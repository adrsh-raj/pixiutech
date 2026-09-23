import * as tf from "@tensorflow/tfjs"

declare global {
  interface Window {
    tf?: typeof tf
    poseDetection?: any
    handpose?: any
    faceapi?: any
    speechCommands?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()
let emotionModelsPromise: Promise<any> | null = null
const SCRIPT_TIMEOUT_MS = 30_000

function loadScript(src: string, ready: () => boolean, label: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("AI Studio needs a browser."))
  }

  if (ready()) return Promise.resolve()

  const existingLoad = scriptLoads.get(src)
  if (existingLoad) return existingLoad

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-ai="${src}"]`,
    )

    let timer: number | null = null
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (timer !== null) window.clearTimeout(timer)
      if (error) reject(error)
      else if (ready()) resolve()
      else reject(new Error(`${label} loaded but did not initialize.`))
    }

    if (current) {
      if (ready()) {
        finish()
      } else {
        current.addEventListener("load", () => finish(), { once: true })
        current.addEventListener("error", () => finish(new Error(`${label} could not be loaded.`)), { once: true })
        timer = window.setTimeout(() => finish(new Error(`${label} timed out while loading.`)), SCRIPT_TIMEOUT_MS)
      }
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.pixiuAi = src
    script.onload = () => finish()
    script.onerror = () => finish(new Error(`${label} could not be loaded.`))
    document.head.appendChild(script)
    timer = window.setTimeout(() => finish(new Error(`${label} timed out while loading.`)), SCRIPT_TIMEOUT_MS)
  })

  scriptLoads.set(src, promise)
  promise.catch(() => scriptLoads.delete(src))
  return promise
}

async function ensureTfReady() {
  if (typeof window === "undefined") {
    throw new Error("AI Studio needs a browser.")
  }

  // All browser-loaded AI libraries must use the same TensorFlow.js instance.
  window.tf = tf
  await tf.ready()

  if (!tf.getBackend()) {
    try {
      await tf.setBackend("webgl")
    } catch {
      await tf.setBackend("cpu")
    }
    await tf.ready()
  }
}

export async function loadPoseDetector() {
  await ensureTfReady()
  await loadScript(
    "https://unpkg.com/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
    () => Boolean(window.poseDetection),
    "Pose AI",
  )

  if (!window.poseDetection) throw new Error("Pose AI is unavailable.")

  return window.poseDetection.createDetector(
    window.poseDetection.SupportedModels.MoveNet,
    {
      modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
    },
  )
}

export async function loadHandDetector() {
  await ensureTfReady()
  await loadScript(
    "https://unpkg.com/@tensorflow-models/handpose@0.1.0/dist/handpose.min.js",
    () => Boolean(window.handpose),
    "Hand AI",
  )

  if (!window.handpose) throw new Error("Hand AI is unavailable.")

  return window.handpose.load({
    maxContinuousChecks: 1,
    detectionConfidence: 0.55,
    scoreThreshold: 0.55,
    iouThreshold: 0.3,
  })
}

export async function loadFaceEmotion() {
  await ensureTfReady()

  if (emotionModelsPromise) return emotionModelsPromise

  emotionModelsPromise = (async () => {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js",
      () => Boolean(window.faceapi),
      "Expression AI",
    )

    if (!window.faceapi) throw new Error("Expression AI is unavailable.")

    const modelBases = [
      "https://justadudewhohacks.github.io/face-api.js/models",
      "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights",
    ]

    let lastError: unknown = null

    for (const modelBase of modelBases) {
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelBase)
        await window.faceapi.nets.faceExpressionNet.loadFromUri(modelBase)
        return window.faceapi
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(
      `Expression AI model files could not be loaded. Check your internet connection and try again.${lastError instanceof Error ? ` (${lastError.message})` : ""}`,
    )
  })()

  try {
    return await emotionModelsPromise
  } catch (error) {
    emotionModelsPromise = null
    throw error
  }
}

export async function loadSpeechRecognizer() {
  await ensureTfReady()

  await loadScript(
    "https://unpkg.com/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
    () => Boolean(window.speechCommands),
    "Sound AI",
  )

  if (!window.speechCommands) throw new Error("Sound AI is unavailable.")

  const recognizer = window.speechCommands.create("BROWSER_FFT")
  await recognizer.ensureModelLoaded()
  return recognizer
}

export function disposeAiResource(resource: any) {
  try {
    resource?.dispose?.()
  } catch {
    // Best effort: some browser-backed models expose partial cleanup.
  }
}

export function stopSpeechRecognizer(resource: any) {
  try {
    void Promise.resolve(resource?.stopListening?.()).catch(() => {})
  } catch {
    // Best effort cleanup.
  }
}
