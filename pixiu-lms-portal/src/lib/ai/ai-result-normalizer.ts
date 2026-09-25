import type { AiDetection, AiVisionMode, AiVisionState } from "./vision-types"

export const DEFAULT_AI_CONFIDENCE_THRESHOLD = 60
export const SOUND_AI_CONFIDENCE_THRESHOLD = 72
export const TRAINED_AI_CONFIDENCE_THRESHOLD = 62

export function getAiConfidenceThreshold(mode: AiVisionMode) {
  if (mode === "sound") return SOUND_AI_CONFIDENCE_THRESHOLD
  if (mode === "trained") return TRAINED_AI_CONFIDENCE_THRESHOLD
  return DEFAULT_AI_CONFIDENCE_THRESHOLD
}

function clampPercent(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function clampThreshold(value: unknown, fallback = DEFAULT_AI_CONFIDENCE_THRESHOLD) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function normalizeLabel(value: unknown) {
  const label = String(value ?? "").trim().toLowerCase()
  if (!label) return "none"

  const aliases: Record<string, string> = {
    "cell phone": "phone",
    mobile: "phone",
    mobilephone: "phone",
    surprise: "surprised",
  }

  return aliases[label] ?? label
}

function normalizeDetection(detection: AiDetection): AiDetection {
  const [x = 0, y = 0, width = 0, height = 0] = Array.isArray(detection.bbox)
    ? detection.bbox
    : []
  return {
    class: normalizeLabel(detection.class),
    score: Math.max(
      0,
      Math.min(
        1,
        Number.isFinite(Number(detection.score))
          ? Number(detection.score)
          : 0,
      ),
    ),
    bbox: [
      Number.isFinite(Number(x)) ? Number(x) : 0,
      Number.isFinite(Number(y)) ? Number(y) : 0,
      Math.max(0, Number.isFinite(Number(width)) ? Number(width) : 0),
      Math.max(0, Number.isFinite(Number(height)) ? Number(height) : 0),
    ],
  }
}

function normalizeProbabilities(
  probabilities: Record<string, number> | undefined,
) {
  if (!probabilities) return undefined

  const normalized: Record<string, number> = {}
  for (const [label, value] of Object.entries(probabilities)) {
    normalized[normalizeLabel(label)] = clampPercent(value)
  }
  return normalized
}

export type AiDecision = {
  candidate: string
  confidence: number
  accepted: boolean
  unknown: boolean
  lowConfidence: boolean
  reason: "recognized" | "no_input" | "low_confidence"
}

export function normalizeAiDecision(
  candidate: unknown,
  confidence: unknown,
  threshold = DEFAULT_AI_CONFIDENCE_THRESHOLD,
): AiDecision {
  const normalizedCandidate = normalizeLabel(candidate)
  const normalizedConfidence = clampPercent(confidence)
  const normalizedThreshold = clampThreshold(threshold)

  if (normalizedCandidate === "none") {
    return {
      candidate: "none",
      confidence: 0,
      accepted: false,
      unknown: false,
      lowConfidence: false,
      reason: "no_input",
    }
  }

  if (
    normalizedCandidate === "unknown" ||
    normalizedConfidence < normalizedThreshold
  ) {
    return {
      candidate: "unknown",
      confidence: normalizedConfidence,
      accepted: false,
      unknown: true,
      lowConfidence: normalizedCandidate !== "unknown",
      reason: "low_confidence",
    }
  }

  return {
    candidate: normalizedCandidate,
    confidence: normalizedConfidence,
    accepted: true,
    unknown: false,
    lowConfidence: false,
    reason: "recognized",
  }
}

export function normalizeAiVisionState(
  state: AiVisionState,
  threshold = getAiConfidenceThreshold(state.mode),
): AiVisionState {
  const decision = normalizeAiDecision(
    state.detectedClass,
    state.confidence,
    threshold,
  )
  const decisionReason =
    decision.unknown && state.decisionReason === "ambiguous"
      ? "ambiguous"
      : decision.reason

  return {
    ...state,
    detectedClass: decision.candidate,
    confidence: decision.confidence,
    allDetections: (state.allDetections ?? []).map(normalizeDetection),
    modelClasses: state.modelClasses?.map(normalizeLabel),
    probabilities: normalizeProbabilities(state.probabilities),
    detectedGesture: state.detectedGesture
      ? normalizeLabel(state.detectedGesture)
      : state.detectedGesture,
    fingerCount: Number.isFinite(Number(state.fingerCount))
      ? Math.max(0, Math.min(5, Math.round(Number(state.fingerCount))))
      : state.fingerCount,
    handedness: state.handedness
      ? normalizeLabel(state.handedness)
      : state.handedness,
    unknown: decision.unknown,
    lowConfidence: decision.lowConfidence,
    confidenceThreshold: clampThreshold(threshold),
    decisionReason,
  }
}

export function normalizeAiForMode(
  mode: AiVisionMode,
  candidate: unknown,
  confidence: unknown,
  detail: string,
  extras: Partial<AiVisionState> = {},
): AiVisionState {
  return normalizeAiVisionState(
    {
      enabled: true,
      mode,
      detectedClass: String(candidate ?? "none"),
      confidence: Number(confidence ?? 0),
      allDetections: [],
      modelSource: mode === "trained" ? "trained" : "ready",
      detail,
      ...extras,
    },
    getAiConfidenceThreshold(mode),
  )
}
