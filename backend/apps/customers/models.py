"""Customers App Models - Regular, Credit, and Installment customer management"""
from django.db import models


class Customer(models.Model):
    """
    Customer entity supporting three types:
    - Regular: standard customers (cash sales)
    - Credit: customers with credit limit and running balance
    - Installment: customers buying on installment plans
    """
    TYPE_REGULAR = 'regular'
    TYPE_CREDIT = 'credit'
    TYPE_INSTALLMENT = 'installment'

    CUSTOMER_TYPES = [
        (TYPE_REGULAR, 'Regular'),
        (TYPE_CREDIT, 'Credit'),
        (TYPE_INSTALLMENT, 'Installment'),
    ]

    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, db_index=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    id_number = models.CharField(max_length=50, blank=True)  # National ID or passport
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPES, default=TYPE_REGULAR)
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # Outstanding debt (positive = customer owes us)
    outstanding_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.get_customer_type_display()})'

    @property
    def available_credit(self):
        """For credit customers: how much more credit they can use."""
        if self.customer_type == self.TYPE_CREDIT:
            return max(0, self.credit_limit - self.outstanding_balance)
        return 0


class CustomerTransaction(models.Model):
    """Records all financial activities for a customer."""
    TYPE_PURCHASE = 'purchase'
    TYPE_PAYMENT = 'payment'
    TYPE_RETURN = 'return'
    TYPE_INSTALLMENT = 'installment_payment'

    TRANSACTION_TYPES = [
        (TYPE_PURCHASE, 'Purchase'),
        (TYPE_PAYMENT, 'Payment'),
        (TYPE_RETURN, 'Return'),
        (TYPE_INSTALLMENT, 'Installment Payment'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=25, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    sale = models.ForeignKey(
        'sales.Sale', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='customer_transactions'
    )
    recorded_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True
    )

    class Meta:
        db_table = 'customer_transactions'
        ordering = ['-date']

    def __str__(self):
        return f'{self.customer.name} - {self.get_transaction_type_display()} - {self.amount}'


class InstallmentPlan(models.Model):
    """
    Structured installment payment plan for a sale.
    Tracks down payment, monthly installments, and completion status.
    """
    STATUS_ACTIVE = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_DEFAULTED = 'defaulted'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_DEFAULTED, 'Defaulted'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    sale = models.OneToOneField(
        'sales.Sale', on_delete=models.CASCADE, related_name='installment_plan'
    )
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='installment_plans'
    )
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    down_payment = models.DecimalField(max_digits=15, decimal_places=2)
    remaining_amount = models.DecimalField(max_digits=15, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    monthly_installment = models.DecimalField(max_digits=15, decimal_places=2)
    installment_count = models.IntegerField()     # total number of installments
    paid_count = models.IntegerField(default=0)   # how many have been paid
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    # Guarantor information
    guarantor_name = models.CharField(max_length=200, blank=True)
    guarantor_phone = models.CharField(max_length=20, blank=True)
    guarantor_id = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'installment_plans'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.customer.name} - {self.total_amount} ({self.status})'

    @property
    def overdue_installments(self):
        from django.utils import timezone
        today = timezone.now().date()
        paid = self.paid_count
        # Calculate expected installments by now
        months_since_start = (today.year - self.start_date.year) * 12 + \
                             (today.month - self.start_date.month)
        expected = min(months_since_start + 1, self.installment_count)
        return max(0, expected - paid)


class InstallmentPayment(models.Model):
    """Individual payment record within an installment plan."""
    plan = models.ForeignKey(InstallmentPlan, on_delete=models.CASCADE, related_name='payments')
    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    installment_number = models.IntegerField()  # which installment number this is
    notes = models.TextField(blank=True)
    received_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL, null=True,
        related_name='installment_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'installment_payments'
        ordering = ['-payment_date']

    def __str__(self):
        return f'{self.plan.customer.name} - Installment #{self.installment_number} - {self.amount}'
