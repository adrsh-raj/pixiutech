# Phase 5 — Business Operations

Phase 5 adds the operational layer around the Phase 3/4 academic and learning domain.

## Modules

1. Billing: invoices and invoice items.
2. Payments / receipts: relational payments against invoices and one-to-one receipts.
3. Inventory / kits: item master, stock ledger, kits, kit components and kit assignments.
4. Notifications: per-user notifications with read state and expiry.
5. Leads / CRM: lead pipeline plus a relational activity timeline.
6. Audit logs: append-only mutation/request records with actor, endpoint and change metadata.

## Source-of-truth rules

- Billing is linked to the authoritative `School` / optional `Student` records; no school or student names are copied as relationship keys.
- Payments cannot exceed the invoice balance.
- Receipts are generated from successful payments and have unique receipt numbers.
- Inventory quantity is derived from a transactional stock ledger; kit composition uses foreign keys to inventory items.
- Kit assignments point to real schools/classes/students instead of string IDs.
- Notifications target a real Django `User`.
- CRM leads use a user FK for assignment and a real `School` FK when a lead converts.
- Audit records reference the actor and store object IDs as metadata because audited models span multiple Django apps; audit rows are never exposed to non-admin users.

## Security boundary

Every endpoint is authenticated and role-restricted. School visibility is limited to its own school. Student visibility is limited to its own notification records and any future billing/inventory record explicitly linked to that student. Admin owns operational writes. CRM and audit records are admin-only in Phase 5.

## Legacy review

The legacy database was used only to understand the previous concepts: billing, inventory, notifications, leads/CRM and audit logs. The new design does not copy its string-based relationships or rely on legacy rows. The rebuild remains fresh-data-only.

## Frontend contract for later portal work

When the portal is wired to these APIs, all four role portals (student, trainer, school, admin) should use a simple responsive shell with a collapsible sidebar, clear role-specific navigation, readable cards/tables, mobile-friendly actions and no hardcoded demo/fallback records. API data must come from Django only.
