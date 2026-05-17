"""Customers Views - Customer financial management (credit + installment)"""
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrManager, IsAuthenticatedWithRole
from .models import Customer, CustomerTransaction, InstallmentPlan, InstallmentPayment
from .serializers import (
    CustomerSerializer, CustomerListSerializer,
    CustomerTransactionSerializer, InstallmentPlanSerializer, InstallmentPaymentSerializer
)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.order_by('name')
    search_fields = ['name', 'phone', 'email', 'id_number']
    filterset_fields = ['customer_type', 'is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Full financial statement for a customer."""
        customer = self.get_object()
        transactions = customer.transactions.order_by('-date')
        return Response({
            'customer': CustomerListSerializer(customer).data,
            'outstanding_balance': customer.outstanding_balance,
            'transactions': CustomerTransactionSerializer(transactions, many=True).data,
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def receive_payment(self, request, pk=None):
        """Record a payment received from a credit customer."""
        customer = self.get_object()
        amount = request.data.get('amount')
        if not amount or float(amount) <= 0:
            return Response({'detail': 'Valid amount required.'}, status=status.HTTP_400_BAD_REQUEST)

        amount = float(amount)
        customer.outstanding_balance = max(0, customer.outstanding_balance - amount)
        customer.save()

        CustomerTransaction.objects.create(
            customer=customer,
            transaction_type=CustomerTransaction.TYPE_PAYMENT,
            amount=amount,
            balance_after=customer.outstanding_balance,
            notes=request.data.get('notes', ''),
            recorded_by=request.user,
        )
        return Response({
            'detail': 'Payment recorded.',
            'new_balance': customer.outstanding_balance,
        })


class CustomerTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CustomerTransaction.objects.select_related('customer', 'recorded_by').order_by('-date')
    serializer_class = CustomerTransactionSerializer
    filterset_fields = ['customer', 'transaction_type']
    search_fields = ['customer__name']
    permission_classes = [IsAuthenticatedWithRole]


class InstallmentPlanViewSet(viewsets.ModelViewSet):
    queryset = InstallmentPlan.objects.select_related('customer', 'sale').prefetch_related('payments').order_by('-created_at')
    serializer_class = InstallmentPlanSerializer
    filterset_fields = ['customer', 'status']
    search_fields = ['customer__name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def pay_installment(self, request, pk=None):
        """Record an installment payment."""
        plan = self.get_object()
        if plan.status != InstallmentPlan.STATUS_ACTIVE:
            return Response(
                {'detail': 'This plan is not active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = float(request.data.get('amount', plan.monthly_installment))
        plan.amount_paid += amount
        plan.remaining_amount = max(0, plan.total_amount - plan.amount_paid)
        plan.paid_count += 1

        if plan.remaining_amount <= 0:
            plan.status = InstallmentPlan.STATUS_COMPLETED

        plan.save()

        # Record the installment payment
        InstallmentPayment.objects.create(
            plan=plan,
            payment_date=request.data.get('payment_date', __import__('datetime').date.today()),
            amount=amount,
            installment_number=plan.paid_count,
            notes=request.data.get('notes', ''),
            received_by=request.user,
        )

        # Update customer balance
        customer = plan.customer
        customer.outstanding_balance = max(0, customer.outstanding_balance - amount)
        customer.save()

        CustomerTransaction.objects.create(
            customer=customer,
            transaction_type=CustomerTransaction.TYPE_INSTALLMENT,
            amount=amount,
            balance_after=customer.outstanding_balance,
            sale=plan.sale,
            recorded_by=request.user,
        )

        return Response({
            'detail': 'Installment payment recorded.',
            'remaining_amount': plan.remaining_amount,
            'status': plan.status,
        })

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Return plans with overdue installments."""
        plans = [p for p in self.get_queryset().filter(status='active') if p.overdue_installments > 0]
        return Response(InstallmentPlanSerializer(plans, many=True).data)
