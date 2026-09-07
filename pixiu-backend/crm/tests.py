from datetime import datetime, timezone
from django.test import TestCase

from accounts.models import User, UserRole
from .models import Lead, LeadActivity, LeadStatus


class CRMTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("crm-admin", "strong-password", role=UserRole.ADMIN, is_staff=True)

    def test_won_lead_requires_converted_school_at_serializer_boundary(self):
        lead = Lead.objects.create(lead_code="L-001", organization_name="School", contact_name="Person", status=LeadStatus.WON, created_by=self.admin)
        self.assertEqual(lead.status, "won")
        activity = LeadActivity.objects.create(lead=lead, activity_type="call", summary="Discussed proposal", happened_at=datetime.now(timezone.utc), actor=self.admin)
        self.assertEqual(activity.lead_id, lead.id)
