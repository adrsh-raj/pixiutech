#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 DIAGNOSIS & BLOCKLY CODE GENERATOR (WP 2.5)
 * 
 * Generates evidence-grounded diagnosis candidates (Group 3) and source-matched
 * Blockly XML candidates (Group 4). Compile/execution is explicitly not tested.
 * 
 * Produces:
 * - data/ai-copilot/phase2/records/diagnosis-explanations.jsonl (Target >= 50)
 * - data/ai-copilot/phase2/records/blockly-code.jsonl (Target >= 50)
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getBundledModules, ROOT } from "./bundle-helper.mjs"
import { sha256 } from "./normalize-record.mjs"
import { getBuildTimestamp } from "./build-metadata.mjs"
import { buildPhase25Audit, isWellFormedBlocklyXml } from "./phase25-task-audit.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


/**
 * Clean string for identifier use.
 */
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

/**
 * Format telemetry findings into an evidence-bounded diagnosis explanation.
 */
function buildDiagnosisExplanation(canonicalRecord, telemetry, healthReport, variantIndex) {
  const boardName = telemetry.board?.name || String(canonicalRecord.context.target_board || "Microcontroller")
  const diagnostics = telemetry.diagnostics || {}
  const rails = telemetry.powerRails || {}
  const components = Array.isArray(telemetry.components) ? telemetry.components : []
  const healthScore = diagnostics.healthScore ?? healthReport.score ?? 0
  const healthStatus = diagnostics.healthStatus ?? healthReport.status ?? "unknown"
  const railText = []
  if (typeof rails.rail5v === "number") railText.push("5V=" + rails.rail5v + "V")
  if (typeof rails.rail3v3 === "number") railText.push("3.3V=" + rails.rail3v3 + "V")
  if (typeof rails.battery9v === "number") railText.push("battery=" + rails.battery9v + "V")
  railText.push("GND reference=" + Number(rails.gnd ?? 0).toFixed(2) + "V")
  const componentLines = components.map((component) => {
    const details = Object.entries(component.details || {}).map(([key, value]) => key + "=" + String(value)).join(", ")
    return "- " + component.partId + " (" + component.type + "): " + component.status +
      " [truth=" + component.truth + "]" + (details ? " {" + details + "}" : "")
  })
  const issues = Array.isArray(healthReport.issues) ? healthReport.issues : []
  const issueLines = issues.length
    ? issues.slice(0, 10).map((issue) =>
        "- " + issue.severity.toUpperCase() + ": " + issue.title + " — " + issue.message +
        (issue.suggestion ? " Suggested action: " + issue.suggestion : "") + " [static-rule-inference]"
      )
    : ["- No issue was returned by the configured static checks. This is not a physical-hardware safety certification."]
  return [
    "[" + (variantIndex === 0 ? "Circuit Diagnostic Analysis" : "Electrical Safety and Nodal Review") + " for " + boardName + "]",
    "Board logic reference: " + (telemetry.board && typeof telemetry.board.logicVoltage === "number" ? telemetry.board.logicVoltage + "V" : "not recorded") + " [static-rule-inference]",
    "Circuit Doctor snapshot: " + healthScore + "/100 (" + healthStatus + ") [static-rule-inference]",
    "Simulated rail snapshot: " + railText.join("; ") + " [simulated; not a physical measurement]",
    "Component telemetry:",
    componentLines.length ? componentLines.join("\n") : "- No component telemetry entries were returned.",
    "Circuit Doctor findings (" + issues.length + "):",
    issueLines.join("\n"),
    "Scope: this describes a simulated/static snapshot. Re-run validation against the current circuit before acting; it does not certify physical hardware as safe.",
  ].join("\n")
}

/**
 * Generate Blockly code explanation.
 */
function buildBlocklyExplanation(canonicalRecord) {
  const board = canonicalRecord.context.target_board || "microcontroller";
  const instruction = canonicalRecord.instruction.text;
  return "Source-matched Blockly XML candidate for '" + instruction + "' targeting " + board +
    ". XML shape, board pin references and circuit rules are audited; compile status not tested.";
}
export async function generateDiagnosisAndCode({
  writeArtifacts = false,
  canonicalRecords: suppliedCanonicalRecords = null,
  modules: suppliedModules = null,
  reviewedAt = getBuildTimestamp(),
} = {}) {
  const modules = suppliedModules || await getBundledModules();
  const { telemetry, doctor, validator } = modules;
  const canonicalPath = resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl");
  const canonicalRecords = suppliedCanonicalRecords || readFileSync(canonicalPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (!Array.isArray(canonicalRecords) || canonicalRecords.length === 0) throw new Error("Canonical record source is empty.");
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new Error("reviewedAt must be a valid timestamp.");

  console.log("Loaded " + canonicalRecords.length + " canonical records for Phase 2.5 generation...");
  const diagnosisRecords = []
  const blocklyRecords = []

  for (const parent of canonicalRecords) {
    const circuit = parent.target.circuit
    const healthReport = doctor.diagnoseCircuit(circuit)
    const rawTelemetry = telemetry.serializeCircuitTelemetry({ circuit, healthReport })
    const circuitValidation = validator.validateProposedCircuit(circuit, { allowWarnings: true, targetBoard: parent.context?.target_board })

    const cleanId = slugify(parent.source.source_id)

    // Generate 2 diagnosis variants per canonical record
    const diagInstructions = [
      `Diagnose the circuit health and pin connections for: ${parent.instruction.text}.`,
      `Analyze the telemetry, voltage rails, and electrical safety for this ${parent.context.target_board || "microcontroller"} schematic.`,
    ]

    for (let v = 0; v < diagInstructions.length; v++) {
      const explanation = buildDiagnosisExplanation(parent, rawTelemetry, healthReport, v)
      const recordId = `pxai2-diag-${cleanId}-${v}`
      const contentHash = sha256({
        circuit,
        explanation,
        instruction: diagInstructions[v],
        task: "diagnosis_explanation",
      })

      diagnosisRecords.push({
        record_id: recordId,
        record_schema_version: "1.0.0",
        task_type: "diagnosis_explanation",
        project_family_id: parent.project_family_id,
        source: {
          source_type: "pixiu_diagnostic",
          source_path: parent.source.source_path,
          source_id: `${parent.source.source_id}#diag-${v}`,
          source_revision: parent.source.source_revision,
        },
        permission: {
          status: "internal_owned",
          review_status: "approved",
        },
        context: {
          ...parent.context,
        },
        instruction: {
          text: diagInstructions[v],
        },
        target: {
          circuit,
          explanation,
          code: null,
        },
        validation: {
          status: circuitValidation.valid ? "pass" : "reject",
          validator_version: "1.0.0",
          errors: circuitValidation.errors || [],
          warnings: circuitValidation.warnings || [],
        },
        capabilities: {
          simulation: "supported",
          compile: "not_tested",
        },
        review: {
          status: "in_review",
          reviewer: "automated-circuit-doctor-audit",
          reviewed_at: reviewedAt
        },
        variant: {
          kind: v === 0 ? "canonical" : "paraphrase",
          parent_record_id: parent.record_id,
        },
        hashes: {
          source_hash: parent.hashes.source_hash,
          topology_hash: parent.hashes.topology_hash,
          content_hash: contentHash,
        },
        limitations: parent.limitations || [],
      })
    }

    // Generate 2 Blockly code variants per canonical record (if valid code exists)
    if (parent.target.code && isWellFormedBlocklyXml(parent.target.code)) {
      const codeInstructions = [
        `Write a Blockly program for: ${parent.instruction.text}.`,
        `Generate visual logic blocks in Blockly to operate this ${parent.context.target_board || "microcontroller"} circuit.`,
      ]

      for (let v = 0; v < codeInstructions.length; v++) {
        const explanation = buildBlocklyExplanation(parent)
        const blocklyValidation = validator.validateProposedCircuit({ ...circuit, blocklyXml: parent.target.code }, { allowWarnings: true, targetBoard: parent.context?.target_board })
        if (!blocklyValidation.valid) throw new Error("Blockly XML failed validator checks for " + parent.record_id + ": " + blocklyValidation.errors.join("; "))
        const recordId = `pxai2-code-${cleanId}-${v}`
        const contentHash = sha256({
          circuit,
          code: parent.target.code,
          instruction: codeInstructions[v],
          task: "blockly_code",
        })

        blocklyRecords.push({
          record_id: recordId,
          record_schema_version: "1.0.0",
          task_type: "blockly_code",
          project_family_id: parent.project_family_id,
          source: {
            source_type: parent.source.source_type,
            source_path: parent.source.source_path,
            source_id: `${parent.source.source_id}#code-${v}`,
            source_revision: parent.source.source_revision,
          },
          permission: {
            status: "internal_owned",
            review_status: "approved",
          },
          context: {
            ...parent.context,
          },
          instruction: {
            text: codeInstructions[v],
          },
          target: {
            circuit,
            explanation,
            code: parent.target.code,
          },
          validation: {
            status: blocklyValidation.valid ? "pass" : "reject",
            validator_version: "1.0.0",
            errors: blocklyValidation.errors || [],
            warnings: blocklyValidation.warnings || [],
          },
          capabilities: {
            simulation: "not_tested",
            compile: "not_tested",
          },
          review: {
            status: "in_review",
            reviewer: "automated-blockly-source-audit",
            reviewed_at: reviewedAt
          },
          variant: {
            kind: v === 0 ? "canonical" : "paraphrase",
            parent_record_id: parent.record_id,
          },
          hashes: {
            source_hash: parent.hashes.source_hash,
            topology_hash: parent.hashes.topology_hash,
            content_hash: contentHash,
          },
          limitations: parent.limitations || [],
        })
      }
    }
  }

  const taskAudit = buildPhase25Audit({ canonicalRecords, diagnosisRecords, blocklyRecords, modules });
  if (!taskAudit.passed) {
    const issueCounts = taskAudit.issues.reduce((counts, issue) => {
      counts[issue.code] = (counts[issue.code] || 0) + 1;
      return counts;
    }, {});
    throw new Error("Phase 2.5 diagnosis/Blockly audit failed; candidate records were not written: " +
      JSON.stringify({
        metrics: taskAudit.metrics,
        issue_counts: Object.fromEntries(Object.entries(issueCounts).sort(([a], [b]) => a.localeCompare(b))),
        issues: taskAudit.issues.slice(0, 20),
      }, null, 2));
  }

  if (writeArtifacts) {
    const diagOutPath = resolve(ROOT, "data/ai-copilot/phase2/records/diagnosis-explanations.jsonl");
    const codeOutPath = resolve(ROOT, "data/ai-copilot/phase2/records/blockly-code.jsonl");
    writeFileSync(diagOutPath, diagnosisRecords.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
    writeFileSync(codeOutPath, blocklyRecords.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
    console.log("Wrote " + diagnosisRecords.length + " diagnosis and " + blocklyRecords.length + " Blockly candidate records.");
    console.log("Generated records remain in_review until an independent human approves them.");
  } else {
    console.log("Read-only Phase 2.5 audit passed: " + diagnosisRecords.length + " diagnosis records, " +
      blocklyRecords.length + " Blockly records; no files were written.");
  }
  console.log("Phase 2.5 audit metrics: " + JSON.stringify(taskAudit.metrics));
  return { diagnosisRecords, blocklyRecords, taskAudit, wroteArtifacts: writeArtifacts };
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateDiagnosisAndCode({ writeArtifacts: process.argv.includes("--write") }).catch((err) => {
    console.error("❌ Failed to generate diagnosis and blockly code records:", err)
    process.exit(1)
  })
}
