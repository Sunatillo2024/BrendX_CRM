from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InventoryValuationView, StockMovementViewSet, StockReceiptViewSet

router = DefaultRouter()
router.register('receipts', StockReceiptViewSet, basename='stock-receipts')
router.register('movements', StockMovementViewSet, basename='stock-movements')

urlpatterns = [
    path('valuation/', InventoryValuationView.as_view(), name='inventory-valuation'),
    path('', include(router.urls)),
]
