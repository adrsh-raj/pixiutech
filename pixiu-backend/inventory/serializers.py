from rest_framework import serializers

from academics.models import SchoolClass
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset, accessible_trainer_queryset
from accounts.models import UserRole
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody, KitComponent, KitMaintenance, Condition, KitStatus


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


class KitComponentSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    first_used_session_label = serializers.SerializerMethodField()

    class Meta:
        model = KitComponent
        fields = ["id", "kit", "name", "role", "specs", "first_used_session", "first_used_session_label", "quantity", "condition", "status", "image", "image_url", "created_at", "updated_at"]
        read_only_fields = ["id", "image_url", "first_used_session_label", "created_at", "updated_at"]

    def get_image_url(self, obj):
        try: return obj.image.url if obj.image else ""
        except ValueError: return ""
    def get_first_used_session_label(self, obj):
        s = obj.first_used_session
        return f"{s.date} · {s.topic}" if s else "Not recorded"

    def validate(self, attrs):
        user = self.context["request"].user
        kit = attrs.get("kit", getattr(self.instance, "kit", None))
        if not kit: raise serializers.ValidationError({"kit": "Kit is required."})
        if self.instance and kit.pk != self.instance.kit_id: raise serializers.ValidationError({"kit": "Kit cannot be changed."})
        if user.role != UserRole.ADMIN and not accessible_class_queryset(user).filter(pk=kit.school_class_id).exists(): raise serializers.ValidationError("You cannot modify components for this kit.")
        return attrs


class KitMaintenanceSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source="performed_by.username", read_only=True)
    class Meta:
        model = KitMaintenance
        fields = ["id", "kit", "maintenance_type", "notes", "performed_at", "performed_by", "performed_by_name", "created_at"]
        read_only_fields = ["id", "performed_by", "performed_by_name", "created_at"]
    def validate(self, attrs):
        kit = attrs.get("kit", getattr(self.instance, "kit", None))
        if not kit: raise serializers.ValidationError({"kit": "Kit is required."})
        return attrs


class KitItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitItem
        fields = ["id", "kit", "item", "quantity", "serial_number"]
        read_only_fields = ["id"]
    def validate(self, attrs):
        user = self.context["request"].user; kit = attrs.get("kit", getattr(self.instance, "kit", None))
        if kit is None: raise serializers.ValidationError({"kit": "Kit is required."})
        if self.instance and kit.id != self.instance.kit_id: raise serializers.ValidationError({"kit": "Kit cannot be changed after creation."})
        if user.role != UserRole.ADMIN and not accessible_class_queryset(user).filter(pk=kit.school_class_id).exists(): raise serializers.ValidationError("You cannot modify items for this kit.")
        return attrs


class KitSerializer(serializers.ModelSerializer):
    school_code = serializers.CharField(source="school.school_code", read_only=True)
    class_name = serializers.CharField(source="school_class.display_name", read_only=True)
    image_url = serializers.SerializerMethodField()
    components = KitComponentSerializer(many=True, read_only=True)
    maintenance_history = KitMaintenanceSerializer(many=True, read_only=True)
    items = KitItemSerializer(many=True, read_only=True)

    class Meta:
        model = Kit
        fields = ["id", "kit_code", "name", "description", "school", "school_code", "school_class", "class_name", "condition", "status", "image", "image_url", "created_by", "created_at", "updated_at", "components", "maintenance_history", "items"]
        read_only_fields = ["id", "school_code", "class_name", "image_url", "created_by", "created_at", "updated_at", "components", "maintenance_history", "items"]

    def get_image_url(self, obj):
        try: return obj.image.url if obj.image else ""
        except ValueError: return ""

    def validate(self, attrs):
        user = self.context["request"].user
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        school = attrs.get("school", getattr(self.instance, "school", None))
        if school_class and not school: school = school_class.school
        if school_class and school and school_class.school_id != school.pk: raise serializers.ValidationError({"school_class": "Assigned class must belong to the selected school."})
        if user.role != UserRole.ADMIN:
            if school and not accessible_school_queryset(user).filter(pk=school.pk).exists(): raise serializers.ValidationError("You cannot assign a kit to this school.")
            if school_class and not accessible_class_queryset(user).filter(pk=school_class.pk).exists(): raise serializers.ValidationError("You cannot assign a kit to this class.")
        attrs["school"] = school
        return attrs


class KitCustodySerializer(serializers.ModelSerializer):
    class Meta:
        model = KitCustody
        fields = ["id", "kit", "school", "trainer", "student", "issued_at", "returned_at", "issued_by", "returned_by", "notes"]
        read_only_fields = ["id", "issued_at", "returned_at", "issued_by", "returned_by"]
