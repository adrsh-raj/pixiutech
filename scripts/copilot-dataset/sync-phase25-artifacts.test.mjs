import assert from "node:assert/strict";
import test from "node:test";
import { planPhase25Sync } from "./sync-phase25-artifacts.mjs";

const mk = (record_id, task_type, content) => ({ record_id, task_type, content });

test("Phase 2.5 sync updates the current task rows without changing split membership/order", () => {
  const currentDiagnosisRecords = [mk("diag-1", "diagnosis_explanation", "old")];
  const currentBlocklyRecords = [mk("code-1", "blockly_code", "old")];
  const candidateDiagnosisRecords = [mk("diag-1", "diagnosis_explanation", "new")];
  const candidateBlocklyRecords = [mk("code-1", "blockly_code", "new")];
  const unrelated = mk("request-1", "request_to_circuit", "unchanged");
  const splits = {
    train: [currentBlocklyRecords[0], unrelated],
    validation: [currentDiagnosisRecords[0]],
    test: [],
  };
  const plan = planPhase25Sync({
    currentDiagnosisRecords, currentBlocklyRecords, candidateDiagnosisRecords, candidateBlocklyRecords, splits,
  });
  assert.equal(plan.metrics.diagnosis_changed, 1);
  assert.equal(plan.metrics.blockly_changed, 1);
  assert.equal(plan.metrics.split_assignments_changed, 0);
  assert.equal(plan.metrics.non_phase25_rows_changed, 0);
  assert.deepEqual(plan.plannedSplits.train.map((record) => record.record_id), ["code-1", "request-1"]);
  assert.equal(plan.plannedSplits.train[0].content, "new");
  assert.deepEqual(plan.plannedSplits.train[1], unrelated);
  assert.equal(plan.plannedSplits.validation[0].content, "new");
});

test("Phase 2.5 sync refuses task-record ID additions or removals", () => {
  assert.throws(() => planPhase25Sync({
    currentDiagnosisRecords: [mk("diag-old", "diagnosis_explanation", "old")],
    currentBlocklyRecords: [mk("code-1", "blockly_code", "old")],
    candidateDiagnosisRecords: [mk("diag-new", "diagnosis_explanation", "new")],
    candidateBlocklyRecords: [mk("code-1", "blockly_code", "new")],
    splits: { train: [mk("diag-old", "diagnosis_explanation", "old"), mk("code-1", "blockly_code", "old")], validation: [], test: [] },
  }), /ID set changed/);
});

test("Phase 2.5 sync refuses records absent from exactly one existing split", () => {
  assert.throws(() => planPhase25Sync({
    currentDiagnosisRecords: [mk("diag-1", "diagnosis_explanation", "old")],
    currentBlocklyRecords: [mk("code-1", "blockly_code", "old")],
    candidateDiagnosisRecords: [mk("diag-1", "diagnosis_explanation", "new")],
    candidateBlocklyRecords: [mk("code-1", "blockly_code", "new")],
    splits: { train: [mk("code-1", "blockly_code", "old")], validation: [], test: [] },
  }), /exactly one existing split/);
});

test("Phase 2.5 sync refuses orphaned task records in a split", () => {
  assert.throws(() => planPhase25Sync({
    currentDiagnosisRecords: [mk("diag-1", "diagnosis_explanation", "old")],
    currentBlocklyRecords: [mk("code-1", "blockly_code", "old")],
    candidateDiagnosisRecords: [mk("diag-1", "diagnosis_explanation", "new")],
    candidateBlocklyRecords: [mk("code-1", "blockly_code", "new")],
    splits: { train: [mk("diag-orphan", "diagnosis_explanation", "old"), mk("code-1", "blockly_code", "old")], validation: [mk("diag-1", "diagnosis_explanation", "old")], test: [] },
  }), /orphan Phase 2.5 record/);
});
