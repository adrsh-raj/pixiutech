# School Billing Receipt Print — Recovery Checkpoint

Updated: 2026-11-05 (Asia/Kolkata)

## Context / user-reported incident

- User viewed `portal.pixiutech.com/billing` as a school account.
- Screenshot shows the school billing page's “Payment history” section with two successful ₹10,000 cash entries dated 2026-11-05 and no receipt print/download action.
- Visible school/contract reference: `PIXIU-ZPS-2026`.
- Snapshot balances shown in the screenshot: ₹40,000 after one ₹10,000 receipt and ₹30,000 after another ₹10,000 receipt.
- User also mentioned a mistaken ₹1,000 and ₹10,000 entry, but the screenshot itself displays only two ₹10,000 payment rows. No ₹1,000 row or transaction IDs are visible.
- User requested receipt printing and a zero/reset of the named school's billing. The exact reset scope and transaction IDs are not yet established.

## Root cause

- PR #78 added a PDF print flow to `pixiu-lms-portal/src/pages/Payments.jsx`, the finance/admin Payments page.
- The screenshot is `BillingCenter.jsx`, whose school-side Receipt / Payment history renderer had no action button at all.
- `BillingCenter.jsx` also only displayed the receipt number and balance-after-receipt; it did not present contract value and cumulative paid amount alongside it.
- `GET /payments` and `PaymentSerializer` already expose the immutable snapshot fields:
  - `receipt_total_amount_snapshot`
  - `receipt_amount_paid_snapshot`
  - `receipt_balance_due_snapshot`

## Current implementation

- Feature branch: `fix/school-billing-receipt-print-20261105`
- Base `main`: `4118adb510a0d4b3850f5eab92dc3b8a950b06e0`
- Source commit: `e164ae49ce532103718e5c99e73213534c011cf9`
- Changed source: `pixiu-lms-portal/src/pages/BillingCenter.jsx`
- Adds a **Download PDF** button directly beside each successful receipt in the school Billing page.
- PDF uses the server-issued immutable receipt snapshot and displays:
  - Contract Value (or Invoice Value for invoice-only payment)
  - Total Paid (including this receipt)
  - Unpaid / Outstanding Balance
  - Payment status
  - Amount received on this receipt
  - School, receipt number, contract/invoice reference, payment date, method and transaction reference
- Browser print dialog supports **Save as PDF**.
- If the historic snapshot is missing, it shows “Not recorded” rather than estimating.
- The receipt history row also shows contract value, cumulative paid, and outstanding values inline.

## Data-reset safety / current decision

- No production financial data has been changed, deleted, zeroed, or reclassified in this work.
- Payment records, receipts and audit logs are financial evidence. A silent delete/zero would destroy reconciliation history.
- The existing backend has no documented safe correction/reversal endpoint for successful payments. `PaymentStatus.REFUNDED` is an enum value, not proof that a refund/reversal workflow is implemented.
- Before correcting entries, confirm the exact school identity and which specific successful payment records are mistaken. A proper correction should preserve the original transaction and receipt, create an audited reversal/void state, recalculate invoice/contract balances and mark the original receipt as void where appropriate.
- The screenshot does not show a ₹1,000 payment. Do not guess a target row from the user's spoken amount alone.

## Validation status

- Static source checks confirm the renderer, Download PDF action, snapshot fields and null-snapshot guard exist.
- PR CI / frontend lint / production build are pending.
- The manual browser acceptance flow must open Billing as a school account and print a receipt.

## Resume procedure

1. Check the open PR head and CI status before any write.
2. Validate the school-side Billing receipt button (not only the admin Payments page).
3. Use a ₹50,000 contract test fixture with two ₹10,000 verified payments: first PDF should show ₹10,000 paid / ₹40,000 due; second should show ₹20,000 paid / ₹30,000 due. First receipt must retain its original snapshot.
4. For a correction, verify payment ID, receipt number, school ID/code, status, amount, method, reference, recorded_by, and linked invoice/contract from the authoritative database before any reversal.
5. Do not zero or delete all school financial records without explicit exact-scope confirmation and an auditable backup/reversal plan.
