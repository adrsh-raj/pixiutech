"use client"
import "./workbench.css"

import { lazy, Suspense, useCallback, useMemo, useRef, useState, useEffect } from "react"
import type { CircuitState, PartType, PinRef, PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"
import { samePin } from "@/lib/geometry"
import { computeRuntime, type ArduinoPinState } from "@/lib/simulation"
import { defineArduinoBlocks, setAiClassContext, arduino, normalizeBlocklyXml } from "@/lib/arduino-blocks"
import { runBlocklyProgram, executeStatement, type ExecutionEnvironment, type BlockStepInfo } from "@/lib/blockly-runner"
import { virtualWifiManager, type VirtualWifiState } from "@/lib/virtual-wifi"
import { IotWebPortal } from "./iot-web-portal"
import { LabSupportWidget } from "./lab-support-widget"
import { MICROBIT_ICONS, MICROBIT_DIGITS, createEmptyMatrix } from "@/lib/microbit-patterns"
import { audioEngine } from "@/lib/audio-engine"
import { createHistory, pushState, undo as historyUndo, redo as historyRedo, canUndo, canRedo, type HistoryState } from "@/lib/history"
import { saveCircuit, saveCurrentCircuit, clearCurrentCircuit, importFromJSON, exportAsJSON, type SavedCircuit } from "@/lib/storage"
import * as Blockly from "blockly"
import { Boxes, Camera, Sparkles, Terminal, Trash2, Gauge, Sliders, ShieldAlert, RotateCw, Copy, X, Smartphone } from "lucide-react"
import { computeWireCurrents } from "@/lib/current-flow"
import { isBoardPart, getActiveBoard, scaleAdcReading, lookupBoardPinState } from "@/lib/board-registry"
import { solveCircuitNodalPotentials } from "@/lib/circuit-solver"
import { Multimeter } from "./multimeter"
import { Oscilloscope } from "./oscilloscope"
import { CircuitCanvas } from "./circuit-canvas"
import { Inspector } from "./inspector"
import { Palette } from "./palette"
import { Toolbar, type WorkbenchView } from "./toolbar"
import { BlocklyEditor } from "./blockly-editor"
import { SerialMonitor, type SerialLine } from "./serial-monitor"
import { StatusBar } from "./status-bar"
import { TemplateBrowser } from "./template-browser"
const AiCameraPanel = lazy(() => import("./ai-camera-panel").then((module) => ({ default: module.AiCameraPanel })))
import { LessonBrowser } from "./lesson-browser"
import type { AiVisionState } from "@/lib/ai/vision-types"
import { createAiVisionState } from "@/lib/ai/vision-state"
import { normalizeAiVisionState } from "@/lib/ai/ai-result-normalizer"
const AiStudioPanel = lazy(() => import("./ai-studio-panel").then((module) => ({ default: module.AiStudioPanel })))
import { ContextMenu, type ContextMenuTarget } from "./context-menu"
import type { ProjectTemplate } from "@/lib/templates"
import { getLessonSeed, getLessonById, type Lesson } from "@/lib/lesson-engine"
import { ProjectManager } from "./project-manager"
import { WelcomeOverlay } from "./welcome-overlay"
import { CircuitDoctorHud } from "./circuit-doctor-hud"
import { diagnoseCircuit } from "@/lib/circuit-doctor"
import { buildInoSketch, triggerInoDownload } from "@/lib/sketch-exporter"
import { awardCreationXp, awardTinkeringXp, syncXpWithServer, setActiveStudentId, setUserRole } from "@/lib/xp-engine"

function PixiuModuleLoading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/96 p-2 text-white sm:p-3">
      <div className="flex h-[min(98vh,1080px)] w-[calc(100vw-8px)] max-w-[1800px] items-center justify-center rounded-3xl border border-violet-400/20 bg-slate-900/95 p-8 text-center shadow-2xl shadow-violet-950/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300">
          <Sparkles size={24} className="animate-pulse" />
        </div>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">PIXIU TECH</p>
        <h2 className="mt-2 text-lg font-black">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p>
        <div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-400" />
        </div>
      </div>
    </div>
  )
}


const DEFAULT_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
  </block>
</xml>`

const INITIAL_STATE: CircuitState = {
  parts: [],
  wires: [],
}

function findCircuitLedPinMappings(currentState: CircuitState, activeBoard: ReturnType<typeof getActiveBoard>) {
  const boardPart = currentState.parts.find((pt) => isBoardPart(pt.type))
  const builtIn = activeBoard?.builtInLedPin ?? (activeBoard?.id === "esp32-devkit" ? "d2" : activeBoard?.id === "arduino-uno" ? "d13" : "gp25")
  const ledParts = currentState.parts.filter((pt) => pt.type === "led")
  const mappings: { partId: string; color: string; pinId: string; cleanPin: string }[] = []

  if (!boardPart) return { mappings, builtIn }

  const adj = new Map<string, string[]>()
  const addEdge = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, [])
    if (!adj.has(v)) adj.set(v, [])
    adj.get(u)!.push(v)
    adj.get(v)!.push(u)
  }

  for (const w of currentState.wires) {
    addEdge(`${w.from.partId}:${w.from.pinId}`, `${w.to.partId}:${w.to.pinId}`)
  }

  for (const pt of currentState.parts) {
    if (pt.type === "resistor") {
      addEdge(`${pt.id}:a`, `${pt.id}:b`)
    } else if (pt.type === "breadboard") {
      for (let c = 1; c <= 20; c++) {
        const top = ["a", "b", "c", "d", "e"]
        for (let i = 0; i < top.length - 1; i++) {
          addEdge(`${pt.id}:${top[i]}_${c}`, `${pt.id}:${top[i + 1]}_${c}`)
        }
        const bot = ["f", "g", "h", "i", "j"]
        for (let i = 0; i < bot.length - 1; i++) {
          addEdge(`${pt.id}:${bot[i]}_${c}`, `${pt.id}:${bot[i + 1]}_${c}`)
        }
      }
    }
  }

  const isBoardDigitalPin = (pinId: string) => {
    if (!activeBoard) return false
    const lower = pinId.toLowerCase()
    if (lower.includes("gnd") || lower.includes("3v") || lower.includes("5v") || lower.includes("vin") || lower === "rst") return false
    return activeBoard.pins.some((bp) => bp.id.toLowerCase() === lower && bp.kind === "digital")
  }

  for (const led of ledParts) {
    const color = String(led.props?.color ?? "red").toLowerCase()
    let foundPin: string | null = null

    for (const startPin of ["anode", "cathode"]) {
      const startNode = `${led.id}:${startPin}`
      const queue = [startNode]
      const visited = new Set<string>([startNode])

      while (queue.length > 0) {
        const curr = queue.shift()!
        const [pId, pinId] = curr.split(":")
        if (pId === boardPart.id && isBoardDigitalPin(pinId)) {
          foundPin = pinId
          break
        }
        for (const neighbor of adj.get(curr) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push(neighbor)
          }
        }
      }
      if (foundPin) break
    }

    if (foundPin) {
      mappings.push({
        partId: led.id,
        color,
        pinId: foundPin,
        cleanPin: foundPin.replace(/^(gpio|gp|d|p)/i, ""),
      })
    }
  }

  return { mappings, builtIn }
}

interface WorkbenchProps {
  userRole?: string
  pixiuId?: string
  accountId?: string | number
}

export function Workbench({ userRole, pixiuId, accountId }: WorkbenchProps = {}) {
  const projectStorageScope = useMemo(
    () => `${String(userRole || "user").toLowerCase()}:${String(pixiuId || accountId || "account")}`,
    [accountId, pixiuId, userRole],
  )
  useEffect(() => {
    if (userRole) {
      setUserRole(userRole)
      setActiveStudentId(userRole.toLowerCase() === "student" ? pixiuId || null : null)
    }
  }, [pixiuId, userRole])
  const [history, setHistory] = useState<HistoryState<CircuitState>>(() => createHistory(INITIAL_STATE))
  const state = history.present

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)
  const [activeWireColor, setActiveWireColor] = useState<string>("#22c55e")
  const [wiring, setWiring] = useState<PinRef | null>(null)
  const [running, setRunning] = useState(false)
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const pressedRef = useRef<Set<string>>(new Set())
  const [view, setView] = useState<WorkbenchView>("circuit")
  const [pinStates, setPinStates] = useState<Record<string, ArduinoPinState>>({})
  const pinStatesRef = useRef<Record<string, ArduinoPinState>>({})
  useEffect(() => {
    pinStatesRef.current = pinStates
  }, [pinStates])
  const [blocklyXml, setBlocklyXml] = useState<string>(DEFAULT_XML)
  const [blocklyDocumentVersion, setBlocklyDocumentVersion] = useState(0)
  const [serialLines, setSerialLines] = useState<SerialLine[]>([])
  const [isSerialOpen, setIsSerialOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [runTime, setRunTime] = useState(0)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState("Untitled Circuit")
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isLessonsOpen, setIsLessonsOpen] = useState(false)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [isAiCameraOpen, setIsAiCameraOpen] = useState(false)
  const [isAiStudioOpen, setIsAiStudioOpen] = useState(false)
  const [aiRuntimeEnabled, setAiRuntimeEnabled] = useState(false)
  const [aiCameraCompact, setAiCameraCompact] = useState(false)
  const [aiRequestedMode, setAiRequestedMode] = useState<"objects" | "pose" | "hands" | "emotion" | "sound" | "numbers" | "trained" | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: ContextMenuTarget
  } | null>(null)

  const [isDmmOpen, setIsDmmOpen] = useState(false)
  const [probeRed, setProbeRed] = useState<PinRef | null>(null)
  const [probeBlack, setProbeBlack] = useState<PinRef | null>(null)
  const [activeProbeToPlace, setActiveProbeToPlace] = useState<"red" | "black" | null>(null)

  const [isScopeOpen, setIsScopeOpen] = useState(false)
  const [scopeProbeCH1, setScopeProbeCH1] = useState<PinRef | null>(null)
  const [scopeProbeCH2, setScopeProbeCH2] = useState<PinRef | null>(null)
  const [activeScopeProbeToPlace, setActiveScopeProbeToPlace] = useState<"ch1" | "ch2" | null>(null)

  // Virtual Wi-Fi & micro:bit v2 state
  const [isIotPortalOpen, setIsIotPortalOpen] = useState(false)
  const [wifiState, setWifiState] = useState<VirtualWifiState>(() => virtualWifiManager.getState())
  const [microbitMatrix, setMicrobitMatrix] = useState<boolean[][]>(() => createEmptyMatrix())
  const currentHttpRouteRef = useRef<string>("/")

  useEffect(() => {
    return virtualWifiManager.subscribe((st) => {
      setWifiState(st)
    })
  }, [])

  // Schematic view mode & AI Doctor state
  const [schematicMode, setSchematicMode] = useState(false)
  const [isDoctorOpen, setIsDoctorOpen] = useState(false)
  const [highlightPartIds, setHighlightPartIds] = useState<string[]>([])

  // Stepping debugger state & refs
  const [isPaused, setIsPaused] = useState(false)
  const [debugSpeed, setDebugSpeed] = useState<"normal" | "slow" | "step">("normal")
  const [activeStepBlock, setActiveStepBlock] = useState<BlockStepInfo | null>(null)

  const isPausedRef = useRef(false)
  const debugSpeedRef = useRef<"normal" | "slow" | "step">("normal")
  const stepResolverRef = useRef<(() => void) | null>(null)
  const visualWorkspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const saveNowRef = useRef<() => void>(() => {})

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // A fresh Lab session is intentionally blank. Existing projects are opened
  // explicitly through Projects so an old circuit never masquerades as a new one.
  useEffect(() => {
    setStorageReady(true)
    void syncXpWithServer()
  }, [])

  useEffect(() => {
    debugSpeedRef.current = debugSpeed
  }, [debugSpeed])

  // Resize Blockly workspace whenever user switches to "code" view
  useEffect(() => {
    if (view === "code" && visualWorkspaceRef.current) {
      const timer = setTimeout(() => {
        if (visualWorkspaceRef.current) {
          Blockly.svgResize(visualWorkspaceRef.current)
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [view])

  // Ensure that whenever a Beginner mission is active, its Blockly code is automatically loaded
  useEffect(() => {
    if (!activeLessonId) return
    const lesson = getLessonById(activeLessonId)
    if (!lesson || lesson.difficulty !== "Beginner") return

    const seed = getLessonSeed(lesson)
    if (!seed.blocklyXml) return

    const isBlank =
      !blocklyXml ||
      blocklyXml.trim() === DEFAULT_XML.trim() ||
      blocklyXml.includes('<block type="arduino_program" x="40" y="40"></block>') ||
      blocklyXml.includes('<block type="arduino_program" x="40" y="40">\n  </block>') ||
      blocklyXml.includes('<block type="arduino_program" x="40" y="40">\r\n  </block>')

    if (isBlank && seed.blocklyXml !== blocklyXml) {
      setBlocklyXml(seed.blocklyXml)
      setBlocklyDocumentVersion((v) => v + 1)
    }
  }, [activeLessonId, blocklyXml])

  const handleProbeClip = useCallback((ref: PinRef) => {
    if (activeProbeToPlace === "red") {
      setProbeRed(ref)
      setActiveProbeToPlace(null)
    } else if (activeProbeToPlace === "black") {
      setProbeBlack(ref)
      setActiveProbeToPlace(null)
    }
  }, [activeProbeToPlace])

  const handleScopeProbeClip = useCallback((ref: PinRef) => {
    if (activeScopeProbeToPlace === "ch1") {
      setScopeProbeCH1(ref)
      setActiveScopeProbeToPlace(null)
    } else if (activeScopeProbeToPlace === "ch2") {
      setScopeProbeCH2(ref)
      setActiveScopeProbeToPlace(null)
    }
  }, [activeScopeProbeToPlace])

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, target })
  }, [])
  const [aiState, setAiState] = useState<AiVisionState>(() => createAiVisionState("objects"))
  const aiStateRef = useRef(aiState)
  const handleAiStateChange = useCallback(
    (nextState: AiVisionState) => {
      const normalized = normalizeAiVisionState(nextState)
      aiStateRef.current = normalized
      setAiState(normalized)
    },
    [],
  )
  useEffect(() => {
    aiStateRef.current = aiState
  }, [aiState])

  // Keep Blockly AI dropdowns in sync with the student’s learned concepts.
  useEffect(() => {
    setAiClassContext(aiState.modelClasses ?? [])
  }, [aiState.modelClasses])

  const runnerAbortRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)
  const addCounter = useRef(0)
  const partsRef = useRef(state.parts)
  const stateRef = useRef(state)

  useEffect(() => {
    partsRef.current = state.parts
    stateRef.current = state
  }, [state])

  // Synchronize dynamic IoT sensor telemetry to virtual web server responses
  useEffect(() => {
    virtualWifiManager.setBodyTransformer((rawBody) => {
      if (!rawBody) return rawBody
      let text = rawBody
      const parts = partsRef.current
      const dht = parts.find((p) => p.type === "dht11")
      const ldr = parts.find((p) => p.type === "ldr")
      const mq2 = parts.find((p) => p.type === "mq2-gas")
      const soil = parts.find((p) => p.type === "soil-moisture")
      const dist = parts.find((p) => p.type === "ultrasonic")
      const pot = parts.find((p) => p.type === "potentiometer")

      const curTemp = dht?.props?.temperature ?? 25
      const curHum = dht?.props?.humidity ?? 55
      const curLux = ldr?.props?.light ?? 512
      const curGas = mq2?.props?.gasLevel ?? mq2?.props?.gasPpm ?? 120
      const curMoist = soil?.props?.moisture ?? 500
      const curDist = dist?.props?.distance ?? 42
      const curPot = pot?.props?.value ?? 512

      // 1. Explicit placeholder replacements
      text = text
        .replace(/\{\{\s*temp(erature)?\s*\}\}/gi, String(curTemp))
        .replace(/\{\{\s*humidity?\s*\}\}/gi, String(curHum))
        .replace(/\{\{\s*(light|lux)\s*\}\}/gi, String(curLux))
        .replace(/\{\{\s*gas\s*\}\}/gi, String(curGas))
        .replace(/\{\{\s*moisture\s*\}\}/gi, String(curMoist))
        .replace(/\{\{\s*distance\s*\}\}/gi, String(curDist))
        .replace(/\{\{\s*pot\s*\}\}/gi, String(curPot))

      // 2. Dynamically update formatted sensor telemetry strings
      text = text.replace(/(Temperature:\s*)\d+(\.?\d*)\s*(°?C)?/gi, `$1${curTemp}°C`)
      text = text.replace(/(Humidity:\s*)\d+(\.?\d*)\s*(%?)/gi, `$1${curHum}%`)
      text = text.replace(/(Ambient Light:\s*)\d+(\.?\d*)\s*(Lux)?/gi, `$1${curLux} Lux`)
      text = text.replace(/(Gas Level:\s*)\d+(\.?\d*)\s*(ppm)?/gi, `$1${curGas} ppm`)
      text = text.replace(/(Soil Moisture:\s*)\d+(\.?\d*)/gi, `$1${curMoist}`)
      text = text.replace(/(Target Dist:\s*)\d+(\.?\d*)\s*(cm)?/gi, `$1${curDist} cm`)

      return text
    })

    return () => {
      virtualWifiManager.setBodyTransformer(undefined)
    }
  }, [])

  const selected = state.parts.find((p) => p.id === selectedId) ?? null
  const selectedWire = state.wires.find((w) => w.id === selectedWireId) ?? null

  const runtime = useMemo(() => {
    if (!running) return {}
    const baseRuntime = computeRuntime(state, pressed, pinStates)
    const microbitPart = state.parts.find((p) => p.type === "microbit-v2")
    if (microbitPart) {
      const btnA = pressed.has(`${microbitPart.id}_a`) || pressed.has("microbit_a")
      const btnB = pressed.has(`${microbitPart.id}_b`) || pressed.has("microbit_b")
      baseRuntime[microbitPart.id] = {
        ...baseRuntime[microbitPart.id],
        matrix5x5: microbitMatrix,
        btnAPressed: btnA,
        btnBPressed: btnB,
      }
    }
    return baseRuntime
  }, [running, state, pressed, pinStates, microbitMatrix])

  const oscilloscopeSimulationRef = useRef({ state, pinStates, running, pressed })
  oscilloscopeSimulationRef.current = { state, pinStates, running, pressed }

  const wireCurrents = useMemo(
    () => (running ? computeWireCurrents(state, runtime, pinStates, pressed) : {}),
    [running, state, runtime, pinStates, pressed],
  )

  // Calculate total mA consumption across components
  const totalCurrentMa = useMemo(() => {
    return Object.values(runtime).reduce((acc, r) => acc + (r?.currentMa ?? 0), 0)
  }, [runtime])

  // Run timer effect (pauses when debugger is paused)
  useEffect(() => {
    if (!running) {
      setRunTime(0)
      return
    }
    if (isPaused) {
      return
    }
    const timer = setInterval(() => {
      setRunTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [running, isPaused])

  // Audio effect: derive a cheap boolean from runtime, then react only when
  // buzzer ON/OFF actually changes. Runtime itself updates many times per second.
  const anyBuzzerActive = useMemo(
    () => state.parts.some(
      (p) => p.type === "buzzer" && (runtime[p.id]?.level ?? 0) > 0,
    ),
    [runtime, state.parts],
  )
  const buzzerActiveRef = useRef(false)

  useEffect(() => {
    const shouldBeep = running && !isMuted && anyBuzzerActive

    if (shouldBeep && !buzzerActiveRef.current) {
      audioEngine.unlockAudio()
      audioEngine.playTone(850, 180)
      buzzerActiveRef.current = true
    } else if (!shouldBeep && buzzerActiveRef.current) {
      audioEngine.stopTone()
      buzzerActiveRef.current = false
    }
  }, [running, isMuted, anyBuzzerActive])

  // Hard cleanup only when Workbench unmounts.
  useEffect(() => {
    return () => {
      if (buzzerActiveRef.current) {
        audioEngine.stopTone()
        buzzerActiveRef.current = false
      }
    }
  }, [])

  // Helper to commit state changes to history
  const updateState = useCallback((updater: (prev: CircuitState) => CircuitState) => {
    setHistory((h) => {
      const next = updater(h.present)
      return pushState(h, next)
    })
    if (storageReady) setIsDirty(true)
  }, [storageReady])

  const handleUndo = useCallback(() => {
    setHistory((h) => historyUndo(h))
    if (storageReady) setIsDirty(true)
  }, [storageReady])

  const handleRedo = useCallback(() => {
    setHistory((h) => historyRedo(h))
    if (storageReady) setIsDirty(true)
  }, [storageReady])

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).substring(2, 9)}`

  const addPart = useCallback((type: PartType, x?: number, y?: number) => {
    const def = CATALOG[type]
    if (!def) return
    const n = addCounter.current++
    const part: PlacedPart = {
      id: newId(),
      type,
      x: x ?? 160 + (n % 4) * 190,
      y: y ?? 120 + (Math.floor(n / 4) % 3) * 150,
      rotation: 0,
      props: { ...(def.defaults ?? {}) },
    }
    updateState((s) => {
      // Auto-replace unused controller board if student drops a new board
      if (isBoardPart(type)) {
        const unusedBoard = s.parts.find(
          (p) => isBoardPart(p.type) && !s.wires.some((w) => w.from.partId === p.id || w.to.partId === p.id)
        )
        if (unusedBoard) {
          const replacedPart: PlacedPart = {
            ...part,
            x: x ?? unusedBoard.x,
            y: y ?? unusedBoard.y,
          }
          return {
            ...s,
            parts: s.parts.map((p) => (p.id === unusedBoard.id ? replacedPart : p)),
          }
        }
      }
      return { ...s, parts: [...s.parts, part] }
    })
    setSelectedId(part.id)
    setSelectedWireId(null)
  }, [updateState])

  const movePart = useCallback((id: string, x: number, y: number) => {
    updateState((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  }, [updateState])

  const changeProp = useCallback((id: string, k: string, value: string | number) => {
    partsRef.current = partsRef.current.map((p) =>
      p.id === id ? { ...p, props: { ...p.props, [k]: value } } : p
    )
    updateState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, [k]: value } } : p)),
    }))
  }, [updateState])

  const rotatePart = useCallback((id: string) => {
    updateState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    }))
  }, [updateState])

  const deletePart = useCallback((id: string) => {
    updateState((s) => ({
      parts: s.parts.filter((p) => p.id !== id),
      wires: s.wires.filter((w) => w.from.partId !== id && w.to.partId !== id),
    }))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId, updateState])

  const duplicatePart = useCallback((id: string) => {
    const part = state.parts.find((p) => p.id === id)
    if (!part) return
    const dup: PlacedPart = {
      ...part,
      id: newId(),
      x: part.x + 30,
      y: part.y + 30,
    }
    updateState((s) => ({ ...s, parts: [...s.parts, dup] }))
    setSelectedId(dup.id)
    setSelectedWireId(null)
  }, [state.parts, updateState])

  const deleteWire = useCallback((id: string) => {
    updateState((s) => ({ ...s, wires: s.wires.filter((w) => w.id !== id) }))
    if (selectedWireId === id) setSelectedWireId(null)
  }, [selectedWireId, updateState])

  const deleteSelectedWire = useCallback(() => {
    if (selectedWireId) {
      deleteWire(selectedWireId)
    }
  }, [selectedWireId, deleteWire])

  const handleSelectWireColor = useCallback((color: string) => {
    setActiveWireColor(color)
    if (selectedWireId) {
      updateState((s) => ({
        ...s,
        wires: s.wires.map((w) => (w.id === selectedWireId ? { ...w, color } : w)),
      }))
    }
  }, [selectedWireId, updateState])

  const handlePinDown = useCallback((ref: PinRef) => {
    if (!wiring) {
      setWiring(ref)
      setSelectedId(null)
      setSelectedWireId(null)
      return
    }
    if (samePin(wiring, ref)) {
      setWiring(null)
      return
    }

    // Use current wire color
    const color = activeWireColor || "#22c55e"
    updateState((s) => ({
      ...s,
      wires: [
        ...s.wires,
        {
          id: newId(),
          from: wiring,
          to: ref,
          color,
        },
      ],
    }))
    setWiring(null)
  }, [wiring, activeWireColor, updateState])

  const interact = useCallback((id: string, mode: "down" | "up" | boolean) => {
    setPressed((prev) => {
      const next = new Set(prev)
      const isDown = mode === "down" || mode === true
      if (isDown) next.add(id)
      else next.delete(id)
      pressedRef.current = next
      return next
    })
  }, [])

  const stopProgram = useCallback(() => {
    runningRef.current = false
    runnerAbortRef.current?.abort()
    runnerAbortRef.current = null
    if (stepResolverRef.current) {
      const resolve = stepResolverRef.current
      stepResolverRef.current = null
      resolve()
    }
    if (visualWorkspaceRef.current) {
      try {
        visualWorkspaceRef.current.highlightBlock(null)
      } catch (e) {}
    }
    audioEngine.stopTone()
    setPinStates({})
    setIsPaused(false)
    isPausedRef.current = false
    setActiveStepBlock(null)
    virtualWifiManager.reset()
    setMicrobitMatrix(createEmptyMatrix())
    currentHttpRouteRef.current = "/"
  }, [])

  // AI runtime lifecycle is deliberately separate from the Arduino runner.
  // AI Vision Canvas and PIXIU AI Studio are separate interfaces.
  const stopAiRuntime = useCallback(() => {
    setAiRequestedMode(null)
    setAiRuntimeEnabled(false)
    setAiCameraCompact(false)
    setIsAiCameraOpen(false)
  }, [])

  const handleToggleAiVision = useCallback(() => {
    if (isAiCameraOpen) {
      stopAiRuntime()
      return
    }

    // Manual full Vision Canvas. Automatic program execution uses the
    // compact right-side Runtime HUD instead.
    setIsAiStudioOpen(false)
    setAiRequestedMode(null)
    setIsAiCameraOpen(true)
    setAiCameraCompact(false)
    setAiRuntimeEnabled(true)
  }, [isAiCameraOpen, stopAiRuntime])

  const handleAiStudioClose = useCallback(() => {
    setIsAiStudioOpen(false)
  }, [])

  const handleToggleAiStudio = useCallback(() => {
    if (isAiStudioOpen) {
      handleAiStudioClose()
      return
    }

    // Studio is an authoring/learning surface. It is intentionally separate
    // from the integrated runtime canvas.
    stopAiRuntime()
    setIsAiStudioOpen(true)
  }, [handleAiStudioClose, isAiStudioOpen, stopAiRuntime])

  const startProgram = useCallback((startPaused: boolean = false, openAiHud: boolean = true) => {
    stopProgram()
    runningRef.current = true
    const controller = new AbortController()
    runnerAbortRef.current = controller

    if (startPaused) {
      setIsPaused(true)
      isPausedRef.current = true
    }

    // Only run embedded program and AI Vision if a controller board actually exists in the circuit
    const hasController = state.parts.some((p) => isBoardPart(p.type))
    if (!hasController) {
      // Pure DC circuit (battery, resistor, LED, etc.) - no MCU code, no AI camera.
      // Keep the Workbench run-state consistent with the early return.
      runningRef.current = false
      setRunning(false)
      stopAiRuntime()
      return
    }

    // Serialize the currently mounted Blockly editor before Run. The visible workspace
    // is the source of truth; blocklyXml is the fallback during editor hydration.
    const liveWorkspaceForRun = visualWorkspaceRef.current
    const liveWorkspaceXml = liveWorkspaceForRun
      ? Blockly.utils.xml.domToText(Blockly.Xml.workspaceToDom(liveWorkspaceForRun))
      : null
    const currentBlocklyXml = liveWorkspaceXml || blocklyXml

    // Auto-open AI Vision HUD ONLY if current program uses AI Vision blocks
    const usesAi = Boolean(
      currentBlocklyXml.includes('type="ai_') ||
      currentBlocklyXml.includes("ai_detect_objects") ||
      currentBlocklyXml.includes("ai_is_detected") ||
      currentBlocklyXml.includes("ai_is_unknown") ||
      currentBlocklyXml.includes("ai_get_detected_class") ||
      currentBlocklyXml.includes("ai_confidence") ||
      currentBlocklyXml.includes("ai_get_gesture") ||
      currentBlocklyXml.includes("ai_get_finger_count") ||
      currentBlocklyXml.includes("ai_is_gesture") ||
      currentBlocklyXml.includes("ai_camera_enable") ||
      currentBlocklyXml.includes("ai_microphone_enable")
    )
    const usesNumberGestureAi = Boolean(
      currentBlocklyXml.includes("ai_get_gesture") ||
      currentBlocklyXml.includes("ai_get_finger_count") ||
      currentBlocklyXml.includes("ai_is_gesture")
    )
    const programAiMode = usesNumberGestureAi
      ? "numbers"
      : currentBlocklyXml.includes("ai_microphone_enable")
        ? "sound"
        : usesAi
          ? "objects"
          : null
    // Any Arduino program containing AI blocks automatically gets the
    // compact Pixiu Vision Runtime HUD on the right side. This is the
    // execution surface; the full AI Studio remains a separate authoring UI.
    if (usesAi && openAiHud) {
      setIsAiCameraOpen(false)
      setIsAiStudioOpen(false)
      setAiCameraCompact(true)
      setAiRequestedMode(programAiMode)
      setAiRuntimeEnabled(true)
    } else {
      setAiRequestedMode(null)
      setAiCameraCompact(false)
      stopAiRuntime()
    }

    try {
      defineArduinoBlocks()
      const liveWorkspace = visualWorkspaceRef.current
      const liveXml = liveWorkspace
        ? Blockly.utils.xml.domToText(Blockly.Xml.workspaceToDom(liveWorkspace))
        : null
      let workspace: Blockly.Workspace = liveWorkspace ?? new Blockly.Workspace()
      const ownsWorkspace = !liveWorkspace

      // The mounted Blockly editor is the execution source of truth. React XML
      // is only the hydration fallback when the editor is not mounted yet.
      if (!liveWorkspace) {
        const dom = Blockly.utils.xml.textToDom(normalizeBlocklyXml(blocklyXml))
        Blockly.Xml.domToWorkspace(dom, workspace)
      }

      const runnableRoot = workspace.getTopBlocks(true).find((b) => b.type === "arduino_program")
      if (!runnableRoot) {
        throw new Error("No Arduino Program block found. Open Code and add an Arduino program before running.")
      }

      const env: ExecutionEnvironment = {
        setDigitalPin: (pin, state) => {
          const raw = String(pin).trim()
          const digits = raw.replace(/^(gpio|gp|d|p)/i, "")
          setPinStates((prev) => {
            const next = { ...prev, [raw]: { ...prev[raw], state } }
            if (raw.toLowerCase() !== raw) next[raw.toLowerCase()] = { ...next[raw.toLowerCase()], state }
            if (digits) {
              next[digits] = { ...next[digits], state }
              next[`d${digits}`] = { ...next[`d${digits}`], state }
              next[`gpio${digits}`] = { ...next[`gpio${digits}`], state }
              next[`gp${digits}`] = { ...next[`gp${digits}`], state }
              next[`p${digits}`] = { ...next[`p${digits}`], state }
            }
            return next
          })
        },
        setAnalogPin: (pin, value) => {
          const raw = String(pin).trim()
          const digits = raw.replace(/^(gpio|gp|d|p)/i, "")
          const state = value > 0 ? "HIGH" : "LOW"
          setPinStates((prev) => {
            const next = { ...prev, [raw]: { ...prev[raw], state, value } }
            if (raw.toLowerCase() !== raw) next[raw.toLowerCase()] = { ...next[raw.toLowerCase()], state, value }
            if (digits) {
              next[digits] = { ...next[digits], state, value }
              next[`d${digits}`] = { ...next[`d${digits}`], state, value }
              next[`gpio${digits}`] = { ...next[`gpio${digits}`], state, value }
              next[`gp${digits}`] = { ...next[`gp${digits}`], state, value }
              next[`p${digits}`] = { ...next[`p${digits}`], state, value }
            }
            return next
          })
        },
        setServoAngle: (pin, angle) => {
          const raw = String(pin).trim()
          const digits = raw.replace(/^(gpio|gp|d|p)/i, "")
          setPinStates((prev) => {
            const next = { ...prev, [raw]: { ...prev[raw], angle } }
            if (raw.toLowerCase() !== raw) next[raw.toLowerCase()] = { ...next[raw.toLowerCase()], angle }
            if (digits) {
              next[digits] = { ...next[digits], angle }
              next[`d${digits}`] = { ...next[`d${digits}`], angle }
              next[`gpio${digits}`] = { ...next[`gpio${digits}`], angle }
              next[`gp${digits}`] = { ...next[`gp${digits}`], angle }
              next[`p${digits}`] = { ...next[`p${digits}`], angle }
            }
            return next
          })
        },
        setTone: (pin, freq) => {
          const raw = String(pin).trim()
          const digits = raw.replace(/^(gpio|gp|d|p)/i, "")
          const state = freq ? "HIGH" : "LOW"
          const value = freq ?? 0
          setPinStates((prev) => {
            const next = { ...prev, [raw]: { ...prev[raw], state, value } }
            if (digits) {
              next[digits] = { ...next[digits], state, value }
              next[`d${digits}`] = { ...next[`d${digits}`], state, value }
              next[`gpio${digits}`] = { ...next[`gpio${digits}`], state, value }
            }
            return next
          })
          if (freq) {
            audioEngine.playTone(freq)
          } else {
            audioEngine.stopTone()
          }
        },
        serialPrint: (text) => {
          setSerialLines((prev) => [...prev, { text, timestamp: Date.now(), type: "output" }])
        },
        serialPrintln: (text) => {
          setSerialLines((prev) => [...prev, { text, timestamp: Date.now(), type: "output" }])
        },
        setLcdText: (col, row, text) => {
          setPinStates((prev) => {
            const key = row === 0 ? "lcd_line1" : "lcd_line2"
            const current = String(prev[key] ?? "").padEnd(16, " ")
            const c = Math.max(0, Math.min(15, Number(col) || 0))
            const str = String(text ?? "")
            const updated = (current.slice(0, c) + str + current.slice(c + str.length)).slice(0, 16)
            return {
              ...prev,
              [key]: updated as any,
            }
          })
        },
        clearLcd: () => {
          setPinStates((prev) => ({
            ...prev,
            lcd_line1: "" as any,
            lcd_line2: "" as any,
          }))
        },
        setOledText: (line, text) => {
          setPinStates((prev) => ({
            ...prev,
            [line === 1 ? "oled_line1" : line === 2 ? "oled_line2" : "oled_line3"]: text as any,
          }))
        },
        clearOled: () => {
          setPinStates((prev) => ({
            ...prev,
            oled_line1: "" as any,
            oled_line2: "" as any,
            oled_line3: "" as any,
          }))
        },
        clearKeypadPin: () => {
          partsRef.current = partsRef.current.map((p) =>
            p.type === "keypad-4x4" ? { ...p, props: { ...p.props, lastKey: "", enteredPin: "" } } : p
          )
          updateState((s) => ({
            ...s,
            parts: s.parts.map((p) =>
              p.type === "keypad-4x4" ? { ...p, props: { ...p.props, lastKey: "", enteredPin: "" } } : p
            ),
          }))
        },
        setSevenSegmentDigit: (digit: number) => {
          const d = Math.max(0, Math.min(9, Math.floor(digit)))
          partsRef.current = partsRef.current.map((p) =>
            p.type === "seven-segment" ? { ...p, props: { ...p.props, digit: d } } : p
          )
          updateState((s) => ({
            ...s,
            parts: s.parts.map((p) =>
              p.type === "seven-segment" ? { ...p, props: { ...p.props, digit: d } } : p
            ),
          }))
        },
        clearSevenSegment: () => {
          partsRef.current = partsRef.current.map((p) =>
            p.type === "seven-segment" ? { ...p, props: { ...p.props, digit: -1 } } : p
          )
          updateState((s) => ({
            ...s,
            parts: s.parts.map((p) =>
              p.type === "seven-segment" ? { ...p, props: { ...p.props, digit: -1 } } : p
            ),
          }))
        },
        getSensorValue: (type, pin) => {
          const state = stateRef.current
          const currentState = state
          const activeBoard = getActiveBoard(currentState)
          const directPart = pin ? partsRef.current.find((pt) => pt.id === pin) : undefined
          const aliases: Record<string, string> = {
            pir: "pir-sensor",
            ir: "ir-sensor",
            dht_temperature: "dht11",
            dht_humidity: "dht11",
            joystick_x: "joystick",
            joystick_y: "joystick",
            joystick_button: "joystick",
            soil: "soil-moisture",
            encoder: "rotary-encoder",
            "mq2-gas": "mq2-gas",
            mq2_gas: "mq2-gas",
          }
          const partType = aliases[type] ?? type
          const p = directPart ?? partsRef.current.find((pt) => pt.type === partType)
          const liveRuntime = runningRef.current
            ? computeRuntime(state, pressedRef.current, pinStatesRef.current)[p?.id ?? ""]
            : undefined

          if (type === "pushbutton") return p ? (pressedRef.current.has(p.id) ? 1 : 0) : 0
          if (type === "ultrasonic") {
            const currentDist = Number(p?.props?.distance ?? 100)
            return liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : currentDist
          }
          if (type === "ldr") {
            const currentLight = Number(p?.props?.light ?? 512)
            const raw = liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : currentLight
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1023)), activeBoard)
          }
          if (type === "tmp36") {
            const currentTemp = Number(p?.props?.temperature ?? 25)
            return liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : currentTemp
          }
          if (type === "pir") {
            return liveRuntime?.level !== undefined ? liveRuntime.level : (String(p?.props?.motion ?? "false") === "true" ? 1 : 0)
          }
          if (type === "potentiometer") {
            const raw = Number(p?.props?.value ?? 512)
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1023)), activeBoard)
          }
          if (type === "ir") {
            return liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : (String(p?.props?.detected ?? "false") === "true" ? 1 : 0)
          }
          if (type === "dht_temperature") {
            const currentTemp = Number(p?.props?.temperature ?? 25)
            return liveRuntime?.dhtTemperature !== undefined ? liveRuntime.dhtTemperature : currentTemp
          }
          if (type === "dht_humidity") {
            const currentHum = Number(p?.props?.humidity ?? 55)
            return liveRuntime?.dhtHumidity !== undefined ? liveRuntime.dhtHumidity : currentHum
          }
          if (type === "joystick_x") {
            const raw = liveRuntime?.joystickX !== undefined ? liveRuntime.joystickX : Number(p?.props?.x ?? 512)
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1023)), activeBoard)
          }
          if (type === "joystick_y") {
            const raw = liveRuntime?.joystickY !== undefined ? liveRuntime.joystickY : Number(p?.props?.y ?? 512)
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1023)), activeBoard)
          }
          if (type === "joystick_button") {
            return liveRuntime?.joystickButton ? 1 : (String(p?.props?.pressed ?? "false") === "true" ? 1 : 0)
          }
          if (type === "soil") {
            const currentMoist = Number(p?.props?.moisture ?? 620)
            const raw = liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : currentMoist
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1023)), activeBoard)
          }
          if (type === "encoder") {
            return liveRuntime?.encoderValue !== undefined ? liveRuntime.encoderValue : Number(p?.props?.value ?? 0)
          }
          if (type === "mq2-gas" || type === "mq2_gas") {
            const currentGas = Number(p?.props?.gasLevel ?? p?.props?.gasPpm ?? 120)
            const raw = liveRuntime?.sensorValue !== undefined ? liveRuntime.sensorValue : currentGas
            return scaleAdcReading(Math.max(0, Math.min(1, raw / 1000)), activeBoard)
          }
          if (type === "analog") {
            const boardPart = partsRef.current.find((pt) => isBoardPart(pt.type))
            if (boardPart && pin) {
              const rawPin = String(pin).trim().toLowerCase()
              const pinDigits = rawPin.replace(/^(gpio|gp|d|p)/i, "")
              const targetBoardPin = activeBoard.pins.find(
                (bp) =>
                  bp.id.toLowerCase() === rawPin ||
                  bp.label.toLowerCase() === rawPin ||
                  bp.id.toLowerCase() === pinDigits ||
                  bp.label.toLowerCase() === pinDigits ||
                  bp.alternateNames?.some((alt) => alt.toLowerCase() === rawPin || alt.toLowerCase() === pinDigits)
              )

              if (targetBoardPin) {
                const nodal = solveCircuitNodalPotentials(currentState, pressedRef.current, pinStatesRef.current, true)
                const vPin = nodal.getPinVoltage({ partId: boardPart.id, pinId: targetBoardPin.id })
                const isWired = currentState.wires.some(
                  (w) =>
                    (w.from.partId === boardPart.id && w.from.pinId === targetBoardPin.id) ||
                    (w.to.partId === boardPart.id && w.to.pinId === targetBoardPin.id)
                )

                if (vPin > 0 || isWired) {
                  const ratio = Math.max(0, Math.min(1, vPin / activeBoard.adcMaxVoltage))
                  return scaleAdcReading(ratio, activeBoard)
                }
              }
            }

            const pot = partsRef.current.find((pt) => pt.type === "potentiometer")
            if (pot) {
              const norm = Math.max(0, Math.min(1, Number(pot.props.value ?? 512) / 1023))
              return scaleAdcReading(norm, activeBoard)
            }
            return 0
          }
          return 0
        },
        getDigitalPin: (pin) => {
          const currentState = stateRef.current
          const activeBoard = getActiveBoard(currentState)
          const boardPart = partsRef.current.find((pt) => isBoardPart(pt.type))

          // 1. Direct state lookup with universal prefix normalization
          const direct = lookupBoardPinState(pinStatesRef.current, pin, activeBoard)
          if (direct?.state === "HIGH") return true

          // 2. Physical circuit potential check (e.g. wired pushbutton, switch, or digital sensor output)
          if (boardPart) {
            const rawPin = String(pin).trim().toLowerCase()
            const pinDigits = rawPin.replace(/^(gpio|gp|d|p)/i, "")
            const targetBoardPin = activeBoard.pins.find(
              (bp) =>
                bp.id.toLowerCase() === rawPin ||
                bp.label.toLowerCase() === rawPin ||
                bp.id.replace(/^(gpio|gp|d|p)/i, "") === pinDigits ||
                bp.label.toLowerCase().replace(/^(gpio|gp|d|p)/i, "") === pinDigits ||
                bp.alternateNames?.some((alt) => alt.toLowerCase() === rawPin || alt.toLowerCase() === pinDigits)
            )

            if (targetBoardPin) {
              const nodal = solveCircuitNodalPotentials(currentState, pressedRef.current, pinStatesRef.current, true)
              const vPin = nodal.getPinVoltage({ partId: boardPart.id, pinId: targetBoardPin.id })
              if (vPin >= activeBoard.logicVoltage * 0.45) {
                return true
              }
            }
          }

          return false
        },
        getSensorText: (type, id) => {
          if (type !== "keypad") return ""
          const keypad = partsRef.current.find((pt) => pt.id === id && pt.type === "keypad-4x4")
            ?? partsRef.current.find((pt) => pt.type === "keypad-4x4")
          return String(keypad?.props?.lastKey ?? "")
        },
        isAiDetected: (cls) => {
          const state = aiStateRef.current
          if (
            !state.enabled ||
            state.unknown ||
            state.detectedClass === "none" ||
            state.detectedClass === "unknown"
          ) {
            return false
          }
           const normalizeClass = (value: string) => {
             const normalized = String(value).trim().toLowerCase()
             return normalized === "phone" ? "cell phone" : normalized
           }
           return normalizeClass(state.detectedClass) === normalizeClass(String(cls))
        },
        isAiUnknown: () => aiStateRef.current.unknown === true,
        getAiDetectedClass: () => aiStateRef.current.detectedClass,
        getAiConfidence: () => aiStateRef.current.confidence,
        getAiGesture: () => aiStateRef.current.detectedGesture ?? "none",
        getAiFingerCount: () => aiStateRef.current.fingerCount ?? 0,
        isAiGesture: (gesture) =>
          (aiStateRef.current.detectedGesture ?? "none").trim().toLowerCase() ===
          String(gesture).trim().toLowerCase(),
        setAiCamera: (enabled) => {
          setAiRequestedMode(enabled ? "objects" : null)
          setAiRuntimeEnabled(enabled)
          setIsAiCameraOpen(false)
          setIsAiStudioOpen(false)
          setAiCameraCompact(enabled)
        },
        setAiMicrophone: (enabled) => {
          if (enabled) {
            setAiRequestedMode("sound")
            setAiRuntimeEnabled(true)
            setIsAiCameraOpen(false)
            setIsAiStudioOpen(false)
            setAiCameraCompact(true)
          } else {
            setAiRequestedMode(null)
            stopAiRuntime()
          }
        },
        // Virtual Wi-Fi & Web Server hooks
        wifiConnect: (ssid: string, pass: string) => {
          virtualWifiManager.connect(ssid, pass)
          setSerialLines((prev) => [
            ...prev,
            { text: `[WiFi] Connecting to "${ssid}"...`, timestamp: Date.now(), type: "info" },
            { text: `[WiFi] Connected! IP: 192.168.1.105 (RSSI: -54 dBm)`, timestamp: Date.now(), type: "info" },
          ])
        },
        wifiIsConnected: () => virtualWifiManager.getState().status === "connected",
        wifiGetIp: () => virtualWifiManager.getState().ipAddress,
        wifiServerBegin: (port: number) => {
          virtualWifiManager.startServer(port)
          const currentState = stateRef.current
          const activeBoard = getActiveBoard(currentState)
          const { mappings, builtIn } = findCircuitLedPinMappings(currentState, activeBoard)

          const allLedPins = Array.from(
            new Set([
              builtIn,
              ...mappings.map((m) => m.pinId),
              ...(activeBoard.id === "esp32-devkit" && mappings.length === 0 && currentState.parts.some((p) => p.type === "led")
                ? ["4", "15"]
                : []),
            ])
          )

          const redPins = mappings.filter((m) => m.color === "red" || m.partId.includes("red")).map((m) => m.pinId)
          if (redPins.length === 0 && activeBoard.id === "esp32-devkit") redPins.push("4")

          const bluePins = mappings.filter((m) => m.color === "blue" || m.partId.includes("blue")).map((m) => m.pinId)
          if (bluePins.length === 0 && activeBoard.id === "esp32-devkit") bluePins.push("15")

          // Default /led/on
          if (!virtualWifiManager.getState().routes["/led/on"]?.handler) {
            virtualWifiManager.registerRoute(
              "/led/on",
              () => {
                for (const pin of allLedPins) env.setDigitalPin(pin, "HIGH")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /led/on -> Digital Pins [${allLedPins.join(", ")}] set to HIGH`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }

          // Default /led/off
          if (!virtualWifiManager.getState().routes["/led/off"]?.handler) {
            virtualWifiManager.registerRoute(
              "/led/off",
              () => {
                for (const pin of allLedPins) env.setDigitalPin(pin, "LOW")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /led/off -> Digital Pins [${allLedPins.join(", ")}] set to LOW`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }

          // Default /red/on and /red/off
          if (!virtualWifiManager.getState().routes["/red/on"]?.handler) {
            virtualWifiManager.registerRoute(
              "/red/on",
              () => {
                for (const pin of redPins) env.setDigitalPin(pin, "HIGH")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /red/on -> Red Light Pin [${redPins.join(", ")}] set to HIGH`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }
          if (!virtualWifiManager.getState().routes["/red/off"]?.handler) {
            virtualWifiManager.registerRoute(
              "/red/off",
              () => {
                for (const pin of redPins) env.setDigitalPin(pin, "LOW")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /red/off -> Red Light Pin [${redPins.join(", ")}] set to LOW`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }

          // Default /blue/on and /blue/off
          if (!virtualWifiManager.getState().routes["/blue/on"]?.handler) {
            virtualWifiManager.registerRoute(
              "/blue/on",
              () => {
                for (const pin of bluePins) env.setDigitalPin(pin, "HIGH")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /blue/on -> Blue Light Pin [${bluePins.join(", ")}] set to HIGH`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }
          if (!virtualWifiManager.getState().routes["/blue/off"]?.handler) {
            virtualWifiManager.registerRoute(
              "/blue/off",
              () => {
                for (const pin of bluePins) env.setDigitalPin(pin, "LOW")
                setSerialLines((prev) => [
                  ...prev,
                  { text: `[HTTP] GET /blue/off -> Blue Light Pin [${bluePins.join(", ")}] set to LOW`, timestamp: Date.now(), type: "info" },
                ])
              },
              200,
              "text/html"
            )
          }

          // Default / (Root Dashboard)
          if (!virtualWifiManager.getState().routes["/"]?.handler) {
            const rootHtml = `<!DOCTYPE html><html><head><title>ESP32 IoT Dashboard</title></head><body style='font-family:system-ui,sans-serif;padding:20px 14px;background:#090d16;color:#f8fafc;text-align:center;'><h1 style='color:#38bdf8;font-size:20px;margin-bottom:4px;'>🏠 ESP32 Smart Home</h1><p style='color:#94a3b8;font-size:12px;margin-bottom:16px;'>Server: 192.168.1.105 | Tap button to switch lamps:</p><div style='background:#1e293b;border:1px solid #334155;border-radius:12px;padding:12px;margin-bottom:10px;text-align:left;'><div style='font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px;'>🔴 Living Room Lamp (${redPins.join(", ")})</div><div style='display:flex;gap:6px;'><a href='/red/on' data-href='/red/on' style='flex:1;padding:8px;background:#dc2626;color:#fff;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;'>Turn ON</a><a href='/red/off' data-href='/red/off' style='flex:1;padding:8px;background:#334155;color:#fff;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;'>Turn OFF</a></div></div><div style='background:#1e293b;border:1px solid #334155;border-radius:12px;padding:12px;margin-bottom:12px;text-align:left;'><div style='font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:6px;'>🔵 Bedroom Lamp (${bluePins.join(", ")})</div><div style='display:flex;gap:6px;'><a href='/blue/on' data-href='/blue/on' style='flex:1;padding:8px;background:#0284c7;color:#fff;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;'>Turn ON</a><a href='/blue/off' data-href='/blue/off' style='flex:1;padding:8px;background:#334155;color:#fff;border-radius:8px;text-align:center;text-decoration:none;font-size:12px;font-weight:600;'>Turn OFF</a></div></div><div style='display:flex;gap:8px;'><a href='/led/on' data-href='/led/on' style='flex:1;padding:10px;background:#10b981;color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;'>💡 Turn All ON</a><a href='/led/off' data-href='/led/off' style='flex:1;padding:10px;background:#475569;color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;'>Turn All OFF</a></div></body></html>`
            virtualWifiManager.registerRoute("/", undefined, 200, "text/html", rootHtml)
          }

          setSerialLines((prev) => [
            ...prev,
            { text: `[HTTP] Web Server started on port ${port}. Listening at http://${virtualWifiManager.getState().ipAddress}:${port}/`, timestamp: Date.now(), type: "info" },
          ])
        },
        wifiServerOn: (route: string, branch: Blockly.Block | null) => {
          currentHttpRouteRef.current = route
          virtualWifiManager.registerRoute(route, async () => {
            currentHttpRouteRef.current = route
            if (branch && runningRef.current) {
              const signal = runnerAbortRef.current?.signal ?? new AbortController().signal
              await executeStatement(branch, env, signal)
            }
            // Hardware pin driver guarantee
            const clean = (route || "").toLowerCase()
            const currentState = stateRef.current
            const board = getActiveBoard(currentState)
            const { mappings, builtIn } = findCircuitLedPinMappings(currentState, board)
            if (clean.includes("/led/on") || clean === "/on") {
              env.setDigitalPin(builtIn, "HIGH")
              for (const m of mappings) env.setDigitalPin(m.pinId, "HIGH")
              if (board.id === "esp32-devkit" && mappings.length === 0) {
                env.setDigitalPin("4", "HIGH")
                env.setDigitalPin("15", "HIGH")
              }
            } else if (clean.includes("/led/off") || clean === "/off") {
              env.setDigitalPin(builtIn, "LOW")
              for (const m of mappings) env.setDigitalPin(m.pinId, "LOW")
              if (board.id === "esp32-devkit" && mappings.length === 0) {
                env.setDigitalPin("4", "LOW")
                env.setDigitalPin("15", "LOW")
              }
            } else if (clean.includes("red") && clean.includes("on")) {
              const reds = mappings.filter((m) => m.color === "red" || m.partId.includes("red"))
              if (reds.length > 0) for (const r of reds) env.setDigitalPin(r.pinId, "HIGH")
              else env.setDigitalPin("4", "HIGH")
            } else if (clean.includes("red") && clean.includes("off")) {
              const reds = mappings.filter((m) => m.color === "red" || m.partId.includes("red"))
              if (reds.length > 0) for (const r of reds) env.setDigitalPin(r.pinId, "LOW")
              else env.setDigitalPin("4", "LOW")
            } else if (clean.includes("blue") && clean.includes("on")) {
              const blues = mappings.filter((m) => m.color === "blue" || m.partId.includes("blue"))
              if (blues.length > 0) for (const b of blues) env.setDigitalPin(b.pinId, "HIGH")
              else env.setDigitalPin("15", "HIGH")
            } else if (clean.includes("blue") && clean.includes("off")) {
              const blues = mappings.filter((m) => m.color === "blue" || m.partId.includes("blue"))
              if (blues.length > 0) for (const b of blues) env.setDigitalPin(b.pinId, "LOW")
              else env.setDigitalPin("15", "LOW")
            }
          })
        },
        wifiServerSend: (code: number, contentType: string, body: string) => {
          const route = currentHttpRouteRef.current
          virtualWifiManager.setRouteResponse(route, code, contentType, body)
          setSerialLines((prev) => [
            ...prev,
            { text: `[HTTP] Sent ${code} response for ${route} (${body.length} bytes)`, timestamp: Date.now(), type: "info" },
          ])
        },

        // BBC micro:bit v2 hooks
        showMatrixIcon: (icon: string) => {
          const pattern = MICROBIT_ICONS[icon.toLowerCase()] ?? MICROBIT_ICONS.heart
          setMicrobitMatrix(pattern)
        },
        showMatrixNumber: (num: number) => {
          const digit = Math.abs(Math.floor(num)) % 10
          setMicrobitMatrix(MICROBIT_DIGITS[digit] ?? MICROBIT_DIGITS[0])
        },
        showMatrixText: (text: string) => {
          const clean = String(text).trim()
          if (clean.length > 0 && /^[0-9]$/.test(clean[0])) {
            const digit = parseInt(clean[0], 10)
            setMicrobitMatrix(MICROBIT_DIGITS[digit] ?? MICROBIT_DIGITS[0])
          } else {
            setMicrobitMatrix(MICROBIT_ICONS.heart)
          }
        },
        clearMatrix: () => {
          setMicrobitMatrix(createEmptyMatrix())
        },
        isButtonPressed: (btn: "A" | "B") => {
          const k = btn.toLowerCase()
          return (
            pressedRef.current.has(`microbit_${k}`) ||
            Array.from(pressedRef.current).some((id) => id.endsWith(`_${k}`))
          )
        },

        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        isRunning: () => runningRef.current,

        // Live Stepping Debugger hooks
        isPaused: () => isPausedRef.current,
        getExecutionSpeed: () => debugSpeedRef.current,
        waitStep: async (info: BlockStepInfo) => {
          setActiveStepBlock(info)
          return new Promise<void>((resolve) => {
            stepResolverRef.current = resolve
          })
        },
        highlightBlock: (blockId: string | null) => {
          if (visualWorkspaceRef.current) {
            try {
              visualWorkspaceRef.current.highlightBlock(blockId)
            } catch (e) {}
          }
        },
        onBlockEnter: (info: BlockStepInfo) => {
          setActiveStepBlock(info)
        },
      }

      void runBlocklyProgram(workspace, env, controller.signal)
        .catch((err) => {
          console.error("Pixiu Blockly runtime failed:", err)
          if (runnerAbortRef.current === controller) {
            runningRef.current = false
            setRunning(false)
            setSerialLines((prev) => [...prev, {
              text: "[Runtime error] " + (err instanceof Error ? err.message : String(err)),
              timestamp: Date.now(),
              type: "error",
            }])
          }
        })
        .finally(() => {
          if (ownsWorkspace) workspace.dispose()
          if (visualWorkspaceRef.current) {
            try {
              visualWorkspaceRef.current.highlightBlock(null)
            } catch (e) {}
          }
          if (runnerAbortRef.current === controller) {
            runnerAbortRef.current = null
          }
          setActiveStepBlock(null)
        })
    } catch (err) {
      console.error("Failed to start Pixiu Blockly runtime:", err)
      if (runnerAbortRef.current === controller) {
        runnerAbortRef.current = null
        runningRef.current = false
        setRunning(false)
        setSerialLines((prev) => [...prev, {
          text: "[Runtime error] " + (err instanceof Error ? err.message : String(err)),
          timestamp: Date.now(),
          type: "error",
        }])
      }
    }
  }, [blocklyXml, state.parts, stopProgram, stopAiRuntime])

  const handlePause = useCallback(() => {
    setIsPaused(true)
    isPausedRef.current = true
  }, [])

  const handleResume = useCallback(() => {
    setIsPaused(false)
    isPausedRef.current = false
    if (stepResolverRef.current) {
      const resolve = stepResolverRef.current
      stepResolverRef.current = null
      resolve()
    }
  }, [])

  const handleStepNext = useCallback(() => {
    if (!runningRef.current) {
      setRunning(true)
      setIsPaused(true)
      isPausedRef.current = true
      startProgram(true)
      return
    }
    setIsPaused(true)
    isPausedRef.current = true
    if (stepResolverRef.current) {
      const resolve = stepResolverRef.current
      stepResolverRef.current = null
      resolve()
    }
  }, [startProgram])

  const handleDebugSpeedChange = useCallback((speed: "normal" | "slow" | "step") => {
    setDebugSpeed(speed)
    debugSpeedRef.current = speed
    if (speed === "step") {
      setIsPaused(true)
      isPausedRef.current = true
    }
  }, [])

  const clearAll = useCallback(() => {
    stopProgram()
    updateState(() => ({ parts: [], wires: [] }))
    setSelectedId(null)
    setSelectedWireId(null)
    setWiring(null)
    setRunning(false)
    setIsPaused(false)
    isPausedRef.current = false
    setActiveStepBlock(null)
    setPressed(new Set())
    pressedRef.current = new Set()
    setSerialLines([])
    setBlocklyXml(DEFAULT_XML)
    setBlocklyDocumentVersion((value) => value + 1)
    stopAiRuntime()
    setProbeRed(null)
    setProbeBlack(null)
    setScopeProbeCH1(null)
    setScopeProbeCH2(null)
  }, [stopProgram, stopAiRuntime, updateState])

  const toggleRun = useCallback(() => {
    // Do not perform start/stop side effects inside a React state updater.
    // The previous version did that, which could batch the AI-camera state
    // updates with setRunning and leave the floating presentation out of sync.
    if (runningRef.current) {
      runningRef.current = false
      setRunning(false)
      setPressed(new Set())
      pressedRef.current = new Set()
      stopProgram()
      return
    }

    setWiring(null)
    setSelectedId(null)
    setSelectedWireId(null)
    setRunning(true)
    startProgram(false, true)
  }, [startProgram, stopProgram])

  // AI Studio "Run circuit" hands control to the compact right-side
  // Pixiu Vision Runtime HUD. It must never open the separate full
  // AI Vision Canvas, otherwise two camera owners can compete for getUserMedia.
  const handleRunFromAiStudio = useCallback(() => {
    setIsAiStudioOpen(false)
    setIsAiCameraOpen(false)
    setAiCameraCompact(true)
    setAiRuntimeEnabled(true)
    if (!runningRef.current) {
      setRunning(true)
      startProgram(false, true)
    }
  }, [startProgram])

  // AI Circuit Doctor diagnostic report
  const doctorReport = useMemo(
    () => diagnoseCircuit(state, runtime, pinStates),
    [state, runtime, pinStates],
  )

  const handleResetMcu = useCallback(() => {
    audioEngine.stopTone()
    setPinStates({})
    if (runningRef.current) {
      startProgram(false, false)
    }
  }, [startProgram])

  const handleHighlightParts = useCallback((partIds: string[]) => {
    setHighlightPartIds(partIds)
  }, [])

  const handleDownloadIno = useCallback(() => {
    defineArduinoBlocks()
    let code = ""
    try {
      const liveWs = visualWorkspaceRef.current
      if (liveWs) {
        code = arduino.workspaceToCode(liveWs)
      } else {
        const headless = new Blockly.Workspace()
        const dom = Blockly.utils.xml.textToDom(normalizeBlocklyXml(blocklyXml))
        Blockly.Xml.domToWorkspace(dom, headless)
        code = arduino.workspaceToCode(headless)
        headless.dispose()
      }
    } catch (err) {
      console.error("Failed to generate C++ code for sketch:", err)
    }
    const sketchContent = buildInoSketch(state, code)
    const safeName = (currentProjectName || "pixiu_circuit").toLowerCase().replace(/[^a-z0-9_-]/g, "_")
    triggerInoDownload(`${safeName}.ino`, sketchContent)
  }, [blocklyXml, currentProjectName, state])

  // Keyboard shortcut listener and DevTools protection (placed after toggleRun and edit callbacks)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keep inspection shortcuts intact, but Ctrl/Cmd+S belongs to Pixiu project save.
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        (e.ctrlKey && ["U", "u"].includes(e.key))
      ) {
        e.preventDefault()
        e.stopPropagation()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        saveNowRef.current()
        return
      }

      const activeEl = document.activeElement
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable
      if (isInput) return

      // Space toggles simulation
      if (e.code === "Space") {
        e.preventDefault()
        toggleRun()
        return
      }

      // 'S' toggles Schematic vs Physical view
      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey && view === "circuit") {
        e.preventDefault()
        setSchematicMode((prev) => !prev)
        return
      }

      // F10 Step Next in debugger
      if (e.key === "F10") {
        e.preventDefault()
        handleStepNext()
        return
      }

      // 'P' toggles Pause/Resume when simulation is running
      if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey && running) {
        e.preventDefault()
        if (isPaused) {
          handleResume()
        } else {
          handlePause()
        }
        return
      }

      // 'R' rotates selected component
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
        if (selectedId) {
          rotatePart(selectedId)
          e.preventDefault()
        }
      }

      // 'D' duplicates selected component
      if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey) {
        if (selectedId) {
          duplicatePart(selectedId)
          e.preventDefault()
        }
      }

      // DELETE / BACKSPACE removes selected component or selected wire!
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedWireId) {
          deleteWire(selectedWireId)
          setSelectedWireId(null)
          e.preventDefault()
        } else if (selectedId) {
          deletePart(selectedId)
          setSelectedId(null)
          e.preventDefault()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        e.preventDefault()
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        handleRedo()
        e.preventDefault()
      }
    }

    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, target: { type: "canvas" } })
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("contextmenu", handleGlobalContextMenu)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("contextmenu", handleGlobalContextMenu)
    }
  }, [handleUndo, handleRedo, selectedWireId, selectedId, deleteWire, deletePart, rotatePart, duplicatePart, toggleRun, handleStepNext, handlePause, handleResume, isPaused, running, view])

  const handleSave = useCallback(async (requestedName?: string): Promise<void> => {
    const name = requestedName?.trim() || currentProjectName.trim() || "Untitled Circuit"
    setIsSaving(true)
    try {
      const liveWorkspace = visualWorkspaceRef.current
      const xmlToSave = liveWorkspace
        ? Blockly.utils.xml.domToText(Blockly.Xml.workspaceToDom(liveWorkspace))
        : blocklyXml
      const saved = await saveCircuit(name, state, xmlToSave, projectStorageScope)
      setCurrentProjectName(saved.name)
      setLastSaved(saved.savedAt)
      setIsDirty(false)
      const isMission = Boolean(activeLessonId) || name.startsWith("Mission ·")
      if (name && name !== "Untitled Circuit") {
        awardCreationXp(state, xmlToSave, name, {
          activeTemplateId,
          isMission,
        })
      }
    } catch (error) {
      setIsDirty(true)
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [activeLessonId, activeTemplateId, blocklyXml, currentProjectName, projectStorageScope, state])

  // Active simulation tinkering heartbeat (awards engagement XP for interactive testing)
  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      awardTinkeringXp()
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [running])

  useEffect(() => {
    saveNowRef.current = () => {
      void handleSave().catch((error) => console.warn("Pixiu save failed:", error))
    }
  }, [handleSave])

  // Debounced autosave keeps drag/edit interactions off the storage write path.
  useEffect(() => {
    if (!storageReady || !isDirty) return

    const timer = window.setTimeout(() => {
      void handleSave().catch((error) => console.warn("Pixiu autosave failed:", error))
    }, 900)

    return () => window.clearTimeout(timer)
  }, [handleSave, isDirty, storageReady])

  const handleExport = useCallback((password?: string) => {
    const liveWorkspace = visualWorkspaceRef.current
    const xmlToExport = liveWorkspace
      ? Blockly.utils.xml.domToText(Blockly.Xml.workspaceToDom(liveWorkspace))
      : blocklyXml
    void exportAsJSON(currentProjectName, state, xmlToExport, password).catch((error) => {
      window.alert(error instanceof Error ? error.message : "Could not export this .pixiu file.")
    })
  }, [blocklyXml, currentProjectName, state])

  const handleUploadFile = useCallback(async (file: File, password?: string): Promise<void> => {
    const imported = await importFromJSON(file, password)
    stopProgram()

    const saved = await saveCircuit(imported.name, imported.state, imported.blocklyXml || DEFAULT_XML, projectStorageScope)
    setHistory(createHistory(saved.state))
    setBlocklyXml(saved.blocklyXml || DEFAULT_XML)
    setBlocklyDocumentVersion((value) => value + 1)
    setCurrentProjectName(saved.name)
    setSelectedId(null)
    setSelectedWireId(null)
    setWiring(null)
    setSerialLines([])
    stopAiRuntime()
    setIsDmmOpen(false)
    setIsScopeOpen(false)
    setLastSaved(saved.savedAt)
    setIsDirty(false)
  }, [projectStorageScope, stopProgram, stopAiRuntime])

  const handleLoadProject = useCallback(async (project: SavedCircuit): Promise<void> => {
    stopProgram()
    await saveCurrentCircuit(project, projectStorageScope)
    setHistory(createHistory(project.state))
    setBlocklyXml(project.blocklyXml || DEFAULT_XML)
    setBlocklyDocumentVersion((value) => value + 1)
    setCurrentProjectName(project.name)
    setSelectedId(null)
    setSelectedWireId(null)
    setWiring(null)
    setSerialLines([])
    stopAiRuntime()
    setIsDmmOpen(false)
    setIsScopeOpen(false)
    setLastSaved(project.savedAt)
    setIsDirty(false)
    setActiveLessonId(null)
    setActiveTemplateId(null)
  }, [projectStorageScope, stopProgram, stopAiRuntime])

  const handleNewProject = useCallback(async (): Promise<void> => {
    stopProgram()
    await clearCurrentCircuit(projectStorageScope)
    setHistory(createHistory(INITIAL_STATE))
    setBlocklyXml(DEFAULT_XML)
    setBlocklyDocumentVersion((value) => value + 1)
    setCurrentProjectName("Untitled Circuit")
    setLastSaved(null)
    setIsDirty(false)
    setSelectedId(null)
    setSelectedWireId(null)
    setWiring(null)
    setSerialLines([])
    stopAiRuntime()
    setIsDmmOpen(false)
    setIsScopeOpen(false)
    setActiveLessonId(null)
    setActiveTemplateId(null)
  }, [projectStorageScope, stopProgram, stopAiRuntime])

  const handleSelectLesson = useCallback((lesson: Lesson) => {
    setActiveLessonId(lesson.id)
    setActiveTemplateId(null)
    if (lesson.difficulty === "Beginner") {
      const seed = getLessonSeed(lesson)
      if (seed.blocklyXml) {
        setBlocklyXml(seed.blocklyXml)
        setBlocklyDocumentVersion((value) => value + 1)
      }
    }
  }, [])

  const handleLoadLesson = useCallback(
    (lesson: Lesson) => {
      const seed = getLessonSeed(lesson)
      stopProgram()
      updateState(() => seed.state)
      setBlocklyXml(seed.blocklyXml)
      setBlocklyDocumentVersion((value) => value + 1)
      setCurrentProjectName(`Mission · ${lesson.shortTitle}`)
      setLastSaved(null)
      setRunTime(0)
      setSelectedId(null)
      setSelectedWireId(null)
      setWiring(null)
      setSerialLines([])
      setIsDmmOpen(false)
      setIsScopeOpen(false)
      stopAiRuntime()
      setActiveLessonId(lesson.id)
      setActiveTemplateId(null)
      setView("circuit")
    },
    [stopProgram, stopAiRuntime, updateState],
  )

  const handleSelectTemplate = useCallback(
    (tmpl: ProjectTemplate) => {
      stopProgram()
      updateState(() => tmpl.circuit)
      setActiveLessonId(null)
      setActiveTemplateId(tmpl.id)
      setBlocklyXml(tmpl.blocklyXml)
      setBlocklyDocumentVersion((value) => value + 1)
      if (storageReady) setIsDirty(true)
      setSelectedId(null)
      setSelectedWireId(null)
      setWiring(null)
      setSerialLines([])
      // Selecting a template replaces the active program context. AI templates
      // never request camera/microphone access until the student runs the program.
      setIsAiStudioOpen(false)
      setAiRequestedMode(null)
      setAiRuntimeEnabled(false)
      setAiCameraCompact(false)
      setIsAiCameraOpen(false)
    },
    [stopProgram, stopAiRuntime, updateState],
  )

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      audioEngine.setMuted(next)
      return next
    })
  }, [])

  return (
    <div className="circuit-lab-blue-theme flex h-screen flex-col bg-background text-foreground overflow-hidden select-none">
      <LabSupportWidget />

      <Toolbar
        view={view}
        onViewChange={setView}
        running={running}
        onToggleRun={toggleRun}
        onClear={clearAll}
        canUndo={canUndo(history)}
        onUndo={handleUndo}
        canRedo={canRedo(history)}
        onRedo={handleRedo}
         onOpenProjects={() => setIsProjectManagerOpen(true)}
        onOpenLessons={() => setIsLessonsOpen(true)}
        onOpenGuide={() => window.dispatchEvent(new Event("pixiu-open-guide"))}
        isSerialOpen={isSerialOpen}
        onToggleSerial={() => setIsSerialOpen((prev) => !prev)}
        isAiCameraOpen={isAiCameraOpen}
        onToggleAiCamera={handleToggleAiVision}
        isAiStudioOpen={isAiStudioOpen}
        onOpenAiStudio={handleToggleAiStudio}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        selectedWireId={selectedWireId}
        onDeleteSelectedWire={deleteSelectedWire}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onStepNext={handleStepNext}
        debugSpeed={debugSpeed}
        onDebugSpeedChange={handleDebugSpeedChange}
        activeStepLabel={activeStepBlock?.label ?? null}
        schematicMode={schematicMode}
        onToggleSchematic={() => setSchematicMode((prev) => !prev)}
        isDoctorOpen={isDoctorOpen}
        onToggleDoctor={() => setIsDoctorOpen((prev) => !prev)}
        doctorScore={doctorReport.score}
        onDownloadIno={handleDownloadIno}
      />

      <WelcomeOverlay
        onOpenProjects={() => setIsProjectManagerOpen(true)}
        onOpenLessons={() => setIsLessonsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
      />

      <ProjectManager
        isOpen={isProjectManagerOpen}
        currentProjectName={currentProjectName}
        lastSaved={lastSaved}
        dirty={isDirty}
        storageReady={storageReady}
        isSaving={isSaving}
        storageScope={projectStorageScope}
        displayPixiuId={pixiuId}
        onClose={() => setIsProjectManagerOpen(false)}
        onSave={handleSave}
        onNew={handleNewProject}
        onImport={handleUploadFile}
        onLoad={handleLoadProject}
        onExportCurrent={handleExport}
      />

      <LessonBrowser
        isOpen={isLessonsOpen}
        onClose={() => setIsLessonsOpen(false)}
        activeLessonId={activeLessonId}
        onSelectLesson={handleSelectLesson}
        onLoadLesson={handleLoadLesson}
        context={{ state, blocklyXml, running, runtime }}
      />

      <TemplateBrowser
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Integrated AI Vision Canvas — runtime surface for AI Arduino templates/programs. */}
      <Suspense fallback={<PixiuModuleLoading title="Loading PIXIU Vision" subtitle="Preparing the integrated AI runtime surface. Camera access starts only when the runtime is ready." />}>
      <AiCameraPanel
        isOpen={isAiCameraOpen}
        onClose={stopAiRuntime}
        aiState={aiState}
        onAiStateChange={handleAiStateChange}
        isSimRunning={running}
        runtimeEnabled={aiRuntimeEnabled}
        onStartSim={handleRunFromAiStudio}
      />
      </Suspense>

      {/* Pixiu AI Studio: simple by default, deep only when a student opens Understand. */}
      <Suspense fallback={<PixiuModuleLoading title="Loading PIXIU AI Studio" subtitle="Preparing the AI workspace. Camera and model runtimes start only when you use them." />}>
        <AiStudioPanel
          isOpen={isAiStudioOpen}
          onClose={handleAiStudioClose}
          aiState={aiState}
          onAiStateChange={handleAiStateChange}
          isSimRunning={running}
          runtimeEnabled={aiRuntimeEnabled && !isAiCameraOpen}
          compact={aiCameraCompact}
          requestedMode={aiRequestedMode}
          onRequestedModeHandled={() => setAiRequestedMode(null)}
          onStartSim={handleRunFromAiStudio}
        />
      </Suspense>

      {/* Blockly Code View (Kept mounted to preserve workspace & block highlights) */}
      <div className={view === "code" ? "flex-1 min-h-0 w-full overflow-hidden" : "hidden"}>
        <BlocklyEditor
          key={blocklyDocumentVersion}
          circuit={state}
          xml={blocklyXml}
          onXmlChange={(xml) => {
            setBlocklyXml(xml)
            if (storageReady) setIsDirty(true)
          }}
          onWorkspaceReady={(ws) => {
            visualWorkspaceRef.current = ws
          }}
        />
      </div>

      {/* Circuit Studio View */}
      <div className={view !== "code" ? "flex min-h-0 flex-1 relative" : "hidden"}>
        <Palette
          onQuickAdd={(t) => {
            addPart(t)
            setMobilePaletteOpen(false)
          }}
          isOpen={mobilePaletteOpen}
          onClose={() => setMobilePaletteOpen(false)}
          isDmmOpen={isDmmOpen}
          onToggleDmm={() => setIsDmmOpen((prev) => !prev)}
          isScopeOpen={isScopeOpen}
          onToggleScope={() => setIsScopeOpen((prev) => !prev)}
          isIotOpen={isIotPortalOpen}
          onToggleIot={() => setIsIotPortalOpen((prev) => !prev)}
          wifiRunning={wifiState.serverRunning}
          activeWireColor={selectedWire ? selectedWire.color : activeWireColor}
          onSelectWireColor={handleSelectWireColor}
        />
        <main className="relative min-w-0 flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
          <div className="flex-1 relative">
            {/* Mobile Quick-Add Components Trigger */}
            <button
              onClick={() => setMobilePaletteOpen(true)}
              className="md:hidden absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-xl bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs font-bold shadow-md text-foreground hover:bg-secondary cursor-pointer"
              title="Open Components Palette"
            >
              <span className="text-primary text-sm font-black">+</span>
              <span>Components</span>
            </button>

            {/* Re-open Inspector Button when closed */}
            {!isInspectorOpen && (
              <button
                onClick={() => setIsInspectorOpen(true)}
                className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-xl bg-card/90 backdrop-blur-sm border border-border px-3 py-1.5 text-xs font-bold shadow-md text-foreground hover:bg-secondary cursor-pointer transition animate-in fade-in"
                title="Open Inspector Panel"
              >
                <Sliders size={14} className="text-primary" />
                <span className="hidden sm:inline">Inspector</span>
              </button>
            )}

            <CircuitCanvas
              parts={state.parts}
              wires={state.wires}
              selectedId={selectedId}
              tool="select"
              wiring={wiring}
              runtime={runtime}
              running={running}
              wireCurrents={wireCurrents}
              probeRed={probeRed}
              probeBlack={probeBlack}
              activeProbeToPlace={activeProbeToPlace}
              onProbeClip={handleProbeClip}
              scopeProbeCH1={scopeProbeCH1}
              scopeProbeCH2={scopeProbeCH2}
              activeScopeProbeToPlace={activeScopeProbeToPlace}
              onScopeProbeClip={handleScopeProbeClip}
              onSelect={(id) => {
                setSelectedId(id)
                if (id) {
                  setSelectedWireId(null)
                  setIsInspectorOpen(true)
                }
              }}
              onMovePart={movePart}
              onPinDown={handlePinDown}
              onCancelWire={() => setWiring(null)}
              onDeleteWire={deleteWire}
              onDropPart={addPart}
              onInteract={interact}
              selectedWireId={selectedWireId}
              onSelectWire={(id) => {
                setSelectedWireId(id)
                if (id) setSelectedId(null)
              }}
              onCanvasContextMenu={handleCanvasContextMenu}
              onChangeProp={changeProp}
              viewMode={schematicMode ? "schematic" : "physical"}
              highlightPartIds={highlightPartIds}
              onResetMcu={handleResetMcu}
              isScopeOpen={isScopeOpen}
              activeWireColor={activeWireColor}
            />

            {running && (
              <div
                className={`pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border backdrop-blur-sm px-4 py-1.5 font-mono text-xs shadow-lg flex items-center gap-2 transition-all ${
                  isPaused
                    ? "border-amber-500/50 bg-amber-950/85 text-amber-300 ring-2 ring-amber-500/20"
                    : "border-emerald-500/40 bg-emerald-950/80 text-emerald-400"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isPaused ? "bg-amber-400" : "bg-emerald-400 animate-ping"
                  }`}
                />
                <span>{isPaused ? `Paused at Step (${runTime}s)` : `Simulation Active (${runTime}s)`}</span>
                {isPaused && activeStepBlock && (
                  <span className="max-w-[240px] truncate text-[11px] text-amber-200 bg-amber-900/70 px-2 py-0.5 rounded-md font-mono border border-amber-600/50 font-bold">
                    {activeStepBlock.label}
                  </span>
                )}
              </div>
            )}

            {running && wifiState.serverRunning && (
              <button
                onClick={() => setIsIotPortalOpen(true)}
                className="absolute left-1/2 top-14 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-950/90 hover:bg-sky-900/90 text-sky-300 px-3.5 py-1 font-mono text-xs shadow-xl backdrop-blur-sm cursor-pointer transition animate-in fade-in"
                title="Open Simulated IoT Web Server"
              >
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                <span className="font-bold">🌐 Web Server:</span>
                <span className="underline decoration-sky-400">http://{wifiState.ipAddress}:{wifiState.port}/</span>
              </button>
            )}
          </div>

          {/* Sliding Serial Monitor Panel */}
          <SerialMonitor
            lines={serialLines}
            isOpen={isSerialOpen}
            onToggle={() => setIsSerialOpen((prev) => !prev)}
            onClear={() => setSerialLines([])}
            onSend={(text) => {
              setSerialLines((prev) => [
                ...prev,
                { text, timestamp: Date.now(), type: "input" },
              ])
            }}
          />

          {/* Mobile Bottom Dock Bar */}
          <div className="md:hidden fixed bottom-3 inset-x-3 z-30 flex items-center justify-around rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-lg shadow-2xl py-2 px-2 text-xs font-semibold text-white">
            <button
              onClick={() => setMobilePaletteOpen(true)}
              className="flex flex-col items-center gap-0.5 p-1 text-foreground hover:text-primary transition active:scale-95"
              title="Add Components"
            >
              <Boxes size={18} className="text-primary" />
              <span className="text-[10px]">Parts</span>
            </button>

            <button
              onClick={handleToggleAiVision}
              className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                isAiCameraOpen ? "text-cyan-300 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="AI Vision Canvas"
            >
              <Camera size={18} className={isAiCameraOpen ? "text-cyan-300" : ""} />
              <span className="text-[10px]">AI Vision</span>
            </button>

            <button
              onClick={handleToggleAiStudio}
              className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                isAiStudioOpen ? "text-violet-300 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="PIXIU AI Studio"
            >
              <Sparkles size={18} className={isAiStudioOpen ? "text-violet-300" : ""} />
              <span className="text-[10px]">AI Studio</span>
            </button>

            <button
              onClick={() => setIsDmmOpen((prev) => !prev)}
              className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                isDmmOpen ? "text-amber-400 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Digital Multimeter"
            >
              <Gauge size={18} className={isDmmOpen ? "text-amber-400" : ""} />
              <span className="text-[10px]">DMM</span>
            </button>

            <button
              onClick={() => setIsTemplatesOpen(true)}
              className="flex flex-col items-center gap-0.5 p-1 text-indigo-400 transition active:scale-95"
              title="Templates & Projects"
            >
              <Sparkles size={18} />
              <span className="text-[10px]">Projects</span>
            </button>

            <button
              onClick={() => setIsDoctorOpen((prev) => !prev)}
              className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                isDoctorOpen ? "text-cyan-400 font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="AI Circuit Doctor"
            >
              <ShieldAlert size={18} className={isDoctorOpen ? "text-cyan-400" : ""} />
              <span className="text-[10px]">Doctor</span>
            </button>

            <button
              onClick={() => setIsSerialOpen((prev) => !prev)}
              className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                isSerialOpen ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Serial Monitor"
            >
              <Terminal size={18} />
              <span className="text-[10px]">Serial</span>
            </button>

            {/* ESP32 Virtual IoT Smart Device Button */}
            {(state.parts.some((p) => p.type === "esp32-nodemcu") || wifiState.status === "connected") && (
              <button
                onClick={() => setIsIotPortalOpen((prev) => !prev)}
                className={`flex flex-col items-center gap-0.5 p-1 transition active:scale-95 ${
                  isIotPortalOpen ? "text-cyan-400 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
                title="ESP32 Virtual IoT Device"
              >
                <Smartphone size={18} className={isIotPortalOpen ? "text-cyan-400" : ""} />
                <span className="text-[10px]">IoT Phone</span>
              </button>
            )}
          </div>

          {/* Universal Quick Selection Action HUD (Touch-friendly & Desktop-friendly) */}
          {(selected || selectedWire) && (
            <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-35 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-2xl border border-slate-700/90 bg-slate-900/95 shadow-2xl backdrop-blur-md text-white select-none animate-in slide-in-from-bottom-2 duration-150">
              {selected && (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] font-mono border border-slate-700/60 mr-1 max-w-[120px] sm:max-w-[180px] truncate">
                    <span className="font-bold text-cyan-300 truncate">{CATALOG[selected.type]?.name || selected.type}</span>
                  </div>
                  <button
                    onClick={() => {
                      deletePart(selected.id)
                      setSelectedId(null)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs shadow-md active:scale-95 transition cursor-pointer"
                    title="Delete this component"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => rotatePart(selected.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 active:scale-95 transition cursor-pointer"
                    title="Rotate 90° (R)"
                  >
                    <RotateCw size={14} />
                    <span className="hidden sm:inline">Rotate</span>
                  </button>
                  <button
                    onClick={() => duplicatePart(selected.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 active:scale-95 transition cursor-pointer"
                    title="Duplicate (D)"
                  >
                    <Copy size={14} />
                    <span className="hidden sm:inline">Duplicate</span>
                  </button>
                  <button
                    onClick={() => setIsInspectorOpen((prev) => !prev)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs border border-slate-700 active:scale-95 transition cursor-pointer"
                    title="Toggle Inspector"
                  >
                    <Sliders size={14} />
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer ml-1"
                    title="Deselect"
                  >
                    <X size={14} />
                  </button>
                </>
              )}

              {selectedWire && (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] font-mono border border-slate-700/60 mr-1">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedWire.color }} />
                    <span className="font-bold text-cyan-300">Wire</span>
                  </div>
                  <button
                    onClick={() => {
                      deleteWire(selectedWire.id)
                      setSelectedWireId(null)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs shadow-md active:scale-95 transition cursor-pointer"
                    title="Delete this wire"
                  >
                    <Trash2 size={14} />
                    <span>Delete Wire</span>
                  </button>
                  <div className="flex items-center gap-1 px-1">
                    {["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#1e293b", "#f97316"].map((col) => (
                      <button
                        key={col}
                        onClick={() => handleSelectWireColor(col)}
                        style={{ backgroundColor: col }}
                        className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                          selectedWire.color === col ? "border-white scale-110 shadow-md ring-2 ring-cyan-400" : "border-slate-600 hover:scale-105"
                        }`}
                        title={`Color ${col}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setSelectedWireId(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer ml-1"
                    title="Deselect"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </main>
        {isInspectorOpen && (
          <Inspector
            part={selected}
            runtime={selected ? runtime[selected.id] : undefined}
            running={running}
            partCount={state.parts.length}
            wireCount={state.wires.length}
            onChangeProp={changeProp}
            onRotate={rotatePart}
            onDelete={deletePart}
            onDuplicate={duplicatePart}
            onClose={() => {
              setIsInspectorOpen(false)
              setSelectedId(null)
            }}
          />
        )}
      </div>

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          partName={selected ? CATALOG[selected.type]?.name : undefined}
          selectedPart={selected}
          running={running}
          activeWireColor={selectedWire ? selectedWire.color : activeWireColor}
          onClose={() => setContextMenu(null)}
          onRotate={() => selectedId && rotatePart(selectedId)}
          onDuplicate={() => selectedId && duplicatePart(selectedId)}
          onDelete={() => {
            if (contextMenu.target.type === "part" && selectedId) {
              deletePart(selectedId)
              setSelectedId(null)
            } else if (contextMenu.target.type === "wire" && selectedWireId) {
              deleteWire(selectedWireId)
              setSelectedWireId(null)
            }
          }}
          onFitToScreen={() => {
            window.dispatchEvent(new CustomEvent("circuit-fit-screen"))
          }}
          onOpenPalette={() => setMobilePaletteOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          onToggleSerial={() => setIsSerialOpen((prev) => !prev)}
          isDmmOpen={isDmmOpen}
          onToggleDmm={() => setIsDmmOpen((prev) => !prev)}
          isScopeOpen={isScopeOpen}
          onToggleScope={() => setIsScopeOpen((prev) => !prev)}
          onToggleAiCamera={handleToggleAiVision}
          onSwitchToCode={() => setView("code")}
          onToggleRun={toggleRun}
          onClearCanvas={clearAll}
          onChangeWireColor={handleSelectWireColor}
          onChangeProp={changeProp}
        />
      )}

      {/* Interactive Digital Multimeter (DMM) */}
      <Multimeter
        isOpen={isDmmOpen && view === "circuit"}
        onClose={() => setIsDmmOpen(false)}
        state={state}
        runtime={runtime}
        pinStates={pinStates}
        pressed={pressed}
        running={running}
        probeRed={probeRed}
        probeBlack={probeBlack}
        onSetProbeRed={setProbeRed}
        onSetProbeBlack={setProbeBlack}
        activeProbeToPlace={activeProbeToPlace}
        onSetActiveProbeToPlace={setActiveProbeToPlace}
        isAiCameraOpen={isAiCameraOpen}
      />

      {/* Interactive Mini Oscilloscope & Logic Waveform Grapher */}
      <Oscilloscope
        isOpen={isScopeOpen && view === "circuit"}
        onClose={() => setIsScopeOpen(false)}
        state={state}
        running={running}
        simulationRef={oscilloscopeSimulationRef}
        pressed={pressed}
        probeCH1={scopeProbeCH1}
        probeCH2={scopeProbeCH2}
        onSetProbeCH1={setScopeProbeCH1}
        onSetProbeCH2={setScopeProbeCH2}
        activeProbeToPlace={activeScopeProbeToPlace}
        onSetActiveProbeToPlace={setActiveScopeProbeToPlace}
      />

      {/* AI Circuit Doctor Diagnostics Drawer */}
      <CircuitDoctorHud
        report={doctorReport}
        isOpen={isDoctorOpen && view === "circuit"}
        onClose={() => setIsDoctorOpen(false)}
        onHighlightParts={handleHighlightParts}
      />

      {/* ESP32 Virtual IoT Web Browser & Traffic Inspector */}
      <IotWebPortal
        isOpen={isIotPortalOpen}
        onClose={() => setIsIotPortalOpen(false)}
      />
    </div>
  )
}
