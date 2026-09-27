import type {
  AiRuntimeErrorKind,
  AiRuntimeStatus,
  AiVisionMode,
} from "./vision-types"
import { AiRuntimeError } from "./ai-errors"

export type { AiRuntimeErrorKind, AiRuntimeStatus }

export function classifyAiRuntimeError(error: unknown): AiRuntimeErrorKind {
  if (error instanceof AiRuntimeError) return error.kind

  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : ""

  if (
    name === "NotAllowedError" ||
    name === "SecurityError" ||
    name === "PermissionDeniedError"
  ) return "permission"

  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "unsupported"
  if (name === "NotReadableError" || name === "TrackStartError") return "unsupported"

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? "").toLowerCase()

  if (
    message.includes("permission") ||
    message.includes("denied") ||
    message.includes("secure context")
  ) return "permission"

  if (
    message.includes("not support") ||
    message.includes("unsupported") ||
    message.includes("browser")
  ) return "unsupported"

  if (
    message.includes("model") ||
    message.includes("mediapipe") ||
    message.includes("movenet") ||
    message.includes("speech commands") ||
    message.includes("coco-ssd")
  ) return "model"

  if (message.includes("camera") || message.includes("microphone")) return "unsupported"
  if (message.includes("storage") || message.includes("indexeddb")) return "storage"
  if (message.includes("cancel")) return "cancelled"

  if (
    message.includes("inference") ||
    message.includes("predict") ||
    message.includes("detection")
  ) return "inference"

  return "unknown"
}

export function runtimeDetail(
  mode: AiVisionMode,
  status: AiRuntimeStatus,
): string {
  if (status === "idle") return mode === "sound" ? "Microphone idle" : "Camera idle"
  if (status === "loading") return mode === "sound" ? "Starting microphone…" : "Loading AI…"
  if (status === "ready") return "AI ready"
  if (status === "running") return "AI running"
  if (status === "stopped") return "AI stopped"
  return "AI unavailable"
}
