import type { CircuitState, PinRef } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { solveCircuitNodalPotentials } from "./circuit-solver"

export interface WaveformPoint {
  t: number // timestamp in ms (monotonic)
  v1: number // channel 1 voltage (0 - 5.0V)
  v2: number // channel 2 voltage (0 - 5.0V)
}

export interface ChannelMetrics {
  currentV: number
  vMax: number
  vMin: number
  vpp: number
  frequencyHz: number
  dutyCyclePct: number
  isConnected: boolean
}

export function samplePinVoltage(
  ref: PinRef | null,
  state: CircuitState,
  pinStates: Record<string, ArduinoPinState>,
  runtime: Record<string, PartRuntime>,
  simTimeMs: number
): number {
  if (!ref) return 0

  // 1. Direct Arduino Pin check for high-fidelity PWM / Digital simulation
  const part = state.parts.find((p) => p.id === ref.partId)
  if (part?.type === "arduino-uno") {
    const rawPin = ref.pinId.toLowerCase()
    const pinDigits = rawPin.replace(/^d/, "")

    // Power rails
    if (rawPin === "5v" || rawPin === "vin" || rawPin === "pos_top" || rawPin === "pos_bot") return 5.0
    if (rawPin === "3v3") return 3.3
    if (rawPin.includes("gnd")) return 0.0

    // Digital pins with potential PWM (check both "d13" and "13")
    const pinData = pinStates[rawPin] || pinStates[pinDigits]
    if (pinData) {
      if (typeof pinData.value === "number" && pinData.value > 0 && pinData.value < 255) {
        // Authentic Arduino PWM (490Hz default, period ~2.04ms)
        const periodMs = 2.04
        const duty = pinData.value / 255
        const phase = (simTimeMs % periodMs) / periodMs
        return phase < duty ? 5.0 : 0.0
      }
      return pinData.state === "HIGH" ? 5.0 : 0.0
    }
  }

  // 2. Pure nodal potential solver for rest of circuit
  const nodal = solveCircuitNodalPotentials(state, new Set(), pinStates, true)
  return Math.max(0, Math.min(5.0, nodal.getPinVoltage(ref)))
}

export function computeChannelMetrics(
  history: WaveformPoint[],
  channel: "v1" | "v2",
  isConnected: boolean
): ChannelMetrics {
  if (!isConnected || history.length < 5) {
    return {
      currentV: 0,
      vMax: 0,
      vMin: 0,
      vpp: 0,
      frequencyHz: 0,
      dutyCyclePct: 0,
      isConnected: false,
    }
  }

  const values = history.map((p) => p[channel])
  const currentV = values[values.length - 1] ?? 0
  const vMax = Math.max(...values)
  const vMin = Math.min(...values)
  const vpp = Number((vMax - vMin).toFixed(2))

  // Detect transitions (rising edge crossings around mid-voltage)
  const mid = (vMax + vMin) / 2
  const crossings: number[] = []
  let highDurationMs = 0
  let totalDurationMs = 0

  if (vpp > 0.4 && history.length >= 10) {
    for (let i = 1; i < history.length; i++) {
      const dt = history[i].t - history[i - 1].t
      totalDurationMs += dt
      if (history[i][channel] >= mid) {
        highDurationMs += dt
      }
      // Rising edge
      if (history[i - 1][channel] < mid && history[i][channel] >= mid) {
        crossings.push(history[i].t)
      }
    }
  }

  let frequencyHz = 0
  if (crossings.length >= 2) {
    const intervals: number[] = []
    for (let i = 1; i < crossings.length; i++) {
      intervals.push(crossings[i] - crossings[i - 1])
    }
    const avgPeriodMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
    if (avgPeriodMs > 0) {
      frequencyHz = Number((1000 / avgPeriodMs).toFixed(1))
    }
  }

  const dutyCyclePct =
    totalDurationMs > 0 ? Math.round((highDurationMs / totalDurationMs) * 100) : currentV > 2.5 ? 100 : 0

  return {
    currentV: Number(currentV.toFixed(2)),
    vMax: Number(vMax.toFixed(2)),
    vMin: Number(vMin.toFixed(2)),
    vpp,
    frequencyHz,
    dutyCyclePct,
    isConnected: true,
  }
}
