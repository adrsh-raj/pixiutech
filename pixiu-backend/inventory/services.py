from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import InventoryItem, StockBalance, StockMovement, Kit, KitCustody


@transaction.atomic
def move_stock(*, item: InventoryItem, quantity_delta: int, performed_by, reason: str, school=None, trainer=None, reference=""):
    quantity_delta = int(quantity_delta)
    if quantity_delta == 0:
        raise ValidationError("Quantity delta cannot be zero.")
    balance, _ = StockBalance.objects.select_for_update().get_or_create(
        item=item, school=school, trainer=trainer, defaults={"quantity": 0}
    )
    new_quantity = balance.quantity + quantity_delta
    if new_quantity < 0:
        raise ValidationError("Insufficient stock for this location.")
    balance.quantity = new_quantity
    balance.save(update_fields=["quantity", "updated_at"])
    movement = StockMovement.objects.create(
        item=item,
        quantity_delta=quantity_delta,
        school=school,
        trainer=trainer,
        reason=reason.strip(),
        reference=reference.strip(),
        performed_by=performed_by,
    )
    return movement, balance


@transaction.atomic
def issue_kit(*, kit: Kit, issued_by, school=None, trainer=None, student=None, notes=""):
    if not any([school, trainer, student]):
        raise ValidationError("A school, trainer or student recipient is required.")
    if sum(bool(x) for x in [school, trainer, student]) != 1:
        raise ValidationError("A kit can have exactly one active custodian.")
    if KitCustody.objects.filter(kit=kit, returned_at__isnull=True).exists():
        raise ValidationError("Kit is already issued.")
    custody = KitCustody.objects.create(
        kit=kit,
        school=school,
        trainer=trainer,
        student=student,
        issued_at=timezone.now(),
        issued_by=issued_by,
        notes=notes.strip(),
    )
    return custody


@transaction.atomic
def return_kit(*, custody: KitCustody, returned_by, notes=""):
    locked = KitCustody.objects.select_for_update().get(pk=custody.pk)
    if locked.returned_at is not None:
        raise ValidationError("Kit is already returned.")
    locked.returned_at = timezone.now()
    locked.returned_by = returned_by
    if notes:
        locked.notes = notes.strip()
    locked.save(update_fields=["returned_at", "returned_by", "notes"])
    return locked
