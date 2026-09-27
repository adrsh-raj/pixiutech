from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
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


def trainer_currently_assigned_to_school(user, school_id):
    if user.role != UserRole.TRAINER:
        return False
    trainer = getattr(user, "trainer_profile", None)
    if trainer is None:
        return False
    today = timezone.localdate()
    return trainer.school_assignments.filter(
        school_id=school_id,
        status="active",
        assigned_from__lte=today,
    ).filter(
        Q(assigned_to__isnull=True) | Q(assigned_to__gte=today)
    ).exists()


def ensure_trainer_session_mutation_access(user, session):
    if user.role != UserRole.TRAINER:
        return
    if session.trainer.account_id != user.id:
        raise PermissionDenied("A trainer can only manage their own sessions.")
    if not trainer_currently_assigned_to_school(user, session.school_class.school_id):
        raise PermissionDenied("Trainer is not currently assigned to this school.")


def accessible_sessions(user):
    qs = Session.objects.select_related("school_class__school", "trainer", "created_by").prefetch_related("activities")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.SCHOOL:
        return qs.filter(school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(trainer__account_id=user.id)
    if user.role == UserRole.STUDENT:
        return qs.filter(school_class__students__account_id=user.id).distinct()
    return qs.none()


def accessible_attendance(user):
    qs = AttendanceRecord.objects.select_related(
        "session__school_class__school", "session__trainer", "student", "marked_by"
    )
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.SCHOOL:
        return qs.filter(session__school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(session__trainer__account_id=user.id)
    if user.role == UserRole.STUDENT:
        return qs.filter(student__account_id=user.id)
    return qs.none()


def accessible_curriculum(user):
    qs = CurriculumUnit.objects.select_related("created_by")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(status="published", class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    if user.role in {UserRole.SCHOOL, UserRole.TRAINER}:
        return qs.filter(class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    return qs.none()


def accessible_content(user):
    qs = LearningContent.objects.select_related("created_by")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(status="published", target_role__in=["student", "student_trainer", "all"], class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    if user.role == UserRole.TRAINER:
        return qs.filter(target_role__in=["student", "trainer", "student_trainer", "all"], class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    if user.role == UserRole.SCHOOL:
        return qs.filter(target_role__in=["school", "all"], class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    return qs.none()


def accessible_quizzes(user):
    qs = Quiz.objects.select_related("created_by").prefetch_related("questions")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(status="active", class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    if user.role == UserRole.TRAINER:
        return qs.filter(Q(created_by_id=user.id) | Q(class_assignments__school_class_id__in=assigned_class_ids(user))).distinct()
    if user.role == UserRole.SCHOOL:
        return qs.filter(class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    return qs.none()


def accessible_attempts(user):
    qs = QuizAttempt.objects.select_related("quiz", "student")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(student__account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(student__school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(student__school_class_id__in=assigned_class_ids(user))
    return qs.none()


def accessible_assessments(user):
    qs = StudentAssessment.objects.select_related("student", "trainer")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(student__account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(student__school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(trainer__account_id=user.id)
    return qs.none()


def accessible_projects(user):
    qs = Project.objects.select_related("student__school_class__school").prefetch_related("evidence")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(student__account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(student__school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(student__school_class_id__in=assigned_class_ids(user))
    return qs.none()


def accessible_evidence(user):
    qs = ProjectEvidence.objects.select_related("project__student", "uploaded_by")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(project__student__account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(project__student__school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(project__student__school_class_id__in=assigned_class_ids(user))
    return qs.none()


def ensure_class_access(user, school_class):
    if not accessible_class_queryset(user).filter(pk=school_class.pk).exists():
        raise PermissionDenied("You do not have access to this class.")


def ensure_student_access(user, student):
    if not accessible_student_queryset(user).filter(pk=student.pk).exists():
        raise PermissionDenied("You do not have access to this student.")


def _safe_completion_time(start_time):
    now = timezone.localtime().time().replace(microsecond=0)
    if start_time is None or now > start_time:
        return now
    if start_time >= time(23, 59, 59):
        raise ValidationError("This session cannot be completed because its start time leaves no later time on the same day.")
    return (datetime.combine(datetime.min.date(), start_time) + timedelta(seconds=1)).time()


@transaction.atomic
def start_session(*, user, session: Session):
    locked = Session.objects.select_for_update().select_related("school_class", "trainer").get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked.status != "planned":
        raise ValidationError("Only planned sessions can be started.")
    ensure_trainer_session_mutation_access(user, locked)
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
    ensure_trainer_session_mutation_access(user, locked)
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
    ensure_trainer_session_mutation_access(user, session)
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
    ensure_trainer_session_mutation_access(user, locked_session)
    normalized = str(status or "").strip().lower()
    if normalized not in {choice.value for choice in AttendanceStatus}:
        raise ValidationError({"status": "Status must be present, absent, late, or excused."})
    record, _ = AttendanceRecord.objects.update_or_create(
        session=locked_session,
        student=student,
        defaults={"status": normalized, "marked_by": user, "note": str(note or "")[:500]},
    )
    return record


@transaction.atomic
def save_attendance_batch(*, user, session: Session, entries):
    locked_session = Session.objects.select_for_update().select_related("school_class__school", "trainer").get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked_session.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked_session.is_locked or locked_session.status in {"completed", "cancelled"}:
        raise ValidationError("Attendance is locked for this session.")
    if locked_session.status not in {"in_progress", "planned"}:
        raise ValidationError("Attendance cannot be recorded for this session.")
    ensure_trainer_session_mutation_access(user, locked_session)

    roster_rows = list(Student.objects.filter(school_class_id=locked_session.school_class_id, status="active").order_by("roll_number"))
    roster_by_pk = {str(s.pk): s for s in roster_rows}
    roster_by_student_id = {str(s.student_id).upper(): s for s in roster_rows}
    if not isinstance(entries, list) or not entries:
        raise ValidationError({"entries": "Attendance entries are required."})

    normalized = []
    seen = set()
    allowed = {choice.value for choice in AttendanceStatus}
    for raw in entries:
        if not isinstance(raw, dict):
            raise ValidationError({"entries": "Each attendance entry must be an object."})
        key = str(raw.get("student") or raw.get("student_id") or "").strip()
        student = roster_by_pk.get(key) or roster_by_student_id.get(key.upper())
        if not student:
            raise ValidationError({"entries": "Every student must belong to the session class."})
        student_key = str(student.pk)
        if student_key in seen:
            raise ValidationError({"entries": "A student cannot appear more than once."})
        seen.add(student_key)
        status = str(raw.get("status", "")).strip().lower()
        if status not in allowed:
            raise ValidationError({"status": "Status must be present, absent, late, or excused."})
        normalized.append((student, status, str(raw.get("note", ""))[:500]))

    if seen != set(roster_by_pk):
        raise ValidationError({"entries": "Attendance must include every active student in the session roster."})

    records = []
    for student, status, note in normalized:
        record, _ = AttendanceRecord.objects.update_or_create(session=locked_session, student=student, defaults={"status": status, "marked_by": user, "note": note})
        records.append(record)
    return records


@transaction.atomic
def admin_override_attendance(*, user, session: Session, student: Student, status: str, note=""):
    if user.role != UserRole.ADMIN:
        raise PermissionDenied("Only administrators can override attendance.")
    locked_session = Session.objects.select_for_update().get(pk=session.pk)
    if student.school_class_id != locked_session.school_class_id:
        raise ValidationError("Student does not belong to the session class.")
    normalized = str(status or "").strip().lower()
    if normalized not in {choice.value for choice in AttendanceStatus}:
        raise ValidationError({"status": "Status must be present, absent, late, or excused."})
    record, created = AttendanceRecord.objects.update_or_create(
        session=locked_session,
        student=student,
        defaults={"status": normalized, "marked_by": user, "note": str(note or "")[:500]},
    )
    record_audit(
        actor=user,
        action="update" if not created else "create",
        entity_type="AttendanceRecord",
        entity_id=record.id,
        summary=f"Admin attendance correction for {student.student_id}",
        changes={"session": str(session.id), "student": student.student_id, "status": normalized},
    )
    return record


@transaction.atomic
def grade_attempt(*, quiz, student: Student, answers: dict, time_taken_seconds=0, violation_count=0):
    """Grade atomically and serialize attempt-number allocation per quiz."""
    if not isinstance(answers, dict):
        raise ValidationError({"answers": "Answers must be an object keyed by question ID."})
    locked_quiz = type(quiz).objects.select_for_update().get(pk=quiz.pk)
    if locked_quiz.status != "active":
        raise ValidationError("This quiz is not active.")
    if not QuizClassAssignment.objects.filter(quiz=locked_quiz, school_class_id=student.school_class_id).exists():
        raise PermissionDenied("This quiz is not assigned to the student's class.")
    questions = list(locked_quiz.questions.all())
    if not questions:
        raise ValidationError("This quiz has no questions.")
    existing = QuizAttempt.objects.filter(quiz=locked_quiz, student=student).count()
    if existing >= locked_quiz.max_attempts:
        raise ValidationError("Maximum quiz attempts reached.")
    score = Decimal("0"); total = Decimal("0"); correct = 0; attempted = 0; normalized = {}
    valid_ids = {str(question.id) for question in questions}
    unknown_ids = set(str(key) for key in answers) - valid_ids
    if unknown_ids:
        raise ValidationError({"answers": "Answers contain a question that does not belong to this quiz."})
    for question in questions:
        total += Decimal(question.points)
        raw = answers.get(str(question.id))
        if raw is None or str(raw).strip() == "": continue
        selected = str(raw).strip().upper()
        if selected not in {"A", "B", "C", "D"}: raise ValidationError({"answers": "Each answer must be A, B, C, or D."})
        normalized[str(question.id)] = selected; attempted += 1
        if selected == question.correct_option: correct += 1; score += Decimal(question.points)
    percentage = (score / total * Decimal("100")) if total else Decimal("0")
    attempt = QuizAttempt.objects.create(quiz=locked_quiz, student=student, attempt_number=existing + 1, answers=normalized, score=score, total_marks=total, percentage=percentage.quantize(Decimal("0.01")), correct_count=correct, attempted_count=attempted, total_questions=len(questions), time_taken_seconds=max(0, int(time_taken_seconds or 0)), violation_count=max(0, int(violation_count or 0)), status="completed")
    return attempt
