import os

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from accounts.models import User, UserRole, UserStatus


class Command(BaseCommand):
    help = "Bootstrap a fresh PIXIU Django database with an admin account."

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin-username",
            default=os.environ.get("PIXIU_BOOTSTRAP_ADMIN_USERNAME", ""),
            help="Initial admin username. Defaults to PIXIU_BOOTSTRAP_ADMIN_USERNAME.",
        )
        parser.add_argument(
            "--admin-password",
            default=os.environ.get("PIXIU_BOOTSTRAP_ADMIN_PASSWORD", ""),
            help="Initial admin password. Prefer PIXIU_BOOTSTRAP_ADMIN_PASSWORD in deployment environments.",
        )
        parser.add_argument(
            "--admin-name",
            default=os.environ.get("PIXIU_BOOTSTRAP_ADMIN_NAME", "PIXIU Administrator"),
            help="Display name for the initial admin account.",
        )
        parser.add_argument(
            "--admin-email",
            default=os.environ.get("PIXIU_BOOTSTRAP_ADMIN_EMAIL", ""),
            help="Email address for the initial admin account.",
        )

    def _check_database(self):
        expected = os.environ.get("DJANGO_EXPECTED_DATABASE_NAME", "").strip()
        if not expected:
            raise CommandError(
                "Refusing bootstrap because DJANGO_EXPECTED_DATABASE_NAME is not set. "
                "Pin the command to the intended fresh Render database first."
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), current_user")
                database_name, database_user = cursor.fetchone()
        except Exception as exc:
            raise CommandError(f"PostgreSQL connection failed: {exc}") from exc

        configured_name = connection.settings_dict["NAME"]
        if configured_name != database_name:
            raise CommandError(
                "Django and PostgreSQL disagree about the configured database name."
            )
        if database_name != expected:
            raise CommandError(
                f"Refusing bootstrap: connected database is '{database_name}', "
                f"but DJANGO_EXPECTED_DATABASE_NAME is '{expected}'."
            )

        self.stdout.write(f"Database check: OK ({database_name}, user={database_user})")

    def handle(self, *args, **options):
        self._check_database()

        username = str(options["admin_username"] or "").strip()
        password = str(options["admin_password"] or "")
        display_name = str(options["admin_name"] or "PIXIU Administrator").strip()
        email = str(options["admin_email"] or "").strip()

        if not username:
            raise CommandError(
                "Admin username is required. Set PIXIU_BOOTSTRAP_ADMIN_USERNAME "
                "or pass --admin-username."
            )
        if not password:
            raise CommandError(
                "Admin password is required. Set PIXIU_BOOTSTRAP_ADMIN_PASSWORD "
                "or pass --admin-password."
            )
        if len(password) < 12:
            raise CommandError("Admin password must be at least 12 characters.")

        with transaction.atomic():
            user = User.objects.filter(username=username).first()
            created = user is None

            if user is None:
                user = User(username=username)

            user.role = UserRole.ADMIN
            user.status = UserStatus.ACTIVE
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.must_change_password = False
            user.display_name = display_name or username
            user.email = email
            user.set_password(password)
            user.save()

        action = "created" if created else "reconciled"
        self.stdout.write(self.style.SUCCESS(
            f"PIXIU bootstrap complete: admin account {action} ({user.username})."
        ))
        self.stdout.write("Next: create schools, trainers, classes and students through the admin/API layer.")
