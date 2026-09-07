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
        migrations.CreateModel(name="InventoryItem", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("sku", models.CharField(max_length=50, unique=True)), ("name", models.CharField(max_length=200)), ("category", models.CharField(max_length=80)), ("unit", models.CharField(default="pcs", max_length=30)), ("reorder_level", models.DecimalField(decimal_places=2, default=0, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal("0"))])), ("active", models.BooleanField(default=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
        ]),
        migrations.CreateModel(name="Kit", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("kit_code", models.CharField(max_length=50, unique=True)), ("name", models.CharField(max_length=200)), ("description", models.TextField(blank=True)), ("status", models.CharField(choices=[("active","Active"),("inactive","Inactive")], default="active", max_length=20)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
        ]),
        migrations.CreateModel(name="StockMovement", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("movement_type", models.CharField(choices=[("receipt","Receipt"),("issue","Issue"),("return","Return"),("adjustment","Adjustment")], max_length=20)), ("quantity", models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])), ("reference", models.CharField(blank=True, max_length=120)), ("note", models.CharField(blank=True, max_length=500)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("item", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="movements", to="inventory.inventoryitem")), ("performed_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="stock_movements", to=settings.AUTH_USER_MODEL)),
        ], options={"ordering":["-created_at"]}),
        migrations.CreateModel(name="KitItem", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("quantity", models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal("0.01"))])),
            ("item", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="kit_components", to="inventory.inventoryitem")), ("kit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="inventory.kit")),
        ]),
        migrations.CreateModel(name="KitAssignment", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("assigned_at", models.DateTimeField(auto_now_add=True)), ("returned_at", models.DateTimeField(blank=True, null=True)), ("note", models.CharField(blank=True, max_length=500)),
            ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="kit_assignments", to=settings.AUTH_USER_MODEL)), ("kit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assignments", to="inventory.kit")), ("school", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="kit_assignments", to="academics.school")), ("school_class", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="kit_assignments", to="academics.schoolclass")), ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="kit_assignments", to="academics.student")),
        ]),
        migrations.AddConstraint(model_name="kititem", constraint=models.UniqueConstraint(fields=("kit","item"), name="uniq_kit_item")),
        migrations.AddConstraint(model_name="kitassignment", constraint=models.CheckConstraint(condition=Q(("school__isnull", False) | ("school_class__isnull", False) | ("student__isnull", False)), name="kit_assignment_has_recipient")),
    ]
