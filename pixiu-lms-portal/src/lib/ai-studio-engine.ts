import * as tf from "@tensorflow/tfjs"
import { AIDatasetError, AIModelShapeError } from "@/lib/ai/ai-errors"
import {
  disposeMyAiFeatureExtractor,
  extractMyAiEmbedding,
  loadMyAiFeatureExtractor,
  MY_AI_FEATURE_VERSION,
  MY_AI_INPUT_SIZE,
  MY_AI_FEATURE_SIZE,
  MY_AI_PREDICTION_THRESHOLD,
} from "./ai/my-ai-feature-extractor"

// Standard feature contract: MY_AI_FEATURE_SIZE = 512
export { MY_AI_FEATURE_SIZE }

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
  imageInputShape: [number, number, number]
  featureShape: [number]
  modelInputShape: [number]
  outputShape: [number]
  embeddingSize: number
  classCount: number
  featureExtractor: string
  storageKey: string
  classPrototypes?: Record<string, number[]>
  architecture: string
  predictionThreshold: number
  confidenceCalibration: string
  trainingProfile?: AiTrainingProfile
  hiddenLayers?: number
  hiddenUnits?: number
  dropoutRate?: number
  learningRate?: number
  batchSize?: number
  earlyStoppingPatience?: number
  earlyStoppingMinDelta?: number
  earlyStopped?: boolean
  bestEpoch?: number
  parameterCount?: number
  layerSpecs?: AiLayerSpec[]
  trainingHistory?: AiTrainingHistoryPoint[]
  validationAvailable?: boolean
  generalizationGap?: number
  validationConfusionMatrix?: number[][]
}

export type AiStudioStore = {
  classes: string[]
  samples: AiSample[]
  model: AiModelSummary | null
}

export type AiDatasetStats = {
  classCount: number
  sampleCount: number
  minSamples: number
  maxSamples: number
  averageSamples: number
  ready: boolean
  balanced: boolean
  recommended: boolean
}

const STORE_KEY = "pixiu-ai-studio-v4"
const MODEL_KEY = "pixiu-ai-studio-model-v4"
const LEGACY_STORE_KEYS = ["pixiu-ai-studio-v3", "pixiu-ai-studio-v2", "pixiu-ai-studio-v1"]
const LEGACY_MODEL_KEYS = [
  "pixiu-ai-studio-model-v3",
  "pixiu-ai-studio-model-v2",
  "pixiu-ai-studio-model-v1",
]

export const MIN_CLASSES = 2
export const MIN_SAMPLES_PER_CLASS = 3
export const RECOMMENDED_SAMPLES_PER_CLASS = 8
export const MAX_CLASSES = 8
export const MAX_SAMPLES_PER_CLASS = 20
export const MAX_TOTAL_SAMPLES = 80
export const MY_AI_SAMPLE_MAX_SIZE = 384
export const MY_AI_SAMPLE_JPEG_QUALITY = 0.62
export const MY_AI_LOW_MARGIN_THRESHOLD = 0.08
// Conservative soft ceiling for localStorage JSON. This prevents a browser
// quota failure from silently turning a large dataset into an ephemeral state.
export const AI_DATASET_STORAGE_SOFT_LIMIT_BYTES = 4_000_000
export const MAX_CONFIGURABLE_LAYERS = 8

export type AiLayerType = "dense" | "batchNormalization" | "dropout" | "activation"

export type AiLayerSpec = {
  type: AiLayerType
  units?: number
  activation?: "relu" | "linear" | "tanh" | "sigmoid"
  rate?: number
}

export type AiTrainingHistoryPoint = {
  epoch: number
  loss: number
  accuracy: number
  valLoss: number | null
  valAccuracy: number | null
  elapsedMs: number
}

export type AiTrainingProfile = "grade6" | "grade7" | "grade8" | "custom"

export type AiTrainingConfig = {
  epochs: number
  layers: AiLayerSpec[]
  learningRate: number
  batchSize: number
  earlyStoppingPatience: number
  earlyStoppingMinDelta: number
}

export const AI_TRAINING_PROFILES: Record<Exclude<AiTrainingProfile, "custom">, AiTrainingConfig> = {
  grade6: { epochs: 20, layers: [{ type: "dense", units: 64, activation: "relu" }, { type: "dropout", rate: 0.15 }], learningRate: 0.001, batchSize: 8, earlyStoppingPatience: 6, earlyStoppingMinDelta: 0.001 },
  grade7: { epochs: 35, layers: [{ type: "dense", units: 96, activation: "relu" }, { type: "batchNormalization" }, { type: "dropout", rate: 0.2 }, { type: "dense", units: 64, activation: "relu" }, { type: "dropout", rate: 0.2 }], learningRate: 0.001, batchSize: 8, earlyStoppingPatience: 8, earlyStoppingMinDelta: 0.001 },
  grade8: { epochs: 50, layers: [{ type: "dense", units: 128, activation: "relu" }, { type: "batchNormalization" }, { type: "dropout", rate: 0.2 }, { type: "dense", units: 96, activation: "relu" }, { type: "dropout", rate: 0.2 }], learningRate: 0.0008, batchSize: 8, earlyStoppingPatience: 10, earlyStoppingMinDelta: 0.001 },
}

function finiteNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function safeActivation(value: unknown): AiLayerSpec["activation"] {
  return value === "relu" || value === "linear" || value === "tanh" || value === "sigmoid"
    ? value
    : "relu"
}

function sanitizeLayerSpecs(specs: AiLayerSpec[] | undefined): AiLayerSpec[] {
  return (Array.isArray(specs) ? specs : []).slice(0, MAX_CONFIGURABLE_LAYERS).map((spec) => {
    if (spec.type === "dense") {
      return {
        type: "dense",
        units: Math.max(16, Math.min(256, Math.round(finiteNumber(spec.units, 64)))),
        activation: safeActivation(spec.activation),
      }
    }
    if (spec.type === "dropout") {
      return {
        type: "dropout",
        rate: Math.max(0, Math.min(0.5, finiteNumber(spec.rate, 0.2))),
      }
    }
    if (spec.type === "activation") {
      return { type: "activation", activation: safeActivation(spec.activation) }
    }
    return { type: "batchNormalization" }
  })
}

export function estimateTrainingLoad(
  specs: AiLayerSpec[],
  classCount: number,
  inputSize = MY_AI_FEATURE_SIZE,
  epochs = 20,
  sampleCount = 1,
  batchSize = 8,
) {
  let previousUnits = Math.max(1, Math.round(inputSize))
  let parameters = 0

  for (const spec of sanitizeLayerSpecs(specs)) {
    if (spec.type === "dense") {
      const units = spec.units ?? 64
      parameters += previousUnits * units + units
      previousUnits = units
    } else if (spec.type === "batchNormalization") {
      parameters += previousUnits * 4
    }
  }

  const outputs = Math.max(2, classCount)
  parameters += previousUnits * outputs + outputs

  const safeSamples = Math.max(1, Math.round(sampleCount))
  const safeBatchSize = Math.max(1, Math.round(batchSize))
  const stepsPerEpoch = Math.max(1, Math.ceil(safeSamples / safeBatchSize))
  const workUnits =
    parameters * Math.max(1, Math.round(epochs)) * stepsPerEpoch

  const label =
    parameters > 750_000 || workUnits > 60_000_000
      ? "High"
      : parameters > 250_000 || workUnits > 20_000_000
        ? "Medium"
        : "Light"

  return {
    parameters: Math.round(parameters),
    stepsPerEpoch,
    workUnits: Math.round(workUnits),
    label,
    warning:
      label === "High"
        ? "This setup may feel slow on lower-end devices. Reduce units, layers, epochs, or batch size if needed."
        : label === "Medium"
          ? "Training stays browser-local; longer runs may use more CPU/GPU time."
          : null,
  }
}

function clampTrainingConfig(options: TrainOptions = {}): AiTrainingConfig {
  const fallback = AI_TRAINING_PROFILES.grade7
  return {
    epochs: Math.max(8, Math.min(150, Math.round(finiteNumber(options.epochs, fallback.epochs)))),
    layers: sanitizeLayerSpecs(options.layers ?? fallback.layers),
    learningRate: Math.max(0.0001, Math.min(0.01, finiteNumber(options.learningRate, fallback.learningRate))),
    batchSize: Math.max(2, Math.min(32, Math.round(finiteNumber(options.batchSize, fallback.batchSize)))),
    earlyStoppingPatience: Math.max(2, Math.min(20, Math.round(finiteNumber(options.earlyStoppingPatience, fallback.earlyStoppingPatience)))),
    earlyStoppingMinDelta: Math.max(0.0001, Math.min(0.05, finiteNumber(options.earlyStoppingMinDelta, fallback.earlyStoppingMinDelta))),
  }
}

let activeModel: tf.LayersModel | null = null
let modelStorageQueue: Promise<void> = Promise.resolve()

function emptyStore(): AiStudioStore {
  return { classes: [], samples: [], model: null }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeLabel(label: string) {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32)
}

export function isCompatibleModelSummary(summary: unknown): summary is AiModelSummary {
  if (!summary || typeof summary !== "object") return false
  const candidate = summary as Partial<AiModelSummary>
  if (
    candidate.storageKey !== MODEL_KEY ||
    candidate.featureExtractor !== MY_AI_FEATURE_VERSION ||
    candidate.embeddingSize !== MY_AI_FEATURE_SIZE ||
    !Array.isArray(candidate.classes) ||
    candidate.classes.length < MIN_CLASSES ||
    candidate.classes.length > MAX_CLASSES ||
    !Array.isArray(candidate.featureShape) ||
    candidate.featureShape.length !== 1 ||
    candidate.featureShape[0] !== MY_AI_FEATURE_SIZE ||
    !Array.isArray(candidate.modelInputShape) ||
    candidate.modelInputShape.length !== 1 ||
    candidate.modelInputShape[0] !== MY_AI_FEATURE_SIZE ||
    !Array.isArray(candidate.outputShape) ||
    candidate.outputShape.length !== 1 ||
    candidate.outputShape[0] !== candidate.classes.length ||
    candidate.classCount !== candidate.classes.length ||
    new Set(candidate.classes.map((value) => String(value).trim().toLowerCase())).size !== candidate.classes.length ||
    !candidate.classPrototypes ||
    typeof candidate.classPrototypes !== "object"
  ) return false

  return candidate.classes.every((className) => {
    const prototype = candidate.classPrototypes?.[className]
    return (
      Array.isArray(prototype) &&
      prototype.length === MY_AI_FEATURE_SIZE &&
      prototype.every((value) => Number.isFinite(Number(value)))
    )
  })
}

function uniqueClasses(values: unknown) {
  const output: string[] = []
  const seen = new Set<string>()

  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") continue
    const label = normalizeLabel(value)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    output.push(label)
  }

  return output.slice(0, MAX_CLASSES)
}

function validSamples(value: unknown): AiSample[] {
  if (!Array.isArray(value)) return []

  return value.filter((sample): sample is AiSample => {
    if (!sample || typeof sample !== "object") return false
    const candidate = sample as Partial<AiSample>
    return (
      typeof candidate.id === "string" &&
      typeof candidate.label === "string" &&
      typeof candidate.dataUrl === "string" &&
      candidate.dataUrl.startsWith("data:image/") &&
      typeof candidate.createdAt === "number"
    )
  })
}

export function loadAiStudioStore(): AiStudioStore {
  if (typeof window === "undefined") return emptyStore()

  const current = safeParse<Partial<AiStudioStore>>(
    window.localStorage.getItem(STORE_KEY),
    {},
  )

  let source = current
  if (!Array.isArray(source.classes) || !Array.isArray(source.samples)) {
    for (const legacyKey of LEGACY_STORE_KEYS) {
      const legacy = safeParse<Partial<AiStudioStore>>(
        window.localStorage.getItem(legacyKey),
        {},
      )
      if (Array.isArray(legacy.samples)) {
        source = legacy
        break
      }
    }
  }

  const samples = validSamples(source.samples).slice(-MAX_TOTAL_SAMPLES)
  const classes = uniqueClasses(
    Array.isArray(source.classes) && source.classes.length
      ? source.classes
      : samples.map((sample) => sample.label),
  )

  const known = new Set(classes.map((name) => name.toLowerCase()))
  for (const sample of samples) {
    const label = normalizeLabel(sample.label)
    if (label && !known.has(label.toLowerCase()) && classes.length < MAX_CLASSES) {
      classes.push(label)
      known.add(label.toLowerCase())
    }
  }

  return {
    classes,
    samples: samples.filter((sample) =>
      classes.some((name) => name.toLowerCase() === normalizeLabel(sample.label).toLowerCase()),
    ),
    model: isCompatibleModelSummary(source.model) ? source.model : null,
  }
}

export function saveAiStudioStore(store: AiStudioStore) {
  if (typeof window === "undefined") return false

  try {
    const serialized = JSON.stringify({
      classes: uniqueClasses(store.classes),
      samples: store.samples.slice(-MAX_TOTAL_SAMPLES),
      model: store.model,
    })

    if (serialized.length > AI_DATASET_STORAGE_SOFT_LIMIT_BYTES) {
      console.warn(
        "PIXIU My AI dataset is too large for the localStorage safety ceiling.",
      )
      return false
    }

    window.localStorage.setItem(STORE_KEY, serialized)
    for (const key of LEGACY_STORE_KEYS) {
      window.localStorage.removeItem(key)
    }
    return true
  } catch {
    // Dataset persistence is best-effort. The active React state remains usable.
    return false
  }
}

export async function clearAiStudioStore() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORE_KEY)
    for (const key of LEGACY_STORE_KEYS) {
      window.localStorage.removeItem(key)
    }
  }

  await queueModelOperation(() => deleteStoredModel())
}

function queueModelOperation(operation: () => Promise<void>) {
  modelStorageQueue = modelStorageQueue
    .catch(() => undefined)
    .then(operation)
  return modelStorageQueue
}

function invalidateStoredModel() {
  void queueModelOperation(() => deleteStoredModel())
}

export function addAiClass(store: AiStudioStore, label: string): AiStudioStore {
  const cleanLabel = normalizeLabel(label)
  if (!cleanLabel) return store
  if (store.classes.some((name) => name.toLowerCase() === cleanLabel.toLowerCase())) {
    return store
  }
  if (store.classes.length >= MAX_CLASSES) return store

  invalidateStoredModel()
  return {
    ...store,
    classes: [...store.classes, cleanLabel],
    model: null,
  }
}

export function renameAiClass(
  store: AiStudioStore,
  currentName: string,
  nextName: string,
): AiStudioStore {
  const cleanNext = normalizeLabel(nextName)
  if (!cleanNext) return store

  const duplicate = store.classes.some(
    (name) =>
      name !== currentName &&
      name.toLowerCase() === cleanNext.toLowerCase(),
  )
  if (duplicate) return store

  const exists = store.classes.some((name) => name === currentName)
  if (!exists) return store

  invalidateStoredModel()
  return {
    ...store,
    classes: store.classes.map((name) =>
      name === currentName ? cleanNext : name,
    ),
    samples: store.samples.map((sample) =>
      sample.label === currentName ? { ...sample, label: cleanNext } : sample,
    ),
    model: null,
  }
}

export function removeAiClass(store: AiStudioStore, className: string): AiStudioStore {
  if (!store.classes.includes(className)) return store

  invalidateStoredModel()
  return {
    ...store,
    classes: store.classes.filter((name) => name !== className),
    samples: store.samples.filter((sample) => sample.label !== className),
    model: null,
  }
}

export function getAiClasses(source: AiStudioStore | AiSample[]) {
  if (Array.isArray(source)) {
    return uniqueClasses(source.map((sample) => sample.label))
  }
  return uniqueClasses(source.classes)
}

export function getSampleCounts(samples: AiSample[]) {
  return samples.reduce<Record<string, number>>((counts, sample) => {
    counts[sample.label] = (counts[sample.label] ?? 0) + 1
    return counts
  }, {})
}

export function getAiDatasetStats(store: AiStudioStore): AiDatasetStats {
  const classes = getAiClasses(store)
  const counts = getSampleCounts(store.samples)
  const values = classes.map((name) => counts[name] ?? 0)
  const minSamples = values.length ? Math.min(...values) : 0
  const maxSamples = values.length ? Math.max(...values) : 0
  const sampleCount = store.samples.length
  const averageSamples = classes.length ? sampleCount / classes.length : 0

  return {
    classCount: classes.length,
    sampleCount,
    minSamples,
    maxSamples,
    averageSamples,
    ready:
      classes.length >= MIN_CLASSES &&
      minSamples >= MIN_SAMPLES_PER_CLASS,
    balanced:
      classes.length >= MIN_CLASSES &&
      maxSamples - minSamples <= Math.max(2, Math.ceil(maxSamples * 0.35)),
    recommended:
      classes.length >= MIN_CLASSES &&
      minSamples >= RECOMMENDED_SAMPLES_PER_CLASS,
  }
}

export function getSampleAddError(
  store: AiStudioStore,
  label: string,
): string | null {
  const cleanLabel = normalizeLabel(label)
  if (!cleanLabel) return "Enter a concept name first."

  const classExists = store.classes.some(
    (name) => name.toLowerCase() === cleanLabel.toLowerCase(),
  )

  if (!classExists && store.classes.length >= MAX_CLASSES) {
    return "Maximum 8 concepts reached."
  }
  if (store.samples.length >= MAX_TOTAL_SAMPLES) {
    return "Dataset limit reached. Remove a sample before adding another."
  }

  const existingLabel =
    store.classes.find((name) => name.toLowerCase() === cleanLabel.toLowerCase()) ??
    cleanLabel
  const count = store.samples.filter((sample) => sample.label === existingLabel).length
  if (count >= MAX_SAMPLES_PER_CLASS) {
    return "This concept already has 20 examples. Keep the dataset focused."
  }

  return null
}

export function addAiSample(
  store: AiStudioStore,
  label: string,
  dataUrl: string,
): AiStudioStore {
  const cleanLabel = normalizeLabel(label)
  if (!cleanLabel || !dataUrl.startsWith("data:image/")) return store

  const existingName =
    store.classes.find((name) => name.toLowerCase() === cleanLabel.toLowerCase()) ??
    cleanLabel
  const error = getSampleAddError(store, existingName)
  if (error) return store

  const nextStore = store.classes.some(
    (name) => name.toLowerCase() === existingName.toLowerCase(),
  )
    ? store
    : { ...store, classes: [...store.classes, existingName] }

  if (
    nextStore.samples.some(
      (sample) => sample.label === existingName && sample.dataUrl === dataUrl,
    )
  ) {
    return nextStore
  }

  invalidateStoredModel()

  return {
    ...nextStore,
    samples: [
      ...nextStore.samples,
      {
        id: createId(),
        label: existingName,
        dataUrl,
        createdAt: Date.now(),
      },
    ],
    model: null,
  }
}

export function removeAiSample(store: AiStudioStore, id: string): AiStudioStore {
  if (!store.samples.some((sample) => sample.id === id)) return store

  invalidateStoredModel()
  return {
    ...store,
    samples: store.samples.filter((sample) => sample.id !== id),
    model: null,
  }
}

export async function optimizeAiImage(
  dataUrl: string,
  maxSize = MY_AI_SAMPLE_MAX_SIZE,
  quality = MY_AI_SAMPLE_JPEG_QUALITY,
): Promise<string> {
  const image = await loadImage(dataUrl)
  const longest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  const scale = longest > maxSize ? maxSize / longest : 1

  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available in this browser.")

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas.toDataURL("image/jpeg", quality)
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
    return [
      Array.from(first.dataSync())
        .slice(0, 12)
        .map((value) => Number(value.toFixed(3))),
    ]
  })
}

type TrainOptions = {
  epochs?: number
  layers?: AiLayerSpec[]
  learningRate?: number
  batchSize?: number
  earlyStoppingPatience?: number
  earlyStoppingMinDelta?: number
  profile?: AiTrainingProfile
  onEpoch?: (point: AiTrainingHistoryPoint) => void
  onStage?: (stage: string) => void
  shouldCancel?: () => boolean
}

function shuffle<T>(items: T[]) {
  const output = [...items]
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[output[index], output[swapIndex]] = [output[swapIndex], output[index]]
  }
  return output
}

function buildValidationSplit(samples: AiSample[], classes: string[]) {
  const useValidation =
    samples.length >= 15 &&
    classes.every(
      (className) =>
        samples.filter((sample) => sample.label === className).length >= 5,
    )

  if (!useValidation) {
    return {
      train: samples,
      validation: [] as AiSample[],
    }
  }

  const train: AiSample[] = []
  const validation: AiSample[] = []

  for (const className of classes) {
    const classSamples = shuffle(
      samples.filter((sample) => sample.label === className),
    )
    const validationCount = Math.max(1, Math.floor(classSamples.length * 0.2))
    validation.push(...classSamples.slice(0, validationCount))
    train.push(...classSamples.slice(validationCount))
  }

  return { train: shuffle(train), validation: shuffle(validation) }
}

function augmentImageForTraining(
  image: HTMLImageElement,
  variant: number,
): HTMLCanvasElement {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available in this browser.")

  const zoom = variant === 0 ? 1.06 : 0.95
  const offsetX = variant === 0 ? width * 0.02 : -width * 0.015
  const offsetY = variant === 0 ? -height * 0.015 : height * 0.015
  context.filter = variant === 0
    ? "brightness(1.06) contrast(1.03)"
    : "brightness(0.94) contrast(1.03)"
  context.translate(width / 2 + offsetX, height / 2 + offsetY)
  context.scale(zoom, zoom)
  context.drawImage(image, -width / 2, -height / 2, width, height)
  return canvas
}

function normalizeVector(values: number[]) {
  let sumSquares = 0
  for (const value of values) {
    const safe = Number.isFinite(value) ? value : 0
    sumSquares += safe * safe
  }
  const norm = Math.sqrt(sumSquares) || 1
  return values.map((value) => (Number.isFinite(value) ? value : 0) / norm)
}

function buildClassPrototypes(
  features: number[][],
  labels: number[],
  classes: string[],
) {
  const prototypes: Record<string, number[]> = {}
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const classFeatures = features.filter((_, index) => labels[index] === classIndex)
    if (!classFeatures.length) continue
    const mean = new Array(classFeatures[0].length).fill(0)
    for (const vector of classFeatures) {
      for (let i = 0; i < vector.length; i += 1) mean[i] += vector[i]
    }
    for (let i = 0; i < mean.length; i += 1) mean[i] /= classFeatures.length
    prototypes[classes[classIndex]] = normalizeVector(mean)
  }
  return prototypes
}

function cosineSimilarity(a: number[], b: number[]) {
  const size = Math.min(a.length, b.length)
  let score = 0
  for (let i = 0; i < size; i += 1) score += a[i] * b[i]
  return Math.max(-1, Math.min(1, Number.isFinite(score) ? score : 0))
}

function softmaxScores(scores: number[], temperature = 0.12) {
  if (!scores.length) return []
  const logits = scores.map((score) => score / temperature)
  const maxLogit = Math.max(...logits)
  const exps = logits.map((value) => Math.exp(value - maxLogit))
  const total = exps.reduce((sum, value) => sum + value, 0) || 1
  return exps.map((value) => value / total)
}

async function extractFeatures(
  samples: AiSample[],
  options: TrainOptions,
  augment = false,
): Promise<{ features: number[][]; size: number }> {
  await loadMyAiFeatureExtractor()
  const features: number[][] = []
  let embeddingSize = 0

  for (let index = 0; index < samples.length; index += 1) {
    if (options.shouldCancel?.()) {
      throw new Error("Training cancelled.")
    }

    const image = await loadImage(samples[index].dataUrl)
    const sources: Array<HTMLImageElement | HTMLCanvasElement> =
      augment && samples.length <= 32
        ? [image, augmentImageForTraining(image, index % 2)]
        : [image]

    for (const source of sources) {
      const embedding = await extractMyAiEmbedding(source)
      if (embedding.length !== MY_AI_FEATURE_SIZE) {
        throw new Error(
          "My AI feature-size contract mismatch. Expected " +
            MY_AI_FEATURE_SIZE +
            ", got " +
            embedding.length +
            ".",
        )
      }
      if (embedding.some((value) => !Number.isFinite(value))) {
        throw new Error("My AI feature extractor returned a non-finite embedding.")
      }
      if (!embeddingSize) embeddingSize = embedding.length
      if (embedding.length !== embeddingSize) {
        throw new Error("My AI returned inconsistent feature sizes.")
      }
      features.push(embedding)
    }

    options.onStage?.(`Learning visual patterns · ${index + 1}/${samples.length}`)
    await tf.nextFrame()
  }

  return { features, size: embeddingSize }
}

function buildTrainableLayers(
  inputSize: number,
  classCount: number,
  specs: AiLayerSpec[],
) {
  const layers: tf.layers.Layer[] = [
    tf.layers.inputLayer({
      inputShape: [inputSize],
      name: "my-ai-input",
    }),
  ]

  for (const spec of sanitizeLayerSpecs(specs)) {
    if (spec.type === "dense") {
      layers.push(
        tf.layers.dense({
          units: spec.units ?? 64,
          activation: spec.activation ?? "relu",
          kernelRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
        }),
      )
    } else if (spec.type === "batchNormalization") {
      layers.push(tf.layers.batchNormalization())
    } else if (spec.type === "dropout") {
      layers.push(tf.layers.dropout({ rate: spec.rate ?? 0.2 }))
    } else {
      layers.push(
        tf.layers.activation({
          activation: spec.activation ?? "relu",
        }),
      )
    }
  }

  layers.push(
    tf.layers.dense({
      units: classCount,
      activation: "softmax",
      name: "my-ai-output",
    }),
  )

  return layers
}

function validateClassifierModelShape(
  model: tf.LayersModel,
  inputSize: number,
  classCount: number,
) {
  const inputShape = model.inputs?.[0]?.shape
  const outputShape = model.outputs?.[0]?.shape

  if (
    !Array.isArray(inputShape) ||
    inputShape.length !== 2 ||
    inputShape[0] !== null ||
    Number(inputShape[1]) !== inputSize
  ) {
    throw new AIModelShapeError(
      "My AI model input shape mismatch. Expected [batch, " +
        inputSize +
        "]. Retrain My AI with the current feature version.",
    )
  }

  if (
    !Array.isArray(outputShape) ||
    outputShape.length !== 2 ||
    outputShape[0] !== null ||
    Number(outputShape[1]) !== classCount
  ) {
    throw new AIModelShapeError(
      "My AI model output shape mismatch. Retrain My AI with the current class set.",
    )
  }
}

function describeArchitecture(specs: AiLayerSpec[], classCount: number) {
  return `Visual features → ${sanitizeLayerSpecs(specs).map((spec,index) => {
    if (spec.type === "dense") return `${index+1}. Dense(${spec.units})`
    if (spec.type === "dropout") return `${index+1}. Dropout(${Math.round((spec.rate??0.2)*100)}%)`
    if (spec.type === "batchNormalization") return `${index+1}. Normalization`
    return `${index+1}. Activation(${spec.activation??"relu"})`
  }).join(" → ")} → Classifier(${classCount} classes)`
}

function makeTensorPair(
  features: number[][],
  labels: number[],
  classCount: number,
) {
  if (!features.length) {
    throw new Error("My AI cannot train with an empty feature matrix.")
  }
  if (features.length !== labels.length) {
    throw new Error(
      "My AI dataset shape mismatch: " +
        features.length +
        " feature rows for " +
        labels.length +
        " labels.",
    )
  }

  const featureSize = features[0]?.length ?? 0
  if (!featureSize) {
    throw new Error("My AI received an empty feature vector.")
  }
  if (featureSize !== MY_AI_FEATURE_SIZE) {
    throw new Error(
      "My AI feature matrix size mismatch. Expected " +
        MY_AI_FEATURE_SIZE +
        ", got " +
        featureSize +
        ".",
    )
  }

  for (const row of features) {
    if (
      row.length !== featureSize ||
      row.some((value) => !Number.isFinite(value))
    ) {
      throw new Error("My AI received an invalid or inconsistent feature matrix.")
    }
  }

  if (
    labels.some(
      (label) =>
        !Number.isInteger(label) || label < 0 || label >= classCount,
    )
  ) {
    throw new Error("My AI received an invalid class index.")
  }

  const xs = tf.tensor2d(
    features,
    [features.length, featureSize],
    "float32",
  )
  let labelTensor: tf.Tensor1D | null = null
  let ys: tf.Tensor2D | null = null

  try {
    labelTensor = tf.tensor1d(labels, "int32")
    ys = tf.oneHot(labelTensor, classCount)
    return { xs, ys, featureSize }
  } catch (error) {
    ys?.dispose()
    xs.dispose()
    throw error
  } finally {
    labelTensor?.dispose()
  }
}

export async function trainAiModel(
  samples: AiSample[],
  options: TrainOptions = {},
): Promise<{ model: tf.LayersModel; summary: AiModelSummary }> {
  const normalizedSamples = samples
    .map((sample) => ({
      ...sample,
      label: normalizeLabel(sample.label),
    }))
    .filter((sample) => sample.label.length > 0)

  const classes = uniqueClasses(
    normalizedSamples.map((sample) => sample.label),
  )
  const classIndexByKey = new Map(
    classes.map((className, index) => [className.toLowerCase(), index]),
  )
  const classIndexForLabel = (label: string) =>
    classIndexByKey.get(normalizeLabel(label).toLowerCase()) ?? -1
  const counts = getSampleCounts(normalizedSamples)


  if (classes.length < MIN_CLASSES) {
    throw new AIDatasetError("Teach at least 2 concepts before training.")
  }

  if (classes.length > MAX_CLASSES) {
    throw new AIDatasetError("My AI supports at most 8 concepts.")
  }

  if (normalizedSamples.length > MAX_TOTAL_SAMPLES) {
    throw new AIDatasetError("My AI supports at most 80 examples.")
  }

  if (classes.some((name) => (counts[name] ?? 0) < MIN_SAMPLES_PER_CLASS)) {
    throw new AIDatasetError("Give every concept at least 3 examples.")
  }

  if (classes.some((name) => (counts[name] ?? 0) > MAX_SAMPLES_PER_CLASS)) {
    throw new AIDatasetError("Keep each concept at or below 20 examples.")
  }

  const { train, validation } = buildValidationSplit(normalizedSamples, classes)
  const minClassSamples = Math.min(...classes.map((name) => counts[name] ?? 0))
  let trainXs: tf.Tensor2D | null = null
  let trainYs: tf.Tensor2D | null = null
  let validationXs: tf.Tensor2D | null = null
  let validationYs: tf.Tensor2D | null = null
  let model: tf.LayersModel | null = null
  let bestWeights: tf.Tensor[] | null = null

  const previousActiveModel = activeModel
  activeModel = null

  try {
    options.onStage?.("Preparing visual learning features")
    const augmentTraining = minClassSamples < RECOMMENDED_SAMPLES_PER_CLASS
    const extractedTrain = await extractFeatures(train, options, augmentTraining)
    const extractedValidation = validation.length
      ? await extractFeatures(validation, options, false)
      : { features: [], size: extractedTrain.size }

    const trainFeatureMatrix = extractedTrain.features
    const validationFeatureMatrix = extractedValidation.features
    const copiesPerSample = augmentTraining && train.length <= 32 ? 2 : 1
    const trainLabels = train.flatMap((sample) => {
      const classIndex = classIndexForLabel(sample.label)
      if (classIndex < 0 || classIndex >= classes.length) {
        throw new Error("My AI found a training label that is not in the concept list.")
      }
      return Array.from({ length: copiesPerSample }, () => classIndex)
    })
    const validationLabels = validation.map((sample) => {
      const classIndex = classIndexForLabel(sample.label)
      if (classIndex < 0 || classIndex >= classes.length) {
        throw new Error("My AI found a validation label that is not in the concept list.")
      }
      return classIndex
    })
    const extracted = {
      features: trainFeatureMatrix,
      size: extractedTrain.size,
    }

    const trainTensors = makeTensorPair(
      trainFeatureMatrix,
      trainLabels,
      classes.length,
    )
    trainXs = trainTensors.xs
    trainYs = trainTensors.ys

    if (validation.length) {
      const validationTensors = makeTensorPair(
        validationFeatureMatrix,
        validationLabels,
        classes.length,
      )
      validationXs = validationTensors.xs
      validationYs = validationTensors.ys
    }

    const config = clampTrainingConfig(options)
    const load = estimateTrainingLoad(
      config.layers,
      classes.length,
      extracted.size,
      config.epochs,
      trainFeatureMatrix.length,
      config.batchSize,
    )
    if (load.parameters > 750_000 || load.label === "High") {
      throw new Error(
        "This architecture is too heavy for a browser. Reduce layer count, layer size, epochs, or batch size before training.",
      )
    }

    model = tf.sequential({
      layers: buildTrainableLayers(
        extracted.size,
        classes.length,
        config.layers,
      ),
    })
    validateClassifierModelShape(model, extracted.size, classes.length)
    model.compile({ optimizer: tf.train.adam(config.learningRate), loss: "categoricalCrossentropy", metrics: ["accuracy"] })

    const epochs = config.epochs
    if (options.shouldCancel?.()) throw new Error("Training cancelled.")

    const history: AiTrainingHistoryPoint[] = []
    let latestAccuracy = 0
    let latestValidation = 0
    let bestEpoch = 0
    let bestMonitor = Number.POSITIVE_INFINITY
    let wait = 0
    let earlyStopped = false
    bestWeights = null
    const startedAt = performance.now()

    options.onStage?.("Training classifier")
    await model.fit(trainXs, trainYs, {
      epochs,
      batchSize: Math.min(config.batchSize, trainFeatureMatrix.length),
      shuffle: true,
      validationData: validationXs && validationYs ? [validationXs, validationYs] : undefined,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          if (options.shouldCancel?.()) {
            model!.stopTraining = true
            return
          }
          latestAccuracy = Number(logs?.accuracy ?? logs?.acc ?? 0)
          latestValidation = Number(logs?.val_accuracy ?? logs?.val_acc ?? 0)
          const point: AiTrainingHistoryPoint = {
            epoch: epoch + 1,
            loss: Number(logs?.loss ?? 0),
            accuracy: latestAccuracy,
            valLoss: validationXs && validationYs && Number.isFinite(Number(logs?.val_loss)) ? Number(logs?.val_loss) : null,
            valAccuracy: validationXs && validationYs ? latestValidation : null,
            elapsedMs: Math.round(performance.now() - startedAt),
          }
          history.push(point)
          options.onEpoch?.(point)

          const monitor = point.valLoss ?? point.loss
          if (monitor + config.earlyStoppingMinDelta < bestMonitor) {
            bestMonitor = monitor
            bestEpoch = point.epoch
            wait = 0
            bestWeights?.forEach((weight) => weight.dispose())
            bestWeights = model!.getWeights().map((weight) => weight.clone())
          } else {
            wait += 1
            if (wait >= config.earlyStoppingPatience && point.epoch >= 8) {
              earlyStopped = true
              model!.stopTraining = true
            }
          }
          await tf.nextFrame()
        },
      },
    })

    if (options.shouldCancel?.()) {
      bestWeights?.forEach((weight) => weight.dispose())
      bestWeights = null
      throw new Error("Training cancelled.")
    }
    if (bestWeights) {
      const weightsToRestore = bestWeights
      bestWeights = null
      try {
        model.setWeights(weightsToRestore)
      } finally {
        weightsToRestore.forEach((weight) => weight.dispose())
      }
    }
    model.stopTraining = false

    let validationAccuracy = 0
    let validationConfusionMatrix: number[][] | undefined

    if (validationXs && validationYs && validation.length) {
      const validationEvaluation = model.evaluate(
        validationXs,
        validationYs,
      ) as tf.Scalar | tf.Scalar[]

      const validationValues = Array.isArray(validationEvaluation)
        ? validationEvaluation
        : [validationEvaluation]

      validationAccuracy = validationValues[1]
        ? Number((await validationValues[1].data())[0])
        : latestValidation

      validationValues.forEach((value) => value.dispose())

      const predictionTensor = model.predict(validationXs) as tf.Tensor
      const predictionValues = Array.from(await predictionTensor.data())
      predictionTensor.dispose()

      validationConfusionMatrix = classes.map(() => classes.map(() => 0))

      for (let row = 0; row < validationLabels.length; row += 1) {
        const actual = validationLabels[row]
        const offset = row * classes.length
        let predicted = 0

        for (let column = 1; column < classes.length; column += 1) {
          if (
            (predictionValues[offset + column] ?? 0) >
            (predictionValues[offset + predicted] ?? 0)
          ) {
            predicted = column
          }
        }

        if (validationConfusionMatrix[actual]) {
          validationConfusionMatrix[actual][predicted] += 1
        }
      }
    }

    const trainEvaluation = model.evaluate(
      trainXs,
      trainYs,
    ) as tf.Scalar | tf.Scalar[]

    const trainValues = Array.isArray(trainEvaluation)
      ? trainEvaluation
      : [trainEvaluation]

    const trainAccuracy = trainValues[1]
      ? Number((await trainValues[1].data())[0])
      : latestAccuracy

    trainValues.forEach((value) => value.dispose())

    const generalizationGap = validation.length
      ? Math.round(Math.max(0, trainAccuracy - validationAccuracy) * 100)
      : 0

    const summary: AiModelSummary = {
      id: createId(),
      name: classes.join(" vs ") + " · Pixiu My AI",
      classes,
      sampleCount: normalizedSamples.length,
      epochs: history.length,
      trainAccuracy: Math.round(trainAccuracy * 100),
      validationAccuracy: Math.round(validationAccuracy * 100),
      createdAt: Date.now(),
      imageInputShape: [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3],
      featureShape: [extracted.size],
      modelInputShape: [extracted.size],
      outputShape: [classes.length],
      embeddingSize: extracted.size,
      classCount: classes.length,
      featureExtractor: MY_AI_FEATURE_VERSION,
      storageKey: MODEL_KEY,
      classPrototypes: buildClassPrototypes(
        trainFeatureMatrix,
        trainLabels,
        classes,
      ),
      architecture: describeArchitecture(config.layers, classes.length),
      predictionThreshold: MY_AI_PREDICTION_THRESHOLD,
      trainingProfile: options.profile ?? "custom",
      hiddenLayers: config.layers.filter((layer) => layer.type === "dense").length,
      hiddenUnits: Math.max(
        0,
        ...config.layers
          .filter((layer) => layer.type === "dense")
          .map((layer) => layer.units ?? 0),
      ),
      dropoutRate:
        config.layers.find((layer) => layer.type === "dropout")?.rate ?? 0,
      learningRate: config.learningRate,
      batchSize: config.batchSize,
      earlyStoppingPatience: config.earlyStoppingPatience,
      earlyStoppingMinDelta: config.earlyStoppingMinDelta,
      earlyStopped,
      bestEpoch:
        bestEpoch || history[history.length - 1]?.epoch || history.length,
      parameterCount: model.countParams(),
      layerSpecs: config.layers,
      trainingHistory: history,
      validationAvailable: validation.length > 0,
      generalizationGap,
      validationConfusionMatrix,
      confidenceCalibration:
        "Classifier confidence is combined with learned class-pattern similarity; weak matches return as unknown.",
    }


    options.onStage?.("Saving model locally")
    try {
      await queueModelOperation(async () => {
        await Promise.race([
          model!.save(`indexeddb://${MODEL_KEY}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error("IndexedDB save timed out")), 4000)),
        ])
      })
    } catch (saveError) {
      console.warn("My AI IndexedDB model save failed; continuing with active model:", saveError)
    }

    if (previousActiveModel && previousActiveModel !== model) {
      previousActiveModel.dispose()
    }
    activeModel = model
    model = null
    return {
      model: activeModel,
      summary,
    }
  } catch (error) {
    activeModel = previousActiveModel
    if (model) model.dispose()
    throw error instanceof Error ? error : new Error("Training failed.")
  } finally {
    bestWeights?.forEach((weight) => weight.dispose())
    bestWeights = null
    trainXs?.dispose()
    trainYs?.dispose()
    validationXs?.dispose()
    validationYs?.dispose()
  }
}

export async function loadStoredAiModel(
  summary: AiModelSummary | null,
): Promise<tf.LayersModel | null> {
  if (!summary || typeof summary !== "object") return null
  if (!isCompatibleModelSummary(summary)) return null

  try {
    await modelStorageQueue
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`)
    const inputShape = model.inputs?.[0]?.shape
    const inputSize = Number(inputShape?.[inputShape.length - 1] ?? 0)
    const outputShape = model.outputs?.[0]?.shape
    const outputClasses = Number(
      outputShape?.[outputShape.length - 1] ?? 0,
    )

    if (
      inputShape?.length !== 2 ||
      inputSize !== summary.embeddingSize ||
      outputShape?.length !== 2 ||
      outputClasses !== summary.classes.length
    ) {
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
  disposeMyAiFeatureExtractor()
}

export async function deleteStoredModel() {
  for (const key of [MODEL_KEY, ...LEGACY_MODEL_KEYS]) {
    try {
      await tf.io.removeModel(`indexeddb://${key}`)
    } catch {
      // Missing IndexedDB models are fine.
    }
  }

  disposeActiveAiModel()
}

async function predictAiEmbedding(
  embeddingValues: number[],
  summary: AiModelSummary | null,
) {
  if (
    !summary ||
    summary.storageKey !== MODEL_KEY ||
    summary.featureExtractor !== MY_AI_FEATURE_VERSION
  ) {
    return null
  }

  const model = activeModel ?? (await loadStoredAiModel(summary))
  if (!model) return null

  try {
    validateClassifierModelShape(
      model,
      summary.embeddingSize,
      summary.classes.length,
    )
  } catch {
    return null
  }

  if (
    embeddingValues.length !== summary.embeddingSize ||
    embeddingValues.some((value) => !Number.isFinite(value))
  ) {
    return null
  }

  const feature = tf.tensor2d(
    embeddingValues,
    [1, summary.embeddingSize],
    "float32",
  )

  let output: tf.Tensor | null = null

  try {
    output = model.predict(feature) as tf.Tensor
    const probabilities = Array.from(await output.data())
      .map((value) =>
        Number.isFinite(Number(value))
          ? Math.max(0, Math.min(1, Number(value)))
          : 0,
      )

    if (probabilities.length !== summary.classes.length || !probabilities.length) {
      return {
        label: "unknown",
        confidence: 0,
        probabilities: {},
        unknown: true,
        lowConfidence: true,
        margin: 0,
        reason: "low_confidence" as const,
      }
    }

    const normalizedEmbedding = normalizeVector(embeddingValues)
    const prototypeSimilarities = summary.classPrototypes
      ? summary.classes.map((className) =>
          cosineSimilarity(
            normalizedEmbedding,
            normalizeVector(summary.classPrototypes?.[className] ?? []),
          ),
        )
      : []
    const prototypeProbabilities = softmaxScores(prototypeSimilarities)

    const perClassSamples =
      summary.sampleCount / Math.max(1, summary.classes.length)
    const prototypeWeight =
      perClassSamples < RECOMMENDED_SAMPLES_PER_CLASS ? 0.68 : 0.42

    const blendedProbabilities = probabilities.map((value, index) =>
      prototypeProbabilities.length
        ? value * (1 - prototypeWeight) +
          (prototypeProbabilities[index] ?? 0) * prototypeWeight
        : value,
    )

    const bestIndex = blendedProbabilities.indexOf(
      Math.max(...blendedProbabilities),
    )
    const sortedProbabilities = [...blendedProbabilities].sort((a, b) => b - a)
    const bestProbability = sortedProbabilities[0] ?? 0
    const secondProbability = sortedProbabilities[1] ?? 0
    const margin = bestProbability - secondProbability
    const threshold = Number.isFinite(summary.predictionThreshold)
      ? Math.max(0, Math.min(1, summary.predictionThreshold))
      : MY_AI_PREDICTION_THRESHOLD
    const prototypeBest = prototypeSimilarities[bestIndex] ?? -1
    const lowConfidence = bestProbability < threshold
    const lowPrototype =
      prototypeSimilarities.length > 0 && prototypeBest < 0.35
    const lowMargin =
      blendedProbabilities.length > 1 &&
      margin < MY_AI_LOW_MARGIN_THRESHOLD
    const unknown = lowConfidence || lowMargin || lowPrototype
    const reason = lowConfidence
      ? "low_confidence"
      : lowMargin
        ? "ambiguous"
        : "recognized"

    return {
      label:
        !unknown && summary.classes[bestIndex]
          ? summary.classes[bestIndex]
          : "unknown",
      confidence: Math.round(bestProbability * 100),
      probabilities: Object.fromEntries(
        summary.classes.map((name, index) => [
          name,
          Math.round((blendedProbabilities[index] ?? 0) * 100),
        ]),
      ),
      unknown,
      lowConfidence,
      margin: Math.round(margin * 100),
      threshold: Math.round(threshold * 100),
      reason,
    }
  } finally {
    output?.dispose()
    feature.dispose()
  }
}

export async function predictAiImage(
  dataUrl: string,
  summary: AiModelSummary | null,
) {
  if (!summary) return null
  const image = await loadImage(dataUrl)
  const embeddingValues = await extractMyAiEmbedding(image)
  return predictAiEmbedding(embeddingValues, summary)
}

export async function predictAiVideo(
  video: HTMLVideoElement,
  summary: AiModelSummary | null,
) {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    return null
  }

  const embeddingValues = await extractMyAiEmbedding(video)
  return predictAiEmbedding(embeddingValues, summary)
}

export function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/jpeg", 0.72)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not read that image."))
    image.src = src
    if (image.complete && image.naturalWidth > 0) {
      resolve(image)
    }
  })
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ai-${Math.random().toString(36).slice(2, 10)}`
}
