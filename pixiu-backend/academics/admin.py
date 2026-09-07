from django.contrib import admin

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("school_code", "name", "principal_name", "status", "account")
    search_fields = ("school_code", "name", "principal_name", "email", "phone")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Trainer)
class TrainerAdmin(admin.ModelAdmin):
    list_display = ("trainer_id", "name", "phone", "rating", "status", "account")
    search_fields = ("trainer_id", "name", "email", "phone")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(TrainerSchoolAssignment)
class TrainerSchoolAssignmentAdmin(admin.ModelAdmin):
    list_display = ("trainer", "school", "assigned_from", "assigned_to", "status")
    list_filter = ("status", "school")
    search_fields = ("trainer__trainer_id", "trainer__name", "school__school_code", "school__name")


@admin.register(SchoolClass)
class SchoolClassAdmin(admin.ModelAdmin):
    list_display = ("school", "grade", "section", "display_name", "status")
    list_filter = ("status", "school", "grade")
    search_fields = ("school__school_code", "school__name", "grade", "section")


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("student_id", "name", "school_class", "roll_number", "status", "account")
    list_filter = ("status", "school_class__school", "school_class__grade")
    search_fields = ("student_id", "name", "guardian_name", "guardian_phone")
    readonly_fields = ("id", "student_id", "created_at", "updated_at", "account")
