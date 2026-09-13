from rest_framework.response import Response

from academics.services import accessible_student_queryset
from academics.serializers import StudentReadSerializer
from academics.views import StudentViewSet


class StudentPortalViewSet(StudentViewSet):
    """Deterministic student collection endpoint.

    The portal needs a plain JSON array and must use the same role-scoped
    queryset as the rest of the academics API. Keep this endpoint explicit so
    legacy-shape mixins cannot accidentally alter the collection response.
    """

    def get_queryset(self):
        return accessible_student_queryset(self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = StudentReadSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        obj = self.get_object_or_404(queryset, pk=self.kwargs[self.lookup_url_kwarg or self.lookup_field])
        self.check_object_permissions(request=self.request, obj=obj)
        return obj
