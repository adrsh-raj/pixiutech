from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    SchoolClassViewSet,
    SchoolViewSet,
    StudentViewSet,
    TrainerSchoolAssignmentViewSet,
    TrainerViewSet,
)

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="school")
router.register("trainers", TrainerViewSet, basename="trainer")
router.register("trainer-school-assignments", TrainerSchoolAssignmentViewSet, basename="trainer-school-assignment")
router.register("classes", SchoolClassViewSet, basename="school-class")
router.register("students", StudentViewSet, basename="student")

urlpatterns = [path("", include(router.urls))]
