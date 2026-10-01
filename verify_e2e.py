"""
End-to-end smoke test against the running Docker stack (through nginx).
Run:  python3 verify_e2e.py
"""
import json
import urllib.error
import urllib.request

BASE = 'http://localhost:4200/api'
ok, failed = [], []


def call(method, path, data=None, token=None, raw=False):
    url = f'{BASE}{path}'
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as res:
            payload = res.read()
            return res.status, (payload if raw else json.loads(payload or b'{}'))
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        try:
            return exc.code, json.loads(payload or b'{}')
        except json.JSONDecodeError:
            return exc.code, payload


def check(name, condition, detail=''):
    (ok if condition else failed).append(name)
    mark = 'OK  ' if condition else 'FAIL'
    print(f'[{mark}] {name}{(" - " + str(detail)) if detail and not condition else ""}')


# 1. PIN login
status, login = call('POST', '/auth/login/pin/', {'pin': '0808'})
check('PIN login works (owner)', status == 200 and 'access' in login, login)
token = login.get('access')
check('owner role returned', login.get('user', {}).get('role') == 'owner')

# 2. Wrong PIN
status, wrong = call('POST', '/auth/login/pin/', {'pin': '9999'})
check('wrong PIN rejected', status == 400)

# 3. Public registration is gone
status, _ = call('POST', '/auth/register/', {'username': 'hacker'})
check('public registration removed', status == 404, status)

# 4. Categories seeded (no hardcoded list in code)
status, cats = call('GET', '/products/categories/?page_size=50', token=token)
check('seeded categories available', status == 200 and cats['count'] >= 9, cats.get('count'))
category_id = cats['results'][0]['id']

# 5. Create a product with variants (no Brand field anywhere)
status, product = call('POST', '/products/', {
    'name': 'Futbolka Classic', 'category': category_id,
    'base_cost_price': '20000', 'base_selling_price': '35000',
    'variants': [
        {'color': None, 'size': None, 'stock_quantity': 5},
        {'color': None, 'size': None, 'stock_quantity': 3},
    ],
}, token=token)
check('product created from category only', status == 201, product)
check('barcode generated', bool(product.get('barcode')))
check('no brand concept', 'brand' not in json.dumps(product).lower())
variant_id = product['variants'][0]['id']

# 6. Duplicate barcode rejected
status, dup = call('POST', '/products/', {
    'name': 'Copy', 'category': category_id, 'barcode': product['barcode'],
    'base_selling_price': '1000', 'variants': [],
}, token=token)
check('duplicate barcode rejected', status == 400, dup)

# 7. Search by name and barcode
status, by_name = call('GET', '/products/search/?q=classic', token=token)
check('search by name', status == 200 and len(by_name) == 2)
status, by_code = call('GET', f"/products/search/?q={product['variants'][0]['barcode']}",
                       token=token)
check('search by barcode', status == 200 and len(by_code) == 1)

# 8. Goods receipt (kirim) increases stock
status, receipt = call('POST', '/inventory/receipts/', {
    'notes': 'E2E kirim',
    'items': [{'product_variant': variant_id, 'quantity': 10, 'cost_price': '21000'}],
}, token=token)
check('stock receipt created', status == 201, receipt)
status, variants = call('GET', f'/products/variants/?product={product["id"]}', token=token)
stock_after = next(v['stock_quantity'] for v in variants['results'] if v['id'] == variant_id)
check('receipt increased stock (5 -> 15)', stock_after == 15, stock_after)
check('receipt number is sequential', receipt.get('number') == 1, receipt.get('number'))

# 9. Sale: cash with change
status, sale = call('POST', '/sales/', {
    'payment_method': 'cash',
    'items': [{'product_variant_id': variant_id, 'quantity': 2,
               'unit_price': '35000', 'discount_percent': 0}],
    'received_amount': '100000',
}, token=token)
check('cash sale created', status == 201, sale)
check('total = 70000', float(sale.get('total_amount', 0)) == 70000)
check('change = 30000 (received - total)', float(sale.get('change_amount', 0)) == 30000)
check('receipt number 000001', sale.get('sale_number') == '000001', sale.get('sale_number'))

# 10. Cash sale rejected when received is too small
status, short = call('POST', '/sales/', {
    'payment_method': 'cash',
    'items': [{'product_variant_id': variant_id, 'quantity': 1,
               'unit_price': '35000', 'discount_percent': 0}],
    'received_amount': '1000',
}, token=token)
check('insufficient cash rejected', status == 400, short)

# 11. Cannot oversell
status, over = call('POST', '/sales/', {
    'payment_method': 'card',
    'items': [{'product_variant_id': variant_id, 'quantity': 999,
               'unit_price': '35000', 'discount_percent': 0}],
}, token=token)
check('overselling blocked', status == 400, over)

# 12. Stock decreased by the sale
status, variants = call('GET', f'/products/variants/?product={product["id"]}', token=token)
stock_now = next(v['stock_quantity'] for v in variants['results'] if v['id'] == variant_id)
check('sale reduced stock (15 -> 13)', stock_now == 13, stock_now)

# 13. Stock movement trail exists
status, movements = call('GET', '/inventory/movements/', token=token)
types = sorted({m['movement_type'] for m in movements['results']})
check('stock movements recorded (purchase + sale)', types == ['purchase', 'sale'], types)

# 14. Receipt PDF
status, pdf = call('GET', f"/sales/{sale['id']}/receipt_pdf/?lang=uz", token=token, raw=True)
check('receipt PDF generated', status == 200 and pdf.startswith(b'%PDF'))

# 15. Return restores stock
sale_item_id = sale['items'][0]['id']
status, ret = call('POST', f"/sales/{sale['id']}/return_items/", {
    'reason': 'size', 'items': [{'sale_item': sale_item_id, 'quantity': 1}],
}, token=token)
check('return created', status == 201, ret)
status, variants = call('GET', f'/products/variants/?product={product["id"]}', token=token)
stock_ret = next(v['stock_quantity'] for v in variants['results'] if v['id'] == variant_id)
check('return restored stock (13 -> 14)', stock_ret == 14, stock_ret)

# 16. Dashboard (owner gets profit)
status, dash = call('GET', '/sales/dashboard/?period=today', token=token)
check('dashboard loaded', status == 200)
check('owner sees revenue', float(dash['operational']['revenue']) == 70000)
check('owner sees net profit', dash.get('financial') is not None and
      float(dash['financial']['net_profit']) != 0)

# 17. Finance: expense + income summary
status, expense = call('POST', '/finance/', {
    'entry_type': 'expense', 'amount': '13000', 'category': 'Arenda',
    'entry_date': dash['period']['start'],
}, token=token)
check('expense created', status == 201, expense)
status, fin_sum = call('GET', '/finance/summary/?period=today', token=token)
check('owner sees net profit incl. expenses',
      float(fin_sum['financial']['expenses']) == 13000, fin_sum.get('financial'))

# 18. Exports
status, xlsx = call('GET', '/reports/sales/?period=today&fmt=xlsx', token=token, raw=True)
check('sales Excel export', status == 200 and xlsx[:2] == b'PK', status)
status, csv_data = call('GET', '/reports/stock/?period=today&fmt=csv&lang=ru',
                        token=token, raw=True)
check('stock CSV export with BOM', status == 200 and csv_data.startswith(b'\xef\xbb\xbf'))
status, fs = call('GET', '/reports/financial-summary/?period=today', token=token, raw=True)
check('owner financial report', status == 200 and fs[:2] == b'PK')

# 19. Create a manager and verify the API hides cost/profit
status, manager = call('POST', '/auth/users/', {
    'username': 'mgr_e2e', 'first_name': 'Manager', 'role': 'manager',
    'pin': '4321', 'password': 'StrongPass!234',
}, token=token)
check('owner created employee', status == 201, manager)

status, mlogin = call('POST', '/auth/login/pin/', {'pin': '4321'})
check('manager PIN login', status == 200 and mlogin['user']['role'] == 'manager')
mtoken = mlogin['access']

status, mdetail = call('GET', f"/sales/{sale['id']}/", token=mtoken)
check('manager gets NO profit from API', mdetail.get('profit') is None,
      mdetail.get('profit'))
check('manager gets NO unit_cost', 'unit_cost' not in mdetail['items'][0])
status, mproduct = call('GET', f"/products/{product['id']}/", token=mtoken)
check('manager gets NO cost price in products', 'base_cost_price' not in mproduct)
status, mval = call('GET', '/inventory/valuation/', token=mtoken)
check('manager blocked from valuation', mval if status == 403 else status == 403)
status, mfs = call('GET', '/reports/financial-summary/', token=mtoken)
check('manager blocked from financial report', status == 403)
status, mdash = call('GET', '/sales/dashboard/?period=today', token=mtoken)
check('manager dashboard has no financial block',
      mdash.get('financial') is None and mdash.get('operational') is not None)

# 20. Cashier restrictions
status, cashier = call('POST', '/auth/users/', {
    'username': 'cash_e2e', 'first_name': 'Cashier', 'role': 'cashier',
    'pin': '5566', 'password': 'StrongPass!234',
}, token=token)
check('owner created cashier', status == 201, cashier)
status, clogin = call('POST', '/auth/login/pin/', {'pin': '5566'})
ctoken = clogin['access']
status, cdash = call('GET', '/sales/dashboard/?period=today', token=ctoken)
check('cashier dashboard limited to own sales', 'operational' not in cdash and
      'my_sales' in cdash)
status, cmov = call('GET', '/inventory/movements/', token=ctoken)
check('cashier blocked from stock', status == 403)
status, cfin = call('GET', '/finance/', token=ctoken)
check('cashier blocked from finance', status == 403)

# 21. PIN lockout after repeated failures
codes = [call('POST', '/auth/login/pin/', {'pin': '0000'})[0] for _ in range(6)]
check('PIN throttling kicks in (429)', 429 in codes, codes)

print()
print(f'PASSED: {len(ok)}   FAILED: {len(failed)}')
if failed:
    print('Failures:')
    for name in failed:
        print(f'  - {name}')
    raise SystemExit(1)
print('ALL E2E CHECKS PASSED')
