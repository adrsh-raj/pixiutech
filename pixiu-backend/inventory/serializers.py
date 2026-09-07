from rest_framework import serializers

from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset, accessible_trainer_queryset
from accounts.models import UserRole
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = ["id", "sku", "name", "category", "description", "unit_cost", "reorder_level", "status", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class StockBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockBalance
        fields = ["id", "item", "school", "trainer", "quantity", "updated_at"]
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ["id", "item", "quantity_delta", "school", "trainer", "reason", "reference", "performed_by", "created_at"]
        read_only_fields = fields


class KitItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitItem
        fields = ["id", "kit", "item", "quantity", "serial_number"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        user = self.context["request"].user
        kit = attrs.get("kit", getattr(self.instance, "kit", None))
        if kit is None:
            raise serializers.ValidationError({"kit": "Kit is required."})
        if self.instance and kit.id != self.instance.kit_id:
            raise serializers.ValidationError({"kit": "Kit cannot be changed after creation."})
        if user.role != UserRole.ADMIN and not accessible_class_queryset(user).filter(pk=kit.school_class_id).exists():
            raise serializers.ValidationError("You cannot modify items for this kit.")
        return attrs


class KitSerializer(serializers.ModelSerializer):
    items = KitItemSerializer(many=True, read_only=True)

    class Meta:
        model = Kit
        fields = ["id", "kit_code", "name", "description", "school_class", "status", "created_by", "created_at", "updated_at", "items"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "items"]

    def validate_school_class(self, school_class):
        user = self.context["request"].user
        if user.role != UserRole.ADMIN and not accessible_class_queryset(user).filter(pk=school_class.pk).exists():
            raise serializers.ValidationError("You cannot assign a kit to this class.")
        return school_class


class KitCustodySerializer(serializers.ModelSerializer):
    class Meta:
        model = KitCustody
        fields = ["id", "kit", "school", "trainer", "student", "issued_at", "returned_at", "issued_by", "returned_by", "notes"]
        read_only_fields = ["id", "issued_at", "returned_at", "issued_by", "returned_by"]
