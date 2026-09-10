from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User, UserRole
from academics.models import School
from .models import BillingStatus, Invoice, PaymentStatus
from .services import add_invoice_line


class BillingApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("billing-api-admin", "strong-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("BILL-API-SCHOOL", "strong-pass", role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code="BILLAPI", name="Billing API School", account=self.school_user)

    def issue_invoice(self):
        invoice = Invoice.objects.create(
            invoice_number="INV-API-TEST",
            school=self.school,
            issue_date=date.today(),
            due_date=date.today(),
            created_by=self.admin,
        )
        add_invoice_line(invoice=invoice, description="Robotics program", quantity=1, unit_price=100)
        self.client.force_authenticate(self.admin)
        response = self.client.post(f"/api/v1/invoices/{invoice.pk}/issue", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, BillingStatus.ISSUED)
        self.assertEqual(invoice.total_amount, Decimal("100.00"))
        return invoice

    def test_admin_can_issue_invoice(self):
        self.issue_invoice()

    def test_school_payment_can_be_verified_by_admin(self):
        invoice = self.issue_invoice()
        self.client.force_authenticate(self.school_user)
        submit = self.client.post(
            "/api/v1/payments/record",
            {
                "invoice": str(invoice.pk),
                "amount": "100.00",
                "method": "upi",
                "payment_date": date.today().isoformat(),
                "transaction_reference": "UTR-API-TEST-001",
                "notes": "School payment",
            },
            format="json",
        )
        self.assertEqual(submit.status_code, 201, submit.data)
        payment_id = submit.data["payment"]["id"]
        self.assertEqual(submit.data["payment"]["status"], PaymentStatus.PENDING)

        self.client.force_authenticate(self.admin)
        verify = self.client.post(f"/api/v1/payments/{payment_id}/verify", {}, format="json")
        self.assertEqual(verify.status_code, 200, verify.data)
        self.assertEqual(verify.data["payment"]["status"], PaymentStatus.SUCCESS)
        self.assertTrue(verify.data["receipt"]["receipt_number"])

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, BillingStatus.PAID)
        self.assertEqual(invoice.amount_paid, Decimal("100.00"))
