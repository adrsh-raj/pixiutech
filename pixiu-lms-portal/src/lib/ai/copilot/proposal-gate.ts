/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 DETERMINISTIC VALIDATION & POLICY GATE
 * 
 * Enforces the primary safety boundary:
 * 1. Reuses live `validateProposedCircuit` as the sole authority on circuit correctness.
 * 2. Never allows direct model writes.
 * 3. Enforces deep task-specific wiring connectivity checks:
 *    - LED series current-limiting resistor & complete control loop
 *    - LDR voltage divider midpoint connection to analog/ADC pin
 *    - Ultrasonic 4-pin completeness (VCC, GND, distinct Trig & Echo)
 *    - Servo 3-pin completeness (VCC, GND, PWM Sig)
 * 4. Invariant: `canPreview = false` and `canApply = false` if any error or policy failure is found.
 */

import type { CircuitState, PlacedPart, Wire } from "../../circuit-types"
import { validateProposedCircuit, type CircuitValidationResult } from "../../circuit-validator"
import type { CopilotProposalPayload, SupportedTaskFamily } from "./proposal-schema"

export interface ProposalGateResult {
  passed: boolean
  canPreview: boolean
  canApply: boolean
  proposal: CopilotProposalPayload | null
  circuitValidation: CircuitValidationResult | null
  errors: string[]
  warnings: string[]
  diagnosticCodes: string[]
  validatedAt: string
}

export interface GateEvaluationOptions {
  currentBoard?: string
  currentRevisionHash?: string
  expectedRevisionHash?: string
}

const POWER_PINS = new Set(["5v", "3v3", "3v", "vin", "vsys", "vbus"])
const GND_PINS = new Set(["gnd", "gnd_pwr", "gnd_l", "gnd_r", "gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"])
const ANALOG_PINS = new Set([
  "a0", "a1", "a2", "a3", "a4", "a5",
  "d34", "d35", "d32", "d33", "vp", "vn",
  "gp26", "gp27", "gp28",
  "p0", "p1", "p2",
])

/**
 * Evaluates a candidate proposal against deterministic safety rules and live validator.
 */
export function evaluateProposalGate(
  proposal: CopilotProposalPayload | null,
  options: GateEvaluationOptions = {}
): ProposalGateResult {
  const timestamp = new Date().toISOString()
  const errors: string[] = []
  const warnings: string[] = []
  const diagnosticCodes: string[] = []

  // 1. Proposal Existence & Null Guard
  if (!proposal) {
    return {
      passed: false,
      canPreview: false,
      canApply: false,
      proposal: null,
      circuitValidation: null,
      errors: ["No proposal object provided to validation gate."],
      warnings: [],
      diagnosticCodes: ["ERR_NULL_PROPOSAL"],
      validatedAt: timestamp,
    }
  }

  // 2. Candidate Circuit Check
  const candidateCircuit = proposal.proposal?.circuit
  if (!candidateCircuit || !Array.isArray(candidateCircuit.parts) || !Array.isArray(candidateCircuit.wires)) {
    return {
      passed: false,
      canPreview: false,
      canApply: false,
      proposal,
      circuitValidation: null,
      errors: ["Proposal does not contain a valid circuit payload with parts and wires."],
      warnings: [],
      diagnosticCodes: ["ERR_MISSING_CIRCUIT_STRUCTURE"],
      validatedAt: timestamp,
    }
  }

  // 3. Board Context Consistency
  const targetBoard = (options.currentBoard || "arduino-uno").toLowerCase()
  const boardPart = candidateCircuit.parts.find((p: PlacedPart) => p.type === targetBoard)
  if (!boardPart) {
    errors.push(`Circuit must contain the target microcontroller board: '${targetBoard}'.`)
    diagnosticCodes.push("ERR_BOARD_MISMATCH")
  }

  // 4. Run Live Deterministic Circuit Validator
  const validatorResult = validateProposedCircuit(candidateCircuit, {
    targetBoard,
    allowWarnings: true,
  })

  if (!validatorResult.valid) {
    for (const err of validatorResult.errors) {
      errors.push(err)
      if (/short\s*circuit/i.test(err)) {
        diagnosticCodes.push("ELECTRICAL_SHORT_CIRCUIT")
      }
    }
  }

  for (const warn of validatorResult.warnings) {
    warnings.push(warn)
  }

  for (const notice of validatorResult.notices || []) {
    if (notice.ruleId && !diagnosticCodes.includes(notice.ruleId)) {
      diagnosticCodes.push(notice.ruleId)
    }
  }

  // 5. Deep Task-Specific Electrical & Wiring Policy Checks
  if (boardPart) {
    runTaskWiringPolicyChecks(
      proposal.task_type,
      candidateCircuit,
      boardPart.id,
      errors,
      warnings,
      diagnosticCodes
    )
  }

  const passed = errors.length === 0

  return {
    passed,
    canPreview: passed,
    canApply: passed,
    proposal,
    circuitValidation: validatorResult,
    errors,
    warnings,
    diagnosticCodes,
    validatedAt: timestamp,
  }
}

/**
 * Checks whether a pin on a component has at least one connected wire.
 */
function isPinConnected(partId: string, pinId: string, wires: Wire[]): boolean {
  return wires.some(
    (w) =>
      (w.from.partId === partId && w.from.pinId.toLowerCase() === pinId.toLowerCase()) ||
      (w.to.partId === partId && w.to.pinId.toLowerCase() === pinId.toLowerCase())
  )
}

/**
 * Finds all pins connected to a specific part pin.
 */
function getConnectedPins(partId: string, pinId: string, wires: Wire[]): Array<{ partId: string; pinId: string }> {
  const result: Array<{ partId: string; pinId: string }> = []
  for (const w of wires) {
    if (w.from.partId === partId && w.from.pinId.toLowerCase() === pinId.toLowerCase()) {
      result.push({ partId: w.to.partId, pinId: w.to.pinId })
    } else if (w.to.partId === partId && w.to.pinId.toLowerCase() === pinId.toLowerCase()) {
      result.push({ partId: w.from.partId, pinId: w.from.pinId })
    }
  }
  return result
}

/**
 * Deep task-specific wiring policy checks.
 */
function runTaskWiringPolicyChecks(
  taskType: SupportedTaskFamily,
  circuit: CircuitState,
  boardId: string,
  errors: string[],
  warnings: string[],
  diagnosticCodes: string[]
): void {
  const parts = circuit.parts
  const wires = circuit.wires

  // --------------------------------------------------------------------------
  // Policy A: LED Control
  // --------------------------------------------------------------------------
  if (taskType === "led_control") {
    const leds = parts.filter((p) => p.type === "led")
    const resistors = parts.filter((p) => p.type === "resistor")

    if (leds.length === 0) {
      errors.push("LED control task requires at least one LED component.")
      diagnosticCodes.push("POLICY_MISSING_LED")
      return
    }

    if (resistors.length === 0) {
      errors.push("LED control task requires a current-limiting resistor to protect the circuit.")
      diagnosticCodes.push("POLICY_MISSING_LED_RESISTOR")
      return
    }

    // Verify each LED is connected in series with a resistor
    for (const led of leds) {
      const anodeConnected = isPinConnected(led.id, "anode", wires)
      const cathodeConnected = isPinConnected(led.id, "cathode", wires)

      if (!anodeConnected || !cathodeConnected) {
        errors.push(`LED '${led.id}' is disconnected or missing complete loop connection.`)
        diagnosticCodes.push("POLICY_INCOMPLETE_LED_LOOP")
      }

      // Check series connection: either anode or cathode must connect to a resistor pin
      const anodeNeighbors = getConnectedPins(led.id, "anode", wires)
      const cathodeNeighbors = getConnectedPins(led.id, "cathode", wires)
      const hasResistorConnection = [...anodeNeighbors, ...cathodeNeighbors].some((n) =>
        resistors.some((r) => r.id === n.partId)
      )

      if (!hasResistorConnection) {
        errors.push(`Resistor is not connected in series with LED '${led.id}' (floating or bypassed).`)
        diagnosticCodes.push("POLICY_DISCONNECTED_LED_RESISTOR")
      }
    }
  }

  // --------------------------------------------------------------------------
  // Policy B: LDR Lighting
  // --------------------------------------------------------------------------
  if (taskType === "ldr_lighting") {
    const ldrs = parts.filter((p) => p.type === "ldr")
    const resistors = parts.filter((p) => p.type === "resistor")

    if (ldrs.length === 0) {
      errors.push("LDR lighting task requires at least one LDR photoresistor.")
      diagnosticCodes.push("POLICY_MISSING_LDR")
      return
    }

    if (resistors.length === 0) {
      errors.push("LDR lighting circuit requires a fixed resistor to form a voltage divider.")
      diagnosticCodes.push("POLICY_MISSING_DIVIDER_RESISTOR")
      return
    }

    for (const ldr of ldrs) {
      const pinAConnected = isPinConnected(ldr.id, "a", wires)
      const pinBConnected = isPinConnected(ldr.id, "b", wires)

      if (!pinAConnected || !pinBConnected) {
        errors.push(`LDR '${ldr.id}' has disconnected terminals.`)
        diagnosticCodes.push("POLICY_INCOMPLETE_LDR_DIVIDER")
      }

      // Check for divider midpoint: LDR pin connected to resistor pin AND an analog board pin
      const aNeighbors = getConnectedPins(ldr.id, "a", wires)
      const bNeighbors = getConnectedPins(ldr.id, "b", wires)

      const dividerMidpointFound = [
        { ldrPin: "a", neighbors: aNeighbors },
        { ldrPin: "b", neighbors: bNeighbors },
      ].some(({ neighbors }) => {
        const connectsToResistor = neighbors.some((n) => resistors.some((r) => r.id === n.partId))
        const connectsToAnalog = neighbors.some((n) => n.partId === boardId && ANALOG_PINS.has(n.pinId.toLowerCase()))
        return connectsToResistor && connectsToAnalog
      })

      if (!dividerMidpointFound) {
        errors.push("LDR and resistor do not form a valid voltage divider tapped into an analog/ADC pin.")
        diagnosticCodes.push("POLICY_DISCONNECTED_DIVIDER")
      }
    }
  }

  // --------------------------------------------------------------------------
  // Policy C: Ultrasonic Alert
  // --------------------------------------------------------------------------
  if (taskType === "ultrasonic_alert") {
    const sonars = parts.filter((p) => p.type === "ultrasonic")
    if (sonars.length === 0) {
      errors.push("Ultrasonic alert task requires an HC-SR04 ultrasonic sensor.")
      diagnosticCodes.push("POLICY_MISSING_ULTRASONIC")
      return
    }

    for (const sonar of sonars) {
      const vccOk = isPinConnected(sonar.id, "vcc", wires)
      const gndOk = isPinConnected(sonar.id, "gnd", wires)
      const trigOk = isPinConnected(sonar.id, "trig", wires)
      const echoOk = isPinConnected(sonar.id, "echo", wires)

      if (!vccOk || !gndOk || !trigOk || !echoOk) {
        errors.push(`Ultrasonic sensor '${sonar.id}' has unconnected pins (all 4 pins VCC, GND, Trig, Echo must be wired).`)
        diagnosticCodes.push("POLICY_UNCONNECTED_ULTRASONIC_PIN")
      }

      // Verify distinct trigger and echo board pins
      const trigNeighbors = getConnectedPins(sonar.id, "trig", wires).filter((n) => n.partId === boardId)
      const echoNeighbors = getConnectedPins(sonar.id, "echo", wires).filter((n) => n.partId === boardId)

      if (trigNeighbors.length > 0 && echoNeighbors.length > 0) {
        const trigPin = trigNeighbors[0].pinId.toLowerCase()
        const echoPin = echoNeighbors[0].pinId.toLowerCase()
        if (trigPin === echoPin) {
          errors.push(`Ultrasonic trigger and echo cannot share the same pin ('${trigPin}').`)
          diagnosticCodes.push("POLICY_ULTRASONIC_PIN_CONFLICT")
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Policy D: Servo Control
  // --------------------------------------------------------------------------
  if (taskType === "servo_control") {
    const servos = parts.filter((p) => p.type === "servo")
    if (servos.length === 0) {
      errors.push("Servo control task requires a servo motor component.")
      diagnosticCodes.push("POLICY_MISSING_SERVO")
      return
    }

    for (const servo of servos) {
      const vccOk = isPinConnected(servo.id, "vcc", wires)
      const gndOk = isPinConnected(servo.id, "gnd", wires)
      const sigOk = isPinConnected(servo.id, "sig", wires)

      if (!vccOk || !gndOk || !sigOk) {
        errors.push(`Servo motor '${servo.id}' has unconnected terminals (VCC, GND, and Sig must all be wired).`)
        diagnosticCodes.push("POLICY_UNCONNECTED_SERVO_PIN")
      }
    }
  }
}
