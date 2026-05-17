"""Inventory Serializers"""
from rest_framework import serializers
from .models import StockItem, StockAdjustment


class StockItemSerializer(serializers.ModelSerializer):
    variant_display = serializers.CharField(source='product_variant.__str__', read_only=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    profit_margin = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            'id', 'item_id', 'product_variant', 'variant_display',
            'vendor', 'vendor_name', 'quantity_per_package', 'total_packages',
            'quantity_received', 'quantity_in_stock', 'quantity_sold',
            'import_date', 'expire_date', 'production_date',
            'cost_price', 'total_cost', 'notes', 'is_active',
            'profit_margin', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'item_id', 'total_cost', 'quantity_in_stock', 'created_at']

    def get_profit_margin(self, obj):
        selling_price = obj.product_variant.effective_price
        if obj.cost_price and obj.cost_price > 0:
            margin = ((selling_price - obj.cost_price) / obj.cost_price) * 100
            return round(float(margin), 2)
        return None

    def validate(self, attrs):
        qty_per_pkg = attrs.get('quantity_per_package', 1)
        total_pkg = attrs.get('total_packages', 1)
        attrs['quantity_received'] = qty_per_pkg * total_pkg
        return attrs


class StockAdjustmentSerializer(serializers.ModelSerializer):
    adjusted_by_name = serializers.CharField(source='adjusted_by.username', read_only=True)

    class Meta:
        model = StockAdjustment
        fields = [
            'id', 'stock_item', 'adjustment_type', 'quantity',
            'reason', 'notes', 'adjusted_by', 'adjusted_by_name', 'adjusted_at'
        ]
        read_only_fields = ['id', 'adjusted_at']
