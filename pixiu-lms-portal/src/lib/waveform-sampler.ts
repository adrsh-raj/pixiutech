import type { CircuitState, PinRef } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { NodalSolution } from "./circuit-solver"
import { solveCircuitNodalPotentials } from "./circuit-solver"
import { getBoardForPart, lookupBoardPinState } from "./board-registry"
import { getPwmDutyCycle } from "./electrical-model"

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

  // 1. Direct Board Pin check for high-fidelity PWM / Digital simulation
  const part = state.parts.find((p) => p.id === ref.partId)
  const board = part ? getBoardForPart(part) : undefined
  if (board) {
    const rawPin = ref.pinId.toLowerCase()
    const pinDigits = rawPin.replace(/^(gpio|gp|d|p)/, "")

    // Power rails
    if (board.powerPins.v5?.some((pin) => pin.toLowerCase() === rawPin) || rawPin === "vin" || rawPin === "pos_top" || rawPin === "pos_bot") return 5.0
    if (board.powerPins.v33?.some((pin) => pin.toLowerCase() === rawPin) || rawPin === "3v3" || rawPin === "3v") return 3.3
    if (board.powerPins.gnd.some((pin) => pin.toLowerCase() === rawPin) || rawPin.includes("gnd")) return 0.0

    const boardPin = board.pins.find((bp) =>
      bp.id.toLowerCase() === rawPin ||
      bp.label.toLowerCase() === rawPin ||
      (bp.alternateNames ?? []).some((alias) => alias.toLowerCase() === rawPin) ||
      bp.id.replace(/^(gpio|gp|d|p)/, "") === pinDigits ||
      bp.label.toLowerCase().replace(/^(gpio|gp|d|p)/, "") === pinDigits
    )
    const pinData = boardPin ? lookupBoardPinState(pinStates, boardPin.id, board) : undefined
    if (pinData && boardPin) {
      if (pinData.outputMode === "tone" && (pinData.toneHz ?? 0) > 0) {
        const periodMs = 1000 / (pinData.toneHz ?? 1)
        const phase = (simTimeMs % periodMs) / periodMs
        return phase < 0.5 ? board.logicVoltage : 0
      }

      if (pinData.outputMode === "servo") {
        const periodMs = 20
        const pulseMs = 1 + (Math.max(0, Math.min(180, pinData.angle ?? 90)) / 180)
        return simTimeMs % periodMs < pulseMs ? board.logicVoltage : 0
      }

      if (pinData.outputMode === "pwm" || (pinData.outputMode === undefined && pinData.value !== undefined && pinData.value > 1)) {
        // A PWM output is a full-amplitude pulse train. Only the duty changes.
        const periodMs = 1000 / board.pwmFrequencyDefaultHz
        const duty = getPwmDutyCycle(pinData.value ?? 0)
        const phase = (simTimeMs % periodMs) / periodMs
        return phase < duty ? board.logicVoltage : 0
      }

      // Only a true DAC output is continuous DC; analogWrite remains PWM even
      // when the selected pad also has DAC capability.
      if (pinData.outputMode === "dac" && boardPin.capabilities?.dac && typeof pinData.value === "number") {
        return Number((board.logicVoltage * getPwmDutyCycle(pinData.value)).toFixed(3))
      }
      return pinData.state === "HIGH" ? board.logicVoltage : 0.0
    }
  }

  // 2. Pure nodal potential solver for rest of circuit
  const nodal = cachedNodalSolution ?? solveCircuitNodalPotentials(state, new Set(), pinStates, true)
  // Keep the solver's signed voltage. Scope probes can be below ground, and
  // clipping here silently turned every negative reading into 0 V.
  const voltage = nodal.getPinVoltage(ref)
  return Number.isFinite(voltage) ? voltage : 0
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
