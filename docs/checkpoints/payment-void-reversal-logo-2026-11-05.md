# Payment Void / Refund and Branded Receipt — Handoff Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository state

- Repository: adrsh-raj/pixiutech
- PR #80: merged — https://github.com/adrsh-raj/pixiutech/pull/80
- Feature branch: feat/payment-void-reversal-and-receipt-logo-20261105
- Squash merge commit on main: 37d81cff3988c694411cb3d5b906af099c50f02e
- Main was verified identical to the merge commit immediately after merge.
- Source changes are in billing backend, BillingCenter, Payments, public logo asset and this checkpoint.
- Production payment records have not been changed.

## User request

- Put the supplied Pixiu Tech logo on downloaded receipt PDFs.
- Show Payment ID and receipt/contract information on the PDF.
- Provide admin-visible Void / Reverse controls for mistaken payment entries; allow Refund only when money was received and then returned.
- Preserve financial audit history; do not silently zero or delete payment and receipt rows.

## Logo

- Used the uploaded transparent Pixiu Tech logo PNG, not the white-background JPEG.
- Added compact branded asset: pixiu-lms-portal/public/pixiu-tech-logo.svg
- Both school Billing and admin Payments PDF templates reference /pixiu-tech-logo.svg.
- Both headers include the logo beside PIXIU TECH LLP text.
- Both PDFs include Payment ID and receipt number.
- Browser print invocation allows extra time for the same-origin logo asset to load.

## Payment correction implementation

### Model and migration

Payment adds:
- reversal_reason
- reversed_at
- reversed_by

Migration: pixiu-backend/billing/migrations/0005_payment_reversal_metadata.py

Original Receipt rows and issue-time snapshot fields are not rewritten or deleted.

### Admin API actions

- POST /api/v1/payments/{id}/void
  - Admin-only.
  - Only successful/verified payments may be voided.
  - Requires a clear reason (minimum 8 characters).
  - Use for a mistaken/duplicate entry where funds were not actually received.
- POST /api/v1/payments/{id}/refund
  - Admin-only.
  - Only successful/verified payments may be marked refunded.
  - Requires a clear reason (minimum 8 characters).
  - Use only when funds were actually received and then returned to the payer.

Both operations call billing.services.reverse_payment:
- Locks the Payment row and the linked Invoice / Contract rows.
- Changes status away from SUCCESS, so current contract and invoice paid totals are recomputed without this entry.
- Recalculates linked invoice amount_paid and status.
- Retains original payment, receipt number and issue-time receipt snapshot.
- Stores reason, timestamp and reversing admin.
- Writes append-only audit event with actor and request IP/user-agent.
- Notifies the school.
- Rejects pending, already reversed or non-successful payment records.

### Portal

- School/admin BillingCenter history retains success, void and refunded receipt entries.
- Admin sees **Void / Reverse** beside each successful receipt.
- Dialog distinguishes:
  - Void mistaken / duplicate entry (funds were not received)
  - Refund / reversal (funds were received and then returned)
- A reason is mandatory.
- Reversed rows show status and saved reason.
- Reversed receipt PDFs show:
  - VOID — NOT VALID FOR COLLECTION
  - REFUNDED — NOT VALID FOR COLLECTION
- Original receipt remains downloadable and clearly invalidated; snapshot is preserved for audit. Current contract/invoice balance is recalculated separately.
- Admin Payments view includes reversal status filtering, reversal reason, and separate Reversed amount metric.

## Validation completed

- PR #80 merged via normal GitHub squash merge.
- Django backend verification: 180 tests passed.
- makemigrations --check --dry-run: No changes detected.
- billing.0005_payment_reversal_metadata applied successfully.
- Portal lint: passed.
- Portal production build: passed.
- Production security smoke: passed.
- Full production-verification workflow stopped after backend stage at existing unrelated public-site audit:
  - src/pages/EightSquareAI.jsx — interactive cursor/scroll reveal pattern detected.
- Other unrelated existing gates:
  - CyberLab browser gate: first-run welcome screen does not expose AI Copilot entry point.
  - Phase 4–6 static gate: missing findArduinoPinState and computeRuntime(state, pressedRef.current, pinStatesRef.current); Phase 9 / Part 4 aggregate gates inherit this.
- These failures are outside the billing source changed in this PR. Repository-wide CI is not fully green.
- Live production deployment, logo loading on production domain, and actual school-account print preview have not yet been independently confirmed.

## Financial data safety — no production action performed

- No production payment, receipt, invoice, contract or balance was zeroed, deleted, voided or refunded by this code work.
- The previously mentioned ₹1,000 / ₹10,000 entries still need their exact live Payment IDs and Receipt numbers inspected before selecting an action.
- Use Void only if a marked payment was never actually received.
- Use Refund only if the money was received and was actually sent back.
- Do not use Refund as a synonym for a mistaken entry.
- The system retains the original Payment and Receipt as audit evidence after either action. Only the current ledger excludes the reversed payment.

## Manual acceptance still required

1. Open admin Billing and confirm each successful receipt has **Void / Reverse**.
2. Void a test-fixture direct contract payment. Verify contract paid total decreases, outstanding increases, receipt is retained and stamped VOID.
3. Refund a test-fixture payment. Verify REFUNDED status, audit details and balance recalculation.
4. Repeat with a contract-linked invoice. Verify invoice amount_paid/status and contract balance recalculate.
5. Open school Billing and admin Payments receipt PDFs. Confirm the uploaded Pixiu logo is visible, Payment ID and receipt number are legible, and Save as PDF works.
6. Verify school account cannot invoke void/refund.

## Resume procedure

1. Verify main SHA before any new write.
2. Do not operate on live payment rows without checking exact payment IDs, receipt numbers, school identity, transaction references and bank evidence.
3. Preserve all original receipt snapshots and audit logs.
4. Keep known baseline CI failures separate from billing-specific results.
