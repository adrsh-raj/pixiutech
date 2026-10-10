#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 FAMILY SPLIT & LEAKAGE AUDIT (WP 2.6)
 * 
 * Aggregates all verified dataset records across the 4 task groups:
 * 1. request_to_circuit
 * 2. fault_repair
 * 3. diagnosis_explanation
 * 4. blockly_code
 * 
 * Partitions records at the `project_family_id` level into:
 * - data/ai-copilot/phase2/splits/train.jsonl (~70%)
 * - data/ai-copilot/phase2/splits/validation.jsonl (~15%)
 * - data/ai-copilot/phase2/splits/test.jsonl (~15%)
 * 
 * Enforces Gate G7 (Split Isolation) with zero unresolved data leakage.
 * Produces: data/ai-copilot/phase2/reports/leakage-audit.json
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { sha256 } from "./normalize-record.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, "../..")

export async function splitByFamily() {
  const recordFiles = [
    resolve(ROOT, "data/ai-copilot/phase2/records/requests.jsonl"),
    resolve(ROOT, "data/ai-copilot/phase2/records/fault-repairs.jsonl"),
    resolve(ROOT, "data/ai-copilot/phase2/records/diagnosis-explanations.jsonl"),
    resolve(ROOT, "data/ai-copilot/phase2/records/blockly-code.jsonl"),
  ]

  const allRecords = []
  const recordMap = new Map()

  for (const file of recordFiles) {
    const lines = readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))

    for (const rec of lines) {
      if (recordMap.has(rec.record_id)) {
        throw new Error(`Duplicate record_id detected across source files: ${rec.record_id}`)
      }
      recordMap.set(rec.record_id, rec)
      allRecords.push(rec)
    }
  }

  console.log(`Loaded ${allRecords.length} total candidate records across 4 task groups.`)

  // Group by project_family_id
  const familyToRecords = new Map()
  for (const rec of allRecords) {
    const fam = rec.project_family_id
    if (!familyToRecords.has(fam)) {
      familyToRecords.set(fam, [])
    }
    familyToRecords.get(fam).push(rec)
  }

  const uniqueFamilies = Array.from(familyToRecords.keys())
  console.log(`Identified ${uniqueFamilies.length} unique project families.`)

  // Stratify by board to ensure all target boards are represented in all splits
  const boardToFamilies = new Map()
  for (const [fam, records] of familyToRecords.entries()) {
    const board = records[0].context.target_board || "generic"
    if (!boardToFamilies.has(board)) {
      boardToFamilies.set(board, [])
    }
    boardToFamilies.get(board).push(fam)
  }

  const familySplitAssignment = new Map()

  for (const [board, families] of boardToFamilies.entries()) {
    // Deterministic sort by SHA-256 of family ID to avoid any run-to-run drift
    const sorted = [...families].sort((a, b) => sha256(a).localeCompare(sha256(b)))

    const n = sorted.length
    // Target 70% train, 15% validation, 15% test
    const nVal = Math.max(1, Math.round(n * 0.15))
    const nTest = Math.max(1, Math.round(n * 0.15))
    const nTrain = n - nVal - nTest

    for (let i = 0; i < n; i++) {
      const fam = sorted[i]
      if (i < nTrain) {
        familySplitAssignment.set(fam, "train")
      } else if (i < nTrain + nVal) {
        familySplitAssignment.set(fam, "validation")
      } else {
        familySplitAssignment.set(fam, "test")
      }
    }
  }

  const splits = {
    train: [],
    validation: [],
    test: [],
  }

  for (const rec of allRecords) {
    const assignedSplit = familySplitAssignment.get(rec.project_family_id)
    if (!assignedSplit) {
      throw new Error(`Unassigned family for record ${rec.record_id}: ${rec.project_family_id}`)
    }
    splits[assignedSplit].push(rec)
  }

  // Sort records within each split deterministically by record_id
  for (const splitKey of Object.keys(splits)) {
    splits[splitKey].sort((a, b) => a.record_id.localeCompare(b.record_id))
  }

  // Write out split files
  const splitDir = resolve(ROOT, "data/ai-copilot/phase2/splits")
  writeFileSync(resolve(splitDir, "train.jsonl"), splits.train.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")
  writeFileSync(resolve(splitDir, "validation.jsonl"), splits.validation.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")
  writeFileSync(resolve(splitDir, "test.jsonl"), splits.test.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")

  // --- LEAKAGE AUDIT ---
  console.log("\nExecuting Comprehensive Data Leakage Audit...")

  const trainRecordIds = new Set(splits.train.map((r) => r.record_id))
  const valRecordIds = new Set(splits.validation.map((r) => r.record_id))
  const testRecordIds = new Set(splits.test.map((r) => r.record_id))

  const trainFamilies = new Set(splits.train.map((r) => r.project_family_id))
  const valFamilies = new Set(splits.validation.map((r) => r.project_family_id))
  const testFamilies = new Set(splits.test.map((r) => r.project_family_id))

  // 1. Same record_id in multiple splits
  const recordOverlapTrainVal = splits.train.filter((r) => valRecordIds.has(r.record_id)).length
  const recordOverlapTrainTest = splits.train.filter((r) => testRecordIds.has(r.record_id)).length
  const recordOverlapValTest = splits.validation.filter((r) => testRecordIds.has(r.record_id)).length
  const totalRecordOverlap = recordOverlapTrainVal + recordOverlapTrainTest + recordOverlapValTest

  // 2. Same project_family_id in multiple splits
  const familyOverlapTrainVal = Array.from(trainFamilies).filter((f) => valFamilies.has(f)).length
  const familyOverlapTrainTest = Array.from(trainFamilies).filter((f) => testFamilies.has(f)).length
  const familyOverlapValTest = Array.from(valFamilies).filter((f) => testFamilies.has(f)).length
  const totalFamilyOverlap = familyOverlapTrainVal + familyOverlapTrainTest + familyOverlapValTest

  // 3. Paraphrase whose parent is in a different split
  let crossSplitParaphraseLeaks = 0
  for (const [splitKey, records] of Object.entries(splits)) {
    const currentSplitIds = new Set(records.map((r) => r.record_id))
    for (const rec of records) {
      if (rec.variant?.parent_record_id) {
        const parentId = rec.variant.parent_record_id
        const parentRecord = recordMap.get(parentId)
        if (parentRecord) {
          const parentSplit = familySplitAssignment.get(parentRecord.project_family_id)
          if (parentSplit !== splitKey) {
            crossSplitParaphraseLeaks++
          }
        }
      }
    }
  }

  // 4. Identical or near-identical topology hash across train and test
  const trainTopologies = new Set(splits.train.map((r) => r.hashes.topology_hash))
  const valTopologies = new Set(splits.validation.map((r) => r.hashes.topology_hash))
  const testTopologies = new Set(splits.test.map((r) => r.hashes.topology_hash))

  const topologyOverlapTrainVal = Array.from(trainTopologies).filter((t) => valTopologies.has(t)).length
  const topologyOverlapTrainTest = Array.from(trainTopologies).filter((t) => testTopologies.has(t)).length
  const totalTopologyOverlap = topologyOverlapTrainVal + topologyOverlapTrainTest

  // 5. External examples with unknown rights in released splits
  const unknownRightsCount = allRecords.filter((r) => r.permission?.review_status !== "approved").length

  // 6. Unapproved / unreviewed records in released splits
  const unapprovedCount = allRecords.filter((r) => r.review?.status !== "approved").length

  const auditReport = {
    audit_name: "Phase 2 Split Isolation and Data Leakage Audit",
    timestamp: new Date().toISOString(),
    gate: "G7",
    passed:
      totalRecordOverlap === 0 &&
      totalFamilyOverlap === 0 &&
      crossSplitParaphraseLeaks === 0 &&
      totalTopologyOverlap === 0 &&
      unknownRightsCount === 0 &&
      unapprovedCount === 0,
    metrics: {
      total_records: allRecords.length,
      unique_families: uniqueFamilies.length,
      splits: {
        train: {
          records: splits.train.length,
          families: trainFamilies.size,
          ratio: Number((splits.train.length / allRecords.length).toFixed(4)),
        },
        validation: {
          records: splits.validation.length,
          families: valFamilies.size,
          ratio: Number((splits.validation.length / allRecords.length).toFixed(4)),
        },
        test: {
          records: splits.test.length,
          families: testFamilies.size,
          ratio: Number((splits.test.length / allRecords.length).toFixed(4)),
        },
      },
    },
    checks: [
      {
        check: "Same record_id in multiple splits",
        expected: 0,
        actual: totalRecordOverlap,
        status: totalRecordOverlap === 0 ? "pass" : "fail",
      },
      {
        check: "Same project_family_id in multiple splits",
        expected: 0,
        actual: totalFamilyOverlap,
        status: totalFamilyOverlap === 0 ? "pass" : "fail",
      },
      {
        check: "Paraphrase whose parent is in a different split",
        expected: 0,
        actual: crossSplitParaphraseLeaks,
        status: crossSplitParaphraseLeaks === 0 ? "pass" : "fail",
      },
      {
        check: "Near-identical topology hash across train and test",
        expected: 0,
        actual: totalTopologyOverlap,
        status: totalTopologyOverlap === 0 ? "pass" : "fail",
      },
      {
        check: "External examples with unknown rights in released splits",
        expected: 0,
        actual: unknownRightsCount,
        status: unknownRightsCount === 0 ? "pass" : "fail",
      },
      {
        check: "Unapproved/generated records in gold split",
        expected: 0,
        actual: unapprovedCount,
        status: unapprovedCount === 0 ? "pass" : "fail",
      },
    ],
  }

  const auditPath = resolve(ROOT, "data/ai-copilot/phase2/reports/leakage-audit.json")
  writeFileSync(auditPath, JSON.stringify(auditReport, null, 2), "utf8")

  console.log(`\nAudit Results (Gate G7):`)
  for (const c of auditReport.checks) {
    console.log(`  [${c.status.toUpperCase()}] ${c.check}: actual=${c.actual}, expected=${c.expected}`)
  }

  console.log(`\nSplit Breakdown:`)
  console.log(`  Train:      ${splits.train.length} records (${(auditReport.metrics.splits.train.ratio * 100).toFixed(1)}%) in ${trainFamilies.size} families`)
  console.log(`  Validation: ${splits.validation.length} records (${(auditReport.metrics.splits.validation.ratio * 100).toFixed(1)}%) in ${valFamilies.size} families`)
  console.log(`  Test:       ${splits.test.length} records (${(auditReport.metrics.splits.test.ratio * 100).toFixed(1)}%) in ${testFamilies.size} families`)

  if (!auditReport.passed) {
    console.error(`\n❌ Split isolation audit FAILED. See: ${auditPath}`)
    process.exit(1)
  }

  console.log(`\n✅ Gate G7 PASSED: Zero unresolved data leakage. Report written to: ${auditPath}`)
  return auditReport
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  splitByFamily().catch((err) => {
    console.error("❌ Failed to split by family:", err)
    process.exit(1)
  })
}
