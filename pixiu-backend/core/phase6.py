from calendar import month_abbr
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.permissions import BasePermission
from rest_framework.views import APIView

from accounts.models import User, UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from billing.models import Invoice, InvoiceLineItem, Payment, Receipt
from crm.models import Lead, LeadActivity, LeadContact
from inventory.models import InventoryItem, Kit, KitCustody, KitItem, StockBalance, StockMovement
from learning.models import AttendanceRecord, ContentClassAssignment, CurriculumUnit, LearningContent, Project, ProjectEvidence, Quiz, QuizAttempt, QuizClassAssignment, Session, StudentAssessment
from notifications.models import Notification, NotificationPreference
from .phase6_auth import ExpressJWTAuthentication

class AdminOnly(BasePermission):
    message = "Administrator access required."
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, "role", None) == UserRole.ADMIN)

def _money(value):
    return float(value or Decimal("0"))

def _audit(request, action, entity_type, summary, changes=None):
    actor = None
    username = getattr(request.user, "username", "")
    if username:
        actor = User.objects.filter(username=username).first()
    AuditLog.objects.create(actor=actor, action=action, entity_type=entity_type, summary=summary, changes=changes or {}, ip_address=request.META.get("REMOTE_ADDR"), user_agent=request.META.get("HTTP_USER_AGENT", "")[:2000])

class Phase6BaseAPIView(APIView):
    authentication_classes = [ExpressJWTAuthentication]
    permission_classes = [AdminOnly]

class DashboardSummaryAPI(Phase6BaseAPIView):
    def get(self, request):
        attendance_total = AttendanceRecord.objects.count()
        present = AttendanceRecord.objects.filter(status="present").count()
        successful = Payment.objects.filter(status="success")
        return JsonResponse({"generated_at": timezone.now().isoformat(), "academics": {"schools": School.objects.count(), "active_schools": School.objects.filter(status="active").count(), "trainers": Trainer.objects.count(), "active_trainers": Trainer.objects.filter(status="active").count(), "classes": SchoolClass.objects.count(), "students": Student.objects.count(), "active_students": Student.objects.filter(status="active").count(), "active_trainer_school_assignments": TrainerSchoolAssignment.objects.filter(status="active").count()}, "learning": {"sessions": Session.objects.count(), "completed_sessions": Session.objects.filter(status="completed").count(), "attendance_records": attendance_total, "attendance_rate": round(present / attendance_total * 100, 2) if attendance_total else None, "curriculum_units": CurriculumUnit.objects.count(), "content": LearningContent.objects.count(), "quizzes": Quiz.objects.count(), "quiz_attempts": QuizAttempt.objects.count(), "projects": Project.objects.count(), "assessments": StudentAssessment.objects.count()}, "finance": {"invoices": Invoice.objects.count(), "invoiced": _money(Invoice.objects.aggregate(v=Sum("total_amount"))["v"]), "collected": _money(successful.aggregate(v=Sum("amount"))["v"]), "pending_payments": _money(Payment.objects.filter(status="pending").aggregate(v=Sum("amount"))["v"]), "overdue_invoices": Invoice.objects.filter(status="overdue").count()}, "inventory": {"items": InventoryItem.objects.count(), "kits": Kit.objects.count(), "stock_balances": StockBalance.objects.count(), "stock_movements": StockMovement.objects.count(), "active_custody": KitCustody.objects.filter(returned_at__isnull=True).count()}, "crm": {"leads": Lead.objects.count(), "open_leads": Lead.objects.exclude(status__in=["won", "lost"]).count(), "won_leads": Lead.objects.filter(status="won").count()}, "notifications": Notification.objects.count()})

class ReportsOverviewAPI(Phase6BaseAPIView):
    def get(self, request):
        start = timezone.localdate().replace(day=1)
        months = []
        for offset in range(11, -1, -1):
            year = start.year + (start.month - 1 - offset) // 12
            month = (start.month - 1 - offset) % 12 + 1
            months.append((year, month))
        invoice_rows = Invoice.objects.annotate(month=TruncMonth("issue_date")).values("month").annotate(value=Sum("total_amount"))
        payment_rows = Payment.objects.filter(status="success").annotate(month=TruncMonth("payment_date")).values("month").annotate(value=Sum("amount"))
        invoices = {(r["month"].year, r["month"].month): _money(r["value"]) for r in invoice_rows if r["month"]}
        payments = {(r["month"].year, r["month"].month): _money(r["value"]) for r in payment_rows if r["month"]}
        return JsonResponse({"generated_at": timezone.now().isoformat(), "monthly_finance": [{"label": f"{month_abbr[m]} {str(y)[2:]}", "invoiced": invoices.get((y, m), 0), "collected": payments.get((y, m), 0)} for y, m in months], "students_by_grade": list(Student.objects.values(grade=F("school_class__grade")).annotate(total=Count("id")).order_by("grade")), "lead_funnel": list(Lead.objects.values("status").annotate(total=Count("id")).order_by("status")), "top_schools": list(School.objects.annotate(student_count=Count("classes__students", distinct=True)).values("school_code", "name", "student_count").order_by("-student_count", "school_code")[:10]), "trainer_load": list(Trainer.objects.annotate(session_count=Count("sessions", distinct=True)).values("trainer_id", "name", "session_count").order_by("-session_count", "trainer_id")[:20])})

class IntegrityAuditAPI(Phase6BaseAPIView):
    def get(self, request):
        return JsonResponse(IntegrityAudit.run_checks())

class ControlledResetAPI(Phase6BaseAPIView):
    RESET_PHRASE = "RESET PIXIU DATA"
    SCOPES = {"learning_runtime", "business", "inventory", "notifications", "all_operational"}
    def post(self, request):
        scope = str(request.data.get("scope", "")).strip().lower()
        confirmation = str(request.data.get("confirmation", "")).strip()
        dry_run = bool(request.data.get("dry_run", False))
        if scope not in self.SCOPES:
            return JsonResponse({"error": "Invalid reset scope.", "allowed_scopes": sorted(self.SCOPES)}, status=400)
        if confirmation != self.RESET_PHRASE:
            return JsonResponse({"error": f"Type '{self.RESET_PHRASE}' exactly to authorize this reset."}, status=400)
        counts = self._counts(scope)
        if dry_run:
            return JsonResponse({"dry_run": True, "scope": scope, "would_delete": counts, "preserved": ["accounts", "academics", "audit_logs"]})
        with transaction.atomic():
            deleted = self._reset(scope)
            _audit(request, AuditAction.DELETE, "controlled_reset", f"Controlled data reset completed: {scope}", {"scope": scope, "deleted": deleted})
        return JsonResponse({"success": True, "scope": scope, "deleted": deleted, "preserved": ["accounts", "academics", "audit_logs"]})
    def _models(self, scope):
        groups = {"learning_runtime": [AttendanceRecord, ProjectEvidence, Project, QuizAttempt, StudentAssessment, Session], "business": [Receipt, Payment, InvoiceLineItem, Invoice, LeadActivity, LeadContact, Lead], "inventory": [KitCustody, KitItem, Kit, StockMovement, StockBalance, InventoryItem], "notifications": [NotificationPreference, Notification]}
        return groups[scope] if scope != "all_operational" else sum(groups.values(), [])
    def _counts(self, scope):
        return {model.__name__: model.objects.count() for model in self._models(scope)}
    def _reset(self, scope):
        return {model.__name__: model.objects.all().delete()[0] for model in self._models(scope)}

class IntegrityAudit:
    @staticmethod
    def _item(code, severity, count, message, samples=None):
        return {"code": code, "severity": severity, "count": int(count), "message": message, "samples": samples or []}
    @staticmethod
    def run_checks():
        checks = [("assignment_dates", IntegrityAudit.assignment_dates), ("session_trainer_school", IntegrityAudit.session_trainer_school), ("attendance_class_scope", IntegrityAudit.attendance_class_scope), ("student_rolls", IntegrityAudit.student_rolls), ("invoice_math", IntegrityAudit.invoice_math), ("payments_over_invoice", IntegrityAudit.payments_over_invoice), ("invoice_lines", IntegrityAudit.invoice_lines), ("content_assignment_grade", IntegrityAudit.content_assignment_grade), ("quiz_attempt_scope", IntegrityAudit.quiz_attempt_scope), ("kit_custody_scope", IntegrityAudit.kit_custody_scope), ("account_profiles", IntegrityAudit.account_profiles)]
        findings = [fn(code) for code, fn in checks]
        errors = sum(item["count"] for item in findings if item["severity"] == "error")
        warnings = sum(item["count"] for item in findings if item["severity"] == "warning")
        return {"status": "healthy" if errors == 0 else "attention_required", "error_count": errors, "warning_count": warnings, "checked_at": timezone.now().isoformat(), "findings": findings}
    @staticmethod
    def assignment_dates(code):
        q = TrainerSchoolAssignment.objects.filter(assigned_to__lt=F("assigned_from"))
        return IntegrityAudit._item(code, "error", q.count(), "Trainer assignment ends before it starts.", list(q.values("id", "trainer__trainer_id", "school__school_code")[:5]))
    @staticmethod
    def session_trainer_school(code):
        count = 0; samples = []
        for row in Session.objects.select_related("school_class__school", "trainer").iterator():
            valid = TrainerSchoolAssignment.objects.filter(trainer=row.trainer, school=row.school_class.school, status="active", assigned_from__lte=row.date).filter(Q(assigned_to__isnull=True) | Q(assigned_to__gte=row.date)).exists()
            if not valid:
                count += 1
                if len(samples) < 5: samples.append({"id": str(row.id), "trainer": row.trainer.trainer_id, "school": row.school_class.school.school_code, "date": row.date.isoformat()})
        return IntegrityAudit._item(code, "error", count, "Session trainer was not assigned to the session school on that date.", samples)
    @staticmethod
    def attendance_class_scope(code):
        q = AttendanceRecord.objects.exclude(session__school_class_id=F("student__school_class_id"))
        return IntegrityAudit._item(code, "error", q.count(), "Attendance points to a student outside the session class.", list(q.values("id", "session_id", "student_id")[:5]))
    @staticmethod
    def student_rolls(code):
        q = Student.objects.values("school_class", "roll_number").annotate(n=Count("id")).filter(n__gt=1)
        return IntegrityAudit._item(code, "error", q.count(), "Duplicate roll numbers exist inside a class.", list(q[:5]))
    @staticmethod
    def invoice_math(code):
        q = Invoice.objects.exclude(total_amount=F("subtotal") + F("tax_amount"))
        return IntegrityAudit._item(code, "error", q.count(), "Invoice total does not equal subtotal plus tax.", list(q.values("invoice_number", "subtotal", "tax_amount", "total_amount")[:5]))
    @staticmethod
    def payments_over_invoice(code):
        count = 0; samples = []
        for inv in Invoice.objects.all().iterator():
            paid = inv.payments.filter(status="success").aggregate(v=Sum("amount"))["v"] or Decimal("0")
            if paid > inv.total_amount:
                count += 1
                if len(samples) < 5: samples.append({"invoice": inv.invoice_number, "total": _money(inv.total_amount), "successful_payments": _money(paid)})
        return IntegrityAudit._item(code, "error", count, "Successful payments exceed the invoice total.", samples)
    @staticmethod
    def invoice_lines(code):
        q = InvoiceLineItem.objects.exclude(line_total=F("quantity") * F("unit_price"))
        return IntegrityAudit._item(code, "warning", q.count(), "Invoice line total differs from quantity × unit price.", list(q.values("id", "invoice__invoice_number", "quantity", "unit_price", "line_total")[:5]))
    @staticmethod
    def content_assignment_grade(code):
        count = 0; samples = []
        for row in ContentClassAssignment.objects.select_related("content", "school_class").iterator():
            if row.content.grade and row.content.grade.upper() != row.school_class.grade.upper():
                count += 1
                if len(samples) < 5: samples.append({"content": str(row.content.id), "class": str(row.school_class.id)})
        return IntegrityAudit._item(code, "warning", count, "Content is assigned to a class with a different grade.", samples)
    @staticmethod
    def quiz_attempt_scope(code):
        count = 0; samples = []
        for row in QuizAttempt.objects.select_related("quiz", "student__school_class").iterator():
            if not QuizClassAssignment.objects.filter(quiz=row.quiz, school_class=row.student.school_class).exists():
                count += 1
                if len(samples) < 5: samples.append({"attempt": str(row.id), "quiz": str(row.quiz.id), "student": row.student.student_id})
        return IntegrityAudit._item(code, "warning", count, "Quiz attempt belongs to a class not assigned that quiz.", samples)
    @staticmethod
    def kit_custody_scope(code):
        q = KitCustody.objects.filter(school__isnull=False, trainer__isnull=False) | KitCustody.objects.filter(school__isnull=False, student__isnull=False) | KitCustody.objects.filter(trainer__isnull=False, student__isnull=False)
        return IntegrityAudit._item(code, "error", q.count(), "Kit custody has multiple recipient types.")
    @staticmethod
    def account_profiles(code):
        count = 0; samples = []
        for user in User.objects.filter(role__in=[UserRole.SCHOOL, UserRole.TRAINER, UserRole.STUDENT]).iterator():
            try:
                _ = user.school_profile if user.role == UserRole.SCHOOL else user.trainer_profile if user.role == UserRole.TRAINER else user.student_profile
            except Exception:
                count += 1
                if len(samples) < 5: samples.append({"username": user.username, "role": user.role})
        return IntegrityAudit._item(code, "warning", count, "Non-admin account has no authoritative academic profile.", samples)
