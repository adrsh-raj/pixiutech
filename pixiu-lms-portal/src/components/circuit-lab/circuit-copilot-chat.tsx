/**
 * PIXIU TECH CYBERLAB — XEN AI CIRCUIT COPILOT CHAT & AUTONOMOUS REPAIR DRAWER
 *
 * Interactive in-situ movable circuit assistant powered by Xen (Xen Step-700).
 * Inspects live canvas state, pin potentials, component runtimes, and Blockly code.
 * Diagnoses electrical fault categories, proposes atomic repair actions,
 * computes visual diffs, and executes simulator-in-the-loop verification.
 *
 * Fully supports:
 * 1. Movable, draggable, minimizable, and closable floating window (zero navigation to /xen).
 * 2. Full lesson-aware tutoring with automatic pedagogical explanations on lesson selection.
 * 3. Continuous interactive cross-questioning incorporating real-time circuit state.
 * 4. Progressive token streaming with live thinking indicators.
 *
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  Sparkles,
  X,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RotateCcw,
  Send,
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  GripHorizontal,
  Minus,
  Maximize2,
  BookOpen,
} from "lucide-react"
import type { CircuitState, PinRef } from "@/lib/circuit-types"
import type { ArduinoPinState } from "@/lib/simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { UseCircuitCopilotActionResult, CircuitCopilotProposal } from "./use-circuit-copilot-action"
import { computeCircuitHash } from "@/lib/circuit-validator"
import {
  serializeCircuitContext,
  verifyCircuitWithSimulator,
  processCircuitCopilotQuery,
  describeCircuitTopology,
  type CircuitFault,
  type StructuredRepairProposal,
  type SimulatorVerificationResult,
  type CircuitDiagnosisContext,
  type CopilotDiagnosticState,
} from "@/lib/circuit-intelligence"
import { CATALOG } from "@/lib/components-catalog"
import { getBoardDefinition, isBoardPart } from "@/lib/board-registry"
import { detectAffirmativeContinuation } from "@/lib/ai/xen/affirmative-detector.js"
import { classifyCopilotIntent } from "@/lib/ai/xen/circuit-query-classifier.js"
import { sanitizeClientOutput, splitXenResponse } from "@/lib/ai/xen/xen-sanitizer.js"
import { XenMarkdown } from "../xen/XenMarkdown.jsx"
import { copilotCompletionSource, streamXenChat, syncCyberLabContext } from "@/lib/ai/xen/xen-client.js"
import {
  buildCanonicalCircuitContextV3,
  LiveCircuitContextBridge,
} from "@/lib/live-circuit-bridge"
import type {
  LiveLifecycleEvent,
  LiveMultimeterTelemetry,
  LiveOscilloscopeTelemetry,
  RecentTargetPin,
} from "@/lib/live-circuit-types"

import { loadLessonProgress, type Lesson } from "@/lib/lesson-engine"

const XEN_LOGO = "/img/xen-logo.svg"

export interface LessonContextData {
  id: string
  title: string
  launchId: string
  progressScope?: string
  board?: string
  steps?: Lesson["steps"]
  seedCircuit?: CircuitState
  seedBlocklyXml?: string
  checkpoint?: { kind: string; title: string; instructions: string }
  shortTitle?: string
  description?: string
  difficulty?: string
  concepts?: string[]
  finalGoal?: string
  codingHints?: string[]
}

export interface CircuitCopilotChatProps {
  currentCircuit?: CircuitState
  currentBlocklyXml?: string
  running?: boolean
  meter?: NonNullable<Parameters<typeof serializeCircuitContext>[1]>["multimeterProbes"]
  scope?: NonNullable<Parameters<typeof serializeCircuitContext>[1]>["oscilloscopeProbes"]
  userRole?: string
  activeBoard?: string | null
  sessionId?: string
  circuitRevision?: number
  interactionRevision?: number
  meterTelemetry?: LiveMultimeterTelemetry | null
  scopeTelemetry?: LiveOscilloscopeTelemetry | null
  generatedCode?: string
  activeStepLabel?: string | null
  isPaused?: boolean
  runTime?: number
  pressedPartIds?: string[]
  serialLines?: string[]
  activeWireColor?: string
  recentTarget?: RecentTargetPin | null
  hoveredPartId?: string | null
  draftMeta?: { draftId: string; startedAt: string; updatedAt: string } | null
  getDraftCursor?: () => { x: number; y: number } | null
  lastLifecycleEvent?: LiveLifecycleEvent | null
  lifecycleEventBatch?: LiveLifecycleEvent[]
  runtime?: Record<string, PartRuntime>
  pinStates?: Record<string, ArduinoPinState>
  copilotAction?: UseCircuitCopilotActionResult
  onHighlightParts?: (partIds: string[]) => void
  lessonContext?: LessonContextData | null
  wiring?: PinRef | null
  hoverPin?: PinRef | null
  selectedId?: string | null
  selectedWireId?: string | null
  stateRevision?: number
  isOpen?: boolean
  onToggleOpen?: () => void
  offlineTimeoutMs?: number
  [key: string]: unknown
}

interface ResponseProvenance {
  response_source: "xen_step700" | "xen_step_700" | "local_fallback" | "local_circuit_engine" | "local_educational_fallback" | "unknown" | "cache" | "error"
  model?: string | null
  assistant?: string | null
  request_id?: string | null
  worker_available?: boolean | null
  remotely_generated?: boolean | null
  local_diagnosis?: boolean
  substituted_after_failure?: boolean
  job_id: string | null
  worker_id: string | null
  session_id: string | null
  circuit_revision: number | null
  context_schema_version: string | null
  response_status: string
  fallback_reason: string | null
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  baseRevisionHash?: string
  baseCircuitRev?: number
  baseInteractionRev?: number
  wasCircuitQuery?: boolean
  diagnosticState?: CopilotDiagnosticState
  proposal?: StructuredRepairProposal
  verification?: SimulatorVerificationResult
  faults?: CircuitFault[]
  timestamp: number
  applied?: boolean
  isStreaming?: boolean
  source?: "xen" | "local_guidance" | "offline_unavailable"
  provenance?: ResponseProvenance
  groundingVerified?: boolean
  unsupportedClaims?: string[]
}

export function buildCleanCopilotHistory(
  msgs: ChatMessage[]
): Array<{
  role: "user" | "assistant"
  content: string
  provenance?: {
    response_source: string
    circuit_revision: number | null
    grounding_verified: boolean
  }
}> {
  const cleaned: Array<{
    role: "user" | "assistant"
    content: string
    provenance?: {
      response_source: string
      circuit_revision: number | null
      grounding_verified: boolean
    }
  }> = []
  for (const m of msgs) {
    if (m.id === "welcome_1" || m.isStreaming || !m.text?.trim()) continue
    if (m.source === "offline_unavailable" || m.provenance?.response_source === "error") continue
    if (m.role === "assistant" && m.groundingVerified === false) continue

    if (m.role === "user") {
      const content = m.text.slice(0, 1000)
      if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === "user") {
        cleaned[cleaned.length - 1] = { role: "user", content }
      } else {
        cleaned.push({ role: "user", content })
      }
    } else {
      cleaned.push({
        role: "assistant",
        content: m.text.slice(0, 1000),
        provenance: {
          response_source:
            m.provenance?.response_source === "xen_step_700" ? "xen_step700" :
            m.provenance?.response_source === "local_circuit_engine" || m.provenance?.response_source === "local_educational_fallback"
              ? "local_fallback" : m.provenance?.response_source ||
            (m.source === "local_guidance" ? "local_fallback" : "unknown"),
          circuit_revision: m.provenance?.circuit_revision ?? m.baseCircuitRev ?? null,
          grounding_verified: m.groundingVerified ?? true,
        },
      })
    }
  }
  return cleaned.slice(-8)
}

export function CircuitCopilotChat({
  currentCircuit = { parts: [], wires: [] },
  currentBlocklyXml = "",
  running = false,
  activeBoard,
  userRole,
  sessionId,
  circuitRevision = 0,
  interactionRevision = 0,
  meter,
  meterTelemetry = null,
  scope,
  scopeTelemetry = null,
  generatedCode = "",
  activeStepLabel = null,
  isPaused = false,
  runTime = 0,
  pressedPartIds = [],
  serialLines = [],
  runtime = {},
  pinStates = {},
  copilotAction,
  onHighlightParts,
  lessonContext = null,
  wiring = null,
  activeWireColor = "#22c55e",
  hoverPin = null,
  recentTarget = null,
  hoveredPartId = null,
  selectedId = null,
  selectedWireId = null,
  draftMeta = null,
  getDraftCursor,
  lastLifecycleEvent = null,
  lifecycleEventBatch,
  stateRevision,
  isOpen: externalIsOpen,
  onToggleOpen: externalOnToggleOpen,
  offlineTimeoutMs = 4000,
}: CircuitCopilotChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = externalIsOpen ?? internalIsOpen
  const toggle = externalOnToggleOpen ?? (() => setInternalIsOpen((open) => !open))

  // Window mobility & minimizability state
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  })
  const panelRef = useRef<HTMLElement>(null)

  const [inputMessage, setInputMessage] = useState("")
  const effectiveSessionId = sessionId || "cyberlab-local-session"
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_1",
      role: "assistant",
      text: "Hi! I’m **Xen**, your Circuit Copilot. Ask me to check a pin, explain an electrical concept, or preview a wiring fix. What are you building?",
      timestamp: Date.now(),
      source: "local_guidance",
      provenance: {
        response_source: "local_educational_fallback",
        job_id: null,
        worker_id: null,
        session_id: effectiveSessionId,
        circuit_revision: null,
        context_schema_version: null,
        response_status: "static_welcome",
        fallback_reason: "initial_ui_greeting",
      },
    },
  ])

  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => () => requestRef.current?.abort(), [])
  const revision = useMemo(() => computeCircuitHash(currentCircuit, currentBlocklyXml), [currentCircuit, currentBlocklyXml])
  const dockRef = useRef<HTMLDivElement>(null)
  const lastLaunchRef = useRef<string | null>(null)

  // Compute default position clamped to bottom-right viewport on mount
  useEffect(() => {
    if (position === null && typeof window !== "undefined") {
      const panelWidth = Math.min(460, window.innerWidth - 32)
      const panelHeight = Math.min(620, window.innerHeight - 80)
      const initialX = Math.max(16, window.innerWidth - panelWidth - 28)
      const initialY = Math.max(64, window.innerHeight - panelHeight - 28)
      setPosition({ x: initialX, y: initialY })
    }
  }, [position])

  // Dragging event handlers with pointer capture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) return
    const currentX = position?.x ?? Math.max(16, window.innerWidth - 488)
    const currentY = position?.y ?? Math.max(64, window.innerHeight - 648)
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentX,
      posY: currentY,
    }
    setIsDragging(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.startX
    const dy = e.clientY - dragStartRef.current.startY
    const panelWidth = panelRef.current?.offsetWidth || 460
    const panelHeight = panelRef.current?.offsetHeight || 600

    const clampedX = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, dragStartRef.current.posX + dx))
    const clampedY = Math.max(8, Math.min(window.innerHeight - panelHeight - 8, dragStartRef.current.posY + dy))
    setPosition({ x: clampedX, y: clampedY })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  // Viewport resize clamping
  useEffect(() => {
    const handleResize = () => {
      setPosition((pos) => {
        if (!pos || typeof window === "undefined") return pos
        const panelWidth = panelRef.current?.offsetWidth || 460
        const panelHeight = panelRef.current?.offsetHeight || 600
        return {
          x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, pos.x)),
          y: Math.max(8, Math.min(window.innerHeight - panelHeight - 8, pos.y)),
        }
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Escape key collapses or closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && isOpen && (panelRef.current?.contains(e.target as Node) || dockRef.current?.contains(e.target as Node))) {
        if (!isMinimized) {
          setIsMinimized(true)
        } else {
          toggle()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isMinimized, toggle])

  useEffect(() => {
    if (isOpen) (isMinimized ? dockRef.current : panelRef.current)?.focus({ preventScroll: true })
  }, [isOpen, isMinimized])

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen, isMinimized, streamingStatus])

  // Compute live circuit context & health report
  const circuitContext: CircuitDiagnosisContext = useMemo(() => {
    return serializeCircuitContext(currentCircuit, {
      blocklyXml: currentBlocklyXml,
      generatedCode,
      multimeterProbes: meter,
      oscilloscopeProbes: scope,
      pressed: new Set(pressedPartIds),
      runtime,
      pinStates,
      running,
      isPaused,
      runTime,
    })
  }, [currentCircuit, currentBlocklyXml, generatedCode, runtime, pinStates, running, isPaused, runTime, meter, scope, pressedPartIds])

  const healthScore = circuitContext.healthReport.score
  const healthBadgeLabel =
    healthScore !== null
      ? `${healthScore}%`
      : circuitContext.healthReport.status === "unwired" || currentCircuit.parts.length > 0
      ? "Not Wired"
      : "Empty"
  const hasCritical = circuitContext.healthReport.criticalCount > 0
  const hasWarning = circuitContext.healthReport.warningCount > 0

  const bridgeRef = useRef<LiveCircuitContextBridge | null>(null)
  const getBridge = useCallback(() => {
    if (!bridgeRef.current) {
      bridgeRef.current = new LiveCircuitContextBridge((payload) => syncCyberLabContext(payload))
    }
    return bridgeRef.current
  }, [])
  useEffect(() => {
    const b = getBridge()
    return () => b.dispose()
  }, [getBridge])

  const buildV3Snapshot = useCallback(
    (event?: LiveLifecycleEvent | null) =>
      buildCanonicalCircuitContextV3({
        circuit: currentCircuit,
        circuitContext,
        sessionId: effectiveSessionId,
        circuitRevision,
        interactionRevision,
        eventSeq: event?.event_seq ?? 0,
        eventId: event?.event_id,
        activeBoard,
        blocklyXml: currentBlocklyXml,
        generatedCode,
        activeStepLabel,
        running,
        isPaused,
        runTime,
        pressedPartIds,
        serialLines,
        runtime,
        pinStates,
        wiring,
        activeWireColor,
        draftMeta,
        cursor: getDraftCursor?.() ?? null,
        hoverPin,
        recentTarget,
        hoveredPartId,
        selectedId,
        selectedWireId,
        meter,
        meterTelemetry,
        scope,
        scopeTelemetry,
        lastEvent: event ?? lastLifecycleEvent,
      }),
    [
      currentCircuit,
      circuitContext,
      effectiveSessionId,
      circuitRevision,
      interactionRevision,
      activeBoard,
      currentBlocklyXml,
      generatedCode,
      activeStepLabel,
      running,
      isPaused,
      runTime,
      pressedPartIds,
      serialLines,
      runtime,
      pinStates,
      wiring,
      activeWireColor,
      draftMeta,
      getDraftCursor,
      hoverPin,
      recentTarget,
      hoveredPartId,
      selectedId,
      selectedWireId,
      meter,
      meterTelemetry,
      scope,
      scopeTelemetry,
      lastLifecycleEvent,
    ],
  )

  const dispatchedEventIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!sessionId) return
    const events =
      lifecycleEventBatch && lifecycleEventBatch.length > 0
        ? lifecycleEventBatch
        : lastLifecycleEvent
        ? [lastLifecycleEvent]
        : []
    if (events.length === 0) return
    for (const evt of events) {
      if (!evt || dispatchedEventIdsRef.current.has(evt.event_id)) continue
      if (dispatchedEventIdsRef.current.size > 200) {
        dispatchedEventIdsRef.current.clear()
      }
      dispatchedEventIdsRef.current.add(evt.event_id)
      const snapshot = buildV3Snapshot(evt)
      getBridge().enqueueLifecycleEvent(evt, snapshot)
    }
  }, [sessionId, lifecycleEventBatch, lastLifecycleEvent, buildV3Snapshot, getBridge])

  // Build context envelope for prompt grounding
  const buildContextEnvelope = useCallback((affirmativeAction?: ReturnType<typeof detectAffirmativeContinuation>) => {
    const progress = lessonContext?.progressScope ? loadLessonProgress(lessonContext.progressScope)[lessonContext.id] : undefined
    const checkpoint = progress ? lessonContext?.steps?.find(step => !progress.completedStepIds.includes(step.id)) : lessonContext?.checkpoint

    const snapshotV3 = buildV3Snapshot(lastLifecycleEvent)
    const authoritativeV3 = getBridge().prepareAuthoritativeChatEnvelope(snapshotV3)

    const placedBoard =
      (activeBoard ? currentCircuit.parts.find((p) => p.type === activeBoard && isBoardPart(p.type)) : undefined) ??
      currentCircuit.parts.find((p) => isBoardPart(p.type))
    const boardDef = placedBoard ? getBoardDefinition(placedBoard.type) : undefined
    const boardId = boardDef?.id ?? null
    const boardName = boardDef?.name ?? null
    const logicVoltage = boardDef?.logicVoltage ?? null

    const powerPins = boardDef?.powerPins ?? null
    const powerPinIds = powerPins
      ? [...(powerPins.v5 || []), ...(powerPins.v33 || []), ...(powerPins.vin || [])]
      : []
    const groundPinIds = powerPins?.gnd || []

    // Components (Parts) with human-readable names and safe properties
    const components = currentCircuit.parts.slice(0, 48).map((part) => {
      const catItem = CATALOG[part.type as keyof typeof CATALOG]
      const safeProps: Record<string, string | number> = {}
      if (part.props) {
        for (const [key, val] of Object.entries(part.props)) {
          if (["resistance", "color", "unit", "value", "capacitance", "voltage", "label"].includes(key) && val !== undefined) {
            safeProps[key] = val
          }
        }
      }
      return {
        id: part.id,
        instanceId: part.id,
        type: part.type,
        name: catItem?.name || part.type,
        props: safeProps,
        pins: (catItem?.pins || []).map((p) => ({
          id: p.id,
          label: p.label,
          kind: p.kind,
        })),
      }
    })

    // Connections (Wires) with net and pin labels (strictly completed wires)
    const connections = currentCircuit.wires.slice(0, 48).map((wire, idx) => {
      const fromPart = currentCircuit.parts.find((p) => p.id === wire.from.partId)
      const fromCat = fromPart ? CATALOG[fromPart.type as keyof typeof CATALOG] : undefined
      const fromPin = fromCat?.pins?.find((p) => p.id === wire.from.pinId)
      const fromLabel = fromPin?.label || wire.from.pinId

      const toPart = currentCircuit.parts.find((p) => p.id === wire.to.partId)
      const toCat = toPart ? CATALOG[toPart.type as keyof typeof CATALOG] : undefined
      const toPin = toCat?.pins?.find((p) => p.id === wire.to.pinId)
      const toLabel = toPin?.label || wire.to.pinId

      const fromKey = `${wire.from.partId}:${wire.from.pinId}`
      const toKey = `${wire.to.partId}:${wire.to.pinId}`
      const matchedNet = circuitContext.nets.find(
        (n) => n.pinKeys.includes(fromKey) || n.pinKeys.includes(toKey)
      )

      return {
        id: wire.id || `wire_${idx}`,
        wireId: wire.id || `wire_${idx}`,
        from: {
          partId: wire.from.partId,
          pinId: wire.from.pinId,
          label: fromLabel,
        },
        to: {
          partId: wire.to.partId,
          pinId: wire.to.pinId,
          label: toLabel,
        },
        color: wire.color,
        status: "complete" as const,
        netId: matchedNet?.id ?? null,
        electricalNetId: matchedNet?.id ?? null,
        netNominalVoltage: matchedNet?.nominalVoltage ?? null,
        nominalVoltage: matchedNet?.nominalVoltage ?? null,
      }
    })

    // Pin states summary
    const pinStatesSummary = Object.entries(pinStates || {}).slice(0, 32).reduce<Record<string, unknown>>((acc, [pin, pState]) => {
      acc[pin] = {
        state: pState.state,
        outputMode: pState.outputMode || "digital",
        value: pState.value,
        angle: pState.angle,
        toneHz: pState.toneHz,
      }
      return acc
    }, {})

    // Component runtime state
    const componentRuntimeState = Object.entries(runtime || {}).slice(0, 32).reduce<Record<string, unknown>>((acc, [partId, r]) => {
      acc[partId] = {
        level: r.level,
        angle: r.angle,
        burnt: r.burnt,
        currentMa: r.currentMa,
        warning: r.warning,
      }
      return acc
    }, {})

    const omittedFields = [
      ...(currentCircuit.parts.length > 32 ? ["circuit.parts"] : []),
      ...(currentCircuit.wires.length > 32 ? ["circuit.wires"] : []),
      ...(circuitContext.nets.length > 16 || circuitContext.nets.some(net => net.pinKeys.length > 12)
        ? ["circuit.netlist"] : []),
      ...(generatedCode && generatedCode.length > 1200 ? ["blockly.code"] : []),
    ]

    // Instrument state controls whether a numerical value can be presented.
    const simulatedReadings = (circuitContext.measurements || []).map((m) => ({
      instrument: m.instrument,
      value: m.value,
      unit: m.unit,
      probeA: m.probeA,
      probeB: m.probeB,
      mode: m.mode,
      state: m.state,
      notes: m.notes,
      source: m.state === "available" ? "simulated" : "unknown",
    }))

    // Health report
    const healthReport = {
      score: circuitContext.healthReport.score,
      status: circuitContext.healthReport.status,
      criticalCount: circuitContext.healthReport.criticalCount,
      warningCount: circuitContext.healthReport.warningCount,
      issues: (circuitContext.healthReport.issues || []).map((issue) => ({
        ruleId: issue.id,
        severity: issue.severity,
        category: issue.category,
        title: issue.title,
        message: issue.message,
        suggestion: issue.suggestion,
        involvedPartIds: issue.involvedPartIds,
      })),
    }

    // Code: blockly block types and pin bindings
    const blockTypes = typeof DOMParser !== "undefined" && currentBlocklyXml
      ? Array.from(new DOMParser().parseFromString(currentBlocklyXml, "application/xml").querySelectorAll("block"))
          .slice(0, 30)
          .map((block) => block.getAttribute("type"))
          .filter((t): t is string => Boolean(t))
      : []

    const blocklyPinBindings = circuitContext.code.pinBindings || []

    const netlistSummary = authoritativeV3.netlist.slice(0, 16).map(({ pin_keys, ...net }) => ({
      ...net,
      pins: pin_keys.slice(0, 12),
    }))

    return {
      ...authoritativeV3,
      lesson: lessonContext
        ? {
            id: lessonContext.id,
            title: lessonContext.title,
            short_title: lessonContext.shortTitle || lessonContext.title,
            description: lessonContext.description || "",
            difficulty: lessonContext.difficulty || "",
            concepts: lessonContext.concepts || [],
            active_step: checkpoint,
            completed_step_ids: progress?.completedStepIds || [],
            steps: lessonContext.steps?.map((step) => step.title),
            target_board: lessonContext.board,
            starter_parts: lessonContext.seedCircuit?.parts.map((part) => part.type),
            required_parts: lessonContext.steps?.flatMap((step) =>
              (step.checks || []).flatMap((check) =>
                check.kind === "parts" ? check.requirements.map((r) => r.count + " " + r.type) : []
              )
            ),
            final_goal: lessonContext.finalGoal || "",
          }
        : undefined,
      circuit: {
        board: boardId
          ? {
              id: boardId,
              partId: placedBoard?.id,
              name: boardName,
              logicVoltage,
              logic_voltage: logicVoltage,
              powerPins,
              power_pins: powerPins,
              powerPinIds,
              power_pin_ids: powerPinIds,
              groundPinIds,
              ground_pin_ids: groundPinIds,
            }
          : null,
        components,
        parts: currentCircuit.parts.slice(0, 32).map(({ id, type, props }) => {
          const cat = CATALOG[type as keyof typeof CATALOG]
          const safeProps: Record<string, string | number> = {}
          if (props) {
            for (const [k, v] of Object.entries(props)) {
              if (["resistance", "color", "unit", "value", "capacitance", "voltage", "label"].includes(k) && v !== undefined) {
                safeProps[k] = v
              }
            }
          }
          return {
            id,
            type,
            name: cat?.name || type,
            props: safeProps,
            pins: (cat?.pins || []).map((p) => ({ id: p.id, label: p.label })),
          }
        }),
        parts_count: currentCircuit.parts.length,
        connections,
        wires: currentCircuit.wires.slice(0, 32).map(({ from, to }) => ({ from, to })),
        wires_count: currentCircuit.wires.length,
        summary: `${currentCircuit.parts.length} components, ${currentCircuit.wires.length} wires`,
        simulation: {
          running,
          pinStates: pinStatesSummary,
          pinStatesSummary,
          componentRuntime: componentRuntimeState,
          component_runtime: componentRuntimeState,
          readings: simulatedReadings,
          healthReport,
        },
        running,
        readings: simulatedReadings,
        issues: circuitContext.healthReport.issues.map((issue) => issue.title).slice(0, 6).join("; "),
        source: "static circuit checks",
        health_score: healthReport.score,
        code: {
          blocks: blockTypes,
          block_types: blockTypes,
          blockTypes,
          pinBindings: blocklyPinBindings,
          pin_bindings: blocklyPinBindings,
          generated_code: authoritativeV3.blockly_context.code,
        },
        endpoint_net_lookup: authoritativeV3.endpoint_net_lookup,
        resistor_terminals: authoritativeV3.resistor_terminals,
        cross_layer_led: authoritativeV3.cross_layer_led,
        in_progress_connection: authoritativeV3.in_progress_connection,
        hovered_pin: authoritativeV3.hovered_pin,
        recent_target_pin: authoritativeV3.recent_target_pin,
        hovered_component: authoritativeV3.hovered_component,
        selected_component: authoritativeV3.selected_component,
        netlist: netlistSummary,
        schema_version: authoritativeV3.schema_version,
        session_id: authoritativeV3.session_id,
        circuit_revision: authoritativeV3.circuit_revision,
        interaction_revision: authoritativeV3.interaction_revision,
        state_revision: authoritativeV3.state_revision,
        metadata: {
          revision,
          timestamp: Date.now(),
          partial: omittedFields.length > 0,
          omitted_fields: omittedFields,
        },
        revision,
        timestamp: Date.now(),
        partial: omittedFields.length > 0,
        omitted_fields: omittedFields,
      },
      blockly: {
        blocks: blockTypes,
        has_code: Boolean(currentBlocklyXml && currentBlocklyXml.length > 40),
        code: generatedCode ? generatedCode.slice(0, 1200) : undefined,
        summary: currentBlocklyXml ? "Blockly blocks placed on workspace" : "No code blocks placed",
        pin_bindings: blocklyPinBindings,
      },
      affirmativeAction: affirmativeAction || undefined,
      affirmative_action: affirmativeAction || undefined,
    }
  }, [
    lessonContext,
    buildV3Snapshot,
    lastLifecycleEvent,
    activeBoard,
    currentCircuit,
    circuitContext,
    pinStates,
    runtime,
    currentBlocklyXml,
    generatedCode,
    running,
    revision,
    getBridge,
  ])

  // Execute diagnostic action / AI tutoring with streaming
  const handleRunDiagnosis = useCallback(
    async (customQuery?: string, isLessonKickoff = false) => {
      if (requestRef.current) return
      const controller = new AbortController()
      requestRef.current = controller
      setIsDiagnosing(true)
      const query = customQuery || "Find the mistake in this circuit and explain what is wrong."

      // Multi-turn affirmative continuation detection
      const lastAsst = [...messages].reverse().find((m) => m.role === "assistant" && m.text)
      const affirmativeAction = detectAffirmativeContinuation(query, lastAsst?.text)

      // Add user message unless it's an automated lesson intro
      if (!isLessonKickoff) {
        const userMsg: ChatMessage = {
          id: `user_${Date.now()}`,
          role: "user",
          text: query,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, userMsg])
      }

      const streamMsgId = `asst_${Date.now()}`
      const intentResolution = classifyCopilotIntent(query, messages, { inCyberLab: true })
      const isCircuitQuery = intentResolution.inspect
      if (intentResolution.intent === "topology") {
        const previous = /^which arduino pin[.!?]*$/i.test(query.trim())
          ? [...messages].reverse().find(m => m.role === "user" && classifyCopilotIntent(m.text).inspect)?.text
          : ""
        const text = isCircuitQuery
          ? describeCircuitTopology(previous ? `${query} ${previous}` : query, circuitContext)
          : "Which part or pin should I check on the canvas?"
        setMessages(prev => [...prev, {
          id: streamMsgId, role: "assistant", text, timestamp: Date.now(),
          wasCircuitQuery: isCircuitQuery, baseRevisionHash: revision,
          baseCircuitRev: circuitRevision, baseInteractionRev: interactionRevision, source: "local_guidance",
          provenance: {
            response_source: isCircuitQuery ? "local_circuit_engine" : "local_educational_fallback",
            job_id: null, worker_id: null, session_id: effectiveSessionId, circuit_revision: circuitRevision,
            context_schema_version: null, response_status: "completed", fallback_reason: null,
            remotely_generated: false, local_diagnosis: isCircuitQuery, substituted_after_failure: false,
          },
        }])
        requestRef.current = null
        setIsDiagnosing(false)
        return
      }
      setStreamingStatus(isCircuitQuery ? "Xen is analyzing circuit & preparing guidance..." : "Xen is thinking...")

      // Pre-calculate simulator-in-the-loop repair proposal only for circuit-specific queries
      const localResult = isCircuitQuery
        ? processCircuitCopilotQuery(query, circuitContext)
        : { reply: "", state: undefined, highlightPartIds: [], proposal: undefined, verification: undefined }
      if (localResult.highlightPartIds && localResult.highlightPartIds.length > 0 && onHighlightParts) {
        onHighlightParts(localResult.highlightPartIds)
      }

      // Add placeholder assistant message with explicit pending provenance
      const baseCircuitRev = circuitRevision
      const baseInteractionRev = interactionRevision
      const contextEnvelope = isCircuitQuery ? buildContextEnvelope(affirmativeAction) : null
      const schemaVersion = (contextEnvelope?.schema_version as string | undefined) ?? null
      setMessages((prev) => [
        ...prev,
        {
          id: streamMsgId,
          role: "assistant",
          text: "",
          baseRevisionHash: revision,
          baseCircuitRev,
          baseInteractionRev,
          wasCircuitQuery: isCircuitQuery,
          diagnosticState: localResult.state,
          proposal: localResult.proposal,
          verification: localResult.verification,
          faults: localResult.proposal?.faults,
          timestamp: Date.now(),
          applied: false,
          isStreaming: true,
          provenance: {
            response_source: "unknown",
            job_id: null,
            worker_id: null,
            session_id: effectiveSessionId,
            circuit_revision: baseCircuitRev,
            context_schema_version: schemaVersion,
            response_status: "pending",
            fallback_reason: null,
          },
        },
      ])

      let streamSucceeded = false
      let fallbackReason = "GPU response unavailable"
      let fallbackCode = "WORKER_UNAVAILABLE"
      let lastRemoteProvenance: ResponseProvenance | undefined

      try {
        const streamResult = await streamXenChat({
          signal: controller.signal,
          prompt: query,
          intent: userRole?.toLowerCase() === "admin" ? "TEACHING_REVIEW" : isLessonKickoff ? "LAB_TEACHING" : "TEACHING",
          contextEnvelope,
          offlineTimeoutMs,
          history: buildCleanCopilotHistory(messages),
          idempotencyKey: isLessonKickoff ? lessonContext?.launchId : undefined,
          onStatusUpdate: (info) => {
            if (info.workerAvailable === false) {
              setStreamingStatus("GPU worker offline — waiting briefly before local circuit check...")
            } else if (info.status === "queued") {
              setStreamingStatus(`Xen queued (position ${info.queuePosition || 1})...`)
            } else if (info.status === "running") {
              setStreamingStatus("Xen is thinking...")
            } else if (info.status === "streaming") {
              setStreamingStatus("Xen is writing response...")
            }
          },
          onChunk: (delta, fullText) => {
            if (isCircuitQuery && !isLessonKickoff) return
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? {
                      ...m,
                      text: fullText,
                      isStreaming: true,
                      source: "xen",
                      provenance: {
                        ...(m.provenance || {
                          job_id: null,
                          worker_id: null,
                          session_id: effectiveSessionId,
                          circuit_revision: baseCircuitRev,
                          context_schema_version: schemaVersion,
                          fallback_reason: null,
                        }),
                        response_source: "unknown",
                        response_status: "streaming",
                      },
                    }
                  : m
              )
            )
          },
        })

        lastRemoteProvenance = (streamResult as { provenance?: ResponseProvenance })?.provenance

        if (isCircuitQuery && streamResult.success && lastRemoteProvenance?.circuit_revision != null &&
            lastRemoteProvenance.circuit_revision !== baseCircuitRev) {
          fallbackReason = "Xen answered from a different circuit revision"
          fallbackCode = "SNAPSHOT_MISMATCH"
        } else if (streamResult.success && streamResult.response?.text?.trim()) {
          streamSucceeded = true
          const gv = streamResult.groundingVerification
          const source = copilotCompletionSource(lastRemoteProvenance, gv)
          const resolvedProv: ResponseProvenance = {
            response_source: source,
            model: streamResult.model ?? null,
            assistant: streamResult.assistant ?? null,
            request_id: streamResult.requestId ?? null,
            worker_available: streamResult.workerAvailable ?? null,
            remotely_generated: source === "xen_step_700" ? true : source === "local_circuit_engine" ? false : null,
            local_diagnosis: source === "local_circuit_engine",
            substituted_after_failure: source === "local_circuit_engine",
            job_id: lastRemoteProvenance?.job_id ?? null,
            worker_id: lastRemoteProvenance?.worker_id ?? null,
            session_id: lastRemoteProvenance?.session_id ?? effectiveSessionId,
            circuit_revision: lastRemoteProvenance?.circuit_revision ?? baseCircuitRev,
            context_schema_version: lastRemoteProvenance?.context_schema_version ?? schemaVersion,
            response_status: lastRemoteProvenance?.response_status || "completed",
            fallback_reason: lastRemoteProvenance?.fallback_reason ?? null,
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId
                ? {
                    ...m,
                    text: sanitizeClientOutput(streamResult.response.text),
                    isStreaming: false,
                    source: resolvedProv.response_source === "local_circuit_engine" ? "local_guidance"
                      : resolvedProv.response_source === "xen_step_700" ? "xen" : undefined,
                    provenance: resolvedProv,
                    groundingVerified: gv?.verified,
                    unsupportedClaims: gv?.unsupported_claims,
                  }
                : m
            )
          )
        } else if (streamResult?.error?.code === "WORKER_OFFLINE") {
          fallbackReason = "GPU worker offline"
          fallbackCode = "WORKER_OFFLINE"
        } else if (streamResult?.error?.code === "TIMEOUT") {
          fallbackReason = "Xen inference request timed out"
          fallbackCode = "TIMEOUT"
        } else if (streamResult?.error?.message) {
          fallbackReason = streamResult.error.message
          fallbackCode = streamResult.error.code || "UPSTREAM_ERROR"
        } else if (streamResult.success && !streamResult.response?.text?.trim()) {
          fallbackReason = "Empty response returned by inference endpoint"
          fallbackCode = "EMPTY_MODEL_RESPONSE"
        }
      } catch {
        // Handle unreachable backend / worker without masquerading as live Xen output
        streamSucceeded = false
        fallbackReason = "Backend request failed"
        fallbackCode = "BACKEND_ERROR"
      }

      // If live Xen inference did not succeed, never masquerade offline text as a Xen model response
      if (!streamSucceeded) {
        let finalText = ""
        let messageSource: ChatMessage["source"] = "local_guidance"
        let provSource: ResponseProvenance["response_source"] = "local_circuit_engine"
        let provStatus = "local_fallback"

        if (!isCircuitQuery && !isLessonKickoff) {
          provSource = "local_educational_fallback"
          const educational = /kinetic|kitnetic|kenetic|gatij/i.test(query)
            ? "Kinetic energy is the energy of motion. $KE = (1/2)mv^2$, where $m$ is mass and $v$ is speed. At the same mass, doubling speed gives four times the kinetic energy."
            : intentResolution.intent === "greeting" || intentResolution.intent === "conversation"
              ? "Hi! I can still check circuit wiring or pin connections while Xen is unavailable."
              : "I can check your circuit locally. For this broader question, try Xen again when the worker is available."
          finalText = `Xen is unavailable right now (${fallbackReason}).\n\n${educational}`
        } else if (isLessonKickoff && lessonContext) {
          messageSource = "local_guidance"
          provSource = "local_educational_fallback"
          provStatus = "local_fallback"
          const missionOverview =
            `Mission overview for **${lessonContext.title}** — ${lessonContext.description || "Build and test this circuit safely."}` +
            (lessonContext.concepts?.length ? `\n\n**Key Concepts:** ${lessonContext.concepts.join(", ")}.` : "") +
            (lessonContext.checkpoint
              ? `\n\n**Current checkpoint:** ${lessonContext.checkpoint.title}\n${lessonContext.checkpoint.instructions}`
              : "")
          finalText = `Local circuit guidance (${fallbackReason} — Xen model is unavailable; showing local mission notes only):\n\n${missionOverview}`
        } else {
          messageSource = "local_guidance"
          provSource = "local_circuit_engine"
          provStatus = "local_fallback"
          const deterministicReply = localResult.reply
            ? localResult.reply
            : "Local deterministic checks inspect placed CyberLab components, wires, nets, and fault rules."
          finalText = `Local circuit guidance (${fallbackReason} — Xen model is unavailable; deterministic CyberLab checks only):\n\n${deterministicReply}`
        }

        const offlineProv: ResponseProvenance = {
          response_source: provSource,
          remotely_generated: false,
          worker_available: fallbackCode === "WORKER_OFFLINE" ? false : null,
          local_diagnosis: provSource === "local_circuit_engine",
          substituted_after_failure: true,
          job_id: lastRemoteProvenance?.job_id ?? null,
          worker_id: lastRemoteProvenance?.worker_id ?? null,
          session_id: lastRemoteProvenance?.session_id ?? effectiveSessionId,
          circuit_revision: baseCircuitRev,
          context_schema_version: schemaVersion,
          response_status: provStatus,
          fallback_reason: fallbackCode,
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: finalText,
                  isStreaming: false,
                  source: messageSource,
                  provenance: offlineProv,
                }
              : m
          )
        )
      }

      requestRef.current = null
      setIsDiagnosing(false)
      setStreamingStatus(null)
    },
    [userRole, effectiveSessionId, revision, circuitRevision, interactionRevision, circuitContext, onHighlightParts, buildContextEnvelope, lessonContext, messages, offlineTimeoutMs]
  )

  // Lesson-aware auto-tutoring effect (idempotent against StrictMode)
  useEffect(() => {
    if (
      isOpen &&
      lessonContext &&
      lessonContext.id &&
      lastLaunchRef.current !== lessonContext.launchId
    ) {
      setIsMinimized(false)

      const kickoffPrompt =
        `You are tutoring the student on the mission "${lessonContext.title}". ` +
        `Explain what we are building, why these components are necessary, and guide them on the current checkpoint: ` +
        `${lessonContext.checkpoint?.title || "Initial Setup"}. Keep it encouraging, clear, and age-appropriate.`

      // StrictMode discards the first effect setup. Only the surviving setup submits.
      const launch = window.setTimeout(() => {
        lastLaunchRef.current = lessonContext.launchId
        void handleRunDiagnosis(kickoffPrompt, true)
      }, 0)
      return () => window.clearTimeout(launch)
    }
  }, [isOpen, lessonContext, handleRunDiagnosis])

  // Handle Apply Fix action (verifies simulator + validator + post-apply state before marking applied)
  const handleApplyFix = useCallback(
    (messageId: string, proposal: StructuredRepairProposal, baseRevisionHash: string, baseCircuitRev?: number) => {
      if (!copilotAction || baseRevisionHash !== revision || baseCircuitRev !== circuitRevision) return

      const effectiveXml = proposal.repairedBlocklyXml || currentBlocklyXml
      const preApplyVerification = verifyCircuitWithSimulator(
        currentCircuit,
        proposal.repairedCircuit,
        pinStates,
        effectiveXml
      )
      if (!preApplyVerification.verified) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  applied: false,
                  verification: preApplyVerification,
                }
              : m
          )
        )
        return
      }

      const actionProposal: CircuitCopilotProposal = {
        id: `repair_${Date.now()}`,
        title: "Circuit Repair Preview",
        rationale: proposal.diagnosis,
        baseRevisionHash,
        circuit: proposal.repairedCircuit,
        blocklyXml: effectiveXml,
      }

      const stageResult = copilotAction.proposeAction(actionProposal)
      if (stageResult.valid) {
        const applied = copilotAction.applyProposal(actionProposal)
        if (applied) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    applied: true,
                    verification: preApplyVerification,
                  }
                : m
            )
          )
        }
      }
    },
    [copilotAction, currentCircuit, currentBlocklyXml, pinStates, revision, circuitRevision]
  )

  // Handle Undo Fix action (restores exact prior topology via undoAction)
  const handleUndoFix = useCallback(
    (messageId: string) => {
      if (!copilotAction || !copilotAction.canUndo) return
      const undone = copilotAction.undoAction()
      if (undone) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, applied: false } : m))
        )
      }
    },
    [copilotAction]
  )

  // Handle Send Text Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isDiagnosing) return
    const msg = inputMessage.trim()
    setInputMessage("")
    void handleRunDiagnosis(msg)
  }

  return (
    <>
      {/* Canvas Launcher Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false)
            toggle()
          }}
          className="fixed bottom-20 right-24 md:bottom-6 md:right-36 z-[78] inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-[#091122]/95 px-4 py-2 text-xs font-black text-white shadow-xl shadow-cyan-900/40 backdrop-blur-md transition hover:border-cyan-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          aria-label="Open Xen AI Circuit Copilot"
          title="Open Xen AI · Circuit Intelligence & Autonomous Repair"
        >
          <img src={XEN_LOGO} alt="" className="h-5 w-5 object-contain" />
          <span className="font-extrabold tracking-wide">Xen AI</span>
          <Sparkles size={13} className="text-cyan-300 animate-pulse" />

          {/* Real-time Health Badge */}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              hasCritical
                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                : hasWarning
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : healthScore === null
                ? "bg-slate-800/90 text-slate-300 border border-slate-700"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            }`}
          >
            {healthBadgeLabel}
          </span>
        </button>
      )}

      {/* Minimized Floating Pill Dock */}
      {isOpen && isMinimized && (
        <div
          role="region"
          tabIndex={-1}
          ref={dockRef}
          aria-label="Xen Minimized Pill"
          className="fixed bottom-6 right-6 md:right-10 z-[85] flex items-center gap-2.5 rounded-full border border-cyan-400/50 bg-[#070d19]/95 px-4 py-2 text-xs font-bold text-white shadow-2xl shadow-cyan-950/60 backdrop-blur-xl animate-in fade-in zoom-in-95"
        >
          <img src={XEN_LOGO} alt="" className="h-5 w-5 object-contain" />
          <span className="font-extrabold text-cyan-200">Xen AI</span>

          {lessonContext && (
            <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-950/80 px-2 py-0.5 text-[10px] text-cyan-300 max-w-[150px] truncate">
              <BookOpen size={10} className="shrink-0" />
              <span className="truncate">{lessonContext.shortTitle || lessonContext.title}</span>
            </span>
          )}

          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="rounded-full p-1 text-slate-300 hover:bg-slate-800 hover:text-white transition"
              title="Expand Xen Window"
              aria-label="Expand Xen Window"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Close Xen"
              aria-label="Close Xen"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Movable, Draggable Floating Copilot Window */}
      {isOpen && !isMinimized && (
        <aside
          tabIndex={-1}
          ref={panelRef}
          aria-label="Xen Circuit Copilot Panel"
          style={{
            transform: position ? `translate3d(${position.x}px, ${position.y}px, 0)` : undefined,
            position: "fixed",
            top: 0,
            left: 0,
          }}
          className="z-[85] flex h-[min(620px,calc(100vh-5rem))] w-[min(460px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-cyan-500/40 bg-[#070d19]/95 text-white shadow-2xl shadow-cyan-950/80 backdrop-blur-xl animate-in fade-in zoom-in-95 select-none"
        >
          {/* Draggable Header */}
          <header
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={() => setIsDragging(false)}
            className={`flex items-center justify-between border-b border-cyan-900/40 bg-slate-900/80 px-4 py-3 touch-none cursor-grab active:cursor-grabbing select-none ${
              isDragging ? "bg-slate-800/90" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <GripHorizontal size={16} className="text-slate-500 shrink-0" />
              <img src={XEN_LOGO} alt="Xen AI" className="h-6 w-6 object-contain pointer-events-none" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-white">Xen</h3>
                  <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400 border border-cyan-800/50">
                    Configured model: Xen Step-700
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Interactive Circuit Copilot & Tutor</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  hasCritical
                    ? "bg-red-950/80 text-red-400 border border-red-700/50"
                    : hasWarning
                    ? "bg-amber-950/80 text-amber-300 border border-amber-700/50"
                    : healthScore === null
                    ? "bg-slate-800/90 text-slate-300 border border-slate-700"
                    : "bg-emerald-950/80 text-emerald-400 border border-emerald-700/50"
                }`}
              >
                {hasCritical ? (
                  <AlertOctagon size={11} />
                ) : hasWarning ? (
                  <AlertTriangle size={11} />
                ) : healthScore === null ? (
                  <Activity size={11} />
                ) : (
                  <CheckCircle2 size={11} />
                )}
                <span>{healthBadgeLabel}</span>
              </span>

              {/* Minimize Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsMinimized(true)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Minimize Xen Window"
                title="Minimize Window"
              >
                <Minus size={15} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggle}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Close Xen Panel"
                title="Close Panel"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {/* Active Lesson Mission Banner */}
          {lessonContext && (
            <div className="flex items-center justify-between border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/50 via-slate-900/60 to-slate-950/50 px-4 py-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <BookOpen size={12} className="text-cyan-400 shrink-0" />
                <span className="font-bold text-cyan-200 truncate">
                  Learning Mission · {lessonContext.title}
                </span>
              </div>
              <span className="ml-2 shrink-0 rounded bg-cyan-900/40 px-1.5 py-0.5 text-[9px] font-medium text-cyan-300 border border-cyan-700/30">
                {lessonContext.difficulty || "Mission"}
              </span>
            </div>
          )}

          {/* Quick Action Bar */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/60 bg-slate-950/50 px-4 py-2 scrollbar-none text-[11px] select-none">
            <button
              type="button"
              onClick={() => void handleRunDiagnosis("Find the mistake in this circuit.")}
              disabled={isDiagnosing}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 font-semibold text-cyan-300 hover:bg-cyan-900/60 transition disabled:opacity-50"
            >
              <Wrench size={12} />
              <span>Diagnose Circuit</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRunDiagnosis("Why is my LED not glowing? Check return path and resistor.")}
              disabled={isDiagnosing}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Zap size={12} className="text-amber-400" />
              <span>Why is LED off?</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRunDiagnosis("LED glow nahi ho rahi, check karo.")}
              disabled={isDiagnosing}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <span>LED check karo (Hinglish)</span>
            </button>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed select-text">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  data-response-source={msg.role === "assistant" ? msg.provenance?.response_source : undefined}
                  data-diagnostic-state={msg.role === "assistant" ? msg.diagnosticState : undefined}
                  data-model-id={msg.role === "assistant" ? msg.provenance?.model ?? undefined : undefined}
                  data-job-id={msg.role === "assistant" && msg.provenance?.job_id ? msg.provenance.job_id : undefined}
                  className={`max-w-[92%] rounded-2xl p-3.5 shadow-md ${
                    msg.role === "user"
                      ? "bg-cyan-600 text-white rounded-tr-none font-medium"
                      : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none space-y-3"
                  }`}
                >
                  {msg.role === "assistant" && msg.id !== "welcome_1" && !msg.isStreaming && (msg.provenance || msg.source) && (
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                      {msg.provenance?.response_source === "cache" ? (
                        <span className="rounded bg-indigo-950/80 px-1.5 py-0.5 text-indigo-300 border border-indigo-800/60">
                          Cached response
                        </span>
                      ) : ["xen_step700", "xen_step_700"].includes(msg.provenance?.response_source ?? "") ? (
                        <span className="rounded bg-cyan-950/80 px-1.5 py-0.5 text-cyan-300 border border-cyan-800/60">
                          Xen Step-700
                        </span>
                      ) : msg.provenance?.response_source === "error" || msg.source === "offline_unavailable" ? (
                        <span className="rounded bg-rose-950/80 px-1.5 py-0.5 text-rose-300 border border-rose-800/60">
                          Xen Inference Unavailable
                        </span>
                      ) : (
                        <span className="rounded bg-amber-950/80 px-1.5 py-0.5 text-amber-300 border border-amber-800/60">
                          {msg.provenance?.response_source === "local_circuit_engine" ? "Local Circuit Engine"
                            : msg.provenance?.response_source === "local_educational_fallback" ? "Local Educational Fallback" : "Unknown source"}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Markdown / Formatted Text */}
                  <div className="leading-relaxed">
                    {msg.text ? splitXenResponse(msg.text).map((section, index) =>
                      section.type === "code"
                        ? <pre key={index} className="overflow-x-auto whitespace-pre p-2 rounded bg-slate-950 font-mono text-cyan-300 border border-slate-800 my-1 text-xs"><code>{section.code}</code></pre>
                        : <XenMarkdown key={index} content={section.content} isUser={msg.role === "user"} />
                    ) : (msg.isStreaming ? "..." : "")}
                  </div>

                  {/* Stale Context Warning for Text-Only Circuit Replies */}
                  {msg.role === "assistant" &&
                    msg.id !== "welcome_1" &&
                    !msg.isStreaming &&
                    msg.wasCircuitQuery &&
                    !(msg.proposal && msg.proposal.actions.length > 0) &&
                    (msg.baseRevisionHash !== revision ||
                      (msg.baseInteractionRev !== undefined && msg.baseInteractionRev !== interactionRevision)) && (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px] text-amber-300">
                        Canvas or live wiring state changed after this reply — ask Xen again to inspect the latest revision.
                      </p>
                    )}

                  {/* Structured Repair Proposal Card */}
                  {msg.proposal && msg.proposal.actions.length > 0 && (
                    <div className="mt-3 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                          <Wrench size={13} />
                          <span>Structured Repair Proposal</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Confidence: {(msg.proposal.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Diff Items */}
                      <div className="space-y-1.5 text-[11px] font-mono">
                        {msg.proposal.actions.map((act, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded bg-slate-900/80 px-2 py-1 text-slate-300"
                          >
                            {act.type === "connect" && (
                              <>
                                <span className="rounded bg-emerald-950 px-1 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-800">
                                  + WIRE
                                </span>
                                <span>{act.from}</span>
                                <ArrowRight size={10} className="text-slate-500" />
                                <span>{act.to}</span>
                              </>
                            )}
                            {act.type === "disconnect" && (
                              <>
                                <span className="rounded bg-red-950 px-1 py-0.2 text-[9px] font-bold text-red-400 border border-red-800">
                                  - DISCONNECT
                                </span>
                                <span>Wire ID {act.wireId}</span>
                              </>
                            )}
                            {act.type === "change_prop" && (
                              <>
                                <span className="rounded bg-blue-950 px-1 py-0.2 text-[9px] font-bold text-blue-400 border border-blue-800">
                                  MOD PROP
                                </span>
                                <span>
                                  {act.partId}.{act.propName} = {act.propValue}Ω
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Simulator-in-the-loop Verification Result */}
                      {msg.verification && (
                        <div
                          className={`mt-2 rounded-lg border p-2 text-[11px] flex items-center justify-between ${
                            msg.verification.verified
                              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                              : "bg-red-950/40 border-red-500/30 text-red-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck
                              size={14}
                              className={msg.verification.verified ? "text-emerald-400" : "text-red-400"}
                            />
                            <span className="font-semibold">
                              {msg.verification.status === "VERIFIED_WORKING"
                                ? "Solver and electrical checks passed"
                                : "Simulation checks failed"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.applied ? "Applied" : "Staged"}
                          </span>
                        </div>
                      )}

                      {/* Stale Revision Notice */}
                      {!msg.applied && (msg.baseRevisionHash !== revision || msg.baseCircuitRev !== circuitRevision) && (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px] text-amber-300">
                          Canvas changed since this diagnosis — ask Xen again to refresh this repair.
                        </p>
                      )}

                      {/* Action Buttons: Apply Fix & Undo */}
                      <div className="flex items-center gap-2 pt-1">
                        {!msg.applied ? (
                          <button
                            type="button"
                            disabled={msg.baseRevisionHash !== revision || msg.baseCircuitRev !== circuitRevision}
                            title={msg.baseRevisionHash !== revision || msg.baseCircuitRev !== circuitRevision ? "Circuit changed. Request a fresh diagnosis." : undefined}
                            onClick={() => handleApplyFix(msg.id, msg.proposal!, msg.baseRevisionHash!, msg.baseCircuitRev)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-900/30 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-600 transition"
                          >
                            <CheckCircle2 size={13} />
                            <span>Apply Fix to Canvas</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUndoFix(msg.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                          >
                            <RotateCcw size={13} />
                            <span>Undo Repair</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Live Thinking / Generation Status */}
            {isDiagnosing && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs py-2 animate-pulse">
                <Activity size={14} className="animate-spin" />
                <span>{streamingStatus || "Xen is analyzing circuit equations..."}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 p-3 select-none"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about this circuit in English or Hinglish..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isDiagnosing}
              className="rounded-xl bg-cyan-600 p-2 text-white shadow-md hover:bg-cyan-500 transition disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </aside>
      )}
    </>
  )
}
