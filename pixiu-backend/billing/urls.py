from rest_framework.routers import DefaultRouter

from .views import InvoiceLineItemViewSet, InvoiceViewSet, PaymentViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="billing-invoice")
router.register("invoice-lines", InvoiceLineItemViewSet, basename="billing-invoice-line")
router.register("payments", PaymentViewSet, basename="billing-payment")
router.register("receipts", ReceiptViewSet, basename="billing-receipt")

urlpatterns = router.urls
