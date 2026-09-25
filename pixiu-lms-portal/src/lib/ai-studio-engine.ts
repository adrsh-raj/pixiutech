import * as tf from "@tensorflow/tfjs"
import {
  disposeMyAiFeatureExtractor,
  extractMyAiEmbedding,
  loadMyAiFeatureExtractor,
  MY_AI_FEATURE_VERSION,
  MY_AI_INPUT_SIZE,
  MY_AI_PREDICTION_THRESHOLD,
} from "@/lib/ai/my-ai-feature-extractor"

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
  embeddingSize: number
  featureExtractor: string
  storageKey: string
  architecture: string
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

const STORE_KEY = "pixiu-ai-studio-v3"
const MODEL_KEY = "pixiu-ai-studio-model-v3"
const LEGACY_STORE_KEYS = ["pixiu-ai-studio-v2", "pixiu-ai-studio-v1"]
const LEGACY_MODEL_KEYS = [
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

let activeModel: tf.LayersModel | null = null

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
    model:
      source.model?.storageKey === MODEL_KEY &&
      Array.isArray(source.model.classes) &&
      typeof source.model.embeddingSize === "number"
        ? source.model
        : null,
  }
}

export function saveAiStudioStore(store: AiStudioStore) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        classes: uniqueClasses(store.classes),
        samples: store.samples.slice(-MAX_TOTAL_SAMPLES),
        model: store.model,
      }),
    )
    for (const key of LEGACY_STORE_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Dataset persistence is best-effort. The active React state remains usable.
  }
}

export async function clearAiStudioStore() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORE_KEY)
    for (const key of LEGACY_STORE_KEYS) {
      window.localStorage.removeItem(key)
    }
  }

  await deleteStoredModel()
}

function invalidateStoredModel() {
  void deleteStoredModel()
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
  onEpoch?: (
    epoch: number,
    total: number,
    accuracy: number,
    loss: number,
  ) => void
  onStage?: (stage: string) => void
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
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

async function extractFeatures(
  samples: AiSample[],
  options: TrainOptions,
): Promise<{ features: number[][]; size: number }> {
  await loadMyAiFeatureExtractor()
  const features: number[][] = []
  let embeddingSize = 0

  for (let index = 0; index < samples.length; index += 1) {
    const image = await loadImage(samples[index].dataUrl)
    const embedding = await extractMyAiEmbedding(image)

    if (!embedding.length) {
      throw new Error("My AI feature extractor returned an empty embedding.")
    }
    if (!embeddingSize) embeddingSize = embedding.length
    if (embedding.length !== embeddingSize) {
      throw new Error("My AI returned inconsistent feature sizes.")
    }

    features.push(embedding)
    options.onStage?.(`Extracting vision features · ${index + 1}/${samples.length}`)
    await tf.nextFrame()
  }

  return { features, size: embeddingSize }
}

function makeTensorPair(
  features: number[][],
  labels: number[],
  classCount: number,
) {
  const xs = tf.tensor2d(features)
  const labelTensor = tf.tensor1d(labels, "int32")
  const ys = tf.oneHot(labelTensor, classCount)
  labelTensor.dispose()
  return { xs, ys }
}

export async function trainAiModel(
  samples: AiSample[],
  options: TrainOptions = {},
): Promise<{ model: tf.LayersModel; summary: AiModelSummary }> {
  const classes = uniqueClasses(samples.map((sample) => sample.label))
  const counts = getSampleCounts(samples)

  if (classes.length < MIN_CLASSES) {
    throw new Error("Teach at least 2 concepts before training.")
  }

  if (classes.some((name) => (counts[name] ?? 0) < MIN_SAMPLES_PER_CLASS)) {
    throw new Error("Give every concept at least 3 examples.")
  }

  const { train, validation } = buildValidationSplit(samples, classes)
  const allForFeatures = [...train, ...validation]
  const allLabels = allForFeatures.map((sample) => classes.indexOf(sample.label))
  let trainXs: tf.Tensor2D | null = null
  let trainYs: tf.Tensor2D | null = null
  let validationXs: tf.Tensor2D | null = null
  let validationYs: tf.Tensor2D | null = null
  let model: tf.LayersModel | null = null

  activeModel?.dispose()
  activeModel = null

  try {
    options.onStage?.("Loading frozen vision encoder · MobileNetV2")
    const extracted = await extractFeatures(allForFeatures, options)
    const trainFeatureMatrix = extracted.features.slice(0, train.length)
    const validationFeatureMatrix = extracted.features.slice(train.length)
    const trainLabels = allLabels.slice(0, train.length)
    const validationLabels = allLabels.slice(train.length)

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

    model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [extracted.size],
          units: 96,
          activation: "relu",
          kernelRegularizer: tf.regularizers.l2({ l2: 0.0001 }),
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: classes.length,
          activation: "softmax",
        }),
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

    options.onStage?.("Training classifier head")
    await model.fit(trainXs, trainYs, {
      epochs,
      batchSize: Math.min(16, train.length),
      shuffle: true,
      validationData:
        validationXs && validationYs
          ? [validationXs, validationYs]
          : undefined,
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          latestAccuracy = Number(logs?.accuracy ?? logs?.acc ?? 0)
          latestValidation = Number(
            logs?.val_accuracy ?? logs?.val_acc ?? latestAccuracy,
          )
          latestLoss = Number(logs?.loss ?? 0)
          options.onEpoch?.(
            epoch + 1,
            epochs,
            latestAccuracy,
            latestLoss,
          )
          await tf.nextFrame()
        },
      },
    })

    const trainEvaluation = model.evaluate(trainXs, trainYs) as tf.Scalar | tf.Scalar[]
    const trainValues = Array.isArray(trainEvaluation)
      ? trainEvaluation
      : [trainEvaluation]
    const trainAccuracy = trainValues[1]
      ? Number((await trainValues[1].data())[0])
      : latestAccuracy
    trainValues.forEach((value) => value.dispose())

    let validationAccuracy = latestValidation
    if (validationXs && validationYs) {
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
    }

    const summary: AiModelSummary = {
      id: createId(),
      name: `${classes.join(" vs ")} · Pixiu Transfer AI`,
      classes,
      sampleCount: samples.length,
      epochs,
      trainAccuracy: Math.round(trainAccuracy * 100),
      validationAccuracy: Math.round(validationAccuracy * 100),
      createdAt: Date.now(),
      inputShape: [MY_AI_INPUT_SIZE, MY_AI_INPUT_SIZE, 3],
      embeddingSize: extracted.size,
      featureExtractor: MY_AI_FEATURE_VERSION,
      storageKey: MODEL_KEY,
      architecture:
        `Frozen ${MY_AI_FEATURE_VERSION} embeddings → Dense(96) → Dropout(20%) → Softmax`,
    }

    options.onStage?.("Saving model locally")
    await model.save(`indexeddb://${MODEL_KEY}`)

    activeModel = model
    model = null
    return {
      model: activeModel,
      summary,
    }
  } catch (error) {
    if (model) model.dispose()
    throw error instanceof Error ? error : new Error("Training failed.")
  } finally {
    trainXs?.dispose()
    trainYs?.dispose()
    validationXs?.dispose()
    validationYs?.dispose()
  }
}

export async function loadStoredAiModel(
  summary: AiModelSummary | null,
): Promise<tf.LayersModel | null> {
  if (
    !summary ||
    summary.storageKey !== MODEL_KEY ||
    summary.featureExtractor !== MY_AI_FEATURE_VERSION ||
    !Number.isFinite(summary.embeddingSize)
  ) {
    return null
  }

  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`)
    const inputShape = model.inputs?.[0]?.shape
    const inputSize = Number(inputShape?.[inputShape.length - 1] ?? 0)
    const outputShape = model.outputs?.[0]?.shape
    const outputClasses = Number(
      outputShape?.[outputShape.length - 1] ?? 0,
    )

    if (
      inputSize !== summary.embeddingSize ||
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

export async function predictAiImage(
  dataUrl: string,
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

  const image = await loadImage(dataUrl)
  const embeddingValues = await extractMyAiEmbedding(image)
  if (embeddingValues.length !== summary.embeddingSize) return null

  const feature = tf.tensor2d(
    embeddingValues,
    [1, summary.embeddingSize],
  )

  try {
    const output = model.predict(feature) as tf.Tensor
    const probabilities = Array.from(await output.data())
      .map((value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0)
    const bestIndex = probabilities.indexOf(Math.max(...probabilities))
    const bestProbability = probabilities[bestIndex] ?? 0

    output.dispose()

    return {
      label:
        bestProbability >= MY_AI_PREDICTION_THRESHOLD
          ? summary.classes[bestIndex] ?? "unknown"
          : "unknown",
      confidence: Math.round(bestProbability * 100),
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
  return canvas.toDataURL("image/jpeg", 0.72)
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
