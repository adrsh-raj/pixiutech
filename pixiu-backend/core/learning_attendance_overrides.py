from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import Student
from learning.models import Session
from learning.services import admin_override_attendance, complete_session, save_attendance_batch
from learning.serializers import AttendanceRecordSerializer, SessionSerializer
from .api_v1_compat import ContractAttendanceViewSet, _first, _student


class StableAttendanceViewSet(ContractAttendanceViewSet):
    @action(detail=False, methods=["post"], url_path="bulk-complete")
    def bulk_complete(self, request):
        self.required_action = "EDIT"
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        session_id = _first(request.data, "session", "session_id")
        session = Session.objects.filter(pk=session_id).first()
        if not session:
            raise ValidationError({"session": "Session does not exist."})
        with transaction.atomic():
            save_attendance_batch(user=request.user, session=session, entries=request.data.get("entries", []))
            completed = complete_session(user=request.user, session=session)
        return Response(SessionSerializer(completed, context={"request": request}).data)

    @action(detail=False, methods=["put"], url_path="admin-override")
    def admin_override(self, request):
        self.required_action = "EDIT"
        self.role_only(UserRole.ADMIN)
        session = Session.objects.filter(pk=_first(request.data, "session", "session_id")).first()
        student = _student(_first(request.data, "student", "student_id"))
        if not session or not student:
            raise ValidationError("Session and student are required.")
        record = admin_override_attendance(
            user=request.user,
            session=session,
            student=student,
            status=str(_first(request.data, "status", default="absent")).lower(),
            note=str(_first(request.data, "note", default="")),
        )
        return Response(AttendanceRecordSerializer(record, context={"request": request}).data)
