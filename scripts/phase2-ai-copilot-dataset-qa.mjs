#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 MASTER DATASET QA ACCEPTANCE SUITE
 * 
 * Verifies all 10 Release Acceptance Gates (G1–G10) for Phase 2:
 * G1: Source Inventory Coverage (100% inventoried, exclusions documented)
 * G2: Schema Integrity (100% schema-valid against record-v1.json)
 * G3: Positive Correctness (100% gold circuits pass live validator)
 * G4: Negative Calibration (100% expected-label match for fault suite >= 50)
 * G5: Provenance & Licensing (100% internal_owned approved, 0 unknown)
 * G6: Paraphrase Preservation (100% exact topology + board invariant match)
 * G7: Split Isolation (0 cross-split family, record, or topology leaks)
 * G8: Reproducibility (deterministic SHA-256 hashes for all records)
 * G9: Review Status (100% released records reviewed & approved)
 * G10: Product Metric Report (complete counts per task, board, and split)
 * 
 * Also verifies Pilot target thresholds:
 * - Total records >= 250
 * - request_to_circuit >= 100
 * - fault_repair >= 50
 * - diagnosis_explanation >= 50
 * - blockly_code >= 50
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { compileRecordSchema } from "./copilot-dataset/record-schema-validator.mjs"
import { evaluateFaultCalibration } from "./copilot-dataset/generate-fault-repair-pairs.mjs"
import { getBundledModules, ROOT } from "./copilot-dataset/bundle-helper.mjs"
import { sha256 } from "./copilot-dataset/normalize-record.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)



function expectedContentHash(rec) {
  if (rec.task_type === "request_to_circuit") return sha256({ text: rec.instruction.text, target: rec.target })
  if (rec.task_type === "fault_repair") return sha256({ fault: rec.fault.input_circuit, target: { circuit: rec.target.corrected_circuit, explanation: rec.target.explanation, code: rec.target.code }, mutation_id: rec.fault.mutation_id })
  if (rec.task_type === "diagnosis_explanation") return sha256({ circuit: rec.target.circuit, explanation: rec.target.explanation, instruction: rec.instruction.text, task: "diagnosis_explanation" })
  if (rec.task_type === "blockly_code") return sha256({ circuit: rec.target.circuit, code: rec.target.code, instruction: rec.instruction.text, task: "blockly_code" })
  return null
}
function isWellFormedBlocklyXml(xml) {
  if (typeof xml !== "string" || !xml.trim() || xml.length > 200_000) return false
  const body = xml.trim().replace(/^\s*<\?xml\b[^?]*\?>/i, "").replace(/<!--[\s\S]*?-->/g, "")
  if (/<!DOCTYPE|<!ENTITY|<\s*script\b|<\s*(?:iframe|object|embed|foreignObject|html|body)\b|javascript\s*:|\bon[a-z]+\s*=/i.test(body)) return false
  const tokenPattern = /<\/?([A-Za-z_][\w:.-]*(?:"[^"]*"|'[^']*'|[^'">])*)\s*\/?>/g
  const stack = [], roots = []
  let cursor = 0, match
  while ((match = tokenPattern.exec(body)) !== null) {
    if (body.slice(cursor, match.index).includes("<")) return false
    const token = match[0]
    const name = token.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1]
    if (!name) return false
    if (/^<\//.test(token)) {
      if (stack.pop() !== name) return false
    } else {
      if (stack.length === 0) roots.push(name)
      if (!/\/\s*>$/.test(token)) stack.push(name)
    }
    cursor = match.index + token.length
  }
  if (body.slice(cursor).includes("<") || stack.length || roots.length !== 1 || roots[0].toLowerCase() !== "xml") return false
  return !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(body)
}
function countTopologyOverlaps(train, validation, test) {
  const sets = {
    train: new Set(train.map((r) => r.hashes?.topology_hash).filter(Boolean)),
    validation: new Set(validation.map((r) => r.hashes?.topology_hash).filter(Boolean)),
    test: new Set(test.map((r) => r.hashes?.topology_hash).filter(Boolean)),
  }
  const overlap = (a, b) => Array.from(sets[a]).filter((value) => sets[b].has(value)).length
  return { train_validation: overlap("train", "validation"), train_test: overlap("train", "test"), validation_test: overlap("validation", "test") }
}

async function runPhase2DatasetQA() {
  console.log("================================================================================")
  console.log("  PIXIU CYBERLAB — AI COPILOT PHASE 2: VERIFIED DATASET QA SUITE")
  console.log("================================================================================")

  const dataDir = resolve(ROOT, "data/ai-copilot/phase2")

  // 1. Verify existence of all required files
  const requiredFiles = [
    "manifest.json",
    "README.md",
    "records/canonical.jsonl",
    "records/requests.jsonl",
    "records/fault-repairs.jsonl",
    "records/diagnosis-explanations.jsonl",
    "records/blockly-code.jsonl",
    "splits/train.jsonl",
    "splits/validation.jsonl",
    "splits/test.jsonl",
    "reports/source-inventory.json",
    "reports/duplicate-audit.json",
    "reports/leakage-audit.json",
    "reports/validation-report.json",
    "reports/release-summary.md",
  ]

  for (const rel of requiredFiles) {
    const full = resolve(dataDir, rel)
    if (!existsSync(full)) {
      console.error(`❌ Missing required Phase 2 file: ${full}`)
      process.exit(1)
    }
  }

  // 2. Load dependencies & data
  const { validator } = await getBundledModules()
  const validateProposedCircuit = validator.validateProposedCircuit

  const schemaPath = resolve(__dirname, "copilot-dataset/schema/record-v1.schema.json")
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  const validateSchema = compileRecordSchema(schema)

  const sourceInventory = JSON.parse(readFileSync(resolve(dataDir, "reports/source-inventory.json"), "utf8"))
  const leakageAudit = JSON.parse(readFileSync(resolve(dataDir, "reports/leakage-audit.json"), "utf8"))
  const validationReport = JSON.parse(readFileSync(resolve(dataDir, "reports/validation-report.json"), "utf8"))
  const manifest = JSON.parse(readFileSync(resolve(dataDir, "manifest.json"), "utf8"))

  const canonicalRecords = readFileSync(resolve(dataDir, "records/canonical.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const requestRecords = readFileSync(resolve(dataDir, "records/requests.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const faultRecords = readFileSync(resolve(dataDir, "records/fault-repairs.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const diagnosisRecords = readFileSync(resolve(dataDir, "records/diagnosis-explanations.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const blocklyRecords = readFileSync(resolve(dataDir, "records/blockly-code.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)

  const trainRecords = readFileSync(resolve(dataDir, "splits/train.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const valRecords = readFileSync(resolve(dataDir, "splits/validation.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const testRecords = readFileSync(resolve(dataDir, "splits/test.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)

  const allReleased = [...trainRecords, ...valRecords, ...testRecords]
  const total = allReleased.length

  // --- GATE EVALUATIONS ---
  const gates = []

  // G1: Inventory Coverage
  const inventoryItems = Array.isArray(sourceInventory.items) ? sourceInventory.items : []
  const totalInv = sourceInventory.summary.total_sources_inventoried
  const eligibleInv = inventoryItems.filter((item) => item.disposition === "eligible").length
  const excludedItems = inventoryItems.filter((item) => item.disposition === "excluded")
  const excludedInv = excludedItems.length
  const uniqueInventoryIds = new Set(inventoryItems.map((item) => item.source_id))
  const g1Passed = totalInv > 0 && totalInv === inventoryItems.length &&
    sourceInventory.summary.eligible_candidates === eligibleInv &&
    sourceInventory.summary.excluded_candidates === excludedInv &&
    uniqueInventoryIds.size === inventoryItems.length &&
    inventoryItems.every((item) => ["eligible", "excluded"].includes(item.disposition) &&
      (item.disposition !== "excluded" || Boolean(item.exclusion_reason)))
  gates.push({
    id: "G1",
    name: "Inventory Coverage",
    threshold: "100% inventoried with disposition",
    metric: `${totalInv}/${totalInv} sources accounted`,
    passed: g1Passed,
  })

  // G2: Schema Integrity
  let g2InvalidCount = 0
  for (const rec of allReleased) {
    if (!validateSchema(rec)) {
      g2InvalidCount++
    }
  }
  const g2Passed = g2InvalidCount === 0
  gates.push({
    id: "G2",
    name: "Schema Integrity",
    threshold: "100% schema-valid against record-v1.json",
    metric: `${total - g2InvalidCount}/${total} valid`,
    passed: g2Passed,
  })

  // G3: Positive Correctness
  let g3InvalidPositive = 0, g3TotalPositive = 0, g3InvalidBlocklyXml = 0, g3InvalidDiagnosisText = 0
  const boardNames = { "arduino-uno": "Arduino Uno R3", "esp32-devkit": "ESP32 DevKit V1", "rpi-pico": "Raspberry Pi Pico", "microbit-v2": "BBC micro:bit v2" }
  for (const rec of allReleased) {
    const circuit = rec.target?.circuit || rec.target?.corrected_circuit
    if (circuit) {
      g3TotalPositive++
      const candidate = rec.task_type === "blockly_code" ? { ...circuit, blocklyXml: rec.target.code } : circuit
      const res = validateProposedCircuit(candidate, { allowWarnings: true })
      if (!res.valid) g3InvalidPositive++
      if (rec.task_type === "blockly_code" && !isWellFormedBlocklyXml(rec.target.code)) g3InvalidBlocklyXml++
    }
    if (rec.task_type === "diagnosis_explanation") {
      const explanation = String(rec.target?.explanation || "")
      const expectedBoard = boardNames[rec.context?.target_board] || String(rec.context?.target_board || "Microcontroller")
      if (!explanation || /\[object Object\]|\bundefined\b|\bNaN\b/i.test(explanation) || !explanation.includes(expectedBoard) ||
        /all electrical conduction loops are closed|no short circuits or pin conflicts|all parts are within safe/i.test(explanation)) g3InvalidDiagnosisText++
    }
  }
  const g3Passed = g3TotalPositive > 0 && g3InvalidPositive === 0 && g3InvalidBlocklyXml === 0 && g3InvalidDiagnosisText === 0
  gates.push({
    id: "G3",
    name: "Positive Correctness",
    threshold: "100% validator pass for positive gold targets",
    metric: `${g3TotalPositive - g3InvalidPositive}/${g3TotalPositive} pass`,
    passed: g3Passed,
  })

  // G4: every seeded fault must match its declared diagnostic rule and severity.
  let g4UnmatchedFaults = 0
  const g4Failures = []
  for (const rec of faultRecords) {
    const fault = rec.fault || {}
    const res = validateProposedCircuit(fault.input_circuit, {
      allowWarnings: true,
      targetBoard: rec.context?.target_board,
    })
    const calibration = evaluateFaultCalibration(fault, res)
    if (!calibration.passed) {
      g4UnmatchedFaults++
      if (g4Failures.length < 8) g4Failures.push({
        record_id: rec.record_id,
        mutation_id: fault.mutation_id,
        expected_rule_ids: fault.expected_rule_ids,
        actual_rule_ids: calibration.actualRuleIds,
        actual_severities: calibration.actualSeverities,
        expected_status: fault.expected_validator_status,
        calibration,
      })
    }
  }
  const g4Passed = faultRecords.length >= 50 && g4UnmatchedFaults === 0
  gates.push({
    id: "G4",
    name: "Negative Calibration",
    threshold: "100% expected-label match for fault suite (>=50)",
    metric: `${faultRecords.length - g4UnmatchedFaults}/${faultRecords.length} calibrated`,
    passed: g4Passed,
  })

  // G5: resolve each record back to the eligible inventoried source revision.
  const inventoryById = new Map(inventoryItems.map((item) => [item.source_id, item]))
  let g5MissingProvenance = 0
  for (const rec of allReleased) {
    const sourceId = String(rec.source?.source_id || "").split("#")[0]
    const source = inventoryById.get(sourceId)
    const exactMatch = source && source.disposition === "eligible" && source.source_path === rec.source?.source_path &&
      source.source_revision === rec.source?.source_revision
    const isApproved = rec.permission?.status === "internal_owned" && rec.permission?.review_status === "approved"
    if (!rec.source?.source_type || !exactMatch || !isApproved) g5MissingProvenance++
  }
  const g5Passed = g5MissingProvenance === 0
  gates.push({
    id: "G5",
    name: "Provenance / Licence",
    threshold: "100% complete, internal_owned, approved",
    metric: `${total - g5MissingProvenance}/${total} verified`,
    passed: g5Passed,
  })

  // G6: Paraphrase Preservation
  const canonMap = new Map(canonicalRecords.map((c) => [c.record_id, c]))
  let g6Evaluated = 0
  let g6Preserved = 0
  for (const rec of requestRecords) {
    if (rec.variant?.kind !== "canonical") {
      g6Evaluated++
      const parent = canonMap.get(rec.variant?.parent_record_id)
      if (parent) {
        const topoMatch = rec.hashes?.topology_hash === parent.hashes?.topology_hash
        const boardMatch = rec.context?.target_board === parent.context?.target_board
        const familyMatch = rec.project_family_id === parent.project_family_id
        if (topoMatch && boardMatch && familyMatch) {
          g6Preserved++
        }
      }
    }
  }
  const requiredStyles = ["direct", "goal_oriented", "contextual", "colloquial", "typo"]
  const observedStyles = new Set(requestRecords.map((rec) => rec.variant?.request_style).filter(Boolean))
  const styleCoverage = requiredStyles.every((style) => observedStyles.has(style))
  const g6Passed = g6Evaluated > 0 && g6Preserved === g6Evaluated && styleCoverage
  gates.push({
    id: "G6",
    name: "Paraphrase Preservation",
    threshold: "100% exact topology + board invariant match",
    metric: `${g6Preserved}/${g6Evaluated} preserved`,
    passed: g6Passed,
  })

  // G7: independently recompute record/family/parent/topology isolation.
  const splitGroups = { train: trainRecords, validation: valRecords, test: testRecords }
  const recordSets = Object.fromEntries(Object.entries(splitGroups).map(([key, list]) => [key, new Set(list.map((rec) => rec.record_id))]))
  const familySets = Object.fromEntries(Object.entries(splitGroups).map(([key, list]) => [key, new Set(list.map((rec) => rec.project_family_id))]))
  const pairNames = [["train","validation"],["train","test"],["validation","test"]]
  let recordLeakCount = 0, familyLeakCount = 0
  for (const [left,right] of pairNames) {
    recordLeakCount += Array.from(recordSets[left]).filter((id) => recordSets[right].has(id)).length
    familyLeakCount += Array.from(familySets[left]).filter((id) => familySets[right].has(id)).length
  }
  const canonicalById = new Map(canonicalRecords.map((rec) => [rec.record_id, rec]))
  let parentLeakCount = 0
  for (const [splitName, list] of Object.entries(splitGroups)) for (const rec of list) {
    const parentId = rec.variant?.parent_record_id
    if (!parentId) continue
    const parentRecord = canonicalById.get(parentId)
    if (!parentRecord || parentRecord.project_family_id !== rec.project_family_id || !familySets[splitName].has(parentRecord.project_family_id)) parentLeakCount++
  }
  const topologyOverlaps = countTopologyOverlaps(trainRecords, valRecords, testRecords)
  const topologyLeakCount = topologyOverlaps.train_validation + topologyOverlaps.train_test + topologyOverlaps.validation_test
  const leakageReportPass = leakageAudit.passed === true && Array.isArray(leakageAudit.checks) && leakageAudit.checks.every((check) => check.status === "pass")
  const g7Passed = recordLeakCount === 0 && familyLeakCount === 0 && parentLeakCount === 0 && topologyLeakCount === 0 && leakageReportPass
  gates.push({
    id: "G7",
    name: "Split Isolation",
    threshold: "0 cross-split family, record, or topology leaks",
    metric: g7Passed ? "0 leaks (clean holdout)" : "leakage detected",
    passed: g7Passed,
  })

  // G8: recompute each task digest and each manifest artifact hash from disk.
  const idSet = new Set(allReleased.map((r) => r.record_id))
  const recordContentHashesValid = allReleased.every((rec) => expectedContentHash(rec) && expectedContentHash(rec) === rec.hashes?.content_hash)
  const canonicalContentHashesValid = canonicalRecords.every((rec) => sha256({ circuit: rec.target.circuit, explanation: rec.target.explanation, code: rec.target.code }) === rec.hashes?.content_hash)
  let manifestArtifactFailures = 0
  for (const artifact of manifest.artifacts || []) {
    const fullPath = resolve(dataDir, artifact.path)
    if (!existsSync(fullPath)) { manifestArtifactFailures++; continue }
    const content = readFileSync(fullPath, "utf8")
    if (sha256(content) !== artifact.sha256 || statSync(fullPath).size !== artifact.size_bytes) manifestArtifactFailures++
  }
  const g8Passed = idSet.size === total && recordContentHashesValid && canonicalContentHashesValid &&
    Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0 && manifestArtifactFailures === 0
  gates.push({
    id: "G8",
    name: "Reproducibility",
    threshold: "Deterministic content hashes across 100% records",
    metric: `${total}/${total} hash-verified`,
    passed: g8Passed,
  })

  // G9: Review Status
  let g9Unapproved = 0
  for (const rec of allReleased) {
    if (rec.review?.status !== "approved") {
      g9Unapproved++
    }
  }
  const invalidReviewMetadata = allReleased.filter((rec) => !String(rec.review?.reviewer || "").trim() ||
    !Number.isFinite(Date.parse(rec.review?.reviewed_at)) || rec.permission?.review_status !== "approved").length
  const g9Passed = g9Unapproved === 0 && invalidReviewMetadata === 0
  gates.push({
    id: "G9",
    name: "Review Status",
    threshold: "100% released records reviewed & approved",
    metric: `${total - g9Unapproved}/${total} approved`,
    passed: g9Passed,
  })

  // G10: recompute counts and compare them with the manifest and release report.
  const actualTaskCounts = {}, actualBoardCounts = {}
  for (const rec of allReleased) {
    actualTaskCounts[rec.task_type] = (actualTaskCounts[rec.task_type] || 0) + 1
    const board = rec.context?.target_board || "unspecified"
    actualBoardCounts[board] = (actualBoardCounts[board] || 0) + 1
  }
  const actualSplitCounts = { train: trainRecords.length, validation: valRecords.length, test: testRecords.length }
  const sameCounts = (left, right) => JSON.stringify(Object.fromEntries(Object.entries(left || {}).sort())) === JSON.stringify(Object.fromEntries(Object.entries(right || {}).sort()))
  const reportGates = new Map((validationReport.gates || []).map((gate) => [gate.id || gate.gate_id, gate]))
  const earlierGateStatusesMatch = gates.every((gate) => reportGates.has(gate.id) && reportGates.get(gate.id).passed === gate.passed)
  const g10Passed = manifest.summary?.total_records === total &&
    sameCounts(actualTaskCounts, manifest.summary?.counts_by_task_type) &&
    sameCounts(actualBoardCounts, manifest.summary?.counts_by_board) &&
    sameCounts(actualSplitCounts, manifest.summary?.counts_by_split) &&
    validationReport.status === "PASSED" && earlierGateStatusesMatch
  gates.push({
    id: "G10",
    name: "Product Metric Report",
    threshold: "Complete counts per task, board, and split",
    metric: g10Passed ? "complete & sealed" : "incomplete report",
    passed: g10Passed,
  })

  // Pilot Target Thresholds Check
  const counts = {
    total,
    requests: requestRecords.length,
    faults: faultRecords.length,
    diagnosis: diagnosisRecords.length,
    blockly: blocklyRecords.length,
  }

  const thresholdChecks = [
    { name: "Total Released Records", actual: counts.total, target: 250, passed: counts.total >= 250 },
    { name: "request_to_circuit", actual: counts.requests, target: 100, passed: counts.requests >= 100 },
    { name: "fault_repair", actual: counts.faults, target: 50, passed: counts.faults >= 50 },
    { name: "diagnosis_explanation", actual: counts.diagnosis, target: 50, passed: counts.diagnosis >= 50 },
    { name: "blockly_code", actual: counts.blockly, target: 50, passed: counts.blockly >= 50 },
  ]

  // Output formatted results
  console.log("\nRelease Acceptance Gates Evaluation:")
  console.log("--------------------------------------------------------------------------------")
  console.log(" Gate  Status   Name                     Result / Metric")
  console.log("--------------------------------------------------------------------------------")
  for (const g of gates) {
    const statusStr = g.passed ? "✅ PASS" : "❌ FAIL"
    console.log(` ${g.id.padEnd(5)} ${statusStr.padEnd(8)} ${g.name.padEnd(24)} ${g.metric}`)
  }
  console.log("--------------------------------------------------------------------------------")

  console.log("\nPilot Size Target Thresholds:")
  console.log("--------------------------------------------------------------------------------")
  for (const t of thresholdChecks) {
    const statusStr = t.passed ? "✅ PASS" : "❌ FAIL"
    console.log(` ${statusStr} ${t.name.padEnd(25)}: ${t.actual} (target >= ${t.target})`)
  }
  console.log("--------------------------------------------------------------------------------")

  console.log("\nSplit Isolation Breakdown:")
  console.log(`  Train Split:      ${trainRecords.length} records (${(manifest.summary.counts_by_split.train / total * 100).toFixed(1)}%)`)
  console.log(`  Validation Split: ${valRecords.length} records (${(manifest.summary.counts_by_split.validation / total * 100).toFixed(1)}%)`)
  console.log(`  Test Split:       ${testRecords.length} records (${(manifest.summary.counts_by_split.test / total * 100).toFixed(1)}%)`)

  if (g4Failures.length) console.error("\nFirst exact-rule fault mismatches: " + JSON.stringify(g4Failures.slice(0, 8), null, 2))
  const allPassed = gates.every((g) => g.passed) && thresholdChecks.every((t) => t.passed)

  if (!allPassed) {
    console.error("\n❌ PHASE 2 QUALITY AUDIT FAILED: Some release acceptance gates did not pass.")
    process.exit(1)
  }

  console.log("\n================================================================================")
  console.log("  ALL 10 RELEASE GATES PASSED — PHASE 2 CORPUS INTEGRITY VERIFIED")
  console.log("  Automated approval metadata is not a substitute for a human spot review.")
  console.log("================================================================================\n")
  return true
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPhase2DatasetQA().catch((err) => {
    console.error("❌ Fatal error in Phase 2 QA:", err)
    process.exit(1)
  })
}
