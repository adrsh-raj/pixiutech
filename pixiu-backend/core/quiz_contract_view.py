import json

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import SchoolClass
from academics.services import accessible_class_queryset
from learning.models import QuizClassAssignment, QuizQuestion
from learning.serializers import QuizSerializer

from .phase7_contract_overrides import ScopedQuizSerializer
from .scoped_contract_views import ScopedContractQuizViewSet


class ScopedContractQuizViewSetStrict(ScopedContractQuizViewSet):
    """Quiz endpoint with one mandatory exact class assignment."""

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
            raise ValidationError({"school_class": "You cannot assign a quiz to this class."})

        # Grade is derived from the selected class; the client cannot create a
        # quiz for a different grade.
        payload["grade"] = str(school_class.grade).strip()
        serializer = QuizSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        quiz = serializer.save(created_by=request.user, duration_minutes=1)

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
        return Response(ScopedQuizSerializer(quiz, context={"request": request}).data, status=status.HTTP_201_CREATED)
