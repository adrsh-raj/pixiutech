/**
 * PIXIU TECH CYBERLAB — PHASE 2 RECORD NORMALIZER & HASH CALCULATOR (WP 2.2)
 *
 * Canonical JSON hashing, graph-isomorphism-aware topology fingerprints, and
 * canonical record construction. Generated artifacts must be rebuilt whenever
 * this hash contract changes.
 *
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */
import { createHash } from "node:crypto";
import { getBuildTimestamp } from "./build-metadata.mjs";

export function stableStringify(value) {
  const ancestors = new WeakSet();
  const encode = (current) => {
    if (current === null) return "null";
    if (Array.isArray(current)) {
      if (ancestors.has(current)) throw new TypeError("Cannot hash a cyclic array");
      ancestors.add(current);
      const result = "[" + current.map((item) => item === undefined ? "null" : encode(item)).join(",") + "]";
      ancestors.delete(current);
      return result;
    }
    if (current instanceof Date) return JSON.stringify(current.toJSON());
    if (typeof current === "object") {
      if (ancestors.has(current)) throw new TypeError("Cannot hash a cyclic object");
      ancestors.add(current);
      const keys = Object.keys(current).filter((key) =>
        current[key] !== undefined &&
        typeof current[key] !== "function" &&
        typeof current[key] !== "symbol"
      ).sort();
      const result = "{" + keys.map((key) => JSON.stringify(key) + ":" + encode(current[key])).join(",") + "}";
      ancestors.delete(current);
      return result;
    }
    if (typeof current === "bigint" || typeof current === "function" || typeof current === "symbol" || current === undefined) {
      throw new TypeError("Value is not JSON serializable");
    }
    const encoded = JSON.stringify(current);
    if (encoded === undefined) throw new TypeError("Value is not JSON serializable");
    return encoded;
  };
  return encode(value);
}

/** Compute SHA-256 over text or a canonical JSON serialization. */
export function sha256(data) {
  const content = typeof data === "string" ? data : stableStringify(data);
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Produce a stable, readable source slug for IDs and default family IDs. */
export function canonicalSourceSlug(sourceId) {
  const slug = String(sourceId ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("Source ID cannot produce a stable record slug");
  return slug;
}

function assignColorIds(signatures) {
  const values = Array.from(new Set(signatures)).sort();
  const colorBySignature = new Map(values.map((signature, index) => [signature, index]));
  return signatures.map((signature) => colorBySignature.get(signature));
}

function samePartition(left, right) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    for (let j = i + 1; j < left.length; j++) {
      if ((left[i] === left[j]) !== (right[i] === right[j])) return false;
    }
  }
  return true;
}

function* permutations(values, prefix = []) {
  if (values.length === 0) {
    yield prefix;
    return;
  }
  for (let i = 0; i < values.length; i++) {
    yield* permutations(values.slice(0, i).concat(values.slice(i + 1)), prefix.concat(values[i]));
  }
}

/**
 * Fingerprint an undirected circuit graph independent of part IDs, part order,
 * layout coordinates, rotation, wire direction, and wire ordering. Component
 * type/properties and canonical pin connections remain significant.
 *
 * Remaining color-refinement ties are exhaustively canonicalized. A hard
 * budget makes pathological graphs fail closed instead of weakening identity.
 */
export function computeCanonicalTopologyHash(circuit, resolveCanonicalPinFn, options = {}) {
  const parts = Array.isArray(circuit?.parts) ? circuit.parts : [];
  const wires = Array.isArray(circuit?.wires) ? circuit.wires : [];
  if (parts.length === 0) return sha256({ format: "pixiu-topology-v2", parts: [], wires: [] });

  const maxCanonicalOrders = Number.isInteger(options.maxCanonicalOrders) && options.maxCanonicalOrders > 0
    ? options.maxCanonicalOrders
    : 100000;
  const indexById = new Map();
  parts.forEach((part, index) => {
    if (!part || typeof part.id !== "string" || !part.id.trim() || typeof part.type !== "string" || !part.type.trim()) {
      throw new Error("Topology hashing requires a non-empty string part ID and type");
    }
    if (indexById.has(part.id)) throw new Error("Topology hashing found duplicate part ID: " + part.id);
    indexById.set(part.id, index);
  });

  const normalizedEdges = wires.map((wire, wireIndex) => {
    const fromIndex = indexById.get(wire?.from?.partId);
    const toIndex = indexById.get(wire?.to?.partId);
    if (fromIndex === undefined || toIndex === undefined) {
      throw new Error("Topology hashing found a wire with an unknown endpoint at index " + wireIndex);
    }
    const fromPin = resolveCanonicalPinFn ? resolveCanonicalPinFn(parts[fromIndex].type, wire.from.pinId) : wire.from.pinId;
    const toPin = resolveCanonicalPinFn ? resolveCanonicalPinFn(parts[toIndex].type, wire.to.pinId) : wire.to.pinId;
    if (fromPin === undefined || fromPin === null || toPin === undefined || toPin === null) {
      throw new Error("Topology hashing could not resolve a wire endpoint pin at index " + wireIndex);
    }
    return { fromIndex, fromPin: String(fromPin), toIndex, toPin: String(toPin) };
  });

  const baseLabels = parts.map((part) => stableStringify({ type: part.type, props: part.props || {} }));
  const adjacency = parts.map(() => []);
  for (const edge of normalizedEdges) {
    adjacency[edge.fromIndex].push({ neighborIndex: edge.toIndex, ownPin: edge.fromPin, neighborPin: edge.toPin });
    adjacency[edge.toIndex].push({ neighborIndex: edge.fromIndex, ownPin: edge.toPin, neighborPin: edge.fromPin });
  }

  let colors = assignColorIds(baseLabels);
  for (let round = 0; round < parts.length; round++) {
    const signatures = parts.map((part, index) => {
      const neighbors = adjacency[index].map((edge) => ({
        own_pin: edge.ownPin,
        neighbor_pin: edge.neighborPin,
        neighbor_color: colors[edge.neighborIndex],
      })).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
      return stableStringify({ base: baseLabels[index], neighbors });
    });
    const nextColors = assignColorIds(signatures);
    const stablePartition = samePartition(colors, nextColors);
    colors = nextColors;
    if (stablePartition) break;
  }

  const colorGroups = new Map();
  colors.forEach((color, index) => {
    if (!colorGroups.has(color)) colorGroups.set(color, []);
    colorGroups.get(color).push(index);
  });
  const groups = Array.from(colorGroups.entries()).sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);

  let orderCount = 1;
  for (const group of groups) {
    for (let n = 2; n <= group.length; n++) {
      orderCount *= n;
      if (orderCount > maxCanonicalOrders) {
        throw new Error(
          "Topology graph exceeds canonical labeling budget (" + maxCanonicalOrders +
          " orders); add a targeted canonical-labeling strategy instead of weakening the hash"
        );
      }
    }
  }

  let bestEncoding = null;
  const visitGroup = (groupIndex, chosenOrder) => {
    if (groupIndex < groups.length) {
      for (const permutation of permutations(groups[groupIndex])) {
        visitGroup(groupIndex + 1, chosenOrder.concat(permutation));
      }
      return;
    }
    const canonicalIndexByPartId = new Map();
    chosenOrder.forEach((partIndex, canonicalIndex) => canonicalIndexByPartId.set(parts[partIndex].id, canonicalIndex));
    const canonicalParts = chosenOrder.map((partIndex) => ({
      type: parts[partIndex].type,
      props: parts[partIndex].props || {},
    }));
    const canonicalWires = normalizedEdges.map((edge) => {
      const left = String(canonicalIndexByPartId.get(parts[edge.fromIndex].id)).padStart(8, "0") + ":" + edge.fromPin;
      const right = String(canonicalIndexByPartId.get(parts[edge.toIndex].id)).padStart(8, "0") + ":" + edge.toPin;
      return left < right ? [left, right] : [right, left];
    }).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
    const encoding = stableStringify({ format: "pixiu-topology-v2", parts: canonicalParts, wires: canonicalWires });
    if (bestEncoding === null || encoding < bestEncoding) bestEncoding = encoding;
  };
  visitGroup(0, []);
  return sha256(bestEncoding);
}

export function cleanInstructionText(title, description) {
  const rawTitle = typeof title === "string" ? title : "";
  const cleaned = rawTitle.replace(/^[0-9]+[.:)]\s*/, "").trim();
  return cleaned || "Build circuit";
}

/** Construct a Canonical Record conforming to record-v1.schema.json. */
export function createCanonicalRecord({
  sourceId, sourceType, sourcePath, sourceRevision, targetBoard, gradeBand = null,
  title, description = "", circuit, code = null, explanation = null,
  validationResult, resolveCanonicalPinFn, reviewer = "system-qa-curator",
}) {
  if (!sourceId || !sourceType || !sourcePath || !sourceRevision) {
    throw new Error("Canonical records require complete source provenance");
  }
  if (!circuit || !Array.isArray(circuit.parts) || !validationResult || typeof validationResult.valid !== "boolean") {
    throw new Error("Canonical records require a circuit and a live validator result");
  }
  const cleanTitle = cleanInstructionText(title, description);
  const targetCircuit = { parts: circuit.parts || [], wires: circuit.wires || [] };
  const targetCode = code || null;
  const targetExplanation = explanation || description ||
    "Standard educational circuit for " + cleanTitle + " on " + (targetBoard || "arduino-uno") + ".";
  const sourceHash = sha256({ sourceId, sourceType, circuit: targetCircuit, code: targetCode });
  const topologyHash = computeCanonicalTopologyHash(targetCircuit, resolveCanonicalPinFn);
  // Hash the values actually stored in target, not pre-fallback input arguments.
  const contentHash = sha256({ circuit: targetCircuit, explanation: targetExplanation, code: targetCode });
  const slug = canonicalSourceSlug(sourceId);
  const recordId = "pxai2-canon-" + slug;
  const familyId = "family-" + slug;
  const instructionText = cleanTitle.length >= 3 ? cleanTitle : "Build a " + cleanTitle + " circuit";

  return {
    record_id: recordId,
    record_schema_version: "1.0.0",
    task_type: "request_to_circuit",
    project_family_id: familyId,
    source: { source_type: sourceType, source_path: sourcePath, source_id: sourceId, source_revision: sourceRevision },
    permission: { status: "internal_owned", review_status: "approved" },
    context: { target_board: targetBoard || "arduino-uno", grade_band: gradeBand },
    instruction: { text: instructionText },
    target: { circuit: targetCircuit, explanation: targetExplanation, code: targetCode },
    validation: {
      status: validationResult.valid ? "pass" : "reject",
      validator_version: "1.0.0",
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
    },
    capabilities: { simulation: "supported", compile: "not_tested" },
    review: { status: "in_review", reviewer: reviewer === "system-qa-curator" ? "automated-canonical-validator" : reviewer, reviewed_at: getBuildTimestamp() },
    variant: { kind: "canonical", parent_record_id: null },
    hashes: { source_hash: sourceHash, topology_hash: topologyHash, content_hash: contentHash },
    limitations: [],
  };
}
