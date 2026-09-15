from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        # Session list serialization includes each activity's created_by field.
        # The canonical session queryset already prefetches activities. Replace
        # that plain prefetch with one that select_related()s created_by instead
        # of registering two competing prefetches for the same relation.
        from django.db.models import Prefetch
        from learning.models import SessionActivity
        import learning.services as learning_services

        if getattr(learning_services, "_PIXIU_OPTIMIZED_SESSION_PREFETCH", False):
            return

        original = learning_services.accessible_sessions
        activity_qs = SessionActivity.objects.select_related("created_by").order_by("created_at")

        def optimized_accessible_sessions(user):
            queryset = original(user).prefetch_related(None)
            return queryset.prefetch_related(
                Prefetch("activities", queryset=activity_qs)
            )

        learning_services.accessible_sessions = optimized_accessible_sessions
        learning_services._PIXIU_OPTIMIZED_SESSION_PREFETCH = True
