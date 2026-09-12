import json
from urllib import parse, request as urllib_request

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .credentials import normalize_login_username, validate_managed_password
from .models import User, UserRole, UserStatus


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_ACTION = "login"


def verify_turnstile_token(token, remote_ip=None):
    """Validate a Turnstile token server-side with Cloudflare."""
    secret = settings.CLOUDFLARE_TURNSTILE_SECRET_KEY
    if not secret:
        raise RuntimeError("CLOUDFLARE_TURNSTILE_SECRET_KEY is not configured.")

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
        # Fail closed: a verifier/network error must never turn the public login
        # endpoint into an unprotected password-checking endpoint.
        return False

    # Bind this token to the login surface. This prevents a valid token minted for
    # another Turnstile action from being replayed against the login endpoint.
    return bool(result.get("success")) and result.get("action") == TURNSTILE_ACTION


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")

        if settings.CLOUDFLARE_TURNSTILE_ENABLED:
            token = attrs.get("turnstile_token", "").strip()
            if not token:
                raise serializers.ValidationError({"detail": "Please complete the security check."})
            if not verify_turnstile_token(token, request.META.get("REMOTE_ADDR") if request else None):
                raise serializers.ValidationError({"detail": "Security verification failed. Please try again."})

        username = normalize_login_username(attrs["username"])

        # Django's default ModelBackend performs an exact username lookup. Login IDs
        # such as TR-001 are operational identifiers and may be entered with different
        # casing, so resolve an unambiguous case-insensitive match first, then ask
        # Django to verify the password against the canonical stored username.
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

    def get_full_name(self, obj):
        return obj.get_full_name().strip() or obj.display_name or obj.username

    def get_name(self, obj):
        return self.get_full_name(obj)

    def get_related_id(self, obj):
        if obj.role == UserRole.SCHOOL:
            return getattr(getattr(obj, "school_profile", None), "school_code", "")
        if obj.role == UserRole.TRAINER:
            return getattr(getattr(obj, "trainer_profile", None), "trainer_id", "")
        if obj.role == UserRole.STUDENT:
            return getattr(getattr(obj, "student_profile", None), "student_id", "")
        return None

    def get_school_id(self, obj):
        profile = getattr(obj, "student_profile", None)
        if profile is not None:
            return profile.school_class.school.school_code
        profile = getattr(obj, "trainer_profile", None)
        if profile is not None:
            assignment = profile.school_assignments.filter(status="active").select_related("school").first()
            return assignment.school.school_code if assignment else None
        if obj.role == UserRole.SCHOOL:
            return getattr(getattr(obj, "school_profile", None), "school_code", None)
        return None


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
