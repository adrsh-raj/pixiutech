from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, KitAssignmentViewSet, KitItemViewSet, KitViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("items", InventoryItemViewSet, basename="inventory-item")
router.register("movements", StockMovementViewSet, basename="stock-movement")
router.register("kits", KitViewSet, basename="kit")
router.register("kit-items", KitItemViewSet, basename="kit-item")
router.register("kit-assignments", KitAssignmentViewSet, basename="kit-assignment")
urlpatterns = router.urls
