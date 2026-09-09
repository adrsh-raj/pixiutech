from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole, UserStatus
from accounts.permissions import IsActiveAccount
from audit.services import record_audit
from .models import School
from .serializers import SchoolSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsActiveAccount])
def activate_school(request, pk):
    if request.user.role != UserRole.ADMIN:
        raise PermissionDenied("Only administrators can activate a school.")

    school = School.objects.select_related("account").filter(pk=pk).first()
    if school is None:
        raise ValidationError({"school": "School not found."})

    school.status = "active"
    school.save(update_fields=["status", "updated_at"])

    # Activation makes the school operational in the academic database. Portal
    # credentials remain independently controlled by School Credentials.
    if school.account_id:
        account = school.account
        if account.status == UserStatus.INACTIVE:
            account.status = UserStatus.INACTIVE
            account.is_active = False
            account.save(update_fields=["status", "is_active"])

    record_audit(
        actor=request.user,
        action="update",
        entity_type="school",
        entity_id=school.id,
        summary=f"School {school.school_code} activated",
        request=request,
    )
    return Response(SchoolSerializer(school, context={"request": request}).data, status=status.HTTP_200_OK)
