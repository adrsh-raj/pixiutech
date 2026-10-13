import assert from "node:assert/strict";
import test from "node:test";
import { isAutomatedReviewer, isHistoricalBulkApproval, isHumanApprovedRecord } from "./review-policy.mjs";

test("automated dataset-generator labels are not treated as human approval", () => {
  assert.equal(isAutomatedReviewer("system-qa-curator"), true);
  assert.equal(isAutomatedReviewer("circuit-doctor-telemetry-verifier"), true);
  assert.equal(isAutomatedReviewer("controlled-mutation-engine"), true);
  assert.equal(isHumanApprovedRecord({
    review: { status: "approved", reviewer: "blockly-runtime-verifier", reviewed_at: "2026-10-10T00:00:00.000Z" },
    permission: { review_status: "approved" },
  }), false);
});

test("a named, timestamped human approval satisfies the review gate", () => {
  assert.equal(isHumanApprovedRecord({
    review: { status: "approved", reviewer: "reviewer-ada", reviewed_at: "2026-10-10T00:00:00.000Z" },
    permission: { review_status: "approved" },
  }), true);
  assert.equal(isHumanApprovedRecord({
    review: { status: "in_review", reviewer: "reviewer-ada", reviewed_at: "2026-10-10T00:00:00.000Z" },
    permission: { review_status: "approved" },
  }), false);
});

test("the exact historical bulk-fill signature is retracted without banning later owner reviews", () => {
  const generated = {
    review: { status: "approved", reviewer: "adrsh-lead-reviewer", reviewed_at: "2026-10-10T16:38:50.000Z" },
    permission: { review_status: "approved" },
  };
  assert.equal(isHistoricalBulkApproval(generated), true);
  assert.equal(isHumanApprovedRecord(generated), false);

  const laterOwnerDecision = {
    review: { status: "approved", reviewer: "adrsh-lead-reviewer", reviewed_at: "2026-10-12T12:00:00.000Z" },
    permission: { review_status: "approved" },
  };
  assert.equal(isHistoricalBulkApproval(laterOwnerDecision), false);
  assert.equal(isHumanApprovedRecord(laterOwnerDecision), true);
});

test("automation labels remain ineligible for human sign-off", () => {
  for (const reviewer of ["system-qa-curator", "linguistic-variant-generator", "controlled-mutation-engine", "blockly-runtime-verifier"]) {
    assert.equal(isHumanApprovedRecord({
      review: { status: "approved", reviewer, reviewed_at: "2026-10-12T12:00:00.000Z" },
      permission: { review_status: "approved" },
    }), false, reviewer);
  }
});
