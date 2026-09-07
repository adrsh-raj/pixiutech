from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display=("created_at","action","entity_type","entity_id","actor","summary")
    list_filter=("action","entity_type")
    search_fields=("entity_type","entity_id","summary","actor__username")
    readonly_fields=tuple(field.name for field in AuditLog._meta.fields)
    actions=None

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
