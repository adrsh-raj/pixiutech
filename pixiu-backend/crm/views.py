from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from audit.services import record_audit
from academics.models import School
from .models import Lead, LeadActivity, LeadContact
from .serializers import LeadSerializer, LeadActivitySerializer, LeadContactSerializer


class CRMBase(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount, HasActionPermission]
    ACTIONS={"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE","convert":"EDIT"}
    def initial(self,request,*args,**kwargs): self.required_action=self.ACTIONS.get(self.action,"VIEW"); super().initial(request,*args,**kwargs)
    def role_only(self,*roles):
        if self.request.user.role not in roles: raise PermissionDenied("Your role cannot perform this operation.")


def lead_scope(user):
    qs=Lead.objects.all()
    if user.role==UserRole.ADMIN:return qs
    if user.role==UserRole.SCHOOL:return qs.filter(owner_id=user.id)|qs.filter(converted_school__account_id=user.id)
    return qs.none()


class LeadViewSet(CRMBase):
    queryset=Lead.objects.select_related("owner","converted_school").prefetch_related("activities","contacts")
    serializer_class=LeadSerializer
    def get_queryset(self): return lead_scope(self.request.user).select_related("owner","converted_school").prefetch_related("activities","contacts")
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=serializer.save(owner=self.request.user)
        record_audit(actor=self.request.user,action="create",entity_type="Lead",entity_id=lead.id,summary=f"Created CRM lead {lead.organization_name}",request=self.request)
    @action(detail=True,methods=["post"],url_path="convert")
    def convert(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=self.get_object()
        if lead.status in {"won","lost"}: raise ValidationError("Closed leads cannot be converted again.")
        target=School.objects.filter(pk=request.data.get("school")).first()
        if not target: raise ValidationError({"school":"School does not exist."})
        if request.user.role==UserRole.SCHOOL and target.account_id!=request.user.id: raise PermissionDenied("You cannot convert to another school.")
        lead.converted_school=target; lead.status="won"; lead.save(update_fields=["converted_school","status","updated_at"])
        record_audit(actor=request.user,action="update",entity_type="Lead",entity_id=lead.id,summary=f"Converted CRM lead {lead.organization_name}",changes={"status":"won","school":target.school_code},request=request)
        return Response(self.get_serializer(lead).data)


class LeadActivityViewSet(CRMBase):
    queryset=LeadActivity.objects.select_related("lead","actor")
    serializer_class=LeadActivitySerializer
    def get_queryset(self): return self.queryset.filter(lead__in=lead_scope(self.request.user))
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=serializer.validated_data["lead"]
        if not lead_scope(self.request.user).filter(pk=lead.pk).exists(): raise PermissionDenied("You cannot add activity to this lead.")
        serializer.save(actor=self.request.user)


class LeadContactViewSet(CRMBase):
    queryset=LeadContact.objects.select_related("lead")
    serializer_class=LeadContactSerializer
    def get_queryset(self): return self.queryset.filter(lead__in=lead_scope(self.request.user))
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=serializer.validated_data["lead"]
        if not lead_scope(self.request.user).filter(pk=lead.pk).exists(): raise PermissionDenied("You cannot add contact to this lead.")
        serializer.save()


from django.db import transaction
from django.http import FileResponse
from rest_framework.parsers import JSONParser

from .models import CareerApplication, CareerApplicationStatus, CareerOpening, CareerOpeningStatus
from .serializers import CareerApplicationSerializer, CareerOpeningSerializer, PublicCareerApplicationSerializer, PublicCareerOpeningSerializer
from core.upload_security import CareerCVMultipartParser, SecureUploadError, validate_career_cv


class CareerAdminMixin:
    def role_only(self):
        if self.request.user.role not in {UserRole.ADMIN, getattr(UserRole, 'SUPERADMIN', 'superadmin')}:
            raise PermissionDenied('Administrator access is required.')

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.role_only()


class CareerOpeningViewSet(CareerAdminMixin, viewsets.ModelViewSet):
    queryset = CareerOpening.objects.all().prefetch_related('applications')
    serializer_class = CareerOpeningSerializer
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        opening = serializer.save()
        record_audit(actor=self.request.user, action='create', entity_type='CareerOpening', entity_id=opening.id, summary=f'Created career opening {opening.title}', request=self.request)

    def perform_update(self, serializer):
        opening = serializer.save()
        record_audit(actor=self.request.user, action='update', entity_type='CareerOpening', entity_id=opening.id, summary=f'Updated career opening {opening.title}', request=self.request)

    def perform_destroy(self, instance):
        title = instance.title
        opening_id = instance.id
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
        response = FileResponse(application.cv.open('rb'), as_attachment=True, filename=application.cv_original_name or 'resume.pdf', content_type='application/pdf')
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
            cv_original_name=str(getattr(uploaded, 'name', 'resume.pdf'))[:255],
            cv_size=int(getattr(secure_cv, 'size', 0) or 0),
            cv_sha256=sha256,
        )
        secure_cv.name = application.id.hex + '.pdf'
        application.cv = secure_cv
        application.save()
        record_audit(actor=None, action='create', entity_type='CareerApplication', entity_id=application.id, summary=f'New career application received for {opening.title if opening else "General Application"}', request=request)
        return Response({'success': True, 'message': 'Application received successfully.'}, status=status.HTTP_201_CREATED)