"""Products URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ColorViewSet, SizeViewSet, ProductViewSet, ProductVariantViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='categories')
router.register('colors', ColorViewSet, basename='colors')
router.register('sizes', SizeViewSet, basename='sizes')
router.register('variants', ProductVariantViewSet, basename='product-variants')
router.register('', ProductViewSet, basename='products')

urlpatterns = [
    path('', include(router.urls)),
]
