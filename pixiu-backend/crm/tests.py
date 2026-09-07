from datetime import date
from django.test import TestCase
from accounts.models import User, UserRole
from academics.models import School
from .models import Lead, LeadActivity, LeadContact

class CRMTests(TestCase):
    def setUp(self):
        self.admin=User.objects.create_user("crm-admin","strong-pass",role=UserRole.ADMIN,is_staff=True)
        self.school_user=User.objects.create_user("CRM-SCHOOL","strong-pass",role=UserRole.SCHOOL)
        self.school=School.objects.create(school_code="CRM",name="CRM School",account=self.school_user)
    def test_lead_keeps_activity_and_conversion_history(self):
        lead=Lead.objects.create(organization_name="Prospect School",contact_name="Principal",owner=self.admin)
        LeadContact.objects.create(lead=lead,name="Principal",email="p@example.com",is_primary=True)
        LeadActivity.objects.create(lead=lead,actor=self.admin,activity_type="call",summary="Initial call")
        lead.converted_school=self.school; lead.status="won"; lead.save()
        self.assertEqual(lead.activities.count(),1)
        self.assertEqual(lead.converted_school_id,self.school.id)
