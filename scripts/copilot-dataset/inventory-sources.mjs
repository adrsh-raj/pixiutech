#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 SOURCE INVENTORY BUILDER (WP 2.1)
 * 
 * Audits and inventories all available internal candidate sources:
 * - Starter Templates from templates.ts
 * - Curriculum Missions from esp32, pico, microbit, and lesson-engine
 * - Diagnostic rules from circuit-doctor.ts
 * - Hardware components from pixiu-components-dataset.json
 * 
 * Produces: data/ai-copilot/phase2/reports/source-inventory.json
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getBundledModules, getCurrentCommitSha, ROOT } from "./bundle-helper.mjs"
import { getBuildTimestamp } from "./build-metadata.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export function resolveBoardContext({
  circuit,
  declaredBoard = null,
  defaultBoard,
  isBoardPart,
  circuitSource = "circuit_board_component",
  metadataSource = "lesson_metadata",
  defaultSource = "source_default",
}) {
  const boardPart = Array.isArray(circuit?.parts) ? circuit.parts.find((part) => isBoardPart(part.type)) : null
  const circuitBoard = boardPart?.type || null
  const boardId = circuitBoard || declaredBoard || defaultBoard
  const conflict = Boolean(circuitBoard && declaredBoard && circuitBoard !== declaredBoard)
  const resolution = circuitBoard
    ? { board_id: circuitBoard, source: circuitSource, explicit: true, used_fallback: false, declared_board: declaredBoard }
    : declaredBoard
      ? { board_id: declaredBoard, source: metadataSource, explicit: true, used_fallback: false }
      : { board_id: defaultBoard, source: defaultSource, explicit: false, used_fallback: true }
  return { boardId, circuitBoard, conflict, resolution }
}

export async function buildSourceInventory({ writeArtifact = true } = {}) {
  const commitSha = getCurrentCommitSha()
  const modules = await getBundledModules()
  const { templates, esp32, pico, microbit, lessons, doctor, boards, componentDataset } = modules
  const { validateProposedCircuit } = modules.validator

  const inventory = []
  const seenIds = new Set()

  // 1. Audit Starter Templates
  const templateList = templates.TEMPLATES || []
  for (const tmpl of templateList) {
    const candidateSourceId = "tmpl-" + tmpl.id
    if (seenIds.has(candidateSourceId)) throw new Error("Duplicate template source_id: " + candidateSourceId)
    const templateCircuit = tmpl.circuit || { parts: [], wires: [] }
    const boardContext = resolveBoardContext({
      circuit: templateCircuit,
      defaultBoard: "arduino-uno",
      isBoardPart: boards.isBoardPart,
      circuitSource: "circuit_board_component",
      defaultSource: "arduino_uno_default",
    })
    const targetBoard = boardContext.boardId
    const boardResolution = boardContext.resolution
    const validation = validateProposedCircuit(templateCircuit, { allowWarnings: true })

    const eligible = Boolean(templateCircuit.parts.length > 0 && validation.valid)
    const exclusionReason = templateCircuit.parts.length === 0
      ? "empty_circuit"
      : !validation.valid
      ? `validation_failed: ${validation.errors.join("; ")}`
      : null

    const entry = {
      source_id: `tmpl-${tmpl.id}`,
      original_id: tmpl.id,
      source_type: "pixiu_template",
      source_path: "pixiu-lms-portal/src/lib/templates.ts",
      source_revision: commitSha,
      title: tmpl.title,
      target_board: targetBoard,
      board_resolution: boardResolution,
      grade_band: tmpl.gradeBand || null,
      difficulty: tmpl.difficulty || "Intermediate",
      tags: tmpl.tags || [],
      part_count: templateCircuit.parts.length,
      wire_count: templateCircuit.wires?.length || 0,
      has_blockly: Boolean(tmpl.blocklyXml && tmpl.blocklyXml.trim().length > 0),
      disposition: eligible ? "eligible" : "excluded",
      exclusion_reason: exclusionReason,
    }

    seenIds.add(entry.source_id)
    inventory.push(entry)
  }

  // 2. Audit Curriculum Missions across all boards
  const curriculumSources = [
    { name: "esp32", list: esp32.ESP32_LESSONS || [], path: "pixiu-lms-portal/src/lib/curriculum/esp32-curriculum.ts", defaultBoard: "esp32-devkit" },
    { name: "pico", list: pico.PICO_LESSONS || [], path: "pixiu-lms-portal/src/lib/curriculum/pico-curriculum.ts", defaultBoard: "rpi-pico" },
    { name: "microbit", list: microbit.MICROBIT_LESSONS || [], path: "pixiu-lms-portal/src/lib/curriculum/microbit-curriculum.ts", defaultBoard: "microbit-v2" },
    { name: "uno", list: lessons.UNO_LESSONS || lessons.LESSONS || [], path: "pixiu-lms-portal/src/lib/lesson-engine.ts", defaultBoard: "arduino-uno" },
  ]

  for (const src of curriculumSources) {
    for (const lsn of src.list) {
      const sourceId = `mission-${lsn.id}`
      if (seenIds.has(sourceId)) throw new Error("Duplicate source_id across curriculum sources: " + sourceId)
      seenIds.add(sourceId)

      const seedCircuit = lsn.seedCircuit || (lsn.stages && lsn.stages[0]?.seedCircuit) || null
      const declaredBoard = lsn.board || null
      const boardContext = resolveBoardContext({
        circuit: seedCircuit,
        declaredBoard,
        defaultBoard: src.defaultBoard,
        isBoardPart: boards.isBoardPart,
        circuitSource: "seed_circuit_board_component",
        metadataSource: "lesson_metadata",
        defaultSource: "curriculum_default",
      })
      const circuitBoard = boardContext.circuitBoard
      const targetBoard = boardContext.boardId
      const boardConflict = boardContext.conflict
      const boardResolution = boardContext.resolution

      let eligible = false
      let exclusionReason = null

      if (boardConflict) {
        eligible = false
        exclusionReason = `board_context_conflict: lesson declares ${declaredBoard}, seed circuit contains ${circuitBoard}`
      } else if (!seedCircuit || !seedCircuit.parts || seedCircuit.parts.length === 0) {
        eligible = false
        exclusionReason = "no_seed_circuit"
      } else {
        const validation = validateProposedCircuit(seedCircuit, { allowWarnings: true })
        if (validation.valid) {
          eligible = true
        } else {
          eligible = false
          exclusionReason = `validation_failed: ${validation.errors.join("; ")}`
        }
      }

      const entry = {
        source_id: sourceId,
        original_id: lsn.id,
        source_type: "pixiu_mission",
        source_path: src.path,
        source_revision: commitSha,
        title: lsn.title || lsn.shortTitle || lsn.id,
        target_board: targetBoard,
        board_resolution: boardResolution,
        grade_band: lsn.grade || null,
        difficulty: lsn.difficulty || "Beginner",
        tags: lsn.tags || [src.name],
        part_count: seedCircuit?.parts?.length || 0,
        wire_count: seedCircuit?.wires?.length || 0,
        has_blockly: Boolean(lsn.seedBlocklyXml && lsn.seedBlocklyXml.trim().length > 0),
        disposition: eligible ? "eligible" : "excluded",
        exclusion_reason: exclusionReason,
      }

      inventory.push(entry)
    }
  }

  // Reference sources are tracked separately from candidate circuits. They inform validation
  // and provenance but are not counted as standalone positive training examples.
  const componentJsonPath = resolve(ROOT, "pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.json")
  const componentJson = JSON.parse(readFileSync(componentJsonPath, "utf8"))
  const typedComponents = componentDataset.PIXIU_COMPONENTS_DATASET || {}
  const jsonComponentIds = Object.keys(componentJson).sort()
  const typedComponentIds = Object.keys(typedComponents).sort()
  const missingFromTypedRegistry = jsonComponentIds.filter((id) => !typedComponentIds.includes(id))
  const missingFromJsonRegistry = typedComponentIds.filter((id) => !jsonComponentIds.includes(id))
  const registryAligned = missingFromTypedRegistry.length === 0 &&
    missingFromJsonRegistry.length === 0 && jsonComponentIds.length === typedComponentIds.length
  if (!registryAligned) {
    throw new Error("Component registry JSON/TypeScript mismatch: " + JSON.stringify({
      missingFromTypedRegistry, missingFromJsonRegistry,
    }))
  }

  const componentReferenceSources = jsonComponentIds.map((componentId) => {
    const component = componentJson[componentId]
    return {
      source_id: "component-" + componentId,
      source_type: "pixiu_component_reference",
      source_path: "pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.json",
      source_revision: commitSha,
      disposition: "reference_only",
      component_type: componentId,
      title: component.name || componentId,
      wiring_rule_ids: Array.isArray(component.wiringRules) ? component.wiringRules.map((rule) => rule.ruleId) : [],
    }
  })
  const diagnosticReferenceSources = [
    {
      source_id: "diagnostics-validate-proposed-circuit",
      source_type: "pixiu_diagnostic_reference",
      source_path: "pixiu-lms-portal/src/lib/circuit-validator.ts",
      source_revision: commitSha,
      disposition: "reference_only",
      exported_contract: "validateProposedCircuit",
      inventory_method: "rule IDs are emitted dynamically in validator notices; enumerate through tested fixtures",
    },
    {
      source_id: "diagnostics-circuit-doctor",
      source_type: "pixiu_diagnostic_reference",
      source_path: "pixiu-lms-portal/src/lib/circuit-doctor.ts",
      source_revision: commitSha,
      disposition: "reference_only",
      exported_contract: "diagnoseCircuit",
      inventory_method: "issue IDs are returned at runtime; enumerate through tested fixtures",
    },
  ]
  const referenceSources = [...componentReferenceSources, ...diagnosticReferenceSources]
  const componentWiringRuleCount = componentReferenceSources.reduce((sum, entry) => sum + entry.wiring_rule_ids.length, 0)

  // Summary Metrics
  const eligibleItems = inventory.filter((i) => i.disposition === "eligible")
  const excludedItems = inventory.filter((i) => i.disposition === "excluded")

  const report = {
    schema_version: "1.0.0",
    generated_at: getBuildTimestamp(),
    commit_sha: commitSha,
    summary: {
      total_sources_inventoried: inventory.length,
      eligible_candidates: eligibleItems.length,
      excluded_candidates: excludedItems.length,
      breakdown_by_type: {
        templates: inventory.filter((i) => i.source_type === "pixiu_template").length,
        templates_eligible: inventory.filter((i) => i.source_type === "pixiu_template" && i.disposition === "eligible").length,
        missions: inventory.filter((i) => i.source_type === "pixiu_mission").length,
        missions_eligible: inventory.filter((i) => i.source_type === "pixiu_mission" && i.disposition === "eligible").length,
      },
      breakdown_by_board: inventory.reduce((acc, i) => {
        if (i.disposition === "eligible") {
          acc[i.target_board] = (acc[i.target_board] || 0) + 1
        }
        return acc
      }, {}),
      reference_source_count: referenceSources.length,
      component_definition_count: componentReferenceSources.length,
      component_wiring_rule_count: componentWiringRuleCount,
      diagnostic_contract_count: diagnosticReferenceSources.length,
      component_registry_alignment: {
        status: registryAligned ? "pass" : "fail",
        json_component_count: jsonComponentIds.length,
        typed_component_count: typedComponentIds.length,
        missing_from_typed_registry: missingFromTypedRegistry,
        missing_from_json_registry: missingFromJsonRegistry,
      },
    },
    items: inventory,
    reference_sources: referenceSources,
  }

  if (writeArtifact) {
    const outDir = resolve(ROOT, "data/ai-copilot/phase2/reports")
    mkdirSync(outDir, { recursive: true })
    const outPath = resolve(outDir, "source-inventory.json")
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8")

    console.log("✅ Source inventory generated at: " + outPath)
    console.log("   - Total inventoried: " + report.summary.total_sources_inventoried)
    console.log("   - Eligible candidates: " + report.summary.eligible_candidates)
    console.log("   - Excluded candidates: " + report.summary.excluded_candidates)
  }

  return report
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildSourceInventory().catch((err) => {
    console.error("❌ Failed to build source inventory:", err)
    process.exit(1)
  })
}
