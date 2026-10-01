from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


def check_access(user):
    if not user.is_active:
        raise AuthenticationFailed('Account disabled.')
    if user.role == 'platform_admin':
        if user.store_id is not None:
            raise AuthenticationFailed('Invalid account context.')
    elif not user.store_id or not user.store.is_active:
        raise AuthenticationFailed('Store access disabled.')


class StoreJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        check_access(user)
        return user


class StoreRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        token = RefreshToken(attrs['refresh'])
        try:
            user = User.objects.select_related('store').get(pk=token['user_id'])
        except User.DoesNotExist:
            raise AuthenticationFailed('Account unavailable.')
        check_access(user)
        return super().validate(attrs)
