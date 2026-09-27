from rest_framework.permissions import BasePermission

from academics.services import accessible_class_queryset

from .services import (
    accessible_assessments, accessible_attempts, accessible_attendance, accessible_content,
    accessible_curriculum, accessible_evidence, accessible_projects, accessible_quizzes, accessible_sessions,
)


class LearningScopePermission(BasePermission):
    message = "You do not have access to this learning record."

    def has_object_permission(self, request, view, obj):
        user = request.user
        model_name = obj.__class__.__name__

        if model_name == "CurriculumClassAssignment":
            return accessible_class_queryset(user).filter(pk=obj.school_class_id).exists() and accessible_curriculum(user).filter(pk=obj.curriculum_unit_id).exists()
        if model_name == "ContentClassAssignment":
            return accessible_class_queryset(user).filter(pk=obj.school_class_id).exists() and accessible_content(user).filter(pk=obj.content_id).exists()
        if model_name == "QuizClassAssignment":
            return accessible_class_queryset(user).filter(pk=obj.school_class_id).exists() and accessible_quizzes(user).filter(pk=obj.quiz_id).exists()
        if model_name == "QuizQuestion":
            return accessible_quizzes(user).filter(pk=obj.quiz_id).exists()
        if model_name == "SessionActivity":
            return accessible_sessions(user).filter(pk=obj.session_id).exists()

        mapping = {
            "Session": accessible_sessions,
            "AttendanceRecord": accessible_attendance,
            "CurriculumUnit": accessible_curriculum,
            "LearningContent": accessible_content,
            "Quiz": accessible_quizzes,
            "QuizAttempt": accessible_attempts,
            "StudentAssessment": accessible_assessments,
            "Project": accessible_projects,
            "ProjectEvidence": accessible_evidence,
        }
        queryset_fn = mapping.get(model_name)
        return bool(queryset_fn and queryset_fn(user).filter(pk=obj.pk).exists())
