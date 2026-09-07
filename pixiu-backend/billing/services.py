from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Invoice, InvoiceLineItem, Payment, PaymentStatus, Receipt, BillingStatus

TWOPLACES = Decimal("0.01")


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
    line = InvoiceLineItem.objects.create(
        invoice=locked_invoice,
        description=description.strip(),
        quantity=quantity,
        unit_price=unit_price,
        line_total=(Decimal(quantity) * Decimal(unit_price)).quantize(TWOPLACES),
    )
    recalculate_invoice(locked_invoice)
    return line


@transaction.atomic
def record_payment(*, invoice: Invoice, amount, method: str, payment_date, recorded_by, transaction_reference="", notes=""):
    locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if locked_invoice.status == BillingStatus.VOID:
        raise ValidationError("A void invoice cannot receive a payment.")
    amount = Decimal(amount).quantize(TWOPLACES)
    recalculate_invoice(locked_invoice)
    outstanding = (locked_invoice.total_amount - locked_invoice.amount_paid).quantize(TWOPLACES)
    if amount > outstanding:
        raise ValidationError({"amount": "Payment exceeds the outstanding invoice balance."})
    payment = Payment.objects.create(
        invoice=locked_invoice,
        amount=amount,
        method=method,
        status=PaymentStatus.SUCCESS,
        payment_date=payment_date,
        transaction_reference=transaction_reference.strip(),
        notes=notes.strip(),
        recorded_by=recorded_by,
    )
    recalculate_invoice(locked_invoice)
    receipt = Receipt.objects.create(
        receipt_number=f"RCT-{timezone.now():%Y}-{uuid4().hex[:10].upper()}",
        payment=payment,
        issued_at=timezone.now(),
        issued_by=recorded_by,
    )
    return payment, receipt
