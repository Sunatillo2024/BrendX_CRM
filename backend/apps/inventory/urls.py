from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StockItemViewSet, StockAdjustmentViewSet

router = DefaultRouter()
router.register('stock', StockItemViewSet, basename='stock-items')
router.register('adjustments', StockAdjustmentViewSet, basename='stock-adjustments')

urlpatterns = [path('', include(router.urls))]
