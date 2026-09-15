from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from academics.services import accessible_student_queryset
from academics.serializers import StudentReadSerializer
from academics.views import StudentViewSet


class StudentPortalViewSet(StudentViewSet):
    """Deterministic student collection endpoint for the portal."""

    PAGINATION_DEFAULT = 50
    PAGINATION_MAX = 100

    def get_queryset(self):
        return accessible_student_queryset(self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Pagination is opt-in to preserve the existing array response for
        # older portal consumers while allowing large rosters to be fetched
        # incrementally. Example: /students?limit=50&offset=0
        limit_raw = request.query_params.get("limit")
        offset_raw = request.query_params.get("offset", "0")
        try:
            limit = int(limit_raw) if limit_raw is not None else None
            offset = max(int(offset_raw), 0)
        except (TypeError, ValueError):
            return Response({"detail": "limit and offset must be integers."}, status=400)

        if limit is None:
            rows = queryset
            next_offset = None
            has_next = False
        else:
            if limit <= 0:
                return Response({"detail": "limit must be greater than zero."}, status=400)
            limit = min(limit, self.PAGINATION_MAX)
            rows = queryset[offset:offset + limit]
            has_next = len(rows) == limit
            next_offset = offset + limit if has_next else None

        serializer = StudentReadSerializer(rows, many=True, context={"request": request})
        response = Response(serializer.data)
        if limit is not None:
            response["X-Pixiu-Page-Limit"] = str(limit)
            response["X-Pixiu-Page-Offset"] = str(offset)
            response["X-Pixiu-Page-Has-Next"] = "true" if has_next else "false"
            if next_offset is not None:
                response["X-Pixiu-Page-Next-Offset"] = str(next_offset)
        return response

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        obj = get_object_or_404(queryset, pk=self.kwargs[self.lookup_url_kwarg or self.lookup_field])
        self.check_object_permissions(self.request, obj)
        return obj
