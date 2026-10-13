import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAutomatedReviewer, isHumanApprovedRecord, isHistoricalBulkApproval } from "./review-policy.mjs";
import { expectedCanonicalContentHash, expectedContentHash } from "./content-hash.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readJsonl = (p) => readFileSync(resolve(ROOT, p), "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const path = {
  canonical: "data/ai-copilot/phase2/records/canonical.jsonl",
  requests: "data/ai-copilot/phase2/records/requests.jsonl",
  faults: "data/ai-copilot/phase2/records/fault-repairs.jsonl",
  diagnoses: "data/ai-copilot/phase2/records/diagnosis-explanations.jsonl",
  blockly: "data/ai-copilot/phase2/records/blockly-code.jsonl",
  train: "data/ai-copilot/phase2/splits/train.jsonl",
  validation: "data/ai-copilot/phase2/splits/validation.jsonl",
  test: "data/ai-copilot/phase2/splits/test.jsonl",
};
const rows = Object.fromEntries(Object.entries(path).map(([k,p]) => [k, readJsonl(p)]));
const family = (r) => {
  const s = [r.record_id, r.project_family_id, r.source?.source_id].filter(Boolean).join(" ");
  if (s.includes("tmpl-g7-tmp36-alert")) return "fan";
  if (s.includes("tmpl-g7-soil-smart-farm")) return "pump";
  if (s.includes("mission-lesson-neopixel-ring")) return "ring";
  return null;
};

test("historical synthetic G9 approvals are rejected but later human reviews remain possible", () => {
  const bulk = { review: { status: "approved", reviewer: "adrsh-lead-reviewer", reviewed_at: "2026-10-10T16:38:50.000Z" }, permission: { review_status: "approved" } };
  assert.equal(isHistoricalBulkApproval(bulk), true);
  assert.equal(isHumanApprovedRecord(bulk), false);
  assert.equal(isAutomatedReviewer("system-qa-curator"), true);
  const real = { review: { status: "approved", reviewer: "adrsh-lead-reviewer", reviewed_at: "2026-10-12T12:00:00.000Z" }, permission: { review_status: "approved" } };
  assert.equal(isHistoricalBulkApproval(real), false);
  assert.equal(isHumanApprovedRecord(real), true);
});

test("the unsafe bulk-approval script cannot generate decisions", () => {
  const source = readFileSync(resolve(ROOT, "scripts/copilot-dataset/fill-g9-human-review.mjs"), "utf8");
  assert.match(source, /intentionally disabled/);
  assert.match(source, /No records, workbooks or reports were modified/);
  assert.doesNotMatch(source, /row\[7\]\s*=\s*["']Approved/);
});

test("no checked-in canonical or released record passes G9 on the old bulk approval signature", () => {
  const all = [...rows.canonical, ...rows.requests, ...rows.faults, ...rows.diagnoses, ...rows.blockly];
  assert.equal(all.length, 867);
  assert.equal(all.filter(isHumanApprovedRecord).length, 0);
  assert.equal(all.filter(r => isHistoricalBulkApproval(r)).length, 0, "bulk signature should be restored from the pinned pre-fill checkpoint");
});

test("safety guidance is synchronized to fan, pump and NeoPixel data with valid hashes", () => {
  const terms = {
    fan: ["simulation abstraction only", "arduino gpio", "mosfet", "flyback"],
    pump: ["simulation abstraction only", "arduino gpio", "mosfet", "flyback"],
    ring: ["480 ma", "brightness at 64", "external 5v supply", "common ground"],
  };
  const source = [...rows.canonical, ...rows.requests, ...rows.faults, ...rows.diagnoses, ...rows.blockly];
  for (const r of source) {
    const f = family(r);
    if (!f) continue;
    const joined = [...(r.limitations || []), r.target?.explanation || ""].join(" ").toLowerCase();
    for (const term of terms[f]) assert.ok(joined.includes(term), r.record_id + " missing " + term);
    const expected = r.record_id.startsWith("pxai2-canon-") ? expectedCanonicalContentHash(r) : expectedContentHash(r);
    assert.equal(r.hashes.content_hash, expected, r.record_id + " content hash");
  }
});

test("released split copies exactly match task source records after safety sync", () => {
  const source = new Map([...rows.requests, ...rows.faults, ...rows.diagnoses, ...rows.blockly].map(r => [r.record_id, r]));
  const releases = [...rows.train, ...rows.validation, ...rows.test];
  assert.equal(releases.length, 796);
  for (const r of releases) assert.deepEqual(r, source.get(r.record_id), r.record_id);
});

test("fan and pump fault scenarios and canonical topology hashes are unchanged", () => {
  const canonical = new Map(rows.canonical.map(r => [r.record_id, r]));
  const fan = canonical.get("pxai2-canon-tmpl-g7-tmp36-alert");
  const pump = canonical.get("pxai2-canon-tmpl-g7-soil-smart-farm");
  const ring = canonical.get("pxai2-canon-mission-lesson-neopixel-ring");
  assert.ok(fan && pump && ring);
  assert.equal(ring.hashes.topology_hash, "13b97cd8d28cb8c88bcce1e8400ddf6110bf2f88d9fe85400a179c505e97fc68");
  for (const r of [...rows.requests, ...rows.faults]) {
    const f = family(r);
    const parent = f === "fan" ? fan : f === "pump" ? pump : f === "ring" ? ring : null;
    if (parent) assert.equal(r.hashes.topology_hash, parent.hashes.topology_hash, r.record_id);
  }
  const ff = rows.faults.find(r => r.record_id === "pxai2-fault-tmpl-g7-tmp36-alert-63");
  const pf = rows.faults.find(r => r.record_id === "pxai2-fault-tmpl-g7-soil-smart-farm-71");
  assert.equal(ff?.fault?.mutation_id, "direct-power-to-gnd-dead-short");
  assert.deepEqual(ff?.fault?.expected_rule_ids, ["safety-direct-power-short-5v"]);
  assert.equal(pf?.fault?.mutation_id, "direct-power-to-gnd-dead-short");
  assert.deepEqual(pf?.fault?.expected_rule_ids, ["safety-direct-power-short-5v"]);
});

test("lesson sources make simulation-only motor wiring and NeoPixel power limits explicit", () => {
  const templates = readFileSync(resolve(ROOT, "pixiu-lms-portal/src/lib/templates.ts"), "utf8").toLowerCase();
  const lessons = readFileSync(resolve(ROOT, "pixiu-lms-portal/src/lib/lesson-engine.ts"), "utf8").toLowerCase();
  for (const word of ["simulation abstraction only", "flyback diode", "mosfet"]) assert.ok(templates.includes(word), word);
  for (const word of ["about 480 ma", "brightness at 64", "external 5v supply", "common ground", "simulator abstraction"]) assert.ok(lessons.includes(word), word);
});
