import type { AiDetection, AiVisionMode, AiVisionState } from "./vision-types"

export const DEFAULT_AI_CONFIDENCE_THRESHOLD = 60

function clampPercent(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
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
  return {
    class: normalizeLabel(detection.class),
    score: Math.max(0, Math.min(1, Number.isFinite(Number(detection.score)) ? Number(detection.score) : 0)),
    bbox: detection.bbox,
  }
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
  const normalizedThreshold = Math.max(0, Math.min(100, Math.round(threshold)))

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
      reason: normalizedCandidate === "unknown" ? "low_confidence" : "low_confidence",
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
  threshold = DEFAULT_AI_CONFIDENCE_THRESHOLD,
): AiVisionState {
  const decision = normalizeAiDecision(
    state.detectedClass,
    state.confidence,
    threshold,
  )

  return {
    ...state,
    detectedClass: decision.candidate,
    confidence: decision.confidence,
    allDetections: (state.allDetections ?? []).map(normalizeDetection),
    modelClasses: state.modelClasses?.map(normalizeLabel),
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
    confidenceThreshold: Math.max(
      0,
      Math.min(100, Math.round(threshold)),
    ),
    decisionReason: decision.reason,
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
    mode === "trained" ? 62 : DEFAULT_AI_CONFIDENCE_THRESHOLD,
  )
}
