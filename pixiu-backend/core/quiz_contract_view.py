import json

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset
from learning.models import QuizAttempt, QuizClassAssignment, QuizQuestion
from learning.serializers import QuizSerializer

from .phase7_contract_overrides import ScopedQuizSerializer
from .scoped_contract_views import ScopedContractQuizViewSet


class ScopedContractQuizViewSetStrict(ScopedContractQuizViewSet):
    """Quiz endpoint with one mandatory exact class assignment and one attempt per student cycle."""

    @action(detail=False, methods=["post"], url_path="create-with-questions")
    @transaction.atomic
    def create_with_questions(self, request):
        self.required_action = "CREATE"
        self.role_only(UserRole.ADMIN, UserRole.TRAINER)
        payload = request.data.copy()
        raw_questions = payload.pop("questions", [])
        if isinstance(raw_questions, str):
            try:
                raw_questions = json.loads(raw_questions)
            except json.JSONDecodeError as exc:
                raise ValidationError({"questions": "Questions must be a JSON array."}) from exc
        if not isinstance(raw_questions, list) or not raw_questions:
            raise ValidationError({"questions": "At least one MCQ question is required."})

        class_id = payload.pop("school_class", None) or payload.pop("class_id", None)
        if not class_id:
            raise ValidationError({"school_class": "Select the exact class for this quiz."})
        school_class = SchoolClass.objects.filter(pk=class_id, status="active").first()
        if not school_class:
            raise ValidationError({"school_class": "Selected active class was not found."})
        if not accessible_class_queryset(request.user).filter(pk=school_class.pk).exists():
            raise PermissionDenied("You cannot assign a quiz to this class.")

        payload["grade"] = str(school_class.grade).strip()
        try:
            duration_seconds = int(payload.get("duration_seconds") or 0)
        except (TypeError, ValueError):
            duration_seconds = 0
        if duration_seconds <= 0:
            raise ValidationError({"duration_seconds": "Set the exam timer in seconds (10 to 14400)."})
        payload["duration_seconds"] = duration_seconds
        payload["max_attempts"] = 1

        serializer = QuizSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        quiz = serializer.save(created_by=request.user, max_attempts=1)

        for index, question in enumerate(raw_questions, start=1):
            text = str(question.get("question_text") or "").strip()
            options = {key: str(question.get(key) or "").strip() for key in ("option_a", "option_b", "option_c", "option_d")}
            correct = str(question.get("correct_option") or "A").strip().upper()
            try:
                points = int(question.get("points", 1))
            except (TypeError, ValueError):
                points = 1
            if not text or not all(options.values()):
                raise ValidationError({"questions": [f"Question {index} needs text and all four options."]})
            if correct not in {"A", "B", "C", "D"}:
                raise ValidationError({"questions": [f"Question {index} has an invalid correct option."]})
            if points <= 0:
                raise ValidationError({"questions": [f"Question {index} must have positive points."]})
            QuizQuestion.objects.create(
                quiz=quiz,
                question_order=index,
                question_text=text,
                option_a=options["option_a"],
                option_b=options["option_b"],
                option_c=options["option_c"],
                option_d=options["option_d"],
                correct_option=correct,
                explanation=str(question.get("explanation") or "").strip(),
                points=points,
            )

        QuizClassAssignment.objects.get_or_create(
            quiz=quiz,
            school_class=school_class,
            defaults={"assigned_by": request.user},
        )
        quiz.refresh_from_db()
        return Response(ScopedQuizSerializer(quiz, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="reattempt")
    @transaction.atomic
    def reattempt(self, request, pk=None):
        if request.user.role != UserRole.TRAINER:
            raise PermissionDenied("Only the assigned trainer can grant a reattempt.")
        quiz = self.get_object()
        student_id = request.data.get("student") or request.data.get("student_id")
        if not student_id:
            raise ValidationError({"student": "Student is required."})
        student = Student.objects.filter(pk=student_id).select_related("school_class__school").first()
        if not student:
            raise ValidationError({"student": "Student was not found."})
        if not QuizClassAssignment.objects.filter(quiz=quiz, school_class=student.school_class).exists():
            raise PermissionDenied("This student is not in the quiz class.")
        if not accessible_class_queryset(request.user).filter(pk=student.school_class_id).exists():
            raise PermissionDenied("You cannot grant a reattempt for this student's class.")
        if not quiz.created_by_id == request.user.id and not quiz.class_assignments.filter(school_class=student.school_class).exists():
            raise PermissionDenied("You are not authorised to grant this reattempt.")

        attempts = QuizAttempt.objects.select_for_update().filter(quiz=quiz, student=student, status__in=["in_progress", "completed"])
        count = attempts.update(status="invalidated", completed_at=__import__("django.utils.timezone", fromlist=["now"]).now())
        return Response({"ok": True, "quiz": str(quiz.id), "student": str(student.id), "invalidated_attempts": count, "message": "Student may now start a new attempt."})
