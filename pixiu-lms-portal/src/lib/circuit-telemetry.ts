/**
 * PIXIU TECH CYBERLAB — SIMULATOR TELEMETRY SERIALIZER
 * 
 * Extracts live nodal potentials, MCU pin states, component physical runtimes,
 * and Circuit Doctor health diagnostics, serializing them into a structured,
 * versioned, truth-labeled telemetry payload for Pixiu AI Circuit Copilot.
 * 
 * Truth-Labeling Model:
 * - "simulated": Values derived from live physics solver and execution kernel.
 * - "static-rule-inference": Rules evaluated from static graph topology.
 * - "unknown": Indeterminate, disconnected, or unpowered states.
 * 
 * Bounded Token Budget:
 * Compresses complex circuit state into a compact ~150-250 token context prompt
 * with strict character limits to protect model context windows.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { CircuitState, PartType } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { getBoardForPart, isBoardPart, type BoardDefinition } from "./board-registry"
import { diagnoseCircuit, type CircuitHealthReport } from "./circuit-doctor"
import { solveCircuitNodalPotentials, type NodalSolution } from "./circuit-solver"

// ============================================================================
// Types & Contracts
// ============================================================================

export type TelemetryTruthSource = "simulated" | "static-rule-inference" | "unknown"

export interface PinTelemetryItem {
  pinId: string
  label: string
  state: "HIGH" | "LOW" | "PWM" | "ANALOG" | "DISCONNECTED" | "UNKNOWN"
  voltage: number
  dutyCyclePercent?: number
  currentMa?: number
  truth: TelemetryTruthSource
}

export interface ComponentTelemetryItem {
  partId: string
  type: PartType
  status: string
  details: Record<string, string | number | boolean>
  truth: TelemetryTruthSource
}

export interface DiagnosticTelemetrySummary {
  healthScore: number
  healthStatus: "healthy" | "needs-attention" | "danger"
  criticalCount: number
  warningCount: number
  criticalIssues: string[]
  warningIssues: string[]
  truth: TelemetryTruthSource
}

export interface SerializedCircuitTelemetry {
  schemaVersion: "1.0.0"
  timestamp: number
  board: {
    id: string
    name: string
    logicVoltage: number
    truth: TelemetryTruthSource
  } | null
  powerRails: {
    rail5v?: number
    rail3v3?: number
    gnd: number
    battery9v?: number
    truth: TelemetryTruthSource
  }
  pins: PinTelemetryItem[]
  components: ComponentTelemetryItem[]
  diagnostics: DiagnosticTelemetrySummary
  compactPromptString: string
  tokenCountEstimate: number
}

export interface TelemetrySerializationParams {
  circuit: CircuitState
  pinStates?: Record<string, ArduinoPinState>
  runtime?: Record<string, PartRuntime>
  nodalSolution?: NodalSolution
  healthReport?: CircuitHealthReport
  /** Maximum character length for compactPromptString (default 1500 chars ~ 375 tokens) */
  maxChars?: number
}

// ============================================================================
// Telemetry Serializer Implementation
// ============================================================================

export function serializeCircuitTelemetry(
  params: TelemetrySerializationParams,
): SerializedCircuitTelemetry {
  const {
    circuit,
    pinStates = {},
    runtime = {},
    maxChars = 1500,
  } = params

  const timestamp = Date.now()

  // 1. Resolve Board
  const boardPart = circuit.parts.find((p) => isBoardPart(p.type))
  const boardDef: BoardDefinition | undefined = boardPart ? getBoardForPart(boardPart) : undefined

  // 2. Resolve Nodal Solution if not provided
  const solution: NodalSolution =
    params.nodalSolution || solveCircuitNodalPotentials(circuit, new Set(), pinStates, true)

  // 3. Resolve Circuit Doctor Health Report if not provided
  const healthReport: CircuitHealthReport =
    params.healthReport || diagnoseCircuit(circuit, runtime, pinStates)

  // 4. Power Rails Extraction
  const powerRails: SerializedCircuitTelemetry["powerRails"] = {
    gnd: 0.0,
    truth: "simulated",
  }

  if (boardPart) {
    const v5Info = solution.getPinVoltage({ partId: boardPart.id, pinId: "5v" })
    if (v5Info > 0.5) powerRails.rail5v = Number(v5Info.toFixed(2))

    const v33Info = solution.getPinVoltage({ partId: boardPart.id, pinId: "3v3" })
    if (v33Info > 0.5) powerRails.rail3v3 = Number(v33Info.toFixed(2))
  }

  const batteryPart = circuit.parts.find((p) => p.type === "battery")
  if (batteryPart) {
    const vBat = solution.getPinVoltage({ partId: batteryPart.id, pinId: "pos" })
    powerRails.battery9v = Number(vBat.toFixed(2))
  }

  // 5. Board Pin Telemetry Extraction
  const pins: PinTelemetryItem[] = []
  if (boardPart && boardDef) {
    for (const bp of boardDef.pins) {
      if (bp.kind !== "digital" && bp.kind !== "analog") continue

      const pinRef = { partId: boardPart.id, pinId: bp.id }
      const volt = solution.getPinVoltage(pinRef)
      const pinKeyStr = bp.id.toLowerCase()
      const rawState = pinStates[pinKeyStr] || pinStates[bp.id]

      let state: PinTelemetryItem["state"] = "DISCONNECTED"
      let dutyCycle: number | undefined
      let truth: TelemetryTruthSource = "unknown"

      // Check if pin is physically wired
      const isWired = circuit.wires.some(
        (w) =>
          (w.from.partId === boardPart.id && w.from.pinId.toLowerCase() === bp.id.toLowerCase()) ||
          (w.to.partId === boardPart.id && w.to.pinId.toLowerCase() === bp.id.toLowerCase()),
      )

      if (isWired) {
        truth = "simulated"
        if (rawState) {
          if (rawState.value !== undefined) {
            if (bp.capabilities?.pwm && rawState.value > 0) {
              state = "PWM"
              dutyCycle = Math.round((rawState.value / 255) * 100)
            } else {
              state = "ANALOG"
            }
          } else {
            state = rawState.state === "HIGH" ? "HIGH" : "LOW"
          }
        } else if (volt > 0.5) {
          state = "HIGH"
        } else {
          state = "LOW"
        }
      }

      // Only include wired pins or driven pins to conserve tokens
      if (isWired || rawState) {
        pins.push({
          pinId: bp.id,
          label: bp.label,
          state,
          voltage: Number(volt.toFixed(2)),
          dutyCyclePercent: dutyCycle,
          truth,
        })
      }
    }
  }

  // 6. Active Component Runtime Extraction
  const components: ComponentTelemetryItem[] = []
  for (const part of circuit.parts) {
    if (isBoardPart(part.type)) continue

    const rt = runtime[part.id]
    const details: Record<string, string | number | boolean> = {}
    let status = "idle"
    let truth: TelemetryTruthSource = "simulated"

    switch (part.type) {
      case "led": {
        if (rt?.burnt) {
          status = "BURNT_OUT"
          details.burnt = true
          details.currentMa = rt.currentMa ?? 100
        } else if (rt?.currentMa && rt.currentMa > 1) {
          status = "ILLUMINATED"
          details.currentMa = Number(rt.currentMa.toFixed(1))
          details.color = String(part.props.color || "red")
        } else {
          status = "OFF"
        }
        break
      }
      case "servo": {
        status = "POSITIONED"
        details.angle = rt?.angle ?? Number(part.props.angle || 0)
        break
      }
      case "buzzer": {
        if (rt?.frequency && rt.frequency > 0) {
          status = "SOUNDING"
          details.frequencyHz = Math.round(rt.frequency)
        } else {
          status = "SILENT"
        }
        break
      }
      case "potentiometer": {
        status = "SET"
        const vWiper = solution.getPinVoltage({ partId: part.id, pinId: "wiper" })
        details.wiperVoltage = Number(vWiper.toFixed(2))
        details.rawTrackValue = Number(part.props.value || 512)
        break
      }
      case "pushbutton": {
        status = part.props.pressed ? "PRESSED" : "RELEASED"
        details.pressed = Boolean(part.props.pressed)
        break
      }
      case "ultrasonic": {
        status = "ACTIVE"
        details.distanceCm = Number(part.props.distance || 25)
        break
      }
      case "dht11": {
        status = "READING"
        details.temperatureC = Number(part.props.temperature || 24)
        details.humidityPercent = Number(part.props.humidity || 50)
        break
      }
      case "lcd-i2c":
      case "oled-i2c": {
        status = "DISPLAYING"
        details.line1 = String(part.props.line1 || "")
        details.line2 = String(part.props.line2 || "")
        break
      }
      case "l298n": {
        status = "ACTIVE"
        details.motorARpm = rt?.motorARpm ?? 0
        details.motorBRpm = rt?.motorBRpm ?? 0
        details.directionA = String(rt?.motorADirection || "stopped")
        break
      }
      default: {
        status = "CONNECTED"
        truth = "static-rule-inference"
      }
    }

    components.push({
      partId: part.id,
      type: part.type,
      status,
      details,
      truth,
    })
  }

  // 7. Diagnostics Summary
  const criticalIssues = healthReport.issues
    .filter((i) => i.severity === "critical")
    .map((i) => `${i.title}: ${i.message}`)
  const warningIssues = healthReport.issues
    .filter((i) => i.severity === "warning")
    .map((i) => `${i.title}: ${i.message}`)

  const diagnostics: DiagnosticTelemetrySummary = {
    healthScore: healthReport.score,
    healthStatus: healthReport.status,
    criticalCount: healthReport.criticalCount,
    warningCount: healthReport.warningCount,
    criticalIssues,
    warningIssues,
    truth: "static-rule-inference",
  }

  // 8. Generate Compact Prompt String with Strict Budget Limit
  const promptLines: string[] = []

  // Header line
  if (boardDef) {
    promptLines.push(
      `[PIXIU CYBERLAB TELEMETRY | BOARD: ${boardDef.name} (${boardDef.logicVoltage}V logic)]`,
    )
  } else {
    promptLines.push(`[PIXIU CYBERLAB TELEMETRY | NO MCU BOARD]`)
  }

  // Power rails
  const railsList: string[] = []
  if (powerRails.rail5v !== undefined) railsList.push(`5V=${powerRails.rail5v}V`)
  if (powerRails.rail3v3 !== undefined) railsList.push(`3.3V=${powerRails.rail3v3}V`)
  if (powerRails.battery9v !== undefined) railsList.push(`9V_BAT=${powerRails.battery9v}V`)
  railsList.push(`GND=0.00V`)
  promptLines.push(`POWER RAILS: ${railsList.join(", ")} [simulated]`)

  // Active pins
  if (pins.length > 0) {
    const pinDesc = pins
      .map((p) => {
        if (p.state === "PWM") return `${p.label}=PWM(${p.dutyCyclePercent}%, ${p.voltage}V)`
        if (p.state === "HIGH") return `${p.label}=HIGH(${p.voltage}V)`
        return `${p.label}=${p.state}(${p.voltage}V)`
      })
      .join(", ")
    promptLines.push(`ACTIVE PINS: ${pinDesc} [simulated]`)
  }

  // Active Components
  if (components.length > 0) {
    promptLines.push("COMPONENTS:")
    for (const c of components) {
      const detailStr = Object.entries(c.details)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")
      promptLines.push(
        `- ${c.partId} (${c.type}): ${c.status}${detailStr ? ` [${detailStr}]` : ""} [${c.truth}]`,
      )
    }
  }

  // Circuit Doctor
  promptLines.push(
    `CIRCUIT DOCTOR HEALTH: ${diagnostics.healthScore}/100 (${diagnostics.healthStatus}) [${diagnostics.truth}]`,
  )
  for (const crit of criticalIssues) {
    promptLines.push(`! CRITICAL: ${crit}`)
  }
  for (const warn of warningIssues) {
    promptLines.push(`* WARNING: ${warn}`)
  }

  let compactPromptString = promptLines.join("\n")

  // Truncate cleanly if exceeding maxChars
  if (compactPromptString.length > maxChars) {
    const truncated = compactPromptString.substring(0, maxChars - 25)
    compactPromptString = `${truncated}\n... [telemetry truncated]`
  }

  const tokenCountEstimate = Math.ceil(compactPromptString.length / 4)

  return {
    schemaVersion: "1.0.0",
    timestamp,
    board: boardDef
      ? {
          id: boardDef.id,
          name: boardDef.name,
          logicVoltage: boardDef.logicVoltage,
          truth: "simulated",
        }
      : null,
    powerRails,
    pins,
    components,
    diagnostics,
    compactPromptString,
    tokenCountEstimate,
  }
}
