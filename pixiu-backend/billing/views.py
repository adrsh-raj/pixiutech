from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from audit.services import record_audit
from .models import BillingStatus, Invoice, InvoiceLineItem, Payment, PaymentStatus, Receipt
from .serializers import InvoiceLineItemSerializer, InvoiceLineItemWriteSerializer, InvoiceSerializer, PaymentRecordSerializer, PaymentSerializer, ReceiptSerializer
from .services import add_invoice_line, notify_admins, notify_school, record_payment, recalculate_invoice, update_invoice_line, verify_pending_payment, issue_invoice


class BillingScopedMixin:
    def initial(self, request, *args, **kwargs):
        mapping = {"list": "VIEW", "retrieve": "VIEW", "create": "CREATE", "update": "EDIT", "partial_update": "EDIT", "destroy": "DELETE", "issue": "EDIT", "void": "EDIT", "record": "CREATE", "verify": "EDIT", "reject": "EDIT"}
        self.required_action = mapping.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)

    def role_only(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


def _school_filter(qs, request, field="school"):
    school = request.query_params.get("school")
    if not school or field not in {"school", "invoice__school"}:
        return qs
    value = str(school).strip()
    from django.db.models import Q
    if field == "school":
        return qs.filter(Q(school__school_code=value.upper()) | Q(school_id=value))
    return qs.filter(Q(invoice__school__school_code=value.upper()) | Q(invoice__school_id=value))


class InvoiceViewSet(BillingScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = Invoice.objects.select_related("school", "school_class", "trainer", "contract", "created_by").prefetch_related("lines", "payments__receipt")
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        u = self.request.user
        qs = self.queryset
        if u.role == UserRole.ADMIN:
            pass
        elif u.role == UserRole.SCHOOL:
            qs = qs.filter(school__account_id=u.id)
        elif u.role == UserRole.TRAINER:
            qs = qs.filter(trainer__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "school")

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN)
        obj = serializer.save(invoice_number=f"INV-{__import__('uuid').uuid4().hex[:10].upper()}", created_by=self.request.user)
        record_audit(actor=self.request.user, action="create", entity_type="Invoice", entity_id=obj.id, summary=f"Created invoice {obj.invoice_number}", request=self.request)

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN)
        invoice = serializer.instance
        if invoice.status not in {BillingStatus.DRAFT, BillingStatus.ISSUED}:
            raise ValidationError("Only draft or issued invoices can be edited.")
        obj = serializer.save()
        record_audit(actor=self.request.user, action="update", entity_type="Invoice", entity_id=obj.id, summary=f"Updated invoice {obj.invoice_number}", request=self.request)

    def perform_destroy(self, instance):
        raise ValidationError("Invoices are not deleted. Use the Void action so the financial record remains retained.")

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        self.role_only(UserRole.ADMIN)
        invoice = self.get_object()
        invoice = issue_invoice(invoice=invoice, issued_by=request.user)
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        self.role_only(UserRole.ADMIN)
        invoice = self.get_object()
        if invoice.status == BillingStatus.PAID:
            raise ValidationError("Paid invoices cannot be voided. Use a controlled finance adjustment.")
        if invoice.status == BillingStatus.VOID:
            raise ValidationError("Invoice is already void.")
        invoice.status = BillingStatus.VOID
        invoice.save(update_fields=["status", "updated_at"])
        notify_school(invoice.school, title=f"Invoice {invoice.invoice_number} voided", message="This Pixiu Tech invoice has been voided and no payment is required against it.", event_key=f"invoice-voided:{invoice.id}", metadata={"invoice_id": str(invoice.id), "status": invoice.status})
        record_audit(actor=request.user, action="void", entity_type="Invoice", entity_id=invoice.id, summary=f"Voided invoice {invoice.invoice_number}", changes={"status": "void"}, request=request)
        return Response(self.get_serializer(invoice).data)


class InvoiceLineItemViewSet(BillingScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = InvoiceLineItem.objects.select_related("invoice")
    serializer_class = InvoiceLineItemSerializer

    def get_queryset(self):
        u = self.request.user
        qs = self.queryset
        if u.role == UserRole.ADMIN:
            pass
        elif u.role == UserRole.SCHOOL:
            qs = qs.filter(invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")

    def get_serializer_class(self):
        return InvoiceLineItemWriteSerializer if self.action in {"create", "update", "partial_update"} else InvoiceLineItemSerializer

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN)
        invoice = serializer.validated_data["invoice"]
        add_invoice_line(invoice=invoice, description=serializer.validated_data["description"], quantity=serializer.validated_data["quantity"], unit_price=serializer.validated_data["unit_price"])

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN)
        update_invoice_line(line=serializer.instance, description=serializer.validated_data["description"], quantity=serializer.validated_data["quantity"], unit_price=serializer.validated_data["unit_price"])

    def perform_destroy(self, instance):
        self.role_only(UserRole.ADMIN)
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
        u = self.request.user
        qs = self.queryset
        if u.role == UserRole.ADMIN:
            pass
        elif u.role == UserRole.SCHOOL:
            qs = qs.filter(invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")

    @action(detail=False, methods=["post"], url_path="record")
    def record(self, request):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL)
        serializer = PaymentRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = serializer.validated_data["invoice"]
        if request.user.role == UserRole.SCHOOL and invoice.school.account_id != request.user.id:
            raise PermissionDenied("You cannot record payment for this invoice.")
        if invoice.status not in {BillingStatus.ISSUED, BillingStatus.PARTIALLY_PAID, BillingStatus.OVERDUE}:
            raise ValidationError("Only issued invoices can receive payments.")
        payment_status = PaymentStatus.PENDING if request.user.role == UserRole.SCHOOL else PaymentStatus.SUCCESS
        payment, receipt = record_payment(recorded_by=request.user, payment_status=payment_status, **serializer.validated_data)
        if payment_status == PaymentStatus.PENDING:
            notify_admins(title=f"Payment verification required — {invoice.school.name}", message=f"{invoice.school.name} submitted ₹{payment.amount:.2f} for invoice {invoice.invoice_number}. Kindly verify the payment.", event_key=f"payment-pending:{payment.id}", metadata={"payment_id": str(payment.id), "invoice_id": str(invoice.id), "school_id": str(invoice.school_id), "amount": str(payment.amount)})
        else:
            notify_school(invoice.school, title=f"Payment recorded — {invoice.invoice_number}", message=f"₹{payment.amount:.2f} has been recorded against your invoice and the invoice status is now {invoice.status}.", event_key=f"payment-recorded:{payment.id}", metadata={"payment_id": str(payment.id), "invoice_id": str(invoice.id), "status": invoice.status})
        return Response({"payment": PaymentSerializer(payment).data, "receipt": ReceiptSerializer(receipt).data if receipt else None}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        self.role_only(UserRole.ADMIN)
        payment = self.get_object()
        payment, receipt = verify_pending_payment(payment=payment, verified_by=request.user)
        invoice = payment.invoice
        notify_school(invoice.school, title=f"Payment verified — {invoice.invoice_number}", message=f"Pixiu Tech verified your payment of ₹{payment.amount:.2f}. Your invoice is now {invoice.status}.", event_key=f"payment-verified:{payment.id}", metadata={"payment_id": str(payment.id), "invoice_id": str(invoice.id), "status": invoice.status, "receipt_number": receipt.receipt_number})
        return Response({"payment": PaymentSerializer(payment).data, "receipt": ReceiptSerializer(receipt).data})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        self.role_only(UserRole.ADMIN)
        payment = self.get_object()
        if payment.status != PaymentStatus.PENDING:
            raise ValidationError("Only pending payments can be rejected.")
        payment.status = PaymentStatus.FAILED
        payment.save(update_fields=["status"])
        payment.invoice.refresh_from_db()
        notify_school(payment.invoice.school, title=f"Payment needs review — {payment.invoice.invoice_number}", message=f"The submitted payment of ₹{payment.amount:.2f} was not verified. Please review the invoice and submit payment again with the correct reference.", event_key=f"payment-rejected:{payment.id}", metadata={"payment_id": str(payment.id), "invoice_id": str(payment.invoice_id), "status": "failed"})
        record_audit(actor=request.user, action="payment_rejected", entity_type="Payment", entity_id=payment.id, summary=f"Rejected payment for {payment.invoice.invoice_number}", changes={"status": "failed"}, request=request)
        return Response(PaymentSerializer(payment).data)


class ReceiptViewSet(BillingScopedMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    queryset = Receipt.objects.select_related("payment__invoice__school", "issued_by")
    serializer_class = ReceiptSerializer

    def get_queryset(self):
        u = self.request.user
        qs = self.queryset
        if u.role == UserRole.ADMIN:
            pass
        elif u.role == UserRole.SCHOOL:
            qs = qs.filter(payment__invoice__school__account_id=u.id)
        else:
            return qs.none()
        return _school_filter(qs, self.request, "invoice__school")
