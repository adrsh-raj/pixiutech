"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, Plus, RotateCcw, X } from "lucide-react"
import type { CircuitState } from "@/lib/circuit-types"
import type { ArduinoPinState } from "@/lib/simulation"
import { getBoardForPart, isBoardPart, lookupBoardPinState } from "@/lib/board-registry"
import { samplePinVoltage } from "@/lib/waveform-sampler"
import { solveCircuitNodalPotentials } from "@/lib/circuit-solver"

interface SimulationSnapshot {
  state: CircuitState
  pinStates: Record<string, ArduinoPinState>
  pressed: Set<string>
  running: boolean
}

interface SimulationSnapshotRef {
  current: SimulationSnapshot
}

interface LogicSample {
  t: number
  levels: boolean[]
  pwm: Array<{ duty: number; periodMs: number } | null>
}

type TriggerMode = "auto" | "rising" | "falling"

interface Props {
  isOpen: boolean
  onClose: () => void
  state: CircuitState
  simulationRef: SimulationSnapshotRef
}

const CHANNEL_COLORS = ["#34d399", "#22d3ee", "#fbbf24", "#c084fc", "#fb7185", "#60a5fa", "#a3e635", "#f97316"]
const SELECT_OPTION_STYLE = { backgroundColor: "#0f172a", color: "#e2e8f0" }

function buildChannelPath(
  samples: LogicSample[],
  channelIndex: number,
  windowMs: number,
): string {
  if (!samples.length) return ""
  const endTime = samples[samples.length - 1].t
  const startTime = endTime - windowMs
  const left = 64
  const width = 680
  const rowTop = 8 + channelIndex * 34
  let currentSampleIndex = 0
  const first = samples[0]
  const firstPwm = first.pwm[channelIndex]
  const firstHigh = firstPwm
    ? ((((startTime % firstPwm.periodMs) + firstPwm.periodMs) % firstPwm.periodMs) < firstPwm.duty * firstPwm.periodMs)
    : Boolean(first.levels[channelIndex])
  let previousHigh = firstHigh
  let path = "M " + left + " " + (rowTop + (previousHigh ? 9 : 26))

  for (let x = 1; x <= width; x += 1) {
    const targetTime = startTime + (x / width) * windowMs
    while (currentSampleIndex + 1 < samples.length && samples[currentSampleIndex + 1].t <= targetTime) {
      currentSampleIndex += 1
    }
    const sample = samples[currentSampleIndex]
    const pwm = sample.pwm[channelIndex]
    const high = pwm
      ? ((((targetTime % pwm.periodMs) + pwm.periodMs) % pwm.periodMs) < pwm.duty * pwm.periodMs)
      : Boolean(sample.levels[channelIndex])
    if (high !== previousHigh) {
      path += " H " + (left + x) + " V " + (rowTop + (high ? 9 : 26))
      previousHigh = high
    }
  }
  path += " H " + (left + width)
  return path
}

export function LogicAnalyzer({ isOpen, onClose, state, simulationRef }: Props) {
  const boardPart = useMemo(() => state.parts.find((part) => isBoardPart(part.type)) ?? null, [state.parts])
  const board = boardPart ? getBoardForPart(boardPart) : undefined
  const pinOptions = useMemo(
    () => board?.pins.filter((pin) => (pin.kind === "digital" || pin.kind === "analog") && pin.id !== "aref") ?? [],
    [board],
  )
  const suggestedPinIds = useMemo(() => {
    if (!board) return []
    const candidates: string[] = []
    if (board.builtInLedPin) candidates.push(board.builtInLedPin)
    candidates.push(...board.pins.filter((pin) => pin.kind === "digital" && pin.capabilities?.pwm).map((pin) => pin.id))
    candidates.push(...board.pins.filter((pin) => pin.kind === "digital").map((pin) => pin.id))
    candidates.push(...board.pins.filter((pin) => pin.kind === "analog").map((pin) => pin.id))
    return Array.from(new Set(candidates)).filter((id) => pinOptions.some((pin) => pin.id === id))
  }, [board, pinOptions])

  const [channelPins, setChannelPins] = useState<string[]>([])
  const [windowMs, setWindowMs] = useState(100)
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("auto")
  const [armed, setArmed] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const [samples, setSamples] = useState<LogicSample[]>([])
  const previousLevelsRef = useRef<boolean[]>([])

  useEffect(() => {
    if (!pinOptions.length) {
      setChannelPins([])
      return
    }
    setChannelPins((current) => {
      const valid = current.filter((pinId) => pinOptions.some((pin) => pin.id === pinId))
      return valid.length ? valid.slice(0, 8) : suggestedPinIds.slice(0, 4)
    })
  }, [pinOptions, suggestedPinIds])

  useEffect(() => {
    if (!isOpen || !armed || !channelPins.length) return
    previousLevelsRef.current = []
    const captureSample = () => {
      const snapshot = simulationRef.current
      const activeBoardPart = snapshot.state.parts.find((part) => isBoardPart(part.type))
      const activeBoard = activeBoardPart ? getBoardForPart(activeBoardPart) : undefined
      if (!activeBoardPart || !activeBoard) return

      const now = performance.now()
      const nodal = solveCircuitNodalPotentials(snapshot.state, snapshot.pressed, snapshot.pinStates, true)
      const readings = channelPins.map((pinId) => {
        const pin = activeBoard.pins.find((item) => item.id === pinId)
        if (!pin) return { level: false, pwm: null as LogicSample["pwm"][number] }
        const pinState = lookupBoardPinState(snapshot.pinStates, pin.id, activeBoard)
        const value = typeof pinState?.value === "number" ? pinState.value : undefined
        const isPwm =
          Boolean(pin.capabilities?.pwm) &&
          !pin.capabilities?.dac &&
          value !== undefined &&
          value > 0 &&
          value < 255
        const pwm = isPwm
          ? { duty: Math.max(0, Math.min(1, value / 255)), periodMs: 1000 / activeBoard.pwmFrequencyDefaultHz }
          : null
        const voltage = samplePinVoltage(
          { partId: activeBoardPart.id, pinId: pin.id },
          snapshot.state,
          snapshot.pinStates,
          now,
          nodal,
        )
        return {
          level: pwm
            ? (((now % pwm.periodMs) + pwm.periodMs) % pwm.periodMs) < pwm.duty * pwm.periodMs
            : voltage >= activeBoard.logicVoltage * 0.5,
          pwm,
        }
      })
      const levels = readings.map((reading) => reading.level)
      const nextSample: LogicSample = { t: now, levels, pwm: readings.map((reading) => reading.pwm) }
      const previous = previousLevelsRef.current
      const edgeReached =
        triggerMode === "rising"
          ? previous.length > 0 && !previous[0] && levels[0]
          : triggerMode === "falling"
            ? previous.length > 0 && previous[0] && !levels[0]
            : true
      previousLevelsRef.current = levels

      if (triggerMode !== "auto" && !triggered && !edgeReached) return
      if (triggerMode !== "auto" && !triggered) {
        setTriggered(true)
        setSamples([nextSample])
        return
      }
      setSamples((current) => {
        const next = [...current, nextSample]
        return next.length > 1600 ? next.slice(-1200) : next
      })
    }

    captureSample()
    const timer = window.setInterval(captureSample, 20)
    return () => window.clearInterval(timer)
  }, [armed, channelPins, isOpen, simulationRef, triggered, triggerMode])

  const chartHeight = Math.max(64, channelPins.length * 34 + 16)
  const chartPaths = channelPins.map((_, index) => buildChannelPath(samples, index, windowMs))
  const captureStatus = !armed ? "READY" : triggerMode === "auto" || triggered ? "CAPTURING" : "WAITING FOR EDGE"
  const simulationRunning = simulationRef.current.running

  if (!isOpen) return null

  return (
    <section
      role="dialog"
      aria-label="Logic Analyzer"
      className="fixed bottom-16 left-2 right-2 z-[45] flex max-h-[62dvh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[min(760px,calc(100vw-2rem))]"
    >
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={16} className="shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <h2 className="truncate text-xs font-semibold text-slate-100">Logic Analyzer</h2>
            <p className="text-[9px] text-slate-500">Digital pin timing · 0/1 and PWM</p>
          </div>
          <span className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[8px] text-slate-400">{captureStatus}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Logic Analyzer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
          <X size={15} />
        </button>
      </header>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        {!boardPart || !board ? (
          <div className="rounded-xl border border-dashed border-slate-700 px-4 py-7 text-center">
            <p className="text-sm font-semibold text-slate-200">Add a supported controller first</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">The analyzer reads digital and analog-capable pins from the board in this circuit.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {channelPins.map((pinId, index) => (
                <label key={index} className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-400">
                  <span className="font-mono font-bold" style={{ color: CHANNEL_COLORS[index % CHANNEL_COLORS.length] }}>CH{index + 1}</span>
                  <select
                    style={{ colorScheme: "dark" }}
                    aria-label={"Logic Analyzer channel " + (index + 1) + " pin"}
                    value={pinId}
                    onChange={(event) => {
                    setChannelPins((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))
                    setSamples([])
                    setTriggered(triggerMode === "auto")
                    previousLevelsRef.current = []
                  }}
                    className="max-w-24 bg-transparent font-mono text-[10px] text-slate-200 outline-none"
                  >
                    {pinOptions.map((pin) => <option key={pin.id} value={pin.id} style={SELECT_OPTION_STYLE}>{pin.label}</option>)}
                  </select>
                  {channelPins.length > 1 && (
                    <button
                      type="button"
                      aria-label={"Remove channel " + (index + 1)}
                      onClick={() => {
                        setChannelPins((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        setSamples([])
                        setTriggered(triggerMode === "auto")
                        previousLevelsRef.current = []
                      }}
                      className="rounded px-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                    >
                      ×
                    </button>
                  )}
                </label>
              ))}
              {channelPins.length < Math.min(8, pinOptions.length) && (
                <button
                  type="button"
                  onClick={() => {
                    const nextPin = suggestedPinIds.find((pinId) => !channelPins.includes(pinId))
                    if (!nextPin) return
                    setSamples([])
                    setTriggered(triggerMode === "auto")
                    previousLevelsRef.current = []
                    setChannelPins((current) => [...current, nextPin])
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-700 px-2 py-1.5 text-[10px] text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200"
                >
                  <Plus size={12} /> Channel
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                Window
                <select
                  style={{ colorScheme: "dark" }}
                    aria-label="Logic Analyzer capture window"
                  value={windowMs}
                  onChange={(event) => setWindowMs(Number(event.target.value))}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
                >
                  <option value={20} style={SELECT_OPTION_STYLE}>20 ms</option>
                  <option value={100} style={SELECT_OPTION_STYLE}>100 ms</option>
                  <option value={500} style={SELECT_OPTION_STYLE}>500 ms</option>
                  <option value={1000} style={SELECT_OPTION_STYLE}>1 second</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                Trigger
                <select
                  style={{ colorScheme: "dark" }}
                    aria-label="Logic Analyzer trigger"
                  value={triggerMode}
                  onChange={(event) => {
                    const mode = event.target.value as TriggerMode
                    setTriggerMode(mode)
                    setTriggered(mode === "auto")
                    setSamples([])
                    previousLevelsRef.current = []
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
                >
                  <option value="auto" style={SELECT_OPTION_STYLE}>Auto</option>
                  <option value="rising" style={SELECT_OPTION_STYLE}>CH1 rising</option>
                  <option value="falling" style={SELECT_OPTION_STYLE}>CH1 falling</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  previousLevelsRef.current = []
                  setSamples([])
                  setTriggered(triggerMode === "auto")
                  setArmed((current) => !current)
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                {armed ? <RotateCcw size={12} /> : <Activity size={12} />}
                {armed ? "Stop capture" : "Arm capture"}
              </button>
            </div>

            {!simulationRunning && (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200/80">
                Simulation is stopped. Arm capture, then run the Blockly program to record changing signals.
              </p>
            )}

            {samples.length === 0 ? (
              <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-slate-800 bg-slate-950/70 text-center text-[10px] text-slate-500">
                Select board pins, arm capture, and run the circuit.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
                <svg
                  viewBox={"0 0 760 " + chartHeight}
                  role="img"
                  aria-label={"Digital signal capture for " + channelPins.map((pinId) => pinOptions.find((pin) => pin.id === pinId)?.label ?? pinId).join(", ")}
                  className="h-auto min-h-[105px] w-full min-w-[520px]"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((tick) => {
                    const x = 64 + tick * 68
                    return <line key={tick} x1={x} y1={2} x2={x} y2={chartHeight - 2} stroke="#1f2b3b" strokeDasharray={tick === 0 ? undefined : "2 4"} />
                  })}
                  {channelPins.map((pinId, index) => {
                    const y = 8 + index * 34
                    const pinLabel = pinOptions.find((pin) => pin.id === pinId)?.label ?? pinId
                    return (
                      <g key={index}>
                        <text x={5} y={y + 18} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} fontSize="9" fontWeight="600">CH{index + 1} {pinLabel}</text>
                        <text x={54} y={y + 11} fill="#64748b" fontSize="7">1</text>
                        <text x={54} y={y + 28} fill="#64748b" fontSize="7">0</text>
                        <line x1={64} y1={y + 17} x2={744} y2={y + 17} stroke="#172233" />
                        <path d={chartPaths[index]} fill="none" stroke={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} strokeWidth="2" strokeLinejoin="round" />
                      </g>
                    )
                  })}
                </svg>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
              <span>Capture samples at 50 Hz; PWM pulses are drawn from the selected board's configured PWM frequency.</span>
              <button
                type="button"
                onClick={() => {
                  previousLevelsRef.current = []
                  setSamples([])
                  setTriggered(false)
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-slate-800 hover:text-slate-200"
              >
                <RotateCcw size={10} /> Clear trace
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
