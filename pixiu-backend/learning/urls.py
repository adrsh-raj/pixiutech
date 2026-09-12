from rest_framework.routers import DefaultRouter
from django.urls import path

from .trainer_units import TrainerUnitListCreateView
from .views import (
    AssessmentViewSet, AttendanceViewSet, ContentAssignmentViewSet, ContentViewSet,
    CurriculumAssignmentViewSet, CurriculumUnitViewSet, ProjectEvidenceViewSet, ProjectViewSet,
    QuizAssignmentViewSet, QuizAttemptViewSet, QuizQuestionViewSet, QuizViewSet, SessionViewSet,
)

router = DefaultRouter()
router.register("sessions", SessionViewSet, basename="learning-session")
router.register("attendance", AttendanceViewSet, basename="learning-attendance")
router.register("curriculum", CurriculumUnitViewSet, basename="curriculum-unit")
router.register("curriculum-assignments", CurriculumAssignmentViewSet, basename="curriculum-assignment")
router.register("content", ContentViewSet, basename="learning-content")
router.register("content-assignments", ContentAssignmentViewSet, basename="content-assignment")
router.register("quizzes", QuizViewSet, basename="quiz")
router.register("quiz-questions", QuizQuestionViewSet, basename="quiz-question")
router.register("quiz-assignments", QuizAssignmentViewSet, basename="quiz-assignment")
router.register("quiz-attempts", QuizAttemptViewSet, basename="quiz-attempt")
router.register("assessments", AssessmentViewSet, basename="student-assessment")
router.register("projects", ProjectViewSet, basename="learning-project")
router.register("project-evidence", ProjectEvidenceViewSet, basename="project-evidence")

urlpatterns = [path("trainer-units", TrainerUnitListCreateView.as_view(), name="trainer-session-units")]
urlpatterns += router.urls
