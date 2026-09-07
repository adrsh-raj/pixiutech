from django.urls import resolve

from .models import AuditAction
from .services import record_audit


class AuditRequestMiddleware:
    """Record successful mutating API requests. Domain services can add richer field-level changes."""

    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/") and request.method in self.MUTATING_METHODS and 200 <= response.status_code < 400:
            try:
                match = resolve(request.path)
                view_name = getattr(match.func, "__name__", "")
                record_audit(
                    actor=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
                    action={"POST": AuditAction.CREATE, "PUT": AuditAction.UPDATE, "PATCH": AuditAction.UPDATE, "DELETE": AuditAction.DELETE}[request.method],
                    app_label="api", model_name=view_name, method=request.method, path=request.path,
                    status_code=response.status_code, ip_address=request.META.get("REMOTE_ADDR"),
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                )
            except Exception:
                # Audit logging must never break an otherwise successful business request.
                pass
        return response
