from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student
from .models import InventoryItem, Kit, KitCustody, StockBalance
from .services import issue_kit, move_stock, return_kit


class InventoryTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("inv-admin", "strong-pass", role=UserRole.ADMIN, is_staff=True)
        self.school_user = User.objects.create_user("INV-SCHOOL", "strong-pass", role=UserRole.SCHOOL)
        self.school = School.objects.create(school_code="INV", name="Inventory School", account=self.school_user)
        self.cls = SchoolClass.objects.create(school=self.school, grade="8", section="A")
        self.student = Student.objects.create(school_class=self.cls, roll_number=1, name="One", student_id="INV8A 01")
        self.item = InventoryItem.objects.create(sku="led-001", name="LED", category="electronics", unit_cost=Decimal("10"), created_by=self.admin)
        self.kit = Kit.objects.create(kit_code="KIT-001", name="Robotics Kit", school_class=self.cls, created_by=self.admin)

    def test_stock_move_is_transactional_and_historical(self):
        move_stock(item=self.item, quantity_delta=10, performed_by=self.admin, reason="receipt", school=self.school)
        self.assertEqual(StockBalance.objects.get(item=self.item, school=self.school).quantity, 10)
        with self.assertRaises(Exception):
            move_stock(item=self.item, quantity_delta=-11, performed_by=self.admin, reason="issue", school=self.school)
        self.assertEqual(StockBalance.objects.get(item=self.item, school=self.school).quantity, 10)

    def test_kit_has_single_active_custody(self):
        custody = issue_kit(kit=self.kit, issued_by=self.admin, student=self.student)
        self.assertIsNotNone(custody)
        with self.assertRaises(Exception):
            issue_kit(kit=self.kit, issued_by=self.admin, school=self.school)
        returned = return_kit(custody=custody, returned_by=self.admin)
        self.assertIsNotNone(returned.returned_at)
        issue_kit(kit=self.kit, issued_by=self.admin, school=self.school)
