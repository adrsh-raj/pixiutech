from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole, UserStatus
from audit.models import AuditAction
from audit.services import record_audit
from .models import Lead, LeadSource, LeadStatus

User = get_user_model()


def _clean(value, max_length):
    return str(value or '').strip()[:max_length]


class PublicEnquiryView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        website = _clean(request.data.get('website'), 120)
        if website:
            return Response({'success': False, 'error': 'Unable to process this enquiry.'}, status=400)

        school = _clean(request.data.get('school'), 250)
        person = _clean(request.data.get('person'), 200)
        phone = _clean(request.data.get('phone'), 30)
        email = _clean(request.data.get('email'), 254)
        city = _clean(request.data.get('city'), 120)
        message = _clean(request.data.get('message'), 4000)
        raw_strength = _clean(request.data.get('strength'), 10)

        if not school or not person or not phone or not email:
            return Response({'success': False, 'error': 'School name, contact person, phone and email are required.'}, status=400)

        try:
            expected_students = max(0, min(int(raw_strength or 0), 100000))
        except ValueError:
            expected_students = 0

        owner = User.objects.filter(
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
            is_active=True,
        ).order_by('id').first()
        if not owner:
            return Response({'success': False, 'error': 'Enquiry service is temporarily unavailable.'}, status=503)

        notes = '\n'.join(
            part for part in [
                f'City: {city}' if city else '',
                f'Student Strength: {expected_students}' if expected_students else '',
                f'Website Message: {message}' if message else '',
                'Source: pixiutech.com Contact Form',
            ] if part
        )

        lead = Lead.objects.create(
            organization_name=school,
            contact_name=person,
            email=email,
            phone=phone,
            source=LeadSource.WEBSITE,
            status=LeadStatus.NEW,
            owner=owner,
            expected_students=expected_students,
            estimated_value=0,
            notes=notes,
        )
        record_audit(
            actor=None,
            action=AuditAction.CREATE,
            entity_type='Lead',
            entity_id=lead.id,
            summary=f'Website enquiry captured for {school}',
            changes={
                'source': LeadSource.WEBSITE,
                'email': email,
                'city': city,
                'expected_students': expected_students,
            },
            request=request,
        )

        return Response({'success': True, 'lead_id': str(lead.id), 'status': lead.status}, status=201)
