"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Activity, X, Play, Pause, RotateCcw, Minimize2, Maximize2, GripHorizontal, Sparkles, Sliders } from "lucide-react"
import type { CircuitState, PinRef } from "@/lib/circuit-types"
import type { ArduinoPinState } from "@/lib/simulation"
import type { PartRuntime } from "./part-art"
import { CATALOG } from "@/lib/components-catalog"
import { samplePinVoltage, computeChannelMetrics, type WaveformPoint } from "@/lib/waveform-sampler"

interface Props {
  isOpen: boolean
  onClose: () => void
  state: CircuitState
  runtime: Record<string, PartRuntime>
  pinStates: Record<string, ArduinoPinState>
  running: boolean
  probeCH1: PinRef | null
  probeCH2: PinRef | null
  onSetProbeCH1: (ref: PinRef | null) => void
  onSetProbeCH2: (ref: PinRef | null) => void
  activeProbeToPlace: "ch1" | "ch2" | null
  onSetActiveProbeToPlace: (ch: "ch1" | "ch2" | null) => void
}

const TIMEBASE_OPTIONS = [
  { label: "50ms", windowMs: 500 },
  { label: "100ms", windowMs: 1000 },
  { label: "250ms", windowMs: 2500 },
  { label: "500ms", windowMs: 5000 },
  { label: "1s", windowMs: 10000 },
]

export function Oscilloscope({
  isOpen,
  onClose,
  state,
  runtime,
  pinStates,
  running,
  probeCH1,
  probeCH2,
  onSetProbeCH1,
  onSetProbeCH2,
  activeProbeToPlace,
  onSetActiveProbeToPlace,
}: Props) {
  const [isHold, setIsHold] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [timebaseIndex, setTimebaseIndex] = useState(2) // 250ms / 2.5s window default
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [history, setHistory] = useState<WaveformPoint[]>([])

  const historyRef = useRef<WaveformPoint[]>([])
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  })
  const panelRef = useRef<HTMLDivElement | null>(null)

  const activeWindowMs = TIMEBASE_OPTIONS[timebaseIndex].windowMs

  // Real-time sampling loop (running at ~40-50Hz)
  useEffect(() => {
    if (!isOpen) return

    const interval = setInterval(() => {
      if (isHold) return

      const now = performance.now()
      const v1 = running ? samplePinVoltage(probeCH1, state, pinStates, runtime, now) : 0
      const v2 = running ? samplePinVoltage(probeCH2, state, pinStates, runtime, now) : 0

      const newPoint: WaveformPoint = { t: now, v1, v2 }
      const updated = [...historyRef.current, newPoint]

      // Keep window of points matching activeWindowMs + buffer
      const cutoff = now - activeWindowMs * 1.2
      const trimmed = updated.filter((p) => p.t >= cutoff).slice(-500)

      historyRef.current = trimmed
      setHistory(trimmed)
    }, 25)

    return () => clearInterval(interval)
  }, [isOpen, running, isHold, probeCH1, probeCH2, state, pinStates, runtime, activeWindowMs])

  // Compute live channel metrics
  const metricsCH1 = useMemo(
    () => computeChannelMetrics(history, "v1", Boolean(probeCH1)),
    [history, probeCH1]
  )
  const metricsCH2 = useMemo(
    () => computeChannelMetrics(history, "v2", Boolean(probeCH2)),
    [history, probeCH2]
  )

  // Drag handlers
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
    const panelWidth = panel ? panel.offsetWidth : 440
    const panelHeight = panel ? panel.offsetHeight : 300

    const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, dragStartRef.current.startX + dx))
    const newY = Math.max(10, Math.min(window.innerHeight - panelHeight - 10, dragStartRef.current.startY + dy))
    setPosition({ x: newX, y: newY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch (err) {}
    }
  }

  const formatPin = (ref: PinRef | null) => {
    if (!ref) return "Not Connected"
    const part = state.parts.find((p) => p.id === ref.partId)
    const def = part ? CATALOG[part.type] : null
    const pin = def?.pins.find((p) => p.id === ref.pinId)
    return `${def?.name ?? ref.partId} · ${pin?.label ?? ref.pinId}`
  }

  const uno = state.parts.find((p) => p.type === "arduino-uno")
  const attachPresetCH1 = (pin: string) => {
    if (uno) onSetProbeCH1({ partId: uno.id, pinId: pin })
  }
  const attachPresetCH2 = (pin: string) => {
    if (uno) onSetProbeCH2({ partId: uno.id, pinId: pin })
  }

  if (!isOpen) return null

  // Calculate SVG Screen Path
  const screenWidth = 380
  const screenHeight = 160
  const vMaxScale = 5.5 // 0V to 5.5V full scale

  const generatePath = (channel: "v1" | "v2") => {
    if (history.length === 0) return ""
    const latestT = history[history.length - 1].t
    const startT = latestT - activeWindowMs

    const visiblePoints = history.filter((p) => p.t >= startT)
    if (visiblePoints.length === 0) {
      const currentV = history[history.length - 1][channel]
      const y = screenHeight - (Math.max(0, Math.min(vMaxScale, currentV)) / vMaxScale) * screenHeight
      return `M 0 ${y.toFixed(1)} L ${screenWidth} ${y.toFixed(1)}`
    }

    if (visiblePoints.length === 1) {
      const y = screenHeight - (Math.max(0, Math.min(vMaxScale, visiblePoints[0][channel])) / vMaxScale) * screenHeight
      return `M 0 ${y.toFixed(1)} L ${screenWidth} ${y.toFixed(1)}`
    }

    const points = visiblePoints.map((pt) => {
      const x = ((pt.t - startT) / activeWindowMs) * screenWidth
      const y = screenHeight - (Math.max(0, Math.min(vMaxScale, pt[channel])) / vMaxScale) * screenHeight
      return { x, y }
    })

    let path = ""
    if (points[0].x > 0.5) {
      path = `M 0 ${points[0].y.toFixed(1)} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `
    } else {
      path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `
    }

    for (let i = 1; i < points.length; i++) {
      path += `L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} `
    }

    return path.trim()
  }

  const pathCH1 = generatePath("v1")
  const pathCH2 = generatePath("v2")

  return (
    <div
      ref={panelRef}
      style={{
        transform: position ? `translate(${position.x}px, ${position.y}px)` : undefined,
        touchAction: "none",
      }}
      className={`fixed z-30 transition-shadow select-none ${
        position ? "" : "bottom-14 left-4 sm:left-76 md:left-80"
      }`}
    >
      {/* Minimized Pill */}
      {minimized ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/40 bg-slate-950/95 backdrop-blur-md shadow-2xl text-xs font-mono text-cyan-300 cursor-move"
        >
          <Activity size={14} className="text-cyan-400 animate-pulse" />
          <span className="font-bold">Scope:</span>
          <span className="text-yellow-400 font-bold">CH1: {metricsCH1.currentV.toFixed(1)}V</span>
          <span className="text-cyan-400 font-bold">CH2: {metricsCH2.currentV.toFixed(1)}V</span>
          {isHold && <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1 rounded">HOLD</span>}
          <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2 ml-1">
            <button
              onClick={() => setMinimized(false)}
              className="p-1 hover:text-white rounded cursor-pointer"
              title="Expand Oscilloscope"
            >
              <Maximize2 size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:text-red-400 rounded cursor-pointer"
              title="Close Scope"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* Full Instrument Body */
        <div className="w-[390px] sm:w-[440px] rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl text-slate-200 overflow-hidden flex flex-col ring-1 ring-cyan-500/20">
          {/* Header Bar */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800/80 bg-slate-900/90 cursor-move"
          >
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-cyan-400" />
              <span className="font-bold text-xs tracking-wide text-white">Mini Oscilloscope</span>
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                2-CH DSO
              </span>
            </div>
            <div className="flex items-center gap-1">
              <GripHorizontal size={14} className="text-slate-500 mr-1" />
              <button
                onClick={() => setMinimized(true)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                title="Minimize Scope"
              >
                <Minimize2 size={13} />
              </button>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition cursor-pointer"
                title="Close Oscilloscope"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Oscilloscope CRT Screen */}
          <div className="p-3 bg-slate-950">
            <div className="relative rounded-xl border border-slate-800 bg-[#040810] p-1.5 shadow-inner overflow-hidden">
              <svg
                viewBox={`0 0 ${screenWidth} ${screenHeight}`}
                className="w-full h-[150px] sm:h-[165px] block overflow-hidden"
              >
                {/* 1. CRT Background Phosphor Grid (10 horizontal x 8 vertical divisions) */}
                <defs>
                  <pattern id="scopeGrid" width={screenWidth / 10} height={screenHeight / 8} patternUnits="userSpaceOnUse">
                    <path
                      d={`M ${screenWidth / 10} 0 L 0 0 0 ${screenHeight / 8}`}
                      fill="none"
                      stroke="#132338"
                      strokeWidth="0.8"
                    />
                    {/* Dotted sub-divisions */}
                    <circle cx={(screenWidth / 10) / 2} cy={(screenHeight / 8) / 2} r="0.75" fill="#1e3a5f" />
                  </pattern>
                  {/* Neon Glow Filter */}
                  <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#facc15" floodOpacity="0.9" />
                  </filter>
                  <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.9" />
                  </filter>
                </defs>

                <rect width={screenWidth} height={screenHeight} fill="#040810" />
                <rect width={screenWidth} height={screenHeight} fill="url(#scopeGrid)" />

                {/* Center Crosshairs */}
                <line x1={0} y1={screenHeight / 2} x2={screenWidth} y2={screenHeight / 2} stroke="#1e3a5f" strokeWidth="1" strokeDasharray="4 2" />
                <line x1={screenWidth / 2} y1={0} x2={screenWidth / 2} y2={screenHeight} stroke="#1e3a5f" strokeWidth="1" strokeDasharray="4 2" />

                {/* Voltage reference levels */}
                <text x="5" y="14" fill="#64748b" fontSize="8" fontFamily="monospace">5V</text>
                <text x="5" y={screenHeight / 2 + 3} fill="#64748b" fontSize="8" fontFamily="monospace">2.5V</text>
                <text x="5" y={screenHeight - 4} fill="#64748b" fontSize="8" fontFamily="monospace">0V ⏚</text>

                {/* CH2 Signal Path (Cyan) */}
                {probeCH2 && pathCH2 && (
                  <g>
                    {/* Neon Glow Halo */}
                    <path
                      d={pathCH2}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="5"
                      strokeOpacity="0.35"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Bright Core Beam */}
                    <path
                      d={pathCH2}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* CH1 Signal Path (Electric Yellow) */}
                {probeCH1 && pathCH1 && (
                  <g>
                    {/* Neon Glow Halo */}
                    <path
                      d={pathCH1}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="5"
                      strokeOpacity="0.35"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Bright Core Beam */}
                    <path
                      d={pathCH1}
                      fill="none"
                      stroke="#fef08a"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                )}
              </svg>

              {/* Watermarks & Indicators */}
              <div className="absolute top-2.5 right-3 flex items-center gap-1.5 pointer-events-none">
                {isHold ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 font-mono text-[9px] font-bold animate-pulse">
                    ❄️ HOLD
                  </span>
                ) : running ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[9px] font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px]">
                    STOPPED
                  </span>
                )}
              </div>
            </div>

            {/* Scope Timebase & Run Controls */}
            <div className="flex items-center justify-between mt-2.5 px-0.5 text-xs">
              {/* Timebase Scale */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-slate-400 mr-0.5">Time/Div:</span>
                {TIMEBASE_OPTIONS.map((tb, idx) => (
                  <button
                    key={tb.label}
                    onClick={() => setTimebaseIndex(idx)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                      timebaseIndex === idx
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {/* Run / Hold & Clear */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsHold((prev) => !prev)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    isHold
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                  }`}
                  title={isHold ? "Resume real-time tracing" : "Freeze current waveform"}
                >
                  {isHold ? <Play size={10} /> : <Pause size={10} />}
                  <span>{isHold ? "Resume" : "Hold"}</span>
                </button>

                <button
                  onClick={() => {
                    historyRef.current = []
                    setHistory([])
                  }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Clear Buffer"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            </div>

            {/* Channel Cards */}
            <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-800/80">
              {/* Channel 1 (Yellow) */}
              <div className="p-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-yellow-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block shadow-sm shadow-yellow-400/50" />
                    CH1 (Yellow)
                  </span>
                  <button
                    onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "ch1" ? null : "ch1")}
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition cursor-pointer ${
                      activeProbeToPlace === "ch1"
                        ? "bg-yellow-400 text-slate-950 animate-pulse"
                        : "bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border border-yellow-500/40"
                    }`}
                  >
                    {activeProbeToPlace === "ch1" ? "Click Pin" : probeCH1 ? "Change" : "Clip"}
                  </button>
                </div>
                <div className="font-mono text-[10px] text-slate-300 truncate">
                  {formatPin(probeCH1)}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-yellow-500/20 text-[10px] font-mono text-slate-300">
                  <div>V: <span className="text-yellow-400 font-bold">{metricsCH1.currentV.toFixed(2)}V</span></div>
                  <div>Vpp: <span className="text-white">{metricsCH1.vpp.toFixed(2)}V</span></div>
                  <div>f: <span className="text-yellow-300">{metricsCH1.frequencyHz > 0 ? `${metricsCH1.frequencyHz}Hz` : "--"}</span></div>
                  <div>D: <span className="text-white">{metricsCH1.dutyCyclePct > 0 ? `${metricsCH1.dutyCyclePct}%` : "--"}</span></div>
                </div>
              </div>

              {/* Channel 2 (Cyan) */}
              <div className="p-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400/50" />
                    CH2 (Cyan)
                  </span>
                  <button
                    onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "ch2" ? null : "ch2")}
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition cursor-pointer ${
                      activeProbeToPlace === "ch2"
                        ? "bg-cyan-400 text-slate-950 animate-pulse"
                        : "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40"
                    }`}
                  >
                    {activeProbeToPlace === "ch2" ? "Click Pin" : probeCH2 ? "Change" : "Clip"}
                  </button>
                </div>
                <div className="font-mono text-[10px] text-slate-300 truncate">
                  {formatPin(probeCH2)}
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-cyan-500/20 text-[10px] font-mono text-slate-300">
                  <div>V: <span className="text-cyan-400 font-bold">{metricsCH2.currentV.toFixed(2)}V</span></div>
                  <div>Vpp: <span className="text-white">{metricsCH2.vpp.toFixed(2)}V</span></div>
                  <div>f: <span className="text-cyan-300">{metricsCH2.frequencyHz > 0 ? `${metricsCH2.frequencyHz}Hz` : "--"}</span></div>
                  <div>D: <span className="text-white">{metricsCH2.dutyCyclePct > 0 ? `${metricsCH2.dutyCyclePct}%` : "--"}</span></div>
                </div>
              </div>
            </div>

            {/* Quick Test Presets */}
            {uno && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono flex items-center gap-1">
                  <Sparkles size={11} className="text-indigo-400" /> Presets:
                </span>
                <div className="flex items-center gap-1 font-mono">
                  <button
                    onClick={() => attachPresetCH1("d13")}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-yellow-500/20 hover:text-yellow-300 text-slate-300 transition cursor-pointer"
                    title="Probe CH1 to Uno Pin 13 (Blink)"
                  >
                    CH1: D13
                  </button>
                  <button
                    onClick={() => attachPresetCH2("d9")}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-300 transition cursor-pointer"
                    title="Probe CH2 to Uno Pin 9 (PWM)"
                  >
                    CH2: D9
                  </button>
                  <button
                    onClick={() => attachPresetCH2("5v")}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-red-500/20 hover:text-red-300 text-slate-300 transition cursor-pointer"
                    title="Probe CH2 to 5V Rail"
                  >
                    CH2: 5V
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
