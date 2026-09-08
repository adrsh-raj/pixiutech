import json

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import UserRole
from academics.models import School, TrainerSchoolAssignment
from academics.services import create_trainer_account, next_trainer_id
from .api_v1_compat import ContractTrainerViewSet


class SafeContractTrainerViewSet(ContractTrainerViewSet):
    """Compatibility adapter that tolerates stale frontend school defaults.

    Older portal builds can submit ZPS as the default school even when the fresh
    database contains a different active school. When there is exactly one active
    school, that school is used rather than rolling the whole trainer transaction
    back. With multiple schools, an invalid selection still fails explicitly.
    """

    def perform_create(self, serializer):
        self.assert_role(UserRole.ADMIN)
        try:
            original = json.loads((self.request.body or b"{}").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            original = {}

        password = str(original.get("password") or "").strip()
        if not password:
            raise ValidationError({"password": "Trainer password is required."})

        requested_trainer_id = str(original.get("trainer_id") or "").strip().upper()
        trainer_id = requested_trainer_id or next_trainer_id()

        assigned_schools = original.get("assigned_schools") or []
        if isinstance(assigned_schools, str):
            assigned_schools = [item.strip() for item in assigned_schools.split(",") if item.strip()]
        elif not isinstance(assigned_schools, list):
            assigned_schools = []

        resolved_schools = []
        missing_values = []
        for school_value in assigned_schools:
            raw = str(school_value or "").strip()
            if not raw:
                continue
            try:
                school = School.objects.filter(pk=raw).first()
            except (ValueError, TypeError):
                school = None
            school = school or School.objects.filter(school_code=raw.upper()).first()
            if school:
                if school not in resolved_schools:
                    resolved_schools.append(school)
            else:
                missing_values.append(raw)

        # The deployed portal historically defaulted to ZPS. A fresh database
        # may legitimately have only XYZ (or another single school). Do not let
        # that stale default prevent creation of an otherwise valid trainer.
        if not resolved_schools and missing_values:
            active_schools = list(School.objects.filter(status="active").order_by("school_code"))
            if len(active_schools) == 1:
                resolved_schools = active_schools
            else:
                raise ValidationError({
                    "assigned_schools": f"School(s) not found: {', '.join(missing_values)}. Select an active school from the current database."
                })

        with transaction.atomic():
            trainer = serializer.save(trainer_id=trainer_id)
            create_trainer_account(trainer=trainer, password=password)

            for school in resolved_schools:
                TrainerSchoolAssignment.objects.update_or_create(
                    trainer=trainer,
                    school=school,
                    assigned_from=timezone.localdate(),
                    defaults={"status": "active", "assigned_to": None},
                )

    def map_out(self, obj):
        data = super().map_out(obj)
        assignments = data.get("assigned_schools")
        if isinstance(assignments, list):
            data["assigned_schools"] = ", ".join(str(item) for item in assignments if str(item).strip())
        return data
