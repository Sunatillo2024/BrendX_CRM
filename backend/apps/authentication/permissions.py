from rest_framework.permissions import BasePermission


def _role(request):
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated or not user.is_active:
        return None
    if user.role == 'platform_admin':
        return user.role if user.store_id is None else None
    if not user.store_id or not user.store.is_active:
        return None
    return user.role


class IsOwner(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == 'owner'


class IsOwnerOrManager(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in ('owner', 'manager')


class IsAuthenticatedWithRole(BasePermission):
    def has_permission(self, request, view):
        return _role(request) in ('owner', 'manager', 'cashier')


class IsPlatformAdmin(BasePermission):
    def has_permission(self, request, view):
        return _role(request) == 'platform_admin'


IsAdmin = IsOwner
IsAdminOrManager = IsOwnerOrManager
