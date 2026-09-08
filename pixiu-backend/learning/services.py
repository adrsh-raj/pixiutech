from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import UserRole
from academics.models import Student
from academics.services import accessible_class_queryset, accessible_student_queryset
from audit.services import record_audit

from .models import (
    AttendanceRecord, AttendanceStatus, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    Session, SessionActivity, StudentAssessment,
)


def assigned_class_ids(user):
    return accessible_class_queryset(user).values("id")


def ensure_class_access(user, school_class):
    if not accessible_class_queryset(user).filter(pk=school_class.pk).exists():
        raise PermissionDenied("You do not have access to this class.")


def ensure_student_access(user, student):
    if not accessible_student_queryset(user).filter(pk=student.pk).exists():
        raise PermissionDenied("You do not have access to this student.")


def _safe_completion_time(start_time):
    now = timezone.localtime().time().replace(microsecond=0)
    if start_time is None:
        return now
    minimum = (datetime.combine(datetime.min.date(), start_time) + timedelta(minutes=1)).time()
    return max(now, minimum)


@transaction.atomic
def start_session(*, user, session: Session):
    locked = Session.objects.select_for_update().select_related("school_class", "trainer").get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked.status != "planned":
        raise ValidationError("Only planned sessions can be started.")
    if locked.trainer.account_id != user.id and user.role not in {UserRole.ADMIN, UserRole.SCHOOL}:
        raise PermissionDenied("A trainer can only start their own session.")
    if user.role == UserRole.TRAINER and not locked.trainer.school_assignments.filter(school_id=locked.school_class.school_id, status="active").exists():
        raise PermissionDenied("Trainer is not currently assigned to this school.")
    locked.status = "in_progress"
    locked.save(update_fields=["status", "updated_at"])
    return locked


@transaction.atomic
def complete_session(*, user, session: Session):
    locked = Session.objects.select_for_update().get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked.status != "in_progress":
        raise ValidationError("Only in-progress sessions can be completed.")
    locked.status = "completed"
    locked.is_locked = True
    if locked.end_time is None or (locked.start_time and locked.end_time <= locked.start_time):
        locked.end_time = _safe_completion_time(locked.start_time)
    locked.save(update_fields=["status", "is_locked", "end_time", "updated_at"])
    return locked


@transaction.atomic
def create_session_activity(*, user, session: Session, title: str, activity_type="lesson", notes=""):
    if not accessible_sessions(user).filter(pk=session.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if session.is_locked or session.status in {"completed", "cancelled"}:
        raise ValidationError("Locked or completed sessions cannot be changed.")
    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "Activity title is required."})
    return SessionActivity.objects.create(session=session, title=title, activity_type=(activity_type or "lesson").strip().lower(), notes=(notes or "").strip(), created_by=user)


@transaction.atomic
def create_attendance(*, user, session: Session, student: Student, status: str, note=""):
    locked_session = Session.objects.select_for_update().select_related("school_class__school", "trainer").get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked_session.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked_session.is_locked or locked_session.status in {"completed", "cancelled"}:
        raise ValidationError("Attendance is locked for this session.")
    if locked_session.status not in {"in_progress", "planned"}:
        raise ValidationError("Attendance cannot be recorded for this session.")
    if not accessible_student_queryset(user).filter(pk=student.pk).exists():
        raise PermissionDenied("You do not have access to this student.")
    if student.school_class_id != locked_session.school_class_id:
        raise ValidationError("Student does not belong to the session class.")
    status = (status or "").strip().lower()
    valid_statuses = {choice for choice, _ in AttendanceStatus.choices}
    if status not in valid_statuses:
        raise ValidationError({"status": "Invalid attendance status."})
    attendance, _ = AttendanceRecord.objects.update_or_create(
        session=locked_session,
        student=student,
        defaults={"status": status, "note": (note or "").strip()},
    )
    return attendance
