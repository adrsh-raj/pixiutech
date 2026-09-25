import { createHuman, disposeHuman, HUMAN_VERSION } from "./human-runtime"

export type HandPoint = {
  x: number
  y: number
  z: number
  name?: string
}

export type HandDetection = {
  score: number
  boxScore: number
  fingerScore: number
  handedness: string
  box: [number, number, number, number]
  keypoints: HandPoint[]
  fingerCount: number
}

export type HandDetector = {
  version: string
  detect: (video: HTMLVideoElement) => Promise<HandDetection[]>
  dispose: () => void
}

const MIN_HAND_SCORE = 0.5
const MAX_HANDS = 2

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

function pointDistance(a: HandPoint, b: HandPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
}

function jointAngle(a: HandPoint, b: HandPoint, c: HandPoint) {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z
  const mag = Math.hypot(ab.x, ab.y, ab.z) * Math.hypot(cb.x, cb.y, cb.z)
  if (!mag) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI)
}

function isFingerExtended(
  points: HandPoint[],
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
) {
  const pMcp = points[mcp]
  const pPip = points[pip]
  const pDip = points[dip]
  const pTip = points[tip]
  const pWrist = points[LANDMARK_INDEX.wrist]
  if (!pMcp || !pPip || !pDip || !pTip || !pWrist) return false

  const pipAngle = jointAngle(pMcp, pPip, pDip)
  const dipAngle = jointAngle(pPip, pDip, pTip)
  const radial = pointDistance(pTip, pWrist)
  const base = pointDistance(pMcp, pWrist)

  return pipAngle > 145 && dipAngle > 145 && radial > base * 1.25
}

function isThumbExtended(points: HandPoint[]) {
  const cmc = points[LANDMARK_INDEX.thumbCmc]
  const mcp = points[LANDMARK_INDEX.thumbMcp]
  const ip = points[LANDMARK_INDEX.thumbIp]
  const tip = points[LANDMARK_INDEX.thumbTip]
  const indexMcp = points[LANDMARK_INDEX.indexMcp]
  if (!cmc || !mcp || !ip || !tip || !indexMcp) return false

  const mcpAngle = jointAngle(cmc, mcp, ip)
  const ipAngle = jointAngle(mcp, ip, tip)
  return (
    mcpAngle > 135 &&
    ipAngle > 135 &&
    pointDistance(tip, indexMcp) > pointDistance(ip, indexMcp) * 1.12
  )
}

export function countExtendedFingers(points: HandPoint[]) {
  if (points.length < 21) return 0

  let count = 0
  if (isThumbExtended(points)) count += 1
  if (isFingerExtended(points, LANDMARK_INDEX.indexMcp, LANDMARK_INDEX.indexPip, LANDMARK_INDEX.indexDip, LANDMARK_INDEX.indexTip)) count += 1
  if (isFingerExtended(points, LANDMARK_INDEX.middleMcp, LANDMARK_INDEX.middlePip, LANDMARK_INDEX.middleDip, LANDMARK_INDEX.middleTip)) count += 1
  if (isFingerExtended(points, LANDMARK_INDEX.ringMcp, LANDMARK_INDEX.ringPip, LANDMARK_INDEX.ringDip, LANDMARK_INDEX.ringTip)) count += 1
  if (isFingerExtended(points, LANDMARK_INDEX.pinkyMcp, LANDMARK_INDEX.pinkyPip, LANDMARK_INDEX.pinkyDip, LANDMARK_INDEX.pinkyTip)) count += 1
  return count
}

function toPoint(point: any): HandPoint {
  return {
    x: Number(point?.x ?? point?.[0] ?? 0),
    y: Number(point?.y ?? point?.[1] ?? 0),
    z: Number(point?.z ?? point?.[2] ?? 0),
    name: typeof point?.name === "string" ? point.name : undefined,
  }
}

function toBox(box: any): [number, number, number, number] {
  return [
    Number(box?.[0] ?? box?.x ?? 0),
    Number(box?.[1] ?? box?.y ?? 0),
    Number(box?.[2] ?? box?.width ?? 0),
    Number(box?.[3] ?? box?.height ?? 0),
  ]
}

export async function loadHandDetector(): Promise<HandDetector> {
  const human = await createHuman({
    hand: {
      enabled: true,
      rotation: false,
      maxDetected: MAX_HANDS,
      minConfidence: MIN_HAND_SCORE,
      iouThreshold: 0.2,
      landmarks: true,
      skipFrames: 1,
      skipTime: 120,
      detector: { modelPath: "handtrack.json" },
      skeleton: { modelPath: "handlandmark-lite.json" },
    },
  })

  return {
    version: HUMAN_VERSION,
    async detect(video) {
      const result = await human.detect(video)
      const rawHands = Array.isArray(result?.hand) ? result.hand : []

      return rawHands.slice(0, MAX_HANDS).map((hand: any) => {
        const keypoints = Array.isArray(hand?.keypoints)
          ? hand.keypoints.map(toPoint)
          : []

        return {
          score: Number(hand?.score ?? 0),
          boxScore: Number(hand?.boxScore ?? hand?.score ?? 0),
          fingerScore: Number(hand?.fingerScore ?? hand?.score ?? 0),
          handedness: String(hand?.label ?? hand?.handedness ?? "hand"),
          box: toBox(hand?.box),
          keypoints,
          fingerCount: countExtendedFingers(keypoints),
        }
      })
    },
    dispose() {
      disposeHuman(human)
    },
  }
}

export function disposeHandDetector(detector: HandDetector | null) {
  detector?.dispose()
}
