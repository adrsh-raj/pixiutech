/**
 * PIXIU TECH CYBERLAB — AI TUTOR PHASE 1E RESPONSE CONTRACT
 * 
 * Defines the versioned `pixiu-tutor-response-v1` tutoring response schema,
 * bilingual language handling, explanation depth levels, evidence truthfulness,
 * and deterministic response validation rules.
 * 
 * Core Architectural Principle:
 * "The model proposes; Pixiu software validates; the student controls Apply."
 * 
 * Truthfulness Invariants:
 * 1. An explanation is not proof that a circuit works.
 * 2. A circuit proposal is separate from the educational explanation.
 * 3. A rejected circuit cannot be labeled safe or verified.
 * 4. Simulator, compiler, or measurement claims require real evidence.
 * 5. Grade-appropriate simplification must NEVER omit safety notes.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { CopilotProposalPayload } from "./proposal-schema"
import type { CircuitValidationResult } from "../../circuit-validator"

// ============================================================================
// Types & Literals
// ============================================================================

export type TutorIntent =
  | "build_circuit"
  | "modify_circuit"
  | "diagnose"
  | "explain_circuit"
  | "science_question"
  | "code_help"
  | "clarify"

export const ALLOWED_TUTOR_INTENTS: readonly TutorIntent[] = [
  "build_circuit",
  "modify_circuit",
  "diagnose",
  "explain_circuit",
  "science_question",
  "code_help",
  "clarify",
] as const

export type TutorLanguage = "english" | "hinglish"

export const ALLOWED_TUTOR_LANGUAGES: readonly TutorLanguage[] = [
  "english",
  "hinglish",
] as const

export type ExplanationDepth = "quick" | "student" | "deep_dive"

export const ALLOWED_EXPLANATION_DEPTHS: readonly ExplanationDepth[] = [
  "quick",
  "student",
  "deep_dive",
] as const

export type GradeBand =
  | "elementary"
  | "middle_school"
  | "high_school"
  | "college"
  | "general"

export const ALLOWED_GRADE_BANDS: readonly GradeBand[] = [
  "elementary",
  "middle_school",
  "high_school",
  "college",
  "general",
] as const

export type TutorEvidenceLabel =
  | "verified_by_validator"
  | "simulated"
  | "compiled"
  | "static-rule-inference"
  | "static_rule_inference"
  | "retrieved_source"
  | "inferred"
  | "not_tested"
  | "unknown"

export const ALLOWED_EVIDENCE_LABELS: readonly TutorEvidenceLabel[] = [
  "verified_by_validator",
  "simulated",
  "compiled",
  "static-rule-inference",
  "static_rule_inference",
  "retrieved_source",
  "inferred",
  "not_tested",
  "unknown",
] as const

export interface ComponentRoleItem {
  partId: string
  role: string
  whyNeeded: string
}

export interface CodeLogicWalkthrough {
  summary: string
  steps: string[]
  language?: "blockly" | "cpp" | "python"
}

export interface ScienceFormulaItem {
  name: string
  formula: string
  units: string
  assumptions: string
}

export interface ScienceConceptItem {
  title: string
  explanation: string
  formulas?: ScienceFormulaItem[]
  common_misconceptions?: string[]
}

export interface TutorEvidenceEnvelope {
  circuit_validation: {
    status: "passed" | "rejected" | "not_applicable"
    validator_version?: string
    issues_count: number
    critical_count: number
    warning_count: number
    truth: TutorEvidenceLabel
  }
  simulation: {
    status: "simulated" | "not_run" | "not_supported"
    truth: TutorEvidenceLabel
    notes?: string
  }
  compilation: {
    status: "compiled" | "not_run" | "not_supported"
    truth: TutorEvidenceLabel
  }
  knowledge_source: {
    status: "curriculum_grounded" | "inferred" | "unknown"
    source_reference?: string
    truth: TutorEvidenceLabel
  }
}

export interface PixiuTutorResponseV1 {
  schema_version: "pixiu-tutor-response-v1"
  intent: TutorIntent
  language: TutorLanguage
  language_detected: TutorLanguage
  language_override_applied: boolean
  depth: ExplanationDepth
  grade_band: GradeBand
  direct_answer: string
  circuit_proposal: CopilotProposalPayload | null
  component_roles: ComponentRoleItem[]
  operating_sequence: string[]
  code_logic_walkthrough: CodeLogicWalkthrough | null
  science_concept: ScienceConceptItem | null
  evidence_status: TutorEvidenceEnvelope
  assumptions_and_limitations: string[]
  safety_notes: string[]
  next_question_or_action: string | null
}

export interface TutorResponseValidationResult {
  valid: boolean
  errors: string[]
  response: PixiuTutorResponseV1 | null
}

// ============================================================================
// Language Detection & Formatting Helpers
// ============================================================================

/**
 * Common Romanized Hindi keywords indicating Hinglish intent.
 */
const HINGLISH_INDICATORS = new Set([
  "kya", "kyu", "kyun", "kaise", "kisko", "kis", "kaha", "kahan",
  "batao", "samjhao", "bataiye", "sikhao", "dekho", "dekhiye",
  "hai", "hain", "tha", "the", "hoga", "hogi", "honge",
  "karna", "karu", "karun", "karein", "lagana", "lagaye", "lagayein",
  "jodna", "jodein", "jodo", "nikalo", "hatao", "badlo",
  "pehle", "baad", "wala", "wali", "wale", "chahiye", "hota", "hoti",
  "nahi", "mat", "jalega", "chalega", "kharaab", "galti", "sahi",
  "roshni", "doori", "ghumaao", "awaz", "taar", "jhatka",
])

/**
 * Detects whether a prompt is primarily English or Hinglish,
 * with explicit override precedence.
 */
export function detectPromptLanguage(
  prompt: string,
  override?: "english" | "hinglish"
): { language: TutorLanguage; isOverride: boolean } {
  if (override && (override === "english" || override === "hinglish")) {
    return { language: override, isOverride: true }
  }

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { language: "english", isOverride: false }
  }

  const normalized = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
  const words = normalized.split(/\s+/).filter(Boolean)

  let hindiKeywordCount = 0
  for (const word of words) {
    if (HINGLISH_INDICATORS.has(word)) {
      hindiKeywordCount++
    }
  }

  // If at least 2 Hinglish keywords or >= 20% of tokens match Hinglish vocabulary
  const isHinglish = hindiKeywordCount >= 2 || (words.length > 0 && (hindiKeywordCount / words.length) >= 0.2)

  return {
    language: isHinglish ? "hinglish" : "english",
    isOverride: false,
  }
}

/**
 * Resolves explanation depth with a fallback to "student".
 */
export function resolveExplanationDepth(depth?: string): ExplanationDepth {
  if (depth === "quick" || depth === "student" || depth === "deep_dive") {
    return depth
  }
  return "student"
}

/**
 * Detects robotic conversational clichés that an educational mentor should avoid.
 */
export function containsRoboticOpeningCliché(text: string): boolean {
  if (typeof text !== "string") return false
  const t = text.trim()
  return (
    /^certainly[!,.]/i.test(t) ||
    /^absolutely[!,.]/i.test(t) ||
    /^great question[!,.]/i.test(t) ||
    /^sure thing[!,.]/i.test(t) ||
    /^of course[!,.]/i.test(t) ||
    /^as an ai[!,.]/i.test(t)
  )
}

// ============================================================================
// Deterministic Tutor Response Validator
// ============================================================================

const ALLOWED_ROOT_KEYS = new Set([
  "schema_version",
  "intent",
  "language",
  "language_detected",
  "language_override_applied",
  "depth",
  "grade_band",
  "direct_answer",
  "circuit_proposal",
  "component_roles",
  "operating_sequence",
  "code_logic_walkthrough",
  "science_concept",
  "evidence_status",
  "assumptions_and_limitations",
  "safety_notes",
  "next_question_or_action",
])

/**
 * Deterministically validates a PixiuTutorResponseV1 payload.
 * Enforces schema compliance, evidence alignment, and safety rules.
 */
export function validateTutorResponse(
  raw: unknown,
  options?: {
    validatorResult?: CircuitValidationResult
  }
): TutorResponseValidationResult {
  const errors: string[] = []

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ["Response must be a non-null JSON object"],
      response: null,
    }
  }

  const payload = raw as Record<string, unknown>

  // 1. Root Key Inspection
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      errors.push(`Unexpected root field in tutor response: "${key}"`)
    }
  }

  // 2. Schema Version
  if (payload.schema_version !== "pixiu-tutor-response-v1") {
    errors.push(`Invalid schema_version: expected "pixiu-tutor-response-v1", got "${payload.schema_version}"`)
  }

  // 3. Intent
  if (!ALLOWED_TUTOR_INTENTS.includes(payload.intent as TutorIntent)) {
    errors.push(`Invalid or missing intent: "${payload.intent}"`)
  }

  // 4. Language & Depth
  if (!ALLOWED_TUTOR_LANGUAGES.includes(payload.language as TutorLanguage)) {
    errors.push(`Invalid or missing language: "${payload.language}"`)
  }
  if (!ALLOWED_TUTOR_LANGUAGES.includes(payload.language_detected as TutorLanguage)) {
    errors.push(`Invalid or missing language_detected: "${payload.language_detected}"`)
  }
  if (typeof payload.language_override_applied !== "boolean") {
    errors.push("language_override_applied must be a boolean")
  }
  if (!ALLOWED_EXPLANATION_DEPTHS.includes(payload.depth as ExplanationDepth)) {
    errors.push(`Invalid or missing depth: "${payload.depth}"`)
  }
  if (!ALLOWED_GRADE_BANDS.includes(payload.grade_band as GradeBand)) {
    errors.push(`Invalid or missing grade_band: "${payload.grade_band}"`)
  }

  // 5. Direct Answer
  if (typeof payload.direct_answer !== "string" || payload.direct_answer.trim().length === 0) {
    errors.push("direct_answer must be a non-empty string")
  }

  // 6. Component Roles & Operating Sequence
  if (!Array.isArray(payload.component_roles)) {
    errors.push("component_roles must be an array")
  } else {
    for (let i = 0; i < payload.component_roles.length; i++) {
      const cr = payload.component_roles[i]
      if (!cr || typeof cr !== "object" || typeof cr.partId !== "string" || typeof cr.role !== "string" || typeof cr.whyNeeded !== "string") {
        errors.push(`component_roles[${i}] must have string fields (partId, role, whyNeeded)`)
      }
    }
  }

  if (!Array.isArray(payload.operating_sequence)) {
    errors.push("operating_sequence must be an array of strings")
  }

  // 7. Code Logic Walkthrough
  if (payload.code_logic_walkthrough !== null && payload.code_logic_walkthrough !== undefined) {
    if (typeof payload.code_logic_walkthrough !== "object" || Array.isArray(payload.code_logic_walkthrough)) {
      errors.push("code_logic_walkthrough must be null or an object")
    } else {
      const cw = payload.code_logic_walkthrough as Record<string, unknown>
      if (typeof cw.summary !== "string" || !Array.isArray(cw.steps)) {
        errors.push("code_logic_walkthrough must contain summary (string) and steps (array)")
      }
    }
  }

  // 8. Science Concept
  if (payload.science_concept !== null && payload.science_concept !== undefined) {
    if (typeof payload.science_concept !== "object" || Array.isArray(payload.science_concept)) {
      errors.push("science_concept must be null or an object")
    } else {
      const sc = payload.science_concept as Record<string, unknown>
      if (typeof sc.title !== "string" || typeof sc.explanation !== "string") {
        errors.push("science_concept must contain title and explanation strings")
      }
    }
  }

  // 9. Safety Notes (CRITICAL)
  if (!Array.isArray(payload.safety_notes)) {
    errors.push("safety_notes must be an array of strings")
  }

  // 10. Assumptions & Limitations
  if (!Array.isArray(payload.assumptions_and_limitations)) {
    errors.push("assumptions_and_limitations must be an array of strings")
  }

  // 11. Evidence Envelope
  const ev = payload.evidence_status as TutorEvidenceEnvelope | undefined
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
    errors.push("evidence_status must be an object")
  } else {
    if (!ev.circuit_validation || !ALLOWED_EVIDENCE_LABELS.includes(ev.circuit_validation.truth)) {
      errors.push("evidence_status.circuit_validation has invalid or missing truth label")
    }
    if (!ev.simulation || !ALLOWED_EVIDENCE_LABELS.includes(ev.simulation.truth)) {
      errors.push("evidence_status.simulation has invalid or missing truth label")
    }
    if (!ev.compilation || !ALLOWED_EVIDENCE_LABELS.includes(ev.compilation.truth)) {
      errors.push("evidence_status.compilation has invalid or missing truth label")
    }
    if (!ev.knowledge_source || !ALLOWED_EVIDENCE_LABELS.includes(ev.knowledge_source.truth)) {
      errors.push("evidence_status.knowledge_source has invalid or missing truth label")
    }

    // Truthfulness Rule: Simulation status vs truth
    if (ev.simulation && ev.simulation.status === "not_run" && ev.simulation.truth === "simulated") {
      errors.push("Truthfulness violation: simulation.status is 'not_run' but truth claims 'simulated'")
    }

    // Truthfulness Rule: Compilation status vs truth
    if (ev.compilation && ev.compilation.status === "not_run" && ev.compilation.truth === "compiled") {
      errors.push("Truthfulness violation: compilation.status is 'not_run' but truth claims 'compiled'")
    }
  }

  // 12. Cross-Field Truthfulness & Validation Invariants
  const proposal = payload.circuit_proposal as CopilotProposalPayload | null | undefined
  if (proposal) {
    if (typeof proposal !== "object" || proposal.schema_version !== "pixiu-copilot-proposal-v1") {
      errors.push("circuit_proposal must match 'pixiu-copilot-proposal-v1' schema")
    }

    // When validator result is provided and circuit has critical failures
    if (options?.validatorResult) {
      const vRes = options.validatorResult
      if (!vRes.valid && ev?.circuit_validation?.status === "passed") {
        errors.push("Truthfulness violation: circuit failed validator but evidence claims status 'passed'")
      }
      if (!vRes.valid && ev?.circuit_validation?.truth === "verified_by_validator") {
        errors.push("Truthfulness violation: rejected circuit cannot be labeled 'verified_by_validator'")
      }
      if (!vRes.valid) {
        const hasWarningInSafetyNotes = (payload.safety_notes as string[]).some(n =>
          /error|hazard|warning|short|resistor|burnout|reject|invalid/i.test(n)
        )
        if (!hasWarningInSafetyNotes) {
          errors.push("Safety violation: validator detected hazards but safety_notes contains no warning")
        }
      }
    }
  } else {
    // If no circuit proposal is attached, circuit_validation status should be not_applicable
    if (ev && ev.circuit_validation && ev.circuit_validation.status === "passed") {
      errors.push("Truthfulness violation: cannot claim circuit_validation 'passed' when no circuit_proposal exists")
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      response: null,
    }
  }

  return {
    valid: true,
    errors: [],
    response: payload as unknown as PixiuTutorResponseV1,
  }
}
