# Phase 6 — Django Admin, Analytics & Data Integrity

Phase 6 is implemented in the Django rebuild backend.

## 30 — Django Admin

The Django admin is enabled at `/admin/`. The custom PIXIU user model, schools, trainers, trainer-school assignments, classes, students, learning records, billing, inventory, CRM, notifications and audit logs are registered. Learning administration now has searchable, filterable views for sessions, attendance, content, quizzes, attempts, assessments, projects and evidence.

The Django rebuild deliberately keeps authoritative academic identity relational: trainer-school assignments are rows in `TrainerSchoolAssignment`, students belong to `SchoolClass`, and operational learning records reference those records directly. This avoids the legacy string-ID/fallback pattern.

## 31 — Dashboard APIs

Admin-only dashboard endpoints:

- `GET /api/phase6/dashboard/summary/`
- `GET /api/phase6/reports/overview/`

Dashboard data is generated from PostgreSQL aggregates and the Django domain models. The summary endpoint is intentionally lightweight; full integrity scanning is a separate endpoint.

## 32 — Reports / Analytics

The reports endpoint exposes the last 12 months of invoiced vs collected amounts, student distribution by grade, CRM funnel totals, top schools by student count, and trainer session load. This provides a stable JSON contract for the future admin analytics UI.

## 33 — Controlled Data Reset

Admin-only endpoint:

- `POST /api/phase6/controlled-reset/`

Supported scopes are `learning_runtime`, `business`, `inventory`, `notifications`, and `all_operational`.

Every reset requires the exact confirmation phrase `RESET PIXIU DATA`. A `dry_run` returns affected row counts without deleting anything. Actual deletion runs inside a PostgreSQL transaction and creates an append-only audit event. Accounts, academic master data (schools/classes/students/trainers), and audit logs are explicitly preserved.

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

The audit checks trainer assignment dates, trainer/school session scope, attendance/class consistency, duplicate student rolls, invoice arithmetic, payment totals, invoice line arithmetic, content/grade assignment mismatches, quiz attempt scope, kit custody recipient rules, and account/profile consistency. Findings return severity, count, message and sample records.

The implementation is diagnostic-first rather than a destructive repair job. Durable integrity remains enforced by PostgreSQL primary-key, unique, foreign-key and check constraints, while the audit identifies inconsistent states that may already exist.

## Architecture rule

Phase 6 does not introduce a second database or a second source of truth. The Django backend remains isolated from the legacy Express/SQLite database and is protected by the database-name preflight already documented in `README.md`.
