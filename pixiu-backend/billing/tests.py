from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounts.models import User, UserRole
from academics.models import School
from .models import Invoice, BillingStatus, InvoiceLineItem, Payment
from .services import add_invoice_line, record_payment


class BillingTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("billing-admin", "strong-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("BILL-SCHOOL", "strong-pass", role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code="BILL", name="Billing School", account=self.school_user)
        self.invoice = Invoice.objects.create(invoice_number="INV-TEST", school=self.school, issue_date=date.today(), due_date=date.today(), tax_amount=Decimal("10.00"), created_by=self.admin)

    def test_invoice_total_is_server_calculated(self):
        add_invoice_line(invoice=self.invoice, description="Robotics program", quantity=2, unit_price=100)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.subtotal, Decimal("200.00"))
        self.assertEqual(self.invoice.total_amount, Decimal("210.00"))

    def test_payment_creates_receipt_and_updates_balance(self):
        add_invoice_line(invoice=self.invoice, description="Program", quantity=1, unit_price=500)
        payment, receipt = record_payment(invoice=self.invoice, amount=Decimal("500"), method="upi", payment_date=timezone.now(), recorded_by=self.admin)
        self.assertEqual(payment.status, "success")
        self.assertEqual(receipt.payment_id, payment.id)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.amount_paid, Decimal("500.00"))
        self.assertEqual(self.invoice.status, BillingStatus.PAID)
