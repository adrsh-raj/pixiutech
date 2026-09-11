from django.db import migrations, models
import django.db.models.deletion


def backfill_curriculum_units(apps, schema_editor):
    Session = apps.get_model("learning", "Session")
    CurriculumUnit = apps.get_model("learning", "CurriculumUnit")
    marker = "__PIXIU_CURRICULUM_UNIT_ID__:"
    for session in Session.objects.filter(curriculum_unit__isnull=True).iterator():
        notes = str(session.notes or "")
        start = notes.find(marker)
        if start < 0:
            continue
        tail = notes[start + len(marker):]
        raw_id = tail.split("__", 1)[0].strip()
        try:
            unit = CurriculumUnit.objects.filter(pk=raw_id).first()
        except Exception:
            unit = None
        if unit:
            session.curriculum_unit_id = unit.pk
            session.notes = (notes[:start] + (tail.split("__", 1)[1] if "__" in tail else "")).strip()
            session.save(update_fields=["curriculum_unit", "notes"])


class Migration(migrations.Migration):
    dependencies = [("learning", "0003_sessionactivity_title_required")]

    operations = [
        migrations.AddField(
            model_name="session",
            name="curriculum_unit",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sessions",
                to="learning.curriculumunit",
            ),
        ),
        migrations.RunPython(backfill_curriculum_units, migrations.RunPython.noop),
    ]
