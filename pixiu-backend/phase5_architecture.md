# Phase 5 — Commercial Operations, Inventory, CRM, Notifications & Audit

Phase 5 is a fresh Django implementation inspired by the legacy LMS concepts, but it does not copy legacy schema relationships or string-based ownership.

## Domains

24. Billing — commercial charges and invoices
25. Payments / Receipts — recorded payment transactions and receipts
26. Inventory / Kits — serialized stock, school/trainer custody, kit issue/return
27. Notifications — in-app delivery records with read state
28. Leads / CRM — lead lifecycle, contacts, follow-ups and conversion
29. Audit Logs — append-only security/business activity history

## Design rules

- PostgreSQL is the source of truth.
- Financial amounts use Decimal fields; no floating point for money.
- Invoice totals are derived server-side from line items, not trusted from the browser.
- Payments are relational to invoices and cannot exceed outstanding balance unless an explicit controlled adjustment exists.
- Receipts are generated from successful recorded payments and retain a stable receipt number.
- Inventory movement uses relational transaction rows instead of directly mutating stock without history.
- Kits are composed of real inventory items and assigned through explicit custody records.
- Notifications are created by backend events and scoped to a real user; clients cannot spoof the recipient.
- CRM leads keep acquisition/source/contact/follow-up/conversion history as relational records.
- Audit logs are append-only from the application API; ordinary users never edit or delete them.
- Tenant boundaries follow the existing School / Trainer / Student relationships from academics.
- Frontend work is intentionally queued for the next portal phase: responsive role-based shells, simple navigation/sidebar and mobile-friendly components will be built against these APIs rather than recreating business rules in React.

## Legacy review

The legacy database contained billing, inventory, communications, alerts and audit concepts. Phase 5 preserves the business intent while replacing implicit/string relationships with ForeignKey/OneToOne relations and controlled state transitions.

No legacy rows are imported into Phase 5.
