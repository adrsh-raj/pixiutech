import * as cocoSsd from "@tensorflow-models/coco-ssd"

export type ObjectDetector = cocoSsd.ObjectDetection

export async function loadObjectDetector(): Promise<ObjectDetector> {
  return cocoSsd.load({
    base: "lite_mobilenet_v2",
  })
}

export async function detectObjects(
  detector: ObjectDetector,
  video: HTMLVideoElement,
) {
  return detector.detect(video, 20, 0.45)
}

export function disposeObjectDetector(detector: ObjectDetector | null) {
  detector?.dispose()
}
