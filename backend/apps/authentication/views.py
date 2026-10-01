"""Authentication Views - PIN login, employee management."""
from django.conf import settings
from django.db import transaction
from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.audit.models import AuditLog
from apps.audit.services import log_action

from apps.common.tenancy import TenantViewMixin, active_store
from .models import PinAttempt, User
from .permissions import IsOwner, IsOwnerOrManager
from .serializers import (
    ChangePasswordSerializer, ChangePinSerializer, CustomTokenObtainPairSerializer,
    PinLoginSerializer, ProfileUpdateSerializer, SetPinSerializer, UserCreateSerializer,
    UserSerializer, UserUpdateSerializer, pin_is_taken,
)


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') or None


def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserSerializer(user).data,
    }


class PinLoginView(generics.GenericAPIView):
    """
    Employee login with a PIN.

    The PIN is only ever compared against a stored hash; it is never logged.
    Repeated failures from the same IP trigger a temporary lockout.
    """
    serializer_class = PinLoginSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = _client_ip(request)
        max_attempts = getattr(settings, 'PIN_MAX_ATTEMPTS', 5)
        lockout = getattr(settings, 'PIN_LOCKOUT_SECONDS', 300)

        locked_until = PinAttempt.locked_until(ip, max_attempts, lockout)
        if locked_until:
            seconds = max(1, int((locked_until - timezone.now()).total_seconds()))
            return Response(
                {'detail': f'Too many incorrect attempts. Try again in {seconds} seconds.',
                 'retry_after': seconds},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pin = str(serializer.validated_data['pin'])

        user = None
        candidates = User.objects.filter(is_active=True).exclude(pin_hash='')
        if serializer.validated_data.get('platform'):
            candidates = candidates.filter(role='platform_admin', store__isnull=True)
        else:
            code = serializer.validated_data.get('store_code', '').strip().upper()
            if not code:
                return Response({'detail': 'Store code required.'}, status=400)
            candidates = candidates.filter(store__code=code, store__is_active=True).exclude(role='platform_admin')
        for candidate in candidates:
            if candidate.check_pin(pin):
                user = candidate
                break

        if not user:
            PinAttempt.objects.create(ip_address=ip, was_success=False)
            log_action(AuditLog.ACTION_LOGIN_FAILED, entity='user', details={'ip': ip or ''})
            remaining = max(0, max_attempts - PinAttempt.recent_failures(ip, lockout))
            return Response(
                {'detail': 'Incorrect PIN.', 'attempts_left': remaining},
                status=status.HTTP_400_BAD_REQUEST,
            )

        PinAttempt.objects.create(ip_address=ip, was_success=True)
        User.objects.filter(pk=user.pk).update(last_login=timezone.now())
        log_action(AuditLog.ACTION_LOGIN, user=user, entity='user', entity_id=user.pk,
                   details={'method': 'pin'})
        return Response(_issue_tokens(user), status=status.HTTP_200_OK)


class CustomTokenObtainPairView(TokenObtainPairView):
    """Username/password login - technical access (owner / Django admin users)."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                user = User.objects.get(username=request.data.get('username'))
                log_action(AuditLog.ACTION_LOGIN, user=user, entity='user',
                           entity_id=user.pk, details={'method': 'password'})
            except User.DoesNotExist:
                pass
        return response


class LogoutView(generics.GenericAPIView):
    """Blacklist the refresh token on logout."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
        except Exception:
            return Response({'detail': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)
        log_action(AuditLog.ACTION_LOGOUT, user=request.user, entity='user',
                   entity_id=request.user.pk)
        return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)


class UserViewSet(TenantViewMixin, viewsets.ModelViewSet):
    def get_queryset(self):
        return super().get_queryset().exclude(role='platform_admin')

    def get_serializer(self, *args, **kwargs):
        # Profile actions also support a global platform account.
        if self.action in ('me', 'change_password', 'change_pin'):
            return viewsets.ModelViewSet.get_serializer(self, *args, **kwargs)
        return super().get_serializer(*args, **kwargs)

    """Employee management. Only the owner can create/edit/deactivate employees."""
    queryset = User.objects.all().order_by('first_name', 'username')
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone']
    filterset_fields = ['role', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        # ``get_permissions`` is what DRF calls, so the role rules live here
        # rather than in @action(permission_classes=...).
        if self.action in ['list', 'retrieve']:
            return [IsOwnerOrManager()]
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'set_pin']:
            return [IsOwner()]
        return [IsAuthenticated()]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        from apps.stores.models import Store
        Store.objects.select_for_update().get(pk=active_store(request.user).pk)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = serializer.save(store=active_store(self.request.user), is_staff=False, is_superuser=False)
        log_action(AuditLog.ACTION_USER_CREATED, user=self.request.user, entity='user',
                   entity_id=user.pk, details={'username': user.username, 'role': user.role})

    def perform_update(self, serializer):
        target = self.get_object()
        if target.role == 'owner':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Use the platform panel to manage the owner.')
        before = {'role': target.role, 'is_active': target.is_active}
        new_pin = bool(serializer.validated_data.get('pin'))
        user = serializer.save()
        log_action(AuditLog.ACTION_USER_UPDATED, user=self.request.user, entity='user',
                   entity_id=user.pk,
                   details={'username': user.username, 'before': before,
                            'after': {'role': user.role, 'is_active': user.is_active}})
        if new_pin:
            log_action(AuditLog.ACTION_PIN_CHANGED, user=self.request.user, entity='user',
                       entity_id=user.pk, details={'username': user.username, 'by': 'owner'})

    def perform_destroy(self, instance):
        # Never hard-delete an employee: deactivate to keep sales history intact.
        if instance.role == 'owner':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Owner deactivation is managed by the platform.')
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        log_action(AuditLog.ACTION_USER_DEACTIVATED, user=self.request.user, entity='user',
                   entity_id=instance.pk, details={'username': instance.username})

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """Get or update the current employee profile."""
        user = request.user
        if request.method == 'GET':
            return Response(UserSerializer(user).data)
        serializer = ProfileUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'old_password': 'Incorrect password.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        update_session_auth_hash(request, user)
        return Response({'detail': 'Password updated successfully.'})

    @action(detail=False, methods=['post'])
    def change_pin(self, request):
        """Change your own PIN (requires the current PIN)."""
        serializer = ChangePinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_pin(serializer.validated_data['current_pin']):
            return Response({'current_pin': 'Incorrect PIN.'}, status=status.HTTP_400_BAD_REQUEST)

        new_pin = serializer.validated_data['pin']
        if pin_is_taken(new_pin, exclude_user_id=user.pk, store=user.store):
            return Response({'pin': 'This PIN is already used by another employee.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_pin(new_pin)
        user.save(update_fields=['pin_hash', 'updated_at'])
        log_action(AuditLog.ACTION_PIN_CHANGED, user=user, entity='user', entity_id=user.pk,
                   details={'username': user.username, 'by': 'self'})
        return Response({'detail': 'PIN updated successfully.'})

    @action(detail=True, methods=['post'])
    def set_pin(self, request, pk=None):
        """Owner sets/resets an employee PIN."""
        user = self.get_object()
        serializer = SetPinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_pin = serializer.validated_data['pin']
        if pin_is_taken(new_pin, exclude_user_id=user.pk, store=user.store):
            return Response({'pin': 'This PIN is already used by another employee.'},
                            status=status.HTTP_400_BAD_REQUEST)
        user.set_pin(new_pin)
        user.save(update_fields=['pin_hash', 'updated_at'])
        log_action(AuditLog.ACTION_PIN_CHANGED, user=request.user, entity='user',
                   entity_id=user.pk, details={'username': user.username, 'by': 'owner'})
        return Response({'detail': 'PIN updated successfully.'})
