import * as tf from "@tensorflow/tfjs"

export const MY_AI_FEATURE_VERSION = "MobileNetV2-0.5"
export const MY_AI_FEATURE_URL =
  "https://tfhub.dev/google/imagenet/mobilenet_v2_050_224/classification/2"
export const MY_AI_EMBEDDING_NODE =
  "module_apply_default/MobilenetV2/Logits/AvgPool"
export const MY_AI_INPUT_SIZE = 224
export const MY_AI_PREDICTION_THRESHOLD = 0.55

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
    const model = await tf.loadGraphModel(MY_AI_FEATURE_URL, { fromTFHub: true })

    const warmup = tf.zeros([1, MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3])
    const output = firstTensor(
      model.execute(warmup, MY_AI_EMBEDDING_NODE) as tf.Tensor,
    )
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
    const resized = tf.image.resizeBilinear(
      normalized,
      [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE],
      true,
    )
    const batched = tf.expandDims(resized, 0)
    const raw = model.execute(batched, MY_AI_EMBEDDING_NODE) as tf.Tensor4D
    return tf.reshape(raw, [1, -1])
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
