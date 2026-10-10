import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ROOT } from "./bundle-helper.mjs";
import { generateDiagnosisAndCode } from "./generate-diagnosis-and-code.mjs";
import { computeCanonicalTopologyHash } from "./normalize-record.mjs";

const xml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program"><field name="PIN">6</field></block></xml>';
const board = {
  id: "arduino-uno",
  name: "Arduino Uno R3",
  logicVoltage: 5,
  pins: [
    { id: "d6", label: "D6", kind: "digital", capabilities: { pwm: true }, alternateNames: ["6"] },
  ],
};

function makeModules() {
  return {
    boards: { getBoardDefinition: (id) => id === board.id ? board : null },
    validator: {
      resolveCanonicalPin: (_type, pin) => pin,
      validateProposedCircuit: () => ({ valid: true, errors: [], warnings: [] }),
    },
    doctor: { diagnoseCircuit: () => ({ score: 100, status: "healthy", issues: [] }) },
    telemetry: {
      serializeCircuitTelemetry: () => ({
        board: { name: board.name, logicVoltage: board.logicVoltage },
        diagnostics: { healthScore: 100, healthStatus: "healthy" },
        powerRails: { rail5v: 5, gnd: 0 },
        components: [],
      }),
    },
  };
}

function makeParents(count, modules) {
  const circuit = {
    parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, props: {} }],
    wires: [],
  };
  const topologyHash = computeCanonicalTopologyHash(circuit, modules.validator.resolveCanonicalPin);
  return Array.from({ length: count }, (_, index) => ({
    record_id: "pxai2-canon-test-" + index,
    task_type: "request_to_circuit",
    project_family_id: "family-test-" + index,
    source: {
      source_type: "internal_fixture",
      source_path: "tests/fixture.ts",
      source_id: "fixture-source-" + index,
      source_revision: "fixture-revision",
    },
    context: { target_board: board.id, grade_band: 7 },
    instruction: { text: "Make the LED blink " + index },
    target: { circuit, code: xml, explanation: "Fixture parent record." },
    hashes: { source_hash: "source-" + index, topology_hash: topologyHash },
    variant: { kind: "canonical", parent_record_id: null },
    permission: { status: "internal_owned", review_status: "approved" },
    review: { status: "in_review", reviewer: "test-fixture", reviewed_at: "2026-10-10T00:00:00.000Z" },
  }));
}

test("Phase 2.5 generator builds evidence-grounded candidate records without writing by default", async () => {
  const artifactPaths = [
    "data/ai-copilot/phase2/records/diagnosis-explanations.jsonl",
    "data/ai-copilot/phase2/records/blockly-code.jsonl",
  ];
  const before = new Map(artifactPaths.map((path) => [path, readFileSync(resolve(ROOT, path), "utf8")]));
  const modules = makeModules();
  const parents = makeParents(25, modules);
  const result = await generateDiagnosisAndCode({
    canonicalRecords: parents,
    modules,
    reviewedAt: "2026-10-10T00:00:00.000Z",
  });
  assert.equal(result.wroteArtifacts, false);
  assert.equal(result.taskAudit.passed, true, JSON.stringify(result.taskAudit.issues));
  assert.equal(result.diagnosisRecords.length, 50);
  assert.equal(result.blocklyRecords.length, 50);
  assert.ok(result.diagnosisRecords.every((record) =>
    record.review.status === "in_review" &&
    record.target.explanation.includes("Simulated rail snapshot:") &&
    record.target.explanation.includes("does not certify physical hardware as safe")
  ));
  assert.ok(result.blocklyRecords.every((record) =>
    record.capabilities.compile === "not_tested" &&
    /compile status not tested/i.test(record.target.explanation) &&
    record.review.status === "in_review"
  ));
  for (const [path, contents] of before) {
    assert.equal(readFileSync(resolve(ROOT, path), "utf8"), contents, "read-only Phase 2.5 audit changed " + path);
  }
});
