"""Finance tests - income / expense book and owner-only profit."""
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.authentication.models import User
from apps.stores.models import Store
from apps.products.models import Category, Product, ProductVariant
from apps.sales.models import Sale, SaleItem

from .models import FinanceEntry


class FinanceBase(APITestCase):
    def setUp(self):
        self.store = Store.objects.create(name='Test', code='TEST')
        self.client = APIClient()
        self.owner = self._user('owner', User.ROLE_OWNER)
        self.manager = self._user('manager', User.ROLE_MANAGER)
        self.cashier = self._user('cashier', User.ROLE_CASHIER)
        self.auth(self.owner)

    def _user(self, username, role):
        user = User(store=self.store, username=username, role=role, first_name=username.title())
        user.set_password('StrongPass!234')
        user.set_pin({'owner': '0000', 'manager': '1111', 'cashier': '2222'}[role])
        user.save()
        return user

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def _make_sale(self, total='100000', cost='60000'):
        category = Category.objects.create(store=self.store, name='Futbolka')
        product = Product.objects.create(store=self.store, 
            name='P', category=category, barcode='4000000000001',
            base_cost_price=Decimal(cost), base_selling_price=Decimal(total),
        )
        variant = ProductVariant.objects.create(store=self.store, 
            product=product, sku='SKU-P', barcode='4000000000018', stock_quantity=5,
        )
        sale = Sale.objects.create(store=self.store, 
            number=1, cashier=self.owner, payment_method=Sale.PAYMENT_CASH,
            subtotal=Decimal(total), total_amount=Decimal(total),
            cash_amount=Decimal(total), received_amount=Decimal(total),
        )
        SaleItem.objects.create(
            sale=sale, product_variant=variant, product_name='P', quantity=1,
            unit_price=Decimal(total), unit_cost=Decimal(cost),
        )
        return sale


class ExpenseIncomeTests(FinanceBase):
    def test_owner_creates_expense(self):
        response = self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '13000', 'category': 'Arenda',
            'comment': 'Sentabr ijarasi', 'entry_date': '2026-09-01',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(FinanceEntry.objects.count(), 1)
        self.assertEqual(response.data['created_by_name'], self.owner.display_name)

    def test_owner_creates_income(self):
        response = self.client.post('/api/finance/', {
            'entry_type': 'income', 'amount': '5000', 'category': 'Boshqa',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_manager_may_create_expense(self):
        self.auth(self.manager)
        response = self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '900', 'category': 'Paket',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cashier_cannot_touch_finance(self):
        self.auth(self.cashier)
        self.assertEqual(self.client.get('/api/finance/').status_code,
                         status.HTTP_403_FORBIDDEN)
        response = self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '10',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_cannot_delete_entries(self):
        entry_id = self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '500',
        }, format='json').data['id']
        self.auth(self.manager)
        response = self.client.delete(f'/api/finance/{entry_id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(FinanceEntry.objects.filter(pk=entry_id).exists())

    def test_owner_can_delete_entries(self):
        entry_id = self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '500',
        }, format='json').data['id']
        self.assertEqual(self.client.delete(f'/api/finance/{entry_id}/').status_code,
                         status.HTTP_204_NO_CONTENT)

    def test_creation_is_audited(self):
        from apps.audit.models import AuditLog
        self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '700', 'category': 'Elektr',
        }, format='json')
        self.assertTrue(AuditLog.objects.filter(action=AuditLog.ACTION_EXPENSE_CREATED).exists())


class FinanceSummaryTests(FinanceBase):
    def setUp(self):
        super().setUp()
        self._make_sale(total='150000', cost='92000')
        self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '13000', 'category': 'Arenda',
            'entry_date': str(self._today()),
        }, format='json')

    @staticmethod
    def _today():
        from django.utils import timezone
        return timezone.localdate()

    def test_owner_sees_full_profit_breakdown(self):
        response = self.client.get('/api/finance/summary/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        financial = response.data['financial']
        self.assertEqual(Decimal(financial['revenue']), Decimal('150000.00'))
        self.assertEqual(Decimal(financial['cost_of_goods']), Decimal('92000.00'))
        self.assertEqual(Decimal(financial['gross_profit']), Decimal('58000.00'))
        self.assertEqual(Decimal(financial['expenses']), Decimal('13000.00'))
        self.assertEqual(Decimal(financial['net_profit']), Decimal('45000.00'))

    def test_manager_gets_totals_but_no_profit(self):
        self.auth(self.manager)
        response = self.client.get('/api/finance/summary/', {'period': 'today'})
        self.assertEqual(Decimal(response.data['expense']), Decimal('13000.00'))
        self.assertNotIn('financial', response.data)

    def test_period_filter_excludes_old_entries(self):
        self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '99999', 'entry_date': '2020-01-01',
        }, format='json')
        response = self.client.get('/api/finance/summary/', {'period': 'today'})
        self.assertEqual(Decimal(response.data['expense']), Decimal('13000.00'))

    def test_date_range_filter(self):
        self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '99999', 'entry_date': '2020-01-01',
        }, format='json')
        response = self.client.get('/api/finance/summary/', {
            'date_from': '2020-01-01', 'date_to': '2030-01-01',
        })
        self.assertEqual(Decimal(response.data['expense']), Decimal('112999.00'))

    def test_open_range_returns_everything(self):
        self.client.post('/api/finance/', {
            'entry_type': 'expense', 'amount': '5', 'entry_date': '2020-01-01',
        }, format='json')
        response = self.client.get('/api/finance/summary/', {'date_from': '2020-01-01'})
        self.assertEqual(Decimal(response.data['expense']), Decimal('13005.00'))
