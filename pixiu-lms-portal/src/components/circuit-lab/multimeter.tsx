import { useState, useEffect, useMemo, useRef } from "react"
import { Gauge, X, Volume2, HelpCircle, Sparkles, CheckCircle2, RotateCcw, AlertTriangle, Zap, Minimize2, Maximize2, GripHorizontal } from "lucide-react"
import type { CircuitState, PinRef } from "@/lib/circuit-types"
import type { PartRuntime } from "./part-art"
import type { ArduinoPinState } from "@/lib/simulation"
import { audioEngine } from "@/lib/audio-engine"
import { solveCircuitNodalPotentials } from "@/lib/circuit-solver"

export type DmmMode = "voltage" | "current" | "resistance" | "continuity" | "off"

export interface MultimeterState {
  isOpen: boolean
  mode: DmmMode
  probeRed: PinRef | null
  probeBlack: PinRef | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  state: CircuitState
  runtime: Record<string, PartRuntime>
  pinStates: Record<string, ArduinoPinState>
  running: boolean
  probeRed: PinRef | null
  probeBlack: PinRef | null
  onSetProbeRed: (ref: PinRef | null) => void
  onSetProbeBlack: (ref: PinRef | null) => void
  activeProbeToPlace: "red" | "black" | null
  onSetActiveProbeToPlace: (color: "red" | "black" | null) => void
  isAiCameraOpen?: boolean
}

export function Multimeter({
  isOpen,
  onClose,
  state,
  runtime,
  pinStates,
  running,
  probeRed,
  probeBlack,
  onSetProbeRed,
  onSetProbeBlack,
  activeProbeToPlace,
  onSetActiveProbeToPlace,
  isAiCameraOpen = false,
}: Props) {
  const [mode, setMode] = useState<DmmMode>("voltage")
  const [minimized, setMinimized] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [testedAudio, setTestedAudio] = useState(false)

  const handleTestBeep = () => {
    audioEngine.unlockAudio()
    audioEngine.playTone(2400)
    setTestedAudio(true)
    setTimeout(() => {
      audioEngine.stopTone()
      setTestedAudio(false)
    }, 250)
  }

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  })
  const panelRef = useRef<HTMLDivElement | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return
    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    }
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStartRef.current.mouseX
    const dy = e.clientY - dragStartRef.current.mouseY
    const panel = panelRef.current
    const panelWidth = panel ? panel.offsetWidth : 380
    const panelHeight = panel ? panel.offsetHeight : 200

    const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, dragStartRef.current.startX + dx))
    const newY = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, dragStartRef.current.startY + dy))
    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {}
    }
  }

  // Dynamically solve exact nodal potentials across entire circuit network
  const nodalSolution = useMemo(() => {
    return solveCircuitNodalPotentials(state, new Set(), pinStates, running)
  }, [state, pinStates, running])

  const infoRed = useMemo(() => nodalSolution.getPinInfo(probeRed), [nodalSolution, probeRed])
  const infoBlack = useMemo(() => nodalSolution.getPinInfo(probeBlack), [nodalSolution, probeBlack])

  // Helper to format pin label for display
  const formatPin = (ref: PinRef | null) => {
    if (!ref) return "Not connected"
    const part = state.parts.find((p) => p.id === ref.partId)
    const partName = part ? part.type.replace("-", " ") : ref.partId
    return `${partName.toUpperCase()} (${ref.pinId})`
  }

  // Calculate measurement reading based on probed pins and circuit state
  const reading = useMemo<{
    value: string
    unit: string
    isContinuityBeep: boolean
    explanation: string
    subtext?: string
    isWarning?: boolean
  }>(() => {
    if (mode === "off") {
      return { value: "", unit: "", isContinuityBeep: false, explanation: "Multimeter is powered OFF" }
    }

    if (!probeRed || !probeBlack) {
      return {
        value: "O.L",
        unit: "",
        isContinuityBeep: false,
        explanation: "Clip both RED (+) and BLACK (-) probes to measure",
        subtext: "Click 'Clip Pin' below and select any component terminal on the canvas",
      }
    }

    // Check if probes are directly on a resistor
    const sameResistor =
      probeRed.partId === probeBlack.partId &&
      state.parts.find((p) => p.id === probeRed.partId)?.type === "resistor"

    const resistorPart = sameResistor ? state.parts.find((p) => p.id === probeRed.partId) : null
    const resistorVal = resistorPart ? Number(resistorPart.props.resistance ?? 220) : null

    switch (mode) {
      case "voltage": {
        const pd = nodalSolution.getPotentialDifference(probeRed, probeBlack, state, pinStates)
        const sign = pd.diff >= 0 ? "+" : ""
        return {
          value: `${sign}${pd.diff.toFixed(2)}`,
          unit: "V DC",
          isContinuityBeep: false,
          explanation: pd.explanation,
          subtext: pd.subtext,
          isWarning: pd.isWarning,
        }
      }

      case "resistance": {
        const res = nodalSolution.computeResistanceBetweenPins(probeRed, probeBlack)
        if (res.resistance === Infinity) {
          return {
            value: "O.L",
            unit: "kΩ",
            isContinuityBeep: false,
            explanation: res.explanation,
            subtext: res.subtext,
          }
        }
        const isKilo = res.resistance >= 1000
        const dispVal = isKilo ? (res.resistance / 1000).toFixed(2) : res.resistance.toFixed(1)
        return {
          value: dispVal,
          unit: isKilo ? "kΩ" : "Ω",
          isContinuityBeep: false,
          explanation: res.explanation,
          subtext: res.subtext,
        }
      }

      case "continuity": {
        const res = nodalSolution.computeResistanceBetweenPins(probeRed, probeBlack)
        const isContinuous = Number.isFinite(res.resistance) && res.resistance < 30

        return {
          value: isContinuous ? res.resistance.toFixed(1) : "O.L",
          unit: "Ω",
          isContinuityBeep: isContinuous,
          explanation: isContinuous
            ? `🔊 Closed continuous path (${res.resistance.toFixed(1)}Ω < 30Ω)`
            : (res.explanation || "No continuous low-resistance connection between probes (O.L)"),
          subtext: isContinuous
            ? "Beep tone actively sounding via Web Audio API (2.4 kHz)"
            : res.subtext,
        }
      }

      case "current": {
        const cur = nodalSolution.computeCurrentBetweenPins(probeRed, probeBlack, runtime)
        return {
          value: cur.currentMa.toFixed(1),
          unit: "mA",
          isContinuityBeep: false,
          explanation: cur.explanation,
          subtext: cur.subtext,
          isWarning: cur.isWarning,
        }
      }
    }
  }, [mode, probeRed, probeBlack, state, nodalSolution, pinStates, infoRed, infoBlack, runtime])

  // Play audio buzzer tone if in continuity mode and continuity is detected
  useEffect(() => {
    if (mode === "continuity" && reading.isContinuityBeep) {
      audioEngine.playTone(2400) // 2.4 kHz standard DMM continuity beeper tone
    } else {
      audioEngine.stopTone()
    }
    return () => audioEngine.stopTone()
  }, [mode, reading.isContinuityBeep])

  if (!isOpen) return null

  // Find first resistor and LED for quick test presets
  const firstResistor = state.parts.find((p) => p.type === "resistor")
  const firstLed = state.parts.find((p) => p.type === "led")

  return (
    <div
      ref={panelRef}
      className={`fixed z-40 rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl text-white select-none font-sans transition-shadow duration-200 ${
        position === null
          ? isAiCameraOpen
            ? "bottom-14 right-2 sm:right-[424px] max-w-[calc(100vw-16px)]"
            : "bottom-14 right-4 max-w-[calc(100vw-16px)]"
          : ""
      } ${minimized ? "w-auto min-w-[260px] p-2.5" : "w-80 sm:w-96 p-4 animate-in slide-in-from-bottom-5"}`}
      style={
        position !== null
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: "auto",
              right: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(245, 158, 11, 0.15)",
            }
          : {
              boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(245, 158, 11, 0.15)",
            }
      }
    >
      {/* Minimized View */}
      {minimized ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center justify-between gap-3 px-1 py-0.5 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reposition. Click expand to open full Multimeter."
        >
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400">
                {mode.toUpperCase()}:
              </span>
              <span className="text-xs font-extrabold text-emerald-400 font-mono tracking-tight">
                {reading.value || "---"} {reading.unit}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Expand Multimeter"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
              title="Close Multimeter"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header Bar (Draggable) */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex items-center justify-between pb-3 border-b border-slate-800 cursor-grab active:cursor-grabbing touch-none select-none"
            title="Click & drag header to move Multimeter anywhere on screen"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Gauge size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>Digital Multimeter</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-normal">
                    Physics MNA
                  </span>
                </h3>
                <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                  <GripHorizontal size={11} className="text-slate-500" />
                  <span>Drag to move</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {position !== null && (
                <button
                  onClick={() => setPosition(null)}
                  className="rounded-lg py-0.5 px-1.5 text-[9px] font-mono text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                  title="Reset to default position"
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => setMinimized(true)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                title="Minimize Multimeter"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                title="Close Multimeter"
              >
                <X size={16} />
              </button>
            </div>
          </div>

      {/* Backlit Digital LCD Screen */}
      <div className="mt-3 rounded-xl border-2 border-slate-800 bg-[#0c1f17] p-3 shadow-inner relative overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-500/70 font-bold uppercase">
          <span className="flex items-center gap-1">
            <Zap size={11} className="text-emerald-400" />
            {mode.toUpperCase()} MODE
          </span>
          {reading.isContinuityBeep && (
            <span className="flex items-center gap-1 text-amber-400 animate-pulse font-bold">
              <Volume2 size={12} /> BEEP (CONTINUITY)
            </span>
          )}
        </div>

        {/* Big 7-Segment Value Readout */}
        <div className="my-1.5 flex items-baseline justify-between font-mono">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
            {reading.value || "---"}
          </span>
          <span className="text-sm font-bold text-emerald-400 font-mono">{reading.unit}</span>
        </div>

        {/* Detailed Explanation & Physics Diagnostic */}
        <div className="pt-1 border-t border-emerald-900/40">
          <p className="text-[11px] text-emerald-300 leading-snug font-mono break-words">
            {reading.explanation}
          </p>
          {reading.subtext && (
            <p className="text-[10px] text-amber-300/90 mt-1 font-mono leading-tight">
              💡 {reading.subtext}
            </p>
          )}
        </div>
      </div>

      {/* Warning Notice Banner (e.g. Arduino pin is LOW) */}
      {reading.isWarning && (
        <div className="mt-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 p-2 text-[11px] text-amber-200 font-mono flex items-start gap-2 animate-in fade-in">
          <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold">Voltage Notice: </span>
            <span>{reading.explanation}. {reading.subtext}</span>
          </div>
        </div>
      )}

      {/* Rotary Mode Selector Buttons */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold font-mono">
        <button
          onClick={() => {
            audioEngine.unlockAudio()
            setMode("voltage")
          }}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "voltage"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          DC V
        </button>
        <button
          onClick={() => {
            audioEngine.unlockAudio()
            setMode("current")
          }}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "current"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          mA
        </button>
        <button
          onClick={() => {
            audioEngine.unlockAudio()
            setMode("resistance")
          }}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "resistance"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Ω (Ohm)
        </button>
        <button
          onClick={() => {
            audioEngine.unlockAudio()
            setMode("continuity")
          }}
          className={`py-1.5 rounded-lg text-center flex items-center justify-center gap-1 transition cursor-pointer ${
            mode === "continuity"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Volume2 size={12} /> Cont
        </button>
      </div>

      {/* Continuity Mode Status & Audio Test Bar */}
      {mode === "continuity" && (
        <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`h-2 w-2 rounded-full shrink-0 ${reading.isContinuityBeep ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
            <span className="text-slate-300 truncate">
              {reading.isContinuityBeep ? "Path Closed (< 30Ω)" : "Threshold: R < 30Ω (Silent on Diodes)"}
            </span>
          </div>
          <button
            onClick={handleTestBeep}
            className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 font-bold flex items-center gap-1 ${
              testedAudio
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30"
            }`}
            title="Click to test continuity audio buzzer tone via browser speakers"
          >
            <Volume2 size={11} />
            <span>{testedAudio ? "Sound OK!" : "Test Beep"}</span>
          </button>
        </div>
      )}

      {/* Probe Clips & Attachment Jacks */}
      <div className="mt-3 space-y-2 text-[11px]">
        {/* Red Positive Probe */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-950/40 border border-red-800/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-red-300 leading-tight">RED PROBE (+)</p>
                {probeRed && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono font-bold">
                    {infoRed.voltage > 0 ? `+${infoRed.voltage.toFixed(2)}V` : `${infoRed.voltage.toFixed(2)}V`}
                    {infoRed.isDigitalLow ? " (LOW)" : ""}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-300 truncate font-mono">{formatPin(probeRed)}</p>
              {infoRed.sourceLabel && (
                <p className="text-[9px] text-red-400/80 font-mono truncate">{infoRed.sourceLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {probeRed ? (
              <button
                onClick={() => onSetProbeRed(null)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-red-900/60 hover:bg-red-800 text-red-200 font-semibold cursor-pointer transition"
              >
                Unclip
              </button>
            ) : (
              <button
                onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "red" ? null : "red")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  activeProbeToPlace === "red"
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-red-900/40 hover:bg-red-900/80 text-red-300"
                }`}
              >
                {activeProbeToPlace === "red" ? "Click any Pin..." : "Clip Pin"}
              </button>
            )}
          </div>
        </div>

        {/* Black Negative / Ground Probe */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-slate-400 shrink-0 shadow-[0_0_8px_rgba(148,163,184,0.8)]" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-300 leading-tight">BLACK PROBE (-)</p>
                {probeBlack && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300 font-mono font-bold">
                    {infoBlack.voltage > 0 ? `+${infoBlack.voltage.toFixed(2)}V` : `${infoBlack.voltage.toFixed(2)}V`}
                    {infoBlack.isDigitalLow ? " (LOW)" : ""}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-300 truncate font-mono">{formatPin(probeBlack)}</p>
              {infoBlack.sourceLabel && (
                <p className="text-[9px] text-slate-400 font-mono truncate">{infoBlack.sourceLabel}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {probeBlack ? (
              <button
                onClick={() => onSetProbeBlack(null)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer transition"
              >
                Unclip
              </button>
            ) : (
              <button
                onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "black" ? null : "black")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  activeProbeToPlace === "black"
                    ? "bg-slate-300 text-slate-950 animate-pulse font-bold"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {activeProbeToPlace === "black" ? "Click any Pin..." : "Clip Pin"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Test Presets (1-Click learning buttons) */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-1.5">
        <span className="font-semibold">Quick Test:</span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => {
              audioEngine.unlockAudio()
              const uno = state.parts.find((p) => p.type === "arduino-uno")
              if (uno) {
                onSetProbeRed({ partId: uno.id, pinId: "5v" })
                onSetProbeBlack({ partId: uno.id, pinId: "gnd" })
                setMode("voltage")
              }
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-semibold cursor-pointer transition"
            title="Clip probes across 5V and GND (Measures 5.00V)"
          >
            5V - GND
          </button>
          <button
            onClick={() => {
              audioEngine.unlockAudio()
              const uno = state.parts.find((p) => p.type === "arduino-uno")
              if (uno) {
                onSetProbeRed({ partId: uno.id, pinId: "d13" })
                onSetProbeBlack({ partId: uno.id, pinId: "gnd" })
                setMode("voltage")
              }
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono font-semibold cursor-pointer transition"
            title="Clip probes across Pin 13 and GND"
          >
            D13 - GND
          </button>

          {/* Quick preset for Resistor drop */}
          {firstResistor && (
            <button
              onClick={() => {
                audioEngine.unlockAudio()
                onSetProbeRed({ partId: firstResistor.id, pinId: "a" })
                onSetProbeBlack({ partId: firstResistor.id, pinId: "b" })
                setMode("voltage")
              }}
              className="px-2 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 text-amber-300 font-mono font-semibold cursor-pointer transition"
              title="Clip probes across Resistor terminals to measure voltage drop ΔV"
            >
              Across R
            </button>
          )}

          {/* Quick preset for LED */}
          {firstLed && (
            <button
              onClick={() => {
                audioEngine.unlockAudio()
                onSetProbeRed({ partId: firstLed.id, pinId: "anode" })
                onSetProbeBlack({ partId: firstLed.id, pinId: "cathode" })
                setMode("voltage")
              }}
              className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-mono font-semibold cursor-pointer transition"
              title="Clip probes across LED diode to measure forward drop Vf"
            >
              Across LED
            </button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  )
}
