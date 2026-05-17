"""Vendors Serializers"""
from rest_framework import serializers
from .models import Vendor, VendorTransaction


class VendorTransactionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = VendorTransaction
        fields = [
            'id', 'vendor', 'transaction_type', 'amount', 'balance_after',
            'date', 'reference', 'notes', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'balance_after', 'created_at']


class VendorSerializer(serializers.ModelSerializer):
    recent_transactions = serializers.SerializerMethodField()
    total_purchases = serializers.SerializerMethodField()
    total_payments = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            'id', 'name', 'phone', 'email', 'address', 'contact_person',
            'company_name', 'tax_number', 'balance', 'notes', 'is_active',
            'recent_transactions', 'total_purchases', 'total_payments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'balance', 'created_at', 'updated_at']

    def get_recent_transactions(self, obj):
        txns = obj.transactions.order_by('-date')[:5]
        return VendorTransactionSerializer(txns, many=True).data

    def get_total_purchases(self, obj):
        from django.db.models import Sum
        result = obj.transactions.filter(
            transaction_type='purchase'
        ).aggregate(total=Sum('amount'))
        return result['total'] or 0

    def get_total_payments(self, obj):
        from django.db.models import Sum
        result = obj.transactions.filter(
            transaction_type='payment'
        ).aggregate(total=Sum('amount'))
        return result['total'] or 0


class VendorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ['id', 'name', 'phone', 'email', 'balance', 'is_active']
