# Phase 6 — Django Admin, Dashboard APIs, Reports, Reset & Integrity

Phase 6 is implemented in the Django rebuild backend and is exposed to the admin portal.

## 30 — Django Admin

The Django admin is enabled at `/admin/`. The custom PIXIU user model, schools, trainers, trainer-school assignments, classes, students, learning records, billing, inventory, CRM, notifications and audit logs are registered. Learning administration has searchable/filterable views for operational records.

The Django rebuild keeps authoritative academic identity relational: trainers are assigned to schools through `TrainerSchoolAssignment`, students belong to `SchoolClass`, and learning records reference those entities directly. This avoids the legacy string-ID/fallback pattern.

## 31 — Dashboard APIs

Admin-only endpoints:

- `GET /api/phase6/dashboard/summary/`
- `GET /api/phase6/reports/overview/`

Dashboard data comes from PostgreSQL/Django domain models. The summary endpoint is intentionally lightweight; full integrity scanning is separate.

## 32 — Reports / Analytics

The reports endpoint exposes the last 12 months of invoiced vs collected amounts, student distribution by grade, CRM funnel totals, top schools by student count, and trainer session load.

## 33 — Controlled Data Reset

Admin-only endpoint:

- `POST /api/phase6/controlled-reset/`

Supported scopes are `learning_runtime`, `business`, `inventory`, `notifications`, and `all_operational`.

Every reset requires `RESET PIXIU DATA`. `dry_run=true` returns affected row counts without deleting anything. Actual deletion runs inside a database transaction and writes an append-only audit event. Accounts, academic master data and audit logs are preserved.

CLI equivalents:

```bash
python manage.py controlled_reset learning_runtime --dry-run --confirm "RESET PIXIU DATA"
python manage.py controlled_reset all_operational --confirm "RESET PIXIU DATA"
```

## 34 — Data Integrity Audit

Admin-only endpoint:

- `GET /api/phase6/integrity-audit/`

CLI:

```bash
python manage.py data_integrity_audit
python manage.py data_integrity_audit --strict
```

The audit checks trainer assignment dates, trainer/school session scope, attendance/class consistency, duplicate student rolls, invoice arithmetic, payment totals, invoice line arithmetic, content/grade assignment mismatches, quiz attempt scope, kit custody recipient rules, and account/profile consistency. Findings include severity, accurate total count, message and up to five samples.

The audit is diagnostic-first rather than a destructive repair job. Durable integrity remains enforced by PostgreSQL primary-key, unique, foreign-key and check constraints.

## API authentication bridge

Phase 6 uses `ExpressJWTAuthentication` so the current portal can reuse its existing Bearer JWT instead of introducing a second login. Django validates the token with `EXPRESS_JWT_SECRET` (or `JWT_SECRET`) and only accepts `role=admin` for these endpoints.

## Frontend connection

The admin portal now exposes `/phase6` and consumes all four Phase 6 endpoints using `VITE_DJANGO_API_URL`.

Deployment requirements:

- Frontend: `VITE_DJANGO_API_URL=https://<django-host>/api`
- Django API: `EXPRESS_JWT_SECRET` must equal the Express LMS `JWT_SECRET` that signs the current portal token.

Real secrets must never be committed to git.

## Architecture rule

Phase 6 does not introduce another database. The Django backend is the canonical rebuild backend and remains protected by the existing database-name preflight. The legacy Express/SQLite database is not silently reused by the Django APIs.
