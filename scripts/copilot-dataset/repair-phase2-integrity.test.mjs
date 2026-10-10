import assert from "node:assert/strict";
import test from "node:test";
import { planPhase2IntegrityRepair } from "./repair-phase2-integrity.mjs";
import { expectedContentHash, expectedCanonicalContentHash } from "./content-hash.mjs";

const canonical = {
  record_id: "parent-1", task_type: "request_to_circuit", project_family_id: "family-1",
  context: { target_board: "arduino-uno" }, target: { circuit: {}, explanation: "parent", code: null },
  hashes: { source_hash: "s", topology_hash: "topology-1", content_hash: "legacy-parent" },
};
function fault(id, mutationId = "legacy-bad", inputCircuit = { parts: [], wires: [] }) {
  return {
    record_id: id, task_type: "fault_repair", project_family_id: "family-1",
    context: { target_board: "arduino-uno" },
    source: { source_type: "synthetic_mutation", source_path: "parent.ts", source_id: id, source_revision: "rev1" },
    permission: { status: "internal_owned", review_status: "approved" }, instruction: { text: "Repair circuit" },
    fault: { mutation_id: mutationId, input_circuit: inputCircuit, expected_rule_ids: ["safety-led-burnout-led1"] },
    target: { corrected_circuit: {}, explanation: "repair", code: null },
    variant: { kind: "fault", parent_record_id: "parent-1" },
    review: { status: "in_review", reviewer: "automated-test", reviewed_at: "2026-10-10T00:00:00.000Z" },
    hashes: { source_hash: "s", topology_hash: "topology-1", content_hash: "legacy-fault" },
  };
}
function fixture(noCandidate = false) {
  const bad = fault("fault-1");
  const request = { record_id: "request-1", task_type: "request_to_circuit", project_family_id: "family-1",
    context: { target_board: "arduino-uno" }, instruction: { text: "Make circuit" },
    target: { circuit: {}, explanation: "request", code: null },
    hashes: { source_hash: "s", topology_hash: "topology-1", content_hash: "old" } };
  const diagnosis = { record_id: "diagnosis-1", task_type: "diagnosis_explanation", project_family_id: "family-1",
    context: { target_board: "arduino-uno" }, instruction: { text: "Explain" },
    target: { circuit: {}, explanation: "grounded", code: null },
    hashes: { source_hash: "s", topology_hash: "topology-1", content_hash: "old" } };
  const blockly = { record_id: "blockly-1", task_type: "blockly_code", project_family_id: "family-1",
    context: { target_board: "arduino-uno" }, instruction: { text: "Build blocks" },
    target: { circuit: {}, explanation: "source-matched", code: "<xml/>" },
    hashes: { source_hash: "s", topology_hash: "topology-1", content_hash: "old" } };
  const candidate = fault("candidate-1", "current-calibrated", { parts: [], wires: [{ id: "new" }] });
  const records = { canonical: [canonical], requests: [request], faultRepairs: [bad],
    diagnosisExplanations: [diagnosis], blocklyCode: [blockly] };
  return {
    records, splits: { train: [request, diagnosis], validation: [bad], test: [blockly] },
    candidateFaultRecords: noCandidate ? [] : [{ ...candidate, hashes: { ...candidate.hashes, topology_hash: "topology-1" } }],
    validateFaultRecord: (row) => ({ passed: row.fault?.mutation_id === "current-calibrated",
      actualRuleIds: row.fault?.expected_rule_ids || [], actualSeverities: ["critical"] }),
  };
}

test("repair recalculates hashes and preserves split IDs, membership and order", () => {
  const input = fixture();
  const before = Object.fromEntries(Object.entries(input.splits).map(([key, rows]) => [key, rows.map((r) => r.record_id)]));
  const plan = planPhase2IntegrityRepair(input);
  assert.equal(plan.summary.fault_failures_before.length, 1);
  assert.equal(plan.summary.fault_replacements[0].new_mutation_id, "current-calibrated");
  assert.equal(plan.summary.split_assignments_changed, 0);
  assert.equal(plan.summary.split_order_preserved, true);
  for (const key of Object.keys(before)) assert.deepEqual(plan.splits[key].map((r) => r.record_id), before[key]);
  assert.equal(plan.records.faultRepairs[0].record_id, "fault-1");
  assert.equal(plan.records.faultRepairs[0].hashes.content_hash, expectedContentHash(plan.records.faultRepairs[0]));
  assert.equal(plan.records.requests[0].hashes.content_hash, expectedContentHash(plan.records.requests[0]));
  assert.equal(plan.records.canonical[0].hashes.content_hash, expectedCanonicalContentHash(plan.records.canonical[0]));
  assert.equal(plan.splits.validation[0].hashes.content_hash, expectedContentHash(plan.splits.validation[0]));
});
test("aborts rather than guessing if no calibrated same-parent replacement exists", () => {
  assert.throws(() => planPhase2IntegrityRepair(fixture(true)), /No distinct calibrated replacement/);
});
test("aborts if split family, board or topology invariant differs from source artifact", () => {
  const input = fixture();
  input.splits.validation[0] = { ...input.splits.validation[0],
    hashes: { ...input.splits.validation[0].hashes, topology_hash: "different-topology" } };
  assert.throws(() => planPhase2IntegrityRepair(input), /task, family, board or topology invariant differs/);
});
test("aborts if source task IDs do not exactly reconcile with split IDs", () => {
  const input = fixture(); input.splits.test = [];
  assert.throws(() => planPhase2IntegrityRepair(input), /Source\/split IDs do not reconcile/);
});
