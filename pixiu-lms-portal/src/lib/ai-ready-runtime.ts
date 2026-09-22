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

const loadedScripts = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("AI Studio needs a browser."))
  const existing = loadedScripts.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(`script[data-pixiu-ai="${src}"]`)
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true })
      current.addEventListener("error", () => reject(new Error("AI module could not be loaded.")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.pixiuAi = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("AI module could not be loaded."))
    document.head.appendChild(script)
  })

  loadedScripts.set(src, promise)
  return promise
}

function ensureTfGlobal() {
  if (typeof window === "undefined") return
  if (!window.tf) window.tf = tf
}

export async function loadPoseDetector() {
  ensureTfGlobal()
  await loadScript("https://unpkg.com/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js")
  if (!window.poseDetection) throw new Error("Pose AI is unavailable.")
  return window.poseDetection.createDetector(window.poseDetection.SupportedModels.MoveNet, {
    modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
  })
}

export async function loadHandDetector() {
  ensureTfGlobal()
  await loadScript("https://unpkg.com/@tensorflow-models/handpose@0.1.0/dist/handpose.min.js")
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
  await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js")
  const faceapi = window.faceapi
  if (!faceapi) throw new Error("Emotion AI is unavailable.")

  const modelBase = "https://justadudewhohacks.github.io/face-api.js/models"
  await faceapi.nets.tinyFaceDetector.loadFromUri(modelBase)
  await faceapi.nets.faceExpressionNet.loadFromUri(modelBase)
  return faceapi
}

export async function loadSpeechRecognizer() {
  ensureTfGlobal()
  await loadScript("https://unpkg.com/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js")
  if (!window.speechCommands) throw new Error("Sound AI is unavailable.")

  const recognizer = window.speechCommands.create("BROWSER_FFT")
  await recognizer.ensureModelLoaded()
  return recognizer
}

export function disposeAiResource(resource: any) {
  try {
    resource?.dispose?.()
  } catch {
    // Best-effort cleanup.
  }
}

export function stopSpeechRecognizer(resource: any) {
  try {
    resource?.stopListening?.()
  } catch {
    // Best-effort cleanup.
  }
}
