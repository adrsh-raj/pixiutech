import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from academics.models import School, SchoolClass, Student, Trainer


class ItemStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


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

    def save(self, *args, **kwargs):
        self.sku = self.sku.strip().upper()
        self.name = self.name.strip()
        super().save(*args, **kwargs)


class StockBalance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="balances")
    school = models.ForeignKey(School, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_balances")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, null=True, blank=True, related_name="inventory_balances")
    quantity = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(school__isnull=True) | Q(trainer__isnull=True), name="stock_one_or_zero_custodian"),
            models.UniqueConstraint(fields=["item", "school", "trainer"], name="uniq_stock_location"),
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
    school_class = models.ForeignKey(SchoolClass, on_delete=models.PROTECT, null=True, blank=True, related_name="kits")
    status = models.CharField(max_length=20, choices=ItemStatus.choices, default=ItemStatus.ACTIVE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_kits")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.kit_code = self.kit_code.strip().upper()
        super().save(*args, **kwargs)


class KitItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kit = models.ForeignKey(Kit, on_delete=models.CASCADE, related_name="items")
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, related_name="kit_items")
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    serial_number = models.CharField(max_length=120, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["kit", "item", "serial_number"], name="uniq_kit_item_serial"),
        ]


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
        constraints = [
            models.CheckConstraint(condition=Q(school__isnull=False) | Q(trainer__isnull=False) | Q(student__isnull=False), name="kit_custody_has_recipient"),
            models.UniqueConstraint(fields=["kit"], condition=Q(returned_at__isnull=True), name="uniq_active_kit_custody"),
        ]
