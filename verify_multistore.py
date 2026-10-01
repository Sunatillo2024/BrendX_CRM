#!/usr/bin/env python3
"""Smoke test for the multi-store platform stack (stdlib only).

Run against a freshly provisioned stack:
    python3 verify_multistore.py
Base URL: http://localhost:8000 (API) and http://localhost:4200 (web).
"""
import json
import sys
import urllib.error
import urllib.request
import uuid

API = 'http://localhost:8000/api'
WEB = 'http://localhost:4200'
PLATFORM_PIN = '0808'
SUFFIX = uuid.uuid4().hex[:6]  # rerun-safe barcodes

results = []


def call(method, path, body=None, token=None, raw=False, base=API):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            payload = res.read()
            return res.status, (payload if raw else json.loads(payload or b'{}'))
    except urllib.error.HTTPError as exc:
        payload = exc.read()
        try:
            return exc.code, json.loads(payload or b'{}')
        except ValueError:
            return exc.code, payload


def check(name, ok, extra=''):
    results.append((name, bool(ok), extra))
    print(('PASS  ' if ok else 'FAIL  ') + name + (f'  {extra}' if extra else ''))


def main():
    # 1. Web app is served
    status, _ = call('GET', '/', base=WEB, raw=True)
    check('web app responds', status == 200, str(status))

    # 2. Platform administrator PIN login
    status, data = call('POST', '/auth/login/pin/',
                        {'pin': PLATFORM_PIN, 'platform': True})
    check('platform PIN login', status == 200 and data.get('user', {}).get('role') == 'platform_admin',
          str(status))
    if status != 200:
        return finish()
    admin_token = data['access']

    # 3. Platform dashboard counts
    status, dash = call('GET', '/platform/dashboard/', token=admin_token)
    check('platform dashboard', status == 200 and 'total_stores' in dash, str(status))

    # 4. Create two isolated stores, each with its own owner
    stores = {}
    for name, code in [('NewMax', 'NEWMAX'), ('Fashion KG', 'FASHION')]:
        status, store = call('POST', '/platform/stores/', {
            'name': name, 'code': code, 'owner_name': code.title(),
            'owner_pin': '0808', 'owner_language': 'ru',
        }, token=admin_token)
        if status == 400 and 'already exists' in str(store):
            status, listing = call('GET', f'/platform/stores/?search={code}', token=admin_token)
            found = [row for row in listing.get('results', []) if row['code'] == code]
            status, store = 201, (found[0] if found else {'code': code})
        check(f'store {code} provisioned (store + owner transaction)',
              status in (200, 201), str(status))
        stores[code] = store.get('id')

    # 5. Owners log in through their store link with the SAME pin
    tokens = {}
    for code in stores:
        status, data = call('POST', '/auth/login/pin/', {'store_code': code, 'pin': '0808'})
        check(f'{code} owner login via /store/{code}/login', status == 200, str(status))
        if status == 200:
            tokens[code] = data['access']

    if len(tokens) != 2:
        return finish()
    token_a, token_b = tokens['NEWMAX'], tokens['FASHION']

    # 6. Owner A must not reach platform endpoints
    status, _ = call('GET', '/platform/stores/', token=token_a)
    check('owner blocked from platform API', status == 403, str(status))

    # 7. Owner A creates a category + simple product with stock
    status, category = call('POST', '/products/categories/', {'name': 'Футболка'}, token=token_a)
    check('owner creates category in own store', status == 201, str(status))
    status, product = call('POST', '/products/', {
        'name': 'Футболка Classic', 'category': category.get('id'),
        'barcode': f'smoke-newmax-{SUFFIX}', 'base_selling_price': '2300',
        'base_cost_price': '1500',
        'variants': [{'color': None, 'size': None, 'barcode': '', 'stock_quantity': 5}],
    }, token=token_a)
    check('owner creates simple product with stock movement', status == 201, str(status))

    # 8. The same barcode is allowed in the other store (store-aware uniqueness)
    status, other = call('POST', '/products/', {
        'name': 'Футболка Classic', 'barcode': f'smoke-newmax-{SUFFIX}',
        'base_selling_price': '2300',
        'variants': [{'color': None, 'size': None, 'barcode': '', 'stock_quantity': 3}],
    }, token=token_b)
    check('duplicate barcode allowed across stores', status == 201, str(status))

    # 9. Cross-store read: owner A must not see store B product (404)
    if status == 201:
        status_b, product_b = call('GET', f"/products/{other.get('id')}/", token=token_a)
        check('cross-store product detail is 404', status_b == 404, str(status_b))

    # 10. POS checkout in store A
    search_status, rows = call('GET', f'/products/search/?q=smoke-newmax-{SUFFIX}', token=token_a)
    variant_id = rows[0]['id'] if search_status == 200 and rows else None
    status, sale = call('POST', '/sales/', {
        'payment_method': 'cash', 'received_amount': '5000',
        'items': [{'product_variant_id': variant_id, 'quantity': 1, 'unit_price': '2300'}],
    }, token=token_a)
    check('POS checkout in NewMax', status == 201, str(status))
    if status == 201:
        check('change calculated', sale.get('change_amount') == '2700.00',
              str(sale.get('change_amount')))
        status, pdf = call('GET', f"/sales/{sale['id']}/receipt_pdf/?lang=ru",
                           token=token_a, raw=True)
        check('store receipt PDF', status == 200 and pdf[:4] == b'%PDF', str(status))
        status, receipt = call('GET', f"/sales/{sale['id']}/receipt_data/", token=token_a)
        check('receipt uses store name', receipt.get('business_name') == 'NewMax',
              str(receipt.get('business_name')))

    # 11. Export from store A must not contain store B rows
    status, csv = call('GET', '/reports/sales/?period=all&fmt=csv&lang=ru',
                       token=token_a, raw=True)
    text = csv.decode('utf-8', 'ignore') if isinstance(csv, bytes) else ''
    check('export scoped to own store', status == 200 and 'Fashion KG' not in text,
          str(status))

    # 12. Statistics are store-scoped and role-filtered
    status, dash_a = call('GET', '/sales/dashboard/?period=today', token=token_a)
    check('owner dashboard has financial block', status == 200 and dash_a.get('financial'),
          str(status))
    status, dash_b = call('GET', '/sales/dashboard/?period=today', token=token_b)
    same = dash_b.get('operational', {}).get('sales_count') == dash_a.get(
        'operational', {}).get('sales_count')
    check('other store sees no NewMax sales', status == 200 and not same, str(status))

    # 13. Store deactivation blocks login and existing tokens
    status, store_row = call('GET', f"/platform/stores/{stores['NEWMAX']}/",
                             token=admin_token)
    status, _ = call('PATCH', f"/platform/stores/{stores['NEWMAX']}/",
                     {'is_active': False}, token=admin_token)
    check('platform deactivates store', status == 200, str(status))
    status, _ = call('GET', '/products/', token=token_a)
    check('deactivated store token rejected', status in (401, 403), str(status))
    status, _ = call('POST', '/auth/login/pin/', {'store_code': 'NEWMAX', 'pin': '0808'})
    check('deactivated store login rejected', status in (400, 403), str(status))
    call('PATCH', f"/platform/stores/{stores['NEWMAX']}/", {'is_active': True},
         token=admin_token)
    status, _ = call('POST', '/auth/login/pin/', {'store_code': 'NEWMAX', 'pin': '0808'})
    check('reactivation restores access', status == 200, str(status))

    # 14. Technical Django admin keeps its PIN pad
    status, page = call('GET', '/admin/login/', base='http://localhost:8000', raw=True)
    html = page.decode('utf-8', 'ignore') if isinstance(page, bytes) else ''
    check('admin PIN login page', status == 200 and 'name="pin"' in html, str(status))

    return finish()


def finish():
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print('FAILED: ' + ', '.join(r[0] for r in failed))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
