"""Customers Serializers"""
from rest_framework import serializers
from .models import Customer, CustomerTransaction, InstallmentPlan, InstallmentPayment


class CustomerTransactionSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)

    class Meta:
        model = CustomerTransaction
        fields = [
            'id', 'customer', 'transaction_type', 'amount', 'balance_after',
            'date', 'notes', 'sale', 'recorded_by', 'recorded_by_name'
        ]
        read_only_fields = ['id', 'balance_after', 'date']


class InstallmentPaymentSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source='received_by.username', read_only=True)

    class Meta:
        model = InstallmentPayment
        fields = [
            'id', 'plan', 'payment_date', 'amount', 'installment_number',
            'notes', 'received_by', 'received_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InstallmentPlanSerializer(serializers.ModelSerializer):
    payments = InstallmentPaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    overdue_installments = serializers.IntegerField(read_only=True)

    class Meta:
        model = InstallmentPlan
        fields = [
            'id', 'sale', 'customer', 'customer_name', 'total_amount',
            'down_payment', 'remaining_amount', 'amount_paid',
            'monthly_installment', 'installment_count', 'paid_count',
            'start_date', 'end_date', 'status', 'guarantor_name',
            'guarantor_phone', 'guarantor_id', 'notes',
            'overdue_installments', 'payments', 'created_at'
        ]
        read_only_fields = ['id', 'amount_paid', 'paid_count', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    recent_transactions = serializers.SerializerMethodField()
    total_purchases = serializers.SerializerMethodField()
    available_credit = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    active_installment_plans = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address', 'id_number',
            'customer_type', 'credit_limit', 'outstanding_balance',
            'available_credit', 'notes', 'is_active',
            'recent_transactions', 'total_purchases',
            'active_installment_plans', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'outstanding_balance', 'created_at', 'updated_at']

    def get_recent_transactions(self, obj):
        txns = obj.transactions.order_by('-date')[:5]
        return CustomerTransactionSerializer(txns, many=True).data

    def get_total_purchases(self, obj):
        from django.db.models import Sum
        return obj.transactions.filter(
            transaction_type='purchase'
        ).aggregate(total=Sum('amount'))['total'] or 0

    def get_active_installment_plans(self, obj):
        plans = obj.installment_plans.filter(status='active')
        return InstallmentPlanSerializer(plans, many=True).data


class CustomerListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'customer_type',
            'outstanding_balance', 'credit_limit', 'is_active'
        ]
