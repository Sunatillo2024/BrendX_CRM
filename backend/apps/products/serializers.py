"""Products Serializers - cost/profit fields are owner-only."""
import json

from rest_framework import serializers
from django.db import transaction
from apps.common.tenancy import active_store, TenantSerializerMixin
from apps.stores.models import Store

from apps.common.serializers import OwnerOnlyFieldsMixin
from .models import Category, Color, Product, ProductVariant, Size
from .utils import generate_barcode

OWNER_ONLY_FIELDS = ('base_cost_price', 'cost_price', 'effective_cost', 'profit_margin')


class CostMaskingMixin(OwnerOnlyFieldsMixin):
    """Removes purchase-price fields from the payload for non-owner roles."""
    owner_only_fields = OWNER_ONLY_FIELDS


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'image', 'is_active', 'product_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()


class ColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Color
        fields = ['id', 'name', 'hex_code']


class SizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Size
        fields = ['id', 'name', 'size_type', 'display_order']


class ProductVariantSerializer(TenantSerializerMixin, CostMaskingMixin, serializers.ModelSerializer):
    color_detail = ColorSerializer(source='color', read_only=True)
    size_detail = SizeSerializer(source='size', read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    effective_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'product', 'color', 'color_detail', 'size', 'size_detail',
            'sku', 'barcode', 'selling_price', 'effective_price', 'cost_price', 'effective_cost',
            'stock_quantity', 'low_stock_threshold', 'is_active',
            'is_low_stock', 'is_out_of_stock', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'sku']

    @transaction.atomic
    def create(self, validated_data):
        store = active_store(self.context['request'].user)
        Store.objects.select_for_update().get(pk=store.pk)
        product = validated_data['product']
        if product.store_id != store.pk:
            raise serializers.ValidationError('Cross-store product denied.')
        stock = validated_data.pop('stock_quantity', 0)
        if stock < 0:
            raise serializers.ValidationError('Stock cannot be negative.')
        if not self.context['request'].user.can_view_financials:
            validated_data.pop('cost_price', None)
        code = validated_data.get('barcode') or generate_barcode()
        if Product.objects.filter(store=store, barcode=code).exists() or ProductVariant.objects.filter(store=store, barcode=code).exists():
            raise serializers.ValidationError({'barcode': 'Barcode already exists.'})
        variant = ProductVariant(store=store, **validated_data)
        variant.barcode = code
        variant.sku = variant.generate_sku() + '-' + generate_barcode()[-6:]
        variant.save()
        from apps.inventory.services import set_counted_stock
        set_counted_stock(variant, stock, user=self.context['request'].user)
        return variant

    @transaction.atomic
    def update(self, instance, validated_data):
        Store.objects.select_for_update().get(pk=instance.store_id)
        if 'product' in validated_data and validated_data['product'].pk != instance.product_id:
            raise serializers.ValidationError('Cannot move a variant between products.')
        stock = validated_data.pop('stock_quantity', instance.stock_quantity)
        if stock < 0:
            raise serializers.ValidationError('Stock cannot be negative.')
        if not self.context['request'].user.can_view_financials:
            validated_data.pop('cost_price', None)
        code = validated_data.get('barcode', instance.barcode)
        if Product.objects.filter(store=instance.store, barcode=code).exists() or ProductVariant.objects.filter(store=instance.store, barcode=code).exclude(pk=instance.pk).exists():
            raise serializers.ValidationError({'barcode': 'Barcode already exists.'})
        instance = super().update(instance, validated_data)
        from apps.inventory.services import set_counted_stock
        set_counted_stock(instance, stock, user=self.context['request'].user)
        return instance

    def validate_barcode(self, value):
        qs = ProductVariant.objects.filter(store=active_store(self.context['request'].user), barcode=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This barcode is already used by another variant.')
        return value


class VariantWriteSerializer(serializers.ModelSerializer):
    """Nested variant write used by the product form."""
    id = serializers.IntegerField(required=False)
    # Left blank -> a unique barcode is generated on save.
    barcode = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'color', 'size', 'barcode', 'selling_price', 'cost_price',
            'stock_quantity', 'low_stock_threshold', 'is_active',
        ]

    def validate_barcode(self, value):
        qs = ProductVariant.objects.filter(store=active_store(self.context['request'].user), barcode=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if value and qs.exists():
            raise serializers.ValidationError('This barcode is already used by another variant.')
        return value


class ProductSerializer(TenantSerializerMixin, CostMaskingMixin, serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    variants = VariantWriteSerializer(many=True, required=False)
    total_stock = serializers.IntegerField(read_only=True)
    # Left blank -> a unique barcode is generated on save.
    barcode = serializers.CharField(required=False, allow_blank=True, max_length=50)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'category', 'category_name',
            'barcode', 'image', 'base_cost_price', 'base_selling_price',
            'low_stock_threshold', 'is_active', 'variants', 'total_stock',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_barcode(self, value):
        qs = Product.objects.filter(store=active_store(self.context['request'].user), barcode=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if value and qs.exists():
            raise serializers.ValidationError('This barcode is already used by another product.')
        if value and ProductVariant.objects.filter(store=active_store(self.context['request'].user), barcode=value).exists():
            raise serializers.ValidationError('This barcode is already used by a product variant.')
        return value

    def validate(self, attrs):
        """Catch duplicate barcodes inside a single payload before the DB does."""
        if not self.context['request'].user.can_view_financials:
            attrs.pop('base_cost_price', None)
        product_barcode = attrs.get('barcode')
        variants = attrs.get('variants') or []
        codes = [v.get('barcode') for v in variants if v.get('barcode')]
        if len(codes) != len(set(codes)):
            raise serializers.ValidationError(
                {'variants': 'The same barcode appears on more than one variant.'}
            )
        if product_barcode and product_barcode in codes:
            raise serializers.ValidationError(
                {'variants': 'A variant barcode equals the product barcode.'}
            )
        if product_barcode and not self.instance and \
                ProductVariant.objects.filter(store=active_store(self.context['request'].user), barcode=product_barcode).exists():
            raise serializers.ValidationError(
                {'barcode': 'This barcode is already used by a product variant.'}
            )
        return attrs

    def to_internal_value(self, data):
        # Multipart forms send nested variants as a JSON string.
        if hasattr(data, 'get') and isinstance(data.get('variants'), str):
            data = data.copy()
            try:
                data['variants'] = json.loads(data['variants'])
            except (TypeError, ValueError):
                raise serializers.ValidationError({'variants': 'Invalid JSON.'})
        return super().to_internal_value(data)

    def _validate_codes(self, store, barcode, variants, instance=None):
        products = Product.objects.filter(store=store)
        if instance:
            products = products.exclude(pk=instance.pk)
        codes = [barcode] + [v.get('barcode') for v in variants]
        ids = [v.get('id') for v in variants if v.get('id')]
        existing = ProductVariant.objects.filter(store=store).exclude(pk__in=ids)
        for code in filter(None, codes):
            if products.filter(barcode=code).exists() or existing.filter(barcode=code).exists():
                raise serializers.ValidationError({'barcode': 'Товар с таким штрих-кодом уже существует.'})
        for v in variants:
            if v.get('color') and v['color'].store_id != store.pk or v.get('size') and v['size'].store_id != store.pk:
                raise serializers.ValidationError('Cross-store attributes denied.')
            if int(v.get('stock_quantity', 0)) < 0:
                raise serializers.ValidationError('Stock cannot be negative.')

    def _save_variants(self, product, variants_data):
        keep_ids = []
        user = self.context['request'].user
        if not user.can_view_financials:
            for row in variants_data:
                row.pop('cost_price', None)
        seen_barcodes = set()
        combinations = [(v.get('color').pk if v.get('color') else None, v.get('size').pk if v.get('size') else None) for v in variants_data]
        if len(combinations) != len(set(combinations)):
            raise serializers.ValidationError({'variants': 'Duplicate size/color combination.'})
        for item in variants_data:
            item = dict(item)
            variant_id = item.pop('id', None)
            if not item.get('barcode'):
                item['barcode'] = generate_barcode()
            if item['barcode'] in seen_barcodes:
                raise serializers.ValidationError(
                    {'variants': f'Barcode {item["barcode"]} is used twice in this product.'}
                )
            seen_barcodes.add(item['barcode'])

            stock = item.pop('stock_quantity', 0)
            if variant_id:
                variant = ProductVariant.objects.filter(pk=variant_id, product=product).first()
                if variant is None:
                    raise serializers.ValidationError({'variants': 'Variant does not belong to this product.'})
                for key, value in item.items():
                    setattr(variant, key, value)
                variant.sku = variant.generate_sku()
                variant.save()
            else:
                variant = ProductVariant(product=product, store=product.store, **item)
                variant.sku = variant.generate_sku()
                # Guarantee SKU uniqueness for identical attribute sets
                if ProductVariant.objects.filter(store=product.store, sku=variant.sku).exists():
                    variant.sku = f'{variant.sku}-{generate_barcode()[-4:]}'
                variant.save()
            from apps.inventory.services import set_counted_stock
            set_counted_stock(variant, stock, user=user, reason='correction', notes='Product form')
            keep_ids.append(variant.pk)

        # Variants removed in the form are deactivated, never deleted
        # (sales history references them).
        product.variants.exclude(pk__in=keep_ids).update(is_active=False)

    @transaction.atomic
    def create(self, validated_data):
        store = active_store(self.context['request'].user)
        Store.objects.select_for_update().get(pk=store.pk)
        validated_data['store'] = store
        variants_data = validated_data.pop('variants', [])
        self._validate_codes(store, validated_data.get('barcode'), variants_data)
        if not validated_data.get('barcode'):
            validated_data['barcode'] = generate_barcode()
        product = Product.objects.create(**validated_data)
        self._save_variants(product, variants_data)
        return product

    @transaction.atomic
    def update(self, instance, validated_data):
        Store.objects.select_for_update().get(pk=instance.store_id)
        variants_data = validated_data.pop('variants', None)
        self._validate_codes(instance.store, validated_data.get('barcode', instance.barcode), variants_data or [], instance)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if not instance.barcode:
            instance.barcode = generate_barcode()
        instance.save()
        if variants_data is not None:
            self._save_variants(instance, variants_data)
        return instance


class ProductListSerializer(CostMaskingMixin, serializers.ModelSerializer):
    """Lightweight serializer for product listings."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    total_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category', 'category_name', 'barcode', 'image',
            'base_cost_price', 'base_selling_price', 'low_stock_threshold',
            'is_active', 'total_stock', 'created_at',
        ]


class VariantSearchSerializer(serializers.ModelSerializer):
    """Flat, POS-friendly variant row (name + colour + size + price + stock)."""
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    category_name = serializers.CharField(source='product.category.name', read_only=True, default=None)
    color_name = serializers.CharField(source='color.name', read_only=True, default=None)
    size_name = serializers.CharField(source='size.name', read_only=True, default=None)
    image = serializers.ImageField(source='product.image', read_only=True)
    price = serializers.DecimalField(
        source='effective_price', max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'product_id', 'product_name', 'category_name', 'image',
            'color_name', 'size_name', 'barcode', 'price',
            'stock_quantity', 'is_active',
        ]
