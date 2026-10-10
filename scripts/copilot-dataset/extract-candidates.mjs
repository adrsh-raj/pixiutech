#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 CANONICAL CANDIDATE EXTRACTOR (WP 2.2)
 * 
 * Extracts eligible templates and missions into canonical records.
 * Deduplicates exact & topology duplicates and assigns family IDs.
 * 
 * Produces:
 * - data/ai-copilot/phase2/records/canonical.jsonl
 * - data/ai-copilot/phase2/reports/duplicate-audit.json
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getBundledModules, getCurrentCommitSha, ROOT } from "./bundle-helper.mjs"
import { buildSourceInventory } from "./inventory-sources.mjs"
import { createCanonicalRecord } from "./normalize-record.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function extractCanonicalCandidates() {
  const commitSha = getCurrentCommitSha()
  const modules = await getBundledModules()
  const { templates, esp32, pico, microbit, lessons, boards } = modules
  const { validateProposedCircuit, resolveCanonicalPin } = modules.validator

  // Ensure inventory is up to date
  const inventoryReport = await buildSourceInventory()
  const eligibleItems = inventoryReport.items.filter((i) => i.disposition === "eligible")

  // Fast lookups
  const templateMap = new Map((templates.TEMPLATES || []).map((t) => [`tmpl-${t.id}`, t]))
  const missionMap = new Map()

  const addMissions = (list, srcPath) => {
    for (const m of list) {
      missionMap.set(`mission-${m.id}`, { mission: m, srcPath })
    }
  }
  addMissions(esp32.ESP32_LESSONS || [], "esp32-curriculum.ts")
  addMissions(pico.PICO_LESSONS || [], "pico-curriculum.ts")
  addMissions(microbit.MICROBIT_LESSONS || [], "microbit-curriculum.ts")
  addMissions(lessons.UNO_LESSONS || lessons.LESSONS || [], "lesson-engine.ts")

  const canonicalRecords = []
  const topologyFamilyMap = new Map() // topology_hash -> canonical family_id
  const duplicateAudit = {
    exact_duplicates: [],
    topology_clusters: {},
    unique_families_count: 0,
    canonical_records_count: 0,
  }

  for (const item of eligibleItems) {
    let circuit = null
    let title = item.title
    let description = ""
    let code = null
    let targetBoard = item.target_board

    if (item.source_type === "pixiu_template") {
      const tmpl = templateMap.get(item.source_id)
      if (!tmpl) continue
      circuit = tmpl.circuit
      title = tmpl.title
      description = tmpl.description
      code = tmpl.blocklyXml
    } else if (item.source_type === "pixiu_mission") {
      const entry = missionMap.get(item.source_id)
      if (!entry) continue
      const lsn = entry.mission
      circuit = lsn.seedCircuit || (lsn.stages && lsn.stages[0]?.seedCircuit)
      title = lsn.title || lsn.shortTitle
      description = lsn.description || (lsn.stages && lsn.stages[0]?.instructions) || ""
      code = lsn.seedBlocklyXml || null
    }

    if (!circuit || !circuit.parts || circuit.parts.length === 0) continue

    const valResult = validateProposedCircuit(circuit, { allowWarnings: true })
    if (!valResult.valid) {
      console.warn(`⚠️ Skipping invalid candidate ${item.source_id}:`, valResult.errors)
      continue
    }

    const record = createCanonicalRecord({
      sourceId: item.source_id,
      sourceType: item.source_type,
      sourcePath: item.source_path,
      sourceRevision: commitSha,
      targetBoard,
      gradeBand: item.grade_band,
      title,
      description,
      circuit: valResult.normalizedCircuit || circuit,
      code,
      validationResult: valResult,
      resolveCanonicalPinFn: resolveCanonicalPin,
    })

    // Topology deduplication and family unification
    const topHash = record.hashes.topology_hash
    if (topologyFamilyMap.has(topHash)) {
      // Re-assign project_family_id to the root canonical family
      const existingFamily = topologyFamilyMap.get(topHash)
      record.project_family_id = existingFamily
      duplicateAudit.exact_duplicates.push({
        source_id: item.source_id,
        matched_family: existingFamily,
        topology_hash: topHash,
      })
    } else {
      topologyFamilyMap.set(topHash, record.project_family_id)
      duplicateAudit.topology_clusters[record.project_family_id] = {
        title: record.instruction.text,
        board: targetBoard,
        topology_hash: topHash,
        parts_count: record.target.circuit.parts.length,
        wires_count: record.target.circuit.wires.length,
      }
    }

    canonicalRecords.push(record)
  }

  duplicateAudit.canonical_records_count = canonicalRecords.length
  duplicateAudit.unique_families_count = topologyFamilyMap.size

  // Write canonical.jsonl
  const recordsDir = resolve(ROOT, "data/ai-copilot/phase2/records")
  const reportsDir = resolve(ROOT, "data/ai-copilot/phase2/reports")
  mkdirSync(recordsDir, { recursive: true })
  mkdirSync(reportsDir, { recursive: true })

  const canonPath = resolve(recordsDir, "canonical.jsonl")
  const lines = canonicalRecords.map((r) => JSON.stringify(r)).join("\n") + "\n"
  writeFileSync(canonPath, lines, "utf8")

  const auditPath = resolve(reportsDir, "duplicate-audit.json")
  writeFileSync(auditPath, JSON.stringify(duplicateAudit, null, 2), "utf8")

  console.log(`✅ Extracted ${canonicalRecords.length} canonical records into: ${canonPath}`)
  console.log(`   - Unique Project Families: ${duplicateAudit.unique_families_count}`)
  console.log(`   - Duplicate Audit saved to: ${auditPath}`)

  return { canonicalRecords, duplicateAudit }
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  extractCanonicalCandidates().catch((err) => {
    console.error("❌ Failed to extract canonical candidates:", err)
    process.exit(1)
  })
}
