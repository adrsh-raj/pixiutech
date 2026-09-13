from django.db import migrations, models


FORWARD_SQL = """
ALTER TABLE academics_student
ADD COLUMN IF NOT EXISTS current_level varchar(50) NOT NULL DEFAULT '';
"""


class Migration(migrations.Migration):
    dependencies = [("academics", "0001_initial")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="student",
                    name="current_level",
                    field=models.CharField(blank=True, max_length=50),
                ),
            ],
        ),
    ]
