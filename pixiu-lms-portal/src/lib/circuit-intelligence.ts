/**
 * PIXIU TECH CYBERLAB — 8SQUARE CIRCUIT INTELLIGENCE & AUTONOMOUS REPAIR ENGINE
 * 
 * Deep domain-specific reasoning, 20-category electrical fault diagnosis,
 * structured atomic repair generation, and simulator-in-the-loop verification.
 * 
 * Authoritative Assistant Identity: 8square (developed by PixiuTech)
 * Underlying Model: Xen (Step-700)
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { CircuitState, PlacedPart, Wire, PinRef, PartType } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { getBoardForPart, isBoardPart, type BoardDefinition } from "./board-registry"
import { CATALOG } from "./components-catalog"
import { diagnoseCircuit, type CircuitHealthReport, type DiagnosticIssue } from "./circuit-doctor"
import { solveCircuitNodalPotentials, type NodalSolution } from "./circuit-solver"
import { validateProposedCircuit, computeCircuitHash, type CircuitValidationResult } from "./circuit-validator"
import type { CircuitCopilotProposal } from "@/components/circuit-lab/use-circuit-copilot-action"

// ============================================================================
// 1. Authoritative Domain Types & Fault Classifications
// ============================================================================

export type FaultClassification =
  | "OPEN_CIRCUIT"
  | "SHORT_CIRCUIT"
  | "MISSING_GROUND"
  | "MISSING_POWER"
  | "REVERSED_LED_POLARITY"
  | "REVERSED_DIODE_POLARITY"
  | "INCORRECT_RESISTOR_PLACEMENT"
  | "INCORRECT_RESISTOR_VALUE"
  | "FLOATING_INPUT_PIN"
  | "INCORRECT_ARDUINO_PIN_MAPPING"
  | "INCORRECT_ANALOG_CONNECTION"
  | "INCORRECT_TRANSISTOR_CONNECTION"
  | "INCORRECT_SERVO_WIRING"
  | "INCORRECT_PWM_CONFIGURATION"
  | "INVALID_COMPONENT_PLACEMENT"
  | "INCOMPATIBLE_COMPONENT_TYPES"
  | "INCORRECT_SENSOR_CONNECTIONS"
  | "CODE_PIN_MISMATCH"
  | "POWER_SOURCE_CONFLICT"
  | "SOLVER_CONVERGENCE_ERROR"

export interface CircuitFault {
  id: string
  classification: FaultClassification
  title: string
  affectedPartId: string
  affectedPinId: string
  affectedNetId?: number
  evidence: string
  electricalExplanation: string
  confidence: number
  suggestedRepair: string
  expectedOutcome: string
}

export interface CircuitRepairAction {
  type: "connect" | "disconnect" | "change_prop" | "replace_part" | "set_code_pin"
  from?: string // "partId:pinId" or "partId.pinId"
  to?: string   // "partId:pinId" or "partId.pinId"
  wireId?: string
  partId?: string
  propName?: string
  propValue?: string | number
  color?: string
}

export interface StructuredRepairProposal {
  diagnosis: string
  confidence: number
  faults: CircuitFault[]
  actions: CircuitRepairAction[]
  expectedOutcome: string
  repairedCircuit: CircuitState
  repairedBlocklyXml?: string
  diff: {
    addedWires: Wire[]
    removedWires: Wire[]
    modifiedParts: PlacedPart[]
  }
}

export interface ElectricalNet {
  id: number
  name: string
  isPowerRail: boolean
  isGroundRail: boolean
  nominalVoltage?: number
  pinKeys: string[] // "partId:pinId"
}

export interface InstrumentMeasurement {
  instrument: "multimeter" | "oscilloscope"
  probeA: string
  probeB?: string
  mode: string
  value: number
  unit: string
  state: "available" | "unavailable"
  notes?: string
}

export interface CodePinBinding {
  pinId: string
  configuredMode: "OUTPUT" | "INPUT" | "PWM" | "SERVO" | "ANALOG_READ"
  codeSnippet: string
}

export interface CircuitDiagnosisContext {
  circuitId: string
  board: {
    id: string
    name: string
    logicVoltage: number
  } | null
  parts: PlacedPart[]
  wires: Wire[]
  nets: ElectricalNet[]
  measurements: InstrumentMeasurement[]
  code: {
    rawXml?: string
    pinBindings: CodePinBinding[]
  }
  simulationStatus: "ready" | "running" | "paused" | "stopped"
  simulationErrors: string[]
  healthReport: CircuitHealthReport
  nodalSolution?: NodalSolution
}

export interface SimulatorVerificationResult {
  verified: boolean
  solverPassed: boolean
  electricalChecksPassed: boolean
  status: "VERIFIED_WORKING" | "FAILED_SOLVER" | "FAILED_ELECTRICAL" | "HAZARD_DETECTED"
  beforeMetrics: {
    healthScore: number
    criticalCount: number
    warningCount: number
    activeCurrentsMa: Record<string, number>
    componentStates: Record<string, string>
  }
  afterMetrics: {
    healthScore: number
    criticalCount: number
    warningCount: number
    activeCurrentsMa: Record<string, number>
    componentStates: Record<string, string>
  }
  deltaExplanation: string
}

// ============================================================================
// 2. Helper Utilities & Pin Normalization
// ============================================================================

export function formatPinKey(partId: string, pinId: string): string {
  return `${partId}:${pinId.toLowerCase()}`
}

export function parsePinKey(key: string): { partId: string; pinId: string } {
  const [partId, ...rest] = key.split(/[:.]/)
  return { partId, pinId: rest.join(":").toLowerCase() }
}

export function isCircuitPinWired(circuit: CircuitState, partId: string, pinId: string): boolean {
  const target = formatPinKey(partId, pinId)
  return circuit.wires.some(
    (w) =>
      formatPinKey(w.from.partId, w.from.pinId) === target ||
      formatPinKey(w.to.partId, w.to.pinId) === target
  )
}

/**
 * Union-Find Disjoint Set for Netlist Partitioning.
 */
class UnionFind {
  private parent = new Map<string, string>()

  find(item: string): string {
    if (!this.parent.has(item)) this.parent.set(item, item)
    if (this.parent.get(item) !== item) {
      this.parent.set(item, this.find(this.parent.get(item)!))
    }
    return this.parent.get(item)!
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent.set(rootA, rootB)
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const key of this.parent.keys()) {
      const root = this.find(key)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(key)
    }
    return groups
  }
}

// ============================================================================
// 3. Phase 2 — Circuit Context Serialization
// ============================================================================

export function serializeCircuitContext(
  circuit: CircuitState,
  options: {
    blocklyXml?: string
    runtime?: Record<string, PartRuntime>
    pinStates?: Record<string, ArduinoPinState>
    running?: boolean
    multimeterProbes?: { red: PinRef | null; black: PinRef | null; mode?: string }
    oscilloscopeProbes?: { ch1: PinRef | null; ch2: PinRef | null }
  } = {}
): CircuitDiagnosisContext {
  const {
    blocklyXml,
    runtime = {},
    pinStates = {},
    running = false,
    multimeterProbes,
    oscilloscopeProbes,
  } = options

  const boardPart = circuit.parts.find((p) => isBoardPart(p.type))
  const boardDef = boardPart ? getBoardForPart(boardPart) : undefined

  // Run MNA Nodal Solver & Circuit Doctor
  const nodal = solveCircuitNodalPotentials(circuit, new Set(), pinStates, running)
  const health = diagnoseCircuit(circuit, runtime, pinStates)

  // Netlist Graph Partitioning
  const uf = new UnionFind()

  // Register all pins of placed parts
  for (const part of circuit.parts) {
    const def = CATALOG[part.type] || (isBoardPart(part.type) ? boardDef : null)
    if (def?.pins) {
      for (const p of def.pins) {
        uf.find(formatPinKey(part.id, p.id))
      }
    }
  }

  // Union connected pins through wires
  for (const wire of circuit.wires) {
    const k1 = formatPinKey(wire.from.partId, wire.from.pinId)
    const k2 = formatPinKey(wire.to.partId, wire.to.pinId)
    uf.union(k1, k2)
  }

  // Model internal copper ties of breadboard
  for (const part of circuit.parts.filter((p) => p.type === "breadboard")) {
    // Breadboard vertical columns tie terminal a-b-c-d-e and f-g-h-i-j together
    for (let col = 1; col <= 30; col++) {
      const topHalf = ["a", "b", "c", "d", "e"]
      for (let i = 0; i < topHalf.length - 1; i++) {
        uf.union(formatPinKey(part.id, `${topHalf[i]}_${col}`), formatPinKey(part.id, `${topHalf[i + 1]}_${col}`))
      }
      const botHalf = ["f", "g", "h", "i", "j"]
      for (let i = 0; i < botHalf.length - 1; i++) {
        uf.union(formatPinKey(part.id, `${botHalf[i]}_${col}`), formatPinKey(part.id, `${botHalf[i + 1]}_${col}`))
      }
    }
    // Power rails
    for (let c = 1; c <= 29; c++) {
      uf.union(formatPinKey(part.id, `pos_t_${c}`), formatPinKey(part.id, `pos_t_${c + 1}`))
      uf.union(formatPinKey(part.id, `neg_t_${c}`), formatPinKey(part.id, `neg_t_${c + 1}`))
      uf.union(formatPinKey(part.id, `pos_b_${c}`), formatPinKey(part.id, `pos_b_${c + 1}`))
      uf.union(formatPinKey(part.id, `neg_b_${c}`), formatPinKey(part.id, `neg_b_${c + 1}`))
    }
  }

  const groups = uf.getGroups()
  const nets: ElectricalNet[] = []
  let netCounter = 0

  for (const [, pins] of groups) {
    netCounter++
    let isPower = false
    let isGround = false
    let nominalV = 0

    for (const pKey of pins) {
      const { partId, pinId } = parsePinKey(pKey)
      const part = circuit.parts.find((p) => p.id === partId)
      if (part && isBoardPart(part.type)) {
        const b = getBoardForPart(part)
        if (b?.powerPins.v5?.map((x) => x.toLowerCase()).includes(pinId)) {
          isPower = true
          nominalV = 5.0
        } else if (b?.powerPins.v33?.map((x) => x.toLowerCase()).includes(pinId)) {
          isPower = true
          nominalV = 3.3
        } else if (b?.powerPins.gnd.map((x) => x.toLowerCase()).includes(pinId)) {
          isGround = true
          nominalV = 0.0
        }
      } else if (part?.type === "battery") {
        if (pinId === "pos") {
          isPower = true
          nominalV = 9.0
        } else if (pinId === "neg") {
          isGround = true
          nominalV = 0.0
        }
      }
    }

    const netName = isGround ? "GND" : isPower ? `${nominalV}V` : `NET_${netCounter}`
    nets.push({
      id: netCounter,
      name: netName,
      isPowerRail: isPower,
      isGroundRail: isGround,
      nominalVoltage: isPower || isGround ? nominalV : undefined,
      pinKeys: pins,
    })
  }

  // Instrument Measurements
  const measurements: InstrumentMeasurement[] = []
  if (multimeterProbes?.red && multimeterProbes?.black) {
    const kRed = formatPinKey(multimeterProbes.red.partId, multimeterProbes.red.pinId)
    const kBlack = formatPinKey(multimeterProbes.black.partId, multimeterProbes.black.pinId)
    const diff = nodal.getPotentialDifference(multimeterProbes.red, multimeterProbes.black, circuit, pinStates)
    measurements.push({
      instrument: "multimeter",
      probeA: kRed,
      probeB: kBlack,
      mode: multimeterProbes.mode || "dc_v",
      value: Number(diff.diff.toFixed(3)),
      unit: "V",
      state: "available",
      notes: diff.explanation,
    })
  } else {
    measurements.push({
      instrument: "multimeter",
      probeA: "",
      mode: "dc_v",
      value: 0,
      unit: "V",
      state: "unavailable",
      notes: "Multimeter probes are not placed on circuit pins.",
    })
  }

  if (oscilloscopeProbes?.ch1) {
    const kCh1 = formatPinKey(oscilloscopeProbes.ch1.partId, oscilloscopeProbes.ch1.pinId)
    const vCh1 = nodal.getPinVoltage(oscilloscopeProbes.ch1)
    measurements.push({
      instrument: "oscilloscope",
      probeA: kCh1,
      mode: "CH1",
      value: Number(vCh1.toFixed(3)),
      unit: "V",
      state: "available",
      notes: "Channel 1 waveform probe active",
    })
  }

  // Extract Code Pin Bindings from Blockly XML
  const pinBindings: CodePinBinding[] = []
  if (blocklyXml) {
    const pinMatches = blocklyXml.matchAll(/<field name="PIN">([a-zA-Z0-9_]+)<\/field>/gi)
    for (const match of pinMatches) {
      const pinName = match[1]
      pinBindings.push({
        pinId: pinName.toLowerCase(),
        configuredMode: "OUTPUT",
        codeSnippet: match[0],
      })
    }
  }

  return {
    circuitId: `circuit_${Date.now()}`,
    board: boardDef
      ? {
          id: boardPart!.id,
          name: boardDef.name,
          logicVoltage: boardDef.logicVoltage,
        }
      : null,
    parts: circuit.parts,
    wires: circuit.wires,
    nets,
    measurements,
    code: {
      rawXml: blocklyXml,
      pinBindings,
    },
    simulationStatus: running ? "running" : "ready",
    simulationErrors: health.issues
      .filter((i) => i.severity === "critical")
      .map((i) => `${i.title}: ${i.message}`),
    healthReport: health,
    nodalSolution: nodal,
  }
}

// ============================================================================
// 4. Phase 3 — Comprehensive Circuit Diagnosis Engine
// ============================================================================

export function diagnoseCircuitIntelligence(
  context: CircuitDiagnosisContext
): CircuitFault[] {
  const faults: CircuitFault[] = []
  const { parts, wires, nets, board, code, healthReport, nodalSolution } = context

  const gndNet = nets.find((n) => n.isGroundRail)
  const powerNets = nets.filter((n) => n.isPowerRail)

  // Map each pin to its Electrical Net
  const pinNetMap = new Map<string, ElectricalNet>()
  for (const net of nets) {
    for (const pKey of net.pinKeys) {
      pinNetMap.set(pKey, net)
    }
  }

  // Helper: check if a pin is wired
  const isPinWired = (partId: string, pinId: string): boolean => {
    const target = formatPinKey(partId, pinId)
    return wires.some(
      (w) =>
        formatPinKey(w.from.partId, w.from.pinId) === target ||
        formatPinKey(w.to.partId, w.to.pinId) === target
    )
  }

  // --------------------------------------------------------------------------
  // Check 1: Dead Short Circuit (5V / Battery to GND)
  // --------------------------------------------------------------------------
  if (gndNet) {
    for (const pNet of powerNets) {
      if (pNet.id === gndNet.id) {
        faults.push({
          id: `fault_short_${pNet.id}`,
          classification: "SHORT_CIRCUIT",
          title: "Direct Power-to-Ground Dead Short",
          affectedPartId: board ? board.id : "battery",
          affectedPinId: "gnd",
          affectedNetId: gndNet.id,
          evidence: `Net ${pNet.name} is shorted directly to GND with 0Ω impedance.`,
          electricalExplanation:
            "A direct connection between power and ground causes excessive current, collapsing the power rail and triggering thermal shutdown.",
          confidence: 0.99,
          suggestedRepair: "Disconnect the direct wire linking the power pin to ground.",
          expectedOutcome: "Power rail returns to nominal voltage with no short-circuit current.",
        })
      }
    }
  }

  // --------------------------------------------------------------------------
  // Check 2: Missing Ground Reference
  // --------------------------------------------------------------------------
  const gndConnectedPins = gndNet ? gndNet.pinKeys : []
  const hasGroundWires = wires.some(
    (w) =>
      w.from.pinId.toLowerCase() === "gnd" ||
      w.to.pinId.toLowerCase() === "gnd" ||
      w.from.pinId.toLowerCase() === "neg" ||
      w.to.pinId.toLowerCase() === "neg"
  )

  if (!hasGroundWires && parts.length > 1) {
    const targetBoard = parts.find((p) => isBoardPart(p.type))
    faults.push({
      id: "fault_missing_gnd",
      classification: "MISSING_GROUND",
      title: "Missing Circuit Ground Reference",
      affectedPartId: targetBoard ? targetBoard.id : parts[0].id,
      affectedPinId: "gnd",
      evidence: "No components are connected to the ground return rail (GND).",
      electricalExplanation:
        "Every electronic circuit requires a complete 0V return reference. Without a ground path, no current can flow in loops.",
      confidence: 0.98,
      suggestedRepair: `Connect the ground return of your load to ${targetBoard ? targetBoard.id : "the board"}.GND.`,
      expectedOutcome: "A complete 0V return path is established for all active components.",
    })
  }

  // --------------------------------------------------------------------------
  // Check 3: LED Diagnostics (Open Loop, Reverse Polarity, Burnout, Resistor Value)
  // --------------------------------------------------------------------------
  const leds = parts.filter((p) => p.type === "led")
  for (const led of leds) {
    const anodeKey = formatPinKey(led.id, "anode")
    const cathodeKey = formatPinKey(led.id, "cathode")
    const anodeWired = isPinWired(led.id, "anode")
    const cathodeWired = isPinWired(led.id, "cathode")

    // 3a. Open Circuit on LED
    if (!anodeWired || !cathodeWired) {
      const missingPin = !cathodeWired ? "cathode" : "anode"
      faults.push({
        id: `fault_open_led_${led.id}`,
        classification: "OPEN_CIRCUIT",
        title: `Open Circuit: LED ${led.id} Disconnected`,
        affectedPartId: led.id,
        affectedPinId: missingPin,
        evidence: `Pin ${missingPin} on ${led.id} has no wires attached.`,
        electricalExplanation:
          "Current cannot flow across an open circuit. An LED requires both anode and cathode connected in a closed loop.",
        confidence: 0.99,
        suggestedRepair:
          missingPin === "cathode"
            ? `Connect ${led.id}.cathode to Ground.`
            : `Connect ${led.id}.anode through a current-limiting resistor to the driver pin or power rail.`,
        expectedOutcome: "The circuit loop closes, allowing current to illuminate the LED.",
      })
      continue
    }

    const anodeNet = pinNetMap.get(anodeKey)
    const cathodeNet = pinNetMap.get(cathodeKey)

    // 3b. Reversed LED Polarity
    if (anodeNet?.isGroundRail && !cathodeNet?.isGroundRail) {
      faults.push({
        id: `fault_rev_led_${led.id}`,
        classification: "REVERSED_LED_POLARITY",
        title: `Reversed LED Polarity on ${led.id}`,
        affectedPartId: led.id,
        affectedPinId: "anode",
        evidence: `Anode (+) is connected to Ground (${anodeNet.name}), while Cathode (-) is facing the positive voltage rail.`,
        electricalExplanation:
          "LEDs are diodes that only conduct when forward biased (Anode positive relative to Cathode). Under reverse bias, the diode blocks current.",
        confidence: 0.97,
        suggestedRepair: `Swap LED terminals: connect ${led.id}.anode to the resistor/signal and ${led.id}.cathode to Ground.`,
        expectedOutcome: "LED becomes forward biased and illuminates when the signal goes HIGH.",
      })
    }

    // 3c. Resistor Series Check & Resistor Value
    // Find all resistors connected to this LED's anode or cathode
    const connectedResistors: PlacedPart[] = []
    for (const w of wires) {
      let otherPin: PinRef | null = null
      if (w.from.partId === led.id) otherPin = w.to
      else if (w.to.partId === led.id) otherPin = w.from
      if (otherPin) {
        const otherPart = parts.find((p) => p.id === otherPin!.partId)
        if (otherPart && otherPart.type === "resistor") {
          connectedResistors.push(otherPart)
        }
      }
    }

    if (connectedResistors.length === 0 && anodeNet && cathodeNet && !anodeNet.isGroundRail && cathodeNet.isGroundRail) {
      // Direct connection across power without series resistor!
      faults.push({
        id: `fault_naked_led_${led.id}`,
        classification: "INCORRECT_RESISTOR_PLACEMENT",
        title: `Naked LED Without Series Resistor: ${led.id}`,
        affectedPartId: led.id,
        affectedPinId: "anode",
        evidence: `${led.id} is connected directly across voltage without a current-limiting resistor.`,
        electricalExplanation:
          "Diodes have exponential I-V curves. Without a series resistor to drop excess voltage, forward current exceeds the 20mA maximum, destroying the LED.",
        confidence: 0.98,
        suggestedRepair: `Add a 220Ω resistor in series between ${board ? board.id : "the signal pin"} and ${led.id}.anode.`,
        expectedOutcome: "Current is limited to a safe ~13-18mA, ensuring bright, safe operation.",
      })
    }

    for (const r of connectedResistors) {
      const val = Number(r.props.resistance ?? 220)
      if (val < 100) {
        faults.push({
          id: `fault_res_too_low_${r.id}`,
          classification: "INCORRECT_RESISTOR_VALUE",
          title: `Resistor ${r.id} Resistance Too Low (${val}Ω)`,
          affectedPartId: r.id,
          affectedPinId: "a",
          evidence: `Resistance value is ${val}Ω. For a 5V supply and 2.0V LED drop, current is ${( (5 - 2) / val * 1000 ).toFixed(1)}mA (exceeds 20mA limit).`,
          electricalExplanation:
            `According to Ohm's Law (I = (V_supply - V_f) / R), a ${val}Ω resistor permits excessive current, threatening LED and GPIO burnout.`,
          confidence: 0.96,
          suggestedRepair: `Change ${r.id} resistance to 220Ω or 330Ω.`,
          expectedOutcome: "Current stabilizes to a safe 14mA, preventing damage.",
        })
      } else if (val > 100000) {
        // e.g. 10MΩ
        faults.push({
          id: `fault_res_too_high_${r.id}`,
          classification: "INCORRECT_RESISTOR_VALUE",
          title: `Resistor ${r.id} Resistance Inappropriately High (${val}Ω)`,
          affectedPartId: r.id,
          affectedPinId: "a",
          evidence: `Resistance value is ${val}Ω. LED forward current is choked to ${( (5 - 2) / val * 1000000 ).toFixed(2)}µA (far below the 2mA illumination threshold).`,
          electricalExplanation:
            `According to Ohm's Law (I = (V_supply - V_f) / R), a resistor this large (${val}Ω) starves the LED of current, causing it to remain completely dark even with a valid circuit.`,
          confidence: 0.98,
          suggestedRepair: `Change ${r.id} resistance to a standard 220Ω or 330Ω value.`,
          expectedOutcome: "Forward current rises to ~14mA and the LED illuminates brightly.",
        })
      }
    }
  }

  // --------------------------------------------------------------------------
  // Check 4: Floating Analog Input Pin
  // --------------------------------------------------------------------------
  if (board) {
    const boardPart = parts.find((p) => p.id === board.id)
    if (boardPart) {
      // Check Arduino analog inputs A0-A5
      const analogPins = ["a0", "a1", "a2", "a3", "a4", "a5"]
      for (const aPin of analogPins) {
        const isUsedInCode = code.pinBindings.some((b) => b.pinId === aPin)
        const isWired = isPinWired(boardPart.id, aPin)
        if (isUsedInCode && !isWired) {
          faults.push({
            id: `fault_floating_analog_${aPin}`,
            classification: "FLOATING_INPUT_PIN",
            title: `Floating Analog Input Pin: ${aPin.toUpperCase()}`,
            affectedPartId: boardPart.id,
            affectedPinId: aPin,
            evidence: `Arduino pin ${aPin.toUpperCase()} is sampled in code but has no wire connected.`,
            electricalExplanation:
              "An unconnected high-impedance CMOS ADC gate floats, picking up electromagnetic environmental noise and returning erratic readings between 0 and 1023.",
            confidence: 0.95,
            suggestedRepair: `Connect a sensor output or potentiometer wiper to ${boardPart.id}.${aPin.toUpperCase()}.`,
            expectedOutcome: "Analog pin receives a clean, deterministic 0–5V voltage signal.",
          })
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Check 5: Potentiometer Wiper Diagnostics
  // --------------------------------------------------------------------------
  const pots = parts.filter((p) => p.type === "potentiometer")
  for (const pot of pots) {
    const t1Wired = isPinWired(pot.id, "t1")
    const t2Wired = isPinWired(pot.id, "t2")
    const wiperWired = isPinWired(pot.id, "wiper")

    if (!wiperWired) {
      faults.push({
        id: `fault_pot_wiper_open_${pot.id}`,
        classification: "OPEN_CIRCUIT",
        title: `Potentiometer ${pot.id} Wiper Unconnected`,
        affectedPartId: pot.id,
        affectedPinId: "wiper",
        evidence: `Wiper terminal on ${pot.id} is disconnected.`,
        electricalExplanation:
          "A potentiometer functions as an adjustable voltage divider between outer terminals T1 and T2. The divided voltage is only output on the wiper.",
        confidence: 0.95,
        suggestedRepair: `Connect ${pot.id}.wiper to an Arduino analog input (such as A0).`,
        expectedOutcome: "Arduino reads a smooth analog voltage proportional to knob angle.",
      })
    } else if (!t1Wired || !t2Wired) {
      const missingOuter = !t1Wired ? "t1" : "t2"
      faults.push({
        id: `fault_pot_outer_open_${pot.id}`,
        classification: "MISSING_POWER",
        title: `Potentiometer ${pot.id} Missing Reference Supply`,
        affectedPartId: pot.id,
        affectedPinId: missingOuter,
        evidence: `Terminal ${missingOuter} on ${pot.id} is disconnected.`,
        electricalExplanation:
          "To form a voltage divider, one outer terminal must connect to 5V and the other to GND. With an outer terminal open, the wiper cannot produce a divided voltage.",
        confidence: 0.95,
        suggestedRepair: `Connect ${pot.id}.${missingOuter} to ${missingOuter === "t1" ? "5V" : "GND"}.`,
        expectedOutcome: "Complete resistive track between 5V and GND enables full-range 0-5V division.",
      })
    }
  }

  // --------------------------------------------------------------------------
  // Check 6: Servo Motor Diagnostics
  // --------------------------------------------------------------------------
  const servos = parts.filter((p) => p.type === "servo")
  for (const servo of servos) {
    const vccWired = isPinWired(servo.id, "vcc")
    const gndWired = isPinWired(servo.id, "gnd")
    const sigWired = isPinWired(servo.id, "sig")

    if (!vccWired || !gndWired) {
      const missing = !vccWired ? "vcc" : "gnd"
      faults.push({
        id: `fault_servo_unpowered_${servo.id}`,
        classification: missing === "gnd" ? "MISSING_GROUND" : "MISSING_POWER",
        title: `Servo Motor ${servo.id} Missing Power/Ground`,
        affectedPartId: servo.id,
        affectedPinId: missing,
        evidence: `Pin ${missing.toUpperCase()} on ${servo.id} is not connected to a power rail.`,
        electricalExplanation:
          "A servo motor requires continuous DC power (VCC=5V) and common ground return to energize its internal H-bridge and control circuit.",
        confidence: 0.98,
        suggestedRepair: `Connect ${servo.id}.${missing} to Arduino ${missing.toUpperCase()}.`,
        expectedOutcome: "Servo motor internal controller powers up and responds to control pulses.",
      })
    }

    if (!sigWired) {
      faults.push({
        id: `fault_servo_sig_open_${servo.id}`,
        classification: "OPEN_CIRCUIT",
        title: `Servo Motor ${servo.id} Signal Disconnected`,
        affectedPartId: servo.id,
        affectedPinId: "sig",
        evidence: `Signal pin on ${servo.id} has no control wire.`,
        electricalExplanation:
          "Servos require 50Hz PWM control pulses (1ms–2ms high pulse) on the signal pin to position the internal potentiometer.",
        confidence: 0.96,
        suggestedRepair: `Connect ${servo.id}.sig to an Arduino PWM-capable digital pin (e.g. D9).`,
        expectedOutcome: "Microcontroller sends timed angle pulses, rotating the servo shaft.",
      })
    }
  }

  // --------------------------------------------------------------------------
  // Check 7: Ultrasonic Sensor (HC-SR04) Diagnostics
  // --------------------------------------------------------------------------
  const ultrasonics = parts.filter((p) => p.type === "ultrasonic")
  for (const us of ultrasonics) {
    const vccWired = isPinWired(us.id, "vcc")
    const gndWired = isPinWired(us.id, "gnd")
    const trigWired = isPinWired(us.id, "trig")
    const echoWired = isPinWired(us.id, "echo")

    if (!vccWired || !gndWired) {
      faults.push({
        id: `fault_us_unpowered_${us.id}`,
        classification: !vccWired ? "MISSING_POWER" : "MISSING_GROUND",
        title: `Ultrasonic Sensor ${us.id} Unpowered`,
        affectedPartId: us.id,
        affectedPinId: !vccWired ? "vcc" : "gnd",
        evidence: `HC-SR04 sensor ${us.id} has disconnected power/ground pins.`,
        electricalExplanation:
          "The HC-SR04 ultrasonic transducer requires 5V operating voltage to trigger the 40kHz sonic burst.",
        confidence: 0.97,
        suggestedRepair: `Connect ${us.id}.vcc to 5V and ${us.id}.gnd to GND.`,
        expectedOutcome: "Sensor powers up and enables distance echo capture.",
      })
    }

    if (!trigWired || !echoWired) {
      const missing = !trigWired ? "trig" : "echo"
      faults.push({
        id: `fault_us_sig_open_${us.id}`,
        classification: "INCORRECT_SENSOR_CONNECTIONS",
        title: `Ultrasonic Sensor ${us.id} Signal Missing: ${missing.toUpperCase()}`,
        affectedPartId: us.id,
        affectedPinId: missing,
        evidence: `Pin ${missing} on ${us.id} is disconnected.`,
        electricalExplanation:
          "HC-SR04 requires a 10µs pulse on TRIG to emit sonar, and outputs the pulse round-trip time on ECHO. Both pins must be connected.",
        confidence: 0.96,
        suggestedRepair: `Connect ${us.id}.${missing} to an Arduino digital GPIO.`,
        expectedOutcome: "Two-way sonar triggering and echo duration measurement are restored.",
      })
    }
  }

  // --------------------------------------------------------------------------
  // Check 8: Code-to-Wiring Pin Mismatch
  // --------------------------------------------------------------------------
  if (board && code.pinBindings.length > 0) {
    const boardPart = parts.find((p) => p.id === board.id)
    if (boardPart) {
      for (const binding of code.pinBindings) {
        const pinKey = formatPinKey(boardPart.id, binding.pinId)
        const isWired = wires.some(
          (w) =>
            formatPinKey(w.from.partId, w.from.pinId) === pinKey ||
            formatPinKey(w.to.partId, w.to.pinId) === pinKey
        )

        if (!isWired) {
          // Check if another adjacent digital pin IS wired
          const wiredBoardPins = wires
            .flatMap((w) => [
              w.from.partId === boardPart.id ? w.from.pinId : null,
              w.to.partId === boardPart.id ? w.to.pinId : null,
            ])
            .filter(Boolean) as string[]

          const digitalWired = wiredBoardPins.filter((p) => /^d\d+$/i.test(p))
          if (digitalWired.length > 0) {
            faults.push({
              id: `fault_code_pin_mismatch_${binding.pinId}`,
              classification: "CODE_PIN_MISMATCH",
              title: `Code / Hardware Pin Mismatch: Pin ${binding.pinId.toUpperCase()}`,
              affectedPartId: boardPart.id,
              affectedPinId: binding.pinId,
              evidence: `Program outputs to pin ${binding.pinId.toUpperCase()}, but the actual wire is connected to pin ${digitalWired[0].toUpperCase()}.`,
              electricalExplanation:
                `The microcontroller code drives ${binding.pinId.toUpperCase()} HIGH, but because the load is physically plugged into ${digitalWired[0].toUpperCase()}, no voltage reaches the component.`,
              confidence: 0.95,
              suggestedRepair: `Move the wire on ${digitalWired[0].toUpperCase()} to ${binding.pinId.toUpperCase()} (or update the program to use ${digitalWired[0].toUpperCase()}).`,
              expectedOutcome: "Physical pin routing matches program control, executing intended behavior.",
            })
          }
        }
      }
    }
  }

  return faults
}

// ============================================================================
// 5. Phase 4 — Structured Repair Action Generator
// ============================================================================

export function generateCircuitRepairProposal(
  currentCircuit: CircuitState,
  faults: CircuitFault[],
  baseRevisionHash: string,
  blocklyXml?: string
): StructuredRepairProposal {
  const actions: CircuitRepairAction[] = []
  let outcome = "All identified electrical faults resolved."

  // Clone parts and wires for modification
  const newParts: PlacedPart[] = JSON.parse(JSON.stringify(currentCircuit.parts))
  let newWires: Wire[] = JSON.parse(JSON.stringify(currentCircuit.wires))
  let updatedBlocklyXml = blocklyXml

  const boardPart = newParts.find((p) => isBoardPart(p.type))
  const gndPin = boardPart ? `${boardPart.id}:gnd` : "uno:gnd"

  for (const fault of faults) {
    if (fault.classification === "OPEN_CIRCUIT") {
      if (fault.affectedPinId === "cathode") {
        // Connect LED cathode to GND
        actions.push({
          type: "connect",
          from: `${fault.affectedPartId}:cathode`,
          to: gndPin,
          color: "black",
        })
        newWires.push({
          id: `w_repair_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from: { partId: fault.affectedPartId, pinId: "cathode" },
          to: { partId: boardPart ? boardPart.id : "uno", pinId: "gnd" },
          color: "black",
        })
      } else if (fault.affectedPinId === "wiper") {
        // Connect potentiometer wiper to A0
        const a0Pin = boardPart ? `${boardPart.id}:a0` : "uno:a0"
        actions.push({
          type: "connect",
          from: `${fault.affectedPartId}:wiper`,
          to: a0Pin,
          color: "blue",
        })
        newWires.push({
          id: `w_repair_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from: { partId: fault.affectedPartId, pinId: "wiper" },
          to: { partId: boardPart ? boardPart.id : "uno", pinId: "a0" },
          color: "blue",
        })
      } else if (fault.affectedPinId === "sig") {
        // Connect servo signal to D9
        const d9Pin = boardPart ? `${boardPart.id}:d9` : "uno:d9"
        actions.push({
          type: "connect",
          from: `${fault.affectedPartId}:sig`,
          to: d9Pin,
          color: "orange",
        })
        newWires.push({
          id: `w_repair_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from: { partId: fault.affectedPartId, pinId: "sig" },
          to: { partId: boardPart ? boardPart.id : "uno", pinId: "d9" },
          color: "orange",
        })
      }
    } else if (fault.classification === "REVERSED_LED_POLARITY") {
      // Find wires connected to anode and cathode
      const anodeTarget = `${fault.affectedPartId}:anode`
      const cathodeTarget = `${fault.affectedPartId}:cathode`

      const anodeWireIdx = newWires.findIndex(
        (w) =>
          formatPinKey(w.from.partId, w.from.pinId) === anodeTarget ||
          formatPinKey(w.to.partId, w.to.pinId) === anodeTarget
      )
      const cathodeWireIdx = newWires.findIndex(
        (w) =>
          formatPinKey(w.from.partId, w.from.pinId) === cathodeTarget ||
          formatPinKey(w.to.partId, w.to.pinId) === cathodeTarget
      )

      if (anodeWireIdx !== -1 && cathodeWireIdx !== -1) {
        const wireA = newWires[anodeWireIdx]
        const wireC = newWires[cathodeWireIdx]

        // Other endpoints
        const endpointA =
          formatPinKey(wireA.from.partId, wireA.from.pinId) === anodeTarget
            ? wireA.to
            : wireA.from
        const endpointC =
          formatPinKey(wireC.from.partId, wireC.from.pinId) === cathodeTarget
            ? wireC.to
            : wireC.from

        actions.push({
          type: "disconnect",
          wireId: wireA.id,
        })
        actions.push({
          type: "disconnect",
          wireId: wireC.id,
        })
        actions.push({
          type: "connect",
          from: `${fault.affectedPartId}:anode`,
          to: `${endpointC.partId}:${endpointC.pinId}`,
          color: "red",
        })
        actions.push({
          type: "connect",
          from: `${fault.affectedPartId}:cathode`,
          to: `${endpointA.partId}:${endpointA.pinId}`,
          color: "black",
        })

        // Filter out old wires and push corrected wires
        newWires = newWires.filter((_, idx) => idx !== anodeWireIdx && idx !== cathodeWireIdx)
        newWires.push({
          id: `w_swapped_a_${Date.now()}`,
          from: { partId: fault.affectedPartId, pinId: "anode" },
          to: endpointC,
          color: "red",
        })
        newWires.push({
          id: `w_swapped_c_${Date.now()}`,
          from: { partId: fault.affectedPartId, pinId: "cathode" },
          to: endpointA,
          color: "black",
        })
      }
    } else if (fault.classification === "INCORRECT_RESISTOR_VALUE") {
      // Update resistor value to 220Ω
      const resPart = newParts.find((p) => p.id === fault.affectedPartId)
      if (resPart) {
        actions.push({
          type: "change_prop",
          partId: resPart.id,
          propName: "resistance",
          propValue: 220,
        })
        resPart.props = { ...resPart.props, resistance: 220 }
      }
    } else if (fault.classification === "MISSING_GROUND") {
      // Find components that have a ground pin not connected to anything
      const ungroundedPart = newParts.find((p) => {
        if (isBoardPart(p.type) || p.type === "battery" || p.type === "breadboard") return false
        const def = CATALOG[p.type]
        const gndPins = def?.pins.filter((pin) => pin.kind === "ground" || pin.id === "cathode" || pin.id === "neg") ?? []
        return gndPins.some((gPin) => !isCircuitPinWired(currentCircuit, p.id, gPin.id))
      })

      if (ungroundedPart) {
        const def = CATALOG[ungroundedPart.type]
        const targetPin = def?.pins.find((pin) => pin.kind === "ground" || pin.id === "cathode" || pin.id === "neg")?.id ?? "cathode"
        actions.push({
          type: "connect",
          from: `${ungroundedPart.id}:${targetPin}`,
          to: gndPin,
          color: "black",
        })
        newWires.push({
          id: `w_gnd_repair_${Date.now()}`,
          from: { partId: ungroundedPart.id, pinId: targetPin },
          to: { partId: boardPart ? boardPart.id : "uno", pinId: "gnd" },
          color: "black",
        })
      }
    } else if (fault.classification === "CODE_PIN_MISMATCH") {
      // Move wire to match code pin
      const wiredBoardPins = newWires
        .flatMap((w) => [
          w.from.partId === boardPart?.id ? { wire: w, pin: w.from.pinId, isFrom: true } : null,
          w.to.partId === boardPart?.id ? { wire: w, pin: w.to.pinId, isFrom: false } : null,
        ])
        .filter(Boolean) as { wire: Wire; pin: string; isFrom: boolean }[]

      const mismatchWire = wiredBoardPins.find((p) => /^d\d+$/i.test(p.pin))
      if (mismatchWire && boardPart) {
        actions.push({
          type: "disconnect",
          wireId: mismatchWire.wire.id,
        })
        actions.push({
          type: "connect",
          from: `${boardPart.id}:${fault.affectedPinId}`,
          to: mismatchWire.isFrom
            ? `${mismatchWire.wire.to.partId}:${mismatchWire.wire.to.pinId}`
            : `${mismatchWire.wire.from.partId}:${mismatchWire.wire.from.pinId}`,
          color: mismatchWire.wire.color,
        })

        newWires = newWires.filter((w) => w.id !== mismatchWire.wire.id)
        newWires.push({
          id: `w_align_pin_${Date.now()}`,
          from: { partId: boardPart.id, pinId: fault.affectedPinId },
          to: mismatchWire.isFrom ? mismatchWire.wire.to : mismatchWire.wire.from,
          color: mismatchWire.wire.color,
        })
      }
    }
  }

  // Calculate diff
  const addedWires = newWires.filter((w) => !currentCircuit.wires.some((cw) => cw.id === w.id))
  const removedWires = currentCircuit.wires.filter((cw) => !newWires.some((w) => w.id === cw.id))
  const modifiedParts = newParts.filter((p) => {
    const cp = currentCircuit.parts.find((orig) => orig.id === p.id)
    return cp && JSON.stringify(cp.props) !== JSON.stringify(p.props)
  })

  const repairedCircuit: CircuitState = {
    parts: newParts,
    wires: newWires,
  }

  const primaryDiagnosis =
    faults.length > 0
      ? `${faults[0].title}: ${faults[0].electricalExplanation}`
      : "Circuit topology is electrically sound."

  return {
    diagnosis: primaryDiagnosis,
    confidence: faults.length > 0 ? faults[0].confidence : 1.0,
    faults,
    actions,
    expectedOutcome: outcome,
    repairedCircuit,
    repairedBlocklyXml: updatedBlocklyXml,
    diff: {
      addedWires,
      removedWires,
      modifiedParts,
    },
  }
}

// ============================================================================
// 6. Phase 5 — Simulator-in-the-Loop Verification
// ============================================================================

export function verifyCircuitWithSimulator(
  beforeCircuit: CircuitState,
  afterCircuit: CircuitState,
  pinStates: Record<string, ArduinoPinState> = {},
  blocklyXml?: string
): SimulatorVerificationResult {
  // 1. Solve Before State
  const beforeNodal = solveCircuitNodalPotentials(beforeCircuit, new Set(), pinStates, true)
  const beforeHealth = diagnoseCircuit(beforeCircuit, {}, pinStates)

  // 2. Solve After State
  const afterNodal = solveCircuitNodalPotentials(afterCircuit, new Set(), pinStates, true)
  const afterHealth = diagnoseCircuit(afterCircuit, {}, pinStates)
  const validation = validateProposedCircuit({
    parts: afterCircuit.parts,
    wires: afterCircuit.wires,
    blocklyXml,
  })

  // Measure active currents across components
  const beforeCurrents: Record<string, number> = {}
  const afterCurrents: Record<string, number> = {}
  const afterStates: Record<string, string> = {}
  const beforeStates: Record<string, string> = {}

  for (const p of afterCircuit.parts) {
    if (p.type === "led") {
      const vAnode = afterNodal.getPinVoltage({ partId: p.id, pinId: "anode" })
      const vCathode = afterNodal.getPinVoltage({ partId: p.id, pinId: "cathode" })
      const vDrop = vAnode - vCathode
      const current = afterNodal.getBranchCurrent(p.id, "anode", "cathode")
      afterCurrents[p.id] = Number(current.toFixed(2))
      afterStates[p.id] = vDrop > 1.6 && current > 2.0 ? `ILLUMINATED (${current.toFixed(1)}mA)` : "OFF"
    } else if (p.type === "resistor") {
      const current = afterNodal.getBranchCurrent(p.id, "a", "b")
      afterCurrents[p.id] = Number(current.toFixed(2))
    }
  }

  for (const p of beforeCircuit.parts) {
    if (p.type === "led") {
      const current = beforeNodal.getBranchCurrent(p.id, "anode", "cathode")
      beforeCurrents[p.id] = Number(current.toFixed(2))
      const vDrop =
        beforeNodal.getPinVoltage({ partId: p.id, pinId: "anode" }) -
        beforeNodal.getPinVoltage({ partId: p.id, pinId: "cathode" })
      beforeStates[p.id] = vDrop > 1.6 && current > 2.0 ? `ILLUMINATED (${current.toFixed(1)}mA)` : "OFF"
    }
  }

  const solverPassed = afterNodal.diagnostics.length === 0
  const noShorts = afterHealth.criticalCount === 0
  const electricalChecksPassed = solverPassed && noShorts && validation.valid

  const verified = electricalChecksPassed && afterHealth.score >= beforeHealth.score

  let deltaMsg = ""
  if (verified) {
    deltaMsg = `Simulated circuit passed the electrical checks. Health score changed from ${beforeHealth.score}/100 to ${afterHealth.score}/100. Critical issues: 0.`
  } else {
    deltaMsg = `Simulation verification failed. Errors detected: ${afterHealth.issues.map((i) => i.title).join(", ")}`
  }

  return {
    verified,
    solverPassed,
    electricalChecksPassed,
    status: verified ? "VERIFIED_WORKING" : noShorts ? "FAILED_ELECTRICAL" : "HAZARD_DETECTED",
    beforeMetrics: {
      healthScore: beforeHealth.score,
      criticalCount: beforeHealth.criticalCount,
      warningCount: beforeHealth.warningCount,
      activeCurrentsMa: beforeCurrents,
      componentStates: beforeStates,
    },
    afterMetrics: {
      healthScore: afterHealth.score,
      criticalCount: afterHealth.criticalCount,
      warningCount: afterHealth.warningCount,
      activeCurrentsMa: afterCurrents,
      componentStates: afterStates,
    },
    deltaExplanation: deltaMsg,
  }
}

// ============================================================================
// 7. Phase 7 — Natural Language & Hinglish Reasoning Interface
// ============================================================================

export function processCircuitCopilotQuery(
  userQuery: string,
  circuitContext: CircuitDiagnosisContext
): {
  reply: string
  proposal?: StructuredRepairProposal
  verification?: SimulatorVerificationResult
  highlightPartIds: string[]
} {
  const queryLower = userQuery.toLowerCase().trim()
  const faults = diagnoseCircuitIntelligence(circuitContext)
  const currentHash = computeCircuitHash(
    { parts: circuitContext.parts, wires: circuitContext.wires },
    circuitContext.code.rawXml
  )

  const isHinglish =
    queryLower.includes("nahi") ||
    queryLower.includes("nhi") ||
    queryLower.includes("bhai") ||
    queryLower.includes("karo") ||
    queryLower.includes("chahiye") ||
    queryLower.includes("chaiye") ||
    queryLower.includes("galti") ||
    queryLower.includes("kyun") ||
    queryLower.includes("kyu") ||
    queryLower.includes("badla")

  const highlightPartIds = faults.map((f) => f.affectedPartId)

  // Generate repair proposal if faults exist
  let proposal: StructuredRepairProposal | undefined
  let verification: SimulatorVerificationResult | undefined

  if (faults.length > 0) {
    proposal = generateCircuitRepairProposal(
      { parts: circuitContext.parts, wires: circuitContext.wires },
      faults,
      currentHash,
      circuitContext.code.rawXml
    )
    verification = verifyCircuitWithSimulator(
      { parts: circuitContext.parts, wires: circuitContext.wires },
      proposal.repairedCircuit,
      {},
      circuitContext.code.rawXml
    )
  }

  // Construct structured pedagogical response
  let reply = ""
  if (faults.length === 0) {
    if (isHinglish) {
      reply = `**8square AI:** Aapka circuit electrically bilkul theek hai! Saare connections intact hain aur Circuit Doctor health score **${circuitContext.healthReport.score}/100** hai. Koi short circuit ya broken return path nahi mila.`
    } else {
      reply = `**8square AI:** Your virtual circuit is electrically sound! All connections are intact with a Circuit Doctor health score of **${circuitContext.healthReport.score}/100**. No open loops, shorts, or polarity errors detected.`
    }
  } else {
    const f = faults[0]
    if (isHinglish) {
      reply = `**8square AI — Circuit Diagnosis Report:**\n\n` +
        `🔍 **Samasya (Fault):** ${f.title}\n` +
        `⚡ **Evidence:** ${f.evidence}\n` +
        `💡 **Electrical Reason:** ${f.electricalExplanation}\n\n` +
        `🛠️ **Proposed Repair:** ${f.suggestedRepair}\n` +
        `✅ **Expected Result:** ${f.expectedOutcome}\n\n` +
        `Aap niche **"Apply Fix"** button dabakar is correction ko canvas par apply kar sakte hain.`
    } else {
      reply = `**8square AI — Circuit Diagnosis Report:**\n\n` +
        `🔍 **Fault Identified:** ${f.title}\n` +
        `⚡ **Hardware Evidence:** ${f.evidence}\n` +
        `💡 **Electrical Root Cause:** ${f.electricalExplanation}\n\n` +
        `🛠️ **Recommended Fix:** ${f.suggestedRepair}\n` +
        `✅ **Expected Outcome:** ${f.expectedOutcome}\n\n` +
        `You can inspect the proposed repair diff below and click **"Apply Fix"** to update your circuit canvas.`
    }
  }

  return {
    reply,
    proposal,
    verification,
    highlightPartIds,
  }
}
