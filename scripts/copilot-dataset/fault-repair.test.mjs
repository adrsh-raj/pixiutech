import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { getBundledModules, ROOT } from "./bundle-helper.mjs";
import { sha256, stableStringify } from "./normalize-record.mjs";
import {
  buildFaultRepairRecords,
  evaluateFaultCalibration,
  generateFaultRepairPairs,
} from "./generate-fault-repair-pairs.mjs";

const reviewedAt = "2026-10-10T00:00:00.000Z";

test("fault calibration requires the declared rule itself to have the expected severity", () => {
  const mutation = {
    expected_validator_status: "reject",
    expected_rule_ids: ["safety-led-burnout-led1"],
  };
  const unrelatedCritical = {
    valid: false,
    notices: [
      { ruleId: "safety-led-burnout-led1", severity: "advisory" },
      { ruleId: "identity-unknown-pin-uno-bad", severity: "critical" },
    ],
  };
  assert.equal(evaluateFaultCalibration(mutation, unrelatedCritical).passed, false);

  const exactCritical = {
    valid: false,
    notices: [{ ruleId: "safety-led-burnout-led1", severity: "critical" }],
  };
  assert.equal(evaluateFaultCalibration(mutation, exactCritical).passed, true);
});

test("warning-only calibration does not pass from an unrelated critical rule", () => {
  const mutation = {
    expected_validator_status: "warning",
    expected_rule_ids: ["wiring-missing-ground-return-srv"],
  };
  const result = {
    valid: false,
    notices: [
      { ruleId: "wiring-missing-ground-return-srv", severity: "advisory" },
      { ruleId: "identity-unknown-pin-u-bad", severity: "critical" },
    ],
  };
  assert.equal(evaluateFaultCalibration(mutation, result).passed, false);
});

test("read-only fault generation is deterministic, calibrated, and preserves the existing artifact", async () => {
  const faultPath = resolve(ROOT, "data/ai-copilot/phase2/records/fault-repairs.jsonl");
  const canonicalPath = resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl");
  const beforeFaults = readFileSync(faultPath, "utf8");
  const beforeCanonical = readFileSync(canonicalPath, "utf8");

  const first = await generateFaultRepairPairs({ writeArtifacts: false, reviewedAt, minRecords: 50 });
  const second = await generateFaultRepairPairs({ writeArtifacts: false, reviewedAt, minRecords: 50 });

  assert.ok(first.faultRecords.length >= 50);
  assert.equal(first.faultRecords.length, second.faultRecords.length);
  assert.equal(stableStringify(first.faultRecords), stableStringify(second.faultRecords));
  assert.equal(stableStringify(first.summary), stableStringify(second.summary));
  assert.equal(new Set(first.faultRecords.map((record) => record.record_id)).size, first.faultRecords.length);

  for (const record of first.faultRecords) {
    assert.match(record.record_id, /^pxai2-fault-[a-z0-9\-_]+$/);
    assert.equal(record.task_type, "fault_repair");
    assert.equal(record.variant.kind, "fault");
    assert.ok(record.variant.parent_record_id);
    assert.ok(record.source.source_path);
    assert.ok(record.source.source_revision);
    assert.ok(record.fault.expected_rule_ids.length > 0);
    assert.equal(record.hashes.content_hash, sha256({
      fault: record.fault.input_circuit,
      target: {
        circuit: record.target.corrected_circuit,
        explanation: record.target.explanation,
        code: record.target.code,
      },
      mutation_id: record.fault.mutation_id,
    }));
  }

  assert.equal(readFileSync(faultPath, "utf8"), beforeFaults);
  assert.equal(readFileSync(canonicalPath, "utf8"), beforeCanonical);
});

test("fault builder rejects invalid minimum-target options before processing parents", async () => {
  const { boards, validator } = await getBundledModules();
  assert.throws(() => buildFaultRepairRecords([{}], {
    boards,
    validateProposedCircuit: validator.validateProposedCircuit,
    resolveCanonicalPin: validator.resolveCanonicalPin,
    reviewedAt,
    minRecords: -1,
  }), /minRecords must be a non-negative integer/);
});
