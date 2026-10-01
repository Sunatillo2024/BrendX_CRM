from django.http import HttpResponseForbidden
from django.utils import timezone
from zoneinfo import ZoneInfo
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed


class StoreContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = request.user
        if request.path.startswith('/admin/') and user.is_authenticated and user.role != 'platform_admin':
            return HttpResponseForbidden('Technical admin access denied.')
        if request.path.startswith('/api/'):
            from apps.authentication.backends import StoreJWTAuthentication
            try:
                result = StoreJWTAuthentication().authenticate(request)
                if result:
                    user = result[0]
            except (AuthenticationFailed, InvalidToken, TokenError):
                # DRF renders its usual authentication error; never treat this
                # failure as valid store context.
                user = None
        timezone.deactivate()
        if user and user.is_authenticated and user.store_id and user.store.is_active:
            timezone.activate(ZoneInfo(user.store.timezone))
        try:
            return self.get_response(request)
        finally:
            timezone.deactivate()
