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


class LeadViewSet(CRMBase):
    queryset=Lead.objects.select_related("owner","converted_school").prefetch_related("activities","contacts")
    serializer_class=LeadSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(owner_id=u.id)|self.queryset.filter(converted_school__account_id=u.id)
        return self.queryset.none()
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=serializer.save(owner=self.request.user)
        record_audit(actor=self.request.user,action="create",entity_type="Lead",entity_id=lead.id,summary=f"Created CRM lead {lead.organization_name}",request=self.request)
    @action(detail=True,methods=["post"],url_path="convert")
    def convert(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL)
        lead=self.get_object()
        if lead.status in {"won","lost"}: raise ValidationError("Closed leads cannot be converted again.")
        school_id=request.data.get("school")
        if not school_id: raise ValidationError({"school":"School is required for conversion."})
        target=School.objects.filter(pk=school_id).first()
        if not target: raise ValidationError({"school":"School does not exist."})
        if request.user.role==UserRole.SCHOOL and target.account_id!=request.user.id: raise PermissionDenied("You cannot convert to another school.")
        lead.converted_school=target; lead.status="won"; lead.save(update_fields=["converted_school","status","updated_at"])
        record_audit(actor=request.user,action="update",entity_type="Lead",entity_id=lead.id,summary=f"Converted CRM lead {lead.organization_name}",changes={"status":"won","school":target.school_code},request=request)
        return Response(self.get_serializer(lead).data)


class LeadActivityViewSet(CRMBase):
    queryset=LeadActivity.objects.select_related("lead","actor")
    serializer_class=LeadActivitySerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(lead__owner_id=u.id)
        return self.queryset.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save(actor=self.request.user)


class LeadContactViewSet(CRMBase):
    queryset=LeadContact.objects.select_related("lead")
    serializer_class=LeadContactSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(lead__owner_id=u.id)
        return self.queryset.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
