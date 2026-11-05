from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from audit.services import record_audit
from notifications.models import Notification, NotificationType
from .models import (
    BillingProfile, BillingStatus, ContractStatus, Invoice, InvoiceLineItem,
    Payment, PaymentStatus, Receipt, SchoolContract,
)

User = get_user_model()
TWOPLACES = Decimal("0.01")

BILLING_PROFILE_FIELDS = ("account_name", "bank_name", "account_number", "ifsc", "upi")


def default_billing_profile_data():
    return {
        "account_name": getattr(settings, "PIXIU_BILLING_ACCOUNT_NAME", "").strip(),
        "bank_name": getattr(settings, "PIXIU_BILLING_BANK_NAME", "").strip(),
        "account_number": getattr(settings, "PIXIU_BILLING_ACCOUNT_NUMBER", "").strip(),
        "ifsc": getattr(settings, "PIXIU_BILLING_IFSC", "").strip(),
        "upi": getattr(settings, "PIXIU_BILLING_UPI", "").strip(),
    }


def ensure_school_billing_profile(*, school):
    defaults = default_billing_profile_data()
    profile, created = BillingProfile.objects.get_or_create(school=school, defaults=defaults)
    if not created:
        changed = []
        for field in BILLING_PROFILE_FIELDS:
            value = getattr(profile, field, "")
            default = defaults.get(field, "")
            if not value and default:
                setattr(profile, field, default)
                changed.append(field)
        if changed:
            changed.append("updated_at")
            profile.save(update_fields=changed)
    return profile



def _notify(recipient_id, *, title, message, notification_type=NotificationType.PAYMENT, event_key=None, metadata=None):
    if not recipient_id:
        return None
    key = event_key or f"billing:{uuid4()}"
    obj, _ = Notification.objects.get_or_create(recipient_id=recipient_id, event_key=f"{key}:{recipient_id}", defaults={"notification_type": notification_type, "title": title[:200], "message": message, "metadata": metadata or {}})
    return obj


def notify_school(school, *, title, message, event_key, metadata=None):
    if school and school.account_id and school.account.is_active:
        return _notify(school.account_id, title=title, message=message, event_key=event_key, metadata=metadata)
    return None


def notify_admins(*, title, message, event_key, metadata=None):
    recipients = User.objects.filter(role__in=["admin", "superadmin"], is_active=True).values_list("id", flat=True)
    return [_notify(user_id, title=title, message=message, event_key=event_key, metadata=metadata) for user_id in recipients]


@transaction.atomic
def issue_invoice(*, invoice: Invoice, issued_by) -> Invoice:
    locked_invoice = Invoice.objects.select_for_update().select_related("school").get(pk=invoice.pk)
    if locked_invoice.status != BillingStatus.DRAFT:
        raise ValidationError("Only draft invoices can be issued.")
    recalculate_invoice(locked_invoice)
    if locked_invoice.total_amount <= 0:
        raise ValidationError("An invoice must have a positive total before it can be issued.")
    if locked_invoice.contract_id:
        contract = SchoolContract.objects.select_for_update().get(pk=locked_invoice.contract_id)
        if contract.status not in {ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
            raise ValidationError("Only active or expired signed contracts can be invoiced.")
        if Payment.objects.filter(contract=contract, status=PaymentStatus.PENDING).exists():
            raise ValidationError("Resolve the pending direct contract payment before issuing a linked invoice.")
        open_invoices = contract.invoices.filter(
            status__in=[BillingStatus.ISSUED, BillingStatus.PARTIALLY_PAID, BillingStatus.OVERDUE]
        ).exclude(pk=locked_invoice.pk)
        already_billed_due = sum(
            (
                max(Decimal(item.total_amount) - Decimal(item.amount_paid), Decimal("0.00"))
                for item in open_invoices
            ),
            Decimal("0.00"),
        )
        available_to_invoice = max(
            Decimal(contract.total_value) - contract_amount_paid(contract) - already_billed_due,
            Decimal("0.00"),
        )
        if locked_invoice.total_amount > available_to_invoice:
            raise ValidationError({
                "contract": f"This invoice exceeds the remaining unbilled contract value of ₹{available_to_invoice:.2f}."
            })
    locked_invoice.status = BillingStatus.ISSUED
    locked_invoice.save(update_fields=["status", "updated_at"])
    notify_school(
        locked_invoice.school,
        title=f"New Pixiu Tech invoice {locked_invoice.invoice_number}",
        message=f"Invoice {locked_invoice.invoice_number} for ₹{locked_invoice.total_amount:.2f} is ready. Open Billing to review the bill and payment details.",
        event_key=f"invoice-issued:{locked_invoice.id}",
        metadata={"invoice_id": str(locked_invoice.id), "status": locked_invoice.status, "amount": str(locked_invoice.total_amount)},
    )
    record_audit(
        actor=issued_by,
        action="update",
        entity_type="Invoice",
        entity_id=locked_invoice.id,
        summary=f"Issued invoice {locked_invoice.invoice_number}",
        changes={"status": "issued", "amount": str(locked_invoice.total_amount)},
    )
    return locked_invoice


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
    locked_line.description = description.strip(); locked_line.quantity = quantity; locked_line.unit_price = unit_price
    locked_line.line_total = (Decimal(quantity) * Decimal(unit_price)).quantize(TWOPLACES)
    locked_line.save(update_fields=["description", "quantity", "unit_price", "line_total"])
    recalculate_invoice(invoice)
    return locked_line


def contract_amount_paid(contract: SchoolContract) -> Decimal:
    """Successful payments allocated directly to a contract or to its linked invoices."""
    total = Payment.objects.filter(
        Q(contract=contract) | Q(invoice__contract=contract),
        status=PaymentStatus.SUCCESS,
    ).aggregate(total=Sum("amount"))["total"]
    return (total or Decimal("0.00")).quantize(TWOPLACES)


def _issue_payment_receipt(*, payment: Payment, issued_by, school, invoice=None, contract=None) -> Receipt:
    """Create an immutable receipt snapshot after the payment is confirmed."""
    if invoice and invoice.contract_id:
        contract = contract or invoice.contract
    if contract:
        total = Decimal(contract.total_value).quantize(TWOPLACES)
        paid = contract_amount_paid(contract)
        contract_number = contract.contract_number
    else:
        total = Decimal(invoice.total_amount).quantize(TWOPLACES)
        paid = Decimal(invoice.amount_paid).quantize(TWOPLACES)
        contract_number = ""
    balance = max(total - paid, Decimal("0.00")).quantize(TWOPLACES)
    obligation_label = contract_number or (invoice.invoice_number if invoice else "contract")
    return Receipt.objects.create(
        receipt_number=f"RCT-{timezone.localdate():%Y}-{uuid4().hex[:10].upper()}",
        payment=payment,
        issued_at=timezone.now(),
        issued_by=issued_by,
        school_name_snapshot=school.name,
        invoice_number_snapshot=invoice.invoice_number if invoice else "",
        contract_number_snapshot=contract_number,
        total_amount_snapshot=total,
        amount_paid_snapshot=paid,
        balance_due_snapshot=balance,
    )


@transaction.atomic
def record_payment(
    *,
    invoice: Invoice = None,
    contract: SchoolContract = None,
    amount,
    method: str,
    payment_date,
    recorded_by,
    transaction_reference="",
    notes="",
    payment_status=PaymentStatus.SUCCESS,
):
    if (invoice is None) == (contract is None):
        raise ValidationError("Provide exactly one of invoice or contract.")

    locked_invoice = None
    locked_contract = None
    school = None

    if invoice is not None:
        # Avoid SELECT FOR UPDATE across nullable select_related joins (PostgreSQL
        # rejects locking the nullable side of an outer join). Lock the invoice row
        # only; lock its contract explicitly below when one is linked.
        locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
        if locked_invoice.status == BillingStatus.VOID:
            raise ValidationError("A void invoice cannot receive a payment.")
        recalculate_invoice(locked_invoice)
        school = locked_invoice.school
        invoice_outstanding = (
            locked_invoice.total_amount - locked_invoice.amount_paid
        ).quantize(TWOPLACES)
        outstanding = invoice_outstanding
        if locked_invoice.contract_id:
            locked_contract = SchoolContract.objects.select_for_update().select_related(
                "school"
            ).get(pk=locked_invoice.contract_id)
            if locked_contract.status not in {ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
                raise ValidationError("The linked contract is not eligible to receive payment.")
            contract_outstanding = (
                locked_contract.total_value - contract_amount_paid(locked_contract)
            ).quantize(TWOPLACES)
            outstanding = min(invoice_outstanding, contract_outstanding)
    else:
        locked_contract = SchoolContract.objects.select_for_update().select_related(
            "school"
        ).get(pk=contract.pk)
        if locked_contract.status not in {ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
            raise ValidationError("Only active or expired signed contracts can receive payments.")
        if locked_contract.invoices.filter(
            status__in=[BillingStatus.ISSUED, BillingStatus.PARTIALLY_PAID, BillingStatus.OVERDUE]
        ).exists():
            raise ValidationError({
                "contract": "This contract has an open invoice. Record the payment against that invoice so both balances stay aligned."
            })
        school = locked_contract.school
        outstanding = (
            locked_contract.total_value - contract_amount_paid(locked_contract)
        ).quantize(TWOPLACES)

    amount = Decimal(amount).quantize(TWOPLACES)
    normalized_reference = (transaction_reference or "").strip()
    if normalized_reference and Payment.objects.filter(
        method=method,
        transaction_reference__iexact=normalized_reference,
    ).exists():
        raise ValidationError({
            "transaction_reference": "This transaction reference has already been recorded."
        })

    if amount <= 0:
        raise ValidationError({"amount": "Payment amount must be positive."})
    if outstanding <= 0:
        raise ValidationError({"amount": "There is no outstanding balance for this record."})
    if amount > outstanding:
        raise ValidationError({
            "amount": f"Payment exceeds the outstanding balance of ₹{outstanding:.2f}."
        })

    pending_query = Payment.objects.filter(status=PaymentStatus.PENDING)
    if locked_contract:
        pending_query = pending_query.filter(
            Q(contract=locked_contract) | Q(invoice__contract=locked_contract)
        )
    else:
        pending_query = pending_query.filter(invoice=locked_invoice)
    if pending_query.exists():
        raise ValidationError({
            "payment": "A payment is already awaiting verification for this contract or invoice. Verify or reject it before recording another payment."
        })

    try:
        # Nested savepoint allows us to translate a concurrent duplicate-reference
        # uniqueness violation without leaving the outer financial transaction broken.
        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=locked_invoice,
                contract=locked_contract if locked_invoice is None else None,
                amount=amount,
                method=method,
                status=payment_status,
                payment_date=payment_date,
                transaction_reference=normalized_reference,
                notes=notes.strip(),
                recorded_by=recorded_by,
            )
    except IntegrityError:
        if normalized_reference and Payment.objects.filter(
            method=method,
            transaction_reference__iexact=normalized_reference,
        ).exists():
            raise ValidationError({
                "transaction_reference": "This transaction reference has already been recorded."
            })
        raise
    receipt = None
    target_label = (
        locked_contract.contract_number if locked_contract
        else locked_invoice.invoice_number
    )

    if payment_status == PaymentStatus.SUCCESS:
        if locked_invoice:
            recalculate_invoice(locked_invoice)
        receipt = _issue_payment_receipt(
            payment=payment,
            issued_by=recorded_by,
            school=school,
            invoice=locked_invoice,
            contract=locked_contract,
        )
        record_audit(
            actor=recorded_by,
            action="payment",
            entity_type="Payment",
            entity_id=payment.id,
            summary=f"Payment recorded for {target_label}",
            changes={
                "amount": str(amount),
                "method": method,
                "invoice": locked_invoice.invoice_number if locked_invoice else None,
                "contract": locked_contract.contract_number if locked_contract else None,
            },
        )
        record_audit(
            actor=recorded_by,
            action="create",
            entity_type="Receipt",
            entity_id=receipt.id,
            summary=f"Receipt issued for {target_label}",
            changes={"receipt_number": receipt.receipt_number},
        )
    else:
        record_audit(
            actor=recorded_by,
            action="payment_pending",
            entity_type="Payment",
            entity_id=payment.id,
            summary=f"Payment submitted for verification for {target_label}",
            changes={
                "amount": str(amount),
                "method": method,
                "invoice": locked_invoice.invoice_number if locked_invoice else None,
                "contract": locked_contract.contract_number if locked_invoice is None else (
                    locked_contract.contract_number if locked_contract else None
                ),
            },
        )
    return payment, receipt


@transaction.atomic
def verify_pending_payment(*, payment: Payment, verified_by):
    # The invoice and contract FKs are nullable, so do not combine them with
    # SELECT FOR UPDATE joins. Lock the payment row, then lock the actual target
    # rows explicitly in the branches below.
    locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if locked_payment.status != PaymentStatus.PENDING:
        raise ValidationError("Only pending payments can be verified.")

    invoice = None
    contract = None
    school = None
    outstanding = Decimal("0.00")

    if locked_payment.invoice_id:
        invoice = Invoice.objects.select_for_update().get(pk=locked_payment.invoice_id)
        if invoice.status == BillingStatus.VOID:
            raise ValidationError("A void invoice payment cannot be verified.")
        recalculate_invoice(invoice)
        outstanding = (invoice.total_amount - invoice.amount_paid).quantize(TWOPLACES)
        school = invoice.school
        if invoice.contract_id:
            contract = SchoolContract.objects.select_for_update().get(pk=invoice.contract_id)
            if contract.status not in {ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
                raise ValidationError("The linked contract is not eligible to receive payment.")
            contract_outstanding = (
                contract.total_value - contract_amount_paid(contract)
            ).quantize(TWOPLACES)
            outstanding = min(outstanding, contract_outstanding)
    else:
        contract = SchoolContract.objects.select_for_update().select_related(
            "school"
        ).get(pk=locked_payment.contract_id)
        if contract.status not in {ContractStatus.ACTIVE, ContractStatus.EXPIRED}:
            raise ValidationError("Only active or expired signed contracts can receive payments.")
        if contract.invoices.filter(
            status__in=[BillingStatus.ISSUED, BillingStatus.PARTIALLY_PAID, BillingStatus.OVERDUE]
        ).exists():
            raise ValidationError({
                "contract": "This contract has an open invoice. Verify the payment against the invoice instead."
            })
        school = contract.school
        outstanding = (
            contract.total_value - contract_amount_paid(contract)
        ).quantize(TWOPLACES)

    if locked_payment.amount > outstanding or outstanding <= 0:
        raise ValidationError("This payment would exceed the outstanding balance.")

    locked_payment.status = PaymentStatus.SUCCESS
    locked_payment.save(update_fields=["status"])
    if invoice:
        recalculate_invoice(invoice)

    receipt = _issue_payment_receipt(
        payment=locked_payment,
        issued_by=verified_by,
        school=school,
        invoice=invoice,
        contract=contract,
    )
    target_label = contract.contract_number if contract else invoice.invoice_number
    record_audit(
        actor=verified_by,
        action="payment_verified",
        entity_type="Payment",
        entity_id=locked_payment.id,
        summary=f"Verified payment for {target_label}",
        changes={
            "status": "success",
            "amount": str(locked_payment.amount),
            "invoice": invoice.invoice_number if invoice else None,
            "contract": contract.contract_number if contract else None,
        },
    )
    record_audit(
        actor=verified_by,
        action="create",
        entity_type="Receipt",
        entity_id=receipt.id,
        summary=f"Receipt issued for {target_label}",
        changes={"receipt_number": receipt.receipt_number},
    )
    return locked_payment, receipt

@transaction.atomic
def reverse_payment(*, payment: Payment, reversed_by, reversal_status: str, reason: str) -> Payment:
    """Void a mistaken entry or record a real refund without deleting its receipt.

    The receipt's immutable issuance snapshot is deliberately preserved. Ledger
    aggregates count only SUCCESS payments, so changing the status removes the
    amount from current contract/invoice balances while retaining the evidence.
    """
    if reversal_status not in {PaymentStatus.VOID, PaymentStatus.REFUNDED}:
        raise ValidationError("Reversal type must be void or refunded.")

    normalized_reason = (reason or "").strip()
    if len(normalized_reason) < 8:
        raise ValidationError({"reason": "Enter a clear reversal reason (at least 8 characters)."})

    locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if locked_payment.status != PaymentStatus.SUCCESS:
        raise ValidationError("Only a successful, verified payment can be voided or refunded.")

    invoice = None
    contract = None
    school = None
    if locked_payment.invoice_id:
        invoice = Invoice.objects.select_for_update().get(pk=locked_payment.invoice_id)
        school = invoice.school
        if invoice.contract_id:
            contract = SchoolContract.objects.select_for_update().get(pk=invoice.contract_id)
    else:
        contract = SchoolContract.objects.select_for_update().select_related(
            "school"
        ).get(pk=locked_payment.contract_id)
        school = contract.school

    receipt_number = Receipt.objects.filter(payment=locked_payment).values_list(
        "receipt_number", flat=True
    ).first()
    previous_status = locked_payment.status
    locked_payment.status = reversal_status
    locked_payment.reversal_reason = normalized_reason
    locked_payment.reversed_at = timezone.now()
    locked_payment.reversed_by = reversed_by
    locked_payment.save(update_fields=[
        "status", "reversal_reason", "reversed_at", "reversed_by"
    ])

    if invoice:
        recalculate_invoice(invoice)

    target_label = (
        contract.contract_number if contract
        else invoice.invoice_number if invoice
        else "payment"
    )
    action = (
        "payment_voided"
        if reversal_status == PaymentStatus.VOID
        else "payment_refunded"
    )
    record_audit(
        actor=reversed_by,
        action=action,
        entity_type="Payment",
        entity_id=locked_payment.id,
        summary=f"{'Voided' if reversal_status == PaymentStatus.VOID else 'Refunded'} payment for {target_label}",
        changes={
            "previous_status": previous_status,
            "status": reversal_status,
            "amount": str(locked_payment.amount),
            "reason": normalized_reason,
            "receipt_number": receipt_number,
            "invoice": invoice.invoice_number if invoice else None,
            "contract": contract.contract_number if contract else None,
        },
    )
    notify_school(
        school,
        title=f"Payment {'voided' if reversal_status == PaymentStatus.VOID else 'refunded'} — {target_label}",
        message=(
            f"The payment entry of ₹{locked_payment.amount:.2f} has been "
            f"{'voided' if reversal_status == PaymentStatus.VOID else 'marked refunded'} by Pixiu Tech. "
            "Your current contract / invoice balance has been recalculated. "
            "The original receipt remains retained and is marked as invalid."
        ),
        event_key=f"payment-reversed:{locked_payment.id}",
        metadata={
            "payment_id": str(locked_payment.id),
            "receipt_number": receipt_number,
            "status": reversal_status,
            "amount": str(locked_payment.amount),
        },
    )
    return locked_payment
