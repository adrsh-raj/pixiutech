/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 STRUCTURED PROPOSAL CONTRACT
 * 
 * Defines the strict `pixiu-copilot-proposal-v1` proposal envelope and parser.
 * Protects application state by rejecting malformed payloads, unknown fields,
 * and unsupported task identifiers before reaching the validator.
 */

import type { CircuitState, PlacedPart, Wire } from "../../circuit-types"

export type SupportedTaskFamily =
  | "led_control"
  | "ldr_lighting"
  | "ultrasonic_alert"
  | "servo_control"

export const SUPPORTED_TASK_FAMILIES: readonly SupportedTaskFamily[] = [
  "led_control",
  "ldr_lighting",
  "ultrasonic_alert",
  "servo_control",
] as const

export type CapabilityStatus =
  | "supported"
  | "partial"
  | "unsupported"
  | "not_tested"
  | "unknown"

export interface ProposalCapabilities {
  simulation: CapabilityStatus
  compilation: CapabilityStatus
  physical_hardware: "not_verified"
}

export interface CopilotProposalPayload {
  schema_version: "pixiu-copilot-proposal-v1"
  task_type: SupportedTaskFamily
  summary: string
  assumptions: string[]
  needs_clarification: string[]
  proposal: {
    circuit: CircuitState | null
    code: string | null
    explanation: string
  }
  capabilities: ProposalCapabilities
}

export interface ProposalParseResult {
  valid: boolean
  payload: CopilotProposalPayload | null
  errors: string[]
  rawTrimmed: string
}

/**
 * Strips markdown code blocks and trims whitespace.
 */
export function extractCleanJsonString(raw: string): string {
  if (typeof raw !== "string") return ""
  let text = raw.trim()
  if (text.startsWith("```json")) {
    text = text.slice(7)
  } else if (text.startsWith("```")) {
    text = text.slice(3)
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3)
  }
  return text.trim()
}

/**
 * Parses and strictly validates a raw model output into a typed CopilotProposalPayload.
 * Fails closed on any schema violation or unknown task type.
 */
export function parseProposalPayload(input: unknown): ProposalParseResult {
  const errors: string[] = []

  let parsed: unknown
  let rawStr = ""

  if (typeof input === "string") {
    rawStr = extractCleanJsonString(input)
    if (!rawStr) {
      return { valid: false, payload: null, errors: ["Empty or whitespace-only response string."], rawTrimmed: "" }
    }
    try {
      parsed = JSON.parse(rawStr)
    } catch (err) {
      return {
        valid: false,
        payload: null,
        errors: [`Malformed JSON: ${err instanceof Error ? err.message : String(err)}`],
        rawTrimmed: rawStr.slice(0, 200),
      }
    }
  } else if (input && typeof input === "object") {
    parsed = input
    rawStr = JSON.stringify(input)
  } else {
    return { valid: false, payload: null, errors: ["Input must be a JSON string or object."], rawTrimmed: "" }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, payload: null, errors: ["Proposal root must be a JSON object."], rawTrimmed: rawStr }
  }

  const obj = parsed as Record<string, unknown>

  // 1. Schema version
  if (obj.schema_version !== "pixiu-copilot-proposal-v1") {
    errors.push(`Invalid schema_version: expected 'pixiu-copilot-proposal-v1', got '${String(obj.schema_version)}'.`)
  }

  // 2. Task type
  if (!SUPPORTED_TASK_FAMILIES.includes(obj.task_type as SupportedTaskFamily)) {
    errors.push(`Unsupported task_type: '${String(obj.task_type)}'. Allowed: ${SUPPORTED_TASK_FAMILIES.join(", ")}.`)
  }

  // 3. Summary
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    errors.push("Missing or invalid 'summary' string.")
  }

  // 4. Assumptions & Clarifications
  if (!Array.isArray(obj.assumptions)) {
    errors.push("'assumptions' must be an array of strings.")
  }
  if (!Array.isArray(obj.needs_clarification)) {
    errors.push("'needs_clarification' must be an array of strings.")
  }

  // 5. Proposal envelope
  if (!obj.proposal || typeof obj.proposal !== "object" || Array.isArray(obj.proposal)) {
    errors.push("Missing or invalid 'proposal' object.")
  } else {
    const prop = obj.proposal as Record<string, unknown>
    if (typeof prop.explanation !== "string" || !prop.explanation.trim()) {
      errors.push("Proposal must include a non-empty 'explanation' string.")
    }

    if (prop.circuit !== null) {
      if (!prop.circuit || typeof prop.circuit !== "object" || Array.isArray(prop.circuit)) {
        errors.push("Proposal 'circuit' must be an object with parts and wires, or null.")
      } else {
        const circ = prop.circuit as Record<string, unknown>
        if (!Array.isArray(circ.parts)) {
          errors.push("Proposal circuit must contain a 'parts' array.")
        }
        if (!Array.isArray(circ.wires)) {
          errors.push("Proposal circuit must contain a 'wires' array.")
        }
      }
    }

    if (prop.code !== null && typeof prop.code !== "string") {
      errors.push("Proposal 'code' must be a string or null.")
    }
  }

  // 6. Capabilities envelope
  if (!obj.capabilities || typeof obj.capabilities !== "object" || Array.isArray(obj.capabilities)) {
    errors.push("Missing 'capabilities' object.")
  } else {
    const caps = obj.capabilities as Record<string, unknown>
    if (caps.physical_hardware !== "not_verified") {
      errors.push("capabilities.physical_hardware must be 'not_verified'.")
    }
  }

  if (errors.length > 0) {
    return { valid: false, payload: null, errors, rawTrimmed: rawStr.slice(0, 200) }
  }

  return {
    valid: true,
    payload: parsed as CopilotProposalPayload,
    errors: [],
    rawTrimmed: rawStr,
  }
}
