from django.core.management.base import BaseCommand
from core.phase6 import IntegrityAudit

class Command(BaseCommand):
    help = "Run the PIXIU Phase 6 data-integrity audit."
    def add_arguments(self, parser):
        parser.add_argument("--strict", action="store_true", help="Exit with status 1 when errors are found.")
    def handle(self, *args, **options):
        report = IntegrityAudit.run_checks()
        self.stdout.write(f"Status: {report['status']}")
        self.stdout.write(f"Errors: {report['error_count']} | Warnings: {report['warning_count']}")
        for finding in report["findings"]:
            if finding["count"]:
                self.stdout.write(f"[{finding['severity'].upper()}] {finding['code']}: {finding['count']} — {finding['message']}")
                for sample in finding["samples"]:
                    self.stdout.write(f"  sample: {sample}")
        if options["strict"] and report["error_count"]:
            raise SystemExit(1)
