import * as tf from "@tensorflow/tfjs"
import type { PoseKeypoint, PoseResult } from "./vision-types"

const MOVENET_URL = "/models/movenet/model.json"

export const MOVENET_EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [0, 5], [0, 6], [5, 7], [7, 9],
  [6, 8], [8, 10], [5, 6], [5, 11],
  [6, 12], [11, 12], [11, 13], [13, 15],
  [12, 14], [14, 16],
]

export const MOVENET_KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const

const INPUT_SIZE = 192
const KEYPOINT_SCORE_THRESHOLD = 0.25

function firstGraphTensor(
  output: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap,
): tf.Tensor {
  if (Array.isArray(output)) {
    const first = output[0]
    if (!first) throw new Error("MoveNet returned no output tensor.")
    return first
  }
  if (output instanceof tf.Tensor) return output
  const first = Object.values(output)[0]
  if (!first) throw new Error("MoveNet returned no output tensor.")
  return first
}

function disposeGraphOutput(
  output: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap,
) {
  if (Array.isArray(output)) {
    output.forEach((tensor) => tensor.dispose())
    return
  }
  if (output instanceof tf.Tensor) {
    output.dispose()
    return
  }
  Object.values(output).forEach((tensor) => tensor.dispose())
}

export async function loadMoveNet(): Promise<tf.GraphModel> {
  await tf.ready()

  if (tf.getBackend() !== "webgl") {
    try {
      await tf.setBackend("webgl")
      await tf.ready()
    } catch {
      await tf.setBackend("cpu")
      await tf.ready()
    }
  }

  const model = await tf.loadGraphModel(MOVENET_URL)

  // Warm the graph once so the first visible inference is not a cold-start spike.
  const warmup = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3], "int32")
  const rawOutput = model.execute(warmup)
  disposeGraphOutput(rawOutput)
  warmup.dispose()

  return model
}

export async function estimateMoveNetPose(
  model: tf.GraphModel,
  video: HTMLVideoElement,
): Promise<PoseResult | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return null
  }

  const output = tf.tidy(() => {
    const frame = tf.browser.fromPixels(video)
    const resized = tf.image.resizeBilinear(
      frame,
      [INPUT_SIZE, INPUT_SIZE],
      true,
    )
    const input = tf.cast(tf.expandDims(resized, 0), "int32")
    return firstGraphTensor(model.execute(input))
  })

  try {
    const values = await output.data()
    if (values.length < MOVENET_KEYPOINT_NAMES.length * 3) {
      return null
    }

    const keypoints: PoseKeypoint[] = MOVENET_KEYPOINT_NAMES.map((name, index) => {
      const offset = index * 3
      const y = Number(values[offset] ?? 0)
      const x = Number(values[offset + 1] ?? 0)
      const score = Number(values[offset + 2] ?? 0)

      return {
        name,
        x: x * video.videoWidth,
        y: y * video.videoHeight,
        score,
      }
    })

    const visible = keypoints.filter(
      (point) => point.score >= KEYPOINT_SCORE_THRESHOLD,
    )

    if (visible.length < 4) {
      return null
    }

    const score =
      visible.reduce((sum, point) => sum + point.score, 0) / visible.length

    return { score, keypoints }
  } finally {
    output.dispose()
  }
}

export function disposeMoveNet(model: tf.GraphModel | null) {
  model?.dispose()
}
