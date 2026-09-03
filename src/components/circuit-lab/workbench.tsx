"use client"

import { useCallback, useMemo, useRef, useState, useEffect } from "react"
import type { CircuitState, PartType, PinRef, PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"
import { samePin } from "@/lib/geometry"
import { computeRuntime, type ArduinoPinState } from "@/lib/simulation"
import { defineArduinoBlocks } from "@/lib/arduino-blocks"
import { runBlocklyProgram, type ExecutionEnvironment } from "@/lib/blockly-runner"
import { audioEngine } from "@/lib/audio-engine"
import { createHistory, pushState, undo as historyUndo, redo as historyRedo, canUndo, canRedo, type HistoryState } from "@/lib/history"
import { saveCircuit, loadCircuit } from "@/lib/storage"
import * as Blockly from "blockly"
import { CircuitCanvas } from "./circuit-canvas"
import { Inspector } from "./inspector"
import { Palette } from "./palette"
import { Toolbar, type WorkbenchView } from "./toolbar"
import { BlocklyEditor } from "./blockly-editor"
import { SerialMonitor, type SerialLine } from "./serial-monitor"
import { StatusBar } from "./status-bar"
import { TemplateBrowser } from "./template-browser"
import { AiCameraPanel, type AiVisionState } from "./ai-camera-panel"
import type { ProjectTemplate } from "@/lib/templates"

const DEFAULT_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="ai_is_detected"><field name="CLASS">car</field></block>
        </value>
        <statement name="DO0">
          <block type="serial_println"><value name="TEXT"><block type="text_string"><field name="TEXT">🚗 [AI Vision] Car Detected! Raising Boom Barrier...</field></block></value><next>
          <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">600</field></shadow></value></block>
          </next></block></next></block></next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value></block>
          </next></block></next></block></next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`

const INITIAL_STATE: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
    { id: "gate", type: "servo", x: 430, y: 70, rotation: 0, props: { arm: "barrier", angle: 0 } },
    { id: "led_green", type: "led", x: 600, y: 60, rotation: 0, props: { color: "green" } },
    { id: "r_green", type: "resistor", x: 600, y: 150, rotation: 0, props: { resistance: 220 } },
    { id: "led_red", type: "led", x: 440, y: 220, rotation: 0, props: { color: "red" } },
    { id: "r_red", type: "resistor", x: 540, y: 220, rotation: 0, props: { resistance: 220 } },
  ],
  wires: [
    { id: "w_gvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "gate", pinId: "vcc" }, color: "#ef4444" },
    { id: "w_ggnd", from: { partId: "gate", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "w_gsig", from: { partId: "uno", pinId: "d6" }, to: { partId: "gate", pinId: "sig" }, color: "#f97316" },
    { id: "w_r1", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_green", pinId: "a" }, color: "#22c55e" },
    { id: "w_r2", from: { partId: "r_green", pinId: "b" }, to: { partId: "led_green", pinId: "anode" }, color: "#22c55e" },
    { id: "w_lgnd", from: { partId: "led_green", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "w_r3", from: { partId: "uno", pinId: "d13" }, to: { partId: "r_red", pinId: "a" }, color: "#ef4444" },
    { id: "w_r4", from: { partId: "r_red", pinId: "b" }, to: { partId: "led_red", pinId: "anode" }, color: "#ef4444" },
    { id: "w_lrgnd", from: { partId: "led_red", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
  ],
}

export function Workbench() {
  const [history, setHistory] = useState<HistoryState<CircuitState>>(() => createHistory(INITIAL_STATE))
  const state = history.present

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)
  const [activeWireColor, setActiveWireColor] = useState<string>("#22c55e")
  const [wiring, setWiring] = useState<PinRef | null>(null)
  const [running, setRunning] = useState(false)
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [view, setView] = useState<WorkbenchView>("circuit")
  const [pinStates, setPinStates] = useState<Record<string, ArduinoPinState>>({})
  const [blocklyXml, setBlocklyXml] = useState<string>(DEFAULT_XML)
  const [serialLines, setSerialLines] = useState<SerialLine[]>([])
  const [isSerialOpen, setIsSerialOpen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [runTime, setRunTime] = useState(0)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false)
  const [isAiCameraOpen, setIsAiCameraOpen] = useState(true)
  const [aiState, setAiState] = useState<AiVisionState>({
    enabled: true,
    detectedClass: "none",
    confidence: 0,
  })
  const aiStateRef = useRef(aiState)
  useEffect(() => {
    aiStateRef.current = aiState
  }, [aiState])

  const runnerAbortRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)
  const addCounter = useRef(0)
  const partsRef = useRef(state.parts)

  useEffect(() => {
    partsRef.current = state.parts
  }, [state.parts])

  const selected = state.parts.find((p) => p.id === selectedId) ?? null
  const selectedWire = state.wires.find((w) => w.id === selectedWireId) ?? null

  const runtime = useMemo(
    () => (running ? computeRuntime(state, pressed, pinStates) : {}),
    [running, state, pressed, pinStates],
  )

  // Calculate total mA consumption across components
  const totalCurrentMa = useMemo(() => {
    return Object.values(runtime).reduce((acc, r) => acc + (r?.currentMa ?? 0), 0)
  }, [runtime])

  // Run timer effect
  useEffect(() => {
    if (!running) {
      setRunTime(0)
      return
    }
    const timer = setInterval(() => {
      setRunTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [running])

  // Audio effect: if any buzzer is powered in runtime and simulation is running, sound tone!
  useEffect(() => {
    if (!running || isMuted) {
      audioEngine.stopTone()
      return
    }
    const anyBuzzerActive = state.parts.some(
      (p) => p.type === "buzzer" && (runtime[p.id]?.level ?? 0) > 0,
    )
    if (anyBuzzerActive) {
      audioEngine.playTone(850, 180)
    } else {
      audioEngine.stopTone()
    }
  }, [running, isMuted, runtime, state.parts])

  // Helper to commit state changes to history
  const updateState = useCallback((updater: (prev: CircuitState) => CircuitState) => {
    setHistory((h) => {
      const next = updater(h.present)
      return pushState(h, next)
    })
  }, [])

  const handleUndo = useCallback(() => {
    setHistory((h) => historyUndo(h))
  }, [])

  const handleRedo = useCallback(() => {
    setHistory((h) => historyRedo(h))
  }, [])

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
    updateState((s) => ({ ...s, parts: [...s.parts, part] }))
    setSelectedId(part.id)
    setSelectedWireId(null)
  }, [updateState])

  const movePart = useCallback((id: string, x: number, y: number) => {
    updateState((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  }, [updateState])

  const changeProp = useCallback((id: string, k: string, value: string | number) => {
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

  // Keyboard shortcut listener for Undo / Redo / Delete / Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable
      if (isInput) return

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
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleUndo, handleRedo, selectedWireId, selectedId, deleteWire, deletePart])

  const interact = useCallback((id: string, mode: "down" | "up") => {
    setPressed((prev) => {
      const next = new Set(prev)
      if (mode === "down") next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const stopProgram = useCallback(() => {
    runningRef.current = false
    runnerAbortRef.current?.abort()
    runnerAbortRef.current = null
    audioEngine.stopTone()
    setPinStates({})
  }, [])

  const startProgram = useCallback(() => {
    stopProgram()
    runningRef.current = true
    const controller = new AbortController()
    runnerAbortRef.current = controller

    try {
      defineArduinoBlocks()
      const workspace = new Blockly.Workspace()
      const dom = Blockly.utils.xml.textToDom(blocklyXml)
      Blockly.Xml.domToWorkspace(dom, workspace)

      const env: ExecutionEnvironment = {
        setDigitalPin: (pin, state) => {
          setPinStates((prev) => ({ ...prev, [pin]: { ...prev[pin], state } }))
        },
        setAnalogPin: (pin, value) => {
          setPinStates((prev) => ({
            ...prev,
            [pin]: { ...prev[pin], state: value > 0 ? "HIGH" : "LOW", value },
          }))
        },
        setServoAngle: (pin, angle) => {
          setPinStates((prev) => ({ ...prev, [pin]: { ...prev[pin], angle } }))
        },
        setTone: (pin, freq) => {
          setPinStates((prev) => ({
            ...prev,
            [pin]: { ...prev[pin], state: freq ? "HIGH" : "LOW", value: freq ?? 0 },
          }))
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
          setPinStates((prev) => ({
            ...prev,
            [row === 0 ? "lcd_line1" : "lcd_line2"]: text as any,
          }))
        },
        clearLcd: () => {
          setPinStates((prev) => ({
            ...prev,
            lcd_line1: "" as any,
            lcd_line2: "" as any,
          }))
        },
        getSensorValue: (type) => {
          const p = partsRef.current.find((pt) => pt.type === type)
          if (type === "ultrasonic") return Number(p?.props?.distance ?? 100)
          if (type === "ldr") return Number(p?.props?.light ?? 512)
          if (type === "tmp36") return Number(p?.props?.temperature ?? 25)
          return 0
        },
        isAiDetected: (cls) => aiStateRef.current.detectedClass === cls,
        getAiDetectedClass: () => aiStateRef.current.detectedClass,
        getAiConfidence: () => aiStateRef.current.confidence,
        setAiCamera: (enabled) => setIsAiCameraOpen(enabled),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        isRunning: () => runningRef.current,
      }

      runBlocklyProgram(workspace, env, controller.signal).finally(() => {
        workspace.dispose()
      })
    } catch (err) {
      console.error("Failed to run Blockly program:", err)
    }
  }, [blocklyXml, state.parts, stopProgram])

  const clearAll = useCallback(() => {
    stopProgram()
    updateState(() => ({ parts: [], wires: [] }))
    setSelectedId(null)
    setSelectedWireId(null)
    setWiring(null)
    setRunning(false)
    setPressed(new Set())
    setSerialLines([])
  }, [stopProgram, updateState])

  const toggleRun = useCallback(() => {
    setRunning((r) => {
      const next = !r
      if (next) {
        setWiring(null)
        setSelectedId(null)
        setSelectedWireId(null)
        startProgram()
      } else {
        setPressed(new Set())
        stopProgram()
      }
      return next
    })
  }, [startProgram, stopProgram])

  const handleSave = useCallback(() => {
    saveCircuit("default", state, blocklyXml)
    setLastSaved(new Date().toISOString())
  }, [state, blocklyXml])

  const handleSelectTemplate = useCallback(
    (tmpl: ProjectTemplate) => {
      stopProgram()
      updateState(() => tmpl.circuit)
      setBlocklyXml(tmpl.blocklyXml)
      setSelectedId(null)
      setSelectedWireId(null)
      setWiring(null)
      setSerialLines([])
      if (tmpl.tags.includes("AI Vision") || tmpl.id.includes("ai")) {
        setIsAiCameraOpen(true)
      }
    },
    [stopProgram, updateState],
  )

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      audioEngine.setMuted(next)
      return next
    })
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden select-none">
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
        onSave={handleSave}
        isSerialOpen={isSerialOpen}
        onToggleSerial={() => setIsSerialOpen((prev) => !prev)}
        isAiCameraOpen={isAiCameraOpen}
        onToggleAiCamera={() => setIsAiCameraOpen((prev) => !prev)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        activeWireColor={selectedWire ? selectedWire.color : activeWireColor}
        onSelectWireColor={handleSelectWireColor}
        selectedWireId={selectedWireId}
        onDeleteSelectedWire={deleteSelectedWire}
      />

      <TemplateBrowser
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* PictoBlox AI Vision Floating Camera HUD */}
      <AiCameraPanel
        isOpen={isAiCameraOpen}
        onClose={() => setIsAiCameraOpen(false)}
        aiState={aiState}
        onAiStateChange={setAiState}
        isSimRunning={running}
        onStartSim={toggleRun}
      />

      {view === "code" ? (
        <div className="flex-1 min-h-0 w-full overflow-hidden">
          <BlocklyEditor circuit={state} xml={blocklyXml} onXmlChange={setBlocklyXml} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 relative">
          <Palette onQuickAdd={(t) => addPart(t)} />
          <main className="relative min-w-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 relative">
              <CircuitCanvas
                parts={state.parts}
                wires={state.wires}
                selectedId={selectedId}
                tool="select"
                wiring={wiring}
                runtime={runtime}
                running={running}
                onSelect={(id) => {
                  setSelectedId(id)
                  if (id) setSelectedWireId(null)
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
              />
              {running && (
                <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-950/80 backdrop-blur-sm px-4 py-1.5 font-mono text-xs text-emerald-400 shadow-lg flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Simulation Active ({runTime}s)</span>
                </div>
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
          </main>
          <Inspector
            part={selected}
            runtime={selected ? runtime[selected.id] : undefined}
            partCount={state.parts.length}
            wireCount={state.wires.length}
            onChangeProp={changeProp}
            onRotate={rotatePart}
            onDelete={deletePart}
            onDuplicate={duplicatePart}
          />
        </div>
      )}

      {/* Global Bottom Status Bar */}
      <StatusBar
        partCount={state.parts.length}
        wireCount={state.wires.length}
        zoom={1}
        running={running}
        runTime={runTime}
        totalCurrentMa={totalCurrentMa}
        lastSaved={lastSaved}
      />
    </div>
  )
}
