import test from 'node:test';
import assert from 'node:assert/strict';
import { buildXlsx, readReviewQueueSheet, parseCsv } from './xlsx-lite.mjs';
import { createReviewWorkbookModel, buildReviewWorkbook } from './export-phase2-human-review.mjs';
import { planHumanReviewImport } from './import-phase2-human-review.mjs';
import { sha256, stableStringify } from './normalize-record.mjs';
import { isHumanApprovedRecord } from './review-policy.mjs';

function copy(value) { return structuredClone(value); }
function fingerprint(record) { const clone = copy(record); delete clone.review; return sha256(stableStringify(clone)); }
function makeRecord({ id, task = 'request_to_circuit', review = { status: 'approved', reviewer: 'system-qa-curator', reviewed_at: '2026-10-10T00:00:00.000Z' } } = {}) {
  const target = { circuit: { parts: [{ id: 'board', type: 'arduino-uno', props: {} }], wires: [] }, explanation: 'LED turns on.', code: null };
  const base = { record_id: id, task_type: task, project_family_id: 'family-test', context: { target_board: 'arduino-uno' }, source: { source_path: 'test.json', source_id: 'test-source', source_revision: 'abc123' }, instruction: { text: 'Make a test circuit.' }, target, fault: null, validation: { status: 'pass' }, capabilities: { simulation: 'supported', compile: 'not_tested' }, limitations: [], permission: { status: 'internal_owned', review_status: 'approved' }, review, variant: { kind: 'canonical', parent_record_id: null }, hashes: { source_hash: 'src', topology_hash: 'topo', content_hash: '' } };
  base.hashes.content_hash = sha256({ text: base.instruction.text, target: base.target });
  return base;
}
function decisionRow(record, overrides = {}) {
  return { 'Record Scope': 'released_record', Split: 'train', 'Record ID': record.record_id, 'Content Fingerprint (do not edit)': fingerprint(record), 'Human Decision': 'Approved', 'Reviewer ID': 'reviewer-human-1', 'Reviewed At UTC': '2026-10-10T14:30:00Z', 'Evidence / Findings Notes': 'Reviewed instruction and target circuit against board profile.', 'Finding Category': 'Technical correctness', ...overrides };
}

test('workbook XLSX writer emits a readable Review Queue sheet and leaves decisions blank', () => {
  const model = createReviewWorkbookModel({ canonicalRecords: [makeRecord({ id: 'pxai2-canon-test' })], sourceRecords: [makeRecord({ id: 'pxai2-request-test' })], splitRecords: { train: [makeRecord({ id: 'pxai2-request-test' })], validation: [], test: [] } });
  assert.equal(model.summary.scopeCount, 2);
  const rows = readReviewQueueSheet(buildReviewWorkbook(model));
  assert.equal(rows.length, 3); assert.equal(rows[0][2], 'Record ID'); assert.equal(rows[1][2], 'pxai2-canon-test'); assert.equal(rows[2][2], 'pxai2-request-test');
  assert.equal(rows[2][6], ''); assert.equal(rows[2][7], ''); assert.equal(rows[2][12], fingerprint(makeRecord({ id: 'pxai2-request-test' })));
});
test('import plan updates review metadata without changing split order or IDs', () => {
  const canonical = [makeRecord({ id: 'pxai2-canon-test' })], request = makeRecord({ id: 'pxai2-request-test' });
  const plan = planHumanReviewImport({ decisions: [decisionRow(request)], canonical, taskRecords: { request_to_circuit: [request], fault_repair: [], diagnosis_explanation: [], blockly_code: [] }, splitRecords: { train: [copy(request)], validation: [], test: [] } });
  assert.equal(plan.submitted.length, 1); assert.equal(plan.taskRecords.request_to_circuit[0].review.status, 'approved'); assert.equal(isHumanApprovedRecord(plan.taskRecords.request_to_circuit[0]), true); assert.equal(plan.splitRecords.train[0].record_id, request.record_id); assert.equal(plan.splitRecords.train[0].review.status, 'approved');
});
test('import rejects automated reviewers, stale fingerprints, missing evidence and unapproved permission review', () => {
  const request = makeRecord({ id: 'pxai2-request-test' });
  const plan = overrides => () => planHumanReviewImport({ decisions: [decisionRow(request, overrides)], canonical: [], taskRecords: { request_to_circuit: [request], fault_repair: [], diagnosis_explanation: [], blockly_code: [] }, splitRecords: { train: [copy(request)], validation: [], test: [] } });
  assert.throws(plan({ 'Reviewer ID': 'system-qa-curator' }), /automated reviewer/i);
  assert.throws(plan({ 'Content Fingerprint (do not edit)': 'stale' }), /stale content fingerprint/i);
  assert.throws(plan({ 'Evidence / Findings Notes': '' }), /Evidence \/ Findings Notes is required/i);
  const notPermitted = copy(request); notPermitted.permission.review_status = 'in_review';
  assert.throws(() => planHumanReviewImport({ decisions: [decisionRow(notPermitted)], canonical: [], taskRecords: { request_to_circuit: [notPermitted], fault_repair: [], diagnosis_explanation: [], blockly_code: [] }, splitRecords: { train: [copy(notPermitted)], validation: [], test: [] } }), /permission\.review_status/i);
});
test('CSV parser handles quoted commas, embedded newlines and escaped quotes', () => assert.deepEqual(parseCsv('a,b\n"one,two","line 1\nline 2"\n"say ""hi""",ok\n'), [['a', 'b'], ['one,two', 'line 1\nline 2'], ['say "hi"', 'ok']]));
