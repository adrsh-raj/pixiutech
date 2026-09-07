from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserRole

from .models import InventoryItem, Kit, KitAssignment, KitItem, StockMovement
from .serializers import InventoryItemSerializer, KitAssignmentSerializer, KitItemSerializer, KitSerializer, StockMovementSerializer


class InventoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def admin_only(self):
        if self.request.user.role != UserRole.ADMIN:
            raise PermissionDenied("Inventory changes are admin-only.")


class InventoryItemViewSet(InventoryViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    def perform_create(self, serializer): self.admin_only(); serializer.save()
    def perform_update(self, serializer): self.admin_only(); serializer.save()
    def perform_destroy(self, instance): self.admin_only(); instance.active = False; instance.save(update_fields=["active", "updated_at"])


class StockMovementViewSet(InventoryViewSet):
    queryset = StockMovement.objects.select_related("item", "performed_by")
    serializer_class = StockMovementSerializer
    def perform_create(self, serializer): self.admin_only(); serializer.save()
    def perform_update(self, serializer): self.admin_only(); raise PermissionDenied("Stock movements are immutable; create an adjustment or return entry.")
    def perform_destroy(self, instance): self.admin_only(); raise PermissionDenied("Stock movements are immutable.")


class KitViewSet(InventoryViewSet):
    queryset = Kit.objects.prefetch_related("items__item")
    serializer_class = KitSerializer
    def perform_create(self, serializer): self.admin_only(); serializer.save()
    def perform_update(self, serializer): self.admin_only(); serializer.save()
    def perform_destroy(self, instance): self.admin_only(); instance.status = "inactive"; instance.save(update_fields=["status", "updated_at"])


class KitItemViewSet(InventoryViewSet):
    queryset = KitItem.objects.select_related("kit", "item")
    serializer_class = KitItemSerializer
    def perform_create(self, serializer): self.admin_only(); serializer.save()
    def perform_update(self, serializer): self.admin_only(); serializer.save()
    def perform_destroy(self, instance): self.admin_only(); instance.delete()


class KitAssignmentViewSet(InventoryViewSet):
    queryset = KitAssignment.objects.select_related("kit", "school", "school_class", "student", "assigned_by")
    serializer_class = KitAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == UserRole.ADMIN:
            return self.queryset
        if user.role == UserRole.SCHOOL:
            return self.queryset.filter(school__account_id=user.id) | self.queryset.filter(school_class__school__account_id=user.id) | self.queryset.filter(student__school_class__school__account_id=user.id)
        if user.role == UserRole.STUDENT:
            return self.queryset.filter(student__account_id=user.id)
        return self.queryset.none()

    def perform_create(self, serializer): self.admin_only(); serializer.save()
    def perform_update(self, serializer): self.admin_only(); serializer.save()
    def perform_destroy(self, instance): self.admin_only(); raise PermissionDenied("Kit assignments are retained for audit/history.")
