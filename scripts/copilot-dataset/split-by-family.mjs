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
import { getBuildTimestamp } from "./build-metadata.mjs"

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

  // Group records by family, then union families with identical topology
  // fingerprints so exact topology duplicates never cross split boundaries.
  const familyToRecords = new Map()
  for (const rec of allRecords) {
    if (!familyToRecords.has(rec.project_family_id)) familyToRecords.set(rec.project_family_id, [])
    familyToRecords.get(rec.project_family_id).push(rec)
  }
  const uniqueFamilies = Array.from(familyToRecords.keys())
  console.log("Identified " + uniqueFamilies.length + " unique project families.")
  const parent = new Map(uniqueFamilies.map((family) => [family, family]))
  const findRoot = (family) => {
    let root = family
    while (parent.get(root) !== root) root = parent.get(root)
    let current = family
    while (parent.get(current) !== current) {
      const next = parent.get(current)
      parent.set(current, root)
      current = next
    }
    return root
  }
  const union = (left, right) => {
    const a = findRoot(left), b = findRoot(right)
    if (a === b) return
    const ordered = [a, b].sort()
    parent.set(ordered[1], ordered[0])
  }
  const topologyFamilies = new Map()
  for (const rec of allRecords) {
    const topology = rec.hashes?.topology_hash
    if (!topology) throw new Error("Missing topology hash for " + rec.record_id)
    if (!topologyFamilies.has(topology)) topologyFamilies.set(topology, new Set())
    topologyFamilies.get(topology).add(rec.project_family_id)
  }
  for (const families of topologyFamilies.values()) {
    const list = Array.from(families)
    for (let i = 1; i < list.length; i++) union(list[0], list[i])
  }
  const clustersByRoot = new Map()
  for (const family of uniqueFamilies) {
    const root = findRoot(family)
    if (!clustersByRoot.has(root)) clustersByRoot.set(root, [])
    clustersByRoot.get(root).push(family)
  }
  const clusters = Array.from(clustersByRoot.entries()).map(([root, families]) => ({
    root, families: families.slice().sort(),
    records: families.flatMap((family) => familyToRecords.get(family)),
    key: families.slice().sort().join("|"),
  })).sort((a, b) => b.records.length - a.records.length || a.key.localeCompare(b.key))
  if (clusters.length < 3) throw new Error("At least three independent topology clusters are required for train/validation/test.")
  const targets = { train: allRecords.length * 0.652, validation: allRecords.length * 0.177, test: allRecords.length * 0.171 }
  const counts = { train: 0, validation: 0, test: 0 }
  const familySplitAssignment = new Map()
  const initial = ["train", "validation", "test"]
  clusters.forEach((cluster, index) => {
    const selected = index < 3 ? initial[index] : Object.keys(targets).sort((a, b) =>
      counts[a] / targets[a] - counts[b] / targets[b] || a.localeCompare(b)
    )[0]
    counts[selected] += cluster.records.length
    for (const family of cluster.families) familySplitAssignment.set(family, selected)
  })
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
  const canonicalRecords = readFileSync(resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
  const canonicalById = new Map(canonicalRecords.map((record) => [record.record_id, record]))
  let crossSplitParaphraseLeaks = 0
  for (const [splitKey, records] of Object.entries(splits)) {
    for (const rec of records) {
      const parentId = rec.variant?.parent_record_id
      if (!parentId) continue
      const parentRecord = canonicalById.get(parentId) || recordMap.get(parentId)
      if (!parentRecord || parentRecord.project_family_id !== rec.project_family_id ||
        familySplitAssignment.get(parentRecord.project_family_id) !== splitKey) crossSplitParaphraseLeaks++
    }
  }
  const topologySets = Object.fromEntries(Object.entries(splits).map(([name, records]) =>
    [name, new Set(records.map((record) => record.hashes.topology_hash))]
  ))
  const overlapCount = (left, right) => Array.from(topologySets[left]).filter((hash) => topologySets[right].has(hash)).length
  const topologyOverlapTrainVal = overlapCount("train", "validation")
  const topologyOverlapTrainTest = overlapCount("train", "test")
  const topologyOverlapValTest = overlapCount("validation", "test")
  const totalTopologyOverlap = topologyOverlapTrainVal + topologyOverlapTrainTest + topologyOverlapValTest
  const unknownRightsCount = allRecords.filter((record) =>
    !["internal_owned", "external_reviewed"].includes(record.permission?.status) ||
    record.permission?.review_status !== "approved"
  ).length

  // 6. Unapproved / unreviewed records in released splits
  const unapprovedCount = allRecords.filter((r) => r.review?.status !== "approved").length

  const auditReport = {
    audit_name: "Phase 2 Split Isolation and Data Leakage Audit",
    timestamp: getBuildTimestamp()
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
        check: "Exact topology fingerprint overlap across all split pairs",
        expected: 0,
        actual: totalTopologyOverlap,
        breakdown: { train_validation: topologyOverlapTrainVal, train_test: topologyOverlapTrainTest, validation_test: topologyOverlapValTest },
        status: totalTopologyOverlap === 0 ? "pass" : "fail",
      },
      {
        check: "Unknown/unapproved source-rights metadata in released splits",
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
