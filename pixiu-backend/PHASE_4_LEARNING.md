# Phase 4 — Learning Domain

Implemented as a fresh Django learning domain without importing legacy rows.

## Domains

- Sessions
- Attendance
- Curriculum units + class assignments
- Learning content/materials + class assignments
- Quizzes + MCQ questions
- Server-graded quiz attempts
- Student assessments/reviews
- Projects + evidence

## Integrity rules

- Sessions belong to a real `SchoolClass` and assigned `Trainer`.
- Attendance has a unique `(session, student)` record and a student must belong to the session class.
- Curriculum/materials/quizzes use explicit class assignment tables; no frontend string matching is used for class sharing.
- Quiz answers are graded on the server. Student quiz responses never expose `correct_option` or explanation.
- Quiz attempts are relational and have a database uniqueness key per `(quiz, student, attempt_number)`.
- Project evidence belongs to a project, which belongs to a student.
- School, trainer and student visibility is enforced at queryset and object-permission layers.

## Legacy review

The old LMS PostgreSQL schema was inspected from the legacy server definition before designing this domain. Its session, attendance, curriculum, content, project, review and quiz concepts were preserved, while string IDs were replaced with Django foreign keys and explicit assignment tables.

The old database was **not** connected or migrated into this rebuild. The available WoWSQL account currently has no database projects, so no live legacy database was modified or used.

## Migration policy

Phase 4 has its own Django migration. The rebuild remains PostgreSQL-only and fresh-data-only.
