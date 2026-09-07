from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from accounts.models import User, UserRole
from academics.models import School
from .models import Invoice, InvoiceStatus, Payment, Receipt
from .services import record_payment


class BillingTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("bill-admin", "strong-password", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("BILL-SCHOOL", "strong-password", role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code="BILL", name="Billing School", account=self.school_user)
        self.invoice = Invoice.objects.create(
            invoice_number="INV-001", school=self.school, issue_date=date(2026, 9, 7), due_date=date(2026, 9, 30),
            subtotal=Decimal("1000.00"), tax_amount=Decimal("180.00"), total_amount=Decimal("1180.00"), created_by=self.admin,
        )

    def test_partial_payment_updates_balance_state_and_creates_receipt(self):
        payment, receipt = record_payment(invoice=self.invoice, amount=Decimal("500.00"), method="upi", transaction_reference="TX-1", received_by=self.admin)
        self.invoice.refresh_from_db()
        self.assertEqual(payment.status, "success")
        self.assertEqual(receipt.payment_id, payment.id)
        self.assertEqual(self.invoice.status, InvoiceStatus.PARTIALLY_PAID)
        self.assertEqual(Receipt.objects.count(), 1)

    def test_overpayment_rejected(self):
        record_payment(invoice=self.invoice, amount=Decimal("1180.00"), method="upi", transaction_reference="TX-2", received_by=self.admin)
        with self.assertRaises(ValidationError):
            record_payment(invoice=self.invoice, amount=Decimal("0.01"), method="upi", transaction_reference="TX-3", received_by=self.admin)

    def test_successful_payment_cannot_duplicate_transaction_reference(self):
        record_payment(invoice=self.invoice, amount=Decimal("100.00"), method="bank", transaction_reference="DUP", received_by=self.admin)
        with self.assertRaises(Exception):
            record_payment(invoice=self.invoice, amount=Decimal("100.00"), method="bank", transaction_reference="DUP", received_by=self.admin)
