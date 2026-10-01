"""Authentication Permissions - Role-Based Access Control (owner/manager/cashier)"""
from rest_framework.permissions import BasePermission


def _role(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return None
    return user.role


class IsOwner(BasePermission):
    """Owner only - full access, including money/profit."""

    message = 'Only the owner can perform this action.'

    def has_permission(self, request, view):
        return _role(request) == 'owner'


class IsOwnerOrManager(BasePermission):
    """Owner + manager (operational access, no profit data)."""

    message = 'Only the owner or a manager can perform this action.'

    def has_permission(self, request, view):
        return _role(request) in ('owner', 'manager')


class IsAuthenticatedWithRole(BasePermission):
    """Any authenticated employee."""

    message = 'Authentication required.'

    def has_permission(self, request, view):
        return _role(request) is not None


# Backwards-compatible aliases (older imports)
IsAdmin = IsOwner
IsAdminOrManager = IsOwnerOrManager
