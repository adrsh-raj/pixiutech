import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { ROOT, getBundledModules } from "./bundle-helper.mjs";
import {
  canonicalSourceSlug,
  computeCanonicalTopologyHash,
  createCanonicalRecord,
  sha256,
  stableStringify,
} from "./normalize-record.mjs";
import { assertUniqueStableIds, extractCanonicalCandidates } from "./extract-candidates.mjs";

function makeRecord(sourceId, options = {}) {
  return createCanonicalRecord({
    sourceId,
    sourceType: "pixiu_template",
    sourcePath: "pixiu-lms-portal/src/lib/templates.ts",
    sourceRevision: "test-revision",
    targetBoard: "arduino-uno",
    title: "Hash test circuit",
    description: options.description ?? "",
    circuit: options.circuit || { parts: [{ id: "board", type: "arduino-uno", props: {} }], wires: [] },
    code: options.code ?? "",
    validationResult: { valid: true, errors: [], warnings: [] },
  });
}

test("SHA-256 uses stable canonical JSON key ordering", () => {
  assert.equal(sha256({ alpha: 1, beta: 2 }), sha256({ beta: 2, alpha: 1 }));
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("canonical content hash matches the final stored target, including fallback text and null code", () => {
  const record = makeRecord("tmpl-hash-fallback");
  assert.equal(record.target.code, null);
  assert.equal(record.capabilities.compile, "not_tested", "static circuit validation must not imply compilation");
  assert.equal(record.review.status, "in_review", "canonical extraction creates candidates, not human-approved gold records");
  assert.equal(record.hashes.content_hash, sha256({
    circuit: record.target.circuit,
    explanation: record.target.explanation,
    code: record.target.code,
  }));
});

test("topology hash ignores part IDs, part ordering, wire direction/order, and layout", () => {
  const first = {
    parts: [
      { id: "board", type: "arduino-uno", props: {}, x: 10, y: 20, rotation: 0 },
      { id: "led1", type: "led", props: { color: "red" }, x: 80, y: 20, rotation: 0 },
      { id: "res", type: "resistor", props: { resistance: 220 }, x: 50, y: 20, rotation: 0 },
    ],
    wires: [
      { from: { partId: "board", pinId: "D2" }, to: { partId: "res", pinId: "1" } },
      { from: { partId: "res", pinId: "2" }, to: { partId: "led1", pinId: "a" } },
    ],
  };
  const second = {
    parts: [
      { id: "l-9", type: "led", props: { color: "red" }, x: 700, y: 300, rotation: 180 },
      { id: "r-2", type: "resistor", props: { resistance: 220 }, x: 500, y: 200, rotation: 90 },
      { id: "mcu-new", type: "arduino-uno", props: {}, x: 100, y: 20, rotation: 270 },
    ],
    wires: [
      { from: { partId: "l-9", pinId: "a" }, to: { partId: "r-2", pinId: "2" } },
      { from: { partId: "r-2", pinId: "1" }, to: { partId: "mcu-new", pinId: "D2" } },
    ],
  };
  assert.equal(computeCanonicalTopologyHash(first), computeCanonicalTopologyHash(second));
});

test("topology hash distinguishes connections between identical component instances", () => {
  const parts = [
    { id: "board", type: "board", props: {} },
    { id: "led1", type: "led", props: { color: "red" } },
    { id: "led2", type: "led", props: { color: "red" } },
  ];
  const first = {
    parts,
    wires: [
      { from: { partId: "board", pinId: "5V" }, to: { partId: "led1", pinId: "anode" } },
      { from: { partId: "board", pinId: "GND" }, to: { partId: "led1", pinId: "cathode" } },
    ],
  };
  const second = {
    parts: parts.map((part) => ({ ...part })),
    wires: [
      { from: { partId: "board", pinId: "5V" }, to: { partId: "led1", pinId: "anode" } },
      { from: { partId: "board", pinId: "GND" }, to: { partId: "led2", pinId: "cathode" } },
    ],
  };
  assert.notEqual(computeCanonicalTopologyHash(first), computeCanonicalTopologyHash(second));
});

test("canonical extraction rejects colliding source slugs instead of emitting duplicate IDs", () => {
  assert.equal(canonicalSourceSlug("tmpl-a b"), canonicalSourceSlug("tmpl-a&b"));
  const first = makeRecord("tmpl-a b");
  const second = makeRecord("tmpl-a&b");
  assert.throws(() => assertUniqueStableIds([first, second]), /ID collision/);
});

test("canonical extraction reconciles eligible sources and is deterministic without rewriting artifacts", async () => {
  const artifactPaths = [
    "data/ai-copilot/phase2/records/canonical.jsonl",
    "data/ai-copilot/phase2/reports/duplicate-audit.json",
    "data/ai-copilot/phase2/reports/source-inventory.json",
  ];
  const before = new Map(artifactPaths.map((path) => [path, readFileSync(resolve(ROOT, path), "utf8")]));
  const first = await extractCanonicalCandidates({ writeArtifacts: false });
  const second = await extractCanonicalCandidates({ writeArtifacts: false });
  const serializeRecords = (records) => records.map((record) => stableStringify(record)).join("\n");
  assert.equal(first.canonicalRecords.length, first.inventoryReport.summary.eligible_candidates);
  assert.equal(first.canonicalRecords.length, second.canonicalRecords.length);
  assert.equal(serializeRecords(first.canonicalRecords), serializeRecords(second.canonicalRecords));
  assert.equal(stableStringify(first.duplicateAudit), stableStringify(second.duplicateAudit));
  assert.equal(new Set(first.canonicalRecords.map((record) => record.record_id)).size, first.canonicalRecords.length);
  assert.ok(first.canonicalRecords.every((record) =>
    record.source.source_revision === first.inventoryReport.commit_sha &&
    record.source.source_path &&
    record.source.source_id &&
    record.hashes.content_hash === sha256({
      circuit: record.target.circuit,
      explanation: record.target.explanation,
      code: record.target.code,
    })
  ));
  for (const [path, original] of before) {
    assert.equal(readFileSync(resolve(ROOT, path), "utf8"), original, "read-only extraction changed " + path);
  }
  const modules = await getBundledModules();
  assert.equal(typeof modules.validator.validateProposedCircuit, "function");
});
