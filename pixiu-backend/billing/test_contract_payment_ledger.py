from datetime import date, timedelta
from decimal import Decimal

from rest_framework.test import APITestCase

from accounts.models import User, UserRole
from academics.models import School
from billing.models import ContractStatus, Payment, PaymentStatus, Receipt, SchoolContract


class ContractPaymentLedgerApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            "contract-ledger-admin", "strong-pass", role=UserRole.ADMIN, is_staff=True
        )
        self.school_user = User.objects.create_user(
            "contract-ledger-school", "strong-pass", role=UserRole.SCHOOL
        )
        self.school = School.objects.create(
            school_code="LEDGER", name="Contract Ledger School", account=self.school_user
        )
        self.contract = SchoolContract.objects.create(
            contract_number="PIX-LEDGER-001",
            school=self.school,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365),
            total_value=Decimal("50000.00"),
            status=ContractStatus.ACTIVE,
            created_by=self.admin,
        )

    def post_contract_payment(self, amount, reference):
        return self.client.post(
            "/api/v1/payments/record",
            {
                "contract": str(self.contract.pk),
                "amount": str(amount),
                "method": "bank_transfer",
                "payment_date": date.today().isoformat(),
                "transaction_reference": reference,
                "notes": "Contract payment",
            },
            format="json",
        )

    def get_contract(self):
        response = self.client.get(f"/api/v1/contracts/{self.contract.pk}")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_partial_payment_generates_receipt_and_preserves_historical_balance(self):
        self.client.force_authenticate(self.admin)
        first = self.post_contract_payment("10000.00", "LEDGER-UTR-001")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(first.data["payment"]["status"], PaymentStatus.SUCCESS)
        first_receipt = first.data["receipt"]
        self.assertTrue(first_receipt["receipt_number"].startswith("RCT-"))
        self.assertEqual(first_receipt["school_name_snapshot"], self.school.name)
        self.assertEqual(first_receipt["contract_number_snapshot"], self.contract.contract_number)
        self.assertEqual(first_receipt["total_amount_snapshot"], "50000.00")
        self.assertEqual(first_receipt["amount_paid_snapshot"], "10000.00")
        self.assertEqual(first_receipt["balance_due_snapshot"], "40000.00")

        duplicate = self.post_contract_payment("1000.00", "ledger-utr-001")
        self.assertEqual(duplicate.status_code, 400, duplicate.data)
        self.assertIn("transaction_reference", duplicate.data["fields"])

        contract = self.get_contract()
        self.assertEqual(contract["total_value"], "50000.00")
        self.assertEqual(Decimal(str(contract["amount_paid"])), Decimal("10000.00"))
        self.assertEqual(Decimal(str(contract["balance_due"])), Decimal("40000.00"))
        self.assertEqual(contract["payment_status"], "partially_paid")

        second = self.post_contract_payment("5000.00", "LEDGER-UTR-002")
        self.assertEqual(second.status_code, 201, second.data)
        second_receipt = second.data["receipt"]
        self.assertEqual(second_receipt["amount_paid_snapshot"], "15000.00")
        self.assertEqual(second_receipt["balance_due_snapshot"], "35000.00")

        first_receipt_response = self.client.get(f"/api/v1/receipts/{first_receipt['id']}")
        self.assertEqual(first_receipt_response.status_code, 200, first_receipt_response.data)
        self.assertEqual(first_receipt_response.data["amount_paid_snapshot"], "10000.00")
        self.assertEqual(first_receipt_response.data["balance_due_snapshot"], "40000.00")

        summary = self.client.get("/api/v1/billing-summary")
        self.assertEqual(summary.status_code, 200, summary.data)
        self.assertEqual(Decimal(str(summary.data["contract_value"])), Decimal("50000.00"))
        self.assertEqual(Decimal(str(summary.data["contract_collected"])), Decimal("15000.00"))
        self.assertEqual(Decimal(str(summary.data["contract_pending"])), Decimal("35000.00"))

    def test_school_payment_stays_pending_until_admin_verifies_it(self):
        self.client.force_authenticate(self.school_user)
        submit = self.post_contract_payment("10000.00", "LEDGER-SCHOOL-UTR-001")
        self.assertEqual(submit.status_code, 201, submit.data)
        self.assertEqual(submit.data["payment"]["status"], PaymentStatus.PENDING)
        self.assertIsNone(submit.data["receipt"])

        contract = self.get_contract()
        self.assertEqual(Decimal(str(contract["amount_paid"])), Decimal("0.00"))
        self.assertEqual(Decimal(str(contract["balance_due"])), Decimal("50000.00"))
        self.assertEqual(contract["payment_status"], "unpaid")

        payment_id = submit.data["payment"]["id"]
        self.client.force_authenticate(self.admin)
        verify = self.client.post(f"/api/v1/payments/{payment_id}/verify", {}, format="json")
        self.assertEqual(verify.status_code, 200, verify.data)
        self.assertEqual(verify.data["payment"]["status"], PaymentStatus.SUCCESS)
        self.assertEqual(verify.data["receipt"]["amount_paid_snapshot"], "10000.00")
        self.assertEqual(verify.data["receipt"]["balance_due_snapshot"], "40000.00")

        self.client.force_authenticate(self.school_user)
        receipts = self.client.get("/api/v1/receipts")
        self.assertEqual(receipts.status_code, 200, receipts.data)
        rows = receipts.data if isinstance(receipts.data, list) else receipts.data["results"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["balance_due_snapshot"], "40000.00")

    def test_duplicate_pending_submission_and_overpayment_are_rejected(self):
        self.client.force_authenticate(self.school_user)
        pending = self.post_contract_payment("10000.00", "LEDGER-PENDING-UTR-001")
        self.assertEqual(pending.status_code, 201, pending.data)
        another = self.post_contract_payment("1000.00", "LEDGER-PENDING-UTR-002")
        self.assertEqual(another.status_code, 400, another.data)

        self.client.force_authenticate(self.admin)
        payment_id = pending.data["payment"]["id"]
        reject = self.client.post(f"/api/v1/payments/{payment_id}/reject", {}, format="json")
        self.assertEqual(reject.status_code, 200, reject.data)

        overpayment = self.post_contract_payment("50000.01", "LEDGER-OVER-UTR-001")
        self.assertEqual(overpayment.status_code, 400, overpayment.data)
        self.assertEqual(Payment.objects.filter(contract=self.contract).count(), 1)
        self.assertEqual(Receipt.objects.filter(payment__contract=self.contract).count(), 0)


    def test_linked_invoice_payments_roll_up_to_contract_and_prevent_separate_contract_payments(self):
        self.client.force_authenticate(self.admin)
        today = date.today()
        created = self.client.post(
            "/api/v1/invoices/create-with-lines",
            {
                "school": str(self.school.pk),
                "contract": str(self.contract.pk),
                "issue_date": today.isoformat(),
                "due_date": (today + timedelta(days=30)).isoformat(),
                "tax_amount": "0.00",
                "notes": "Contract-linked invoice",
                "lines": [{"description": "School programme", "quantity": 1, "unit_price": "50000.00"}],
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.data)
        invoice_id = created.data["id"]

        contract = self.get_contract()
        self.assertEqual(contract["open_invoice_count"], 1)

        direct = self.post_contract_payment("10000.00", "LEDGER-DIRECT-WHILE-INVOICE-OPEN")
        self.assertEqual(direct.status_code, 400, direct.data)
        self.assertEqual(Payment.objects.filter(contract=self.contract).count(), 0)

        paid = self.client.post(
            "/api/v1/payments/record",
            {
                "invoice": invoice_id,
                "amount": "10000.00",
                "method": "bank_transfer",
                "payment_date": today.isoformat(),
                "transaction_reference": "LEDGER-INVOICE-UTR-001",
                "notes": "Invoice-linked contract payment",
            },
            format="json",
        )
        self.assertEqual(paid.status_code, 201, paid.data)
        self.assertEqual(paid.data["receipt"]["contract_number_snapshot"], self.contract.contract_number)
        self.assertEqual(paid.data["receipt"]["amount_paid_snapshot"], "10000.00")
        self.assertEqual(paid.data["receipt"]["balance_due_snapshot"], "40000.00")

        contract = self.get_contract()
        self.assertEqual(Decimal(str(contract["amount_paid"])), Decimal("10000.00"))
        self.assertEqual(Decimal(str(contract["balance_due"])), Decimal("40000.00"))
        self.assertEqual(contract["open_invoice_count"], 1)

    def test_contract_terms_cannot_be_rewritten_after_a_payment(self):
        self.client.force_authenticate(self.admin)
        payment = self.post_contract_payment("10000.00", "LEDGER-LOCK-UTR-001")
        self.assertEqual(payment.status_code, 201, payment.data)

        edit = self.client.patch(
            f"/api/v1/contracts/{self.contract.pk}",
            {"total_value": "60000.00"},
            format="json",
        )
        self.assertEqual(edit.status_code, 400, edit.data)
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.total_value, Decimal("50000.00"))
