from django.db import migrations, models
from django.db.models import Q
from django.db.models.functions import Lower, Trim


def deduplicate_assessments(apps, schema_editor):
    StudentAssessment = apps.get_model('learning', 'StudentAssessment')
    db_alias = schema_editor.connection.alias
    rows = StudentAssessment.objects.using(db_alias).all().order_by('student_id', 'unit_code', '-updated_at', '-created_at', '-id')

    keep = {}
    delete_ids = []
    for row in rows.iterator():
        unit_code = str(row.unit_code or '').strip().upper()
        if not unit_code:
            continue
        key = (row.student_id, unit_code)
        if key in keep:
            delete_ids.append(row.id)
            continue
        keep[key] = row.id

    if delete_ids:
        StudentAssessment.objects.using(db_alias).filter(id__in=delete_ids).delete()

    # Normalize retained unit codes so future uniqueness checks are deterministic.
    for (student_id, unit_code), row_id in keep.items():
        StudentAssessment.objects.using(db_alias).filter(id=row_id).update(unit_code=unit_code)


class Migration(migrations.Migration):
    dependencies = [('learning', '0006_unit_completion_overrides')]

    operations = [
        migrations.RunPython(deduplicate_assessments, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='studentassessment',
            constraint=models.UniqueConstraint(
                Lower(Trim('unit_code')), 'student',
                condition=~Q(unit_code=''),
                name='uniq_assessment_student_unit_ci',
            ),
        ),
    ]
