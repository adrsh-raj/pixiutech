from decimal import Decimal

from rest_framework import serializers

from academics.models import Student
from academics.services import accessible_school_queryset, accessible_student_queryset

from .models import Invoice, InvoiceItem, Payment, Receipt
from .services import record_payment


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = "__all__"
        read_only_fields = ["id", "line_total", "created_at"]

    def create(self, validated_data):
        validated_data["line_total"] = (Decimal(validated_data["quantity"]) * Decimal(validated_data["unit_price"])).quantize(Decimal("0.01"))
        return super().create(validated_data)


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, required=False)
    amount_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ["id", "invoice_number", "school", "student", "issue_date", "due_date", "currency", "subtotal", "tax_amount", "total_amount", "status", "notes", "created_by", "created_at", "updated_at", "items", "amount_paid", "balance"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "amount_paid", "balance"]

    def validate(self, attrs):
        user = self.context["request"].user
        school = attrs.get("school", getattr(self.instance, "school", None))
        student = attrs.get("student", getattr(self.instance, "student", None))
        if user.role != "admin" and not accessible_school_queryset(user).filter(pk=school.pk).exists():
            raise serializers.ValidationError("You cannot use this school.")
        if student and (not accessible_student_queryset(user).filter(pk=student.pk).exists() or student.school_class.school_id != school.id):
            raise serializers.ValidationError("Student must belong to the selected school and your scope.")
        return attrs

    def get_amount_paid(self, obj):
        from .services import successful_total
        return successful_total(obj.pk)

    def get_balance(self, obj):
        return obj.total_amount - self.get_amount_paid(obj)

    def create(self, validated_data):
        items = validated_data.pop("items", [])
        invoice = Invoice.objects.create(created_by=self.context["request"].user, **validated_data)
        for item in items:
            InvoiceItem.objects.create(invoice=invoice, line_total=(item["quantity"] * item["unit_price"]).quantize(Decimal("0.01")), **item)
        return invoice


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["id", "status", "paid_at", "received_by", "created_at"]

    def create(self, validated_data):
        payment, _ = record_payment(received_by=self.context["request"].user, **validated_data)
        return payment


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = "__all__"
        read_only_fields = fields
