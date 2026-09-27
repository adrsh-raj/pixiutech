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
  reset?: () => void
}

const FACE_VERSION = "3.0.0"
const MAX_FACES = 1
const FACE_MESH_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js"
const FACE_MESH_ASSET_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/"

declare global {
  interface Window {
    FaceMesh?: any
  }
}

let faceScriptPromise: Promise<void> | null = null

function loadFaceMeshScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PIXIU Face AI needs a browser."))
  }
  if (typeof window.FaceMesh === "function") return Promise.resolve()
  if (faceScriptPromise) return faceScriptPromise

  faceScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pixiu-face-mesh-solution="1"]',
    )

    const cleanup = (script: HTMLScriptElement) => {
      script.removeEventListener("load", onLoad)
      script.removeEventListener("error", onError)
    }

    const onLoad = (event?: Event) => {
      const script = (event?.currentTarget as HTMLScriptElement | null) ?? existing
      if (script) cleanup(script)
      if (typeof window.FaceMesh === "function") {
        resolve()
      } else {
        faceScriptPromise = null
        reject(new Error("MediaPipe Face Mesh loaded, but the FaceMesh constructor is unavailable."))
      }
    }

    const onError = (event?: Event) => {
      const script = (event?.currentTarget as HTMLScriptElement | null) ?? existing
      if (script) cleanup(script)
      faceScriptPromise = null
      reject(new Error("MediaPipe Face Mesh script could not be loaded."))
    }

    if (existing) {
      existing.addEventListener("load", onLoad, { once: true })
      existing.addEventListener("error", onError, { once: true })
      if (typeof window.FaceMesh === "function") onLoad()
      return
    }

    const script = document.createElement("script")
    script.async = true
    script.crossOrigin = "anonymous"
    script.src = FACE_MESH_SCRIPT
    script.dataset.pixiuFaceMeshSolution = "1"
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    document.head.appendChild(script)

    window.setTimeout(() => {
      if (typeof window.FaceMesh === "function") return
      onError()
    }, 30000)
  })

  return faceScriptPromise
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 1e-6 ? numerator / denominator : 0
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function distance(a: FacePoint, b: FacePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function classifyExpression(
  points: FacePoint[],
  box: [number, number, number, number],
): FaceEmotion {
  if (points.length < 200) return { emotion: "neutral", score: 0.35 }

  const width = Math.max(
    1,
    box[2] || Math.max(...points.map((point) => point.x)) -
      Math.min(...points.map((point) => point.x)),
  )
  const height = Math.max(
    1,
    box[3] || Math.max(...points.map((point) => point.y)) -
      Math.min(...points.map((point) => point.y)),
  )
  const p = (index: number) => points[index]

  const leftCorner = p(61)
  const rightCorner = p(291)
  const upperLip = p(13)
  const lowerLip = p(14)
  const leftEyeTop = p(159)
  const leftEyeBottom = p(145)
  const rightEyeTop = p(386)
  const rightEyeBottom = p(374)

  if (!leftCorner || !rightCorner || !upperLip || !lowerLip) {
    return { emotion: "neutral", score: 0.4 }
  }

  const mouthWidth = Math.abs(rightCorner.x - leftCorner.x)
  const mouthOpen = Math.abs(lowerLip.y - upperLip.y)
  const leftEyeOpen =
    leftEyeTop && leftEyeBottom
      ? Math.abs(leftEyeBottom.y - leftEyeTop.y)
      : 0
  const rightEyeOpen =
    rightEyeTop && rightEyeBottom
      ? Math.abs(rightEyeBottom.y - rightEyeTop.y)
      : 0

  const widthRatio = safeRatio(mouthWidth, width)
  const openRatio = safeRatio(mouthOpen, height)
  const eyeRatio = safeRatio((leftEyeOpen + rightEyeOpen) / 2, height)

  const lipCenterY = (upperLip.y + lowerLip.y) / 2
  const cornerCenterY = (leftCorner.y + rightCorner.y) / 2
  const cornerLiftRatio = safeRatio(lipCenterY - cornerCenterY, height)

  const smileBreadth = clamp01((widthRatio - 0.22) / 0.18)
  const smileLift = clamp01((cornerLiftRatio + 0.001) / 0.028)
  const smileScore = clamp01(smileBreadth * 0.42 + smileLift * 0.58)

  const mouthOpenScore = clamp01((openRatio - 0.045) / 0.10)
  const eyeOpenScore = clamp01((eyeRatio - 0.055) / 0.09)
  const surpriseScore = clamp01(mouthOpenScore * 0.65 + eyeOpenScore * 0.35)

  if (surpriseScore >= 0.68 && openRatio >= 0.06) {
    return { emotion: "surprised", score: surpriseScore }
  }
  if (smileScore >= 0.45) {
    return { emotion: "happy", score: smileScore }
  }

  const neutralScore = Math.max(0.45, 1 - Math.max(smileScore, surpriseScore))
  return { emotion: "neutral", score: neutralScore }
}

function boundsFromMesh(mesh: FacePoint[]): [number, number, number, number] {
  if (!mesh.length) return [0, 0, 0, 0]
  const xs = mesh.map((point) => point.x)
  const ys = mesh.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return [minX, minY, Math.max(0, maxX - minX), Math.max(0, maxY - minY)]
}

export async function loadFaceDetector(): Promise<FaceDetector> {
  await loadFaceMeshScript()

  const faceMesh = new window.FaceMesh({
    locateFile: (file: string) => `${FACE_MESH_ASSET_BASE}${file}`,
  })

  faceMesh.setOptions({
    maxNumFaces: MAX_FACES,
    refineLandmarks: true,
    minDetectionConfidence: 0.35,
    minTrackingConfidence: 0.35,
  })

  let disposed = false
  let processing = false
  let pending:
    | {
        resolve: (value: FaceDetection[]) => void
        reject: (reason: unknown) => void
      }
    | null = null

  faceMesh.onResults((results: any) => {
    if (!pending) return

    const detections: FaceDetection[] = (
      Array.isArray(results?.multiFaceLandmarks)
        ? results.multiFaceLandmarks
        : []
    )
      .slice(0, MAX_FACES)
      .map((landmarks: any[]) => {
        const mesh = landmarks.map(toPoint)
        const box = boundsFromMesh(mesh)
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
      .filter((face: FaceDetection) => face.mesh.length >= 200)

    const current = pending
    pending = null
    processing = false
    current.resolve(detections)
  })

  const detect = async (video: HTMLVideoElement) => {
    if (disposed) throw new Error("Face detector has been disposed.")
    if (processing) return []
    processing = true

    return await new Promise<FaceDetection[]>((resolve, reject) => {
      pending = { resolve, reject }
      faceMesh.send({ image: video }).catch((error: unknown) => {
        if (!pending) return
        const current = pending
        pending = null
        processing = false
        current.reject(error)
      })
    })
  }

  return {
    version: FACE_VERSION,
    detect,
    dispose() {
      disposed = true
      pending?.resolve([])
      pending = null
      processing = false
      faceMesh.close?.()
    },
    reset() {
      faceMesh.reset?.()
      processing = false
      pending = null
    },
  }
}

function toPoint(point: any): FacePoint {
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
    z: Number(point?.z ?? 0),
    name: typeof point?.name === "string" ? point.name : undefined,
  }
}

export async function detectFaces(
  detector: FaceDetector,
  video: HTMLVideoElement,
) {
  return detector.detect(video)
}

export function disposeFaceDetector(detector: FaceDetector | null) {
  detector?.dispose()
}
