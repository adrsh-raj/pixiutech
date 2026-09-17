from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_student_queryset
from learning import course_completion_final as service


class ClassEvaluationView(APIView):
    """Server-authoritative class-wide evaluation and re-evaluation endpoint."""

    permission_classes = [IsAuthenticated]

    def _class(self, request, class_key):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            raise PermissionError("Only authorised trainers or administrators can evaluate a class.")
        return get_object_or_404(accessible_class_queryset(request.user), pk=class_key)

    def get(self, request, class_key):
        try:
            school_class = self._class(request, class_key)
            return Response(service.class_evaluation_data(school_class, persist=False))
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=403)

    def post(self, request, class_key):
        try:
            school_class = self._class(request, class_key)
            current = service.class_evaluation_data(school_class, persist=False)
            confirmed = bool(request.data.get("confirm"))
            if not current["all_evaluated"] and not confirmed:
                pending = current.get("pending_students", [])
                names = ", ".join(item["student_name"] for item in pending[:10])
                suffix = "" if len(pending) <= 10 else f" and {len(pending) - 10} more"
                return Response(
                    {
                        "requires_confirmation": True,
                        "detail": "Not all active students in this class have been fully evaluated.",
                        "warning": f"Pending students: {names}{suffix}. Continuing will evaluate/re-evaluate every active student in the class. Students below 70% will be marked Not Passed.",
                        "pending_students": pending,
                        "class_size": current["class_size"],
                    },
                    status=409,
                )
            data = service.class_evaluation_data(school_class, persist=True, evaluator=request.user)
            return Response(data)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=403)


class StudentProgressReportDataView(APIView):
    """Return the same server-side completion data used for evaluation/certificates."""

    permission_classes = [IsAuthenticated]
    allowed_roles = {UserRole.ADMIN, UserRole.TRAINER, UserRole.SCHOOL}

    def get(self, request, student_key):
        if request.user.role not in self.allowed_roles:
            return Response({"detail": "This report is not available for the current account role."}, status=403)
        qs = accessible_student_queryset(request.user).select_related('school_class__school')
        raw = str(student_key or '').strip()
        student = None
        try:
            student = qs.filter(pk=UUID(raw)).first()
        except (ValueError, TypeError, AttributeError):
            pass
        if student is None:
            student = get_object_or_404(qs, student_id__iexact=raw)
        return Response(service.student_report_data(student))
