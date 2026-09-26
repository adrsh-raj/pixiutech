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

const FACE_VERSION = "2.0.0"
const MAX_FACES = 1
const MEDIAPIPE_FACE_VERSION = "0.4.1633559619"

const FACE_RUNTIME_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection@1.0.6/dist/face-landmarks-detection.min.js",
  "https://unpkg.com/@tensorflow-models/face-landmarks-detection@1.0.6/dist/face-landmarks-detection.min.js",
]

const FACE_SOLUTION_SOURCES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_FACE_VERSION}/face_mesh.js`,
  `https://unpkg.com/@mediapipe/face_mesh@${MEDIAPIPE_FACE_VERSION}/face_mesh.js`,
]
declare global {
  interface Window {
    faceLandmarksDetection?: any
    FaceMesh?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string, ready: () => boolean, marker: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required."))
  if (ready()) return Promise.resolve()

  const key = marker + "::" + src
  const existing = scriptLoads.get(key)
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
      else reject(new Error(`Face AI ${marker} loaded without its runtime API.`))
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      if (!current) script.remove()
      reject(new Error(`Face AI ${marker} could not be loaded.`))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    if (!current) {
      script.async = true
      script.crossOrigin = "anonymous"
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

  scriptLoads.set(key, promise)
  promise.catch(() => scriptLoads.delete(key))
  return promise
}

async function ensureRuntime() {
  if (typeof window === "undefined") throw new Error("PIXIU Face AI needs a browser.")

  let lastError: unknown = null
  for (const src of FACE_RUNTIME_SOURCES) {
    try {
      await loadScript(src, () => Boolean(window.faceLandmarksDetection), "detector")
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!window.faceLandmarksDetection) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Face landmarks runtime could not be loaded.")
  }

  let solutionError: unknown = null
  for (const src of FACE_SOLUTION_SOURCES) {
    try {
      await loadScript(src, () => Boolean(window.FaceMesh), "mediapipe")
      break
    } catch (error) {
      solutionError = error
    }
  }

  if (!window.FaceMesh) {
    throw solutionError instanceof Error
      ? solutionError
      : new Error("MediaPipe Face Mesh runtime could not be loaded.")
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
  if (points.length < 200) return { emotion: "neutral", score: 0.35 }

  const width = Math.max(1, box[2])
  const height = Math.max(1, box[3])
  const p = (index: number) => points[index]

  const mouthLeft = p(61)
  const mouthRight = p(291)
  const upperLip = p(13)
  const lowerLip = p(14)
  const leftEyeTop = p(159)
  const leftEyeBottom = p(145)
  const rightEyeTop = p(386)
  const rightEyeBottom = p(374)

  if (!mouthLeft || !mouthRight || !upperLip || !lowerLip) {
    return { emotion: "neutral", score: 0.4 }
  }

  const mouthWidth = dist(mouthLeft, mouthRight)
  const mouthOpen = dist(upperLip, lowerLip)
  const leftEyeOpen = leftEyeTop && leftEyeBottom ? dist(leftEyeTop, leftEyeBottom) : 0
  const rightEyeOpen = rightEyeTop && rightEyeBottom ? dist(rightEyeTop, rightEyeBottom) : 0

  // Normalize by face size so the same expression works at different camera distances.
  const widthRatio = safeRatio(mouthWidth, width)
  const openRatio = safeRatio(mouthOpen, height)
  const eyeRatio = safeRatio(leftEyeOpen + rightEyeOpen, height)

  // In image coordinates y grows downward: lifted smile corners have a
  // smaller y than the lip center.
  const lipCenterY = (upperLip.y + lowerLip.y) / 2
  const cornerCenterY = (mouthLeft.y + mouthRight.y) / 2
  const cornerLift = safeRatio(lipCenterY - cornerCenterY, height)

  const smileBreadth = clamp01((widthRatio - 0.24) / 0.20)
  const smileLift = clamp01((cornerLift + 0.002) / 0.035)
  const smileScore = clamp01(smileBreadth * 0.45 + smileLift * 0.55)

  const mouthSurprise = clamp01((openRatio - 0.035) / 0.10)
  const eyeSurprise = clamp01((eyeRatio - 0.06) / 0.10)
  const surpriseScore = clamp01(mouthSurprise * 0.62 + eyeSurprise * 0.38)

  if (surpriseScore >= 0.64 && openRatio > 0.055) return { emotion: "surprised", score: surpriseScore }
  if (smileScore >= 0.48) return { emotion: "happy", score: smileScore }
  return { emotion: "neutral", score: Math.max(0.45, 1 - Math.max(smileScore, surpriseScore)) }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
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
      runtime: "mediapipe",
      maxFaces: MAX_FACES,
      refineLandmarks: true,
      solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${MEDIAPIPE_FACE_VERSION}`,
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
            score: 1,
            box,
            expression: expression.emotion,
            expressionScore: expression.score,
            emotions: [expression],
            mesh,
          }
        })
        .filter((face) => face.mesh.length >= 200)
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
