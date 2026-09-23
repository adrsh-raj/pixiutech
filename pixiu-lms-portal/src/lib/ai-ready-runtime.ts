import * as tf from "@tensorflow/tfjs"

declare global {
  interface Window {
    tf?: typeof tf
    poseDetection?: any
    Human?: any
    speechCommands?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()

const CDN = {
  pose: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
    "https://unpkg.com/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js",
  ],
  human: [
    "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js",
    "https://unpkg.com/@vladmandic/human@3.3.6/dist/human.js",
  ],
  speech: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
    "https://unpkg.com/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
  ],
}

const HUMAN_VERSION = "3.3.6"
const HUMAN_MODEL_BASE =
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/"

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
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-ai-src="${src}"]`,
    )

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

async function loadHuman(config: Record<string, unknown>) {
  await loadAny(CDN.human, () => Boolean(window.Human))

  if (!window.Human?.Human) {
    throw new Error(`Human AI ${HUMAN_VERSION} did not initialize.`)
  }

  const human = new window.Human.Human({
    backend: "webgl",
    debug: false,
    cacheModels: true,
    cacheSensitivity: 0,
    modelBasePath: HUMAN_MODEL_BASE,
    filter: { enabled: false },
    face: { enabled: false },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
    ...config,
  })

  // Explicit preload turns model/network errors into the adapter's startup
  // error instead of surfacing them later during the first camera frame.
  await human.load()
  return human
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

/**
 * 6D Hand AI
 *
 * Uses the maintained Human browser library (v3.3.6) with hand tracking and
 * hand-landmark models enabled only for this adapter. The adapter exposes the
 * old normalized shape consumed by the AI Studio drawing/inference layer so
 * the rest of the application stays model-agnostic.
 */
export async function loadHandDetector() {
  const human = await loadHuman({
    hand: {
      enabled: true,
      rotation: false,
      maxDetected: 2,
      minConfidence: 0.5,
      iouThreshold: 0.2,
      landmarks: true,
      detector: { modelPath: "handtrack.json" },
      skeleton: { modelPath: "handlandmark-lite.json" },
    },
    gesture: { enabled: true },
  })

  return {
    version: HUMAN_VERSION,
    async estimate(video: HTMLVideoElement) {
      const result = await human.detect(video)
      const hands = Array.isArray(result?.hand) ? result.hand : []

      return {
        human: result,
        multiHandLandmarks: hands.map((hand: any) =>
          (hand.keypoints ?? []).map((point: any) => ({
            x: Number(point?.[0] ?? 0),
            y: Number(point?.[1] ?? 0),
            z: Number(point?.[2] ?? 0),
          })),
        ),
      }
    },
    async dispose() {
      try {
        human.reset?.()
      } catch {
        // Best effort. Human keeps model cache separate from app state.
      }
    },
  }
}

/**
 * 6E Face AI
 *
 * face-api.js 0.22.2 is no longer the maintained path for this project.
 * Human 3.3.6 provides browser face detection, mesh/landmarks and emotion
 * analysis on a maintained TensorFlow.js stack.
 */
export async function loadFaceEmotion() {
  const human = await loadHuman({
    face: {
      enabled: true,
      detector: {
        rotation: false,
        maxDetected: 2,
        minConfidence: 0.45,
        minSize: 80,
        return: false,
      },
      mesh: { enabled: true },
      iris: { enabled: false },
      description: { enabled: false },
      emotion: { enabled: true, minConfidence: 0.15 },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
    gesture: { enabled: true },
  })

  return {
    version: HUMAN_VERSION,
    async detect(video: HTMLVideoElement) {
      return human.detect(video)
    },
    async dispose() {
      try {
        human.reset?.()
      } catch {
        // Best effort cleanup.
      }
    },
  }
}

export async function estimateFaceEmotion(faceRuntime: any, video: HTMLVideoElement) {
  const result = await faceRuntime.detect(video)
  const faces = Array.isArray(result?.face) ? result.face : []
  const primary = faces[0]

  if (!primary) return null

  const emotions = Array.isArray(primary.emotion) ? primary.emotion : []
  const [top] = [...emotions].sort(
    (a: any, b: any) => Number(b?.score ?? 0) - Number(a?.score ?? 0),
  )

  return {
    expression: String(top?.emotion ?? "neutral"),
    score: Number(top?.score ?? 0),
    count: faces.length,
    box: Array.isArray(primary.box)
      ? primary.box.map((value: unknown) => Number(value))
      : null,
    mesh: Array.isArray(primary.mesh)
      ? primary.mesh.map((point: any) => ({
          x: Number(point?.[0] ?? 0),
          y: Number(point?.[1] ?? 0),
        }))
      : [],
  }
}

export async function loadSpeechRecognizer() {
  await ensureTfReady()
  await loadAny(CDN.speech, () => Boolean(window.speechCommands))

  const recognizer = window.speechCommands.create("BROWSER_FFT")
  await recognizer.ensureModelLoaded()
  return recognizer
}

export function disposeAiResource(resource: any) {
  try {
    if (resource?.dispose) {
      void resource.dispose()
    } else if (resource?.close) {
      void resource.close()
    }
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
