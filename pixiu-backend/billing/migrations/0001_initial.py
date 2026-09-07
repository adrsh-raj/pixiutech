import uuid
from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("academics", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="Invoice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("invoice_number", models.CharField(max_length=40, unique=True)),
                ("issue_date", models.DateField()), ("due_date", models.DateField()), ("currency", models.CharField(default="INR", max_length=3)),
                ("subtotal", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0"))])),
                ("tax_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0"))])),
                ("total_amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
                ("status", models.CharField(choices=[("draft","Draft"),("issued","Issued"),("partially_paid","Partially Paid"),("paid","Paid"),("void","Void")], default="draft", max_length=20)),
                ("notes", models.TextField(blank=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_invoices", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="invoices", to="academics.school")),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="invoices", to="academics.student")),
            ], options={"ordering":["-issue_date","-created_at"]},
        ),
        migrations.CreateModel(
            name="InvoiceItem",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("description", models.CharField(max_length=250)), ("quantity", models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0"))])),
                ("line_total", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0"))])),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("invoice", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="billing.invoice")),
            ], options={"ordering":["created_at"]},
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
                ("method", models.CharField(choices=[("cash","Cash"),("bank","Bank Transfer"),("upi","UPI"),("card","Card"),("other","Other")], max_length=20)),
                ("status", models.CharField(choices=[("pending","Pending"),("success","Success"),("failed","Failed"),("refunded","Refunded")], default="pending", max_length=20)),
                ("transaction_reference", models.CharField(blank=True, max_length=120)), ("paid_at", models.DateTimeField(blank=True, null=True)), ("created_at", models.DateTimeField(auto_now_add=True)),
                ("invoice", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="billing.invoice")),
                ("received_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="received_payments", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering":["-created_at"]},
        ),
        migrations.CreateModel(
            name="Receipt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("receipt_number", models.CharField(max_length=40, unique=True)), ("issued_at", models.DateTimeField(auto_now_add=True)), ("notes", models.TextField(blank=True)),
                ("payment", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="receipt", to="billing.payment")),
            ],
        ),
        migrations.AddConstraint(model_name="invoice", constraint=models.CheckConstraint(condition=Q(("due_date__gte", models.F("issue_date"))), name="invoice_due_on_after_issue")),
        migrations.AddConstraint(model_name="invoice", constraint=models.CheckConstraint(condition=Q(("total_amount__gte", models.F("subtotal") + models.F("tax_amount"))), name="invoice_total_not_below_components")),
        migrations.AddConstraint(model_name="invoice", constraint=models.CheckConstraint(condition=Q(("currency__regex", "^[A-Z]{3}$")), name="invoice_currency_iso3")),
        migrations.AddConstraint(model_name="payment", constraint=models.UniqueConstraint(condition=~Q(transaction_reference=""), fields=("invoice","transaction_reference"), name="uniq_invoice_payment_reference")),
    ]
