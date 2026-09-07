from django.http import Http404
from rest_framework.decorators import action

from academics.models import School

from .api_v1_compat import ContractSchoolViewSet, ContractSessionViewSet


class ContractSchoolCompatViewSet(ContractSchoolViewSet):
    """Accept both canonical UUIDs and legacy school-code identifiers."""

    def get_object(self):
        raw = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        obj = queryset.filter(pk=raw).first()
        if obj is None:
            obj = queryset.filter(school_code=str(raw).strip().upper()).first()
        if obj is None:
            raise Http404
        self.check_object_permissions(self.request, obj)
        return obj


class ContractSessionCompatViewSet(ContractSessionViewSet):
    """Keep the legacy PUT unlock call working during the API cutover."""

    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        return super().unlock(request, pk=pk)
