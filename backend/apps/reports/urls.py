from django.urls import path

from .views import (
    FinanceExportView, FinancialSummaryExportView, ReceiptsExportView,
    ReportSummaryView, SalesExportView, StockExportView,
)

urlpatterns = [
    path('summary/', ReportSummaryView.as_view(), name='report-summary'),
    path('sales/', SalesExportView.as_view(), name='report-sales'),
    path('stock/', StockExportView.as_view(), name='report-stock'),
    path('receipts/', ReceiptsExportView.as_view(), name='report-receipts'),
    path('finance/', FinanceExportView.as_view(), name='report-finance'),
    path('financial-summary/', FinancialSummaryExportView.as_view(),
         name='report-financial-summary'),
]
