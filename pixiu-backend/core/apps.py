from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Session list serialization includes each activity's created_by field
        # and CourseAwareSessionViewSet.map_out reads workflow/profile data per
        # session. Prepare all of those relations in the base queryset so list
        # responses do not issue per-session queries.
        from django.db.models import Prefetch
        from learning.models import SessionActivity
        import learning.services as learning_services

        if not getattr(learning_services, "_PIXIU_OPTIMIZED_SESSION_PREFETCH", False):
            original = learning_services.accessible_sessions
            activity_qs = SessionActivity.objects.select_related("created_by").order_by("created_at")

            def optimized_accessible_sessions(user):
                queryset = original(user).prefetch_related(None).select_related(
                    "curriculum_unit",
                    "workflow__technology",
                    "curriculum_unit__completion_profile__technology",
                )
                return queryset.prefetch_related(Prefetch("activities", queryset=activity_qs))

            learning_services.accessible_sessions = optimized_accessible_sessions
            learning_services._PIXIU_OPTIMIZED_SESSION_PREFETCH = True

        # Enforce the same upload policy at the model FileField validation
        # boundary. This protects every ModelSerializer/view that accepts these
        # fields, including future endpoints that do not know about the upload
        # security implementation.
        from .upload_security import validate_file_field_value
        from learning.models import LearningContent, ProjectEvidence

        for model in (LearningContent, ProjectEvidence):
            field = model._meta.get_field("file")
            if validate_file_field_value not in field.validators:
                field.validators.append(validate_file_field_value)
