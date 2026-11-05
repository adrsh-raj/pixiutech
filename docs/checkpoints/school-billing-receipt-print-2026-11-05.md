# School Billing Receipt Print — Recovery Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Repository state

- Repository: adrsh-raj/pixiutech
- PR #79: [merged](https://github.com/adrsh-raj/pixiutech/pull/79)
- Feature branch: fix/school-billing-receipt-print-20261105
- Source commit: e164ae49ce532103718e5c99e73213534c011cf9
- Squash merge commit on main: e14a04006ef3c09bb65a45af2ee888054c22a9d3
- Changed source: pixiu-lms-portal/src/pages/BillingCenter.jsx

## Context / user-reported incident

- User viewed portal.pixiutech.com/billing as a school account.
- Screenshot shows the school billing page's “Payment history” section with two successful ₹10,000 cash entries dated 2026-11-05 and no receipt print/download action.
- Visible school/contract reference: PIXIU-ZPS-2026.
- Snapshot balances shown: ₹40,000 after one ₹10,000 receipt and ₹30,000 after another ₹10,000 receipt.
- User also mentioned a mistaken ₹1,000 and ₹10,000 entry, but the screenshot itself displays only two ₹10,000 payment rows. No ₹1,000 row or transaction IDs are visible.

## Root cause

- PR #78 added a PDF print flow to pixiu-lms-portal/src/pages/Payments.jsx, the finance/admin Payments page.
- The screenshot is BillingCenter.jsx, whose school-side Payment history renderer had no action button.
- School-side receipt history only displayed the receipt number and balance-after-receipt; it did not present contract value and cumulative paid amount alongside it.
- GET /payments and PaymentSerializer already expose immutable receipt snapshot fields:
  - receipt_total_amount_snapshot
  - receipt_amount_paid_snapshot
  - receipt_balance_due_snapshot

## Merged fix

- Adds a Download PDF button directly beside each successful receipt in the school Billing page.
- PDF uses the server-issued immutable snapshot and displays:
  - Contract Value (or Invoice Value for invoice-only payment)
  - Total Paid (including this receipt)
  - Unpaid / Outstanding Balance
  - Payment status
  - Amount received on this receipt
  - School, receipt number, contract/invoice reference, payment date, method and transaction reference
- Browser print dialog supports Save as PDF.
- Missing historical snapshot values display “Not recorded” rather than an estimated figure.
- School Payment history now shows contract value, total paid and outstanding values inline.
- The existing signed contract ledger section remains the authoritative current balance view; receipt rows represent historical balances at issue time.

## Validation

- PR #79 merged normally through GitHub (squash).
- main was fetched after merge; its BillingCenter source contains the new school-side PDF action and all three receipt balance labels.
- PIXIU AI Lab Phase 0-3 Gate passed, including portal lint and production build (run #265).
- PIXIU Production Security Smoke passed (run #620).
- PIXIU Production Verification Django backend stage passed; overall job stopped on public site audit:
  - src/pages/EightSquareAI.jsx — interactive cursor/scroll reveal pattern detected.
- Other non-billing existing gates:
  - CyberLab browser gate: first-run welcome screen does not expose AI Copilot entry point.
  - Phase 4–6 static gate: missing findArduinoPinState and computeRuntime(state, pressedRef.current, pinStatesRef.current); Phase 9 / Part 4 aggregate checks inherit this.
- These failures are outside the changed BillingCenter source. Do not describe repository-wide CI as fully green.
- Live production deployment and school-account browser print-preview have not yet been independently confirmed.

## Financial data correction / reset — not performed

- No production financial data has been changed, deleted, zeroed, or reclassified.
- The existing backend does not implement a documented audited reversal endpoint for successful payments. PaymentStatus.REFUNDED is an enum value, not proof of a completed refund/reversal workflow.
- The screenshot does not show the mentioned ₹1,000 row or transaction IDs.
- Before correcting entries, verify the exact school ID/code and each payment's ID, receipt number, status, amount, method, transaction reference, recorded_by and linked invoice/contract from the authoritative database.
- A correction should preserve the original transaction and receipt, create an audited void/reversal, recalculate invoice/contract balances, and visibly mark the original receipt as void where appropriate. Do not silently delete financial evidence or zero unrelated records.

## Manual acceptance still required

1. Open /billing as the school account for the intended school.
2. Confirm each successful receipt row has a visible Download PDF button.
3. For a ₹50,000 contract with two verified ₹10,000 payments, first PDF should show ₹10,000 paid / ₹40,000 due; second PDF should show ₹20,000 paid / ₹30,000 due. The first receipt must retain its original snapshot.
4. Verify a fully paid receipt shows ₹0.00 outstanding.
5. Verify the browser print dialog can save the receipt as PDF.

## Resume procedure

1. Verify the current main SHA before any new source write.
2. For payment correction, identify the exact school and payment records from the production database first.
3. Do not zero or delete all school financial records without exact-scope confirmation and an auditable backup/reversal plan.
4. Preserve unrelated baseline CI failures separately from Billing-specific verification.
