from rest_framework import serializers

from academics.services import accessible_school_queryset
from django.conf import settings
from .models import Invoice, InvoiceLineItem, Payment, Receipt


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


class PaymentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["invoice", "amount", "method", "payment_date", "transaction_reference", "notes"]


class PaymentSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.receipt_number", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    school_code = serializers.CharField(source="invoice.school.school_code", read_only=True)
    class Meta:
        model = Payment
        fields = ["id", "invoice", "invoice_number", "school_code", "amount", "method", "status", "transaction_reference", "payment_date", "notes", "recorded_by", "created_at", "receipt_number"]
        read_only_fields = ["id", "status", "recorded_by", "created_at", "receipt_number", "invoice_number", "school_code"]


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ["id", "receipt_number", "payment", "issued_at", "issued_by"]
        read_only_fields = fields
