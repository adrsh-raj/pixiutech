from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit.services import record_audit
from notifications.models import Notification, NotificationType
from .models import Invoice, InvoiceLineItem, Payment, PaymentStatus, Receipt, BillingStatus

User = get_user_model()
TWOPLACES = Decimal("0.01")


def _notify(recipient_id, *, title, message, notification_type=NotificationType.PAYMENT, event_key=None, metadata=None):
    if not recipient_id:
        return None
    key = event_key or f"billing:{uuid4()}"
    obj, _ = Notification.objects.get_or_create(
        recipient_id=recipient_id,
        event_key=f"{key}:{recipient_id}",
        defaults={"notification_type": notification_type, "title": title[:200], "message": message, "metadata": metadata or {}},
    )
    return obj


def notify_school(school, *, title, message, event_key, metadata=None):
    if school and school.account_id and school.account.is_active:
        return _notify(school.account_id, title=title, message=message, event_key=event_key, metadata=metadata)
    return None


def notify_admins(*, title, message, event_key, metadata=None):
    recipients = User.objects.filter(role="admin", is_active=True).values_list("id", flat=True)
    return [_notify(user_id, title=title, message=message, event_key=event_key, metadata=metadata) for user_id in recipients]


def recalculate_invoice(invoice: Invoice) -> Invoice:
    subtotal = sum((line.quantity * line.unit_price for line in invoice.lines.all()), Decimal("0"))
    subtotal = subtotal.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    invoice.subtotal = subtotal
    invoice.total_amount = (subtotal + invoice.tax_amount).quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    invoice.amount_paid = sum((p.amount for p in invoice.payments.filter(status=PaymentStatus.SUCCESS)), Decimal("0")).quantize(TWOPLACES)
    if invoice.status != BillingStatus.VOID:
        if invoice.amount_paid >= invoice.total_amount and invoice.total_amount > 0:
            invoice.status = BillingStatus.PAID
        elif invoice.amount_paid > 0:
            invoice.status = BillingStatus.PARTIALLY_PAID
        elif invoice.status != BillingStatus.DRAFT and invoice.due_date < timezone.localdate():
            invoice.status = BillingStatus.OVERDUE
        elif invoice.status != BillingStatus.DRAFT:
            invoice.status = BillingStatus.ISSUED
    invoice.save(update_fields=["subtotal", "total_amount", "amount_paid", "status", "updated_at"])
    return invoice


@transaction.atomic
def add_invoice_line(*, invoice: Invoice, description: str, quantity, unit_price) -> InvoiceLineItem:
    locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if locked_invoice.status not in {BillingStatus.DRAFT, BillingStatus.ISSUED}:
        raise ValidationError("Only draft or issued invoices can be edited.")
    line = InvoiceLineItem.objects.create(invoice=locked_invoice, description=description.strip(), quantity=quantity, unit_price=unit_price, line_total=(Decimal(quantity) * Decimal(unit_price)).quantize(TWOPLACES))
    recalculate_invoice(locked_invoice)
    return line


@transaction.atomic
def update_invoice_line(*, line: InvoiceLineItem, description: str, quantity, unit_price) -> InvoiceLineItem:
    locked_line = InvoiceLineItem.objects.select_for_update().select_related("invoice").get(pk=line.pk)
    invoice = Invoice.objects.select_for_update().get(pk=locked_line.invoice_id)
    if invoice.status not in {BillingStatus.DRAFT, BillingStatus.ISSUED}:
        raise ValidationError("Only draft or issued invoices can be edited.")
    locked_line.description = description.strip()
    locked_line.quantity = quantity
    locked_line.unit_price = unit_price
    locked_line.line_total = (Decimal(quantity) * Decimal(unit_price)).quantize(TWOPLACES)
    locked_line.save(update_fields=["description", "quantity", "unit_price", "line_total"])
    recalculate_invoice(invoice)
    return locked_line


@transaction.atomic
def record_payment(*, invoice: Invoice, amount, method: str, payment_date, recorded_by, transaction_reference="", notes="", payment_status=PaymentStatus.SUCCESS):
    locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if locked_invoice.status == BillingStatus.VOID:
        raise ValidationError("A void invoice cannot receive a payment.")
    amount = Decimal(amount).quantize(TWOPLACES)
    if amount <= 0:
        raise ValidationError({"amount": "Payment amount must be positive."})
    recalculate_invoice(locked_invoice)
    outstanding = (locked_invoice.total_amount - locked_invoice.amount_paid).quantize(TWOPLACES)
    if amount > outstanding:
        raise ValidationError({"amount": "Payment exceeds the outstanding invoice balance."})
    if payment_status == PaymentStatus.PENDING and Payment.objects.filter(invoice=locked_invoice, status=PaymentStatus.PENDING).exists():
        raise ValidationError({"invoice": "A payment is already pending verification for this invoice."})

    payment = Payment.objects.create(invoice=locked_invoice, amount=amount, method=method, status=payment_status, payment_date=payment_date, transaction_reference=transaction_reference.strip(), notes=notes.strip(), recorded_by=recorded_by)
    receipt = None
    if payment_status == PaymentStatus.SUCCESS:
        recalculate_invoice(locked_invoice)
        receipt = Receipt.objects.create(receipt_number=f"RCT-{timezone.now():%Y}-{uuid4().hex[:10].upper()}", payment=payment, issued_at=timezone.now(), issued_by=recorded_by)
        record_audit(actor=recorded_by, action="payment", entity_type="Payment", entity_id=payment.id, summary=f"Payment recorded for {locked_invoice.invoice_number}", changes={"amount": str(amount), "method": method, "invoice": locked_invoice.invoice_number})
        record_audit(actor=recorded_by, action="create", entity_type="Receipt", entity_id=receipt.id, summary=f"Receipt issued for {locked_invoice.invoice_number}", changes={"receipt_number": receipt.receipt_number})
    else:
        record_audit(actor=recorded_by, action="payment_pending", entity_type="Payment", entity_id=payment.id, summary=f"Payment submitted for verification for {locked_invoice.invoice_number}", changes={"amount": str(amount), "method": method, "invoice": locked_invoice.invoice_number})
    return payment, receipt


@transaction.atomic
def verify_pending_payment(*, payment: Payment, verified_by):
    locked_payment = Payment.objects.select_for_update().select_related("invoice__school").get(pk=payment.pk)
    if locked_payment.status != PaymentStatus.PENDING:
        raise ValidationError("Only pending payments can be verified.")
    invoice = Invoice.objects.select_for_update().get(pk=locked_payment.invoice_id)
    if invoice.status == BillingStatus.VOID:
        raise ValidationError("A void invoice payment cannot be verified.")
    recalculate_invoice(invoice)
    outstanding = (invoice.total_amount - invoice.amount_paid).quantize(TWOPLACES)
    if locked_payment.amount > outstanding:
        raise ValidationError("This payment would exceed the invoice outstanding balance.")
    locked_payment.status = PaymentStatus.SUCCESS
    locked_payment.save(update_fields=["status"])
    recalculate_invoice(invoice)
    receipt = Receipt.objects.create(receipt_number=f"RCT-{timezone.now():%Y}-{uuid4().hex[:10].upper()}", payment=locked_payment, issued_at=timezone.now(), issued_by=verified_by)
    record_audit(actor=verified_by, action="payment_verified", entity_type="Payment", entity_id=locked_payment.id, summary=f"Verified payment for {invoice.invoice_number}", changes={"status": "success", "amount": str(locked_payment.amount), "invoice": invoice.invoice_number})
    record_audit(actor=verified_by, action="create", entity_type="Receipt", entity_id=receipt.id, summary=f"Receipt issued for {invoice.invoice_number}", changes={"receipt_number": receipt.receipt_number})
    return locked_payment, receipt
