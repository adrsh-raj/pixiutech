"use client"

import { useState, useEffect, useMemo } from "react"
import { Gauge, X, Volume2, HelpCircle, Sparkles, CheckCircle2, RotateCcw } from "lucide-react"
import type { CircuitState, PinRef } from "@/lib/circuit-types"
import type { PartRuntime } from "./part-art"
import type { ArduinoPinState } from "@/lib/simulation"
import { audioEngine } from "@/lib/audio-engine"

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

  // Helper to format pin label for display
  const formatPin = (ref: PinRef | null) => {
    if (!ref) return "Not connected"
    const part = state.parts.find((p) => p.id === ref.partId)
    const partName = part ? part.type.replace("-", " ") : ref.partId
    return `${partName.toUpperCase()} (${ref.pinId})`
  }

  // Calculate measurement reading based on probed pins and circuit state
  const reading = useMemo<{ value: string; unit: string; isContinuityBeep: boolean; explanation: string }>(() => {
    if (mode === "off") {
      return { value: "", unit: "", isContinuityBeep: false, explanation: "Multimeter is powered OFF" }
    }

    if (!probeRed || !probeBlack) {
      return {
        value: "O.L",
        unit: "",
        isContinuityBeep: false,
        explanation: "Clip both RED (+) and BLACK (-) probes to measure",
      }
    }

    // Helper: evaluate pin potential
    const getPinPotential = (ref: PinRef): number => {
      const part = state.parts.find((p) => p.id === ref.partId)
      if (!part) return 0

      if (part.type === "arduino-uno") {
        if (ref.pinId === "5v" || ref.pinId === "vin") return 5.0
        if (ref.pinId === "3v3") return 3.3
        if (ref.pinId === "gnd" || ref.pinId === "gnd_pwr") return 0.0

        // Digital pins
        const pNum = ref.pinId.replace(/^d/, "")
        const pState = pinStates[pNum]
        if (pState?.state === "HIGH") return 5.0
        if (pState?.value !== undefined) return Number((5.0 * (pState.value / 255)).toFixed(2))
        return 0.0
      }

      if (part.type === "battery") {
        if (ref.pinId === "pos") return 9.0
        if (ref.pinId === "neg") return 0.0
      }

      // Check if connected via wire to a known potential
      for (const wire of state.wires) {
        let otherRef: PinRef | null = null
        if (wire.from.partId === ref.partId && wire.from.pinId === ref.pinId) otherRef = wire.to
        if (wire.to.partId === ref.partId && wire.to.pinId === ref.pinId) otherRef = wire.from
        if (otherRef) {
          const otherPart = state.parts.find((p) => p.id === otherRef!.partId)
          if (otherPart?.type === "arduino-uno") {
            if (otherRef.pinId === "5v") return 5.0
            if (otherRef.pinId === "3v3") return 3.3
            if (otherRef.pinId.includes("gnd")) return 0.0
            const pNum = otherRef.pinId.replace(/^d/, "")
            const ps = pinStates[pNum]
            if (ps?.state === "HIGH") return 5.0
          }
        }
      }

      return 0.0
    }

    const vRed = getPinPotential(probeRed)
    const vBlack = getPinPotential(probeBlack)

    // Check if probes are directly on a resistor
    const sameResistor =
      probeRed.partId === probeBlack.partId &&
      state.parts.find((p) => p.id === probeRed.partId)?.type === "resistor"

    const resistorVal = sameResistor
      ? Number(state.parts.find((p) => p.id === probeRed.partId)?.props.resistance ?? 220)
      : null

    switch (mode) {
      case "voltage": {
        const diff = vRed - vBlack
        const sign = diff >= 0 ? "+" : ""
        return {
          value: `${sign}${diff.toFixed(2)}`,
          unit: "V DC",
          isContinuityBeep: false,
          explanation: `Potential Difference: Red (${vRed.toFixed(2)}V) minus Black (${vBlack.toFixed(2)}V)`,
        }
      }

      case "resistance": {
        if (resistorVal !== null) {
          return {
            value: `${resistorVal.toFixed(1)}`,
            unit: "Ω",
            isContinuityBeep: false,
            explanation: `Component Resistance across Resistor terminals`,
          }
        }
        // If probing same tie-point or wire
        if (probeRed.partId === probeBlack.partId && probeRed.pinId === probeBlack.pinId) {
          return { value: "0.0", unit: "Ω", isContinuityBeep: false, explanation: "Zero resistance (Direct short)" }
        }
        return {
          value: "O.L",
          unit: "kΩ",
          isContinuityBeep: false,
          explanation: "Open Circuit / High Resistance path",
        }
      }

      case "continuity": {
        const isContinuous =
          (probeRed.partId === probeBlack.partId && probeRed.pinId === probeBlack.pinId) ||
          (resistorVal !== null && resistorVal < 30)

        return {
          value: isContinuous ? "0.0" : "O.L",
          unit: "Ω",
          isContinuityBeep: isContinuous,
          explanation: isContinuous
            ? "🔊 Closed connection (Resistance < 30Ω)"
            : "No continuous connection between probes",
        }
      }

      case "current": {
        // If measuring active LED current
        const led = state.parts.find((p) => p.id === probeRed.partId || p.id === probeBlack.partId)
        const ledRuntime = led ? runtime[led.id] : null
        const current = ledRuntime?.currentMa ?? 0
        return {
          value: `${current.toFixed(1)}`,
          unit: "mA",
          isContinuityBeep: false,
          explanation: `Measured Loop Branch Current: ${current.toFixed(1)} mA`,
        }
      }

      default:
        return { value: "0.00", unit: "V", isContinuityBeep: false, explanation: "" }
    }
  }, [mode, probeRed, probeBlack, state, pinStates, runtime])

  // Play continuity audio tone when beep is triggered
  useEffect(() => {
    if (reading.isContinuityBeep && isOpen && mode === "continuity") {
      audioEngine.playTone(2400)
    } else {
      audioEngine.stopTone()
    }
    return () => audioEngine.stopTone()
  }, [reading.isContinuityBeep, isOpen, mode])

  if (!isOpen) return null

  return (
    <div className="fixed top-14 right-4 z-40 w-80 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md text-white select-none animate-in fade-in zoom-in-95">
      {/* Window Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Gauge size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">Digital Multimeter</h3>
            <span className="text-[10px] text-slate-400 font-mono">Model DMM-2026</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          title="Close Multimeter"
        >
          <X size={16} />
        </button>
      </div>

      {/* Backlit Digital LCD Screen */}
      <div className="mt-3 rounded-xl border-2 border-slate-800 bg-[#0c1f17] p-3 shadow-inner relative overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-500/70 font-bold uppercase">
          <span>{mode.toUpperCase()} MODE</span>
          {reading.isContinuityBeep && (
            <span className="flex items-center gap-1 text-amber-400 animate-pulse">
              <Volume2 size={12} /> BEEP
            </span>
          )}
        </div>

        {/* Big 7-Segment Value Readout */}
        <div className="my-1 flex items-baseline justify-between font-mono">
          <span className="text-3xl font-extrabold tracking-tight text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
            {reading.value || "---"}
          </span>
          <span className="text-sm font-bold text-emerald-500">{reading.unit}</span>
        </div>

        <p className="text-[10px] text-emerald-400/80 truncate font-mono">{reading.explanation}</p>
      </div>

      {/* Rotary Mode Selector Buttons */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold font-mono">
        <button
          onClick={() => setMode("voltage")}
          className={`py-1.5 rounded-lg text-center transition ${
            mode === "voltage"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          DC V
        </button>
        <button
          onClick={() => setMode("current")}
          className={`py-1.5 rounded-lg text-center transition ${
            mode === "current"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          mA
        </button>
        <button
          onClick={() => setMode("resistance")}
          className={`py-1.5 rounded-lg text-center transition ${
            mode === "resistance"
              ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Ω (Ohm)
        </button>
        <button
          onClick={() => setMode("continuity")}
          className={`py-1.5 rounded-lg text-center flex items-center justify-center gap-1 transition ${
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
        <div className="flex items-center justify-between p-2 rounded-xl bg-red-950/40 border border-red-800/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <div className="min-w-0">
              <p className="font-bold text-red-300 leading-tight">RED PROBE (+)</p>
              <p className="text-[10px] text-slate-400 truncate font-mono">{formatPin(probeRed)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {probeRed ? (
              <button
                onClick={() => onSetProbeRed(null)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-red-900/60 hover:bg-red-800 text-red-200 font-semibold"
              >
                Unclip
              </button>
            ) : (
              <button
                onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "red" ? null : "red")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition ${
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
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-700/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-3 w-3 rounded-full bg-slate-400 shrink-0 shadow-[0_0_8px_rgba(148,163,184,0.8)]" />
            <div className="min-w-0">
              <p className="font-bold text-slate-300 leading-tight">BLACK PROBE (-)</p>
              <p className="text-[10px] text-slate-400 truncate font-mono">{formatPin(probeBlack)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {probeBlack ? (
              <button
                onClick={() => onSetProbeBlack(null)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Unclip
              </button>
            ) : (
              <button
                onClick={() => onSetActiveProbeToPlace(activeProbeToPlace === "black" ? null : "black")}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition ${
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
      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span>Quick Test:</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              const uno = state.parts.find((p) => p.type === "arduino-uno")
              if (uno) {
                onSetProbeRed({ partId: uno.id, pinId: "5v" })
                onSetProbeBlack({ partId: uno.id, pinId: "gnd" })
                setMode("voltage")
              }
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono font-semibold"
            title="Clip probes across 5V and GND"
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
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono font-semibold"
            title="Clip probes across Pin 13 and GND"
          >
            D13 - GND
          </button>
        </div>
      </div>
    </div>
  )
}
