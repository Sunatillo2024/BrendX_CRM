"""Finance Serializers"""
from rest_framework import serializers

from .models import FinanceEntry


class FinanceEntrySerializer(serializers.ModelSerializer):
    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be positive.')
        return value

    created_by_name = serializers.CharField(source='created_by.display_name', read_only=True,
                                            default=None)

    class Meta:
        model = FinanceEntry
        fields = ['id', 'entry_type', 'amount', 'category', 'comment', 'entry_date',
                  'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
