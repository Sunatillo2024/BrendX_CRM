"""Products Views - Full CRUD with barcode generation and image handling"""
import io
import barcode as barcode_lib
from barcode.writer import ImageWriter
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters

from apps.authentication.permissions import IsAdminOrManager, IsAuthenticatedWithRole
from .models import Category, Color, Size, Product, ProductVariant
from .serializers import (
    CategorySerializer, ColorSerializer, SizeSerializer,
    ProductSerializer, ProductListSerializer, ProductVariantSerializer
)


class CategoryFilter(django_filters.FilterSet):
    root_only = django_filters.BooleanFilter(field_name='parent', lookup_expr='isnull')

    class Meta:
        model = Category
        fields = ['is_active', 'parent']


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['name', 'description']
    filterset_class = CategoryFilter

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @action(detail=False, methods=['get'])
    def all(self, request):
        """Return all categories including nested children."""
        qs = Category.objects.filter(is_active=True).order_by('name')
        return Response(CategorySerializer(qs, many=True).data)


class ColorViewSet(viewsets.ModelViewSet):
    queryset = Color.objects.all().order_by('name')
    serializer_class = ColorSerializer
    search_fields = ['name']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]


class SizeViewSet(viewsets.ModelViewSet):
    queryset = Size.objects.all().order_by('size_type', 'display_order')
    serializer_class = SizeSerializer
    search_fields = ['name']
    filterset_fields = ['size_type']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category').prefetch_related(
        'variants__color', 'variants__size'
    ).order_by('-created_at')
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
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    @action(detail=True, methods=['get'])
    def barcode_image(self, request, pk=None):
        """Generate and return barcode image for a product."""
        product = self.get_object()
        buffer = io.BytesIO()
        try:
            code = barcode_lib.get('code128', product.barcode, writer=ImageWriter())
            code.write(buffer)
            buffer.seek(0)
            return HttpResponse(buffer.read(), content_type='image/png')
        except Exception:
            return Response({'detail': 'Could not generate barcode.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        """Lookup product by barcode (for POS scanner)."""
        barcode_val = request.query_params.get('code', '')
        if not barcode_val:
            return Response({'detail': 'Barcode required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Try product barcode first, then variant barcode
        product = Product.objects.filter(barcode=barcode_val, is_active=True).first()
        if product:
            return Response(ProductSerializer(product).data)

        variant = ProductVariant.objects.filter(
            barcode=barcode_val, is_active=True
        ).select_related('product', 'color', 'size').first()
        if variant:
            return Response({
                'product': ProductSerializer(variant.product).data,
                'matched_variant': ProductVariantSerializer(variant).data
            })

        return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Return all products with low or zero stock."""
        variants = ProductVariant.objects.filter(
            stock_quantity__lte=models_low_threshold(), is_active=True
        ).select_related('product', 'color', 'size')
        return Response(ProductVariantSerializer(variants, many=True).data)


def models_low_threshold():
    from django.db.models import F
    return F('low_stock_threshold')


class ProductVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related(
        'product', 'color', 'size'
    ).order_by('product__name')
    serializer_class = ProductVariantSerializer
    search_fields = ['sku', 'barcode', 'product__name']
    filterset_fields = ['product', 'color', 'size', 'is_active']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminOrManager()]
        return [IsAuthenticatedWithRole()]

    def perform_create(self, serializer):
        variant = serializer.save()
        if not variant.sku:
            variant.sku = variant.generate_sku()
            variant.save()
