import type { AiRuntimeErrorKind } from "./vision-types"

export class AiRuntimeError extends Error {
  readonly kind: AiRuntimeErrorKind
  readonly userMessage: string
  readonly cause: unknown

  constructor(kind: AiRuntimeErrorKind, userMessage: string, cause?: unknown) {
    super(userMessage)
    this.name = "AiRuntimeError"
    this.kind = kind
    this.userMessage = userMessage
    this.cause = cause
  }
}

export class AIModelLoadError extends AiRuntimeError {
  constructor(userMessage = "The selected AI model could not be loaded.", cause?: unknown) {
    super("model", userMessage, cause)
    this.name = "AIModelLoadError"
  }
}

export class AIModelShapeError extends AiRuntimeError {
  constructor(userMessage = "The selected AI model has an incompatible shape.", cause?: unknown) {
    super("model", userMessage, cause)
    this.name = "AIModelShapeError"
  }
}

export class AITensorShapeError extends AiRuntimeError {
  constructor(userMessage = "The AI input data has an invalid tensor shape.", cause?: unknown) {
    super("inference", userMessage, cause)
    this.name = "AITensorShapeError"
  }
}

export class AIDatasetError extends AiRuntimeError {
  constructor(userMessage = "The My AI dataset is not valid for training.", cause?: unknown) {
    super("storage", userMessage, cause)
    this.name = "AIDatasetError"
  }
}

export class AIPermissionError extends AiRuntimeError {
  constructor(userMessage = "Camera or microphone permission is required.", cause?: unknown) {
    super("permission", userMessage, cause)
    this.name = "AIPermissionError"
  }
}

export class AICameraError extends AiRuntimeError {
  constructor(userMessage = "The camera could not be started.", cause?: unknown) {
    super("unsupported", userMessage, cause)
    this.name = "AICameraError"
  }
}

export class AIMicrophoneError extends AiRuntimeError {
  constructor(userMessage = "The microphone could not be started.", cause?: unknown) {
    super("unsupported", userMessage, cause)
    this.name = "AIMicrophoneError"
  }
}

export class AIInferenceError extends AiRuntimeError {
  constructor(userMessage = "AI inference failed. The selected AI can be retried.", cause?: unknown) {
    super("inference", userMessage, cause)
    this.name = "AIInferenceError"
  }
}

export class AIStorageError extends AiRuntimeError {
  constructor(userMessage = "Local AI data could not be saved.", cause?: unknown) {
    super("storage", userMessage, cause)
    this.name = "AIStorageError"
  }
}

export class AIUnsupportedBrowserError extends AiRuntimeError {
  constructor(userMessage = "This browser or device does not support this AI feature.", cause?: unknown) {
    super("unsupported", userMessage, cause)
    this.name = "AIUnsupportedBrowserError"
  }
}

export function toAiRuntimeError(error: unknown, context = "AI"): AiRuntimeError {
  if (error instanceof AiRuntimeError) return error

  const message = error instanceof Error ? error.message : String(error ?? "")
  const lower = message.toLowerCase()

  if (lower.includes("permission") || lower.includes("notallowed") || lower.includes("secure context")) {
    return new AIPermissionError(context + " needs browser permission. Allow access and try again.", error)
  }
  if (lower.includes("not support") || lower.includes("unsupported")) {
    return new AIUnsupportedBrowserError(undefined, error)
  }
  if (lower.includes("model") || lower.includes("movenet") || lower.includes("mediapipe") || lower.includes("coco-ssd") || lower.includes("speech commands")) {
    return new AIModelLoadError(undefined, error)
  }
  if (lower.includes("camera")) {
    return new AICameraError("The camera could not be started. Check the camera and browser permission.", error)
  }
  if (lower.includes("microphone")) {
    return new AIMicrophoneError("The microphone could not be started. Check the microphone and browser permission.", error)
  }
  if (lower.includes("shape") || lower.includes("tensor") || lower.includes("rank")) {
    return new AITensorShapeError(undefined, error)
  }
  if (lower.includes("storage") || lower.includes("indexeddb") || lower.includes("localstorage")) {
    return new AIStorageError(undefined, error)
  }
  if (lower.includes("cancel")) {
    return new AiRuntimeError("cancelled", context + " was cancelled.", error)
  }
  return new AIInferenceError(undefined, error)
}
