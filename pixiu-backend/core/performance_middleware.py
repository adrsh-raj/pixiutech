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
    """Opt-in request/DB timing diagnostics with safe response headers.

    When PERF_DIAGNOSTICS=true, logs aggregate request/DB metrics and exposes
    the same aggregate values in response headers for the read-only baseline
    tooling. No request paths, query strings, bodies, auth values, user IDs,
    roles, SQL text or response bodies are logged or exposed.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.environ.get("PERF_DIAGNOSTICS", "False").lower() == "true"
        if self.enabled:
            logger.setLevel(logging.INFO)

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

        response = None
        try:
            with connection.execute_wrapper(collect_execute):
                response = self.get_response(request)
            duration_ms = (time.perf_counter() - start) * 1000
            response["X-Pixiu-Perf-Duration-Ms"] = f"{duration_ms:.2f}"
            response["X-Pixiu-Perf-DB-Queries"] = str(query_count)
            response["X-Pixiu-Perf-DB-Time-Ms"] = f"{db_time * 1000:.2f}"
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "perf request method=%s route=%s status=%s duration_ms=%.2f db_queries=%d db_time_ms=%.2f",
                request.method,
                _safe_route(request),
                getattr(response, "status_code", "error"),
                duration_ms,
                query_count,
                db_time * 1000,
            )
