import uuid
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="SchoolContract",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("contract_number", models.CharField(max_length=50, unique=True)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("total_value", models.DecimalField(decimal_places=2, max_digits=14, validators=[MinValueValidator(Decimal("0"))])),
                ("status", models.CharField(choices=[("draft","Draft"),("active","Active"),("expired","Expired"),("terminated","Terminated")], default="draft", max_length=20)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_school_contracts", to=settings.AUTH_USER_MODEL)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="contracts", to="academics.school")),
            ],
            options={"ordering":["-start_date","-created_at"]},
        ),
        migrations.AddField(
            model_name="invoice",
            name="contract",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="invoices", to="billing.schoolcontract"),
        ),
        migrations.AddConstraint(model_name="schoolcontract", constraint=models.CheckConstraint(condition=Q(end_date__gte=models.F("start_date")), name="contract_end_on_or_after_start")),
        migrations.AddConstraint(model_name="schoolcontract", constraint=models.UniqueConstraint(condition=Q(status="active"), fields=("school",), name="uniq_active_contract_per_school")),
    ]
