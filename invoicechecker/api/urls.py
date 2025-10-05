from django.urls import path
from .views import InvoiceComparisonView, ListModelsView

urlpatterns = [
    path('compare/', InvoiceComparisonView.as_view(), name='compare-invoices'),
    path('models/', ListModelsView.as_view(), name='list-models'),
]
