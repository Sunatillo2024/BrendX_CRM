from decimal import Decimal
from django.db import IntegrityError, transaction
from rest_framework.test import APITestCase
from apps.authentication.models import User
from apps.products.models import Category, Product, ProductVariant
from apps.sales.models import Sale, SaleItem, Receipt
from apps.finance.models import FinanceEntry
from apps.sales.services import financial_stats
from .models import Store


class MultiStoreTests(APITestCase):
    def setUp(self):
        self.a = Store.objects.create(name='NewMax', code='NEWMAX')
        self.b = Store.objects.create(name='Fashion KG', code='FASHION')
        self.owner_a = self.user('oa', 'owner', self.a)
        self.owner_b = self.user('ob', 'owner', self.b)
        self.cashier = self.user('ca', 'cashier', self.a, '1234')
        self.platform = self.user('platform', 'platform_admin', None)
        self.products = []
        self.variants = []
        self.sales = []
        self.entries = []
        for store, owner in [(self.a, self.owner_a), (self.b, self.owner_b)]:
            cat = Category.objects.create(store=store, name='Футболка')
            product = Product.objects.create(store=store, category=cat, name=store.name,
                barcode='same-product', base_selling_price=100, base_cost_price=40)
            variant = ProductVariant.objects.create(store=store, product=product,
                barcode='same-variant', sku='same-sku', stock_quantity=10)
            sale = Sale.objects.create(store=store, cashier=owner, number=1,
                subtotal=100, total_amount=100, cash_amount=100)
            SaleItem.objects.create(sale=sale, product_variant=variant, product_name=product.name,
                quantity=1, unit_price=100, unit_cost=40)
            Receipt.objects.create(sale=sale, receipt_number='000001')
            expense = FinanceEntry.objects.create(store=store, entry_type='expense', amount=10, created_by=owner)
            self.products.append(product)
            self.variants.append(variant)
            self.sales.append(sale)
            self.entries.append(expense)
        self.client.force_authenticate(self.owner_a)

    def user(self, username, role, store, pin='0808'):
        user = User(username=username, role=role, store=store)
        user.set_password('Test-password!')
        user.set_pin(pin)
        user.save()
        return user

    def test_cross_store_detail_idor(self):
        for url in [f'/api/products/{self.products[1].pk}/',
                    f'/api/products/variants/{self.variants[1].pk}/',
                    f'/api/sales/{self.sales[1].pk}/',
                    f'/api/sales/{self.sales[1].pk}/receipt_data/',
                    f'/api/sales/{self.sales[1].pk}/receipt_pdf/',
                    f'/api/finance/{self.entries[1].pk}/',
                    f'/api/auth/users/{self.owner_b.pk}/']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 404)

    def test_pos_cannot_sell_another_store_variant(self):
        self.client.force_authenticate(self.cashier)
        response = self.client.post('/api/sales/', {'payment_method': 'cash',
            'items': [{'product_variant_id': self.variants[1].pk, 'quantity': 1, 'unit_price': '100'}]}, format='json')
        self.assertEqual(response.status_code, 400)
        self.variants[1].refresh_from_db()
        self.assertEqual(self.variants[1].stock_quantity, 10)

    def test_barcode_lookup_and_search_are_scoped(self):
        lookup = self.client.get('/api/products/by_barcode/', {'code': 'same-variant'})
        self.assertEqual(lookup.data['variant']['id'], self.variants[0].pk)
        search = self.client.get('/api/products/search/', {'q': 'Fashion'})
        self.assertEqual(search.data, [])

    def test_foreign_category_rejected(self):
        response = self.client.post('/api/products/', {'name': 'Attack',
            'category': self.products[1].category_id, 'base_selling_price': '100'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_employee_store_is_server_assigned_and_platform_role_rejected(self):
        response = self.client.post('/api/auth/users/', {'username': 'employee', 'role': 'cashier',
            'pin': '4321', 'store': self.b.pk}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(User.objects.get(username='employee').store_id, self.a.pk)
        response = self.client.post('/api/auth/users/', {'username': 'evil', 'role': 'platform_admin'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_export_has_no_other_store_rows(self):
        response = self.client.get('/api/reports/sales/', {'fmt': 'csv'})
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'NewMax', response.content)
        self.assertNotIn(b'Fashion KG', response.content)

    def test_statistics_use_only_store_and_historical_cost(self):
        stats = financial_stats(store=self.a)
        self.assertEqual(stats['revenue'], Decimal('100'))
        self.assertEqual(stats['cost_of_goods'], Decimal('40'))
        self.assertEqual(stats['net_profit'], Decimal('50'))
        self.products[0].base_cost_price = 90
        self.products[0].save()
        self.assertEqual(financial_stats(store=self.a)['cost_of_goods'], Decimal('40'))

    def test_same_pin_allowed_across_stores_and_context_required(self):
        self.client.force_authenticate(None)
        for code, expected in [('NEWMAX', self.owner_a.pk), ('FASHION', self.owner_b.pk)]:
            response = self.client.post('/api/auth/login/pin/', {'store_code': code, 'pin': '0808'}, format='json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['user']['id'], expected)
        self.assertEqual(self.client.post('/api/auth/login/pin/', {'pin': '0808'}, format='json').status_code, 400)

    def test_platform_endpoints_reject_owner_and_platform_rejects_shop_api(self):
        self.assertEqual(self.client.get('/api/platform/stores/').status_code, 403)
        self.client.force_authenticate(self.platform)
        self.assertEqual(self.client.get('/api/products/').status_code, 403)
        self.assertEqual(self.client.get('/api/platform/dashboard/').status_code, 200)

    def test_atomic_store_first_owner_creation(self):
        self.client.force_authenticate(self.platform)
        response = self.client.post('/api/platform/stores/', {'name': 'Style Shop', 'code': 'STYLE',
            'owner_name': 'Akmal', 'owner_pin': '0808', 'owner_language': 'ru'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        owner = User.objects.get(store__code='STYLE', role='owner')
        self.assertTrue(owner.check_pin('0808'))
        self.assertFalse(owner.is_staff)
        response = self.client.post('/api/platform/stores/', {'name': 'Broken', 'code': 'BROKEN',
            'owner_name': 'Akmal', 'owner_pin': 'x'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Store.objects.filter(code='BROKEN').exists())

    def test_deactivation_blocks_existing_access_refresh_and_login(self):
        self.client.force_authenticate(None)
        tokens = self.client.post('/api/auth/login/pin/', {'store_code': 'NEWMAX', 'pin': '0808'}, format='json').data
        self.a.is_active = False
        self.a.save()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + tokens['access'])
        self.assertEqual(self.client.get('/api/products/').status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post('/api/auth/token/refresh/', {'refresh': tokens['refresh']}, format='json').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/login/pin/', {'store_code': 'NEWMAX', 'pin': '0808'}, format='json').status_code, 400)
        self.a.is_active = True
        self.a.save()
        self.assertEqual(self.client.post('/api/auth/login/pin/', {'store_code': 'NEWMAX', 'pin': '0808'}, format='json').status_code, 200)

    def test_discounted_full_return_has_zero_net_revenue_cogs_and_payments(self):
        sale = self.sales[0]
        sale.discount_amount = 10
        sale.total_amount = 90
        sale.cash_amount = 30
        sale.card_amount = 60
        sale.payment_method = 'mixed'
        sale.save()
        response = self.client.post(f'/api/sales/{sale.pk}/return_items/',
            {'items':[{'sale_item':sale.items.get().pk,'quantity':1}]}, format='json')
        self.assertEqual(response.status_code,201,response.data)
        stats = financial_stats(store=self.a)
        self.assertEqual(stats['net_revenue'],0)
        self.assertEqual(stats['cost_of_goods'],0)
        self.assertEqual(stats['units_sold'],0)
        self.assertEqual(stats['cash_total'],0)
        self.assertEqual(stats['card_total'],0)
        self.assertEqual(stats['net_profit'],-10)
        second = self.client.post(f'/api/sales/{sale.pk}/return_items/',
            {'items':[{'sale_item':sale.items.get().pk,'quantity':1}]}, format='json')
        self.assertEqual(second.status_code,400)

    def test_duplicate_return_lines_roll_back(self):
        sale=self.sales[0]
        row={'sale_item':sale.items.get().pk,'quantity':1}
        response=self.client.post(f'/api/sales/{sale.pk}/return_items/',{'items':[row,row]},format='json')
        self.assertEqual(response.status_code,400)
        self.assertEqual(sale.returns.count(),0)

    def test_foreign_stock_receipt_and_adjustment_are_rejected(self):
        response=self.client.post('/api/inventory/receipts/',{'items':[{'product_variant':self.variants[1].pk,'quantity':2,'cost_price':'10'}]},format='json')
        self.assertEqual(response.status_code,400)
        response=self.client.post('/api/inventory/movements/adjust/',{'product_variant':self.variants[1].pk,'quantity':4},format='json')
        self.assertEqual(response.status_code,400)

    def test_simple_product_and_stock_movement(self):
        response=self.client.post('/api/products/',{'name':'Ремень','barcode':'belt','base_selling_price':'900',
            'variants':[{'color':None,'size':None,'stock_quantity':12}]},format='json')
        self.assertEqual(response.status_code,201,response.data)
        product=Product.objects.get(pk=response.data['id'])
        self.assertEqual(product.total_stock,12)
        self.assertEqual(product.variants.get().movements.get().quantity_change,12)

    def test_failed_nested_product_creation_is_atomic(self):
        foreign=self.products[1]
        response=self.client.post('/api/products/',{'name':'Broken','base_selling_price':'100',
            'variants':[{'id':foreign.variants.get().pk,'color':None,'size':None,'stock_quantity':1}]},format='json')
        self.assertEqual(response.status_code,400)
        self.assertFalse(Product.objects.filter(name='Broken').exists())

    def test_manager_cannot_receive_cost_via_receipts_or_exports(self):
        manager=self.user('ma','manager',self.a,'9988')
        receipt=self.client.post('/api/inventory/receipts/',{'items':[{'product_variant':self.variants[0].pk,'quantity':1,'cost_price':'40'}]},format='json')
        self.assertEqual(receipt.status_code,201)
        self.client.force_authenticate(manager)
        response=self.client.get('/api/inventory/receipts/')
        self.assertNotIn('total_cost',response.data['results'][0])
        self.assertNotIn('cost_price',response.data['results'][0]['items'][0])
        self.assertEqual(self.client.get('/api/reports/receipts/').status_code,403)
        dashboard=self.client.get('/api/sales/dashboard/',{'period':'today'})
        self.assertIsNone(dashboard.data['financial'])

    def test_chart_and_date_range_use_same_store(self):
        response=self.client.get('/api/sales/dashboard/',{'period':'today'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.data['chart']),24)
        self.assertEqual(sum(p['revenue'] for p in response.data['chart']),100)
        self.assertEqual(self.client.get('/api/sales/dashboard/',{'period':'custom','date_from':'2026-10-02','date_to':'2026-10-01'}).status_code,400)

    def test_receipt_uses_store_settings(self):
        self.a.receipt_footer='NewMax thank you'
        self.a.save()
        data=self.client.get(f'/api/sales/{self.sales[0].pk}/receipt_data/').data
        self.assertEqual(data['business_name'],'NewMax')
        self.assertEqual(data['receipt_footer'],'NewMax thank you')
        pdf=self.client.get(f'/api/sales/{self.sales[0].pk}/receipt_pdf/')
        self.assertEqual(pdf.status_code,200)
        self.assertTrue(pdf.content.startswith(b'%PDF'))

    def test_cross_store_write_and_owner_privilege_changes_denied(self):
        self.assertEqual(self.client.patch(f'/api/products/{self.products[1].pk}/',{'name':'attack'},format='json').status_code,404)
        self.assertEqual(self.client.delete(f'/api/finance/{self.entries[1].pk}/').status_code,404)
        self.assertEqual(self.client.patch(f'/api/auth/users/{self.cashier.pk}/',{'role':'platform_admin'},format='json').status_code,400)
        self.assertEqual(self.client.patch(f'/api/auth/users/{self.owner_a.pk}/',{'role':'cashier'},format='json').status_code,403)

    def test_database_requires_store_for_normal_user(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create(username='unscoped', role='cashier')
