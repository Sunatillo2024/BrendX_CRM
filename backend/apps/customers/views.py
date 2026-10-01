"""Customers Views - simple customer registry"""
from rest_framework import viewsets

from apps.authentication.permissions import IsAuthenticatedWithRole, IsOwnerOrManager

from apps.common.tenancy import TenantViewMixin
from .models import Customer
from .serializers import CustomerListSerializer, CustomerSerializer


class CustomerViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.order_by('name')
    search_fields = ['name', 'phone', 'email']
    filterset_fields = ['is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]

    def destroy(self, request, *args, **kwargs):
        """Deactivate rather than delete - sales keep the customer reference."""
        customer = self.get_object()
        customer.is_active = False
        customer.save(update_fields=['is_active', 'updated_at'])
        from rest_framework import status
        from rest_framework.response import Response
        return Response(status=status.HTTP_204_NO_CONTENT)
