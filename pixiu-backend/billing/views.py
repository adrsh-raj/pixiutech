from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserRole

from .models import Invoice, InvoiceItem, Payment, Receipt
from .serializers import InvoiceItemSerializer, InvoiceSerializer, PaymentSerializer, ReceiptSerializer


class BillingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def role_only(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


class InvoiceViewSet(BillingViewSet):
    queryset = Invoice.objects.select_related("school", "student", "created_by").prefetch_related("items", "payments")
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        if user.role == UserRole.SCHOOL:
            return self.queryset.filter(school__account_id=user.id)
        if user.role == UserRole.STUDENT:
            return self.queryset.filter(student__account_id=user.id)
        return self.queryset.none()

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status = "void"; instance.save(update_fields=["status", "updated_at"])


class InvoiceItemViewSet(BillingViewSet):
    queryset = InvoiceItem.objects.select_related("invoice")
    serializer_class = InvoiceItemSerializer

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return qs
        if user.role == UserRole.SCHOOL:
            return qs.filter(invoice__school__account_id=user.id)
        if user.role == UserRole.STUDENT:
            return qs.filter(invoice__student__account_id=user.id)
        return qs.none()

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.delete()


class PaymentViewSet(BillingViewSet):
    queryset = Payment.objects.select_related("invoice", "received_by")
    serializer_class = PaymentSerializer

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return qs
        if user.role == UserRole.SCHOOL:
            return qs.filter(invoice__school__account_id=user.id)
        if user.role == UserRole.STUDENT:
            return qs.filter(invoice__student__account_id=user.id)
        return qs.none()

    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); raise PermissionDenied("Payments are immutable; use a refund workflow.")
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); raise PermissionDenied("Payments are immutable; use a refund workflow.")


class ReceiptViewSet(BillingViewSet):
    queryset = Receipt.objects.select_related("payment__invoice", "payment__received_by")
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return qs
        if user.role == UserRole.SCHOOL:
            return qs.filter(payment__invoice__school__account_id=user.id)
        if user.role == UserRole.STUDENT:
            return qs.filter(payment__invoice__student__account_id=user.id)
        return qs.none()
