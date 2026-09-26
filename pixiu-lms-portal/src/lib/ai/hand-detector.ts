import * as tf from "@tensorflow/tfjs"

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

export type HandDetector = {
  version: string
  detect: (video: HTMLVideoElement) => Promise<HandDetection[]>
  dispose: () => void
}

const HAND_VERSION = "2.0.1"
const MAX_HANDS = 2
const MIN_HAND_SCORE = 0.5
const HAND_RUNTIME_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection@2.0.1/dist/hand-pose-detection.min.js",
  "https://unpkg.com/@tensorflow-models/hand-pose-detection@2.0.1/dist/hand-pose-detection.min.js",
]

declare global {
  interface Window {
    tf?: typeof tf
    handPoseDetection?: any
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PIXIU Hand AI needs a browser."))
  }
  if (window.handPoseDetection) return Promise.resolve()

  const existing = scriptLoads.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-hand-src="${src}"]`,
    )
    if (current && window.handPoseDetection) {
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
      if (window.handPoseDetection) resolve()
      else reject(new Error("Hand pose runtime loaded without its API."))
    }
    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error("Hand pose runtime could not be loaded."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })

    if (!current) {
      script.async = true
      script.src = src
      script.dataset.pixiuHandSrc = src
      document.head.appendChild(script)
    }

    window.setTimeout(() => {
      if (settled) return
      if (window.handPoseDetection) onLoad()
      else onError()
    }, 30000)
  })

  scriptLoads.set(src, promise)
  promise.catch(() => scriptLoads.delete(src))
  return promise
}

async function ensureRuntime() {
  if (typeof window === "undefined") throw new Error("Browser required.")
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
  for (const src of HAND_RUNTIME_SOURCES) {
    try {
      await loadScript(src)
      if (window.handPoseDetection) return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Hand pose runtime could not be loaded.")
}

const LANDMARK_INDEX = {
  wrist: 0,
  thumbCmc: 1,
  thumbMcp: 2,
  thumbIp: 3,
  thumbTip: 4,
  indexMcp: 5,
  indexPip: 6,
  indexDip: 7,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleDip: 11,
  middleTip: 12,
  ringMcp: 13,
  ringPip: 14,
  ringDip: 15,
  ringTip: 16,
  pinkyMcp: 17,
  pinkyPip: 18,
  pinkyDip: 19,
  pinkyTip: 20,
} as const

function distance(a: HandPoint, b: HandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function angle(a: HandPoint, b: HandPoint, c: HandPoint) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const magnitude = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z)
  if (!magnitude) return 0
  const cosine = (ab.x * cb.x + ab.y * cb.y + ab.z * cb.z) / magnitude
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
}

function fingerExtended(points: HandPoint[], mcp: number, pip: number, dip: number, tip: number) {
  const a = points[mcp], b = points[pip], c = points[dip], d = points[tip], wrist = points[0]
  if (!a || !b || !c || !d || !wrist) return false
  return angle(a, b, c) > 145 && angle(b, c, d) > 145 && distance(d, wrist) > distance(a, wrist) * 1.22
}

function thumbExtended(points: HandPoint[]) {
  const cmc = points[1], mcp = points[2], ip = points[3], tip = points[4], indexMcp = points[5]
  if (!cmc || !mcp || !ip || !tip || !indexMcp) return false
  return angle(cmc, mcp, ip) > 130 && angle(mcp, ip, tip) > 130 &&
    distance(tip, indexMcp) > distance(ip, indexMcp) * 1.05
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

function toPoint(point: any, point3d?: any): HandPoint {
  return {
    x: Number(point?.x ?? 0),
    y: Number(point?.y ?? 0),
    z: Number(point3d?.z ?? point?.z ?? 0),
    name: typeof point?.name === "string" ? point.name : undefined,
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

export async function loadHandDetector(): Promise<HandDetector> {
  await ensureRuntime()

  const detector = await window.handPoseDetection.createDetector(
    window.handPoseDetection.SupportedModels.MediaPipeHands,
    {
      runtime: "tfjs",
      modelType: "full",
      maxHands: MAX_HANDS,
    },
  )

  return {
    version: HAND_VERSION,
    async detect(video) {
      const hands = await detector.estimateHands(video, { flipHorizontal: false })
      return hands
        .filter((hand: any) => Number(hand?.score ?? 0) >= MIN_HAND_SCORE)
        .slice(0, MAX_HANDS)
        .map((hand: any) => {
          const keypoints = Array.isArray(hand?.keypoints)
            ? hand.keypoints.map((point: any, index: number) =>
                toPoint(point, hand?.keypoints3D?.[index]),
              )
            : []
          const extendedFingers = getExtendedFingerMask(keypoints)
          return {
            score: Number(hand?.score ?? 0),
            boxScore: Number(hand?.score ?? 0),
            fingerScore: Number(hand?.score ?? 0),
            handedness: String(hand?.handedness ?? "Hand"),
            box: toBox(hand?.box),
            keypoints,
            extendedFingers,
            fingerCount: extendedFingers.filter(Boolean).length,
          }
        })
    },
    dispose() {
      detector.dispose?.()
    },
  }
}

export async function detectHands(detector: HandDetector, video: HTMLVideoElement) {
  return detector.detect(video)
}

export function disposeHandDetector(detector: HandDetector | null) {
  detector?.dispose()
}
