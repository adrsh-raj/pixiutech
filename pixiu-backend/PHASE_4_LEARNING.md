# Phase 4 — Learning Domain

Implemented as a fresh Django learning domain without importing legacy rows.

## Phase 4A — Learning foundation

- Sessions
- Attendance
- Curriculum units + explicit class assignments
- Learning content/materials + explicit class assignments
- Quizzes + MCQ questions
- Server-graded quiz attempts
- Student assessments/reviews
- Projects + evidence

## Phase 4B — Security and permissions

- Every learning queryset is scoped by admin, school, trainer or student relationship.
- Detail access checks are applied separately, because list filtering alone is not sufficient for object-level authorization.
- Students cannot mark or edit attendance.
- Students cannot change project score, evaluation status or trainer feedback.
- Trainers can only schedule sessions for themselves and only for schools where they have an active assignment.
- Trainers cannot modify another trainer's assessment.
- Assignment detail checks include both the target class and the underlying curriculum/content/quiz, preventing cross-school leakage.

## Phase 4C — Data integrity

- Sessions use real `SchoolClass` and `Trainer` foreign keys and reject invalid end times.
- Session status is state-controlled; completion locks the session, and only admins can unlock it.
- Attendance is unique per `(session, student)` and every write is revalidated through one transactional service, including updates.
- Curriculum, content and quiz assignments are grade-checked and use unique relational keys.
- Published content requires a source URL or uploaded file; link content requires a URL.
- Quiz questions cannot move between quizzes after creation, and closed quizzes are immutable.
- Quiz answers are checked against the quiz's own question IDs and graded on the server.
- Quiz attempt allocation is inside `transaction.atomic()` with a row lock on the quiz, eliminating concurrent duplicate attempt numbers before the database uniqueness constraint is reached.
- Project evidence is relational and must contain a file, external URL or note.

## Phase 4D — Verification tests

The learning test suite covers class binding, locked attendance, student attendance denial, grade matching, content publishing rules, server-side quiz grading, answer scoping, attempt limits, project evaluation protection, project submission, cross-school object isolation and relational source-of-truth checks.

## Phase 4E — CI

CI runs Django system checks, migration drift checks, migrations, the full test suite and Python compilation, followed by legacy LMS syntax/CORS checks and both website/frontend builds.

## Legacy review

The old LMS PostgreSQL schema was inspected from the legacy server definition before designing this domain. Session, attendance, curriculum, content, project, review and quiz concepts were retained, but string relationships and frontend fallbacks were not copied into the new data model.

The old database was **not** connected or migrated into this rebuild. The available WoWSQL account had no database projects, so no live legacy database was modified or used.

## Migration policy

Phase 4 has its own Django migration. The rebuild remains PostgreSQL-only and fresh-data-only.
