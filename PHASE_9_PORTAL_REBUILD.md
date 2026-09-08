# Phase 9 — PIXIU Portal Rebuild: DB-Truth, Role UX & Production Hardening

## Objective
Rebuild the LMS portal UI around the existing Django/PostgreSQL domain model so that application records are server-authoritative, role-scoped, responsive, and resilient. This phase is not a CSS-only redesign and is not a data migration.

## Non-negotiable rules

1. PostgreSQL/Django is the single source of truth for runtime application data.
2. The frontend must never invent or seed schools, trainers, students, classes, sessions, attendance, rankings, revenue, dates, or account IDs.
3. No hardcoded operational identifiers such as ZPS, XYZ, TR-01, TR-02, CLS-ZPS-6A, sample student IDs, or named staff identities in runtime portal logic.
4. Static curriculum blueprints may remain configuration only when they are explicitly not runtime school/application records; school-specific inventory and assignment data must come from the API.
5. Every write must handle success, validation failure, authorization failure, network failure, and server failure visibly.
6. Every data-heavy screen gets loading, empty, error, and refresh states. An empty database must render as genuinely empty, not as demo data. This follows established enterprise UX guidance for empty/loading/error states. 
7. Responsive behavior is required at mobile, tablet, laptop, and wide desktop breakpoints. Tables collapse or become horizontally scrollable intentionally; controls remain reachable.
8. Refresh re-fetches server state without a full browser reload. Writes revalidate affected data after success. GET retries remain bounded; writes are never blindly retried.
9. Frontend role visibility is for UX. Django permissions/querysets remain the security boundary.
10. Database migrations are introduced only when the data model actually changes.

## Canonical runtime entities

- User
- School
- Trainer
- TrainerSchoolAssignment
- SchoolClass
- Student
- Session
- AttendanceRecord
- CurriculumUnit / curriculum assignments
- LearningContent / content assignments
- Quiz / QuizAttempt
- Project / ProjectEvidence
- StudentAssessment
- Invoice / Payment / Receipt
- Notification
- AuditLog
- Inventory / Kit

## Portal information architecture

### Admin

Command Center
Business & CRM: Sales Pipeline, Partner Schools, Billing & Invoices, Payments & Receipts
Academics & LMS: Student Directory, Trainer Faculty, Classes & Sessions, Attendance, Curriculum, Content, Quizzes, Projects
Operations: Hardware & Kits, Notifications, Announcements/Comms, Audit Logs
System: credential management, settings, controlled operational tools

Admin screens prioritize decisions and actions rather than simply exposing database tables.

### Trainer

Workspace
My Classes
My Students
Today's Sessions
Attendance
Class Performance
Class Ranking
Student Reviews
Curriculum
Teaching Materials
Quizzes
Projects
Virtual Arduino Lab
Hardware Kits
Announcements / Notifications

Trainer data is restricted by Django scope to the trainer's current assignments.

### School

Overview
Classes
Students
Trainers
Sessions
Attendance
Curriculum
Learning Materials
Class Performance
Student Progress
Announcements / Notifications

School data is restricted to the authenticated school account.

### Student

Overview
My Learning
Lessons / Materials
Quizzes
Projects
Attendance
Progress
Trainer Reviews
Class Ranking / Leaderboard
Achievements / Milestones
Virtual Arduino Lab
Announcements / Notifications

The student sidebar is mandatory; ranking is class-scoped and must be derived from server-authoritative performance data.

## Student ranking design

Ranking is a product feature, not a frontend decoration. The backend must return a scoped ranking payload because a student must not receive unrestricted access to other students merely because the UI needs a leaderboard.

Initial score proposal for implementation review:
- 40% quiz performance
- 25% project performance
- 15% published trainer assessment
- 20% attendance

The UI should show the student's current rank, class size, score components, and a concise explanation of how the score is calculated. The exact weighting is a product rule and must live in one backend service, not be duplicated in multiple React pages.

## Shared UI system

Build reusable components for:
- Portal shell and responsive sidebar
- Page header / breadcrumbs
- Refresh control
- Skeleton loading
- Empty state with next action
- Inline and banner errors
- Confirm dialog
- Form field/error presentation
- Search / filter bar
- Responsive tables and cards
- Status badges
- KPI cards
- Progress bars
- Pagination where useful
- Toast/notification handling

Empty states should explain why the screen is empty and what the user can do next rather than looking broken.

## Data contract layer

Create explicit frontend normalization helpers for:
- IDs and codes
- status values
- assignment lists
- dates and times
- pagination/collection responses
- API errors

API shapes should be consumed according to Django serializers. The frontend must not assume fields such as trainer.role, legacy id/code aliases, or school trainer strings unless the API contract explicitly exposes them.

## Page-level acceptance rules

Every page must satisfy:

- No hardcoded runtime entities.
- No silent failed writes.
- No success toast when a write failed.
- No duplicate network loops caused by unstable effect dependencies.
- No direct localStorage fallback for database records.
- No full page reload required after normal CRUD.
- Refresh button visible where stale data is operationally plausible.
- Mobile layout tested for every modal, table, filter bar, and primary action.
- Destructive operations require confirmation and use safe lifecycle semantics.

## Backend coordination

Portal-only work should not change the schema unless a feature truly requires new persisted data. Backend endpoint additions are acceptable when they expose server-derived views that cannot safely be assembled from a user's scoped collections, such as class ranking.

The Django backend already uses role-aware querysets for schools, classes, students, trainers, assignments, and related data; these remain the authorization boundary.

## Implementation order

### 9A — Data contracts and safety
Normalize API response shapes, remove legacy assumptions from the frontend data layer, and define page-state handling.

### 9B — Shared responsive shell
Finalize admin/trainer/school/student shells, mobile navigation, refresh, loading, empty, and error components.

### 9C — Admin rebuild
Command Center, Schools, Trainer Faculty, Students, Classes/Sessions, Billing, Payments, Audit, Operations.

### 9D — Trainer rebuild
Workspace, class roster, attendance, rankings, reviews, curriculum, materials, quizzes, projects, hardware.

### 9E — School rebuild
School overview, classes, students, attendance, trainer visibility, progress, communication.

### 9F — Student rebuild
Learning dashboard, progress, class ranking, attendance, quizzes, projects, reviews, achievements, materials, lab.

### 9G — Production hardening
Run a code scan for hardcoded operational values, verify every route, verify role isolation, test all CRUD flows, verify refresh behavior, run builds, and perform deployed smoke tests.

## Definition of done

The portal is not considered complete until:

- A fresh database produces an honest empty UI.
- Creating a school makes that school immediately selectable everywhere it is relevant.
- Creating a trainer makes the trainer immediately visible and assignable.
- Creating a class exposes it to the correct school/trainer workflows.
- Creating a student generates credentials from the canonical school/class/roll rules.
- Attendance, quizzes, projects, reviews, rankings, revenue, inventory, and dashboards show only server-derived values.
- The same action never needs a browser reload to become visible.
- All common controls have explicit disabled/loading/error states.
- No page contains legacy ZPS/XYZ/TR-01/TR-02/CLS-* runtime defaults.
- No `.length`, `.map`, `.filter`, or `.find` call can crash because an API collection unexpectedly arrives as undefined.
- Student ranking is delivered through a scoped backend contract.
- Kit/component images use persistent storage before being presented as a completed feature.
- Frontend build and deployed smoke test pass before sign-off.
