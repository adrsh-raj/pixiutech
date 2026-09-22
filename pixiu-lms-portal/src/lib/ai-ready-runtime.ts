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

function loadScript(src: string, ready: () => boolean): Promise<void> {
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

    if (current) {
      const finish = () => (ready() ? resolve() : reject(new Error("AI module loaded but did not initialize.")))
      if (ready()) {
        finish()
      } else {
        current.addEventListener("load", finish, { once: true })
        current.addEventListener("error", () => reject(new Error("AI module could not be loaded.")), {
          once: true,
        })
      }
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.pixiuAi = src
    script.onload = () => (ready() ? resolve() : reject(new Error("AI module loaded but did not initialize.")))
    script.onerror = () => reject(new Error("AI module could not be loaded."))
    document.head.appendChild(script)
  })

  scriptLoads.set(src, promise)

  promise.catch(() => {
    scriptLoads.delete(src)
  })

  return promise
}

function ensureTfGlobal() {
  if (typeof window !== "undefined" && !window.tf) {
    window.tf = tf
  }
}

export async function loadPoseDetector() {
  ensureTfGlobal()
  await loadScript(
    "https://unpkg.com/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
    () => Boolean(window.poseDetection),
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
  ensureTfGlobal()
  await loadScript(
    "https://unpkg.com/@tensorflow-models/handpose@0.1.0/dist/handpose.min.js",
    () => Boolean(window.handpose),
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
  ensureTfGlobal()

  if (emotionModelsPromise) return emotionModelsPromise

  emotionModelsPromise = (async () => {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js",
      () => Boolean(window.faceapi),
    )

    if (!window.faceapi) throw new Error("Expression AI is unavailable.")

    const modelBase =
      "https://justadudewhohacks.github.io/face-api.js/models"

    await window.faceapi.nets.tinyFaceDetector.loadFromUri(modelBase)
    await window.faceapi.nets.faceExpressionNet.loadFromUri(modelBase)

    return window.faceapi
  })()

  try {
    return await emotionModelsPromise
  } catch (error) {
    emotionModelsPromise = null
    throw error
  }
}

export async function loadSpeechRecognizer() {
  ensureTfGlobal()

  await loadScript(
    "https://unpkg.com/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
    () => Boolean(window.speechCommands),
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
    resource?.stopListening?.()
  } catch {
    // Best effort cleanup.
  }
}
