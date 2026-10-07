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
    # Stable human-facing ID for privileged/admin accounts. Student, trainer and
    # school IDs remain owned by their role profiles and are exposed through the
    # unified serializer field.
    pixiu_id = models.CharField(max_length=80, unique=True, null=True, blank=True, editable=False)
    auth_version = models.PositiveIntegerField(default=0)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

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

    def _generate_admin_pixiu_id(self):
        raw = " ".join(
            part for part in [self.display_name.strip(), self.first_name.strip(), self.last_name.strip()]
            if part
        )
        base = "".join(ch for ch in raw.upper() if ch.isalnum())[:72]
        if not base or base.isdigit():
            base = "ADMIN"
        candidate = base
        suffix = 2
        while type(self).objects.filter(pixiu_id__iexact=candidate).exclude(pk=self.pk).exists():
            candidate = f"{base}{suffix}"
            suffix += 1
        return candidate[:80]

    def save(self, *args, **kwargs):
        self.username = self.username.strip()
        if not self.display_name:
            self.display_name = " ".join(
                part for part in [self.first_name.strip(), self.last_name.strip()] if part
            )
        if self.role != UserRole.ADMIN:
            self.is_staff = False
            self.is_superuser = False
            self.pixiu_id = None
        elif self.is_superuser:
            self.is_staff = True
        if self.role == UserRole.ADMIN and not self.pixiu_id:
            self.pixiu_id = self._generate_admin_pixiu_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.role})"


class StudentCredentialBatch(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=__import__("uuid").uuid4, editable=False)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="student_credential_batches")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    student_ids = models.JSONField(default=list)
    processed_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    encrypted_payload = models.TextField(blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Student credential batch {self.id} ({self.status})"
