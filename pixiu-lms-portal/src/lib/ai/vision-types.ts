export type AiVisionMode = "camera" | "objects" | "pose"

export type AiDetection = {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export type PoseKeypoint = {
  x: number
  y: number
  score: number
  name: string
}

export type PoseResult = {
  score: number
  keypoints: PoseKeypoint[]
}

export interface AiVisionState {
  enabled: boolean
  mode: AiVisionMode
  detectedClass: string
  confidence: number
  allDetections: AiDetection[]
  detail: string
}
