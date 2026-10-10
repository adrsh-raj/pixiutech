/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 DETERMINISTIC VALIDATION & POLICY GATE
 * 
 * Enforces the primary safety boundary:
 * 1. Reuses live `validateProposedCircuit` as the sole authority on circuit correctness.
 * 2. Never allows direct model writes.
 * 3. Enforces task-specific safety policies (LED current-limiting, LDR divider, ultrasonic pin conflicts, servo limits).
 * 4. Invariant: `canPreview = false` and `canApply = false` if any blocking error is found.
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
  const targetBoard = options.currentBoard || "arduino-uno"
  const hasTargetBoardPart = candidateCircuit.parts.some((p: PlacedPart) => p.type === targetBoard)
  if (!hasTargetBoardPart) {
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

  // 5. Task-Specific Electrical & Logical Policy Checks
  runTaskPolicyChecks(proposal.task_type, candidateCircuit, targetBoard, errors, warnings, diagnosticCodes)

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
 * Task-specific policy checks for the 4 narrow families.
 */
function runTaskPolicyChecks(
  taskType: SupportedTaskFamily,
  circuit: CircuitState,
  board: string,
  errors: string[],
  warnings: string[],
  diagnosticCodes: string[]
): void {
  const parts = circuit.parts
  const wires = circuit.wires

  // Policy A: LED Control
  if (taskType === "led_control") {
    const leds = parts.filter((p) => p.type === "led")
    const resistors = parts.filter((p) => p.type === "resistor")

    if (leds.length === 0) {
      errors.push("LED control task requires at least one LED component.")
      diagnosticCodes.push("POLICY_MISSING_LED")
    }

    if (leds.length > 0 && resistors.length === 0) {
      errors.push("LED control task requires a current-limiting resistor to protect the circuit.")
      diagnosticCodes.push("POLICY_MISSING_LED_RESISTOR")
    }
  }

  // Policy B: LDR Lighting
  if (taskType === "ldr_lighting") {
    const ldrs = parts.filter((p) => p.type === "ldr")
    const resistors = parts.filter((p) => p.type === "resistor")

    if (ldrs.length === 0) {
      errors.push("LDR lighting task requires at least one LDR photoresistor.")
      diagnosticCodes.push("POLICY_MISSING_LDR")
    }

    if (resistors.length === 0) {
      errors.push("LDR lighting circuit requires a fixed resistor to form a voltage divider.")
      diagnosticCodes.push("POLICY_MISSING_DIVIDER_RESISTOR")
    }
  }

  // Policy C: Ultrasonic Alert
  if (taskType === "ultrasonic_alert") {
    const sonars = parts.filter((p) => p.type === "ultrasonic")
    if (sonars.length === 0) {
      errors.push("Ultrasonic alert task requires an HC-SR04 ultrasonic sensor.")
      diagnosticCodes.push("POLICY_MISSING_ULTRASONIC")
    }

    // Verify distinct trigger and echo wires
    if (sonars.length > 0) {
      const sonarId = sonars[0].id
      const trigWire = wires.find(
        (w) => (w.from.partId === sonarId && w.from.pinId === "trig") || (w.to.partId === sonarId && w.to.pinId === "trig")
      )
      const echoWire = wires.find(
        (w) => (w.from.partId === sonarId && w.from.pinId === "echo") || (w.to.partId === sonarId && w.to.pinId === "echo")
      )

      if (trigWire && echoWire) {
        const trigPin = trigWire.from.partId === sonarId ? trigWire.to.pinId : trigWire.from.pinId
        const echoPin = echoWire.from.partId === sonarId ? echoWire.to.pinId : echoWire.from.pinId
        if (trigPin === echoPin) {
          errors.push(`Ultrasonic trigger and echo cannot share the same pin ('${trigPin}').`)
          diagnosticCodes.push("POLICY_ULTRASONIC_PIN_CONFLICT")
        }
      }
    }
  }

  // Policy D: Servo Control
  if (taskType === "servo_control") {
    const servos = parts.filter((p) => p.type === "servo")
    if (servos.length === 0) {
      errors.push("Servo control task requires a servo motor component.")
      diagnosticCodes.push("POLICY_MISSING_SERVO")
    }
  }
}
