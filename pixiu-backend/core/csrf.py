"""CSRF helpers for cookie-authenticated authentication endpoints."""

from functools import wraps

from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "csrf_token"

    def get(self, request):
        response = JsonResponse({"csrfToken": get_token(request)})
        response["Cache-Control"] = "no-store, private"
        response["X-Content-Type-Options"] = "nosniff"
        return response


csrf_token_view = CsrfTokenView.as_view()


def require_api_csrf(view_func):
    """Apply Django's real CSRF checks to DRF APIViews that receive cookies.

    DRF's APIView is normally csrf_exempt because it uses explicit API
    authentication. Login/refresh/logout in PIXIU additionally use an
    HttpOnly refresh cookie, so those endpoints need CSRF protection of their
    own. We call Django's middleware directly to avoid weakening the rest of
    the API and preserve JSON error responses.
    """
    middleware = CsrfViewMiddleware(lambda request: JsonResponse({"detail": "CSRF validation failed."}, status=403))

    def _non_exempt_callback(req):
        return None
    _non_exempt_callback.csrf_exempt = False

    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        raw_request = getattr(request, "_request", request)
        if hasattr(raw_request, "csrf_processing_done"):
            raw_request.csrf_processing_done = False
        raw_request._dont_enforce_csrf_checks = False
        rejection = middleware.process_view(raw_request, _non_exempt_callback, args, kwargs)
        if rejection is not None:
            return JsonResponse({"detail": "CSRF validation failed."}, status=403)
        return view_func(request, *args, **kwargs)

    return wrapped
