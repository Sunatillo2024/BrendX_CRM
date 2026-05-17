"""AI Analysis Views"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .services import AIAnalysisService, FinancialDataCollector


class AIAnalysisView(APIView):
    """Single endpoint for AI-powered financial analysis."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get('query', 'Give me a comprehensive business health report.')
        context_type = request.data.get('context', 'general')

        service = AIAnalysisService()
        result = service.analyze(query, context_type)
        return Response(result)


class FinancialDashboardView(APIView):
    """Returns structured financial data for dashboard charts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collector = FinancialDataCollector()
        return Response({
            'sales_30d': collector.get_sales_summary(30),
            'sales_7d': collector.get_sales_summary(7),
            'inventory': collector.get_inventory_health(),
            'customers': collector.get_customer_insights(),
            'top_products': collector.get_top_products(10),
        })
