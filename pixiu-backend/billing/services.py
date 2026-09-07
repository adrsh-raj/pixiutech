from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Invoice, InvoiceStatus, Payment, PaymentStatus, Receipt


def successful_total(invoice_id):
    return sum((p.amount for p in Payment.objects.filter(invoice_id=invoice_id, status=PaymentStatus.SUCCESS)), 0)


@transaction.atomic
def record_payment(*, invoice, amount, method, transaction_reference, received_by):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if invoice.status == InvoiceStatus.VOID:
        raise ValidationError("Void invoices cannot receive payments.")
    balance = invoice.total_amount - successful_total(invoice.pk)
    if amount > balance:
        raise ValidationError({"amount": "Payment cannot exceed the invoice balance."})
    payment = Payment.objects.create(
        invoice=invoice, amount=amount, method=method, status=PaymentStatus.SUCCESS,
        transaction_reference=transaction_reference or "", paid_at=timezone.now(), received_by=received_by,
    )
    invoice.status = InvoiceStatus.PAID if amount == balance else InvoiceStatus.PARTIALLY_PAID
    invoice.save(update_fields=["status", "updated_at"])
    receipt = Receipt.objects.create(payment=payment, receipt_number=f"RCT-{payment.id.hex[:12].upper()}")
    return payment, receipt
