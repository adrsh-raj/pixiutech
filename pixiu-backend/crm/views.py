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
