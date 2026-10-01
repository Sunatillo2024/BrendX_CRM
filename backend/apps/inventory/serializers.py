"""Inventory Serializers"""
from decimal import Decimal

from rest_framework import serializers

from apps.products.models import ProductVariant
from apps.vendors.models import Vendor

from .models import StockMovement, StockReceipt, StockReceiptItem


class StockReceiptItemSerializer(serializers.ModelSerializer):
    variant_display = serializers.CharField(source='product_variant.__str__', read_only=True)
    product_name = serializers.CharField(source='product_variant.product.name', read_only=True)
    color_name = serializers.CharField(source='product_variant.color.name', read_only=True, default=None)
    size_name = serializers.CharField(source='product_variant.size.name', read_only=True, default=None)

    class Meta:
        model = StockReceiptItem
        fields = ['id', 'product_variant', 'variant_display', 'product_name',
                  'color_name', 'size_name', 'quantity', 'cost_price', 'total_cost']
        read_only_fields = ['id', 'total_cost']


class StockReceiptItemWriteSerializer(serializers.Serializer):
    product_variant = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.all())
    quantity = serializers.IntegerField(min_value=1)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2,
                                          min_value=Decimal('0'))


class StockReceiptSerializer(serializers.ModelSerializer):
    items = StockReceiptItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.display_name', read_only=True, default=None)

    class Meta:
        model = StockReceipt
        fields = ['id', 'number', 'receipt_date', 'vendor', 'vendor_name', 'notes',
                  'total_quantity', 'total_cost', 'created_by_name', 'items', 'created_at']
        read_only_fields = ['id', 'number', 'total_quantity', 'total_cost', 'created_at']


class StockReceiptWriteSerializer(serializers.Serializer):
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.all(), required=False, allow_null=True
    )
    receipt_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = StockReceiptItemWriteSerializer(many=True, min_length=1)

    def validate_items(self, value):
        seen = set()
        for row in value:
            variant = row['product_variant']
            if variant.pk in seen:
                raise serializers.ValidationError(
                    f'{variant} appears twice - merge the lines into one.'
                )
            seen.add(variant.pk)
        return value


class StockMovementSerializer(serializers.ModelSerializer):
    variant_display = serializers.CharField(source='product_variant.__str__', read_only=True)
    product_name = serializers.CharField(source='product_variant.product.name', read_only=True)
    color_name = serializers.CharField(source='product_variant.color.name', read_only=True, default=None)
    size_name = serializers.CharField(source='product_variant.size.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.display_name', read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = ['id', 'product_variant', 'variant_display', 'product_name', 'color_name',
                  'size_name', 'movement_type', 'quantity_before', 'quantity_change',
                  'quantity_after', 'unit_cost', 'reason', 'reference', 'notes',
                  'created_by_name', 'created_at']


class StockAdjustWriteSerializer(serializers.Serializer):
    """Manual adjustment or inventory count."""
    MODE_DELTA = 'delta'
    MODE_COUNTED = 'counted'
    MODE_CHOICES = [(MODE_DELTA, 'By difference'), (MODE_COUNTED, 'By counted quantity')]

    product_variant = serializers.PrimaryKeyRelatedField(queryset=ProductVariant.objects.all())
    mode = serializers.ChoiceField(choices=MODE_CHOICES, default=MODE_COUNTED)
    quantity = serializers.IntegerField(
        help_text='Signed difference when mode=delta, absolute counted quantity when mode=counted.'
    )
    reason = serializers.ChoiceField(
        choices=[c[0] for c in StockMovement.REASON_CHOICES if c[0]], required=False, default='correction'
    )
    notes = serializers.CharField(required=False, allow_blank=True)
