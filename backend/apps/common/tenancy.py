from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

STORE_PATHS = {
    'productvariant': 'store', 'product': 'store', 'category': 'store',
    'color': 'store', 'size': 'store', 'user': 'store', 'customer': 'store',
    'vendor': 'store', 'financeentry': 'store', 'sale': 'store',
    'stockreceipt': 'store', 'auditlog': 'store',
    'saleitem': 'sale__store', 'receipt': 'sale__store',
    'salereturn': 'sale__store', 'salereturnitem': 'sale_return__sale__store',
    'stockmovement': 'product_variant__store', 'stockreceiptitem': 'receipt__store',
    'vendortransaction': 'vendor__store',
}


def active_store(user):
    if not user or not user.is_authenticated or user.role == 'platform_admin' or not user.store_id:
        raise PermissionDenied('Store account required.')
    if not user.is_active or not user.store.is_active:
        raise PermissionDenied('Store access is disabled.')
    return user.store


def scope(queryset, store):
    if store is None:
        raise PermissionDenied('Store context required.')
    path = STORE_PATHS.get(queryset.model._meta.model_name)
    if not path:
        raise PermissionDenied('Unsupported tenant entity.')
    return queryset.filter(**{path: store.pk})


def scope_fields(serializer, store):
    for field in serializer.fields.values():
        if isinstance(field, serializers.ListSerializer):
            scope_fields(field.child, store)
        elif isinstance(field, serializers.Serializer):
            scope_fields(field, store)
        elif isinstance(field, serializers.PrimaryKeyRelatedField) and field.queryset is not None:
            field.queryset = scope(field.queryset, store)


class TenantSerializerMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request:
            scope_fields(self, active_store(request.user))


class TenantViewMixin:
    def get_queryset(self):
        return scope(super().get_queryset(), active_store(self.request.user))

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        target = serializer.child if isinstance(serializer, serializers.ListSerializer) else serializer
        scope_fields(target, active_store(self.request.user))
        return serializer

    def perform_create(self, serializer):
        store = active_store(self.request.user)
        if hasattr(serializer.Meta.model, 'store_id'):
            serializer.save(store=store)
        else:
            serializer.save()
