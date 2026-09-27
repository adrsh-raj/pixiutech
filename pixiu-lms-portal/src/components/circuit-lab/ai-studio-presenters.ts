import type { AiVisionState } from "@/lib/ai/vision-types"

export function formatDecisionReason(reason: AiVisionState["decisionReason"]) {
  if (reason === "no_input") return "No usable input"
  if (reason === "low_confidence") return "Below confidence threshold"
  if (reason === "ambiguous") return "Top classes are too close"
  return "Accepted"
}
