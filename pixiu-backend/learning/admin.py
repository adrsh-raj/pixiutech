from django.contrib import admin

from .models import (
    AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit,
    LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment,
    QuizQuestion, Session, StudentAssessment,
)

admin.site.register([Session, AttendanceRecord, CurriculumUnit, CurriculumClassAssignment, LearningContent, ContentClassAssignment, Quiz, QuizQuestion, QuizClassAssignment, QuizAttempt, StudentAssessment, Project, ProjectEvidence])
