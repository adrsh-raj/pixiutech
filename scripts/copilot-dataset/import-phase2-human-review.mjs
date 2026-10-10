#!/usr/bin/env node
/** Guarded, audit-logged import of real human decisions from the G9 workbook. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stableStringify } from './normalize-record.mjs';
import { expectedContentHash } from './content-hash.mjs';
import { isAutomatedReviewer, isHumanApprovedRecord } from './review-policy.mjs';
import { readReviewQueueSheet, parseCsv } from './xlsx-lite.mjs';
import { buildReleaseReport } from './build-release-report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE_MAP = { canonical: 'canonical.jsonl', request_to_circuit: 'requests.jsonl', fault_repair: 'fault-repairs.jsonl', diagnosis_explanation: 'diagnosis-explanations.jsonl', blockly_code: 'blockly-code.jsonl' };
const SPLIT_NAMES = ['train', 'validation', 'test'];
const REPORT_OUTPUTS = ['reports/diagnosis-blockly-audit.json', 'reports/review-queue.json', 'reports/validation-report.json', 'reports/release-summary.md', 'manifest.json', 'README.md'];
function readJsonl(path) {
  const raw = readFileSync(path, 'utf8');
  if (!raw.trim()) return [];
  return raw.trim().split(/\r?\n/).map((line, index) => { try { return JSON.parse(line); } catch (error) { throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`); } });
}
function jsonl(rows) { return rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''); }
function humanFingerprint(record) { const copy = structuredClone(record); delete copy.review; return createHash('sha256').update(stableStringify(copy), 'utf8').digest('hex'); }
function parseCsvObjects(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error('The CSV contains no header row.');
  const headers = rows[0].map((h, i) => (i === 0 ? String(h).replace(/^\uFEFF/, '') : String(h)).trim());
  return rows.slice(1).filter(row => row.some(value => String(value ?? '').trim() !== '')).map((row, rowIndex) => {
    const item = {}; headers.forEach((header, i) => { if (header) item[header] = row[i] ?? ''; }); item.__row_number = rowIndex + 2; return item;
  });
}
function getDecisions(inputPath) {
  const ext = inputPath.toLowerCase().split('.').pop();
  if (ext === 'xlsx') {
    const rows = readReviewQueueSheet(readFileSync(inputPath));
    if (!rows.length) throw new Error('The Review Queue worksheet is empty.');
    const headers = rows[0].map(h => String(h ?? '').replace(/^\uFEFF/, '').trim());
    return rows.slice(1).filter(row => row.some(value => String(value ?? '').trim() !== '')).map((row, index) => {
      const item = {}; headers.forEach((header, i) => { if (header) item[header] = row[i] ?? ''; }); item.__row_number = index + 2; return item;
    });
  }
  if (ext === 'csv') return parseCsvObjects(readFileSync(inputPath, 'utf8'));
  throw new Error('Input must be the exported .xlsx workbook or a CSV exported from its Review Queue sheet.');
}
function requiredText(value, label, rowNumber) {
  const text = String(value ?? '').trim(); if (!text) throw new Error(`Row ${rowNumber}: ${label} is required.`); return text;
}
function parseReviewTimestamp(value, rowNumber) {
  const timestamp = requiredText(value, 'Reviewed At UTC', rowNumber);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error(`Row ${rowNumber}: Reviewed At UTC must be ISO 8601 with timezone, e.g. 2026-10-10T14:30:00Z.`);
  return new Date(timestamp).toISOString();
}
function decisionStatus(value, rowNumber) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'approved') return { decision: 'Approved', status: 'approved' };
  if (normalized === 'rejected') return { decision: 'Rejected', status: 'rejected' };
  if (normalized === 'needs correction') return { decision: 'Needs correction', status: 'in_review' };
  if (normalized === 'in review') return { decision: 'In review', status: 'in_review' };
  throw new Error(`Row ${rowNumber}: unknown Human Decision '${value}'. Use Approved, Rejected, Needs correction, or In review.`);
}
function validateSplitIntegrity(originalSplits, updatedSplits, sourceById) {
  for (const name of SPLIT_NAMES) {
    const original = originalSplits[name], updated = updatedSplits[name];
    if (original.length !== updated.length) throw new Error(`Guard failed: ${name} split record count would change.`);
    for (let i = 0; i < original.length; i++) {
      const before = original[i], after = updated[i], source = sourceById.get(before.record_id);
      if (before.record_id !== after.record_id) throw new Error(`Guard failed: ${name} split order/ID would change at row ${i + 1}.`);
      if (!source || source.project_family_id !== after.project_family_id || source.context?.target_board !== after.context?.target_board || source.hashes?.topology_hash !== after.hashes?.topology_hash) throw new Error(`Guard failed: family/board/topology mismatch for ${after.record_id}.`);
      if ((expectedContentHash(source) || '') !== (after.hashes?.content_hash || '')) throw new Error(`Guard failed: content hash diverges for ${after.record_id}.`);
    }
  }
}
function parseArgs(args) {
  const fileIndex = args.indexOf('--file');
  if (fileIndex < 0 || !args[fileIndex + 1]) throw new Error('Provide --file path/to/review-workbook.xlsx.');
  return { filePath: resolve(args[fileIndex + 1]), write: args.includes('--write') };
}

export function planHumanReviewImport({ decisions, canonical, taskRecords, splitRecords }) {
  const sourceMap = new Map(), locationMap = new Map();
  for (const [key, rows] of Object.entries({ canonical, ...taskRecords })) for (const record of rows) {
    if (!record?.record_id || sourceMap.has(record.record_id)) throw new Error(`Missing or duplicate record ID in source files: ${record?.record_id}`);
    sourceMap.set(record.record_id, record); locationMap.set(record.record_id, key);
  }
  const splitById = new Map();
  for (const split of SPLIT_NAMES) for (const record of splitRecords[split]) {
    if (splitById.has(record.record_id)) throw new Error(`Duplicate ID across splits: ${record.record_id}`); splitById.set(record.record_id, split);
  }
  const submitted = [], seen = new Set();
  for (const row of decisions) {
    const rawDecision = String(row['Human Decision'] ?? '').trim(); if (!rawDecision) continue;
    const rowNumber = row.__row_number ?? '?', id = requiredText(row['Record ID'], 'Record ID', rowNumber);
    if (seen.has(id)) throw new Error(`Row ${rowNumber}: duplicate submitted decision for ${id}.`); seen.add(id);
    const current = sourceMap.get(id); if (!current) throw new Error(`Row ${rowNumber}: unknown Record ID ${id}; no changes written.`);
    if (String(row['Content Fingerprint (do not edit)'] ?? '').trim() !== humanFingerprint(current)) throw new Error(`Row ${rowNumber}: stale content fingerprint for ${id}. Re-export the workbook after data changes.`);
    const scope = locationMap.get(id) === 'canonical' ? 'canonical_parent' : 'released_record';
    if (String(row['Record Scope'] ?? '').trim() !== scope) throw new Error(`Row ${rowNumber}: scope does not match current record ${id}.`);
    const split = scope === 'canonical_parent' ? 'canonical' : splitById.get(id);
    if (String(row.Split ?? '').trim() !== split) throw new Error(`Row ${rowNumber}: split assignment mismatch for ${id}.`);
    const decision = decisionStatus(rawDecision, rowNumber);
    const reviewer = requiredText(row['Reviewer ID'], 'Reviewer ID', rowNumber);
    if (isAutomatedReviewer(reviewer)) throw new Error(`Row ${rowNumber}: '${reviewer}' is an automated reviewer label, not an independent human reviewer.`);
    const reviewedAt = parseReviewTimestamp(row['Reviewed At UTC'], rowNumber);
    const evidence = requiredText(row['Evidence / Findings Notes'], 'Evidence / Findings Notes', rowNumber);
    if (decision.status === 'approved' && current.permission?.review_status !== 'approved') throw new Error(`Row ${rowNumber}: ${id} cannot pass G9 while permission.review_status is '${current.permission?.review_status ?? 'missing'}'. Fix permission review separately; importer will not silently approve it.`);
    submitted.push({ record_id: id, scope, split, record_key: locationMap.get(id), decision: decision.decision, status: decision.status, reviewer, reviewed_at: reviewedAt, evidence, finding_category: String(row['Finding Category'] ?? '').trim() || null, content_fingerprint: humanFingerprint(current), row_number: rowNumber });
  }
  if (!submitted.length) throw new Error('No Human Decision values were filled. Blank rows are intentionally left pending.');
  const updates = new Map(submitted.map(item => [item.record_id, item])), applied = [];
  const patchRows = rows => rows.map(record => {
    const item = updates.get(record.record_id); if (!item) return record; applied.push(record.record_id);
    return { ...record, review: { ...(record.review || {}), status: item.status, reviewer: item.reviewer, reviewed_at: item.reviewed_at } };
  });
  const outputCanonical = patchRows(structuredClone(canonical));
  const outputTasks = Object.fromEntries(Object.entries(structuredClone(taskRecords)).map(([key, rows]) => [key, patchRows(rows)]));
  if (applied.length !== submitted.length) throw new Error('Internal guard: not all submitted decisions were mapped to source records.');
  const updatedById = new Map([...outputCanonical, ...Object.values(outputTasks).flat()].map(record => [record.record_id, record]));
  const outputSplits = Object.fromEntries(SPLIT_NAMES.map(name => [name, splitRecords[name].map(old => {
    const updated = updatedById.get(old.record_id); if (!updated) throw new Error(`Split record ${old.record_id} has no source task record.`); return updated;
  })]));
  validateSplitIntegrity(splitRecords, outputSplits, updatedById);
  const g9ApprovedAfter = [...outputCanonical, ...SPLIT_NAMES.flatMap(name => outputSplits[name])].filter(isHumanApprovedRecord).length;
  const auditRows = submitted.map(item => ({ record_id: item.record_id, scope: item.scope, split: item.split, decision: item.decision, review_status_written: item.status, reviewer: item.reviewer, reviewed_at: item.reviewed_at, evidence_notes: item.evidence, finding_category: item.finding_category, content_fingerprint: item.content_fingerprint, workbook_row: item.row_number }));
  return { canonical: outputCanonical, taskRecords: outputTasks, splitRecords: outputSplits, submitted, auditRows, g9ApprovedAfter };
}

export async function importHumanReview({ filePath, write = false, root = ROOT } = {}) {
  const dataDir = resolve(root, 'data/ai-copilot/phase2'), recordsDir = resolve(dataDir, 'records'), splitsDir = resolve(dataDir, 'splits'), reportsDir = resolve(dataDir, 'reports');
  if (!existsSync(filePath)) throw new Error(`Review workbook not found: ${filePath}`);
  const decisions = getDecisions(filePath), canonicalPath = resolve(recordsDir, FILE_MAP.canonical), canonical = readJsonl(canonicalPath);
  const taskRecords = Object.fromEntries(Object.entries(FILE_MAP).filter(([key]) => key !== 'canonical').map(([key, name]) => [key, readJsonl(resolve(recordsDir, name))]));
  const splitRecords = Object.fromEntries(SPLIT_NAMES.map(name => [name, readJsonl(resolve(splitsDir, `${name}.jsonl`))]));
  const plan = planHumanReviewImport({ decisions, canonical, taskRecords, splitRecords });
  const summary = { mode: write ? 'write' : 'dry-run', input: filePath, decisions_submitted: plan.submitted.length, approved: plan.submitted.filter(item => item.status === 'approved').length, rejected: plan.submitted.filter(item => item.status === 'rejected').length, needs_correction_or_in_review: plan.submitted.filter(item => item.status === 'in_review').length, human_approved_records_after_import: plan.g9ApprovedAfter, total_g9_scope: plan.canonical.length + SPLIT_NAMES.reduce((n, split) => n + plan.splitRecords[split].length, 0), ids_split_order_family_board_topology_preserved: true };
  console.log(JSON.stringify(summary, null, 2));
  if (!write) { console.log('DRY RUN ONLY: no JSONL files, audit log, manifest or reports were modified. Apply with --write after inspecting the summary.'); return summary; }

  const recordPaths = [canonicalPath, ...Object.entries(FILE_MAP).filter(([key]) => key !== 'canonical').map(([, name]) => resolve(recordsDir, name))];
  const splitPaths = SPLIT_NAMES.map(name => resolve(splitsDir, `${name}.jsonl`));
  const auditPath = resolve(reportsDir, 'human-review-audit.jsonl');
  const reportPaths = REPORT_OUTPUTS.map(rel => rel.startsWith('reports/') ? resolve(dataDir, rel) : resolve(dataDir, rel));
  const allPaths = [...recordPaths, ...splitPaths, auditPath, ...reportPaths];
  const backups = new Map(allPaths.map(path => [path, existsSync(path) ? readFileSync(path) : null]));
  try {
    writeFileSync(canonicalPath, jsonl(plan.canonical), 'utf8');
    const outputByKey = { canonical: plan.canonical, ...plan.taskRecords };
    for (const [key, file] of Object.entries(FILE_MAP)) if (key !== 'canonical') writeFileSync(resolve(recordsDir, file), jsonl(outputByKey[key]), 'utf8');
    for (const split of SPLIT_NAMES) writeFileSync(resolve(splitsDir, `${split}.jsonl`), jsonl(plan.splitRecords[split]), 'utf8');
    mkdirSync(dirname(auditPath), { recursive: true });
    const auditText = plan.auditRows.map(item => JSON.stringify({ ...item, imported_at: new Date().toISOString() })).join('\n') + '\n';
    writeFileSync(auditPath, (backups.get(auditPath)?.toString('utf8') || '') + auditText, 'utf8');
    const release = await buildReleaseReport(), gate8 = release.gates.find(gate => gate.id === 'G8');
    if (!gate8?.passed) throw new Error('G8 failed after applying review metadata; rolling all writes back.');
    const gate9 = release.gates.find(gate => gate.id === 'G9');
    console.log(JSON.stringify({ applied: true, G8: gate8.score, G9: gate9?.score, G9_passed: gate9?.passed, audit_log: auditPath }, null, 2));
    return { ...summary, applied: true, gate8: gate8.score, gate9: gate9?.score, gate9Passed: gate9?.passed };
  } catch (error) {
    for (const [path, oldBytes] of backups) { if (oldBytes === null) { if (existsSync(path)) unlinkSync(path); } else writeFileSync(path, oldBytes); }
    throw new Error(`Review import failed and all touched files were rolled back: ${error.message}`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const parsed = parseArgs(process.argv.slice(2)); await importHumanReview(parsed); }
  catch (error) { console.error(`G9 human-review import failed: ${error.stack || error.message}`); process.exitCode = 1; }
}
