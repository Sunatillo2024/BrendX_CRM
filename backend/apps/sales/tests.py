"""Sales tests - POS checkout, change calculation, stock, receipts, returns."""
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.authentication.models import User
from apps.stores.models import Store
from apps.inventory.models import StockMovement
from apps.products.models import Category, Color, Product, ProductVariant, Size

from .models import Receipt, Sale, SaleReturn


class SaleBase(APITestCase):
    def setUp(self):
        self.store = Store.objects.create(name='Test', code='TEST')
        self.client = APIClient()
        self.owner = self._user('owner', User.ROLE_OWNER)
        self.manager = self._user('manager', User.ROLE_MANAGER)
        self.cashier = self._user('cashier', User.ROLE_CASHIER)
        self.auth(self.cashier)

        category = Category.objects.create(store=self.store, name='Futbolka')
        black = Color.objects.create(store=self.store, name='Qora', hex_code='#000000')
        medium = Size.objects.create(store=self.store, name='M', size_type='letter')
        self.product = Product.objects.create(store=self.store, 
            name='Futbolka Classic', category=category, barcode='3000000000001',
            base_cost_price=2000, base_selling_price=2300,
        )
        self.variant = ProductVariant.objects.create(store=self.store, 
            product=self.product, color=black, size=medium,
            sku='SKU-M', barcode='3000000000018', stock_quantity=10,
        )

    def _user(self, username, role):
        user = User(store=self.store, username=username, role=role, first_name=username.title())
        user.set_password('StrongPass!234')
        user.set_pin({'owner': '0000', 'manager': '1111', 'cashier': '2222'}[role])
        user.save()
        return user

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def payload(self, **overrides):
        data = {
            'payment_method': 'cash',
            'items': [{
                'product_variant_id': self.variant.pk,
                'quantity': 2,
                'unit_price': '2300',
                'discount_percent': '0',
            }],
            'received_amount': '5000',
        }
        data.update(overrides)
        return data

    def sell(self, **overrides):
        response = self.client.post('/api/sales/', self.payload(**overrides), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response


class CheckoutTests(SaleBase):
    def test_cash_sale_calculates_change(self):
        response = self.sell()
        # 2 x 2300 = 4600, customer handed over 5000 -> change 400
        self.assertEqual(Decimal(response.data['total_amount']), Decimal('4600.00'))
        self.assertEqual(Decimal(response.data['received_amount']), Decimal('5000.00'))
        self.assertEqual(Decimal(response.data['change_amount']), Decimal('400.00'))
        self.assertEqual(Decimal(response.data['cash_amount']), Decimal('4600.00'))
        self.assertEqual(Decimal(response.data['card_amount']), Decimal('0.00'))

    def test_cash_sale_rejected_when_received_is_too_small(self):
        response = self.client.post('/api/sales/', self.payload(received_amount='1000'),
                                    format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Sale.objects.count(), 0)

    def test_cash_sale_without_received_amount_falls_back_to_total(self):
        response = self.sell(received_amount='0')
        self.assertEqual(Decimal(response.data['change_amount']), Decimal('0.00'))
        self.assertEqual(Decimal(response.data['cash_amount']), Decimal('4600.00'))

    def test_card_sale(self):
        response = self.sell(payment_method='card', received_amount='0')
        self.assertEqual(Decimal(response.data['card_amount']), Decimal('4600.00'))
        self.assertEqual(Decimal(response.data['cash_amount']), Decimal('0.00'))
        self.assertEqual(Decimal(response.data['change_amount']), Decimal('0.00'))

    def test_mixed_sale_splits_cash_and_card(self):
        response = self.sell(payment_method='mixed', received_amount='3000',
                             card_amount='2000')
        self.assertEqual(Decimal(response.data['card_amount']), Decimal('2000.00'))
        self.assertEqual(Decimal(response.data['cash_amount']), Decimal('2600.00'))
        self.assertEqual(Decimal(response.data['change_amount']), Decimal('400.00'))

    def test_mixed_sale_rejected_when_total_short(self):
        response = self.client.post('/api/sales/', self.payload(
            payment_method='mixed', received_amount='1000', card_amount='1000'
        ), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sale_reduces_stock_and_logs_movement(self):
        self.sell()
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 8)
        movement = StockMovement.objects.get()
        self.assertEqual(movement.movement_type, StockMovement.TYPE_SALE)
        self.assertEqual(movement.quantity_change, -2)
        self.assertEqual(movement.quantity_after, 8)

    def test_cannot_sell_more_than_stock(self):
        response = self.client.post('/api/sales/', self.payload(
            items=[{'product_variant_id': self.variant.pk, 'quantity': 99,
                    'unit_price': '2300', 'discount_percent': '0'}]
        ), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 10)
        self.assertEqual(Sale.objects.count(), 0)

    def test_discount_is_applied(self):
        response = self.sell(discount_amount='600')
        self.assertEqual(Decimal(response.data['total_amount']), Decimal('4000.00'))

    def test_receipt_is_created(self):
        response = self.sell()
        self.assertEqual(Receipt.objects.count(), 1)
        receipt = Receipt.objects.get()
        self.assertEqual(receipt.receipt_number, response.data['sale_number'])
        self.assertEqual(receipt.sale_id, response.data['id'])

    def test_receipt_numbers_are_sequential(self):
        first = self.sell()
        second = self.sell()
        self.assertEqual(first.data['number'], 1)
        self.assertEqual(second.data['number'], 2)
        self.assertEqual(second.data['sale_number'], '000002')

    def test_sale_records_the_cashier(self):
        response = self.sell()
        self.assertEqual(response.data['cashier'], self.cashier.pk)
        self.assertEqual(response.data['cashier_name'], self.cashier.display_name)

    def test_sale_is_immutable(self):
        sale_id = self.sell().data['id']
        self.assertEqual(
            self.client.put(f'/api/sales/{sale_id}/', {}, format='json').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        self.assertEqual(
            self.client.delete(f'/api/sales/{sale_id}/').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_receipt_pdf_is_generated(self):
        sale_id = self.sell().data['id']
        response = self.client.get(f'/api/sales/{sale_id}/receipt_pdf/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_receipt_data_endpoint(self):
        sale_id = self.sell().data['id']
        response = self.client.get(f'/api/sales/{sale_id}/receipt_data/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('sale', response.data)
        self.assertIn('business_name', response.data)


class SaleHistoryTests(SaleBase):
    def test_history_persists_and_filters_by_period(self):
        self.sell()
        response = self.client.get('/api/sales/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['item_count'], 2)

    def test_filter_by_payment_method(self):
        self.sell()
        self.sell(payment_method='card', received_amount='0')
        filtered = self.client.get('/api/sales/', {'payment_method': 'card'})
        self.assertEqual(filtered.data['count'], 1)

    def test_cashier_only_sees_own_sales(self):
        self.sell()
        self.auth(self.owner)
        self.client.post('/api/sales/', self.payload(), format='json')
        self.auth(self.cashier)
        response = self.client.get('/api/sales/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['cashier_name'], self.cashier.display_name)


class ReturnTests(SaleBase):
    def setUp(self):
        super().setUp()
        sale = self.sell().data
        self.sale_id = sale['id']
        self.sale_item_id = sale['items'][0]['id']
        # Returns are an owner/manager operation.
        self.auth(self.owner)

    def test_return_restores_stock(self):
        response = self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'reason': 'size', 'items': [{'sale_item': self.sale_item_id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 9)
        self.assertEqual(SaleReturn.objects.count(), 1)
        movement = StockMovement.objects.filter(
            movement_type=StockMovement.TYPE_RETURN
        ).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.quantity_change, 1)

    def test_full_return_marks_sale_refunded(self):
        self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 2}],
        }, format='json')
        sale = Sale.objects.get(pk=self.sale_id)
        self.assertEqual(sale.status, Sale.STATUS_REFUNDED)
        self.assertTrue(Sale.objects.filter(pk=self.sale_id).exists())

    def test_partial_return_marks_sale_partially_refunded(self):
        self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 1}],
        }, format='json')
        sale = Sale.objects.get(pk=self.sale_id)
        self.assertEqual(sale.status, Sale.STATUS_PARTIALLY_REFUNDED)

    def test_cannot_return_more_than_sold(self):
        response = self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 5}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleReturn.objects.count(), 0)

    def test_cashier_cannot_process_return(self):
        self.auth(self.cashier)
        response = self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_process_return(self):
        self.auth(self.manager)
        response = self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_return_history_endpoint(self):
        self.auth(self.manager)
        self.client.post(f'/api/sales/{self.sale_id}/return_items/', {
            'items': [{'sale_item': self.sale_item_id, 'quantity': 1}],
        }, format='json')
        response = self.client.get('/api/sales/returns/')
        self.assertEqual(response.data['count'], 1)


class PermissionTests(SaleBase):
    def test_owner_sees_cost_and_profit(self):
        sale_id = self.sell().data['id']
        self.auth(self.owner)
        response = self.client.get(f'/api/sales/{sale_id}/')
        self.assertEqual(Decimal(response.data['total_cost']), Decimal('4000.00'))
        self.assertEqual(Decimal(response.data['profit']), Decimal('600.00'))
        self.assertIn('unit_cost', response.data['items'][0])

    def test_manager_does_not_get_profit_from_api(self):
        """Requirement 19: manager must not receive profit through the API."""
        sale_id = self.sell().data['id']
        self.auth(self.manager)
        response = self.client.get(f'/api/sales/{sale_id}/')
        self.assertIsNone(response.data['profit'])
        self.assertIsNone(response.data['total_cost'])
        self.assertNotIn('unit_cost', response.data['items'][0])

    def test_cashier_does_not_get_profit_from_api(self):
        sale_id = self.sell().data['id']
        response = self.client.get(f'/api/sales/{sale_id}/')
        self.assertIsNone(response.data['profit'])
        self.assertNotIn('unit_cost', response.data['items'][0])


class DashboardTests(SaleBase):
    def test_owner_dashboard_has_full_financials(self):
        self.sell()
        self.auth(self.owner)
        response = self.client.get('/api/sales/dashboard/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], User.ROLE_OWNER)
        self.assertEqual(Decimal(response.data['operational']['revenue']), Decimal('4600.00'))
        self.assertIn('financial', response.data)
        self.assertEqual(Decimal(response.data['financial']['cost_of_goods']), Decimal('4000.00'))
        self.assertEqual(Decimal(response.data['financial']['gross_profit']), Decimal('600.00'))

    def test_manager_dashboard_has_no_financial_block(self):
        """Requirement 20: manager gets operational numbers only."""
        self.sell()
        self.auth(self.manager)
        response = self.client.get('/api/sales/dashboard/', {'period': 'today'})
        self.assertIsNone(response.data['financial'])
        self.assertEqual(Decimal(response.data['operational']['revenue']), Decimal('4600.00'))
        self.assertEqual(Decimal(response.data['operational']['cash_total']), Decimal('4600.00'))

    def test_cashier_dashboard_is_limited_to_own_sales(self):
        self.sell()
        response = self.client.get('/api/sales/dashboard/', {'period': 'today'})
        self.assertNotIn('operational', response.data)
        self.assertEqual(response.data['my_sales']['sales_count'], 1)

    def test_dashboard_counts_payment_methods(self):
        self.sell()
        self.sell(payment_method='card', received_amount='0')
        self.auth(self.owner)
        response = self.client.get('/api/sales/dashboard/', {'period': 'today'})
        self.assertEqual(Decimal(response.data['operational']['cash_total']), Decimal('4600.00'))
        self.assertEqual(Decimal(response.data['operational']['card_total']), Decimal('4600.00'))
        self.assertEqual(response.data['operational']['sales_count'], 2)

    def test_dashboard_average_check(self):
        self.sell()
        self.sell()
        self.auth(self.owner)
        response = self.client.get('/api/sales/dashboard/', {'period': 'today'})
        self.assertEqual(Decimal(response.data['operational']['average_check']), Decimal('4600.00'))
