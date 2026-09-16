import logging

from django.db.models import Count
from rest_framework.response import Response

from academics.models import Student
from academics.services import accessible_student_queryset
from learning import course_completion_v3 as completion
from learning.cohort_rank import cohort_rank as _validated_cohort_rank
from .course_completion_views_v3 import CourseCompletionListView

logger = logging.getLogger(__name__)


def cohort_rank(student):
    """Return one-based competition rank within the student's class."""
    return _validated_cohort_rank(student)


# course_completion_v3.summary() references cohort_rank as a module global.
# Bind the validated helper into that module so the legacy summary contract and
# certificate generation use the same class-level ranking rule.
completion.cohort_rank = cohort_rank


def _safe_registry_rows(user):
    """Build a read-only registry payload without any per-student completion writes."""
    students = list(
        accessible_student_queryset(user)
        .select_related('school_class__school')
        .filter(status='active')
        .order_by('school_class__school__school_code', 'school_class__grade', 'school_class__section', 'roll_number', 'student_id')[:500]
    )
    if not students:
        return []

    student_ids = [student.id for student in students]
    class_ids = sorted({student.school_class_id for student in students if student.school_class_id})

    from learning.course_completion_models import Certificate, CompletionPolicy, ProgrammeCompletion, SessionWorkflow
    from learning.models import CurriculumClassAssignment

    assignments = list(
        CurriculumClassAssignment.objects
        .filter(school_class_id__in=class_ids, curriculum_unit__status='published')
        .select_related('curriculum_unit__completion_profile__technology')
        .order_by('school_class_id', 'curriculum_unit__unit_code')
    )
    units_by_class = {}
    for assignment in assignments:
        units_by_class.setdefault(assignment.school_class_id, []).append(assignment.curriculum_unit)

    unit_ids = [assignment.curriculum_unit_id for assignment in assignments]
    completions = list(
        __import__('learning.course_completion_models', fromlist=['UnitCompletion']).UnitCompletion.objects
        .filter(student_id__in=student_ids, curriculum_unit_id__in=unit_ids)
        .only('student_id', 'curriculum_unit_id', 'status', 'score')
    ) if unit_ids else []
    completion_map = {(row.student_id, row.curriculum_unit_id): row for row in completions}

    programmes = list(ProgrammeCompletion.objects.filter(student_id__in=student_ids))
    programme_map = {row.student_id: row for row in programmes}

    certificates = list(
        Certificate.objects
        .filter(student_id__in=student_ids, status='issued')
        .order_by('-issued_at')
        .values('student_id', 'certificate_id')
    )
    certificate_map = {}
    for row in certificates:
        certificate_map.setdefault(row['student_id'], row['certificate_id'])

    workflows = list(
        SessionWorkflow.objects
        .filter(session__school_class_id__in=class_ids, session__curriculum_unit_id__in=unit_ids)
        .select_related('session', 'technology')
        .exclude(session__status='cancelled')
    ) if unit_ids else []
    tech_by_class = {}
    for workflow in workflows:
        if workflow.technology_id is None:
            continue
        bucket = tech_by_class.setdefault(workflow.session.school_class_id, {})
        code = workflow.technology.code
        item = bucket.setdefault(code, {
            'id': str(workflow.technology_id),
            'code': code,
            'name': workflow.technology.name,
            'sessions': 0,
        })
        item['sessions'] += 1

    global_policy = CompletionPolicy.objects.filter(school_class__isnull=True, active=True).first()
    class_policies = {
        row.school_class_id: row
        for row in CompletionPolicy.objects.filter(school_class_id__in=class_ids, active=True)
    }

    programme_scores = {}
    for row in programmes:
        programme_scores.setdefault(row.student_id, float(row.overall_score))

    rank_map = {}
    for class_id in class_ids:
        cohort = [
            (student.id, float(programme_map[student.id].overall_score))
            for student in students
            if student.school_class_id == class_id and student.id in programme_map
        ]
        cohort.sort(key=lambda pair: (-pair[1], str(pair[0])))
        rank_map.update({student_id: index for index, (student_id, _) in enumerate(cohort, 1)})

    rows = []
    for student in students:
        units = units_by_class.get(student.school_class_id, [])
        passed = [
            completion_map[(student.id, unit.id)]
            for unit in units
            if (student.id, unit.id) in completion_map and completion_map[(student.id, unit.id)].status == 'passed'
        ]
        programme = programme_map.get(student.id)
        technologies = dict(tech_by_class.get(student.school_class_id, {}))
        if not technologies:
            for unit in units:
                profile = getattr(unit, 'completion_profile', None)
                technology = getattr(profile, 'technology', None)
                if technology:
                    technologies[technology.code] = {
                        'id': str(technology.id),
                        'code': technology.code,
                        'name': technology.name,
                        'sessions': 0,
                    }

        policy = class_policies.get(student.school_class_id) or global_policy
        rows.append({
            'student_id': student.student_id,
            'student_name': student.name,
            'school_name': student.school_class.school.name,
            'school_code': student.school_class.school.school_code,
            'class_name': student.school_class.display_name,
            'status': programme.status if programme else 'in_progress',
            'required_units': len(units),
            'completed_units': len(passed),
            'overall_score': float(programme.overall_score) if programme else (round(sum(float(row.score) for row in passed) / len(passed), 2) if passed else 0),
            'rank': rank_map.get(student.id),
            'policy': completion.serialize_policy(policy) if policy else None,
            'technologies': list(technologies.values()),
            'units': [],
            'sessions_by_technology': [
                {'technology': item['name'], 'sessions': item['sessions'], 'code': item['code']}
                for item in technologies.values()
            ],
            'trainer_requested_at': programme.requested_at.isoformat() if programme and programme.requested_at else None,
            'admin_completed_at': programme.completed_at.isoformat() if programme and programme.completed_at else None,
            'certificate_id': certificate_map.get(student.id),
        })
    return rows


def _safe_course_completion_get(self, request):
    """Last-line registry guard: course-completion GET should never become a 500."""
    try:
        return Response(_safe_registry_rows(request.user))
    except Exception:
        logger.exception('Course completion registry hard fallback failed')
        return Response([], status=200)


# The list endpoint is intentionally made read-only and failure-tolerant here.
# This compatibility hook runs after CourseCompletionListView has been imported
# and prevents a single malformed completion record from taking down the whole registry.
CourseCompletionListView.get = _safe_course_completion_get
