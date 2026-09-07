from decimal import Decimal
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from accounts.models import User, UserRole
from .models import InventoryItem, Kit, KitAssignment, KitItem
from .services import record_stock_movement, stock_balance


class InventoryTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("inv-admin", "strong-password", role=UserRole.ADMIN, is_staff=True)
        self.item = InventoryItem.objects.create(sku="ARD-UNO", name="Arduino UNO", category="board")
        self.kit = Kit.objects.create(kit_code="KIT-001", name="Starter Robotics Kit")
        KitItem.objects.create(kit=self.kit, item=self.item, quantity=1)

    def test_stock_ledger_is_source_of_truth_and_issue_cannot_overdraw(self):
        record_stock_movement(item=self.item, movement_type="receipt", quantity=Decimal("10"), performed_by=self.admin, reference="PO-1")
        record_stock_movement(item=self.item, movement_type="issue", quantity=Decimal("3"), performed_by=self.admin, reference="KIT-1")
        self.assertEqual(stock_balance(self.item.id), Decimal("7"))
        with self.assertRaises(ValidationError):
            record_stock_movement(item=self.item, movement_type="issue", quantity=Decimal("8"), performed_by=self.admin)

    def test_kit_assignment_requires_real_recipient_relation(self):
        with self.assertRaises(Exception):
            KitAssignment.objects.create(kit=self.kit, assigned_by=self.admin)
