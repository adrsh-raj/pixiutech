from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from audit.models import AuditAction, AuditLog
from core.phase6 import ControlledResetAPI

class Command(BaseCommand):
    help = "Safely reset selected PIXIU operational data. Academic master data and audit logs are preserved."
    def add_arguments(self, parser):
        parser.add_argument("scope", choices=sorted(ControlledResetAPI.SCOPES))
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--confirm", default="")
    def handle(self, *args, **options):
        if options["confirm"] != ControlledResetAPI.RESET_PHRASE:
            raise CommandError(f"Use --confirm '{ControlledResetAPI.RESET_PHRASE}' to authorize the reset.")
        scope = options["scope"]
        helper = ControlledResetAPI()
        counts = helper._counts(scope)
        if options["dry_run"]:
            self.stdout.write(f"DRY RUN: {counts}")
            return
        with transaction.atomic():
            deleted = helper._reset(scope)
            AuditLog.objects.create(action=AuditAction.DELETE, entity_type="controlled_reset", summary=f"Management command reset: {scope}", changes={"scope": scope, "deleted": deleted})
        self.stdout.write(self.style.SUCCESS(f"Reset complete: {deleted}"))
