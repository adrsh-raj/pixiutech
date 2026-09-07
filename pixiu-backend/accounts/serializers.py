from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, UserRole


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)

    def validate(self, attrs):
        request = self.context.get("request")
        username = attrs["username"].strip()
        password = attrs["password"]
        user = authenticate(request=request, username=username, password=password)

        if user is None:
            raise serializers.ValidationError(
                {"detail": "Invalid username or password."}, code="invalid_credentials"
            )
        if not user.is_active or user.status != "active":
            raise serializers.ValidationError(
                {"detail": "This account is not active."}, code="inactive_account"
            )

        requested_role = attrs.get("role")
        if requested_role and user.role != requested_role:
            raise serializers.ValidationError(
                {"detail": "This account is not permitted to use the selected login type."},
                code="role_mismatch",
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
            "role",
            "status",
            "must_change_password",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name().strip() or obj.display_name or obj.username
