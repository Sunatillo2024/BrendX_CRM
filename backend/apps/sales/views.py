"""Sales Views - POS checkout, receipts, returns and dashboards"""
import io
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from apps.audit.models import AuditLog
from apps.audit.services import log_action
from apps.authentication.permissions import IsAuthenticatedWithRole, IsOwner, IsOwnerOrManager
from apps.common.filters import DateRangeFilterMixin, resolve_period
from apps.customers.models import Customer
from apps.inventory import services as inventory_services
from apps.inventory.models import StockMovement
from apps.products.models import ProductVariant
from apps.products.serializers import VariantSearchSerializer
from apps.sales import services as sales_services

from .models import Receipt, Sale, SaleItem, SaleReturn, SaleReturnItem
from .serializers import (
    SaleCreateSerializer, SaleListSerializer, SaleReturnCreateSerializer,
    SaleReturnSerializer, SaleSerializer,
)

RECEIPT_LABELS = {
    'uz': {
        'receipt': 'Chek', 'date': 'Sana', 'cashier': 'Kassir', 'customer': 'Mijoz',
        'item': 'Mahsulot', 'qty': 'Soni', 'price': 'Narx', 'sum': 'Summa',
        'subtotal': 'Jami', 'discount': 'Chegirma', 'total': 'JAMI',
        'cash': 'NAQD', 'card': 'KARTA', 'received': 'OLINDI', 'change': 'QAYTIM',
        'thanks': 'Xaridingiz uchun rahmat!',
    },
    'ru': {
        'receipt': 'Чек', 'date': 'Дата', 'cashier': 'Кассир', 'customer': 'Клиент',
        'item': 'Товар', 'qty': 'Кол-во', 'price': 'Цена', 'sum': 'Сумма',
        'subtotal': 'Итого', 'discount': 'Скидка', 'total': 'ИТОГО',
        'cash': 'НАЛИЧНЫЕ', 'card': 'КАРТА', 'received': 'ПОЛУЧЕНО', 'change': 'СДАЧА',
        'thanks': 'Спасибо за покупку!',
    },
}


def _labels(request):
    lang = (request.query_params.get('lang') or '').lower()
    if lang not in RECEIPT_LABELS:
        lang = getattr(settings, 'DEFAULT_LANGUAGE', 'uz')
    return RECEIPT_LABELS.get(lang, RECEIPT_LABELS['uz'])


class SaleViewSet(DateRangeFilterMixin, viewsets.ModelViewSet):
    """POS sales: create, browse, print receipts, process returns."""
    queryset = Sale.objects.select_related('cashier', 'customer').prefetch_related(
        'items__product_variant', 'returns__items'
    ).order_by('-created_at')
    search_fields = ['notes', 'customer__name', 'cashier__first_name', 'cashier__username']
    filterset_fields = ['payment_method', 'status', 'cashier', 'customer']
    ordering_fields = ['created_at', 'total_amount', 'number']
    date_field = 'created_at'
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return SaleListSerializer
        if self.action == 'create':
            return SaleCreateSerializer
        return SaleSerializer

    def get_permissions(self):
        # Never rely on the @action(permission_classes=...) shortcut here -
        # this method is what DRF actually calls.
        if self.action == 'cancel':
            return [IsOwner()]
        if self.action == 'return_items':
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]

    def get_queryset(self):
        qs = self.filter_by_period(super().get_queryset())
        user = self.request.user
        if getattr(user, 'is_cashier', False):
            qs = qs.filter(cashier=user)
        return qs

    # ── Checkout ────────────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            sale = self._process_sale(request, serializer.validated_data)
        except sales_services.PaymentError as exc:
            return Response({'detail': exc.detail, 'code': exc.code},
                            status=status.HTTP_400_BAD_REQUEST)
        except inventory_services.InsufficientStock as exc:
            return Response({'detail': str(exc), 'code': 'insufficient_stock'},
                            status=status.HTTP_400_BAD_REQUEST)
        except Customer.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            SaleSerializer(sale, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _process_sale(self, request, data):
        """Create the sale atomically.

        Locking (select_for_update) and stock validation happen *inside* the
        transaction so both are race-safe: the row locks are held for the whole
        checkout and a failure rolls the whole sale back.
        """
        customer = None
        if data.get('customer_id'):
            customer = Customer.objects.get(pk=data['customer_id'])

        with transaction.atomic():
            # Lock the last sale row so receipt numbers stay sequential.
            last = Sale.objects.select_for_update().order_by('-number').first()
            number = (last.number if last else 0) + 1

            lines = []
            subtotal = Decimal('0')
            for raw in data['items']:
                variant = ProductVariant.objects.select_for_update().select_related(
                    'product', 'color', 'size'
                ).filter(pk=raw['product_variant_id'], is_active=True,
                         product__is_active=True).first()
                if variant is None:
                    raise inventory_services.InsufficientStock(
                        f'variant {raw["product_variant_id"]}', 0, raw['quantity']
                    )
                if variant.stock_quantity < raw['quantity']:
                    raise inventory_services.InsufficientStock(
                        variant, variant.stock_quantity, raw['quantity']
                    )

                percent = raw.get('discount_percent')
                percent = Decimal('0') if percent is None else Decimal(str(percent))
                line_total = Decimal(str(raw['unit_price'])) * raw['quantity']
                discount = line_total * percent / Decimal('100')
                subtotal += line_total - discount
                lines.append({'variant': variant, 'raw': raw, 'net': line_total - discount})

            discount_amount = data.get('discount_amount') or Decimal('0')
            if discount_amount > subtotal:
                raise sales_services.PaymentError(
                    'invalid_discount',
                    'Discount cannot be greater than the subtotal.')
            taxable = subtotal - discount_amount
            tax_rate = Decimal(str(getattr(settings, 'TAX_RATE', 0)))
            tax_amount = (taxable * tax_rate).quantize(Decimal('0.01'))
            total = taxable + tax_amount

            cash_amount, card_amount, received, change = sales_services.resolve_payment(
                data['payment_method'], total,
                data.get('received_amount') or 0, data.get('card_amount') or 0,
            )

            sale = Sale.objects.create(
                number=number,
                customer=customer,
                cashier=request.user,
                payment_method=data['payment_method'],
                subtotal=subtotal,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                total_amount=total,
                cash_amount=cash_amount,
                card_amount=card_amount,
                received_amount=received,
                change_amount=change,
                notes=data.get('notes', ''),
            )

            for line in lines:
                variant = line['variant']
                raw = line['raw']
                SaleItem.objects.create(
                    sale=sale,
                    product_variant=variant,
                    product_name=variant.product.name,
                    color_name=variant.color.name if variant.color else '',
                    size_name=variant.size.name if variant.size else '',
                    quantity=raw['quantity'],
                    unit_price=raw['unit_price'],
                    unit_cost=variant.effective_cost,
                    discount_percent=raw.get('discount_percent') or 0,
                )
                inventory_services.sell_stock(variant, raw['quantity'], sale, user=request.user)

            Receipt.objects.create(sale=sale, receipt_number=sale.sale_number)

        log_action(AuditLog.ACTION_SALE_CREATED, user=request.user, entity='sale',
                   entity_id=sale.pk,
                   details={'number': sale.sale_number, 'total': str(sale.total_amount),
                            'payment_method': sale.payment_method,
                            'items': len(lines)})
        return sale

    # ── Receipts ────────────────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def receipt_data(self, request, pk=None):
        """Receipt payload for on-screen display / re-print."""
        sale = self.get_object()
        return Response({
            'sale': SaleSerializer(sale, context={'request': request}).data,
            'business_name': getattr(settings, 'BUSINESS_NAME', 'BrandX'),
            'currency': getattr(settings, 'CURRENCY_SYMBOL', 'сом'),
        })

    @action(detail=True, methods=['get'])
    def receipt_pdf(self, request, pk=None):
        """Thermal-printer friendly PDF receipt (80mm)."""
        sale = self.get_object()
        labels = _labels(request)
        buffer = self._build_receipt_pdf(sale, labels)

        receipt = getattr(sale, 'receipt', None)
        if receipt:
            Receipt.objects.filter(pk=receipt.pk).update(printed_count=receipt.printed_count + 1)

        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = (
            f'inline; filename="receipt_{sale.sale_number}.pdf"'
        )
        return response

    def _build_receipt_pdf(self, sale, labels):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=(8.0 * cm, 24 * cm),
            rightMargin=0.45 * cm, leftMargin=0.45 * cm,
            topMargin=0.5 * cm, bottomMargin=0.5 * cm,
        )
        styles = getSampleStyleSheet()
        small = ParagraphStyle('small', parent=styles['Normal'], fontSize=7.5, leading=9.5)
        centre = ParagraphStyle('centre', parent=small, alignment=1)
        bold = ParagraphStyle('bold', parent=small, fontName='Helvetica-Bold')

        story = [
            Paragraph(f"<b>{getattr(settings, 'BUSINESS_NAME', 'BrandX')}</b>",
                      ParagraphStyle('h', parent=styles['Title'], fontSize=12, alignment=1)),
            Paragraph(f"{labels['receipt']} №{sale.sale_number}", centre),
            Spacer(1, 0.15 * cm),
            Paragraph(f"{labels['date']}: {timezone.localtime(sale.created_at):%d.%m.%Y %H:%M}", small),
            Paragraph(f"{labels['cashier']}: {sale.cashier.display_name}", small),
        ]
        if sale.customer:
            story.append(Paragraph(f"{labels['customer']}: {sale.customer.name}", small))
        story.append(Spacer(1, 0.2 * cm))

        rows = [[labels['item'], labels['qty'], labels['sum']]]
        for item in sale.items.all():
            variant = ' / '.join(p for p in [item.color_name, item.size_name] if p)
            name = item.product_name if not variant else f'{item.product_name} ({variant})'
            rows.append([Paragraph(name, small), str(item.quantity),
                         f'{item.total_price:.0f}'])

        table = Table(rows, colWidths=[4.3 * cm, 1.2 * cm, 1.6 * cm])
        table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 7.5),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('LINEBELOW', (0, 0), (-1, 0), 0.4, colors.black),
            ('LINEABOVE', (0, -1), (-1, -1), 0.4, colors.black),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story += [table, Spacer(1, 0.2 * cm)]

        def line(label, value, bold_=False):
            style = bold if bold_ else small
            return Paragraph(f'<b>{label}</b> {value}' if bold_ else f'{label} {value}', style)

        if sale.discount_amount:
            story.append(line(labels['discount'], f'-{sale.discount_amount:.0f}'))
        story.append(line(labels['total'], f'{sale.total_amount:.0f}', bold_=True))
        if sale.cash_amount:
            story.append(line(labels['cash'], f'{sale.cash_amount:.0f}'))
        if sale.card_amount:
            story.append(line(labels['card'], f'{sale.card_amount:.0f}'))
        if sale.change_amount:
            story.append(line(labels['change'], f'{sale.change_amount:.0f}'))
        story += [Spacer(1, 0.35 * cm), Paragraph(labels['thanks'], centre)]

        doc.build(story)
        buffer.seek(0)
        return buffer

    # ── Returns ─────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def return_items(self, request, pk=None):
        """
        Return goods from a sale.

        The sale itself is never deleted - a SaleReturn document is created,
        stock goes back on the shelf and the sale status is updated.
        """
        sale = self.get_object()
        serializer = SaleReturnCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sale_items = {item.pk: item for item in sale.items.all()}

        # Validate everything BEFORE opening the transaction so a bad request
        # can never leave a half-written return behind.
        for row in data['items']:
            item = sale_items.get(row['sale_item'])
            if item is None:
                return Response(
                    {'detail': f'Sale item {row["sale_item"]} not found in this sale.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            remaining = item.quantity - item.returned_quantity
            if row['quantity'] > remaining:
                return Response(
                    {'detail': f'Cannot return {row["quantity"]} of "{item.product_name}" '
                               f'- only {remaining} left to return.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            sale_return = SaleReturn.objects.create(
                sale=sale,
                reason=data.get('reason', 'other'),
                notes=data.get('notes', ''),
                created_by=request.user,
            )
            total = Decimal('0')
            for row in data['items']:
                item = sale_items[row['sale_item']]
                SaleReturnItem.objects.create(
                    sale_return=sale_return, sale_item=item,
                    quantity=row['quantity'], unit_price=item.unit_price,
                )
                item.returned_quantity += row['quantity']
                item.save(update_fields=['returned_quantity'])

                inventory_services.return_stock(
                    item.product_variant, row['quantity'], sale=sale, user=request.user,
                    notes=data.get('notes', ''),
                )
                total += item.unit_price * row['quantity']

            sale_return.total_amount = total
            sale_return.save(update_fields=['total_amount'])

            fully_returned = all(i.returned_quantity >= i.quantity for i in sale.items.all())
            sale.status = (Sale.STATUS_REFUNDED if fully_returned
                           else Sale.STATUS_PARTIALLY_REFUNDED)
            sale.save(update_fields=['status', 'updated_at'])

        log_action(AuditLog.ACTION_SALE_RETURNED, user=request.user, entity='sale',
                   entity_id=sale.pk,
                   details={'number': sale.sale_number, 'amount': str(total),
                            'reason': data.get('reason')})
        return Response(SaleReturnSerializer(sale_return).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a sale (owner only) - stock is put back, the record stays."""
        sale = self.get_object()
        if sale.status == Sale.STATUS_CANCELLED:
            return Response({'detail': 'Sale is already cancelled.'},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for item in sale.items.all():
                pending = item.quantity - item.returned_quantity
                if pending > 0:
                    inventory_services.return_stock(
                        item.product_variant, pending, sale=sale, user=request.user,
                        reason='correction', notes='Sale cancelled',
                    )
            sale.status = Sale.STATUS_CANCELLED
            sale.save(update_fields=['status', 'updated_at'])

        log_action(AuditLog.ACTION_SALE_RETURNED, user=request.user, entity='sale',
                   entity_id=sale.pk, details={'number': sale.sale_number, 'op': 'cancel'})
        return Response(SaleSerializer(sale, context={'request': request}).data)

    # ── Dashboard ───────────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Role-aware dashboard.

        owner   -> full P&L
        manager -> operational numbers only (no cost / margin / profit)
        cashier -> own shift totals only
        """
        start, end = resolve_period(request.query_params)
        user = request.user

        if getattr(user, 'is_cashier', False):
            own = sales_services.sales_in_range(start, end).filter(cashier=user)
            return Response({
                'role': user.role,
                'period': {'start': start, 'end': end},
                'my_sales': {
                    'sales_count': own.count(),
                    'revenue': own.aggregate(t=models.Sum('total_amount'))['t'] or 0,
                },
            })

        payload = {
            'role': user.role,
            'period': {'start': start, 'end': end},
            'operational': sales_services.operational_stats(start, end),
            'top_products': sales_services.top_products(start, end, 5),
            'chart': sales_services.sales_by_day(start, end) if start and end else [],
            'low_stock': VariantSearchSerializer(
                ProductVariant.objects.filter(
                    is_active=True, product__is_active=True,
                    stock_quantity__lte=models.F('low_stock_threshold'),
                ).select_related('product', 'color', 'size').order_by('stock_quantity')[:10],
                many=True,
            ).data,
        }

        if user.can_view_financials:
            payload['financial'] = sales_services.financial_stats(start, end)
        else:
            payload['financial'] = None

        return Response(payload)


class SaleReturnViewSet(DateRangeFilterMixin, viewsets.ReadOnlyModelViewSet):
    """Return history (read-only - returns are created through the sale)."""
    queryset = SaleReturn.objects.select_related('sale', 'created_by').prefetch_related(
        'items__sale_item'
    ).order_by('-created_at')
    serializer_class = SaleReturnSerializer
    filterset_fields = ['sale', 'reason', 'created_by']
    search_fields = ['sale__number', 'notes']
    date_field = 'created_at'
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        return self.filter_by_period(super().get_queryset())
