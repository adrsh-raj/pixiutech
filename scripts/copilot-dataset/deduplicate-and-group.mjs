#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 DEDUPLICATION & GROUP ASSIGNMENT (WP 2.2 / WP 2.6)
 * 
 * Computes hashes, exact and topology duplicate clusters, and verifies stable
 * project-family group assignments across canonical circuits.
 * 
 * Produces/Updates: data/ai-copilot/phase2/reports/duplicate-audit.json
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT } from "./bundle-helper.mjs"
import { getBuildTimestamp } from "./build-metadata.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function deduplicateAndGroup() {
  const canonicalPath = resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl")
  const canonicalRecords = readFileSync(canonicalPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))

  console.log(`Auditing deduplication and grouping for ${canonicalRecords.length} canonical records...`)

  const contentMap = new Map() // content_hash -> records
  const topologyMap = new Map() // topology_hash -> records
  const familyMap = new Map() // project_family_id -> records

  for (const rec of canonicalRecords) {
    const cHash = rec.hashes.content_hash
    const tHash = rec.hashes.topology_hash
    const fam = rec.project_family_id

    if (!contentMap.has(cHash)) contentMap.set(cHash, [])
    contentMap.get(cHash).push(rec.record_id)

    if (!topologyMap.has(tHash)) topologyMap.set(tHash, [])
    topologyMap.get(tHash).push(rec.record_id)

    if (!familyMap.has(fam)) familyMap.set(fam, [])
    familyMap.get(fam).push(rec.record_id)
  }

  const exactDuplicates = []
  for (const [hash, ids] of contentMap.entries()) {
    if (ids.length > 1) {
      exactDuplicates.push({ content_hash: hash, record_ids: ids })
    }
  }

  const topologyClusters = {}
  for (const [hash, ids] of topologyMap.entries()) {
    if (ids.length > 1) {
      topologyClusters[hash] = ids
    }
  }

  const report = {
    report_name: "Phase 2 Deduplication & Group Assignment Audit",
    timestamp: getBuildTimestamp()
    total_canonical_records: canonicalRecords.length,
    unique_content_hashes: contentMap.size,
    unique_topology_hashes: topologyMap.size,
    unique_project_families: familyMap.size,
    exact_duplicates: exactDuplicates,
    topology_clusters: topologyClusters,
    family_distribution: Array.from(familyMap.entries()).map(([fam, ids]) => ({
      family_id: fam,
      record_count: ids.length,
      records: ids,
    })),
  }

  const reportPath = resolve(ROOT, "data/ai-copilot/phase2/reports/duplicate-audit.json")
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8")

  console.log(`✅ Deduplication & Grouping Report written to: ${reportPath}`)
  console.log(`   - Canonical Records: ${canonicalRecords.length}`)
  console.log(`   - Unique Topologies: ${topologyMap.size}`)
  console.log(`   - Unique Families: ${familyMap.size}`)
  console.log(`   - Exact Duplicates: ${exactDuplicates.length}`)

  return report
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deduplicateAndGroup().catch((err) => {
    console.error("❌ Failed to audit deduplication and grouping:", err)
    process.exit(1)
  })
}
