from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import Student, TrainerSchoolAssignment
from audit.models import AuditAction, AuditLog
from learning.models import AssessmentStatus, AttendanceStatus, StudentAssessment

COMPLETION_LEVELS = 6


def _level_key(assessment):
    return str(assessment.level or assessment.unit_code or assessment.title or '').strip().lower()


def _completion_assessments(student):
    rows = StudentAssessment.objects.filter(student=student, status=AssessmentStatus.PUBLISHED, score__isnull=False).select_related('trainer').order_by('assessment_date', 'created_at')
    unique = {}
    for row in rows:
        key = _level_key(row)
        if key:
            unique[key] = row
    return list(unique.values())


def _is_certified(student):
    return 'certified graduate' in str(student.current_level or '').lower()


def _certificate_ref(student):
    school = student.school_class.school
    year = timezone.localdate().year
    return f"PIXIU-{school.school_code}-{str(student.student_id).replace(' ', '')}-{year}"


def _attendance_rate(student):
    records = student.attendance_records.all().only('status')
    total = records.count()
    if not total:
        return 0
    attended = records.filter(status__in=[AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED]).count()
    return round((attended / total) * 100)


def _public_payload(student, request=None):
    school_class = student.school_class
    school = school_class.school
    assessments = _completion_assessments(student)
    certified = _is_certified(student)
    completed = len(assessments)
    verified = certified and completed >= COMPLETION_LEVELS
    certificate_ref = _certificate_ref(student)
    public_origin = str(getattr(settings, 'PUBLIC_APP_URL', 'https://pixiutech.com')).rstrip('/')
    verify_url = f"{public_origin}/verify?id={student.student_id}"
    project_rows = [
        {'title': project.title, 'status': project.status, 'score': float(project.score) if project.score is not None else None, 'completed_at': project.completed_at.isoformat() if project.completed_at else None}
        for project in student.projects.all().order_by('-updated_at')
    ]
    latest_trainer = assessments[-1].trainer if assessments else None
    return {
        'verified': verified,
        'status': 'verified' if verified else 'not_verified',
        'reason': None if verified else ('Certificate has not been issued by an authorised trainer.' if not certified else f'Course completion requires {COMPLETION_LEVELS} published unit evaluations; {completed} are currently recorded.'),
        'student_id': student.student_id,
        'student_name': student.name,
        'school_name': school.name,
        'school_code': school.school_code,
        'class_name': school_class.display_name,
        'grade': school_class.grade,
        'section': school_class.section,
        'current_level': student.current_level,
        'certificate_ref': certificate_ref,
        'verification_url': verify_url,
        'attendance_rate': _attendance_rate(student),
        'completion_count': completed,
        'required_completion_count': COMPLETION_LEVELS,
        'assessments': [
            {'level': row.level, 'unit_code': row.unit_code, 'title': row.title, 'score': float(row.score) if row.score is not None else None, 'rating': float(row.rating) if row.rating is not None else None, 'feedback': row.feedback, 'assessment_date': row.assessment_date.isoformat(), 'trainer_name': row.trainer.name}
            for row in assessments
        ],
        'projects': project_rows,
        'trainer_name': latest_trainer.name if latest_trainer else '',
        'registry': 'Pixiu Tech Central Registry',
    }


class IssueCertificateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if getattr(request.user, 'status', 'active') != 'active':
            return JsonResponse({'detail': 'Active account required.'}, status=403)
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}:
            return JsonResponse({'detail': 'Only trainers and administrators can issue certificates.'}, status=403)
        student = get_object_or_404(Student.objects.select_related('school_class__school', 'account'), pk=pk)
        if request.user.role == UserRole.TRAINER and not TrainerSchoolAssignment.objects.filter(trainer__account=request.user, school=student.school_class.school, status='active').exists():
            return JsonResponse({'detail': 'Student is outside your active school assignment.'}, status=403)
        assessments = _completion_assessments(student)
        if len(assessments) < COMPLETION_LEVELS:
            return JsonResponse({'detail': f'Certificate requires {COMPLETION_LEVELS} distinct published unit evaluations.', 'completion_count': len(assessments), 'required_completion_count': COMPLETION_LEVELS}, status=400)
        with transaction.atomic():
            student.current_level = 'Level 5 (Certified Graduate)'
            student.save(update_fields=['current_level', 'updated_at'])
            AuditLog.objects.create(actor=request.user, action=AuditAction.OTHER, entity_type='student_certificate', entity_id=str(student.pk), summary=f'Graduate certificate issued for {student.student_id}.', changes={'student_id': student.student_id, 'certificate_ref': _certificate_ref(student), 'completion_count': len(assessments)}, ip_address=request.META.get('REMOTE_ADDR'), user_agent=request.META.get('HTTP_USER_AGENT', ''))
        payload = _public_payload(student, request)
        payload.update({'issued': True, 'issued_by': request.user.display_name or request.user.username, 'issued_at': timezone.now().isoformat()})
        return JsonResponse(payload, status=200)


def verify_certificate(request, student_id):
    student = Student.objects.select_related('school_class__school').prefetch_related('projects').filter(student_id__iexact=str(student_id).strip()).first()
    if not student:
        return JsonResponse({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech credential matches this Student ID.'}, status=404)
    return JsonResponse(_public_payload(student, request), status=200)


class VerifyCertificateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, student_id):
        return verify_certificate(request, student_id)
