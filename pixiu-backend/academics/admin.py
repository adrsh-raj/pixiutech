from django.contrib import admin

from .models import (
    School,
    SchoolClass,
    Student,
    Trainer,
    TrainerSchoolAssignment,
    XenSchool,
    XenLab,
    XenTrainer,
    XenSession,
    XenJob,
    XenWorkerHeartbeat,
)


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


@admin.register(XenSchool)
class XenSchoolAdmin(admin.ModelAdmin):
    list_display = ("xen_school_code", "school", "status", "created_at")
    search_fields = ("xen_school_code", "school__school_code", "school__name")
    list_filter = ("status",)
    readonly_fields = ("id", "xen_school_code", "created_at", "updated_at")


@admin.register(XenLab)
class XenLabAdmin(admin.ModelAdmin):
    list_display = ("xen_lab_code", "school_class", "slot_number", "academic_period", "status")
    search_fields = ("xen_lab_code", "school_class__school__school_code", "school_class__grade", "school_class__section")
    list_filter = ("academic_period", "slot_number", "status")
    readonly_fields = ("id", "xen_lab_code", "created_at", "updated_at")


@admin.register(XenTrainer)
class XenTrainerAdmin(admin.ModelAdmin):
    list_display = ("xen_trainer_code", "trainer", "is_a05_qualified", "a05_certificate_id", "status", "created_at")
    search_fields = ("xen_trainer_code", "trainer__trainer_id", "trainer__name", "a05_certificate_id")
    list_filter = ("is_a05_qualified", "status")
    readonly_fields = ("id", "xen_trainer_code", "created_at", "updated_at")


@admin.register(XenSession)
class XenSessionAdmin(admin.ModelAdmin):
    list_display = ("idempotency_key", "user", "role", "intent", "is_completed", "created_at")
    search_fields = ("idempotency_key", "user__username", "intent")
    list_filter = ("role", "intent", "is_completed")
    readonly_fields = ("id", "created_at")


@admin.register(XenJob)
class XenJobAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "status", "worker_id", "created_at", "completed_at")
    search_fields = ("id", "idempotency_key", "user__username", "worker_id")
    list_filter = ("status", "role", "intent")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(XenWorkerHeartbeat)
class XenWorkerHeartbeatAdmin(admin.ModelAdmin):
    list_display = ("worker_id", "last_seen", "is_active", "created_at")
    search_fields = ("worker_id",)
    list_filter = ("is_active",)
    readonly_fields = ("created_at", "last_seen")


