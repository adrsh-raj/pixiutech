/**
 * PIXIU TECH CYBERLAB — PHASE 2 RECORD NORMALIZER & HASH CALCULATOR (WP 2.2)
 * 
 * Maps raw source candidates to the Phase 2 Canonical Record schema.
 * Enforces deterministic hashing, canonical pin resolution, and validation checks.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { createHash } from "node:crypto"

/**
 * Compute deterministic SHA-256 of any JSON-serializable object.
 */
export function sha256(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data)
  return createHash("sha256").update(str, "utf8").digest("hex")
}

/**
 * Compute invariant topology hash of a circuit graph.
 * Invariant to: part ID differences, coordinates, rotation, wire color, and wire order.
 * Sensitive to: component types, component props, and canonical electrical connections.
 */
export function computeCanonicalTopologyHash(circuit, resolveCanonicalPinFn) {
  if (!circuit || !Array.isArray(circuit.parts)) return "empty-topology"

  // 1. Map parts: sort by (type, props)
  const partTypeMap = new Map()
  for (const part of circuit.parts) {
    partTypeMap.set(part.id, part.type)
  }

  const normalizedParts = circuit.parts
    .map((p) => `${p.type}:${JSON.stringify(p.props || {})}`)
    .sort()

  // 2. Map wires: resolve canonical endpoints and sort
  const normalizedWires = (circuit.wires || [])
    .map((w) => {
      const fromType = partTypeMap.get(w.from.partId) || "unknown"
      const toType = partTypeMap.get(w.to.partId) || "unknown"
      const fromPin = resolveCanonicalPinFn ? resolveCanonicalPinFn(fromType, w.from.pinId) : w.from.pinId
      const toPin = resolveCanonicalPinFn ? resolveCanonicalPinFn(toType, w.to.pinId) : w.to.pinId

      const epA = `${fromType}:${fromPin}`
      const epB = `${toType}:${toPin}`
      return epA < epB ? `${epA}<->${epB}` : `${epB}<->${epA}`
    })
    .sort()

  return sha256(`${normalizedParts.join("|")}###${normalizedWires.join("|")}`)
}

/**
 * Clean natural language instruction text.
 */
export function cleanInstructionText(title, description) {
  if (title && description) {
    // Strip leading numbering like "1. " or "2) "
    const cleanTitle = title.replace(/^[0-9]+[.:)]\s*/, "").trim()
    return cleanTitle
  }
  return title || "Build circuit"
}

/**
 * Construct a Canonical Record conforming to record-v1.schema.json.
 */
export function createCanonicalRecord({
  sourceId,
  sourceType,
  sourcePath,
  sourceRevision,
  targetBoard,
  gradeBand = null,
  title,
  description = "",
  circuit,
  code = null,
  explanation = null,
  validationResult,
  resolveCanonicalPinFn,
  reviewer = "system-qa-curator",
}) {
  const cleanTitle = cleanInstructionText(title, description)
  const sourceHash = sha256({ sourceId, sourceType, circuit, code })
  const topologyHash = computeCanonicalTopologyHash(circuit, resolveCanonicalPinFn)
  const contentHash = sha256({ circuit, explanation, code })

  // Clean slug for deterministic record ID & family ID
  const slug = sourceId.toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-")
  const recordId = `pxai2-canon-${slug}`
  const familyId = `family-${slug}`

  const targetExplanation = explanation || description || `Standard educational circuit for ${cleanTitle} on ${targetBoard}.`

  return {
    record_id: recordId,
    record_schema_version: "1.0.0",
    task_type: "request_to_circuit",
    project_family_id: familyId,
    source: {
      source_type: sourceType,
      source_path: sourcePath,
      source_id: sourceId,
      source_revision: sourceRevision,
    },
    permission: {
      status: "internal_owned",
      review_status: "approved",
    },
    context: {
      target_board: targetBoard || "arduino-uno",
      grade_band: gradeBand,
    },
    instruction: {
      text: cleanTitle.length >= 3 ? cleanTitle : `Build a ${cleanTitle} circuit`,
    },
    target: {
      circuit: {
        parts: circuit.parts || [],
        wires: circuit.wires || [],
      },
      explanation: targetExplanation,
      code: code || null,
    },
    validation: {
      status: validationResult.valid ? "pass" : "reject",
      validator_version: "1.0.0",
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
    },
    capabilities: {
      simulation: "supported",
      compile: code ? "supported" : "not_tested",
    },
    review: {
      status: "approved",
      reviewer,
      reviewed_at: new Date().toISOString(),
    },
    variant: {
      kind: "canonical",
      parent_record_id: null,
    },
    hashes: {
      source_hash: sourceHash,
      topology_hash: topologyHash,
      content_hash: contentHash,
    },
    limitations: [],
  }
}
