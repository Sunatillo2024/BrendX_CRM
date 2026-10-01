"""Shared query helpers used by sales / inventory / finance views."""
from datetime import date, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date

# Period keys understood by every list/report endpoint
PERIOD_TODAY = 'today'
PERIOD_YESTERDAY = 'yesterday'
PERIOD_WEEK = 'week'
PERIOD_MONTH = 'month'
PERIOD_CUSTOM = 'custom'
PERIOD_ALL = 'all'


def resolve_period(params):
    """
    Resolve ``period`` / ``date_from`` / ``date_to`` query params into a
    (start_date, end_date) tuple. Both values are inclusive and may be None.
    """
    period = (params.get('period') or '').strip().lower()
    today = timezone.localdate()

    if period == PERIOD_TODAY:
        return today, today
    if period == PERIOD_YESTERDAY:
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    if period == 'days30':
        return today - timedelta(days=29), today
    if period == PERIOD_WEEK:
        return today - timedelta(days=6), today
    if period == PERIOD_MONTH:
        return today.replace(day=1), today
    if period == PERIOD_ALL:
        return None, None

    start = parse_date(params.get('date_from') or '') 
    end = parse_date(params.get('date_to') or '')
    if period == PERIOD_CUSTOM or start or end:
        from rest_framework.exceptions import ValidationError
        if params.get('date_from') and not start or params.get('date_to') and not end:
            raise ValidationError('Invalid date range.')
        if start and end and (start > end or (end-start).days > 3660):
            raise ValidationError('Invalid or excessively long date range.')
        return start, end
    return None, None


class DateRangeFilterMixin:
    """
    Adds ``?period=``, ``?date_from=``/``?date_to=`` filtering on a date field.

    Set ``date_field`` on the view (defaults to 'created_at').
    """
    date_field = 'created_at'

    def filter_by_period(self, queryset):
        start, end = resolve_period(self.request.query_params)
        if not start and not end:
            return queryset

        # A DateTimeField needs the __date transform; a DateField does not.
        from django.db.models import DateTimeField
        field = queryset.model._meta.get_field(self.date_field)
        suffix = '__date' if isinstance(field, DateTimeField) else ''
        if start:
            queryset = queryset.filter(**{f'{self.date_field}{suffix}__gte': start})
        if end:
            queryset = queryset.filter(**{f'{self.date_field}{suffix}__lte': end})
        return queryset


def today_range():
    today = timezone.localdate()
    return today, today


def parse_date_param(value):
    return parse_date(value) if value else None


__all__ = [
    'resolve_period', 'DateRangeFilterMixin', 'today_range', 'parse_date_param',
    'PERIOD_TODAY', 'PERIOD_YESTERDAY', 'PERIOD_WEEK', 'PERIOD_MONTH',
    'PERIOD_CUSTOM', 'PERIOD_ALL', 'date',
]
