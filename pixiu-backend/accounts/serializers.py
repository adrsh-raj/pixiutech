from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .credentials import normalize_login_username, validate_managed_password
from .models import User, UserRole, UserStatus


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)

    def validate(self, attrs):
        request = self.context.get("request")
        username = normalize_login_username(attrs["username"])
        user = authenticate(request=request, username=username, password=attrs["password"])

        if user is None:
            raise serializers.ValidationError({"detail": "Invalid username or password."})
        if not user.is_active or user.status != UserStatus.ACTIVE:
            raise serializers.ValidationError({"detail": "This account is not active."})

        requested_role = attrs.get("role")
        if requested_role and user.role != requested_role:
            raise serializers.ValidationError(
                {"detail": "This account is not permitted to use the selected login type."}
            )

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

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "display_name",
            "email",
            "role",
            "status",
            "must_change_password",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name().strip() or obj.display_name or obj.username


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
