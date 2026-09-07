from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .credentials import create_or_reset_managed_account, set_managed_password
from .models import User, UserRole
from .permissions import IsAdminRole, IsActiveAccount
from .serializers import (
    ChangeOwnPasswordSerializer,
    LoginSerializer,
    ManagedAccountSerializer,
    ResetManagedPasswordSerializer,
    UserMeSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            if "selected login type" in str(serializer.errors):
                return Response(serializer.errors, status=status.HTTP_403_FORBIDDEN)
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return Response(
            {
                "success": True,
                "access": serializer.validated_data["access"],
                "refresh": serializer.validated_data["refresh"],
                "user": UserMeSerializer(user).data,
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def get(self, request):
        return Response({"success": True, "user": UserMeSerializer(request.user).data})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh_token).blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"success": True}, status=status.HTTP_205_RESET_CONTENT)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]
    authentication_classes = []


class ChangeOwnPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]

    def post(self, request):
        serializer = ChangeOwnPasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response({"success": True, "detail": "Password changed successfully."})


class ManagedAccountView(APIView):
    """Admin-only create/reset entry point for school and trainer accounts."""

    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        serializer = ManagedAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, created = create_or_reset_managed_account(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
            role=serializer.validated_data["role"],
            display_name=serializer.validated_data.get("display_name", ""),
            email=serializer.validated_data.get("email", ""),
        )
        return Response(
            {
                "success": True,
                "created": created,
                "user": UserMeSerializer(user).data,
                "detail": "Account created." if created else "Account password and profile updated.",
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ManagedPasswordResetView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminRole]

    @transaction.atomic
    def post(self, request, username):
        user = User.objects.filter(username=username.strip()).first()
        if user is None:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.role not in {UserRole.SCHOOL, UserRole.TRAINER}:
            return Response({"detail": "Only school and trainer accounts can be reset here."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ResetManagedPasswordSerializer(
            data=request.data,
            context={"target_user": user},
        )
        serializer.is_valid(raise_exception=True)
        set_managed_password(user, serializer.validated_data["new_password"], must_change=True)
        return Response({"success": True, "detail": "Password reset successfully."})
