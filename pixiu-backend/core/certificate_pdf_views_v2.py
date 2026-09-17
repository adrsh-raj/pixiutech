from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from academics.models import Student
from academics.services import accessible_student_queryset
from learning import course_completion_final as service
from learning.certificate_pdf_v2 import build_certificate_pdf
from learning.course_completion_models import Certificate
from learning.scorecard_pdf import build_scorecard_pdf


def _error(message, code=400):
    return Response({'detail': message}, status=code)


def _scoped_student(user, key):
    qs = accessible_student_queryset(user).select_related('school_class__school')
    raw = str(key or '').strip()
    if not raw:
        return get_object_or_404(qs, student_id__iexact=raw)
    try:
        uuid_key = UUID(raw)
    except (ValueError, TypeError, AttributeError):
        uuid_key = None
    if uuid_key is not None:
        student = qs.filter(pk=uuid_key).first()
        if student is not None:
            return student
    return get_object_or_404(qs, student_id__iexact=raw)


class CertificatePdfViewV2(APIView):
    """Authenticated official certificate PDF using the certificate-size layout."""
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        student = _scoped_student(request.user, student_key)
        certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
        if certificate is None:
            return _error('No issued certificate exists for this student.', 404)
        return build_certificate_pdf(certificate)


class PublicCertificatePdfViewV2(APIView):
    """Public certificate PDF. The certificate ID is the only lookup key."""
    permission_classes = [AllowAny]

    def get(self, request, certificate_id):
        certificate = Certificate.objects.filter(
            certificate_id__iexact=str(certificate_id).strip(),
            status='issued',
        ).first()
        if certificate is None:
            return _error('No issued Pixiu Tech certificate matches this certificate ID.', 404)
        return build_certificate_pdf(certificate)


class ScorecardPdfViewV2(APIView):
    """Authenticated A4 scorecard containing the student's rank and top-10 class ranking."""
    permission_classes = [IsAuthenticated]

    def get(self, request, student_key):
        student = _scoped_student(request.user, student_key)
        certificate = Certificate.objects.filter(student=student, status='issued').order_by('-issued_at').first()
        if certificate is None:
            return _error('No issued certificate exists for this student.', 404)
        try:
            scorecard = service.scorecard_data(certificate)
        except Exception as exc:
            return _error(f'Unable to build the scorecard from the LMS record: {exc}', 500)
        return build_scorecard_pdf(certificate, scorecard)
