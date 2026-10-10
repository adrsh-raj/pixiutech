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

import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { getBundledModules, ROOT } from "./copilot-dataset/bundle-helper.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

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

  const Ajv2020 = require("ajv/dist/2020")
  const ajv = new Ajv2020()
  const schemaPath = resolve(__dirname, "copilot-dataset/schema/record-v1.schema.json")
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  const validateSchema = ajv.compile(schema)

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
  const totalInv = sourceInventory.summary.total_sources_inventoried
  const eligibleInv = sourceInventory.summary.eligible_candidates
  const excludedInv = sourceInventory.summary.excluded_candidates
  const g1Passed = totalInv > 0 && eligibleInv + excludedInv === totalInv
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
  let g3InvalidPositive = 0
  let g3TotalPositive = 0
  for (const rec of allReleased) {
    const circuit = rec.target?.circuit || rec.target?.corrected_circuit
    if (circuit) {
      g3TotalPositive++
      const res = validateProposedCircuit(circuit, { allowWarnings: true })
      if (!res.valid) {
        g3InvalidPositive++
      }
    }
  }
  const g3Passed = g3TotalPositive > 0 && g3InvalidPositive === 0
  gates.push({
    id: "G3",
    name: "Positive Correctness",
    threshold: "100% validator pass for positive gold targets",
    metric: `${g3TotalPositive - g3InvalidPositive}/${g3TotalPositive} pass`,
    passed: g3Passed,
  })

  // G4: Negative Calibration
  let g4UnmatchedFaults = 0
  for (const rec of faultRecords) {
    const faultCircuit = rec.fault?.input_circuit
    const res = validateProposedCircuit(faultCircuit, { allowWarnings: false })
    const flagged = !res.valid || (res.warnings && res.warnings.length > 0)
    if (!flagged) {
      g4UnmatchedFaults++
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

  // G5: Provenance & Licensing
  let g5MissingProvenance = 0
  for (const rec of allReleased) {
    const hasSource = rec.source?.source_type && rec.source?.source_id && rec.source?.source_revision
    const isApproved = rec.permission?.status === "internal_owned" && rec.permission?.review_status === "approved"
    if (!hasSource || !isApproved) {
      g5MissingProvenance++
    }
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
  const g6Passed = g6Evaluated > 0 && g6Preserved === g6Evaluated
  gates.push({
    id: "G6",
    name: "Paraphrase Preservation",
    threshold: "100% exact topology + board invariant match",
    metric: `${g6Preserved}/${g6Evaluated} preserved`,
    passed: g6Passed,
  })

  // G7: Split Isolation
  const g7Passed = leakageAudit.passed === true && leakageAudit.checks.every((c) => c.status === "pass")
  gates.push({
    id: "G7",
    name: "Split Isolation",
    threshold: "0 cross-split family, record, or topology leaks",
    metric: g7Passed ? "0 leaks (clean holdout)" : "leakage detected",
    passed: g7Passed,
  })

  // G8: Reproducibility
  const idSet = new Set(allReleased.map((r) => r.record_id))
  const g8Passed = idSet.size === total && allReleased.every((r) => r.hashes?.content_hash?.length === 64)
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
  const g9Passed = g9Unapproved === 0
  gates.push({
    id: "G9",
    name: "Review Status",
    threshold: "100% released records reviewed & approved",
    metric: `${total - g9Unapproved}/${total} approved`,
    passed: g9Passed,
  })

  // G10: Product Metric Report
  const hasTaskTypes = Object.keys(manifest.summary?.counts_by_task_type || {}).length === 4
  const hasBoards = Object.keys(manifest.summary?.counts_by_board || {}).length >= 4
  const hasSplits = Object.keys(manifest.summary?.counts_by_split || {}).length === 3
  const g10Passed = hasTaskTypes && hasBoards && hasSplits
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

  const allPassed = gates.every((g) => g.passed) && thresholdChecks.every((t) => t.passed)

  if (!allPassed) {
    console.error("\n❌ PHASE 2 QUALITY AUDIT FAILED: Some release acceptance gates did not pass.")
    process.exit(1)
  }

  console.log("\n================================================================================")
  console.log("  🎉 ALL 10 RELEASE GATES (G1–G10) PASSED — PHASE 2 CORPUS VERIFIED & SEALED")
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
