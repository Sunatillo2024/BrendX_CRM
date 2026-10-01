from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from unittest import skipUnless
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient
from apps.authentication.models import User
from apps.products.models import Product, ProductVariant
from apps.sales.models import Sale
from .models import Store


@skipUnless(connection.vendor == 'postgresql', 'Requires actual PostgreSQL row locks')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.store = Store.objects.create(name='Concurrent', code='CONCURRENT')
        self.user = User.objects.create_user(store=self.store, username='concurrent', role='owner')
        product = Product.objects.create(store=self.store, name='Last item', barcode='con-product',
            base_selling_price=100, base_cost_price=40)
        self.variant = ProductVariant.objects.create(store=self.store, product=product,
            barcode='con-variant', sku='con-sku', stock_quantity=1)

    def checkout(self, variant_id):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=self.user.pk))
            response = client.post('/api/sales/', {'payment_method':'cash','received_amount':'100',
                'items':[{'product_variant_id':variant_id,'quantity':1,'unit_price':'100'}]}, format='json')
            return response.status_code
        finally:
            close_old_connections()

    def test_two_checkouts_cannot_oversell_last_unit(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes = list(pool.map(self.checkout, [self.variant.pk, self.variant.pk]))
        self.assertEqual(sorted(codes), [201,400])
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity,0)
        self.assertEqual(Sale.objects.count(),1)

    def test_empty_store_parallel_numbering_is_unique(self):
        self.variant.stock_quantity=2
        self.variant.save()
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes = list(pool.map(self.checkout, [self.variant.pk, self.variant.pk]))
        self.assertEqual(codes,[201,201])
        self.assertEqual(set(Sale.objects.values_list('number',flat=True)),{1,2})

    def test_parallel_returns_cannot_refund_twice(self):
        self.assertEqual(self.checkout(self.variant.pk),201)
        sale=Sale.objects.get()
        item_id=sale.items.get().pk
        def refund(_):
            close_old_connections()
            try:
                client=APIClient()
                client.force_authenticate(User.objects.get(pk=self.user.pk))
                return client.post(f'/api/sales/{sale.pk}/return_items/',
                    {'items':[{'sale_item':item_id,'quantity':1}]},format='json').status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(refund,[0,1]))
        self.assertEqual(sorted(codes),[201,400])
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity,1)
        self.assertEqual(sale.returns.get().total_amount,Decimal('100'))
