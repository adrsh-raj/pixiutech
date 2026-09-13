from django.shortcuts import get_object_or_404
from rest_framework.response import Response

from academics.services import accessible_student_queryset
from academics.serializers import StudentReadSerializer
from academics.views import StudentViewSet


class StudentPortalViewSet(StudentViewSet):
    """Deterministic student collection endpoint for the portal."""

    def get_queryset(self):
        return accessible_student_queryset(self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = StudentReadSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        obj = get_object_or_404(queryset, pk=self.kwargs[self.lookup_url_kwarg or self.lookup_field])
        self.check_object_permissions(self.request, obj)
        return obj
