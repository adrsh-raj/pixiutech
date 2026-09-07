from django.contrib import admin
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody
admin.site.register([InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody])
