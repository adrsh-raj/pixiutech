from django.contrib import admin
from .models import Lead, LeadActivity, LeadContact
admin.site.register([Lead, LeadActivity, LeadContact])



from .models import CareerApplication, CareerOpening


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
    readonly_fields = ("id", "opening", "name", "email", "phone", "cover_message", "cv", "cv_original_name", "cv_size", "cv_sha256", "created_at", "updated_at")
