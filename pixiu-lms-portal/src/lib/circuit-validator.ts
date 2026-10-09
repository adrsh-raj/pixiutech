/**
 * PIXIU TECH CYBERLAB — DETERMINISTIC CIRCUIT VALIDATOR
 * 
 * 7-Layer Physics, Schema, and Electrical Validation Engine for
 * Pixiu AI Circuit Copilot & CyberLab Interactive Workbench.
 * 
 * Core Architectural Principle:
 * "Make the model propose; make software verify."
 * Untrusted AI payloads are deterministically validated before touching canvas state.
 * 
 * Layers:
 * 1. Schema & Type Envelope (JSON structural validity, unique IDs, coordinate ranges)
 * 2. Identity & Pin Registry Validation (Dataset lookup, canonical alias resolution)
 * 3. Board & Pin Capability Verification (PWM, ADC, I2C, Serial, logic voltage levels)
 * 4. Netlist Graph Topology & Electrical Short-Circuit Engine (Equivalence classes, 0Ω shorts)
 * 5. Component Burnout & Protection Verification (LED series resistor, 3.3V overvoltage)
 * 6. Inductive Budget & Module Continuity (Missing GND return paths, motor GPIO overdrive)
 * 7. Canonical Normalization & Revision Hashing (Deterministic state, collision-resistant hash)
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { CircuitState, PlacedPart, Wire, PartType } from "./circuit-types"
import { PIXIU_COMPONENTS_DATASET } from "./ai/pixiu-components-dataset"
import { CATALOG } from "./components-catalog"
import {
  getBoardDefinition,
  isBoardPart,
  getBoardForPart,
  type BoardDefinition,
  type BoardId,
} from "./board-registry"

// ============================================================================
// Types & Interfaces
// ============================================================================

export type DiagnosticSeverity = "critical" | "warning" | "advisory"
export type DiagnosticCategory = "schema" | "identity" | "pinout" | "safety" | "budget" | "protocol" | "syntax" | "wiring"

export interface DiagnosticNotice {
  ruleId: string
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  title: string
  message: string
  suggestion: string
  involvedPartIds: string[]
  involvedPinIds?: string[]
}

export interface ValidationMetric {
  partCount: number
  wireCount: number
  unconnectedPins: number
  powerRailsOk: boolean
  shortCircuitsFound: number
  overcurrentRisks: number
  overvoltageRisks: number
  unpoweredModules: number
  missingReturnPaths: number
}

export interface CircuitValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  notices: DiagnosticNotice[]
  normalizedCircuit?: CircuitState
  metrics: ValidationMetric
  revHash: string
}

export interface ValidateCircuitOptions {
  /** If true, warnings do not fail validation (only critical errors do). Default: true */
  allowWarnings?: boolean
  /** Base circuit state for incremental validation or stale proposal detection */
  baseCircuit?: CircuitState
  /** Expected target board ID (e.g. 'arduino-uno', 'esp32-devkit') */
  targetBoard?: BoardId
}

// ============================================================================
// Alias Dictionaries for All 32 Components
// ============================================================================

const PIN_ALIAS_MAP: Record<string, Record<string, string>> = {
  led: {
    a: "anode",
    pos: "anode",
    "+": "anode",
    p: "anode",
    plus: "anode",
    k: "cathode",
    neg: "cathode",
    "-": "cathode",
    c: "cathode",
    minus: "cathode",
  },
  resistor: {
    t1: "a",
    "1": "a",
    pin1: "a",
    term1: "a",
    t2: "b",
    "2": "b",
    pin2: "b",
    term2: "b",
  },
  pushbutton: {
    "1a": "p1a",
    t1a: "p1a",
    terminal1a: "p1a",
    "1b": "p1b",
    t1b: "p1b",
    terminal1b: "p1b",
    "2a": "p2a",
    t2a: "p2a",
    terminal2a: "p2a",
    "2b": "p2b",
    t2b: "p2b",
    terminal2b: "p2b",
  },
  potentiometer: {
    t1: "t1",
    "1": "t1",
    pin1: "t1",
    vcc: "t1",
    "5v": "t1",
    wiper: "wiper",
    w: "wiper",
    out: "wiper",
    sig: "wiper",
    "2": "wiper",
    pin2: "wiper",
    t2: "t2",
    "3": "t2",
    pin3: "t2",
    gnd: "t2",
  },
  battery: {
    pos: "pos",
    "+": "pos",
    positive: "pos",
    vcc: "pos",
    "9v": "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    negative: "neg",
    gnd: "neg",
    black: "neg",
  },
  servo: {
    sig: "sig",
    signal: "sig",
    pwm: "sig",
    control: "sig",
    orange: "sig",
    yellow: "sig",
    data: "sig",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    red: "vcc",
    pos: "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    black: "gnd",
    brown: "gnd",
    neg: "gnd",
    "-": "gnd",
  },
  buzzer: {
    pos: "pos",
    "+": "pos",
    anode: "pos",
    sig: "pos",
    signal: "pos",
    pin1: "pos",
    vcc: "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    cathode: "neg",
    gnd: "neg",
    ground: "neg",
    pin2: "neg",
    black: "neg",
  },
  "rgb-led": {
    r: "red",
    anode_r: "red",
    gnd: "gnd",
    com: "gnd",
    cathode: "gnd",
    c: "gnd",
    "-": "gnd",
    g: "green",
    anode_g: "green",
    b: "blue",
    anode_b: "blue",
  },
  ultrasonic: {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    trig: "trig",
    trigger: "trig",
    echo: "echo",
    gnd: "gnd",
    ground: "gnd",
  },
  dht11: {
    vcc: "vcc",
    "+": "vcc",
    power: "vcc",
    data: "data",
    out: "data",
    sig: "data",
    signal: "data",
    pin2: "data",
    gnd: "gnd",
    "-": "gnd",
    ground: "gnd",
  },
  "pir-sensor": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd",
  },
  tmp36: {
    vcc: "vcc",
    vs: "vcc",
    power: "vcc",
    out: "out",
    vout: "out",
    sig: "out",
    signal: "out",
    analog: "out",
    gnd: "gnd",
    ground: "gnd",
  },
  ldr: {
    t1: "t1",
    "1": "t1",
    a: "t1",
    pin1: "t1",
    t2: "t2",
    "2": "t2",
    b: "t2",
    pin2: "t2",
  },
  relay: {
    vcc: "vcc",
    power: "vcc",
    gnd: "gnd",
    ground: "gnd",
    in: "in",
    sig: "in",
    signal: "in",
    control: "in",
    input: "in",
    com: "com",
    common: "com",
    no: "no",
    normally_open: "no",
    nc: "nc",
    normally_closed: "nc",
  },
  l298n: {
    vs: "vs",
    vcc: "vs",
    power: "vs",
    "12v": "vs",
    "9v": "vs",
    gnd: "gnd",
    ground: "gnd",
    "5v": "5v",
    logic_vcc: "5v",
    ena: "ena",
    enb: "enb",
    in1: "in1",
    in2: "in2",
    in3: "in3",
    in4: "in4",
    out1: "out1",
    out2: "out2",
    out3: "out3",
    out4: "out4",
  },
  "lcd-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    sda: "sda",
    data: "sda",
    scl: "scl",
    clk: "scl",
    clock: "scl",
  },
  "oled-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "3v3": "vcc",
    "5v": "vcc",
    scl: "scl",
    clk: "scl",
    clock: "scl",
    sda: "sda",
    data: "sda",
  },
  "neopixel-ring": {
    di: "di",
    din: "di",
    data: "di",
    in: "di",
    sig: "di",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    "-": "gnd",
    do: "do",
    dout: "do",
    out: "do",
  },
  "mq2-gas": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    gnd: "gnd",
    ground: "gnd",
    do: "do",
    digital: "do",
    dout: "do",
    ao: "ao",
    analog: "ao",
    aout: "ao",
  },
  "soil-moisture": {
    vcc: "vcc",
    power: "vcc",
    ao: "ao",
    analog: "ao",
    out: "ao",
    sig: "ao",
    signal: "ao",
    gnd: "gnd",
    ground: "gnd",
  },
  "ir-sensor": {
    vcc: "vcc",
    power: "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd",
  },
  joystick: {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    vrx: "vrx",
    x: "vrx",
    vx: "vrx",
    vry: "vry",
    y: "vry",
    vy: "vry",
    sw: "sw",
    btn: "sw",
    switch: "sw",
    button: "sw",
  },
  "rotary-encoder": {
    gnd: "gnd",
    vcc: "vcc",
    clk: "clk",
    a: "clk",
    dt: "dt",
    b: "dt",
    sw: "sw",
    btn: "sw",
  },
  "dc-motor": {
    pos: "pos",
    "+": "pos",
    "m+": "pos",
    pin1: "pos",
    neg: "neg",
    "-": "neg",
    "m-": "neg",
    pin2: "neg",
  },
  "npn-transistor": {
    collector: "collector",
    c: "collector",
    base: "base",
    b: "base",
    emitter: "emitter",
    e: "emitter",
  },
  "seven-segment": {
    com: "com",
    common: "com",
    gnd: "com",
    cathode: "com",
    dp: "dp",
    dot: "dp",
  },
}

// ============================================================================
// Helper: Canonical Pin Resolution
// ============================================================================

export function resolveCanonicalPin(partType: string, pinId: string): string {
  const clean = pinId.trim().toLowerCase()
  if (!clean) return clean

  // Check alias map for known discrete components
  const partAliases = PIN_ALIAS_MAP[partType]
  if (partAliases && partAliases[clean]) {
    return partAliases[clean]
  }

  // Breadboard coordinates: a_1, b_1 ... j_20, pos_t_1, neg_t_1, etc.
  if (partType === "breadboard") {
    // Legacy top/bottom rails
    if (clean === "pos_top" || clean === "+top" || clean === "top_+") return "pos_top"
    if (clean === "neg_top" || clean === "-top" || clean === "top_-") return "neg_top"
    if (clean === "pos_bot" || clean === "+bot" || clean === "bot_+") return "pos_bot"
    if (clean === "neg_bot" || clean === "-bot" || clean === "bot_-") return "neg_bot"
    // Column pins like a1 -> a1 or a_1
    return clean.replace(/[-]/g, "_")
  }

  // Microcontrollers (Uno, ESP32, Pico, micro:bit)
  if (isBoardPart(partType)) {
    const board = getBoardDefinition(partType)
    if (board) {
      // 1. Direct match
      for (const p of board.pins) {
        if (p.id.toLowerCase() === clean || p.label.toLowerCase() === clean) {
          return p.id
        }
        if (p.alternateNames?.some((alt) => alt.toLowerCase() === clean)) {
          return p.id
        }
      }
      // 2. Power pin normalization
      if (clean === "5v" || clean === "v5") return "5v"
      if (clean === "v33" || clean === "3v3" || clean === "3.3v" || clean === "3v") {
        return board.powerPins.v33?.[0] ?? "3v3"
      }
      if (clean === "vin" || clean === "v_in") return "vin"
      if (clean === "gnd" || clean.startsWith("gnd")) {
        return board.powerPins.gnd[0] ?? "gnd"
      }
      // 3. Digital pin strip / prefix
      // If student wrote "13" -> Uno "d13"
      const numOnly = clean.replace(/^(gpio|gp|d|p)/, "")
      if (/^\d+$/.test(numOnly)) {
        for (const p of board.pins) {
          const bpNum = p.id.replace(/^(gpio|gp|d|p)/, "")
          if (bpNum === numOnly) return p.id
        }
      }
    }
  }

  // Resolve declared aliases from the ground-truth component dataset. Only return
  // aliases whose canonical ID actually exists in the rendered catalog.
  const catalogDefinition = CATALOG[partType as PartType]
  const componentPins = PIXIU_COMPONENTS_DATASET[partType]?.pins ?? []
  const datasetPin = componentPins.find((pin) =>
    pin.id.toLowerCase() === clean ||
    pin.label.trim().toLowerCase() === clean ||
    pin.aliases.some((alias) => alias.trim().toLowerCase() === clean),
  )
  if (datasetPin && catalogDefinition?.pins.some((pin) => pin.id.toLowerCase() === datasetPin.id.toLowerCase())) {
    return datasetPin.id
  }

  const catalogPin = catalogDefinition?.pins.find(
    (pin) => pin.id.toLowerCase() === clean || pin.label.trim().toLowerCase() === clean,
  )
  if (catalogPin) return catalogPin.id

  // Leave unknown values untouched; the validator below will reject them.
  return clean
}

function isRegisteredPin(partType: string, pinId: string): boolean {
  const definition = CATALOG[partType as PartType]
  return Boolean(definition?.pins.some((pin) => pin.id.toLowerCase() === pinId.toLowerCase()))
}

// ============================================================================
// Helper: Deterministic non-cryptographic revision fingerprint (Dual 32-bit FNV-1a)
// ============================================================================

export function computeCircuitHash(circuit: CircuitState, blocklyXml?: string): string {
  // 1. Sort parts by ID
  const sortedParts = [...circuit.parts].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({
    id: p.id,
    type: p.type,
    // Preserve sub-pixel edits; revision guards must not round away real mutations.
    x: Object.is(p.x, -0) ? 0 : p.x,
    y: Object.is(p.y, -0) ? 0 : p.y,
    rotation: Object.is(p.rotation || 0, -0) ? 0 : (p.rotation || 0),
    props: Object.keys(p.props || {})
      .sort()
      .reduce((acc, k) => {
        acc[k] = p.props[k]
        return acc
      }, {} as Record<string, string | number>),
  }))

  // 2. Sort wires deterministically
  const sortedWires = [...circuit.wires].sort((a, b) => {
    const kA = `${a.from.partId}:${a.from.pinId}->${a.to.partId}:${a.to.pinId}`
    const kB = `${b.from.partId}:${b.from.pinId}->${b.to.partId}:${b.to.pinId}`
    return kA.localeCompare(kB)
  }).map((w) => ({
    from: `${w.from.partId}:${w.from.pinId}`,
    to: `${w.to.partId}:${w.to.pinId}`,
    color: w.color || "#38bdf8",
  }))

  // Blockly edits are part of the user-authored lab state too. When supplied, XML
  // participates in the revision fingerprint so circuit-only changes cannot mask
  // a newer workspace edit.
  const canonicalStr = JSON.stringify({
    parts: sortedParts,
    wires: sortedWires,
    blocklyXml: blocklyXml ?? null,
  })

  // 3. Dual 32-bit FNV-1a Hash
  let h1 = 0x811c9dc5
  let h2 = 0x811c9dc5 ^ 0x5bd1e995

  for (let i = 0; i < canonicalStr.length; i++) {
    const code = canonicalStr.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code
    h2 = Math.imul(h2, 0x01000193)
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, "0")
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0")
  return `${p1}${p2}`
}

// ============================================================================
// Netlist Graph & Disjoint-Set Union (Union-Find)
// ============================================================================

class DisjointSet {
  private parent = new Map<string, string>()

  find(item: string): string {
    if (!this.parent.has(item)) {
      this.parent.set(item, item)
      return item
    }
    const root = this.parent.get(item)!
    if (root === item) return item
    const resolved = this.find(root)
    this.parent.set(item, resolved)
    return resolved
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA)
    }
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b)
  }

  allNodes(): string[] {
    return Array.from(this.parent.keys())
  }
}

// ============================================================================
// Main Validation Engine
// ============================================================================

export function validateProposedCircuit(
  candidate: unknown,
  options: ValidateCircuitOptions = {},
): CircuitValidationResult {
  const allowWarnings = options.allowWarnings ?? true
  const notices: DiagnosticNotice[] = []
  const errors: string[] = []
  const warnings: string[] = []

  const metrics: ValidationMetric = {
    partCount: 0,
    wireCount: 0,
    unconnectedPins: 0,
    powerRailsOk: true,
    shortCircuitsFound: 0,
    overcurrentRisks: 0,
    overvoltageRisks: 0,
    unpoweredModules: 0,
    missingReturnPaths: 0,
  }

  const addNotice = (notice: DiagnosticNotice) => {
    notices.push(notice)
    if (notice.severity === "critical") {
      errors.push(`${notice.title}: ${notice.message}`)
    } else if (notice.severity === "warning") {
      warnings.push(`${notice.title}: ${notice.message}`)
    }
  }

  // --------------------------------------------------------------------------
  // LAYER 1: Schema & Type Envelope Validation
  // --------------------------------------------------------------------------
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    addNotice({
      ruleId: "schema-envelope-invalid",
      severity: "critical",
      category: "schema",
      title: "Malformed Circuit Payload",
      message: "The circuit proposal is not a valid JSON object.",
      suggestion: "Provide a JSON object containing 'parts' and 'wires' arrays.",
      involvedPartIds: [],
    })
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000",
    }
  }

  const rawCandidate = candidate as { parts?: unknown; wires?: unknown; blocklyXml?: unknown }

  if (!Array.isArray(rawCandidate.parts)) {
    addNotice({
      ruleId: "schema-parts-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Parts Array",
      message: "Proposed circuit object must contain a 'parts' array.",
      suggestion: "Include 'parts: []' in the proposed circuit structure.",
      involvedPartIds: [],
    })
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000",
    }
  }

  if (!Array.isArray(rawCandidate.wires)) {
    addNotice({
      ruleId: "schema-wires-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Wires Array",
      message: "Proposed circuit object must contain a 'wires' array.",
      suggestion: "Include 'wires: []' in the proposed circuit structure.",
      involvedPartIds: [],
    })
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000",
    }
  }

  // Validate part items
  const partMap = new Map<string, PlacedPart>()
  const validPartIds = new Set<string>()

  for (let i = 0; i < rawCandidate.parts.length; i++) {
    const rawPart = rawCandidate.parts[i]
    if (!rawPart || typeof rawPart !== "object") {
      addNotice({
        ruleId: `schema-part-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Part Entry",
        message: `Part at index ${i} is not a valid object.`,
        suggestion: "Ensure all items in the 'parts' array are valid PlacedPart objects.",
        involvedPartIds: [],
      })
      continue
    }

    const p = rawPart as Partial<PlacedPart>
    if (!p.id || typeof p.id !== "string" || !p.id.trim()) {
      addNotice({
        ruleId: `schema-part-${i}-missing-id`,
        severity: "critical",
        category: "schema",
        title: "Missing Part ID",
        message: `Part at index ${i} is missing a valid string 'id'.`,
        suggestion: "Assign a unique string identifier (e.g., 'uno', 'led-1') to every part.",
        involvedPartIds: [],
      })
      continue
    }

    const normalizedPartId = p.id.trim()
    if (validPartIds.has(normalizedPartId)) {
      addNotice({
        ruleId: `schema-duplicate-part-id-${normalizedPartId}`,
        severity: "critical",
        category: "schema",
        title: "Duplicate Part ID",
        message: `Multiple components share the normalized ID '${normalizedPartId}'. Part IDs must be unique after trimming whitespace.`,
        suggestion: `Rename one of the parts with ID '${normalizedPartId}' to a distinct identifier.`,
        involvedPartIds: [normalizedPartId],
      })
      continue
    }

    if (!p.type || typeof p.type !== "string") {
      addNotice({
        ruleId: `schema-part-${p.id}-missing-type`,
        severity: "critical",
        category: "schema",
        title: "Missing Part Type",
        message: `Component '${p.id}' does not specify a valid 'type'.`,
        suggestion: "Specify a recognized component type from the Pixiu CyberLab catalog.",
        involvedPartIds: [p.id],
      })
      continue
    }

    const coordinateFields = [
      { field: "x", value: p.x },
      { field: "y", value: p.y },
      { field: "rotation", value: p.rotation },
    ]
    const malformedCoordinate = coordinateFields.find(
      ({ value }) => value !== undefined && (typeof value !== "number" || !Number.isFinite(value)),
    )
    const coordinateOutOfBounds =
      (typeof p.x === "number" && Math.abs(p.x) > 100_000) ||
      (typeof p.y === "number" && Math.abs(p.y) > 100_000) ||
      (typeof p.rotation === "number" && Math.abs(p.rotation) > 3_600)

    if (malformedCoordinate || coordinateOutOfBounds) {
      const field = malformedCoordinate?.field ?? "x/y/rotation"
      addNotice({
        ruleId: `schema-part-${normalizedPartId}-coordinate-invalid`,
        severity: "critical",
        category: "schema",
        title: "Invalid Component Coordinates",
        message: malformedCoordinate
          ? `Component '${normalizedPartId}' has a non-finite or non-numeric '${field}' value.`
          : `Component '${normalizedPartId}' exceeds the allowed canvas coordinate/rotation bounds.`,
        suggestion: "Use finite numeric x/y/rotation values; x/y must be within ±100,000 canvas units and rotation within ±3,600 degrees.",
        involvedPartIds: [normalizedPartId],
      })
      continue
    }

    const placed: PlacedPart = {
      id: normalizedPartId,
      type: p.type.trim() as PartType,
      x: Number.isFinite(p.x) ? Number(p.x) : 100,
      y: Number.isFinite(p.y) ? Number(p.y) : 100,
      rotation: Number.isFinite(p.rotation) ? Number(p.rotation) : 0,
      props: p.props && typeof p.props === "object" ? { ...p.props } : {},
    }

    validPartIds.add(placed.id)
    partMap.set(placed.id, placed)
  }

  metrics.partCount = partMap.size

  // --------------------------------------------------------------------------
  // LAYER 2: Component Identity & Pin Registry Resolution
  // --------------------------------------------------------------------------
  const validComponentTypes = new Set([
    ...Object.keys(PIXIU_COMPONENTS_DATASET),
    ...Object.keys(CATALOG),
    "arduino-uno",
    "esp32-devkit",
    "rpi-pico",
    "microbit-v2",
  ])

  for (const part of partMap.values()) {
    if (!validComponentTypes.has(part.type)) {
      addNotice({
        ruleId: `identity-unknown-part-type-${part.type}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Type",
        message: `Component '${part.id}' specifies unrecognized type '${part.type}'.`,
        suggestion: `Use one of the supported 32 components in Pixiu CyberLab.`,
        involvedPartIds: [part.id],
      })
    }
  }

  // Validate wires & resolve aliases
  const normalizedWires: Wire[] = []
  const wireIdSet = new Set<string>()

  for (let i = 0; i < rawCandidate.wires.length; i++) {
    const rawWire = rawCandidate.wires[i]
    if (!rawWire || typeof rawWire !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Wire Entry",
        message: `Wire at index ${i} is not a valid object.`,
        suggestion: "Ensure each wire specifies 'from' and 'to' endpoints.",
        involvedPartIds: [],
      })
      continue
    }

    const w = rawWire as Partial<Wire>
    if (!w.from || typeof w.from !== "object" || !w.to || typeof w.to !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-missing-endpoints`,
        severity: "critical",
        category: "schema",
        title: "Incomplete Wire Endpoints",
        message: `Wire at index ${i} is missing 'from' or 'to' endpoint definitions.`,
        suggestion: "Each wire must define { from: { partId, pinId }, to: { partId, pinId } }.",
        involvedPartIds: [],
      })
      continue
    }

    const fromPartId = String(w.from.partId || "").trim()
    const fromPinRaw = String(w.from.pinId || "").trim()
    const toPartId = String(w.to.partId || "").trim()
    const toPinRaw = String(w.to.pinId || "").trim()

    if (!fromPartId || !fromPinRaw || !toPartId || !toPinRaw) {
      addNotice({
        ruleId: `schema-wire-${i}-empty-endpoint-ids`,
        severity: "critical",
        category: "schema",
        title: "Empty Wire Endpoint Identifiers",
        message: `Wire at index ${i} has empty partId or pinId fields.`,
        suggestion: "Specify non-empty partId and pinId strings for both endpoints.",
        involvedPartIds: [],
      })
      continue
    }

    // Check if referenced parts exist
    const fromPart = partMap.get(fromPartId)
    const toPart = partMap.get(toPartId)

    if (!fromPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${fromPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Origin Part Not Found",
        message: `Wire starts at component '${fromPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${fromPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [fromPartId],
      })
      continue
    }

    if (!toPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${toPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Target Part Not Found",
        message: `Wire ends at component '${toPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${toPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [toPartId],
      })
      continue
    }

    // Normalize pin aliases
    const canonicalFromPin = resolveCanonicalPin(fromPart.type, fromPinRaw)
    const canonicalToPin = resolveCanonicalPin(toPart.type, toPinRaw)

    let invalidPinEndpoint = false
    if (!isRegisteredPin(fromPart.type, canonicalFromPin)) {
      invalidPinEndpoint = true
      addNotice({
        ruleId: `identity-unknown-pin-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${fromPinRaw}' resolves to '${canonicalFromPin}', which is not registered on component '${fromPartId}' (${fromPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin],
      })
    }
    if (!isRegisteredPin(toPart.type, canonicalToPin)) {
      invalidPinEndpoint = true
      addNotice({
        ruleId: `identity-unknown-pin-${toPartId}-${canonicalToPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${toPinRaw}' resolves to '${canonicalToPin}', which is not registered on component '${toPartId}' (${toPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [toPartId],
        involvedPinIds: [canonicalToPin],
      })
    }
    if (invalidPinEndpoint) continue

    // Self-connecting wire check
    if (fromPartId === toPartId && canonicalFromPin === canonicalToPin) {
      addNotice({
        ruleId: `safety-self-loop-wire-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "safety",
        title: "Redundant Self-Connecting Wire Loop",
        message: `Wire connects pin '${canonicalFromPin}' on '${fromPartId}' to itself.`,
        suggestion: "Remove redundant loop wire connecting the same pin to itself.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin],
      })
      continue
    }

    const wireId =
      w.id && typeof w.id === "string" && !wireIdSet.has(w.id)
        ? w.id
        : `w_${fromPartId}_${canonicalFromPin}_${toPartId}_${canonicalToPin}_${i}`

    wireIdSet.add(wireId)

    normalizedWires.push({
      id: wireId,
      from: { partId: fromPartId, pinId: canonicalFromPin },
      to: { partId: toPartId, pinId: canonicalToPin },
      color: typeof w.color === "string" && w.color ? w.color : "#38bdf8",
    })
  }

  metrics.wireCount = normalizedWires.length

  // Construct normalized circuit candidate
  const normalizedParts = Array.from(partMap.values())
  const normalizedCircuit: CircuitState = {
    parts: normalizedParts,
    wires: normalizedWires,
  }

  const revHash = computeCircuitHash(
    normalizedCircuit,
    typeof rawCandidate.blocklyXml === "string" ? rawCandidate.blocklyXml : undefined,
  )

  // --------------------------------------------------------------------------
  // LAYER 3: Board & Pin Capability Verification
  // --------------------------------------------------------------------------
  const boardParts = normalizedParts.filter((p) => isBoardPart(p.type))
  const primaryBoardPart = boardParts[0]
  const boardDef: BoardDefinition | undefined = primaryBoardPart
    ? getBoardForPart(primaryBoardPart)
    : undefined

  if (boardParts.length > 1) {
    addNotice({
      ruleId: "budget-multiple-boards-detected",
      severity: "warning",
      category: "budget",
      title: "Multiple Microcontrollers Detected",
      message: `The canvas contains ${boardParts.length} microcontroller boards (${boardParts.map((b) => b.id).join(", ")}).`,
      suggestion: "Ensure shared common ground continuity across all microcontrollers.",
      involvedPartIds: boardParts.map((b) => b.id),
    })
  }

  // --------------------------------------------------------------------------
  // LAYER 4: Netlist Graph Topology & Electrical Short-Circuit Detection
  // --------------------------------------------------------------------------
  const netlist = new DisjointSet()
  const pinKey = (partId: string, pinId: string) => `${partId}:${pinId}`

  // 1. Add all jumper wires (0Ω ideal copper conductors)
  for (const w of normalizedWires) {
    netlist.union(pinKey(w.from.partId, w.from.pinId), pinKey(w.to.partId, w.to.pinId))
  }

  // 2. Add internal zero-resistance tie points for breadboards & switches
  for (const part of normalizedParts) {
    if (part.type === "breadboard") {
      // Connect vertical tie columns
      for (let c = 1; c <= 20; c++) {
        const topRow = ["a", "b", "c", "d", "e"]
        for (let r = 0; r < topRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${topRow[r]}_${c}`), pinKey(part.id, `${topRow[r + 1]}_${c}`))
        }
        const botRow = ["f", "g", "h", "i", "j"]
        for (let r = 0; r < botRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${botRow[r]}_${c}`), pinKey(part.id, `${botRow[r + 1]}_${c}`))
        }
      }
      // Power rails continuous across columns
      for (let c = 1; c < 20; c++) {
        netlist.union(pinKey(part.id, `pos_t_${c}`), pinKey(part.id, `pos_t_${c + 1}`))
        netlist.union(pinKey(part.id, `neg_t_${c}`), pinKey(part.id, `neg_t_${c + 1}`))
        netlist.union(pinKey(part.id, `pos_b_${c}`), pinKey(part.id, `pos_b_${c + 1}`))
        netlist.union(pinKey(part.id, `neg_b_${c}`), pinKey(part.id, `neg_b_${c + 1}`))
      }
      // Legacy breadboard pin aliases bridged to row 1
      netlist.union(pinKey(part.id, "pos_top"), pinKey(part.id, "pos_t_1"))
      netlist.union(pinKey(part.id, "neg_top"), pinKey(part.id, "neg_t_1"))
      netlist.union(pinKey(part.id, "pos_bot"), pinKey(part.id, "pos_b_1"))
      netlist.union(pinKey(part.id, "neg_bot"), pinKey(part.id, "neg_b_1"))
      netlist.union(pinKey(part.id, "a1"), pinKey(part.id, "a_3"))
      netlist.union(pinKey(part.id, "b1"), pinKey(part.id, "b_3"))
      netlist.union(pinKey(part.id, "c1"), pinKey(part.id, "c_3"))
      netlist.union(pinKey(part.id, "d1"), pinKey(part.id, "d_3"))
      netlist.union(pinKey(part.id, "e1"), pinKey(part.id, "e_3"))
      netlist.union(pinKey(part.id, "a2"), pinKey(part.id, "f_3"))
      netlist.union(pinKey(part.id, "b2"), pinKey(part.id, "g_3"))
      netlist.union(pinKey(part.id, "c2"), pinKey(part.id, "h_3"))
      netlist.union(pinKey(part.id, "d2"), pinKey(part.id, "i_3"))
      netlist.union(pinKey(part.id, "e2"), pinKey(part.id, "j_3"))
    } else if (part.type === "pushbutton") {
      // Tactile pushbutton internally bridges 1a-1b and 2a-2b
      netlist.union(pinKey(part.id, "p1a"), pinKey(part.id, "p1b"))
      netlist.union(pinKey(part.id, "p2a"), pinKey(part.id, "p2b"))
    }
  }

  // Gather Power and Ground Rails across boards and external power supplies
  const v5Pins: string[] = []
  const v33Pins: string[] = []
  const gndPins: string[] = []
  const batteryPosPins: string[] = []
  const batteryNegPins: string[] = []

  for (const bPart of boardParts) {
    const b = getBoardForPart(bPart)
    if (!b) continue
    if (b.powerPins.v5) {
      v5Pins.push(...b.powerPins.v5.map((p) => pinKey(bPart.id, p)))
    }
    if (b.powerPins.v33) {
      v33Pins.push(...b.powerPins.v33.map((p) => pinKey(bPart.id, p)))
    }
    if (b.powerPins.vin) {
      v5Pins.push(...b.powerPins.vin.map((p) => pinKey(bPart.id, p)))
    }
    gndPins.push(...b.powerPins.gnd.map((p) => pinKey(bPart.id, p)))
  }

  for (const part of normalizedParts) {
    if (part.type === "battery") {
      batteryPosPins.push(pinKey(part.id, "pos"))
      batteryNegPins.push(pinKey(part.id, "neg"))
    }
  }

  // 1. Check for Direct 5V to GND Short Circuit
  for (const pwr of v5Pins) {
    for (const gnd of gndPins) {
      if (netlist.connected(pwr, gnd)) {
        metrics.shortCircuitsFound++
        metrics.powerRailsOk = false
        addNotice({
          ruleId: "safety-direct-power-short-5v",
          severity: "critical",
          category: "safety",
          title: "Direct Short Circuit Detected (5V to GND)",
          message: "The 5V power supply rail is connected directly to Ground with zero resistance. On hardware, this causes an overcurrent shutdown or burns out the onboard voltage regulator.",
          suggestion: "Remove the wire connecting 5V directly to Ground. Ensure a load or resistor separates power from ground.",
          involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
          involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]],
        })
        break
      }
    }
    if (!metrics.powerRailsOk) break
  }

  // 2. Check for Direct 3.3V to GND Short Circuit
  if (metrics.powerRailsOk) {
    for (const pwr of v33Pins) {
      for (const gnd of gndPins) {
        if (netlist.connected(pwr, gnd)) {
          metrics.shortCircuitsFound++
          metrics.powerRailsOk = false
          addNotice({
            ruleId: "safety-direct-power-short-3v3",
            severity: "critical",
            category: "safety",
            title: "Direct Short Circuit Detected (3.3V to GND)",
            message: "The 3.3V power supply rail is connected directly to Ground with zero resistance.",
            suggestion: "Remove the wire bridging 3.3V to Ground. Add a load or circuit component between them.",
            involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
            involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]],
          })
          break
        }
      }
      if (!metrics.powerRailsOk) break
    }
  }

  // 3. Check for 5V Shorted to 3.3V Power Rail
  if (metrics.powerRailsOk) {
    for (const v5 of v5Pins) {
      for (const v33 of v33Pins) {
        if (netlist.connected(v5, v33)) {
          metrics.shortCircuitsFound++
          metrics.powerRailsOk = false
          addNotice({
            ruleId: "safety-rail-conflict-5v-3v3",
            severity: "critical",
            category: "safety",
            title: "Voltage Rail Conflict (5V Shorted to 3.3V)",
            message: "The 5V power rail is tied directly to the 3.3V low-dropout regulator rail without a level shifter or regulator.",
            suggestion: "Disconnect the direct link between 5V and 3.3V power buses.",
            involvedPartIds: [v5.split(":")[0], v33.split(":")[0]],
            involvedPinIds: [v5.split(":")[1], v33.split(":")[1]],
          })
          break
        }
      }
      if (!metrics.powerRailsOk) break
    }
  }

  // 4. Check for Battery Short Circuit (Pos to Neg)
  for (const bPos of batteryPosPins) {
    const batPartId = bPos.split(":")[0]
    const bNeg = pinKey(batPartId, "neg")
    if (netlist.connected(bPos, bNeg)) {
      metrics.shortCircuitsFound++
      metrics.powerRailsOk = false
      addNotice({
        ruleId: `safety-battery-short-${batPartId}`,
        severity: "critical",
        category: "safety",
        title: "Battery Terminal Short Circuit",
        message: `9V Battery '${batPartId}' positive and negative terminals are connected together with 0Ω resistance. This causes thermal runaway and battery rupture.`,
        suggestion: "Remove direct short between battery positive and negative terminals.",
        involvedPartIds: [batPartId],
        involvedPinIds: ["pos", "neg"],
      })
    }
  }

  // --------------------------------------------------------------------------
  // LAYER 5: Component Burnout & Series Resistor Verification (LEDs)
  // --------------------------------------------------------------------------
  // Build adjacency graph of resistive connections
  const resistiveGraph = new Map<string, { to: string; resistance: number }[]>()
  const addResistiveEdge = (u: string, v: string, r: number) => {
    if (!resistiveGraph.has(u)) resistiveGraph.set(u, [])
    if (!resistiveGraph.has(v)) resistiveGraph.set(v, [])
    resistiveGraph.get(u)!.push({ to: v, resistance: r })
    resistiveGraph.get(v)!.push({ to: u, resistance: r })
  }

  // Add 0-ohm net connections
  for (const node of netlist.allNodes()) {
    const root = netlist.find(node)
    if (root !== node) {
      addResistiveEdge(node, root, 0)
    }
  }

  // Add resistors (a to b)
  for (const part of normalizedParts) {
    if (part.type === "resistor") {
      const rVal = Math.max(1, Number(part.props.resistance || 220))
      addResistiveEdge(pinKey(part.id, "a"), pinKey(part.id, "b"), rVal)
    }
  }

  // Helper: Find total minimum resistance path between two pins
  const findMinResistance = (startPin: string, targetPins: string[]): number => {
    const targetSet = new Set(targetPins)
    const dist = new Map<string, number>()
    const queue: { node: string; d: number }[] = [{ node: startPin, d: 0 }]
    dist.set(startPin, 0)

    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d)
      const { node: cur, d } = queue.shift()!

      if (targetSet.has(cur)) return d

      const neighbors = resistiveGraph.get(cur) || []
      for (const edge of neighbors) {
        const nextDist = d + edge.resistance
        if (!dist.has(edge.to) || nextDist < dist.get(edge.to)!) {
          dist.set(edge.to, nextDist)
          queue.push({ node: edge.to, d: nextDist })
        }
      }
    }

    return Infinity
  }

  // Check every LED for series current-limiting resistor
  const allPowerPins = [...v5Pins, ...v33Pins]
  if (primaryBoardPart && boardDef) {
    for (const bp of boardDef.pins) {
      if (bp.kind === "digital") {
        allPowerPins.push(pinKey(primaryBoardPart.id, bp.id))
      }
    }
  }

  for (const part of normalizedParts) {
    if (part.type === "led") {
      const anodePin = pinKey(part.id, "anode")
      const cathodePin = pinKey(part.id, "cathode")

      // Check if anode and cathode are wired
      const anodeConnected = resistiveGraph.has(anodePin)
      const cathodeConnected = resistiveGraph.has(cathodePin)

      if (anodeConnected && cathodeConnected) {
        // Find resistance to Power and Ground
        const rToPower = findMinResistance(anodePin, allPowerPins)
        const rToGnd = findMinResistance(cathodePin, gndPins)

        // Also check reverse orientation
        const rRevToPower = findMinResistance(cathodePin, allPowerPins)
        const rRevToGnd = findMinResistance(anodePin, gndPins)

        const totalLoopRes = Math.min(rToPower + rToGnd, rRevToPower + rRevToGnd)

        if (Number.isFinite(totalLoopRes) && totalLoopRes < 100) {
          metrics.overcurrentRisks++
          addNotice({
            ruleId: `safety-led-burnout-${part.id}`,
            severity: "critical",
            category: "safety",
            title: `LED Overcurrent Burnout Risk (${part.id})`,
            message: `LED '${part.id}' is wired directly across power and ground with only ${totalLoopRes.toFixed(1)}Ω series resistance. Operating an LED without a 220Ω–1kΩ current-limiting resistor causes thermal burnout within milliseconds!`,
            suggestion: `Insert a 220Ω or 330Ω resistor in series with LED '${part.id}' Anode (+) or Cathode (-).`,
            involvedPartIds: [part.id],
            involvedPinIds: ["anode", "cathode"],
          })
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // LAYER 6: 3.3V Logic Overvoltage & Inductive Motor Overdrive
  // --------------------------------------------------------------------------
  // Check 3.3V Board Overvoltage
  if (primaryBoardPart && boardDef && boardDef.logicVoltage <= 3.3) {
    const dangerousSources = [...v5Pins, ...batteryPosPins]
    for (const pin of boardDef.pins) {
      if (pin.kind === "digital" || pin.kind === "analog") {
        const boardPinKey = pinKey(primaryBoardPart.id, pin.id)
        if (resistiveGraph.has(boardPinKey)) {
          const minResToOvervoltage = findMinResistance(boardPinKey, dangerousSources)
          if (Number.isFinite(minResToOvervoltage)) {
            const referencePathResistance = findMinResistance(boardPinKey, [...gndPins, ...v33Pins])
            // A single series resistor can limit current but does not, by itself, clamp a
            // high-impedance GPIO input to a safe voltage. A modeled return/reference path
            // may be a divider, but this topology-only validator cannot prove its ratio.
            const seriesOnlyOrLowResistance =
              minResToOvervoltage < 500 || !Number.isFinite(referencePathResistance)
            metrics.overvoltageRisks++
            addNotice({
              ruleId: `safety-overvoltage-gpio-${primaryBoardPart.id}-${pin.id}`,
              severity: seriesOnlyOrLowResistance ? "critical" : "warning",
              category: "safety",
              title: `5V Overvoltage on 3.3V MCU Pin (${pin.label})`,
              message: seriesOnlyOrLowResistance
                ? `A ${minResToOvervoltage.toFixed(0)}Ω path connects a 5V/9V source to ${pin.label} on ${boardDef.name} without a modeled safe divider/reference return. A series resistor alone does not prove 3.3V-safe logic.`
                : `A ${minResToOvervoltage.toFixed(0)}Ω path connects a 5V/9V source to ${pin.label} on ${boardDef.name}. A return/reference path exists, but this static validator cannot prove the resulting node voltage or divider ratio.`,
              suggestion: "Use a verified resistor-divider topology or a suitable logic-level shifter; do not rely on a series resistor alone.",
              involvedPartIds: [primaryBoardPart.id],
              involvedPinIds: [pin.id],
            })
          }
        }
      }
    }
  }

  // Check DC Motor connected directly to MCU GPIO
  if (primaryBoardPart && boardDef) {
    const boardGpioPins = boardDef.pins
      .filter((p) => p.kind === "digital")
      .map((p) => pinKey(primaryBoardPart.id, p.id))

    for (const part of normalizedParts) {
      if (part.type === "dc-motor") {
        const mPos = pinKey(part.id, "pos")
        const mNeg = pinKey(part.id, "neg")
        const posConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mPos, bp))
        const negConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mNeg, bp))

        if (posConnectedToGpio || negConnectedToGpio) {
          addNotice({
            ruleId: `safety-motor-direct-gpio-${part.id}`,
            severity: "warning",
            category: "safety",
            title: `Inductive Overload Risk (DC Motor ${part.id})`,
            message: `DC Motor '${part.id}' is wired directly to microcontroller GPIO pins. Real physical motors require 200mA–1000mA (MCU pins can only supply 20mA–40mA) and generate inductive back-EMF spikes that damage pins. In physical assembly, use an L298N driver or relay.`,
            suggestion: "In physical breadboard assembly, use an L298N motor driver or relay module with external battery power to control the motor.",
            involvedPartIds: [part.id, primaryBoardPart.id],
            involvedPinIds: ["pos", "neg"],
          })
        }
      }
    }
  }

  // Check Active Modules Ground Return Path Continuity
  const activeModuleTypes = [
    "ultrasonic",
    "dht11",
    "mq2-gas",
    "neopixel-ring",
    "oled-i2c",
    "lcd-i2c",
    "servo",
    "l298n",
    "pir-sensor",
    "ir-sensor",
  ]

  for (const part of normalizedParts) {
    if (activeModuleTypes.includes(part.type) && primaryBoardPart) {
      const moduleGnd = pinKey(part.id, "gnd")
      const hasWires = normalizedWires.some(
        (w) => w.from.partId === part.id || w.to.partId === part.id,
      )

      if (hasWires) {
        // Module is wired. Does it have GND continuity to board GND?
        const hasGndContinuity = gndPins.some((gnd) => netlist.connected(moduleGnd, gnd))
        if (!hasGndContinuity) {
          metrics.missingReturnPaths++
          addNotice({
            ruleId: `wiring-missing-ground-return-${part.id}`,
            severity: "warning",
            category: "wiring",
            title: `Missing Ground Return Path (${part.id})`,
            message: `Active component '${part.id}' (${part.type}) is connected to the microcontroller but its Ground (GND) pin is not connected to common circuit GND. Without a closed return path, signals cannot flow.`,
            suggestion: `Connect '${part.id}' pin 'gnd' to microcontroller GND rail.`,
            involvedPartIds: [part.id],
            involvedPinIds: ["gnd"],
          })
        }
      }
    }
  }

  // Do not require hardware PWM for hobby servos: the standard Arduino Servo library
  // generates control pulses with timer interrupts and works on ordinary supported GPIOs.

  // --------------------------------------------------------------------------
  // LAYER 7: Blockly Code & Final Result Computation
  // --------------------------------------------------------------------------
  if (Object.prototype.hasOwnProperty.call(rawCandidate, "blocklyXml") && rawCandidate.blocklyXml !== undefined) {
    if (typeof rawCandidate.blocklyXml !== "string") {
      addNotice({
        ruleId: "syntax-blockly-xml-type-invalid",
        severity: "critical",
        category: "syntax",
        title: "Invalid Blockly XML Payload",
        message: "Blockly XML must be a string when supplied.",
        suggestion: "Send a serialized Blockly workspace XML string or omit blocklyXml.",
        involvedPartIds: [],
      })
    } else {
      const xml = rawCandidate.blocklyXml.trim()
      const hasXmlRoot =
        /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?>[\s\S]*<\/xml>\s*$/i.test(xml) ||
        /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?\/>\s*$/i.test(xml)
      const unsafeXmlPattern = /<!DOCTYPE|<!ENTITY|<\s*script\b|<\s*(?:iframe|object|embed|foreignObject|html|body)\b|javascript\s*:|\bon[a-z]+\s*=/i

      if (xml.length > 200_000) {
        addNotice({
          ruleId: "syntax-blockly-xml-size-limit",
          severity: "critical",
          category: "syntax",
          title: "Blockly XML Payload Too Large",
          message: "Blockly XML exceeds the 200,000-character safety limit.",
          suggestion: "Reduce the workspace payload and submit a smaller Blockly program.",
          involvedPartIds: [],
        })
      } else if (xml && !hasXmlRoot) {
        addNotice({
          ruleId: "syntax-blockly-xml-root-invalid",
          severity: "critical",
          category: "syntax",
          title: "Malformed Blockly XML",
          message: "Blockly workspace payload must have a single <xml> root element.",
          suggestion: "Send XML exported from the Blockly workspace serializer.",
          involvedPartIds: [],
        })
      } else if (unsafeXmlPattern.test(xml)) {
        addNotice({
          ruleId: "syntax-script-injection-blocked",
          severity: "critical",
          category: "syntax",
          title: "Unsafe Blockly XML Blocked",
          message: "Blockly XML contains a forbidden active-content, script, or event-handler pattern.",
          suggestion: "Remove script/active-content markup and regenerate the workspace XML.",
          involvedPartIds: [],
        })
      }
    }
  }

  // Determine overall validity
  const criticalCount = notices.filter((n) => n.severity === "critical").length
  const warningCount = notices.filter((n) => n.severity === "warning").length
  const valid = criticalCount === 0 && (allowWarnings || warningCount === 0)

  return {
    valid,
    errors,
    warnings,
    notices,
    normalizedCircuit: valid ? normalizedCircuit : undefined,
    metrics,
    revHash,
  }
}
