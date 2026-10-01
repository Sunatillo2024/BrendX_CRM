"""Products Views - catalog CRUD, barcode lookup, POS search"""
import io

import barcode as barcode_lib
import django_filters
from barcode.writer import ImageWriter
from django.db.models import F, Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import log_action
from apps.authentication.permissions import IsOwnerOrManager, IsAuthenticatedWithRole

from .models import Category, Color, Product, ProductVariant, Size
from .serializers import (
    CategorySerializer, ColorSerializer, ProductListSerializer, ProductSerializer,
    ProductVariantSerializer, SizeSerializer, VariantSearchSerializer,
)


class CategoryFilter(django_filters.FilterSet):
    class Meta:
        model = Category
        fields = ['is_active']


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['name', 'description']
    filterset_class = CategoryFilter

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]

    def perform_create(self, serializer):
        category = serializer.save()
        log_action(AuditLog.ACTION_CATEGORY_CHANGED, user=self.request.user, entity='category',
                   entity_id=category.pk, details={'name': category.name, 'op': 'create'})

    def perform_update(self, serializer):
        category = serializer.save()
        log_action(AuditLog.ACTION_CATEGORY_CHANGED, user=self.request.user, entity='category',
                   entity_id=category.pk, details={'name': category.name, 'op': 'update'})

    def destroy(self, request, *args, **kwargs):
        """
        Delete a category only when it is safe.
        If products still reference it, deactivate it instead of breaking data.
        """
        category = self.get_object()
        in_use = category.products.exists()
        if in_use:
            category.is_active = False
            category.save(update_fields=['is_active'])
            log_action(AuditLog.ACTION_CATEGORY_CHANGED, user=request.user, entity='category',
                       entity_id=category.pk,
                       details={'name': category.name, 'op': 'deactivate'})
            return Response(
                {'detail': 'Category is used by products and was deactivated instead of deleted.',
                 'deactivated': True},
                status=status.HTTP_200_OK,
            )
        log_action(AuditLog.ACTION_CATEGORY_CHANGED, user=request.user, entity='category',
                   entity_id=category.pk, details={'name': category.name, 'op': 'delete'})
        return super().destroy(request, *args, **kwargs)


class ColorViewSet(viewsets.ModelViewSet):
    queryset = Color.objects.all().order_by('name')
    serializer_class = ColorSerializer
    search_fields = ['name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]


class SizeViewSet(viewsets.ModelViewSet):
    queryset = Size.objects.all().order_by('size_type', 'display_order')
    serializer_class = SizeSerializer
    search_fields = ['name']
    filterset_fields = ['size_type']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').prefetch_related(
        'variants__color', 'variants__size'
    ).order_by('name')
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['name', 'barcode', 'description']
    filterset_fields = ['category', 'is_active']
    ordering_fields = ['name', 'base_selling_price', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]

    def perform_create(self, serializer):
        product = serializer.save()
        log_action(AuditLog.ACTION_PRODUCT_CREATED, user=self.request.user, entity='product',
                   entity_id=product.pk, details={'name': product.name, 'barcode': product.barcode})

    def perform_update(self, serializer):
        before = {'base_selling_price': str(serializer.instance.base_selling_price),
                  'base_cost_price': str(serializer.instance.base_cost_price),
                  'is_active': serializer.instance.is_active}
        product = serializer.save()
        after = {'base_selling_price': str(product.base_selling_price),
                 'base_cost_price': str(product.base_cost_price),
                 'is_active': product.is_active}
        log_action(AuditLog.ACTION_PRODUCT_UPDATED, user=self.request.user, entity='product',
                   entity_id=product.pk, details={'name': product.name, 'before': before, 'after': after})
        if before['base_selling_price'] != after['base_selling_price'] or \
           before['base_cost_price'] != after['base_cost_price']:
            log_action(AuditLog.ACTION_PRICE_CHANGED, user=self.request.user, entity='product',
                       entity_id=product.pk,
                       details={'name': product.name, 'old_price': before['base_selling_price'],
                                'new_price': after['base_selling_price']})

    def destroy(self, request, *args, **kwargs):
        """Deactivate instead of deleting so sales history stays intact."""
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=['is_active', 'updated_at'])
        product.variants.update(is_active=False)
        log_action(AuditLog.ACTION_PRODUCT_DELETED, user=request.user, entity='product',
                   entity_id=product.pk, details={'name': product.name, 'op': 'deactivate'})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def barcode_image(self, request, pk=None):
        """Generate a Code128 barcode PNG for the product."""
        product = self.get_object()
        buffer = io.BytesIO()
        try:
            code = barcode_lib.get('code128', product.barcode, writer=ImageWriter())
            code.write(buffer)
            buffer.seek(0)
            return HttpResponse(buffer.read(), content_type='image/png')
        except Exception:
            return Response({'detail': 'Could not generate barcode.'},
                            status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Fast POS lookup: match a product name OR a barcode, return flat variants.
        Used by the cashier screen (typing or scanning).
        """
        query = (request.query_params.get('q') or '').strip()
        limit = min(int(request.query_params.get('limit', 50)), 200)

        qs = ProductVariant.objects.select_related('product', 'color', 'size').filter(
            is_active=True, product__is_active=True
        )
        if query:
            qs = qs.filter(
                Q(product__name__icontains=query)
                | Q(barcode__icontains=query)
                | Q(product__barcode__icontains=query)
                | Q(sku__icontains=query)
            )
        qs = qs.order_by('product__name')[:limit]
        return Response(VariantSearchSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """
        Barcode scanner endpoint.
        Variant barcode -> that exact variant; product barcode -> its variants.
        """
        code = (request.query_params.get('code') or '').strip()
        if not code:
            return Response({'detail': 'Barcode required.'}, status=status.HTTP_400_BAD_REQUEST)

        variant = ProductVariant.objects.select_related('product', 'color', 'size').filter(
            barcode=code, is_active=True
        ).first()
        if variant:
            return Response({'type': 'variant', 'variant': VariantSearchSerializer(variant).data})

        product = Product.objects.filter(barcode=code, is_active=True).first()
        if product:
            variants = product.variants.filter(is_active=True).select_related('color', 'size')
            return Response({
                'type': 'product',
                'product': ProductListSerializer(product, context={'request': request}).data,
                'variants': VariantSearchSerializer(variants, many=True).data,
            })

        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Variants at or below their low-stock threshold."""
        variants = ProductVariant.objects.filter(
            is_active=True, product__is_active=True, stock_quantity__lte=F('low_stock_threshold')
        ).select_related('product', 'color', 'size').order_by('stock_quantity')
        return Response(VariantSearchSerializer(variants, many=True).data)


class ProductVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related(
        'product', 'color', 'size'
    ).order_by('product__name')
    serializer_class = ProductVariantSerializer
    search_fields = ['sku', 'barcode', 'product__name']
    filterset_fields = ['product', 'color', 'size', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsOwnerOrManager()]
        return [IsAuthenticatedWithRole()]
