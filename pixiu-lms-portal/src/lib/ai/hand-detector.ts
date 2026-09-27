export type HandPoint = {
  x: number
  y: number
  z: number
  name?: string
}

export type FingerMask = [boolean, boolean, boolean, boolean, boolean]

export type HandDetection = {
  score: number
  boxScore: number
  fingerScore: number
  handedness: string
  box: [number, number, number, number]
  keypoints: HandPoint[]
  extendedFingers: FingerMask
  fingerCount: number
}


export type MediaPipeHandLandmark = { x?: number; y?: number; z?: number; name?: string }
export type MediaPipeHandsResults = {
  multiHandLandmarks?: MediaPipeHandLandmark[][]
  multiHandedness?: Array<{
    classification?: Array<{ displayName?: string; categoryName?: string }>
  }>
}
export type MediaPipeHandsInstance = {
  setOptions: (options: {
    maxNumHands: number
    modelComplexity: number
    minDetectionConfidence: number
    minTrackingConfidence: number
  }) => void
  onResults: (callback: (results: MediaPipeHandsResults) => void) => void
  send: (input: { image: HTMLVideoElement }) => Promise<void>
  close: () => void
  reset?: () => void
}

export type HandDetector = {
  version: string
  detect: (video: HTMLVideoElement) => Promise<HandDetection[]>
  dispose: () => void
  reset?: () => void
}

const HAND_VERSION = "4.0.0"
const MAX_HANDS = 2
const MIN_HAND_SCORE = 0.05
const HANDS_SCRIPT = "/vendor/mediapipe/hands/hands.js"
const HANDS_ASSET_BASE = "/vendor/mediapipe/hands/"

declare global {
  interface Window {
    Hands?: new (options: { locateFile: (file: string) => string }) => MediaPipeHandsInstance
  }
}

let handsScriptPromise: Promise<void> | null = null

function loadHandsScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PIXIU Hand AI needs a browser."))
  }
  if (typeof window.Hands === "function") return Promise.resolve()

  if (handsScriptPromise) return handsScriptPromise

  handsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pixiu-hands-solution="1"]',
    )

    const cleanup = (script: HTMLScriptElement) => {
      script.removeEventListener("load", onLoad)
      script.removeEventListener("error", onError)
    }

    const onLoad = (event?: Event) => {
      const script = (event?.currentTarget as HTMLScriptElement | null) ?? existing
      if (script) cleanup(script)
      if (typeof window.Hands === "function") {
        resolve()
      } else {
        handsScriptPromise = null
        reject(new Error("MediaPipe Hands loaded, but the Hands constructor is unavailable."))
      }
    }

    const onError = (event?: Event) => {
      const script = (event?.currentTarget as HTMLScriptElement | null) ?? existing
      if (script) cleanup(script)
      handsScriptPromise = null
      reject(new Error("MediaPipe Hands script could not be loaded."))
    }

    if (existing) {
      existing.addEventListener("load", onLoad, { once: true })
      existing.addEventListener("error", onError, { once: true })
      if (typeof window.Hands === "function") {
        onLoad()
      }
      return
    }

    const script = document.createElement("script")
    script.async = true
    script.crossOrigin = "anonymous"
    script.src = HANDS_SCRIPT
    script.dataset.pixiuHandsSolution = "1"
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })
    document.head.appendChild(script)

    window.setTimeout(() => {
      if (typeof window.Hands === "function") return
      onError()
    }, 30000)
  })

  return handsScriptPromise
}

function distance(a: HandPoint, b: HandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function angle(a: HandPoint, b: HandPoint, c: HandPoint) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const magnitude =
    Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z)
  if (!magnitude) return 0
  const cosine =
    (ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / magnitude
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
}

function fingerExtended(
  points: HandPoint[],
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number,
) {
  const wrist = points[0]
  const mcp = points[mcpIndex]
  const pip = points[pipIndex]
  const dip = points[dipIndex]
  const tip = points[tipIndex]
  if (!wrist || !mcp || !pip || !dip || !tip) return false

  const pipAngle = angle(mcp, pip, dip)
  const dipAngle = angle(pip, dip, tip)
  const tipDistance = distance(tip, wrist)
  const pipDistance = distance(pip, wrist)
  const pathLength =
    distance(mcp, pip) + distance(pip, dip) + distance(dip, tip)
  const straightness = pathLength > 1e-6 ? distance(mcp, tip) / pathLength : 0

  return (
    pipAngle >= 135 &&
    dipAngle >= 130 &&
    tipDistance >= pipDistance * 1.01 &&
    straightness >= 0.68
  )
}

function thumbExtended(points: HandPoint[]) {
  const wrist = points[0]
  const cmc = points[1]
  const mcp = points[2]
  const ip = points[3]
  const tip = points[4]
  const indexMcp = points[5]
  if (!wrist || !cmc || !mcp || !ip || !tip || !indexMcp) return false

  const ipAngle = angle(mcp, ip, tip)
  const tipDistance = distance(tip, wrist)
  const ipDistance = distance(ip, wrist)
  const lateral = distance(tip, indexMcp)
  const ipLateral = distance(ip, indexMcp)

  return (
    ipAngle >= 125 &&
    tipDistance >= ipDistance * 1.005 &&
    lateral >= ipLateral * 0.9
  )
}

export function getExtendedFingerMask(points: HandPoint[]): FingerMask {
  if (points.length < 21) return [false, false, false, false, false]
  return [
    thumbExtended(points),
    fingerExtended(points, 5, 6, 7, 8),
    fingerExtended(points, 9, 10, 11, 12),
    fingerExtended(points, 13, 14, 15, 16),
    fingerExtended(points, 17, 18, 19, 20),
  ]
}

export function countExtendedFingers(points: HandPoint[]) {
  return getExtendedFingerMask(points).filter(Boolean).length
}

function toPoint(point: MediaPipeHandLandmark, point3d?: MediaPipeHandLandmark): HandPoint {
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
    z: Number(point3d?.z ?? point?.z ?? 0),
    name: typeof point?.name === "string" ? point.name : undefined,
  }
}

function toBoxFromPoints(
  points: HandPoint[],
): [number, number, number, number] {
  if (!points.length) return [0, 0, 0, 0]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return [minX, minY, Math.max(0, maxX - minX), Math.max(0, maxY - minY)]
}

function normalizeHandResult(hand: { keypoints: MediaPipeHandLandmark[]; keypoints3D?: MediaPipeHandLandmark[]; score?: number; handedness?: string; handednesses?: Array<{ classification?: Array<{ displayName?: string; categoryName?: string }> }> }): HandDetection {
  const keypoints = Array.isArray(hand?.keypoints)
    ? hand.keypoints.map((point: MediaPipeHandLandmark, index: number) =>
        toPoint(point, hand?.keypoints3D?.[index]),
      )
    : []

  const scoreValue = Number(hand?.score)
  const score =
    Number.isFinite(scoreValue) && scoreValue > 0 ? scoreValue : 1
  const extendedFingers = getExtendedFingerMask(keypoints)
  const handedness =
    String(
      hand?.handedness ??
        hand?.handednesses?.[0]?.displayName ??
        hand?.handednesses?.[0]?.categoryName ??
        "Hand",
    ) || "Hand"

  return {
    score,
    boxScore: score,
    fingerScore: score,
    handedness,
    box: toBoxFromPoints(keypoints),
    keypoints,
    extendedFingers,
    fingerCount: extendedFingers.filter(Boolean).length,
  }
}

export async function loadHandDetector(
  options: { maxHands?: number } = {},
): Promise<HandDetector> {
  await loadHandsScript()

  const maxHands = Math.max(
    1,
    Math.min(MAX_HANDS, Math.round(options.maxHands ?? MAX_HANDS)),
  )

  const hands = new window.Hands!({
    locateFile: (file) => `${HANDS_ASSET_BASE}${file}`,
  })

  hands.setOptions({
    maxNumHands: maxHands,
    modelComplexity: 1,
    minDetectionConfidence: 0.35,
    minTrackingConfidence: 0.35,
  })

  let disposed = false
  let processing = false
  let pending:
    | {
        resolve: (value: HandDetection[]) => void
        reject: (reason: unknown) => void
      }
    | null = null
  let pendingTimeout: number | null = null
  const clearPendingTimeout = () => {
    if (pendingTimeout !== null) {
      window.clearTimeout(pendingTimeout)
      pendingTimeout = null
    }
  }

  hands.onResults((results: MediaPipeHandsResults) => {
    if (!pending) return
    clearPendingTimeout()

    const normalized = Array.isArray(results?.multiHandLandmarks)
      ? results.multiHandLandmarks
          .slice(0, maxHands)
          .map((landmarks: MediaPipeHandLandmark[], index: number) =>
            normalizeHandResult({
              keypoints: landmarks,
              keypoints3D: results?.multiHandWorldLandmarks?.[index],
              score: Number(
                results?.multiHandedness?.[index]?.score ??
                  results?.multiHandedness?.[index]?.[0]?.score ??
                  1,
              ),
              handedness:
                results?.multiHandedness?.[index]?.displayName ??
                results?.multiHandedness?.[index]?.[0]?.displayName ??
                results?.multiHandedness?.[index]?.categoryName ??
                results?.multiHandedness?.[index]?.[0]?.categoryName ??
                "Hand",
            }),
          )
          .filter((hand: HandDetection) => hand.keypoints.length >= 21 && hand.score >= MIN_HAND_SCORE)
      : []

    const current = pending
    pending = null
    processing = false
    current.resolve(normalized)
  })

  const detect = async (video: HTMLVideoElement) => {
    if (disposed) throw new Error("Hand detector has been disposed.")
    if (processing) return []
    processing = true

    return await new Promise<HandDetection[]>((resolve, reject) => {
      pending = { resolve, reject }
      pendingTimeout = window.setTimeout(() => {
        if (!pending) return
        const current = pending
        pending = null
        processing = false
        pendingTimeout = null
        current.reject(new Error("Hand detection timed out."))
      }, 8000)

      hands.send({ image: video }).catch((error: unknown) => {
        if (!pending) return
        clearPendingTimeout()
        const current = pending
        pending = null
        processing = false
        current.reject(error)
      })
    })
  }

  return {
    version: HAND_VERSION,
    detect,
    dispose() {
      disposed = true
      clearPendingTimeout()
      pending?.resolve([])
      pending = null
      processing = false
      hands.close?.()
    },
    reset() {
      hands.reset?.()
      clearPendingTimeout()
      pending?.resolve([])
      processing = false
      pending = null
    },
  }
}

export async function detectHands(
  detector: HandDetector,
  video: HTMLVideoElement,
) {
  return detector.detect(video)
}

export function disposeHandDetector(detector: HandDetector | null) {
  detector?.dispose()
}
