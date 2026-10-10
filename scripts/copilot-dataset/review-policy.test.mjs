import assert from "node:assert/strict";
import test from "node:test";
import { isAutomatedReviewer, isHumanApprovedRecord } from "./review-policy.mjs";

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
