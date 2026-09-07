from calendar import month_abbr
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView
from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from billing.models import Invoice, InvoiceLineItem, Payment, Receipt
from crm.models import Lead, LeadActivity, LeadContact
from inventory.models import InventoryItem, Kit, KitCustody, KitItem, StockBalance, StockMovement
from learning.models import AttendanceRecord, ContentClassAssignment, CurriculumUnit, LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment, Session, StudentAssessment
from notifications.models import Notification, NotificationPreference

class AdminOnly(IsAdminUser):
    message = "Administrator access required."

def _money(v):
    return float(v or Decimal("0"))

def _audit(request, action, entity_type, summary, changes=None):
    AuditLog.objects.create(actor=request.user if request.user.is_authenticated else None, action=action, entity_type=entity_type, summary=summary, changes=changes or {}, ip_address=request.META.get("REMOTE_ADDR"), user_agent=request.META.get("HTTP_USER_AGENT", "")[:2000])

class DashboardSummaryAPI(APIView):
    permission_classes=[AdminOnly]
    def get(self, request):
        total=AttendanceRecord.objects.count(); present=AttendanceRecord.objects.filter(status="present").count(); paid=Payment.objects.filter(status="success")
        return JsonResponse({"generated_at":timezone.now().isoformat(),"academics":{"schools":School.objects.count(),"active_schools":School.objects.filter(status="active").count(),"trainers":Trainer.objects.count(),"active_trainers":Trainer.objects.filter(status="active").count(),"classes":SchoolClass.objects.count(),"students":Student.objects.count(),"active_students":Student.objects.filter(status="active").count(),"active_trainer_school_assignments":TrainerSchoolAssignment.objects.filter(status="active").count()},"learning":{"sessions":Session.objects.count(),"completed_sessions":Session.objects.filter(status="completed").count(),"attendance_records":total,"attendance_rate":round(present/total*100,2) if total else None,"curriculum_units":CurriculumUnit.objects.count(),"content":LearningContent.objects.count(),"quizzes":Quiz.objects.count(),"quiz_attempts":QuizAttempt.objects.count(),"projects":Project.objects.count(),"assessments":StudentAssessment.objects.count()},"finance":{"invoices":Invoice.objects.count(),"invoiced":_money(Invoice.objects.aggregate(v=Sum("total_amount"))["v"]),"collected":_money(paid.aggregate(v=Sum("amount"))["v"]),"pending_payments":_money(Payment.objects.filter(status="pending").aggregate(v=Sum("amount"))["v"]),"overdue_invoices":Invoice.objects.filter(status="overdue").count()},"inventory":{"items":InventoryItem.objects.count(),"kits":Kit.objects.count(),"stock_balances":StockBalance.objects.count(),"stock_movements":StockMovement.objects.count(),"active_custody":KitCustody.objects.filter(returned_at__isnull=True).count()},"crm":{"leads":Lead.objects.count(),"open_leads":Lead.objects.exclude(status__in=["won","lost"]).count(),"won_leads":Lead.objects.filter(status="won").count()},"notifications":Notification.objects.count(),"integrity":IntegrityAudit.run_checks()})

class ReportsOverviewAPI(APIView):
    permission_classes=[AdminOnly]
    def get(self, request):
        start=timezone.localdate().replace(day=1); months=[]
        for offset in range(11,-1,-1):
            y=start.year+(start.month-1-offset)//12; m=(start.month-1-offset)%12+1; months.append((y,m))
        irows=Invoice.objects.annotate(month=TruncMonth("issue_date")).values("month").annotate(value=Sum("total_amount")); prows=Payment.objects.filter(status="success").annotate(month=TruncMonth("payment_date")).values("month").annotate(value=Sum("amount"))
        im={(r["month"].year,r["month"].month):_money(r["value"]) for r in irows if r["month"]}; pm={(r["month"].year,r["month"].month):_money(r["value"]) for r in prows if r["month"]}
        return JsonResponse({"generated_at":timezone.now().isoformat(),"monthly_finance":[{"label":f"{month_abbr[m]} {str(y)[2:]}","invoiced":im.get((y,m),0),"collected":pm.get((y,m),0)} for y,m in months],"students_by_grade":list(Student.objects.values(grade=F("school_class__grade")).annotate(total=Count("id")).order_by("grade")),"lead_funnel":list(Lead.objects.values("status").annotate(total=Count("id")).order_by("status")),"top_schools":list(School.objects.annotate(student_count=Count("classes__students",distinct=True)).values("school_code","name","student_count").order_by("-student_count","school_code")[:10]),"trainer_load":list(Trainer.objects.annotate(session_count=Count("sessions",distinct=True)).values("trainer_id","name","session_count").order_by("-session_count","trainer_id")[:20])})

class IntegrityAuditAPI(APIView):
    permission_classes=[AdminOnly]
    def get(self, request): return JsonResponse(IntegrityAudit.run_checks())

class ControlledResetAPI(APIView):
    permission_classes=[AdminOnly]; RESET_PHRASE="RESET PIXIU DATA"; SCOPES={"learning_runtime","business","inventory","notifications","all_operational"}
    def post(self, request):
        scope=str(request.data.get("scope","")).strip().lower(); confirmation=str(request.data.get("confirmation","")).strip(); dry=bool(request.data.get("dry_run",False))
        if scope not in self.SCOPES: return JsonResponse({"error":"Invalid reset scope.","allowed_scopes":sorted(self.SCOPES)},status=400)
        if confirmation!=self.RESET_PHRASE: return JsonResponse({"error":f"Type '{self.RESET_PHRASE}' exactly to authorize this reset."},status=400)
        counts=self._counts(scope)
        if dry: return JsonResponse({"dry_run":True,"scope":scope,"would_delete":counts,"preserved":["accounts","academics","audit_logs"]})
        with transaction.atomic():
            deleted=self._reset(scope); _audit(request,AuditAction.DELETE,"controlled_reset",f"Controlled data reset completed: {scope}",{"scope":scope,"deleted":deleted})
        return JsonResponse({"success":True,"scope":scope,"deleted":deleted,"preserved":["accounts","academics","audit_logs"]})
    def _models(self,scope):
        groups={"learning_runtime":[AttendanceRecord,ProjectEvidence,Project,QuizAttempt,StudentAssessment,Session],"business":[Receipt,Payment,InvoiceLineItem,Invoice,LeadActivity,LeadContact,Lead],"inventory":[KitCustody,KitItem,Kit,StockMovement,StockBalance,InventoryItem],"notifications":[NotificationPreference,Notification]}
        return groups[scope] if scope!="all_operational" else sum(groups.values(),[])
    def _counts(self,scope): return {m.__name__:m.objects.count() for m in self._models(scope)}
    def _reset(self,scope): return {m.__name__:m.objects.all().delete()[0] for m in self._models(scope)}

class IntegrityAudit:
    @staticmethod
    def _item(code,severity,count,message,samples=None): return {"code":code,"severity":severity,"count":int(count),"message":message,"samples":samples or []}
    @staticmethod
    def run_checks():
        fs=[IntegrityAudit.assignment_dates("assignment_dates"),IntegrityAudit.session_trainer_school("session_trainer_school"),IntegrityAudit.attendance_class_scope("attendance_class_scope"),IntegrityAudit.student_rolls("student_rolls"),IntegrityAudit.invoice_math("invoice_math"),IntegrityAudit.payments_over_invoice("payments_over_invoice"),IntegrityAudit.invoice_lines("invoice_lines"),IntegrityAudit.content_assignment_grade("content_assignment_grade"),IntegrityAudit.quiz_attempt_scope("quiz_attempt_scope"),IntegrityAudit.kit_custody_scope("kit_custody_scope"),IntegrityAudit.account_profiles("account_profiles")]
        e=sum(x["count"] for x in fs if x["severity"]=="error"); w=sum(x["count"] for x in fs if x["severity"]=="warning")
        return {"status":"healthy" if e==0 else "attention_required","error_count":e,"warning_count":w,"checked_at":timezone.now().isoformat(),"findings":fs}
    @staticmethod
    def assignment_dates(code):
        q=TrainerSchoolAssignment.objects.filter(assigned_to__lt=F("assigned_from")); return IntegrityAudit._item(code,"error",q.count(),"Trainer assignment ends before it starts.",list(q.values("id","trainer__trainer_id","school__school_code")[:5]))
    @staticmethod
    def session_trainer_school(code):
        bad=[]
        for r in Session.objects.select_related("school_class__school","trainer").iterator():
            ok=TrainerSchoolAssignment.objects.filter(trainer=r.trainer,school=r.school_class.school,status="active",assigned_from__lte=r.date).filter(Q(assigned_to__isnull=True)|Q(assigned_to__gte=r.date)).exists()
            if not ok: bad.append({"id":str(r.id),"trainer":r.trainer.trainer_id,"school":r.school_class.school.school_code,"date":r.date.isoformat()})
            if len(bad)>=5: break
        return IntegrityAudit._item(code,"error",len(bad),"Session trainer was not assigned to the session school on that date.",bad)
    @staticmethod
    def attendance_class_scope(code):
        q=AttendanceRecord.objects.exclude(session__school_class_id=F("student__school_class_id")); return IntegrityAudit._item(code,"error",q.count(),"Attendance points to a student outside the session class.",list(q.values("id","session_id","student_id")[:5]))
    @staticmethod
    def student_rolls(code):
        q=Student.objects.values("school_class","roll_number").annotate(n=Count("id")).filter(n__gt=1); return IntegrityAudit._item(code,"error",q.count(),"Duplicate roll numbers exist inside a class.",list(q[:5]))
    @staticmethod
    def invoice_math(code):
        q=Invoice.objects.exclude(total_amount=F("subtotal")+F("tax_amount")); return IntegrityAudit._item(code,"error",q.count(),"Invoice total does not equal subtotal plus tax.",list(q.values("invoice_number","subtotal","tax_amount","total_amount")[:5]))
    @staticmethod
    def payments_over_invoice(code):
        bad=[]
        for inv in Invoice.objects.all().iterator():
            paid=inv.payments.filter(status="success").aggregate(v=Sum("amount"))["v"] or Decimal("0")
            if paid>inv.total_amount: bad.append({"invoice":inv.invoice_number,"total":_money(inv.total_amount),"successful_payments":_money(paid)})
            if len(bad)>=5: break
        return IntegrityAudit._item(code,"error",len(bad),"Successful payments exceed the invoice total.",bad)
    @staticmethod
    def invoice_lines(code):
        q=InvoiceLineItem.objects.exclude(line_total=F("quantity")*F("unit_price")); return IntegrityAudit._item(code,"warning",q.count(),"Invoice line total differs from quantity × unit price.",list(q.values("id","invoice__invoice_number","quantity","unit_price","line_total")[:5]))
    @staticmethod
    def content_assignment_grade(code):
        bad=[]
        for r in ContentClassAssignment.objects.select_related("content","school_class").iterator():
            if r.content.grade and r.content.grade.upper()!=r.school_class.grade.upper(): bad.append({"content":str(r.content.id),"class":str(r.school_class.id)})
            if len(bad)>=5: break
        return IntegrityAudit._item(code,"warning",len(bad),"Content is assigned to a class with a different grade.",bad)
    @staticmethod
    def quiz_attempt_scope(code):
        bad=[]
        for r in QuizAttempt.objects.select_related("quiz","student__school_class").iterator():
            if not QuizClassAssignment.objects.filter(quiz=r.quiz,school_class=r.student.school_class).exists(): bad.append({"attempt":str(r.id),"quiz":str(r.quiz.id),"student":r.student.student_id})
            if len(bad)>=5: break
        return IntegrityAudit._item(code,"warning",len(bad),"Quiz attempt belongs to a class not assigned that quiz.",bad)
    @staticmethod
    def kit_custody_scope(code):
        q=KitCustody.objects.filter(school__isnull=False,trainer__isnull=False)|KitCustody.objects.filter(school__isnull=False,student__isnull=False)|KitCustody.objects.filter(trainer__isnull=False,student__isnull=False); return IntegrityAudit._item(code,"error",q.count(),"Kit custody has multiple recipient types.")
    @staticmethod
    def account_profiles(code):
        bad=[]
        for u in User.objects.filter(role__in=[UserRole.SCHOOL,UserRole.TRAINER,UserRole.STUDENT]).iterator():
            try: related=u.school_profile if u.role==UserRole.SCHOOL else u.trainer_profile if u.role==UserRole.TRAINER else u.student_profile
            except Exception: related=None
            if related is None: bad.append({"username":u.username,"role":u.role})
            if len(bad)>=5: break
        return IntegrityAudit._item(code,"warning",len(bad),"Non-admin account has no authoritative academic profile.",bad)
