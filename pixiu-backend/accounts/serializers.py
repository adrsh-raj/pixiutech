import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .credentials import normalize_login_username, validate_managed_password
from .models import User, UserRole, UserStatus

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_ACTION = "login"
USER_PROFILE_CACHE_TTL = 30


def verify_turnstile_token(token, remote_ip=None):
    """Validate a Turnstile token server-side with Cloudflare.

    A missing deployment secret is treated as an unavailable optional verifier
    rather than allowing configuration drift to turn the login endpoint into a
    HTTP 500. When configured, verification failures still fail closed.
    """
    secret = settings.CLOUDFLARE_TURNSTILE_SECRET_KEY
    if not secret:
        return None
    payload = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip
    body = parse.urlencode(payload).encode("utf-8")
    req = urllib_request.Request(
        TURNSTILE_VERIFY_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception:
        return False
    return bool(result.get("success")) and result.get("action") == TURNSTILE_ACTION


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        secret = settings.CLOUDFLARE_TURNSTILE_SECRET_KEY
        if settings.CLOUDFLARE_TURNSTILE_ENABLED and secret:
            token = attrs.get("turnstile_token", "").strip()
            if not token:
                raise serializers.ValidationError({"detail": "Please complete the security check."})
            if verify_turnstile_token(token, request.META.get("REMOTE_ADDR") if request else None) is not True:
                raise serializers.ValidationError({"detail": "Security verification failed. Please try again."})
        username = normalize_login_username(attrs["username"])
        user = User.objects.filter(username=username).first()
        if user is None:
            candidates = User.objects.filter(username__iexact=username)
            if candidates.count() == 1:
                user = candidates.first()
        if user is None:
            raise serializers.ValidationError({"detail": "Invalid username or password."})
        user = authenticate(request=request, username=user.username, password=attrs["password"])
        if user is None:
            raise serializers.ValidationError({"detail": "Invalid username or password."})
        if not user.is_active or user.status != UserStatus.ACTIVE:
            raise serializers.ValidationError({"detail": "This account is not active."})
        requested_role = attrs.get("role")
        if requested_role and user.role != requested_role:
            raise serializers.ValidationError({"detail": "This account is not permitted to use the selected login type."})
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["username"] = user.username
        refresh["display_name"] = user.display_name or user.get_full_name() or user.username
        attrs["user"] = user
        attrs["access"] = str(refresh.access_token)
        attrs["refresh"] = str(refresh)
        return attrs


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    related_id = serializers.SerializerMethodField()
    school_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "first_name", "last_name", "full_name", "name", "display_name", "email",
            "role", "status", "must_change_password", "related_id", "school_id",
        )
        read_only_fields = fields

    def _related(self, obj, relation):
        try:
            return getattr(obj, relation)
        except Exception:
            return None

    def _profile_scope(self, obj):
        if obj.role == UserRole.ADMIN:
            return {"related_id": None, "school_id": None}
        key = f"user-me-profile:v1:{obj.pk}:{obj.role}"
        cached = cache.get(key)
        if cached is not None:
            return cached
        result = {"related_id": None, "school_id": None}
        if obj.role == UserRole.SCHOOL:
            profile = self._related(obj, "school_profile")
            school_code = getattr(profile, "school_code", None) if profile else None
            result = {"related_id": school_code or "", "school_id": school_code}
        elif obj.role == UserRole.TRAINER:
            profile = self._related(obj, "trainer_profile")
            trainer_id = getattr(profile, "trainer_id", "") if profile else ""
            assignment = profile.school_assignments.filter(status="active").select_related("school").first() if profile else None
            school_code = assignment.school.school_code if assignment and assignment.school else None
            result = {"related_id": trainer_id, "school_id": school_code}
        elif obj.role == UserRole.STUDENT:
            profile = self._related(obj, "student_profile")
            student_id = getattr(profile, "student_id", "") if profile else ""
            school_class = getattr(profile, "school_class", None) if profile else None
            school = getattr(school_class, "school", None) if school_class else None
            school_code = getattr(school, "school_code", None)
            result = {"related_id": student_id, "school_id": school_code}
        cache.set(key, result, USER_PROFILE_CACHE_TTL)
        return result

    def get_full_name(self, obj):
        return obj.get_full_name().strip() or obj.display_name or obj.username

    def get_name(self, obj):
        return self.get_full_name(obj)

    def get_related_id(self, obj):
        return self._profile_scope(obj)["related_id"]

    def get_school_id(self, obj):
        return self._profile_scope(obj)["school_id"]


class ChangeOwnPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({"new_password": "New password must differ from the current password."})
        try:
            validate_managed_password(attrs["new_password"], user.role)
        except ValueError as exc:
            raise serializers.ValidationError({"new_password": str(exc)}) from exc
        return attrs


class ManagedAccountSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=[UserRole.SCHOOL, UserRole.TRAINER])
    display_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        try:
            attrs["username"] = normalize_login_username(attrs["username"])
            validate_managed_password(attrs["password"], attrs["role"])
        except ValueError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc
        return attrs


class ResetManagedPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        user = self.context.get("target_user")
        if not user or user.role not in {UserRole.SCHOOL, UserRole.TRAINER}:
            raise serializers.ValidationError("Only school and trainer accounts can be reset here.")
        try:
            validate_managed_password(value, user.role)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return value
