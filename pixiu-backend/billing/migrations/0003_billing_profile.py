from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


def backfill_billing_profiles(apps, schema_editor):
    School = apps.get_model("academics", "School")
    BillingProfile = apps.get_model("billing", "BillingProfile")
    db_alias = schema_editor.connection.alias
    defaults = {
        "account_name": getattr(settings, "PIXIU_BILLING_ACCOUNT_NAME", "").strip(),
        "bank_name": getattr(settings, "PIXIU_BILLING_BANK_NAME", "").strip(),
        "account_number": getattr(settings, "PIXIU_BILLING_ACCOUNT_NUMBER", "").strip(),
        "ifsc": getattr(settings, "PIXIU_BILLING_IFSC", "").strip(),
        "upi": getattr(settings, "PIXIU_BILLING_UPI", "").strip(),
    }
    for school in School.objects.using(db_alias).all().iterator():
        BillingProfile.objects.using(db_alias).get_or_create(
            school_id=school.pk,
            defaults=defaults,
        )


class Migration(migrations.Migration):
    dependencies = [("billing", "0002_school_contract")]

    operations = [
        migrations.CreateModel(
            name="BillingProfile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("account_name", models.CharField(max_length=200)),
                ("bank_name", models.CharField(max_length=150)),
                ("account_number", models.CharField(max_length=80)),
                ("ifsc", models.CharField(max_length=30)),
                ("upi", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="billing_profile", to="academics.school")),
            ],
            options={"ordering": ["school__school_code", "-created_at"]},
        ),
        migrations.RunPython(backfill_billing_profiles, migrations.RunPython.noop),
    ]
