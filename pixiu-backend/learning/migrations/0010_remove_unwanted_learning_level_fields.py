from django.db import migrations


FORWARD_SQL = """
ALTER TABLE learning_curriculumunit DROP COLUMN IF EXISTS level;
ALTER TABLE learning_learningcontent DROP COLUMN IF EXISTS level;
ALTER TABLE learning_quiz DROP COLUMN IF EXISTS level;
ALTER TABLE learning_studentassessment DROP COLUMN IF EXISTS level;
"""


class Migration(migrations.Migration):
    dependencies = [("learning", "0009_student_assessment_level_repair")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop),
            ],
            state_operations=[
                migrations.RemoveField(model_name="curriculumunit", name="level"),
                migrations.RemoveField(model_name="learningcontent", name="level"),
                migrations.RemoveField(model_name="quiz", name="level"),
                migrations.RemoveField(model_name="studentassessment", name="level"),
            ],
        ),
    ]
