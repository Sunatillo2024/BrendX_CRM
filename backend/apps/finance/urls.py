from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FinanceEntryViewSet

router = DefaultRouter()
router.register('', FinanceEntryViewSet, basename='finance-entries')

urlpatterns = [path('', include(router.urls))]
