#!/usr/bin/env node
/**
 * Guarded Phase 2 integrity migration. Dry-run by default; --write applies only
 * after ID/split/family/board/topology preflight. Existing IDs, split assignment,
 * order and counts remain fixed. Task artifacts are authoritative because the
 * split-by-family generator materializes them into existing partition files.
 * Fault rows that fail the live calibration are replaced only with a distinct,
 * calibrated current-generator candidate from the exact same canonical parent.
 * Reports are rebuilt and all writes roll back unless G4/G8 pass. G9 is untouched.
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, getBundledModules } from "./bundle-helper.mjs";
import { evaluateFaultCalibration, generateFaultRepairPairs } from "./generate-fault-repair-pairs.mjs";
import { buildReleaseReport } from "./build-release-report.mjs";
import { stableStringify } from "./normalize-record.mjs";
import { expectedCanonicalContentHash, expectedContentHash, withExpectedCanonicalContentHash, withExpectedContentHash } from "./content-hash.mjs";

const __filename = fileURLToPath(import.meta.url);
const DATA_DIR = resolve(ROOT, "data/ai-copilot/phase2");
const RECORDS_DIR = resolve(DATA_DIR, "records");
const SPLITS_DIR = resolve(DATA_DIR, "splits");
const REPORTS_DIR = resolve(DATA_DIR, "reports");
const SPLIT_NAMES = ["train", "validation", "test"];
const RECORD_FILES = {
  canonical: "canonical.jsonl", requests: "requests.jsonl", faultRepairs: "fault-repairs.jsonl",
  diagnosisExplanations: "diagnosis-explanations.jsonl", blocklyCode: "blockly-code.jsonl",
};
const TASK_KEYS = ["requests", "faultRepairs", "diagnosisExplanations", "blocklyCode"];
const REPORT_OUTPUTS = [
  resolve(REPORTS_DIR, "diagnosis-blockly-audit.json"), resolve(REPORTS_DIR, "review-queue.json"),
  resolve(REPORTS_DIR, "validation-report.json"), resolve(REPORTS_DIR, "release-summary.md"),
  resolve(DATA_DIR, "manifest.json"), resolve(DATA_DIR, "README.md"),
];
function readJsonl(path) {
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return [];
  return raw.trim().split(/\r?\n/).map((line, i) => {
    try { return JSON.parse(line); } catch (e) { throw new Error("Invalid JSONL at " + path + ":" + (i + 1) + ": " + e.message); }
  });
}
function encodeJsonl(rows) { return rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function withoutContentHash(record) {
  const copy = clone(record);
  if (copy.hashes && typeof copy.hashes === "object") delete copy.hashes.content_hash;
  return copy;
}
function uniqueById(rows, label) {
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row.record_id !== "string" || !row.record_id.trim()) throw new Error(label + " contains a row without record_id");
    if (map.has(row.record_id)) throw new Error(label + " contains duplicate record_id " + row.record_id);
    map.set(row.record_id, row);
  }
  return map;
}
function ruleFamily(id) {
  for (const [prefix, name] of [
    ["wiring-missing-ground-return-", "ground"], ["safety-led-burnout-", "led"],
    ["identity-unknown-pin-", "pin"], ["safety-direct-power-short-", "power"],
  ]) if (String(id || "").startsWith(prefix)) return name;
  return String(id || "");
}
function duplicatesCandidate(candidate, existing) {
  return existing.some((r) => r.variant?.parent_record_id === candidate.variant?.parent_record_id &&
    stableStringify(r.fault?.input_circuit) === stableStringify(candidate.fault?.input_circuit) &&
    stableStringify(r.fault?.expected_rule_ids) === stableStringify(candidate.fault?.expected_rule_ids));
}

/** Pure planner covered by tests; validateFaultRecord must use the live validator. */
export function planPhase2IntegrityRepair({ records, splits, candidateFaultRecords, validateFaultRecord }) {
  const nextRecords = clone(records);
  const nextSplits = clone(splits);
  const sourceRows = () => TASK_KEYS.flatMap((key) => nextRecords[key]);
  const sourceById = uniqueById(sourceRows(), "Source task artifacts");
  const canonicalById = uniqueById(nextRecords.canonical, "Canonical records");
  const splitById = new Map();
  const idsBefore = {};
  const assignmentsBefore = {};
  for (const name of SPLIT_NAMES) {
    if (!Array.isArray(nextSplits[name])) throw new Error("Missing split " + name);
    idsBefore[name] = nextSplits[name].map((row) => row.record_id);
    for (const row of nextSplits[name]) {
      if (splitById.has(row.record_id)) throw new Error("Duplicate record across splits: " + row.record_id);
      splitById.set(row.record_id, { name, row });
      assignmentsBefore[row.record_id] = name;
    }
  }
  const missing = [...sourceById.keys()].filter((id) => !splitById.has(id));
  const orphaned = [...splitById.keys()].filter((id) => !sourceById.has(id));
  if (missing.length || orphaned.length) throw new Error(
    "Source/split IDs do not reconcile. Missing from splits: " + missing.slice(0, 10).join(", ") +
    "; orphaned split IDs: " + orphaned.slice(0, 10).join(", "));

  const sourceSplitDivergences = [];
  for (const [id, source] of sourceById) {
    const split = splitById.get(id).row;
    if (source.task_type !== split.task_type || source.project_family_id !== split.project_family_id ||
        source.context?.target_board !== split.context?.target_board ||
        source.hashes?.topology_hash !== split.hashes?.topology_hash) {
      throw new Error("Source/split task, family, board or topology invariant differs for " + id + "; refusing to guess.");
    }
    if (stableStringify(withoutContentHash(source)) !== stableStringify(withoutContentHash(split))) sourceSplitDivergences.push(id);
  }

  const failures = nextRecords.faultRepairs.map((record) => ({ record, calibration: validateFaultRecord(record) }))
    .filter((entry) => !entry.calibration?.passed);
  const failedIds = new Set(failures.map((entry) => entry.record.record_id));
  const passingExisting = nextRecords.faultRepairs.filter((row) => !failedIds.has(row.record_id));
  const candidates = [...uniqueById(candidateFaultRecords, "Generated calibrated candidates").values()];
  const selectedKeys = new Set();
  const replacements = [];
  for (const failure of failures) {
    const stored = failure.record;
    const parentId = stored.variant?.parent_record_id;
    const parent = canonicalById.get(parentId);
    if (!parent) throw new Error("Fault " + stored.record_id + " has no exact canonical parent; refusing to guess.");
    if (parent.project_family_id !== stored.project_family_id ||
        parent.context?.target_board !== stored.context?.target_board ||
        parent.hashes?.topology_hash !== stored.hashes?.topology_hash) {
      throw new Error("Fault/canonical family, board or topology invariant differs for " + stored.record_id);
    }
    const oldFamilies = new Set((stored.fault?.expected_rule_ids || []).map(ruleFamily));
    const available = candidates.filter((candidate) => {
      const key = parentId + "\u0000" + candidate.fault?.mutation_id;
      return !selectedKeys.has(key) && candidate.variant?.parent_record_id === parentId &&
        candidate.project_family_id === stored.project_family_id &&
        candidate.context?.target_board === stored.context?.target_board &&
        candidate.hashes?.topology_hash === stored.hashes?.topology_hash &&
        !duplicatesCandidate(candidate, passingExisting) && validateFaultRecord(candidate)?.passed === true;
    }).sort((a, b) => {
      const rank = (c) => (c.fault?.expected_rule_ids || []).some((id) => oldFamilies.has(ruleFamily(id))) ? 0 : 1;
      return rank(a) - rank(b) || String(a.fault?.mutation_id || "").localeCompare(String(b.fault?.mutation_id || "")) ||
        a.record_id.localeCompare(b.record_id);
    });
    const candidate = available[0];
    if (!candidate) throw new Error("No distinct calibrated replacement exists for " + stored.record_id +
      " under exact parent/family/board/topology. No data was written.");
    selectedKeys.add(parentId + "\u0000" + candidate.fault.mutation_id);
    const replacement = { ...clone(candidate), record_id: stored.record_id };
    const index = nextRecords.faultRepairs.findIndex((row) => row.record_id === stored.record_id);
    nextRecords.faultRepairs[index] = replacement;
    replacements.push({
      record_id: stored.record_id, split: splitById.get(stored.record_id).name, parent_record_id: parentId,
      old_mutation_id: stored.fault?.mutation_id || null, new_mutation_id: replacement.fault?.mutation_id || null,
      old_expected_rule_ids: stored.fault?.expected_rule_ids || [],
      new_expected_rule_ids: replacement.fault?.expected_rule_ids || [],
      old_actual_rule_ids: failure.calibration.actualRuleIds || [],
      replacement_calibrated: validateFaultRecord(replacement).passed === true,
    });
  }

  const releasedBefore = [...splits.train, ...splits.validation, ...splits.test];
  const oldTaskRows = TASK_KEYS.flatMap((key) => records[key]);
  const hashFailuresBefore = {
    task_artifacts: oldTaskRows.filter((r) => expectedContentHash(r) !== r.hashes?.content_hash).length,
    split_rows: releasedBefore.filter((r) => expectedContentHash(r) !== r.hashes?.content_hash).length,
    canonical: records.canonical.filter((r) => expectedCanonicalContentHash(r) !== r.hashes?.content_hash).length,
  };
  nextRecords.canonical = nextRecords.canonical.map(withExpectedCanonicalContentHash);
  for (const key of TASK_KEYS) nextRecords[key] = nextRecords[key].map(withExpectedContentHash);
  const updatedById = uniqueById(sourceRows(), "Repaired source task artifacts");
  for (const name of SPLIT_NAMES) {
    // Refresh copies from source artifacts in-place; this is not a repartition.
    nextSplits[name] = nextSplits[name].map((oldRow) => clone(updatedById.get(oldRow.record_id)));
  }
  const countsBefore = Object.fromEntries(SPLIT_NAMES.map((name) => [name, splits[name].length]));
  const countsAfter = Object.fromEntries(SPLIT_NAMES.map((name) => [name, nextSplits[name].length]));
  const orderPreserved = SPLIT_NAMES.every((name) =>
    stableStringify(idsBefore[name]) === stableStringify(nextSplits[name].map((row) => row.record_id)));
  const assignmentsAfter = {};
  for (const name of SPLIT_NAMES) for (const row of nextSplits[name]) assignmentsAfter[row.record_id] = name;
  const assignmentChanges = Object.keys(assignmentsBefore).filter((id) => assignmentsAfter[id] !== assignmentsBefore[id]);
  if (!orderPreserved || assignmentChanges.length || stableStringify(countsBefore) !== stableStringify(countsAfter)) {
    throw new Error("Plan would change split order, membership or counts; refusing to continue.");
  }
  const hashUpdates = {
    task_records: sourceRows().filter((r) => r.hashes?.content_hash !== sourceById.get(r.record_id)?.hashes?.content_hash).length,
    canonical_records: nextRecords.canonical.filter((r, i) =>
      r.hashes?.content_hash !== records.canonical[i]?.hashes?.content_hash).length,
  };
  return {
    records: nextRecords, splits: nextSplits,
    summary: {
      released_records: sourceRows().length, canonical_records: nextRecords.canonical.length,
      split_counts_before: countsBefore, split_counts_after: countsAfter, split_order_preserved: orderPreserved,
      split_assignments_changed: assignmentChanges.length,
      source_split_payload_divergences_before: sourceSplitDivergences.length,
      source_split_payload_divergence_ids: sourceSplitDivergences.slice(0, 25),
      pre_repair_hash_mismatches: hashFailuresBefore,
      fault_failures_before: failures.map((e) => ({
        record_id: e.record.record_id, parent_record_id: e.record.variant?.parent_record_id || null,
        mutation_id: e.record.fault?.mutation_id || null, expected_rule_ids: e.record.fault?.expected_rule_ids || [],
        actual_rule_ids: e.calibration.actualRuleIds || [], actual_severities: e.calibration.actualSeverities || [],
      })),
      fault_replacements: replacements,
      content_hash_updates: hashUpdates,
      human_review: "Not changed; independent human review remains required.",
    },
  };
}

function loadRecords() {
  return {
    canonical: readJsonl(resolve(RECORDS_DIR, RECORD_FILES.canonical)),
    requests: readJsonl(resolve(RECORDS_DIR, RECORD_FILES.requests)),
    faultRepairs: readJsonl(resolve(RECORDS_DIR, RECORD_FILES.faultRepairs)),
    diagnosisExplanations: readJsonl(resolve(RECORDS_DIR, RECORD_FILES.diagnosisExplanations)),
    blocklyCode: readJsonl(resolve(RECORDS_DIR, RECORD_FILES.blocklyCode)),
  };
}
function loadSplits() {
  return Object.fromEntries(SPLIT_NAMES.map((name) => [name, readJsonl(resolve(SPLITS_DIR, name + ".jsonl"))]));
}
function mismatchCount(rows, digest) {
  return rows.filter((row) => !digest(row) || digest(row) !== row.hashes?.content_hash).length;
}

async function main() {
  const write = process.argv.includes("--write");
  const records = loadRecords();
  const splits = loadSplits();
  const { validator } = await getBundledModules();
  const validateFaultRecord = (record) => evaluateFaultCalibration(record.fault,
    validator.validateProposedCircuit(record.fault?.input_circuit, {
      allowWarnings: true, targetBoard: record.context?.target_board,
    }));
  const released = [...splits.train, ...splits.validation, ...splits.test];
  const taskRows = TASK_KEYS.flatMap((key) => records[key]);
  const baseline = {
    released_records: released.length, canonical_records: records.canonical.length,
    split_counts: { train: splits.train.length, validation: splits.validation.length, test: splits.test.length },
    fault_calibration_failures: records.faultRepairs.filter((r) => !validateFaultRecord(r).passed).length,
    source_task_hash_mismatches: mismatchCount(taskRows, expectedContentHash),
    released_hash_mismatches: mismatchCount(released, expectedContentHash),
    canonical_hash_mismatches: mismatchCount(records.canonical, expectedCanonicalContentHash),
  };
  const generated = await generateFaultRepairPairs({ writeArtifacts: false, canonicalRecords: records.canonical, minRecords: 50 });
  const plan = planPhase2IntegrityRepair({ records, splits, candidateFaultRecords: generated.faultRecords, validateFaultRecord });
  console.log(JSON.stringify({ mode: write ? "write" : "dry-run", baseline, plan: plan.summary }, null, 2));
  if (!write) {
    console.log("DRY RUN ONLY: no records, split files, reports, manifests or README files were changed.");
    console.log("Apply with: npm run repair:copilot-phase2-integrity -- --write");
    return;
  }

  const paths = [
    ...Object.values(RECORD_FILES).map((file) => resolve(RECORDS_DIR, file)),
    ...SPLIT_NAMES.map((name) => resolve(SPLITS_DIR, name + ".jsonl")), ...REPORT_OUTPUTS,
  ];
  const backup = new Map(paths.map((path) => [path, existsSync(path) ? readFileSync(path, "utf8") : null]));
  try {
    writeFileSync(resolve(RECORDS_DIR, RECORD_FILES.canonical), encodeJsonl(plan.records.canonical), "utf8");
    for (const key of TASK_KEYS) writeFileSync(resolve(RECORDS_DIR, RECORD_FILES[key]), encodeJsonl(plan.records[key]), "utf8");
    for (const name of SPLIT_NAMES) writeFileSync(resolve(SPLITS_DIR, name + ".jsonl"), encodeJsonl(plan.splits[name]), "utf8");
    await buildReleaseReport();
    const report = JSON.parse(readFileSync(resolve(REPORTS_DIR, "validation-report.json"), "utf8"));
    const g4 = report.gates.find((gate) => gate.id === "G4");
    const g8 = report.gates.find((gate) => gate.id === "G8");
    if (!g4?.passed || !g8?.passed) throw new Error("Post-write acceptance failed: G4=" + String(g4?.passed) +
      ", G8=" + String(g8?.passed) + ". Rolling back all data/report writes.");
    console.log("PHASE 2 INTEGRITY MIGRATION APPLIED:");
    console.log(JSON.stringify({
      overall_release_status: report.status, G4: g4.score, G8: g8.score,
      G9: report.gates.find((gate) => gate.id === "G9")?.score || "unknown",
      split_counts: plan.summary.split_counts_after, split_assignments_changed: plan.summary.split_assignments_changed,
    }, null, 2));
    console.log("G9 remains blocked until genuine independent human review is completed.");
  } catch (error) {
    for (const [path, content] of backup) {
      if (content === null) { if (existsSync(path)) unlinkSync(path); }
      else writeFileSync(path, content, "utf8");
    }
    throw error;
  }
}
if (process.argv[1] === __filename) {
  main().catch((error) => { console.error("Phase 2 integrity repair failed safely:", error?.stack || error); process.exit(1); });
}
