#!/usr/bin/env node
/** Build the Phase 2 G9 independent human review workbook from the live local data. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, stableStringify } from './normalize-record.mjs';
import { isHumanApprovedRecord } from './review-policy.mjs';
import { buildXlsx } from './xlsx-lite.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = resolve(ROOT, 'data/ai-copilot/phase2');
const RECORDS = resolve(DATA, 'records');
const SPLITS = resolve(DATA, 'splits');
const SPECIAL_FAULT_REVIEW_IDS = new Set([
  'pxai2-fault-tmpl-g7-tmp36-alert-63',
  'pxai2-fault-tmpl-g7-soil-smart-farm-71',
  'pxai2-fault-mission-lesson-microbit-external-led-132',
  'pxai2-fault-mission-lesson-microbit-optical-nightlight-136',
  'pxai2-fault-mission-lesson-microbit-intruder-alarm-143',
]);
const TASK_FILES = [
  ['request_to_circuit', 'requests.jsonl'],
  ['fault_repair', 'fault-repairs.jsonl'],
  ['diagnosis_explanation', 'diagnosis-explanations.jsonl'],
  ['blockly_code', 'blockly-code.jsonl'],
];

export function readJsonl(path) {
  const raw = readFileSync(path, 'utf8');
  if (!raw.trim()) return [];
  return raw.trim().split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`); }
  });
}
function jsonCell(value) {
  if (value === null || value === undefined) return '';
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (rendered.length > 32000) throw new Error(`A review field exceeds Excel's cell text limit (${rendered.length} chars).`);
  return rendered;
}
function reviewFingerprint(record) {
  const copy = structuredClone(record);
  delete copy.review;
  return sha256(stableStringify(copy));
}
function sameStable(left, right) { return stableStringify(left ?? null) === stableStringify(right ?? null); }
function counts(rows, keyFn) {
  const result = {};
  for (const row of rows) { const key = keyFn(row) || 'unspecified'; result[key] = (result[key] || 0) + 1; }
  return result;
}

export function createReviewWorkbookModel({ canonicalRecords, sourceRecords, splitRecords }) {
  const splitById = new Map();
  for (const split of ['train', 'validation', 'test']) {
    for (const record of splitRecords[split]) {
      if (!record?.record_id || splitById.has(record.record_id)) throw new Error(`Missing or duplicate record ID in splits: ${record?.record_id}`);
      splitById.set(record.record_id, split);
    }
  }
  const sourcesById = new Map();
  for (const record of sourceRecords) {
    if (!record?.record_id || sourcesById.has(record.record_id)) throw new Error(`Missing or duplicate source artifact ID: ${record?.record_id}`);
    sourcesById.set(record.record_id, record);
  }
  if (sourcesById.size !== splitById.size) throw new Error(`Source/split scope mismatch: ${sourcesById.size} source records vs ${splitById.size} split records.`);
  for (const [id, source] of sourcesById) {
    const splitName = splitById.get(id);
    const split = splitRecords[splitName].find(record => record.record_id === id);
    if (!split) throw new Error(`Task record ${id} is missing from its assigned split.`);
    for (const field of ['task_type', 'project_family_id']) {
      if (source[field] !== split[field]) throw new Error(`Source/split ${field} mismatch for ${id}; refusing to export a misleading workbook.`);
    }
    if (source.context?.target_board !== split.context?.target_board || source.hashes?.topology_hash !== split.hashes?.topology_hash) {
      throw new Error(`Source/split board or topology mismatch for ${id}; refusing to export a misleading workbook.`);
    }
    if (!sameStable(source.target, split.target) || !sameStable(source.fault, split.fault) || source.instruction?.text !== split.instruction?.text) {
      throw new Error(`Source/split payload mismatch for ${id}; repair/sync data before exporting G9 workbook.`);
    }
  }
  const ids = new Set();
  for (const record of canonicalRecords) {
    if (!record?.record_id || ids.has(record.record_id) || sourcesById.has(record.record_id)) throw new Error(`Duplicate/missing record ID across review scope: ${record?.record_id}`);
    ids.add(record.record_id);
  }
  for (const id of sourcesById.keys()) {
    if (ids.has(id)) throw new Error(`Duplicate record ID across canonical/released scope: ${id}`);
    ids.add(id);
  }
  const queue = [
    ...canonicalRecords.map(record => ({ record, scope: 'canonical_parent', split: 'canonical' })),
    ...['train', 'validation', 'test'].flatMap(split => splitRecords[split].map(record => ({ record: sourcesById.get(record.record_id), scope: 'released_record', split }))),
  ];
  const header = [
    'Record Scope', 'Split', 'Record ID', 'Task Type', 'Project Family ID', 'Target Board',
    'Special Review Flag', 'Human Decision', 'Reviewer ID', 'Reviewed At UTC', 'Evidence / Findings Notes', 'Finding Category',
    'Content Fingerprint (do not edit)', 'Source Path', 'Source ID', 'Source Revision', 'Instruction / Request',
    'Variant Kind', 'Parent Record ID', 'Positive Target Circuit JSON', 'Fault Input Circuit JSON',
    'Expected Fault Rule IDs', 'Expected Fault Validator Status', 'Target Explanation', 'Target Code / Blockly XML',
    'Automated Validation Status', 'Simulation Capability', 'Compile Capability', 'Limitations',
    'Permission Status', 'Permission Review Status', 'Existing Review Status', 'Existing Reviewer', 'Existing Reviewed At',
  ];
  const rows = queue.map(({ record, scope, split }) => [
    scope, split, record.record_id, record.task_type, record.project_family_id, record.context?.target_board ?? '',
    SPECIAL_FAULT_REVIEW_IDS.has(record.record_id) ? 'FAULT REPLACEMENT — verify the replacement fault and expected diagnosis' : '',
    '', '', '', '', '', reviewFingerprint(record),
    record.source?.source_path ?? '', record.source?.source_id ?? '', record.source?.source_revision ?? '',
    record.instruction?.text ?? '', record.variant?.kind ?? '', record.variant?.parent_record_id ?? '',
    jsonCell(record.target?.circuit ?? record.target?.corrected_circuit), jsonCell(record.fault?.input_circuit),
    jsonCell(record.fault?.expected_rule_ids), record.fault?.expected_validator_status ?? '',
    record.target?.explanation ?? '', record.target?.code ?? '', record.validation?.status ?? '',
    record.capabilities?.simulation ?? '', record.capabilities?.compile ?? '', jsonCell(record.limitations),
    record.permission?.status ?? '', record.permission?.review_status ?? '', record.review?.status ?? 'missing',
    record.review?.reviewer ?? '', record.review?.reviewed_at ?? '',
  ]);
  const releaseRows = queue.filter(item => item.scope === 'released_record').map(item => item.record);
  const approved = queue.filter(item => isHumanApprovedRecord(item.record)).length;
  const byTask = counts(releaseRows, r => r.task_type);
  const byBoard = counts(releaseRows, r => r.context?.target_board);
  const bySplit = counts(queue.filter(item => item.scope === 'released_record'), item => item.split);
  return { queue, header, rows, summary: {
    scopeCount: queue.length, canonicalCount: canonicalRecords.length, releasedCount: releaseRows.length,
    pending: queue.length - approved, humanApproved: approved, byTask, byBoard, bySplit,
  } };
}

export function buildReviewWorkbook(model) {
  const { header, rows, summary } = model;
  const startRows = [
    ['PIXIU TECH — PHASE 2 G9 HUMAN REVIEW'],
    ['Purpose', 'Independent technical review of the Phase 2 AI Copilot dataset. Automated QA is not a human approval.'],
    ['Scope', `${summary.canonicalCount} canonical parent circuits + ${summary.releasedCount} released records = ${summary.scopeCount} records.`],
    ['Current state', `${summary.humanApproved} records already satisfy the human-review policy; ${summary.pending} need independent review.`],
    ['Step 1', 'Filter the Review Queue by task type/split. Read the instruction, circuit/fault, expected rules, explanation and/or code. Use the board column to judge board compatibility.'],
    ['Step 2', 'For each reviewed row, choose Human Decision from the dropdown. Fill Reviewer ID with the actual human reviewer identity, Reviewed At UTC with the actual completion time, and Evidence / Findings Notes.'],
    ['Step 3', 'Use Approved only after checking the record against real technical evidence. Use Rejected or Needs correction when wrong/unsafe/unsupported; add specific findings. Do not approve by copying automated metadata.'],
    ['Step 4', 'Save this file as .xlsx. The guarded importer reads the Review Queue worksheet. First run dry-run; apply only after its validation report has no errors.'],
    ['Export command', 'npm run export:copilot-g9-review'],
    ['Dry-run import', 'npm run import:copilot-g9-review -- --file data/ai-copilot/phase2/reports/phase2-g9-human-review.xlsx --dry-run'],
    ['Apply reviewed decisions', 'npm run import:copilot-g9-review -- --file data/ai-copilot/phase2/reports/phase2-g9-human-review.xlsx --write'],
    ['UTC timestamp format', 'Example format: 2026-10-10T14:30:00Z. Enter the real review time; do not backdate or fabricate approvals.'],
    ['Important', 'The importer will not change IDs, split assignments, ordering, topology, permissions or counts. If a source/split fingerprint changes after export, it rejects the stale row.'],
    ['Note for fault-repair records', 'The Review Queue marks the five fault records replaced during Phase 2 integrity repair. Verify that each new fault and expected diagnostic matches the intended learning objective.'],
    ['G9 release rule', 'G9 remains pending until every canonical parent and released record has valid independent human approval and its permission review is approved.'],
    ['Task type review criteria', 'request_to_circuit: request vs circuit/components/wiring. fault_repair: fault, exact expected diagnosis and corrected circuit. diagnosis_explanation: explanation matches the evidence. blockly_code: XML/logic/pins/board behaviour match the circuit/request.'],
  ];
  const taskRows = [['Released records by task type', 'Count'], ...Object.entries(summary.byTask).sort().map(([k, v]) => [k, v])];
  const boardRows = [['Released records by target board', 'Count'], ...Object.entries(summary.byBoard).sort().map(([k, v]) => [k, v])];
  const splitRows = [['Released records by split', 'Count'], ...['train', 'validation', 'test'].map(k => [k, summary.bySplit[k] || 0])];
  const rollup = [['Metric', 'Value'], ['Canonical parent records', summary.canonicalCount], ['Released records', summary.releasedCount], ['Total records in G9 scope', summary.scopeCount], ['Already human-approved under policy', summary.humanApproved], ['Pending human review', summary.pending], ['Release ready', 'NO — review and rerun all release gates']];
  const widths = [17, 14, 34, 25, 34, 20, 43, 22, 24, 28, 50, 24, 68, 42, 26, 30, 52, 19, 34, 48, 48, 35, 25, 52, 55, 22, 19, 19, 40, 22, 24, 23, 25, 28];
  const lastRow = rows.length + 1;
  return buildXlsx([
    { name: 'Start Here', rows: startRows, widths: [24, 115], freeze: false, rowHeights: { 1: 30 } },
    { name: 'Review Queue', rows: [header, ...rows], widths, freeze: true, filter: true,
      validations: [
        { ref: `H2:H${lastRow}`, formula: '"Approved,Rejected,Needs correction,In review"' },
        { ref: `L2:L${lastRow}`, formula: '"Technical correctness,Electrical safety,Board compatibility,Instruction mismatch,Fault diagnosis,Blockly/XML issue,Explanation issue,Other"' },
      ], rowHeights: { 1: 34 } },
    { name: 'Summary', rows: [['G9 HUMAN REVIEW SUMMARY', 'Value'], ...rollup.slice(1), ['', ''], ...taskRows, ['', ''], ...boardRows, ['', ''], ...splitRows], widths: [42, 54], freeze: false, rowHeights: { 1: 30 } },
  ]);
}

export async function exportWorkbook({ root = ROOT, outPath = null } = {}) {
  const dataDir = resolve(root, 'data/ai-copilot/phase2');
  const recordsDir = resolve(dataDir, 'records'), splitsDir = resolve(dataDir, 'splits');
  const canonicalRecords = readJsonl(resolve(recordsDir, 'canonical.jsonl'));
  const sourceRecords = TASK_FILES.flatMap(([, file]) => readJsonl(resolve(recordsDir, file)));
  const splitRecords = Object.fromEntries(['train', 'validation', 'test'].map(split => [split, readJsonl(resolve(splitsDir, `${split}.jsonl`))]));
  const model = createReviewWorkbookModel({ canonicalRecords, sourceRecords, splitRecords });
  const target = resolve(outPath || resolve(dataDir, 'reports/phase2-g9-human-review.xlsx'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buildReviewWorkbook(model));
  return { path: target, summary: model.summary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const outIndex = process.argv.indexOf('--out');
    const output = outIndex >= 0 ? process.argv[outIndex + 1] : null;
    if (outIndex >= 0 && !output) throw new Error('--out requires a filepath.');
    const result = await exportWorkbook({ outPath: output });
    console.log(JSON.stringify({ workbook: result.path, ...result.summary }, null, 2));
    console.log('Workbook generated from the current local dataset. Human decisions are blank; no approvals were invented.');
  } catch (error) {
    console.error(`G9 workbook export failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
