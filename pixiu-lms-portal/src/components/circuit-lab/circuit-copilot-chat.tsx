/**
 * PIXIU TECH CYBERLAB — 8SQUARE AI CIRCUIT COPILOT CHAT & AUTONOMOUS REPAIR DRAWER
 *
 * Interactive in-situ movable circuit assistant powered by 8square AI (Xen Step-700).
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
import type { CircuitState } from "@/lib/circuit-types"
import type { ArduinoPinState } from "@/lib/simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { UseCircuitCopilotActionResult, CircuitCopilotProposal } from "./use-circuit-copilot-action"
import { computeCircuitHash } from "@/lib/circuit-validator"
import {
  serializeCircuitContext,
  verifyCircuitWithSimulator,
  processCircuitCopilotQuery,
  type CircuitFault,
  type StructuredRepairProposal,
  type SimulatorVerificationResult,
  type CircuitDiagnosisContext,
} from "@/lib/circuit-intelligence"
import { CATALOG } from "@/lib/components-catalog"
import { getBoardDefinition } from "@/lib/board-registry"
import { detectAffirmativeContinuation } from "@/lib/ai/xen/affirmative-detector.js"
import { isCircuitSpecificQuery } from "@/lib/ai/xen/circuit-query-classifier.js"
import { splitXenResponse } from "@/lib/ai/xen/xen-sanitizer.js"
import { XenMarkdown } from "../xen/XenMarkdown.jsx"
import { streamXenChat } from "@/lib/ai/xen/xen-client.js"

import { loadLessonProgress, type Lesson } from "@/lib/lesson-engine"

const EIGHT_SQUARE_LOGO = "/img/8square-logo.svg"

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
  activeBoard?: string
  runtime?: Record<string, PartRuntime>
  pinStates?: Record<string, ArduinoPinState>
  copilotAction?: UseCircuitCopilotActionResult
  onHighlightParts?: (partIds: string[]) => void
  lessonContext?: LessonContextData | null
  isOpen?: boolean
  onToggleOpen?: () => void
  offlineTimeoutMs?: number
  [key: string]: unknown
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  baseRevisionHash?: string
  proposal?: StructuredRepairProposal
  verification?: SimulatorVerificationResult
  faults?: CircuitFault[]
  timestamp: number
  applied?: boolean
  isStreaming?: boolean
}

export function CircuitCopilotChat({
  currentCircuit = { parts: [], wires: [] },
  currentBlocklyXml = "",
  running = false,
  activeBoard,
  userRole,
  meter, scope,
  runtime = {},
  pinStates = {},
  copilotAction,
  onHighlightParts,
  lessonContext = null,
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_1",
      role: "assistant",
      text: "Hello! I am **8square**, your AI Circuit Copilot powered by **Xen Step-700**.\n\nI can inspect your live virtual circuit, identify wiring mistakes, explain electrical flow, and repair faults directly on your canvas. What are you building today?",
      timestamp: Date.now(),
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
      multimeterProbes: meter, oscilloscopeProbes: scope,
      runtime,
      pinStates,
      running,
    })
  }, [currentCircuit, currentBlocklyXml, runtime, pinStates, running, meter, scope])

  const healthScore = circuitContext.healthReport.score
  const hasCritical = circuitContext.healthReport.criticalCount > 0
  const hasWarning = circuitContext.healthReport.warningCount > 0

  // Build context envelope for prompt grounding
  const buildContextEnvelope = useCallback((affirmativeAction?: ReturnType<typeof detectAffirmativeContinuation>) => {
    const progress = lessonContext?.progressScope ? loadLessonProgress(lessonContext.progressScope)[lessonContext.id] : undefined
    const checkpoint = progress ? lessonContext?.steps?.find(step => !progress.completedStepIds.includes(step.id)) : lessonContext?.checkpoint

    const boardDef = activeBoard ? getBoardDefinition(activeBoard) : undefined
    const boardId = activeBoard || boardDef?.id || circuitContext.board?.id || "arduino-uno"
    const boardName = boardDef?.name || circuitContext.board?.name || "Arduino Uno R3"
    const logicVoltage = boardDef?.logicVoltage ?? circuitContext.board?.logicVoltage ?? 5.0

    const powerPins = boardDef?.powerPins || {
      v5: ["5v"],
      v33: ["3v3"],
      gnd: ["gnd", "gnd_pwr"],
      vin: ["vin"],
    }
    const powerPinIds = [
      ...(powerPins.v5 || []),
      ...(powerPins.v33 || []),
      ...(powerPins.vin || []),
    ]
    const groundPinIds = powerPins.gnd || ["gnd", "gnd_pwr"]

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

    // Connections (Wires) with net and pin labels
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

    // Multimeter and oscilloscope simulated readings
    const simulatedReadings = (circuitContext.measurements || []).map((m) => ({
      instrument: m.instrument,
      value: m.value,
      unit: m.unit,
      probeA: m.probeA,
      probeB: m.probeB,
      mode: m.mode,
      source: "simulated" as const,
    }))

    // Health report
    const healthReport = {
      score: circuitContext.healthReport.score,
      criticalCount: circuitContext.healthReport.criticalCount,
      warningCount: circuitContext.healthReport.warningCount,
      issues: (circuitContext.healthReport.issues || []).map((issue) => ({
        ruleId: issue.id,
        severity: issue.severity,
        title: issue.title,
        message: issue.message,
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

    return {
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
        // Board
        board: {
          id: boardId,
          name: boardName,
          logicVoltage,
          logic_voltage: logicVoltage,
          powerPins,
          power_pins: powerPins,
          powerPinIds,
          power_pin_ids: powerPinIds,
          groundPinIds,
          ground_pin_ids: groundPinIds,
        },

        // Components
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

        // Connections
        connections,
        wires: currentCircuit.wires.slice(0, 32).map(({ from, to }) => ({ from, to })),
        wires_count: currentCircuit.wires.length,
        summary: `${currentCircuit.parts.length} components, ${currentCircuit.wires.length} wires`,

        // Simulation
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

        // Code
        code: {
          blocks: blockTypes,
          block_types: blockTypes,
          blockTypes,
          pinBindings: blocklyPinBindings,
          pin_bindings: blocklyPinBindings,
        },

        // Metadata
        metadata: {
          revision,
          timestamp: Date.now(),
          partial: false,
        },
        revision,
        timestamp: Date.now(),
        partial: false,
      },
      blockly: {
        blocks: typeof DOMParser !== "undefined" && currentBlocklyXml
          ? Array.from(new DOMParser().parseFromString(currentBlocklyXml, "application/xml").querySelectorAll("block"))
              .slice(0, 20)
              .map((block) => {
                const pin = block.querySelector(':scope > field[name="PIN"]')?.textContent
                return [block.getAttribute("type"), pin].filter(Boolean).join(" ")
              })
          : [],
        has_code: Boolean(currentBlocklyXml && currentBlocklyXml.length > 40),
        summary: currentBlocklyXml ? "Blockly blocks placed on workspace" : "No code blocks placed",
        pin_bindings: blocklyPinBindings,
      },
      affirmativeAction: affirmativeAction || undefined,
      affirmative_action: affirmativeAction || undefined,
    }
  }, [lessonContext, revision, circuitContext, currentCircuit, running, activeBoard, healthScore, currentBlocklyXml, pinStates, runtime])

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
      const isCircuitQuery = isCircuitSpecificQuery(query, messages)
      setStreamingStatus(isCircuitQuery ? "8square is analyzing circuit & preparing guidance..." : "8square is thinking...")

      // Pre-calculate simulator-in-the-loop repair proposal only for circuit-specific queries
      const localResult = isCircuitQuery
        ? processCircuitCopilotQuery(query, circuitContext)
        : { reply: "", highlightPartIds: [], proposal: undefined, verification: undefined }
      if (localResult.highlightPartIds && localResult.highlightPartIds.length > 0 && onHighlightParts) {
        onHighlightParts(localResult.highlightPartIds)
      }

      // Add placeholder assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: streamMsgId,
          role: "assistant",
          text: "",
          baseRevisionHash: revision,
          proposal: localResult.proposal,
          verification: localResult.verification,
          faults: localResult.proposal?.faults,
          timestamp: Date.now(),
          applied: false,
          isStreaming: true,
        },
      ])

      const contextEnvelope = isCircuitQuery ? buildContextEnvelope(affirmativeAction) : null
      let streamSucceeded = false
      let fallbackReason = "GPU response unavailable"

      try {
        const streamResult = await streamXenChat({
          signal: controller.signal,
          prompt: query,
          intent: userRole?.toLowerCase() === "admin" ? "TEACHING_REVIEW" : isLessonKickoff ? "LAB_TEACHING" : "TEACHING",
          contextEnvelope,
          offlineTimeoutMs,
          history: messages.filter(m => m.id !== "welcome_1" && !m.isStreaming && m.text)
            .slice(-6).map(m => ({ role: m.role, content: m.text.slice(0, 1000) })),
          idempotencyKey: isLessonKickoff ? lessonContext?.launchId : undefined,
          onStatusUpdate: (info) => {
            if (info.workerAvailable === false) {
              setStreamingStatus("GPU worker offline — switching to local diagnosis...")
            } else if (info.status === "queued") {
              setStreamingStatus(`8square queued (position ${info.queuePosition || 1})...`)
            } else if (info.status === "running") {
              setStreamingStatus("8square is thinking...")
            } else if (info.status === "streaming") {
              setStreamingStatus("8square is writing response...")
            }
          },
          onChunk: (delta, fullText) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, text: fullText, isStreaming: true }
                  : m
              )
            )
          },
        })

        if (streamResult.success && streamResult.response?.text) {
          streamSucceeded = true
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId
                ? {
                    ...m,
                    text: streamResult.response.text,
                    isStreaming: false,
                  }
                : m
            )
          )
        } else if (streamResult?.error?.code === "WORKER_OFFLINE") {
          fallbackReason = "GPU worker offline"
        }
      } catch {
        // Fallback gracefully to local Circuit Intelligence engine
        streamSucceeded = false
      }

      // If streaming didn't return text, use local pedagogical reply
      if (!streamSucceeded) {
        let fallbackText = localResult.reply
        if (!isCircuitQuery) {
          if (/kinetic|enerf|kitnetic/i.test(query)) {
            fallbackText = "**Kinetic Energy**\n\n$$\\mathrm{KE} = \\frac{1}{2}mv^2$$\n\nwhere:\n- $m$ = mass of the object\n- $v$ = velocity of the object"
          } else if (/newton/i.test(query)) {
            fallbackText = "**Newton's Second Law of Motion**\n\n$$\\vec{F} = m\\vec{a}$$\n\nwhere:\n- $\\vec{F}$ is net force applied\n- $m$ is mass of the object\n- $\\vec{a}$ is acceleration produced"
          } else {
            fallbackText = "I am ready to assist you with Physics, STEM concepts, formulas, or your CyberLab circuit."
          }
        } else if (affirmativeAction?.detected) {
          if (affirmativeAction.actionType === "latex_formatting") {
            fallbackText = "Here is the mathematical formula in LaTeX:\n\n$$V = I \\times R$$\n\nWhere:\n- $V$ is Voltage (Volts, $\\text{V}$)\n- $I$ is Current (Amperes, $\\text{A}$)\n- $R$ is Resistance (Ohms, $\\Omega$)"
          } else if (affirmativeAction.actionType === "circuit_diagnosis") {
            fallbackText = localResult.reply || "Let us inspect the circuit wiring and verify every pin connection."
          } else if (affirmativeAction.actionType === "code_generation") {
            fallbackText = "Here is the code for your circuit:\n\n```cpp\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n```"
          }
        } else if (isLessonKickoff && lessonContext) {
          fallbackText =
            `Welcome to **${lessonContext.title}**!\n\n` +
            `**Mission Objective:** ${lessonContext.description || "Build and test this circuit safely."}\n\n` +
            `**Key Concepts:** ${(lessonContext.concepts || []).join(", ")}.\n\n` +
            (lessonContext.checkpoint
              ? `**Current checkpoint:** ${lessonContext.checkpoint.title}\n${lessonContext.checkpoint.instructions}`
              : "Let's inspect your breadboard and start wiring!")
        }

        const finalText = isCircuitQuery ? `Local circuit guidance (${fallbackReason})\n\n${fallbackText}` : fallbackText
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? {
                  ...m,
                  text: finalText,
                  isStreaming: false,
                }
              : m
          )
        )
      }

      requestRef.current = null
      setIsDiagnosing(false)
      setStreamingStatus(null)
    },
    [userRole, revision, circuitContext, onHighlightParts, buildContextEnvelope, lessonContext, messages, offlineTimeoutMs]
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

  // Handle Apply Fix action
  const handleApplyFix = useCallback(
    (messageId: string, proposal: StructuredRepairProposal, baseRevisionHash: string) => {
      if (!copilotAction) return

      const actionProposal: CircuitCopilotProposal = {
        id: `repair_${Date.now()}`,
        title: "8square Circuit Repair",
        rationale: proposal.diagnosis,
        baseRevisionHash,
        circuit: proposal.repairedCircuit,
        blocklyXml: proposal.repairedBlocklyXml || currentBlocklyXml,
      }

      const stageResult = copilotAction.proposeAction(actionProposal)
      if (stageResult.valid) {
        const applied = copilotAction.applyProposal(actionProposal)
        if (applied) {
          const liveVerification = verifyCircuitWithSimulator(
            currentCircuit,
            proposal.repairedCircuit,
            pinStates,
            proposal.repairedBlocklyXml || currentBlocklyXml
          )

          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    applied: true,
                    verification: liveVerification,
                  }
                : m
            )
          )
        }
      }
    },
    [copilotAction, currentCircuit, currentBlocklyXml, pinStates]
  )

  // Handle Undo Fix action
  const handleUndoFix = useCallback(
    (messageId: string) => {
      if (!copilotAction || !copilotAction.canUndo) return
      const undone = copilotAction.undoProposal()
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
          aria-label="Open 8square AI Circuit Copilot"
          title="Open 8square AI · Circuit Intelligence & Autonomous Repair"
        >
          <img src={EIGHT_SQUARE_LOGO} alt="" className="h-5 w-5 object-contain" />
          <span className="font-extrabold tracking-wide">8square AI</span>
          <Sparkles size={13} className="text-cyan-300 animate-pulse" />

          {/* Real-time Health Badge */}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              hasCritical
                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                : hasWarning
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            }`}
          >
            {healthScore}%
          </span>
        </button>
      )}

      {/* Minimized Floating Pill Dock */}
      {isOpen && isMinimized && (
        <div
          role="region"
          tabIndex={-1}
          ref={dockRef}
          aria-label="8square Minimized Pill"
          className="fixed bottom-6 right-6 md:right-10 z-[85] flex items-center gap-2.5 rounded-full border border-cyan-400/50 bg-[#070d19]/95 px-4 py-2 text-xs font-bold text-white shadow-2xl shadow-cyan-950/60 backdrop-blur-xl animate-in fade-in zoom-in-95"
        >
          <img src={EIGHT_SQUARE_LOGO} alt="" className="h-5 w-5 object-contain" />
          <span className="font-extrabold text-cyan-200">8square AI</span>

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
              title="Expand 8square Window"
              aria-label="Expand 8square Window"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Close 8square"
              aria-label="Close 8square"
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
          aria-label="8square Circuit Copilot Panel"
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
              <img src={EIGHT_SQUARE_LOGO} alt="8square AI" className="h-6 w-6 object-contain pointer-events-none" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-white">8square AI</h3>
                  <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400 border border-cyan-800/50">
                    Xen Step-700
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
                    : "bg-emerald-950/80 text-emerald-400 border border-emerald-700/50"
                }`}
              >
                {hasCritical ? (
                  <AlertOctagon size={11} />
                ) : hasWarning ? (
                  <AlertTriangle size={11} />
                ) : (
                  <CheckCircle2 size={11} />
                )}
                <span>{healthScore}%</span>
              </span>

              {/* Minimize Button */}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsMinimized(true)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                aria-label="Minimize 8square Window"
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
                aria-label="Close 8square Panel"
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
                  className={`max-w-[92%] rounded-2xl p-3.5 shadow-md ${
                    msg.role === "user"
                      ? "bg-cyan-600 text-white rounded-tr-none font-medium"
                      : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none space-y-3"
                  }`}
                >
                  {/* Markdown / Formatted Text */}
                  <div className="leading-relaxed">
                    {msg.text ? splitXenResponse(msg.text).map((section, index) =>
                      section.type === "code"
                        ? <pre key={index} className="overflow-x-auto whitespace-pre p-2 rounded bg-slate-950 font-mono text-cyan-300 border border-slate-800 my-1 text-xs"><code>{section.code}</code></pre>
                        : <XenMarkdown key={index} content={section.content} isUser={msg.role === "user"} />
                    ) : (msg.isStreaming ? "..." : "")}
                  </div>

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
                                ? "Simulator Verified (MNA Valid)"
                                : "Simulation checks failed"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.applied ? "Applied" : "Staged"}
                          </span>
                        </div>
                      )}

                      {/* Stale Revision Notice */}
                      {!msg.applied && msg.baseRevisionHash !== revision && (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-2.5 py-1 text-[10px] text-amber-300">
                          Canvas changed since this diagnosis — ask 8square again to refresh this repair.
                        </p>
                      )}

                      {/* Action Buttons: Apply Fix & Undo */}
                      <div className="flex items-center gap-2 pt-1">
                        {!msg.applied ? (
                          <button
                            type="button"
                            disabled={msg.baseRevisionHash !== revision}
                            title={msg.baseRevisionHash !== revision ? "Circuit changed. Request a fresh diagnosis." : undefined}
                            onClick={() => handleApplyFix(msg.id, msg.proposal!, msg.baseRevisionHash!)}
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
                <span>{streamingStatus || "8square is analyzing circuit equations..."}</span>
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
