import * as cocoSsd from "@tensorflow-models/coco-ssd"

export type ObjectDetector = cocoSsd.ObjectDetection

export type NormalizedObjectDetection = {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export const DEFAULT_OBJECT_MAX_BOXES = 20
export const DEFAULT_OBJECT_MIN_SCORE = 0.3

export async function loadObjectDetector(): Promise<ObjectDetector> {
  return cocoSsd.load({
    base: "lite_mobilenet_v2",
  })
}

export async function detectObjects(
  detector: ObjectDetector,
  video: HTMLVideoElement,
  options: {
    maxNumBoxes?: number
    minScore?: number
  } = {},
) {
  const maxNumBoxes = Math.max(1, Math.min(20, Math.floor(options.maxNumBoxes ?? DEFAULT_OBJECT_MAX_BOXES)))
  const minScore = Math.max(0.1, Math.min(0.99, Number(options.minScore ?? DEFAULT_OBJECT_MIN_SCORE)))
  return detector.detect(video, maxNumBoxes, minScore)
}

export function disposeObjectDetector(detector: ObjectDetector | null) {
  detector?.dispose()
}
