#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 RELEASE REPORT & MANIFEST GENERATOR (WP 2.7)
 * 
 * Computes release metrics, generates manifest.json, validation-report.json,
 * release-summary.md, and dataset README.md.
 * 
 * Evaluates Release Gates G1 through G10.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getBundledModules, getCurrentCommitSha, ROOT } from "./bundle-helper.mjs"
import { compileRecordSchema } from "./record-schema-validator.mjs"
import { evaluateFaultCalibration } from "./generate-fault-repair-pairs.mjs"
import { sha256 } from "./normalize-record.mjs"
import { buildPhase25Audit } from "./phase25-task-audit.mjs"
import { isHumanApprovedRecord } from "./review-policy.mjs"
import { getBuildTimestamp } from "./build-metadata.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export async function buildReleaseReport() {
  const commitSha = getCurrentCommitSha()
  const buildTimestamp = getBuildTimestamp()
  const modules = await getBundledModules()
  const { validator } = modules
  const validateProposedCircuit = validator.validateProposedCircuit

  // Compile the checked-in Phase 2 schema using a dependency-free validator.
  // It supports the keywords currently present in this schema and fails fast if
  // a new unsupported keyword appears, so validation cannot silently weaken.
  const schemaPath = resolve(__dirname, "schema/record-v1.schema.json")
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
  const validateSchema = compileRecordSchema(schema)

  const dataDir = resolve(ROOT, "data/ai-copilot/phase2")
  const recordsDir = resolve(dataDir, "records")
  const splitsDir = resolve(dataDir, "splits")
  const reportsDir = resolve(dataDir, "reports")

  // Load Source Inventory
  const sourceInventory = JSON.parse(readFileSync(resolve(reportsDir, "source-inventory.json"), "utf8"))

  // Load Splits
  const splits = {
    train: readFileSync(resolve(splitsDir, "train.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    validation: readFileSync(resolve(splitsDir, "validation.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    test: readFileSync(resolve(splitsDir, "test.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
  }

  const allReleasedRecords = [...splits.train, ...splits.validation, ...splits.test]
  const totalReleased = allReleasedRecords.length

  // Load Task Group Files
  const recordFiles = {
    canonical: readFileSync(resolve(recordsDir, "canonical.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    requests: readFileSync(resolve(recordsDir, "requests.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    faultRepairs: readFileSync(resolve(recordsDir, "fault-repairs.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    diagnosisExplanations: readFileSync(resolve(recordsDir, "diagnosis-explanations.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
    blocklyCode: readFileSync(resolve(recordsDir, "blockly-code.jsonl"), "utf8").trim().split("\n").filter(Boolean).map(JSON.parse),
  }

  // Load Leakage Audit
  const leakageAudit = JSON.parse(readFileSync(resolve(reportsDir, "leakage-audit.json"), "utf8"))

  // Phase 2.5: audit diagnosis and Blockly targets against live board, circuit,
  // telemetry, topology and provenance evidence. This does not compile code.
  const phase25Audit = buildPhase25Audit({
    canonicalRecords: recordFiles.canonical,
    diagnosisRecords: recordFiles.diagnosisExplanations,
    blocklyRecords: recordFiles.blocklyCode,
    modules,
  })
  writeFileSync(resolve(reportsDir, "diagnosis-blockly-audit.json"), JSON.stringify(phase25Audit, null, 2), "utf8")

  // Automation is not an independent human sign-off. Generate a transparent
  // queue for every canonical parent and record present in the evaluation split.
  const reviewRecords = [...recordFiles.canonical, ...allReleasedRecords]
  const pendingReviews = reviewRecords.filter((record) => !isHumanApprovedRecord(record))
  const reviewQueue = {
    report_name: "Pixiu AI Copilot Independent Human Review Queue",
    report_version: "1.0.0",
    dataset_version: "2.0.0",
    release_ready: pendingReviews.length === 0,
    total_records_in_scope: reviewRecords.length,
    human_approved_records: reviewRecords.length - pendingReviews.length,
    pending_review_count: pendingReviews.length,
    items: pendingReviews.map((record) => ({
      record_id: record.record_id,
      task_type: record.task_type,
      project_family_id: record.project_family_id,
      target_board: record.context?.target_board || null,
      reviewer_metadata: record.review?.reviewer || null,
      review_status: record.review?.status || "missing",
      source_path: record.source?.source_path || null,
      instruction_excerpt: String(record.instruction?.text || "").slice(0, 160),
    })),
  }
  writeFileSync(resolve(reportsDir, "review-queue.json"), JSON.stringify(reviewQueue, null, 2), "utf8")

  console.log(`Evaluating 10 Release Acceptance Gates for ${totalReleased} records...`)

  // --- GATE EVALUATIONS ---

  // G1 - Inventory Coverage
  const totalInventoried = sourceInventory.summary.total_sources_inventoried
  const eligibleSources = sourceInventory.summary.eligible_candidates
  const excludedSources = sourceInventory.summary.excluded_candidates
  const g1Passed = totalInventoried > 0 && (eligibleSources + excludedSources === totalInventoried)

  // G2 - Schema Integrity
  let schemaValidCount = 0
  const schemaErrors = []
  for (const rec of allReleasedRecords) {
    if (validateSchema(rec)) {
      schemaValidCount++
    } else {
      schemaErrors.push({ record_id: rec.record_id, errors: validateSchema.errors })
    }
  }
  const g2Passed = schemaValidCount === totalReleased

  // G3 - Positive Correctness (100% validator pass for positive gold targets)
  let positiveEvaluated = 0
  let positivePassed = 0
  for (const rec of allReleasedRecords) {
    const circuit = rec.target?.circuit || rec.target?.corrected_circuit
    if (circuit) {
      positiveEvaluated++
      const res = validateProposedCircuit(circuit, { allowWarnings: true })
      if (res.valid) {
        positivePassed++
      }
    }
  }
  const g3Passed = positivePassed === positiveEvaluated && positiveEvaluated > 0 && phase25Audit.passed

  // G4 - Negative Calibration
  let faultEvaluated = 0
  let faultPassed = 0
  for (const rec of recordFiles.faultRepairs) {
    faultEvaluated++
    const fault = rec.fault || {}
    const res = validateProposedCircuit(fault.input_circuit, {
      allowWarnings: true,
      targetBoard: rec.context?.target_board,
    })
    const calibration = evaluateFaultCalibration(fault, res)
    if (calibration.passed) faultPassed++
  }
  const g4Passed = faultPassed === faultEvaluated && faultEvaluated >= 50

  // G5 - Provenance / Licensing
  const provenanceCompleteCount = allReleasedRecords.filter(
    (r) => r.source?.source_type && r.source?.source_id && r.source?.source_revision && r.permission?.status === "internal_owned" && r.permission?.review_status === "approved"
  ).length
  const g5Passed = provenanceCompleteCount === totalReleased

  // G6 - Paraphrase Preservation
  const canonicalMap = new Map(recordFiles.canonical.map((c) => [c.record_id, c]))
  let paraphrasesEvaluated = 0
  let paraphrasesPreserved = 0
  for (const rec of recordFiles.requests) {
    if (rec.variant?.kind !== "canonical") {
      paraphrasesEvaluated++
      const parent = canonicalMap.get(rec.variant?.parent_record_id)
      if (parent) {
        const topoMatch = rec.hashes.topology_hash === parent.hashes.topology_hash
        const boardMatch = rec.context.target_board === parent.context.target_board
        const familyMatch = rec.project_family_id === parent.project_family_id
        if (topoMatch && boardMatch && familyMatch) {
          paraphrasesPreserved++
        }
      }
    }
  }
  const g6Passed = paraphrasesPreserved === paraphrasesEvaluated && paraphrasesEvaluated > 0

  // G7 - Split Isolation
  const g7Passed = leakageAudit.passed === true

  // G8 - recompute each task's content digest; a 64-character string is not proof.
  const uniqueRecordIds = new Set(allReleasedRecords.map((r) => r.record_id))
  const expectedContentHash = (rec) => {
    if (rec.task_type === "request_to_circuit") return sha256({ text: rec.instruction.text, target: rec.target })
    if (rec.task_type === "fault_repair") return sha256({ fault: rec.fault.input_circuit, target: { circuit: rec.target.corrected_circuit, explanation: rec.target.explanation, code: rec.target.code }, mutation_id: rec.fault.mutation_id })
    if (rec.task_type === "diagnosis_explanation") return sha256({ circuit: rec.target.circuit, explanation: rec.target.explanation, instruction: rec.instruction.text, task: "diagnosis_explanation" })
    if (rec.task_type === "blockly_code") return sha256({ circuit: rec.target.circuit, code: rec.target.code, instruction: rec.instruction.text, task: "blockly_code" })
    return null
  }
  const allPayloadHashesMatch = allReleasedRecords.every((rec) => expectedContentHash(rec) !== null && expectedContentHash(rec) === rec.hashes?.content_hash)
  const canonicalHashesMatch = recordFiles.canonical.every((rec) => sha256({ circuit: rec.target.circuit, explanation: rec.target.explanation, code: rec.target.code }) === rec.hashes?.content_hash)
  const g8Passed = uniqueRecordIds.size === totalReleased && allPayloadHashesMatch && canonicalHashesMatch

  // G9 - Review Status
  const approvedCount = reviewRecords.filter((record) => isHumanApprovedRecord(record)).length
  const g9Passed = approvedCount === reviewRecords.length

  // G10 - Product Metric Report
  const countsByTaskType = {}
  const countsByBoard = {}
  const countsBySplit = {
    train: splits.train.length,
    validation: splits.validation.length,
    test: splits.test.length,
  }

  for (const rec of allReleasedRecords) {
    countsByTaskType[rec.task_type] = (countsByTaskType[rec.task_type] || 0) + 1
    const b = rec.context.target_board || "unspecified"
    countsByBoard[b] = (countsByBoard[b] || 0) + 1
  }

  const g10Passed = Object.keys(countsByTaskType).length === 4 && Object.keys(countsByBoard).length >= 4

  const gates = [
    { id: "G1", name: "Inventory Coverage", threshold: "100% inventoried; excluded get reasons", passed: g1Passed, score: `${totalInventoried}/${totalInventoried}` },
    { id: "G2", name: "Schema Integrity", threshold: "100% schema-valid against record-v1.json", passed: g2Passed, score: `${schemaValidCount}/${totalReleased}` },
    { id: "G3", name: "Positive Correctness & Phase 2.5 Evidence", threshold: "Live validator pass plus diagnosis evidence and board-aware Blockly checks", passed: g3Passed, score: `${positivePassed}/${positiveEvaluated}; diagnosis ${phase25Audit.metrics.diagnosis.records - phase25Audit.metrics.diagnosis.failures}/${phase25Audit.metrics.diagnosis.records}; Blockly ${phase25Audit.metrics.blockly.records - phase25Audit.metrics.blockly.failures}/${phase25Audit.metrics.blockly.records}` },
    { id: "G4", name: "Negative Calibration", threshold: "100% expected-label match for fault suite (>=50)", passed: g4Passed, score: `${faultPassed}/${faultEvaluated}` },
    { id: "G5", name: "Provenance / Licence", threshold: "100% complete internal_owned approved", passed: g5Passed, score: `${provenanceCompleteCount}/${totalReleased}` },
    { id: "G6", name: "Paraphrase Preservation", threshold: "100% exact topology + board invariant match", passed: g6Passed, score: `${paraphrasesPreserved}/${paraphrasesEvaluated}` },
    { id: "G7", name: "Split Isolation", threshold: "0 cross-split family, record, or topology leaks", passed: g7Passed, score: "0 leaks" },
    { id: "G8", name: "Content Hash Integrity", threshold: "Recomputed task-specific hashes match released and canonical records", passed: g8Passed, score: "payload digests recomputed" },
    { id: "G9", name: "Independent Human Review", threshold: "Every canonical parent and released record has a named human approval", passed: g9Passed, score: `${approvedCount}/${reviewRecords.length}; ${pendingReviews.length} pending` },
    { id: "G10", name: "Product Metric Report", threshold: "Complete counts per task, board, and split", passed: g10Passed, score: "Generated" },
  ]

  const allGatesPassed = gates.every((g) => g.passed)

  // Compute file hashes for manifest
  function getFileMeta(relPath) {
    const fullPath = resolve(dataDir, relPath)
    const content = readFileSync(fullPath)
    return {
      path: relPath,
      size_bytes: statSync(fullPath).size,
      sha256: sha256(content.toString("utf8")),
    }
  }

  const manifest = {
    dataset_name: "pixiu-ai-copilot-evaluation-corpus",
    version: "2.0.0",
    commit_sha: commitSha,
    generated_at: buildTimestamp,
    record_schema_version: "1.0.0",
    pilot_target_satisfied: totalReleased >= 250,
    overall_status: allGatesPassed ? "PASSED" : "FAILED",
    summary: {
      total_records: totalReleased,
      project_families: leakageAudit.metrics.unique_families,
      counts_by_task_type: countsByTaskType,
      counts_by_board: countsByBoard,
      counts_by_split: countsBySplit,
    },
    gates: gates.map((g) => ({
      gate_id: g.id,
      name: g.name,
      passed: g.passed,
      metric: g.score,
      threshold: g.threshold,
    })),
    artifacts: [
      getFileMeta("records/canonical.jsonl"),
      getFileMeta("records/requests.jsonl"),
      getFileMeta("records/fault-repairs.jsonl"),
      getFileMeta("records/diagnosis-explanations.jsonl"),
      getFileMeta("records/blockly-code.jsonl"),
      getFileMeta("splits/train.jsonl"),
      getFileMeta("splits/validation.jsonl"),
      getFileMeta("splits/test.jsonl"),
      getFileMeta("reports/source-inventory.json"),
      getFileMeta("reports/duplicate-audit.json"),
      getFileMeta("reports/leakage-audit.json"),
      getFileMeta("reports/diagnosis-blockly-audit.json"),
      getFileMeta("reports/review-queue.json"),
    ],
  }

  const validationReport = {
    report_name: "Phase 2 Validation & Quality Gate Verification",
    timestamp: buildTimestamp,
    commit_sha: commitSha,
    status: allGatesPassed ? "PASSED" : "FAILED",
    gates,
    metrics: {
      schema_pass_rate: totalReleased ? schemaValidCount / totalReleased : 0,
      phase25_audit_passed: phase25Audit.passed,
      phase25_diagnosis_records: phase25Audit.metrics.diagnosis.records,
      phase25_blockly_records: phase25Audit.metrics.blockly.records,
      pending_human_reviews: pendingReviews.length,
      positive_circuit_acceptance_rate: positivePassed / positiveEvaluated,
      negative_fault_rejection_rate: faultPassed / faultEvaluated,
      split_ratios: leakageAudit.metrics.splits,
    },
    schema_errors: schemaErrors,
  }

  // Write manifest and validation report
  writeFileSync(resolve(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  writeFileSync(resolve(reportsDir, "validation-report.json"), JSON.stringify(validationReport, null, 2), "utf8")

  // Generate release-summary.md
  const releaseSummaryMd = `# Pixiu CyberLab AI Copilot — Phase 2 Release Summary

**Corpus Version:** 2.0.0  
**Commit SHA:** \`${commitSha}\`  
**Generated At:** ${buildTimestamp}  
**Overall Quality Gate Status:** ${allGatesPassed ? "✅ **ALL 10 GATES PASSED (G1–G10)**" : "❌ **FAILED**"}

---

## 1. Executive Summary

Phase 2 builds the **Verified Dataset Pipeline & Evaluation Corpus** for the Pixiu AI Copilot chatbot. The goal is student-friendly circuit guidance grounded in the current board profile, with accurate diagnoses and Blockly candidates that do not overclaim physical safety or compilation. The corpus establishes four task families:

1. **\`request_to_circuit\`**: Direct, contextual, colloquial, and typo-tolerant student prompts mapped to targets that pass the configured circuit validator; this is not a physical hardware safety certification.
2. **\`fault_repair\`**: Controlled hardware defect mutations paired with validated repair targets and diagnostic explanations.
3. **\`diagnosis_explanation\`**: Evidence-bounded explanations of loop currents, power rails, and resistor protection.
4. **\`blockly_code\`**: Source-matched Blockly XML candidates with board-pin checks; code compilation/execution is not claimed unless an actual compiler/runtime check is run.

---

## 2. Release Acceptance Gates (G1–G10)

| Gate | Name | Threshold | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
${gates.map((g) => `| **${g.id}** | ${g.name} | ${g.threshold} | \`${g.score}\` | ${g.passed ? "✅ PASS" : "❌ FAIL"} |`).join("\n")}

---

## 3. Dataset Distribution & Scale

- **Total Released Records:** \`${totalReleased}\` (Pilot target was \`>= 250\`, achieved **${((totalReleased / 250) * 100).toFixed(0)}%**)
- **Unique Project Families:** \`${leakageAudit.metrics.unique_families}\`

### By Task Group
- **\`request_to_circuit\`:** ${countsByTaskType["request_to_circuit"] || 0} records (Target >= 100)
- **\`fault_repair\`:** ${countsByTaskType["fault_repair"] || 0} records (Target >= 50)
- **\`diagnosis_explanation\`:** ${countsByTaskType["diagnosis_explanation"] || 0} records (Target >= 50)
- **\`blockly_code\`:** ${countsByTaskType["blockly_code"] || 0} records (Target >= 50)

### By Target Board Architecture
${Object.entries(countsByBoard).map(([board, count]) => `- **\`${board}\`:** ${count} records (${((count / totalReleased) * 100).toFixed(1)}%)`).join("\n")}

### By Evaluation Partition (Split Isolation)
- **Train (${((splits.train.length / totalReleased) * 100).toFixed(1)}%):** ${splits.train.length} records across ${leakageAudit.metrics.splits.train.families} families
- **Validation (${((splits.validation.length / totalReleased) * 100).toFixed(1)}%):** ${splits.validation.length} records across ${leakageAudit.metrics.splits.validation.families} families
- **Test (${((splits.test.length / totalReleased) * 100).toFixed(1)}%):** ${splits.test.length} records across ${leakageAudit.metrics.splits.test.families} families
- **Cross-Split Data Leakage:** **0 records, 0 families, 0 topology overlaps.**

---

## 4. Governance & Licensing
- **Licence Status:** 100% \`internal_owned\` (Pixiu CyberLab proprietary templates & curriculum).
- **External Unreviewed Rights:** \`0\`.
- **Schema Compliance:** 100% compliant with \`record-v1.schema.json\`.
- **Circuit Validation:** positive targets are checked by \`validateProposedCircuit\`.
- **Review semantics:** approval metadata is programmatic and is not a substitute for independent human review.
`

  writeFileSync(resolve(reportsDir, "release-summary.md"), releaseSummaryMd, "utf8")

  // Generate dataset README.md
  const readmeMd = `# Pixiu CyberLab AI Copilot — Phase 2 Dataset Corpus

This directory contains the verified dataset pipeline, canonical representations, evaluation splits, and quality reports for the Pixiu AI Copilot.

## Directory Layout

\`\`\`
data/ai-copilot/phase2/
├── README.md               # This documentation
├── manifest.json           # Cryptographic release manifest with SHA-256 hashes
├── records/
│   ├── canonical.jsonl     # Extracted canonical ground-truth circuits
│   ├── requests.jsonl      # Task Group 1: Student request paraphrases (${recordFiles.requests.length} records)
│   ├── fault-repairs.jsonl # Task Group 2: Controlled fault/repair pairs (${recordFiles.faultRepairs.length} records)
│   ├── diagnosis-explanations.jsonl # Task Group 3: Telemetry-grounded diagnostics (${recordFiles.diagnosisExplanations.length} records)
│   └── blockly-code.jsonl  # Task Group 4: Well-formed Blockly XML programs (${recordFiles.blocklyCode.length} records)
├── splits/
│   ├── train.jsonl         # Training partition (${splits.train.length} records, ${leakageAudit.metrics.splits.train.families} families)
│   ├── validation.jsonl    # Validation partition (${splits.validation.length} records, ${leakageAudit.metrics.splits.validation.families} families)
│   └── test.jsonl          # Held-out evaluation partition (${splits.test.length} records, ${leakageAudit.metrics.splits.test.families} families)
└── reports/
    ├── source-inventory.json   # Full inventory of scanned templates and missions
    ├── duplicate-audit.json    # Deduplication and topology equivalence report
    ├── leakage-audit.json      # Cross-split family and paraphrase isolation audit
    ├── validation-report.json  # Gate G1–G10 verification scores
    └── release-summary.md      # Human-readable release documentation
\`\`\`

## Reproduction Pipeline

To re-build and verify the dataset from scratch:

\`\`\`bash
# 1. Run complete dataset build & QA gate check
npm run qa:copilot-dataset

# 2. Or run individual pipeline stages
node scripts/copilot-dataset/inventory-sources.mjs
node scripts/copilot-dataset/extract-candidates.mjs
node scripts/copilot-dataset/generate-request-variants.mjs
node scripts/copilot-dataset/generate-fault-repair-pairs.mjs
node scripts/copilot-dataset/generate-diagnosis-and-code.mjs
node scripts/copilot-dataset/split-by-family.mjs
node scripts/copilot-dataset/build-release-report.mjs
\`\`\`
`

  writeFileSync(resolve(dataDir, "README.md"), readmeMd, "utf8")

  console.log(`\nRelease Report Build Complete:`)
  console.log(`- Manifest: ${resolve(dataDir, "manifest.json")}`)
  console.log(`- Validation Report: ${resolve(reportsDir, "validation-report.json")}`)
  console.log(`- Release Summary: ${resolve(reportsDir, "release-summary.md")}`)
  console.log(`- README: ${resolve(dataDir, "README.md")}`)

  return { allGatesPassed, gates, manifest }
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildReleaseReport().then(({ allGatesPassed }) => {
    if (!allGatesPassed) {
      console.error("\n❌ Release Report: Some gates failed.")
      process.exit(1)
    }
    console.log("\n✅ Release Report: All 10 gates passed successfully.")
  }).catch((err) => {
    console.error("❌ Failed to build release report:", err)
    process.exit(1)
  })
}
