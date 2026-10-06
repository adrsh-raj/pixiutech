from django.contrib import admin

from .models import CareerApplication, CareerOpening, LabEnquiryAttachment, Lead, LeadActivity, LeadContact


class LabEnquiryAttachmentInline(admin.TabularInline):
    model = LabEnquiryAttachment
    extra = 0
    can_delete = False
    readonly_fields = ("original_name", "size", "content_type", "sha256", "file", "created_at")
    fields = ("original_name", "size", "content_type", "file", "created_at")


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("organization_name", "contact_name", "enquiry_type", "source", "status", "created_at")
    list_filter = ("enquiry_type", "source", "status")
    search_fields = ("organization_name", "contact_name", "email", "phone", "notes")
    readonly_fields = ("id", "created_at", "updated_at")
    inlines = (LabEnquiryAttachmentInline,)


admin.site.register([LeadActivity, LeadContact])


@admin.register(CareerOpening)
class CareerOpeningAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "location", "employment_type", "sort_order", "created_at")
    list_filter = ("status", "employment_type")
    search_fields = ("title", "location", "description", "requirements")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(CareerApplication)
class CareerApplicationAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "opening", "status", "created_at")
    list_filter = ("status", "opening")
    search_fields = ("name", "email", "phone", "opening__title")
    readonly_fields = ("id", "opening", "name", "email", "phone", "cover_message", "cv_original_name", "cv_size", "cv_sha256", "created_at", "updated_at")
    exclude = ("cv",)
