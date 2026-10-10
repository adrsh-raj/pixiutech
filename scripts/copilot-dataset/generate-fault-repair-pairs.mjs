#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 FAULT & REPAIR PAIR GENERATOR (WP 2.4)
 *
 * Creates deterministic negative examples whose intended diagnostic rule and
 * severity must match the live circuit validator exactly. Generation is built
 * in memory before writes so an unsuccessful run cannot partially replace data.
 *
 * Produces: data/ai-copilot/phase2/records/fault-repairs.jsonl
 * Target: >= 50 verified fault_repair records.
 *
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getBundledModules, ROOT } from "./bundle-helper.mjs";
import { canonicalSourceSlug, sha256, stableStringify } from "./normalize-record.mjs";
import { getBuildTimestamp } from "./build-metadata.mjs";

const ACTIVE_GROUND_RETURN_TYPES = new Set([
  "ultrasonic", "dht11", "mq2-gas", "neopixel-ring", "oled-i2c",
  "lcd-i2c", "servo", "l298n", "pir-sensor", "ir-sensor",
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function endpointForPart(wire, partId) {
  if (wire?.from?.partId === partId) return { endpoint: wire.from, other: wire.to };
  if (wire?.to?.partId === partId) return { endpoint: wire.to, other: wire.from };
  return null;
}

function validatorSnapshot(result) {
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

/**
 * Propose controlled circuit faults. Each mutation is a candidate only; the
 * live validator below must prove that its declared rule actually fires.
 */
export function createFaultMutations(canonicalRecord, boards, resolveCanonicalPin) {
  const circuit = canonicalRecord?.target?.circuit;
  if (!Array.isArray(circuit?.parts) || !Array.isArray(circuit?.wires)) {
    throw new Error("Fault mutations require a canonical circuit with parts and wires: " + (canonicalRecord?.record_id || "<unknown>"));
  }

  const boardPart = circuit.parts.find((part) => boards.isBoardPart(part.type));
  if (!boardPart) return [];
  const boardId = boardPart.id;
  const boardType = boardPart.type;
  const boardDefinition = boards.getBoardDefinition(boardType);
  if (!boardDefinition) throw new Error("No board definition found for " + boardType);

  const faults = [];
  const wireIdPrefix = canonicalSourceSlug(canonicalRecord.record_id);

  // 1. Direct power-rail-to-ground short: use a pin supported by this board.
  const powerPin = boardDefinition.powerPins.v5?.[0] || boardDefinition.powerPins.v33?.[0] || null;
  const powerRule = boardDefinition.powerPins.v5?.length
    ? "safety-direct-power-short-5v"
    : "safety-direct-power-short-3v3";
  const groundPin = boardDefinition.powerPins.gnd?.[0] || null;
  if (powerPin && groundPin) {
    faults.push({
      mutation_id: "direct-power-to-gnd-dead-short",
      instruction: "Diagnose and repair the direct power-to-ground short in this " + canonicalRecord.instruction.text + " circuit.",
      input_circuit: {
        parts: cloneJson(circuit.parts),
        wires: [
          ...cloneJson(circuit.wires),
          {
            id: "w-fault-short-" + wireIdPrefix,
            from: { partId: boardId, pinId: powerPin },
            to: { partId: boardId, pinId: groundPin },
            color: "#ef4444",
          },
        ],
      },
      expected_validator_status: "reject",
      expected_rule_ids: [powerRule],
      explanation: "A direct low-impedance wire was added between the board power rail and ground. Remove the shorting wire and restore the canonical circuit.",
    });
  }

  // 2. Bypass a resistor that is actually connected in series with an LED.
  // This avoids removing an arbitrary resistor that is unrelated to the LED.
  const ledParts = circuit.parts.filter((part) => part.type === "led");
  const resistorParts = circuit.parts.filter((part) => part.type === "resistor");
  let ledMutation = null;
  for (const led of ledParts) {
    for (const resistor of resistorParts) {
      const ledResistorWire = circuit.wires.find((wire) => {
        const ledEndpoint = endpointForPart(wire, led.id);
        const resistorEndpoint = endpointForPart(wire, resistor.id);
        if (!ledEndpoint || !resistorEndpoint) return false;
        const canonicalLedPin = resolveCanonicalPin(led.type, ledEndpoint.endpoint.pinId);
        return canonicalLedPin === "anode" || canonicalLedPin === "cathode";
      });
      if (!ledResistorWire) continue;

      const resistorConnections = circuit.wires
        .map((wire) => ({ wire, endpoints: endpointForPart(wire, resistor.id) }))
        .filter((entry) => entry.endpoints && entry.wire !== ledResistorWire);
      const upstream = resistorConnections.find((entry) => entry.endpoints.other?.partId !== led.id);
      if (!upstream) continue;

      const ledSide = endpointForPart(ledResistorWire, led.id)?.endpoint;
      const upstreamSide = upstream.endpoints.other;
      if (!ledSide || !upstreamSide) continue;

      const wiresWithoutResistor = circuit.wires.filter((wire) =>
        wire.from.partId !== resistor.id && wire.to.partId !== resistor.id
      );
      wiresWithoutResistor.push({
        id: "w-fault-resistor-bypass-" + wireIdPrefix,
        from: { partId: upstreamSide.partId, pinId: upstreamSide.pinId },
        to: { partId: ledSide.partId, pinId: ledSide.pinId },
        color: "#ef4444",
      });
      ledMutation = {
        mutation_id: "led-series-resistor-bypassed-" + canonicalSourceSlug(led.id),
        instruction: "Find and repair the missing current-limiting path in the LED circuit.",
        input_circuit: {
          parts: cloneJson(circuit.parts.filter((part) => part.id !== resistor.id)),
          wires: cloneJson(wiresWithoutResistor),
        },
        expected_validator_status: "reject",
        expected_rule_ids: ["safety-led-burnout-" + led.id],
        explanation: "The resistor that limited LED current was bypassed and removed from the parts list. Restore the canonical series-resistor path to protect the LED.",
      };
      break;
    }
    if (ledMutation) break;
  }
  if (ledMutation) faults.push(ledMutation);

  // 3. Remove one real ground wire from an active peripheral, using object
  // identity rather than optional wire IDs (which may be absent or repeated).
  const partById = new Map(circuit.parts.map((part) => [part.id, part]));
  const boardGroundPins = new Set((boardDefinition.powerPins.gnd || []).map((pin) =>
    resolveCanonicalPin(boardType, pin)
  ));
  const groundConnection = circuit.wires.map((wire) => {
    const fromBoard = wire.from?.partId === boardId;
    const toBoard = wire.to?.partId === boardId;
    if (!fromBoard && !toBoard) return null;
    const boardEndpoint = fromBoard ? wire.from : wire.to;
    const peripheralEndpoint = fromBoard ? wire.to : wire.from;
    const peripheral = partById.get(peripheralEndpoint?.partId);
    if (!peripheral || boards.isBoardPart(peripheral.type) ||
        !ACTIVE_GROUND_RETURN_TYPES.has(peripheral.type)) return null;
    const boardPin = resolveCanonicalPin(boardType, boardEndpoint.pinId);
    const peripheralPin = resolveCanonicalPin(peripheral.type, peripheralEndpoint.pinId);
    if (!boardGroundPins.has(boardPin) || peripheralPin !== "gnd") return null;
    return { wire, peripheralEndpoint, peripheral };
  }).find(Boolean);

  if (groundConnection && circuit.wires.length > 2) {
    faults.push({
      mutation_id: "missing-ground-return-" + canonicalSourceSlug(groundConnection.peripheral.id),
      instruction: "Why is this circuit not functioning? Find the missing ground-return connection and repair it.",
      input_circuit: {
        parts: cloneJson(circuit.parts),
        wires: cloneJson(circuit.wires.filter((wire) => wire !== groundConnection.wire)),
      },
      expected_validator_status: "warning_or_reject",
      expected_rule_ids: ["wiring-missing-ground-return-" + groundConnection.peripheral.id],
      explanation: "The active peripheral's actual GND terminal was disconnected from common board ground. Restore the removed ground-return wire.",
    });
  }

  // 4. Unknown pin endpoint: preserve all other wiring and target one exact,
  // validator-generated identity rule.
  const firstWire = circuit.wires.find((wire) => wire?.from?.partId && wire?.from?.pinId);
  if (firstWire) {
    const badWires = cloneJson(circuit.wires);
    const selected = badWires[circuit.wires.indexOf(firstWire)];
    selected.from.pinId = "invalid_pin_99";
    faults.push({
      mutation_id: "unsupported-pin-alias",
      instruction: "Repair the wire connected to a non-existent pin assignment.",
      input_circuit: { parts: cloneJson(circuit.parts), wires: badWires },
      expected_validator_status: "reject",
      expected_rule_ids: ["identity-unknown-pin-" + selected.from.partId + "-invalid_pin_99"],
      explanation: "A wire endpoint was changed to the unregistered pin invalid_pin_99. Restore the original canonical pin endpoint.",
    });
  }

  const mutationIds = faults.map((fault) => fault.mutation_id);
  if (new Set(mutationIds).size !== mutationIds.length) {
    throw new Error("Mutation IDs collided for canonical parent " + canonicalRecord.record_id);
  }
  return faults;
}

/** Match the declared diagnostic and severity, not an unrelated warning. */
export function evaluateFaultCalibration(mutation, validationResult) {
  const expectedIds = Array.isArray(mutation?.expected_rule_ids) ? mutation.expected_rule_ids : [];
  const notices = Array.isArray(validationResult?.notices) ? validationResult.notices : [];
  const matchedNotices = expectedIds.map((ruleId) => notices.find((notice) => notice.ruleId === ruleId));
  const ruleMatch = expectedIds.length > 0 && matchedNotices.every(Boolean);
  const expectedNoticeSeveritiesMatch = ruleMatch && matchedNotices.every((notice) => {
    if (mutation.expected_validator_status === "reject") return notice.severity === "critical";
    if (mutation.expected_validator_status === "warning") return notice.severity === "warning";
    if (mutation.expected_validator_status === "warning_or_reject") {
      return notice.severity === "warning" || notice.severity === "critical";
    }
    return false;
  });
  const resultStatusMatches = mutation.expected_validator_status === "reject"
    ? validationResult?.valid === false
    : mutation.expected_validator_status === "warning"
      ? notices.some((notice) => notice.severity === "warning")
      : mutation.expected_validator_status === "warning_or_reject"
        ? notices.some((notice) => notice.severity === "critical" || notice.severity === "warning")
        : false;
  return {
    passed: ruleMatch && expectedNoticeSeveritiesMatch && resultStatusMatches,
    ruleMatch,
    expectedNoticeSeveritiesMatch,
    resultStatusMatches,
    actualRuleIds: notices.map((notice) => notice.ruleId),
    actualSeverities: notices.map((notice) => notice.severity),
  };
}

/**
 * Build fault records deterministically without writing files. Rejected
 * candidates are returned as explicit audit entries instead of being silently
 * ignored; only calibrated records enter the release corpus.
 */
export function buildFaultRepairRecords(canonicalRecords, {
  boards,
  validateProposedCircuit,
  resolveCanonicalPin,
  reviewedAt = getBuildTimestamp(),
  minRecords = 50,
} = {}) {
  if (!Array.isArray(canonicalRecords) || canonicalRecords.length === 0) {
    throw new Error("Fault generation requires a non-empty canonical dataset");
  }
  if (!boards || typeof validateProposedCircuit !== "function" || typeof resolveCanonicalPin !== "function") {
    throw new Error("Fault generation requires board registry and live validator dependencies");
  }
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new Error("Fault reviewedAt must be a valid timestamp");
  if (!Number.isInteger(minRecords) || minRecords < 0) throw new Error("minRecords must be a non-negative integer");

  const parents = canonicalRecords.slice().sort((a, b) => a.record_id.localeCompare(b.record_id));
  const parentIdSet = new Set();
  const slugToSource = new Map();
  for (const parent of parents) {
    if (!parent?.record_id || parent.task_type !== "request_to_circuit" ||
        parent.variant?.kind !== "canonical" || !parent.source?.source_id ||
        !parent.source?.source_path || !parent.source?.source_revision ||
        !parent.context?.target_board || !parent.target?.circuit ||
        !parent.hashes?.topology_hash || !parent.project_family_id) {
      throw new Error("Invalid canonical parent for fault generation: " + (parent?.record_id || "<unknown>"));
    }
    if (parentIdSet.has(parent.record_id)) throw new Error("Duplicate canonical parent ID: " + parent.record_id);
    parentIdSet.add(parent.record_id);
    const slug = canonicalSourceSlug(parent.source.source_id);
    if (slugToSource.has(slug)) {
      throw new Error("Canonical source IDs collide after slug normalization: " +
        slugToSource.get(slug) + " and " + parent.source.source_id);
    }
    slugToSource.set(slug, parent.source.source_id);
  }

  const faultRecords = [];
  const rejectedMutations = [];
  const recordIds = new Set();

  for (const parent of parents) {
    const options = { allowWarnings: true, targetBoard: parent.context.target_board };
    const targetValidation = validateProposedCircuit(parent.target.circuit, options);
    const targetValidationAgain = validateProposedCircuit(parent.target.circuit, options);
    if (validatorSnapshot(targetValidation) !== validatorSnapshot(targetValidationAgain)) {
      throw new Error("Non-deterministic repair-target validator result for " + parent.record_id);
    }
    if (!targetValidation.valid) {
      throw new Error("Canonical repair target failed live validation: " + parent.record_id +
        ": " + stableStringify(targetValidation.errors || []));
    }

    const mutations = createFaultMutations(parent, boards, resolveCanonicalPin);
    for (const mutation of mutations) {
      const faultValidation = validateProposedCircuit(mutation.input_circuit, options);
      const faultValidationAgain = validateProposedCircuit(mutation.input_circuit, options);
      if (validatorSnapshot(faultValidation) !== validatorSnapshot(faultValidationAgain)) {
        throw new Error("Non-deterministic fault validator result for " + parent.record_id + "/" + mutation.mutation_id);
      }

      const calibration = evaluateFaultCalibration(mutation, faultValidation);
      if (!calibration.passed) {
        rejectedMutations.push({
          parent_record_id: parent.record_id,
          mutation_id: mutation.mutation_id,
          expected_rule_ids: mutation.expected_rule_ids,
          expected_status: mutation.expected_validator_status,
          actual_rule_ids: calibration.actualRuleIds,
          actual_severities: calibration.actualSeverities,
          rejection_reasons: [
            ...(!calibration.ruleMatch ? ["expected diagnostic rule not found"] : []),
            ...(!calibration.expectedNoticeSeveritiesMatch ? ["expected rule severity mismatch"] : []),
            ...(!calibration.resultStatusMatches ? ["validator result status mismatch"] : []),
          ],
        });
        continue;
      }

      const sourceId = parent.source.source_id + "#" + mutation.mutation_id;
      const recordId = "pxai2-fault-" + canonicalSourceSlug(parent.source.source_id) +
        "-" + canonicalSourceSlug(mutation.mutation_id);
      if (recordIds.has(recordId)) throw new Error("Fault record ID collision: " + recordId);
      recordIds.add(recordId);

      const target = {
        corrected_circuit: parent.target.circuit,
        explanation: mutation.explanation,
        code: parent.target.code || null,
      };
      const contentHash = sha256({
        fault: mutation.input_circuit,
        target: {
          circuit: target.corrected_circuit,
          explanation: target.explanation,
          code: target.code,
        },
        mutation_id: mutation.mutation_id,
      });

      faultRecords.push({
        record_id: recordId,
        record_schema_version: "1.0.0",
        task_type: "fault_repair",
        project_family_id: parent.project_family_id,
        source: {
          source_type: "synthetic_mutation",
          source_path: parent.source.source_path,
          source_id: sourceId,
          source_revision: parent.source.source_revision,
        },
        permission: { status: "internal_owned", review_status: "approved" },
        context: { ...parent.context },
        instruction: { text: mutation.instruction },
        fault: {
          mutation_id: mutation.mutation_id,
          input_circuit: mutation.input_circuit,
          expected_validator_status: mutation.expected_validator_status,
          expected_rule_ids: mutation.expected_rule_ids,
        },
        target,
        validation: {
          status: "pass",
          validator_version: "1.0.0",
          errors: [],
          warnings: targetValidation.warnings || [],
        },
        capabilities: {
          simulation: "supported",
          compile: target.code ? "supported" : "not_tested",
        },
        review: {
          status: "approved",
          reviewer: "controlled-mutation-engine",
          reviewed_at: reviewedAt,
        },
        variant: { kind: "fault", parent_record_id: parent.record_id },
        hashes: {
          source_hash: sha256({ source_id: sourceId, mutation_id: mutation.mutation_id, input_circuit: mutation.input_circuit }),
          topology_hash: parent.hashes.topology_hash,
          content_hash: contentHash,
        },
        limitations: parent.limitations || [],
      });
    }
  }

  faultRecords.sort((a, b) => a.record_id.localeCompare(b.record_id));
  if (faultRecords.length < minRecords) {
    throw new Error("Fault-repair target not met: " + faultRecords.length +
      " calibrated records; expected at least " + minRecords +
      ". Rejected mutation candidates: " + rejectedMutations.length);
  }

  return {
    faultRecords,
    rejectedMutations,
    summary: {
      parent_count: parents.length,
      candidate_mutations: faultRecords.length + rejectedMutations.length,
      calibrated_records: faultRecords.length,
      rejected_mutations: rejectedMutations.length,
      unique_record_ids: recordIds.size,
      minimum_target: minRecords,
    },
  };
}

export async function generateFaultRepairPairs({
  writeArtifacts = true,
  canonicalRecords = null,
  reviewedAt = getBuildTimestamp(),
  minRecords = 50,
} = {}) {
  const modules = await getBundledModules();
  const { boards } = modules;
  const { validateProposedCircuit, resolveCanonicalPin } = modules.validator;
  let parents = canonicalRecords;
  if (parents === null) {
    const canonPath = resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl");
    const content = readFileSync(canonPath, "utf8").trim();
    if (!content) throw new Error("Canonical record file is empty: " + canonPath);
    parents = content.split(/\r?\n/).map((line) => JSON.parse(line));
  }

  // Build and validate the entire batch before opening the destination for writing.
  const result = buildFaultRepairRecords(parents, {
    boards,
    validateProposedCircuit,
    resolveCanonicalPin,
    reviewedAt,
    minRecords,
  });

  if (writeArtifacts) {
    const outPath = resolve(ROOT, "data/ai-copilot/phase2/records/fault-repairs.jsonl");
    const outputContent = result.faultRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
    writeFileSync(outPath, outputContent, "utf8");
    console.log("Generated " + result.faultRecords.length + " calibrated fault-repair records into: " + outPath);
  } else {
    console.log("Read-only mode: generated " + result.faultRecords.length + " calibrated fault-repair records; no files written.");
  }

  console.log("Fault-generation summary: " + stableStringify(result.summary));
  if (result.rejectedMutations.length) {
    console.warn("Rejected uncalibrated mutations (not released): " + result.rejectedMutations.length);
    for (const rejected of result.rejectedMutations.slice(0, 10)) {
      console.warn(stableStringify(rejected));
    }
    if (result.rejectedMutations.length > 10) console.warn("Additional rejection details omitted from console: " + (result.rejectedMutations.length - 10));
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateFaultRepairPairs().catch((error) => {
    console.error("Failed to generate fault-repair pairs:", error);
    process.exit(1);
  });
}
