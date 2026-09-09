from django.db import transaction
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
        attempt = grade_attempt(
            quiz=quiz,
            student=student,
            answers=answers,
            time_taken_seconds=request.data.get("time_taken_seconds", 0),
            violation_count=request.data.get("violation_count", 0),
        )
        return Response(QuizAttemptReadSerializer(attempt, context={"request": request}).data, status=status.HTTP_201_CREATED)


class QuizReviewView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        if request.user.role not in {UserRole.ADMIN, UserRole.SUPERADMIN if hasattr(UserRole, "SUPERADMIN") else UserRole.ADMIN, UserRole.TRAINER}:
            raise PermissionDenied("Trainer or administrator access is required.")

        queryset = QuizAttempt.objects.select_related("quiz", "student", "student__school_class").prefetch_related("quiz__questions")
        quiz_id = request.query_params.get("quiz")
        if quiz_id:
            queryset = queryset.filter(quiz_id=quiz_id)
        if request.user.role == UserRole.TRAINER:
            accessible_classes = accessible_class_queryset(request.user).values("id")
            queryset = queryset.filter(student__school_class_id__in=accessible_classes)

        payload = []
        for attempt in queryset.order_by("-submitted_at"):
            questions = {str(question.id): question for question in attempt.quiz.questions.all()}
            answer_rows = []
            for question_id, selected in (attempt.answers or {}).items():
                question = questions.get(str(question_id))
                if question is None:
                    continue
                answer_rows.append({
                    "question_id": str(question.id),
                    "question": question.question_text,
                    "options": {
                        "A": question.option_a,
                        "B": question.option_b,
                        "C": question.option_c,
                        "D": question.option_d,
                    },
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
                "score": float(attempt.score),
                "total_points": float(attempt.total_points),
                "correct_answers": attempt.correct_answers,
                "wrong_answers": attempt.wrong_answers,
                "submitted_at": attempt.submitted_at,
                "answers": answer_rows,
            })
        return Response(payload)
