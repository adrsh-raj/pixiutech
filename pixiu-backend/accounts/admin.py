from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class PIXIUUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("PIXIU access", {"fields": ("role", "status", "must_change_password", "display_name")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("PIXIU access", {"fields": ("role", "status", "must_change_password", "display_name")}),
    )
    list_display = ("username", "display_name", "role", "status", "is_active", "last_login")
    list_filter = ("role", "status", "is_active", "is_staff", "is_superuser")
    search_fields = ("username", "display_name", "first_name", "last_name", "email")
