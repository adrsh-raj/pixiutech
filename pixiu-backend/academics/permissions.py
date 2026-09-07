from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

from accounts.permissions import HasActionPermission, IsActiveAccount

from .services import detail_scope_allows


class AcademicPermission(HasActionPermission, IsActiveAccount):
    """Authentication + business-action + domain scope permission."""

    def has_object_permission(self, request, view, obj):
        if not detail_scope_allows(request.user, obj):
            raise PermissionDenied("You do not have access to this record.")
        return True


class AdminCreatePermission(IsActiveAccount):
    """Only an active administrator may create/assign master records."""

    def has_permission(self, request, view):
        super().has_permission(request, view)
        user = request.user
        return bool(user and user.is_authenticated and user.role == "admin" and user.is_staff)


class ScopePermission(BasePermission):
    """Object-level scope check used after a queryset lookup."""

    message = "You do not have access to this record."

    def has_object_permission(self, request, view, obj):
        return detail_scope_allows(request.user, obj)
