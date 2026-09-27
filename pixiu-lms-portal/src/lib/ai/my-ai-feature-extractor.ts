import * as tf from "@tensorflow/tfjs"

export const MY_AI_FEATURE_VERSION = "vision-features-v4-local"
export const MY_AI_INPUT_SIZE = 224
export const MY_AI_FEATURE_SIZE = 512
export const MY_AI_PREDICTION_THRESHOLD = 0.62

const L2_EPSILON = 1e-12

// Shape contract:
// source pixels     [H, W, 3]
// batched image     [1, 224, 224, 3]
// feature vector    [1, 512]
// classifier input  [batch, 512]
let featureExtractorReady = false
let featureExtractorPromise: Promise<void> | null = null

function assertShape(tensor: tf.Tensor, expected: number[], label: string) {
  const actual = tensor.shape
  const matches =
    actual.length === expected.length &&
    expected.every((value, index) => value === -1 || actual[index] === value)

  if (!matches) {
    throw new Error(
      label +
        " shape mismatch. Expected [" +
        expected.join(", ") +
        "], got [" +
        actual.join(", ") +
        "].",
    )
  }
}

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

    const warmup = tf.zeros([
      1,
      MY_AI_INPUT_SIZE,
      MY_AI_INPUT_SIZE,
      3,
    ])
    const warmupMean = tf.mean(warmup)
    try {
      assertShape(
        warmup,
        [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3],
        "My AI warmup tensor",
      )
      await warmupMean.data()
    } finally {
      warmupMean.dispose()
      warmup.dispose()
    }

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
    assertShape(pixels, [-1, -1, 3], "Source image tensor")

    const batchedPixels = tf.expandDims(pixels, 0)
    assertShape(
      batchedPixels,
      [1, -1, -1, 3],
      "Batched source image tensor",
    )

    const normalized = tf.div(tf.cast(batchedPixels, "float32"), 255)
    const resized = tf.image.resizeBilinear(
      normalized,
      [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE],
      true,
    )
    assertShape(
      resized,
      [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3],
      "Resized image tensor",
    )

    const grayscale = tf.mean(resized, 3, true)
    assertShape(
      grayscale,
      [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 1],
      "Grayscale tensor",
    )

    const graySmall = tf.image.resizeBilinear(grayscale, [16, 16], true)
    const grayFeatures = tf.reshape(graySmall, [1, 256])
    assertShape(grayFeatures, [1, 256], "Grayscale feature vector")

    const rgbSmall = tf.image.resizeBilinear(resized, [8, 8], true)
    const rgbFeatures = tf.reshape(rgbSmall, [1, 192])
    assertShape(rgbFeatures, [1, 192], "RGB feature vector")

    const dx = tf.abs(
      tf.sub(
        grayscale.slice(
          [0, 0, 1, 0],
          [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE - 1, 1],
        ),
        grayscale.slice(
          [0, 0, 0, 0],
          [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE - 1, 1],
        ),
      ),
    )
    const dy = tf.abs(
      tf.sub(
        grayscale.slice(
          [0, 1, 0, 0],
          [1, MY_AI_INPUT_SIZE - 1, MY_AI_INPUT_SIZE, 1],
        ),
        grayscale.slice(
          [0, 0, 0, 0],
          [1, MY_AI_INPUT_SIZE - 1, MY_AI_INPUT_SIZE, 1],
        ),
      ),
    )
    assertShape(
      dx,
      [1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE - 1, 1],
      "Horizontal edge tensor",
    )
    assertShape(
      dy,
      [1, MY_AI_INPUT_SIZE - 1, MY_AI_INPUT_SIZE, 1],
      "Vertical edge tensor",
    )

    const dxSmall = tf.image.resizeBilinear(dx, [8, 8], true)
    const dySmall = tf.image.resizeBilinear(dy, [8, 8], true)
    const edgeFeatures = tf.reshape(tf.add(dxSmall, dySmall), [1, 64])
    assertShape(edgeFeatures, [1, 64], "Edge feature vector")

    const combined = tf.concat(
      [grayFeatures, rgbFeatures, edgeFeatures],
      1,
    )
    assertShape(combined, [1, MY_AI_FEATURE_SIZE], "Combined feature vector")

    const sumSquares = tf.sum(tf.square(combined), 1, true)
    const norm = tf.sqrt(
      tf.maximum(sumSquares, tf.scalar(L2_EPSILON)),
    )
    const normalizedFeatures = tf.div(combined, norm)
    assertShape(
      normalizedFeatures,
      [1, MY_AI_FEATURE_SIZE],
      "Normalized feature vector",
    )

    return normalizedFeatures
  })

  try {
    const values = await embedding.data()
    if (values.length !== MY_AI_FEATURE_SIZE) {
      throw new Error(
        "My AI feature-size mismatch. Expected " +
          MY_AI_FEATURE_SIZE +
          ", got " +
          values.length +
          ".",
      )
    }
    return Array.from(values)
  } finally {
    embedding.dispose()
  }
}

export function disposeMyAiFeatureExtractor() {
  featureExtractorReady = false
  featureExtractorPromise = null
}
