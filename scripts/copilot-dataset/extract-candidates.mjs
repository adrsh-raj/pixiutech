#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 CANONICAL CANDIDATE EXTRACTOR (WP 2.2)
 *
 * Extracts every eligible template and mission into canonical records. Exact
 * duplicates and topology families are reported separately. Read-only mode
 * supports QA without mutating committed dataset artifacts.
 *
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getBundledModules, getCurrentCommitSha, ROOT } from "./bundle-helper.mjs";
import { buildSourceInventory } from "./inventory-sources.mjs";
import { getBuildTimestamp } from "./build-metadata.mjs";
import { canonicalSourceSlug, createCanonicalRecord, sha256, stableStringify } from "./normalize-record.mjs";

function validationSnapshot(result) {
  return stableStringify({
    valid: result.valid,
    errors: result.errors || [],
    warnings: result.warnings || [],
    notices: result.notices || [],
    normalizedCircuit: result.normalizedCircuit || null,
    metrics: result.metrics || null,
    revHash: result.revHash || null,
  });
}

export function assertUniqueStableIds(records) {
  const ownerByRecordId = new Map();
  for (const record of records) {
    const id = record?.record_id;
    const sourceId = record?.source?.source_id;
    if (typeof id !== "string" || !id || typeof sourceId !== "string" || !sourceId) {
      throw new Error("Every canonical record must contain record_id and source.source_id");
    }
    const expectedId = "pxai2-canon-" + canonicalSourceSlug(sourceId);
    if (id !== expectedId) {
      throw new Error("Non-deterministic canonical record ID for source " + sourceId + ": expected " + expectedId + ", got " + id);
    }
    if (ownerByRecordId.has(id)) {
      throw new Error(
        "Canonical record ID collision: " + id + " is claimed by both " +
        ownerByRecordId.get(id) + " and " + sourceId
      );
    }
    ownerByRecordId.set(id, sourceId);
  }
  return true;
}

export async function extractCanonicalCandidates({ writeArtifacts = true } = {}) {
  const commitSha = getCurrentCommitSha();
  const modules = await getBundledModules();
  const { templates, esp32, pico, microbit, lessons } = modules;
  const { validateProposedCircuit, resolveCanonicalPin } = modules.validator;

  // Build inventory in memory. Extraction must not rewrite source-inventory.json.
  const inventoryReport = await buildSourceInventory({ writeArtifact: false });
  if (inventoryReport.commit_sha !== commitSha) {
    throw new Error("Inventory/source revision does not match the checkout: " + inventoryReport.commit_sha + " vs " + commitSha);
  }
  const eligibleItems = inventoryReport.items
    .filter((item) => item.disposition === "eligible")
    .slice()
    .sort((a, b) => a.source_id.localeCompare(b.source_id));
  const seenInventoryIds = new Set();
  for (const item of inventoryReport.items) {
    if (!item.source_id || seenInventoryIds.has(item.source_id)) {
      throw new Error("Source inventory contains a missing or duplicate source_id: " + item.source_id);
    }
    seenInventoryIds.add(item.source_id);
  }

  const templateMap = new Map((templates.TEMPLATES || []).map((template) => ["tmpl-" + template.id, template]));
  const missionMap = new Map();
  const addMissions = (list) => {
    for (const mission of list) {
      const sourceId = "mission-" + mission.id;
      if (missionMap.has(sourceId)) throw new Error("Duplicate curriculum mission ID: " + sourceId);
      missionMap.set(sourceId, mission);
    }
  };
  addMissions(esp32.ESP32_LESSONS || []);
  addMissions(pico.PICO_LESSONS || []);
  addMissions(microbit.MICROBIT_LESSONS || []);
  addMissions(lessons.UNO_LESSONS || lessons.LESSONS || []);

  const canonicalRecords = [];
  const topologyFamilyMap = new Map();
  for (const item of eligibleItems) {
    let source = null;
    let circuit = null;
    let title = item.title;
    let description = "";
    let code = null;

    if (item.source_type === "pixiu_template") {
      source = templateMap.get(item.source_id);
      if (!source) throw new Error("Eligible template not found in current source modules: " + item.source_id);
      circuit = source.circuit;
      title = source.title;
      description = source.description || "";
      code = source.blocklyXml || null;
      if (item.source_path !== "pixiu-lms-portal/src/lib/templates.ts") {
        throw new Error("Source path mismatch for template " + item.source_id);
      }
    } else if (item.source_type === "pixiu_mission") {
      source = missionMap.get(item.source_id);
      if (!source) throw new Error("Eligible mission not found in current source modules: " + item.source_id);
      circuit = source.seedCircuit || (source.stages && source.stages[0]?.seedCircuit) || null;
      title = source.title || source.shortTitle || source.id;
      description = source.description || (source.stages && source.stages[0]?.instructions) || "";
      code = source.seedBlocklyXml || null;
    } else {
      throw new Error("Unknown eligible source type " + item.source_type + " for " + item.source_id);
    }

    if (!circuit || !Array.isArray(circuit.parts) || circuit.parts.length === 0) {
      throw new Error("Eligible inventory entry has no seed circuit: " + item.source_id);
    }
    if (item.target_board !== (item.board_resolution?.board_id || item.target_board)) {
      throw new Error("Resolved board and candidate board disagree: " + item.source_id);
    }

    const validationOptions = { allowWarnings: true, targetBoard: item.target_board };
    const validation = validateProposedCircuit(circuit, validationOptions);
    if (!validation.valid) {
      throw new Error("Eligible source failed live validation: " + item.source_id + ": " + stableStringify(validation.errors || []));
    }
    const repeatedValidation = validateProposedCircuit(circuit, validationOptions);
    if (validationSnapshot(validation) !== validationSnapshot(repeatedValidation)) {
      throw new Error("Non-deterministic validator result for source " + item.source_id);
    }

    const record = createCanonicalRecord({
      sourceId: item.source_id,
      sourceType: item.source_type,
      sourcePath: item.source_path,
      sourceRevision: item.source_revision,
      targetBoard: item.target_board,
      gradeBand: item.grade_band,
      title,
      description,
      circuit: validation.normalizedCircuit || circuit,
      code,
      validationResult: validation,
      resolveCanonicalPinFn: resolveCanonicalPin,
    });
    canonicalRecords.push(record);
  }

  assertUniqueStableIds(canonicalRecords);
  if (canonicalRecords.length !== eligibleItems.length) {
    throw new Error(
      "Canonical extraction coverage mismatch: extracted " + canonicalRecords.length +
      " of " + eligibleItems.length + " eligible inventory candidates"
    );
  }

  // Lexicographically first source ID is the stable topology-family root.
  for (const record of canonicalRecords) {
    const topologyHash = record.hashes.topology_hash;
    if (topologyFamilyMap.has(topologyHash)) record.project_family_id = topologyFamilyMap.get(topologyHash);
    else topologyFamilyMap.set(topologyHash, record.project_family_id);
  }

  const groupBy = (records, field) => {
    const groups = new Map();
    for (const record of records) {
      const value = record.hashes[field];
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(record.record_id);
    }
    for (const ids of groups.values()) ids.sort();
    return groups;
  };
  const contentGroups = groupBy(canonicalRecords, "content_hash");
  const topologyGroups = groupBy(canonicalRecords, "topology_hash");
  const familyGroups = new Map();
  for (const record of canonicalRecords) {
    if (!familyGroups.has(record.project_family_id)) familyGroups.set(record.project_family_id, []);
    familyGroups.get(record.project_family_id).push(record.record_id);
  }
  const exactDuplicates = Array.from(contentGroups.entries())
    .filter((entry) => entry[1].length > 1)
    .map(([contentHash, recordIds]) => ({ content_hash: contentHash, record_ids: recordIds }))
    .sort((a, b) => a.content_hash.localeCompare(b.content_hash));
  const topologyClusters = Object.fromEntries(
    Array.from(topologyGroups.entries())
      .filter((entry) => entry[1].length > 1)
      .sort((a, b) => a[0].localeCompare(b[0]))
  );
  const familyDistribution = Array.from(familyGroups.entries())
    .map(([familyId, recordIds]) => ({
      family_id: familyId,
      record_count: recordIds.length,
      records: recordIds.slice().sort(),
    }))
    .sort((a, b) => a.family_id.localeCompare(b.family_id));
  const duplicateAudit = {
    report_name: "Phase 2 Deduplication & Group Assignment Audit",
    timestamp: getBuildTimestamp(),
    total_canonical_records: canonicalRecords.length,
    unique_content_hashes: contentGroups.size,
    unique_topology_hashes: topologyGroups.size,
    unique_project_families: familyGroups.size,
    exact_duplicates: exactDuplicates,
    topology_clusters: topologyClusters,
    family_distribution: familyDistribution,
  };

  if (writeArtifacts) {
    const recordsDir = resolve(ROOT, "data/ai-copilot/phase2/records");
    const reportsDir = resolve(ROOT, "data/ai-copilot/phase2/reports");
    mkdirSync(recordsDir, { recursive: true });
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(
      resolve(recordsDir, "canonical.jsonl"),
      canonicalRecords.map((record) => JSON.stringify(record)).join("\n") + "\n",
      "utf8"
    );
    writeFileSync(resolve(reportsDir, "duplicate-audit.json"), JSON.stringify(duplicateAudit, null, 2), "utf8");
    console.log("Extracted " + canonicalRecords.length + " canonical records.");
    console.log("Unique topology families: " + duplicateAudit.unique_project_families);
  }

  return { canonicalRecords, duplicateAudit, inventoryReport };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  extractCanonicalCandidates().catch((error) => {
    console.error("Failed to extract canonical candidates:", error);
    process.exit(1);
  });
}
