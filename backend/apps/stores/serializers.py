import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from rest_framework import serializers
from apps.authentication.serializers import validate_pin_format
from .models import Store


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ['id', 'name', 'code', 'is_active', 'phone', 'address',
                  'receipt_header', 'receipt_footer', 'currency_code', 'currency_symbol',
                  'low_stock_threshold', 'default_language', 'timezone']
        read_only_fields = ['id', 'code', 'is_active']

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError('Invalid timezone.')
        return value


class PlatformStoreSerializer(StoreSettingsSerializer):
    owner_name = serializers.CharField(write_only=True, required=False)
    owner_pin = serializers.CharField(write_only=True, required=False, validators=[validate_pin_format])
    owner_language = serializers.ChoiceField(choices=['ru', 'uz'], write_only=True, default='ru')

    class Meta(StoreSettingsSerializer.Meta):
        fields = StoreSettingsSerializer.Meta.fields + ['notes', 'created_at', 'updated_at',
                  'owner_name', 'owner_pin', 'owner_language']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_code(self, value):
        value = value.strip().upper()
        if not re.fullmatch(r'[A-Z0-9_-]{2,40}', value):
            raise serializers.ValidationError('Use 2–40 letters, digits, _ or -.')
        qs = Store.objects.filter(code=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Store code already exists.')
        return value

    def validate(self, attrs):
        if not self.instance and (not attrs.get('owner_name', '').strip() or not attrs.get('owner_pin')):
            raise serializers.ValidationError('First owner name and PIN are required.')
        if self.instance and any(k in attrs for k in ('owner_name', 'owner_pin')):
            raise serializers.ValidationError('Use manage_owner to change the owner.')
        return attrs
