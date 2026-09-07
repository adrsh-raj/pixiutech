from django.contrib.auth.models import AbstractUser, UserManager
from django.core.exceptions import ValidationError
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    SCHOOL = "school", "School"
    TRAINER = "trainer", "Trainer"
    STUDENT = "student", "Student"


class UserStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    INACTIVE = "inactive", "Inactive"


class AccountUserManager(UserManager):
    use_in_migrations = True

    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError("Username is required.")
        role = extra_fields.get("role")
        if not role:
            raise ValueError("Role is required for PIXIU users.")
        username = username.strip()
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields["role"] = UserRole.ADMIN
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        extra_fields["is_active"] = True
        extra_fields["status"] = UserStatus.ACTIVE
        return self.create_user(username, password, **extra_fields)


class User(AbstractUser):
    username = models.CharField(max_length=150, unique=True)
    role = models.CharField(max_length=20, choices=UserRole.choices)
    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.ACTIVE,
    )
    must_change_password = models.BooleanField(default=False)
    display_name = models.CharField(max_length=200, blank=True)

    objects = AccountUserManager()
    REQUIRED_FIELDS = []

    def clean(self):
        super().clean()
        self.username = self.username.strip()
        if not self.role:
            raise ValidationError({"role": "A PIXIU user role is required."})
        if self.role != UserRole.ADMIN and (self.is_staff or self.is_superuser):
            raise ValidationError("Only admin-role users may be staff or superusers.")
        if self.role == UserRole.ADMIN and self.is_superuser:
            self.is_staff = True

    def save(self, *args, **kwargs):
        self.username = self.username.strip()
        if not self.display_name:
            self.display_name = " ".join(
                part for part in [self.first_name.strip(), self.last_name.strip()] if part
            )
        if self.role != UserRole.ADMIN:
            self.is_staff = False
            self.is_superuser = False
        elif self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"
