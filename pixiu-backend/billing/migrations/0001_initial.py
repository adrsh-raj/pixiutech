import uuid
from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db.models import Q

class Migration(migrations.Migration):
    initial=True
    dependencies=[("academics","0001_initial"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[
        migrations.CreateModel(name="Invoice",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),
            ("invoice_number",models.CharField(max_length=40,unique=True)),("status",models.CharField(choices=[("draft","Draft"),("issued","Issued"),("partially_paid","Partially paid"),("paid","Paid"),("void","Void"),("overdue","Overdue")],default="draft",max_length=20)),
            ("issue_date",models.DateField()),("due_date",models.DateField()),("notes",models.TextField(blank=True)),
            ("subtotal",models.DecimalField(decimal_places=2,default=Decimal("0.00"),max_digits=12,validators=[MinValueValidator(Decimal("0"))])),
            ("tax_amount",models.DecimalField(decimal_places=2,default=Decimal("0.00"),max_digits=12,validators=[MinValueValidator(Decimal("0"))])),
            ("total_amount",models.DecimalField(decimal_places=2,default=Decimal("0.00"),max_digits=12,validators=[MinValueValidator(Decimal("0"))])),
            ("amount_paid",models.DecimalField(decimal_places=2,default=Decimal("0.00"),max_digits=12,validators=[MinValueValidator(Decimal("0"))])),
            ("created_at",models.DateTimeField(auto_now_add=True)),("updated_at",models.DateTimeField(auto_now=True)),
            ("created_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="created_invoices",to=settings.AUTH_USER_MODEL)),
            ("school",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="invoices",to="academics.school")),
            ("school_class",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,related_name="invoices",to="academics.schoolclass")),
            ("trainer",models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.PROTECT,related_name="invoices",to="academics.trainer"))],options={"ordering":["-issue_date","-created_at"]}),
        migrations.CreateModel(name="InvoiceLineItem",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("description",models.CharField(max_length=250)),
            ("quantity",models.DecimalField(decimal_places=2,max_digits=10,validators=[MinValueValidator(Decimal("0.01"))])),("unit_price",models.DecimalField(decimal_places=2,max_digits=12,validators=[MinValueValidator(Decimal("0"))])),("line_total",models.DecimalField(decimal_places=2,max_digits=12,validators=[MinValueValidator(Decimal("0"))])),
            ("invoice",models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name="lines",to="billing.invoice"))]),
        migrations.CreateModel(name="Payment",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("amount",models.DecimalField(decimal_places=2,max_digits=12,validators=[MinValueValidator(Decimal("0.01"))])),
            ("method",models.CharField(choices=[("cash","Cash"),("bank_transfer","Bank transfer"),("upi","UPI"),("card","Card"),("other","Other")],max_length=30)),
            ("status",models.CharField(choices=[("pending","Pending"),("success","Success"),("failed","Failed"),("refunded","Refunded"),("void","Void")],default="pending",max_length=20)),
            ("transaction_reference",models.CharField(blank=True,max_length=120)),("payment_date",models.DateTimeField()),("notes",models.TextField(blank=True)),("created_at",models.DateTimeField(auto_now_add=True)),
            ("invoice",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="payments",to="billing.invoice")),("recorded_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="recorded_payments",to=settings.AUTH_USER_MODEL))]),
        migrations.CreateModel(name="Receipt",fields=[
            ("id",models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),("receipt_number",models.CharField(max_length=40,unique=True)),("issued_at",models.DateTimeField()),
            ("issued_by",models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name="issued_receipts",to=settings.AUTH_USER_MODEL)),("payment",models.OneToOneField(on_delete=django.db.models.deletion.PROTECT,related_name="receipt",to="billing.payment"))]),
        migrations.AddConstraint(model_name="invoice",constraint=models.CheckConstraint(condition=models.Q(("due_date__gte",models.F("issue_date"))),name="invoice_due_on_or_after_issue")),
        migrations.AddConstraint(model_name="invoice",constraint=models.CheckConstraint(condition=models.Q(("amount_paid__lte",models.F("total_amount"))),name="invoice_paid_not_over_total")),
        migrations.AddConstraint(model_name="payment",constraint=models.UniqueConstraint(condition=~models.Q(("transaction_reference","")),fields=("method","transaction_reference"),name="uniq_payment_reference_per_method")),
    ]
