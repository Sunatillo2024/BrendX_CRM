"""Authentication Permissions - Role-Based Access Control"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrManager(BasePermission):
    """Allow access to admin and manager users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_manager)


class IsAuthenticatedWithRole(BasePermission):
    """Allow any authenticated user, but limit actions by role."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
