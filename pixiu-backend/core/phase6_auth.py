import os

import jwt
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


class ExpressJWTUser:
    def __init__(self, payload):
        self.payload = payload
        self.id = payload.get("id")
        self.username = payload.get("username") or ""
        self.role = payload.get("role") or ""
        self.name = payload.get("name") or self.username
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = self.role == "admin"
        self.is_superuser = False

    def __str__(self):
        return f"{self.username} ({self.role})"


class ExpressJWTAuthentication(BaseAuthentication):
    """Validate the existing LMS JWT for Phase 6 without creating a second login."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None
        if header[0].decode("utf-8").lower() != self.keyword.lower():
            return None
        if len(header) != 2:
            raise AuthenticationFailed("Invalid authorization header.")

        secret = os.environ.get("EXPRESS_JWT_SECRET") or os.environ.get("JWT_SECRET")
        if not secret or len(secret.strip()) < 32:
            raise AuthenticationFailed("Phase 6 JWT verification is not configured.")
        try:
            payload = jwt.decode(header[1].decode("utf-8"), secret.strip(), algorithms=["HS256"], options={"require": ["exp"]})
        except jwt.ExpiredSignatureError as exc:
            raise AuthenticationFailed("Session expired.") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed("Invalid session token.") from exc

        if payload.get("role") != "admin":
            raise AuthenticationFailed("Administrator access required.")
        return ExpressJWTUser(payload), payload
