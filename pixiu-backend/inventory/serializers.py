from rest_framework import serializers

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


class KitSerializer(serializers.ModelSerializer):
    items = KitItemSerializer(many=True, read_only=True)

    class Meta:
        model = Kit
        fields = ["id", "kit_code", "name", "description", "school_class", "status", "created_by", "created_at", "updated_at", "items"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at", "items"]


class KitCustodySerializer(serializers.ModelSerializer):
    class Meta:
        model = KitCustody
        fields = ["id", "kit", "school", "trainer", "student", "issued_at", "returned_at", "issued_by", "returned_by", "notes"]
        read_only_fields = ["id", "issued_at", "returned_at", "issued_by", "returned_by"]
