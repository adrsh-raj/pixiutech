from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0007_assessment_uniqueness"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE "learning_curriculumunit" DROP COLUMN IF EXISTS "level";\n'
                        'ALTER TABLE "learning_learningcontent" DROP COLUMN IF EXISTS "level";\n'
                        'ALTER TABLE "learning_quiz" DROP COLUMN IF EXISTS "level";\n'
                        'ALTER TABLE "learning_studentassessment" DROP COLUMN IF EXISTS "level";'
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                )
            ],
            state_operations=[
                migrations.RemoveField(model_name="curriculumunit", name="level"),
                migrations.RemoveField(model_name="learningcontent", name="level"),
                migrations.RemoveField(model_name="quiz", name="level"),
                migrations.RemoveField(model_name="studentassessment", name="level"),
            ],
        )
    ]
