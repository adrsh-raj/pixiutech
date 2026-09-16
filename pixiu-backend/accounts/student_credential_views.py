from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from academics.services import accessible_student_queryset, reset_student_to_temp_pin
from accounts.models import StudentCredentialBatch, UserRole
from accounts.permissions import IsActiveAccount
from audit.services import record_audit

from .student_credential_batch import (
    credential_csv_response,
    credential_pdf_response,
    get_batch_filters,
    get_batch_rows,
    process_student_credential_batch,
    start_student_credential_batch,
)


class AdminStudentCredentialMigrationView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Only administrators can access student credential exports."}, status=status.HTTP_403_FORBIDDEN)
        batch = StudentCredentialBatch.objects.filter(
            created_by=request.user,
            status=StudentCredentialBatch.Status.COMPLETED,
        ).first()
        if not batch:
            return Response({"success": True, "available": False})
        schools, classes = get_batch_filters(batch)
        return Response({
            "success": True,
            "available": True,
            "batch_id": str(batch.id),
            "total_count": batch.total_count,
            "processed_count": batch.processed_count,
            "status": batch.status,
            "schools": schools,
            "classes": classes,
        })

    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Only administrators can migrate student credentials."}, status=status.HTTP_403_FORBIDDEN)
        if request.data.get("confirm") != "RESET_ALL_STUDENT_CREDENTIALS":
            return Response({"detail": "Confirmation phrase is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            batch = start_student_credential_batch(request.user)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": True, "batch_id": str(batch.id), "total_count": batch.total_count, "processed_count": batch.processed_count, "status": batch.status})


class AdminStudentCredentialMigrationProcessView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request, batch_id):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Only administrators can process credential migration."}, status=status.HTTP_403_FORBIDDEN)
        batch = get_object_or_404(StudentCredentialBatch, id=batch_id, created_by=request.user)
        try:
            _, complete, batch = process_student_credential_batch(batch)
        except Exception as exc:
            StudentCredentialBatch.objects.filter(pk=batch.pk).update(status=StudentCredentialBatch.Status.FAILED, error=str(exc))
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {
            "success": True,
            "batch_id": str(batch.id),
            "processed_count": batch.processed_count,
            "total_count": batch.total_count,
            "status": batch.status,
            "complete": complete,
        }
        if complete:
            schools, classes = get_batch_filters(batch)
            payload.update({"schools": schools, "classes": classes})
            try:
                record_audit(actor=request.user, action="password_reset", entity_type="student_credentials", summary=f"Bulk student temporary PIN migration completed for {batch.total_count} active students", request=request, changes={"count": batch.total_count})
            except Exception:
                pass
        return Response(payload)


class AdminStudentCredentialExportView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request, batch_id, export_format):
        if request.user.role != UserRole.ADMIN:
            return Response({"detail": "Only administrators can export student credentials."}, status=status.HTTP_403_FORBIDDEN)
        batch = get_object_or_404(
            StudentCredentialBatch,
            id=batch_id,
            created_by=request.user,
            status=StudentCredentialBatch.Status.COMPLETED,
        )
        school_code = str(request.data.get("school_code", "")).strip()
        class_name = str(request.data.get("class_name", "")).strip()
        rows = get_batch_rows(batch)
        filtered = [
            row for row in rows
            if (not school_code or row.get("school_code") == school_code)
            and (not class_name or row.get("class_name") == class_name)
        ]
        if not filtered:
            return Response({"detail": "No students match the selected filters."}, status=status.HTTP_400_BAD_REQUEST)
        if export_format == "pdf":
            return credential_pdf_response(rows, school_code, class_name)
        if export_format == "csv":
            filename = f"pixiu-student-credentials-{school_code or 'all'}-{class_name or 'all'}.csv".replace(" ", "-")
            return credential_csv_response(filtered, filename=filename)
        return Response({"detail": "Unsupported export format."}, status=status.HTTP_400_BAD_REQUEST)


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
        record_audit(actor=request.user, action="password_reset", entity_type="student", entity_id=student.id, summary=f"Temporary PIN reset for student {student.student_id}", changes={"username": student.account.username, "temporary_pin_issued": True}, request=request)
        return Response({"success": True, "student_id": student.student_id, "username": student.account.username, "temporary_pin": pin, "must_change_password": True, "detail": "Temporary PIN generated. Give it directly to the student."})
