import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.db.models import F
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User, UserRole, UserStatus

STUDENT_TEMP_PIN_LENGTH = 8
STUDENT_TEMP_PIN_ALPHABET = "0123456789"


def login_max_failed_attempts() -> int:
    return max(1, int(getattr(settings, "LOGIN_MAX_FAILED_ATTEMPTS", 5)))


def login_lockout_minutes() -> int:
    return max(1, int(getattr(settings, "LOGIN_LOCKOUT_MINUTES", 15)))


def login_is_locked(user, now=None):
    now = now or timezone.now()
    return bool(user.locked_until and user.locked_until > now)


def clear_login_failures(user):
    changed = user.failed_login_attempts != 0 or user.locked_until is not None
    if changed:
        user.failed_login_attempts = 0
        user.locked_until = None
    return changed


def record_failed_login(user, now=None):
    now = now or timezone.now()
    attempts = int(user.failed_login_attempts or 0) + 1
    max_attempts = login_max_failed_attempts()
    user.failed_login_attempts = min(attempts, max_attempts)
    if attempts >= max_attempts:
        user.locked_until = now + timedelta(minutes=login_lockout_minutes())
    user.save(update_fields=["failed_login_attempts", "locked_until"])
    return attempts


def bump_auth_version(user):
    """Atomically invalidate all access tokens issued before this credential change."""
    User.objects.filter(pk=user.pk).update(
        auth_version=F("auth_version") + 1,
        failed_login_attempts=0,
        locked_until=None,
    )
    user.refresh_from_db(fields=["auth_version", "failed_login_attempts", "locked_until"])
    try:
        import hashlib
        from django.core.cache import cache

        key_material = str(user.pk).encode("utf-8")
        cache_key = f"pixiu:jwt-user:v2:{hashlib.sha256(key_material).hexdigest()}"
        cache.delete(cache_key)
    except Exception:
        pass


def invalidate_user_sessions(user):
    """Invalidate existing access and refresh tokens after a credential change."""
    bump_auth_version(user)
    revoke_all_refresh_tokens(user)


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


def generate_student_temp_pin() -> str:
    """Generate an 8-digit cryptographically secure temporary student PIN."""
    return "".join(secrets.choice(STUDENT_TEMP_PIN_ALPHABET) for _ in range(STUDENT_TEMP_PIN_LENGTH))


def revoke_all_refresh_tokens(user: User) -> None:
    for token_record in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token_record)


def set_managed_password(user: User, password: str, *, must_change: bool = True) -> User:
    validate_managed_password(password, user.role)
    user.set_password(password)
    user.must_change_password = must_change
    user.status = UserStatus.ACTIVE
    user.is_active = True
    user.save(update_fields=["password", "must_change_password", "status", "is_active"])
    invalidate_user_sessions(user)
    return user


def create_or_reset_managed_account(*, username: str, password: str, role: str, display_name: str = "", email: str = "") -> tuple[User, bool]:
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
    invalidate_user_sessions(user)
    return user, created
