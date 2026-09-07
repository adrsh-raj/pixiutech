from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.services import accessible_school_queryset

from .models import Invoice, InvoiceLineItem, Payment, Receipt, BillingStatus
from .serializers import InvoiceSerializer, InvoiceLineItemSerializer, InvoiceLineItemWriteSerializer, PaymentSerializer, ReceiptSerializer
from .services import add_invoice_line, record_payment, recalculate_invoice


class BillingScopedMixin:
    def initial(self, request, *args, **kwargs):
        mapping = {"list": "VIEW", "retrieve": "VIEW", "create": "CREATE", "update": "EDIT", "partial_update": "EDIT", "destroy": "DELETE"}
        self.required_action = mapping.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)

    def role_only(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


class InvoiceViewSet(BillingScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = Invoice.objects.select_related("school", "school_class", "trainer", "created_by").prefetch_related("lines", "payments__receipt")
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        if user.role == UserRole.SCHOOL:
            return self.queryset.filter(school__account_id=user.id)
        if user.role == UserRole.TRAINER:
            return self.queryset.filter(trainer__account_id=user.id)
        return self.queryset.none()

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN)
        school = serializer.validated_data["school"]
        serializer.save(invoice_number=f"INV-{__import__('uuid').uuid4().hex[:10].upper()}", created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        invoice = self.get_object()
        if invoice.status not in {BillingStatus.DRAFT, BillingStatus.ISSUED}:
            raise ValidationError("Only draft invoices can be issued.")
        invoice.status = BillingStatus.ISSUED
        recalculate_invoice(invoice)
        return Response(self.get_serializer(invoice).data)


class InvoiceLineItemViewSet(BillingScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = InvoiceLineItem.objects.select_related("invoice")
    serializer_class = InvoiceLineItemSerializer

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == UserRole.ADMIN:
            return qs
        if user.role == UserRole.SCHOOL:
            return qs.filter(invoice__school__account_id=user.id)
        return qs.none()

    def get_serializer_class(self):
        return InvoiceLineItemWriteSerializer if self.action in {"create", "update", "partial_update"} else InvoiceLineItemSerializer

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        invoice = serializer.validated_data["invoice"]
        if self.request.user.role == UserRole.SCHOOL and invoice.school.account_id != self.request.user.id:
            raise PermissionDenied("You cannot edit this invoice.")
        add_invoice_line(invoice=invoice, **{k: serializer.validated_data[k] for k in ["description", "quantity", "unit_price"]})

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        self.perform_destroy(serializer.instance)
        self.perform_create(serializer)

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        if instance.invoice.status not in {BillingStatus.DRAFT, BillingStatus.ISSUED}:
            raise ValidationError("Only draft or issued invoices can be edited.")
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=instance.invoice_id)
            instance.delete()
            recalculate_invoice(invoice)


class PaymentViewSet(BillingScopedMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = Payment.objects.select_related("invoice__school", "recorded_by", "receipt")
    serializer_class = PaymentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        if user.role == UserRole.SCHOOL:
            return self.queryset.filter(invoice__school__account_id=user.id)
        return self.queryset.none()

    @action(detail=False, methods=["post"], url_path="record")
    def record(self, request):
        self.required_action = "CREATE"
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.validated_data["invoice"]
        if request.user.role == UserRole.SCHOOL and invoice.school.account_id != request.user.id:
            raise PermissionDenied("You cannot record payment for this invoice.")
        payment, receipt = record_payment(recorded_by=request.user, **serializer.validated_data)
        return Response({"payment": PaymentSerializer(payment).data, "receipt": ReceiptSerializer(receipt).data}, status=status.HTTP_201_CREATED)


class ReceiptViewSet(BillingScopedMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = Receipt.objects.select_related("payment__invoice__school", "issued_by")
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        if user.role == UserRole.SCHOOL:
            return self.queryset.filter(payment__invoice__school__account_id=user.id)
        return self.queryset.none()
