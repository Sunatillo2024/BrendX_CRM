"""Audit Views - read-only trail, owner only."""
from rest_framework import viewsets

from apps.authentication.permissions import IsOwnerOrManager

from apps.common.tenancy import TenantViewMixin
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    """
    WHO / WHAT / WHEN trail.

    Managers can see the trail (they need it for stock questions); secrets are
    never stored in it to begin with.
    """
    queryset = AuditLog.objects.select_related('user').order_by('-created_at')
    serializer_class = AuditLogSerializer
    filterset_fields = ['action', 'entity', 'username']
    search_fields = ['username', 'entity', 'entity_id']
    permission_classes = [IsOwnerOrManager]
