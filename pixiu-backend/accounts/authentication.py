import hashlib

from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

from .models import User


class CachedJWTAuthentication(JWTAuthentication):
    """JWT authentication with a short-lived cache for the user DB lookup.

    The JWT is still cryptographically validated on every request. Only the
    database-backed User lookup is cached for a few seconds. This reduces the
    repeated authentication query that otherwise runs before every protected
    API request, while keeping account-state staleness bounded.
    """

    CACHE_PREFIX = "pixiu:jwt-user:v1"
    CACHE_SECONDS = 5

    def get_user(self, validated_token):
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        if user_id is None:
            return super().get_user(validated_token)

        key_material = str(user_id).encode("utf-8")
        cache_key = f"{self.CACHE_PREFIX}:{hashlib.sha256(key_material).hexdigest()}"
        cached = cache.get(cache_key)

        if cached is not None:
            return User(**cached)

        user = super().get_user(validated_token)
        payload = {
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
        }
        cache.set(cache_key, payload, timeout=self.CACHE_SECONDS)
        return user
