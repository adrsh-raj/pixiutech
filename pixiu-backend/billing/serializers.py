from rest_framework import serializers

from .models import Invoice, InvoiceLineItem, Payment, Receipt


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceLineItem
        fields = ["id", "invoice", "description", "quantity", "unit_price", "line_total"]
        read_only_fields = ["id", "invoice", "line_total"]


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "invoice_number", "school", "school_class", "trainer", "status", "issue_date", "due_date", "notes", "subtotal", "tax_amount", "total_amount", "amount_paid", "lines", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "invoice_number", "status", "subtotal", "total_amount", "amount_paid", "created_by", "created_at", "updated_at"]


class InvoiceLineItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLineItem
        fields = ["id", "invoice", "description", "quantity", "unit_price"]
        read_only_fields = ["id", "invoice"]


class PaymentSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.receipt_number", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "invoice", "amount", "method", "status", "transaction_reference", "payment_date", "notes", "recorded_by", "created_at", "receipt_number"]
        read_only_fields = ["id", "status", "recorded_by", "created_at", "receipt_number"]


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ["id", "receipt_number", "payment", "issued_at", "issued_by"]
        read_only_fields = fields
