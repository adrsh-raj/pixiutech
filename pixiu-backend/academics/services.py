from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone

from accounts.credentials import build_student_username, create_or_reset_managed_account, generate_student_temp_pin, revoke_all_refresh_tokens, invalidate_user_sessions
from accounts.models import User, UserRole, UserStatus

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment


def _clean_or_error(value: str, field: str) -> str:
    value = str(value or "").strip()
    if not value:
        raise ValueError(f"{field} is required.")
    return value


def next_trainer_id() -> str:
    number = 1
    while Trainer.objects.filter(trainer_id=f"TR-{number:03d}").exists(): number += 1
    return f"TR-{number:03d}"


def _current_trainer_school_ids(user):
    today = timezone.localdate()
    return TrainerSchoolAssignment.objects.filter(trainer__account_id=user.id, status="active", assigned_from__lte=today).filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=today)).values("school_id")


def create_school_account(*, school: School) -> User:
    username = str(school.school_code or "").strip().upper()
    if not username:
        raise ValueError("School code is required.")

    # Lock an existing username row so two admins cannot race while linking a
    # school profile to the same managed login.
    existing = User.objects.select_for_update().filter(username=username).first()
    if existing:
        if existing.role != UserRole.SCHOOL:
            raise ValueError(f"School code '{username}' is already used by a different account role.")
        if existing.school_profile_id not in (None, school.id):
            raise ValueError(f"School code '{username}' is already linked to another school.")

    user = existing or User(username=username, role=UserRole.SCHOOL)
    user.role = UserRole.SCHOOL
    user.display_name = school.name
    user.email = school.email
    user.status = UserStatus.INACTIVE
    user.is_active = False
    user.set_unusable_password()
    user.save()

    school.account = user
    school.save(update_fields=["account", "updated_at"])
    return user


def create_trainer_account(*, trainer: Trainer, password: str) -> User:
    user, _ = create_or_reset_managed_account(username=trainer.trainer_id, password=password, role=UserRole.TRAINER, display_name=trainer.name, email=trainer.email)
    if trainer.status != "active":
        user.status = UserStatus.INACTIVE; user.is_active = False; user.save(update_fields=["status", "is_active"])
    trainer.account = user; trainer.save(update_fields=["account", "updated_at"]); return user


@transaction.atomic
def provision_student(*, student: Student) -> tuple[Student, str]:
    school_class = SchoolClass.objects.select_for_update().select_related("school").get(pk=student.school_class_id)
    username = build_student_username(school_class.school.school_code, school_class.grade, school_class.section, student.roll_number)
    temp_pin = generate_student_temp_pin()
    if Student.objects.filter(student_id=username).exclude(pk=student.pk).exists(): raise ValueError("Generated student ID already exists. Choose a different class/roll number.")
    existing_user = User.objects.filter(username=username).first()
    if existing_user and existing_user.role != UserRole.STUDENT: raise ValueError("Generated student username is already used by another account role.")
    student.student_id = username; student.name = _clean_or_error(student.name, "Student name"); student.save()
    user = existing_user or User(username=username, role=UserRole.STUDENT)
    user.role = UserRole.STUDENT; user.display_name = student.name; user.email = student.email; user.status = UserStatus.ACTIVE; user.is_active = True; user.must_change_password = True; user.set_password(temp_pin); user.save()
    student.account = user; student.save(update_fields=["account", "updated_at"])
    return student, temp_pin


def reset_student_to_temp_pin(student: Student) -> str:
    if not student.account_id: raise ValueError("Student does not have a linked login account.")
    account = student.account
    if account.role != UserRole.STUDENT: raise ValueError("Linked account is not a student account.")
    temp_pin = generate_student_temp_pin()
    account.set_password(temp_pin); account.must_change_password = True; account.status = UserStatus.ACTIVE if student.status == "active" else UserStatus.INACTIVE; account.is_active = student.status == "active"
    account.save(update_fields=["password", "must_change_password", "status", "is_active"]); invalidate_user_sessions(account)
    return temp_pin


def assert_school_access(user, school: School) -> bool:
    if user.role == UserRole.ADMIN: return True
    if user.role == UserRole.SCHOOL: return school.account_id == user.id
    if user.role == UserRole.TRAINER:
        return TrainerSchoolAssignment.objects.filter(trainer__account_id=user.id, school_id=school.id, status="active", assigned_from__lte=timezone.localdate()).filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=timezone.localdate())).exists()
    if user.role == UserRole.STUDENT: return Student.objects.filter(account_id=user.id, school_class__school_id=school.id).exists()
    return False


def accessible_school_queryset(user):
    qs = School.objects.all()
    if user.role == UserRole.ADMIN: return qs
    if user.role == UserRole.SCHOOL: return qs.filter(account_id=user.id)
    if user.role == UserRole.TRAINER: return qs.filter(id__in=_current_trainer_school_ids(user)).distinct()
    if user.role == UserRole.STUDENT: return qs.filter(classes__students__account_id=user.id).distinct()
    return qs.none()


def accessible_class_queryset(user):
    qs = SchoolClass.objects.select_related("school").annotate(active_student_count=Count("students", filter=Q(students__status="active"), distinct=True))
    if user.role == UserRole.ADMIN: return qs
    if user.role == UserRole.SCHOOL: return qs.filter(school__account_id=user.id)
    if user.role == UserRole.TRAINER: return qs.filter(school_id__in=_current_trainer_school_ids(user)).distinct()
    if user.role == UserRole.STUDENT: return qs.filter(students__account_id=user.id).distinct()
    return qs.none()


def accessible_student_queryset(user):
    qs = Student.objects.select_related("school_class__school", "account")
    if user.role == UserRole.ADMIN: return qs
    if user.role == UserRole.SCHOOL: return qs.filter(school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER: return qs.filter(school_class__school_id__in=_current_trainer_school_ids(user)).distinct()
    if user.role == UserRole.STUDENT: return qs.filter(account_id=user.id)
    return qs.none()


def accessible_trainer_queryset(user):
    qs = Trainer.objects.select_related("account")
    if user.role == UserRole.ADMIN: return qs
    if user.role == UserRole.TRAINER: return qs.filter(account_id=user.id)
    if user.role == UserRole.SCHOOL: return qs.filter(school_assignments__school__account_id=user.id).distinct()
    if user.role == UserRole.STUDENT: return qs.filter(school_assignments__school__classes__students__account_id=user.id, school_assignments__status="active").distinct()
    return qs.none()


def accessible_assignment_queryset(user):
    qs = TrainerSchoolAssignment.objects.select_related("trainer", "school")
    if user.role == UserRole.ADMIN: return qs
    if user.role == UserRole.TRAINER: return qs.filter(trainer__account_id=user.id)
    if user.role == UserRole.SCHOOL: return qs.filter(school__account_id=user.id)
    if user.role == UserRole.STUDENT: return qs.filter(school__classes__students__account_id=user.id).distinct()
    return qs.none()


def detail_scope_allows(user, obj) -> bool:
    if user.role == UserRole.ADMIN: return True
    if isinstance(obj, School): return assert_school_access(user, obj)
    if isinstance(obj, SchoolClass): return accessible_class_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, Student): return accessible_student_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, Trainer): return accessible_trainer_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, TrainerSchoolAssignment): return accessible_assignment_queryset(user).filter(pk=obj.pk).exists()
    return False
