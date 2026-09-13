from .course_completion_models import ProgrammeCompletion


def cohort_rank(student):
    """Return a stable class rank for programme records that have a recorded score.

    In-progress students have no programme completion score yet, so they do not
    receive a misleading rank. Completed/requested programme scores are ranked
    highest-first inside the student's active class, with student ID as a
    deterministic tie-breaker.
    """
    programme = ProgrammeCompletion.objects.filter(student=student).only("overall_score").first()
    if not programme:
        return None

    higher = ProgrammeCompletion.objects.filter(
        student__school_class_id=student.school_class_id,
        student__status="active",
        overall_score__gt=programme.overall_score,
    ).count()
    return higher + 1
