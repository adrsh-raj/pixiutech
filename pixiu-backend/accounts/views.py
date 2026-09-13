import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from audit.services import record_audit
from .credentials import create_or_reset_managed_account, revoke_all_refresh_tokens, set_managed_password
from .models import User, UserRole
from .permissions import IsAdminRole, IsActiveAccount
from .serializers import ChangeOwnPasswordSerializer, LoginSerializer, ManagedAccountSerializer, ResetManagedPasswordSerializer, UserMeSerializer

logger = logging.getLogger(__name__)


def _set_refresh_cookie(response, refresh_token: str) -> None:
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.JWT_REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
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

        # Authentication itself must not be turned into a 500 by non-critical
        # bookkeeping (last_login or audit persistence).
        try:
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])
        except Exception:
            logger.exception("Login succeeded but last_login could not be updated", extra={"username": user.username})

        try:
            record_audit(
                actor=user,
                action="login",
                entity_type="user",
                entity_id=user.id,
                summary=f"{user.role} account authenticated",
                request=request,
            )
        except Exception:
            logger.exception("Login succeeded but audit record could not be written", extra={"username": user.username})

        try:
            user_data = UserMeSerializer(user).data
        except Exception:
            # A missing/stale optional school/trainer/student relation must not prevent
            # a successfully authenticated account from receiving its access token.
            logger.exception("User profile serialization failed during login", extra={"username": user.username})
            user_data = {
                "id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "full_name": user.get_full_name().strip() or user.display_name or user.username,
                "name": user.get_full_name().strip() or user.display_name or user.username,
                "display_name": user.display_name,
                "email": user.email,
                "role": user.role,
                "status": user.status,
                "must_change_password": user.must_change_password,
                "related_id": None,
                "school_id": None,
            }

        response = Response({"success": True, "access": serializer.validated_data["access"], "user": user_data})
        _set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    def get(self, request): return Response({"success": True, "user": UserMeSerializer(request.user).data})


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass
        response = Response({"success": True}, status=status.HTTP_205_RESET_CONTENT)
        _clear_refresh_cookie(response)
        if request.user.is_authenticated:
            try:
                record_audit(actor=request.user, action="logout", entity_type="user", entity_id=request.user.id, summary="Account logged out", request=request)
            except Exception:
                logger.exception("Logout audit record could not be written", extra={"username": request.user.username})
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        refresh_token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if not refresh_token:
            return Response({"detail": "Refresh session is not available."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            response = Response({"detail": "Refresh session is invalid or expired."}, status=status.HTTP_401_UNAUTHORIZED)
            _clear_refresh_cookie(response)
            return response
        data = serializer.validated_data
        response = Response({"success": True, "access": data["access"]}, status=status.HTTP_200_OK)
        rotated_refresh = data.get("refresh")
        if rotated_refresh:
            _set_refresh_cookie(response, rotated_refresh)
        return response


class ChangeOwnPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount]
    def post(self, request):
        serializer = ChangeOwnPasswordSerializer(data=request.data, context={"request": request}); serializer.is_valid(raise_exception=True)
        user = request.user; user.set_password(serializer.validated_data["new_password"]); user.must_change_password = False; user.save(update_fields=["password", "must_change_password"]); revoke_all_refresh_tokens(user)
        response = Response({"success": True, "detail": "Password changed successfully."})
        _clear_refresh_cookie(response)
        record_audit(actor=user, action="password_reset", entity_type="user", entity_id=user.id, summary="Own password changed", request=request)
        return response


class ManagedAccountView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminRole]
    @transaction.atomic
    def post(self, request):
        serializer = ManagedAccountSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        try:
            user, created = create_or_reset_managed_account(username=serializer.validated_data["username"], password=serializer.validated_data["password"], role=serializer.validated_data["role"], display_name=serializer.validated_data.get("display_name", ""), email=serializer.validated_data.get("email", ""))
        except ValueError as exc: return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record_audit(actor=request.user, action="create" if created else "update", entity_type="managed_account", entity_id=user.id, summary=f"Managed {user.role} account {'created' if created else 'updated'}", changes={"username": user.username, "role": user.role}, request=request)
        return Response({"success": True, "created": created, "user": UserMeSerializer(user).data, "detail": "Account created." if created else "Account password and profile updated."}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ManagedPasswordResetView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminRole]
    @transaction.atomic
    def post(self, request, username):
        user = User.objects.filter(username=username.strip()).first()
        if user is None: return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.role not in {UserRole.SCHOOL, UserRole.TRAINER}: return Response({"detail": "Only school and trainer accounts can be reset here."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ResetManagedPasswordSerializer(data=request.data, context={"target_user": user}); serializer.is_valid(raise_exception=True)
        set_managed_password(user, serializer.validated_data["new_password"], must_change=True)
        record_audit(actor=request.user, action="password_reset", entity_type="user", entity_id=user.id, summary=f"{user.role} account password reset", changes={"username": user.username, "role": user.role}, request=request)
        return Response({"success": True, "detail": "Password reset successfully."})
