import * as cocoSsd from "@tensorflow-models/coco-ssd"

export type ObjectDetector = cocoSsd.ObjectDetection

export type NormalizedObjectDetection = {
  class: string
  score: number
  bbox: [number, number, number, number]
}

export const COCO_SSD_CLASSES = [
  "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
  "fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
  "elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
  "skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard",
  "tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl","banana","apple",
  "sandwich","orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch",
  "potted plant","bed","dining table","toilet","tv","laptop","mouse","remote","keyboard",
  "cell phone","microwave","oven","toaster","sink","refrigerator","book","clock","vase",
  "scissors","teddy bear","hair drier","toothbrush",
] as const

export const DEFAULT_OBJECT_MAX_BOXES = 20
export const DEFAULT_OBJECT_MIN_SCORE = 0.3
export const COCO_SSD_MODEL_URL = "/models/coco-ssd-lite-mobilenet-v2/model.json"

let objectDetectorLoadPromise: Promise<ObjectDetector> | null = null
let objectDetectorInstance: ObjectDetector | null = null
let objectDetectorReferences = 0

export async function loadObjectDetector(): Promise<ObjectDetector> {
  objectDetectorReferences += 1

  if (objectDetectorInstance) return objectDetectorInstance
  if (objectDetectorLoadPromise) {
    try {
      const model = await objectDetectorLoadPromise
      return model
    } catch (error) {
      objectDetectorReferences = Math.max(0, objectDetectorReferences - 1)
      throw error
    }
  }

  objectDetectorLoadPromise = cocoSsd.load({
    base: "lite_mobilenet_v2",
    modelUrl: COCO_SSD_MODEL_URL,
  })
    .then((model) => {
      objectDetectorInstance = model
      return model
    })
    .finally(() => {
      objectDetectorLoadPromise = null
    })

  try {
    return await objectDetectorLoadPromise
  } catch (error) {
    objectDetectorReferences = Math.max(0, objectDetectorReferences - 1)
    throw error
  }
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
  return lower
}

export function disposeObjectDetector(detector: ObjectDetector | null) {
  if (!detector) return
  objectDetectorReferences = Math.max(0, objectDetectorReferences - 1)
  if (objectDetectorReferences > 0) return

  if (detector === objectDetectorInstance) {
    objectDetectorInstance = null
  }
  detector.dispose()
}
