"""BrandX API - Main URL Configuration"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.admin.exceptions import NotRegistered
from django.urls import include, path

from apps.authentication.admin_login import PinAdminLoginView
from apps.stores.views import PlatformDashboard, PlatformStoreViewSet, StoreSettingsView
from rest_framework.routers import DefaultRouter
platform_router = DefaultRouter()
platform_router.register('stores', PlatformStoreViewSet, basename='platform-stores')

admin.site.site_header = 'BrandX'
admin.site.site_title = 'BrandX'
admin.site.index_title = 'Boshqaruv'

# Hide technical JWT token tables - not useful for a shop admin.
try:
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken, OutstandingToken,
    )
    for _model in (BlacklistedToken, OutstandingToken):
        try:
            admin.site.unregister(_model)
        except NotRegistered:
            pass
except Exception:  # pragma: no cover - token blacklist app is optional
    pass

urlpatterns = [
    # PIN login for the admin (must come before admin.site.urls so it wins).
    path('admin/login/', PinAdminLoginView.as_view(), name='admin-pin-login'),
    path('admin/', admin.site.urls),

    # Language switching (used by the admin language chooser).
    path('i18n/', include('django.conf.urls.i18n')),

    path('api/platform/dashboard/', PlatformDashboard.as_view()),
    path('api/platform/', include(platform_router.urls)),
    path('api/store/settings/', StoreSettingsView.as_view()),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/products/', include('apps.products.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/vendors/', include('apps.vendors.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/sales/', include('apps.sales.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/ai/', include('apps.ai_analysis.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
