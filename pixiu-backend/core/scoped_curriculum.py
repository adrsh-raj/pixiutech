from django.db import transaction
from rest_framework.exceptions import ValidationError

from accounts.models import UserRole
from academics.services import accessible_class_queryset
from learning.course_completion_models import CurriculumUnitProfile, Technology
from learning.models import CurriculumClassAssignment, CurriculumUnit
from learning.services import accessible_curriculum
from .scoped_contract_views import ScopedContractCurriculumViewSet


class ScopedCurriculumViewSet(ScopedContractCurriculumViewSet):
    """Class-scoped curriculum endpoint using the current curriculum contract."""

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
        """Normalize current fields without inventing missing values on PATCH."""
        is_partial = str(getattr(self.request, "method", "")).upper() == "PATCH"
        level_value = str(data.get("level") or data.get("unit_level") or "").strip()
        if not is_partial and not level_value:
            raise ValidationError({"level": "Level is required. Enter the level manually for this unit."})
        if is_partial and ("level" in data or "unit_level" in data) and not level_value:
            raise ValidationError({"level": "Level is required. Enter the level manually for this unit."})

        payload = dict(data)
        for key in ("level", "unit_level", "school_class", "class_id", "technology", "technology_id"):
            payload.pop(key, None)
        grade_value = data.get("grade") or data.get("class_grade")
        unit_code_value = data.get("unit_code")
        week_value = data.get("week")
        topic_value = data.get("topic") or data.get("title")
        objectives_value = data.get("objectives")
        status_value = data.get("status")

        if grade_value not in (None, ""):
            payload["grade"] = str(grade_value).strip()
        elif not is_partial:
            payload["grade"] = ""

        if unit_code_value not in (None, ""):
            payload["unit_code"] = str(unit_code_value).strip().upper()
        elif not is_partial:
            week_text = str(week_value or "").strip()
            digits = __import__("re").search(r"(\d+)", week_text)
            unit_number = digits.group(1) if digits else "1"
            payload["unit_code"] = f"U{unit_number}"

        if week_value not in (None, ""):
            payload["week"] = str(week_value).strip()
        elif not is_partial:
            payload["week"] = f"Unit {str(payload.get('unit_code', 'U1')).lstrip('U')}"

        if topic_value not in (None, ""):
            payload["topic"] = str(topic_value).strip()
            payload["title"] = str(data.get("title") or topic_value).strip()
        elif not is_partial:
            topic = str(week_value or "").strip() or f"Unit {str(payload.get('unit_code', 'U1')).lstrip('U')}"
            payload["topic"] = topic
            payload["title"] = topic

        if objectives_value not in (None, ""):
            payload["objectives"] = str(objectives_value).strip()
        elif objectives_value == "" and not is_partial:
            payload["objectives"] = ""

        if status_value not in (None, ""):
            status_map = {
                "upcoming": "draft",
                "untaught": "draft",
                "draft": "draft",
                "completed": "published",
                "taught": "published",
                "published": "published",
                "archived": "archived",
            }
            normalized = str(status_value).strip().lower()
            payload["status"] = status_map.get(normalized, normalized)
        elif not is_partial:
            payload["status"] = "published"

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
    def _save_and_assign(self, validated_data, existing_unit=None):
        if existing_unit is not None:
            unit = existing_unit
            grade = str(unit.grade).strip()
            unit_code = str(unit.unit_code).strip().upper()
        else:
            grade = str(validated_data.get("grade") or "").strip()
            unit_code = str(validated_data.get("unit_code") or "").strip().upper()
            if not grade or not unit_code:
                raise ValidationError({"unit_code": "Grade and unit code are required."})
            unit = CurriculumUnit.objects.filter(grade=grade, unit_code=unit_code).first()

        target_class = self._target_class(unit)
        technology = self._technology(unit)
        if unit is None and technology is None:
            raise ValidationError({"technology_id": "Technology is required when creating a curriculum unit."})

        if unit is None:
            unit = CurriculumUnit.objects.create(created_by=self.request.user, **validated_data)
        else:
            update_fields = []
            for field in ("title", "week", "topic", "objectives", "status"):
                if field in validated_data:
                    setattr(unit, field, validated_data[field])
                    update_fields.append(field)
            if update_fields:
                update_fields.append("updated_at")
                unit.save(update_fields=update_fields)

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
        unit = self._save_and_assign(dict(serializer.validated_data), existing_unit=serializer.instance)
        serializer.instance = unit
