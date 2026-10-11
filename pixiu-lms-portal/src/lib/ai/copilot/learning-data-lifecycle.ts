/**
 * PIXIU TECH CYBERLAB — LEARNING-DATA LIFECYCLE & GOVERNANCE STATE MACHINE
 * 
 * Enforces the formal state transitions for transforming raw educational
 * interactions into approved, versioned dataset records.
 * 
 * Non-Negotiable Governance Invariants:
 * 1. Storing a prompt DOES NOT mean consent to model training.
 * 2. Negative or missing consent immediately rejects the candidate.
 * 3. Candidates CANNOT bypass policy evaluation, redaction, or human review.
 * 4. Rejected records can NEVER enter an approved dataset.
 * 5. Feedback submission DOES NOT grant training permission.
 * 6. NO automatic model weight updates occur from raw chat interactions.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { TutorInteractionEvent } from "./conversation-event-schema"

// ============================================================================
// Types & State Definitions
// ============================================================================

export type CandidateLifecycleState =
  | "INTERACTION_OCCURRED"
  | "SESSION_HANDLED"
  | "TRAINING_CONSENT_VERIFIED"
  | "POLICY_AND_RIGHTS_EVALUATED"
  | "REDACTION_AND_MINIMIZATION"
  | "CANDIDATE_QUEUED"
  | "HUMAN_REVIEW_PENDING"
  | "APPROVED_FOR_DATASET"
  | "REJECTED_INELIGIBLE"
  | "VERSIONED_DATASET_RELEASED"

export const ALLOWED_LIFECYCLE_STATES: readonly CandidateLifecycleState[] = [
  "INTERACTION_OCCURRED",
  "SESSION_HANDLED",
  "TRAINING_CONSENT_VERIFIED",
  "POLICY_AND_RIGHTS_EVALUATED",
  "REDACTION_AND_MINIMIZATION",
  "CANDIDATE_QUEUED",
  "HUMAN_REVIEW_PENDING",
  "APPROVED_FOR_DATASET",
  "REJECTED_INELIGIBLE",
  "VERSIONED_DATASET_RELEASED",
] as const

export interface PiiScrubbingResult {
  sanitizedText: string
  detectedPiiTypes: string[]
  isFullyScrubbed: boolean
  hasUncertainIdentity: boolean
  uncertaintyReasons?: string[]
}

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b[6-9]\d{9}\b/g
const AUTH_SECRET_PATTERN = /\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?)\b/gi
const GOV_ID_PATTERN = /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/g
const STUDENT_ID_PATTERN = /\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id|reg(?:istration)?\s*(?:no\.?|number)?)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+\b|\b(?:DPS|KV|SCH|STU|ADM)[-_]\d{4}[-_]\d{3,6}\b/gi
const CLASS_GRADE_PATTERN = /\b(?:class|grade|standard|std\.?)\s*(?:1[0-2]|[1-9]|X|XI|XII|IX|VIII|VII|VI|V|IV|III|II|I)(?:th|st|nd|rd)?(?:\s*[-/]?\s*(?:sec(?:tion)?\s*)?[A-Za-z])?\b|\b(?:sec(?:tion)?)\s*[-/:]?\s*[A-Fa-f]\b/gi
const SCHOOL_PATTERN = /\b(?:Delhi\s+Public\s+School|Kendriya\s+Vidyalaya|DPS\s+[A-Za-z]+|St\.?\s+[A-Za-z]+(?:'s)?\s+School)\b|\b(?:[A-Z][a-zA-Z0-9.'-]*\s+){1,4}(?:Public\s+School|High\s+School|Grammar\s+School|International\s+School|Vidyalaya|Vidyamandir|Convent|Academy|Secondary\s+School)\b/g
const STUDENT_NAME_DISCLOSURE_PATTERN = /(?:\b(?:[mM]y\s+[nN]ame\s+[iI]s|[tT]his\s+[iI]s|[mM]yself|[cC]all\s+[mM]e)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b)|(?:\b[iI]\s+[aA]m\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b)/g
const UNCERTAIN_DISCLOSURE_PATTERN = /\b(?:my\s+name\s+is|call\s+me|myself|i\s+am\s+a\s+student\s+at|my\s+school\s+is|i\s+study\s+at|my\s+class\s+is|my\s+roll\s+is|my\s+teacher\s+is|my\s+mentor\s+is|contact\s+me\s+at|reach\s+me\s+at)\b/i
const KNOWN_TECHNICAL_TERMS = new Set([
  "how", "why", "what", "when", "where", "which", "who", "does", "do", "is", "are", "can",
  "could", "should", "would", "will", "if", "the", "a", "an", "in", "on", "at", "to", "for",
  "with", "from", "by", "of", "and", "or", "not", "no", "my", "your", "his", "her", "its",
  "our", "their", "this", "that", "these", "those", "it", "i", "you", "he", "she", "we", "they",
  "me", "him", "us", "them", "be", "been", "being", "have", "has", "had", "having",
  "need", "needs", "needed", "use", "uses", "used", "using", "connect", "connects", "connected",
  "connecting", "wire", "wires", "wired", "wiring", "work", "works", "worked", "working",
  "stop", "stops", "stopped", "stopping", "fail", "fails", "failed", "failing", "burn", "burns",
  "burned", "burning", "out", "blink", "blinks", "blinked", "blinking", "turn", "turns", "turned",
  "turning", "run", "runs", "ran", "running", "read", "reads", "reading", "write", "writes",
  "writing", "set", "sets", "setting", "drive", "drives", "driven", "driving", "measure",
  "measures", "measured", "measuring", "calculate", "calculates", "calculated", "calculating",
  "explain", "explains", "explained", "explaining", "help", "helps", "helped", "helping",
  "arduino", "uno", "r3", "mega", "nano", "esp32", "raspberry", "pi", "pico", "microbit",
  "led", "gnd", "vcc", "pin", "pins", "resistor", "resistors", "capacitor", "capacitors",
  "potentiometer", "servo", "servos", "buzzer", "buzzers", "sensor", "sensors", "ultrasonic",
  "hc-sr04", "dht11", "dht22", "ldr", "breadboard", "breadboards", "voltage", "current",
  "amp", "amps", "amperes", "milliamp", "milliamps", "ma", "volt", "volts", "v", "ohm", "ohms",
  "ground", "power", "rail", "rails", "digital", "analog", "pwm", "gpio", "circuit", "circuits",
  "multimeter", "dmm", "switch", "pushbutton", "button", "transistor", "mosfet", "relay",
  "motor", "dc", "ac", "battery", "batteries", "diode", "diodes", "ic", "chip", "i2c", "spi",
  "uart", "tx", "rx", "scl", "sda", "logic", "high", "low", "input", "output", "pullup",
  "pulldown", "board", "boards", "hardware", "code", "sketch", "telemetry", "doctor",
  "student", "query", "prompt", "question", "answer", "phone", "email", "redacted",
  "5v", "3.3v", "9v", "12v", "ohms", "law", "formula", "v=ir", "milliseconds", "ms", "seconds",
  "d13", "d12", "d11", "d10", "d9", "d8", "d7", "d6", "d5", "d4", "d3", "d2", "d1", "d0",
  "a0", "a1", "a2", "a3", "a4", "a5", "d34", "d35", "current-limiting", "series", "parallel"
])

const INTERPERSONAL_DIALOGUE_PATTERN = /\b(?:told|asked|says|said|informed|explained\s+to|showed|working\s+with|partner|classmate|teammate|friend|brother|sister)\b/i
const UNFAMILIAR_SCHOOL_PATTERN = /\b(?:from|at|in|studies\s+at|goes\s+to)\s+([A-Za-z0-9.'\-_]+(?:\s+[A-Za-z0-9.'\-_]+){0,3}\s+(?:school|campus|academy|vidyalaya|vidyamandir|institute|college|institution|center))\b/i
const INFORMAL_SCHOOL_PATTERN = /\b(?:from|at)\s+(?:greenwood|riverdale|sunset|hillside|st\.?\s+[a-z]+|dps|kv|convent)\b/i
const INFORMAL_STUDENT_ID_PATTERN = /\b(?:student\s*id|roll\s*(?:no\.?|num|number)?|adm(?:ission)?\s*(?:no\.?|num|number|id)?|reg(?:istration)?\s*(?:no\.?|number)?|my\s+id\s+is|my\s+roll\s+is)\s*[:=#\-]?\s*#?\s*[0-9A-Za-z\-_]+\b|\b(?:student|candidate)\s*#\s*\d+\b|\b#(?:[0-9]{3,8})\b|\bid\s*[:=]\s*\d+\b/i

/**
 * Detects potential student names, third-person narrative dialogues, unfamiliar schools,
 * or informal student IDs that regex scrubbing cannot guarantee to be clean.
 */
export function detectPotentialIdentityLeakage(text: string): {
  hasPotentialIdentity: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  if (INTERPERSONAL_DIALOGUE_PATTERN.test(text)) {
    reasons.push("interpersonal_dialogue_marker")
  }

  if (UNFAMILIAR_SCHOOL_PATTERN.test(text) || INFORMAL_SCHOOL_PATTERN.test(text)) {
    reasons.push("informal_or_unfamiliar_school_reference")
  }

  if (INFORMAL_STUDENT_ID_PATTERN.test(text)) {
    reasons.push("informal_student_id")
  }

  if (UNCERTAIN_DISCLOSURE_PATTERN.test(text)) {
    reasons.push("self_disclosure_marker")
  }

  const words = text.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    const raw = words[i].replace(/[^A-Za-z0-9]/g, "")
    const lower = raw.toLowerCase()
    if (!raw || lower.length < 2) continue

    const isCap = /^[A-Z][a-z]+$/.test(raw)
    if (isCap) {
      const isStartOfSentence = i === 0 || /[.!?]$/.test(words[i - 1])
      if (!KNOWN_TECHNICAL_TERMS.has(lower)) {
        if (!isStartOfSentence) {
          reasons.push(`unrecognized_proper_noun:${raw}`)
        } else if (i + 1 < words.length && /^[A-Z][a-z]+$/.test(words[i + 1].replace(/[^A-Za-z0-9]/g, ""))) {
          const nextLower = words[i + 1].replace(/[^A-Za-z0-9]/g, "").toLowerCase()
          if (!KNOWN_TECHNICAL_TERMS.has(nextLower)) {
            reasons.push(`consecutive_unrecognized_proper_nouns:${raw}_${words[i + 1]}`)
          }
        }
      }
    }
  }

  return {
    hasPotentialIdentity: reasons.length > 0,
    reasons,
  }
}

/**
 * Validates whether a text string contains any raw, unredacted PII patterns.
 * Non-global regexes are used to prevent stateful regex lastIndex mutation bugs.
 */
export function containsRawPii(text: string): {
  hasRawPii: boolean
  matchedType?: string
} {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { hasRawPii: false }
  }

  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "email" }
  }
  if (/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b[6-9]\d{9}\b/.test(text)) {
    return { hasRawPii: true, matchedType: "phone" }
  }
  if (/\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?)\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "auth_token_or_secret" }
  }
  if (/\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    return { hasRawPii: true, matchedType: "government_id" }
  }
  if (/\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id|reg(?:istration)?\s*(?:no\.?|number)?)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+\b|\b(?:DPS|KV|SCH|STU|ADM)[-_]\d{4}[-_]\d{3,6}\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "student_roll_or_admission_id" }
  }
  if (/\b(?:class|grade|standard|std\.?)\s*(?:1[0-2]|[1-9]|X|XI|XII|IX|VIII|VII|VI|V|IV|III|II|I)(?:th|st|nd|rd)?(?:\s*[-/]?\s*(?:sec(?:tion)?\s*)?[A-Za-z])?\b|\b(?:sec(?:tion)?)\s*[-/:]?\s*[A-Fa-f]\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "class_grade_section" }
  }
  if (/\b(?:Delhi\s+Public\s+School|Kendriya\s+Vidyalaya|DPS\s+[A-Za-z]+|St\.?\s+[A-Za-z]+(?:'s)?\s+School)\b|\b(?:[A-Z][a-zA-Z0-9.'-]*\s+){1,4}(?:Public\s+School|High\s+School|Grammar\s+School|International\s+School|Vidyalaya|Vidyamandir|Convent|Academy|Secondary\s+School)\b/.test(text)) {
    return { hasRawPii: true, matchedType: "school_name" }
  }
  if (/(?:(?:[mM]y\s+[nN]ame\s+[iI]s|[tT]his\s+[iI]s|[mM]yself|[cC]all\s+[mM]e)\s+[A-Z][a-z]+)|(?:[iI]\s+[aA]m\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/.test(text)) {
    return { hasRawPii: true, matchedType: "student_name" }
  }
  if (UNCERTAIN_DISCLOSURE_PATTERN.test(text)) {
    return { hasRawPii: true, matchedType: "uncertain_disclosure" }
  }

  return { hasRawPii: false }
}

/**
 * Sanitizes caller-provided rejection reasons to prevent arbitrary text or PII smuggling.
 */
export function sanitizeRejectionReason(callerReason: string | undefined, defaultReason: string): string {
  if (!callerReason || typeof callerReason !== "string") {
    return defaultReason
  }
  const trimmed = callerReason.trim()
  if (/^[A-Z0-9_]{3,64}$/.test(trimmed)) {
    return trimmed
  }
  return defaultReason
}

/**
 * Deterministic baseline PII scrubbing for supported patterns:
 * - Emails, phone numbers, auth secrets
 * - Government IDs (Aadhaar, SSN)
 * - Student roll numbers, admission IDs, class/grade/section
 * - School names and self-disclosed student names
 * 
 * Includes fail-closed detection of unscrubbed or uncertain student identity markers.
 */
export function scrubPii(text: string): PiiScrubbingResult {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { sanitizedText: "", detectedPiiTypes: [], isFullyScrubbed: false, hasUncertainIdentity: false }
  }

  const detected: string[] = []
  let result = text

  let before = result
  result = result.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
  if (result !== before) detected.push("email")

  before = result
  result = result.replace(PHONE_PATTERN, "[REDACTED_PHONE]")
  if (result !== before) detected.push("phone")

  before = result
  result = result.replace(AUTH_SECRET_PATTERN, "[REDACTED_SECRET]")
  if (result !== before) detected.push("auth_token_or_secret")

  before = result
  result = result.replace(GOV_ID_PATTERN, "[REDACTED_GOV_ID]")
  if (result !== before) detected.push("government_id")

  before = result
  result = result.replace(STUDENT_ID_PATTERN, "[REDACTED_STUDENT_ID]")
  if (result !== before) detected.push("student_roll_or_admission_id")

  before = result
  result = result.replace(CLASS_GRADE_PATTERN, "[REDACTED_CLASS]")
  if (result !== before) detected.push("class_grade_section")

  before = result
  result = result.replace(SCHOOL_PATTERN, "[REDACTED_SCHOOL]")
  if (result !== before) detected.push("school_name")

  before = result
  result = result.replace(STUDENT_NAME_DISCLOSURE_PATTERN, "[REDACTED_STUDENT_NAME]")
  if (result !== before) detected.push("student_name")

  // Post-scrub check: Ensure no residual raw patterns remain
  const residualEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.test(result)
  const residualPhone = /\b[6-9]\d{9}\b|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(result)
  const residualGovId = /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/.test(result)
  const residualStudentId = /\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+/i.test(result)
  const residualSecret = /\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=])/i.test(result)

  const identityCheck = detectPotentialIdentityLeakage(result)
  const hasUncertainIdentity = identityCheck.hasPotentialIdentity
  const uncertaintyReasons: string[] = [...identityCheck.reasons]
  if (residualEmail || residualPhone || residualGovId || residualStudentId || residualSecret) {
    uncertaintyReasons.push("residual_structured_identifier")
  }

  const isFullyScrubbed =
    !residualEmail &&
    !residualPhone &&
    !residualGovId &&
    !residualStudentId &&
    !residualSecret &&
    !hasUncertainIdentity

  return {
    sanitizedText: result,
    detectedPiiTypes: [...new Set(detected)],
    isFullyScrubbed,
    hasUncertainIdentity,
    uncertaintyReasons: uncertaintyReasons.length > 0 ? uncertaintyReasons : undefined,
  }
}

export interface RedactionResult {
  isRedacted: boolean
  redactedPrompt: string
  redactedResponseSummary: string
  piiDetected: boolean
  piiTypes: string[]
}

export interface HumanReviewSignature {
  reviewerId: string
  reviewedAtUtc: string
  decision: "APPROVED" | "REJECTED"
  reviewCategory: "electrical_validity" | "pedagogical_clarity" | "safety_adherence"
  evidenceNotes: string
}

export type AuthoritativeReviewerVerifier = (
  signature: HumanReviewSignature
) => { verified: boolean; failureReason?: string }

export interface LearningCandidateRecord {
  concept_type: "learning_data_candidate"
  candidateId: string
  sourceEventId: string
  sourceConversationId: string
  state: CandidateLifecycleState
  trainingConsentGranted: boolean
  policyCheckPassed: boolean
  redaction: RedactionResult | null
  humanReview: HumanReviewSignature | null
  targetDatasetVersion?: string
  rejectionReason?: string
  createdAt: number
  updatedAt: number
}

export interface AuthoritativeConsentRecord {
  consentId: string
  subjectId: string
  consentType: "learning_data_research_and_benchmarking"
  grantedAtUtc: string
  policyVersion: string
  verificationStatus: "VERIFIED_ACTIVE" | "REVOKED" | "UNVERIFIED"
  authorityProvider: string
}

export interface TransitionContext {
  trainingConsent?: boolean
  authoritativeConsentRecord?: AuthoritativeConsentRecord
  policyPassed?: boolean
  rawPrompt?: string
  rawResponseSummary?: string
  redactionResult?: RedactionResult
  humanReviewSignature?: HumanReviewSignature
  reviewerVerifier?: AuthoritativeReviewerVerifier
  datasetVersion?: string
  rejectionReason?: string
}

export interface TransitionResult {
  success: boolean
  previousState: CandidateLifecycleState
  currentState: CandidateLifecycleState
  error?: string
  candidate: LearningCandidateRecord
}

// ============================================================================
// Lifecycle State Machine Implementation
// ============================================================================

/**
 * Valid forward transitions mapping.
 */
const VALID_TRANSITIONS: Record<CandidateLifecycleState, readonly CandidateLifecycleState[]> = {
  INTERACTION_OCCURRED: ["SESSION_HANDLED", "REJECTED_INELIGIBLE"],
  SESSION_HANDLED: ["TRAINING_CONSENT_VERIFIED", "REJECTED_INELIGIBLE"],
  TRAINING_CONSENT_VERIFIED: ["POLICY_AND_RIGHTS_EVALUATED", "REJECTED_INELIGIBLE"],
  POLICY_AND_RIGHTS_EVALUATED: ["REDACTION_AND_MINIMIZATION", "REJECTED_INELIGIBLE"],
  REDACTION_AND_MINIMIZATION: ["CANDIDATE_QUEUED", "REJECTED_INELIGIBLE"],
  CANDIDATE_QUEUED: ["HUMAN_REVIEW_PENDING", "REJECTED_INELIGIBLE"],
  HUMAN_REVIEW_PENDING: ["APPROVED_FOR_DATASET", "REJECTED_INELIGIBLE"],
  APPROVED_FOR_DATASET: ["VERSIONED_DATASET_RELEASED", "REJECTED_INELIGIBLE"],
  REJECTED_INELIGIBLE: [], // Terminal sink
  VERSIONED_DATASET_RELEASED: [], // Terminal released
}

export interface LearningDataIntakeConfig {
  readonly freeTextIntakeEnabled: boolean
  readonly defaultRejectionReason: string
}

/**
 * Default learning-data intake configuration.
 * Strictly frozen to prevent runtime mutation by callers.
 */
export const DEFAULT_LEARNING_DATA_INTAKE_CONFIG: Readonly<LearningDataIntakeConfig> = Object.freeze({
  freeTextIntakeEnabled: false,
  defaultRejectionReason: "REJECTED_LEARNING_DATA_INTAKE_DISABLED",
})

/**
 * Returns whether learning-data intake for free-text interactions is enabled.
 * In Phase 1E, intake is strictly disabled by default and immutable.
 */
export function isLearningDataIntakeEnabled(): boolean {
  return DEFAULT_LEARNING_DATA_INTAKE_CONFIG.freeTextIntakeEnabled
}

export interface CandidateIntakeResult {
  accepted: boolean
  candidate: LearningCandidateRecord
  reasonCode: string
}

/**
 * High-level candidate intake entry point for educational interactions.
 * In Phase 1E, learning-data intake is disabled by default.
 */
export function intakeLearningCandidate(
  event: TutorInteractionEvent
): CandidateIntakeResult {
  const candidate = createLearningCandidateFromEvent(event)
  candidate.state = "REJECTED_INELIGIBLE"
  candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
  candidate.trainingConsentGranted = false
  candidate.redaction = null
  candidate.updatedAt = Date.now()
  return {
    accepted: false,
    candidate,
    reasonCode: DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason,
  }
}

/**
 * Creates a raw learning candidate from an interaction event.
 * Initial state is always INTERACTION_OCCURRED.
 * Consent is initialized strictly to false; a caller-provided boolean does not establish consent.
 */
export function createLearningCandidateFromEvent(
  event: TutorInteractionEvent
): LearningCandidateRecord {
  return {
    concept_type: "learning_data_candidate",
    candidateId: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "INTERACTION_OCCURRED",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function createFallbackRejectedCandidate(reason: string): LearningCandidateRecord {
  return {
    concept_type: "learning_data_candidate",
    candidateId: "cand-malformed-fallback",
    sourceEventId: "unknown",
    sourceConversationId: "unknown",
    state: "REJECTED_INELIGIBLE",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    rejectionReason: reason,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Validates and executes a state transition with strict policy enforcement.
 */
export function transitionCandidateState(
  candidate: LearningCandidateRecord,
  targetState: CandidateLifecycleState,
  context: TransitionContext = {}
): TransitionResult {
  // Validate candidate object before accessing any properties
  if (!candidate || typeof candidate !== "object") {
    return {
      success: false,
      previousState: "REJECTED_INELIGIBLE",
      currentState: "REJECTED_INELIGIBLE",
      error: "Malformed candidate: candidate must be an object",
      candidate: createFallbackRejectedCandidate("REJECTED_MALFORMED_CANDIDATE"),
    }
  }

  // Validate candidate.state against VALID_TRANSITIONS
  const rawState = candidate.state
  const isKnownState =
    typeof rawState === "string" &&
    Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, rawState)

  if (!isKnownState) {
    const rawStateStr = String(rawState)
    try {
      if (!Object.isFrozen(candidate)) {
        candidate.state = "REJECTED_INELIGIBLE"
        candidate.rejectionReason = "REJECTED_INVALID_STATE"
        candidate.updatedAt = Date.now()
      }
    } catch {
      // Safely ignore mutation failures on frozen/sealed objects
    }
    return {
      success: false,
      previousState: "REJECTED_INELIGIBLE",
      currentState: "REJECTED_INELIGIBLE",
      error: `Invalid or unknown candidate state: ${rawStateStr}`,
      candidate,
    }
  }

  // Validate targetState against VALID_TRANSITIONS
  const isKnownTargetState =
    typeof targetState === "string" &&
    Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, targetState)

  if (!isKnownTargetState) {
    return {
      success: false,
      previousState: candidate.state,
      currentState: candidate.state,
      error: `Invalid or unknown target state: ${String(targetState)}`,
      candidate,
    }
  }

  const previousState = candidate.state
  const allowedNext = VALID_TRANSITIONS[previousState]

  // 1. Transition Graph Check
  if (!allowedNext || !allowedNext.includes(targetState)) {
    return {
      success: false,
      previousState,
      currentState: previousState,
      error: `Illegal state transition from ${previousState} to ${targetState}`,
      candidate,
    }
  }

  // 2. Invariant Check: Consent Verification (FAIL-CLOSED)
  if (targetState === "TRAINING_CONSENT_VERIFIED") {
    // Attack vector 1: Caller attempts to forge consent via caller-controlled boolean trainingConsent: true
    if (context.trainingConsent === true && !context.authoritativeConsentRecord) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_CALLER_CONTROLLED_CONSENT_FORBIDDEN"
      candidate.trainingConsentGranted = false
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Raw caller-supplied boolean trainingConsent: true is prohibited. An authoritative consent record verified by a trusted consent service is required.",
        candidate,
      }
    }

    // Attack vector 2: Caller supplies a fabricated consent record claiming verificationStatus: "VERIFIED_ACTIVE"
    // In Phase 1E, until a trusted consent authority service is integrated, caller-supplied objects cannot establish authenticity.
    if (context.authoritativeConsentRecord) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_UNVERIFIED_CONSENT_AUTHORITY"
      candidate.trainingConsentGranted = false
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Caller-provided consent record cannot establish authenticity. Trusted district consent verification service integration is required.",
        candidate,
      }
    }

    // Default missing consent
    candidate.state = "REJECTED_INELIGIBLE"
    candidate.rejectionReason = "REJECTED_MISSING_EXPLICIT_TRAINING_CONSENT"
    candidate.trainingConsentGranted = false
    candidate.updatedAt = Date.now()
    return {
      success: false,
      previousState,
      currentState: "REJECTED_INELIGIBLE",
      error: "Candidate rejected: No active authoritative consent record available from integrated consent service.",
      candidate,
    }
  }

  // 3. Invariant Check: Policy & Rights
  if (targetState === "POLICY_AND_RIGHTS_EVALUATED") {
    if (!context.policyPassed) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = sanitizeRejectionReason(context.rejectionReason, "REJECTED_FAILED_POLICY_CHECK")
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Failed privacy/school policy or IP rights evaluation",
        candidate,
      }
    }
    candidate.policyCheckPassed = true
  }

  // 4. Invariant Check: Real Redaction & PII Verification (FAIL-CLOSED)
  if (targetState === "CANDIDATE_QUEUED") {
    let sanitizedPrompt = ""
    let sanitizedSummary = ""
    const detectedPiiTypes = new Set<string>()

    if (context.rawPrompt) {
      // Conservative Phase 1E Invariant:
      // Until reliable student-identity screening (e.g. on-device NER) and authoritative consent
      // verification are available, raw free-text prompts must NOT enter the learning-candidate review queue.
      // Free-text learning-data intake is disabled by default with an explicit generic reason code.
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
      candidate.redaction = null
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake for raw free-text prompts is disabled by default until reliable identity screening and authoritative consent verification are integrated.",
        candidate,
      }
    } else if (context.redactionResult) {
      // Caller passed redactionResult — DO NOT TRUST caller isRedacted or piiDetected flags!
      if (!context.redactionResult.isRedacted) {
        candidate.state = "REJECTED_INELIGIBLE"
        candidate.rejectionReason = "REJECTED_UNREDACTED_PII"
        candidate.redaction = null
        candidate.updatedAt = Date.now()
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Payload explicitly marked unredacted",
          candidate,
        }
      }

      const promptText = context.redactionResult.redactedPrompt
      if (!promptText || typeof promptText !== "string" || promptText.trim().length === 0) {
        candidate.state = "REJECTED_INELIGIBLE"
        candidate.rejectionReason = "REJECTED_MISSING_REDACTION_PAYLOAD"
        candidate.redaction = null
        candidate.updatedAt = Date.now()
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Missing or invalid sanitized prompt payload",
          candidate,
        }
      }

      // Verify that redactedPrompt is truly free of raw PII and uncertain identity
      const promptRawCheck = containsRawPii(promptText)
      const promptLeakage = detectPotentialIdentityLeakage(promptText)
      const promptScrubbed = scrubPii(promptText)

      if (promptRawCheck.hasRawPii || promptLeakage.hasPotentialIdentity || !promptScrubbed.isFullyScrubbed || promptScrubbed.hasUncertainIdentity) {
        candidate.state = "REJECTED_INELIGIBLE"
        candidate.rejectionReason = promptRawCheck.hasRawPii
          ? "REJECTED_UNREDACTED_PII"
          : (promptLeakage.hasPotentialIdentity || promptScrubbed.hasUncertainIdentity)
          ? "REJECTED_UNCERTAIN_STUDENT_PII"
          : "REJECTED_UNREDACTED_PII"
        candidate.redaction = null
        candidate.updatedAt = Date.now()
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Raw PII detected in redactedPrompt payload. Identifiable student data and blind isRedacted flags are not trusted.",
          candidate,
        }
      }

      for (const t of promptScrubbed.detectedPiiTypes) {
        detectedPiiTypes.add(t)
      }
      if (/\[REDACTED_EMAIL\]/.test(promptText)) detectedPiiTypes.add("email")
      if (/\[REDACTED_PHONE\]/.test(promptText)) detectedPiiTypes.add("phone")
      if (/\[REDACTED_SECRET\]/.test(promptText)) detectedPiiTypes.add("auth_token_or_secret")
      if (/\[REDACTED_GOV_ID\]/.test(promptText)) detectedPiiTypes.add("government_id")
      if (/\[REDACTED_STUDENT_ID\]/.test(promptText)) detectedPiiTypes.add("student_roll_or_admission_id")
      if (/\[REDACTED_CLASS\]/.test(promptText)) detectedPiiTypes.add("class_grade_section")
      if (/\[REDACTED_SCHOOL\]/.test(promptText)) detectedPiiTypes.add("school_name")
      if (/\[REDACTED_STUDENT_NAME\]/.test(promptText)) detectedPiiTypes.add("student_name")

      sanitizedPrompt = promptText

      // Verify response summary in redactionResult
      const summaryText = context.redactionResult.redactedResponseSummary ?? "sanitized_for_review"
      if (summaryText !== "sanitized_for_review") {
        const summaryRawCheck = containsRawPii(summaryText)
        const summaryLeakage = detectPotentialIdentityLeakage(summaryText)
        const summaryScrubbed = scrubPii(summaryText)

        if (summaryRawCheck.hasRawPii || summaryLeakage.hasPotentialIdentity || !summaryScrubbed.isFullyScrubbed || summaryScrubbed.hasUncertainIdentity) {
          candidate.state = "REJECTED_INELIGIBLE"
          candidate.rejectionReason = summaryRawCheck.hasRawPii
            ? "REJECTED_UNREDACTED_PII"
            : (summaryLeakage.hasPotentialIdentity || summaryScrubbed.hasUncertainIdentity)
            ? "REJECTED_UNCERTAIN_STUDENT_PII"
            : "REJECTED_UNREDACTED_PII"
          candidate.redaction = null
          candidate.updatedAt = Date.now()
          return {
            success: false,
            previousState,
            currentState: "REJECTED_INELIGIBLE",
            error: "Candidate rejected: Raw PII or identifiable student data detected in redactedResponseSummary payload.",
            candidate,
          }
        }

        for (const t of summaryScrubbed.detectedPiiTypes) {
          detectedPiiTypes.add(t)
        }
        if (/\[REDACTED_EMAIL\]/.test(summaryText)) detectedPiiTypes.add("email")
        if (/\[REDACTED_PHONE\]/.test(summaryText)) detectedPiiTypes.add("phone")
        if (/\[REDACTED_SECRET\]/.test(summaryText)) detectedPiiTypes.add("auth_token_or_secret")
        if (/\[REDACTED_GOV_ID\]/.test(summaryText)) detectedPiiTypes.add("government_id")
        if (/\[REDACTED_STUDENT_ID\]/.test(summaryText)) detectedPiiTypes.add("student_roll_or_admission_id")
        if (/\[REDACTED_CLASS\]/.test(summaryText)) detectedPiiTypes.add("class_grade_section")
        if (/\[REDACTED_SCHOOL\]/.test(summaryText)) detectedPiiTypes.add("school_name")
        if (/\[REDACTED_STUDENT_NAME\]/.test(summaryText)) detectedPiiTypes.add("student_name")

        sanitizedSummary = summaryText
      } else {
        sanitizedSummary = "sanitized_for_review"
      }
    } else {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_MISSING_REDACTION_PAYLOAD"
      candidate.redaction = null
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Must undergo verified PII redaction and payload minimization before queueing",
        candidate,
      }
    }

    // Conservative Phase 1E Boundary Guard:
    // Intake is disabled by default. Regardless of whether caller passed rawPrompt,
    // pre-filled redactionResult, or any other payload, no candidate may enter CANDIDATE_QUEUED.
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
      candidate.redaction = null
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default until reliable identity screening and authoritative consent verification are integrated.",
        candidate,
      }
    }

    // Only sanitized text can proceed; piiDetected is truthfully computed by the system
    candidate.redaction = {
      isRedacted: true,
      redactedPrompt: sanitizedPrompt,
      redactedResponseSummary: sanitizedSummary,
      piiDetected: detectedPiiTypes.size > 0,
      piiTypes: Array.from(detectedPiiTypes),
    }
  }

  // 5. Invariant Check: Review Queue State Guard (FAIL-CLOSED)
  if (targetState === "HUMAN_REVIEW_PENDING") {
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
      candidate.redaction = null
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default. Human review queue cannot accept candidates while intake is disabled.",
        candidate,
      }
    }
  }

  // 6. Invariant Check: Human Review Sign-Off (FAIL-CLOSED)
  if (targetState === "APPROVED_FOR_DATASET") {
    const sig = context.humanReviewSignature
    if (!sig || sig.decision !== "APPROVED" || !sig.reviewerId || !sig.reviewedAtUtc) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_MISSING_OR_INVALID_HUMAN_SIGNATURE"
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Cannot approve without a genuine, evidenced human review signature",
        candidate,
      }
    }

    // Reject automated reviewer labels
    const isAutoReviewer = /(?:^system-|generator|verifier|automation|automated|(?:^|[-_])bot(?:$|[-_]))/i.test(sig.reviewerId)
    if (isAutoReviewer) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_AUTOMATED_REVIEWER_LABEL"
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Reviewer ID indicates an automated generator/verifier, not an independent human reviewer",
        candidate,
      }
    }

    // Validate that evidenceNotes does not contain raw student PII or leakage
    if (typeof sig.evidenceNotes === "string" && sig.evidenceNotes.trim().length > 0) {
      const evidenceRawPii = containsRawPii(sig.evidenceNotes)
      const evidenceLeakage = detectPotentialIdentityLeakage(sig.evidenceNotes)
      if (evidenceRawPii.hasRawPii || evidenceLeakage.hasPotentialIdentity) {
        candidate.state = "REJECTED_INELIGIBLE"
        candidate.rejectionReason = evidenceRawPii.hasRawPii
          ? "REJECTED_UNREDACTED_PII"
          : evidenceLeakage.hasPotentialIdentity
          ? "REJECTED_UNCERTAIN_STUDENT_PII"
          : "REJECTED_UNREDACTED_PII"
        candidate.updatedAt = Date.now()
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Raw PII or identifiable student data detected in reviewer evidence notes.",
          candidate,
        }
      }
    }

    // Attack vector 2: Caller attempts to inject an arbitrary user-supplied function in reviewerVerifier or test mock
    if (context.reviewerVerifier || (context as Record<string, unknown>).__testOnly_mockAuthorization) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = "REJECTED_CALLER_INJECTED_VERIFIER_FORBIDDEN"
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Dataset approval blocked: Caller-injected reviewerVerifier functions are strictly prohibited. A user-supplied function cannot establish reviewer authorization.",
        candidate,
      }
    }

    // Fail-Closed: Authoritative Reviewer Verification Check
    // In production and throughout Phase 1E, an authoritative IAM/SSO identity service is required.
    // External IAM/SSO is not yet integrated, so approval unconditionally fails closed.
    candidate.state = "REJECTED_INELIGIBLE"
    candidate.rejectionReason = "REJECTED_AUTHORITATIVE_VERIFIER_UNAVAILABLE"
    candidate.updatedAt = Date.now()
    return {
      success: false,
      previousState,
      currentState: "REJECTED_INELIGIBLE",
      error: "Dataset approval blocked: No authoritative reviewer-verification integration available to verify reviewer identity and permission.",
      candidate,
    }
  }

  // 7. Invariant Check: Dataset Version Pinning & Release Guard (FAIL-CLOSED)
  if (targetState === "VERSIONED_DATASET_RELEASED") {
    if (!context.datasetVersion) {
      return {
        success: false,
        previousState,
        currentState: previousState,
        error: "Cannot release without a pinned target dataset version (e.g. 'v2.1.0')",
        candidate,
      }
    }

    // Boundary Guard: While intake is disabled, dataset release cannot proceed
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE"
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
      candidate.updatedAt = Date.now()
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default. Cannot release dataset while intake is disabled.",
        candidate,
      }
    }

    candidate.targetDatasetVersion = context.datasetVersion
  }

  // 8. Transition to REJECTED_INELIGIBLE
  if (targetState === "REJECTED_INELIGIBLE") {
    candidate.rejectionReason = sanitizeRejectionReason(context.rejectionReason, "REJECTED_UNSPECIFIED")
  }

  // Apply State Transition
  candidate.state = targetState
  candidate.updatedAt = Date.now()

  return {
    success: true,
    previousState,
    currentState: targetState,
    candidate,
  }
}

/**
 * Hard architectural guardrail:
 * Online training / real-time weight updating from raw student chat interactions
 * is strictly prohibited by Pixiu Tech safety policy.
 */
export function triggerOnlineModelWeightUpdate(): never {
  throw new Error(
    "GOVERNANCE VIOLATION: Online learning or automatic model weight updates from raw chats is strictly prohibited. All model enhancements must proceed via governed Phase 4/5 batch retraining."
  )
}
