from academics.models import School

from .api_v1_compat import ContractSchoolViewSet


class ContractSchoolCompatViewSet(ContractSchoolViewSet):
    """Accept both the canonical UUID and the legacy school-code identifier."""

    def get_object(self):
        pk = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        try:
            obj = queryset.get(pk=pk)
        except (School.DoesNotExist, ValueError):
            obj = queryset.get(school_code=str(pk).strip().upper())
        self.check_object_permissions(self.request, obj)
        return obj
