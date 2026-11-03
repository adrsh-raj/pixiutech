import json
from uuid import UUID

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.models import Student
from academics.services import accessible_class_queryset
from .models import VirtualLabAssignment, VirtualLabProgress


MANAGER_ROLES = {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}
MAX_PROGRESS_BYTES = 64 * 1024


def _safe_payload(data):
    if not isinstance(data, dict):
        raise ValidationError("A JSON object is required.")
    try:
        encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    except (TypeError, ValueError):
        raise ValidationError("Progress must contain valid JSON data.")
    if len(encoded.encode("utf-8")) > MAX_PROGRESS_BYTES:
        raise ValidationError("Progress payload exceeds the 64 KB limit.")
    return encoded


def _assignment_data(assignment, user):
    result = {
        "id": str(assignment.id),
        "class_id": str(assignment.school_class_id),
        "class_name": assignment.school_class.display_name or (assignment.school_class.grade + " " + assignment.school_class.section),
        "lesson_id": assignment.lesson_id,
        "title": assignment.title,
        "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
        "created_at": assignment.created_at.isoformat(),
        "published": assignment.published,
    }
    if user.role == UserRole.STUDENT:
        progress = assignment.progress_records.filter(student__account_id=user.id).first()
        result["my_progress"] = _progress_data(progress, include_snapshot=True) if progress else None
    else:
        result["submissions"] = [
            _progress_data(progress, include_student=True)
            for progress in assignment.progress_records.select_related("student").all()
        ]
    return result


def _progress_data(progress, include_snapshot=False, include_student=False):
    result = {
        "id": str(progress.id),
        "status": progress.status,
        "completed_step_ids": progress.completed_step_ids,
        "result_summary": progress.result_summary,
        "reflection": progress.reflection,
        "feedback": progress.feedback,
        "submitted_at": progress.submitted_at.isoformat() if progress.submitted_at else None,
        "reviewed_at": progress.reviewed_at.isoformat() if progress.reviewed_at else None,
        "updated_at": progress.updated_at.isoformat(),
    }
    if include_snapshot:
        result["snapshot"] = progress.snapshot
    if include_student:
        result["student"] = {
            "id": str(progress.student_id),
            "name": progress.student.name,
            "roll_number": progress.student.roll_number,
        }
    return result


class VirtualLabAssignmentsView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]

    def initial(self, request, *args, **kwargs):
        self.required_action = "CREATE" if request.method == "POST" else "VIEW"
        super().initial(request, *args, **kwargs)

    def get(self, request):
        if request.user.role not in MANAGER_ROLES | {UserRole.STUDENT}:
            raise PermissionDenied("Your role cannot access Virtual Lab assignments.")
        classes = accessible_class_queryset(request.user)
        queryset = VirtualLabAssignment.objects.select_related("school_class").prefetch_related(
            "progress_records__student"
        ).filter(school_class_id__in=classes.values("id"))
        if request.user.role == UserRole.STUDENT:
            queryset = queryset.filter(published=True)
        queryset = queryset[:100]
        return Response({"assignments": [_assignment_data(item, request.user) for item in queryset]})

    def post(self, request):
        if request.user.role not in MANAGER_ROLES:
            raise PermissionDenied("Only school staff can assign a Virtual Lab mission.")
        class_id = str(request.data.get("school_class", "")).strip()
        lesson_id = str(request.data.get("lesson_id", "")).strip()
        title = str(request.data.get("title", "")).strip()
        try:
            class_uuid = UUID(class_id)
        except (ValueError, TypeError):
            raise ValidationError({"school_class": "Select an available class."})
        if not accessible_class_queryset(request.user).filter(pk=class_uuid, status="active").exists():
            raise PermissionDenied("You cannot assign work to this class.")
        if not lesson_id or len(lesson_id) > 120 or any(not (char.isalnum() or char in "-_") for char in lesson_id):
            raise ValidationError({"lesson_id": "Choose a valid Virtual Lab mission."})
        if not title or len(title) > 200:
            raise ValidationError({"title": "A title of up to 200 characters is required."})
        due_raw = str(request.data.get("due_date", "") or "").strip()
        due_date = parse_date(due_raw) if due_raw else None
        if due_raw and due_date is None:
            raise ValidationError({"due_date": "Use YYYY-MM-DD format."})
        assignment = VirtualLabAssignment.objects.create(
            school_class_id=class_uuid,
            lesson_id=lesson_id,
            title=title,
            due_date=due_date,
            assigned_by=request.user,
            published=True,
        )
        assignment = VirtualLabAssignment.objects.select_related("school_class").get(pk=assignment.pk)
        return Response(_assignment_data(assignment, request.user), status=status.HTTP_201_CREATED)


class VirtualLabProgressView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]

    def initial(self, request, *args, **kwargs):
        self.required_action = "GRADE" if request.method == "POST" and kwargs.get("action") == "review" else "CREATE"
        super().initial(request, *args, **kwargs)

    @transaction.atomic
    def post(self, request, assignment_id, action):
        if action == "review":
            return self.review(request, assignment_id)
        if action not in {"progress", "submit"}:
            raise ValidationError("Unknown Virtual Lab action.")
        if request.user.role != UserRole.STUDENT:
            raise PermissionDenied("Only the assigned student can update this mission.")
        student = get_object_or_404(Student.objects.select_related("school_class"), account_id=request.user.id)
        assignment = get_object_or_404(
            VirtualLabAssignment.objects.select_related("school_class"),
            pk=assignment_id,
            school_class_id=student.school_class_id,
            published=True,
        )
        payload = request.data
        _safe_payload(payload)
        current = VirtualLabProgress.objects.select_for_update().filter(assignment=assignment, student=student).first()
        if current and current.status in {VirtualLabProgress.Status.SUBMITTED, VirtualLabProgress.Status.REVIEWED}:
            if action == "progress":
                return Response(_progress_data(current, include_snapshot=True), status=status.HTTP_200_OK)
            raise ValidationError("This submission is locked while it is awaiting or has completed teacher review.")
        completed = payload.get("completed_step_ids", [])
        if not isinstance(completed, list) or len(completed) > 100 or any(not isinstance(item, str) or len(item) > 120 for item in completed):
            raise ValidationError({"completed_step_ids": "Provide up to 100 valid step IDs."})
        snapshot = payload.get("snapshot", {})
        summary = payload.get("result_summary", {})
        if not isinstance(snapshot, dict) or not isinstance(summary, dict):
            raise ValidationError("Snapshot and result summary must be JSON objects.")
        reflection = str(payload.get("reflection", "") or "").strip()
        if len(reflection) > 1000:
            raise ValidationError({"reflection": "Reflection must be 1,000 characters or fewer."})
        progress, _ = VirtualLabProgress.objects.update_or_create(
            assignment=assignment,
            student=student,
            defaults={
                "status": VirtualLabProgress.Status.IN_PROGRESS,
                "completed_step_ids": completed,
                "snapshot": snapshot,
                "result_summary": summary,
                "reflection": reflection,
            },
        )
        if action == "submit":
            if not completed or summary.get("completion_percent") != 100:
                raise ValidationError("Complete every mission step before submitting.")
            progress.status = VirtualLabProgress.Status.SUBMITTED
            progress.submitted_at = timezone.now()
            progress.save(update_fields=["status", "submitted_at", "updated_at"])
        return Response(_progress_data(progress, include_snapshot=True), status=status.HTTP_200_OK)

    @transaction.atomic
    def review(self, request, assignment_id):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            raise PermissionDenied("Only trainers or administrators can review a Virtual Lab submission.")
        assignment = get_object_or_404(
            VirtualLabAssignment.objects.select_related("school_class"),
            pk=assignment_id,
        )
        if not accessible_class_queryset(request.user).filter(pk=assignment.school_class_id).exists():
            raise PermissionDenied("You cannot review work from this class.")
        payload = request.data
        _safe_payload(payload)
        try:
            progress_uuid = UUID(str(payload.get("progress_id", "")).strip())
        except (ValueError, TypeError):
            raise ValidationError({"progress_id": "Select a valid student submission."})
        progress = get_object_or_404(
            VirtualLabProgress.objects.select_related("student"),
            pk=progress_uuid,
            assignment=assignment,
            status=VirtualLabProgress.Status.SUBMITTED,
        )
        feedback = str(payload.get("feedback", "") or "").strip()
        if len(feedback) > 1000:
            raise ValidationError({"feedback": "Feedback must be 1,000 characters or fewer."})
        progress.status = VirtualLabProgress.Status.REVIEWED
        progress.feedback = feedback
        progress.reviewed_by = request.user
        progress.reviewed_at = timezone.now()
        progress.save(update_fields=["status", "feedback", "reviewed_by", "reviewed_at", "updated_at"])
        return Response(_progress_data(progress, include_student=True))
