export type ReadyAiMode =
  | "objects"
  | "pose"
  | "hands"
  | "emotion"
  | "sound"
  | "numbers"

export type AiVisionMode = ReadyAiMode | "trained"

export type AiDetection = {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export interface AiVisionState {
  enabled: boolean
  mode: AiVisionMode
  detectedClass: string
  confidence: number
  allDetections: AiDetection[]
  detectedGesture?: string
  fingerCount?: number
  handedness?: string
  modelClasses?: string[]
  modelSource?: "ready" | "trained"
  detail: string
}
