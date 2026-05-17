"""Products App Models - Categories, Colors, Sizes, Products, Variants with Barcodes"""
import uuid
import os
from django.db import models
from django.utils.text import slugify


def product_image_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f'products/{uuid.uuid4()}{ext}'


def category_image_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f'categories/{uuid.uuid4()}{ext}'


class Category(models.Model):
    """Product categories with hierarchical support (parent/child)."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='children'
    )
    image = models.ImageField(upload_to=category_image_path, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Color(models.Model):
    """Color options for product variants."""
    name = models.CharField(max_length=50)
    hex_code = models.CharField(max_length=7, default='#000000')

    class Meta:
        db_table = 'colors'
        ordering = ['name']

    def __str__(self):
        return self.name


class Size(models.Model):
    """Size options for product variants (S/M/L, numeric, age-based)."""
    SIZE_LETTER = 'letter'
    SIZE_NUMERIC = 'numeric'
    SIZE_AGE = 'age'
    SIZE_UNIVERSAL = 'universal'

    SIZE_TYPE_CHOICES = [
        (SIZE_LETTER, 'Letter (XS/S/M/L/XL/XXL)'),
        (SIZE_NUMERIC, 'Numeric (28/30/32/34)'),
        (SIZE_AGE, 'Age-based (2Y/4Y/6Y/8Y)'),
        (SIZE_UNIVERSAL, 'Universal'),
    ]

    name = models.CharField(max_length=20)
    size_type = models.CharField(max_length=20, choices=SIZE_TYPE_CHOICES)
    display_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'sizes'
        ordering = ['size_type', 'display_order']

    def __str__(self):
        return f'{self.name} ({self.get_size_type_display()})'


class Product(models.Model):
    """
    Main product entity.
    Each product can have multiple variants (color + size combinations).
    """
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='products'
    )
    barcode = models.CharField(max_length=50, unique=True, db_index=True)
    image = models.ImageField(upload_to=product_image_path, null=True, blank=True)
    base_cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    base_selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def total_stock(self):
        return sum(v.stock_quantity for v in self.variants.filter(is_active=True))


class ProductVariant(models.Model):
    """
    Product variant combining product + color + size.
    Each variant has its own barcode, SKU, and stock quantity.
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    color = models.ForeignKey(
        Color, on_delete=models.SET_NULL, null=True, blank=True, related_name='variants'
    )
    size = models.ForeignKey(
        Size, on_delete=models.SET_NULL, null=True, blank=True, related_name='variants'
    )
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    barcode = models.CharField(max_length=50, unique=True, db_index=True)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_quantity = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_variants'
        unique_together = [['product', 'color', 'size']]

    def __str__(self):
        parts = [self.product.name]
        if self.color:
            parts.append(self.color.name)
        if self.size:
            parts.append(self.size.name)
        return ' - '.join(parts)

    @property
    def effective_price(self):
        """Variant-specific price or fallback to product base price."""
        return self.selling_price if self.selling_price else self.product.base_selling_price

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self):
        return self.stock_quantity <= 0

    def generate_sku(self):
        """Auto-generate SKU from product + color + size."""
        parts = [self.product.barcode]
        if self.color:
            parts.append(self.color.name[:3].upper())
        if self.size:
            parts.append(self.size.name.upper())
        return '-'.join(parts)
