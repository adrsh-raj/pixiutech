import * as tf from "@tensorflow/tfjs"

export const MY_AI_FEATURE_VERSION = "vision-features-v2"
// Use the underlying TensorFlow.js-hosted artifact directly instead of the
// tfhub.dev landing URL. tfhub.dev currently redirects this model family to
// Kaggle, while the browser loader expects the TFJS model.json + shard layout.
export const MY_AI_FEATURE_URL =
  "https://storage.googleapis.com/tfhub-tfjs-modules/google/imagenet/mobilenet_v2_100_224/feature_vector/4/model.json"
export const MY_AI_INPUT_SIZE = 224
export const MY_AI_PREDICTION_THRESHOLD = 0.62

let featureModel: tf.GraphModel | null = null
let featureModelPromise: Promise<tf.GraphModel> | null = null

function firstTensor(output: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap) {
  if (output instanceof tf.Tensor) return output
  if (Array.isArray(output)) {
    if (!output[0]) throw new Error("My AI feature extractor returned no tensor.")
    return output[0]
  }
  const tensor = Object.values(output)[0]
  if (!tensor) throw new Error("My AI feature extractor returned no tensor.")
  return tensor
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
  if (featureModel) return featureModel
  if (featureModelPromise) return featureModelPromise

  featureModelPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("My AI needs a browser runtime.")
    }

    await ensureBackend()
    let model: tf.GraphModel
    try {
      model = await tf.loadGraphModel(MY_AI_FEATURE_URL)
    } catch (directError) {
      // Backward-compatible fallback for environments where the direct
      // storage endpoint is blocked by a network policy.
      try {
        model = await tf.loadGraphModel(
          "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/feature_vector/4",
          { fromTFHub: true },
        )
      } catch (fallbackError) {
        const directMessage =
          directError instanceof Error ? directError.message : String(directError)
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        throw new Error(
          "My AI model could not be downloaded. Direct TFJS model fetch failed (" +
            directMessage +
            "); TF Hub fallback failed (" +
            fallbackMessage +
            "). Check the browser network/CSP and allow storage.googleapis.com.",
        )
      }
    }

    const warmup = tf.zeros([1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3])
    const output = firstTensor(model.execute(warmup) as tf.Tensor)
    await output.data()
    output.dispose()
    warmup.dispose()

    featureModel = model
    return model
  })()

  try {
    return await featureModelPromise
  } finally {
    featureModelPromise = null
  }
}

export async function extractMyAiEmbedding(
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData,
) {
  const model = await loadMyAiFeatureExtractor()

  const embedding = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image)
    const normalized = tf.mul(tf.cast(pixels, "float32"), 1 / 255)
    const resized = tf.image.resizeWithPad(
      normalized,
      MY_AI_INPUT_SIZE,
      MY_AI_INPUT_SIZE,
    )
    const batched = tf.expandDims(resized, 0)
    const raw = firstTensor(model.execute(batched) as tf.Tensor)
    const flat = tf.reshape(raw, [1, -1])
    return tf.linalg.l2Normalize(flat, 1)
  })

  try {
    const values = await embedding.data()
    return Array.from(values)
  } finally {
    embedding.dispose()
  }
}

export function disposeMyAiFeatureExtractor() {
  featureModel?.dispose()
  featureModel = null
  featureModelPromise = null
}
