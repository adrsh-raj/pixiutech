from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import School, Trainer
from .credentials import set_managed_password
from .models import UserRole
from .permissions import IsActiveAccount, IsAdminRole
from .serializers import ResetManagedPasswordSerializer


class _ProfilePasswordResetView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAccount, IsAdminRole]
    profile_model = None
    role = None

    @transaction.atomic
    def post(self, request, pk):
        profile = self.profile_model.objects.select_related("account").filter(pk=pk).first()
        if profile is None:
            return Response({"detail": "Account profile not found."}, status=status.HTTP_404_NOT_FOUND)

        account = getattr(profile, "account", None)
        if account is None:
            return Response({"detail": "Login account has not been provisioned for this profile."}, status=status.HTTP_409_CONFLICT)
        if account.role != self.role:
            return Response({"detail": "Profile account role is inconsistent."}, status=status.HTTP_409_CONFLICT)

        serializer = ResetManagedPasswordSerializer(
            data={"new_password": request.data.get("password", "")},
            context={"target_user": account},
        )
        serializer.is_valid(raise_exception=True)
        set_managed_password(account, serializer.validated_data["new_password"], must_change=True)
        return Response({"success": True, "detail": "Password reset successfully."})


class SchoolProfilePasswordResetView(_ProfilePasswordResetView):
    profile_model = School
    role = UserRole.SCHOOL


class TrainerProfilePasswordResetView(_ProfilePasswordResetView):
    profile_model = Trainer
    role = UserRole.TRAINER
