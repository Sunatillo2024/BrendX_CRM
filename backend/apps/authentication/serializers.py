"""Authentication Serializers"""
import secrets
import string

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


def validate_pin_format(value):
    from django.conf import settings as dj_settings
    if not value or not str(value).isdigit():
        raise serializers.ValidationError('PIN must contain digits only.')
    min_len = getattr(dj_settings, 'PIN_MIN_LENGTH', 4)
    max_len = getattr(dj_settings, 'PIN_MAX_LENGTH', 8)
    if not (min_len <= len(str(value)) <= max_len):
        raise serializers.ValidationError(f'PIN must be {min_len}-{max_len} digits long.')
    return str(value)


def pin_is_taken(pin, exclude_user_id=None, store=None):
    """PINs must be unique, otherwise PIN login cannot identify the employee."""
    qs = User.objects.filter(is_active=True, store=store).exclude(pin_hash='')
    if exclude_user_id:
        qs = qs.exclude(pk=exclude_user_id)
    for user in qs.only('id', 'pin_hash'):
        if user.check_pin(pin):
            return True
    return False


def _random_password():
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(24))


class UserSerializer(serializers.ModelSerializer):
    pin_set = serializers.BooleanField(source='has_pin', read_only=True)
    display_name = serializers.CharField(read_only=True)

    store_detail = serializers.SerializerMethodField()

    def get_store_detail(self, obj):
        if not obj.store_id:
            return None
        from apps.stores.serializers import StoreSettingsSerializer
        return StoreSettingsSerializer(obj.store).data

    class Meta:
        model = User
        fields = [
            'store', 'store_detail',
            'id', 'username', 'email', 'first_name', 'last_name', 'display_name',
            'role', 'phone', 'avatar', 'language', 'is_active', 'pin_set', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Owner creates employees. Public registration does not exist."""
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True, validators=[validate_pin_format])
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'language', 'is_active', 'pin', 'password',
        ]

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def validate_role(self, value):
        if value not in ('manager', 'cashier'):
            raise serializers.ValidationError('Invalid role.')
        return value

    def validate(self, attrs):
        pin = attrs.get('pin')
        if pin and pin_is_taken(pin, store=self.context['request'].user.store):
            raise serializers.ValidationError({'pin': 'This PIN is already used by another employee.'})
        return attrs

    def create(self, validated_data):
        pin = validated_data.pop('pin', '') or ''
        password = validated_data.pop('password', '') or _random_password()
        user = User(**validated_data)
        user.set_password(password)
        if pin:
            user.set_pin(pin)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    def validate_role(self, value):
        if value not in ('manager', 'cashier'):
            raise serializers.ValidationError('Only manager/cashier roles can be assigned here.')
        return value

    """Owner edits an employee. Password/PIN are never mass-assigned here."""
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True, validators=[validate_pin_format])

    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'phone', 'avatar',
            'role', 'language', 'is_active', 'pin',
        ]

    def validate(self, attrs):
        pin = attrs.get('pin')
        if pin and pin_is_taken(pin, exclude_user_id=self.instance.pk if self.instance else None, store=self.context['request'].user.store):
            raise serializers.ValidationError({'pin': 'This PIN is already used by another employee.'})
        return attrs

    def update(self, instance, validated_data):
        pin = validated_data.pop('pin', '') or ''
        user = super().update(instance, validated_data)
        if pin:
            user.set_pin(pin)
            user.save(update_fields=['pin_hash', 'updated_at'])
        return user


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Employees may edit their own basic profile / language."""

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'phone', 'avatar', 'language']


class SetPinSerializer(serializers.Serializer):
    pin = serializers.CharField(required=True, validators=[validate_pin_format])
    pin_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['pin'] != attrs['pin_confirm']:
            raise serializers.ValidationError({'pin': 'PINs do not match.'})
        return attrs


class ChangePinSerializer(serializers.Serializer):
    """Self-service PIN change - requires the current PIN."""
    current_pin = serializers.CharField(required=True)
    pin = serializers.CharField(required=True, validators=[validate_pin_format])
    pin_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['pin'] != attrs['pin_confirm']:
            raise serializers.ValidationError({'pin': 'PINs do not match.'})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    confirm_password = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'new_password': 'Passwords do not match.'})
        return attrs


class PinLoginSerializer(serializers.Serializer):
    pin = serializers.CharField(required=True, validators=[validate_pin_format])
    store_code = serializers.CharField(required=False)
    platform = serializers.BooleanField(default=False)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Username/password login (kept for owner/admin technical access)."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['full_name'] = user.display_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        from .backends import check_access
        check_access(self.user)
        data['user'] = UserSerializer(self.user).data
        return data
