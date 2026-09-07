from django.db import transaction
from django.db.models import Q

from accounts.credentials import build_student_password, build_student_username
from accounts.models import User, UserRole, UserStatus

from .models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment


def _clean_or_error(value: str, field: str) -> str:
    value = str(value or "").strip()
    if not value:
        raise ValueError(f"{field} is required.")
    return value


def create_school_account(*, school: School) -> User:
    username = school.school_code
    existing = User.objects.filter(username=username).first()
    if existing and (existing.role != UserRole.SCHOOL or existing.school_profile_id != school.id):
        raise ValueError("School code is already used by another account.")
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


def create_trainer_account(*, trainer: Trainer) -> User:
    username = trainer.trainer_id
    existing = User.objects.filter(username=username).first()
    if existing and (existing.role != UserRole.TRAINER or existing.trainer_profile_id != trainer.id):
        raise ValueError("Trainer ID is already used by another account.")
    user = existing or User(username=username, role=UserRole.TRAINER)
    user.role = UserRole.TRAINER
    user.display_name = trainer.name
    user.email = trainer.email
    user.status = UserStatus.INACTIVE
    user.is_active = False
    user.set_unusable_password()
    user.save()
    trainer.account = user
    trainer.save(update_fields=["account", "updated_at"])
    return user


@transaction.atomic
def provision_student(*, student: Student) -> tuple[Student, str]:
    student.school_class_id = student.school_class_id
    school_class = SchoolClass.objects.select_for_update().select_related("school").get(pk=student.school_class_id)
    username = build_student_username(
        school_class.school.school_code,
        school_class.grade,
        school_class.section,
        student.roll_number,
    )
    password = build_student_password(school_class.school.school_code, username)

    if Student.objects.filter(student_id=username).exclude(pk=student.pk).exists():
        raise ValueError("Generated student ID already exists. Choose a different class/roll number.")

    existing_user = User.objects.filter(username=username).first()
    if existing_user and existing_user.role != UserRole.STUDENT:
        raise ValueError("Generated student username is already used by another account role.")

    student.student_id = username
    student.name = _clean_or_error(student.name, "Student name")
    student.save()

    user = existing_user or User(username=username, role=UserRole.STUDENT)
    user.role = UserRole.STUDENT
    user.display_name = student.name
    user.email = student.email
    user.status = UserStatus.ACTIVE
    user.is_active = True
    user.must_change_password = True
    user.set_password(password)
    user.save()

    student.account = user
    student.save(update_fields=["account", "updated_at"])
    return student, password


def assert_school_access(user, school: School) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.SCHOOL:
        return school.account_id == user.id
    if user.role == UserRole.TRAINER:
        return TrainerSchoolAssignment.objects.filter(
            trainer__account_id=user.id,
            school_id=school.id,
            status="active",
        ).exists()
    if user.role == UserRole.STUDENT:
        return Student.objects.filter(account_id=user.id, school_class__school_id=school.id).exists()
    return False


def accessible_school_queryset(user):
    qs = School.objects.all()
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.SCHOOL:
        return qs.filter(account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(trainer_assignments__trainer__account_id=user.id, trainer_assignments__status="active").distinct()
    if user.role == UserRole.STUDENT:
        return qs.filter(classes__students__account_id=user.id).distinct()
    return qs.none()


def accessible_class_queryset(user):
    qs = SchoolClass.objects.select_related("school")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.SCHOOL:
        return qs.filter(school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(school__trainer_assignments__trainer__account_id=user.id, school__trainer_assignments__status="active").distinct()
    if user.role == UserRole.STUDENT:
        return qs.filter(students__account_id=user.id).distinct()
    return qs.none()


def accessible_student_queryset(user):
    qs = Student.objects.select_related("school_class__school", "account")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.SCHOOL:
        return qs.filter(school_class__school__account_id=user.id)
    if user.role == UserRole.TRAINER:
        return qs.filter(
            school_class__school__trainer_assignments__trainer__account_id=user.id,
            school_class__school__trainer_assignments__status="active",
        ).distinct()
    if user.role == UserRole.STUDENT:
        return qs.filter(account_id=user.id)
    return qs.none()


def accessible_trainer_queryset(user):
    qs = Trainer.objects.select_related("account")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.TRAINER:
        return qs.filter(account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(school_assignments__school__account_id=user.id).distinct()
    if user.role == UserRole.STUDENT:
        return qs.filter(
            school_assignments__school__classes__students__account_id=user.id,
            school_assignments__status="active",
        ).distinct()
    return qs.none()


def accessible_assignment_queryset(user):
    qs = TrainerSchoolAssignment.objects.select_related("trainer", "school")
    if user.role == UserRole.ADMIN:
        return qs
    if user.role == UserRole.TRAINER:
        return qs.filter(trainer__account_id=user.id)
    if user.role == UserRole.SCHOOL:
        return qs.filter(school__account_id=user.id)
    if user.role == UserRole.STUDENT:
        return qs.filter(school__classes__students__account_id=user.id).distinct()
    return qs.none()


def detail_scope_allows(user, obj) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if isinstance(obj, School):
        return assert_school_access(user, obj)
    if isinstance(obj, SchoolClass):
        return accessible_class_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, Student):
        return accessible_student_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, Trainer):
        return accessible_trainer_queryset(user).filter(pk=obj.pk).exists()
    if isinstance(obj, TrainerSchoolAssignment):
        return accessible_assignment_queryset(user).filter(pk=obj.pk).exists()
    return False
