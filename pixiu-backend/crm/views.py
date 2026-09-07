from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from .models import Lead, LeadActivity, LeadContact
from .serializers import LeadSerializer, LeadActivitySerializer, LeadContactSerializer


class CRMBase(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount, HasActionPermission]
    ACTIONS={"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE"}
    def initial(self,request,*args,**kwargs): self.required_action=self.ACTIONS.get(self.action,"VIEW"); super().initial(request,*args,**kwargs)


class LeadViewSet(CRMBase):
    queryset=Lead.objects.select_related("owner","converted_school").prefetch_related("activities","contacts")
    serializer_class=LeadSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        if u.role==UserRole.SCHOOL: return self.queryset.filter(converted_school__account_id=u.id)
        return self.queryset.filter(owner_id=u.id)
    def perform_create(self,serializer):
        if self.request.user.role not in {UserRole.ADMIN,UserRole.SCHOOL}: raise PermissionDenied("Your role cannot create CRM leads.")
        serializer.save(owner=self.request.user)
    @action(detail=True,methods=["post"],url_path="convert")
    def convert(self,request,pk=None):
        self.required_action="EDIT"
        if request.user.role not in {UserRole.ADMIN,UserRole.SCHOOL}: raise PermissionDenied("Only admin or school users can convert leads.")
        lead=self.get_object()
        school=request.data.get("school")
        if not school: return Response({"school":"School is required for conversion."},status=400)
        from academics.models import School
        target=School.objects.get(pk=school)
        if request.user.role==UserRole.SCHOOL and target.account_id!=request.user.id: raise PermissionDenied("You cannot convert to another school.")
        lead.converted_school=target; lead.status="won"; lead.save(update_fields=["converted_school","status","updated_at"])
        return Response(self.get_serializer(lead).data)


class LeadActivityViewSet(CRMBase):
    queryset=LeadActivity.objects.select_related("lead","actor")
    serializer_class=LeadActivitySerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        return self.queryset.filter(lead__owner_id=u.id)
    def perform_create(self,serializer): serializer.save(actor=self.request.user)


class LeadContactViewSet(CRMBase):
    queryset=LeadContact.objects.select_related("lead")
    serializer_class=LeadContactSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        return self.queryset.filter(lead__owner_id=u.id)
    def perform_create(self,serializer): serializer.save()
