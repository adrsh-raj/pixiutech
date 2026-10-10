#!/usr/bin/env node

/**
 * Phase 2.5 artifact synchronizer.
 *
 * Default mode is a dry run. It rebuilds diagnosis/Blockly candidates in memory,
 * verifies stable IDs and existing split membership, and reports the proposed
 * update without writing any files.
 *
 * --write explicitly applies only these candidate files and updates the
 * corresponding existing rows in each split without reassigning any record.
 * It then regenerates the release/manifest reports so hashes cannot silently
 * remain stale. Release status may correctly remain FAILED until human review.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, getBundledModules } from "./bundle-helper.mjs";
import { generateDiagnosisAndCode } from "./generate-diagnosis-and-code.mjs";
import { buildReleaseReport } from "./build-release-report.mjs";
import { stableStringify } from "./normalize-record.mjs";

const __filename = fileURLToPath(import.meta.url);
const DATA_DIR = resolve(ROOT, "data/ai-copilot/phase2");
const RECORDS_DIR = resolve(DATA_DIR, "records");
const SPLITS_DIR = resolve(DATA_DIR, "splits");

function readJsonl(path) {
  const content = readFileSync(path, "utf8");
  if (!content.trim()) return [];
  return content.trim().split("\n").map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error("Invalid JSONL at " + path + ":" + (index + 1) + ": " + error.message);
    }
  });
}

function jsonl(records) {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
}

function uniqueById(records, label) {
  const map = new Map();
  for (const record of records) {
    if (!record || typeof record.record_id !== "string" || !record.record_id.trim()) {
      throw new Error(label + " contains a record without a stable record_id");
    }
    if (map.has(record.record_id)) throw new Error(label + " contains duplicate record_id " + record.record_id);
    map.set(record.record_id, record);
  }
  return map;
}

/**
 * Prepare a safe in-memory plan. Existing split assignment and all non-Phase-2.5
 * rows must remain identical; every Phase 2.5 record must appear exactly once.
 */
export function planPhase25Sync({
  currentDiagnosisRecords,
  currentBlocklyRecords,
  candidateDiagnosisRecords,
  candidateBlocklyRecords,
  splits,
}) {
  const currentDiagnosis = uniqueById(currentDiagnosisRecords, "Stored diagnosis records");
  const currentBlockly = uniqueById(currentBlocklyRecords, "Stored Blockly records");
  const candidateDiagnosis = uniqueById(candidateDiagnosisRecords, "Candidate diagnosis records");
  const candidateBlockly = uniqueById(candidateBlocklyRecords, "Candidate Blockly records");

  const assertSameIds = (current, candidate, label) => {
    const a = [...current.keys()].sort();
    const b = [...candidate.keys()].sort();
    if (stableStringify(a) !== stableStringify(b)) {
      const currentSet = new Set(a), candidateSet = new Set(b);
      throw new Error(label + " ID set changed; refusing implicit row additions/removals. Missing candidates: " +
        a.filter((id) => !candidateSet.has(id)).slice(0, 10).join(", ") +
        "; new candidates: " + b.filter((id) => !currentSet.has(id)).slice(0, 10).join(", "));
    }
  };
  assertSameIds(currentDiagnosis, candidateDiagnosis, "Diagnosis");
  assertSameIds(currentBlockly, candidateBlockly, "Blockly");

  const candidateById = new Map([...candidateDiagnosis, ...candidateBlockly]);
  const seenSplitIds = new Map();
  const plannedSplits = {};
  for (const splitName of ["train", "validation", "test"]) {
    const rows = splits[splitName];
    if (!Array.isArray(rows)) throw new Error("Missing split array: " + splitName);
    plannedSplits[splitName] = rows.map((record) => {
      const id = record?.record_id;
      if (record?.task_type === "diagnosis_explanation" || record?.task_type === "blockly_code") {
        const candidate = candidateById.get(id);
        const stored = (record.task_type === "diagnosis_explanation" ? currentDiagnosis : currentBlockly).get(id);
        if (!candidate || !stored) {
          throw new Error("Split " + splitName + " has an orphan Phase 2.5 record not present in the stored/candidate files: " + id);
        }
        if (stored.task_type !== record.task_type || stableStringify(stored) !== stableStringify(record)) {
          throw new Error("Split " + splitName + " row " + id + " differs from its source task record; refusing to overwrite a divergent row");
        }
        const locations = seenSplitIds.get(id) || [];
        locations.push(splitName);
        seenSplitIds.set(id, locations);
        return candidate;
      }
      return record;
    });
  }

  const assignmentErrors = [];
  for (const id of candidateById.keys()) {
    const locations = seenSplitIds.get(id) || [];
    if (locations.length !== 1) assignmentErrors.push({ record_id: id, locations });
  }
  if (assignmentErrors.length) {
    throw new Error("Every Phase 2.5 record must appear in exactly one existing split. First errors: " +
      stableStringify(assignmentErrors.slice(0, 10)));
  }

  const changed = (current, candidate) =>
    [...candidate].filter(([id, next]) => stableStringify(current.get(id)) !== stableStringify(next)).length;
  const changedSplitRows = {};
  for (const splitName of ["train", "validation", "test"]) {
    const old = splits[splitName], next = plannedSplits[splitName];
    changedSplitRows[splitName] = next.reduce((total, record, index) =>
      total + (stableStringify(record) === stableStringify(old[index]) ? 0 : 1), 0);
    if (old.length !== next.length ||
        stableStringify(old.map((record) => record.record_id)) !== stableStringify(next.map((record) => record.record_id))) {
      throw new Error("Split " + splitName + " record IDs/order changed during plan construction");
    }
  }

  return {
    currentDiagnosisRecords,
    currentBlocklyRecords,
    candidateDiagnosisRecords,
    candidateBlocklyRecords,
    plannedSplits,
    metrics: {
      diagnosis_total: candidateDiagnosis.size,
      diagnosis_changed: changed(currentDiagnosis, candidateDiagnosis),
      blockly_total: candidateBlockly.size,
      blockly_changed: changed(currentBlockly, candidateBlockly),
      split_counts: Object.fromEntries(Object.entries(splits).map(([name, rows]) => [name, rows.length])),
      split_rows_to_update: changedSplitRows,
      split_assignments_changed: 0,
      non_phase25_rows_changed: 0,
    },
  };
}

export async function syncPhase25Artifacts({ write = false } = {}) {
  const modules = await getBundledModules();
  const canonicalRecords = readJsonl(resolve(RECORDS_DIR, "canonical.jsonl"));
  const currentDiagnosisRecords = readJsonl(resolve(RECORDS_DIR, "diagnosis-explanations.jsonl"));
  const currentBlocklyRecords = readJsonl(resolve(RECORDS_DIR, "blockly-code.jsonl"));
  const splits = {
    train: readJsonl(resolve(SPLITS_DIR, "train.jsonl")),
    validation: readJsonl(resolve(SPLITS_DIR, "validation.jsonl")),
    test: readJsonl(resolve(SPLITS_DIR, "test.jsonl")),
  };

  const generated = await generateDiagnosisAndCode({ canonicalRecords, modules, writeArtifacts: false });
  const plan = planPhase25Sync({
    currentDiagnosisRecords,
    currentBlocklyRecords,
    candidateDiagnosisRecords: generated.diagnosisRecords,
    candidateBlocklyRecords: generated.blocklyRecords,
    splits,
  });

  console.log("Phase 2.5 artifact sync preflight:");
  console.log(JSON.stringify(plan.metrics, null, 2));
  console.log("Audit warnings: " + JSON.stringify(generated.taskAudit.warnings || []));
  if (!write) {
    console.log("DRY RUN ONLY: no records, split files, manifests, or reports were changed.");
    console.log("Review the proposed counts, then use --write only when corpus/split updates are approved.");
    return { wrote: false, plan };
  }

  const targets = [
    [resolve(RECORDS_DIR, "diagnosis-explanations.jsonl"), jsonl(plan.candidateDiagnosisRecords)],
    [resolve(RECORDS_DIR, "blockly-code.jsonl"), jsonl(plan.candidateBlocklyRecords)],
    [resolve(SPLITS_DIR, "train.jsonl"), jsonl(plan.plannedSplits.train)],
    [resolve(SPLITS_DIR, "validation.jsonl"), jsonl(plan.plannedSplits.validation)],
    [resolve(SPLITS_DIR, "test.jsonl"), jsonl(plan.plannedSplits.test)],
  ];
  const reportPaths = [
    resolve(DATA_DIR, "manifest.json"),
    resolve(DATA_DIR, "README.md"),
    resolve(DATA_DIR, "reports/validation-report.json"),
    resolve(DATA_DIR, "reports/release-summary.md"),
    resolve(DATA_DIR, "reports/diagnosis-blockly-audit.json"),
    resolve(DATA_DIR, "reports/review-queue.json"),
  ];
  const backups = [...targets.map(([path]) => path), ...reportPaths].map((path) => [
    path,
    existsSync(path) ? readFileSync(path, "utf8") : null,
  ]);
  try {
    for (const [path, content] of targets) writeFileSync(path, content, "utf8");
    const release = await buildReleaseReport();
    console.log("Phase 2.5 records were synchronized while preserving existing split membership.");
    console.log("Release report regenerated. Overall release gates passed: " + release.allGatesPassed);
    if (!release.allGatesPassed) {
      console.log("Some overall release gates remain blocked; inspect reports/validation-report.json, especially human review.");
    }
    return { wrote: true, plan, release };
  } catch (error) {
    for (const [path, content] of backups) {
      if (content === null) {
        if (existsSync(path)) unlinkSync(path);
      } else {
        writeFileSync(path, content, "utf8");
      }
    }
    throw new Error("Phase 2.5 sync failed; original candidate/split and release-report files were restored. Cause: " + (error?.message || error));
  }
}

if (process.argv[1] === __filename) {
  syncPhase25Artifacts({ write: process.argv.includes("--write") }).catch((error) => {
    console.error("Phase 2.5 artifact sync failed:", error);
    process.exit(1);
  });
}
