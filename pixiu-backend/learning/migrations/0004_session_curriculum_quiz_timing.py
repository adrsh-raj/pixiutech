from django.db import migrations, models
from django.core.validators import MaxValueValidator, MinValueValidator
import django.db.models.deletion


FORWARD_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'learning_session'
          AND column_name = 'curriculum_unit_id'
    ) THEN
        ALTER TABLE learning_session ADD COLUMN curriculum_unit_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'learning_session'::regclass
          AND conname = 'learning_session_curriculum_unit_id_fk'
    ) THEN
        ALTER TABLE learning_session
        ADD CONSTRAINT learning_session_curriculum_unit_id_fk
        FOREIGN KEY (curriculum_unit_id)
        REFERENCES learning_curriculumunit(id)
        DEFERRABLE INITIALLY DEFERRED;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'learning_quiz'
          AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE learning_quiz ADD COLUMN duration_seconds integer;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'learning_quizattempt'
          AND column_name = 'started_at'
    ) THEN
        ALTER TABLE learning_quizattempt ADD COLUMN started_at timestamptz;
    END IF;

    ALTER TABLE learning_quizattempt
    ALTER COLUMN completed_at DROP NOT NULL;
END $$;
"""


class Migration(migrations.Migration):
    dependencies = [("learning", "0003_sessionactivity_title_required")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.AddField(
                    model_name="session",
                    name="curriculum_unit",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sessions",
                        to="learning.curriculumunit",
                    ),
                ),
                migrations.AddField(
                    model_name="quiz",
                    name="duration_seconds",
                    field=models.PositiveIntegerField(
                        blank=True,
                        null=True,
                        validators=[MinValueValidator(10), MaxValueValidator(14400)],
                    ),
                ),
                migrations.AddField(
                    model_name="quizattempt",
                    name="started_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AlterField(
                    model_name="quizattempt",
                    name="completed_at",
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AlterModelOptions(
                    name="quizattempt",
                    options={"ordering": ["-completed_at", "-started_at"]},
                ),
            ],
        ),
    ]
