from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VendorViewSet, VendorTransactionViewSet

router = DefaultRouter()
router.register('transactions', VendorTransactionViewSet, basename='vendor-transactions')
router.register('', VendorViewSet, basename='vendors')

urlpatterns = [path('', include(router.urls))]
