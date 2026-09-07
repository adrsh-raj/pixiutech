from rest_framework.decorators import action

from .api_v1_compat import ContractSessionViewSet


class ContractSessionCompatViewSet(ContractSessionViewSet):
    """Keep the legacy PUT unlock call working during the API cutover."""

    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        return super().unlock(request, pk=pk)
