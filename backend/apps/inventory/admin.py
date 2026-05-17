from django.contrib import admin
from .models import StockItem, StockAdjustment


class StockAdjustmentInline(admin.TabularInline):
    model = StockAdjustment
    extra = 0
    readonly_fields = ['adjusted_at']


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ['item_id', 'product_variant', 'vendor', 'quantity_received', 'quantity_in_stock', 'quantity_sold', 'cost_price', 'total_cost', 'import_date', 'is_active']
    list_filter = ['is_active', 'import_date', 'vendor']
    search_fields = ['item_id', 'product_variant__product__name', 'vendor__name']
    readonly_fields = ['item_id', 'total_cost', 'created_at']
    inlines = [StockAdjustmentInline]


@admin.register(StockAdjustment)
class StockAdjustmentAdmin(admin.ModelAdmin):
    list_display = ['stock_item', 'adjustment_type', 'quantity', 'reason', 'adjusted_by', 'adjusted_at']
    list_filter = ['adjustment_type', 'reason']
    search_fields = ['stock_item__item_id', 'stock_item__product_variant__product__name']
    readonly_fields = ['adjusted_at']
