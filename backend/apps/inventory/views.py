"""Inventory Views - Stock management with cost tracking"""
from django.db import transaction
from django.db.models import Sum, F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrManager, IsAuthenticatedWithRole
from apps.products.models import ProductVariant
from .models import StockItem, StockAdjustment
from .serializers import StockItemSerializer, StockAdjustmentSerializer


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.select_related(
        'product_variant__product', 'product_variant__color',
        'product_variant__size', 'vendor', 'created_by'
    ).order_by('-import_date')
    serializer_class = StockItemSerializer
    search_fields = ['item_id', 'product_variant__product__name', 'vendor__name']
    filterset_fields = ['vendor', 'is_active', 'product_variant__product']
    ordering_fields = ['import_date', 'expire_date', 'cost_price', 'created_at']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    def perform_create(self, serializer):
        stock_item = serializer.save(created_by=self.request.user)
        # Update product variant stock quantity
        variant = stock_item.product_variant
        variant.stock_quantity = (
            StockItem.objects.filter(
                product_variant=variant, is_active=True
            ).aggregate(total=Sum('quantity_in_stock'))['total'] or 0
        )
        variant.save()

    @action(detail=False, methods=['get'])
    def valuation(self, request):
        """Returns total inventory valuation (cost vs retail)."""
        items = StockItem.objects.filter(is_active=True)
        total_cost = sum(
            item.cost_price * item.quantity_in_stock for item in items
        )
        total_retail = sum(
            item.product_variant.effective_price * item.quantity_in_stock
            for item in items.select_related('product_variant')
        )
        return Response({
            'total_cost_value': total_cost,
            'total_retail_value': total_retail,
            'potential_profit': total_retail - total_cost,
        })

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Returns items expiring within 30 days."""
        from django.utils import timezone
        from datetime import timedelta
        threshold = timezone.now().date() + timedelta(days=30)
        items = self.queryset.filter(
            expire_date__lte=threshold, expire_date__isnull=False,
            quantity_in_stock__gt=0
        )
        return Response(StockItemSerializer(items, many=True).data)


class StockAdjustmentViewSet(viewsets.ModelViewSet):
    queryset = StockAdjustment.objects.select_related(
        'stock_item__product_variant__product', 'adjusted_by'
    ).order_by('-adjusted_at')
    serializer_class = StockAdjustmentSerializer
    filterset_fields = ['adjustment_type', 'reason', 'stock_item']

    def get_permissions(self):
        return [IsAdminOrManager()]

    @transaction.atomic
    def perform_create(self, serializer):
        adjustment = serializer.save(adjusted_by=self.request.user)
        stock_item = adjustment.stock_item

        # Apply adjustment to stock
        if adjustment.adjustment_type == StockAdjustment.ADJUSTMENT_INCREASE:
            stock_item.quantity_in_stock += adjustment.quantity
        else:
            stock_item.quantity_in_stock = max(0, stock_item.quantity_in_stock - adjustment.quantity)
        stock_item.save()

        # Sync product variant stock
        variant = stock_item.product_variant
        total_stock = StockItem.objects.filter(
            product_variant=variant, is_active=True
        ).aggregate(total=Sum('quantity_in_stock'))['total'] or 0
        variant.stock_quantity = total_stock
        variant.save()
