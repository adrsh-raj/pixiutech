import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User, UserRole, UserStatus


class Command(BaseCommand):
    help = "Create or update the PIXIU platform admin from environment-provided credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            help="Admin username. Prefer the ADMIN_BOOTSTRAP_USERNAME environment variable.",
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset the existing admin password using ADMIN_BOOTSTRAP_PASSWORD.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        username = (options.get("username") or os.environ.get("ADMIN_BOOTSTRAP_USERNAME", "")).strip()
        password = os.environ.get("ADMIN_BOOTSTRAP_PASSWORD", "")

        if not username:
            raise CommandError("Provide ADMIN_BOOTSTRAP_USERNAME or --username.")
        if len(username) < 3 or len(username) > 150:
            raise CommandError("Admin username must be between 3 and 150 characters.")
        if not password:
            raise CommandError("ADMIN_BOOTSTRAP_PASSWORD is required; no default password exists.")
        if len(password) < 12:
            raise CommandError("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.")

        user = User.objects.filter(username=username).first()
        if user:
            if user.role != UserRole.ADMIN and not user.is_superuser:
                raise CommandError("An existing non-admin account uses this username; refusing to overwrite it.")
            if options["reset_password"]:
                user.set_password(password)
                user.must_change_password = False
                user.role = UserRole.ADMIN
                user.status = UserStatus.ACTIVE
                user.is_active = True
                user.is_staff = True
                user.is_superuser = True
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Admin account "{username}" password reset.'))
            else:
                self.stdout.write(f'Admin account "{username}" already exists; no password changed.')
            return

        user = User.objects.create_superuser(username=username, password=password)
        user.display_name = "PIXIU Tech Administrator"
        user.save(update_fields=["display_name"])
        self.stdout.write(self.style.SUCCESS(f'Admin account "{username}" created.'))
