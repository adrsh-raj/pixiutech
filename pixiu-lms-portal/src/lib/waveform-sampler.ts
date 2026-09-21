import type { CircuitState, PinRef } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { NodalSolution } from "./circuit-solver"
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
  simTimeMs: number,
  cachedNodalSolution?: NodalSolution
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
  const nodal = cachedNodalSolution ?? solveCircuitNodalPotentials(state, new Set(), pinStates, true)
  return Math.max(0, Math.min(5.0, nodal.getPinVoltage(ref)))
}

export function computeChannelMetrics(
  history: WaveformPoint[],
  channel: "v1" | "v2",
  isConnected: boolean
): ChannelMetrics {
  if (!isConnected || history.length < 2) {
    return {
      currentV: 0,
      vMax: 0,
      vMin: 0,
      vpp: 0,
      frequencyHz: 0,
      dutyCyclePct: 0,
      isConnected,
    }
  }

  const currentV = history[history.length - 1]?.[channel] ?? 0
  let vMax = -Infinity
  let vMin = Infinity

  for (const point of history) {
    const value = point[channel]
    if (value > vMax) vMax = value
    if (value < vMin) vMin = value
  }

  if (!Number.isFinite(vMax) || !Number.isFinite(vMin)) {
    return {
      currentV: 0,
      vMax: 0,
      vMin: 0,
      vpp: 0,
      frequencyHz: 0,
      dutyCyclePct: 0,
      isConnected,
    }
  }

  const vpp = Number(Math.max(0, vMax - vMin).toFixed(2))
  const mid = (vMax + vMin) / 2
  const crossings: number[] = []
  let highDurationMs = 0
  let totalDurationMs = 0

  for (let i = 1; i < history.length; i += 1) {
    const previous = history[i - 1]
    const point = history[i]
    const dt = point.t - previous.t
    if (Number.isFinite(dt) && dt > 0) {
      totalDurationMs += dt
      if (point[channel] >= mid) highDurationMs += dt
    }

    if (
      vpp > 0.4 &&
      previous[channel] < mid &&
      point[channel] >= mid &&
      Number.isFinite(point.t)
    ) {
      crossings.push(point.t)
    }
  }

  let frequencyHz = 0
  if (crossings.length >= 2) {
    let periodSum = 0
    let periodCount = 0

    for (let i = 1; i < crossings.length; i += 1) {
      const gap = crossings[i] - crossings[i - 1]
      if (Number.isFinite(gap) && gap > 0.5) {
        periodSum += gap
        periodCount += 1
      }
    }

    if (periodCount > 0) {
      const averagePeriodMs = periodSum / periodCount
      if (Number.isFinite(averagePeriodMs) && averagePeriodMs > 0) {
        frequencyHz = Math.round((1000 / averagePeriodMs) * 10) / 10
      }
    }
  }

  const dutyCyclePct =
    totalDurationMs > 0
      ? Math.max(0, Math.min(100, Math.round((highDurationMs / totalDurationMs) * 100)))
      : currentV > 2.5
        ? 100
        : 0

  return {
    currentV: Number(currentV.toFixed(2)),
    vMax: Number(vMax.toFixed(2)),
    vMin: Number(vMin.toFixed(2)),
    vpp,
    frequencyHz,
    dutyCyclePct,
    isConnected,
  }
}
