import * as tf from "@tensorflow/tfjs"

export type FacePoint = {
  x: number
  y: number
  z: number
  name?: string
}

export type FaceEmotion = {
  emotion: string
  score: number
}

export type FaceDetection = {
  score: number
  box: [number, number, number, number]
  expression: string
  expressionScore: number
  emotions: FaceEmotion[]
  mesh: FacePoint[]
}

export type FaceDetector = {
  version: string
  detect: (video: HTMLVideoElement) => Promise<FaceDetection[]>
  dispose: () => void
}

const FACE_VERSION = "1.0.6"
const MAX_FACES = 3
// MediaPipe FaceMesh returns 478 keypoints in the TFJS adapter.
const MIN_FACE_SCORE = 0.45
const FACE_RUNTIME_SOURCES = {
  detector: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection@1.0.3/dist/face-detection.min.js",
    "https://unpkg.com/@tensorflow-models/face-detection@1.0.3/dist/face-detection.min.js",
  ],
  mesh: [
    "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@1.0.6/dist/face-landmarks-detection.min.js",
    "https://unpkg.com/@tensorflow-models/face-landmarks-detection@1.0.6/dist/face-landmarks-detection.min.js",
  ],
}

declare global {
  interface Window {
    tf?: typeof tf
    faceDetection?: any
    faceLandmarksDetection?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required."))
  if (ready()) return Promise.resolve()

  const existing = scriptLoads.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-face-src="${src}"]`,
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
      else reject(new Error("Face AI runtime loaded without its API."))
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error("Face AI runtime could not be loaded."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    if (!current) {
      script.async = true
      script.src = src
      script.dataset.pixiuFaceSrc = src
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

async function ensureRuntime() {
  if (typeof window === "undefined") throw new Error("PIXIU Face AI needs a browser.")
  window.tf = tf
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

  let lastError: unknown = null
  for (const src of FACE_RUNTIME_SOURCES.detector) {
    try {
      await loadScript(src, () => Boolean(window.faceDetection))
      if (window.faceDetection) break
    } catch (error) {
      lastError = error
    }
  }
  if (!window.faceDetection) {
    throw lastError instanceof Error ? lastError : new Error("Face detector runtime could not be loaded.")
  }

  lastError = null
  for (const src of FACE_RUNTIME_SOURCES.mesh) {
    try {
      await loadScript(src, () => Boolean(window.faceLandmarksDetection))
      if (window.faceLandmarksDetection) break
    } catch (error) {
      lastError = error
    }
  }
  if (!window.faceLandmarksDetection) {
    throw lastError instanceof Error ? lastError : new Error("Face mesh runtime could not be loaded.")
  }
}

function toBox(box: any): [number, number, number, number] {
  return [
    Number(box?.xMin ?? box?.x ?? 0),
    Number(box?.yMin ?? box?.y ?? 0),
    Number(box?.width ?? 0),
    Number(box?.height ?? 0),
  ]
}

function toPoint(point: any): FacePoint {
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
    z: Number(point?.z ?? 0),
    name: typeof point?.name === "string" ? point.name : undefined,
  }
}

function dist(a: FacePoint, b: FacePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 1e-6 ? numerator / denominator : 0
}

// This is intentionally called "expression demo", not medical or affective truth.
// It is geometry derived from the 478-point mesh: smile / surprise / neutral.
export function classifyExpression(points: FacePoint[], box: [number, number, number, number]): FaceEmotion {
  if (points.length < 300) return { emotion: "neutral", score: 0 }

  const width = Math.max(1, box[2])
  const height = Math.max(1, box[3])
  const p = (index: number) => points[index]

  const mouthLeft = p(61), mouthRight = p(291), upperLip = p(13), lowerLip = p(14)
  const leftEyeTop = p(159), leftEyeBottom = p(145)
  const rightEyeTop = p(386), rightEyeBottom = p(374)

  const mouthWidth = mouthLeft && mouthRight ? dist(mouthLeft, mouthRight) : 0
  const mouthOpen = upperLip && lowerLip ? dist(upperLip, lowerLip) : 0
  const leftEyeOpen = leftEyeTop && leftEyeBottom ? dist(leftEyeTop, leftEyeBottom) : 0
  const rightEyeOpen = rightEyeTop && rightEyeBottom ? dist(rightEyeTop, rightEyeBottom) : 0

  const smileScore = Math.min(1, Math.max(0, (mouthWidth / width - 0.28) / 0.16))
  const surpriseScore = Math.min(1, Math.max(0,
    ((mouthOpen / height - 0.08) / 0.16) * 0.6 +
    (((leftEyeOpen + rightEyeOpen) / height - 0.045) / 0.12) * 0.4,
  ))

  if (surpriseScore >= 0.65) return { emotion: "surprised", score: surpriseScore }
  if (smileScore >= 0.62) return { emotion: "happy", score: smileScore }
  return { emotion: "neutral", score: Math.max(0.5, 1 - Math.max(smileScore, surpriseScore)) }
}

export function getTopEmotion(emotions: any[]): FaceEmotion | null {
  if (!Array.isArray(emotions) || emotions.length === 0) return null
  return [...emotions]
    .map((entry) => ({
      emotion: String(entry?.emotion ?? "neutral"),
      score: Number(entry?.score ?? 0),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null
}

export async function loadFaceDetector(): Promise<FaceDetector> {
  await ensureRuntime()

  const detector = await window.faceLandmarksDetection.createDetector(
    window.faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
    {
      runtime: "tfjs",
      maxFaces: MAX_FACES,
      // Keep iris/lip refinement enabled so the adapter's 478-point contract
      // matches the MediaPipe FaceMesh refined output used by this UI.
      refineLandmarks: true,
    },
  )

  return {
    version: FACE_VERSION,
    async detect(video) {
      const faces = await detector.estimateFaces(video, {
        flipHorizontal: false,
        staticImageMode: false,
      })

      return faces
        .slice(0, MAX_FACES)
        .map((face: any) => {
          const mesh = Array.isArray(face?.keypoints)
            ? face.keypoints.map(toPoint)
            : []
          const box = toBox(face?.box)
          const expression = classifyExpression(mesh, box)

          return {
            score: Number(face?.score ?? 0),
            box,
            expression: expression.emotion,
            expressionScore: expression.score,
            emotions: [expression],
            mesh,
          }
        })
        .filter((face) => face.score === 0 || face.score >= MIN_FACE_SCORE)
    },
    dispose() {
      detector.dispose?.()
    },
  }
}

export async function detectFaces(detector: FaceDetector, video: HTMLVideoElement) {
  return detector.detect(video)
}

export function disposeFaceDetector(detector: FaceDetector | null) {
  detector?.dispose()
}
