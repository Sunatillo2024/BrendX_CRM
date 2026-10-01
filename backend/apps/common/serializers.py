"""Shared serializer helpers."""


def can_view_cost(context):
    """True only for the owner - managers/cashiers never receive cost data."""
    request = context.get('request') if context else None
    user = getattr(request, 'user', None)
    return bool(user and getattr(user, 'is_authenticated', False) and user.can_view_financials)


class OwnerOnlyFieldsMixin:
    """
    Removes purchase-price / profit fields from the payload for every role
    except the owner. This is a *backend* guarantee - hiding a field in the
    UI is never enough.
    """
    owner_only_fields = ()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not can_view_cost(self.context):
            for field in self.owner_only_fields:
                data.pop(field, None)
        return data
