from django.contrib import admin
from .models import (AttendanceRecord, ContentClassAssignment, CurriculumClassAssignment, CurriculumUnit, LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment, QuizQuestion, Session, StudentAssessment)

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display=("date","start_time","school_class","trainer","status","is_locked")
    list_filter=("status","is_locked","school_class__school")
    search_fields=("topic","trainer__name","school_class__school__name")

@admin.register(AttendanceRecord)
class AttendanceAdmin(admin.ModelAdmin):
    list_display=("session","student","status","marked_by","marked_at")
    list_filter=("status","session__school_class__school")
    search_fields=("student__student_id","student__name")

@admin.register(CurriculumUnit)
class CurriculumUnitAdmin(admin.ModelAdmin):
    list_display=("grade","unit_code","level","title","status")
    list_filter=("grade","level","status")
    search_fields=("unit_code","title","topic")

@admin.register(LearningContent)
class LearningContentAdmin(admin.ModelAdmin):
    list_display=("title","content_type","grade","level","target_role","status","created_by")
    list_filter=("content_type","grade","target_role","status","is_watermarked")
    search_fields=("title","description","unit_code")

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display=("title","grade","level","status","duration_minutes","max_attempts","created_by")
    list_filter=("grade","level","status")
    search_fields=("title","unit_code")

@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display=("quiz","question_order","points","correct_option")
    list_filter=("quiz__grade",)
    search_fields=("quiz__title","question_text")

@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display=("quiz","student","attempt_number","score","percentage","status","completed_at")
    list_filter=("status","quiz__grade")
    search_fields=("student__student_id","student__name","quiz__title")

@admin.register(StudentAssessment)
class StudentAssessmentAdmin(admin.ModelAdmin):
    list_display=("student","trainer","unit_code","score","rating","status","assessment_date")
    list_filter=("status","student__school_class__school","student__school_class__grade")
    search_fields=("student__student_id","student__name","trainer__name","unit_code")

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display=("student","title","status","score","submitted_at","completed_at")
    list_filter=("status","student__school_class__school")
    search_fields=("student__student_id","student__name","title")

@admin.register(ProjectEvidence)
class ProjectEvidenceAdmin(admin.ModelAdmin):
    list_display=("project","title","uploaded_by","created_at")
    search_fields=("project__title","project__student__student_id","title")

admin.site.register([CurriculumClassAssignment, ContentClassAssignment, QuizClassAssignment])
