"""Finance Views - Income / Expense entries (Кирим / Чиқим)"""
from django.db.models import Q, Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import log_action
from apps.authentication.permissions import IsOwner, IsOwnerOrManager
from apps.common.filters import DateRangeFilterMixin, resolve_period
from apps.sales import services as sales_services

from apps.common.tenancy import TenantViewMixin, active_store
from .models import FinanceEntry
from .serializers import FinanceEntrySerializer


class FinanceEntryViewSet(TenantViewMixin, DateRangeFilterMixin, viewsets.ModelViewSet):
    """
    Income / expense book.

    Manager may add and see entries (they often pay the bills); the profit
    calculation stays owner-only.
    """
    queryset = FinanceEntry.objects.select_related('created_by').order_by(
        '-entry_date', '-created_at'
    )
    serializer_class = FinanceEntrySerializer
    search_fields = ['category', 'comment']
    filterset_fields = ['entry_type', 'category']
    ordering_fields = ['entry_date', 'amount', 'created_at']
    date_field = 'entry_date'

    def get_permissions(self):
        # Deleting a money record is owner-only; managers may add/edit entries.
        if self.action == 'destroy':
            return [IsOwner()]
        return [IsOwnerOrManager()]

    def get_queryset(self):
        return self.filter_by_period(super().get_queryset())

    def perform_create(self, serializer):
        entry = serializer.save(created_by=self.request.user, store=active_store(self.request.user))
        log_action(
            AuditLog.ACTION_INCOME_CREATED if entry.entry_type == FinanceEntry.TYPE_INCOME
            else AuditLog.ACTION_EXPENSE_CREATED,
            user=self.request.user, entity='finance_entry', entity_id=entry.pk,
            details={'amount': str(entry.amount), 'category': entry.category,
                     'entry_date': str(entry.entry_date)},
        )

    def perform_update(self, serializer):
        entry = serializer.save()
        log_action(
            AuditLog.ACTION_INCOME_CREATED if entry.entry_type == FinanceEntry.TYPE_INCOME
            else AuditLog.ACTION_EXPENSE_CREATED,
            user=self.request.user, entity='finance_entry', entity_id=entry.pk,
            details={'amount': str(entry.amount), 'op': 'update'},
        )

    def perform_destroy(self, instance):
        log_action(AuditLog.ACTION_FINANCE_DELETED, user=self.request.user,
                   entity='finance_entry', entity_id=instance.pk,
                   details={'amount': str(instance.amount), 'entry_type': instance.entry_type})
        instance.delete()

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Period totals.

        Everyone with access gets income/expense totals; only the owner gets
        the profit breakdown.
        """
        start, end = resolve_period(request.query_params)
        entries = self.filter_by_period(FinanceEntry.objects.filter(store=active_store(request.user)))
        totals = entries.aggregate(
            income=Sum('amount', filter=Q(entry_type=FinanceEntry.TYPE_INCOME)),
            expense=Sum('amount', filter=Q(entry_type=FinanceEntry.TYPE_EXPENSE)),
        )
        payload = {
            'period': {'start': start, 'end': end},
            'income': totals['income'] or 0,
            'expense': totals['expense'] or 0,
        }
        if request.user.can_view_financials:
            payload['financial'] = sales_services.financial_stats(start, end, store=active_store(request.user))
        return Response(payload)
