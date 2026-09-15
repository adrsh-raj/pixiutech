from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Session list serialization includes each activity's created_by field.
        # The canonical session queryset already prefetches activities, but the
        # activity queryset previously lacked created_by select_related(),
        # producing one extra user query per activity row (N+1).
        from django.db.models import Prefetch
        from learning.models import SessionActivity
        import learning.services as learning_services

        if getattr(learning_services, "_PIXIU_OPTIMIZED_SESSION_PREFETCH", False):
            return

        original = learning_services.accessible_sessions
        activity_qs = SessionActivity.objects.select_related("created_by").order_by("created_at")

        def optimized_accessible_sessions(user):
            return original(user).prefetch_related(
                Prefetch("activities", queryset=activity_qs)
            )

        learning_services.accessible_sessions = optimized_accessible_sessions
        learning_services._PIXIU_OPTIMIZED_SESSION_PREFETCH = True
