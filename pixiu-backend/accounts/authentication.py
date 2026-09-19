import hashlib

from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

from .models import User, UserStatus


class CachedJWTAuthentication(JWTAuthentication):
    """JWT authentication with a short-lived user cache and session versioning."""

    CACHE_PREFIX = "pixiu:jwt-user:v2"
    CACHE_SECONDS = 5

    def get_user(self, validated_token):
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        if user_id is None:
            return super().get_user(validated_token)

        key_material = str(user_id).encode("utf-8")
        cache_key = f"{self.CACHE_PREFIX}:{hashlib.sha256(key_material).hexdigest()}"
        cached = cache.get(cache_key)

        if cached is not None:
            user = User(**cached)
        else:
            user = super().get_user(validated_token)
            cache.set(
                cache_key,
                {
                    "id": user.pk,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "display_name": user.display_name,
                    "role": user.role,
                    "status": user.status,
                    "is_active": user.is_active,
                    "is_staff": user.is_staff,
                    "is_superuser": user.is_superuser,
                    "auth_version": int(user.auth_version or 0),
                },
                timeout=self.CACHE_SECONDS,
            )

        token_version = int(validated_token.get("auth_version", 0) or 0)
        current_version = int(getattr(user, "auth_version", 0) or 0)
        if token_version != current_version:
            raise AuthenticationFailed(
                "Session has been invalidated. Please sign in again.",
                code="session_invalidated",
            )
        if not getattr(user, "is_active", False) or getattr(user, "status", None) != UserStatus.ACTIVE:
            raise AuthenticationFailed("This account is not active.", code="account_inactive")
        return user
