"use client"

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
}

export type AiStudioStore = {
  samples: AiSample[]
  model: AiModelSummary | null
}

const STORE_KEY = "pixiu-ai-studio-v1"
const MODEL_KEY = "pixiu-ai-studio-model-v1"
const INPUT_W = 8
const INPUT_H = 8
const INPUT_C = 3

let activeModel: tf.LayersModel | null = null

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function loadAiStudioStore(): AiStudioStore {
  if (typeof window === "undefined") return { samples: [], model: null }
  const store = safeParse<AiStudioStore>(window.localStorage.getItem(STORE_KEY), { samples: [], model: null })
  return {
    samples: Array.isArray(store.samples) ? store.samples : [],
    model: store.model ?? null,
  }
}

export function saveAiStudioStore(store: AiStudioStore) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch (error) {
    console.warn("Pixiu AI dataset could not be saved locally:", error)
  }
}

export function clearAiStudioStore() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORE_KEY)
  }
  void deleteStoredModel()
}

export function addAiSample(store: AiStudioStore, label: string, dataUrl: string): AiStudioStore {
  const cleanLabel = label.trim().slice(0, 32)
  if (!cleanLabel || !dataUrl) return store
  const sample: AiSample = {
    id: createId(),
    label: cleanLabel,
    dataUrl,
    createdAt: Date.now(),
  }
  return { ...store, samples: [...store.samples, sample] }
}

export function removeAiSample(store: AiStudioStore, id: string): AiStudioStore {
  return { ...store, samples: store.samples.filter((sample) => sample.id !== id) }
}

export function getAiClasses(samples: AiSample[]): string[] {
  return Array.from(new Set(samples.map((sample) => sample.label.trim()).filter(Boolean)))
}

export function getSampleCounts(samples: AiSample[]): Record<string, number> {
  return samples.reduce<Record<string, number>>((counts, sample) => {
    counts[sample.label] = (counts[sample.label] ?? 0) + 1
    return counts
  }, {})
}

export function getModelWeightShapes(model: tf.LayersModel | null): string[] {
  if (!model) return []
  return model.layers.flatMap((layer) =>
    layer.getWeights().map((weight) => {
      const dims = weight.shape.join(" × ")
      return `${layer.name}: ${dims}`
    }),
  )
}

export function getModelWeightPreview(model: tf.LayersModel | null): number[][] {
  if (!model) return []
  return model.layers.flatMap((layer) => {
    const first = layer.getWeights()[0]
    if (!first) return []
    const values = Array.from(first.dataSync()).slice(0, 12)
    return [values.map((value) => Number(value.toFixed(3)))]
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
  const byClass = getSampleCounts(samples)

  if (classes.length < 2) {
    throw new Error("Teach at least 2 concepts before training the AI.")
  }

  if (classes.some((name) => (byClass[name] ?? 0) < 2)) {
    throw new Error("Give every concept at least 2 examples so the model can learn a pattern.")
  }

  const shuffled = [...samples].sort(() => Math.random() - 0.5)
  const features: tf.Tensor[] = []
  const labels: number[] = []

  try {
    for (const sample of shuffled) {
      features.push(await imageToFeatureTensor(sample.dataUrl))
      labels.push(classes.indexOf(sample.label))
    }

    const xs = tf.stack(features)
    const ys = tf.oneHot(tf.tensor1d(labels, "int32"), classes.length)

    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [INPUT_W * INPUT_H * INPUT_C],
          units: 32,
          activation: "relu",
          name: "pattern-detector",
        }),
        tf.layers.dense({
          units: 16,
          activation: "relu",
          name: "feature-layer",
        }),
        tf.layers.dense({
          units: classes.length,
          activation: "softmax",
          name: "decision-layer",
        }),
      ],
    })

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: "categoricalCrossentropy",
      metrics: ["accuracy"],
    })

    const epochs = Math.max(5, Math.min(30, options.epochs ?? 18))
    let latestAccuracy = 0
    let latestLoss = 0

    await model.fit(xs, ys, {
      epochs,
      batchSize: Math.min(8, samples.length),
      shuffle: true,
      validationSplit: samples.length >= 12 ? 0.2 : 0,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          latestAccuracy = Number(logs?.acc ?? logs?.accuracy ?? 0)
          latestLoss = Number(logs?.loss ?? 0)
          options.onEpoch?.(epoch + 1, epochs, latestAccuracy, latestLoss)
          await tf.nextFrame()
        },
      },
    })

    const evaluation = model.evaluate(xs, ys) as tf.Scalar | tf.Scalar[]
    const evalItems = Array.isArray(evaluation) ? evaluation : [evaluation]
    const trainLoss = Number((await evalItems[0].data())[0])
    const trainAccuracy = evalItems[1] ? Number((await evalItems[1].data())[0]) : latestAccuracy
    evalItems.forEach((item) => item.dispose())

    xs.dispose()
    ys.dispose()
    features.forEach((tensor) => tensor.dispose())

    activeModel?.dispose()
    activeModel = model

    const summary: AiModelSummary = {
      id: createId(),
      name: `${classes.join(" vs ")} · Mini Vision`,
      classes,
      sampleCount: samples.length,
      epochs,
      trainAccuracy: Math.round(trainAccuracy * 100),
      validationAccuracy: Math.round((samples.length >= 12 ? latestAccuracy : trainAccuracy) * 100),
      createdAt: Date.now(),
      inputShape: [INPUT_H, INPUT_W, INPUT_C],
      storageKey: MODEL_KEY,
    }

    try {
      await model.save(`indexeddb://${MODEL_KEY}`)
    } catch (error) {
      console.warn("Pixiu AI model could not be persisted to IndexedDB:", error)
    }

    return { model, summary }
  } catch (error) {
    features.forEach((tensor) => tensor.dispose())
    throw error
  } finally {
  }
}

export async function loadStoredAiModel(summary: AiModelSummary | null): Promise<tf.LayersModel | null> {
  if (!summary) return null
  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`)
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

export async function deleteStoredModel() {
  try {
    await tf.io.removeModel(`indexeddb://${MODEL_KEY}`)
  } catch {
    // Nothing to remove.
  }
  activeModel?.dispose()
  activeModel = null
}

export async function predictAiImage(
  dataUrl: string,
  summary: AiModelSummary | null,
): Promise<{ label: string; confidence: number; probabilities: Record<string, number> } | null> {
  if (!summary) return null
  const model = activeModel ?? (await loadStoredAiModel(summary))
  if (!model) return null

  const feature = await imageToFeatureTensor(dataUrl)
  try {
    const output = model.predict(feature) as tf.Tensor
    const probabilities = Array.from(await output.data())
    const bestIndex = probabilities.indexOf(Math.max(...probabilities))
    const result = {
      label: summary.classes[bestIndex] ?? "unknown",
      confidence: Math.round((probabilities[bestIndex] ?? 0) * 100),
      probabilities: Object.fromEntries(
        summary.classes.map((name, index) => [name, Math.round((probabilities[index] ?? 0) * 100)]),
      ),
    }
    output.dispose()
    return result
  } finally {
    feature.dispose()
  }
}

export async function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  return canvas.toDataURL("image/jpeg", 0.72)
}

async function imageToFeatureTensor(dataUrl: string): Promise<tf.Tensor2D> {
  const image = await loadImage(dataUrl)
  const canvas = document.createElement("canvas")
  canvas.width = INPUT_W
  canvas.height = INPUT_H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is not available in this browser.")

  ctx.drawImage(image, 0, 0, INPUT_W, INPUT_H)
  const pixels = ctx.getImageData(0, 0, INPUT_W, INPUT_H).data
  const values = new Float32Array(INPUT_W * INPUT_H * INPUT_C)

  let i = 0
  for (let p = 0; p < pixels.length; p += 4) {
    values[i++] = pixels[p] / 255
    values[i++] = pixels[p + 1] / 255
    values[i++] = pixels[p + 2] / 255
  }

  return tf.tensor2d(values, [1, INPUT_W * INPUT_H * INPUT_C])
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
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
