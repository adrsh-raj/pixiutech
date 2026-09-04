"use client"

import { useState, useEffect, useMemo } from "react"
import { Gauge, X, Volume2, HelpCircle, Sparkles, CheckCircle2, RotateCcw, AlertTriangle, Zap } from "lucide-react"
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
}: Props) {
  const [mode, setMode] = useState<DmmMode>("voltage")

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
        if (resistorVal !== null) {
          return {
            value: `${resistorVal.toFixed(1)}`,
            unit: "Ω",
            isContinuityBeep: false,
            explanation: `Component Resistance across Resistor terminals`,
            subtext: `Marking bands indicate nominal value: ${resistorVal}Ω`,
          }
        }
        // If probing same tie-point or direct wire
        if (
          (probeRed.partId === probeBlack.partId && probeRed.pinId === probeBlack.pinId) ||
          (infoRed.netId === infoBlack.netId && infoRed.netId !== -1)
        ) {
          return {
            value: "0.0",
            unit: "Ω",
            isContinuityBeep: false,
            explanation: "Zero resistance (Direct copper wire / continuous net)",
          }
        }
        return {
          value: "O.L",
          unit: "kΩ",
          isContinuityBeep: false,
          explanation: "Open Circuit / High Resistance path",
          subtext: "Probes are not connected by a continuous resistive element",
        }
      }

      case "continuity": {
        const isDirect =
          (probeRed.partId === probeBlack.partId && probeRed.pinId === probeBlack.pinId) ||
          (infoRed.netId === infoBlack.netId && infoRed.netId !== -1)
        const isLowR = resistorVal !== null && resistorVal < 30

        const isContinuous = isDirect || isLowR

        return {
          value: isContinuous ? "0.0" : "O.L",
          unit: "Ω",
          isContinuityBeep: isContinuous,
          explanation: isContinuous
            ? "🔊 Closed continuous path (Resistance < 30Ω)"
            : "No continuous connection between probes",
          subtext: isContinuous ? "Beep tone actively sounding via Web Audio API" : undefined,
        }
      }

      case "current": {
        const pd = nodalSolution.getPotentialDifference(probeRed, probeBlack, state, pinStates)
        if (sameResistor && resistorVal && resistorVal > 0) {
          const currentMa = (Math.abs(pd.diff) / resistorVal) * 1000
          return {
            value: `${currentMa.toFixed(1)}`,
            unit: "mA",
            isContinuityBeep: false,
            explanation: `Current flowing through ${resistorVal}Ω Resistor`,
            subtext: `Ohm's Law: I = ΔV / R = ${Math.abs(pd.diff).toFixed(2)}V / ${resistorVal}Ω = ${currentMa.toFixed(1)} mA`,
          }
        }

        // If measuring active LED
        const led = state.parts.find((p) => p.id === probeRed.partId || p.id === probeBlack.partId)
        const ledRuntime = led ? runtime[led.id] : null
        if (ledRuntime && ledRuntime.currentMa !== undefined) {
          return {
            value: `${ledRuntime.currentMa.toFixed(1)}`,
            unit: "mA",
            isContinuityBeep: false,
            explanation: `Loop Current through LED branch: ${ledRuntime.currentMa} mA`,
            subtext: ledRuntime.burnt ? "⚠️ BURNOUT OVERCURRENT!" : "Normal safe operating range",
            isWarning: ledRuntime.burnt,
          }
        }

        return {
          value: "0.0",
          unit: "mA",
          isContinuityBeep: false,
          explanation: "In-line current measurement requires closed active loop",
          subtext: "Clip probes in series or across component terminals during simulation",
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
      className="fixed bottom-14 right-4 z-40 w-80 sm:w-96 rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl p-4 text-white animate-in slide-in-from-bottom-5 duration-200 select-none font-sans"
      style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(245, 158, 11, 0.15)" }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Gauge size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>Digital Multimeter</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-normal">
                Physics MNA
              </span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Model DMM-2026</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          title="Close Multimeter"
        >
          <X size={16} />
        </button>
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
          onClick={() => setMode("voltage")}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "voltage"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          DC V
        </button>
        <button
          onClick={() => setMode("current")}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "current"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          mA
        </button>
        <button
          onClick={() => setMode("resistance")}
          className={`py-1.5 rounded-lg text-center transition cursor-pointer ${
            mode === "resistance"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Ω (Ohm)
        </button>
        <button
          onClick={() => setMode("continuity")}
          className={`py-1.5 rounded-lg text-center flex items-center justify-center gap-1 transition cursor-pointer ${
            mode === "continuity"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Volume2 size={12} /> Cont
        </button>
      </div>

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
    </div>
  )
}
