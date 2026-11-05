from rest_framework import serializers

from academics.services import accessible_school_queryset
from django.conf import settings
from decimal import Decimal

from .models import Invoice, InvoiceLineItem, Payment, PaymentMethod, Receipt, SchoolContract


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    class Meta:
        model = InvoiceLineItem
        fields = ["id", "invoice", "description", "quantity", "unit_price", "line_total"]
        read_only_fields = ["id", "invoice", "line_total"]


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineItemSerializer(many=True, read_only=True)
    school_code = serializers.CharField(source="school.school_code", read_only=True)
    school_name = serializers.CharField(source="school.name", read_only=True)
    billing_profile = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    pending_payment = serializers.SerializerMethodField()
    contract_number = serializers.CharField(source="contract.contract_number", read_only=True)
    class Meta:
        model = Invoice
        fields = ["id", "invoice_number", "contract", "contract_number", "school", "school_code", "school_name", "school_class", "trainer", "status", "issue_date", "due_date", "notes", "subtotal", "tax_amount", "total_amount", "amount_paid", "balance_due", "pending_payment", "lines", "billing_profile", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "invoice_number", "status", "subtotal", "total_amount", "amount_paid", "balance_due", "created_by", "created_at", "updated_at"]
    def get_balance_due(self, obj):
        return max(obj.total_amount - obj.amount_paid, 0)

    def get_pending_payment(self, obj):
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", "")
        if role != "admin":
            return None
        for payment in obj.payments.all():
            if payment.status == "pending":
                return {
                    "id": str(payment.id),
                    "invoice": str(payment.invoice_id),
                    "invoice_number": obj.invoice_number,
                    "school_id": str(obj.school_id),
                    "school_code": obj.school.school_code,
                    "school_name": obj.school.name,
                    "amount": payment.amount,
                    "method": payment.method,
                    "status": payment.status,
                    "transaction_reference": payment.transaction_reference,
                    "payment_date": payment.payment_date,
                    "notes": payment.notes,
                }
        return None

    def get_billing_profile(self, obj):
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", "")
        if role not in {"admin", "school"}:
            return {}
        profile = getattr(obj.school, "billing_profile", None)
        if not profile:
            return {}
        return {
            "school_id": str(obj.school_id),
            "school_code": obj.school.school_code,
            "school_name": obj.school.name,
            "account_name": profile.account_name,
            "bank_name": profile.bank_name,
            "account_number": profile.account_number,
            "ifsc": profile.ifsc,
            "upi": profile.upi,
            "configured": bool(profile.account_name and profile.bank_name and profile.account_number and profile.ifsc),
        }

    def validate(self, attrs):
        user = self.context["request"].user
        school = attrs.get("school", getattr(self.instance, "school", None))
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        trainer = attrs.get("trainer", getattr(self.instance, "trainer", None))
        contract = attrs.get("contract", getattr(self.instance, "contract", None))
        if not school or not accessible_school_queryset(user).filter(pk=school.pk).exists():
            raise serializers.ValidationError({"school": "You cannot bill this school."})
        if school_class and school_class.school_id != school.id:
            raise serializers.ValidationError({"school_class": "Invoice class must belong to the selected school."})
        if trainer and trainer.school_assignments.filter(school_id=school.id, status="active").exists() is False:
            raise serializers.ValidationError({"trainer": "Invoice trainer is not actively assigned to the selected school."})
        if contract and contract.school_id != school.id:
            raise serializers.ValidationError({"contract": "Contract must belong to the selected school."})
        if attrs.get("tax_amount", getattr(self.instance, "tax_amount", 0)) < 0:
            raise serializers.ValidationError({"tax_amount": "Tax cannot be negative."})
        return attrs


class InvoiceLineItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ["id", "invoice", "description", "quantity", "unit_price"]
        read_only_fields = ["id"]


class PaymentRecordSerializer(serializers.Serializer):
    invoice = serializers.PrimaryKeyRelatedField(queryset=Invoice.objects.all(), required=False, allow_null=True)
    contract = serializers.PrimaryKeyRelatedField(queryset=SchoolContract.objects.all(), required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    payment_date = serializers.DateTimeField()
    transaction_reference = serializers.CharField(max_length=120, required=False, allow_blank=True, trim_whitespace=True)
    notes = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)

    def validate(self, attrs):
        invoice = attrs.get("invoice")
        contract = attrs.get("contract")
        if (invoice is None) == (contract is None):
            raise serializers.ValidationError("Provide exactly one of invoice or contract.")
        reference = attrs.get("transaction_reference", "").strip()
        if reference and Payment.objects.filter(
            method=attrs["method"],
            transaction_reference__iexact=reference,
        ).exists():
            raise serializers.ValidationError({
                "transaction_reference": "This transaction reference has already been recorded."
            })
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.SerializerMethodField()
    contract_id = serializers.SerializerMethodField()
    contract_number = serializers.SerializerMethodField()
    school_id = serializers.SerializerMethodField()
    school_code = serializers.SerializerMethodField()
    school_name = serializers.SerializerMethodField()
    receipt_number = serializers.SerializerMethodField()
    receipt_total_amount_snapshot = serializers.SerializerMethodField()
    receipt_amount_paid_snapshot = serializers.SerializerMethodField()
    receipt_balance_due_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "invoice", "invoice_number", "contract", "contract_id", "contract_number",
            "school_id", "school_code", "school_name", "amount", "method", "status",
            "transaction_reference", "payment_date", "notes", "recorded_by", "created_at",
            "receipt_number", "receipt_total_amount_snapshot", "receipt_amount_paid_snapshot",
            "receipt_balance_due_snapshot",
        ]
        read_only_fields = fields

    @staticmethod
    def _receipt(obj):
        try:
            return obj.receipt
        except Receipt.DoesNotExist:
            return None

    @staticmethod
    def _school(obj):
        if obj.invoice_id:
            return obj.invoice.school
        if obj.contract_id:
            return obj.contract.school
        return None

    def get_invoice_number(self, obj):
        return obj.invoice.invoice_number if obj.invoice_id else None

    def get_contract_id(self, obj):
        if obj.contract_id:
            return str(obj.contract_id)
        if obj.invoice_id and obj.invoice.contract_id:
            return str(obj.invoice.contract_id)
        return None

    def get_contract_number(self, obj):
        if obj.contract_id:
            return obj.contract.contract_number
        if obj.invoice_id and obj.invoice.contract_id:
            return obj.invoice.contract.contract_number
        return None

    def get_school_id(self, obj):
        school = self._school(obj)
        return str(school.id) if school else None

    def get_school_code(self, obj):
        school = self._school(obj)
        return school.school_code if school else None

    def get_school_name(self, obj):
        school = self._school(obj)
        return school.name if school else None

    def get_receipt_number(self, obj):
        receipt = self._receipt(obj)
        return receipt.receipt_number if receipt else None

    def get_receipt_total_amount_snapshot(self, obj):
        receipt = self._receipt(obj)
        return receipt.total_amount_snapshot if receipt else None

    def get_receipt_amount_paid_snapshot(self, obj):
        receipt = self._receipt(obj)
        return receipt.amount_paid_snapshot if receipt else None

    def get_receipt_balance_due_snapshot(self, obj):
        receipt = self._receipt(obj)
        return receipt.balance_due_snapshot if receipt else None


class ReceiptSerializer(serializers.ModelSerializer):
    payment_amount = serializers.DecimalField(source="payment.amount", max_digits=12, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(source="payment.method", read_only=True)
    payment_date = serializers.DateTimeField(source="payment.payment_date", read_only=True)
    transaction_reference = serializers.CharField(source="payment.transaction_reference", read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id", "receipt_number", "payment", "issued_at", "issued_by",
            "school_name_snapshot", "invoice_number_snapshot", "contract_number_snapshot",
            "total_amount_snapshot", "amount_paid_snapshot", "balance_due_snapshot",
            "payment_amount", "payment_method", "payment_date", "transaction_reference",
        ]
        read_only_fields = fields
