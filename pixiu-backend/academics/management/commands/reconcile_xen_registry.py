"""
Management command to audit and reconcile existing LMS Schools and Trainers
into the authoritative Xen Identity Registry.
Supports:
  --dry-run (default): Outputs redacted inventory without modifying database.
  --apply: Transactionally provisions XenSchool and XenTrainer records.
"""

import json
from django.core.management.base import BaseCommand
from django.db import transaction
from academics.models import School, Trainer, Status
from academics.models_xen import XenSchool, XenTrainer, XenLab


class Command(BaseCommand):
    help = "Reconcile LMS schools and trainers with the Xen Identity Registry."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes transactionally to the database.",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output inventory as formatted JSON.",
        )

    def handle(self, *args, **options):
        dry_run = not options.get("apply", False)
        output_json = options.get("json", False)

        schools = list(School.objects.all().order_by("school_code"))
        trainers = list(Trainer.objects.all().order_by("trainer_id"))

        inventory = {
            "mode": "DRY_RUN (Audit only)" if dry_run else "APPLIED",
            "counts": {
                "lms_schools": len(schools),
                "lms_trainers": len(trainers),
                "existing_xen_schools": XenSchool.objects.count() if not dry_run else 0,
                "existing_xen_trainers": XenTrainer.objects.count() if not dry_run else 0,
            },
            "schools": [
                {
                    "school_id": str(s.id),
                    "school_code": s.school_code,
                    "redacted_name": s.name[:3] + "***" if len(s.name) > 3 else "***",
                    "status": s.status,
                }
                for s in schools
            ],
            "trainers": [
                {
                    "trainer_id": str(t.id),
                    "trainer_code": t.trainer_id,
                    "redacted_name": t.name[:2] + "***" if len(t.name) > 2 else "***",
                    "status": t.status,
                }
                for t in trainers
            ],
            "slot_policy": {
                "academic_period": "2026-27",
                "slots_per_class_rule": "1 or 2 slots per class",
                "assignment_status": "EXACT_SLOT_ASSIGNMENTS_UNRESOLVED_BY_FOUNDER_POLICY",
            },
        }

        if output_json:
            self.stdout.write(json.dumps(inventory, indent=2))
        else:
            self.stdout.write(self.style.SUCCESS(f"=== XEN IDENTITY REGISTRY INVENTORY [{inventory['mode']}] ==="))
            self.stdout.write(f"Total LMS Schools found: {len(schools)}")
            self.stdout.write(f"Total LMS Trainers found: {len(trainers)}")
            for s in inventory["schools"]:
                self.stdout.write(f"  - School: {s['school_code']} ({s['redacted_name']}) [ID: {s['school_id']}]")
            for t in inventory["trainers"]:
                self.stdout.write(f"  - Trainer: {t['trainer_code']} ({t['redacted_name']}) [ID: {t['trainer_id']}]")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run completed. No database changes were made."))
            return

        # Transactional application
        created_schools = 0
        created_trainers = 0

        with transaction.atomic():
            for school in schools:
                xen_sch, created = XenSchool.objects.get_or_create(
                    school=school,
                    defaults={"status": school.status},
                )
                if created:
                    created_schools += 1

            for trainer in trainers:
                xen_trn, created = XenTrainer.objects.get_or_create(
                    trainer=trainer,
                    defaults={"status": trainer.status, "is_a05_qualified": False},
                )
                if created:
                    created_trainers += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully reconciled: {created_schools} new XenSchools, {created_trainers} new XenTrainers."
            )
        )
