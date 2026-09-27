"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  BookOpen,
  Brain,
  Camera,
  CameraOff,
  CheckCircle2,
  Info,
  Layers3,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Mic,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react"
import {
  addAiClass,
  addAiSample,
  clearAiStudioStore,
  disposeActiveAiModel,
  getActiveAiModel,
  getAiClasses,
  getAiDatasetStats,
  getModelWeightPreview,
  getModelWeightShapes,
  getSampleAddError,
  getSampleCounts,
  loadAiStudioStore,
  loadStoredAiModel,
  optimizeAiImage,
  predictAiImage,
  predictAiVideo,
  removeAiClass,
  removeAiSample,
  renameAiClass,
  saveAiStudioStore,
  estimateTrainingLoad,
  AI_TRAINING_PROFILES,
  trainAiModel,
  type AiLayerSpec,
  type AiTrainingHistoryPoint,
  type AiStudioStore, type AiTrainingProfile,
} from "@/lib/ai-studio-engine"
import { MY_AI_FEATURE_SIZE } from "@/lib/ai/my-ai-feature-extractor"
import {
  captureVideoFrame,
  startCamera,
  stopCamera,
} from "@/lib/ai/camera-session"
import {
  detectHands,
  disposeHandDetector,
  loadHandDetector,
  type HandDetection,
} from "@/lib/ai/hand-detector"
import { interpretHandGesture } from "@/lib/ai/gesture-interpreter"
import {
  detectFaces,
  disposeFaceDetector,
  loadFaceDetector,
  type FaceDetection,
} from "@/lib/ai/face-detector"
import {
  loadSoundRecognizer,
  stopSoundRecognizer,
  type SoundRecognizer,
} from "@/lib/ai/sound-detector"
import {
  COCO_SSD_CLASSES,
  DEFAULT_OBJECT_MAX_BOXES,
  DEFAULT_OBJECT_MIN_SCORE,
  detectObjects,
  disposeObjectDetector,
  loadObjectDetector,
} from "@/lib/ai/object-detector"
import {
  disposeMoveNet,
  estimateMoveNetPose,
  loadMoveNet,
} from "@/lib/ai/pose-detector"
import type { AiVisionMode, ReadyAiMode, AiVisionState } from "@/lib/ai/vision-types"
import { createAiVisionState } from "@/lib/ai/vision-state"
import {
  classifyAiRuntimeError,
  runtimeDetail,
  type AiRuntimeStatus,
} from "@/lib/ai/ai-runtime-state"
import {
  AI_PERFORMANCE_BUDGETS,
  createAiRuntimeMetrics,
  isBudgetExceeded,
  type AiRuntimeMetrics,
} from "@/lib/ai/ai-performance"
import "./pixiu-brand.css"

export type { AiVisionState, ReadyAiMode }

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning?: boolean
  runtimeEnabled?: boolean
  compact?: boolean
  onStartSim?: () => void
  onGoToSimulation?: () => void
  requestedMode?: ReadyAiMode | "trained" | null
  onRequestedModeHandled?: () => void
}

type Tab = "try" | "teach" | "understand"
type ReadyResource = any

const OBJECT_MIN_SCORE = DEFAULT_OBJECT_MIN_SCORE
const OBJECT_MAX_BOXES = DEFAULT_OBJECT_MAX_BOXES

function formatDecisionReason(reason: AiVisionState["decisionReason"]) {
  if (reason === "no_input") return "No usable input"
  if (reason === "low_confidence") return "Below confidence threshold"
  if (reason === "ambiguous") return "Top classes are too close"
  return "Accepted"
}

function explainCurrentAiResult(
  state: AiVisionState,
  modelSummary: AiStudioStore["model"],
) {
  const threshold = state.confidenceThreshold ?? 60
  if (!state.enabled || state.detectedClass === "none") {
    return "No input is being accepted right now. Start the required camera or microphone and provide a clear example."
  }

  if (state.unknown) {
    const reason = state.decisionReason === "ambiguous"
      ? "the top candidates are too close to one another"
      : "the confidence is below the acceptance threshold"
    return "AI returned UNKNOWN because " + reason + ". The normalized bridge does not present this result as a detected class."
  }

  if (state.mode === "trained" && state.probabilities && modelSummary) {
    const ranked = Object.entries(state.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const top = ranked.map(([name, value]) => name + " " + value + "%").join(" · ")
    return "My AI used the frozen feature extractor plus its trained classifier head. Top scores: " + top + ". The result is accepted at " + state.confidence + "% because it clears the " + threshold + "% threshold."
  }

  if (state.mode === "numbers") {
    return "6G first reads the 21 hand landmarks, converts them to extended-finger geometry, then uses short temporal smoothing. Current gesture: " + (state.detectedGesture ?? "none") + "."
  }

  if (state.mode === "hands") {
    return "6D uses the detected hand landmarks and handedness. Finger counts are derived from landmark geometry rather than a separate image classifier."
  }

  if (state.mode === "objects") {
    return "6B ranks the visible object candidates produced by COCO-SSD. The normalized bridge exposes the top accepted label and confidence to Blockly."
  }

  if (state.mode === "pose") {
    return "6C uses MoveNet Lightning keypoint scores. The displayed confidence is based on the visible keypoints that pass the runtime visibility threshold."
  }

  if (state.mode === "emotion") {
    return "6E uses the FaceMesh landmark geometry and the project's expression heuristic. This is an expression demo, not a definitive measurement of a person's internal emotional state."
  }

  if (state.mode === "sound") {
    return "6F compares microphone audio against the browser speech-command vocabulary. Only sufficiently confident actionable words are exposed as recognized commands."
  }

  return "The current AI result is accepted by the active model contract."
}

function mediaPermissionMessage(error: unknown, fallback: string) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : ""

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permission blocked. Allow camera/microphone access for this site, then start AI again."
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No compatible camera or microphone was found."
  }
  if (name === "NotReadableError") {
    return "The camera or microphone is busy in another app or browser tab."
  }
  return fallback
}

const MODES: Array<{ id: ReadyAiMode; title: string; subtitle: string }> = [
  { id: "objects", title: "Objects", subtitle: "COCO-SSD object boxes" },
  { id: "pose", title: "Pose", subtitle: "17 body keypoints" },
  { id: "hands", title: "Fingers", subtitle: "21 hand landmarks" },
  { id: "emotion", title: "Emotion", subtitle: "Expression demo" },
  { id: "sound", title: "Sound", subtitle: "Words + digits" },
  { id: "numbers", title: "Numbers", subtitle: "0–5 + gestures" },
]


function drawBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Array<{ class: string; score: number; bbox: [number, number, number, number] }>,
) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 3
  ctx.font = "700 13px system-ui"

  detections.forEach((detection) => {
    const [x, y, w, h] = detection.bbox
    ctx.strokeStyle = "#a78bfa"
    ctx.strokeRect(x, y, w, h)
    const text = `${detection.class} ${Math.round(detection.score * 100)}%`
    const tw = ctx.measureText(text).width + 12
    ctx.fillStyle = "#a78bfa"
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22)
    ctx.fillStyle = "#0f172a"
    ctx.fillText(text, x + 6, Math.max(15, y - 7))
  })
}

function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, poseResult: { keypoints?: any[] } | null) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const edges = [
    [0, 1], [0, 2], [1, 3], [2, 4], [0, 5], [0, 6],
    [5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11],
    [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  ]

  const pose = poseResult
  if (!pose) return
  ctx.lineWidth = 3
  ctx.strokeStyle = "#22c55e"
  for (const [aIndex, bIndex] of edges) {
    const a = pose.keypoints?.[aIndex]
    const b = pose.keypoints?.[bIndex]
    if (!a || !b || (a.score ?? 0) < 0.25 || (b.score ?? 0) < 0.25) continue
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  ctx.fillStyle = "#f8fafc"
  for (const point of pose.keypoints ?? []) {
    if ((point.score ?? 0) < 0.25) continue
    ctx.beginPath()
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHands(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  hands: HandDetection[],
) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 3
  ctx.strokeStyle = "#38bdf8"
  ctx.fillStyle = "#e0f2fe"
  ctx.font = "700 12px system-ui"

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
  ]

  hands.forEach((hand) => {
    edges.forEach(([a, b]) => {
      const p1 = hand.keypoints[a]
      const p2 = hand.keypoints[b]
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    })

    for (const point of hand.keypoints) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    const [x, y, w, h] = hand.box
    if (w > 0 && h > 0) {
      ctx.strokeRect(x, y, w, h)
      const label = `${hand.handedness} · ${hand.fingerCount} fingers · ${Math.round(hand.score * 100)}%`
      const tw = ctx.measureText(label).width + 12
      ctx.fillStyle = "#38bdf8"
      ctx.fillRect(x, Math.max(0, y - 22), tw, 22)
      ctx.fillStyle = "#0f172a"
      ctx.fillText(label, x + 6, Math.max(15, y - 7))
      ctx.fillStyle = "#e0f2fe"
    }
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Image could not be read."))
    }
    reader.onerror = () => reject(new Error("Image could not be read."))
    reader.readAsDataURL(file)
  })
}

function drawFaces(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  faces: FaceDetection[],
) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineWidth = 2
  ctx.font = "700 12px system-ui"

  for (const face of faces) {
    const [x, y, w, h] = face.box
    if (w <= 0 || h <= 0) continue

    ctx.strokeStyle = "#f472b6"
    ctx.strokeRect(x, y, w, h)

    if (face.mesh.length) {
      ctx.fillStyle = "rgba(244, 114, 182, 0.75)"
      for (const point of face.mesh) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const label = `${face.expression} · ${Math.round(face.expressionScore * 100)}%`
    const tw = ctx.measureText(label).width + 12
    ctx.fillStyle = "#f472b6"
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22)
    ctx.fillStyle = "#0f172a"
    ctx.fillText(label, x + 6, Math.max(15, y - 7))
  }
}


function metricValues(points: AiTrainingHistoryPoint[], key: "loss"|"valLoss"|"accuracy"|"valAccuracy") {
  return points.map((point) => point[key]).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
}
function metricPath(points: AiTrainingHistoryPoint[], key: "loss"|"valLoss"|"accuracy"|"valAccuracy") {
  const values = metricValues(points, key)
  if (!values.length) return ""
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(0.0001, max - min)
  const width = 520, height = 180, padX = 30, padY = 18
  const plotted = points.map((point,index) => {
    const value = point[key]
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    const x = padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2)
    const y = height - padY - ((value - min) / range) * (height - padY * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).filter((value): value is string => Boolean(value))
  if (plotted.length > 1) return `M ${plotted.join(" L ")}`
  if (plotted.length === 1) return `M ${plotted[0]}`
  return ""
}

function MetricChart({ title, points, primary, secondary, primaryLabel, secondaryLabel }: {
  title: string
  points: AiTrainingHistoryPoint[]
  primary: "loss" | "accuracy"
  secondary: "valLoss" | "valAccuracy"
  primaryLabel: string
  secondaryLabel: string
}) {
  if (!points.length) return null
  const latest = points[points.length - 1]
  const hasSecondary = metricValues(points, secondary).length > 0

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black">{title}</p>
        <div className="flex gap-3 text-[8px] font-mono">
          <span className="text-violet-300">● {primaryLabel}</span>
          {hasSecondary ? <span className="text-cyan-300">● {secondaryLabel}</span> : null}
        </div>
      </div>
      <svg viewBox="0 0 520 180" className="mt-2 h-44 w-full" role="img" aria-label={title}>
        <path d={metricPath(points, primary)} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
        {hasSecondary ? <path d={metricPath(points, secondary)} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" /> : null}
      </svg>
      <div className="flex justify-between text-[8px] font-mono text-slate-600"><span>Epoch 1</span><span>Epoch {latest.epoch}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-800 p-2">
          <p className="text-[8px] text-slate-600">{primaryLabel} · latest</p>
          <p className="mt-1 text-xs font-black">{primary === "accuracy" ? Math.round(latest.accuracy * 100) + "%" : latest.loss.toFixed(4)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 p-2">
          <p className="text-[8px] text-slate-600">{secondaryLabel} · latest</p>
          <p className="mt-1 text-xs font-black">
            {secondary === "valAccuracy"
              ? latest.valAccuracy == null
                ? "Not available"
                : Math.round(latest.valAccuracy * 100) + "%"
              : latest.valLoss == null
                ? "Not available"
                : latest.valLoss.toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  )
}

function ConfusionMatrix({ classes, matrix }: { classes: string[]; matrix?: number[][] }) {
  if (!matrix?.length) return null
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black">Validation confusion matrix</p>
        <span className="text-[8px] font-mono text-slate-600">actual → predicted</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-[8px] font-mono">
          <thead>
            <tr>
              <th className="border border-slate-800 px-2 py-1">A/P</th>
              {classes.map((name) => <th key={name} className="border border-slate-800 px-2 py-1">{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={classes[rowIndex]}>
                <th className="border border-slate-800 px-2 py-1 text-left">{classes[rowIndex]}</th>
                {row.map((value, columnIndex) => (
                  <td key={columnIndex} className={"border border-slate-800 px-2 py-1 text-center " + (rowIndex === columnIndex ? "text-emerald-300" : "text-slate-500")}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AiStudioPanel({
  isOpen,
  onClose,
  aiState,
  onAiStateChange,
  isSimRunning = false,
  runtimeEnabled = false,
  compact = false,
  onStartSim,
  onGoToSimulation,
  requestedMode = null,
  onRequestedModeHandled,
}: Props) {
  const [tab, setTab] = useState<Tab>("try")
  const [mode, setMode] = useState<ReadyAiMode | "trained">("objects")
  const [cameraActive, setCameraActive] = useState(false)
  const [soundActive, setSoundActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("AI idle")
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [store, setStore] = useState<AiStudioStore>(() => ({ classes: [], samples: [], model: null }))
  const [model, setModel] = useState<any>(null)
  const [label, setLabel] = useState("")
  const [renamingClass, setRenamingClass] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [training, setTraining] = useState(false)
  const [progress, setProgress] = useState({
    epoch: 0,
    total: 0,
    accuracy: 0,
    loss: 0,
    valAccuracy: null as number | null,
    valLoss: null as number | null,
    stage: "",
  })
  const [trainingHistory, setTrainingHistory] = useState<AiTrainingHistoryPoint[]>([])
  const [trainingProfile, setTrainingProfile] = useState<AiTrainingProfile>("grade6")
  const [advancedTuning, setAdvancedTuning] = useState(false)
  const [customEpochs, setCustomEpochs] = useState(40)
  const [customLayers, setCustomLayers] = useState<AiLayerSpec[]>(() => AI_TRAINING_PROFILES.grade6.layers.map((layer) => ({ ...layer })))
  const [customLearningRate, setCustomLearningRate] = useState(0.001)
  const [customBatchSize, setCustomBatchSize] = useState(8)
  const [customPatience, setCustomPatience] = useState(8)
  const [customMinDelta, setCustomMinDelta] = useState(0.001)

  // Keep separate video/canvas refs for the full Studio and the compact
  // floating runtime window. The same MediaStream can safely feed both, so
  // switching UI state never turns the camera off or loses the overlay target.
  const studioVideoRef = useRef<HTMLVideoElement | null>(null)
  const floatingVideoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const floatingOverlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const resourceRef = useRef<ReadyResource>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const cameraRequestRef = useRef(0)
  const resourceModeRef = useRef<AiVisionMode | null>(null)
  const busyRef = useRef(false)
  const busySessionRef = useRef<number | null>(null)
  const aiStateRef = useRef(aiState)
  useEffect(() => {
    aiStateRef.current = aiState
  }, [aiState])
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])
  const handCountHistoryRef = useRef<number[]>([])
  const handGestureHistoryRef = useRef<string[]>([])
  const emotionHistoryRef = useRef<string[]>([])
  const emptyHandFramesRef = useRef(0)
  const emptyFaceFramesRef = useRef(0)
  const fpsStartRef = useRef(0)
  const fpsFramesRef = useRef(0)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const trainingRunRef = useRef(0)
  const datasetVersionRef = useRef(0)
  const runtimeFailedRef = useRef(false)
  const runtimeStatusRef = useRef<AiRuntimeStatus>("idle")
  const runtimeMetricsRef = useRef<ReturnType<typeof createAiRuntimeMetrics> | null>(null)
  const lastRuntimeMetricsRef = useRef<AiRuntimeMetrics | null>(null)
  const [floatingPosition, setFloatingPosition] = useState<{ left: number; top: number } | null>(null)

  function publishRuntimeState(
    status: AiRuntimeStatus,
    detail = runtimeDetail(mode, status),
    extras: Partial<AiVisionState> = {},
  ) {
    runtimeStatusRef.current = status
    onAiStateChange({
      ...aiStateRef.current,
      mode,
      runtimeStatus: status,
      runtimeError: status === "error" ? extras.runtimeError : undefined,
      runtimeErrorKind: status === "error" ? extras.runtimeErrorKind : undefined,
      detail,
      ...extras,
    })
  }

  const classes = useMemo(() => getAiClasses(store), [store])
  const counts = useMemo(() => getSampleCounts(store.samples), [store.samples])
  const datasetStats = useMemo(() => getAiDatasetStats(store), [store])
  const currentExplanation = explainCurrentAiResult(aiState, store.model)
  const canTrain = datasetStats.ready
  const selectedTrainingConfig = advancedTuning
    ? { epochs: customEpochs, layers: customLayers, learningRate: customLearningRate, batchSize: customBatchSize, earlyStoppingPatience: customPatience, earlyStoppingMinDelta: customMinDelta }
    : AI_TRAINING_PROFILES[trainingProfile === "custom" ? "grade7" : trainingProfile]

  const estimatedTrainingLoad = estimateTrainingLoad(
    selectedTrainingConfig.layers,
    Math.max(2, classes.length),
    store.model?.embeddingSize ?? MY_AI_FEATURE_SIZE,
    selectedTrainingConfig.epochs,
    Math.max(1, store.samples.length),
    selectedTrainingConfig.batchSize,
  )

  useEffect(() => {
    const preset = AI_TRAINING_PROFILES[trainingProfile === "custom" ? "grade7" : trainingProfile]
    setCustomLayers(preset.layers.map((layer) => ({ ...layer })))
    setCustomEpochs(preset.epochs)
    setCustomLearningRate(preset.learningRate)
    setCustomBatchSize(preset.batchSize)
    setCustomPatience(preset.earlyStoppingPatience)
    setCustomMinDelta(preset.earlyStoppingMinDelta)
  }, [trainingProfile])

  function updateCustomLayer(index: number, patch: Partial<AiLayerSpec>) {
    setCustomLayers((current) => current.map((layer, i) => i === index ? { ...layer, ...patch } : layer))
  }
  function addCustomLayer() {
    if (customLayers.length >= 8) return
    setCustomLayers((current) => [...current, { type: "dense", units: 64, activation: "relu" }])
  }
  function removeCustomLayer(index: number) {
    setCustomLayers((current) => current.length <= 1 ? current : current.filter((_, i) => i !== index))
  }
  function moveCustomLayer(index: number, direction: -1 | 1) {
    setCustomLayers((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function commitStore(next: AiStudioStore) {
    datasetVersionRef.current += 1
    setStore(next)
    const persisted = saveAiStudioStore(next)
    if (!persisted) {
      setStatus("Dataset updated for this session, but browser storage is full. Remove some samples and save again.")
    }
  }

  useEffect(() => {
    if (!isOpen) {
      if (!runtimeEnabled) stopAll()
      return
    }
    setTab("try")
    runtimeFailedRef.current = false
    setStore(loadAiStudioStore())
    setLoading(false)
    setError(null)
    setStatus(runtimeEnabled ? "AI runtime active" : "AI idle")
    onAiStateChange(runtimeEnabled ? aiState : createAiVisionState("objects"))
  }, [isOpen])

  function bindExistingCameraToVisibleVideo() {
    if (!streamRef.current) return false
    attachStreamToVisibleVideos()
    return Boolean(getActiveVideo())
  }

  useEffect(() => {
    if (!requestedMode) return

    if (mode !== requestedMode) {
      stopInput()
      setMode(requestedMode)
      setError(null)
      setStatus(
        requestedMode === "sound"
          ? "Sound selected by circuit"
          : requestedMode === "trained"
            ? "My AI selected by circuit"
            : `${MODES.find((item) => item.id === requestedMode)?.title ?? "AI"} selected by circuit`,
      )
    }

    onRequestedModeHandled?.()
  }, [requestedMode])

  useEffect(() => {
    if (runtimeEnabled) {
      if (runtimeFailedRef.current) return
      if (mode === "sound") {
        if (!soundActive) void startSound()
        return
      }

      // The full AI Studio and the compact PiP use the same camera stream but
      // mount different <video> elements. When the UI switches between them,
      // re-attach the existing stream instead of assuming cameraActive means
      // that the newly mounted video already has srcObject.
      if (!cameraActive || !streamRef.current) {
        void openCamera(true)
      } else {
        const frame = window.requestAnimationFrame(() => {
          bindExistingCameraToVisibleVideo()
        })
        return () => window.cancelAnimationFrame(frame)
      }
    } else if (!isOpen) {
      stopAll()
    } else if (!training) {
      stopInput()
    }
  }, [runtimeEnabled, mode, isOpen, compact])

  useEffect(() => {
    if (!store.model) {
      disposeActiveAiModel()
      setModel(null)
      return
    }

    // Training already returns a live model. Do not immediately load the same
    // IndexedDB model again: loadStoredAiModel() disposes the active model,
    // which can turn the just-trained React state into a disposed tensor graph.
    if (model) return

    let cancelled = false
    void loadStoredAiModel(store.model).then((loaded) => {
      if (cancelled) {
        if (loaded && getActiveAiModel() === loaded) {
          disposeActiveAiModel()
        }
        return
      }
      setModel(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [store.model, model])

  function getActiveVideo() {
    return ((compact || !isOpen) ? floatingVideoRef.current : studioVideoRef.current)
      ?? studioVideoRef.current
      ?? floatingVideoRef.current
  }

  function getActiveOverlay() {
    return ((compact || !isOpen) ? floatingOverlayRef.current : overlayRef.current)
      ?? overlayRef.current
      ?? floatingOverlayRef.current
  }

  function attachStreamToVisibleVideos() {
    const stream = streamRef.current
    if (!stream) return

    for (const video of [studioVideoRef.current, floatingVideoRef.current]) {
      if (!video) continue
      if (video.srcObject !== stream) video.srcObject = stream
      void video.play().catch(() => {})
    }
  }

  function clearOverlay() {
    for (const canvas of [overlayRef.current, floatingOverlayRef.current]) {
      if (!canvas) continue
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  function resetFloatingPosition() {
    setFloatingPosition(null)
  }

  function handleFloatingPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleFloatingPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const width = event.currentTarget.offsetWidth || 280
    const height = event.currentTarget.offsetHeight || 190
    const margin = 12
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, event.clientX - drag.offsetX))
    const top = Math.max(56, Math.min(window.innerHeight - height - margin, event.clientY - drag.offsetY))
    setFloatingPosition({ left, top })
  }

  function handleFloatingPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {}
  }

  function stopInference() {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    clearOverlay()
    handCountHistoryRef.current = []
    handGestureHistoryRef.current = []
    emotionHistoryRef.current = []
    emptyHandFramesRef.current = 0
    emptyFaceFramesRef.current = 0
    fpsStartRef.current = 0
    fpsFramesRef.current = 0
    setFps(0)
  }

  function releaseLoadedResource(resourceMode: AiVisionMode | null, resource: ReadyResource) {
    if (!resource) return

    if (resourceMode === "sound") {
      void stopSoundRecognizer(resource as SoundRecognizer)
    } else if (resourceMode === "trained") {
      if (resource !== model) disposeActiveAiModel()
    } else if (resourceMode === "objects") {
      disposeObjectDetector(resource)
    } else if (resourceMode === "pose") {
      disposeMoveNet(resource)
    } else if (resourceMode === "hands" || resourceMode === "numbers") {
      disposeHandDetector(resource)
    } else if (resourceMode === "emotion") {
      disposeFaceDetector(resource)
    }
  }

  function releaseCurrentResource() {
    const resource = resourceRef.current
    const resourceMode = resourceModeRef.current
    resourceRef.current = null
    resourceModeRef.current = null

    if (!resource) return

    if (resourceMode === "trained") {
      disposeActiveAiModel()
      setModel(null)
      return
    }

    releaseLoadedResource(resourceMode, resource)
  }

  function stopCameraStream() {
    const stream = streamRef.current
    if (!stream) return

    stopCamera(studioVideoRef.current, stream)
    stopCamera(floatingVideoRef.current, stream)
    streamRef.current = null
  }

  function stopAll() {
    runtimeFailedRef.current = false
    cameraRequestRef.current += 1
    stopInference()
    releaseCurrentResource()
    stopCameraStream()
    setCameraActive(false)
    setSoundActive(false)
    setLoading(false)
  }

  async function openCamera(withModel = true) {
    const requestId = ++cameraRequestRef.current
    setError(null)
    runtimeStatusRef.current = "loading"
    setStatus("Starting camera...")
    onAiStateChange({
      ...aiStateRef.current,
      mode,
      runtimeStatus: "loading",
      runtimeError: undefined,
      runtimeErrorKind: undefined,
      detail: "Starting camera…",
    })
    stopInference()
    releaseCurrentResource()
    stopCameraStream()
    setCameraActive(false)

    try {
      const video = getActiveVideo()
      if (!video) throw new Error("Camera preview is not mounted.")
      const stream = await startCamera(video)

      if (requestId !== cameraRequestRef.current) {
        stopCamera(video, stream)
        return
      }

      streamRef.current = stream
      attachStreamToVisibleVideos()
      setCameraActive(true)
      runtimeStatusRef.current = withModel ? "loading" : "ready"
      setStatus(withModel ? "Camera live · loading AI" : "Camera live · ready to teach")
      onAiStateChange({
        ...createAiVisionState(mode),
        enabled: true,
        runtimeStatus: withModel ? "loading" : "ready",
        detail: withModel ? "Camera live" : "Teach camera live",
      })
    } catch (cameraError) {
      if (requestId !== cameraRequestRef.current) return
      const message = mediaPermissionMessage(
        cameraError,
        cameraError instanceof Error
          ? cameraError.message
          : "Camera permission was denied or unavailable.",
      )
      const errorKind = classifyAiRuntimeError(cameraError)
      runtimeStatusRef.current = "error"
      setError(message)
      setStatus("Camera unavailable")
      setCameraActive(false)
      onAiStateChange({
        ...createAiVisionState(mode),
        enabled: false,
        runtimeStatus: "error",
        runtimeErrorKind: errorKind,
        runtimeError: message,
        detail: message,
      })
      return
    }

    if (!withModel) return
    if (mode !== "sound" && requestId === cameraRequestRef.current) {
      await startModeResource()
    }
  }

  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1
      sessionRef.current += 1
      trainingRunRef.current += 1
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }

      const stream = streamRef.current
      stopCamera(studioVideoRef.current, stream)
      stopCamera(floatingVideoRef.current, stream)
      streamRef.current = null

      const resource = resourceRef.current
      const resourceMode = resourceModeRef.current
      resourceRef.current = null
      resourceModeRef.current = null

      if (resourceMode === "sound") {
        void stopSoundRecognizer(resource as SoundRecognizer)
      } else if (resourceMode === "trained") {
        disposeActiveAiModel()
      } else if (resourceMode === "objects") {
        disposeObjectDetector(resource)
      } else if (resourceMode === "pose") {
        disposeMoveNet(resource)
      } else if (resourceMode === "hands" || resourceMode === "numbers") {
        disposeHandDetector(resource)
      } else if (resourceMode === "emotion") {
        disposeFaceDetector(resource)
      }
    }
  }, [])

  async function startCameraForMode() {
    await openCamera(true)
  }

  async function startTeachCamera() {
    await openCamera(false)
  }

  async function startModeResource() {
    const activeSession = ++sessionRef.current
    runtimeStatusRef.current = "loading"
    runtimeMetricsRef.current = createAiRuntimeMetrics(String(mode))
    setLoading(true)
    onAiStateChange({
      ...aiStateRef.current,
      mode,
      runtimeStatus: "loading",
      runtimeError: undefined,
      runtimeErrorKind: undefined,
      detail: runtimeDetail(mode, "loading"),
    })

    try {
      let resource: ReadyResource = null

      if (mode === "objects") {
        resource = await loadObjectDetector()
      } else if (mode === "pose") {
        resource = await loadMoveNet()
      } else if (mode === "hands" || mode === "numbers") {
        resource = await loadHandDetector({ maxHands: mode === "numbers" ? 1 : 2 })
      } else if (mode === "emotion") {
        resource = await loadFaceDetector()
      } else if (mode === "trained") {
        if (!store.model) throw new Error("Train My AI first, then start the live test.")
        resource = model ?? await loadStoredAiModel(store.model)
        if (!resource) throw new Error("Saved My AI model could not be loaded. Retrain the model.")
        if (!model) setModel(resource)
      }

      if (activeSession !== sessionRef.current) {
        releaseLoadedResource(mode, resource)
        return
      }

      resourceRef.current = resource
      resourceModeRef.current = mode
      runtimeMetricsRef.current?.markReady()
      lastRuntimeMetricsRef.current = runtimeMetricsRef.current?.snapshot() ?? null
      runtimeStatusRef.current = "ready"
      setLoading(false)
      setStatus(
        mode === "objects" ? "6B Objects ready"
          : mode === "pose" ? "6C Pose ready"
          : mode === "hands" ? "6D Fingers ready"
          : mode === "numbers" ? "6G Numbers ready"
          : mode === "emotion" ? "6E Emotion ready"
          : "6I My AI ready",
      )

      if (mode !== "sound") startInferenceLoop(activeSession)
    } catch (resourceError) {
      if (activeSession !== sessionRef.current) return
      runtimeFailedRef.current = true
      if (mode !== "sound") {
        stopCameraStream()
        setCameraActive(false)
      }
      releaseCurrentResource()
      setLoading(false)
      const message =
        resourceError instanceof Error
          ? resourceError.message
          : "The selected AI could not start."
      const errorKind = classifyAiRuntimeError(resourceError)
      runtimeStatusRef.current = "error"
      setError(message)
      setStatus("AI unavailable")
      onAiStateChange({
        ...createAiVisionState(mode),
        enabled: false,
        runtimeStatus: "error",
        runtimeErrorKind: errorKind,
        runtimeError: message,
        detail: message,
      })
    }
  }

  async function startSound() {
    setError(null)
    stopInference()
    const activeSession = ++sessionRef.current
    setLoading(true)

    try {
      const recognizer = await loadSoundRecognizer()
      if (activeSession !== sessionRef.current) {
        await stopSoundRecognizer(recognizer)
        return
      }

      resourceRef.current = recognizer
      resourceModeRef.current = "sound"
      setLoading(false)
      setSoundActive(true)
      onAiStateChange({
        ...createAiVisionState("sound"),
        enabled: true,
        modelClasses: recognizer.labels,
        detail: "Microphone ready",
      })
      setStatus("6F Sound ready")

      await recognizer.start((result) => {
        if (activeSession !== sessionRef.current) return

        onAiStateChange({
          enabled: true,
          mode: "sound",
          detectedClass: result.label,
          confidence: result.confidence,
          allDetections: [],
          modelClasses: recognizer.labels,
          modelSource: "ready",
          detail: result.isActionable
            ? `Heard “${result.label}” · ${result.confidence}%`
            : result.label === "none"
              ? "Listening…"
              : `Possible “${result.label}” · speak clearly`,
        })
      })

      if (activeSession === sessionRef.current) {
        setStatus("6F Sound listening")
      }
    } catch (soundError) {
      if (activeSession !== sessionRef.current) return
      runtimeFailedRef.current = true
      const failedResource = resourceRef.current
      const failedResourceMode = resourceModeRef.current
      resourceRef.current = null
      resourceModeRef.current = null
      if (failedResource && failedResourceMode === "sound") {
        await stopSoundRecognizer(failedResource as SoundRecognizer)
      }
      setLoading(false)
      setSoundActive(false)
      setError(
        mediaPermissionMessage(
          soundError,
          soundError instanceof Error
            ? soundError.message
            : "Microphone recognition could not start.",
        ),
      )
      setStatus("Sound AI unavailable")
    }
  }

  function startInferenceLoop(activeSession: number) {
    const tick = async () => {
      if (activeSession !== sessionRef.current) return

      if (
        !streamRef.current ||
        !getActiveVideo() ||
        !resourceRef.current ||
        busyRef.current
      ) {
        timerRef.current = window.setTimeout(tick, 150)
        return
      }

      const video = getActiveVideo()
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        timerRef.current = window.setTimeout(tick, 100)
        return
      }

      busyRef.current = true
      busySessionRef.current = activeSession
      const started = performance.now()

      try {
        if (mode === "objects") {
          const predictions = await detectObjects(resourceRef.current, video, {
            maxNumBoxes: OBJECT_MAX_BOXES,
            minScore: OBJECT_MIN_SCORE,
          })
          if (activeSession !== sessionRef.current) return
          // Keep every detection returned by COCO-SSD at/above our live-demo
          // threshold. Do not whitelist classes such as person/car/phone.
          const visible = predictions
          drawBoxes(getActiveOverlay()!, video, visible)
          const primary = visible[0]
          onAiStateChange({
            enabled: true,
            mode: "objects",
            detectedClass: primary?.class ?? "none",
            confidence: primary ? Math.round(primary.score * 100) : 0,
            allDetections: visible,
            modelSource: "ready",
            detail: primary ? `${visible.length} object${visible.length === 1 ? "" : "s"} detected` : "Looking...",
          })
        } else if (mode === "pose") {
          const pose = await estimateMoveNetPose(resourceRef.current, video)
          if (activeSession !== sessionRef.current) return
          drawPose(getActiveOverlay()!, video, pose)
          const visiblePoints = pose?.keypoints?.filter((point: any) => (point.score ?? 0) >= 0.25) ?? []
          const score = visiblePoints.length
            ? visiblePoints.reduce((sum: number, point: any) => sum + Number(point.score ?? 0), 0) / visiblePoints.length
            : 0
          onAiStateChange({
            enabled: true,
            mode: "pose",
            detectedClass: pose ? "person" : "none",
            confidence: Math.round(score * 100),
            allDetections: [],
            modelSource: "ready",
            detail: pose ? `${visiblePoints.length}/17 keypoints tracked` : "No person detected",
          })
        } else if (mode === "hands" || mode === "numbers") {
          const hands: HandDetection[] = await detectHands(resourceRef.current, video)
          if (activeSession !== sessionRef.current) return

          if (hands.length === 0) {
            emptyHandFramesRef.current += 1
            if (emptyHandFramesRef.current >= 4) {
              resourceRef.current?.reset?.()
              emptyHandFramesRef.current = 0
            }
          } else {
            emptyHandFramesRef.current = 0
          }

          drawHands(getActiveOverlay()!, video, hands)
          const hand = hands[0]
          const interpreted = hand ? interpretHandGesture(hand) : null

          if (hand) {
            handCountHistoryRef.current = [...handCountHistoryRef.current, hand.fingerCount].slice(-4)
            if (interpreted) {
              handGestureHistoryRef.current = [
                ...handGestureHistoryRef.current,
                interpreted.gesture,
              ].slice(-4)
            }
          } else {
            handCountHistoryRef.current = []
            handGestureHistoryRef.current = []
          }

          const sortedCounts = [...handCountHistoryRef.current].sort((a, b) => a - b)
          const stableCount = sortedCounts.length
            ? sortedCounts[Math.floor(sortedCounts.length / 2)]
            : 0

          const gestureHistogram = handGestureHistoryRef.current.reduce<Record<string, number>>(
            (histogram, gesture) => {
              histogram[gesture] = (histogram[gesture] ?? 0) + 1
              return histogram
            },
            {},
          )
          const stableGesture =
            Object.entries(gestureHistogram).sort((a, b) => b[1] - a[1])[0]?.[0] ??
            "none"

          onAiStateChange({
            enabled: true,
            mode,
            detectedClass:
              mode === "numbers"
                ? hand
                  ? String(stableCount)
                  : "none"
                : hand
                  ? "hand"
                  : "none",
            confidence:
              mode === "numbers"
                ? interpreted?.confidence ?? (hand ? Math.round(hand.score * 100) : 0)
                : hand
                  ? Math.round(hand.score * 100)
                  : 0,
            allDetections: [],
            detectedGesture: hand ? stableGesture : "none",
            fingerCount: hand ? stableCount : 0,
            handedness: hand?.handedness ?? "none",
            modelClasses:
              mode === "numbers"
                ? ["0", "1", "2", "3", "4", "5"]
                : ["hand"],
            modelSource: "ready",
            detail: hand
              ? mode === "numbers"
                ? stableCount + " finger" + (stableCount === 1 ? "" : "s") + " · " + stableGesture.replace("_", " ") + " · " + hand.handedness
                : hand.handedness + " hand · " + hand.fingerCount + " fingers · " + (interpreted?.gesture.replace("_", " ") ?? "hand")
              : "Show a hand",
          })
        } else if (mode === "emotion") {
          const faces: FaceDetection[] = await detectFaces(resourceRef.current, video)
          if (activeSession !== sessionRef.current) return

          if (faces.length === 0) {
            emptyFaceFramesRef.current += 1
            if (emptyFaceFramesRef.current >= 4) {
              resourceRef.current?.reset?.()
              emptyFaceFramesRef.current = 0
            }
          } else {
            emptyFaceFramesRef.current = 0
          }

          const face = faces[0]

          if (face) {
            emotionHistoryRef.current = [...emotionHistoryRef.current, face.expression].slice(-3)
          } else {
            emotionHistoryRef.current = []
          }

          const histogram = emotionHistoryRef.current.reduce<Record<string, number>>(
            (counts, expression) => {
              counts[expression] = (counts[expression] ?? 0) + 1
              return counts
            },
            {},
          )
          const stableExpression =
            Object.entries(histogram).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none"

          const drawableFaces = faces.map((current, index) =>
            index === 0 ? { ...current, expression: stableExpression } : current,
          )
          drawFaces(getActiveOverlay()!, video, drawableFaces)

          const stableEmotion = face?.emotions.find(
            (emotion) => emotion.emotion === stableExpression,
          )
          const stableConfidence = stableEmotion?.score ?? face?.expressionScore ?? 0

          onAiStateChange({
            enabled: true,
            mode: "emotion",
            detectedClass: face ? stableExpression : "none",
            confidence: face ? Math.round(stableConfidence * 100) : 0,
            allDetections: [],
            modelClasses: ["neutral", "happy", "surprised"],
            modelSource: "ready",
            detail: face
              ? String(faces.length) + " face" + (faces.length === 1 ? "" : "s") + " · " + stableExpression
              : "Show your face",
          })
        } else if (mode === "trained") {
          // Continuous My AI inference stays on the live video path. JPEG/base64
          // capture is reserved for dataset examples and explicit image flows.
          const result = await predictAiVideo(video, store.model)
          if (activeSession !== sessionRef.current) return
          onAiStateChange({
            enabled: true,
            mode: "trained",
            detectedClass: result?.label ?? "none",
            confidence: result?.confidence ?? 0,
            allDetections: [],
            modelClasses: store.model?.classes ?? [],
            modelSource: "trained",
            unknown: result?.unknown ?? true,
            lowConfidence: result?.lowConfidence ?? true,
            confidenceThreshold: result?.threshold ?? store.model?.predictionThreshold ?? 62,
            decisionReason:
              result?.reason === "ambiguous"
                ? "ambiguous"
                : result?.reason === "low_confidence"
                  ? "low_confidence"
                  : result
                    ? "recognized"
                    : "no_input",
            probabilities: result?.probabilities,
            detail: result
              ? result.unknown
                ? "UNKNOWN · " + formatDecisionReason(result.reason)
                : Object.entries(result.probabilities)
                    .map(([key, value]) => key + " " + value + "%")
                    .join(" · ")
              : "Show an example",
          })
          clearOverlay()
        }

        fpsFramesRef.current += 1
        const now = performance.now()
        if (!fpsStartRef.current) fpsStartRef.current = now
        if (now - fpsStartRef.current >= 1000) {
          setFps(Math.round((fpsFramesRef.current * 1000) / (now - fpsStartRef.current)))
          fpsFramesRef.current = 0
          fpsStartRef.current = now
        }

        const elapsed = performance.now() - started
        timerRef.current = window.setTimeout(tick, Math.max(180, 280 - elapsed))
      } catch (inferenceError) {
        if (activeSession === sessionRef.current) {
          setError(
            inferenceError instanceof Error
              ? inferenceError.message
              : "AI inference failed.",
          )
          setStatus("Inference error · retrying")
          timerRef.current = window.setTimeout(tick, 600)
        }
      } finally {
        if (busySessionRef.current === activeSession) {
          busyRef.current = false
          busySessionRef.current = null
        }
      }
    }

    timerRef.current = window.setTimeout(tick, 0)
  }

  function stopInput() {
    runtimeFailedRef.current = false
    cameraRequestRef.current += 1
    stopInference()
    releaseCurrentResource()
    stopCameraStream()
    setCameraActive(false)
    setSoundActive(false)
    setLoading(false)
    onAiStateChange(createAiVisionState(mode))
    setStatus("AI stopped")
  }

  function selectMode(next: ReadyAiMode | "trained") {
    if (training) return
    stopInput()
    setMode(next)
    setError(null)
    setStatus(next === "trained" ? "My AI selected" : `${MODES.find((item) => item.id === next)?.title ?? "AI"} selected`)
  }

  function selectTab(next: Tab) {
    if (training) return
    // A live Blockly AI runtime must keep its active camera/mic session while
    // the Studio is switched between Try/Teach/Understand.
    if (!runtimeEnabled) stopInput()
    setTab(next)
  }

  async function addSampleFromCamera() {
    if (training || runtimeEnabled) return
    if (!label.trim()) {
      setStatus("Enter a concept name first.")
      return
    }

    const addError = getSampleAddError(store, label)
    if (addError) {
      setStatus(addError)
      return
    }

    if (!cameraActive) {
      await startTeachCamera()
      setStatus("Camera ready · click Capture example again.")
      return
    }

    const video = getActiveVideo()
    if (!video) {
      setStatus("Camera preview is not ready.")
      return
    }

    const frame = captureVideoFrame(video, 384)
    if (!frame) {
      setStatus("Start the camera first.")
      return
    }

    try {
      const optimized = await optimizeAiImage(frame, 384, 0.62)
      const before = store.samples.length
      const next = addAiSample(store, label, optimized)
      commitStore(next)
      setLabel("")
      setStatus(
        next.samples.length > before
          ? "Example captured and added."
          : "That example could not be added.",
      )
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : "Could not save the sample.")
    }
  }

  async function importSample(event: ChangeEvent<HTMLInputElement>) {
    if (training || runtimeEnabled) {
      event.target.value = ""
      return
    }

    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 10)
    event.target.value = ""

    if (!files.length || !label.trim()) {
      setStatus("Enter a concept name and choose one or more images.")
      return
    }

    try {
      let next = addAiClass(store, label)
      let added = 0

      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file)
        const optimized = await optimizeAiImage(dataUrl, 384, 0.62)
        const before = next.samples.length
        next = addAiSample(next, label, optimized)
        if (next.samples.length > before) added += 1
      }

      commitStore(next)
      setLabel("")
      setStatus("Imported " + added + " example" + (added === 1 ? "" : "s") + ".")
    } catch (sampleError) {
      setError(sampleError instanceof Error ? sampleError.message : "Could not import those images.")
    }
  }

  async function train() {
    if (!canTrain || training || runtimeEnabled) {
      if (runtimeEnabled && !training) setStatus("Stop the live AI runtime before training My AI.")
      return
    }
    const runId = ++trainingRunRef.current
    const datasetVersion = datasetVersionRef.current
    const trainingSamples = store.samples
    setTraining(true)
    setError(null)
    setTrainingHistory([])
    setProgress({ epoch: 0, total: selectedTrainingConfig.epochs, accuracy: 0, loss: 0, valAccuracy: null, valLoss: null, stage: "Preparing dataset" })

    try {
      const result = await trainAiModel(trainingSamples, {
        profile: advancedTuning ? "custom" : trainingProfile,
        epochs: selectedTrainingConfig.epochs,
        layers: selectedTrainingConfig.layers,
        learningRate: selectedTrainingConfig.learningRate,
        batchSize: selectedTrainingConfig.batchSize,
        earlyStoppingPatience: selectedTrainingConfig.earlyStoppingPatience,
        earlyStoppingMinDelta: selectedTrainingConfig.earlyStoppingMinDelta,
        shouldCancel: () => runId !== trainingRunRef.current || datasetVersion !== datasetVersionRef.current,
        onStage: (stage) => setProgress((current) => ({ ...current, stage })),
        onEpoch: (point) => {
          setTrainingHistory((current) => [...current, point])
          setProgress((current) => ({ ...current, epoch: point.epoch, total: selectedTrainingConfig.epochs, accuracy: point.accuracy, loss: point.loss, valAccuracy: point.valAccuracy, valLoss: point.valLoss, stage: "Training classifier " + point.epoch + "/" + selectedTrainingConfig.epochs }))
        },
      })

      if (runId !== trainingRunRef.current || datasetVersion !== datasetVersionRef.current) {
        if (getActiveAiModel() === result.model) disposeActiveAiModel()
        return
      }

      const next = { ...store, samples: trainingSamples, model: result.summary }
      commitStore(next)
      setModel(result.model)
      setMode("trained")
      setTab("try")
      setStatus("My AI learned " + result.summary.classes.length + " concepts.")
    } catch (trainError) {
      if (runId !== trainingRunRef.current) return
      setError(trainError instanceof Error ? trainError.message : "Training failed.")
    } finally {
      if (runId === trainingRunRef.current) setTraining(false)
    }
  }

  async function resetStudio() {
    if (runtimeEnabled) {
      setStatus("Stop the live AI runtime before resetting My AI.")
      return
    }
    trainingRunRef.current += 1
    datasetVersionRef.current += 1
    stopInput()
    await clearAiStudioStore()
    setStore({ classes: [], samples: [], model: null })
    setModel(null)
    setLabel("")
    setTab("try")
    setMode("objects")
    setStatus("AI Studio reset.")
  }

  if (!isOpen && !runtimeEnabled) return null

  const isSound = mode === "sound"
  const activeTitle =
    mode === "trained" ? "My AI"
      : MODES.find((item) => item.id === mode)?.title ?? "AI"
  const inputActive = isSound ? soundActive : cameraActive

  // Compact is an explicit presentation mode. It must win over isOpen so
  // an automatically opened AI camera can never cover the workspace.
  if (compact || (runtimeEnabled && !isOpen)) {
    const floatingStyle = floatingPosition
      ? { left: floatingPosition.left, top: floatingPosition.top }
      : { right: 16, bottom: 76 }

    return (
      <div
        className="pixiu-ai-floating fixed z-[70] w-[min(300px,calc(100vw-20px))] overflow-hidden rounded-2xl border bg-slate-950/96 text-white shadow-2xl ring-1 ring-black/50 select-none"
        style={floatingStyle}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={handleFloatingPointerUp}
        onPointerCancel={handleFloatingPointerUp}
      >
        <div
          className="pixiu-ai-floating-header flex cursor-move touch-none items-center justify-between border-b bg-slate-950/95 px-3 py-2"
          onPointerDown={handleFloatingPointerDown}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripVertical size={12} className="shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-cyan-200">PIXIU VISION CORE</p>
              <p className="truncate text-[10px] font-black">{activeTitle} · {mode === "sound" ? "MIC" : "CAMERA"}</p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={resetFloatingPosition}
              className="rounded-md px-1.5 py-1 text-[8px] font-mono text-slate-500 hover:bg-slate-800 hover:text-white"
              title="Reset camera position"
            >
              RESET
            </button>
            <span className="pixiu-ai-live-chip rounded-full border px-2 py-1 text-[8px] font-mono">LIVE FEED</span>
          </div>
        </div>

        <div className="relative aspect-video bg-black">
          {mode === "sound" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
              <Mic size={28} className={soundActive ? "text-violet-300 animate-pulse" : "text-slate-500"} />
              <p className="text-[10px] font-black">{aiState.detectedClass === "none" ? "Listening…" : aiState.detectedClass}</p>
              <p className="text-[8px] text-slate-600">{aiState.detail}</p>
            </div>
          ) : (
            <>
              <video ref={floatingVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <canvas ref={floatingOverlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </>
          )}
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-md bg-slate-950/85 px-2 py-1 text-[9px] font-mono">
            {aiState.detectedClass === "none" ? status : aiState.detectedClass + " · " + aiState.confidence + "%"}
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="pixiu-ai-shell fixed inset-0 z-[80] flex h-[100dvh] w-screen items-stretch justify-stretch overflow-hidden bg-slate-950/90">
      <div className="pixiu-ai-window flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#07111f] text-white shadow-2xl shadow-black/60">
        <header className="pixiu-ai-header flex shrink-0 items-center justify-between border-b bg-slate-950/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="pixiu-ai-mark grid h-9 w-9 place-items-center rounded-xl text-violet-300">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-violet-300">PIXIU AI STUDIO</p>
              <h2 className="text-sm font-black sm:text-base">EXPLORE AI · BUILD AI · UNDERSTAND AI</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Minimize AI Studio">
            <X size={17} />
          </button>
        </header>

        <nav className="pixiu-ai-nav flex items-center gap-1 border-b p-2">
          {([
            ["try", "Try", Sparkles],
            ["teach", "Teach", Brain],
            ["understand", "Understand", Layers3],
          ] as const).map(([value, title, Icon]) => (
            <button key={value} onClick={() => selectTab(value)} className={`pixiu-ai-tab flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black ${tab === value ? "pixiu-ai-tab-active" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"}`}>
              <Icon size={13} />{title}
            </button>
          ))}
          <span className="ml-auto hidden text-[9px] font-mono text-slate-600 sm:block">{store.samples.length} examples</span>
        </nav>

        <div className="pixiu-ai-privacy border-b bg-slate-950/40 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono">
            <span className="mr-1 uppercase tracking-[0.16em] text-slate-600">Privacy</span>
            <span className={"rounded-full border px-2 py-1 " + (cameraActive ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300" : "border-slate-800 text-slate-600")}>
              CAMERA · {cameraActive ? "ACTIVE" : "OFF"}
            </span>
            <span className={"rounded-full border px-2 py-1 " + (soundActive ? "border-violet-400/30 bg-violet-400/5 text-violet-300" : "border-slate-800 text-slate-600")}>
              MIC · {soundActive ? "ACTIVE" : "OFF"}
            </span>
            <span className="rounded-full border border-slate-800 px-2 py-1 text-slate-600">DATA · THIS BROWSER</span>
            {(cameraActive || soundActive) && (
              <button
                type="button"
                onClick={stopInput}
                className="ml-auto rounded-full border border-rose-400/20 px-2 py-1 text-rose-300 hover:bg-rose-500/5"
              >
                Stop inputs
              </button>
            )}
            <span className="text-slate-700">No camera/mic stream is sent to the AI backend by this studio.</span>
            {onGoToSimulation && <button type="button" onClick={onGoToSimulation} className="ml-auto rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[9px] font-black text-violet-200 hover:bg-violet-500/20">Go to Simulation</button>}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6">
          {tab === "try" && (
            <div className="mx-auto max-w-none space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {MODES.map((item) => (
                  <button key={item.id} onClick={() => selectMode(item.id)} className={`pixiu-ai-mode-card rounded-2xl border p-3 text-left ${mode === item.id ? "pixiu-ai-mode-selected" : "border-slate-800 bg-slate-950/40"}`}>
                    <p className="pixiu-ai-mode-kicker text-[10px] font-black">{item.title}</p>
                    <p className="mt-1 text-[9px] leading-4 text-slate-600">{item.subtitle}</p>
                  </button>
                ))}
                <button disabled={!store.model} onClick={() => selectMode("trained")} className={`pixiu-ai-mode-card rounded-2xl border p-3 text-left ${mode === "trained" ? "pixiu-ai-mode-selected" : "border-slate-800 bg-slate-950/40"} disabled:opacity-35`}>
                  <p className="text-[10px] font-black">My AI</p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-600">Your trained model</p>
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.55fr_0.85fr] xl:grid-cols-[1.6fr_0.8fr]">
                <div className="pixiu-ai-preview overflow-hidden rounded-3xl border bg-black">
                  <div className="relative aspect-video min-h-[56vh] lg:min-h-[66vh] xl:min-h-[68vh]">
                {loading && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/92 backdrop-blur-sm">
                    <div className="max-w-md px-6 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300 shadow-lg">
                        <Sparkles size={24} className="animate-pulse" />
                      </div>
                      <p className="mt-4 text-sm font-black">PIXIU AI is loading…</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-500">
                        {mode === "numbers" ? "Preparing hand landmarks and finger geometry." : mode === "hands" ? "Preparing hand landmark tracking." : mode === "emotion" ? "Preparing face landmarks and expression analysis." : mode === "pose" ? "Preparing body-pose keypoints." : "Preparing the selected AI model."}
                      </p>
                      <div className="mx-auto mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-400" />
                      </div>
                    </div>
                  </div>
                )}
                    {isSound ? (
                      <div className="flex h-full flex-col items-center justify-center bg-slate-950/90 p-6 text-center">
                        <Mic size={42} className={soundActive ? "text-violet-300 animate-pulse" : "text-slate-600"} />
                        <p className="mt-3 text-sm font-black">{aiState.detectedClass === "none" ? "Ready for a voice command" : aiState.detectedClass}</p>
                        <p className="mt-1 max-w-sm text-[10px] leading-5 text-slate-600">{aiState.detail}</p>
                      </div>
                    ) : (
                      <>
                        <video ref={studioVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                      </>
                    )}
                    {!inputActive && !isSound && (
                      <div className="absolute inset-0 grid place-items-center bg-slate-950/95 p-6 text-center">
                        {isSound ? <Mic size={32} className="mx-auto text-violet-300" /> : <Camera size={32} className="mx-auto text-violet-300" />}
                        <p className="mt-3 text-sm font-black">{isSound ? "Microphone off" : "Camera off"}</p>
                        <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">
                          {isSound
                            ? "Sound AI runs locally in your browser. Try words such as yes, no, go, stop, up, down, left or right."
                            : "6A loads only the selected Ready AI. 6I uses My AI. 6K is the normalized Blockly bridge."}
                        </p>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 z-30 max-w-2xl rounded-2xl border border-cyan-300/20 bg-slate-950/90 px-4 py-3 shadow-xl backdrop-blur-md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-cyan-200">LIVE RESULT</p>
                          <p className="mt-1 truncate text-base font-black text-white sm:text-lg">
                            {aiState.detectedClass === "none"
                              ? isSound
                                ? "Listening…"
                                : mode === "emotion"
                                  ? "No face detected"
                                  : mode === "numbers" || mode === "hands"
                                    ? "No hand detected"
                                    : "No object detected"
                              : mode === "emotion"
                                ? "Person detected · " + String(aiState.detectedClass).replace(/_/g, " ") + " expression"
                                : mode === "numbers" || mode === "hands"
                                  ? String(aiState.fingerCount ?? 0) + " fingers · " + String(aiState.detectedGesture ?? "hand").replace(/_/g, " ")
                                  : String(aiState.detectedClass).replace(/_/g, " ")}
                          </p>
                          <p className="mt-1 text-[9px] leading-4 text-slate-400">
                            {aiState.detail}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-xl border border-violet-300/20 bg-slate-950 px-3 py-2 text-right">
                          <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">Confidence</p>
                          <p className="mt-1 text-lg font-black text-violet-200">{aiState.confidence}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="pixiu-ai-preview-chip absolute left-3 top-3 rounded-full border px-2.5 py-1 font-mono text-[9px]">
                      {loading ? "LOADING" : inputActive ? (mode === "trained" ? "MY AI LIVE" : `${activeTitle.toUpperCase()} LIVE`) : "READY"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-3 py-3">
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">{activeTitle}</p>
                      <p className="mt-1 text-sm font-black">{aiState.detectedClass === "none" ? status : aiState.detectedClass}</p>
                      <p className="mt-0.5 text-[9px] text-slate-600">{aiState.detail}</p>
                      {mode === "trained" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={"rounded-lg border px-2 py-1 text-[8px] font-mono " + (aiState.unknown ? "border-amber-400/20 bg-amber-400/5 text-amber-300" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-300")}>
                            {aiState.unknown ? "UNKNOWN · safe fallback" : "ACCEPTED · My AI"}
                          </span>
                          <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[8px] font-mono text-slate-500">
                            threshold {aiState.confidenceThreshold ?? 62}%
                          </span>
                        </div>
                      )}
                      {mode === "numbers" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-2 py-1 text-[8px] font-mono text-cyan-200">
                            Gesture · {aiState.detectedGesture ?? "none"}
                          </span>
                          <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[8px] font-mono text-slate-500">
                            {aiState.fingerCount ?? 0} fingers
                          </span>
                        </div>
                      )}
                      {isSound && (
                        <p className="mt-1 max-w-md text-[8px] leading-4 text-slate-700">
                          Local vocabulary: yes · no · go · stop · up · down · left · right · zero–nine
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-violet-300">
                      <span className="text-[10px]">{fps ? `${fps} FPS` : "—"}</span>
                      <span className="text-sm font-black">{aiState.confidence ? `${aiState.confidence}%` : "—"}</span>
                    </div>
                  </div>
                </div>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/55 p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-cyan-200">LIVE RESULT</p>
                        <p className="mt-1 truncate text-sm font-black text-white">
                          {aiState.detectedClass === "none"
                            ? "Waiting for detection"
                            : mode === "emotion"
                              ? "Person · " + String(aiState.detectedClass).replace(/_/g, " ") + " expression"
                              : mode === "numbers" || mode === "hands"
                                ? String(aiState.fingerCount ?? 0) + " fingers · " + String(aiState.detectedGesture ?? "hand").replace(/_/g, " ")
                                : String(aiState.detectedClass).replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[8px] text-violet-200">{aiState.confidence}%</span>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-slate-500">{aiState.detail}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <p className="text-xs font-black">6B–6G · Ready AI</p>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      Objects, Pose, Fingers, Emotion and Numbers use the Vision camera. Sound uses a separate microphone lifecycle. Only the selected AI model loads.
                    </p>
                    <button onClick={isSound ? (soundActive ? stopInput : startSound) : (cameraActive ? stopInput : startCameraForMode)} className="pixiu-ai-command mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black">
                      {(isSound ? soundActive : cameraActive) ? (isSound ? <Mic size={13} /> : <CameraOff size={13} />) : isSound ? <Mic size={13} /> : <Camera size={13} />}
                      {(isSound ? soundActive : cameraActive) ? "Stop" : isSound ? "Start microphone" : "Start camera"}
                    </button>
                  </div>

                  <div className="pixiu-ai-signal-card rounded-2xl border p-4">
                    <div className="flex items-center gap-2"><Zap size={14} className="text-cyan-300" /><p className="pixiu-ai-signal-title text-xs font-mono font-black">6K · AI → CIRCUIT SIGNAL</p></div>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">The Workbench receives detected class, confidence and detections. Blockly can use AI sees, AI class, AI confidence and AI camera ON/OFF.</p>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {["car", "person", "phone", "hand", "0", "3", "happy", "yes"].map((signal) => (
                        <button key={signal} onClick={() => onAiStateChange({ ...aiState, enabled: true, detectedClass: signal, confidence: 95, detail: `Test signal · ${signal}` })} className="pixiu-ai-signal-button rounded-lg border px-2 py-1.5 text-[9px] font-mono text-slate-300">
                          Test {signal}
                        </button>
                      ))}
                    </div>
                    {onStartSim && !isSimRunning && <button onClick={onStartSim} className="mt-3 rounded-xl bg-emerald-400 px-3 py-2 text-[10px] font-black text-slate-950">Run circuit</button>}
                  </div>

                  {error && <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-3 text-[10px] leading-5 text-amber-200">{error}</div>}
                </aside>
              </div>
            </div>
          )}

          {tab === "teach" && (
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black">6H · Build My AI dataset</p>
                      <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
                        Create concepts, capture or import examples, rename classes, remove mistakes, and balance the dataset before training.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right">
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">Dataset</p>
                      <p className="mt-1 text-sm font-black">{datasetStats.sampleCount} samples · {datasetStats.classCount} classes</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Concept name · e.g. bottle"
                      maxLength={32}
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-[10px] outline-none focus:border-violet-400"
                    />
                    <button
                       disabled={runtimeEnabled || training}
                       onClick={() => {
                         const next = addAiClass(store, label)
                        commitStore(next)
                        if (next.classes.length === store.classes.length) {
                          setStatus("Concept already exists or the 8-concept limit is reached.")
                        } else {
                          const created = next.classes[next.classes.length - 1] ?? ""
                          setLabel(created)
                          setStatus("Concept created · capture examples for it.")
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-black"
                    >
                      <Plus size={13} /> Add concept
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void addSampleFromCamera()}
                      disabled={!label.trim() || runtimeEnabled || training}
                       className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-slate-950 px-3 py-2 text-[10px] font-black disabled:opacity-30"
                    >
                      <Camera size={13} /> {cameraActive ? "Capture example" : "Start capture"}
                    </button>
                    <label className={"inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black " + (runtimeEnabled || training ? "cursor-not-allowed opacity-30" : "cursor-pointer")}>
                      <Upload size={13} /> Import images
                      <input hidden multiple type="file" accept="image/*" onChange={importSample} disabled={runtimeEnabled || training} />
                    </label>
                    <span className="text-[9px] text-slate-600">Recommended: 8+ / concept · minimum 3</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <p className="text-xs font-black">Dataset health</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ["Concepts", String(datasetStats.classCount)],
                      ["Samples", String(datasetStats.sampleCount)],
                      ["Min / class", String(datasetStats.minSamples)],
                      ["Balance", datasetStats.balanced ? "Balanced" : "Needs balance"],
                    ].map(([name, value]) => (
                      <div key={name} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">{name}</p>
                        <p className="mt-1 text-xs font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-500/[0.03] p-3 text-[10px] leading-5 text-slate-500">
                    {datasetStats.ready
                      ? datasetStats.recommended
                        ? "Ready · enough examples for a useful transfer-learning run."
                        : "Ready to train · more varied examples can improve generalization."
                      : "Training unlocks with 2 concepts and at least 3 examples per concept."}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-violet-300" />
                  <p className="text-xs font-black">6M · How My AI learns</p>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {[
                    ["DATASET", "Examples + labels", "You teach what each concept looks like."],
                    ["MODEL", "Features + classifier", "A local vision feature extractor converts each image into a fixed-size visual feature vector."],
                    ["TRAIN", "Learn patterns", "Only the small classifier head is updated from your examples."],
                    ["INFERENCE", "Predict + confidence", "A new image is compared with learned class patterns and scored."],
                  ].map(([title, value, note]) => (
                    <div key={title} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[8px] font-mono tracking-[0.15em] text-violet-300">{title}</p>
                      <p className="mt-1 text-[10px] font-black">{value}</p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-600">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <Info size={13} className="mt-0.5 shrink-0 text-slate-500" />
                  <p className="text-[9px] leading-4 text-slate-600">
                    Confidence is not a guarantee of truth. PIXIU treats a weak or ambiguous result as UNKNOWN instead of pretending it knows.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {classes.map((name) => {
                  const classSamples = store.samples.filter((sample) => sample.label === name)
                  const isRenaming = renamingClass === name

                  return (
                    <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <div className="flex gap-2">
                              <input
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] outline-none focus:border-violet-400"
                                maxLength={32}
                                autoFocus
                              />
                              <button
                                 disabled={runtimeEnabled || training}
                                 onClick={() => {
                                   const next = renameAiClass(store, name, renameValue)
                                  commitStore(next)
                                  setRenamingClass(null)
                                  setRenameValue("")
                                  setStatus(next === store ? "That concept name is already in use." : "Concept renamed.")
                                }}
                                className="rounded-lg bg-emerald-500/15 px-2 text-[9px] font-black text-emerald-300"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLabel(name)}
                              className="text-left"
                              title="Use this concept for capture"
                            >
                              <p className="truncate text-xs font-black">{name}</p>
                              <p className="mt-0.5 font-mono text-[8px] text-slate-600">{classSamples.length}/20 samples · click to select</p>
                            </button>
                          )}
                        </div>

                        {!isRenaming && (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={runtimeEnabled || training}
                              onClick={() => {
                                setRenamingClass(name)
                                setRenameValue(name)
                              }}
                              className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:text-white"
                              title="Rename concept"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              disabled={runtimeEnabled || training}
                              onClick={() => {
                                const next = removeAiClass(store, name)
                                commitStore(next)
                                if (label === name) setLabel("")
                                setRenamingClass(null)
                                setStatus("Concept removed with its examples.")
                              }}
                              className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:text-rose-300"
                              title="Delete concept"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {classSamples.map((sample) => (
                          <div key={sample.id} className="relative">
                            <img
                              src={sample.dataUrl}
                              alt={name}
                              loading="lazy"
                              className="h-16 w-20 rounded-lg border border-slate-800 object-cover"
                            />
                            <button
                               disabled={runtimeEnabled || training}
                               onClick={() => {
                                 const next = removeAiSample(store, sample.id)
                                commitStore(next)
                              }}
                              className="absolute right-1 top-1 rounded-md bg-slate-950/85 p-1 text-slate-300 hover:text-rose-300"
                              title="Remove sample"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                        {!classSamples.length && (
                          <div className="grid h-16 w-full place-items-center rounded-lg border border-dashed border-slate-800 text-[9px] text-slate-600">
                            No examples yet
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {!classes.length && (
                  <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center">
                    <Brain size={24} className="mx-auto text-violet-300" />
                    <p className="mt-2 text-xs font-black">Start with your first concept</p>
                    <p className="mt-1 text-[10px] text-slate-600">Create a concept such as “bottle”, “pen”, or “red block”, then add examples.</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black">6I · Train My AI</p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-500">
                        Local visual features feed a small classifier head. Grade-based profiles keep training light; advanced tuning is optional.
                      </p>
                    </div>
                    <button disabled={!canTrain || training || runtimeEnabled} onClick={() => void train()} className="shrink-0 rounded-xl bg-violet-500 px-4 py-2 text-[10px] font-black disabled:opacity-30">
                      {training ? (progress.stage || "Training…") : "Train My AI"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">Training profile</p><p className="mt-1 text-[9px] text-slate-600">Grade 6–8 presets plus Advanced tuning.</p></div>
                    <select value={trainingProfile} onChange={(event)=>setTrainingProfile(event.target.value as AiTrainingProfile)} disabled={training||runtimeEnabled||advancedTuning} className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black text-white"><option value="grade6">Grade 6 · 20 max epochs</option><option value="grade7">Grade 7 · 35 max epochs</option><option value="grade8">Grade 8 · 50 max epochs</option></select></div>
                    <label className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold text-slate-400"><input type="checkbox" checked={advancedTuning} onChange={(event)=>setAdvancedTuning(event.target.checked)} disabled={training||runtimeEnabled}/>Advanced tuning</label>
                    {advancedTuning&&<div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <label className="text-[9px] font-mono text-slate-500">Max epochs<input type="number" min="8" max="150" value={customEpochs} onChange={(event)=>setCustomEpochs(Math.max(8,Math.min(150,Number(event.target.value)||40)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Learning rate<input type="number" min="0.0001" max="0.01" step="0.0001" value={customLearningRate} onChange={(event)=>setCustomLearningRate(Math.max(0.0001,Math.min(0.01,Number(event.target.value)||0.001)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Batch size<input type="number" min="2" max="32" value={customBatchSize} onChange={(event)=>setCustomBatchSize(Math.max(2,Math.min(32,Number(event.target.value)||8)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Patience<input type="number" min="2" max="20" value={customPatience} onChange={(event)=>setCustomPatience(Math.max(2,Math.min(20,Number(event.target.value)||8)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Min improvement<input type="number" min="0.0001" max="0.05" step="0.0001" value={customMinDelta} onChange={(event)=>setCustomMinDelta(Math.max(0.0001,Math.min(0.05,Number(event.target.value)||0.001)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-black text-cyan-200">Layer stack</p><p className="mt-1 text-[8px] text-slate-600">Dense / Linear, Normalization, Dropout and Activation. Conv2D is intentionally excluded.</p></div><button type="button" onClick={addCustomLayer} disabled={training||runtimeEnabled||customLayers.length>=8} className="rounded-lg bg-violet-500/15 px-2 py-1.5 text-[9px] font-black text-violet-200 disabled:opacity-30"><Plus size={11}/> Add layer</button></div>
                        <div className="mt-3 space-y-2">{customLayers.map((layer,index)=><div key={index} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2 lg:grid-cols-[28px_150px_1fr_auto] lg:items-center"><span className="text-center font-mono text-[9px] text-slate-700">{index+1}</span>
                          <select value={layer.type} onChange={(event)=>{const type=event.target.value as AiLayerSpec["type"];updateCustomLayer(index,type==="dense"?{type,units:layer.units??64,activation:layer.activation??"relu"}:type==="dropout"?{type,rate:layer.rate??0.2}:type==="activation"?{type,activation:layer.activation??"relu"}:{type})}} disabled={training||runtimeEnabled} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[9px] font-black text-white"><option value="dense">Dense / Linear</option><option value="batchNormalization">Normalization</option><option value="dropout">Dropout</option><option value="activation">Activation</option></select>
                          <div className="flex flex-wrap items-center gap-2">{layer.type==="dense"&&<><label className="text-[8px] font-mono text-slate-600">Units<input type="number" min="16" max="256" step="8" value={layer.units??64} onChange={(event)=>updateCustomLayer(index,{units:Math.max(16,Math.min(256,Number(event.target.value)||64))})} disabled={training||runtimeEnabled} className="ml-1 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white"/></label><label className="text-[8px] font-mono text-slate-600">Activation<select value={layer.activation??"relu"} onChange={(event)=>updateCustomLayer(index,{activation:event.target.value as AiLayerSpec["activation"]})} disabled={training||runtimeEnabled} className="ml-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white"><option value="relu">ReLU</option><option value="linear">Linear</option><option value="tanh">Tanh</option><option value="sigmoid">Sigmoid</option></select></label></>}</div>
                          <div className="flex items-center justify-end gap-1"><button type="button" onClick={()=>moveCustomLayer(index,-1)} disabled={training||runtimeEnabled||index===0} title="Move up" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-25"><ChevronUp size={12}/></button><button type="button" onClick={()=>moveCustomLayer(index,1)} disabled={training||runtimeEnabled||index===customLayers.length-1} title="Move down" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-25"><ChevronDown size={12}/></button><button type="button" onClick={()=>removeCustomLayer(index)} disabled={training||runtimeEnabled||customLayers.length<=1} title="Remove layer" className="rounded-lg border border-rose-400/10 p-1.5 text-slate-500 hover:text-rose-300 disabled:opacity-25"><Trash2 size={12}/></button></div>
                        </div>)}</div>
                      </div>
                    </div>}
                    <div className="mt-3 flex flex-wrap gap-2 text-[8px] font-mono"><span className="rounded-lg border border-slate-800 px-2 py-1">Epochs · {selectedTrainingConfig.epochs}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Layers · {selectedTrainingConfig.layers.length}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Patience · {selectedTrainingConfig.earlyStoppingPatience}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Load · {estimatedTrainingLoad.label}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Params · {estimatedTrainingLoad.parameters.toLocaleString()}</span></div>
                    {estimatedTrainingLoad.warning&&<p className="mt-2 text-[8px] text-amber-300/80">{estimatedTrainingLoad.warning}</p>}
                  </div>
                  {training && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-600">
                        <span>{progress.stage}</span>
                        <span>{progress.epoch}/{progress.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-violet-400 transition-all" style={{ width: (progress.stage.startsWith("Extracting") ? 18 : 18 + Math.round((progress.epoch / Math.max(1, progress.total)) * 82)) + "%" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(training || store.model?.trainingHistory?.length) && (
  <div className="space-y-3 rounded-2xl border border-cyan-300/10 bg-cyan-500/[0.02] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black">6I · Training diagnostics</p><span className="text-[8px] font-mono text-slate-600">Epoch {training?progress.epoch+"/"+progress.total:store.model?.epochs??0} · Train {training?Math.round(progress.accuracy*100):store.model?.trainAccuracy??0}% · Val {training?(progress.valAccuracy==null?"—":Math.round(progress.valAccuracy*100)+"%"):store.model?.validationAvailable?(store.model.validationAccuracy??0)+"%":"—"}</span></div>
    <div className="grid gap-3 lg:grid-cols-2"><MetricChart title="Loss · lower is better" points={training?trainingHistory:store.model?.trainingHistory??[]} primary="loss" secondary="valLoss" primaryLabel="Training loss" secondaryLabel="Validation loss"/><MetricChart title="Accuracy · higher is better" points={training?trainingHistory:store.model?.trainingHistory??[]} primary="accuracy" secondary="valAccuracy" primaryLabel="Training accuracy" secondaryLabel="Validation accuracy"/></div>
    {!training&&store.model&&<><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Best epoch</p><p className="text-sm font-black">{store.model.bestEpoch??"—"}</p></div><div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Parameters</p><p className="text-sm font-black">{(store.model.parameterCount??0).toLocaleString()}</p></div><div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Validation</p><p className="text-sm font-black">{store.model.validationAvailable?"Available":"Not available"}</p></div><div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Gap</p><p className="text-sm font-black">{store.model.validationAvailable?(store.model.generalizationGap??0)+"%":"—"}</p></div><div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Stopping</p><p className="text-sm font-black">{store.model.earlyStopped?"Early":"Max epochs"}</p></div></div><ConfusionMatrix classes={store.model.classes} matrix={store.model.validationConfusionMatrix}/></>}
  </div>
)}

{error && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[10px] text-amber-200">
                  {error}
                </div>
              )}

              <button
                onClick={() => void resetStudio()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-black text-slate-300"
              >
                <RefreshCcw size={13} /> Reset dataset + My AI
              </button>
            </div>
          )}

          {tab === "understand" && (
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <Info size={16} className="mt-0.5 text-violet-300" />
                  <div className="min-w-0">
                    <p className="text-xs font-black">6N · Why did AI produce this result?</p>
                    <p className="mt-2 text-[10px] leading-5 text-slate-400">{currentExplanation}</p>
                    <div className="mt-3 flex flex-wrap gap-2 font-mono text-[8px]">
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-slate-500">
                        RESULT · {aiState.detectedClass}
                      </span>
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-slate-500">
                        CONFIDENCE · {aiState.confidence}%
                      </span>
                      <span className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-slate-500">
                        THRESHOLD · {aiState.confidenceThreshold ?? 60}%
                      </span>
                      <span className={"rounded-lg border px-2 py-1 " + (aiState.unknown ? "border-amber-400/20 bg-amber-400/5 text-amber-300" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-300")}>
                        {aiState.unknown ? "UNKNOWN / NOT ACCEPTED" : formatDecisionReason(aiState.decisionReason)}
                      </span>
                    </div>
                  </div>
                </div>

                {aiState.probabilities && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">Class probabilities</p>
                      <span className="text-[8px] text-slate-700">top candidates</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(aiState.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => (
                        <div key={name} className="flex items-center gap-2">
                          <span className="w-24 truncate text-[9px] text-slate-500">{name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900">
                            <div className="h-full rounded-full bg-violet-400" style={{ width: value + "%" }} />
                          </div>
                          <span className="w-10 text-right font-mono text-[8px] text-slate-600">{value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="flex items-center gap-2"><BookOpen size={15} className="text-violet-300" /><p className="text-xs font-black">Model structure</p></div>
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">
                    {store.model?.architecture ?? "Train My AI to create a local classifier head."}
                  </p>
                  {store.model && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">Extractor</p>
                        <p className="mt-1 text-[10px] font-black">Local vision features</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">Validation</p>
                        <p className="mt-1 text-[10px] font-black">{store.model.validationAccuracy}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">Training profile</p>
                        <p className="mt-1 text-[10px] font-black">
                          {store.model.trainingProfile === "custom"
                            ? "Custom tuning"
                            : String(store.model.trainingProfile ?? "grade6").replace("grade", "Grade ")}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 rounded-xl bg-slate-950 p-3 font-mono text-[9px] text-slate-500">
                    {model ? getModelWeightShapes(model).map((shape) => <div key={shape} className="py-1">{shape}</div>) : <div>No trained model loaded.</div>}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-300" /><p className="text-xs font-black">6O · AI safety & privacy</p></div>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      Camera and microphone start only when the selected AI runtime is started. Browser permission is required for media input; stopping AI ends the active media tracks.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-mono">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-slate-600">Camera</p>
                        <p className={"mt-1 " + (cameraActive ? "text-emerald-300" : "text-slate-500")}>{cameraActive ? "ACTIVE" : "OFF"}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-slate-600">Microphone</p>
                        <p className={"mt-1 " + (soundActive ? "text-violet-300" : "text-slate-500")}>{soundActive ? "ACTIVE" : "OFF"}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[9px] leading-5 text-slate-600">
                      Samples stay in this browser's storage. “Reset dataset + My AI” removes the dataset and saved model from this browser. The browser controls site permission; stopping PIXIU ends active tracks but does not revoke a site's saved permission.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={stopInput}
                        disabled={!cameraActive && !soundActive && !loading}
                        className="rounded-xl border border-rose-400/20 px-3 py-2 text-[9px] font-black text-rose-300 disabled:opacity-30"
                      >
                        Stop camera / microphone + clear runtime
                      </button>
                      <button
                        type="button"
                        onClick={() => void resetStudio()}
                        className="rounded-xl border border-rose-400/20 px-3 py-2 text-[9px] font-black text-rose-300 hover:bg-rose-500/5"
                      >
                        Erase local AI data
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <p className="text-xs font-black">Model weights preview</p>
                    <div className="mt-3 grid gap-2">
                      {(model ? getModelWeightPreview(model) : []).slice(0, 8).map((row, index) => <div key={index} className="rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[8px] text-slate-500">{row.join(" · ")}</div>)}
                    </div>
                    {!model && <p className="mt-3 text-[10px] text-slate-600">Train My AI in Teach to inspect its learned head.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

