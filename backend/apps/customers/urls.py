from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, CustomerTransactionViewSet, InstallmentPlanViewSet

router = DefaultRouter()
router.register('installment-plans', InstallmentPlanViewSet, basename='installment-plans')
router.register('transactions', CustomerTransactionViewSet, basename='customer-transactions')
router.register('', CustomerViewSet, basename='customers')

urlpatterns = [path('', include(router.urls))]
