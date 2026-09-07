from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Verify that Django is connected to the intended PostgreSQL database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Require DJANGO_EXPECTED_DATABASE_NAME to be configured.",
        )

    def handle(self, *args, **options):
        expected = getattr(settings, "EXPECTED_DATABASE_NAME", "")
        if options["strict"] and not expected:
            raise CommandError(
                "DJANGO_EXPECTED_DATABASE_NAME is required when --strict is used."
            )

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), current_user")
                database_name, database_user = cursor.fetchone()
                cursor.execute("SELECT version()")
                server_version = cursor.fetchone()[0]
        except Exception as exc:
            raise CommandError(f"PostgreSQL connection failed: {exc}") from exc

        configured_name = connection.settings_dict["NAME"]
        if configured_name != database_name:
            raise CommandError(
                "PostgreSQL reported a different database than Django configured."
            )

        self.stdout.write(self.style.SUCCESS("PostgreSQL connection: OK"))
        self.stdout.write(f"Database: {database_name}")
        self.stdout.write(f"User: {database_user}")
        self.stdout.write(f"Host: {connection.settings_dict['HOST']}")
        self.stdout.write(f"Port: {connection.settings_dict['PORT']}")
        self.stdout.write(f"Django expected DB: {expected or '(not pinned)'}")
        self.stdout.write(f"PostgreSQL: {server_version.split(',')[0]}")
