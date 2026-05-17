"""Sales Views - POS processing, receipt generation, and sales analytics"""
import io
from decimal import Decimal
from datetime import datetime, date, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.units import cm
from reportlab.lib import colors

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrManager, IsAuthenticatedWithRole
from apps.customers.models import Customer, CustomerTransaction, InstallmentPlan
from apps.products.models import ProductVariant
from apps.inventory.models import StockItem
from .models import Sale, SaleItem, Receipt
from .serializers import (
    SaleSerializer, SaleListSerializer, SaleCreateSerializer, ReceiptSerializer
)


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.select_related(
        'customer', 'cashier'
    ).prefetch_related('items__product_variant__product').order_by('-created_at')
    search_fields = ['sale_number', 'customer__name', 'cashier__username']
    filterset_fields = ['sale_type', 'status', 'customer']
    ordering_fields = ['created_at', 'total_amount']

    def get_serializer_class(self):
        if self.action == 'list':
            return SaleListSerializer
        if self.action == 'create':
            return SaleCreateSerializer
        return SaleSerializer

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Process a complete POS sale (cash/credit/installment)."""
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        customer = None
        if data.get('customer_id'):
            try:
                customer = Customer.objects.get(pk=data['customer_id'])
            except Customer.DoesNotExist:
                return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Validate stock and calculate totals
        items_data = data['items']
        subtotal = Decimal('0')
        validated_items = []

        for item_data in items_data:
            try:
                variant = ProductVariant.objects.get(pk=item_data['product_variant_id'], is_active=True)
            except ProductVariant.DoesNotExist:
                return Response(
                    {'detail': f'Product variant {item_data["product_variant_id"]} not found.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if variant.stock_quantity < item_data['quantity']:
                return Response(
                    {'detail': f'Insufficient stock for {variant}. Available: {variant.stock_quantity}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            line = item_data['quantity'] * item_data['unit_price']
            discount = line * (item_data.get('discount_percent', 0) / 100)
            subtotal += line - discount
            validated_items.append({'variant': variant, **item_data})

        discount_amount = Decimal(str(data.get('discount_amount', 0)))
        tax_rate = Decimal(str(getattr(settings, 'TAX_RATE', 0)))
        taxable = subtotal - discount_amount
        tax_amount = taxable * tax_rate
        total_amount = taxable + tax_amount

        paid_amount = Decimal(str(data.get('paid_amount', 0)))
        if data['sale_type'] == 'cash':
            paid_amount = total_amount  # cash = full payment
        elif data['sale_type'] == 'installment':
            paid_amount = Decimal(str(data.get('down_payment', 0)))

        remaining = max(Decimal('0'), total_amount - paid_amount)
        change = max(Decimal('0'), paid_amount - total_amount) if data['sale_type'] == 'cash' else Decimal('0')

        # Validate credit limit
        if data['sale_type'] == 'credit' and customer:
            if customer.outstanding_balance + remaining > customer.credit_limit:
                return Response(
                    {'detail': f'Credit limit exceeded. Available: {customer.available_credit}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Create the sale
        sale = Sale.objects.create(
            customer=customer,
            cashier=request.user,
            sale_type=data['sale_type'],
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            paid_amount=paid_amount,
            change_amount=change,
            remaining_amount=remaining,
            notes=data.get('notes', ''),
        )

        # Create sale items and deduct stock
        for item in validated_items:
            variant = item['variant']
            qty = item['quantity']
            SaleItem.objects.create(
                sale=sale,
                product_variant=variant,
                quantity=qty,
                unit_price=item['unit_price'],
                discount_percent=item.get('discount_percent', 0),
            )
            # Deduct from stock
            variant.stock_quantity = max(0, variant.stock_quantity - qty)
            variant.save()
            # Update stock item FIFO
            self._deduct_stock_fifo(variant, qty)

        # Generate receipt
        Receipt.objects.create(sale=sale)

        # Handle credit customer balance
        if data['sale_type'] == 'credit' and customer:
            customer.outstanding_balance += remaining
            customer.save()
            CustomerTransaction.objects.create(
                customer=customer,
                transaction_type=CustomerTransaction.TYPE_PURCHASE,
                amount=total_amount,
                balance_after=customer.outstanding_balance,
                sale=sale,
                recorded_by=request.user,
            )

        # Handle installment plan
        if data['sale_type'] == 'installment' and customer:
            installment_count = data['installment_count']
            monthly = remaining / installment_count
            plan_start = date.today()
            plan_end = date(plan_start.year + ((plan_start.month + installment_count - 1) // 12),
                           ((plan_start.month + installment_count - 1) % 12) + 1, plan_start.day)

            InstallmentPlan.objects.create(
                sale=sale,
                customer=customer,
                total_amount=total_amount,
                down_payment=paid_amount,
                remaining_amount=remaining,
                monthly_installment=monthly,
                installment_count=installment_count,
                start_date=plan_start,
                end_date=plan_end,
                guarantor_name=data.get('guarantor_name', ''),
                guarantor_phone=data.get('guarantor_phone', ''),
                guarantor_id=data.get('guarantor_id', ''),
            )
            customer.outstanding_balance += remaining
            customer.save()

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    def _deduct_stock_fifo(self, variant, quantity):
        """Deduct stock from oldest batches first (FIFO)."""
        stock_items = StockItem.objects.filter(
            product_variant=variant, quantity_in_stock__gt=0, is_active=True
        ).order_by('import_date')

        remaining = quantity
        for item in stock_items:
            if remaining <= 0:
                break
            deduct = min(item.quantity_in_stock, remaining)
            item.quantity_in_stock -= deduct
            item.quantity_sold += deduct
            item.save()
            remaining -= deduct

    @action(detail=True, methods=['get'])
    def receipt_pdf(self, request, pk=None):
        """Generate and return PDF receipt for a sale."""
        sale = self.get_object()
        pdf_buffer = self._generate_receipt_pdf(sale)
        receipt = getattr(sale, 'receipt', None)
        if receipt:
            receipt.printed_count += 1
            receipt.save()
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="receipt_{sale.sale_number}.pdf"'
        return response

    def _generate_receipt_pdf(self, sale):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(8.5 * cm, 21 * cm),
                                rightMargin=0.5*cm, leftMargin=0.5*cm,
                                topMargin=0.5*cm, bottomMargin=0.5*cm)
        styles = getSampleStyleSheet()
        story = []

        # Header
        story.append(Paragraph(f'<b>{getattr(settings, "BUSINESS_NAME", "BrandX")}</b>', styles['Title']))
        story.append(Paragraph('Point of Sale Receipt', styles['Normal']))
        story.append(Spacer(1, 0.3*cm))

        # Sale info
        story.append(Paragraph(f'<b>Receipt #:</b> {sale.receipt.receipt_number if hasattr(sale, "receipt") else "N/A"}', styles['Normal']))
        story.append(Paragraph(f'<b>Invoice #:</b> {sale.sale_number}', styles['Normal']))
        story.append(Paragraph(f'<b>Date:</b> {sale.created_at.strftime("%Y-%m-%d %H:%M")}', styles['Normal']))
        story.append(Paragraph(f'<b>Type:</b> {sale.get_sale_type_display()}', styles['Normal']))
        if sale.customer:
            story.append(Paragraph(f'<b>Customer:</b> {sale.customer.name}', styles['Normal']))
        story.append(Paragraph(f'<b>Cashier:</b> {sale.cashier.get_full_name() or sale.cashier.username}', styles['Normal']))
        story.append(Spacer(1, 0.3*cm))

        # Items table
        table_data = [['Item', 'Qty', 'Price', 'Total']]
        for item in sale.items.all():
            name = item.product_variant.product.name[:15] if item.product_variant else 'N/A'
            table_data.append([name, str(item.quantity), f'{item.unit_price:.2f}', f'{item.total_price:.2f}'])

        table = Table(table_data, colWidths=[3.5*cm, 1*cm, 1.5*cm, 1.5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        story.append(table)
        story.append(Spacer(1, 0.3*cm))

        # Totals
        story.append(Paragraph(f'Subtotal: {sale.subtotal:.2f}', styles['Normal']))
        if sale.discount_amount:
            story.append(Paragraph(f'Discount: -{sale.discount_amount:.2f}', styles['Normal']))
        if sale.tax_amount:
            story.append(Paragraph(f'Tax: {sale.tax_amount:.2f}', styles['Normal']))
        story.append(Paragraph(f'<b>TOTAL: {sale.total_amount:.2f}</b>', styles['Normal']))
        story.append(Paragraph(f'Paid: {sale.paid_amount:.2f}', styles['Normal']))
        if sale.change_amount:
            story.append(Paragraph(f'Change: {sale.change_amount:.2f}', styles['Normal']))
        if sale.remaining_amount:
            story.append(Paragraph(f'<b>Remaining: {sale.remaining_amount:.2f}</b>', styles['Normal']))

        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph('Thank you for your purchase!', styles['Normal']))

        doc.build(story)
        buffer.seek(0)
        return buffer

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Sales dashboard statistics."""
        today = date.today()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        def stats(qs):
            return qs.aggregate(
                count=Count('id'),
                total=Sum('total_amount'),
                paid=Sum('paid_amount'),
            )

        today_qs = Sale.objects.filter(created_at__date=today, status='completed')
        month_qs = Sale.objects.filter(created_at__date__gte=month_start, status='completed')
        year_qs = Sale.objects.filter(created_at__date__gte=year_start, status='completed')

        return Response({
            'today': stats(today_qs),
            'this_month': stats(month_qs),
            'this_year': stats(year_qs),
            'by_type': {
                'cash': stats(month_qs.filter(sale_type='cash')),
                'credit': stats(month_qs.filter(sale_type='credit')),
                'installment': stats(month_qs.filter(sale_type='installment')),
            },
            'outstanding_credit': Customer.objects.filter(
                customer_type='credit'
            ).aggregate(total=Sum('outstanding_balance'))['total'] or 0,
            'outstanding_installment': Customer.objects.filter(
                customer_type='installment'
            ).aggregate(total=Sum('outstanding_balance'))['total'] or 0,
        })

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Monthly sales breakdown."""
        year = int(request.query_params.get('year', date.today().year))
        from django.db.models.functions import TruncMonth
        data = Sale.objects.filter(
            created_at__year=year, status='completed'
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            total=Sum('total_amount'),
            count=Count('id')
        ).order_by('month')
        return Response(list(data))
