"""Sales Serializers"""
from rest_framework import serializers
from .models import Sale, SaleItem, Receipt


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    variant_display = serializers.CharField(source='product_variant.__str__', read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            'id', 'sale', 'product_variant', 'product_name', 'variant_display',
            'quantity', 'unit_price', 'discount_percent', 'discount_amount', 'total_price'
        ]
        read_only_fields = ['id', 'discount_amount', 'total_price']

    def get_product_name(self, obj):
        if obj.product_variant:
            return obj.product_variant.product.name
        return ''


class SaleItemCreateSerializer(serializers.Serializer):
    """Used for creating sale items within a sale creation request."""
    product_variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ['id', 'sale', 'receipt_number', 'generated_at', 'printed_count']
        read_only_fields = ['id', 'receipt_number', 'generated_at']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    receipt = ReceiptSerializer(read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'sale_number', 'customer', 'customer_name', 'cashier', 'cashier_name',
            'sale_type', 'subtotal', 'discount_amount', 'tax_amount', 'total_amount',
            'paid_amount', 'change_amount', 'remaining_amount', 'status', 'notes',
            'items', 'receipt', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sale_number', 'created_at', 'updated_at']


class SaleCreateSerializer(serializers.Serializer):
    """Handles the complete sale creation with all items and installment setup."""
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    sale_type = serializers.ChoiceField(choices=['cash', 'credit', 'installment'])
    items = SaleItemCreateSerializer(many=True, min_length=1)
    discount_amount = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    # Installment-specific fields
    down_payment = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    installment_count = serializers.IntegerField(required=False, min_value=1)
    guarantor_name = serializers.CharField(required=False, allow_blank=True)
    guarantor_phone = serializers.CharField(required=False, allow_blank=True)
    guarantor_id = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        sale_type = attrs.get('sale_type')
        if sale_type in ['credit', 'installment'] and not attrs.get('customer_id'):
            raise serializers.ValidationError(
                {'customer_id': 'Customer is required for credit and installment sales.'}
            )
        if sale_type == 'installment':
            if not attrs.get('installment_count'):
                raise serializers.ValidationError(
                    {'installment_count': 'Required for installment sales.'}
                )
        return attrs


class SaleListSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'sale_number', 'customer_name', 'cashier_name',
            'sale_type', 'total_amount', 'paid_amount', 'remaining_amount',
            'status', 'item_count', 'created_at'
        ]

    def get_item_count(self, obj):
        return obj.items.count()
