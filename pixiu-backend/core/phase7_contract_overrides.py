from rest_framework import serializers
from rest_framework.decorators import action

from accounts.models import UserRole
from academics.services import accessible_class_queryset
from learning.models import CurriculumUnit, Quiz
from learning.serializers import QuizSerializer, SessionSerializer
from learning.views import QuizViewSet, SessionViewSet

from .api_v1_compat import ContractSessionViewSet


class CurriculumBackedSessionSerializer(SessionSerializer):
    class Meta(SessionSerializer.Meta):
        fields = list(SessionSerializer.Meta.fields)
        read_only_fields = list(SessionSerializer.Meta.read_only_fields)


class ScopedQuizSerializer(QuizSerializer):
    assigned_classes = serializers.SerializerMethodField()

    class Meta(QuizSerializer.Meta):
        fields = list(dict.fromkeys(list(QuizSerializer.Meta.fields) + ["assigned_classes"]))

    def get_assigned_classes(self, obj):
        return [
            {"id": str(row.school_class_id), "name": row.school_class.display_name, "grade": str(row.school_class.grade), "section": row.school_class.section}
            for row in obj.class_assignments.select_related("school_class").all()
        ]


SessionViewSet.serializer_class = CurriculumBackedSessionSerializer
QuizViewSet.serializer_class = ScopedQuizSerializer


class ContractSessionCompatViewSet(ContractSessionViewSet):
    serializer_class = CurriculumBackedSessionSerializer

    def map_in(self, data):
        payload = super().map_in(data)
        curriculum_id = data.get("curriculum_unit") or data.get("curriculum") or data.get("curriculum_unit_id")
        if curriculum_id:
            payload["curriculum_unit"] = curriculum_id
        return payload

    def map_out(self, obj):
        payload = super().map_out(obj)
        curriculum_id = str(obj.curriculum_unit_id) if getattr(obj, "curriculum_unit_id", None) else ""
        payload["curriculum_unit"] = curriculum_id
        payload["curriculum_unit_id"] = curriculum_id
        return payload

    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        return super().unlock(request, pk=pk)
