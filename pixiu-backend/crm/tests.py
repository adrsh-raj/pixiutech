from datetime import date
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User, UserRole
from academics.models import School
from audit.models import AuditLog
from .models import Lead, LeadActivity, LeadContact, LeadSource, LeadStatus


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

    def test_public_enquiry_creates_website_lead_and_audit_record(self):
        client = APIClient()
        response = client.post('/api/v1/public/enquiries', {
            'school': 'Website School',
            'person': 'Principal Mehta',
            'phone': '9876543210',
            'email': 'principal@example.com',
            'city': 'Jaipur',
            'strength': '450',
            'message': 'Interested in a robotics lab.',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(organization_name='Website School')
        self.assertEqual(lead.source, LeadSource.WEBSITE)
        self.assertEqual(lead.status, LeadStatus.NEW)
        self.assertEqual(lead.owner_id, self.admin.id)
        self.assertEqual(lead.expected_students, 450)
        self.assertIn('Interested in a robotics lab.', lead.notes)
        self.assertTrue(AuditLog.objects.filter(entity_type='Lead', entity_id=str(lead.id), action='create').exists())

    def test_public_enquiry_honeypot_is_rejected(self):
        client = APIClient()
        response = client.post('/api/v1/public/enquiries', {
            'school': 'Bot School',
            'person': 'Bot',
            'phone': '9876543210',
            'email': 'bot@example.com',
            'website': 'filled',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Lead.objects.filter(organization_name='Bot School').exists())
