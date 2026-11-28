/**
 * PIXIU TECH CYBERLAB — XEN CIRCUIT INTELLIGENCE & AUTONOMOUS REPAIR ENGINE
 * 
 * Deep domain-specific reasoning, 20-category electrical fault diagnosis,
 * structured atomic repair generation, and simulator-in-the-loop verification.
 * 
 * Authoritative Assistant Identity: Xen (developed by PixiuTech)
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
import { validateProposedCircuit, computeCircuitHash, resolveCanonicalPin, type CircuitValidationResult } from "./circuit-validator"
import { extractCodePinBindings, normalizeCodePinToken, type CodePinBinding } from "./code-pin-bindings"
import type { CircuitCopilotProposal } from "@/components/circuit-lab/use-circuit-copilot-action"

export { extractCodePinBindings, normalizeCodePinToken, type CodePinBinding }

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
  value?: number
  unit: string
  state: "available" | "unavailable" | "invalid" | "not_configured"
  notes?: string
}

export interface EndpointNetEntry {
  endpoint: string
  partId: string
  partType: string
  pinId: string
  canonicalPinId: string
  netId: number | null
  netName: string | null
  isConnected: boolean
  isPowerRail: boolean
  isGroundRail: boolean
  isFloating: boolean
  voltageV: number | null
  directWirePeers: string[]
  sameNetEndpoints: string[]
  sameNetBoardPins: string[]
}

export interface TerminalNetBinding {
  pinId: string
  netId: number | null
  netName: string | null
  isConnected: boolean
  directPeers: string[]
  sameNetPeers: string[]
  boardPins: string[]
  voltageV: number | null
}

export interface ResistorTerminalLookup {
  partId: string
  resistanceOhm: number
  terminalA: TerminalNetBinding
  terminalB: TerminalNetBinding
  currentMa: number | null
  pathSummary: string
}

export interface CrossLayerLedDiagnostic {
  ledId: string
  layerA_electricalTopology: {
    anodeConnected: boolean
    cathodeConnected: boolean
    anodeNetId: number | null
    anodeNetName: string | null
    cathodeNetId: number | null
    cathodeNetName: string | null
    anodePeers: string[]
    cathodePeers: string[]
    seriesResistorIds: string[]
    physicalDriverPins: string[]
    hasGroundReturn: boolean
    reversedPolarity: boolean
    openCircuitPins: string[]
    shorted: boolean
    topologyOk: boolean
  }
  layerB_safetyConstraints: {
    hasSeriesResistor: boolean
    resistorValuesOhm: number[]
    overcurrentRisk: boolean
    burnt: boolean
    safetyOk: boolean
  }
  layerC_controllerPinCompatibility: {
    physicalBoardId: string | null
    physicalBoardPins: string[]
    supportsDigitalOutput: boolean
    supportsPwm: boolean
    pinCompatibilityOk: boolean
  }
  layerD_programMapping: {
    codePins: string[]
    codeUsesPwm: boolean
    matchesPhysicalPin: boolean
    mismatchReason: string | null
  }
  layerE_simulatorExecution: {
    simulationStatus: "ready" | "running" | "paused" | "stopped"
    running: boolean
    paused: boolean
    runTimeS: number
  }
  layerF_observedOutput: {
    anodeVoltageV: number | null
    cathodeVoltageV: number | null
    voltageDropV: number | null
    currentMa: number
    level: number
    state:
      | "burnt"
      | "illuminated"
      | "off_code_mismatch"
      | "off_unwired_or_fault"
      | "off_pin_low_or_unstarted"
      | "stopped_not_running"
      | "paused"
    pinStatesOnPhysicalPins: Record<string, string>
    pinStatesOnCodePins: Record<string, string>
  }
  summary: string
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
    generatedCode?: string
    pinBindings: CodePinBinding[]
  }
  simulationStatus: "ready" | "running" | "paused" | "stopped"
  isPaused?: boolean
  runTime?: number
  simulationErrors: string[]
  healthReport: CircuitHealthReport
  nodalSolution?: NodalSolution
  endpointLookup?: Record<string, EndpointNetEntry>
  resistorTerminals?: ResistorTerminalLookup[]
  crossLayerLedDiagnostics?: CrossLayerLedDiagnostic[]
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
  const part = circuit.parts.find((p) => p.id === partId)
  const canon = part ? resolveCanonicalPin(part.type, pinId) : pinId.trim().toLowerCase()
  const target = formatPinKey(partId, canon)
  return circuit.wires.some((w) => {
    const fromPart = circuit.parts.find((p) => p.id === w.from.partId)
    const toPart = circuit.parts.find((p) => p.id === w.to.partId)
    const fromKey = formatPinKey(
      w.from.partId,
      fromPart ? resolveCanonicalPin(fromPart.type, w.from.pinId) : w.from.pinId
    )
    const toKey = formatPinKey(
      w.to.partId,
      toPart ? resolveCanonicalPin(toPart.type, w.to.pinId) : w.to.pinId
    )
    return fromKey === target || toKey === target
  })
}

const PASSIVE_SERIES_PART_TYPES = new Set([
  "resistor",
  "pushbutton",
  "switch",
  "slide-switch",
  "diode",
])

function canonicalizePinForPart(part: PlacedPart | undefined, pinId: string): string {
  const trimmed = String(pinId || "").trim()
  if (!part) return trimmed.toLowerCase()
  return resolveCanonicalPin(part.type, trimmed).toLowerCase()
}

/**
 * Deterministically resolve every circuit endpoint and both terminals of every
 * resistor independently against the canonical nodal netlist.
 */
export function buildEndpointNetLookup(
  circuit: CircuitState,
  nodal?: NodalSolution
): {
  endpointLookup: Record<string, EndpointNetEntry>
  resistorTerminals: ResistorTerminalLookup[]
} {
  const partById = new Map<string, PlacedPart>(circuit.parts.map((p) => [p.id, p]))
  const canonicalizeEndpoint = (partId: string, pinId: string): { partId: string; pinId: string; key: string } => {
    const part = partById.get(partId)
    const canonPin = canonicalizePinForPart(part, pinId)
    return { partId, pinId: canonPin, key: formatPinKey(partId, canonPin) }
  }

  const directPeers = new Map<string, Set<string>>()
  const ensureDirectSet = (key: string): Set<string> => {
    let set = directPeers.get(key)
    if (!set) {
      set = new Set<string>()
      directPeers.set(key, set)
    }
    return set
  }

  const knownEndpoints = new Set<string>()
  for (const part of circuit.parts) {
    const boardDef = isBoardPart(part.type) ? getBoardForPart(part) : undefined
    if (boardDef) {
      for (const pin of boardDef.pins) {
        knownEndpoints.add(formatPinKey(part.id, pin.id))
      }
    } else {
      const def = CATALOG[part.type]
      if (def) {
        for (const pin of def.pins) {
          knownEndpoints.add(canonicalizeEndpoint(part.id, pin.id).key)
        }
      }
    }
  }

  for (const w of circuit.wires) {
    const a = canonicalizeEndpoint(w.from.partId, w.from.pinId)
    const b = canonicalizeEndpoint(w.to.partId, w.to.pinId)
    knownEndpoints.add(a.key)
    knownEndpoints.add(b.key)
    ensureDirectSet(a.key).add(b.key)
    ensureDirectSet(b.key).add(a.key)
  }

  const netByEndpoint = new Map<string, NodalSolution["nets"][number]>()
  const canonicalNetMembers = new Map<number, string[]>()
  for (const net of nodal?.nets || []) {
    const memberSet = new Set<string>()
    for (const rawKey of net.pinKeys || []) {
      const parsed = parsePinKey(rawKey)
      const canon = canonicalizeEndpoint(parsed.partId, parsed.pinId).key
      memberSet.add(canon)
      knownEndpoints.add(canon)
      netByEndpoint.set(canon, net)
      netByEndpoint.set(rawKey.toLowerCase(), net)
    }
    canonicalNetMembers.set(net.netId, Array.from(memberSet).sort())
  }

  const sortedEndpoints = Array.from(knownEndpoints).sort()
  const endpointLookup: Record<string, EndpointNetEntry> = {}

  for (const ep of sortedEndpoints) {
    const parsed = parsePinKey(ep)
    const part = partById.get(parsed.partId)
    const net = netByEndpoint.get(ep) ?? null
    const rawInfo = nodal?.getPinInfo?.({ partId: parsed.partId, pinId: parsed.pinId })
    const direct = Array.from(directPeers.get(ep) ?? []).sort()
    const sameNetAll = net ? canonicalNetMembers.get(net.netId) ?? [] : []
    const sameNet = sameNetAll.filter((k) => k !== ep)
    const sameNetBoardPins = sameNet.filter((k) => {
      const peerPart = partById.get(parsePinKey(k).partId)
      return Boolean(peerPart && isBoardPart(peerPart.type))
    })
    const voltageRaw =
      typeof net?.solvedVoltage === "number" && Number.isFinite(net.solvedVoltage)
        ? net.solvedVoltage
        : typeof rawInfo?.voltage === "number" && Number.isFinite(rawInfo.voltage)
        ? rawInfo.voltage
        : null

    endpointLookup[ep] = {
      endpoint: ep,
      partId: parsed.partId,
      partType: part?.type ?? "unknown",
      pinId: parsed.pinId,
      canonicalPinId: parsed.pinId,
      netId: net?.netId ?? null,
      netName: net?.name ?? null,
      isConnected: direct.length > 0 || sameNet.length > 0,
      isPowerRail: Boolean(net?.isPowerRail),
      isGroundRail: Boolean(net?.isGroundRail),
      isFloating: net ? Boolean(net.isFloating) : true,
      voltageV: voltageRaw !== null ? Number(voltageRaw.toFixed(3)) : null,
      directWirePeers: direct,
      sameNetEndpoints: sameNet,
      sameNetBoardPins,
    }
  }

  const formatTerminalSide = (
    partId: string,
    pinId: "a" | "b"
  ): TerminalNetBinding => {
    const entry = endpointLookup[formatPinKey(partId, pinId)]
    if (!entry) {
      return {
        pinId,
        netId: null,
        netName: null,
        isConnected: false,
        directPeers: [],
        sameNetPeers: [],
        boardPins: [],
        voltageV: null,
      }
    }
    return {
      pinId,
      netId: entry.netId,
      netName: entry.netName,
      isConnected: entry.isConnected,
      directPeers: entry.directWirePeers,
      sameNetPeers: entry.sameNetEndpoints,
      boardPins: entry.sameNetBoardPins,
      voltageV: entry.voltageV,
    }
  }

  const describeSide = (label: string, t: TerminalNetBinding): string => {
    if (!t.isConnected) return `${label} -> UNCONNECTED`
    const peerList = t.directPeers.length > 0 ? t.directPeers : t.sameNetPeers
    const netTag = t.netName ? `${t.netName} (net ${t.netId ?? "?"})` : `net ${t.netId ?? "?"}`
    const sameExtra =
      t.sameNetPeers.length > t.directPeers.length
        ? ` [same_net: ${t.sameNetPeers.join(", ")}]`
        : ""
    return `${label} -> ${netTag} peers=[${peerList.join(", ") || "none"}]${sameExtra}`
  }

  const resistors = circuit.parts.filter((p) => p.type === "resistor").sort((a, b) => a.id.localeCompare(b.id))
  const resistorTerminals: ResistorTerminalLookup[] = resistors.map((r) => {
    const terminalA = formatTerminalSide(r.id, "a")
    const terminalB = formatTerminalSide(r.id, "b")
    const ohm = Number(r.props?.resistance ?? 220)
    const rawBranch = nodal?.getBranchCurrent?.(r.id, "a", "b")
    const currentMa =
      typeof rawBranch === "number" && Number.isFinite(rawBranch) ? Number(rawBranch.toFixed(2)) : null
    return {
      partId: r.id,
      resistanceOhm: Number.isFinite(ohm) ? ohm : 220,
      terminalA,
      terminalB,
      currentMa,
      pathSummary: `${r.id} (${Number.isFinite(ohm) ? ohm : 220}Ω): ${describeSide("terminal a", terminalA)} | ${describeSide("terminal b", terminalB)}`,
    }
  })

  return { endpointLookup, resistorTerminals }
}

function traceLedBranchReach(
  ledId: string,
  startPinId: "anode" | "cathode",
  endpointLookup: Record<string, EndpointNetEntry>,
  partLookup: Map<string, PlacedPart>,
  boardDef?: BoardDefinition
): {
  resistorIds: string[]
  boardGpioPins: string[]
  hasGroundRail: boolean
  hasPowerRail: boolean
  netsVisited: number[]
} {
  const startEntry = endpointLookup[formatPinKey(ledId, startPinId)]
  if (!startEntry || !startEntry.isConnected) {
    return { resistorIds: [], boardGpioPins: [], hasGroundRail: false, hasPowerRail: false, netsVisited: [] }
  }

  const visitedNets = new Set<number>()
  const resistorIds = new Set<string>()
  const boardGpioPins = new Set<string>()
  let hasGroundRail = false
  let hasPowerRail = false

  const queue: EndpointNetEntry[] = [startEntry]
  const seenEntries = new Set<string>([startEntry.endpoint])

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.netId !== null) visitedNets.add(cur.netId)
    if (cur.isGroundRail) hasGroundRail = true
    if (cur.isPowerRail) hasPowerRail = true

    const peers = cur.sameNetEndpoints.length > 0 ? cur.sameNetEndpoints : cur.directWirePeers
    for (const peerKey of peers) {
      const peerEntry = endpointLookup[peerKey]
      if (!peerEntry) continue
      const peerPart = partLookup.get(peerEntry.partId)
      if (!peerPart) continue

      if (isBoardPart(peerPart.type)) {
        const bDef = boardDef ?? getBoardForPart(peerPart)
        const isPowerPin = Boolean(
          bDef?.powerPins.gnd.some((p) => p.toLowerCase() === peerEntry.pinId) ||
            bDef?.powerPins.v5.some((p) => p.toLowerCase() === peerEntry.pinId) ||
            bDef?.powerPins.v33.some((p) => p.toLowerCase() === peerEntry.pinId) ||
            peerEntry.pinId === "vin"
        )
        if (!isPowerPin && !peerEntry.isGroundRail && !peerEntry.isPowerRail) {
          boardGpioPins.add(peerEntry.endpoint)
        }
        continue
      }

      if (peerPart.type === "resistor") {
        resistorIds.add(peerPart.id)
      }

      if (PASSIVE_SERIES_PART_TYPES.has(peerPart.type)) {
        // Traverse internally across the opposite terminal of a series two-terminal component
        const partEndpoints = Object.values(endpointLookup).filter(
          (e) => e.partId === peerPart.id && e.endpoint !== peerEntry.endpoint && e.isConnected
        )
        for (const otherTerm of partEndpoints) {
          if (!seenEntries.has(otherTerm.endpoint)) {
            seenEntries.add(otherTerm.endpoint)
            queue.push(otherTerm)
          }
        }
      }
    }
  }

  return {
    resistorIds: Array.from(resistorIds).sort(),
    boardGpioPins: Array.from(boardGpioPins).sort(),
    hasGroundRail,
    hasPowerRail,
    netsVisited: Array.from(visitedNets).sort((a, b) => a - b),
  }
}

/**
 * Evaluate LED circuits across 6 distinct verification layers (A-F):
 * electrical topology, safety/resistor constraints, pin capability compatibility,
 * program/code pin mapping, simulator execution status, and observed runtime output.
 */
export function analyzeCrossLayerLedDiagnostics(options: {
  circuit: CircuitState
  endpointLookup: Record<string, EndpointNetEntry>
  codeBindings: CodePinBinding[]
  boardPart?: PlacedPart
  boardDef?: BoardDefinition
  nodal?: NodalSolution
  runtime?: Record<string, PartRuntime>
  pinStates?: Record<string, ArduinoPinState>
  running?: boolean
  isPaused?: boolean
  runTime?: number
}): CrossLayerLedDiagnostic[] {
  const {
    circuit,
    endpointLookup,
    codeBindings,
    boardPart,
    boardDef,
    nodal,
    runtime = {},
    pinStates = {},
    running = false,
    isPaused = false,
    runTime = 0,
  } = options
  const partLookup = new Map(circuit.parts.map((p) => [p.id, p]))
  const leds = circuit.parts.filter((p) => p.type === "led").sort((a, b) => a.id.localeCompare(b.id))
  const simStatus: "ready" | "running" | "paused" | "stopped" = running
    ? isPaused
      ? "paused"
      : "running"
    : "ready"

  const codePinsAll = Array.from(new Set(codeBindings.map((b) => b.pinId)))
  const codeOutputPins = Array.from(
    new Set(codeBindings.filter((b) => b.configuredMode === "OUTPUT" || b.configuredMode === "PWM").map((b) => b.pinId))
  )
  const effectiveCodePins = codeOutputPins.length > 0 ? codeOutputPins : codePinsAll
  const codeUsesPwm = codeBindings.some((b) => b.configuredMode === "PWM")

  const readPinStateLabel = (pinId: string): string => {
    const direct = pinStates[pinId] ?? pinStates[pinId.toUpperCase()] ?? pinStates[pinId.toLowerCase()]
    if (!direct) return "unknown"
    return direct.outputMode === "pwm" && typeof direct.value === "number"
      ? `PWM(${direct.value})`
      : direct.state
  }

  return leds.map((led) => {
    const anodeEp = endpointLookup[formatPinKey(led.id, "anode")]
    const cathodeEp = endpointLookup[formatPinKey(led.id, "cathode")]
    const anodeReach = traceLedBranchReach(led.id, "anode", endpointLookup, partLookup, boardDef)
    const cathodeReach = traceLedBranchReach(led.id, "cathode", endpointLookup, partLookup, boardDef)

    const anodeConnected = Boolean(anodeEp?.isConnected)
    const cathodeConnected = Boolean(cathodeEp?.isConnected)
    const openCircuitPins: string[] = []
    if (!anodeConnected) openCircuitPins.push("anode")
    if (!cathodeConnected) openCircuitPins.push("cathode")

    const seriesResistorIds = Array.from(
      new Set([...anodeReach.resistorIds, ...cathodeReach.resistorIds])
    ).sort()
    const physicalDriverPins = Array.from(
      new Set([...anodeReach.boardGpioPins, ...cathodeReach.boardGpioPins])
    ).sort()

    const reversedPolarity = Boolean(anodeEp?.isGroundRail && !cathodeEp?.isGroundRail) ||
      Boolean(anodeReach.hasGroundRail && !anodeReach.hasPowerRail && anodeReach.boardGpioPins.length === 0 && (cathodeReach.hasPowerRail || cathodeReach.boardGpioPins.length > 0))
    const shorted = Boolean(
      anodeEp?.netId !== null && anodeEp?.netId !== undefined && anodeEp?.netId === cathodeEp?.netId
    )
    const hasGroundReturn = Boolean(cathodeEp?.isGroundRail || cathodeReach.hasGroundRail)
    const hasDriverOrPower = physicalDriverPins.length > 0 || Boolean(anodeEp?.isPowerRail || anodeReach.hasPowerRail)
    const topologyOk = anodeConnected && cathodeConnected && !reversedPolarity && !shorted && hasGroundReturn && hasDriverOrPower

    const resistorValuesOhm = seriesResistorIds.map((rid) =>
      Number(partLookup.get(rid)?.props?.resistance ?? 220)
    )
    const rt = runtime[led.id]
    const burnt = Boolean(rt?.burnt)
    const hasSeriesResistor = seriesResistorIds.length > 0
    const overcurrentRisk = burnt || (!hasSeriesResistor && topologyOk) || resistorValuesOhm.some((r) => r < 100)
    const highResistor = resistorValuesOhm.some((r) => r > 100000)
    const safetyOk = hasSeriesResistor && !overcurrentRisk && !highResistor && !burnt

    const physicalPinIds = physicalDriverPins.map((k) => parsePinKey(k).pinId)
    let supportsDigitalOutput = physicalPinIds.length > 0
    let supportsPwm = physicalPinIds.length > 0
    if (boardDef && physicalPinIds.length > 0) {
      supportsDigitalOutput = physicalPinIds.every((pid) => {
        const spec = boardDef.pins.find((p) => p.id.toLowerCase() === pid)
        return Boolean(spec && !spec.caps?.inputOnly && (spec.kind === "digital" || spec.kind === "analog"))
      })
      supportsPwm = physicalPinIds.every((pid) => {
        const spec = boardDef.pins.find((p) => p.id.toLowerCase() === pid)
        return Boolean(spec?.caps?.pwm)
      })
    } else if (anodeEp?.isPowerRail || anodeReach.hasPowerRail) {
      supportsDigitalOutput = false
      supportsPwm = false
    }
    const pinCompatibilityOk =
      physicalPinIds.length === 0
        ? Boolean(anodeEp?.isPowerRail || anodeReach.hasPowerRail)
        : supportsDigitalOutput && (!codeUsesPwm || supportsPwm)

    let matchesPhysicalPin = true
    let mismatchReason: string | null = null
    if (effectiveCodePins.length > 0) {
      if (physicalPinIds.length > 0) {
        matchesPhysicalPin = physicalPinIds.some((pid) => effectiveCodePins.includes(pid))
        if (!matchesPhysicalPin) {
          mismatchReason = `${led.id} is physically wired to ${physicalPinIds.map((p) => p.toUpperCase()).join(", ")}, whereas code targets ${effectiveCodePins.map((p) => p.toUpperCase()).join(", ")}.`
        }
      } else if (anodeEp?.isPowerRail || anodeReach.hasPowerRail) {
        matchesPhysicalPin = false
        mismatchReason = `${led.id} is connected to a constant power rail rather than programmable pin ${effectiveCodePins.map((p) => p.toUpperCase()).join(", ")}.`
      }
    }

    const vAnodeRaw = nodal?.getPinVoltage?.({ partId: led.id, pinId: "anode" })
    const vCathodeRaw = nodal?.getPinVoltage?.({ partId: led.id, pinId: "cathode" })
    const vAnode = typeof vAnodeRaw === "number" && Number.isFinite(vAnodeRaw) ? Number(vAnodeRaw.toFixed(3)) : null
    const vCathode = typeof vCathodeRaw === "number" && Number.isFinite(vCathodeRaw) ? Number(vCathodeRaw.toFixed(3)) : null
    const vDrop = vAnode !== null && vCathode !== null ? Number((vAnode - vCathode).toFixed(3)) : null
    const branchMa = nodal?.getBranchCurrent?.(led.id, "anode", "cathode")
    const currentMa = Number(
      (typeof rt?.currentMa === "number" && Number.isFinite(rt.currentMa)
        ? rt.currentMa
        : typeof branchMa === "number" && Number.isFinite(branchMa)
        ? branchMa
        : 0
      ).toFixed(2)
    )
    const level = typeof rt?.level === "number" && Number.isFinite(rt.level) ? Number(rt.level.toFixed(2)) : (vDrop !== null && vDrop > 1.6 && currentMa > 2 ? 1 : 0)

    let obsState: CrossLayerLedDiagnostic["layerF_observedOutput"]["state"]
    if (burnt) {
      obsState = "burnt"
    } else if (!running) {
      obsState = "stopped_not_running"
    } else if (isPaused) {
      obsState = "paused"
    } else if (!topologyOk) {
      obsState = "off_unwired_or_fault"
    } else if (!matchesPhysicalPin && effectiveCodePins.length > 0) {
      obsState = "off_code_mismatch"
    } else if (level > 0.05 || (vDrop !== null && vDrop > 1.6 && currentMa > 2.0)) {
      obsState = "illuminated"
    } else {
      obsState = "off_pin_low_or_unstarted"
    }

    const pinStatesOnPhysicalPins: Record<string, string> = {}
    for (const pid of physicalPinIds) {
      pinStatesOnPhysicalPins[pid] = readPinStateLabel(pid)
    }
    const pinStatesOnCodePins: Record<string, string> = {}
    for (const cpid of effectiveCodePins) {
      pinStatesOnCodePins[cpid] = readPinStateLabel(cpid)
    }

    const summaryParts: string[] = [
      `topology=${topologyOk ? "OK" : openCircuitPins.length ? `OPEN(${openCircuitPins.join(",")})` : reversedPolarity ? "REVERSED" : shorted ? "SHORTED" : "FAULT"}`,
      `safety=${safetyOk ? "OK" : burnt ? "BURNT" : overcurrentRisk ? "OVERCURRENT" : "ISSUE"}`,
      `phys_pins=[${physicalPinIds.join(",") || (anodeReach.hasPowerRail ? "POWER_RAIL" : "none")}]`,
      `code_pins=[${effectiveCodePins.join(",") || "none"}]`,
      `code_match=${matchesPhysicalPin}`,
      `sim=${simStatus}`,
      `observed=${obsState}`,
    ]

    return {
      ledId: led.id,
      layerA_electricalTopology: {
        anodeConnected,
        cathodeConnected,
        anodeNetId: anodeEp?.netId ?? null,
        anodeNetName: anodeEp?.netName ?? null,
        cathodeNetId: cathodeEp?.netId ?? null,
        cathodeNetName: cathodeEp?.netName ?? null,
        anodePeers: anodeEp?.directWirePeers ?? [],
        cathodePeers: cathodeEp?.directWirePeers ?? [],
        seriesResistorIds,
        physicalDriverPins,
        hasGroundReturn,
        reversedPolarity,
        openCircuitPins,
        shorted,
        topologyOk,
      },
      layerB_safetyConstraints: {
        hasSeriesResistor,
        resistorValuesOhm,
        overcurrentRisk,
        burnt,
        safetyOk,
      },
      layerC_controllerPinCompatibility: {
        physicalBoardId: boardPart?.id ?? null,
        physicalBoardPins: physicalPinIds,
        supportsDigitalOutput,
        supportsPwm,
        pinCompatibilityOk,
      },
      layerD_programMapping: {
        codePins: effectiveCodePins,
        codeUsesPwm,
        matchesPhysicalPin,
        mismatchReason,
      },
      layerE_simulatorExecution: {
        simulationStatus: simStatus,
        running,
        paused: isPaused,
        runTimeS: Number(runTime.toFixed(1)),
      },
      layerF_observedOutput: {
        anodeVoltageV: vAnode,
        cathodeVoltageV: vCathode,
        voltageDropV: vDrop,
        currentMa,
        level,
        state: obsState,
        pinStatesOnPhysicalPins,
        pinStatesOnCodePins,
      },
      summary: `${led.id}: ${summaryParts.join(" | ")}`,
    }
  })
}

// ============================================================================
// 3. Phase 2 — Circuit Context Serialization
// ============================================================================

export function serializeCircuitContext(
  circuit: CircuitState,
  options: {
    blocklyXml?: string
    generatedCode?: string
    runtime?: Record<string, PartRuntime>
    pinStates?: Record<string, ArduinoPinState>
    running?: boolean
    isPaused?: boolean
    runTime?: number
    pressed?: Set<string>
    multimeterProbes?: { red: PinRef | null; black: PinRef | null; mode?: string }
    oscilloscopeProbes?: { ch1: PinRef | null; ch2: PinRef | null }
  } = {}
): CircuitDiagnosisContext {
  const {
    blocklyXml,
    generatedCode,
    runtime = {},
    pinStates = {},
    running = false,
    isPaused = false,
    runTime = 0,
    pressed = new Set<string>(),
    multimeterProbes,
    oscilloscopeProbes,
  } = options

  const boardPart = circuit.parts.find((p) => isBoardPart(p.type))
  const boardDef = boardPart ? getBoardForPart(boardPart) : undefined

  // Extract canonical Code Pin Bindings first so Circuit Doctor sees program/wiring mismatches
  const pinBindings: CodePinBinding[] = extractCodePinBindings(blocklyXml, generatedCode, boardPart?.type)

  // Run MNA Nodal Solver & Circuit Doctor (single authoritative netlist, topology & code pin map)
  const nodal = solveCircuitNodalPotentials(circuit, pressed, pinStates, running, {}, runtime)
  const health = diagnoseCircuit(circuit, runtime, pinStates, {
    blocklyXml,
    generatedCode,
    codePinBindings: pinBindings,
  })

  const nets: ElectricalNet[] = nodal.nets.map((net) => ({
    id: net.netId,
    name: net.name,
    isPowerRail: net.isPowerRail,
    isGroundRail: net.isGroundRail,
    nominalVoltage: net.nominalVoltage,
    pinKeys: net.pinKeys,
  }))

  // The solver uses zero as a missing-pin sentinel. Only configured, solved probes can yield a value.
  const measurements: InstrumentMeasurement[] = []
  const dmmMode = (multimeterProbes?.mode || "voltage").toLowerCase()
  const red = multimeterProbes?.red
  const black = multimeterProbes?.black
  const probeKey = (pin?: PinRef | null) => pin ? formatPinKey(pin.partId, pin.pinId) : ""
  const usable = (pin: PinRef) => {
    const info = nodal.getPinInfo(pin)
    return info.netId >= 0 && !info.isFloating && !info.isConflicted && Number.isFinite(info.voltage)
  }
  const resistanceMode = ["resistance", "continuity", "ohms"].includes(dmmMode)
  const currentMode = ["current", "ma", "dc_a"].includes(dmmMode)
  const reading: InstrumentMeasurement = {
    instrument: "multimeter", mode: dmmMode, probeA: probeKey(red), probeB: probeKey(black),
    unit: resistanceMode ? "Ω" : currentMode ? "mA" : "V",
    state: dmmMode === "off" ? "not_configured" : "unavailable",
    notes: dmmMode === "off" ? "Meter is off." : "Place both probes on known pins with a defined measurement.",
  }
  if (dmmMode !== "off" && red && black) {
    const result = resistanceMode && nodal.getPinInfo(red).netId >= 0 && nodal.getPinInfo(black).netId >= 0
      ? nodal.computeResistanceBetweenPins(red, black)
      : usable(red) && usable(black) && !resistanceMode
        ? currentMode
          ? nodal.computeCurrentBetweenPins(red, black, runtime)
          : nodal.getPotentialDifference(red, black, circuit, pinStates)
        : undefined
    if (result) {
      const value = "resistance" in result ? result.resistance : "currentMa" in result ? result.currentMa : result.diff
      reading.notes = result.explanation
      if (Number.isFinite(value) && !("isWarning" in result && result.isWarning && currentMode)) {
        reading.value = Number(value.toFixed(3))
        reading.state = "available"
      } else {
        reading.state = Number.isNaN(value) ? "invalid" : "unavailable"
      }
    }
  }
  measurements.push(reading)

  for (const [mode, probe] of [["CH1", oscilloscopeProbes?.ch1], ["CH2", oscilloscopeProbes?.ch2]] as const) {
    const available = Boolean(probe && usable(probe))
    measurements.push({
      instrument: "oscilloscope", mode, probeA: probeKey(probe), unit: "V",
      state: available ? "available" : probe ? "unavailable" : "not_configured",
      ...(available && probe ? { value: Number(nodal.getPinVoltage(probe).toFixed(3)) } : {}),
      notes: available ? "Nodal simulator sample at the selected probe." : "No usable probe potential.",
    })
  }

  // Build deterministic endpoint-to-net lookup (including independent resistor A/B terminals)
  const { endpointLookup, resistorTerminals } = buildEndpointNetLookup(circuit, nodal)

  // Evaluate 6-layer LED diagnostics (topology, safety, pin capability, code mapping, sim state, observed runtime)
  const crossLayerLedDiagnostics = analyzeCrossLayerLedDiagnostics({
    circuit,
    endpointLookup,
    codeBindings: pinBindings,
    boardPart,
    boardDef,
    nodal,
    runtime,
    pinStates,
    running,
    isPaused,
    runTime,
  })

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
      generatedCode,
      pinBindings,
    },
    simulationStatus: running ? (isPaused ? "paused" : "running") : "ready",
    isPaused,
    runTime: Number(runTime.toFixed(1)),
    simulationErrors: health.issues
      .filter((i) => i.severity === "critical")
      .map((i) => `${i.title}: ${i.message}`),
    healthReport: health,
    nodalSolution: nodal,
    endpointLookup,
    resistorTerminals,
    crossLayerLedDiagnostics,
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

  const partLookup = new Map(parts.map((p) => [p.id, p]))
  const boardPartForDef = parts.find((p) => isBoardPart(p.type))
  const boardDef = boardPartForDef ? getBoardForPart(boardPartForDef) : undefined
  const resolvedEndpoints = context.endpointLookup ?? buildEndpointNetLookup({ parts, wires }, nodalSolution).endpointLookup

  // Map each pin (raw and canonical) to its Electrical Net
  const pinNetMap = new Map<string, ElectricalNet>()
  for (const net of nets) {
    for (const pKey of net.pinKeys) {
      pinNetMap.set(pKey.toLowerCase(), net)
      const parsed = parsePinKey(pKey)
      const part = partLookup.get(parsed.partId)
      const canon = formatPinKey(parsed.partId, canonicalizePinForPart(part, parsed.pinId))
      pinNetMap.set(canon, net)
    }
  }

  // Helper: check if a pin is wired (canonical pin resolution)
  const isPinWired = (partId: string, pinId: string): boolean =>
    isCircuitPinWired({ parts, wires }, partId, pinId)

  // --------------------------------------------------------------------------
  // Check 1: Dead Short Circuit (5V / 3.3V / Battery to GND)
  // --------------------------------------------------------------------------
  for (const shortedNet of nets.filter((n) => n.isGroundRail && n.isPowerRail)) {
    faults.push({
      id: `fault_short_${shortedNet.id}`,
      classification: "SHORT_CIRCUIT",
      title: "Direct Power-to-Ground Dead Short",
      affectedPartId: board ? board.id : "battery",
      affectedPinId: "gnd",
      affectedNetId: shortedNet.id,
      evidence: `Net ${shortedNet.name} is shorted directly to GND with 0Ω impedance.`,
      electricalExplanation:
        "A direct connection between power and ground causes excessive current, collapsing the power rail and triggering thermal shutdown.",
      confidence: 0.99,
      suggestedRepair: "Disconnect the direct wire linking the power pin to ground.",
      expectedOutcome: "Power rail returns to nominal voltage with no short-circuit current.",
    })
  }

  // --------------------------------------------------------------------------
  // Check 2: Missing Ground Reference (handles Uno, ESP32, Pico, micro:bit, Battery)
  // --------------------------------------------------------------------------
  const isCanonicalGroundPin = (partId: string, pinId: string): boolean => {
    const part = partLookup.get(partId)
    if (!part) return false
    const clean = pinId.toLowerCase()
    if (part.type === "battery") return clean === "neg"
    const b = getBoardForPart(part)
    if (b) {
      return b.powerPins.gnd.some((g) => g.toLowerCase() === clean) || clean === "gnd"
    }
    return false
  }
  const hasGroundWires = wires.some(
    (w) => isCanonicalGroundPin(w.from.partId, w.from.pinId) || isCanonicalGroundPin(w.to.partId, w.to.pinId)
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
    const anodeReach = traceLedBranchReach(led.id, "anode", resolvedEndpoints, partLookup, boardDef)
    const cathodeReach = traceLedBranchReach(led.id, "cathode", resolvedEndpoints, partLookup, boardDef)

    // 3b. Reversed LED Polarity (handles direct GND or ground-side series resistor)
    const isReversedLed =
      Boolean(anodeNet?.isGroundRail && !cathodeNet?.isGroundRail) ||
      Boolean(
        anodeReach.hasGroundRail &&
        !anodeReach.hasPowerRail &&
        anodeReach.boardGpioPins.length === 0 &&
        (cathodeReach.hasPowerRail || cathodeReach.boardGpioPins.length > 0)
      )
    if (isReversedLed) {
      faults.push({
        id: `fault_rev_led_${led.id}`,
        classification: "REVERSED_LED_POLARITY",
        title: `Reversed LED Polarity on ${led.id}`,
        affectedPartId: led.id,
        affectedPinId: "anode",
        evidence: `Anode (+) is connected to Ground (${anodeNet?.name || "GND"}), while Cathode (-) faces the positive signal/rail. Note: a series resistor limits forward current only and does not protect against reverse polarity.`,
        electricalExplanation:
          "LEDs are diodes that only conduct when forward biased (Anode positive relative to Cathode). Under reverse bias, the diode blocks current regardless of whether a series resistor is present.",
        confidence: 0.97,
        suggestedRepair: `Swap LED terminals: connect ${led.id}.anode to the resistor/signal and ${led.id}.cathode to Ground.`,
        expectedOutcome: "LED becomes forward biased and illuminates when the signal goes HIGH.",
      })
    }

    // 3c. Resistor Series Check & Resistor Value (supports direct wires & breadboard nets)
    const connectedResistorsMap = new Map<string, PlacedPart>()
    for (const w of wires) {
      let otherPin: PinRef | null = null
      if (w.from.partId === led.id) otherPin = w.to
      else if (w.to.partId === led.id) otherPin = w.from
      if (otherPin) {
        const otherPart = parts.find((p) => p.id === otherPin!.partId)
        if (otherPart && otherPart.type === "resistor") {
          connectedResistorsMap.set(otherPart.id, otherPart)
        }
      }
    }
    const anodeBranch = traceLedBranchReach(led.id, "anode", resolvedEndpoints, partLookup)
    const cathodeBranch = traceLedBranchReach(led.id, "cathode", resolvedEndpoints, partLookup)
    for (const rId of [...anodeBranch.resistorIds, ...cathodeBranch.resistorIds]) {
      const rPart = partLookup.get(rId)
      if (rPart) connectedResistorsMap.set(rPart.id, rPart)
    }
    const connectedResistors = Array.from(connectedResistorsMap.values())

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
  // Check 8: Code-to-Wiring Pin Mismatch (normalized pins + net-traced loads)
  // --------------------------------------------------------------------------
  if (board && code.pinBindings.length > 0) {
    const boardPart = parts.find((p) => p.id === board.id)
    if (boardPart) {
      const boardDef = getBoardForPart(boardPart)
      const normalizedBindings = code.pinBindings.map((b) => ({
        ...b,
        canonicalPinId: normalizeCodePinToken(b.pinId, boardPart.type) || b.pinId.toLowerCase(),
      }))
      const codePinSet = new Set(normalizedBindings.map((b) => b.canonicalPinId))
      const crossLayerLeds =
        context.crossLayerLedDiagnostics ??
        analyzeCrossLayerLedDiagnostics({
          circuit: { parts, wires },
          endpointLookup: resolvedEndpoints,
          codeBindings: normalizedBindings.map((b) => ({
            ...b,
            pinId: b.canonicalPinId,
          })),
          boardPart,
          boardDef,
          nodal: nodalSolution,
          running: context.simulationStatus === "running",
          isPaused: context.isPaused,
          runTime: context.runTime,
        })

      // Collect wired canonical digital pins on this board
      const wiredBoardPinIds = Array.from(
        new Set(
          wires
            .flatMap((w) => [
              w.from.partId === boardPart.id ? canonicalizePinForPart(boardPart, w.from.pinId) : null,
              w.to.partId === boardPart.id ? canonicalizePinForPart(boardPart, w.to.pinId) : null,
            ])
            .filter(Boolean) as string[]
        )
      )
      const unreferencedLedPhysicalPins = Array.from(
        new Set(
          crossLayerLeds
            .flatMap((d) => d.layerC_controllerPinCompatibility.physicalBoardPins)
            .filter((pid) => !codePinSet.has(pid))
        )
      )
      const digitalWired = wiredBoardPinIds.filter((p) => /^(d\d+|gp\d+|gpio\d+|p\d+)$/i.test(p))
      const unreferencedDigital = digitalWired.filter((p) => !codePinSet.has(p))

      const emittedCodePins = new Set<string>()
      for (const binding of normalizedBindings) {
        const canonPin = binding.canonicalPinId
        if (emittedCodePins.has(canonPin)) continue

        const isWired =
          isPinWired(boardPart.id, canonPin) ||
          Boolean(resolvedEndpoints[formatPinKey(boardPart.id, canonPin)]?.isConnected)

        const mismatchedLed = crossLayerLeds.find(
          (d) =>
            d.layerD_programMapping.codePins.includes(canonPin) &&
            !d.layerD_programMapping.matchesPhysicalPin &&
            d.layerC_controllerPinCompatibility.physicalBoardPins.length > 0
        )

        const candidateActualPin =
          mismatchedLed?.layerC_controllerPinCompatibility.physicalBoardPins[0] ??
          unreferencedLedPhysicalPins[0] ??
          unreferencedDigital[0]

        if ((!isWired && candidateActualPin) || mismatchedLed) {
          const actualPin = candidateActualPin ?? digitalWired[0]
          if (!actualPin) continue
          emittedCodePins.add(canonPin)
          const loadHint = mismatchedLed ? ` for ${mismatchedLed.ledId}` : ""
          faults.push({
            id: `fault_code_pin_mismatch_${canonPin}`,
            classification: "CODE_PIN_MISMATCH",
            title: `Code / Hardware Pin Mismatch: Pin ${canonPin.toUpperCase()}`,
            affectedPartId: boardPart.id,
            affectedPinId: canonPin,
            evidence: `Program outputs to pin ${canonPin.toUpperCase()}, but the actual wire${loadHint} is connected to pin ${actualPin.toUpperCase()}.`,
            electricalExplanation: `The microcontroller code drives ${canonPin.toUpperCase()}, while the physical circuit connects${loadHint} to ${actualPin.toUpperCase()}, so no matching control signal reaches the component.`,
            confidence: 0.95,
            suggestedRepair: `Move the physical wire on ${actualPin.toUpperCase()} to ${canonPin.toUpperCase()} so physical wiring matches the program output pin (${canonPin.toUpperCase()}).`,
            expectedOutcome: "Physical pin routing matches program control, executing intended behavior.",
          })
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

  const partMap = new Map<string, PlacedPart>(newParts.map((p) => [p.id, p]))
  const boardPart = newParts.find((p) => isBoardPart(p.type))
  const boardGndPinId = boardPart ? (getBoardForPart(boardPart)?.powerPins.gnd[0] ?? "gnd") : "gnd"
  const gndBoardId = boardPart ? boardPart.id : "uno"

  const pairKeyFor = (p1: string, pin1: string, p2: string, pin2: string): string => {
    const k1 = formatPinKey(p1, canonicalizePinForPart(partMap.get(p1), pin1))
    const k2 = formatPinKey(p2, canonicalizePinForPart(partMap.get(p2), pin2))
    return k1 < k2 ? `${k1}<->${k2}` : `${k2}<->${k1}`
  }

  const rebuildPairSet = (wiresList: Wire[]): Set<string> => {
    const s = new Set<string>()
    for (const w of wiresList) {
      s.add(pairKeyFor(w.from.partId, w.from.pinId, w.to.partId, w.to.pinId))
    }
    return s
  }

  let seenWirePairs = rebuildPairSet(newWires)
  let wireSeq = 0

  const isPinWiredNow = (partId: string, pinId: string): boolean => {
    const target = formatPinKey(partId, canonicalizePinForPart(partMap.get(partId), pinId))
    return newWires.some(
      (w) =>
        formatPinKey(w.from.partId, canonicalizePinForPart(partMap.get(w.from.partId), w.from.pinId)) === target ||
        formatPinKey(w.to.partId, canonicalizePinForPart(partMap.get(w.to.partId), w.to.pinId)) === target
    )
  }

  const pushConnectUnique = (
    fromPartId: string,
    fromPinId: string,
    toPartId: string,
    toPinId: string,
    color: string,
    idPrefix: string
  ): boolean => {
    if (!partMap.has(fromPartId) || !partMap.has(toPartId)) return false
    const cFromPin = canonicalizePinForPart(partMap.get(fromPartId), fromPinId)
    const cToPin = canonicalizePinForPart(partMap.get(toPartId), toPinId)
    if (fromPartId === toPartId && cFromPin === cToPin) return false
    const pk = pairKeyFor(fromPartId, cFromPin, toPartId, cToPin)
    if (seenWirePairs.has(pk)) return false

    seenWirePairs.add(pk)
    actions.push({
      type: "connect",
      from: `${fromPartId}:${cFromPin}`,
      to: `${toPartId}:${cToPin}`,
      color,
    })
    newWires.push({
      id: `${idPrefix}_${Date.now()}_${++wireSeq}`,
      from: { partId: fromPartId, pinId: cFromPin },
      to: { partId: toPartId, pinId: cToPin },
      color,
    })
    return true
  }

  const pushDisconnectWire = (targetWire: Wire): boolean => {
    const idx = newWires.findIndex((w) => w === targetWire || (Boolean(w.id) && w.id === targetWire.id))
    if (idx === -1) return false
    if (typeof targetWire.id === "string" && targetWire.id.trim().length > 0) {
      actions.push({ type: "disconnect", wireId: targetWire.id })
    }
    newWires = newWires.filter((_, i) => i !== idx)
    seenWirePairs = rebuildPairSet(newWires)
    return true
  }

  for (const fault of faults) {
    if (fault.classification === "OPEN_CIRCUIT") {
      if (fault.affectedPinId === "cathode") {
        if (!isPinWiredNow(fault.affectedPartId, "cathode")) {
          pushConnectUnique(fault.affectedPartId, "cathode", gndBoardId, boardGndPinId, "black", "w_repair")
        }
      } else if (fault.affectedPinId === "wiper") {
        if (!isPinWiredNow(fault.affectedPartId, "wiper")) {
          pushConnectUnique(fault.affectedPartId, "wiper", gndBoardId, "a0", "blue", "w_repair")
        }
      } else if (fault.affectedPinId === "sig") {
        if (!isPinWiredNow(fault.affectedPartId, "sig")) {
          pushConnectUnique(fault.affectedPartId, "sig", gndBoardId, "d9", "orange", "w_repair")
        }
      }
    } else if (fault.classification === "REVERSED_LED_POLARITY") {
      const anodeTarget = `${fault.affectedPartId}:anode`
      const cathodeTarget = `${fault.affectedPartId}:cathode`

      const anodeWire = newWires.find(
        (w) =>
          formatPinKey(w.from.partId, w.from.pinId) === anodeTarget ||
          formatPinKey(w.to.partId, w.to.pinId) === anodeTarget
      )
      const cathodeWire = newWires.find(
        (w) =>
          formatPinKey(w.from.partId, w.from.pinId) === cathodeTarget ||
          formatPinKey(w.to.partId, w.to.pinId) === cathodeTarget
      )

      if (anodeWire && cathodeWire && anodeWire !== cathodeWire) {
        const endpointA =
          formatPinKey(anodeWire.from.partId, anodeWire.from.pinId) === anodeTarget
            ? { ...anodeWire.to }
            : { ...anodeWire.from }
        const endpointC =
          formatPinKey(cathodeWire.from.partId, cathodeWire.from.pinId) === cathodeTarget
            ? { ...cathodeWire.to }
            : { ...cathodeWire.from }

        pushDisconnectWire(anodeWire)
        pushDisconnectWire(cathodeWire)
        pushConnectUnique(fault.affectedPartId, "anode", endpointC.partId, endpointC.pinId, "red", "w_swapped_a")
        pushConnectUnique(fault.affectedPartId, "cathode", endpointA.partId, endpointA.pinId, "black", "w_swapped_c")
      }
    } else if (fault.classification === "INCORRECT_RESISTOR_VALUE") {
      const resPart = newParts.find((p) => p.id === fault.affectedPartId)
      if (resPart && Number(resPart.props?.resistance ?? 0) !== 220) {
        actions.push({
          type: "change_prop",
          partId: resPart.id,
          propName: "resistance",
          propValue: 220,
        })
        resPart.props = { ...resPart.props, resistance: 220 }
      }
    } else if (fault.classification === "MISSING_GROUND") {
      // Only add a ground return wire if the mutated circuit still lacks a ground connection
      const ungroundedPart = newParts.find((p) => {
        if (isBoardPart(p.type) || p.type === "battery" || p.type === "breadboard") return false
        const def = CATALOG[p.type]
        const gndPins = def?.pins.filter((pin) => pin.kind === "ground" || pin.id === "cathode" || pin.id === "neg") ?? []
        return gndPins.some((gPin) => !isPinWiredNow(p.id, gPin.id))
      })

      if (ungroundedPart) {
        const def = CATALOG[ungroundedPart.type]
        const targetPin =
          def?.pins.find(
            (pin) => (pin.kind === "ground" || pin.id === "cathode" || pin.id === "neg") && !isPinWiredNow(ungroundedPart.id, pin.id)
          )?.id ?? "cathode"
        pushConnectUnique(ungroundedPart.id, targetPin, gndBoardId, boardGndPinId, "black", "w_gnd_repair")
      }
    } else if (fault.classification === "CODE_PIN_MISMATCH") {
      const wiredBoardPins = newWires
        .flatMap((w) => [
          w.from.partId === boardPart?.id
            ? { wire: w, pin: canonicalizePinForPart(boardPart, w.from.pinId), isFrom: true }
            : null,
          w.to.partId === boardPart?.id
            ? { wire: w, pin: canonicalizePinForPart(boardPart, w.to.pinId), isFrom: false }
            : null,
        ])
        .filter(Boolean) as { wire: Wire; pin: string; isFrom: boolean }[]

      const codePins = new Set(
        extractCodePinBindings(blocklyXml, undefined, boardPart?.type).map((b) => b.pinId)
      )
      const evPinMatch = fault.evidence.match(/connected to pin ([A-Z0-9_]+)/i)
      const preferredActualPin = evPinMatch?.[1]?.toLowerCase()
      const mismatchWire =
        (preferredActualPin ? wiredBoardPins.find((p) => p.pin === preferredActualPin) : undefined) ??
        wiredBoardPins.find((p) => /^(d\d+|gp\d+|gpio\d+|p\d+)$/i.test(p.pin) && !codePins.has(p.pin)) ??
        wiredBoardPins.find((p) => /^d\d+$/i.test(p.pin))
      if (mismatchWire && boardPart) {
        const remoteEnd = mismatchWire.isFrom ? { ...mismatchWire.wire.to } : { ...mismatchWire.wire.from }
        const remoteColor = mismatchWire.wire.color || "green"
        const targetBoardPin = canonicalizePinForPart(boardPart, fault.affectedPinId)
        if (mismatchWire.pin !== targetBoardPin) {
          pushDisconnectWire(mismatchWire.wire)
          pushConnectUnique(boardPart.id, targetBoardPin, remoteEnd.partId, remoteEnd.pinId, remoteColor, "w_align_pin")
        }
      }
    }
  }

  // Deduplicate final wires defensively while preserving canonical endpoints
  const dedupedWires: Wire[] = []
  const finalPairs = new Set<string>()
  for (const w of newWires) {
    const pk = pairKeyFor(w.from.partId, w.from.pinId, w.to.partId, w.to.pinId)
    if (!finalPairs.has(pk)) {
      finalPairs.add(pk)
      dedupedWires.push(w)
    }
  }
  newWires = dedupedWires

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
      : "No fault-backed repair was proposed."

  return {
    diagnosis: primaryDiagnosis,
    confidence: faults.length > 0 ? faults[0].confidence : 0,
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
  const beforeHealth = diagnoseCircuit(beforeCircuit, {}, pinStates, { blocklyXml })

  // 2. Solve After State
  const afterNodal = solveCircuitNodalPotentials(afterCircuit, new Set(), pinStates, true)
  const afterHealth = diagnoseCircuit(afterCircuit, {}, pinStates, { blocklyXml })
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
  const electricalChecksPassed = solverPassed && noShorts && validation.valid && afterHealth.score !== null

  const beforeScore = beforeHealth.score ?? 0
  const afterScore = afterHealth.score ?? 0
  const verified =
    electricalChecksPassed &&
    (beforeHealth.score === null
      ? afterHealth.score !== null
      : beforeHealth.criticalCount > 0
        ? afterHealth.criticalCount < beforeHealth.criticalCount && afterScore > beforeScore
        : afterScore >= beforeScore)

  const beforeLabel = beforeHealth.score !== null ? `${beforeHealth.score}/100` : "N/A"
  const afterLabel = afterHealth.score !== null ? `${afterHealth.score}/100` : "N/A"
  let deltaMsg = ""
  if (verified) {
    deltaMsg = `Simulated circuit passed the electrical checks. Health score changed from ${beforeLabel} to ${afterLabel}. Critical issues: 0.`
  } else {
    deltaMsg = `Simulation verification failed. Errors detected: ${afterHealth.issues.map((i) => i.title).join(", ")}`
  }

  return {
    verified,
    solverPassed,
    electricalChecksPassed,
    status: verified ? "VERIFIED_WORKING" : noShorts ? "FAILED_ELECTRICAL" : "HAZARD_DETECTED",
    beforeMetrics: {
      healthScore: beforeScore,
      criticalCount: beforeHealth.criticalCount,
      warningCount: beforeHealth.warningCount,
      activeCurrentsMa: beforeCurrents,
      componentStates: beforeStates,
    },
    afterMetrics: {
      healthScore: afterScore,
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

export type CopilotDiagnosticState =
  | "VERIFIED_WORKING" | "FAULT_DETECTED" | "EMPTY_CANVAS" | "INCOMPLETE_CIRCUIT"
  | "INSUFFICIENT_EVIDENCE" | "SIMULATOR_UNAVAILABLE" | "ANALYSIS_ERROR"

/** A pin label is resolved via the catalogue. Connectivity is taken only from completed wires and nets. */
export function describeCircuitTopology(query: string, context: CircuitDiagnosisContext) {
  if (!context.parts.length) return "The canvas is empty. Place the components before checking a pin."
  if (!context.endpointLookup) return "This snapshot does not contain enough topology to identify the connection."
  const text = query.toLowerCase()
  const matches = (value: string) => new RegExp(
    `(?:^|[^a-z0-9_-])${value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9_-])`,
  ).test(text)
  const endpoints = Object.values(context.endpointLookup)
  const exactParts = context.parts.filter(p => matches(p.id))
  const partTypes = context.parts.filter(p => matches(p.type) ||
    (p.type === "resistor" && /\bresist(?:or|er)\b/.test(text)) ||
    (p.type === "led" && /\b(?:anode|cathode)\b/.test(text)))
  const namedPin = text.match(/\b(?:[da]\d{1,2}|gpio\d+|gnd\d*)\b/)?.[0]
  const descriptive = [...exactParts, ...partTypes].filter(p => !isBoardPart(p.type))
  let target = exactParts.filter(p => !isBoardPart(p.type))
  if (!target.length) target = [...new Set(descriptive)]
  if (!target.length && namedPin) target = context.parts.filter(p => isBoardPart(p.type))
  if (!target.length) target = exactParts.length ? exactParts : partTypes
  if (target.length !== 1) {
    return target.length
      ? `Which component do you mean? The snapshot contains ${target.map(p => p.id).join(", ")}.`
      : "Which component or board pin should I inspect? Give its canvas ID or pin label."
  }
  const part = target[0]
  const terminal = isBoardPart(part.type) ? namedPin :
    text.match(/\b(?:anode|cathode)\b/)?.[0] || text.match(/\bterminal\s+([ab])\b/)?.[1]
  const chosen = endpoints.filter(e => e.partId === part.id &&
    (!terminal || e.pinId === canonicalizePinForPart(part, terminal)))
  if (!chosen.length) return "This snapshot does not establish that pin. Check the component and pin label."
  const label = (key: string) => {
    const { partId, pinId } = parsePinKey(key)
    const peer = context.parts.find(p => p.id === partId)
    const def = peer && (isBoardPart(peer.type) ? getBoardForPart(peer) : CATALOG[peer.type])
    const display = def?.pins.find(p => p.id.toLowerCase() === pinId)?.label
    return `${partId}:${display || (peer && isBoardPart(peer.type) ? pinId.toUpperCase() : pinId)}`
  }
  return chosen.map(e => {
    const direct = e.directWirePeers.map(label)
    const shared = e.sameNetEndpoints.filter(p => !e.directWirePeers.includes(p)).map(label)
    // Crossing a resistor is a branch path, never a direct wire or a same-net relation.
    const across = e.sameNetEndpoints.flatMap(peerKey => {
      const peer = context.endpointLookup?.[peerKey]
      if (!peer || peer.partType !== "resistor" || peer.partId === e.partId) return []
      const other = context.endpointLookup?.[formatPinKey(peer.partId, peer.pinId === "a" ? "b" : "a")]
      return other?.sameNetBoardPins
        .filter(pin => pin !== e.endpoint && !e.sameNetEndpoints.includes(pin))
        .map(pin => `${label(pin)} through ${peer.partId}`) ?? []
    })
    const observed = [
      direct.length ? `direct wire to ${direct.join(", ")}` : "",
      shared.length ? `same net (${e.netName || e.netId}): ${shared.join(", ")}` : "",
      across.length ? `branch path: ${[...new Set(across)].join(", ")}` : "",
    ].filter(Boolean)
    return `**${label(e.endpoint)}** — ${observed.join("; ") || "no completed connection shown"}.`
  }).join("\n\n")
}

export function processCircuitCopilotQuery(
  userQuery: string,
  circuitContext: CircuitDiagnosisContext
): {
  reply: string
  proposal?: StructuredRepairProposal
  verification?: SimulatorVerificationResult
  highlightPartIds: string[]
  state: CopilotDiagnosticState
} {
  const queryLower = userQuery.toLowerCase().trim()
  let faults: CircuitFault[]
  try {
    faults = diagnoseCircuitIntelligence(circuitContext)
  } catch {
    return { state: "ANALYSIS_ERROR", reply: "Circuit analysis could not complete. No working verdict or repair was produced.", highlightPartIds: [] }
  }
  const unsupported = circuitContext.parts.some(p => !CATALOG[p.type] && !getBoardForPart(p))
  const led = circuitContext.crossLayerLedDiagnostics ?? []
  const verified = !unsupported && Boolean(circuitContext.board) && led.length > 0 &&
    circuitContext.parts.every(p => isBoardPart(p.type) || ["led", "resistor", "breadboard"].includes(p.type)) &&
    circuitContext.healthReport.criticalCount === 0 && circuitContext.healthReport.warningCount === 0 &&
    led.every(d => d.layerA_electricalTopology.topologyOk && d.layerE_simulatorExecution.running &&
      !d.layerE_simulatorExecution.paused && d.layerF_observedOutput.state === "illuminated")
  const state: CopilotDiagnosticState = !circuitContext.parts.length ? "EMPTY_CANVAS"
    : faults.length ? "FAULT_DETECTED"
    : !circuitContext.wires.length ? "INCOMPLETE_CIRCUIT"
    : unsupported || !circuitContext.board ? "INSUFFICIENT_EVIDENCE"
    : circuitContext.simulationStatus !== "running" ? "SIMULATOR_UNAVAILABLE"
    : verified ? "VERIFIED_WORKING" : "INSUFFICIENT_EVIDENCE"
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

  const instrument = /\b(?:oscilloscope|scope|ch[12])\b/i.test(queryLower) ? "oscilloscope"
    : /\b(?:multimeter|dmm|probe|reading)\b/i.test(queryLower) ? "multimeter" : null
  if (instrument && circuitContext.parts.length) {
    const readings = circuitContext.measurements.filter(m => m.instrument === instrument)
    const reply = readings.map(reading => {
      const probes = [reading.probeA, reading.probeB].filter(Boolean).join(" → ")
      const label = `${reading.instrument} ${reading.mode}${probes ? ` (${probes})` : ""}`
      if (reading.state === "available" && reading.value !== undefined) {
        return `**${label}:** ${reading.value} ${reading.unit} (${isHinglish ? "simulator se calculated" : "simulator-computed"}).`
      }
      return `**${label}:** ${reading.state.replace("_", " ")}. ${reading.notes || "No reading is available."}`
    }).join("\n\n")
    return { state, reply: reply || "No instrument reading is configured.", highlightPartIds: [] }
  }

  const highlightPartIds = faults.map((f) => f.affectedPartId)

  // Generate repair proposal if faults exist
  let proposal: StructuredRepairProposal | undefined
  let verification: SimulatorVerificationResult | undefined

  if (faults.length > 0 && !unsupported && circuitContext.parts.length > 0) {
    const candidate = generateCircuitRepairProposal(
      { parts: circuitContext.parts, wires: circuitContext.wires },
      faults,
      currentHash,
      circuitContext.code.rawXml
    )
    verification = verifyCircuitWithSimulator(
      { parts: circuitContext.parts, wires: circuitContext.wires },
      candidate.repairedCircuit,
      {},
      candidate.repairedBlocklyXml
    )
    if (candidate.actions.length && verification.verified) proposal = candidate
  }

  // Construct deterministic offline local circuit guidance (never mislabeled as Xen output)
  let reply = ""
  if (circuitContext.parts.length === 0) {
    if (isHinglish) {
      reply = `**Local Circuit Guidance (Deterministic Check):** Abhi canvas **Empty** hai (0 components aur 0 wires). Koi electrical health score abhi available nahi hai (N/A). Kripya pehle components (jaise Arduino Uno, Resistor, LED) canvas par rakhein aur connect karein.`
    } else {
      reply = `**Local Circuit Guidance (Deterministic Check):** The CyberLab canvas is currently **Empty** (0 components placed and 0 wires connected). Health score is N/A until components are placed and wired.`
    }
  } else if (circuitContext.wires.length === 0 && faults.length === 0) {
    const names = circuitContext.parts.map((p) => `${p.id} (${p.type})`).join(", ")
    if (isHinglish) {
      reply = `**Local Circuit Guidance (Deterministic Check):** Canvas **Not Wired** hai — ${circuitContext.parts.length} component(s) rakhe hain (${names}), lekin abhi tak 0 completed wire connections hain. Health score abhi N/A hai — pehle pins connect karein.`
    } else {
      reply = `**Local Circuit Guidance (Deterministic Check):** Circuit status is **Not Wired** — ${circuitContext.parts.length} component(s) placed (${names}), with 0 completed wire connections so far. Health score is N/A until pins are connected.`
    }
  } else if (faults.length === 0) {
    if (state === "VERIFIED_WORKING") {
      reply = isHinglish
        ? "Simulator snapshot mein LED output on dikh raha hai aur static checks pass hain. Yeh blink timing verify nahi karta."
        : "The running simulator shows the LED output on, and static checks passed. This snapshot does not verify blink timing."
    } else if (state === "SIMULATOR_UNAVAILABLE") {
      reply = isHinglish
        ? "Static checks mein koi fault nahi mila. Simulation chalu nahi hai, isliye circuit working confirm nahi hua."
        : "Static checks found no specific fault. Simulation is not running yet. Start it and inspect the output to verify operation."
    } else {
      reply = isHinglish ? "Snapshot se circuit working confirm nahi hua. Board, wiring aur simulator output check karein."
        : "This snapshot does not verify operation. Confirm the board, completed wiring and observed simulator output."
    }
  } else {
    const f = faults[0]
    const unwiredPrefixEn = circuitContext.wires.length === 0 ? "Circuit status: **Not Wired** (0 completed wires; Health score: N/A).\n\n" : ""
    const unwiredPrefixHi = circuitContext.wires.length === 0 ? "Circuit status: **Not Wired** (0 completed wires; Health score: N/A).\n\n" : ""
    if (isHinglish) {
      reply = `**Local Circuit Guidance (Deterministic Check) — Report:**\n\n` +
        unwiredPrefixHi +
        `🔍 **Samasya (Fault):** ${f.title}\n` +
        `⚡ **Evidence:** ${f.affectedPartId}:${f.affectedPinId} — ${f.evidence}\n` +
        `💡 **Electrical Reason:** ${f.electricalExplanation}\n\n` +
        `🛠️ **Proposed Repair:** ${f.suggestedRepair}\n` +
        `✅ **Expected Result:** ${f.expectedOutcome}\n\n` +
        (proposal ? "Solver-verified repair preview ko review karke **Apply Fix** dabayein." : "Koi solver-verified repair preview available nahi hai.")
    } else {
      reply = `**Local Circuit Guidance (Deterministic Check) — Report:**\n\n` +
        unwiredPrefixEn +
        `🔍 **Fault Identified:** ${f.title}\n` +
        `⚡ **Observed circuit evidence:** ${f.affectedPartId}:${f.affectedPinId} — ${f.evidence}\n` +
        `💡 **Electrical Root Cause:** ${f.electricalExplanation}\n\n` +
        `🛠️ **Recommended Fix:** ${f.suggestedRepair}\n` +
        `✅ **Expected Outcome:** ${f.expectedOutcome}\n\n` +
        (proposal ? "Review the solver-verified proposal below, then use **Apply Fix** to apply it." : "No solver-verified repair preview is available for this fault.")
    }
  }

  return { reply, state, proposal, verification, highlightPartIds }
}
