/**
 * Phase 2.5 release audit for Pixiu AI Copilot diagnosis and Blockly targets.
 * This audit is read-only. It treats simulator/static-rule evidence as distinct
 * from physical measurements and requires code claims to match checks actually run.
 */
import { computeCanonicalTopologyHash } from "./normalize-record.mjs";

const BOARD_NAMES = {
  "arduino-uno": "Arduino Uno R3",
  "esp32-devkit": "ESP32 DevKit V1",
  "rpi-pico": "Raspberry Pi Pico",
  "microbit-v2": "BBC micro:bit v2",
};

export function isWellFormedBlocklyXml(xml) {
  if (typeof xml !== "string" || !xml.trim() || xml.length > 200_000) return false;
  const body = xml.trim()
    .replace(/^\s*<\?xml\b[^?]*\?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (/<!DOCTYPE|<!ENTITY|<\s*script\b|<\s*(?:iframe|object|embed|foreignObject|html|body)\b|javascript\s*:|\bon[a-z]+\s*=/i.test(body)) return false;
  const tokenPattern = /<\/?([A-Za-z_][\w:.-]*(?:"[^"]*"|'[^']*'|[^'">])*)\s*\/?>/g;
  const stack = [], roots = [];
  let cursor = 0, match;
  while ((match = tokenPattern.exec(body)) !== null) {
    if (body.slice(cursor, match.index).includes("<")) return false;
    const token = match[0];
    const name = token.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1];
    if (!name) return false;
    if (/^<\//.test(token)) {
      if (stack.pop() !== name) return false;
    } else {
      if (stack.length === 0) roots.push(name);
      if (!/\/\s*>$/.test(token)) stack.push(name);
    }
    cursor = match.index + token.length;
  }
  if (body.slice(cursor).includes("<") || stack.length || roots.length !== 1 || roots[0].toLowerCase() !== "xml") return false;
  return !/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(body);
}

function decodeXmlText(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function pinCandidates(rawValue, boardId, blockType) {
  const raw = String(rawValue ?? "").trim().toLowerCase();
  const candidates = [];
  const add = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };
  const number = raw.match(/^(?:gpio|gp|d|p)(\d+)$/)?.[1] || (/^\d+$/.test(raw) ? raw : null);
  if (number !== null) {
    // A numeric AIN selector on Uno must resolve to A0-A5 before D0-D5.
    if (/analog.?read/.test(blockType) && boardId === "arduino-uno") add("a" + number);
    const preferred = boardId === "rpi-pico" ? "gp" : boardId === "microbit-v2" ? "p" : "d";
    add(preferred + number);
    add("d" + number);
    add("gp" + number);
    add("p" + number);
    add("gpio" + number);
  }
  add(raw);
  return candidates;
}

export function resolveBlocklyBoardPin(rawValue, boardId, blockType, boardDefinition) {
  if (!boardDefinition || !Array.isArray(boardDefinition.pins)) return null;
  const candidates = pinCandidates(rawValue, boardId, String(blockType || "").toLowerCase());
  for (const candidate of candidates) {
    const exact = boardDefinition.pins.find((pin) => String(pin.id).toLowerCase() === candidate);
    if (exact) return exact;
    const alias = boardDefinition.pins.find((pin) =>
      String(pin.label || "").toLowerCase() === candidate ||
      (Array.isArray(pin.alternateNames) && pin.alternateNames.some((name) => String(name).toLowerCase() === candidate))
    );
    if (alias) return alias;
  }

  // Some boards expose an onboard LED GPIO that is intentionally not part of
  // the external header-pin list (Pico GP25 is the current example). Accept
  // only the exact builtInLedPin declared by that board profile, never an
  // arbitrary undocumented GPIO.
  const builtInLedPin = String(boardDefinition.builtInLedPin || "").trim().toLowerCase();
  const raw = String(rawValue ?? "").trim().toLowerCase();
  const builtInAliases = new Set(["led", "led_builtin", "builtin_led", "builtin-led"]);
  if (builtInLedPin && (candidates.includes(builtInLedPin) || builtInAliases.has(raw))) {
    const declaredPin = boardDefinition.pins.find((pin) => String(pin.id).toLowerCase() === builtInLedPin);
    if (declaredPin) return declaredPin;
    return {
      id: builtInLedPin,
      label: "Built-in LED GPIO",
      kind: "digital",
      capabilities: { pwm: true },
      alternateNames: Array.from(builtInAliases),
      builtIn: true,
    };
  }
  return null;
}

export function extractBlocklyPinFields(xml) {
  if (!isWellFormedBlocklyXml(xml)) return [];
  const tokens = xml.match(/<\/?block\b[^>]*>|<field\b[^>]*>[^<]*<\/field>/gi) || [];
  const stack = [];
  const fields = [];
  for (const token of tokens) {
    if (/^<\/block/i.test(token)) {
      stack.pop();
      continue;
    }
    if (/^<block\b/i.test(token)) {
      const type = token.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      stack.push({ type, fields: {} });
      continue;
    }
    const name = token.match(/^<field\b[^>]*\bname\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!name || !stack.length) continue;
    const value = token.match(/^<field\b[^>]*>([\s\S]*)<\/field>$/i)?.[1] ?? "";
    stack[stack.length - 1].fields[name.toUpperCase()] = decodeXmlText(value).trim();
    if (name.toUpperCase() === "PIN") {
      fields.push({ pin: decodeXmlText(value).trim(), blockType: stack[stack.length - 1].type, parentFields: stack[stack.length - 1].fields });
    }
  }
  return fields.map((field) => ({ pin: field.pin, blockType: field.blockType, mode: field.parentFields.MODE }));
}

function topologyForCircuit(circuit, modules) {
  return computeCanonicalTopologyHash(circuit, modules.validator.resolveCanonicalPin);
}

function validateRecordParent(record, canonicalById, issues) {
  const parentId = record?.variant?.parent_record_id;
  const parent = canonicalById.get(parentId);
  if (!parent) {
    issues.push({ code: "missing_canonical_parent", record_id: record?.record_id || null, detail: String(parentId || "missing parent_record_id") });
    return null;
  }
  if (record.project_family_id !== parent.project_family_id) {
    issues.push({ code: "parent_family_mismatch", record_id: record.record_id, detail: parentId });
  }
  if (record.context?.target_board !== parent.context?.target_board) {
    issues.push({ code: "parent_board_mismatch", record_id: record.record_id, detail: parentId });
  }
  if (record.source?.source_path !== parent.source?.source_path ||
      record.source?.source_revision !== parent.source?.source_revision) {
    issues.push({ code: "parent_provenance_mismatch", record_id: record.record_id, detail: parentId });
  }
  return parent;
}

function validateDiagnosis(record, parent, modules, issues, liveTopologyByCanonicalId) {
  const id = record.record_id;
  const circuit = record.target?.circuit;
  const explanation = record.target?.explanation;
  const boardId = record.context?.target_board;
  if (!circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) {
    issues.push({ code: "diagnosis_target_missing_circuit", record_id: id, detail: "target.circuit must contain parts and wires" });
    return;
  }
  if (typeof explanation !== "string" || !explanation.trim() ||
      /\[object Object\]|\bundefined\b|\bNaN\b|all electrical conduction loops are closed|no short circuits or pin conflicts|all parts are within safe/i.test(explanation)) {
    issues.push({ code: "diagnosis_text_not_grounded", record_id: id, detail: "Explanation is empty or contains an unresolved value" });
    return;
  }
  if (/\bphysically certified safe\b|\bguaranteed safe for physical hardware\b|\bverified on real hardware\b/i.test(explanation)) {
    issues.push({ code: "diagnosis_overclaims_physical_safety", record_id: id, detail: "Static/simulated checks cannot certify a physical build" });
  }
  const board = modules.boards.getBoardDefinition(boardId);
  if (!board || board.id !== boardId) {
    issues.push({ code: "diagnosis_unknown_board_profile", record_id: id, detail: String(boardId) });
    return;
  }
  if (!explanation.includes(board.name)) {
    issues.push({ code: "diagnosis_board_name_mismatch", record_id: id, detail: "Expected " + board.name });
  }
  const boardLogic = explanation.match(/Board logic reference:\s*([0-9]+(?:\.[0-9]+)?)V/i);
  if (!boardLogic || Math.abs(Number(boardLogic[1]) - Number(board.logicVoltage)) > 0.001) {
    issues.push({ code: "diagnosis_board_voltage_mismatch", record_id: id, detail: "Expected logic reference " + board.logicVoltage + "V" });
  }
  if (!/Simulated rail snapshot:/i.test(explanation) ||
      !/not a physical measurement|not hardware|simulator-derived/i.test(explanation) ||
      !/Scope:.*(?:does not certify|not certify|physical hardware as safe)/is.test(explanation)) {
    issues.push({ code: "diagnosis_truth_label_missing", record_id: id, detail: "Rail values and limitations must be labelled as simulated/static, not physical measurements" });
  }
  let health;
  let telemetry;
  try {
    const validation = modules.validator.validateProposedCircuit(circuit, { allowWarnings: true, targetBoard: boardId });
    if (!validation.valid) {
      issues.push({ code: "diagnosis_positive_circuit_invalid", record_id: id, detail: (validation.errors || []).join("; ") });
    }
    health = modules.doctor.diagnoseCircuit(circuit);
    telemetry = modules.telemetry.serializeCircuitTelemetry({ circuit, healthReport: health });
  } catch (error) {
    issues.push({ code: "diagnosis_live_audit_error", record_id: id, detail: String(error?.message || error) });
    return;
  }
  let calculatedTopology;
  try {
    calculatedTopology = topologyForCircuit(circuit, modules);
  } catch (error) {
    issues.push({ code: "diagnosis_topology_unavailable", record_id: id, detail: String(error?.message || error) });
  }
  const parentLiveTopology = parent ? liveTopologyByCanonicalId.get(parent.record_id) : null;
  if (parent && calculatedTopology && parentLiveTopology && calculatedTopology !== parentLiveTopology) {
    issues.push({ code: "diagnosis_parent_topology_mismatch", record_id: id, detail: "Diagnosis target differs from its live canonical parent topology" });
  }
  if (parent && record.hashes?.topology_hash !== parent.hashes?.topology_hash) {
    issues.push({ code: "diagnosis_topology_metadata_mismatch", record_id: id, detail: "Stored topology metadata must be inherited from the canonical parent until a coordinated dataset migration" });
  }
  if (health) {
    const storedHealth = explanation.match(/(?:Stored\s+)?Circuit Doctor snapshot:\s*(\d+(?:\.\d+)?)\s*\/\s*100\s*\((healthy|needs-attention|danger)\)/i);
    if (!storedHealth ||
        Number(storedHealth[1]) !== Number(health.score) ||
        storedHealth[2].toLowerCase() !== String(health.status).toLowerCase()) {
      issues.push({ code: "diagnosis_health_snapshot_mismatch", record_id: id, detail: "Explanation must match the live Circuit Doctor score and status" });
    }
    const findings = explanation.match(/Circuit Doctor findings\s*\((\d+)\)/i);
    if (!findings || Number(findings[1]) !== (health.issues || []).length) {
      issues.push({ code: "diagnosis_findings_count_mismatch", record_id: id, detail: "Explanation must state the exact current finding count" });
    } else {
      for (const issue of (health.issues || []).slice(0, 10)) {
        if (!explanation.includes(issue.title) || !explanation.includes(issue.message)) {
          issues.push({ code: "diagnosis_finding_not_evidenced", record_id: id, detail: issue.id || issue.title });
        }
      }
    }
  }
  for (const component of (telemetry?.components || [])) {
    const evidence = component.partId + " (" + component.type + "): " + component.status;
    if (!explanation.includes(evidence)) {
      issues.push({ code: "diagnosis_component_evidence_missing", record_id: id, detail: component.partId });
    }
  }
}

function validateBlockly(record, parent, modules, issues, liveTopologyByCanonicalId) {
  const id = record.record_id;
  const code = record.target?.code;
  const circuit = record.target?.circuit;
  const boardId = record.context?.target_board;
  if (!isWellFormedBlocklyXml(code)) {
    issues.push({ code: "blockly_xml_invalid", record_id: id, detail: "Blockly XML is malformed, unsafe, oversized, or not rooted at <xml>" });
    return;
  }
  if (!circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) {
    issues.push({ code: "blockly_target_missing_circuit", record_id: id, detail: "target.circuit must contain parts and wires" });
    return;
  }
  if (!parent || typeof parent.target?.code !== "string" || parent.target.code !== code) {
    issues.push({ code: "blockly_code_not_source_matched", record_id: id, detail: "Code must exactly match its canonical internal source until a tested compiler/generator is wired in" });
  }
  if (record.capabilities?.compile === "supported") {
    issues.push({ code: "blockly_compile_capability_unverified", record_id: id, detail: "The pipeline checks XML shape and circuit rules, but does not compile the Blockly program" });
  }
  if (/\bcompiled successfully\b|\bexecutable Blockly\b|\bverified executable\b|\bverified Blockly XML\b/i.test(String(record.target?.explanation || ""))) {
    issues.push({ code: "blockly_explanation_overclaims_execution", record_id: id, detail: "Explanation claims execution/compilation that this pipeline has not performed" });
  }
  if (!/compile status not tested|compilation was not run|compile\/execution was not run/i.test(String(record.target?.explanation || ""))) {
    issues.push({ code: "blockly_compile_limitation_missing", record_id: id, detail: "Code explanation must explicitly disclose that compilation/execution was not tested" });
  }
  const board = modules.boards.getBoardDefinition(boardId);
  if (!board || board.id !== boardId) {
    issues.push({ code: "blockly_unknown_board_profile", record_id: id, detail: String(boardId) });
    return;
  }
  for (const field of extractBlocklyPinFields(code)) {
    const type = String(field.blockType || "").toLowerCase();
    const pin = resolveBlocklyBoardPin(field.pin, boardId, type, board);
    if (!pin) {
      issues.push({ code: "blockly_pin_not_in_board_profile", record_id: id, detail: type + " uses unsupported pin " + field.pin + " on " + boardId });
      continue;
    }
    const wantsPwm = /analog.?write|pwm.?write/.test(type);
    const wantsAdc = /analog.?read/.test(type);
    const writesDigital = /digital.?write/.test(type);
    const servoOrActuatorOutput = /servo.?write|motor.?driver.?write/.test(type);
    const modeOutput = /(?:^|_)pinmode$/.test(type) && /\bOUTPUT\b/i.test(String(field.mode || ""));
    const outputRequested = writesDigital || servoOrActuatorOutput || modeOutput || wantsPwm;
    if (wantsPwm && pin.capabilities?.pwm !== true) {
      issues.push({ code: "blockly_pwm_pin_incompatible", record_id: id, detail: type + " pin " + pin.id + " has no PWM capability in " + boardId });
    }
    if (wantsAdc && pin.capabilities?.adc !== true && pin.kind !== "analog") {
      issues.push({ code: "blockly_adc_pin_incompatible", record_id: id, detail: type + " pin " + pin.id + " has no ADC capability in " + boardId });
    }
    if (outputRequested && (pin.capabilities?.inputOnly === true || pin.kind === "power" || pin.kind === "ground")) {
      issues.push({ code: "blockly_output_pin_incompatible", record_id: id, detail: type + " requests output on non-output pin " + pin.id + " of " + boardId });
    }
  }
  try {
    const validation = modules.validator.validateProposedCircuit(
      { ...circuit, blocklyXml: code },
      { allowWarnings: true, targetBoard: boardId },
    );
    if (!validation.valid) {
      issues.push({ code: "blockly_circuit_validator_failed", record_id: id, detail: (validation.errors || []).join("; ") });
    }
  } catch (error) {
    issues.push({ code: "blockly_validator_error", record_id: id, detail: String(error?.message || error) });
  }
  let calculatedTopology;
  try {
    calculatedTopology = topologyForCircuit(circuit, modules);
  } catch (error) {
    issues.push({ code: "blockly_topology_unavailable", record_id: id, detail: String(error?.message || error) });
  }
  const parentLiveTopology = parent ? liveTopologyByCanonicalId.get(parent.record_id) : null;
  if (parent && calculatedTopology && parentLiveTopology && calculatedTopology !== parentLiveTopology) {
    issues.push({ code: "blockly_parent_topology_mismatch", record_id: id, detail: "Blockly target differs from its live canonical parent topology" });
  }
  if (parent && record.hashes?.topology_hash !== parent.hashes?.topology_hash) {
    issues.push({ code: "blockly_topology_metadata_mismatch", record_id: id, detail: "Stored topology metadata must be inherited from the canonical parent until a coordinated dataset migration" });
  }
}

export function buildPhase25Audit({ canonicalRecords, diagnosisRecords, blocklyRecords, modules, minimumPerTask = 50 }) {
  const issues = [];
  const warnings = [];
  const canonicalById = new Map();
  const liveTopologyByCanonicalId = new Map();
  const legacyTopologyHashMismatches = [];
  const seenCanonicalIds = new Set();
  for (const record of Array.isArray(canonicalRecords) ? canonicalRecords : []) {
    if (!record?.record_id || seenCanonicalIds.has(record.record_id)) {
      issues.push({ code: "canonical_id_missing_or_duplicate", record_id: record?.record_id || null, detail: "Canonical parents must have unique stable record IDs" });
      continue;
    }
    seenCanonicalIds.add(record.record_id);
    canonicalById.set(record.record_id, record);
    if (record.target?.circuit) {
      try {
        const calculated = topologyForCircuit(record.target.circuit, modules);
        liveTopologyByCanonicalId.set(record.record_id, calculated);
        if (calculated !== record.hashes?.topology_hash) {
          // Do not rewrite existing corpus hashes implicitly. The checked-in
          // corpus may have been sealed with an earlier topology-hash contract;
          // use a freshly computed parent fingerprint for Phase 2.5 circuit
          // equivalence checks and report the legacy metadata distinctly.
          legacyTopologyHashMismatches.push({
            record_id: record.record_id,
            stored_hash: record.hashes?.topology_hash || null,
            live_hash: calculated,
          });
        }
      } catch (error) {
        issues.push({ code: "canonical_topology_unavailable", record_id: record.record_id, detail: String(error?.message || error) });
      }
    }
  }
  const seenDerivedIds = new Set();
  for (const record of Array.isArray(diagnosisRecords) ? diagnosisRecords : []) {
    if (!record?.record_id || seenDerivedIds.has(record.record_id)) {
      issues.push({ code: "diagnosis_id_missing_or_duplicate", record_id: record?.record_id || null, detail: "Diagnosis IDs must be unique" });
      continue;
    }
    seenDerivedIds.add(record.record_id);
    const parent = validateRecordParent(record, canonicalById, issues);
    validateDiagnosis(record, parent, modules, issues, liveTopologyByCanonicalId);
  }
  for (const record of Array.isArray(blocklyRecords) ? blocklyRecords : []) {
    if (!record?.record_id || seenDerivedIds.has(record.record_id)) {
      issues.push({ code: "blockly_id_missing_or_duplicate", record_id: record?.record_id || null, detail: "Released record IDs must be unique across derived tasks" });
      continue;
    }
    seenDerivedIds.add(record.record_id);
    const parent = validateRecordParent(record, canonicalById, issues);
    validateBlockly(record, parent, modules, issues, liveTopologyByCanonicalId);
  }
  const diagnosisFailures = issues.filter((issue) => String(issue.code).startsWith("diagnosis_") || String(issue.code).startsWith("canonical_") || issue.code === "missing_canonical_parent" || issue.code === "parent_family_mismatch" || issue.code === "parent_board_mismatch" || issue.code === "parent_provenance_mismatch");
  const blocklyFailures = issues.filter((issue) => String(issue.code).startsWith("blockly_"));
  const diagnosisPassed = Array.isArray(diagnosisRecords) && diagnosisRecords.length >= minimumPerTask && diagnosisFailures.length === 0;
  const blocklyPassed = Array.isArray(blocklyRecords) && blocklyRecords.length >= minimumPerTask && blocklyFailures.length === 0;
  if (legacyTopologyHashMismatches.length) {
    warnings.push({
      code: "legacy_stored_topology_hash_mismatch",
      record_ids: legacyTopologyHashMismatches.map((item) => item.record_id),
      count: legacyTopologyHashMismatches.length,
      detail: "Existing canonical topology hashes differ from the current live fingerprint. They are preserved; Phase 2.5 compares derived targets against fresh parent fingerprints. A corpus hash migration is not performed by this audit.",
    });
  }
  return {
    audit_name: "Pixiu AI Copilot Phase 2.5 Diagnosis and Blockly Evidence Audit",
    audit_version: "1.1.0",
    passed: diagnosisPassed && blocklyPassed && issues.length === 0,
    scope: "Internal source-matched circuit targets only; static/simulated evidence is not physical hardware certification; Blockly compile/execution is not claimed. Legacy stored topology hash mismatches are reported as warnings, not silently migrated.",
    minimum_records_per_task: minimumPerTask,
    metrics: {
      canonical_parents: Array.isArray(canonicalRecords) ? canonicalRecords.length : 0,
      legacy_canonical_topology_hash_mismatches: legacyTopologyHashMismatches.length,
      diagnosis: { records: Array.isArray(diagnosisRecords) ? diagnosisRecords.length : 0, passed: diagnosisPassed, failures: diagnosisFailures.length },
      blockly: { records: Array.isArray(blocklyRecords) ? blocklyRecords.length : 0, passed: blocklyPassed, failures: blocklyFailures.length },
      total_findings: issues.length,
    },
    warnings,
    issues,
  };
}
