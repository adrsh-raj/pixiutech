from django.db import transaction
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveAccount, IsAdminRole
from audit.services import record_audit
import logging
from core.upload_security import CareerCVMultipartParser, SecureUploadError, validate_career_cv
from .models import CareerApplication, CareerOpening, CareerOpeningStatus
from .serializers import CareerApplicationSerializer, CareerOpeningSerializer, PublicCareerApplicationSerializer, PublicCareerOpeningSerializer


logger = logging.getLogger('careers')


class CareerAdminMixin:
    permission_classes = [IsActiveAccount, IsAdminRole]


class CareerOpeningViewSet(CareerAdminMixin, viewsets.ModelViewSet):
    queryset = CareerOpening.objects.all().prefetch_related('applications')
    serializer_class = CareerOpeningSerializer

    def perform_create(self, serializer):
        opening = serializer.save()
        record_audit(actor=self.request.user, action='create', entity_type='CareerOpening', entity_id=opening.id, summary=f'Created career opening {opening.title}', request=self.request)

    def perform_update(self, serializer):
        opening = serializer.save()
        record_audit(actor=self.request.user, action='update', entity_type='CareerOpening', entity_id=opening.id, summary=f'Updated career opening {opening.title}', request=self.request)

    def perform_destroy(self, instance):
        title, opening_id = instance.title, instance.id
        instance.delete()
        record_audit(actor=self.request.user, action='delete', entity_type='CareerOpening', entity_id=opening_id, summary=f'Deleted career opening {title}', request=self.request)


class CareerApplicationViewSet(CareerAdminMixin, viewsets.ModelViewSet):
    queryset = CareerApplication.objects.select_related('opening')
    serializer_class = CareerApplicationSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def perform_update(self, serializer):
        application = serializer.save()
        record_audit(actor=self.request.user, action='update', entity_type='CareerApplication', entity_id=application.id, summary=f'Updated career application status for {application.name}', request=self.request)

    @action(detail=True, methods=['get'], url_path='cv')
    def cv(self, request, pk=None):
        application = self.get_object()
        if not application.cv:
            raise ValidationError({'cv': 'CV is not available.'})
        response = FileResponse(
            application.cv.open('rb'),
            as_attachment=True,
            filename=application.cv_original_name or 'resume.pdf',
            content_type='application/pdf',
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store, max-age=0'
        return response


class PublicCareerOpeningsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        openings = CareerOpening.objects.filter(status=CareerOpeningStatus.PUBLISHED).order_by('sort_order', '-created_at')
        return Response(PublicCareerOpeningSerializer(openings, many=True).data)


class PublicCareerApplicationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [CareerCVMultipartParser]
    throttle_scope = 'career_apply'

    @transaction.atomic
    def post(self, request):
        serializer = PublicCareerApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data['cv']
        original_filename = str(getattr(uploaded, 'name', 'resume.pdf'))[:255]

        try:
            secure_cv, sha256 = validate_career_cv(uploaded)
        except SecureUploadError as exc:
            raise ValidationError({'cv': exc.messages}) from exc

        opening = serializer.validated_data.get('opening')
        application = CareerApplication(
            opening=opening,
            name=serializer.validated_data['name'],
            email=serializer.validated_data['email'].lower(),
            phone=serializer.validated_data['phone'],
            cover_message=serializer.validated_data.get('cover_message', '').strip(),
            cv_original_name=original_filename,
            cv_size=int(getattr(secure_cv, 'size', 0) or 0),
            cv_sha256=sha256,
        )
        secure_cv.name = application.id.hex + '.pdf'
        application.cv = secure_cv
        application.save()

        role_name = opening.title if opening else 'General Application'
        try:
            record_audit(
                actor=None,
                action='create',
                entity_type='CareerApplication',
                entity_id=application.id,
                summary=f'New career application received for {role_name}',
                request=request,
            )
        except Exception:
            logger.exception('Career application saved but audit event failed', extra={'application_id': str(application.id)})
        return Response({'success': True, 'message': 'Application received successfully.'}, status=status.HTTP_201_CREATED)
