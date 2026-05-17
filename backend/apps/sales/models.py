"""Sales App Models - Cash, Credit, and Installment sales with receipts"""
import uuid
from django.db import models


def generate_sale_number():
    return f'INV-{uuid.uuid4().hex[:8].upper()}'


def generate_receipt_number():
    return f'RCP-{uuid.uuid4().hex[:10].upper()}'


class Sale(models.Model):
    """
    Core sale transaction.
    Supports three types: Cash, Credit (customer account), Installment (payment plan).
    """
    TYPE_CASH = 'cash'
    TYPE_CREDIT = 'credit'
    TYPE_INSTALLMENT = 'installment'

    SALE_TYPE_CHOICES = [
        (TYPE_CASH, 'Cash'),
        (TYPE_CREDIT, 'Credit'),
        (TYPE_INSTALLMENT, 'Installment'),
    ]

    STATUS_COMPLETED = 'completed'
    STATUS_PENDING = 'pending'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REFUNDED = 'refunded'

    STATUS_CHOICES = [
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_PENDING, 'Pending'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_REFUNDED, 'Refunded'),
    ]

    sale_number = models.CharField(
        max_length=20, unique=True, default=generate_sale_number, db_index=True
    )
    customer = models.ForeignKey(
        'customers.Customer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sales'
    )
    cashier = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True,
        related_name='sales'
    )
    sale_type = models.CharField(max_length=15, choices=SALE_TYPE_CHOICES, default=TYPE_CASH)
    subtotal = models.DecimalField(max_digits=15, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    change_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    remaining_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_COMPLETED)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.sale_number} - {self.get_sale_type_display()} - {self.total_amount}'


class SaleItem(models.Model):
    """Individual line item within a sale."""
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product_variant = models.ForeignKey(
        'products.ProductVariant', on_delete=models.SET_NULL, null=True,
        related_name='sale_items'
    )
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        db_table = 'sale_items'

    def __str__(self):
        return f'{self.sale.sale_number} - {self.product_variant} x{self.quantity}'

    def save(self, *args, **kwargs):
        line_total = self.unit_price * self.quantity
        if self.discount_percent:
            self.discount_amount = line_total * (self.discount_percent / 100)
        self.total_price = line_total - self.discount_amount
        super().save(*args, **kwargs)


class Receipt(models.Model):
    """
    Generated receipt record for each completed sale.
    Supports multiple print types per sale type.
    """
    sale = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name='receipt')
    receipt_number = models.CharField(
        max_length=30, unique=True, default=generate_receipt_number
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    printed_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'receipts'
        ordering = ['-generated_at']

    def __str__(self):
        return f'{self.receipt_number} - {self.sale.sale_number}'
