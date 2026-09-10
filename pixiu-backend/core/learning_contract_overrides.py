from django.db.models import Max

from accounts.models import UserRole
from learning.models import QuizQuestion
from learning.views import QuizQuestionViewSet


class StableQuizQuestionViewSet(QuizQuestionViewSet):
    def perform_create(self, serializer):
        self.role_only(UserRole.ADMIN, UserRole.TRAINER)
        quiz = serializer.validated_data["quiz"]
        next_order = (QuizQuestion.objects.filter(quiz=quiz).aggregate(max_order=Max("question_order"))["max_order"] or 0) + 1
        serializer.save(question_order=next_order)
