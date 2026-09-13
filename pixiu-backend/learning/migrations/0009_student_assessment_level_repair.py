from django.db import migrations, models


FORWARD_SQL = """
ALTER TABLE learning_studentassessment
ADD COLUMN IF NOT EXISTS level varchar(50) NOT NULL DEFAULT '';
"""


class Migration(migrations.Migration):
    dependencies = [("learning", "0008_schema_repair")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="studentassessment",
                    name="level",
                    field=models.CharField(max_length=50),
                ),
            ],
        ),
    ]
