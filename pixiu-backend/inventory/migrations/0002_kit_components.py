import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.core.validators import MinValueValidator
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        ("learning", "0002_session_workflow"),
    ]

    operations = [
        migrations.AddField(model_name="kit", name="school", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="kits", to="academics.school")),
        migrations.AddField(model_name="kit", name="condition", field=models.CharField(choices=[("new","New"),("good","Good"),("fair","Fair"),("needs_repair","Needs repair"),("damaged","Damaged")], default="good", max_length=20)),
        migrations.AddField(model_name="kit", name="image", field=models.ImageField(blank=True, null=True, upload_to="inventory/kits/%Y/%m/")),
        migrations.AlterField(model_name="kit", name="status", field=models.CharField(choices=[("available","Available"),("assigned","Assigned"),("maintenance","Maintenance"),("lost","Lost"),("retired","Retired")], default="available", max_length=20)),
        migrations.CreateModel(
            name="KitComponent",
            fields=[
                ("id", models.UUIDField(default=__import__("uuid").uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("role", models.CharField(blank=True, max_length=250)),
                ("specs", models.TextField(blank=True)),
                ("quantity", models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])),
                ("condition", models.CharField(choices=[("new","New"),("good","Good"),("fair","Fair"),("needs_repair","Needs repair"),("damaged","Damaged")], default="good", max_length=20)),
                ("status", models.CharField(choices=[("available","Available"),("assigned","Assigned"),("maintenance","Maintenance"),("lost","Lost"),("retired","Retired")], default="available", max_length=20)),
                ("image", models.ImageField(blank=True, null=True, upload_to="inventory/components/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("first_used_session", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="first_used_components", to="learning.session")),
                ("kit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="components", to="inventory.kit")),
            ],
            options={"ordering": ["name", "id"]},
        ),
        migrations.CreateModel(
            name="KitMaintenance",
            fields=[
                ("id", models.UUIDField(default=__import__("uuid").uuid4, editable=False, primary_key=True, serialize=False)),
                ("maintenance_type", models.CharField(default="inspection", max_length=100)),
                ("notes", models.TextField(blank=True)),
                ("performed_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("kit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="maintenance_history", to="inventory.kit")),
                ("performed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="kit_maintenance_records", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-performed_at", "-created_at"]},
        ),
    ]
