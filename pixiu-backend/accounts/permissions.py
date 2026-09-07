from rest_framework.permissions import BasePermission

from .models import UserRole, UserStatus


ROLE_ACTIONS = {
    UserRole.ADMIN: frozenset(
        {
            "VIEW",
            "CREATE",
            "EDIT",
            "DELETE",
            "PUBLISH",
            "ASSIGN",
            "GRADE",
            "RATE",
            "EXPORT",
        }
    ),
    UserRole.SCHOOL: frozenset({"VIEW", "CREATE", "EDIT", "EXPORT"}),
    UserRole.TRAINER: frozenset({"VIEW", "CREATE", "EDIT", "GRADE", "RATE"}),
    UserRole.STUDENT: frozenset({"VIEW", "CREATE"}),
}


class IsActiveAccount(BasePermission):
    message = "This account is not active."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and getattr(user, "status", UserStatus.ACTIVE) == UserStatus.ACTIVE
        )


class HasActionPermission(BasePermission):
    """Require a named business action in addition to authentication.

    Views opt in with `required_action = "VIEW"`, `"EDIT"`, etc. Scope checks
    for a school/class/student happen in the domain-specific queryset/object
    permissions built in later phases.
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        action = getattr(view, "required_action", None)
        if not action:
            return True

        role = getattr(user, "role", None)
        return action.upper() in ROLE_ACTIONS.get(role, frozenset())


class IsAdminRole(BasePermission):
    message = "Administrator access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and getattr(user, "status", None) == UserStatus.ACTIVE
            and getattr(user, "role", None) == UserRole.ADMIN
            and user.is_staff
        )
