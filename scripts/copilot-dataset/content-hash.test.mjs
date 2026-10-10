import assert from "node:assert/strict";
import test from "node:test";
import { expectedCanonicalContentHash, expectedContentHash, withExpectedContentHash } from "./content-hash.mjs";
import { sha256 } from "./normalize-record.mjs";

test("request hash binds stored instruction and target", () => {
  const record = { task_type: "request_to_circuit", instruction: { text: "Blink" },
    target: { circuit: { parts: [], wires: [] }, explanation: "target", code: null },
    hashes: { source_hash: "s", topology_hash: "t" } };
  assert.equal(expectedContentHash(record), sha256({ text: record.instruction.text, target: record.target }));
  assert.equal(withExpectedContentHash(record).hashes.source_hash, "s");
});
test("fault hash binds input, corrected target and mutation ID", () => {
  const record = { task_type: "fault_repair", fault: { input_circuit: {}, mutation_id: "bad-wire" },
    target: { corrected_circuit: {}, explanation: "repair", code: null } };
  assert.equal(expectedContentHash(record), sha256({ fault: record.fault.input_circuit,
    target: { circuit: {}, explanation: "repair", code: null }, mutation_id: "bad-wire" }));
  assert.notEqual(expectedContentHash(record), expectedContentHash({ ...record,
    fault: { ...record.fault, mutation_id: "other" } }));
});
test("diagnosis and Blockly use their explicit task contracts", () => {
  const common = { target: { circuit: {}, explanation: "grounded", code: null }, instruction: { text: "Explain" } };
  const diagnosis = { ...common, task_type: "diagnosis_explanation" };
  const blockly = { ...common, task_type: "blockly_code", target: { ...common.target, code: "<xml/>" } };
  assert.equal(expectedContentHash(diagnosis), sha256({ circuit: {}, explanation: "grounded",
    instruction: "Explain", task: "diagnosis_explanation" }));
  assert.equal(expectedContentHash(blockly), sha256({ circuit: {}, code: "<xml/>",
    instruction: "Explain", task: "blockly_code" }));
});
test("canonical hash is derived from actual stored target fields", () => {
  const record = { target: { circuit: {}, explanation: "parent", code: null } };
  assert.equal(expectedCanonicalContentHash(record), sha256({ circuit: {}, explanation: "parent", code: null }));
});
