from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserRole
from academics.models import School, SchoolClass, Student, Trainer, TrainerSchoolAssignment
from academics.views import SchoolClassViewSet, SchoolViewSet, StudentViewSet, TrainerViewSet
from billing.models import Invoice, PaymentMethod
from billing.serializers import InvoiceSerializer, PaymentSerializer, ReceiptSerializer
from billing.services import record_payment
from billing.views import InvoiceViewSet
from crm.models import Lead, LeadStatus
from crm.views import LeadViewSet
from inventory.views import KitViewSet
from learning.models import AttendanceRecord, Session
from learning.serializers import (
    AttendanceRecordSerializer, CurriculumUnitSerializer, LearningContentSerializer, ProjectSerializer,
    QuizAttemptReadSerializer, QuizSerializer, SessionSerializer, StudentAssessmentSerializer,
)
from learning.views import (
    AssessmentViewSet, AttendanceViewSet, ContentViewSet, CurriculumUnitViewSet,
    ProjectViewSet, QuizAttemptViewSet, QuizViewSet, SessionViewSet,
)
from notifications.models import Notification
from notifications.views import NotificationViewSet

User = get_user_model()


def _first(data, *keys, default=None):
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return default


def _school(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = School.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or School.objects.filter(school_code=raw.upper()).first()


def _trainer(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = Trainer.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or Trainer.objects.filter(trainer_id=raw.upper()).first()


def _class(value, school=None):
    if not value:
        return None
    try:
        obj = SchoolClass.objects.filter(pk=value).first()
    except (ValueError, TypeError):
        obj = None
    if obj:
        return obj
    raw = str(value).strip().upper()
    if raw.startswith("CLS-"):
        raw = raw[4:]
    if school and "-" in raw:
        raw = raw.rsplit("-", 1)[-1]
    if school:
        return SchoolClass.objects.filter(school=school, display_name=raw).first()
    return SchoolClass.objects.filter(display_name=raw).first()


def _student(value):
    if not value:
        return None
    raw = str(value).strip()
    try:
        obj = Student.objects.filter(pk=raw).first()
    except (ValueError, TypeError):
        obj = None
    return obj or Student.objects.filter(student_id=raw.upper()).first()


class ContractSchoolViewSet(viewsets.ModelViewSet):
    pass
