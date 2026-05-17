from django.contrib import admin
from .models import Customer, CustomerTransaction, InstallmentPlan, InstallmentPayment


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'customer_type', 'outstanding_balance', 'credit_limit', 'is_active', 'created_at']
    list_filter = ['customer_type', 'is_active']
    search_fields = ['name', 'phone', 'email', 'id_number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CustomerTransaction)
class CustomerTransactionAdmin(admin.ModelAdmin):
    list_display = ['customer', 'transaction_type', 'amount', 'balance_after', 'date', 'recorded_by']
    list_filter = ['transaction_type']
    search_fields = ['customer__name']
    readonly_fields = ['date']


class InstallmentPaymentInline(admin.TabularInline):
    model = InstallmentPayment
    extra = 0
    readonly_fields = ['created_at']


@admin.register(InstallmentPlan)
class InstallmentPlanAdmin(admin.ModelAdmin):
    list_display = ['customer', 'total_amount', 'down_payment', 'remaining_amount', 'monthly_installment', 'installment_count', 'paid_count', 'status', 'start_date', 'end_date']
    list_filter = ['status']
    search_fields = ['customer__name', 'guarantor_name']
    readonly_fields = ['created_at']
    inlines = [InstallmentPaymentInline]


@admin.register(InstallmentPayment)
class InstallmentPaymentAdmin(admin.ModelAdmin):
    list_display = ['plan', 'installment_number', 'amount', 'payment_date', 'received_by', 'created_at']
    list_filter = ['payment_date']
    search_fields = ['plan__customer__name']
    readonly_fields = ['created_at']
