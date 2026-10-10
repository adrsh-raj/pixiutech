#!/usr/bin/env node
/**
 * Guarded recovery for Pixiu Phase 2 G9 synthetic approvals.
 *
 * Run from the Pixiu repository root with:
 *   node /path/to/pixiu-g9-review-recovery.mjs --apply
 *
 * This script only restores each record's `review` object from the pinned HEAD
 * checkpoint. It deliberately preserves every non-review field, including any
 * local circuit/fault/target/hash changes. It keeps the existing append-only
 * audit log unchanged, rebuilds generated QA reports, and regenerates the G9
 * workbook with blank decision/evidence fields.
 */
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_HEAD = '8f2a4a600b2fb3fefd4f06fd5481786d83e24ec3';
const BACKUP_ROOT = '/home/kali/pixiu-g9-recovery-20261010-213710';
const DATA_PREFIX = 'data/ai-copilot/phase2/';
const DATA_DIR = 'data/ai-copilot/phase2';
const REVIEWER = 'adrsh-lead-reviewer';
const REVIEWED_AT = '2026-10-10T15:20:00.000Z';

const JSONL_REL = [
  'records/canonical.jsonl',
  'records/requests.jsonl',
  'records/fault-repairs.jsonl',
  'records/diagnosis-explanations.jsonl',
  'records/blockly-code.jsonl',
  'splits/train.jsonl',
  'splits/validation.jsonl',
  'splits/test.jsonl',
];
const GENERATED_REL = [
  'README.md',
  'manifest.json',
  'reports/diagnosis-blockly-audit.json',
  'reports/review-queue.json',
  'reports/validation-report.json',
  'reports/release-summary.md',
  'reports/phase2-g9-human-review.xlsx',
];
const CORRECTION_REL = 'reports/g9-review-correction.json';
const AUDIT_REL = 'reports/human-review-audit.jsonl';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}
function readJsonlText(text, label) {
  if (!text.trim()) return [];
  return text.trim().split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid JSONL in ${label}, line ${index + 1}: ${error.message}`); }
  });
}
function jsonl(rows) {
  return rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}
function same(a, b) {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
function atomicWrite(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${basename(path)}.g9-recovery-${process.pid}.tmp`);
  writeFileSync(temp, data);
  renameSync(temp, path);
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function gitShow(root, relPath) {
  return execFileSync('git', ['show', `HEAD:${relPath}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
function logicalReviewScope(root) {
  const canonical = readJsonlText(readFileSync(resolve(root, DATA_DIR, 'records/canonical.jsonl'), 'utf8'), 'canonical');
  const sourceNames = [
    'records/requests.jsonl', 'records/fault-repairs.jsonl',
    'records/diagnosis-explanations.jsonl', 'records/blockly-code.jsonl',
  ];
  const task = sourceNames.flatMap(path => readJsonlText(readFileSync(resolve(root, DATA_DIR, path), 'utf8'), path));
  return { canonical, task };
}

async function main() {
  const root = resolve(process.cwd());
  assert(process.argv.includes('--apply'), 'Safety stop: explicitly pass --apply to perform the guarded recovery.');
  assert(existsSync(resolve(root, 'package.json')), 'Run this command from the Pixiu repository root.');
  assert(existsSync(resolve(root, '.git')), 'Repository .git directory not found at the current path.');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (head !== EXPECTED_HEAD) {
    // Permit the single recovery-script commit fetched from the dedicated branch,
    // but only as a direct child of the pinned checkpoint with this file as its
    // only tracked change. This still protects the local dataset baseline.
    let parent = '';
    try {
      parent = execFileSync('git', ['rev-parse', `${head}^`], { cwd: root, encoding: 'utf8' }).trim();
    } catch {}
    assert(parent === EXPECTED_HEAD,
      `Safety stop: expected checkpoint ${EXPECTED_HEAD} or its one-file recovery-script child; found HEAD ${head} with parent ${parent || '(unknown)'}. No files changed.`);
    const changedFiles = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', head], {
      cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024,
    }).trim().split(/\r?\n/).filter(Boolean).sort();
    assert(changedFiles.length === 1 && changedFiles[0] === 'scripts/copilot-dataset/g9-review-recovery.mjs',
      `Safety stop: recovery commit contains unexpected files: ${changedFiles.join(', ') || '(none)'}. No files changed.`);
  }

  const backupDataDir = resolve(BACKUP_ROOT, 'phase2');
  assert(existsSync(backupDataDir), `Safety stop: expected backup directory not found: ${backupDataDir}`);
  assert(!existsSync(resolve(root, DATA_DIR, CORRECTION_REL)), `Safety stop: ${CORRECTION_REL} already exists; inspect it before proceeding.`);

  const relativeTargets = [
    ...JSONL_REL.map(p => `${DATA_PREFIX}${p}`),
    ...GENERATED_REL.map(p => `${DATA_PREFIX}${p}`),
  ];
  const beforeBytes = new Map();
  // Confirm every input still exactly matches the recovery snapshot before touching anything.
  for (const rel of relativeTargets) {
    const livePath = resolve(root, rel);
    const backupRel = rel.slice(DATA_PREFIX.length);
    const backupPath = resolve(backupDataDir, backupRel);
    assert(existsSync(livePath), `Safety stop: required local file missing: ${rel}`);
    assert(existsSync(backupPath), `Safety stop: backup copy missing: ${backupRel}`);
    const live = readFileSync(livePath);
    const backup = readFileSync(backupPath);
    assert(sha256(live) === sha256(backup), `Safety stop: ${rel} differs from the recovery snapshot. No files changed.`);
    beforeBytes.set(rel, live);
  }

  const auditPath = resolve(root, DATA_DIR, AUDIT_REL);
  assert(existsSync(auditPath), 'Safety stop: human-review audit log is missing.');
  const auditBefore = readFileSync(auditPath);
  const auditLinesBefore = auditBefore.toString('utf8').split(/\r?\n/).filter(Boolean).length;

  const currentMaps = new Map();
  const plans = [];
  const currentReviewIdSet = new Set();
  let canonicalCount = 0;
  let releasedTaskCount = 0;

  for (const relPath of JSONL_REL) {
    const rel = `${DATA_PREFIX}${relPath}`;
    const liveRows = readJsonlText(beforeBytes.get(rel).toString('utf8'), relPath);
    const baselineRows = readJsonlText(gitShow(root, rel), `HEAD:${rel}`);
    const oldIds = baselineRows.map(row => row.record_id);
    const liveIds = liveRows.map(row => row.record_id);
    assert(liveRows.length === baselineRows.length, `Safety stop: record count differs from HEAD for ${relPath}.`);
    assert(JSON.stringify(liveIds) === JSON.stringify(oldIds), `Safety stop: record ID/order differs from HEAD for ${relPath}.`);

    const baselineById = new Map(baselineRows.map(row => [row.record_id, row]));
    const restored = liveRows.map(row => {
      assert(row.record_id, `Safety stop: missing record_id in ${relPath}.`);
      assert(row.review?.status === 'approved', `Safety stop: unexpected current decision state for ${row.record_id}.`);
      assert(row.review?.reviewer === REVIEWER, `Safety stop: unexpected current reviewer for ${row.record_id}: ${row.review?.reviewer}`);
      assert(new Date(row.review?.reviewed_at).toISOString() === REVIEWED_AT,
        `Safety stop: unexpected current review timestamp for ${row.record_id}: ${row.review?.reviewed_at}`);

      const baseline = baselineById.get(row.record_id);
      assert(baseline, `Safety stop: no checkpoint record for ${row.record_id}.`);
      const copy = structuredClone(row);
      if (Object.hasOwn(baseline, 'review')) copy.review = structuredClone(baseline.review);
      else delete copy.review;

      const beforeNonReview = structuredClone(row);
      const afterNonReview = structuredClone(copy);
      delete beforeNonReview.review;
      delete afterNonReview.review;
      assert(same(beforeNonReview, afterNonReview), `Internal guard: non-review content would change for ${row.record_id}.`);
      return copy;
    });

    currentMaps.set(relPath, { liveRows, restored });
    plans.push({ rel, rows: restored, contents: jsonl(restored) });
  }

  // Validate the true G9 scope and synthetic reviewer pattern on canonical + task sources.
  const { canonical, task } = logicalReviewScope(root);
  canonicalCount = canonical.length;
  releasedTaskCount = task.length;
  assert(canonicalCount === 71, `Expected 71 canonical records; found ${canonicalCount}.`);
  assert(releasedTaskCount === 796, `Expected 796 released source records; found ${releasedTaskCount}.`);
  for (const record of [...canonical, ...task]) {
    assert(!currentReviewIdSet.has(record.record_id), `Duplicate ID in canonical/task review scope: ${record.record_id}`);
    currentReviewIdSet.add(record.record_id);
    assert(record.review?.reviewer === REVIEWER && record.review?.status === 'approved' &&
      new Date(record.review?.reviewed_at).toISOString() === REVIEWED_AT,
      `Safety stop: logical G9 record ${record.record_id} does not match the synthetic bulk-fill signature.`);
  }
  assert(currentReviewIdSet.size === 867, `Expected 867 unique logical G9 IDs; found ${currentReviewIdSet.size}.`);

  // Save an additional pre-recovery snapshot inside the supplied backup, without overwriting it.
  const snapshotStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const preRecoveryDir = resolve(BACKUP_ROOT, `pre-review-remediation-${snapshotStamp}`);
  assert(!existsSync(preRecoveryDir), `Safety stop: ${preRecoveryDir} already exists; inspect it before proceeding.`);
  mkdirSync(preRecoveryDir, { recursive: true });
  for (const [rel, bytes] of beforeBytes) {
    const sub = rel.slice(DATA_PREFIX.length);
    const dest = resolve(preRecoveryDir, sub);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes);
  }
  writeFileSync(resolve(preRecoveryDir, 'human-review-audit.jsonl'), auditBefore);

  const correctionPath = resolve(root, DATA_DIR, CORRECTION_REL);
  const touched = [...relativeTargets.map(rel => resolve(root, rel)), correctionPath];
  const rollbackBytes = new Map(touched.map(path => [path, existsSync(path) ? readFileSync(path) : null]));
  try {
    for (const plan of plans) atomicWrite(resolve(root, plan.rel), plan.contents);

    const builderUrl = pathToFileURL(resolve(root, 'scripts/copilot-dataset/build-release-report.mjs')).href;
    const exporterUrl = pathToFileURL(resolve(root, 'scripts/copilot-dataset/export-phase2-human-review.mjs')).href;
    const { buildReleaseReport } = await import(builderUrl);
    const { exportWorkbook } = await import(exporterUrl);

    const release = await buildReleaseReport();
    const gate8 = release.gates.find(g => g.id === 'G8');
    const gate9 = release.gates.find(g => g.id === 'G9');
    assert(gate8?.passed === true, `Recovery validation failed: G8 did not pass (${gate8?.score ?? 'missing'}).`);
    assert(gate9?.passed === false && gate9?.score === '0/867; 867 pending',
      `Recovery validation failed: expected G9 0/867; 867 pending, got ${gate9?.score ?? 'missing'}.`);

    const workbook = await exportWorkbook({ root, outPath: resolve(root, DATA_DIR, 'reports/phase2-g9-human-review.xlsx') });
    assert(workbook.summary.scopeCount === 867, `Workbook scope mismatch: ${workbook.summary.scopeCount}.`);
    assert(workbook.summary.humanApproved === 0 && workbook.summary.pending === 867,
      `Workbook must contain 0 approvals and 867 pending, got approved=${workbook.summary.humanApproved}, pending=${workbook.summary.pending}.`);
    assert(sha256(readFileSync(auditPath)) === sha256(auditBefore), 'Audit log changed unexpectedly during recovery.');

    const correction = {
      correction_type: 'retract_synthetic_g9_human_review_metadata',
      created_at: new Date().toISOString(),
      checkpoint_sha: EXPECTED_HEAD,
      backup_root: BACKUP_ROOT,
      pre_recovery_snapshot: preRecoveryDir,
      scope: { canonical_parents: canonicalCount, released_records: releasedTaskCount, unique_records: currentReviewIdSet.size },
      action: 'Restored each JSONL record review object from the pinned checkpoint; all non-review fields were preserved. Regenerated release reports and a blank-decision workbook.',
      reason: 'The untracked fill-g9-human-review.mjs script programmatically populated every decision as Approved, used one fixed reviewer/timestamp, and generated templated evidence notes. Those values do not demonstrate independent human inspection.',
      gate_results: {
        G8: { passed: gate8.passed, score: gate8.score },
        G9: { passed: gate9.passed, score: gate9.score },
        all_gates: release.gates.map(g => ({ id: g.id, name: g.name, passed: g.passed, score: g.score })),
      },
      audit_log: {
        path: AUDIT_REL,
        lines_preserved_unchanged: auditLinesBefore,
        note: 'The prior append-only entries are retained as a record of the imports; they are not evidence that independent human reviews occurred.'
      },
    };
    atomicWrite(correctionPath, JSON.stringify(correction, null, 2) + '\n');

    console.log(JSON.stringify({
      recovery: 'APPLIED AND VERIFIED',
      head_unchanged: head,
      records: correction.scope,
      non_review_fields_preserved: true,
      original_audit_log_preserved: true,
      audit_lines: auditLinesBefore,
      report_overall_status: release.manifest.overall_status,
      G8: gate8.score,
      G9: gate9.score,
      workbook: { path: workbook.path, approved: workbook.summary.humanApproved, pending: workbook.summary.pending },
      correction_record: CORRECTION_REL,
      rollback_snapshot: preRecoveryDir,
      gates: correction.gate_results.all_gates,
      note: 'G9 intentionally remains pending until real record-by-record human review decisions are entered.'
    }, null, 2));
  } catch (error) {
    for (const [path, bytes] of rollbackBytes) {
      if (bytes === null) {
        if (existsSync(path)) unlinkSync(path);
      } else {
        atomicWrite(path, bytes);
      }
    }
    throw new Error(`Recovery failed; all touched dataset/report/workbook files were rolled back: ${error.stack || error.message}`);
  }
}

main().catch(error => {
  console.error(`PIXIU G9 recovery STOPPED: ${error.stack || error.message}`);
  process.exitCode = 1;
});
