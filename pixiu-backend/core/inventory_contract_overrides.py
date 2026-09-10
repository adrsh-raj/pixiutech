from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from inventory.views import KitComponentViewSet, KitViewSet


class JsonKitViewSet(KitViewSet):
    parser_classes = [JSONParser, MultiPartParser, FormParser]


class JsonKitComponentViewSet(KitComponentViewSet):
    parser_classes = [JSONParser, MultiPartParser, FormParser]
