import type { AiVisionMode, AiVisionState } from "./vision-types"

export function createAiVisionState(mode: AiVisionMode): AiVisionState {
  return {
    enabled: false,
    mode,
    detectedClass: "none",
    confidence: 0,
    allDetections: [],
    modelClasses:
      mode === "numbers"
        ? ["0", "1", "2", "3", "4", "5"]
        : mode === "trained"
          ? []
          : undefined,
    modelSource: mode === "trained" ? "trained" : "ready",
    detail: mode === "trained" ? "My AI idle" : "AI idle",
  }
}
