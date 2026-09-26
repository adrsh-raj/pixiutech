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
): Promise<NormalizedObjectDetection[]> {
  const maxNumBoxes = Math.max(
    1,
    Math.min(20, Math.floor(options.maxNumBoxes ?? DEFAULT_OBJECT_MAX_BOXES)),
  )
  const minScore = Math.max(
    0.1,
    Math.min(0.99, Number(options.minScore ?? DEFAULT_OBJECT_MIN_SCORE)),
  )

  const predictions = await detector.detect(video, maxNumBoxes, minScore)

  return predictions
    .filter((prediction) => Number(prediction.score) >= minScore)
    .map((prediction) => ({
      class: normalizeObjectClass(prediction.class),
      score: Number(prediction.score),
      bbox: [
        Number(prediction.bbox[0]),
        Number(prediction.bbox[1]),
        Number(prediction.bbox[2]),
        Number(prediction.bbox[3]),
      ] as [number, number, number, number],
    }))
}

function normalizeObjectClass(name: string) {
  const lower = String(name).trim().toLowerCase()
  if (lower === "cell phone") return "phone"
  if (["car", "truck", "bus", "motorcycle"].includes(lower)) return "car"
  return lower
}

export function disposeObjectDetector(detector: ObjectDetector | null) {
  detector?.dispose()
}
