"""Audit Serializers"""
from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'username', 'action', 'action_display', 'entity', 'entity_id',
                  'details', 'created_at']
        read_only_fields = fields
