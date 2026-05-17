"""AI Analysis Service - Uses Groq (free) for financial intelligence"""
from datetime import date, timedelta
from django.conf import settings
from django.db.models import Sum, Count, Avg

from apps.sales.models import Sale, SaleItem
from apps.products.models import Product, ProductVariant
from apps.customers.models import Customer, InstallmentPlan
from apps.inventory.models import StockItem


class FinancialDataCollector:
    """Collects and formats business data for AI analysis."""

    @staticmethod
    def get_sales_summary(days: int = 30) -> dict:
        start = date.today() - timedelta(days=days)
        qs = Sale.objects.filter(created_at__date__gte=start, status='completed')
        return {
            'total_sales': qs.count(),
            'total_revenue': float(qs.aggregate(t=Sum('total_amount'))['t'] or 0),
            'total_paid': float(qs.aggregate(t=Sum('paid_amount'))['t'] or 0),
            'total_remaining': float(qs.aggregate(t=Sum('remaining_amount'))['t'] or 0),
            'cash_sales': qs.filter(sale_type='cash').count(),
            'credit_sales': qs.filter(sale_type='credit').count(),
            'installment_sales': qs.filter(sale_type='installment').count(),
            'avg_sale_value': float(qs.aggregate(a=Avg('total_amount'))['a'] or 0),
        }

    @staticmethod
    def get_top_products(limit: int = 10) -> list:
        start = date.today() - timedelta(days=30)
        top = SaleItem.objects.filter(
            sale__created_at__date__gte=start, sale__status='completed'
        ).values(
            'product_variant__product__name'
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('total_price')
        ).order_by('-total_revenue')[:limit]
        return list(top)

    @staticmethod
    def get_inventory_health() -> dict:
        total_items = ProductVariant.objects.filter(is_active=True).count()
        out_of_stock = ProductVariant.objects.filter(stock_quantity=0, is_active=True).count()
        low_stock = ProductVariant.objects.filter(
            stock_quantity__gt=0, stock_quantity__lte=5, is_active=True
        ).count()
        total_value = sum(
            float(item.cost_price) * item.quantity_in_stock
            for item in StockItem.objects.filter(is_active=True)
        )
        return {
            'total_variants': total_items,
            'out_of_stock': out_of_stock,
            'low_stock': low_stock,
            'in_stock': total_items - out_of_stock - low_stock,
            'total_inventory_value': total_value,
        }

    @staticmethod
    def get_customer_insights() -> dict:
        return {
            'total_customers': Customer.objects.filter(is_active=True).count(),
            'credit_customers': Customer.objects.filter(customer_type='credit').count(),
            'installment_customers': Customer.objects.filter(customer_type='installment').count(),
            'total_outstanding': float(
                Customer.objects.aggregate(t=Sum('outstanding_balance'))['t'] or 0
            ),
            'overdue_installments': InstallmentPlan.objects.filter(status='active').count(),
        }


class AIAnalysisService:
    """
    AI-powered financial analysis using Groq's free API (llama3-8b model).
    Falls back to rule-based analysis if API key is not configured.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'GROQ_API_KEY', '')
        self.model = getattr(settings, 'AI_MODEL', 'llama3-8b-8192')
        self.collector = FinancialDataCollector()

    def analyze(self, query: str, context_type: str = 'general') -> dict:
        """Run AI analysis with business context."""
        context = self._build_context(context_type)
        prompt = self._build_prompt(query, context)

        if self.api_key:
            return self._call_groq(prompt)
        return self._rule_based_analysis(context)

    def _build_context(self, context_type: str) -> dict:
        ctx = {
            'sales': self.collector.get_sales_summary(30),
            'inventory': self.collector.get_inventory_health(),
            'customers': self.collector.get_customer_insights(),
            'top_products': self.collector.get_top_products(5),
        }
        return ctx

    def _build_prompt(self, query: str, context: dict) -> str:
        return f"""You are a financial analyst for a clothing retail shop called BrandX.
Analyze the following business data and answer the question.

BUSINESS DATA (Last 30 Days):
Sales Summary: {context['sales']}
Inventory Health: {context['inventory']}
Customer Insights: {context['customers']}
Top Products: {context['top_products']}

QUESTION: {query}

Provide a concise, actionable analysis with specific recommendations.
Format: Start with a brief summary, then bullet points for key findings, then recommendations."""

    def _call_groq(self, prompt: str) -> dict:
        try:
            from groq import Groq
            client = Groq(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {'role': 'system', 'content': 'You are a professional retail business financial analyst.'},
                    {'role': 'user', 'content': prompt}
                ],
                max_tokens=1024,
                temperature=0.3,
            )
            return {
                'analysis': response.choices[0].message.content,
                'model': self.model,
                'source': 'groq_ai'
            }
        except Exception as e:
            return self._rule_based_analysis({})

    def _rule_based_analysis(self, context: dict) -> dict:
        """Fallback analysis without AI API."""
        sales = context.get('sales', {})
        inventory = context.get('inventory', {})
        customers = context.get('customers', {})

        insights = []
        recommendations = []

        if sales:
            rev = sales.get('total_revenue', 0)
            remaining = sales.get('total_remaining', 0)
            if remaining / (rev + 1) > 0.3:
                insights.append(f'High outstanding amount: ${remaining:.2f} ({remaining/rev*100:.1f}% of revenue)')
                recommendations.append('Focus on collecting outstanding credit/installment payments.')

        if inventory:
            if inventory.get('out_of_stock', 0) > 0:
                insights.append(f'{inventory["out_of_stock"]} product variants are out of stock.')
                recommendations.append('Restock out-of-stock items immediately to avoid lost sales.')
            if inventory.get('low_stock', 0) > 0:
                insights.append(f'{inventory["low_stock"]} variants are running low.')
                recommendations.append('Place orders for low-stock items before they run out.')

        analysis = '**Business Analysis Report**\n\n'
        if insights:
            analysis += '**Key Findings:**\n' + '\n'.join(f'• {i}' for i in insights)
        if recommendations:
            analysis += '\n\n**Recommendations:**\n' + '\n'.join(f'• {r}' for r in recommendations)
        if not insights:
            analysis += 'Business is operating within normal parameters. Continue monitoring KPIs.'

        return {'analysis': analysis, 'model': 'rule_based', 'source': 'local'}
