from rest_framework import serializers

from .models import InventoryItem, Kit, KitAssignment, KitItem, StockMovement
from .services import record_stock_movement, stock_balance


class InventoryItemSerializer(serializers.ModelSerializer):
    stock_balance = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = ["id", "sku", "name", "category", "unit", "reorder_level", "active", "created_at", "updated_at", "stock_balance"]
        read_only_fields = ["id", "created_at", "updated_at", "stock_balance"]

    def get_stock_balance(self, obj): return stock_balance(obj.pk)


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = ["id", "performed_by", "created_at"]

    def create(self, validated_data):
        return record_stock_movement(performed_by=self.context["request"].user, **validated_data)


class KitItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitItem
        fields = "__all__"
        read_only_fields = ["id"]


class KitSerializer(serializers.ModelSerializer):
    items = KitItemSerializer(many=True, read_only=True)

    class Meta:
        model = Kit
        fields = ["id", "kit_code", "name", "description", "status", "created_at", "updated_at", "items"]
        read_only_fields = ["id", "created_at", "updated_at"]


class KitAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KitAssignment
        fields = "__all__"
        read_only_fields = ["id", "assigned_by", "assigned_at"]

    def validate(self, attrs):
        school = attrs.get("school")
        school_class = attrs.get("school_class")
        student = attrs.get("student")
        if not any([school, school_class, student]):
            raise serializers.ValidationError("A kit must be assigned to a school, class or student.")
        if school_class and school and school_class.school_id != school.id:
            raise serializers.ValidationError("Class must belong to the selected school.")
        if student:
            if school_class and student.school_class_id != school_class.id:
                raise serializers.ValidationError("Student must belong to the selected class.")
            if school and student.school_class.school_id != school.id:
                raise serializers.ValidationError("Student must belong to the selected school.")
        return attrs

    def create(self, validated_data):
        return KitAssignment.objects.create(assigned_by=self.context["request"].user, **validated_data)
