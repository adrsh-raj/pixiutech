from rest_framework.exceptions import ValidationError

from academics.models import SchoolClass
from academics.services import accessible_class_queryset
from learning.models import CurriculumClassAssignment, CurriculumUnit
from .strict_learning_scope_views import SafeScopedCurriculumViewSet


class ScopedCurriculumViewSet(SafeScopedCurriculumViewSet):
    """Curriculum is shared as a master unit but assigned explicitly to real classes."""

    def get_queryset(self):
        qs = super().get_queryset()
        school_class = self.request.query_params.get("school_class") or self.request.query_params.get("class_id")
        school = self.request.query_params.get("school") or self.request.query_params.get("school_id")
        if school_class:
            if not accessible_class_queryset(self.request.user).filter(pk=school_class).exists():
                return qs.none()
            return qs.filter(class_assignments__school_class_id=school_class).distinct()
        if school:
            return qs.filter(class_assignments__school_class__school_id=school).distinct()
        return qs

    def scoped_queryset(self):
        return self.get_queryset()

    def _target_class(self, unit=None):
        raw = self.request.data.get("school_class") or self.request.data.get("class_id")
        if not raw and unit is not None:
            raw = (
                CurriculumClassAssignment.objects
                .filter(
                    curriculum_unit=unit,
                    school_class_id__in=accessible_class_queryset(self.request.user).values("id"),
                )
                .values_list("school_class_id", flat=True)
                .first()
            )
        if not raw:
            raise ValidationError({"school_class": "Select the school/class for this curriculum unit."})
        school_class = accessible_class_queryset(self.request.user).filter(pk=raw).first()
        if not school_class:
            raise ValidationError({"school_class": "Selected school/class is outside your authorised scope."})
        return school_class

    def map_out(self, obj):
        payload = super().map_out(obj)
        assignments = (
            obj.class_assignments
            .select_related("school_class__school")
            .filter(school_class_id__in=accessible_class_queryset(self.request.user).values("id"))
            .order_by("school_class__school__name", "school_class__grade", "school_class__section")
        )
        payload["assigned_classes"] = [
            {
                "id": str(item.school_class_id),
                "display_name": item.school_class.display_name,
                "grade": str(item.school_class.grade),
                "section": item.school_class.section,
                "school_id": str(item.school_class.school_id),
                "school_code": item.school_class.school.school_code,
                "school_name": item.school_class.school.name,
            }
            for item in assignments
        ]
        return payload

    def _save_and_assign(self, validated_data):
        grade = str(validated_data.get("grade") or "").strip()
        unit_code = str(validated_data.get("unit_code") or "").strip().upper()
        if not grade or not unit_code:
            raise ValidationError({"unit_code": "Grade and unit code are required."})

        existing = CurriculumUnit.objects.filter(grade=grade, unit_code=unit_code).first()
        if existing is None:
            unit = CurriculumUnit.objects.create(created_by=self.request.user, **validated_data)
        else:
            for field in ("level", "title", "week", "topic", "objectives", "status"):
                if field in validated_data:
                    setattr(existing, field, validated_data[field])
            existing.save(update_fields=["level", "title", "week", "topic", "objectives", "status", "updated_at"])
            unit = existing

        target_class = self._target_class(existing if existing is not None else unit)
        if str(target_class.grade).strip() != grade:
            raise ValidationError({"school_class": "Selected class grade must match the curriculum grade."})
        CurriculumClassAssignment.objects.get_or_create(
            curriculum_unit=unit,
            school_class=target_class,
            defaults={"assigned_by": self.request.user},
        )
        return unit

    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        unit = self._save_and_assign(serializer.validated_data)
        serializer.instance = unit

    def perform_update(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        data = dict(serializer.validated_data)
        data["grade"] = serializer.instance.grade
        data["unit_code"] = serializer.instance.unit_code
        unit = self._save_and_assign(data)
        serializer.instance = unit
