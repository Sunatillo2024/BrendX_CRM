"""Inventory App Models - Stock Management with Cost, Vendor, Dates tracking"""
import uuid
from django.db import models


class StockItem(models.Model):
    """
    Stock entry representing a batch of products received from a vendor.
    Tracks: item_id, quantity per package, import/expire/production dates,
    cost price, and vendor association.
    """
    item_id = models.CharField(max_length=50, unique=True, db_index=True)
    product_variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.CASCADE,
        related_name='stock_items'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='stock_items'
    )
    quantity_per_package = models.IntegerField(default=1)
    total_packages = models.IntegerField(default=1)
    quantity_received = models.IntegerField()        # total = packages * qty_per_package
    quantity_in_stock = models.IntegerField()        # current available stock
    quantity_sold = models.IntegerField(default=0)   # tracking sold units from this batch

    import_date = models.DateField()
    expire_date = models.DateField(null=True, blank=True)
    production_date = models.DateField(null=True, blank=True)

    cost_price = models.DecimalField(max_digits=10, decimal_places=2)   # per unit cost
    total_cost = models.DecimalField(max_digits=15, decimal_places=2)   # cost_price * qty_received
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True,
        related_name='stock_entries'
    )

    class Meta:
        db_table = 'stock_items'
        ordering = ['-import_date', '-created_at']

    def __str__(self):
        return f'{self.item_id} - {self.product_variant}'

    def save(self, *args, **kwargs):
        if not self.item_id:
            self.item_id = f'STK-{uuid.uuid4().hex[:8].upper()}'
        if not self.quantity_in_stock:
            self.quantity_in_stock = self.quantity_received
        self.total_cost = self.cost_price * self.quantity_received
        super().save(*args, **kwargs)


class StockAdjustment(models.Model):
    """
    Records manual stock adjustments (damage, theft, audit corrections).
    """
    ADJUSTMENT_INCREASE = 'increase'
    ADJUSTMENT_DECREASE = 'decrease'

    ADJUSTMENT_TYPES = [
        (ADJUSTMENT_INCREASE, 'Increase'),
        (ADJUSTMENT_DECREASE, 'Decrease'),
    ]

    REASON_CHOICES = [
        ('damage', 'Damage'),
        ('theft', 'Theft/Loss'),
        ('audit', 'Audit Correction'),
        ('return', 'Customer Return'),
        ('expired', 'Expired'),
        ('other', 'Other'),
    ]

    stock_item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='adjustments')
    adjustment_type = models.CharField(max_length=10, choices=ADJUSTMENT_TYPES)
    quantity = models.IntegerField()
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    notes = models.TextField(blank=True)
    adjusted_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True
    )
    adjusted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_adjustments'
        ordering = ['-adjusted_at']

    def __str__(self):
        return f'{self.adjustment_type} {self.quantity} - {self.stock_item.item_id}'
