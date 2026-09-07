# PIXIU Phase 7 — API Contract & Node Migration

## Decision

The Django backend is now the canonical API for the portal. The public portal contract is versioned under `/api/v1/` and is backed by the relational Django/PostgreSQL models. The legacy Node/Express API is not part of the target architecture.

DRF ViewSets + routers are used for resource routing, while URL-path versioning gives the portal a stable contract that can evolve without silently breaking clients. citeturn708957search2turn708957search3turn708957search0

## Authentication

The portal uses Django REST Framework authentication with Django SimpleJWT access + refresh tokens:

- `POST /api/v1/auth/login/`
- `POST /api/v1/auth/refresh/`
- `GET /api/v1/auth/me/`
- `POST /api/v1/auth/logout/`

Authentication establishes the request identity; permissions remain responsible for deciding what that identity may access. This separation is enforced by DRF and by PIXIU role/scope permissions. citeturn708957search1

The frontend continues using `pixiu_auth_token` for the access token during the migration and additionally stores `pixiu_auth_refresh_token` for refresh-token rotation.

## Resource contract

| Portal resource | v1 endpoint | Canonical Django entity |
|---|---|---|
| Schools | `/schools` | `academics.School` |
| Trainers | `/trainers` | `academics.Trainer` |
| Classes | `/classes` | `academics.SchoolClass` |
| Students | `/students` | `academics.Student` |
| Sessions | `/sessions` | `learning.Session` |
| Attendance | `/attendance` | `learning.AttendanceRecord` |
| Curriculum | `/curriculum` | `learning.CurriculumUnit` |
| Content | `/content` | `learning.LearningContent` |
| Quizzes | `/quizzes` | `learning.Quiz` / `QuizQuestion` |
| Quiz submissions | `/quiz-submissions` | `learning.QuizAttempt` |
| Reviews | `/reviews` | `learning.StudentAssessment` |
| Projects | `/projects` | `learning.Project` |
| Billing | `/billing` | `billing.Invoice` |
| Inventory | `/inventory` | `inventory.Kit` |
| CRM | `/leads` | `crm.Lead` |
| Notifications | `/notifications` | `notifications.Notification` |

The compatibility adapter preserves important legacy portal field names such as `school_id`, `class_id`, `student_id`, `trainer_id`, `stage`, `paid_amount` and `pending_amount` while IDs and foreign-key relationships are stored canonically as Django relations. PostgreSQL foreign keys and constraints remain the integrity boundary. citeturn708957search6

## Reviews

There is no separate review table in the Django rebuild. Phase 7 intentionally maps the portal's `/reviews` resource to `StudentAssessment`, because that entity already contains student, trainer, rating, score, status, feedback and assessment date. This is a contract decision, not a second data store.

## Migration rule

No API request in the portal should point to the legacy Node origin after cutover. `VITE_API_URL` must point to the Django `/api/v1` endpoint.

The old Node database compatibility layer is deliberately not reused by Django. It contained SQLite-compatibility SQL and legacy table/column assumptions; Phase 7 instead maps the portal contract onto the normalized Django/PostgreSQL schema.

## Cutover checklist

1. Deploy Django with its authoritative PostgreSQL `DATABASE_URL`.
2. Configure `DJANGO_CORS_ALLOWED_ORIGINS` for the production portal origin.
3. Set portal `VITE_API_URL=https://<django-host>/api/v1`.
4. Verify login, refresh, `/api/v1/health/`, Schools, Trainers, Students, Classes, Sessions and Attendance before disabling the Node service.
5. Run Django migrations and Phase 6 integrity audit against the intended Django database.
6. Only then remove the legacy Node server from deployment and repository.

A live production database was not accessed during this implementation, so production row-level migration/cutover is intentionally a deployment verification step rather than a claim of completed data migration.
