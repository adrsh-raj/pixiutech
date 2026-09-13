from django.db.models import Count

from academics.models import Student
from learning import course_completion_v3 as completion


def cohort_rank(student):
    """Return one-based competition rank within the student's class."""
    candidates = (
        Student.objects
        .filter(school_class=student.school_class, status='active')
        .order_by('student_id')
    )
    scores = []
    for candidate in candidates:
        try:
            score = float(completion.programme_state(candidate)[2])
        except (TypeError, ValueError):
            score = 0.0
        scores.append((candidate.pk, score))

    target = next((score for student_id, score in scores if student_id == student.pk), 0.0)
    return 1 + sum(score > target for _, score in scores)


# course_completion_v3.summary() references cohort_rank as a module global.
# Bind the validated helper into that module so the legacy summary contract and
# certificate generation use the same class-level ranking rule.
completion.cohort_rank = cohort_rank
