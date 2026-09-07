from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

from academics.services import accessible_class_queryset, accessible_student_queryset
from .services import (
    accessible_assessments, accessible_attempts, accessible_attendance, accessible_content,
    accessible_curriculum, accessible_evidence, accessible_projects, accessible_quizzes, accessible_sessions,
)


class LearningScopePermission(BasePermission):
    message = "You do not have access to this learning record."

    def has_object_permission(self, request, view, obj):
        model_name = obj.__class__.__name__
        mapping = {
            "Session": accessible_sessions,
            "AttendanceRecord": accessible_attendance,
            "CurriculumUnit": accessible_curriculum,
            "CurriculumClassAssignment": lambda u: accessible_curriculum(u).model.objects.filter(pk=obj.curriculum_unit_id),
            "LearningContent": accessible_content,
            "ContentClassAssignment": lambda u: accessible_content(u).model.objects.filter(pk=obj.content_id),
            "Quiz": accessible_quizzes,
            "QuizClassAssignment": lambda u: accessible_quizzes(u).model.objects.filter(pk=obj.quiz_id),
            "QuizQuestion": lambda u: accessible_quizzes(u).model.objects.filter(pk=obj.quiz_id),
            "QuizAttempt": accessible_attempts,
            "StudentAssessment": accessible_assessments,
            "Project": accessible_projects,
            "ProjectEvidence": accessible_evidence,
        }
        queryset_fn = mapping.get(model_name)
        if queryset_fn is None:
            raise PermissionDenied(self.message)
        return queryset_fn(request.user).filter(pk=obj.pk if model_name not in {"CurriculumClassAssignment", "ContentClassAssignment", "QuizClassAssignment", "QuizQuestion"} else obj.curriculum_unit_id if model_name == "CurriculumClassAssignment" else obj.content_id if model_name == "ContentClassAssignment" else obj.quiz_id if model_name in {"QuizClassAssignment", "QuizQuestion"} else obj.pk).exists()
