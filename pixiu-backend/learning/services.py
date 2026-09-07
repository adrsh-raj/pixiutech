from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import UserRole
from academics.models import Student
from academics.services import accessible_class_queryset, accessible_student_queryset

from .models import (
    AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    Session, StudentAssessment,
)


def assigned_class_ids(user):
    return accessible_class_queryset(user).values("id")


def accessible_sessions(user):
    qs = Session.objects.select_related("school_class__school", "trainer", "created_by")
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
    qs = AttendanceRecord.objects.select_related("session", "student", "marked_by")
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
    if user.role in {UserRole.SCHOOL, UserRole.TRAINER, UserRole.STUDENT}:
        return qs.filter(class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
    return qs.none()


def accessible_content(user):
    qs = LearningContent.objects.select_related("created_by")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.STUDENT:
        return qs.filter(
            status="published",
            target_role__in=["student", "all"],
            class_assignments__school_class_id__in=assigned_class_ids(user),
        ).distinct()
    if user.role == UserRole.TRAINER:
        return qs.filter(target_role__in=["trainer", "all"], class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
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
        return qs.filter(class_assignments__school_class_id__in=assigned_class_ids(user)).distinct()
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

    score = Decimal("0")
    total = Decimal("0")
    correct = 0
    attempted = 0
    normalized = {}
    valid_ids = {str(question.id) for question in questions}
    unknown_ids = set(str(key) for key in answers) - valid_ids
    if unknown_ids:
        raise ValidationError({"answers": "Answers contain a question that does not belong to this quiz."})

    for question in questions:
        total += Decimal(question.points)
        raw = answers.get(str(question.id))
        if raw is None or str(raw).strip() == "":
            continue
        selected = str(raw).strip().upper()
        if selected not in {"A", "B", "C", "D"}:
            raise ValidationError({"answers": "Each answer must be A, B, C, or D."})
        normalized[str(question.id)] = selected
        attempted += 1
        if selected == question.correct_option:
            correct += 1
            score += Decimal(question.points)

    percentage = (score / total * Decimal("100")) if total else Decimal("0")
    return QuizAttempt.objects.create(
        quiz=locked_quiz,
        student=student,
        attempt_number=existing + 1,
        answers=normalized,
        score=score,
        total_marks=total,
        percentage=percentage.quantize(Decimal("0.01")),
        correct_count=correct,
        attempted_count=attempted,
        total_questions=len(questions),
        time_taken_seconds=max(0, int(time_taken_seconds or 0)),
        violation_count=max(0, int(violation_count or 0)),
    )


@transaction.atomic
def create_attendance(*, user, session: Session, student: Student, status: str, note: str = ""):
    ensure_student_access(user, student)
    locked_session = Session.objects.select_for_update().get(pk=session.pk)
    if not accessible_sessions(user).filter(pk=locked_session.pk).exists():
        raise PermissionDenied("You do not have access to this session.")
    if locked_session.is_locked and user.role != UserRole.ADMIN:
        raise ValidationError("Attendance is locked for this session.")
    if locked_session.status == "cancelled":
        raise ValidationError("Attendance cannot be recorded for a cancelled session.")
    if student.school_class_id != locked_session.school_class_id:
        raise ValidationError("Student does not belong to the session class.")
    return AttendanceRecord.objects.update_or_create(
        session=locked_session,
        student=student,
        defaults={"status": status, "marked_by": user, "note": note},
    )[0]
