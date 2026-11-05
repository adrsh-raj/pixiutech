# Payment Void / Refund and Branded Receipt — Handoff Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository state

- Repository: adrsh-raj/pixiutech
- Base main at branch creation: bd16e835bce7b5beb4f0ff9cfc9231990407ba04
- Feature branch: feat/payment-void-reversal-and-receipt-logo-20261105
- Intended PR: open after checkpoint.
- Production payment records have not been modified.

## User request

- Put the supplied Pixiu Tech logo on downloaded receipt PDFs.
- Show Payment ID and receipt/contract information on the PDF.
- Provide an actual admin-visible Void / Reverse option for mistaken payment entries; allow Refund only when funds were received and then returned.
- Preserve financial audit history; avoid silently zeroing or deleting payment and receipt rows.

## Uploaded logo source

- Used the supplied transparent Pixiu Tech logo PNG (not the white-background JPEG).
- Optimized it to a compact transparent PNG and embedded it into:
  pixiu-lms-portal/public/pixiu-tech-logo.svg
- Both the school Billing PDF and admin Payments PDF reference the static portal asset at /pixiu-tech-logo.svg.
- Receipt headers now include the actual mark beside the Pixiu Tech LLP text.
- PDF print is delayed long enough for the same-origin logo asset to load.
- Original payment ID and receipt number are both included.

## Payment correction implementation

### Data model and migration

- Payment gains:
  - reversal_reason
  - reversed_at
  - reversed_by
- Migration:
  pixiu-backend/billing/migrations/0005_payment_reversal_metadata.py
- Existing Receipt rows are not deleted or rewritten. Original issue-time snapshot values remain immutable.

### Backend endpoints

- POST /api/v1/payments/{id}/void
  - Admin-only.
  - Only successful/verified payments may be voided.
  - Reason required (minimum 8 characters).
  - Intended for a mistaken/duplicate entry where funds were not actually received.
- POST /api/v1/payments/{id}/refund
  - Admin-only.
  - Only successful/verified payments may be marked refunded.
  - Reason required (minimum 8 characters).
  - Use only when funds were actually received and then returned to the payer.
- Service: billing.services.reverse_payment
  - Locks payment, invoice and related contract rows.
  - Changes payment status to void/refunded. Only SUCCESS payments count in current paid/collected aggregations, so active contract and invoice balances recalculate.
  - Keeps original Receipt row and receipt snapshot intact.
  - Stores actor, timestamp and reason on the payment.
  - Adds append-only audit event with canonical AuditAction values and request IP/user-agent metadata.
  - Notifies the school that the entry was voided/refunded and balance recalculated.
  - Repeat reversal attempts and non-success payments are rejected.
- Receipt serializer includes payment_status, reversal_reason and reversed_at.
- Payment serializer includes reversal fields.

### Portal UX

- School/admin BillingCenter payment history retains the receipt row for success, void and refunded records.
- Admin sees a Void / Reverse button beside successful receipt entries.
- Dialog distinguishes:
  - Void mistaken / duplicate entry — funds were not received.
  - Refund / reversal — funds were received, then returned.
- Reason is mandatory; cancel is available.
- Reversed rows display VOIDED / REFUNDED and the saved reason.
- The original receipt remains downloadable. PDF visibly stamps it:
  - VOID — NOT VALID FOR COLLECTION
  - REFUNDED — NOT VALID FOR COLLECTION
- Current contract/invoice ledger recalculates independently; historical issue-time snapshots are never rewritten.
- Admin Payments page receipt PDF also has logo, invalid stamp and reversal reason; status filter includes voided/refunded. Finance metrics separate reversed amounts from failed submissions.

## Regression tests added

- Void of mistaken successful direct contract payment restores active outstanding balance to contract value, keeps the original receipt and its old snapshot, and records the audit event.
- Refund of a successful payment removes it from active collection total and records the refund audit event.
- School user cannot void a successful payment.
- Void of linked-invoice payment recalculates invoice amount_paid/status and the contract balance.
- Void without reason is rejected and leaves payment status unchanged.

## Financial safety rules

- No successful payment is silently deleted.
- No receipt is silently deleted.
- Void and Refund are distinct; a refund means the funds were actually sent back.
- A reason and actor/time metadata are retained.
- Receipt snapshots are historical issuance-time facts and must not be changed when the current ledger changes.
- No real payment has been voided/refunded as part of this code work. Production data remains untouched.
- Do not act on the user's previously mentioned ₹1,000 / ₹10,000 records until the actual payment IDs, receipt numbers and school identity are verified from the live account/database.

## Validation status at checkpoint

- Static source checks confirm model fields, migration, API actions, UI buttons/dialog, reason validation, logo references and reversal receipt stamps are present.
- Full regression suite, Django migration consistency, portal lint/build and browser checks are pending PR CI. Do not claim them passed before Actions completes.
- Manual production print preview and deployment are not yet confirmed.

## Resume procedure

1. Verify branch SHA and PR CI.
2. Fix any backend, migration, portal lint or build issues and rerun.
3. Confirm the full Django billing suite passes, including new void/refund tests.
4. Verify PDF preview includes the Pixiu logo and Payment ID in both school Billing and admin Payments.
5. Exercise void/refund only in test fixtures; confirm original receipt remains and current balances recalculate.
6. Merge with a normal squash PR only after relevant tests pass; do not bypass checks.
7. Keep unrelated repository baseline failures separate and document them accurately.
8. For production correction, inspect payment IDs and statements first; do not mutate production records automatically.
