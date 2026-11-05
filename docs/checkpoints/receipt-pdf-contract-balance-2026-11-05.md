# Receipt PDF Contract Balance — Handoff Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository state

- Repository: `adrsh-raj/pixiutech`
- PR #78: [merged](https://github.com/adrsh-raj/pixiutech/pull/78)
- Feature branch: `fix/receipt-pdf-contract-balance-20261105`
- Implementation commit: `3394a704afa37e9c0adbbe350dfd83abff1806bb`
- Squash merge commit on `main`: `55cd214d362d173f1b60c217fe07c4cadbc95730`
- Latest verified `main` at checkpoint update: `55cd214d362d173f1b60c217fe07c4cadbc95730`
- Changed source: `pixiu-lms-portal/src/pages/Payments.jsx`
- This checkpoint is stored at `docs/checkpoints/receipt-pdf-contract-balance-2026-11-05.md`.

## User request

A downloadable receipt should clearly display:
1. Contract value.
2. Total amount paid, including the payment represented by this receipt.
3. Unpaid / outstanding balance.

## Implementation

- Renamed the action to **Download PDF**.
- Receipt opens a print-ready page and invokes the browser print dialog; the user can choose **Save as PDF**.
- Receipt breakdown uses the existing immutable receipt snapshot from Django:
  - `total_amount_snapshot`
  - `amount_paid_snapshot`
  - `balance_due_snapshot`
- Contract-linked payments (including payments against linked invoices) are labelled **Contract Value** and include the contract number. Invoice-only receipts are labelled **Invoice Value**.
- Payment state is rendered as **PAID IN FULL**, **PARTIALLY PAID**, or **UNPAID** based on the stored snapshot.
- The amount collected on the individual receipt is shown separately from cumulative paid-to-date.
- Historical receipts with missing snapshot fields explicitly show **Not recorded**. No balances are inferred from today's ledger.
- Popup-blocker handling tells the user to allow pop-ups and retry.

## Financial invariants

- Pending submissions do not get a receipt and are not counted as paid.
- The values on an issued receipt are point-in-time values immediately after that verified payment.
- A later payment must not mutate an older receipt's paid or unpaid values.
- Do not calculate missing historical values from today's ledger and present them as historical facts.

## Validation status

<success markers>
- PR #78 merged normally through GitHub (squash); no force push or check bypass.
- GitHub compare confirmed `main` equals merge commit `55cd214d362d173f1b60c217fe07c4cadbc95730` at checkpoint verification.
- AI Phase 0–3 job: portal lint and production build passed.
- Production security smoke job: passed.
- Django backend verification step completed successfully.
- Changed frontend source was isolated to `Payments.jsx`; checkpoint change is documentation only.
</success markers>

<known baseline failures>
- Production verification stopped after Django tests at the existing public website audit failure: `src/pages/EightSquareAI.jsx` — “interactive cursor/scroll reveal pattern detected”. The later portal step in that particular job was skipped; portal lint/build passed in the separate Phase 0–3 job.
- CyberLab browser gate still reports: “First-run welcome screen does not expose the AI Copilot entry point”.
- Phase 4–6 static gate still reports missing `findArduinoPinState` and `computeRuntime(state, pressedRef.current, pinStatesRef.current)`; Phase 9 / Part 4 aggregate runs inherit this failure.
- These failures are outside the changed receipt file and were already observed on the pre-feature baseline. Do not describe repository-wide CI as fully green.
</known baseline failures>

## Remaining manual acceptance

CI confirms lint/build but does not exercise this receipt flow end-to-end. When using the portal, check:
1. A verified ₹10,000 partial payment on a ₹50,000 contract prints Contract Value ₹50,000, Total Paid ₹10,000, Outstanding ₹40,000.
2. A later receipt reflects the new paid/unpaid snapshot, while the older receipt retains its original snapshot.
3. A fully paid contract displays ₹0.00 outstanding and PAID IN FULL.
4. An invoice-only receipt is labelled Invoice Value.
5. Historical receipts with null snapshots show Not recorded.

## Resume procedure

1. Read this checkpoint first and verify the live `main` SHA before any further write.
2. Preserve all immutable receipt snapshots. Never re-calculate a historical receipt's unpaid balance from current contract totals.
3. Make additional changes on a new feature branch and use a PR.
4. Keep unrelated baseline CI failures separate from receipt-specific validation.
