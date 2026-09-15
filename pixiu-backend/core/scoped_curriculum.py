from django.db import transaction
from rest_framework.exceptions import ValidationError

from accounts.models import UserRole
from academics.services import accessible_class_queryset
from learning.course_completion_models import CurriculumUnitProfile, Technology
from learning.models import CurriculumClassAssignment, CurriculumUnit
from learning.services import accessible_curriculum
from .scoped_contract_views import ScopedContractCurriculumViewSet


class ScopedCurriculumViewSet(ScopedContractCurriculumViewSet):
    """Master curriculum units assigned explicitly to real classes.

    This endpoint is deliberately based on the current scoped contract, not the
    legacy SafeScopedCurriculumViewSet, whose map_in still enforced the retired
    `level` field.  That legacy validator was the source of the recurring
    `Request validation failed` error on edit/publish.
    """

    def get_queryset(self):
        qs = accessible_curriculum(self.request.user)
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

    def map_in(self, data):
        """Normalize the current curriculum contract; `level` is retired."""
        payload = dict(data)
        payload.pop("level", None)
        payload.pop("unit_level", None)
        payload.pop("school_class", None)
        payload.pop("class_id", None)
        payload.pop("technology", None)
        payload.pop("technology_id", None)

        grade = str(data.get("grade") or data.get("class_grade") or "").strip()
        week = str(data.get("week") or "").strip()
        topic = str(data.get("topic") or data.get("title") or "").strip()
        objectives = str(data.get("objectives") or "").strip()
        unit_code = str(data.get("unit_code") or "").strip().upper()
        if not unit_code:
            unit_number = next((part for part in week.replace("-", " ").split() if part.isdigit()), "1")
            unit_code = f"U{unit_number}"
        if not topic:
            topic = week or f"Unit {unit_code.lstrip('U')}"
        status = str(data.get("status") or "draft").strip().lower()
        status_map = {
            "upcoming": "draft",
            "untaught": "draft",
            "draft": "draft",
            "completed": "published",
            "taught": "published",
            "published": "published",
            "archived": "archived",
        }
        payload.update({
            "grade": grade,
            "unit_code": unit_code,
            "title": str(data.get("title") or topic).strip(),
            "week": week or f"Unit {unit_code.lstrip('U')}",
            "topic": topic,
            "objectives": objectives,
            "status": status_map.get(status, "draft"),
        })
        return payload

    def _target_class(self, unit=None):
        raw = self.request.data.get("school_class") or self.request.data.get("class_id")
        if not raw and unit is not None:
            raw = (
                CurriculumClassAssignment.objects.filter(
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

    def _technology(self, unit=None):
        raw = self.request.data.get("technology_id") or self.request.data.get("technology")
        if raw:
            technology = Technology.objects.filter(pk=raw, active=True).first()
            if technology is None:
                raise ValidationError({"technology_id": "Select a valid active technology."})
            return technology
        if unit is not None:
            profile = getattr(unit, "completion_profile", None)
            if profile and profile.technology_id:
                return profile.technology
        return None

    def map_out(self, obj):
        payload = super().map_out(obj)
        payload.pop("level", None)
        payload.pop("unit_level", None)
        assignments = (
            obj.class_assignments.select_related("school_class__school")
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
        profile = getattr(obj, "completion_profile", None)
        technology = getattr(profile, "technology", None) if profile else None
        payload["technology"] = (
            {"id": str(technology.id), "code": technology.code, "name": technology.name}
            if technology else None
        )
        return payload

    @transaction.atomic
    def _save_and_assign(self, validated_data):
        grade = str(validated_data.get("grade") or "").strip()
        unit_code = str(validated_data.get("unit_code") or "").strip().upper()
        if not grade or not unit_code:
            raise ValidationError({"unit_code": "Grade and unit code are required."})

        existing = CurriculumUnit.objects.filter(grade=grade, unit_code=unit_code).first()
        target_class = self._target_class(existing)
        technology = self._technology(existing)
        if existing is None and technology is None:
            raise ValidationError({"technology_id": "Technology is required when creating a curriculum unit."})

        if existing is None:
            unit = CurriculumUnit.objects.create(created_by=self.request.user, **validated_data)
        else:
            for field in ("title", "week", "topic", "objectives", "status"):
                if field in validated_data:
                    setattr(existing, field, validated_data[field])
            existing.save(update_fields=["title", "week", "topic", "objectives", "status", "updated_at"])
            unit = existing

        if str(target_class.grade).strip() != grade:
            raise ValidationError({"school_class": "Selected class grade must match the curriculum grade."})

        if technology is not None:
            CurriculumUnitProfile.objects.update_or_create(
                curriculum_unit=unit,
                defaults={"technology": technology},
            )

        CurriculumClassAssignment.objects.get_or_create(
            curriculum_unit=unit,
            school_class=target_class,
            defaults={"assigned_by": self.request.user},
        )
        return unit

    def perform_create(self, serializer):
        if self.request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise ValidationError({"detail": "You do not have permission to manage curriculum."})
        unit = self._save_and_assign(serializer.validated_data)
        serializer.instance = unit

    def perform_update(self, serializer):
        if self.request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise ValidationError({"detail": "You do not have permission to manage curriculum."})
        data = dict(serializer.validated_data)
        data["grade"] = serializer.instance.grade
        data["unit_code"] = serializer.instance.unit_code
        unit = self._save_and_assign(data)
        serializer.instance = unit
