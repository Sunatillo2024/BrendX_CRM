"""Inventory Views - goods receipts, stock movements, inventory counts"""
from decimal import Decimal

from django.db.models import F, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import log_action
from apps.authentication.permissions import IsOwner, IsOwnerOrManager
from apps.common.filters import DateRangeFilterMixin
from apps.products.models import ProductVariant

from . import services
from .models import StockMovement, StockReceipt
from .serializers import (
    StockAdjustWriteSerializer, StockMovementSerializer, StockReceiptSerializer,
    StockReceiptWriteSerializer,
)


class StockReceiptViewSet(DateRangeFilterMixin, viewsets.ModelViewSet):
    """
    Goods receipts ("Поступление").

    Receipts are immutable documents: create + read only, so stock history
    stays trustworthy.
    """
    queryset = StockReceipt.objects.select_related('vendor', 'created_by').prefetch_related(
        'items__product_variant__product', 'items__product_variant__color',
        'items__product_variant__size',
    ).order_by('-number')
    serializer_class = StockReceiptSerializer
    search_fields = ['notes', 'vendor__name']
    filterset_fields = ['vendor']
    date_field = 'receipt_date'
    permission_classes = [IsOwnerOrManager]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return self.filter_by_period(super().get_queryset())

    def create(self, request, *args, **kwargs):
        serializer = StockReceiptWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        receipt = services.receive_stock(
            items=data['items'],
            user=request.user,
            vendor=data.get('vendor'),
            receipt_date=data.get('receipt_date'),
            notes=data.get('notes', ''),
        )
        log_action(AuditLog.ACTION_STOCK_RECEIPT, user=request.user, entity='stock_receipt',
                   entity_id=receipt.pk,
                   details={'number': receipt.number, 'lines': len(data['items']),
                            'total_quantity': receipt.total_quantity})
        return Response(StockReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)


class StockMovementViewSet(DateRangeFilterMixin, viewsets.ReadOnlyModelViewSet):
    """Stock movement history (read-only) + manual adjust / inventory count."""
    queryset = StockMovement.objects.select_related(
        'product_variant__product', 'product_variant__color', 'product_variant__size',
        'created_by',
    ).order_by('-created_at')
    serializer_class = StockMovementSerializer
    search_fields = ['reference', 'notes', 'product_variant__product__name',
                     'product_variant__barcode']
    filterset_fields = ['movement_type', 'reason', 'product_variant',
                        'product_variant__product']
    permission_classes = [IsOwnerOrManager]

    def get_queryset(self):
        return self.filter_by_period(super().get_queryset())

    @action(detail=False, methods=['post'])
    def adjust(self, request):
        """
        Manual stock adjustment or physical inventory count.
        Always produces a StockMovement (audit trail).
        """
        serializer = StockAdjustWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        variant = data['product_variant']

        try:
            if data.get('mode') == StockAdjustWriteSerializer.MODE_DELTA:
                movement = services.change_stock(
                    variant, data['quantity'], StockMovement.TYPE_ADJUSTMENT,
                    user=request.user, reason=data.get('reason', 'correction'),
                    notes=data.get('notes', ''),
                )
            else:
                movement = services.set_counted_stock(
                    variant, data['quantity'], user=request.user,
                    reason=data.get('reason', 'inventory'), notes=data.get('notes', ''),
                )
        except services.InsufficientStock as exc:
            return Response({'detail': str(exc), 'code': 'insufficient_stock'},
                            status=status.HTTP_400_BAD_REQUEST)

        log_action(AuditLog.ACTION_INVENTORY_COUNT, user=request.user, entity='stock_movement',
                   entity_id=movement.pk,
                   details={'variant': str(variant), 'before': movement.quantity_before,
                            'change': movement.quantity_change, 'after': movement.quantity_after,
                            'mode': data.get('mode')})
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Variants at or below their own low-stock threshold."""
        variants = ProductVariant.objects.filter(
            is_active=True, product__is_active=True,
            stock_quantity__lte=F('low_stock_threshold'),
        ).select_related('product', 'color', 'size').order_by('stock_quantity')
        from apps.products.serializers import VariantSearchSerializer
        return Response(VariantSearchSerializer(variants, many=True).data)


class InventoryValuationView(APIView):
    """Inventory value at cost / retail - owner only (contains purchase prices)."""
    permission_classes = [IsOwner]

    def get(self, request):
        variants = ProductVariant.objects.filter(
            is_active=True, product__is_active=True
        ).select_related('product')

        total_cost = Decimal('0')
        total_retail = Decimal('0')
        for variant in variants:
            if variant.stock_quantity <= 0:
                continue
            total_cost += variant.effective_cost * variant.stock_quantity
            total_retail += variant.effective_price * variant.stock_quantity

        return Response({
            'total_cost_value': total_cost,
            'total_retail_value': total_retail,
            'potential_profit': total_retail - total_cost,
            'variants_in_stock': variants.filter(stock_quantity__gt=0).count(),
            'units_in_stock': variants.aggregate(total=Sum('stock_quantity'))['total'] or 0,
        })
