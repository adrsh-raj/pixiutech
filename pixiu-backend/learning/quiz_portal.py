from datetime import timedelta
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
from academics.services import accessible_class_queryset

from .models import Quiz, QuizAttempt
from .serializers import QuizAttemptReadSerializer


EXAM_LIMIT_SECONDS = 30
EXAM_GRACE_SECONDS = 2


def _student_for(user):
    if getattr(user, "role", None) != UserRole.STUDENT:
        raise PermissionDenied("Student access is required.")
    student = getattr(user, "student_profile", None)
    if student is None:
        raise ValidationError("The signed-in account is not linked to a student profile.")
    return student


def _check_quiz_for_student(quiz, student):
    if quiz.status != "active":
        raise ValidationError("Quiz is not available.")
    if not quiz.class_assignments.filter(school_class=student.school_class).exists():
        raise PermissionDenied("This quiz is not assigned to the student's class.")
    if not quiz.questions.exists():
        raise ValidationError("This quiz has no questions.")


def _normalize_answers(quiz, answers):
    if not isinstance(answers, dict):
        raise ValidationError({"answers": "Answers must be an object keyed by question ID."})
    questions = list(quiz.questions.all())
    valid_ids = {str(question.id) for question in questions}
    unknown = set(str(key) for key in answers) - valid_ids
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


class QuizStartView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    @transaction.atomic
    def post(self, request, pk):
        student = _student_for(request.user)
        quiz = Quiz.objects.select_for_update().prefetch_related("questions", "class_assignments").filter(pk=pk).first()
        if quiz is None:
            raise ValidationError("Quiz is not available.")
        _check_quiz_for_student(quiz, student)
        if QuizAttempt.objects.filter(quiz=quiz, student=student).exists():
            raise ValidationError("This quiz allows one attempt only and has already been started or submitted.")
        started_at = timezone.now()
        attempt = QuizAttempt.objects.create(quiz=quiz, student=student, attempt_number=1, status="in_progress", started_at=started_at, total_questions=quiz.questions.count())
        return Response({"attempt_id": str(attempt.id), "quiz_id": str(quiz.id), "started_at": started_at.isoformat(), "expires_at": (started_at + timedelta(seconds=EXAM_LIMIT_SECONDS)).isoformat(), "duration_seconds": EXAM_LIMIT_SECONDS}, status=status.HTTP_201_CREATED)


class QuizSingleAttemptView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    @transaction.atomic
    def post(self, request, pk):
        student = _student_for(request.user)
        quiz = Quiz.objects.select_for_update().prefetch_related("questions", "class_assignments").filter(pk=pk).first()
        if quiz is None:
            raise ValidationError("Quiz is not available.")
        _check_quiz_for_student(quiz, student)
        attempt = QuizAttempt.objects.select_for_update().filter(quiz=quiz, student=student, status="in_progress").first()
        if attempt is None:
            if QuizAttempt.objects.filter(quiz=quiz, student=student).exists():
                raise ValidationError("This quiz allows one attempt only and has already been submitted.")
            attempt = QuizAttempt.objects.create(quiz=quiz, student=student, attempt_number=1, status="in_progress", started_at=timezone.now(), total_questions=quiz.questions.count())
        started_at = attempt.started_at or timezone.now()
        elapsed = max(0, int((timezone.now() - started_at).total_seconds()))
        if elapsed > EXAM_LIMIT_SECONDS + EXAM_GRACE_SECONDS:
            attempt.status = "invalidated"
            attempt.completed_at = timezone.now()
            attempt.time_taken_seconds = EXAM_LIMIT_SECONDS
            attempt.save(update_fields=["status", "completed_at", "time_taken_seconds"])
            raise ValidationError("Exam time expired before the server received the submission.")
        try:
            violations = max(0, int(request.data.get("violation_count", 0) or 0))
        except (TypeError, ValueError):
            violations = 0
        normalized, score, total, percentage, correct, attempted, total_questions = _normalize_answers(quiz, request.data.get("answers", {}))
        attempt.answers = normalized
        attempt.score = score
        attempt.total_marks = total
        attempt.percentage = percentage
        attempt.correct_count = correct
        attempt.attempted_count = attempted
        attempt.total_questions = total_questions
        attempt.time_taken_seconds = min(elapsed, EXAM_LIMIT_SECONDS)
        attempt.violation_count = violations
        attempt.status = "completed"
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=["answers", "score", "total_marks", "percentage", "correct_count", "attempted_count", "total_questions", "time_taken_seconds", "violation_count", "status", "completed_at"])
        return Response(QuizAttemptReadSerializer(attempt, context={"request": request}).data, status=status.HTTP_201_CREATED)


class QuizReviewView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER}:
            raise PermissionDenied("Trainer, school or administrator access is required.")
        queryset = QuizAttempt.objects.select_related("quiz", "student", "student__school_class", "student__school_class__school").prefetch_related("quiz__questions")
        quiz_id = request.query_params.get("quiz")
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)
        if request.user.role in {UserRole.SCHOOL, UserRole.TRAINER}:
            queryset = queryset.filter(student__school_class_id__in=accessible_class_queryset(request.user).values("id"))
        payload = []
        for attempt in queryset.order_by("-completed_at", "-started_at"):
            questions = {str(question.id): question for question in attempt.quiz.questions.all()}
            answer_rows = []
            for question_id, selected in (attempt.answers or {}).items():
                question = questions.get(str(question_id))
                if question is None:
                    continue
                answer_rows.append({"question_id": str(question.id), "question": question.question_text, "options": {"A": question.option_a, "B": question.option_b, "C": question.option_c, "D": question.option_d}, "selected": selected, "correct": question.correct_option, "is_correct": str(selected).upper() == str(question.correct_option).upper(), "explanation": question.explanation, "points": float(question.points)})
            payload.append({"id": str(attempt.id), "quiz": str(attempt.quiz_id), "quiz_title": attempt.quiz.title, "student": str(attempt.student_id), "student_name": attempt.student.name, "student_id": attempt.student.student_id, "class_name": attempt.student.school_class.display_name, "school_name": attempt.student.school_class.school.name, "score": float(attempt.score), "total_points": float(attempt.total_marks), "percentage": float(attempt.percentage), "correct_answers": attempt.correct_count, "wrong_answers": max(attempt.total_questions - attempt.correct_count, 0), "submitted_at": attempt.completed_at, "time_taken_seconds": attempt.time_taken_seconds, "violation_count": attempt.violation_count, "answers": answer_rows})
        return Response(payload)
