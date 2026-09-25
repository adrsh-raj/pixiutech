import { createHuman, disposeHuman, HUMAN_VERSION } from "./human-runtime"

export type FacePoint = {
  x: number
  y: number
  z?: number
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

const MAX_FACES = 3
const MIN_FACE_SCORE = 0.45

function toBox(box: any): [number, number, number, number] {
  return [
    Number(box?.[0] ?? box?.x ?? 0),
    Number(box?.[1] ?? box?.y ?? 0),
    Number(box?.[2] ?? box?.width ?? 0),
    Number(box?.[3] ?? box?.height ?? 0),
  ]
}

function toMeshPoint(point: any): FacePoint {
  return {
    x: Number(point?.[0] ?? point?.x ?? 0),
    y: Number(point?.[1] ?? point?.y ?? 0),
    z: Number(point?.[2] ?? point?.z ?? 0),
  }
}

export function getTopEmotion(emotions: any[]): FaceEmotion | null {
  if (!Array.isArray(emotions) || emotions.length === 0) return null

  const sorted = [...emotions]
    .map((entry) => ({
      emotion: String(entry?.emotion ?? "neutral"),
      score: Number(entry?.score ?? 0),
    }))
    .sort((a, b) => b.score - a.score)

  return sorted[0] ?? null
}

export async function loadFaceDetector(): Promise<FaceDetector> {
  const human = await createHuman({
    face: {
      enabled: true,
      detector: {
        enabled: true,
        rotation: false,
        maxDetected: MAX_FACES,
        minConfidence: MIN_FACE_SCORE,
        minSize: 60,
        iouThreshold: 0.2,
        skipFrames: 1,
        skipTime: 180,
        return: false,
      },
      mesh: {
        enabled: true,
        skipFrames: 1,
        skipTime: 180,
      },
      iris: { enabled: false },
      description: { enabled: false },
      emotion: {
        enabled: true,
        minConfidence: 0.1,
        skipFrames: 2,
        skipTime: 450,
        modelPath: "emotion.json",
      },
      antispoof: { enabled: false },
      liveness: { enabled: false },
    },
  })

  return {
    version: HUMAN_VERSION,
    async detect(video) {
      const result = await human.detect(video)
      const rawFaces = Array.isArray(result?.face) ? result.face : []

      return rawFaces.slice(0, MAX_FACES)
        .map((face: any) => {
          const emotion = getTopEmotion(face?.emotion)
          return {
            score: Number(face?.score ?? face?.detector?.score ?? 0),
            box: toBox(face?.box),
            expression: emotion?.emotion ?? "neutral",
            expressionScore: emotion?.score ?? 0,
            emotions: Array.isArray(face?.emotion)
              ? face.emotion.map((item: any) => ({
                  emotion: String(item?.emotion ?? "neutral"),
                  score: Number(item?.score ?? 0),
                }))
              : [],
            mesh: Array.isArray(face?.mesh) ? face.mesh.map(toMeshPoint) : [],
          }
        })
        .filter((face) => face.score >= MIN_FACE_SCORE)
    },
    dispose() {
      disposeHuman(human)
    },
  }
}

export async function detectFaces(detector: FaceDetector, video: HTMLVideoElement): Promise<FaceDetection[]> {
  return detector.detect(video)
}

export function disposeFaceDetector(detector: FaceDetector | null) {
  detector?.dispose()
}
