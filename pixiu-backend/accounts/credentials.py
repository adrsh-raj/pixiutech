import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User, UserRole, UserStatus

STUDENT_PASSWORD_SUFFIX = "@hata"


def validate_managed_password(password: str, role: str) -> None:
    if not isinstance(password, str) or not password:
        raise ValueError("Password is required.")

    minimum = 12 if role == UserRole.TRAINER else 8
    if len(password) < minimum:
        raise ValueError(f"Password must be at least {minimum} characters.")

    try:
        validate_password(password)
    except ValidationError as exc:
        raise ValueError(" ".join(exc.messages)) from exc


def normalize_login_username(username: str) -> str:
    if not isinstance(username, str):
        raise ValueError("Username is required.")
    value = username.strip()
    if not value:
        raise ValueError("Username is required.")
    if len(value) > 150:
        raise ValueError("Username must not exceed 150 characters.")
    return value


def build_student_username(school_code: str, grade: str, section: str, roll_number: int) -> str:
    school = str(school_code or "").strip().upper()
    grade_value = str(grade or "").strip().upper()
    section_value = str(section or "").strip().upper()

    if not re.fullmatch(r"[A-Z0-9]{2,20}", school):
        raise ValueError("School code must contain only letters and numbers.")
    if not re.fullmatch(r"[0-9]{1,2}", grade_value):
        raise ValueError("Grade must be a numeric value between 0 and 99.")
    if not re.fullmatch(r"[A-Z0-9]{1,5}", section_value):
        raise ValueError("Section must contain 1-5 letters or numbers.")
    if isinstance(roll_number, bool) or not isinstance(roll_number, int) or roll_number < 1 or roll_number > 99:
        raise ValueError("Roll number must be an integer from 1 to 99.")

    return f"{school}{grade_value}{section_value} {roll_number:02d}"


def build_student_password(school_code: str, student_username: str) -> str:
    """Build the agreed deterministic student password format.

    Example: XYZ8A 03 -> XYZxyz8A3@hata.
    The leading school-code portion inside the compact username is lowercase,
    while grade/section casing is preserved and the two-digit roll suffix drops
    its presentation padding. The suffix is fixed by the PIXIU credential rule.
    """
    school = str(school_code or "").strip().upper()
    username = normalize_login_username(student_username)
    compact = re.sub(r"\s+", "", username)
    if not compact.upper().startswith(school):
        raise ValueError("Student username must begin with the school code.")

    compact = school.lower() + compact[len(school):]
    compact = re.sub(r"(\d{2})$", lambda match: str(int(match.group(1))), compact)
    return f"{school}{compact}{STUDENT_PASSWORD_SUFFIX}"


def revoke_all_refresh_tokens(user: User) -> None:
    """Invalidate every outstanding refresh token belonging to an account."""
    for token_record in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token_record)


def set_managed_password(user: User, password: str, *, must_change: bool = True) -> User:
    validate_managed_password(password, user.role)
    user.set_password(password)
    user.must_change_password = must_change
    user.status = UserStatus.ACTIVE
    user.is_active = True
    user.save(update_fields=["password", "must_change_password", "status", "is_active"])
    revoke_all_refresh_tokens(user)
    return user


def create_or_reset_managed_account(
    *,
    username: str,
    password: str,
    role: str,
    display_name: str = "",
    email: str = "",
) -> tuple[User, bool]:
    if role not in {UserRole.SCHOOL, UserRole.TRAINER}:
        raise ValueError("Only school and trainer accounts can be managed by this operation.")

    username = normalize_login_username(username)
    validate_managed_password(password, role)

    user = User.objects.filter(username=username).first()
    created = user is None

    if user is None:
        user = User(username=username, role=role)
    elif user.role != role:
        raise ValueError("Username already belongs to a different account role.")

    user.role = role
    user.display_name = display_name.strip()
    user.email = email.strip()
    user.set_password(password)
    user.must_change_password = True
    user.status = UserStatus.ACTIVE
    user.is_active = True
    user.is_staff = False
    user.is_superuser = False
    user.save()
    revoke_all_refresh_tokens(user)
    return user, created
