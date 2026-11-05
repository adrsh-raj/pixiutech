# PixiuTech Contract Payment Ledger — Handoff Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository checkpoint

- Repository: `adrsh-raj/pixiutech`
- Work branch: `feat/contract-payment-receipt-ledger-20261105`
- Pull request: #77 — Add backend-connected school contract payment ledger and receipts
- PR target: `main`
- Pull request #77: [merged](https://github.com/adrsh-raj/pixiutech/pull/77) on 2026-11-05.
- Squash merge commit on `main`: `636a30e1351b296ed9cf98e1b4bfc8a5456d7121`.
- Verified `main` currently points to that merge commit.
- Work branch: `feat/contract-payment-receipt-ledger-20261105` (historical implementation branch; source of merged PR).

## Intended acceptance case

A signed school contract has a total value of ₹50,000. The school pays ₹10,000. The system must show:
- Contract value: ₹50,000
- Verified amount received: ₹10,000
- Outstanding amount: ₹40,000
- A receipt number for the ₹10,000 receipt
- The same ₹40,000 outstanding balance printed on that receipt, representing the balance immediately after that payment

Only successful/verified payments count as received. Pending school submissions must not reduce the balance or create a receipt until verified by Pixiu Tech.

## Implemented files and behaviour

### Django backend
- `billing.models.Payment`: supports exactly one target, invoice or contract; database check constraint enforces this.
- `billing.models.Receipt`: stores immutable school, invoice/contract, total, received-to-date and outstanding-after-payment snapshots.
- `billing/migrations/0004_contract_payment_ledger.py`: adds contract payment target, receipt snapshot columns and the exactly-one-target database constraint. Snapshot amounts are nullable so old receipts remain explicitly “not captured”, not falsely shown as ₹0.
- `billing.serializers`: validates payment target/reference and returns contract/school/receipt snapshot data.
- `billing.services`: handles direct contract payments, invoice-linked roll-up, receipt creation, verification, audit logs, overpayment checks, pending-payment lockout and duplicate-reference rejection. PostgreSQL row locks are scoped to the target rows rather than nullable joined relations.
- `billing.contract_views`: exposes `amount_paid`, `balance_due`, `payment_status` and `open_invoice_count`; protects contract terms after any payment transaction; exposes contract summary totals.
- `billing.views`: connects record / verify / reject APIs for both invoice and contract payment records.

### API paths
- `POST /api/v1/payments/record` — payload contains exactly one of `invoice` or `contract`.
- `POST /api/v1/payments/{id}/verify` — admin verifies pending school-submitted payment and issues receipt.
- `POST /api/v1/payments/{id}/reject` — admin rejects pending payment.
- `GET /api/v1/contracts` and `GET /api/v1/contracts/{id}` — returns contract ledger totals.
- `GET /api/v1/billing-summary` — includes contract value, collected and pending totals.

### Financial integrity rules
- Never allow an invoice and a direct contract payment to be applied as separate overlapping obligations: an open linked invoice blocks direct contract payment.
- Invoice issue checks the contract’s remaining unbilled amount.
- Linked invoice payment updates the contract-level received/outstanding figures.
- A pending payment blocks another payment submission for the same contract/invoice until verified or rejected.
- Amount must be positive and cannot exceed the remaining due.
- Contract terms cannot be changed after payment history exists or after a linked invoice is issued.
- Historical receipt snapshots remain null where no snapshot was captured at the time.

### Portal
- `pixiu-lms-portal/src/pages/BillingCenter.jsx`: shows contract value / received / outstanding for admin and school views; submits contract payment requests; presents pending-verification state and links payments to invoices where needed.
- `pixiu-lms-portal/src/pages/Payments.jsx`: receipt print output includes receipt number, school, contract/invoice, payment details and historical post-payment balance.

### Regression tests
- `billing/test_contract_payment_ledger.py` tests partial payment + immutable receipt, pending verification, overpayment / pending duplicate rejection, invoice-linked roll-up and protection of contract terms.
- Test helper retrieves the contract detail endpoint rather than relying on list pagination.

## Merge and verification status (2026-11-05)

- PR #77 merged by squash; merge commit: `636a30e1351b296ed9cf98e1b4bfc8a5456d7121`.
- Post-merge Cloudflare Workers build for `pixiu-portal`: **success** (build ID `c46f60f9-4310-43ed-a73d-77a548e66c50`).
- Post-merge production security smoke jobs: **success**.
- Full Django/backend verification on the same implementation before merge: **175 tests passed**; migration consistency check reported `No changes detected`; migration `billing.0004_contract_payment_ledger` applied successfully.
- The production verification job also performs public-site audit after the backend stage. That site audit has an existing failure in `src/pages/EightSquareAI.jsx` (interactive cursor/scroll reveal pattern). The exact same site-audit failure was observed on the original `main` baseline before this PR.
- Separate non-billing gates still fail on existing AI/CyberLab code:
  - Phase 4–6 static checker: missing `findArduinoPinState` and `computeRuntime(state, pressedRef.current, pinStatesRef.current)`.
  - CyberLab browser gate: first-run welcome screen does not expose AI Copilot entry point. The same browser failure was observed on the original `main` baseline.
- These failed gates are outside the billing files changed in this PR. Do not mask them or describe the full repository CI as green.
- Post-merge verification workflow IDs included production verification `42018681570`, browser gate `42018681879`, and Cloudflare build `c46f60f9-4310-43ed-a73d-77a548e66c50`.

## Recent CI findings and fixes

1. Earlier portal pipeline caught invalid escaped template literals and a duplicated summary-card `.map(...)`; these were corrected. Latest portal lint had zero errors and the Cloudflare Workers production build succeeded.
2. Backend PostgreSQL tests caught row-lock errors caused by `select_for_update()` with nullable `select_related()` joins, and PATCH date validation comparing `None`; both were fixed. Duplicate UTR protection was added inside the atomic payment operation.
3. The first duplicate-UTR regression assertion checked the wrong error envelope; it was corrected to inspect `response.data["fields"]`.
4. A further lifecycle check now locks contract terms as soon as a linked invoice is issued, before any payment is received.

## Resume procedure after connection interruption

1. Read this checkpoint file first.
2. Fetch PR #77 and confirm its current head SHA. Do not assume it is still the SHA recorded above.
3. Fetch check-runs for the current PR head, and inspect full logs for any failed verification job.
4. Verify the Django backend test suite, migration consistency, frontend lint/build, smoke checks and browser/static gates. Fix any payment-ledger-specific failures and rerun.
5. Review the complete PR diff against the current `main`; preserve unrelated work and do not force-update or reset branches.
6. Merge to `main` only after payment-specific verification is green and remaining failures are understood. Do not bypass a failing payment/backend check.
7. After merge, verify the new `main` SHA and the applied migration state. Do not claim production deployment unless a deployment check confirms it.

## Non-negotiable safety note

This is financial recordkeeping. Do not fabricate historical balances, do not count pending payments as received, do not issue receipts for unverified school submissions, do not permit overpayment, and do not merge while billing/backend checks are failing or unknown.
