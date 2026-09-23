import * as tf from "@tensorflow/tfjs"

export type AiSample = {
  id: string
  label: string
  dataUrl: string
  createdAt: number
}

export type AiModelSummary = {
  id: string
  name: string
  classes: string[]
  sampleCount: number
  epochs: number
  trainAccuracy: number
  validationAccuracy: number
  createdAt: number
  inputShape: [number, number, number]
  storageKey: string
  architecture: string
}

export type AiStudioStore = {
  samples: AiSample[]
  model: AiModelSummary | null
}

const STORE_KEY = "pixiu-ai-studio-v2"
const MODEL_KEY = "pixiu-ai-studio-model-v2"
const LEGACY_STORE_KEY = "pixiu-ai-studio-v1"
const LEGACY_MODEL_KEY = "pixiu-ai-studio-model-v1"
const INPUT_W = 16
const INPUT_H = 16
const INPUT_C = 3

let activeModel: tf.LayersModel | null = null

function emptyStore(): AiStudioStore {
  return { samples: [], model: null }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function loadAiStudioStore(): AiStudioStore {
  if (typeof window === "undefined") return emptyStore()

  const current = safeParse<AiStudioStore>(
    window.localStorage.getItem(STORE_KEY),
    emptyStore(),
  )

  const samples = Array.isArray(current.samples)
    ? current.samples.filter(
        (sample) =>
          typeof sample?.id === "string" &&
          typeof sample?.label === "string" &&
          typeof sample?.dataUrl === "string",
      )
    : []

  return {
    samples,
    model: current.model?.storageKey === MODEL_KEY ? current.model : null,
  }
}

export function saveAiStudioStore(store: AiStudioStore) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
    window.localStorage.removeItem(LEGACY_STORE_KEY)
  } catch {
    // Dataset persistence is best-effort.
  }
}

export async function clearAiStudioStore() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORE_KEY)
    window.localStorage.removeItem(LEGACY_STORE_KEY)
  }

  await deleteStoredModel()
}

export function addAiSample(
  store: AiStudioStore,
  label: string,
  dataUrl: string,
): AiStudioStore {
  const cleanLabel = label.trim().slice(0, 32)
  if (!cleanLabel || !dataUrl) return store

  if (store.model) void deleteStoredModel()

  return {
    ...store,
    samples: [
      ...store.samples,
      {
        id: createId(),
        label: cleanLabel,
        dataUrl,
        createdAt: Date.now(),
      },
    ],
    model: null,
  }
}

export function removeAiSample(store: AiStudioStore, id: string): AiStudioStore {
  if (store.model) void deleteStoredModel()

  return {
    ...store,
    samples: store.samples.filter((sample) => sample.id !== id),
    model: null,
  }
}

export function getAiClasses(samples: AiSample[]) {
  return Array.from(
    new Set(samples.map((sample) => sample.label.trim()).filter(Boolean)),
  )
}

export function getSampleCounts(samples: AiSample[]) {
  return samples.reduce<Record<string, number>>((counts, sample) => {
    counts[sample.label] = (counts[sample.label] ?? 0) + 1
    return counts
  }, {})
}

export function getModelWeightShapes(model: tf.LayersModel | null): string[] {
  if (!model) return []

  return model.layers.flatMap((layer) =>
    layer.getWeights().map((weight) =>
      `${layer.name}: ${weight.shape.join(" × ")}`,
    ),
  )
}

export function getModelWeightPreview(model: tf.LayersModel | null): number[][] {
  if (!model) return []

  return model.layers.flatMap((layer) => {
    const first = layer.getWeights()[0]
    if (!first) return []
    return [Array.from(first.dataSync()).slice(0, 12).map((value) => Number(value.toFixed(3)))]
  })
}

export async function trainAiModel(
  samples: AiSample[],
  options: {
    epochs?: number
    onEpoch?: (epoch: number, total: number, accuracy: number, loss: number) => void
  } = {},
): Promise<{ model: tf.LayersModel; summary: AiModelSummary }> {
  const classes = getAiClasses(samples)
  const counts = getSampleCounts(samples)

  if (classes.length < 2) {
    throw new Error("Teach at least 2 concepts before training.")
  }

  if (classes.some((name) => (counts[name] ?? 0) < 3)) {
    throw new Error("Give every concept at least 3 examples.")
  }

  const shuffled = [...samples].sort(() => Math.random() - 0.5)
  const features: tf.Tensor4D[] = []
  const labels: number[] = []

  try {
    for (const sample of shuffled) {
      features.push(await imageToFeatureTensor(sample.dataUrl))
      labels.push(classes.indexOf(sample.label))
    }

    const xs = tf.concat(features, 0)
    const labelTensor = tf.tensor1d(labels, "int32")
    const ys = tf.oneHot(labelTensor, classes.length)
    labelTensor.dispose()

    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [INPUT_H, INPUT_W, INPUT_C],
          filters: 16,
          kernelSize: 3,
          padding: "same",
          activation: "relu",
        }),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.conv2d({
          filters: 24,
          kernelSize: 3,
          padding: "same",
          activation: "relu",
        }),
        tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 48, activation: "relu" }),
        tf.layers.dropout({ rate: 0.15 }),
        tf.layers.dense({ units: classes.length, activation: "softmax" }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    })

    const epochs = Math.max(8, Math.min(30, options.epochs ?? 18))
    let latestAccuracy = 0
    let latestValidation = 0
    let latestLoss = 0

    await model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(16, samples.length),
      shuffle: true,
      validationSplit: samples.length >= 15 ? 0.2 : 0,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          latestAccuracy = Number(logs?.accuracy ?? logs?.acc ?? 0)
          latestValidation = Number(
            logs?.val_accuracy ?? logs?.val_acc ?? latestAccuracy,
          )
          latestLoss = Number(logs?.loss ?? 0)
          options.onEpoch?.(epoch + 1, epochs, latestAccuracy, latestLoss)
          await tf.nextFrame()
        },
      },
    })

    const evaluation = model.evaluate(xs, ys) as tf.Scalar | tf.Scalar[]
    const values = Array.isArray(evaluation) ? evaluation : [evaluation]
    const trainAccuracy = values[1]
      ? Number((await values[1].data())[0])
      : latestAccuracy

    values.forEach((value) => value.dispose())
    xs.dispose()
    ys.dispose()
    features.forEach((feature) => feature.dispose())

    activeModel?.dispose()
    activeModel = model

    const summary: AiModelSummary = {
      id: createId(),
      name: `${classes.join(" vs ")} · Pixiu Mini Vision`,
      classes,
      sampleCount: samples.length,
      epochs,
      trainAccuracy: Math.round(trainAccuracy * 100),
      validationAccuracy: Math.round(
        (samples.length >= 15 ? latestValidation : trainAccuracy) * 100,
      ),
      createdAt: Date.now(),
      inputShape: [INPUT_H, INPUT_W, INPUT_C],
      storageKey: MODEL_KEY,
      architecture: "16×16 RGB → Conv2D → Pool → Conv2D → Pool → Dense → Softmax",
    }

    await model.save(`indexeddb://${MODEL_KEY}`)
    return { model, summary }
  } catch (error) {
    features.forEach((feature) => feature.dispose())
    throw error instanceof Error ? error : new Error("Training failed.")
  }
}

export async function loadStoredAiModel(
  summary: AiModelSummary | null,
): Promise<tf.LayersModel | null> {
  if (!summary || summary.storageKey !== MODEL_KEY) return null

  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`)
    const outputShape = model.outputs?.[0]?.shape
    const outputClasses = Number(outputShape?.[outputShape.length - 1] ?? 0)

    if (outputClasses !== summary.classes.length) {
      model.dispose()
      return null
    }

    activeModel?.dispose()
    activeModel = model
    return model
  } catch {
    return null
  }
}

export function getActiveAiModel() {
  return activeModel
}

export function disposeActiveAiModel() {
  activeModel?.dispose()
  activeModel = null
}

export async function deleteStoredModel() {
  for (const key of [MODEL_KEY, LEGACY_MODEL_KEY]) {
    try {
      await tf.io.removeModel(`indexeddb://${key}`)
    } catch {
      // Missing IndexedDB models are fine.
    }
  }

  activeModel?.dispose()
  activeModel = null
}

export async function predictAiImage(
  dataUrl: string,
  summary: AiModelSummary | null,
) {
  if (!summary || summary.storageKey !== MODEL_KEY) return null

  const model = activeModel ?? (await loadStoredAiModel(summary))
  if (!model) return null

  const feature = await imageToFeatureTensor(dataUrl)

  try {
    const output = model.predict(feature) as tf.Tensor
    const probabilities = Array.from(await output.data())
    const bestIndex = probabilities.indexOf(Math.max(...probabilities))

    output.dispose()

    return {
      label: summary.classes[bestIndex] ?? "unknown",
      confidence: Math.round((probabilities[bestIndex] ?? 0) * 100),
      probabilities: Object.fromEntries(
        summary.classes.map((name, index) => [
          name,
          Math.round((probabilities[index] ?? 0) * 100),
        ]),
      ),
    }
  } finally {
    feature.dispose()
  }
}

export function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.82)
}

async function imageToFeatureTensor(dataUrl: string): Promise<tf.Tensor4D> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = INPUT_W
  canvas.height = INPUT_H

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available in this browser.")

  context.drawImage(image, 0, 0, INPUT_W, INPUT_H)

  const pixels = context.getImageData(0, 0, INPUT_W, INPUT_H).data
  const values = new Float32Array(INPUT_W * INPUT_H * INPUT_C)

  let index = 0
  for (let pixel = 0; pixel < pixels.length; pixel += 4) {
    values[index++] = pixels[pixel] / 255
    values[index++] = pixels[pixel + 1] / 255
    values[index++] = pixels[pixel + 2] / 255
  }

  return tf.tensor4d(values, [1, INPUT_H, INPUT_W, INPUT_C])
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not read that image."))
    image.src = src
  })
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-${Math.random().toString(36).slice(2, 10)}`
}
