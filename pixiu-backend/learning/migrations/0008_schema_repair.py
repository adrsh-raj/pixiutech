from django.db import migrations, models


FORWARD_SQL = """
ALTER TABLE learning_curriculumunit
ADD COLUMN IF NOT EXISTS level varchar(50) NOT NULL DEFAULT '';

ALTER TABLE learning_learningcontent
ADD COLUMN IF NOT EXISTS level varchar(50) NOT NULL DEFAULT '';

ALTER TABLE learning_quiz
ADD COLUMN IF NOT EXISTS level varchar(50) NOT NULL DEFAULT '';
"""


class Migration(migrations.Migration):
    dependencies = [("learning", "0007_assessment_uniqueness")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="curriculumunit",
                    name="level",
                    field=models.CharField(max_length=50),
                ),
                migrations.AddField(
                    model_name="learningcontent",
                    name="level",
                    field=models.CharField(blank=True, max_length=50),
                ),
                migrations.AddField(
                    model_name="quiz",
                    name="level",
                    field=models.CharField(max_length=50),
                ),
            ],
        ),
    ]
