"""Sales Serializers"""
from decimal import Decimal

from rest_framework import serializers

from apps.common.serializers import OwnerOnlyFieldsMixin

from .models import Receipt, Sale, SaleItem, SaleReturn, SaleReturnItem


class SaleItemSerializer(OwnerOnlyFieldsMixin, serializers.ModelSerializer):
    owner_only_fields = ('unit_cost',)
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            'id', 'product_variant', 'product_name', 'color_name', 'size_name',
            'quantity', 'unit_price', 'unit_cost', 'total_cost', 'discount_percent',
            'discount_amount', 'total_price', 'returned_quantity',
        ]
        read_only_fields = fields

    def get_total_cost(self, obj):
        if not self.context.get('request') or not self.context['request'].user.can_view_financials:
            return None
        return obj.unit_cost * obj.quantity


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ['id', 'receipt_number', 'generated_at', 'printed_count']
        read_only_fields = ['id', 'receipt_number', 'generated_at', 'printed_count']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    returns = serializers.SerializerMethodField()
    receipt = ReceiptSerializer(read_only=True)
    cashier_name = serializers.CharField(source='cashier.display_name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    sale_number = serializers.CharField(read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    total_cost = serializers.SerializerMethodField()
    profit = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'number', 'sale_number', 'customer', 'customer_name',
            'cashier', 'cashier_name', 'payment_method', 'subtotal', 'discount_amount',
            'tax_amount', 'total_amount', 'cash_amount', 'card_amount',
            'received_amount', 'change_amount', 'status', 'notes',
            'items', 'returns', 'receipt', 'item_count', 'total_cost', 'profit',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def _owner(self):
        request = self.context.get('request')
        return bool(request and request.user.can_view_financials)

    def get_returns(self, obj):
        return SaleReturnSerializer(obj.returns.all(), many=True, context=self.context).data

    def get_total_cost(self, obj):
        if not self._owner():
            return None
        return sum(item.unit_cost * item.quantity for item in obj.items.all())

    def get_profit(self, obj):
        if not self._owner():
            return None
        return obj.total_amount - sum(item.unit_cost * item.quantity for item in obj.items.all())


class SaleListSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.display_name', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, default=None)
    sale_number = serializers.CharField(read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    has_returns = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            'id', 'number', 'sale_number', 'created_at', 'cashier_name', 'customer_name',
            'payment_method', 'total_amount', 'cash_amount', 'card_amount',
            'received_amount', 'change_amount', 'discount_amount', 'status',
            'item_count', 'has_returns',
        ]

    def get_has_returns(self, obj):
        return obj.returns.exists()


class SaleItemCreateSerializer(serializers.Serializer):
    product_variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2,
                                          min_value=Decimal('0'))
    discount_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        min_value=Decimal('0'), max_value=Decimal('100'),
    )


class SaleCreateSerializer(serializers.Serializer):
    """POS checkout payload."""
    customer_id = serializers.IntegerField(required=False, allow_null=True)
    payment_method = serializers.ChoiceField(choices=Sale.PAYMENT_CHOICES)
    items = SaleItemCreateSerializer(many=True, min_length=1)
    discount_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0, min_value=Decimal('0')
    )
    received_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0, min_value=Decimal('0'),
        help_text='Cash handed over by the customer (cash / mixed payments).'
    )
    card_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0, min_value=Decimal('0'),
        help_text='Amount paid by card (card / mixed payments).'
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class SaleReturnItemWriteSerializer(serializers.Serializer):
    sale_item = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class SaleReturnCreateSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=[c[0] for c in SaleReturn._meta.get_field('reason').choices], default='other'
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    items = SaleReturnItemWriteSerializer(many=True, min_length=1)


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='sale_item.product_name', read_only=True)
    color_name = serializers.CharField(source='sale_item.color_name', read_only=True)
    size_name = serializers.CharField(source='sale_item.size_name', read_only=True)

    class Meta:
        model = SaleReturnItem
        fields = ['id', 'sale_item', 'product_name', 'color_name', 'size_name',
                  'quantity', 'unit_price', 'total_price']


class SaleReturnSerializer(serializers.ModelSerializer):
    items = SaleReturnItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.display_name', read_only=True,
                                            default=None)
    sale_number = serializers.CharField(source='sale.sale_number', read_only=True)

    class Meta:
        model = SaleReturn
        fields = ['id', 'sale', 'sale_number', 'reason', 'notes', 'total_amount',
                  'items', 'created_by_name', 'created_at']
        read_only_fields = fields
