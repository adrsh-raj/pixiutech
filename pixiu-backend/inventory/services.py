from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import InventoryItem, StockMovement, StockMovementType


def stock_balance(item_id):
    total = Decimal("0")
    for movement in StockMovement.objects.filter(item_id=item_id):
        if movement.movement_type in {StockMovementType.RECEIPT, StockMovementType.RETURN}:
            total += movement.quantity
        else:
            total -= movement.quantity
    return total


@transaction.atomic
def record_stock_movement(*, item, movement_type, quantity, performed_by, reference="", note=""):
    item = InventoryItem.objects.select_for_update().get(pk=item.pk)
    quantity = Decimal(quantity)
    if movement_type in {StockMovementType.ISSUE, StockMovementType.ADJUSTMENT} and quantity > stock_balance(item.pk) and movement_type == StockMovementType.ISSUE:
        raise ValidationError({"quantity": "Insufficient stock for this issue."})
    return StockMovement.objects.create(item=item, movement_type=movement_type, quantity=quantity, performed_by=performed_by, reference=reference, note=note)
