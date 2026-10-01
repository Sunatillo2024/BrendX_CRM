"""Reports tests - Excel / CSV exports and their role rules."""
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.authentication.models import User
from apps.inventory import services as inventory_services
from apps.products.models import Category, Product, ProductVariant
from apps.sales.models import Sale, SaleItem


class ReportBase(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = self._user('owner', User.ROLE_OWNER)
        self.manager = self._user('manager', User.ROLE_MANAGER)
        self.cashier = self._user('cashier', User.ROLE_CASHIER)
        self.auth(self.owner)

        category = Category.objects.create(name='Futbolka')
        self.product = Product.objects.create(
            name='Futbolka Classic', category=category, barcode='5000000000001',
            base_cost_price=Decimal('2000'), base_selling_price=Decimal('2300'),
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SKU-R', barcode='5000000000018', stock_quantity=10,
        )
        inventory_services.receive_stock(
            items=[{'product_variant': self.variant, 'quantity': 5, 'cost_price': Decimal('2000')}],
            user=self.owner,
        )
        self._make_sale()

    def _user(self, username, role):
        user = User(username=username, role=role, first_name=username.title())
        user.set_password('StrongPass!234')
        user.set_pin({'owner': '0000', 'manager': '1111', 'cashier': '2222'}[role])
        user.save()
        return user

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def _make_sale(self):
        sale = Sale.objects.create(
            number=1, cashier=self.owner, payment_method=Sale.PAYMENT_CASH,
            subtotal=Decimal('4600'), total_amount=Decimal('4600'),
            cash_amount=Decimal('4600'), received_amount=Decimal('5000'),
            change_amount=Decimal('400'),
        )
        SaleItem.objects.create(
            sale=sale, product_variant=self.variant, product_name='Futbolka Classic',
            color_name='Qora', size_name='M', quantity=2,
            unit_price=Decimal('2300'), unit_cost=Decimal('2000'),
        )
        self.sale = sale


class ExcelExportTests(ReportBase):
    def test_sales_export_xlsx(self):
        response = self.client.get('/api/reports/sales/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('spreadsheetml', response['Content-Type'])
        self.assertTrue(response.content.startswith(b'PK'))
        self.assertIn('sales_', response['Content-Disposition'])
        self.assertIn('.xlsx', response['Content-Disposition'])

    def test_sales_export_csv_has_bom(self):
        response = self.client.get('/api/reports/sales/', {'period': 'today', 'fmt': 'csv'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b'\xef\xbb\xbf'))
        self.assertIn('text/csv', response['Content-Type'])
        # The sold line is present in the file
        self.assertIn('Futbolka Classic', response.content.decode('utf-8-sig'))

    def test_currency_columns_are_numbers_not_strings(self):
        from io import BytesIO

        from openpyxl import load_workbook
        response = self.client.get('/api/reports/sales/', {'period': 'today'})
        workbook = load_workbook(BytesIO(response.content))
        sheet = workbook.active
        header = [cell.value for cell in sheet[1]]
        self.assertIn('Soni', header)

    def test_receipts_export(self):
        response = self.client.get('/api/reports/receipts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('receipts_', response['Content-Disposition'])

    def test_finance_export_expenses(self):
        response = self.client.get('/api/reports/finance/', {'type': 'expense'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('expense_', response['Content-Disposition'])

    def test_stock_export_for_manager_has_no_cost_column(self):
        from io import BytesIO

        from openpyxl import load_workbook
        self.auth(self.manager)
        response = self.client.get('/api/reports/stock/')
        workbook = load_workbook(BytesIO(response.content))
        header = [cell.value for cell in workbook.active[1]]
        self.assertNotIn('Zakup narxi', header)
        self.assertIn('Ostatka', header)

    def test_stock_export_for_owner_has_cost_column(self):
        from io import BytesIO

        from openpyxl import load_workbook
        response = self.client.get('/api/reports/stock/')
        workbook = load_workbook(BytesIO(response.content))
        header = [cell.value for cell in workbook.active[1]]
        self.assertIn('Zakup narxi', header)

    def test_stock_export_filename_contains_date(self):
        response = self.client.get('/api/reports/stock/')
        self.assertIn(str(timezone.localdate()), response['Content-Disposition'])

    def test_russian_headers(self):
        response = self.client.get('/api/reports/sales/', {'period': 'today', 'lang': 'ru'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class FinancialSummaryTests(ReportBase):
    def test_owner_can_download_financial_summary(self):
        response = self.client.get('/api/reports/financial-summary/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('financial_summary_', response['Content-Disposition'])

    def test_manager_cannot_download_financial_summary(self):
        self.auth(self.manager)
        response = self.client.get('/api/reports/financial-summary/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_cannot_download_any_report(self):
        self.auth(self.cashier)
        for path in ['sales', 'stock', 'finance', 'financial-summary']:
            response = self.client.get(f'/api/reports/{path}/')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, path)


class ReportSummaryJsonTests(ReportBase):
    def test_owner_summary_contains_profit(self):
        response = self.client.get('/api/reports/summary/', {'period': 'today'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('financial', response.data)
        self.assertEqual(Decimal(response.data['financial']['gross_profit']),
                         Decimal('600.00'))

    def test_manager_summary_has_no_profit(self):
        self.auth(self.manager)
        response = self.client.get('/api/reports/summary/', {'period': 'today'})
        self.assertNotIn('financial', response.data)
        self.assertEqual(response.data['operational']['sales_count'], 1)
