from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from academics.models import SchoolClass, Student
from academics.services import accessible_class_queryset, accessible_student_queryset
from learning.course_completion_v3 import admin_complete, certificate_payload, ensure_scope, evaluate_last_session, issue_certificate, policy_for, request_completion, serialize_policy, summary, update_policy
from learning.course_completion_models import Certificate, Technology


def _error(exc, code=400):
    return Response({'detail': str(exc)}, status=code)


def _student_for(user, key):
    qs = accessible_student_queryset(user).select_related('school_class__school')
    student = qs.filter(pk=key).first()
    return student or get_object_or_404(qs, student_id__iexact=str(key).strip())


def _class_for(user, key):
    qs = accessible_class_queryset(user)
    return qs.filter(pk=key).first() or get_object_or_404(qs, pk=key)


class TechnologyListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(list(Technology.objects.filter(active=True).values('id', 'code', 'name', 'sort_order')))
    def post(self, request):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can manage the technology catalogue.'), 403)
        name = str(request.data.get('name') or '').strip()
        code = str(request.data.get('code') or name).strip().lower().replace(' ', '-')
        if not name or not code: return _error(ValueError('Technology name is required.'))
        raw_active = request.data.get('active', True)
        active = raw_active if isinstance(raw_active, bool) else str(raw_active).strip().lower() not in {'false', '0', 'no', 'off'}
        try: sort_order = int(request.data.get('sort_order') or 0)
        except (TypeError, ValueError): sort_order = 0
        technology, created = Technology.objects.get_or_create(code=code, defaults={'name': name, 'sort_order': sort_order, 'active': active})
        if not created:
            technology.name, technology.sort_order, technology.active = name, sort_order, active
            technology.save(update_fields=['name', 'sort_order', 'active', 'updated_at'])
        return Response({'id': str(technology.id), 'code': technology.code, 'name': technology.name, 'sort_order': technology.sort_order, 'active': technology.active}, status=201 if created else 200)


class CourseCompletionListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response([summary(student) for student in accessible_student_queryset(request.user).select_related('school_class__school').filter(status='active')[:500]])


class CourseCompletionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, student_key):
        student = _student_for(request.user, student_key)
        return Response(summary(student))


class CompletionPolicyView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, class_key):
        school_class = _class_for(request.user, class_key)
        try: ensure_scope(request.user, school_class.students.first())
        except AttributeError: pass
        return Response(serialize_policy(policy_for(school_class)))
    def put(self, request, class_key):
        if request.user.role != UserRole.ADMIN:
            return _error(PermissionError('Only administrators can edit completion criteria.'), 403)
        school_class = get_object_or_404(SchoolClass, pk=class_key)
        try: return Response(serialize_policy(update_policy(school_class, request.data)))
        except (TypeError, ValueError) as exc: return _error(exc)


class EvaluateLastSessionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, session_id):
        if request.user.role not in {UserRole.ADMIN, UserRole.TRAINER}: return _error(PermissionError('Only trainers and administrators can evaluate a unit.'), 403)
        from learning.models import Session
        session = get_object_or_404(Session.objects.select_related('school_class', 'curriculum_unit'), pk=session_id)
        if request.user.role == UserRole.TRAINER:
            student = accessible_student_queryset(request.user).filter(school_class=session.school_class).first()
            if not student: return _error(PermissionError('This session is outside your authorised school scope.'), 403)
        try:
            rows = evaluate_last_session(session)
            return Response({'session_id': str(session.id), 'unit_code': session.curriculum_unit.unit_code, 'evaluated_students': len(rows), 'passed': sum(row.status == 'passed' for row in rows), 'failed_or_pending': sum(row.status != 'passed' for row in rows)})
        except ValueError as exc: return _error(exc)


class RequestProgrammeCompletionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try:
            programme = request_completion(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Course completion requested from Admin.'})
        except PermissionError as exc: return _error(exc, 403)
        except ValueError as exc: return _error(exc)


class AdminCompleteProgrammeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        if request.user.role != UserRole.ADMIN: return _error(PermissionError('Only administrators can mark a programme completed.'), 403)
        student = _student_for(request.user, student_key)
        try:
            programme = admin_complete(request.user, student)
            return Response({'status': programme.status, 'student_id': student.student_id, 'overall_score': float(programme.overall_score), 'detail': 'Programme marked completed.'})
        except ValueError as exc: return _error(exc)


class IssueProgrammeCertificateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, student_key):
        student = _student_for(request.user, student_key)
        try: return Response(certificate_payload(issue_certificate(request.user, student)))
        except PermissionError as exc: return _error(exc, 403)
        except ValueError as exc: return _error(exc)


class VerifyProgrammeCertificateView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, student_id=None):
        key = str(request.query_params.get('certificate') or request.query_params.get('cert') or request.query_params.get('id') or student_id or '').strip()
        token = str(request.query_params.get('token') or '').strip()
        certificate = Certificate.objects.filter(verification_token=token).first() if token else None
        if certificate is None and key:
            certificate = Certificate.objects.filter(certificate_id__iexact=key).first()
        if certificate is not None: return Response(certificate_payload(certificate), status=200)
        if key:
            # Preserve verification for credentials issued by the legacy registry before the new Certificate table existed.
            from .certificate_views import _public_payload
            legacy_student = Student.objects.select_related('school_class__school').filter(student_id__iexact=key).first()
            if legacy_student: return Response(_public_payload(legacy_student, request), status=200)
        return Response({'verified': False, 'status': 'not_found', 'reason': 'No Pixiu Tech certificate matches this verification code.'}, status=404)
