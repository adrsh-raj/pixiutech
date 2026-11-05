# Receipt PDF Contract Balance — Handoff Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository state

- Repository: `adrsh-raj/pixiutech`
- Base: `main` at `17ccf5f4134b9b58aa3527125969ed17f4e31069`
- Feature branch: `fix/receipt-pdf-contract-balance-20261105`
- Implementation commit: `3394a704afa37e9c0adbbe350dfd83abff1806bb`
- Changed source: `pixiu-lms-portal/src/pages/Payments.jsx`
- PR: to be opened after this checkpoint is committed.

## User request

A downloadable receipt should clearly display:
1. Contract value.
2. Total amount paid, including the payment represented by this receipt.
3. Unpaid / outstanding balance.

## Implementation

- Renamed the action to **Download PDF**.
- Receipt opens in a print-ready page and invokes the browser print dialog; the user can choose **Save as PDF**.
- Receipt breakdown uses the existing immutable receipt snapshot from Django:
  - `total_amount_snapshot`
  - `amount_paid_snapshot`
  - `balance_due_snapshot`
- Contract-linked payments (including payments against linked invoices) are labelled **Contract Value** and include the contract number. Invoice-only receipts are labelled **Invoice Value**.
- Payment state is rendered as **PAID IN FULL**, **PARTIALLY PAID**, or **UNPAID** based on the stored snapshot.
- The amount collected on the individual receipt is shown separately from cumulative paid-to-date.
- Historical receipts with missing snapshot fields explicitly show **Not recorded**. Do not infer or backfill balances, because a later balance would not represent the original receipt date.
- Popup-blocker handling tells the user to allow pop-ups and retry.

## Financial invariants

- Pending submissions do not get a receipt and are not counted as paid.
- The values on an issued receipt are point-in-time values immediately after that verified payment.
- A later payment must not mutate an older receipt's paid or unpaid values.
- Do not calculate missing historical values from today's ledger and present them as historical facts.

## Validation status at checkpoint creation

- Feature branch is one commit ahead of `main` and zero commits behind.
- GitHub compare confirms only `pixiu-lms-portal/src/pages/Payments.jsx` changed (84 additions, 11 deletions).
- Static content assertions confirmed all three financial labels, Download PDF action, print invocation, and historical snapshot guard are present.
- Frontend lint/build and browser checks remain pending PR CI. Do not claim them passed until GitHub Actions reports completion.

## Resume procedure

1. Fetch this checkpoint and confirm the feature branch SHA.
2. Inspect PR CI for frontend lint/build and any browser checks.
3. Validate print preview on a verified direct-contract partial payment and an invoice-linked contract partial payment.
4. Verify a full-payment receipt displays ₹0.00 outstanding.
5. Verify historical receipts with null snapshots show Not recorded rather than fabricated values.
6. Merge only after relevant receipt/frontend checks pass. Preserve unrelated baseline CI failures and report them separately.
