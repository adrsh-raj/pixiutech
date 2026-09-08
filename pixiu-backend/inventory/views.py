from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset, accessible_trainer_queryset
from audit.services import record_audit
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody, KitComponent, KitMaintenance
from .serializers import InventoryItemSerializer, StockBalanceSerializer, StockMovementSerializer, KitSerializer, KitItemSerializer, KitCustodySerializer, KitComponentSerializer, KitMaintenanceSerializer
from .services import move_stock, issue_kit, return_kit


class InventoryBase(viewsets.ModelViewSet):
    permission_classes=[IsAuthenticated, IsActiveAccount, HasActionPermission]
    ACTIONS={"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE","move":"EDIT","issue":"ASSIGN","return_kit_action":"EDIT","upload_image":"EDIT","remove_image":"EDIT"}
    def initial(self,request,*args,**kwargs): self.required_action=self.ACTIONS.get(self.action,"VIEW"); super().initial(request,*args,**kwargs)
    def role_only(self,*roles):
        if self.request.user.role not in roles: raise PermissionDenied("Your role cannot perform this operation.")


class InventoryItemViewSet(InventoryBase):
    queryset=InventoryItem.objects.select_related("created_by"); serializer_class=InventoryItemSerializer
    def get_queryset(self): return self.queryset if self.request.user.role==UserRole.ADMIN else self.queryset.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN); serializer.save(created_by=self.request.user)
    def perform_update(self,serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self,instance): self.role_only(UserRole.ADMIN); instance.status="inactive"; instance.save(update_fields=["status","updated_at"])


class StockBalanceViewSet(InventoryBase):
    queryset=StockBalance.objects.select_related("item","school","trainer"); serializer_class=StockBalanceSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER:return self.queryset.filter(trainer__account_id=u.id)
        return self.queryset.none()
    @action(detail=False,methods=["post"],url_path="move")
    def move(self,request):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL,UserRole.TRAINER)
        item=InventoryItem.objects.filter(pk=request.data.get("item")).first()
        if not item: raise ValidationError("Inventory item does not exist.")
        school=trainer=None
        if request.user.role==UserRole.SCHOOL:
            school=accessible_school_queryset(request.user).filter(pk=request.data.get("school")).first()
            if not school: raise PermissionDenied("You cannot move stock for this school.")
        elif request.user.role==UserRole.TRAINER:
            trainer=accessible_trainer_queryset(request.user).filter(pk=request.data.get("trainer")).first()
            if not trainer: raise PermissionDenied("You cannot move stock for this trainer.")
        elif request.data.get("school"):
            school=accessible_school_queryset(request.user).filter(pk=request.data["school"]).first()
            if not school: raise PermissionDenied("School is outside your scope.")
        movement,balance=move_stock(item=item,quantity_delta=int(request.data.get("quantity_delta",0)),performed_by=request.user,reason=request.data.get("reason",""),school=school,trainer=trainer,reference=request.data.get("reference",""))
        return Response({"movement":StockMovementSerializer(movement).data,"balance":StockBalanceSerializer(balance).data},status=status.HTTP_201_CREATED)


class StockMovementViewSet(InventoryBase):
    queryset=StockMovement.objects.select_related("item","school","trainer","performed_by"); serializer_class=StockMovementSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER:return self.queryset.filter(trainer__account_id=u.id)
        return self.queryset.none()
    def perform_create(self,serializer): raise PermissionDenied("Use /stock/move/ so stock and history remain atomic.")


class KitViewSet(InventoryBase):
    queryset=Kit.objects.select_related("school","school_class__school","created_by").prefetch_related("components","maintenance_history","items"); serializer_class=KitSerializer
    parser_classes=[MultiPartParser,FormParser]
    def get_queryset(self):
        u=self.request.user; qs=self.queryset
        if u.role==UserRole.ADMIN:return qs
        if u.role==UserRole.SCHOOL:return qs.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER:return qs.filter(school__trainer_assignments__trainer__account_id=u.id,school__trainer_assignments__status="active").distinct()
        if u.role==UserRole.STUDENT:return qs.filter(school_class_id__in=accessible_class_queryset(u).values("id"))
        return qs.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save(created_by=self.request.user)
    def perform_update(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self,instance): self.role_only(UserRole.ADMIN); instance.status="retired"; instance.save(update_fields=["status","updated_at"])
    @action(detail=True,methods=["post"],url_path="upload-image")
    def upload_image(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL); kit=self.get_object(); image=request.FILES.get("image")
        if not image: raise ValidationError({"image":"An image file is required."})
        old_name=kit.image.name if kit.image else ""
        kit.image=image; kit.save(update_fields=["image","updated_at"])
        if old_name and old_name != kit.image.name: default_storage.delete(old_name)
        record_audit(actor=request.user,action="update",entity_type="Kit",entity_id=kit.id,summary=f"Kit image replaced for {kit.kit_code}",changes={"image":"replaced"},request=request)
        return Response(self.get_serializer(kit).data)
    @action(detail=True,methods=["post"],url_path="remove-image")
    def remove_image(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL); kit=self.get_object(); old_name=kit.image.name if kit.image else ""
        kit.image=None; kit.save(update_fields=["image","updated_at"])
        if old_name: default_storage.delete(old_name)
        record_audit(actor=request.user,action="update",entity_type="Kit",entity_id=kit.id,summary=f"Kit image removed for {kit.kit_code}",changes={"image":"removed"},request=request)
        return Response(self.get_serializer(kit).data)


class KitComponentViewSet(InventoryBase):
    queryset=KitComponent.objects.select_related("kit","first_used_session","kit__school","kit__school_class"); serializer_class=KitComponentSerializer; parser_classes=[MultiPartParser,FormParser]
    def get_queryset(self):
        u=self.request.user; qs=self.queryset
        if u.role==UserRole.ADMIN:return qs
        if u.role==UserRole.SCHOOL:return qs.filter(kit__school__account_id=u.id)
        if u.role==UserRole.TRAINER:return qs.filter(kit__school__trainer_assignments__trainer__account_id=u.id,kit__school__trainer_assignments__status="active").distinct()
        if u.role==UserRole.STUDENT:return qs.filter(kit__school_class_id__in=accessible_class_queryset(u).values("id"))
        return qs.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_update(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self,instance): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); instance.delete()
    @action(detail=True,methods=["post"],url_path="upload-image")
    def upload_image(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL); obj=self.get_object(); image=request.FILES.get("image")
        if not image: raise ValidationError({"image":"An image file is required."})
        old_name=obj.image.name if obj.image else ""; obj.image=image; obj.save(update_fields=["image","updated_at"])
        if old_name and old_name != obj.image.name: default_storage.delete(old_name)
        record_audit(actor=request.user,action="update",entity_type="KitComponent",entity_id=obj.id,summary=f"Component image replaced for {obj.name}",changes={"image":"replaced"},request=request)
        return Response(self.get_serializer(obj).data)
    @action(detail=True,methods=["post"],url_path="remove-image")
    def remove_image(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL); obj=self.get_object(); old_name=obj.image.name if obj.image else ""; obj.image=None; obj.save(update_fields=["image","updated_at"])
        if old_name: default_storage.delete(old_name)
        record_audit(actor=request.user,action="update",entity_type="KitComponent",entity_id=obj.id,summary=f"Component image removed for {obj.name}",changes={"image":"removed"},request=request)
        return Response(self.get_serializer(obj).data)


class KitMaintenanceViewSet(InventoryBase):
    queryset=KitMaintenance.objects.select_related("kit","performed_by","kit__school"); serializer_class=KitMaintenanceSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(kit__school__account_id=u.id)
        if u.role==UserRole.TRAINER:return self.queryset.filter(kit__school__trainer_assignments__trainer__account_id=u.id,kit__school__trainer_assignments__status="active").distinct()
        return self.queryset.none()
    def perform_create(self,serializer):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save(performed_by=self.request.user)
    def perform_update(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self,instance): raise PermissionDenied("Maintenance history is retained and cannot be deleted.")


class KitItemViewSet(InventoryBase):
    queryset=KitItem.objects.select_related("kit","item"); serializer_class=KitItemSerializer
    def get_queryset(self):
        u=self.request.user; qs=self.queryset
        if u.role==UserRole.ADMIN:return qs
        if u.role==UserRole.SCHOOL:return qs.filter(kit__school__account_id=u.id)
        if u.role==UserRole.TRAINER:return qs.filter(kit__school__trainer_assignments__trainer__account_id=u.id,kit__school__trainer_assignments__status="active").distinct()
        if u.role==UserRole.STUDENT:return qs.filter(kit__school_class_id__in=accessible_class_queryset(u).values("id"))
        return qs.none()
    def perform_create(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_update(self,serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self,instance): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); instance.delete()


class KitCustodyViewSet(InventoryBase, viewsets.ReadOnlyModelViewSet):
    http_method_names=["get","post","head","options"]
    queryset=KitCustody.objects.select_related("kit","school","trainer","student","issued_by","returned_by"); serializer_class=KitCustodySerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN:return self.queryset
        if u.role==UserRole.SCHOOL:return self.queryset.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER:return self.queryset.filter(trainer__account_id=u.id)
        if u.role==UserRole.STUDENT:return self.queryset.filter(student__account_id=u.id)
        return self.queryset.none()
    @action(detail=False,methods=["post"],url_path="issue")
    def issue(self,request):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL,UserRole.TRAINER); kit=Kit.objects.filter(pk=request.data.get("kit")).first()
        if not kit: raise ValidationError("Kit does not exist.")
        school=accessible_school_queryset(request.user).filter(pk=request.data.get("school")).first() if request.data.get("school") else None
        trainer=accessible_trainer_queryset(request.user).filter(pk=request.data.get("trainer")).first() if request.data.get("trainer") else None
        student=accessible_student_queryset(request.user).filter(pk=request.data.get("student")).first() if request.data.get("student") else None
        if request.user.role==UserRole.SCHOOL and not school: raise PermissionDenied("School recipient is required and must be your school.")
        if request.user.role==UserRole.TRAINER and not trainer: raise PermissionDenied("Trainer recipient is required and must be your trainer account.")
        custody=issue_kit(kit=kit,issued_by=request.user,school=school,trainer=trainer,student=student,notes=request.data.get("notes","")); return Response(self.get_serializer(custody).data,status=status.HTTP_201_CREATED)
    @action(detail=True,methods=["post"],url_path="return")
    def return_kit_action(self,request,pk=None):
        self.role_only(UserRole.ADMIN,UserRole.SCHOOL,UserRole.TRAINER); custody=self.get_object(); return Response(self.get_serializer(return_kit(custody=custody,returned_by=request.user,notes=request.data.get("notes",""))).data)
