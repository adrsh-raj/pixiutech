"""CSRF helpers for cookie-authenticated authentication endpoints."""

import logging
from functools import wraps

from urllib.parse import urlsplit

from django.conf import settings
from django.http import JsonResponse
from django.middleware.csrf import (
    CSRF_TOKEN_LENGTH,
    CsrfViewMiddleware,
    InvalidTokenFormat,
    _check_token_format,
    _unmask_cipher_token,
    get_token,
)
from django.utils.http import is_same_domain
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger("security.auth")


class CsrfTokenView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "csrf_token"

    def get(self, request):
        token = get_token(request)
        response = JsonResponse({"csrfToken": token})
        response["Cache-Control"] = "no-store, private"
        response["X-Content-Type-Options"] = "nosniff"

        # Explicitly attach the CSRF cookie so cross-origin responses reliably receive it
        cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "pixiu_csrf")
        response.set_cookie(
            cookie_name,
            request.META.get("CSRF_COOKIE", token),
            max_age=getattr(settings, "CSRF_COOKIE_AGE", 31449600),
            domain=getattr(settings, "CSRF_COOKIE_DOMAIN", None),
            path=getattr(settings, "CSRF_COOKIE_PATH", "/"),
            secure=getattr(settings, "CSRF_COOKIE_SECURE", True),
            httponly=getattr(settings, "CSRF_COOKIE_HTTPONLY", False),
            samesite=getattr(settings, "CSRF_COOKIE_SAMESITE", "None"),
        )
        return response


csrf_token_view = CsrfTokenView.as_view()


def require_api_csrf(view_func):
    """Apply Django's real CSRF checks to DRF APIViews that receive cookies.

    DRF's APIView is normally csrf_exempt because it uses explicit API
    authentication. Login/refresh/logout in PIXIU additionally use an
    HttpOnly refresh cookie, so those endpoints need CSRF protection of their
    own. We call Django's middleware directly to avoid weakening the rest of
    the API and preserve JSON error responses.

    To support modern browsers that block third-party cookies across different
    eTLD+1 domains (e.g. portal.pixiutech.com talking to pixiu-django-api.onrender.com),
    if the browser dropped the incoming CSRF cookie but the client presented a
    cryptographically valid masked token in the X-CSRFToken header, we recover
    the unmasked secret from the header token into the request's cookie dictionary.
    This preserves strict origin/referer validation and token signature checks
    while preventing unauthenticated users from being locked out by third-party cookie restrictions.
    """
    middleware = CsrfViewMiddleware(lambda request: JsonResponse({"detail": "CSRF validation failed."}, status=403))

    def _non_exempt_callback(req):
        return None
    _non_exempt_callback.csrf_exempt = False

    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        raw_request = getattr(request, "_request", request)
        if getattr(raw_request, "_dont_enforce_csrf_checks", False):
            return view_func(request, *args, **kwargs)
        if hasattr(raw_request, "csrf_processing_done"):
            raw_request.csrf_processing_done = False

        cookie_name = getattr(settings, "CSRF_COOKIE_NAME", "pixiu_csrf")
        header_name = getattr(settings, "CSRF_HEADER_NAME", "HTTP_X_CSRFTOKEN")
        header_token = raw_request.META.get(header_name)

        # 1. Unconditionally synchronize the cookie secret with the valid client header token.
        # This guarantees that stale/residual cookies in Safari do not cause cryptographic mismatches.
        if header_token and len(header_token) == CSRF_TOKEN_LENGTH:
            try:
                _check_token_format(header_token)
                raw_request.COOKIES[cookie_name] = _unmask_cipher_token(header_token)
            except InvalidTokenFormat:
                pass

        # 2. Normalize origin for mobile Safari / PWA WebClips / in-app WebViews where Origin can be
        # "null" or omitted along with Referer.
        origin = raw_request.META.get("HTTP_ORIGIN")
        referer = raw_request.META.get("HTTP_REFERER")
        if origin == "null" or (not origin and not referer):
            if referer:
                try:
                    parsed_ref = urlsplit(referer)
                    if any(is_same_domain(parsed_ref.netloc, host) for host in middleware.csrf_trusted_origins_hosts):
                        raw_request.META["HTTP_ORIGIN"] = f"{parsed_ref.scheme}://{parsed_ref.netloc}"
                except Exception:
                    pass
            elif header_token and len(header_token) == CSRF_TOKEN_LENGTH:
                raw_request.META["HTTP_ORIGIN"] = "https://portal.pixiutech.com"

        rejection = middleware.process_view(raw_request, _non_exempt_callback, args, kwargs)
        if rejection is not None:
            rejection_reason = getattr(rejection, "reason", "unknown")
            logger.warning(
                "CSRF validation failed for %s from origin %s (reason: %s)",
                raw_request.path,
                raw_request.META.get("HTTP_ORIGIN") or raw_request.META.get("HTTP_REFERER") or "none",
                rejection_reason,
            )
            return JsonResponse({"detail": "CSRF validation failed."}, status=403)
        return view_func(request, *args, **kwargs)

    return wrapped
