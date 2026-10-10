import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ROOT } from "./bundle-helper.mjs";
import { sha256, stableStringify } from "./normalize-record.mjs";
import {
  assertCanonicalParents,
  buildRequestVariants,
  createPromptVariations,
  generateRequestVariants,
} from "./generate-request-variants.mjs";

const reviewedAt = "2026-10-10T00:00:00.000Z";

function canonicalParent(sourceId = "tmpl-test-circuit", overrides = {}) {
  const circuit = {
    parts: [{ id: "uno", type: "arduino-uno", props: {} }],
    wires: [],
  };
  const target = { circuit, explanation: "A test circuit.", code: null };
  return {
    record_id: "pxai2-canon-" + sourceId,
    record_schema_version: "1.0.0",
    task_type: "request_to_circuit",
    project_family_id: "family-" + sourceId,
    source: {
      source_type: "pixiu_template",
      source_path: "pixiu-lms-portal/src/lib/templates.ts",
      source_id: sourceId,
      source_revision: "test-revision",
    },
    permission: { status: "internal_owned", review_status: "approved" },
    context: { target_board: "arduino-uno", grade_band: 7 },
    instruction: { text: "LED Traffic Light" },
    target,
    validation: { status: "pass", validator_version: "1.0.0", errors: [], warnings: [] },
    capabilities: { simulation: "supported", compile: "not_tested" },
    review: { status: "approved", reviewer: "test", reviewed_at: reviewedAt },
    variant: { kind: "canonical", parent_record_id: null },
    hashes: {
      source_hash: sha256({ sourceId, circuit }),
      topology_hash: sha256("test-topology"),
      content_hash: sha256({ circuit, explanation: target.explanation, code: target.code }),
    },
    limitations: [],
    ...overrides,
  };
}

test("creates exactly the five supported request styles, with unique prompt text", () => {
  const variants = createPromptVariations(canonicalParent());
  assert.deepEqual(
    variants.map((variant) => variant.request_style),
    ["direct", "goal_oriented", "contextual", "colloquial", "typo"]
  );
  assert.equal(new Set(variants.map((variant) => variant.text)).size, 5);
  assert.ok(variants.find((variant) => variant.request_style === "colloquial").text.includes("kaise"));
});

test("variant IDs, source suffixes and parent links are stable per parent/style", () => {
  const parent = canonicalParent();
  const first = buildRequestVariants([parent], { reviewedAt });
  const second = buildRequestVariants([parent], { reviewedAt });
  assert.equal(stableStringify(first), stableStringify(second));
  assert.deepEqual(first.map((record) => record.record_id), [
    "pxai2-req-tmpl-test-circuit-direct",
    "pxai2-req-tmpl-test-circuit-goal_oriented",
    "pxai2-req-tmpl-test-circuit-contextual",
    "pxai2-req-tmpl-test-circuit-colloquial",
    "pxai2-req-tmpl-test-circuit-typo",
  ]);
  assert.ok(first.every((record) => record.source.source_id.startsWith(parent.source.source_id + "#request-")));
  assert.ok(first.every((record) => record.variant.parent_record_id === parent.record_id));
  assert.ok(first.every((record) =>
    record.hashes.content_hash === sha256({ text: record.instruction.text, target: record.target })
  ));
});

test("output ordering does not depend on canonical input ordering", () => {
  const parents = [canonicalParent("tmpl-zed"), canonicalParent("tmpl-alpha")];
  const first = buildRequestVariants(parents, { reviewedAt });
  const second = buildRequestVariants(parents.slice().reverse(), { reviewedAt });
  assert.equal(stableStringify(first), stableStringify(second));
  assert.ok(first[0].record_id.startsWith("pxai2-req-tmpl-alpha-"));
});

test("rejects duplicate parents and source IDs that normalize to the same slug", () => {
  const parent = canonicalParent("tmpl-duplicate");
  assert.throws(() => assertCanonicalParents([parent, parent]), /Duplicate canonical parent/);
  assert.throws(() => buildRequestVariants([
    canonicalParent("tmpl-a b"),
    canonicalParent("tmpl-a&b"),
  ], { reviewedAt }), /collide after slug normalization/);
});

test("read-only generation does not rewrite the existing request artifact", async () => {
  const requestPath = resolve(ROOT, "data/ai-copilot/phase2/records/requests.jsonl");
  const before = readFileSync(requestPath, "utf8");
  const parents = Array.from({ length: 20 }, (_, index) => canonicalParent("tmpl-read-only-" + index));
  const records = await generateRequestVariants({
    writeArtifacts: false,
    canonicalRecords: parents,
    reviewedAt,
  });
  assert.equal(records.length, 100);
  assert.equal(readFileSync(requestPath, "utf8"), before);
});

test("variant generator rejects a malformed or non-canonical parent", () => {
  assert.throws(() => buildRequestVariants([], { reviewedAt }), /non-empty array/);
  const invalid = canonicalParent();
  invalid.variant = { kind: "paraphrase", parent_record_id: null };
  assert.throws(() => buildRequestVariants([invalid], { reviewedAt }), /Invalid canonical request parent/);
});
