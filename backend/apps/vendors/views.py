"""Vendors Views - Vendor CRUD and financial transaction management"""
from django.db import transaction
from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsAdminOrManager, IsAuthenticatedWithRole
from apps.common.tenancy import TenantViewMixin
from .models import Vendor, VendorTransaction
from .serializers import VendorSerializer, VendorListSerializer, VendorTransactionSerializer


class VendorViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Vendor.objects.order_by('name')
    search_fields = ['name', 'phone', 'email', 'company_name']
    filterset_fields = ['is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return VendorListSerializer
        return VendorSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'pay', 'statement']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Full financial statement for a vendor."""
        vendor = self.get_object()
        transactions = vendor.transactions.order_by('-date')
        return Response({
            'vendor': VendorListSerializer(vendor).data,
            'balance': vendor.balance,
            'transactions': VendorTransactionSerializer(transactions, many=True).data,
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def pay(self, request, pk=None):
        """Record a payment made to a vendor (reduces our debt)."""
        vendor = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', '0')))
        except (InvalidOperation, ValueError):
            amount = Decimal('0')
        if not amount.is_finite() or amount <= 0:
            return Response({'detail': 'Valid amount required.'}, status=status.HTTP_400_BAD_REQUEST)

        vendor = Vendor.objects.select_for_update().get(pk=vendor.pk, store=request.user.store)
        vendor.balance -= amount
        vendor.save()

        VendorTransaction.objects.create(
            vendor=vendor,
            transaction_type=VendorTransaction.TYPE_PAYMENT,
            amount=amount,
            balance_after=vendor.balance,
            date=request.data.get('date', __import__('datetime').date.today()),
            notes=request.data.get('notes', ''),
            created_by=request.user,
        )
        return Response({'detail': 'Payment recorded.', 'new_balance': vendor.balance})


class VendorTransactionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = VendorTransaction.objects.select_related('vendor', 'created_by').order_by('-date')
    serializer_class = VendorTransactionSerializer
    http_method_names = ['get', 'post', 'head', 'options']
    filterset_fields = ['vendor', 'transaction_type']
    search_fields = ['vendor__name', 'reference']

    def get_permissions(self):
        return [IsAdminOrManager()]

    @transaction.atomic
    def perform_create(self, serializer):
        vendor = Vendor.objects.select_for_update().get(pk=serializer.validated_data['vendor'].pk, store=self.request.user.store)
        t_type = serializer.validated_data['transaction_type']
        amount = serializer.validated_data['amount']

        # Update vendor balance
        if t_type == VendorTransaction.TYPE_PURCHASE:
            vendor.balance += amount   # we owe more
        elif t_type == VendorTransaction.TYPE_PAYMENT:
            vendor.balance -= amount   # we paid
        elif t_type in [VendorTransaction.TYPE_RETURN, VendorTransaction.TYPE_REFUND]:
            vendor.balance -= amount   # vendor returns our money
        vendor.save()

        serializer.save(balance_after=vendor.balance, created_by=self.request.user)
