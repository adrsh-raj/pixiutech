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
from .services import grade_attempt


EXAM_LIMIT_SECONDS = 30


def _student_for(user):
    if getattr(user, "role", None) != UserRole.STUDENT:
        raise PermissionDenied("Student access is required.")
    student = getattr(user, "student_profile", None)
    if student is None:
        raise ValidationError("The signed-in account is not linked to a student profile.")
    return student


class QuizSingleAttemptView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    @transaction.atomic
    def post(self, request, pk):
        student = _student_for(request.user)
        quiz = Quiz.objects.select_for_update().prefetch_related("questions").filter(pk=pk, status="active").first()
        if quiz is None:
            raise ValidationError("Quiz is not available.")
        if not quiz.class_assignments.filter(school_class=student.school_class).exists():
            raise PermissionDenied("This quiz is not assigned to the student's class.")
        if QuizAttempt.objects.filter(quiz=quiz, student=student).exists():
            raise ValidationError("This quiz allows one attempt only and has already been submitted.")

        answers = request.data.get("answers", {})
        if not isinstance(answers, dict):
            raise ValidationError({"answers": "Answers must be an object keyed by question ID."})
        try:
            reported_seconds = max(0, int(request.data.get("time_taken_seconds", 0) or 0))
        except (TypeError, ValueError):
            raise ValidationError({"time_taken_seconds": "Time must be a non-negative integer."})
        if reported_seconds > EXAM_LIMIT_SECONDS + 2:
            raise ValidationError({"time_taken_seconds": "Exam time has expired. The submission was rejected."})
        try:
            violations = max(0, int(request.data.get("violation_count", 0) or 0))
        except (TypeError, ValueError):
            violations = 0

        attempt = grade_attempt(
            quiz=quiz,
            student=student,
            answers=answers,
            time_taken_seconds=min(reported_seconds, EXAM_LIMIT_SECONDS),
            violation_count=violations,
        )
        return Response(QuizAttemptReadSerializer(attempt, context={"request": request}).data, status=status.HTTP_201_CREATED)


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

        if request.user.role in {UserRole.SCHOOL, UserRole.TRAINER}:
            class_ids = accessible_class_queryset(request.user).values("id")
            queryset = queryset.filter(student__school_class_id__in=class_ids)

        payload = []
        for attempt in queryset.order_by("-completed_at", "-started_at"):
            questions = {str(question.id): question for question in attempt.quiz.questions.all()}
            answer_rows = []
            for question_id, selected in (attempt.answers or {}).items():
                question = questions.get(str(question_id))
                if question is None:
                    continue
                answer_rows.append({
                    "question_id": str(question.id),
                    "question": question.question_text,
                    "options": {"A": question.option_a, "B": question.option_b, "C": question.option_c, "D": question.option_d},
                    "selected": selected,
                    "correct": question.correct_option,
                    "is_correct": str(selected).upper() == str(question.correct_option).upper(),
                    "explanation": question.explanation,
                    "points": float(question.points),
                })
            payload.append({
                "id": str(attempt.id),
                "quiz": str(attempt.quiz_id),
                "quiz_title": attempt.quiz.title,
                "student": str(attempt.student_id),
                "student_name": attempt.student.name,
                "student_id": attempt.student.student_id,
                "class_name": attempt.student.school_class.display_name,
                "school_name": attempt.student.school_class.school.name,
                "score": float(attempt.score),
                "total_points": float(attempt.total_marks),
                "percentage": float(attempt.percentage),
                "correct_answers": attempt.correct_count,
                "wrong_answers": max(attempt.total_questions - attempt.correct_count, 0),
                "submitted_at": attempt.completed_at,
                "time_taken_seconds": attempt.time_taken_seconds,
                "violation_count": attempt.violation_count,
                "answers": answer_rows,
            })
        return Response(payload)
