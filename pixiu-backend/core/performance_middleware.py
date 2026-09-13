import logging
import os
import time
from django.db import connection

logger = logging.getLogger("performance")


def _safe_route(request):
    """Return the Django route pattern, never the concrete URL path/query string."""
    match = getattr(request, "resolver_match", None)
    route = getattr(match, "route", None)
    return route or "<unresolved>"


class PerformanceDiagnosticsMiddleware:
    """Opt-in request/DB timing diagnostics with no user-data logging.

    Disabled unless PERF_DIAGNOSTICS=true. When enabled, logs only method,
    route pattern, status and aggregate timing/query counts. It never logs
    request paths, query strings, bodies, headers, tokens, user IDs, roles,
    SQL text, or SQL parameters.
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

        try:
            with connection.execute_wrapper(collect_execute):
                response = self.get_response(request)
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "perf request method=%s route=%s status=%s duration_ms=%.2f db_queries=%d db_time_ms=%.2f",
                request.method,
                _safe_route(request),
                getattr(locals().get("response"), "status_code", "error"),
                duration_ms,
                query_count,
                db_time * 1000,
            )

        return response
