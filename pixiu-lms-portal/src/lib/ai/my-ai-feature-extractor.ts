import * as tf from "@tensorflow/tfjs"

export const MY_AI_FEATURE_VERSION = "vision-features-v3-native"
export const MY_AI_INPUT_SIZE = 224
export const MY_AI_PREDICTION_THRESHOLD = 0.62

// My AI intentionally does not depend on a remote pretrained model.
// The feature vector is computed locally in the browser from the user's image.
// This avoids model-download failures, external storage/CSP problems, and keeps
// training self-contained and predictable for classroom use.

let featureExtractorReady = false
let featureExtractorPromise: Promise<void> | null = null

async function ensureBackend() {
  await tf.ready()

  if (tf.getBackend() === "webgl") return

  try {
    await tf.setBackend("webgl")
    await tf.ready()
  } catch {
    await tf.setBackend("cpu")
    await tf.ready()
  }
}

export async function loadMyAiFeatureExtractor() {
  if (featureExtractorReady) return
  if (featureExtractorPromise) return featureExtractorPromise

  featureExtractorPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("My AI needs a browser runtime.")
    }

    await ensureBackend()

    // Warm up TensorFlow.js without downloading any external model.
    const warmup = tf.zeros([1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3])
    await warmup.mean().data()
    warmup.dispose()

    featureExtractorReady = true
  })()

  try {
    await featureExtractorPromise
  } finally {
    featureExtractorPromise = null
  }
}

export async function extractMyAiEmbedding(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData,
) {
  await loadMyAiFeatureExtractor()

  const embedding = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image)
    const normalized = tf.div(tf.cast(pixels, "float32"), 255)
    // Use resizeBilinear directly. resizeWithPad is not available in every
    // TensorFlow.js browser bundle and can fail at runtime after minification.
    const resized = tf.image.resizeBilinear(
      normalized,
      [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE],
      true,
    )

    // 256 dims: coarse luminance layout (16 × 16).
    const grayscale = resized.mean(2, true)
    const graySmall = tf.image.resizeBilinear(grayscale, [16, 16], true)
    const grayFeatures = tf.reshape(graySmall, [1, 256])

    // 192 dims: coarse RGB layout (8 × 8 × 3).
    const rgbSmall = tf.image.resizeBilinear(resized, [8, 8], true)
    const rgbFeatures = tf.reshape(rgbSmall, [1, 192])

    // 64 dims: edge/texture response at 8 × 8.
    // `resizeBilinear` returns a rank-3 H×W×C tensor here, so slice
    // coordinates must also be rank-3 (H, W, C), not rank-4.
    const dx = tf.abs(
      tf.sub(
        grayscale.slice(
          [0, 1, 0],
          [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE - 1, 1],
        ),
        grayscale.slice(
          [0, 0, 0],
          [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE - 1, 1],
        ),
      ),
    )
    const dy = tf.abs(
      tf.sub(
        grayscale.slice(
          [1, 0, 0],
          [MY_AI_INPUT_SIZE - 1, MY_AI_INPUT_SIZE, 1],
        ),
        grayscale.slice(
          [0, 0, 0],
          [MY_AI_INPUT_SIZE - 1, MY_AI_INPUT_SIZE, 1],
        ),
      ),
    )
    const dxSmall = tf.image.resizeBilinear(dx, [8, 8], true)
    const dySmall = tf.image.resizeBilinear(dy, [8, 8], true)
    const edgeFeatures = tf.reshape(tf.add(dxSmall, dySmall), [1, 64])

    return tf.linalg.l2Normalize(
      tf.concat([grayFeatures, rgbFeatures, edgeFeatures], 1),
      1,
    )
  })

  try {
    const values = await embedding.data()
    return Array.from(values)
  } finally {
    embedding.dispose()
  }
}

export function disposeMyAiFeatureExtractor() {
  featureExtractorReady = false
  featureExtractorPromise = null
}
