from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsActiveAccount

from .models import Quiz, QuizAttempt


DEFAULT_EXAM_SECONDS = 30
EXAM_GRACE_SECONDS = 2
START_META_KEY = "__pixiu_exam_started_at"


def _student_for(user):
    if getattr(user, "role", None) != UserRole.STUDENT:
        raise PermissionDenied("Student access is required.")
    student = getattr(user, "student_profile", None)
    if student is None:
        raise ValidationError("The signed-in account is not linked to a student profile.")
    return student


def _duration_seconds(quiz):
    value = getattr(quiz, "duration_seconds", None)
    if value:
        return max(10, int(value))
    return max(60, int(getattr(quiz, "duration_minutes", 1) or 1) * 60)


def _check_quiz_for_student(quiz, student):
    if quiz.status != "active":
        raise ValidationError("Quiz is not available.")
    if not quiz.class_assignments.filter(school_class=student.school_class).exists():
        raise PermissionDenied("This quiz is not assigned to the student's class.")
    if not quiz.questions.exists():
        raise ValidationError("This quiz has no questions.")


def _started_at(attempt):
    raw = (attempt.answers or {}).get(START_META_KEY)
    if not raw:
        return attempt.started_at
    try:
        value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return value if value.tzinfo else value.replace(tzinfo=dt_timezone.utc)
    except (TypeError, ValueError):
        return attempt.started_at


def _answers_without_meta(answers):
    return {str(key): value for key, value in (answers or {}).items() if str(key) != START_META_KEY}


def _normalize_answers(quiz, answers):
    if not isinstance(answers, dict):
        raise ValidationError({"answers": "Answers must be an object keyed by question ID."})
    answers = _answers_without_meta(answers)
    questions = list(quiz.questions.all())
    valid_ids = {str(question.id) for question in questions}
    unknown = set(str(question_id) for question_id in answers) - valid_ids
    if unknown:
        raise ValidationError({"answers": "Answers contain a question that does not belong to this quiz."})

    normalized = {}
    score = Decimal("0")
    total = Decimal("0")
    correct = 0
    attempted = 0
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
    return normalized, score, total, percentage.quantize(Decimal("0.01")), correct, attempted, len(questions)


def _new_attempt(quiz, student):
    started = timezone.now()
    last = QuizAttempt.objects.filter(quiz=quiz, student=student).order_by("-attempt_number").first()
    attempt_number = (last.attempt_number + 1) if last else 1
    return QuizAttempt.objects.create(
        quiz=quiz,
        student=student,
        attempt_number=attempt_number,
        started_at=started,
        answers={START_META_KEY: started.isoformat()},
        status="in_progress",
        total_questions=quiz.questions.count(),
    ), started


def _result_payload(attempt):
    questions = {str(question.id): question for question in attempt.quiz.questions.all()}
    answers = _answers_without_meta(attempt.answers)
    rows = []
    for question in sorted(questions.values(), key=lambda item: item.question_order):
        selected = answers.get(str(question.id))
        rows.append({
            "question_id": str(question.id),
            "question": question.question_text,
            "options": {"A": question.option_a, "B": question.option_b, "C": question.option_c, "D": question.option_d},
            "selected": selected,
            "correct": question.correct_option,
            "is_correct": bool(selected and str(selected).upper() == str(question.correct_option).upper()),
            "explanation": question.explanation,
            "points": float(question.points),
        })
    return {
        "id": str(attempt.id),
        "quiz": str(attempt.quiz_id),
        "quiz_title": attempt.quiz.title,
        "student": str(attempt.student_id),
        "student_name": attempt.student.name,
        "student_id": attempt.student.student_id,
        "score": float(attempt.score),
        "total_marks": float(attempt.total_marks),
        "total_points": float(attempt.total_marks),
        "percentage": float(attempt.percentage),
        "correct_answers": attempt.correct_count,
        "wrong_answers": max(attempt.total_questions - attempt.correct_count, 0),
        "attempted_count": attempt.attempted_count,
        "total_questions": attempt.total_questions,
        "attempt_number": attempt.attempt_number,
        "submitted_at": attempt.completed_at,
        "time_taken_seconds": attempt.time_taken_seconds,
        "violation_count": attempt.violation_count,
        "status": attempt.status,
        "answers": rows,
    }


class QuizStartView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    @transaction.atomic
    def post(self, request, pk):
        student = _student_for(request.user)
        quiz = Quiz.objects.select_for_update().prefetch_related("questions", "class_assignments").filter(pk=pk).first()
        if quiz is None:
            raise ValidationError("Quiz is not available.")
        _check_quiz_for_student(quiz, student)
        if QuizAttempt.objects.filter(quiz=quiz, student=student, status__in=["in_progress", "completed"]).exists():
            raise ValidationError("This quiz already has an active or completed attempt. A trainer must grant a reattempt.")
        attempt, started_at = _new_attempt(quiz, student)
        duration = _duration_seconds(quiz)
        return Response({
            "attempt_id": str(attempt.id),
            "quiz_id": str(quiz.id),
            "attempt_number": attempt.attempt_number,
            "started_at": started_at.isoformat(),
            "expires_at": (started_at + timedelta(seconds=duration)).isoformat(),
            "duration_seconds": duration,
        }, status=status.HTTP_201_CREATED)


class QuizSingleAttemptView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    @transaction.atomic
    def post(self, request, pk):
        student = _student_for(request.user)
        quiz = Quiz.objects.select_for_update().prefetch_related("questions", "class_assignments").filter(pk=pk).first()
        if quiz is None:
            raise ValidationError("Quiz is not available.")
        _check_quiz_for_student(quiz, student)

        attempt_id = request.data.get("attempt_id")
        attempt = QuizAttempt.objects.select_for_update().filter(
            quiz=quiz, student=student, status="in_progress", **({"id": attempt_id} if attempt_id else {})
        ).first()
        if attempt is None:
            if QuizAttempt.objects.filter(quiz=quiz, student=student, status__in=["in_progress", "completed"]).exists():
                raise ValidationError("No active attempt is available for this quiz.")
            attempt, started = _new_attempt(quiz, student)
        else:
            started = _started_at(attempt) or timezone.now()

        duration = _duration_seconds(quiz)
        elapsed = max(0, int((timezone.now() - started).total_seconds()))
        grace = EXAM_GRACE_SECONDS
        try:
            violations = max(0, int(request.data.get("violation_count", 0) or 0))
        except (TypeError, ValueError):
            violations = 0

        if elapsed > duration + grace:
            attempt.status = "invalidated"
            attempt.time_taken_seconds = duration
            attempt.violation_count = violations
            attempt.completed_at = timezone.now()
            attempt.answers = _answers_without_meta(attempt.answers)
            attempt.save(update_fields=["status", "time_taken_seconds", "violation_count", "completed_at", "answers"])
            raise ValidationError("Exam time expired before the server received the submission.")

        normalized, score, total, percentage, correct, attempted, total_questions = _normalize_answers(
            quiz, request.data.get("answers", {})
        )
        attempt.answers = normalized
        attempt.score = score
        attempt.total_marks = total
        attempt.percentage = percentage
        attempt.correct_count = correct
        attempt.attempted_count = attempted
        attempt.total_questions = total_questions
        attempt.time_taken_seconds = min(elapsed, duration)
        attempt.violation_count = violations
        attempt.status = "completed"
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=[
            "answers", "score", "total_marks", "percentage", "correct_count", "attempted_count",
            "total_questions", "time_taken_seconds", "violation_count", "status", "completed_at",
        ])
        return Response(_result_payload(attempt), status=status.HTTP_201_CREATED)


class QuizReviewView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied("Trainer, school or administrator access is required.")

        queryset = QuizAttempt.objects.select_related(
            "quiz", "student", "student__school_class", "student__school_class__school"
        ).prefetch_related("quiz__questions")
        quiz_id = request.query_params.get("quiz")
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)

        from academics.services import accessible_class_queryset
        queryset = queryset.filter(student__school_class_id__in=accessible_class_queryset(request.user).values("id")) if request.user.role in {UserRole.SCHOOL, UserRole.TRAINER} else queryset

        return Response([_result_payload(attempt) for attempt in queryset.order_by("-completed_at", "-id")])
