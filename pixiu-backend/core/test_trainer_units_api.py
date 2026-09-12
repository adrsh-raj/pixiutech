from datetime import date

from django.urls import resolve
from rest_framework.test import APIRequestFactory, force_authenticate
from django.test import TestCase

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Trainer, TrainerSchoolAssignment
from learning.course_completion_models import CurriculumUnitProfile, Technology
from learning.models import CurriculumClassAssignment, CurriculumUnit
from learning.trainer_units import TrainerUnitListCreateView


class TrainerUnitsApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user("TR-ROUTE-001", "trainer-pass", role=UserRole.TRAINER)
        self.school = School.objects.create(school_code="TUS", name="Trainer Unit School")
        self.trainer = Trainer.objects.create(trainer_id="TR-ROUTE-001", name="Route Trainer", account=self.user)
        TrainerSchoolAssignment.objects.create(
            trainer=self.trainer,
            school=self.school,
            assigned_from=date(2026, 1, 1),
        )
        self.school_class = SchoolClass.objects.create(school=self.school, grade="6", section="A")
        self.robotics = Technology.objects.create(code="robotics", name="Robotics", active=True)
        self.ai = Technology.objects.create(code="ai", name="AI", active=True)
        self.robotics_unit = CurriculumUnit.objects.create(
            grade="6",
            level="Level 1",
            unit_code="ROBOTICS-U1",
            title="Robotics Basics",
            week="Unit 1",
            objectives="Build a simple robot",
            status="published",
            created_by=self.user,
        )
        self.ai_unit = CurriculumUnit.objects.create(
            grade="6",
            level="Level 1",
            unit_code="AI-U1",
            title="AI Basics",
            week="Unit 1",
            objectives="Understand AI",
            status="published",
            created_by=self.user,
        )
        CurriculumUnitProfile.objects.create(curriculum_unit=self.robotics_unit, technology=self.robotics)
        CurriculumUnitProfile.objects.create(curriculum_unit=self.ai_unit, technology=self.ai)
        CurriculumClassAssignment.objects.create(curriculum_unit=self.robotics_unit, school_class=self.school_class, assigned_by=self.user)
        CurriculumClassAssignment.objects.create(curriculum_unit=self.ai_unit, school_class=self.school_class, assigned_by=self.user)

    def test_v1_route_is_registered(self):
        match = resolve("/api/trainer-units")
        self.assertEqual(match.func.view_class, TrainerUnitListCreateView)

    def test_trainer_units_are_filtered_by_class_and_technology(self):
        request = self.factory.get(
            "/api/trainer-units",
            {"class_id": str(self.school_class.id), "technology": str(self.robotics.id)},
        )
        force_authenticate(request, user=self.user)
        response = TrainerUnitListCreateView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [str(self.robotics_unit.id)])
