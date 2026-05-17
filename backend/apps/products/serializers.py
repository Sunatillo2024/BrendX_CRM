"""Products Serializers"""
from rest_framework import serializers
from .models import Category, Color, Size, Product, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField(read_only=True)
    product_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'parent', 'image',
                  'is_active', 'children', 'product_count', 'created_at']

    def get_children(self, obj):
        if obj.children.exists():
            return CategorySerializer(obj.children.filter(is_active=True), many=True).data
        return []

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()


class ColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Color
        fields = ['id', 'name', 'hex_code']


class SizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Size
        fields = ['id', 'name', 'size_type', 'display_order']


class ProductVariantSerializer(serializers.ModelSerializer):
    color_detail = ColorSerializer(source='color', read_only=True)
    size_detail = SizeSerializer(source='size', read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'product', 'color', 'color_detail', 'size', 'size_detail',
            'sku', 'barcode', 'selling_price', 'effective_price',
            'stock_quantity', 'low_stock_threshold', 'is_active',
            'is_low_stock', 'is_out_of_stock', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_detail = CategorySerializer(source='category', read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    total_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'category', 'category_detail',
            'barcode', 'image', 'base_cost_price', 'base_selling_price',
            'is_active', 'variants', 'total_stock', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for product listings (no variants)."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    total_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category', 'category_name',
            'barcode', 'image', 'base_selling_price',
            'is_active', 'total_stock', 'created_at'
        ]
