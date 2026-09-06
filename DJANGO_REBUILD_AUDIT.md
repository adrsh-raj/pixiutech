# PIXIU Tech — Django Rebuild Audit

## Step 1: Freeze & Audit Current System

Date: 2026-09-07
Status: Complete

### Production architecture being preserved during rebuild

- Public website: root React/Vite application.
- LMS frontend: `pixiu-lms-portal` React/Vite application.
- Current API: `pixiu-lms-portal/server` Node/Express.
- Current database: PostgreSQL behind the Node API.
- Production deployment: Vercel for frontends; Render for the current API/database service.

### Current LMS feature inventory

The existing frontend contains these operational areas:

- Authentication and role-aware routing
- Admin console/dashboard
- Schools
- Trainers/faculty
- Trainer credential management
- School credential management
- Students
- Student portal
- School portal
- Classes
- Sessions/scheduling
- Attendance
- Curriculum
- Learning content/materials
- Virtual circuit lab
- Quizzes/MCQs
- Quiz submissions/reattempts
- Student reviews/assessment
- Project/evidence uploads
- Billing/invoices/payments
- Inventory/kit management
- Notifications/announcements
- Communications
- Leads/CRM
- Audit/security logs
- Transcript generation
- Administrative data reset

### Current backend/data concerns confirmed during audit

1. The Node backend is a large monolithic `index.js` and mixes authentication, CRUD, business rules, legacy compatibility, and response shaping.
2. PostgreSQL is accessed through a custom compatibility wrapper that converts SQLite-style SQL placeholders/statements at runtime.
3. Legacy SQLite migration support is still present in the production codebase (`better-sqlite3` + migration path logic).
4. Application data and identity data are represented across loosely related string fields instead of a clean relational domain model.
5. Trainer-school assignment previously relied on string values such as school IDs/codes and had UI fallbacks/hardcoded defaults.
6. Existing frontend code still contains legacy/default business values and role-specific preview logic that should not exist in production domain logic.
7. The current database contains legacy operational records that are unrelated to a clean production setup; rebuild will use a fresh database and will not import those records.
8. Authentication, authorization, and credential management are currently custom-built across multiple files and will be consolidated into Django's user/permission model.

### Rebuild rules

- No legacy PostgreSQL data migration.
- No SQLite compatibility layer in the new backend.
- No hardcoded school, trainer, student, phone, billing, or session records.
- No frontend-generated authoritative IDs where the backend/database should own identity.
- No business relationships encoded only as comma-separated strings.
- No plaintext passwords.
- One authoritative Django API and one authoritative PostgreSQL database.
- Existing React frontend remains the presentation layer during migration.
- Old Node backend stays untouched until the Django replacement is ready, then will be removed.
- Git history will not be rewritten as part of this rebuild unless explicitly requested.

### Step 1 cleanup performed

Removed two confirmed-unused legacy frontend seed files:

- `pixiu-lms-portal/src/data/seedData.js`
- `pixiu-lms-portal/src/data/seedQuizzes.js`

The active frontend uses server-backed application records plus the static class-kit configuration; these unused seed files were not referenced by the repository's current code search.

### Next step

**Step 2 — Create Fresh Django Backend**

Create the Django + Django REST Framework project structure without changing the current production frontend yet.
