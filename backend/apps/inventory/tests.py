"""Inventory tests - goods receipts, stock movements, inventory counts."""
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.authentication.models import User
from apps.products.models import Category, Product, ProductVariant

from .models import StockMovement, StockReceipt


class InventoryBase(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = self._user('owner', User.ROLE_OWNER)
        self.manager = self._user('manager', User.ROLE_MANAGER)
        self.cashier = self._user('cashier', User.ROLE_CASHIER)
        self.auth(self.owner)

        category = Category.objects.create(name='Futbolka')
        self.product = Product.objects.create(
            name='Futbolka Classic', category=category, barcode='2000000000001',
            base_cost_price=20000, base_selling_price=35000,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SKU-1', barcode='2000000000018', stock_quantity=10,
        )

    def _user(self, username, role):
        user = User(username=username, role=role, first_name=username.title())
        user.set_password('StrongPass!234')
        user.set_pin('0000' if role == User.ROLE_OWNER else '1111')
        user.save()
        return user

    def auth(self, user):
        self.client.force_authenticate(user=user)


class StockReceiptTests(InventoryBase):
    def test_receipt_increases_stock_and_records_cost(self):
        response = self.client.post('/api/inventory/receipts/', {
            'notes': 'Yangi partiya',
            'items': [
                {'product_variant': self.variant.pk, 'quantity': 20, 'cost_price': '22000'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 30)
        self.assertEqual(str(self.variant.cost_price), '22000.00')
        self.assertEqual(StockReceipt.objects.count(), 1)
        self.assertEqual(response.data['number'], 1)
        self.assertEqual(response.data['total_quantity'], 20)

    def test_receipt_creates_stock_movement(self):
        self.client.post('/api/inventory/receipts/', {
            'items': [{'product_variant': self.variant.pk, 'quantity': 5, 'cost_price': '1000'}],
        }, format='json')
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, StockMovement.TYPE_PURCHASE)
        self.assertEqual(movement.quantity_before, 10)
        self.assertEqual(movement.quantity_change, 5)
        self.assertEqual(movement.quantity_after, 15)
        self.assertEqual(movement.created_by, self.owner)

    def test_receipt_declares_duplicate_variant_once(self):
        response = self.client.post('/api/inventory/receipts/', {
            'items': [
                {'product_variant': self.variant.pk, 'quantity': 5, 'cost_price': '1000'},
                {'product_variant': self.variant.pk, 'quantity': 5, 'cost_price': '1000'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receipts_are_immutable(self):
        receipt_id = self.client.post('/api/inventory/receipts/', {
            'items': [{'product_variant': self.variant.pk, 'quantity': 5, 'cost_price': '1000'}],
        }, format='json').data['id']
        self.assertEqual(
            self.client.patch(f'/api/inventory/receipts/{receipt_id}/', {}, format='json').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_cashier_cannot_create_receipt(self):
        self.auth(self.cashier)
        response = self.client.post('/api/inventory/receipts/', {
            'items': [{'product_variant': self.variant.pk, 'quantity': 5, 'cost_price': '1000'}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class InventoryCountTests(InventoryBase):
    def test_inventory_count_sets_stock_and_logs_movement(self):
        response = self.client.post('/api/inventory/movements/adjust/', {
            'product_variant': self.variant.pk, 'mode': 'counted', 'quantity': 7,
            'reason': 'inventory', 'notes': 'Sanoq',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 7)
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, StockMovement.TYPE_INVENTORY)
        self.assertEqual(movement.quantity_change, -3)

    def test_delta_adjustment_cannot_go_negative(self):
        response = self.client.post('/api/inventory/movements/adjust/', {
            'product_variant': self.variant.pk, 'mode': 'delta', 'quantity': -25,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 10)

    def test_movement_history_is_readable(self):
        self.client.post('/api/inventory/movements/adjust/', {
            'product_variant': self.variant.pk, 'mode': 'delta', 'quantity': 4,
        }, format='json')
        response = self.client.get('/api/inventory/movements/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


class ValuationTests(InventoryBase):
    def test_owner_sees_valuation(self):
        response = self.client.get('/api/inventory/valuation/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data['total_cost_value']), 200000.0)
        self.assertEqual(float(response.data['total_retail_value']), 350000.0)

    def test_manager_cannot_see_valuation(self):
        self.auth(self.manager)
        response = self.client.get('/api/inventory/valuation/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_cannot_open_inventory(self):
        self.auth(self.cashier)
        response = self.client.get('/api/inventory/movements/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
