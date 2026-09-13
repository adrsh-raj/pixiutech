import logging
import os
import time
from django.db import connection

logger = logging.getLogger("performance")


class PerformanceDiagnosticsMiddleware:
    """Opt-in request/DB timing diagnostics for production troubleshooting.

    Disabled unless PERF_DIAGNOSTICS=true. It logs aggregate request timing and
    database query timing without logging query text, request bodies, tokens, or
    query-string values.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.environ.get("PERF_DIAGNOSTICS", "False").lower() == "true"

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        start = time.perf_counter()
        query_count = 0
        db_time = 0.0

        def collect_execute(execute, sql, params, many, context):
            nonlocal query_count, db_time
            qstart = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                query_count += 1
                db_time += time.perf_counter() - qstart

        with connection.execute_wrapper(collect_execute):
            response = self.get_response(request)

        duration_ms = (time.perf_counter() - start) * 1000
        user = getattr(request, "user", None)
        user_id = getattr(user, "id", None) if getattr(user, "is_authenticated", False) else None
        role = getattr(user, "role", None) if getattr(user, "is_authenticated", False) else None

        logger.info(
            "perf request method=%s path=%s status=%s duration_ms=%.2f db_queries=%d db_time_ms=%.2f user_id=%s role=%s",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
            query_count,
            db_time * 1000,
            user_id,
            role,
        )
        return response
