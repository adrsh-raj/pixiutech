from django.db import transaction
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from academics.models import SchoolClass
from academics.services import accessible_class_queryset

from .course_completion_models import CurriculumUnitProfile, Technology
from .models import CurriculumClassAssignment, CurriculumUnit


class TrainerUnitListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def _require_role(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return Response({"detail": "Only an administrator or trainer can manage session units."}, status=403)
        return None

    def _serialize(self, unit):
        profile = getattr(unit, "completion_profile", None)
        return {
            "id": str(unit.id),
            "unit_number": unit.week.replace("Unit ", "", 1).strip() if str(unit.week or "").lower().startswith("unit ") else unit.unit_code,
            "unit_code": unit.unit_code,
            "title": unit.title,
            "topic": unit.topic or unit.title,
            "objectives": unit.objectives,
            "status": unit.status,
            "grade": unit.grade,
            "technology_id": str(profile.technology_id) if profile else None,
            "technology_name": profile.technology.name if profile and getattr(profile, "technology", None) else "",
        }

    def get(self, request):
        denied = self._require_role(request)
        if denied:
            return denied
        class_id = request.query_params.get("class_id")
        technology_id = request.query_params.get("technology") or request.query_params.get("technology_id")
        if not class_id or not technology_id:
            return Response({"detail": "class_id and technology are required."}, status=400)
        if not accessible_class_queryset(request.user).filter(pk=class_id).exists():
            return Response({"detail": "You cannot view units for this class."}, status=403)
        units = (
            CurriculumUnit.objects.filter(
                class_assignments__school_class_id=class_id,
                status__in=["draft", "published"],
            )
            .filter(Q(completion_profile__technology_id=technology_id) | Q(completion_profile__isnull=True))
            .select_related("completion_profile__technology")
            .distinct()
        )
        return Response([self._serialize(unit) for unit in units])

    @transaction.atomic
    def post(self, request):
        denied = self._require_role(request)
        if denied:
            return denied
        if request.user.role != UserRole.TRAINER:
            return Response({"detail": "This session-unit workflow is for trainers. Admin can manage master curriculum from Curriculum."}, status=403)

        class_id = request.data.get("school_class") or request.data.get("class_id")
        technology_id = request.data.get("technology") or request.data.get("technology_id")
        unit_number = str(request.data.get("unit_number") or "").strip()
        title = str(request.data.get("title") or request.data.get("topic") or "").strip()
        objectives = str(request.data.get("objectives") or "").strip()

        if not class_id or not technology_id or not unit_number or not title or not objectives:
            return Response({"detail": "Class, technology, unit number, title and objectives are required."}, status=400)
        if not unit_number.isdigit() or int(unit_number) <= 0:
            return Response({"unit_number": "Enter a positive unit number."}, status=400)
        school_class = SchoolClass.objects.filter(pk=class_id).select_related("school").first()
        if not school_class or not accessible_class_queryset(request.user).filter(pk=school_class.pk).exists():
            return Response({"school_class": "You cannot manage units for this class."}, status=403)
        technology = Technology.objects.filter(pk=technology_id, active=True).first()
        if not technology:
            return Response({"technology": "Select an active technology from the catalogue."}, status=400)

        existing = CurriculumUnit.objects.filter(
            grade=str(school_class.grade).strip().upper(),
            week__iexact=f"Unit {int(unit_number)}",
            completion_profile__technology=technology,
        ).first()
        if existing:
            unit = existing
        else:
            unit_code = f"{technology.code.upper()}-U{int(unit_number)}"
            unit = CurriculumUnit.objects.create(
                grade=school_class.grade,
                unit_code=unit_code,
                title=title,
                week=f"Unit {int(unit_number)}",
                topic=title,
                objectives=objectives,
                status="published",
                created_by=request.user,
            )
            CurriculumUnitProfile.objects.create(curriculum_unit=unit, technology=technology)

        CurriculumClassAssignment.objects.get_or_create(
            curriculum_unit=unit,
            school_class=school_class,
            defaults={"assigned_by": request.user},
        )
        return Response(self._serialize(unit), status=201)
