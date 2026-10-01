import uuid
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import viewsets, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.authentication.models import User
from apps.authentication.permissions import IsPlatformAdmin, IsOwner, IsAuthenticatedWithRole
from apps.authentication.serializers import UserSerializer, validate_pin_format, pin_is_taken
from apps.audit.services import log_action
from apps.sales.models import Sale
from apps.products.models import Product
from apps.common.tenancy import active_store
from .models import Store
from .serializers import PlatformStoreSerializer, StoreSettingsSerializer


def make_owner(store, name, pin, language):
    user = User(username=f'{store.code.lower()}-owner-{uuid.uuid4().hex[:8]}',
                first_name=name, role='owner', store=store, language=language)
    user.set_unusable_password()
    user.set_pin(pin)
    user.save()
    return user


class PlatformDashboard(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        return Response({
            'total_stores': Store.objects.count(),
            'active_stores': Store.objects.filter(is_active=True).count(),
            'inactive_stores': Store.objects.filter(is_active=False).count(),
            'total_users': User.objects.exclude(role='platform_admin').count(),
            'total_owners': User.objects.filter(role='owner').count(),
            'total_sales_transactions': Sale.objects.count(),
            'recent_stores': PlatformStoreSerializer(Store.objects.order_by('-created_at')[:5], many=True).data,
        })


class PlatformStoreViewSet(viewsets.ModelViewSet):
    permission_classes = [IsPlatformAdmin]
    queryset = Store.objects.all()
    serializer_class = PlatformStoreSerializer
    search_fields = ['name', 'code', 'phone']
    filterset_fields = ['is_active']
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    @transaction.atomic
    def perform_create(self, serializer):
        data = dict(serializer.validated_data)
        name, pin = data.pop('owner_name'), data.pop('owner_pin')
        language = data.pop('owner_language', 'ru')
        store = Store.objects.create(**data)
        make_owner(store, name, pin, language)
        serializer.instance = store
        log_action('store_created', user=self.request.user, store=store,
                   entity='store', entity_id=store.pk)

    def perform_update(self, serializer):
        store = serializer.save()
        log_action('store_updated', user=self.request.user, store=store,
                   entity='store', entity_id=store.pk, details={'active': store.is_active})

    def retrieve(self, request, *args, **kwargs):
        store = self.get_object()
        data = self.get_serializer(store).data
        data['owners'] = UserSerializer(store.user_set.filter(role='owner'), many=True).data
        data['employees_count'] = store.user_set.exclude(role='platform_admin').count()
        data['products_count'] = Product.objects.filter(store=store).count()
        data['sales_today'] = Sale.objects.filter(store=store, created_at__date=timezone.localdate()).count()
        data['last_activity'] = store.user_set.aggregate(last=Max('last_login'))['last']
        return Response(data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def manage_owner(self, request, pk=None):
        store = Store.objects.select_for_update().get(pk=self.get_object().pk)
        name = str(request.data.get('name', '')).strip()
        pin = validate_pin_format(request.data.get('pin'))
        language = request.data.get('language', store.default_language)
        if not name or language not in ('uz', 'ru'):
            raise serializers.ValidationError('Name and valid language required.')
        owner = store.user_set.filter(role='owner').first()
        if pin_is_taken(pin, exclude_user_id=owner.pk if owner else None, store=store):
            raise serializers.ValidationError({'pin': 'PIN already used in this store.'})
        if owner:
            owner.first_name = name
            owner.language = language
            owner.is_active = True
            owner.set_pin(pin)
            owner.save()
        else:
            owner = make_owner(store, name, pin, language)
        log_action('store_owner_changed', user=request.user, store=store, entity='user', entity_id=owner.pk)
        return Response(UserSerializer(owner).data)


class StoreSettingsView(APIView):
    permission_classes = [IsAuthenticatedWithRole]

    def get(self, request):
        return Response(StoreSettingsSerializer(active_store(request.user)).data)

    def patch(self, request):
        if not IsOwner().has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Owner required.')
        store = active_store(request.user)
        serializer = StoreSettingsSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_action('settings_changed', user=request.user, entity='store', entity_id=store.pk)
        return Response(serializer.data)
