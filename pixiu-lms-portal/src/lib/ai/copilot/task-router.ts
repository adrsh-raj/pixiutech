/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 NARROW TASK ROUTER
 * 
 * Enforces strict 4-task allowlist routing:
 *   1. led_control (LED blink / state / digital output)
 *   2. ldr_lighting (LDR light sensor / automatic lighting)
 *   3. ultrasonic_alert (HC-SR04 distance threshold + buzzer alert)
 *   4. servo_control (Servo angle / boom barrier / positioning)
 * 
 * Handles colloquial, Hinglish, and typo-tolerant inputs.
 * Fails closed into 'needs_clarification' or 'unsupported' for out-of-scope requests.
 */

import type { SupportedTaskFamily } from "./proposal-schema"

export type RouteDecision = SupportedTaskFamily | "unsupported" | "needs_clarification"

export interface TaskRouteResult {
  route: RouteDecision
  taskType?: SupportedTaskFamily
  confidence: number
  normalizedGoal: string
  targetBoard: string
  missingContext: string[]
  riskFlags: string[]
  clarificationPrompt?: string
}

export const SUPPORTED_BOARDS = [
  "arduino-uno",
  "esp32-devkit",
  "microbit-v2",
  "rpi-pico",
] as const

export type SupportedBoard = (typeof SUPPORTED_BOARDS)[number]

/**
 * Normalizes input text by removing excessive whitespace and lowercase matching.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Classifies a user prompt into one of the 4 supported task families,
 * or flags as out-of-scope / needs-clarification.
 */
export function routeUserRequest(
  prompt: string,
  context: { targetBoard?: string; availableComponents?: string[] } = {}
): TaskRouteResult {
  const norm = normalizeText(prompt)
  const targetBoard = (context.targetBoard || "arduino-uno").toLowerCase()

  // 1. Safety & High-Risk Out-of-Scope Checks (Mains AC, 220V, High Power)
  const highRiskPatterns = [
    /\b(220v|110v|mains|ac voltage|high voltage|socket|power outlet|relay 240v)\b/i,
    /\b(hack|exploit|short circuit the mains|burn)\b/i,
  ]
  for (const pattern of highRiskPatterns) {
    if (pattern.test(norm)) {
      return {
        route: "unsupported",
        confidence: 1.0,
        normalizedGoal: "High-voltage or mains power request",
        targetBoard,
        missingContext: [],
        riskFlags: ["HIGH_VOLTAGE_MAINS_SAFETY_VIOLATION"],
        clarificationPrompt: "Pixiu CyberLab only simulates safe low-voltage DC microcontrollers (3.3V / 5V). Mains electricity (110V/220V AC) is strictly unsupported for safety.",
      }
    }
  }

  // 2. Validate Board Support
  const isSupportedBoard = SUPPORTED_BOARDS.includes(targetBoard as SupportedBoard)
  if (!isSupportedBoard) {
    return {
      route: "unsupported",
      confidence: 0.9,
      normalizedGoal: "Unsupported board target",
      targetBoard,
      missingContext: ["target_board"],
      riskFlags: ["UNSUPPORTED_BOARD"],
      clarificationPrompt: `The board '${targetBoard}' is not supported in Phase 3. Supported boards are: ${SUPPORTED_BOARDS.join(", ")}.`,
    }
  }

  // 3. Match Supported Task Families (including Hinglish and typos)

  // A. Ultrasonic Alert
  const ultrasonicMatches = [
    /\b(ultrasonic|sonar|distance|range|hc\s*sr04|obstacle|proximity)\b/i,
    /\b(door\s*sensor|barrier\s*sonar|object\s*detect)\b/i,
    /\b(doori|durie|distance\s*measure)\b/i, // Hinglish
  ]
  const isUltrasonic = ultrasonicMatches.some((re) => re.test(norm))

  // B. Servo Control
  const servoMatches = [
    /\b(servo|angle|motor\s*position|boom\s*barrier|gate\s*servo|swing\s*arm)\b/i,
    /\b(ghuma|ghumana|rotate\s*servo|degree)\b/i, // Hinglish
  ]
  const isServo = servoMatches.some((re) => re.test(norm))

  // C. LDR Lighting
  const ldrMatches = [
    /\b(ldr|light\s*sensor|photoresistor|night\s*light|nightlight|automatic\s*light|street\s*light)\b/i,
    /\b(roshni|andhera|light\s*detect|darkness\s*sensor)\b/i, // Hinglish
  ]
  const isLdr = ldrMatches.some((re) => re.test(norm))

  // D. LED Control
  const ledMatches = [
    /\b(led|blink|blinking|flash|glow|turn\s*on\s*led|toggle\s*led)\b/i,
    /\b(chalao|jalao|batti|light\s*on)\b/i, // Hinglish
  ]
  const isLed = ledMatches.some((re) => re.test(norm))

  // Check for conflicts or multi-task ambiguity
  const matchedTasks: SupportedTaskFamily[] = []
  if (isUltrasonic) matchedTasks.push("ultrasonic_alert")
  if (isServo) matchedTasks.push("servo_control")
  if (isLdr) matchedTasks.push("ldr_lighting")
  if (isLed && matchedTasks.length === 0) matchedTasks.push("led_control")

  // If both servo and ultrasonic are mentioned (e.g. boom barrier with radar), route to ultrasonic_alert or servo_control based on primary verb
  if (isUltrasonic && isServo) {
    if (norm.includes("distance") || norm.includes("buzzer") || norm.includes("detect")) {
      return {
        route: "ultrasonic_alert",
        taskType: "ultrasonic_alert",
        confidence: 0.88,
        normalizedGoal: "Ultrasonic distance alert with warning buzzer",
        targetBoard,
        missingContext: [],
        riskFlags: [],
      }
    }
    return {
      route: "servo_control",
      taskType: "servo_control",
      confidence: 0.88,
      normalizedGoal: "Servo gate positioning",
      targetBoard,
      missingContext: [],
      riskFlags: [],
    }
  }

  if (isUltrasonic) {
    return {
      route: "ultrasonic_alert",
      taskType: "ultrasonic_alert",
      confidence: 0.95,
      normalizedGoal: "Ultrasonic obstacle/distance detection with buzzer",
      targetBoard,
      missingContext: [],
      riskFlags: [],
    }
  }

  if (isServo) {
    return {
      route: "servo_control",
      taskType: "servo_control",
      confidence: 0.95,
      normalizedGoal: "Servo motor angle and position control",
      targetBoard,
      missingContext: [],
      riskFlags: [],
    }
  }

  if (isLdr) {
    return {
      route: "ldr_lighting",
      taskType: "ldr_lighting",
      confidence: 0.95,
      normalizedGoal: "LDR voltage divider automatic light control",
      targetBoard,
      missingContext: [],
      riskFlags: [],
    }
  }

  if (isLed) {
    return {
      route: "led_control",
      taskType: "led_control",
      confidence: 0.95,
      normalizedGoal: "LED digital state and blink control",
      targetBoard,
      missingContext: [],
      riskFlags: [],
    }
  }

  // 4. If prompt is too vague (e.g., "help", "circuit bana do", "make a project")
  if (norm.length < 15 || /^(help|circuit|bana do|project|make something|hi|hello)$/i.test(norm)) {
    return {
      route: "needs_clarification",
      confidence: 0.4,
      normalizedGoal: "Vague or underspecified circuit request",
      targetBoard,
      missingContext: ["task_goal", "components"],
      riskFlags: ["UNDERSPECIFIED_INTENT"],
      clarificationPrompt: "What kind of circuit would you like to build? You can ask for: 1) LED blink, 2) Automatic nightlight with LDR, 3) Ultrasonic distance alert with buzzer, or 4) Servo motor angle control.",
    }
  }

  // 5. Completely Out-of-Scope (e.g., weather query, math homework, unmodeled components)
  return {
    route: "unsupported",
    confidence: 0.9,
    normalizedGoal: "Unsupported general query",
    targetBoard,
    missingContext: [],
    riskFlags: ["OUT_OF_SCOPE_REQUEST"],
    clarificationPrompt: "This request is outside the 4 supported Phase 3 circuit tasks. Please choose from: LED blink, LDR automatic lighting, Ultrasonic alert, or Servo control.",
  }
}
