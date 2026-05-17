from django.contrib import admin
from .models import Sale, SaleItem, Receipt


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    fields = ['product_variant', 'quantity', 'unit_price', 'discount_percent', 'discount_amount', 'total_price']
    readonly_fields = ['discount_amount', 'total_price']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['sale_number', 'customer', 'cashier', 'sale_type', 'total_amount', 'paid_amount', 'remaining_amount', 'status', 'created_at']
    list_filter = ['sale_type', 'status', 'created_at']
    search_fields = ['sale_number', 'customer__name', 'cashier__username']
    readonly_fields = ['sale_number', 'created_at', 'updated_at']
    inlines = [SaleItemInline]


@admin.register(SaleItem)
class SaleItemAdmin(admin.ModelAdmin):
    list_display = ['sale', 'product_variant', 'quantity', 'unit_price', 'discount_amount', 'total_price']
    search_fields = ['sale__sale_number', 'product_variant__product__name']


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ['receipt_number', 'sale', 'printed_count', 'generated_at']
    search_fields = ['receipt_number', 'sale__sale_number']
    readonly_fields = ['receipt_number', 'generated_at']
