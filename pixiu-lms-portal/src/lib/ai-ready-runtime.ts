import * as tf from "@tensorflow/tfjs"

declare global {
  interface Window {
    tf?: typeof tf
    poseDetection?: any
    Hands?: any
    faceapi?: any
    speechCommands?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()
let emotionPromise: Promise<any> | null = null

const CDN = {
  pose: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
    "https://unpkg.com/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
  ],
  hands: [
    "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
    "https://unpkg.com/@mediapipe/hands/hands.js",
  ],
  face: [
    "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js",
    "https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js",
  ],
  speech: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
    "https://unpkg.com/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
  ],
}

async function ensureTfReady() {
  if (typeof window !== "undefined") window.tf = tf
  await tf.ready()

  if (!tf.getBackend()) {
    try {
      await tf.setBackend("webgl")
      await tf.ready()
    } catch {
      await tf.setBackend("cpu")
      await tf.ready()
    }
  }
}

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("AI Studio needs a browser."))
  }

  if (ready()) return Promise.resolve()

  const existing = scriptLoads.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(`script[data-pixiu-ai-src="${src}"]`)

    if (current && ready()) {
      resolve()
      return
    }

    const script = current ?? document.createElement("script")
    let settled = false

    const cleanup = () => {
      script.removeEventListener("load", onLoad)
      script.removeEventListener("error", onError)
    }

    const onLoad = () => {
      if (settled) return
      settled = true
      cleanup()
      if (ready()) resolve()
      else reject(new Error("AI module loaded but did not initialize."))
    }

    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error("AI module could not be loaded."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    if (!current) {
      script.async = true
      script.src = src
      script.dataset.pixiuAiSrc = src
      document.head.appendChild(script)
    }

    window.setTimeout(() => {
      if (settled) return
      if (ready()) onLoad()
      else onError()
    }, 30000)
  })

  scriptLoads.set(src, promise)
  promise.catch(() => scriptLoads.delete(src))
  return promise
}

async function loadAny(sources: string[], ready: () => boolean): Promise<string> {
  let lastError: unknown = null

  for (const src of sources) {
    try {
      await loadScript(src, ready)
      if (ready()) return src
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The AI module could not be loaded.")
}

export async function loadPoseDetector() {
  await ensureTfReady()
  await loadAny(CDN.pose, () => Boolean(window.poseDetection))

  return window.poseDetection.createDetector(
    window.poseDetection.SupportedModels.MoveNet,
    {
      modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
    },
  )
}

export async function loadHandDetector() {
  const source = await loadAny(CDN.hands, () => Boolean(window.Hands))
  const sourceBase = source.slice(0, source.lastIndexOf("/") + 1)

  const hands = new window.Hands({
    locateFile: (file: string) => `${sourceBase}${file}`,
  })

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  })

  let pending: ((result: any) => void) | null = null
  let rejected: ((error: unknown) => void) | null = null

  hands.onResults((result: any) => {
    const resolve = pending
    pending = null
    rejected = null
    resolve?.(result)
  })

  return {
    async estimate(video: HTMLVideoElement) {
      if (pending) {
        throw new Error("Hand AI is already processing a frame.")
      }

      return new Promise<any>((resolve, reject) => {
        pending = resolve
        rejected = reject

        Promise.resolve(hands.send({ image: video })).catch((error) => {
          const rejectCurrent = rejected
          pending = null
          rejected = null
          rejectCurrent?.(error)
        })
      })
    },
    async dispose() {
      pending = null
      rejected = null
      await hands.close?.()
    },
  }
}

export async function loadFaceEmotion() {
  await ensureTfReady()

  if (emotionPromise) return emotionPromise

  emotionPromise = (async () => {
    await loadAny(CDN.face, () => Boolean(window.faceapi))

    const bases = [
      "https://justadudewhohacks.github.io/face-api.js/models",
      "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights",
    ]

    let lastError: unknown = null

    for (const base of bases) {
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(base)
        await window.faceapi.nets.faceExpressionNet.loadFromUri(base)
        return window.faceapi
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Emotion model weights could not be loaded.")
  })()

  try {
    return await emotionPromise
  } catch (error) {
    emotionPromise = null
    throw error
  }
}

export async function loadSpeechRecognizer() {
  await ensureTfReady()
  await loadAny(CDN.speech, () => Boolean(window.speechCommands))

  const recognizer = window.speechCommands.create("BROWSER_FFT")
  await recognizer.ensureModelLoaded()
  return recognizer
}

export async function estimateFaceEmotion(faceapi: any, video: HTMLVideoElement) {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5,
  })

  const results = await faceapi
    .detectAllFaces(video, options)
    .withFaceExpressions()

  const primary = results?.[0]
  if (!primary?.expressions) return null

  const entries = Object.entries(primary.expressions as Record<string, number>)
    .sort((a, b) => b[1] - a[1])

  const [expression, score] = entries[0] ?? ["unknown", 0]
  return {
    expression,
    score: Number(score),
    count: results.length,
  }
}

export function disposeAiResource(resource: any) {
  try {
    if (resource?.dispose) resource.dispose()
    else if (resource?.close) void resource.close()
  } catch {
    // Best effort cleanup for browser-backed models.
  }
}

export async function stopSpeechRecognizer(resource: any) {
  try {
    await resource?.stopListening?.()
  } catch {
    // Best effort cleanup.
  }
}
