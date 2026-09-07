from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from audit.services import record_audit
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitCustody


@transaction.atomic
def move_stock(*, item: InventoryItem, quantity_delta: int, performed_by, reason: str, school=None, trainer=None, reference=""):
    quantity_delta = int(quantity_delta)
    if quantity_delta == 0:
        raise ValidationError("Quantity delta cannot be zero.")
    if school is not None and trainer is not None:
        raise ValidationError("Stock belongs to either a school, a trainer, or the central store.")
    balance, _ = StockBalance.objects.select_for_update().get_or_create(item=item, school=school, trainer=trainer, defaults={"quantity": 0})
    new_quantity = balance.quantity + quantity_delta
    if new_quantity < 0:
        raise ValidationError("Insufficient stock for this location.")
    balance.quantity = new_quantity
    balance.save(update_fields=["quantity", "updated_at"])
    movement = StockMovement.objects.create(item=item, quantity_delta=quantity_delta, school=school, trainer=trainer, reason=reason.strip(), reference=reference.strip(), performed_by=performed_by)
    record_audit(actor=performed_by, action="create", entity_type="StockMovement", entity_id=movement.id, summary=f"Stock movement: {item.sku} {quantity_delta:+d}", changes={"quantity_delta": quantity_delta, "balance": new_quantity})
    return movement, balance


@transaction.atomic
def issue_kit(*, kit: Kit, issued_by, school=None, trainer=None, student=None, notes=""):
    locked_kit = Kit.objects.select_for_update().select_related("school_class__school").get(pk=kit.pk)
    recipients = [school, trainer, student]
    if sum(bool(x) for x in recipients) != 1:
        raise ValidationError("A kit must have exactly one active recipient.")
    if locked_kit.school_class_id:
        kit_school_id = locked_kit.school_class.school_id
        if school is not None and school.id != kit_school_id:
            raise PermissionDenied("Kit school does not match the recipient school.")
        if student is not None and student.school_class.school_id != kit_school_id:
            raise PermissionDenied("Student does not belong to the kit school.")
        if trainer is not None and not trainer.school_assignments.filter(school_id=kit_school_id, status="active").exists():
            raise PermissionDenied("Trainer is not assigned to the kit school.")
    if KitCustody.objects.filter(kit=locked_kit, returned_at__isnull=True).exists():
        raise ValidationError("Kit is already issued.")
    custody = KitCustody.objects.create(kit=locked_kit, school=school, trainer=trainer, student=student, issued_at=timezone.now(), issued_by=issued_by, notes=notes.strip())
    record_audit(actor=issued_by, action="create", entity_type="KitCustody", entity_id=custody.id, summary=f"Issued kit {locked_kit.kit_code}")
    return custody


@transaction.atomic
def return_kit(*, custody: KitCustody, returned_by, notes=""):
    locked = KitCustody.objects.select_for_update().select_related("kit").get(pk=custody.pk)
    if locked.returned_at is not None:
        raise ValidationError("Kit is already returned.")
    locked.returned_at = timezone.now()
    locked.returned_by = returned_by
    if notes:
        locked.notes = notes.strip()
    locked.save(update_fields=["returned_at", "returned_by", "notes"])
    record_audit(actor=returned_by, action="update", entity_type="KitCustody", entity_id=locked.id, summary=f"Returned kit {locked.kit.kit_code}")
    return locked
