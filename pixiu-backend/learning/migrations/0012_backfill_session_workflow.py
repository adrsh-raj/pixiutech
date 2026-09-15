from django.db import migrations


def backfill_session_workflow(apps, schema_editor):
    Session = apps.get_model("learning", "Session")
    SessionWorkflow = apps.get_model("learning", "SessionWorkflow")
    CurriculumUnitProfile = apps.get_model("learning", "CurriculumUnitProfile")

    profile_by_unit = dict(
        CurriculumUnitProfile.objects.values_list("curriculum_unit_id", "technology_id")
    )
    missing = []
    for session in Session.objects.filter(curriculum_unit_id__isnull=False).only("id", "curriculum_unit_id"):
        if not profile_by_unit.get(session.curriculum_unit_id):
            continue
        if SessionWorkflow.objects.filter(session_id=session.id).exists():
            continue
        missing.append(
            SessionWorkflow(
                session_id=session.id,
                technology_id=profile_by_unit[session.curriculum_unit_id],
                is_last_session_for_unit=False,
            )
        )
    if missing:
        SessionWorkflow.objects.bulk_create(missing, ignore_conflicts=True)


def noop(apps, schema_editor):
    # Deliberately do not delete workflow metadata on rollback. The data is
    # valid derived session metadata and removing it would destroy information
    # that may have been edited after this migration ran.
    return None


class Migration(migrations.Migration):
    dependencies = [("learning", "0011_learning_content_file_backup")]

    operations = [migrations.RunPython(backfill_session_workflow, noop)]
