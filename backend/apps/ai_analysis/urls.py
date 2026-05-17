from django.urls import path
from .views import AIAnalysisView, FinancialDashboardView

urlpatterns = [
    path('analyze/', AIAnalysisView.as_view(), name='ai-analyze'),
    path('dashboard/', FinancialDashboardView.as_view(), name='financial-dashboard'),
]
