import assert from "node:assert/strict";
import test from "node:test";
import { buildPhase25Audit, extractBlocklyPinFields, isWellFormedBlocklyXml, resolveBlocklyBoardPin } from "./phase25-task-audit.mjs";
import { computeCanonicalTopologyHash } from "./normalize-record.mjs";

const xml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program"><field name="PIN">6</field></block></xml>';
const board = { id: "arduino-uno", name: "Arduino Uno R3", logicVoltage: 5, pins: [
  { id: "d6", label: "D6", kind: "digital", capabilities: { pwm: true }, alternateNames: ["6"] },
  { id: "a4", label: "A4", kind: "analog", capabilities: { adc: true }, alternateNames: ["4"] },
] };
const circuit = { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, props: {} }], wires: [] };
function fixture() {
  const modules = {
    boards: {
      getBoardDefinition: (id) => id === board.id ? board : null,
      isBoardPart: (type) => type === "arduino-uno",
    },
    validator: {
      resolveCanonicalPin: (_type, pin) => pin,
      validateProposedCircuit: () => ({ valid: true, errors: [], warnings: [] }),
    },
    doctor: { diagnoseCircuit: () => ({ score: 100, status: "healthy", issues: [] }) },
    telemetry: {
      serializeCircuitTelemetry: () => ({
        board: { id: board.id, name: board.name, logicVoltage: board.logicVoltage },
        powerRails: { rail5v: 5, gnd: 0 },
        components: [],
      }),
    },
  };
  const topologyHash = computeCanonicalTopologyHash(circuit, modules.validator.resolveCanonicalPin);
  const parent = {
    record_id: "pxai2-canon-fixture",
    task_type: "request_to_circuit",
    project_family_id: "fixture-family",
    source: { source_path: "templates.ts", source_id: "fixture", source_revision: "fixture-sha" },
    context: { target_board: board.id, grade_band: 7 },
    instruction: { text: "Build a test circuit" },
    target: { circuit, code: xml },
    hashes: { topology_hash: topologyHash, source_hash: "fixture-source" },
    variant: { kind: "canonical", parent_record_id: null },
  };
  const diagnostic = {
    record_id: "pxai2-diag-fixture",
    task_type: "diagnosis_explanation",
    project_family_id: parent.project_family_id,
    source: { source_path: "templates.ts", source_id: "fixture#diag-0", source_revision: "fixture-sha" },
    context: { target_board: board.id, grade_band: 7 },
    instruction: { text: "Diagnose the test circuit." },
    target: { circuit, explanation:
      "[Circuit Diagnostic Analysis for Arduino Uno R3]\n" +
      "Board logic reference: 5V [static-rule-inference].\n" +
      "Circuit Doctor snapshot: 100/100 (healthy) [static-rule-inference].\n" +
      "Simulated rail snapshot: 5V=5V; GND reference=0.00V [simulated; not a physical measurement].\n" +
      "Component telemetry:\n- No component telemetry entries were returned.\n" +
      "Circuit Doctor findings (0):\n- No issue was returned by the configured static checks. This is not a physical-hardware safety certification.\n" +
      "Scope: this simulated/static snapshot does not certify physical hardware as safe.",
      code: null },
    hashes: { topology_hash: topologyHash },
    variant: { kind: "canonical", parent_record_id: parent.record_id },
  };
  const blockly = {
    record_id: "pxai2-code-fixture",
    task_type: "blockly_code",
    project_family_id: parent.project_family_id,
    source: { source_path: "templates.ts", source_id: "fixture#code-0", source_revision: "fixture-sha" },
    context: { target_board: board.id, grade_band: 7 },
    instruction: { text: "Make a Blockly program." },
    target: { circuit, code: xml, explanation: "Source-matched Blockly XML for the fixture. Compile status not tested." },
    capabilities: { simulation: "not_tested", compile: "not_tested" },
    hashes: { topology_hash: topologyHash },
    variant: { kind: "canonical", parent_record_id: parent.record_id },
  };
  return { modules, parent, diagnostic, blockly, topologyHash };
}

test("Phase 2.5 XML safety parser accepts a closed workspace and rejects malformed or executable markup", () => {
  assert.equal(isWellFormedBlocklyXml(xml), true);
  assert.equal(isWellFormedBlocklyXml("<xml><block></xml>"), false);
  assert.equal(isWellFormedBlocklyXml('<xml><script>alert(1)</script></xml>'), false);
  assert.deepEqual(extractBlocklyPinFields(xml), [{ pin: "6", blockType: "arduino_program", mode: undefined }]);
});

test("board pin resolver maps legacy numeric pin names to the selected board profile", () => {
  assert.equal(resolveBlocklyBoardPin("6", board.id, "servo_write", board)?.id, "d6");
  assert.equal(resolveBlocklyBoardPin("4", board.id, "io_analogread", board)?.id, "a4");
  assert.equal(resolveBlocklyBoardPin("99", board.id, "servo_write", board), null);
});

test("Phase 2.5 audit checks live health evidence, canonical parent/topology and code capability claims", () => {
  const f = fixture();
  const audit = buildPhase25Audit({
    canonicalRecords: [f.parent], diagnosisRecords: [f.diagnostic], blocklyRecords: [f.blockly],
    modules: f.modules, minimumPerTask: 1,
  });
  assert.equal(audit.passed, true, JSON.stringify(audit.issues));
  const badDiagnostic = { ...f.diagnostic, target: { ...f.diagnostic.target, explanation: f.diagnostic.target.explanation.replace("100/100 (healthy)", "75/100 (danger)") } };
  const badBlockly = { ...f.blockly, capabilities: { simulation: "not_tested", compile: "supported" } };
  const failed = buildPhase25Audit({
    canonicalRecords: [f.parent], diagnosisRecords: [badDiagnostic], blocklyRecords: [badBlockly],
    modules: f.modules, minimumPerTask: 1,
  });
  assert.equal(failed.passed, false);
  assert.ok(failed.issues.some((issue) => issue.code === "diagnosis_health_snapshot_mismatch"));
  assert.ok(failed.issues.some((issue) => issue.code === "blockly_compile_capability_unverified"));
});

test("Phase 2.5 audit fails when Blockly references a pin absent from the board profile", () => {
  const f = fixture();
  const badCode = f.blockly.target.code.replace(">6</field>", ">99</field>");
  const badBlockly = { ...f.blockly, target: { ...f.blockly.target, code: badCode } };
  const failed = buildPhase25Audit({
    canonicalRecords: [f.parent], diagnosisRecords: [f.diagnostic], blocklyRecords: [badBlockly],
    modules: f.modules, minimumPerTask: 1,
  });
  assert.equal(failed.passed, false);
  assert.ok(failed.issues.some((issue) => issue.code === "blockly_pin_not_in_board_profile"));
});
