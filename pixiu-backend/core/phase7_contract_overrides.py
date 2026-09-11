from rest_framework import serializers
from rest_framework.decorators import action

from accounts.models import UserRole
from academics.services import accessible_class_queryset
from learning.models import CurriculumUnit, Quiz
from learning.serializers import QuizSerializer, SessionSerializer
from learning.views import QuizViewSet, SessionViewSet

from .api_v1_compat import ContractSessionViewSet


_CURRICULUM_PREFIX = "__PIXIU_CURRICULUM_UNIT_ID__:"


def _strip_curriculum_meta(notes):
    value = str(notes or "")
    marker = value.find(_CURRICULUM_PREFIX)
    if marker < 0:
        return value, None
    tail = value[marker + len(_CURRICULUM_PREFIX):]
    unit_id = tail.split("__", 1)[0].strip()
    suffix = tail.split("__", 1)[1] if "__" in tail else ""
    clean = (value[:marker] + suffix).strip()
    return clean, unit_id or None


class CurriculumBackedSessionSerializer(SessionSerializer):
    """Legacy serializer kept compatible with databases that have curriculum_unit."""
    class Meta(SessionSerializer.Meta):
        fields = list(SessionSerializer.Meta.fields)
        read_only_fields = list(SessionSerializer.Meta.read_only_fields)


class ScopedQuizSerializer(QuizSerializer):
    assigned_classes = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta(QuizSerializer.Meta):
        fields = list(QuizSerializer.Meta.fields) + ["duration_seconds", "assigned_classes"]

    def get_duration_seconds(self, obj):
        return 30

    def get_assigned_classes(self, obj):
        return [
            {"id": str(row.school_class_id), "name": row.school_class.display_name, "grade": str(row.school_class.grade), "section": row.school_class.section}
            for row in obj.class_assignments.select_related("school_class").all()
        ]


# Keep canonical viewsets aware of the response contracts used by the portal.
SessionViewSet.serializer_class = CurriculumBackedSessionSerializer
QuizViewSet.serializer_class = ScopedQuizSerializer


class ContractSessionCompatViewSet(ContractSessionViewSet):
    """Keep legacy unlock working and bind each class occurrence to its curriculum unit."""

    serializer_class = CurriculumBackedSessionSerializer

    def map_in(self, data):
        payload = super().map_in(data)
        curriculum_id = data.get("curriculum_unit") or data.get("curriculum") or data.get("curriculum_unit_id")
        clean_notes, existing_id = _strip_curriculum_meta(data.get("notes", ""))
        curriculum_id = str(curriculum_id or existing_id or "").strip()
        if curriculum_id:
            payload["notes"] = f"{clean_notes} {_CURRICULUM_PREFIX}{curriculum_id}__".strip()
        else:
            payload["notes"] = clean_notes
        return payload

    def map_out(self, obj):
        payload = super().map_out(obj)
        clean_notes, curriculum_id = _strip_curriculum_meta(obj.notes)
        payload["notes"] = clean_notes
        payload["curriculum_unit"] = curriculum_id or ""
        return payload

    @action(detail=True, methods=["post", "put"], url_path="unlock")
    def unlock(self, request, pk=None):
        return super().unlock(request, pk=pk)
