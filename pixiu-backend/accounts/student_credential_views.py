from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from academics.models import Student
from academics.services import accessible_student_queryset, reset_student_to_temp_pin
from accounts.models import UserRole
from accounts.permissions import IsActiveAccount
from audit.services import record_audit

from .student_credentials import credential_csv_response, migrate_student_credentials


class AdminStudentCredentialMigrationView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Only administrators can migrate student credentials."}, status=status.HTTP_403_FORBIDDEN)
        if request.data.get("confirm") != "RESET_ALL_STUDENT_CREDENTIALS":
            return Response({"detail": "Confirmation phrase is required."}, status=status.HTTP_400_BAD_REQUEST)

        rows = migrate_student_credentials()
        try:
            record_audit(
                actor=request.user,
                action="password_reset",
                entity_type="student_credentials",
                summary=f"Bulk student temporary PIN migration generated for {len(rows)} active students",
                request=request,
                changes={"count": len(rows)},
            )
        except Exception:
            pass
        return credential_csv_response(rows)


class StudentTemporaryPasswordResetView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request, pk):
        queryset = accessible_student_queryset(request.user)
        student = get_object_or_404(queryset, pk=pk)
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return Response({"detail": "Only an administrator or assigned trainer can reset a student password."}, status=status.HTTP_403_FORBIDDEN)
        if not student.account_id:
            return Response({"detail": "Student does not have a linked login account."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pin = reset_student_to_temp_pin(student)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record_audit(
            actor=request.user,
            action="password_reset",
            entity_type="student",
            entity_id=student.id,
            summary=f"Temporary PIN reset for student {student.student_id}",
            changes={"username": student.account.username, "temporary_pin_issued": True},
            request=request,
        )
        return Response({
            "success": True,
            "student_id": student.student_id,
            "username": student.account.username,
            "temporary_pin": pin,
            "must_change_password": True,
            "detail": "Temporary PIN generated. Give it directly to the student.",
        })


def migrate_student_credentials():
    from .student_credentials import migrate_student_credentials as _migrate
    return _migrate()
