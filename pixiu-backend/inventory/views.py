from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from accounts.permissions import HasActionPermission, IsActiveAccount
from academics.services import accessible_class_queryset, accessible_school_queryset, accessible_student_queryset, accessible_trainer_queryset
from .models import InventoryItem, StockBalance, StockMovement, Kit, KitItem, KitCustody
from .serializers import InventoryItemSerializer, StockBalanceSerializer, StockMovementSerializer, KitSerializer, KitItemSerializer, KitCustodySerializer
from .services import move_stock, issue_kit, return_kit


class InventoryBase(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAccount, HasActionPermission]
    ACTIONS = {"list":"VIEW","retrieve":"VIEW","create":"CREATE","update":"EDIT","partial_update":"EDIT","destroy":"DELETE"}
    def initial(self, request, *args, **kwargs):
        self.required_action = self.ACTIONS.get(self.action, "VIEW")
        super().initial(request, *args, **kwargs)
    def role_only(self, *roles):
        if self.request.user.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


class InventoryItemViewSet(InventoryBase):
    queryset = InventoryItem.objects.select_related("created_by")
    serializer_class = InventoryItemSerializer
    def get_queryset(self): return self.queryset if self.request.user.role == UserRole.ADMIN else self.queryset.none()
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN); serializer.save(created_by=self.request.user)
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status="inactive"; instance.save(update_fields=["status","updated_at"])


class StockBalanceViewSet(InventoryBase):
    queryset = StockBalance.objects.select_related("item", "school", "trainer")
    serializer_class = StockBalanceSerializer
    def get_queryset(self):
        u = self.request.user
        if u.role == UserRole.ADMIN: return self.queryset
        if u.role == UserRole.SCHOOL: return self.queryset.filter(school__account_id=u.id)
        if u.role == UserRole.TRAINER: return self.queryset.filter(trainer__account_id=u.id)
        return self.queryset.none()

    @action(detail=False, methods=["post"], url_path="move")
    def move(self, request):
        self.required_action="EDIT"
        self.role_only(UserRole.ADMIN, UserRole.SCHOOL, UserRole.TRAINER)
        item = InventoryItem.objects.get(pk=request.data.get("item"))
        school = None; trainer = None
        if request.user.role == UserRole.SCHOOL: school = accessible_school_queryset(request.user).get(pk=request.data.get("school"))
        elif request.user.role == UserRole.TRAINER: trainer = accessible_trainer_queryset(request.user).get(pk=request.data.get("trainer"))
        elif request.data.get("school"): school = accessible_school_queryset(request.user).get(pk=request.data["school"])
        movement, balance = move_stock(item=item, quantity_delta=int(request.data.get("quantity_delta",0)), performed_by=request.user, reason=request.data.get("reason",""), school=school, trainer=trainer, reference=request.data.get("reference",""))
        return Response({"movement": StockMovementSerializer(movement).data, "balance": StockBalanceSerializer(balance).data}, status=status.HTTP_201_CREATED)


class StockMovementViewSet(InventoryBase):
    queryset = StockMovement.objects.select_related("item", "school", "trainer", "performed_by")
    serializer_class = StockMovementSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        if u.role==UserRole.SCHOOL: return self.queryset.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER: return self.queryset.filter(trainer__account_id=u.id)
        return self.queryset.none()
    def perform_create(self, serializer): raise PermissionDenied("Use the stock move operation to create inventory movements.")


class KitViewSet(InventoryBase):
    queryset = Kit.objects.select_related("school_class__school","created_by").prefetch_related("items")
    serializer_class = KitSerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        if u.role==UserRole.SCHOOL: return self.queryset.filter(school_class__school__account_id=u.id)
        if u.role==UserRole.TRAINER: return self.queryset.filter(school_class__school__trainer_assignments__trainer__account_id=u.id, school_class__school__trainer_assignments__status="active").distinct()
        if u.role==UserRole.STUDENT: return self.queryset.filter(school_class_id__in=accessible_class_queryset(u).values("id"))
        return self.queryset.none()
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save(created_by=self.request.user)
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN); instance.status="inactive"; instance.save(update_fields=["status","updated_at"])


class KitItemViewSet(InventoryBase):
    queryset=KitItem.objects.select_related("kit","item")
    serializer_class=KitItemSerializer
    def get_queryset(self): return self.queryset if self.request.user.role==UserRole.ADMIN else self.queryset.filter(kit__in=KitViewSet().get_queryset())
    def perform_create(self, serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_update(self, serializer): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); serializer.save()
    def perform_destroy(self, instance): self.role_only(UserRole.ADMIN,UserRole.SCHOOL); instance.delete()


class KitCustodyViewSet(InventoryBase):
    queryset=KitCustody.objects.select_related("kit","school","trainer","student","issued_by","returned_by")
    serializer_class=KitCustodySerializer
    def get_queryset(self):
        u=self.request.user
        if u.role==UserRole.ADMIN: return self.queryset
        if u.role==UserRole.SCHOOL: return self.queryset.filter(school__account_id=u.id)
        if u.role==UserRole.TRAINER: return self.queryset.filter(trainer__account_id=u.id)
        if u.role==UserRole.STUDENT: return self.queryset.filter(student__account_id=u.id)
        return self.queryset.none()
    @action(detail=False, methods=["post"], url_path="issue")
    def issue(self, request):
        self.required_action="ASSIGN"; self.role_only(UserRole.ADMIN,UserRole.SCHOOL,UserRole.TRAINER)
        kit=Kit.objects.get(pk=request.data.get("kit"))
        school=trainer=student=None
        if request.data.get("school"): school=accessible_school_queryset(request.user).get(pk=request.data["school"])
        if request.data.get("trainer"): trainer=accessible_trainer_queryset(request.user).get(pk=request.data["trainer"])
        if request.data.get("student"): student=accessible_student_queryset(request.user).get(pk=request.data["student"])
        custody=issue_kit(kit=kit,issued_by=request.user,school=school,trainer=trainer,student=student,notes=request.data.get("notes",""))
        return Response(self.get_serializer(custody).data,status=status.HTTP_201_CREATED)
    @action(detail=True, methods=["post"], url_path="return")
    def return_kit_action(self,request,pk=None):
        self.required_action="EDIT"; self.role_only(UserRole.ADMIN,UserRole.SCHOOL,UserRole.TRAINER)
        custody=self.get_object(); return Response(self.get_serializer(return_kit(custody=custody,returned_by=request.user,notes=request.data.get("notes",""))).data)
    def perform_destroy(self, instance): raise PermissionDenied("Custody history cannot be deleted.")
