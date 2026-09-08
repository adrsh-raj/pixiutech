import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from academics.models import School, SchoolClass, Student, Trainer


class ItemStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Condition(models.TextChoices):
    NEW = "new", "New"
    GOOD = "good", "Good"
    FAIR = "fair", "Fair"
    NEEDS_REPAIR = "needs_repair", "Needs repair"
    DAMAGED = "damaged", "Damaged"


class KitStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    ASSIGNED = "assigned", "Assigned"
    MAINTENANCE = "maintenance", "Maintenance"
    LOST = "lost", "Lost"
    RETIRED = "retired", "Retired"


class InventoryItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sku = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    reorder_level = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.ACTIVE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_inventory_items")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def save(self, *args, **kwargs): self.sku=self.sku.strip().upper(); self.name=self.name.strip(); super().save(*args, **kwargs)


class StockBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="balances")
    school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_balances")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_balances")
    quantity = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [
            models.CheckConstraint(condition=~(Q(school__isnull=False) & Q(trainer__isnull=False)), name="stock_not_school_trainer"),
            models.UniqueConstraint(fields=["item", "school"], condition=Q(school__isnull=False), name="uniq_stock_school"),
            models.UniqueConstraint(fields=["item", "trainer"], condition=Q(trainer__isnull=False), name="uniq_stock_trainer"),
            models.UniqueConstraint(fields=["item"], condition=Q(school__isnull=True, trainer__isnull=True), name="uniq_stock_central"),
        ]


class StockMovement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="movements")
    quantity_delta = models.IntegerField()
    school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_movements")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_movements")
    reason = models.CharField(max_length=120)
    reference = models.CharField(max_length=120, blank=True)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="inventory_movements")
    created_at = models.DateTimeField(auto_now_add=True)


class Kit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit_code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="kits")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, null=True, blank=True, related_name="kits")
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    status = models.CharField(max_length=20, choices=KitStatus.choices, default=KitStatus.AVAILABLE)
    image = models.ImageField(upload_to="inventory/kits/%Y/%m/", null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_kits")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def save(self, *args, **kwargs): self.kit_code=self.kit_code.strip().upper(); self.name=self.name.strip(); super().save(*args, **kwargs)


class KitComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit = models.ForeignKey(Kit, on_delete=models.CASCADE, related_name="components")
    name = models.CharField(max_length=200)
    role = models.CharField(max_length=250, blank=True)
    specs = models.TextField(blank=True)
    first_used_session = models.ForeignKey("learning.Session", on_delete=models.SET_NULL, null=True, blank=True, related_name="first_used_components")
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    status = models.CharField(max_length=20, choices=KitStatus.choices, default=KitStatus.AVAILABLE)
    image = models.ImageField(upload_to="inventory/components/%Y/%m/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta: ordering=["name","id"]


class KitMaintenance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit = models.ForeignKey(Kit, on_delete=models.CASCADE, related_name="maintenance_history")
    maintenance_type = models.CharField(max_length=100, default="inspection")
    notes = models.TextField(blank=True)
    performed_at = models.DateTimeField()
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="kit_maintenance_records")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta: ordering=["-performed_at","-created_at"]


class KitItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit = models.ForeignKey(Kit, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="kit_items")
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    serial_number = models.CharField(max_length=120, blank=True)
    class Meta: constraints=[models.UniqueConstraint(fields=["kit","item","serial_number"],name="uniq_kit_item_serial")]


class KitCustody(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit = models.ForeignKey(Kit, on_delete=models.PROTECT, related_name="custody_history")
    school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="kit_custody")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, null=True, blank=True, related_name="kit_custody")
    student = models.ForeignKey(Student, on_delete=models.PROTECT, null=True, blank=True, related_name="kit_custody")
    issued_at = models.DateTimeField()
    returned_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="issued_kits")
    returned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="returned_kits")
    notes = models.TextField(blank=True)
    class Meta:
        constraints=[
            models.CheckConstraint(condition=Q(school__isnull=False)|Q(trainer__isnull=False)|Q(student__isnull=False),name="kit_custody_has_recipient"),
            models.CheckConstraint(condition=~(Q(school__isnull=False)&Q(trainer__isnull=False)),name="kit_custody_not_school_trainer"),
            models.CheckConstraint(condition=~(Q(school__isnull=False)&Q(student__isnull=False)),name="kit_custody_not_school_student"),
            models.CheckConstraint(condition=~(Q(trainer__isnull=False)&Q(student__isnull=False)),name="kit_custody_not_trainer_student"),
            models.UniqueConstraint(fields=["kit"],condition=Q(returned_at__isnull=True),name="uniq_active_kit_custody"),
        ]
