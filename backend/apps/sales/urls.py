from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SaleReturnViewSet, SaleViewSet

router = DefaultRouter()
router.register('returns', SaleReturnViewSet, basename='sale-returns')
router.register('', SaleViewSet, basename='sales')

urlpatterns = [path('', include(router.urls))]
