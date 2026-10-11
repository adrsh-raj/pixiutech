/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 DETERMINISTIC VALIDATION & POLICY GATE
 * 
 * Enforces the primary safety boundary:
 * 1. Reuses live `validateProposedCircuit` as the sole authority on circuit correctness.
 * 2. Never allows direct model writes.
 * 3. Enforces deep task-specific wiring connectivity and destination checks:
 *    - LED series resistor & complete control loop (GPIO to GND)
 *    - LDR voltage divider top to Power, bottom to GND, midpoint tap to Analog/ADC
 *    - Ultrasonic 4-pin destination completeness (VCC to Power, GND to Ground, distinct GPIOs for Trig/Echo)
 *    - Servo 3-pin destination completeness (VCC to Power, GND to Ground, Sig to digital/PWM pin)
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

export const POWER_PINS = new Set(["5v", "3v3", "3v", "vin", "vsys", "vbus", "3v3_en"])
export const GND_PINS = new Set(["gnd", "gnd_pwr", "gnd_l", "gnd_r", "gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"])
export const ANALOG_PINS = new Set([
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

  // 5. Deep Task-Specific Wiring and Destination Policy Checks
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
 * Finds all board pins connected to a specific component pin.
 */
function getBoardPinsFor(partId: string, pinId: string, boardId: string, wires: Wire[]): string[] {
  return getConnectedPins(partId, pinId, wires)
    .filter((n) => n.partId === boardId)
    .map((n) => n.pinId.toLowerCase())
}

/**
 * Deep task-specific wiring policy and destination checks.
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

    for (const led of leds) {
      const anodeConnected = isPinConnected(led.id, "anode", wires)
      const cathodeConnected = isPinConnected(led.id, "cathode", wires)

      if (!anodeConnected || !cathodeConnected) {
        errors.push(`LED '${led.id}' is disconnected or missing complete loop connection.`)
        diagnosticCodes.push("POLICY_INCOMPLETE_LED_LOOP")
        continue
      }

      // Check series connection: either anode or cathode must connect to a resistor pin
      const anodeNeighbors = getConnectedPins(led.id, "anode", wires)
      const cathodeNeighbors = getConnectedPins(led.id, "cathode", wires)

      const seriesResistor = resistors.find((r) =>
        [...anodeNeighbors, ...cathodeNeighbors].some((n) => n.partId === r.id)
      )

      if (!seriesResistor) {
        errors.push(`Resistor is not connected in series with LED '${led.id}' (floating or bypassed).`)
        diagnosticCodes.push("POLICY_DISCONNECTED_LED_RESISTOR")
        continue
      }

      // Check outer destinations: LED branch must connect to a digital GPIO on one end, and GND on the other end
      const allBranchPins = [
        ...getBoardPinsFor(led.id, "anode", boardId, wires),
        ...getBoardPinsFor(led.id, "cathode", boardId, wires),
        ...getBoardPinsFor(seriesResistor.id, "a", boardId, wires),
        ...getBoardPinsFor(seriesResistor.id, "b", boardId, wires),
      ]

      const hasGnd = allBranchPins.some((p) => GND_PINS.has(p))
      const hasGpio = allBranchPins.some((p) => !GND_PINS.has(p) && !POWER_PINS.has(p))

      if (!hasGnd || !hasGpio) {
        errors.push(`LED circuit loop must connect to a digital control pin on one end and GND on the other end.`)
        diagnosticCodes.push("POLICY_LED_INVALID_LOOP_DESTINATION")
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
        continue
      }

      // Check for divider midpoint: LDR pin connected to resistor pin AND an analog board pin
      const aNeighbors = getConnectedPins(ldr.id, "a", wires)
      const bNeighbors = getConnectedPins(ldr.id, "b", wires)

      let midpointFound = false
      let dividerResistorId = ""

      for (const { neighbors } of [{ neighbors: aNeighbors }, { neighbors: bNeighbors }]) {
        const resistorNeighbor = neighbors.find((n) => resistors.some((r) => r.id === n.partId))
        const analogNeighbor = neighbors.find((n) => n.partId === boardId && ANALOG_PINS.has(n.pinId.toLowerCase()))

        if (resistorNeighbor && analogNeighbor) {
          midpointFound = true
          dividerResistorId = resistorNeighbor.partId
          break
        }
      }

      if (!midpointFound) {
        errors.push("LDR and resistor do not form a valid voltage divider tapped into an analog/ADC pin.")
        diagnosticCodes.push("POLICY_DISCONNECTED_DIVIDER")
        continue
      }

      // Check power and ground destination rails for the divider
      const allDividerBoardPins = [
        ...getBoardPinsFor(ldr.id, "a", boardId, wires),
        ...getBoardPinsFor(ldr.id, "b", boardId, wires),
        ...getBoardPinsFor(dividerResistorId, "a", boardId, wires),
        ...getBoardPinsFor(dividerResistorId, "b", boardId, wires),
      ]

      const hasPower = allDividerBoardPins.some((p) => POWER_PINS.has(p))
      const hasGnd = allDividerBoardPins.some((p) => GND_PINS.has(p))

      if (!hasPower || !hasGnd) {
        errors.push("LDR voltage divider must be powered across a board power rail and ground.")
        diagnosticCodes.push("POLICY_LDR_INVALID_DIVIDER_DESTINATION")
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
      const vccBoardPins = getBoardPinsFor(sonar.id, "vcc", boardId, wires)
      const gndBoardPins = getBoardPinsFor(sonar.id, "gnd", boardId, wires)
      const trigBoardPins = getBoardPinsFor(sonar.id, "trig", boardId, wires)
      const echoBoardPins = getBoardPinsFor(sonar.id, "echo", boardId, wires)

      // 1. Missing pin connections
      if (vccBoardPins.length === 0 || gndBoardPins.length === 0 || trigBoardPins.length === 0 || echoBoardPins.length === 0) {
        errors.push(`Ultrasonic sensor '${sonar.id}' has unconnected pins (all 4 pins VCC, GND, Trig, Echo must be wired to board).`)
        diagnosticCodes.push("POLICY_UNCONNECTED_ULTRASONIC_PIN")
        continue
      }

      // 2. Destination correctness: VCC must be power, GND must be ground
      const vccIsPower = vccBoardPins.some((p) => POWER_PINS.has(p))
      if (!vccIsPower) {
        errors.push(`Ultrasonic VCC must connect to a board power rail, got: '${vccBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_POWER_DESTINATION")
      }

      const gndIsGnd = gndBoardPins.some((p) => GND_PINS.has(p))
      if (!gndIsGnd) {
        errors.push(`Ultrasonic GND must connect to a board ground pin, got: '${gndBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_GROUND_DESTINATION")
      }

      // 3. Destination correctness: Trig and Echo must be digital pins (not power, not ground)
      const trigIsGpio = trigBoardPins.every((p) => !POWER_PINS.has(p) && !GND_PINS.has(p))
      if (!trigIsGpio) {
        errors.push(`Ultrasonic Trig must connect to a digital GPIO pin, got: '${trigBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_TRIG_DESTINATION")
      }

      const echoIsGpio = echoBoardPins.every((p) => !POWER_PINS.has(p) && !GND_PINS.has(p))
      if (!echoIsGpio) {
        errors.push(`Ultrasonic Echo must connect to a digital GPIO pin, got: '${echoBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_ECHO_DESTINATION")
      }

      // 4. Pin conflict: Trig and Echo cannot share the same pin
      if (trigBoardPins[0] === echoBoardPins[0]) {
        errors.push(`Ultrasonic trigger and echo cannot share the same pin ('${trigBoardPins[0]}').`)
        diagnosticCodes.push("POLICY_ULTRASONIC_PIN_CONFLICT")
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
      const vccBoardPins = getBoardPinsFor(servo.id, "vcc", boardId, wires)
      const gndBoardPins = getBoardPinsFor(servo.id, "gnd", boardId, wires)
      const sigBoardPins = getBoardPinsFor(servo.id, "sig", boardId, wires)

      if (vccBoardPins.length === 0 || gndBoardPins.length === 0 || sigBoardPins.length === 0) {
        errors.push(`Servo motor '${servo.id}' has unconnected terminals (VCC, GND, and Sig must all be wired to board).`)
        diagnosticCodes.push("POLICY_UNCONNECTED_SERVO_PIN")
        continue
      }

      // Destination correctness: VCC must be power, GND must be ground, Sig must be digital/PWM
      const vccIsPower = vccBoardPins.some((p) => POWER_PINS.has(p))
      if (!vccIsPower) {
        errors.push(`Servo VCC must connect to a board power rail, got: '${vccBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_SERVO_INVALID_POWER_DESTINATION")
      }

      const gndIsGnd = gndBoardPins.some((p) => GND_PINS.has(p))
      if (!gndIsGnd) {
        errors.push(`Servo GND must connect to a board ground pin, got: '${gndBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_SERVO_INVALID_GROUND_DESTINATION")
      }

      const sigIsGpio = sigBoardPins.every((p) => !POWER_PINS.has(p) && !GND_PINS.has(p))
      if (!sigIsGpio) {
        errors.push(`Servo signal must connect to a digital/PWM pin, got: '${sigBoardPins.join(", ")}'.`)
        diagnosticCodes.push("POLICY_SERVO_INVALID_SIGNAL_DESTINATION")
      }
    }
  }
}
