from rest_framework.routers import DefaultRouter
from .views import InventoryItemViewSet, KitViewSet, KitCustodyViewSet, KitItemViewSet, StockBalanceViewSet, StockMovementViewSet

router = DefaultRouter()
router.register("items", InventoryItemViewSet, basename="inventory-item")
router.register("stock", StockBalanceViewSet, basename="stock-balance")
router.register("movements", StockMovementViewSet, basename="stock-movement")
router.register("kits", KitViewSet, basename="inventory-kit")
router.register("kit-items", KitItemViewSet, basename="kit-item")
router.register("kit-custody", KitCustodyViewSet, basename="kit-custody")
urlpatterns = router.urls
