from rest_framework.routers import DefaultRouter
from .views import InvoiceItemViewSet, InvoiceViewSet, PaymentViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("invoice-items", InvoiceItemViewSet, basename="invoice-item")
router.register("payments", PaymentViewSet, basename="payment")
router.register("receipts", ReceiptViewSet, basename="receipt")
urlpatterns = router.urls
