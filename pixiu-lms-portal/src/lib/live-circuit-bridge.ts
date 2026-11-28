import type { CircuitState, PartType, PinRef, PlacedPart } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { CATALOG, ELECTRICAL_MODEL_CONTRACT } from "./components-catalog"
import { getBoardDefinition, getBoardForPart, isBoardPart } from "./board-registry"
import { computeCircuitHash, resolveCanonicalPin, validateCandidateWire } from "./circuit-validator"
import {
  analyzeCrossLayerLedDiagnostics,
  buildEndpointNetLookup,
  type CircuitDiagnosisContext,
} from "./circuit-intelligence"
import {
  LIVE_CIRCUIT_SCHEMA_VERSION,
  type CanonicalCircuitContextV3,
  type InProgressConnectionState,
  type LiveCandidateValidationSummary,
  type LiveInteractionEventType,
  type LiveLifecycleEvent,
  type LiveMultimeterTelemetry,
  type LiveOscilloscopeTelemetry,
  type RecentTargetPin,
} from "./live-circuit-types"

const ALLOWED_SAFE_PROP_KEYS = new Set([
  "resistance",
  "color",
  "unit",
  "value",
  "capacitance",
  "voltage",
  "label",
  "frequency",
  "threshold",
])

const SECRET_KEY_RE = /(?:token|secret|password|authorization|api[_-]?key|cookie|credential)/i

const SEMANTIC_SYNC_EVENTS = new Set<LiveInteractionEventType>([
  "wire_start",
  "target_hover_enter",
  "target_hover_leave",
  "target_validation",
  "wire_complete",
  "wire_cancel",
  "wire_delete",
  "connection_replace",
  "session_reset",
  "circuit_snapshot",
])

function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {}
  if (!props || typeof props !== "object") return safe
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED_SAFE_PROP_KEYS.has(k)) continue
    if (typeof v === "string") {
      safe[k] = v.slice(0, 80)
    } else if (typeof v === "number" && Number.isFinite(v)) {
      safe[k] = v
    } else if (typeof v === "boolean") {
      safe[k] = v
    }
  }
  return safe
}

function summarizePartRuntime(part: PlacedPart, rt?: PartRuntime): string | undefined {
  if (!rt) return undefined
  if (part.type === "led") {
    if (rt.burnt) return "BURNT_OVERCURRENT"
    const ma = Number(rt.currentMa ?? 0)
    return Number(rt.level ?? 0) > 0.05 ? `ILLUMINATED (${ma.toFixed(1)}mA)` : `OFF (${ma.toFixed(1)}mA)`
  }
  if (part.type === "buzzer") return Number(rt.level ?? 0) > 0 ? "SOUNDING" : "SILENT"
  if (part.type === "dc-motor" || part.type === "servo") {
    return typeof rt.angle === "number" ? `ANGLE_${rt.angle}DEG` : Number(rt.level ?? 0) > 0 ? "ACTIVE" : "IDLE"
  }
  if (rt.burnt) return "BURNT"
  if (typeof rt.currentMa === "number" && rt.currentMa > 0) return `ACTIVE (${rt.currentMa.toFixed(1)}mA)`
  return undefined
}

function formatPinRefString(ref: PinRef | null | undefined, partsById: Map<string, PlacedPart>): string | null {
  if (!ref) return null
  const p = partsById.get(ref.partId)
  const canon = p ? resolveCanonicalPin(p.type, ref.pinId) : ref.pinId.trim().toLowerCase()
  return `${ref.partId}:${canon}`
}

export interface BuildCanonicalContextInput {
  circuit: CircuitState
  circuitContext: CircuitDiagnosisContext
  sessionId: string
  circuitRevision: number
  interactionRevision: number
  eventSeq?: number
  eventId?: string
  capturedAt?: string
  activeBoard?: string | null
  blocklyXml?: string
  generatedCode?: string
  activeStepLabel?: string | null
  running?: boolean
  isPaused?: boolean
  runTime?: number
  pressedPartIds?: string[]
  serialLines?: string[]
  runtime?: Record<string, PartRuntime>
  pinStates?: Record<string, ArduinoPinState>
  wiring?: PinRef | null
  activeWireColor?: string
  draftMeta?: { draftId: string; startedAt: string; updatedAt: string } | null
  cursor?: { x: number; y: number } | null
  hoverPin?: PinRef | null
  recentTarget?: RecentTargetPin | null
  hoveredPartId?: string | null
  selectedId?: string | null
  selectedWireId?: string | null
  meter?: { red: PinRef | null; black: PinRef | null; mode?: string }
  meterTelemetry?: LiveMultimeterTelemetry | null
  scope?: { ch1: PinRef | null; ch2: PinRef | null }
  scopeTelemetry?: LiveOscilloscopeTelemetry | null
  lastEvent?: LiveLifecycleEvent | null
}

/**
 * Assemble a canonical, bounded, referentially coherent v3.0 circuit context snapshot.
 * Strictly separates completed connections from active draft wiring and guarantees
 * empty/unwired canvases never masquerade as healthy or default to an unplaced board.
 */
export function buildCanonicalCircuitContextV3(input: BuildCanonicalContextInput): CanonicalCircuitContextV3 {
  const {
    circuit,
    circuitContext,
    sessionId,
    circuitRevision,
    interactionRevision,
    eventSeq = 0,
    eventId = `${sessionId}-snap-${circuitRevision}-${interactionRevision}`,
    capturedAt = new Date().toISOString(),
    activeBoard,
    blocklyXml,
    generatedCode,
    activeStepLabel = null,
    running = false,
    isPaused = false,
    runTime = 0,
    pressedPartIds = [],
    serialLines = [],
    runtime = {},
    pinStates = {},
    wiring = null,
    activeWireColor = "#22c55e",
    draftMeta = null,
    cursor = null,
    hoverPin = null,
    recentTarget = null,
    hoveredPartId = null,
    selectedId = null,
    selectedWireId = null,
    meter,
    meterTelemetry = null,
    scope,
    scopeTelemetry = null,
    lastEvent = null,
  } = input

  const partsSlice = circuit.parts.slice(0, 32)
  const partsById = new Map<string, PlacedPart>(partsSlice.map((p) => [p.id, p]))
  const pressedSet = new Set(pressedPartIds)
  const nodal = circuitContext.nodalSolution

  // Board: ONLY populated when a real microcontroller board part is placed on the canvas
  const placedBoardPart =
    (activeBoard ? partsSlice.find((p) => p.type === activeBoard && isBoardPart(p.type)) : undefined) ??
    partsSlice.find((p) => isBoardPart(p.type))
  const boardDef = placedBoardPart
    ? getBoardForPart(placedBoardPart) ?? getBoardDefinition(placedBoardPart.type)
    : undefined

  const board = placedBoardPart && boardDef
    ? {
        id: boardDef.id,
        part_id: placedBoardPart.id,
        name: boardDef.name,
        architecture: boardDef.architecture,
        logic_voltage: boardDef.logicVoltage,
        adc_resolution_bits: boardDef.adcResolutionBits,
        capabilities: { ...boardDef.capabilities },
      }
    : null

  // Components
  const components = partsSlice.map((part) => {
    const cat = CATALOG[part.type as PartType]
    return {
      id: part.id,
      type: part.type,
      name: cat?.name || part.type,
      category: cat?.category || "component",
      x: Math.round(Number(part.x) || 0),
      y: Math.round(Number(part.y) || 0),
      rotation: Math.round(Number(part.rotation) || 0) % 360,
      props: sanitizeProps(part.props),
      state_summary: summarizePartRuntime(part, runtime[part.id]),
    }
  })

  // Deduplicated catalogue metadata per unique placed component type
  const component_catalogue_metadata: CanonicalCircuitContextV3["component_catalogue_metadata"] = {}
  for (const part of partsSlice) {
    if (component_catalogue_metadata[part.type]) continue
    const cat = CATALOG[part.type as PartType]
    const bDef = isBoardPart(part.type) ? getBoardDefinition(part.type) : undefined
    const contract = ELECTRICAL_MODEL_CONTRACT[part.type as PartType]
    const pinList = bDef ? bDef.pins : cat?.pins || []
    component_catalogue_metadata[part.type] = {
      type: part.type,
      name: cat?.name || part.type,
      category: cat?.category || "component",
      electrical_contract: contract ? { fidelity: contract.fidelity, note: contract.note } : undefined,
      pin_count: pinList.length,
      pins:
        part.type === "breadboard"
          ? pinList.slice(0, 8).map((p) => ({ id: p.id, label: p.label, kind: p.kind }))
          : pinList.slice(0, 40).map((p) => ({ id: p.id, label: p.label, kind: p.kind })),
    }
  }

  // Completed connections (ONLY existing component endpoints, never draft wires)
  const pinToNet = new Map<string, { id: number; name: string }>()
  for (const net of circuitContext.nets) {
    for (const pk of net.pinKeys) {
      pinToNet.set(pk.toLowerCase(), { id: net.id, name: net.name })
    }
  }

  const wiredPinSet = new Set<string>()
  const connections: CanonicalCircuitContextV3["connections"] = []
  for (let i = 0; i < circuit.wires.length && connections.length < 48; i++) {
    const w = circuit.wires[i]
    const fPart = partsById.get(w.from.partId)
    const tPart = partsById.get(w.to.partId)
    if (!fPart || !tPart) continue
    const fPin = resolveCanonicalPin(fPart.type, w.from.pinId)
    const tPin = resolveCanonicalPin(tPart.type, w.to.pinId)
    const fromKey = `${w.from.partId}:${fPin}`
    const toKey = `${w.to.partId}:${tPin}`
    wiredPinSet.add(fromKey.toLowerCase())
    wiredPinSet.add(toKey.toLowerCase())
    const matchedNet = pinToNet.get(fromKey.toLowerCase()) ?? pinToNet.get(toKey.toLowerCase())
    connections.push({
      id: w.id || `wire_${i}`,
      from_part_id: w.from.partId,
      from_pin_id: fPin,
      to_part_id: w.to.partId,
      to_pin_id: tPin,
      from: fromKey,
      to: toKey,
      color: w.color || "#22c55e",
      net_id: matchedNet?.id,
      net_name: matchedNet?.name,
      status: "complete",
    })
  }

  // Active pins list (prioritize wired/draft/hovered pins first so critical endpoints are never dropped)
  const activePriorityKeys = new Set<string>(wiredPinSet)
  if (wiring && partsById.has(wiring.partId)) {
    const wp = partsById.get(wiring.partId)!
    activePriorityKeys.add(`${wp.id}:${resolveCanonicalPin(wp.type, wiring.pinId)}`.toLowerCase())
  }
  if (hoverPin && partsById.has(hoverPin.partId)) {
    const hp = partsById.get(hoverPin.partId)!
    activePriorityKeys.add(`${hp.id}:${resolveCanonicalPin(hp.type, hoverPin.pinId)}`.toLowerCase())
  }
  if (recentTarget && partsById.has(recentTarget.partId)) {
    const rp = partsById.get(recentTarget.partId)!
    activePriorityKeys.add(`${rp.id}:${resolveCanonicalPin(rp.type, recentTarget.pinId)}`.toLowerCase())
  }

  const allPinEntries: CanonicalCircuitContextV3["pins"] = []
  const seenPinIds = new Set<string>()
  for (const part of partsSlice) {
    const cat = CATALOG[part.type as PartType]
    const bDef = isBoardPart(part.type) ? getBoardDefinition(part.type) : undefined
    const candidatePins = bDef ? bDef.pins : cat?.pins || []
    for (const pDef of candidatePins) {
      const id = `${part.id}:${pDef.id}`
      const idLower = id.toLowerCase()
      const wired = wiredPinSet.has(idLower)
      if (part.type === "breadboard" && !wired && !activePriorityKeys.has(idLower)) continue
      if (seenPinIds.has(idLower)) continue
      seenPinIds.add(idLower)
      const pInfo = nodal?.getPinInfo({ partId: part.id, pinId: pDef.id })
      const caps = "capabilities" in pDef ? (pDef as { capabilities?: Record<string, unknown> }).capabilities : undefined
      allPinEntries.push({
        id,
        part_id: part.id,
        pin_id: pDef.id,
        label: pDef.label,
        kind: pDef.kind,
        capabilities: caps,
        net_id: pInfo && pInfo.netId >= 0 ? pInfo.netId : undefined,
        voltage: pInfo && !pInfo.isFloating && !pInfo.isConflicted ? pInfo.voltage : undefined,
        is_driven: pInfo?.isDriven,
        is_gnd: pInfo?.isGnd,
        is_floating: pInfo?.isFloating,
        is_conflicted: pInfo?.isConflicted,
        wired,
      })
    }
  }
  // Ensure wired/active pins come first within a 96-pin ceiling
  allPinEntries.sort((a, b) => {
    const pa = activePriorityKeys.has(a.id.toLowerCase()) ? 0 : 1
    const pb = activePriorityKeys.has(b.id.toLowerCase()) ? 0 : 1
    return pa - pb
  })
  const pins = allPinEntries.slice(0, 96)

  // Hovered component, hovered pin (currently_hovered: true), and recent target (currently_hovered: false)
  const hoveredPart = hoveredPartId ? partsById.get(hoveredPartId) : undefined
  const hovered_component = hoveredPart
    ? {
        id: hoveredPart.id,
        type: hoveredPart.type,
        name: CATALOG[hoveredPart.type as PartType]?.name || hoveredPart.type,
      }
    : null

  const hoverPart = hoverPin ? partsById.get(hoverPin.partId) : undefined
  const hovered_pin: CanonicalCircuitContextV3["hovered_pin"] =
    hoverPin && hoverPart
      ? (() => {
          const canon = resolveCanonicalPin(hoverPart.type, hoverPin.pinId)
          const pDef = (CATALOG[hoverPart.type as PartType]?.pins || []).find((p) => p.id === canon)
          const pInfo = nodal?.getPinInfo({ partId: hoverPart.id, pinId: canon })
          return {
            part_id: hoverPart.id,
            pin_id: hoverPin.pinId,
            canonical_pin_id: canon,
            label: pDef?.label || hoverPin.pinId,
            kind: pDef?.kind || "terminal",
            net_id: pInfo && pInfo.netId >= 0 ? pInfo.netId : undefined,
            voltage: pInfo && !pInfo.isFloating && !pInfo.isConflicted ? pInfo.voltage : undefined,
            currently_hovered: true,
          }
        })()
      : null

  const recentPart = recentTarget && !hovered_pin ? partsById.get(recentTarget.partId) : undefined
  const recent_target_pin: CanonicalCircuitContextV3["recent_target_pin"] =
    recentTarget && recentPart && !hovered_pin
      ? {
          part_id: recentPart.id,
          pin_id: recentTarget.pinId,
          canonical_pin_id: resolveCanonicalPin(recentPart.type, recentTarget.pinId),
          currently_hovered: false,
          left_at: recentTarget.leftAt,
        }
      : null

  // In-progress draft wire construction (strictly null if no active draft or source part missing)
  let in_progress_connection: InProgressConnectionState | null = null
  const draftSourcePart = wiring ? partsById.get(wiring.partId) : undefined
  if (wiring && draftSourcePart) {
    const sourceCanon = resolveCanonicalPin(draftSourcePart.type, wiring.pinId)
    const activeTargetRef: PinRef | null = hovered_pin
      ? { partId: hovered_pin.part_id, pinId: hovered_pin.pin_id }
      : recent_target_pin
      ? { partId: recent_target_pin.part_id, pinId: recent_target_pin.pin_id }
      : null

    let validationSummary: LiveCandidateValidationSummary | null = null
    let draftStatus: InProgressConnectionState["status"] = "draft"

    if (activeTargetRef) {
      const val = validateCandidateWire(circuit, wiring, activeTargetRef, {
        pressed: pressedSet,
        pinStates,
        running,
        nodalSolution: nodal,
      })
      validationSummary = {
        placement_allowed: val.placementAllowed,
        compatibility_status: val.compatibilityStatus,
        is_same_pin: val.isSamePin,
        is_duplicate_wire: val.isDuplicateWire,
        is_already_same_net: val.isAlreadySameNet,
        reasons: val.reasons.slice(0, 4).map((r) => ({
          rule_id: r.ruleId,
          severity: r.severity,
          title: r.title,
          message: r.message.slice(0, 200),
          suggestion: r.suggestion.slice(0, 160),
        })),
      }
      draftStatus = !val.placementAllowed
        ? "invalid"
        : val.compatibilityStatus === "compatible"
        ? "valid"
        : "warning"
    }

    in_progress_connection = {
      draft_id: draftMeta?.draftId || `draft-${sessionId}-${circuitRevision}-${interactionRevision}`,
      status: draftStatus,
      source_part_id: wiring.partId,
      source_pin_id: wiring.pinId,
      source_pin_canonical: sourceCanon,
      color: activeWireColor || "#22c55e",
      started_at: draftMeta?.startedAt || capturedAt,
      updated_at: draftMeta?.updatedAt || capturedAt,
      cursor: cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)
        ? { x: Math.round(cursor.x), y: Math.round(cursor.y) }
        : null,
      candidate_target: hovered_pin
        ? {
            part_id: hovered_pin.part_id,
            pin_id: hovered_pin.pin_id,
            canonical_pin_id: hovered_pin.canonical_pin_id,
            currently_hovered: true,
          }
        : null,
      recent_target: recent_target_pin
        ? {
            part_id: recent_target_pin.part_id,
            pin_id: recent_target_pin.pin_id,
            canonical_pin_id: recent_target_pin.canonical_pin_id,
            currently_hovered: false,
            left_at: recent_target_pin.left_at,
          }
        : null,
      validation: validationSummary,
    }
  }

  // Selection
  const selPart = selectedId ? partsById.get(selectedId) : undefined
  const selected_component = selPart
    ? {
        id: selPart.id,
        type: selPart.type,
        name: CATALOG[selPart.type as PartType]?.name || selPart.type,
        props: sanitizeProps(selPart.props),
      }
    : null

  const selWire = selectedWireId ? circuit.wires.find((w) => w.id === selectedWireId) : undefined
  const selected_wire = selWire
    ? {
        id: selWire.id,
        from: `${selWire.from.partId}:${selWire.from.pinId}`,
        to: `${selWire.to.partId}:${selWire.to.pinId}`,
        color: selWire.color || "#22c55e",
        net_id: pinToNet.get(`${selWire.from.partId}:${selWire.from.pinId}`.toLowerCase())?.id,
      }
    : null

  // Netlist
  const netlist: CanonicalCircuitContextV3["netlist"] = (nodal?.nets || []).slice(0, 24).map((n) => ({
    net_id: n.netId,
    name: n.name,
    is_power_rail: n.isPowerRail,
    is_ground_rail: n.isGroundRail,
    is_floating: n.isFloating,
    is_conflicted: n.isConflicted,
    nominal_voltage: n.nominalVoltage,
    solved_voltage: n.solvedVoltage,
    pin_keys: n.pinKeys.slice(0, 16),
  }))

  // Bounded pin states (cap at 32 meaningful pins)
  const pin_states: CanonicalCircuitContextV3["pin_states"] = {}
  let pinStateCount = 0
  for (const [k, v] of Object.entries(pinStates)) {
    if (pinStateCount >= 32) break
    if (v?.state === "HIGH" || v?.outputMode || (typeof v?.value === "number" && v.value > 0)) {
      pin_states[k] = {
        state: v.state,
        output_mode: v.outputMode,
        value: v.value,
        angle: v.angle,
        tone_hz: v.toneHz,
      }
      pinStateCount += 1
    }
  }

  // Meter & Scope
  const dmmMeasure = circuitContext.measurements.find((m) => m.instrument === "multimeter")
  const meterOut: CanonicalCircuitContextV3["meter"] = {
    is_open: meterTelemetry?.isOpen ?? Boolean(meter?.red || meter?.black),
    mode: meterTelemetry?.mode ?? meter?.mode ?? (dmmMeasure?.mode || "off"),
    red_probe: formatPinRefString(meter?.red, partsById),
    black_probe: formatPinRefString(meter?.black, partsById),
    value: dmmMeasure?.state === "available" ? dmmMeasure.value ?? null : null,
    state: dmmMeasure?.state ?? "not_configured",
    source: dmmMeasure?.state === "available" ? "simulated" : "unknown",
    unit: meterTelemetry?.unit || dmmMeasure?.unit || "V",
    explanation: (meterTelemetry?.explanation || dmmMeasure?.notes || "").slice(0, 180) || undefined,
    is_continuity_beep: meterTelemetry?.isContinuityBeep,
  }

  const scopeOut: CanonicalCircuitContextV3["scope"] = {
    is_open: scopeTelemetry?.isOpen ?? Boolean(scope?.ch1 || scope?.ch2),
    is_hold: scopeTelemetry?.isHold ?? false,
    timebase_label: scopeTelemetry?.timebaseLabel ?? "250ms",
    window_ms: scopeTelemetry?.windowMs ?? 2500,
    ch1_probe: formatPinRefString(scope?.ch1, partsById),
    ch2_probe: formatPinRefString(scope?.ch2, partsById),
    ch1: scope?.ch1 && circuitContext.measurements.some(m => m.instrument === "oscilloscope" && m.mode === "CH1" && m.state === "available") ? scopeTelemetry?.ch1 ?? null : null,
    ch2: scope?.ch2 && circuitContext.measurements.some(m => m.instrument === "oscilloscope" && m.mode === "CH2" && m.state === "available") ? scopeTelemetry?.ch2 ?? null : null,
  }

  // Diagnostics & runtime status
  const hr = circuitContext.healthReport
  const diagnostics: CanonicalCircuitContextV3["diagnostics"] = {
    health_status: hr.status,
    health_score: hr.score,
    critical_count: hr.criticalCount,
    warning_count: hr.warningCount,
    tip_count: hr.tipCount,
    issues: hr.issues.slice(0, 12).map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      category: issue.category,
      title: issue.title.slice(0, 100),
      message: issue.message.slice(0, 220),
      suggestion: issue.suggestion.slice(0, 180),
      involved_part_ids: issue.involvedPartIds.slice(0, 8),
      involved_pin_ids: issue.involvedPinIds?.slice(0, 8),
    })),
    solver_diagnostics: (nodal?.diagnostics || []).slice(0, 8).map((d) => ({
      code: d.code,
      severity: d.severity,
      message: d.message.slice(0, 200),
      net_id: d.netId,
    })),
  }

  const hasProgram = Boolean(blocklyXml && blocklyXml.trim().length > 0 && blocklyXml.includes("<block"))
  const blockly_context: CanonicalCircuitContextV3["blockly_context"] = {
    has_program: hasProgram,
    xml: hasProgram && blocklyXml ? blocklyXml.slice(0, 4000) : undefined,
    code: generatedCode && generatedCode.trim() ? generatedCode.slice(0, 2000) : undefined,
    pin_bindings: (circuitContext.code.pinBindings || []).slice(0, 16).map((b) => ({
      pin_id: b.pinId,
      mode: b.configuredMode,
      snippet: b.codeSnippet.slice(0, 100),
    })),
    active_step_label: activeStepLabel,
  }

  let totalCurrentMa = 0
  const outputs: CanonicalCircuitContextV3["runtime_status"]["outputs"] = []
  for (const part of partsSlice) {
    const rt = runtime[part.id]
    if (!rt) continue
    if (typeof rt.currentMa === "number" && Number.isFinite(rt.currentMa) && rt.currentMa > 0) {
      totalCurrentMa += rt.currentMa
    }
    const stateLabel = summarizePartRuntime(part, rt)
    if (stateLabel) {
      outputs.push({
        part_id: part.id,
        type: part.type,
        state: stateLabel,
        current_ma: typeof rt.currentMa === "number" ? Number(rt.currentMa.toFixed(2)) : undefined,
        burnt: rt.burnt,
      })
    }
  }

  const simStatus: "running" | "paused" | "ready" = running ? (isPaused ? "paused" : "running") : "ready"
  const revHash = computeCircuitHash(circuit, blocklyXml)

  const resolvedLookup =
    circuitContext.endpointLookup && circuitContext.resistorTerminals
      ? {
          endpointLookup: circuitContext.endpointLookup,
          resistorTerminals: circuitContext.resistorTerminals,
        }
      : buildEndpointNetLookup(circuit, circuitContext.nodalSolution)

  const endpoint_net_lookup: NonNullable<CanonicalCircuitContextV3["endpoint_net_lookup"]> = {}
  const sortedLookupEntries = Object.entries(resolvedLookup.endpointLookup).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  for (const [epKey, ep] of sortedLookupEntries) {
    const partObj = partsById.get(ep.partId)
    const isBoard = Boolean(partObj && isBoardPart(partObj.type))
    // Always keep every connected pin (board or discrete) + all non-board component pins (including disconnected leads)
    if (!ep.isConnected && isBoard) continue
    endpoint_net_lookup[epKey] = {
      part_id: ep.partId,
      part_type: ep.partType,
      pin_id: ep.canonicalPinId,
      net_id: ep.netId,
      net_name: ep.netName,
      is_connected: ep.isConnected,
      is_power_rail: ep.isPowerRail,
      is_ground_rail: ep.isGroundRail,
      voltage_v: ep.voltageV,
      direct_peers: ep.directWirePeers.slice(0, 12),
      same_net_endpoints: ep.sameNetEndpoints.slice(0, 16),
      board_pins: ep.sameNetBoardPins.slice(0, 8),
    }
  }

  const resistor_terminals: NonNullable<CanonicalCircuitContextV3["resistor_terminals"]> =
    resolvedLookup.resistorTerminals.slice(0, 16).map((r) => ({
      part_id: r.partId,
      resistance_ohm: r.resistanceOhm,
      terminal_a: {
        pin_id: r.terminalA.pinId,
        net_id: r.terminalA.netId,
        net_name: r.terminalA.netName,
        is_connected: r.terminalA.isConnected,
        direct_peers: r.terminalA.directPeers.slice(0, 8),
        same_net_peers: r.terminalA.sameNetPeers.slice(0, 12),
        board_pins: r.terminalA.boardPins.slice(0, 6),
        voltage_v: r.terminalA.voltageV,
      },
      terminal_b: {
        pin_id: r.terminalB.pinId,
        net_id: r.terminalB.netId,
        net_name: r.terminalB.netName,
        is_connected: r.terminalB.isConnected,
        direct_peers: r.terminalB.directPeers.slice(0, 8),
        same_net_peers: r.terminalB.sameNetPeers.slice(0, 12),
        board_pins: r.terminalB.boardPins.slice(0, 6),
        voltage_v: r.terminalB.voltageV,
      },
      current_ma: r.currentMa,
      path_summary: r.pathSummary,
    }))

  const crossLayerRaw =
    circuitContext.crossLayerLedDiagnostics ??
    analyzeCrossLayerLedDiagnostics({
      circuit,
      endpointLookup: resolvedLookup.endpointLookup,
      codeBindings: circuitContext.code.pinBindings || [],
      boardPart,
      boardDef,
      nodal: circuitContext.nodalSolution,
      runtime,
      pinStates,
      running,
      isPaused,
      runTime,
    })

  const cross_layer_led: NonNullable<CanonicalCircuitContextV3["cross_layer_led"]> =
    crossLayerRaw.slice(0, 12).map((d) => ({
      led_id: d.ledId,
      topology_ok: d.layerA_electricalTopology.topologyOk,
      safety_ok: d.layerB_safetyConstraints.safetyOk,
      pin_compatibility_ok: d.layerC_controllerPinCompatibility.pinCompatibilityOk,
      matches_physical_pin: d.layerD_programMapping.matchesPhysicalPin,
      simulation_status: d.layerE_simulatorExecution.simulationStatus,
      observed_state: d.layerF_observedOutput.state,
      physical_pins: d.layerC_controllerPinCompatibility.physicalBoardPins,
      code_pins: d.layerD_programMapping.codePins,
      series_resistors: d.layerA_electricalTopology.seriesResistorIds,
      has_ground_return: d.layerA_electricalTopology.hasGroundReturn,
      reversed_polarity: d.layerA_electricalTopology.reversedPolarity,
      shorted: d.layerA_electricalTopology.shorted,
      mismatch_reason: d.layerD_programMapping.mismatchReason,
      current_ma: Number.isFinite(runtime[d.ledId]?.currentMa) ? d.layerF_observedOutput.currentMa : undefined,
      summary: d.summary,
    }))

  return {
    schema_version: LIVE_CIRCUIT_SCHEMA_VERSION,
    session_id: sessionId,
    circuit_revision: circuitRevision,
    interaction_revision: interactionRevision,
    state_revision: circuitRevision + interactionRevision,
    event_seq: eventSeq,
    event_id: eventId,
    captured_at: capturedAt,
    board,
    components,
    component_catalogue_metadata,
    pins,
    connections,
    in_progress_connection,
    selected_component,
    selected_wire,
    hovered_component,
    hovered_pin,
    recent_target_pin,
    netlist,
    simulation: {
      running,
      paused: isPaused,
      status: simStatus,
      run_time_s: Number(runTime.toFixed(1)),
      pressed_parts: pressedPartIds.slice(0, 16),
      active_board_id: board?.id ?? null,
      serial_tail: serialLines.slice(-6).map((s) => String(s).slice(0, 120)),
    },
    pin_states,
    meter: meterOut,
    scope: scopeOut,
    diagnostics,
    blockly_context,
    runtime_status: {
      circuit_rev_hash: revHash,
      component_count: circuit.parts.length,
      wire_count: circuit.wires.length,
      is_empty: circuit.parts.length === 0,
      total_current_ma: Number(totalCurrentMa.toFixed(2)),
      outputs: outputs.slice(0, 16),
    },
    endpoint_net_lookup,
    resistor_terminals,
    cross_layer_led,
    last_event: lastEvent,
  }
}

/**
 * Schema & referential integrity validator for CanonicalCircuitContextV3.
 * Enforces structural correctness, endpoint validity, strict draft/complete
 * separation, empty-canvas honesty, and zero secret/DOM leaks.
 */
export function validateCanonicalCircuitContextV3(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["Payload must be a plain object."] }
  }
  const p = payload as Record<string, unknown>

  if (p.schema_version !== LIVE_CIRCUIT_SCHEMA_VERSION) {
    errors.push(`Invalid schema_version: expected '${LIVE_CIRCUIT_SCHEMA_VERSION}', got '${String(p.schema_version)}'.`)
  }
  if (typeof p.session_id !== "string" || !p.session_id.trim()) {
    errors.push("Missing or invalid session_id.")
  }
  for (const revKey of ["circuit_revision", "interaction_revision", "event_seq"]) {
    const v = p[revKey]
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      errors.push(`Revision field '${revKey}' must be a non-negative integer.`)
    }
  }
  if (typeof p.captured_at !== "string" || Number.isNaN(Date.parse(p.captured_at))) {
    errors.push("captured_at must be a valid ISO timestamp.")
  }

  const components = Array.isArray(p.components) ? (p.components as Array<Record<string, unknown>>) : null
  if (!components) {
    errors.push("components must be an array.")
    return { valid: false, errors }
  }
  const componentIds = new Set<string>()
  for (const c of components) {
    if (!c || typeof c.id !== "string" || !c.id.trim()) {
      errors.push("Every component must have a valid string id.")
    } else if (componentIds.has(c.id)) {
      errors.push(`Duplicate component id '${c.id}'.`)
    } else {
      componentIds.add(c.id)
    }
  }

  if (p.board !== null && p.board !== undefined) {
    const b = p.board as Record<string, unknown>
    if (typeof b.part_id !== "string" || !componentIds.has(b.part_id)) {
      errors.push(`board.part_id '${String(b.part_id)}' must reference a placed component.`)
    }
  } else if (components.length === 0 && p.board !== null) {
    errors.push("board must be null on an empty canvas.")
  }

  const connections = Array.isArray(p.connections) ? (p.connections as Array<Record<string, unknown>>) : null
  if (!connections) {
    errors.push("connections must be an array.")
  } else {
    const wireIds = new Set<string>()
    for (const conn of connections) {
      if (conn.status !== "complete") {
        errors.push(`Completed connection '${String(conn.id)}' must have status === 'complete' (no draft wires allowed in connections).`)
      }
      if (typeof conn.id !== "string" || !conn.id.trim()) {
        errors.push("Connection missing string id.")
      } else if (wireIds.has(conn.id)) {
        errors.push(`Duplicate connection id '${conn.id}'.`)
      } else {
        wireIds.add(conn.id)
      }
      if (typeof conn.from_part_id !== "string" || !componentIds.has(conn.from_part_id)) {
        errors.push(`Connection '${String(conn.id)}' from_part_id '${String(conn.from_part_id)}' does not exist.`)
      }
      if (typeof conn.to_part_id !== "string" || !componentIds.has(conn.to_part_id)) {
        errors.push(`Connection '${String(conn.id)}' to_part_id '${String(conn.to_part_id)}' does not exist.`)
      }
    }
  }

  if (p.in_progress_connection !== null && p.in_progress_connection !== undefined) {
    const draft = p.in_progress_connection as Record<string, unknown>
    if (!["draft", "valid", "warning", "invalid"].includes(String(draft.status))) {
      errors.push(`Active in_progress_connection status '${String(draft.status)}' must be draft|valid|warning|invalid.`)
    }
    if (typeof draft.source_part_id !== "string" || !componentIds.has(draft.source_part_id)) {
      errors.push(`in_progress_connection source_part_id '${String(draft.source_part_id)}' does not exist.`)
    }
    const cand = draft.candidate_target as Record<string, unknown> | null | undefined
    const recent = draft.recent_target as Record<string, unknown> | null | undefined
    if (cand && cand !== null) {
      if (cand.currently_hovered !== true) errors.push("candidate_target.currently_hovered must be true.")
      if (typeof cand.part_id !== "string" || !componentIds.has(cand.part_id)) {
        errors.push(`candidate_target.part_id '${String(cand.part_id)}' does not exist.`)
      }
      if (recent) errors.push("candidate_target and recent_target must not both be populated simultaneously.")
    }
    if (recent && recent !== null) {
      if (recent.currently_hovered !== false) errors.push("recent_target.currently_hovered must be false.")
      if (typeof recent.part_id !== "string" || !componentIds.has(recent.part_id)) {
        errors.push(`recent_target.part_id '${String(recent.part_id)}' does not exist.`)
      }
    }
  }

  if (p.hovered_pin && typeof p.hovered_pin === "object") {
    const hp = p.hovered_pin as Record<string, unknown>
    if (hp.currently_hovered !== true) errors.push("hovered_pin.currently_hovered must be true.")
    if (typeof hp.part_id !== "string" || !componentIds.has(hp.part_id)) {
      errors.push("hovered_pin references missing component.")
    }
  }
  if (p.hovered_component && typeof p.hovered_component === "object") {
    const hc = p.hovered_component as Record<string, unknown>
    if (typeof hc.id !== "string" || !componentIds.has(hc.id)) {
      errors.push("hovered_component references missing component.")
    }
  }
  if (p.selected_component && typeof p.selected_component === "object") {
    const sc = p.selected_component as Record<string, unknown>
    if (typeof sc.id !== "string" || !componentIds.has(sc.id)) {
      errors.push("selected_component references missing component.")
    }
  }

  if (p.diagnostics && typeof p.diagnostics === "object") {
    const diag = p.diagnostics as Record<string, unknown>
    if (components.length === 0) {
      if (diag.health_status !== "empty" || diag.health_score !== null) {
        errors.push("Empty canvas must report health_status='empty' and health_score=null.")
      }
    }
    if (Number(diag.critical_count || 0) > 0 && diag.health_status === "healthy") {
      errors.push("Contradictory diagnostics: critical_count > 0 cannot have health_status='healthy'.")
    }
  } else {
    errors.push("diagnostics object is required.")
  }

  if (Array.isArray(p.resistor_terminals)) {
    for (const rt of p.resistor_terminals as Array<Record<string, unknown>>) {
      if (typeof rt?.part_id !== "string" || !componentIds.has(rt.part_id)) {
        errors.push(`resistor_terminals references missing component '${String(rt?.part_id)}'.`)
      }
    }
  }
  if (Array.isArray(p.cross_layer_led)) {
    for (const cl of p.cross_layer_led as Array<Record<string, unknown>>) {
      if (typeof cl?.led_id !== "string" || !componentIds.has(cl.led_id)) {
        errors.push(`cross_layer_led references missing LED component '${String(cl?.led_id)}'.`)
      }
    }
  }

  // Secret / DOM / sensitive key scan
  const scanKeys = (node: unknown, depth = 0): void => {
    if (depth > 8 || !node || typeof node !== "object") return
    if (typeof (node as { nodeType?: unknown }).nodeType === "number") {
      errors.push("DOM nodes must never be serialized into circuit context.")
      return
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        errors.push(`Forbidden credential-like key '${k}' found in circuit context.`)
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) scanKeys(v[i], depth + 1)
      } else if (v && typeof v === "object") {
        scanKeys(v, depth + 1)
      }
    }
  }
  scanKeys(p)

  return { valid: errors.length === 0, errors }
}

export type SyncTransportFn = (payload: {
  sessionId: string
  eventType: LiveInteractionEventType
  eventId: string
  eventSeq: number
  circuitRevision: number
  interactionRevision: number
  contextEnvelope: CanonicalCircuitContextV3
  signal?: AbortSignal
}) => Promise<{ success: boolean; stale?: boolean; error?: unknown }>

/**
 * Live Circuit Context Bridge:
 * - Filters noise and transmits semantic lifecycle transitions without raw pointer spam.
 * - Coalesces rapid hover enter/leave transitions within 80ms while preserving start/complete/cancel/delete/reset immediately.
 * - Tracks sync watermarks per session_id so failed syncs force fresh full-snapshot reconciliation.
 */
export class LiveCircuitContextBridge {
  private syncFn: SyncTransportFn
  private coalesceMs: number
  private hoverTimer: ReturnType<typeof setTimeout> | null = null
  private lastSynced = {
    sessionId: "",
    circuitRevision: -1,
    interactionRevision: -1,
    eventSeq: -1,
  }
  private needsResync = false
  private sentEventIds = new Set<string>()
  private pendingAbort: AbortController | null = null

  constructor(syncFn: SyncTransportFn, options: { coalesceMs?: number } = {}) {
    this.syncFn = syncFn
    this.coalesceMs = options.coalesceMs ?? 80
  }

  shouldTransmitEvent(eventType: LiveInteractionEventType): boolean {
    return SEMANTIC_SYNC_EVENTS.has(eventType)
  }

  getSyncMetadata() {
    return {
      ...this.lastSynced,
      needsResync: this.needsResync,
    }
  }

  private async dispatchNow(event: LiveLifecycleEvent, snapshot: CanonicalCircuitContextV3): Promise<boolean> {
    if (this.sentEventIds.has(event.event_id)) return true
    const effectiveEventType: LiveInteractionEventType =
      this.needsResync && event.event_type !== "session_reset" ? "circuit_snapshot" : event.event_type

    // Keep idempotency bounded
    if (this.sentEventIds.size > 200) {
      this.sentEventIds.clear()
    }
    this.sentEventIds.add(event.event_id)

    this.pendingAbort?.abort()
    const controller = new AbortController()
    this.pendingAbort = controller

    try {
      const res = await this.syncFn({
        sessionId: event.session_id,
        eventType: effectiveEventType,
        eventId: event.event_id,
        eventSeq: event.event_seq,
        circuitRevision: event.circuit_revision,
        interactionRevision: event.interaction_revision,
        contextEnvelope: snapshot,
        signal: controller.signal,
      })
      if (res?.success) {
        this.needsResync = false
        if (
          event.session_id !== this.lastSynced.sessionId ||
          event.circuit_revision > this.lastSynced.circuitRevision ||
          (event.circuit_revision === this.lastSynced.circuitRevision &&
            event.interaction_revision >= this.lastSynced.interactionRevision)
        ) {
          this.lastSynced = {
            sessionId: event.session_id,
            circuitRevision: event.circuit_revision,
            interactionRevision: event.interaction_revision,
            eventSeq: event.event_seq,
          }
        }
        return true
      }
      this.needsResync = true
      return false
    } catch {
      this.needsResync = true
      return false
    }
  }

  enqueueLifecycleEvent(event: LiveLifecycleEvent, snapshot: CanonicalCircuitContextV3): void {
    if (!this.shouldTransmitEvent(event.event_type)) return

    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }

    const isHoverTransition =
      event.event_type === "target_hover_enter" || event.event_type === "target_hover_leave"

    if (event.event_type === "session_reset") {
      this.sentEventIds.clear()
      this.needsResync = false
      void this.dispatchNow(event, snapshot)
      return
    }

    if (isHoverTransition && this.coalesceMs > 0) {
      this.hoverTimer = setTimeout(() => {
        this.hoverTimer = null
        void this.dispatchNow(event, snapshot)
      }, this.coalesceMs)
      return
    }

    void this.dispatchNow(event, snapshot)
  }

  /**
   * Build the authoritative chat-submit envelope synchronously before calling Xen chat,
   * embedding reconciliation metadata so the backend can accept newer state and reject stale state.
   */
  prepareAuthoritativeChatEnvelope(snapshot: CanonicalCircuitContextV3): CanonicalCircuitContextV3 & {
    sync_reconciliation: {
      last_synced_session_id: string
      last_synced_circuit_revision: number
      last_synced_interaction_revision: number
      needs_resync: boolean
      authoritative_for_request: true
    }
  } {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }
    return {
      ...snapshot,
      sync_reconciliation: {
        last_synced_session_id: this.lastSynced.sessionId,
        last_synced_circuit_revision: this.lastSynced.circuitRevision,
        last_synced_interaction_revision: this.lastSynced.interactionRevision,
        needs_resync: this.needsResync,
        authoritative_for_request: true,
      },
    }
  }

  dispose(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer)
      this.hoverTimer = null
    }
    this.pendingAbort?.abort()
    this.pendingAbort = null
  }
}
