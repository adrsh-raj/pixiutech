"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  addAiClass,
  addAiSample,
  clearAiStudioStore,
  disposeActiveAiModel,
  getActiveAiModel,
  getAiClasses,
  getAiDatasetStats,
  getSampleAddError,
  getSampleCounts,
  loadAiStudioStore,
  loadStoredAiModel,
  optimizeAiImage,
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
  getCameraPermissionState,
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
  getMicrophonePermissionState,
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
import type { AiVisionMode, ReadyAiMode, AiVisionState, PoseResult } from "@/lib/ai/vision-types"
import { createAiVisionState } from "@/lib/ai/vision-state"
import {
  runtimeDetail,
  type AiRuntimeStatus,
} from "@/lib/ai/ai-runtime-state"
import {
  createAiRuntimeMetrics,
  isBudgetExceeded,
  type AiRuntimeMetrics,
} from "@/lib/ai/ai-performance"
import type { AiStudioViewModel } from "./ai-studio-view-model"
import type { GraphModel, LayersModel } from "@tensorflow/tfjs"
import type { FaceDetector } from "@/lib/ai/face-detector"
import type { HandDetector } from "@/lib/ai/hand-detector"
import type { ObjectDetector } from "@/lib/ai/object-detector"
import { toAiRuntimeError } from "@/lib/ai/ai-errors"

export interface AiStudioPanelProps {
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
type ReadyResource =
  | ObjectDetector
  | GraphModel
  | LayersModel
  | HandDetector
  | FaceDetector
  | SoundRecognizer

const OBJECT_MIN_SCORE = DEFAULT_OBJECT_MIN_SCORE
const OBJECT_MAX_BOXES = DEFAULT_OBJECT_MAX_BOXES

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

function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, poseResult: PoseResult | null) {
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



import type { AiStudioViewModel } from "./ai-studio-view-model"

export interface AiStudioPanelProps {
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

export function useAiStudioController({

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
}: AiStudioPanelProps) {
const [tab, setTab] = useState<Tab>("try")
  const [mode, setMode] = useState<ReadyAiMode | "trained">("objects")
  const [cameraActive, setCameraActive] = useState(false)
  const [soundActive, setSoundActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("AI idle")
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [store, setStore] = useState<AiStudioStore>(() => ({ classes: [], samples: [], model: null }))
  const [model, setModel] = useState<LayersModel | null>(null)
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
  const runtimeBudgetWarnedRef = useRef(false)
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

  function releaseLoadedResource(resourceMode: AiVisionMode | null, resource: ReadyResource | null) {
    if (!resource || !resourceMode) return

    if (resourceMode === "sound") {
      void stopSoundRecognizer(resource as SoundRecognizer)
    } else if (resourceMode === "trained") {
      disposeActiveAiModel()
    } else if (resourceMode === "objects") {
      disposeObjectDetector(resource as ObjectDetector)
    } else if (resourceMode === "pose") {
      disposeMoveNet(resource as GraphModel)
    } else if (resourceMode === "hands" || resourceMode === "numbers") {
      disposeHandDetector(resource as HandDetector)
    } else if (resourceMode === "emotion") {
      disposeFaceDetector(resource as FaceDetector)
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
      const permission = await getCameraPermissionState()
      if (permission === "denied") {
        throw Object.assign(
          new Error("Camera permission is blocked for this site. Allow camera access and try again."),
          { name: "NotAllowedError" },
        )
      }

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
      const structuredError = toAiRuntimeError(cameraError, "Camera")
      const message = structuredError.userMessage
      const errorKind = structuredError.kind
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
    runtimeBudgetWarnedRef.current = false
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
      let resource: ReadyResource | null = null

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
        resource = (model ?? await loadStoredAiModel(store.model)) as LayersModel | null
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
      onAiStateChange({
        ...aiStateRef.current,
        mode,
        runtimeStatus: "ready",
        runtimeError: undefined,
        runtimeErrorKind: undefined,
        detail: "AI ready",
      })
      const loadBudget = lastRuntimeMetricsRef.current
        ? isBudgetExceeded(lastRuntimeMetricsRef.current)
        : null
      setStatus(
        loadBudget?.load
          ? "AI ready · model load was slow"
          : mode === "objects"
            ? "6B Objects ready"
            : mode === "pose"
              ? "6C Pose ready"
              : mode === "hands"
                ? "6D Fingers ready"
                : mode === "numbers"
                  ? "6G Numbers ready"
                  : mode === "emotion"
                    ? "6E Emotion ready"
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
      const structuredError = toAiRuntimeError(resourceError, "Selected AI")
      const message = structuredError.userMessage
      const errorKind = structuredError.kind
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
    runtimeStatusRef.current = "loading"
    runtimeMetricsRef.current = createAiRuntimeMetrics("sound")
    setLoading(true)
    onAiStateChange({
      ...aiStateRef.current,
      mode: "sound",
      runtimeStatus: "loading",
      runtimeError: undefined,
      runtimeErrorKind: undefined,
      detail: "Starting microphone…",
    })

    try {
      const permission = await getMicrophonePermissionState()
      if (permission === "denied") {
        throw Object.assign(
          new Error("Microphone permission is blocked for this site. Allow microphone access and try again."),
          { name: "NotAllowedError" },
        )
      }

      const recognizer = await loadSoundRecognizer()
      if (activeSession !== sessionRef.current) {
        await stopSoundRecognizer(recognizer)
        return
      }

      resourceRef.current = recognizer
      resourceModeRef.current = "sound"
      runtimeMetricsRef.current?.markReady()
      lastRuntimeMetricsRef.current = runtimeMetricsRef.current?.snapshot() ?? null
      runtimeStatusRef.current = "ready"
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
          runtimeStatus: "running",
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
      const structuredError = toAiRuntimeError(soundError, "Microphone")
      const message = structuredError.userMessage
      const errorKind = structuredError.kind
      runtimeStatusRef.current = "error"
      setLoading(false)
      setSoundActive(false)
      setError(message)
      setStatus("Sound AI unavailable")
      onAiStateChange({
        ...createAiVisionState("sound"),
        enabled: false,
        runtimeStatus: "error",
        runtimeErrorKind: errorKind,
        runtimeError: message,
        detail: message,
      })
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
          const predictions = await detectObjects(resourceRef.current as ObjectDetector, video, {
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
            runtimeStatus: "running",
            detectedClass: primary?.class ?? "none",
            confidence: primary ? Math.round(primary.score * 100) : 0,
            allDetections: visible,
            modelSource: "ready",
            detail: primary ? `${visible.length} object${visible.length === 1 ? "" : "s"} detected` : "Looking...",
          })
        } else if (mode === "pose") {
          const pose = await estimateMoveNetPose(resourceRef.current as GraphModel, video)
          if (activeSession !== sessionRef.current) return
          drawPose(getActiveOverlay()!, video, pose)
          const visiblePoints = pose?.keypoints?.filter((point) => (point.score ?? 0) >= 0.25) ?? []
          const score = visiblePoints.length
            ? visiblePoints.reduce((sum, point) => sum + Number(point.score ?? 0), 0) / visiblePoints.length
            : 0
          onAiStateChange({
            enabled: true,
            mode: "pose",
            runtimeStatus: "running",
            detectedClass: pose ? "person" : "none",
            confidence: Math.round(score * 100),
            allDetections: [],
            modelSource: "ready",
            detail: pose ? `${visiblePoints.length}/17 keypoints tracked` : "No person detected",
          })
        } else if (mode === "hands" || mode === "numbers") {
          const hands: HandDetection[] = await detectHands(resourceRef.current as HandDetector, video)
          if (activeSession !== sessionRef.current) return

          if (hands.length === 0) {
            emptyHandFramesRef.current += 1
            if (emptyHandFramesRef.current >= 4) {
              (resourceRef.current as HandDetector | FaceDetector | null)?.reset?.()
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
            runtimeStatus: "running",
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
          const faces: FaceDetection[] = await detectFaces(resourceRef.current as FaceDetector, video)
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
            runtimeStatus: "running",
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
            runtimeStatus: "running",
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
        if (runtimeStatusRef.current === "ready") {
          runtimeStatusRef.current = "running"
          setStatus("AI running")
        }

        timerRef.current = window.setTimeout(tick, Math.max(180, 280 - elapsed))
      } catch (inferenceError) {
        if (activeSession === sessionRef.current) {
          const structuredError = toAiRuntimeError(inferenceError, "AI inference")
          setError(structuredError.userMessage)
          onAiStateChange({
            ...aiStateRef.current,
            mode,
            runtimeStatus: "error",
            runtimeErrorKind: structuredError.kind,
            runtimeError: structuredError.userMessage,
            detail: "AI inference unavailable · retrying",
          })
          setStatus("Inference error · retrying")
          timerRef.current = window.setTimeout(tick, 600)
        }
      } finally {
        runtimeMetricsRef.current?.recordInference(performance.now() - started)
        lastRuntimeMetricsRef.current = runtimeMetricsRef.current?.snapshot() ?? null
        if (
          activeSession === sessionRef.current &&
          !runtimeBudgetWarnedRef.current &&
          lastRuntimeMetricsRef.current
        ) {
          const budget = isBudgetExceeded(lastRuntimeMetricsRef.current)
          if (budget.steadyInference || budget.tensorGrowth) {
            runtimeBudgetWarnedRef.current = true
            setStatus(
              budget.tensorGrowth
                ? "AI running · memory growth warning"
                : "AI running · performance warning",
            )
          }
        }
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
    onAiStateChange({
      ...createAiVisionState(mode),
      runtimeStatus: "stopped",
      detail: "AI stopped",
    })
    setStatus("AI stopped")
  }

  function selectMode(next: ReadyAiMode | "trained") {
    if (training) return
    stopInput()
    setMode(next)
    runtimeStatusRef.current = "idle"
    setError(null)
    onAiStateChange({
      ...createAiVisionState(next),
      runtimeStatus: "idle",
      detail: next === "trained" ? "My AI selected" : "AI selected",
    })
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
      setError(toAiRuntimeError(sampleError, "Dataset").userMessage)
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
      setError(toAiRuntimeError(sampleError, "Dataset").userMessage)
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
      setError(toAiRuntimeError(trainError, "My AI training").userMessage)
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


  const isSound = mode === "sound"
  const activeTitle =
    mode === "trained" ? "My AI"
      : MODES.find((item) => item.id === mode)?.title ?? "AI"
  const inputActive = isSound ? soundActive : cameraActive


  const viewModel: AiStudioViewModel = {
    aiState,
    onAiStateChange,
    isSimRunning,
    onStartSim,
    onGoToSimulation,
    mode,
    isSound,
    runtimeEnabled,
    activeTitle,
    loading,
    cameraActive,
    soundActive,
    inputActive,
    status,
    setStatus,
    error,
    fps,
    store,
    model,
    classes,
    datasetStats,
    canTrain,
    currentExplanation,
    studioVideoRef,
    overlayRef,
    stopInput,
    startSound,
    startCameraForMode,
    selectMode,
    label,
    setLabel,
    addSampleFromCamera,
    importSample,
    commitStore,
    renamingClass,
    renameValue,
    setRenamingClass,
    setRenameValue,
    training,
    removeAiClass,
    renameAiClass,
    removeAiSample,
    trainingProfile,
    setTrainingProfile,
    advancedTuning,
    setAdvancedTuning,
    customEpochs,
    setCustomEpochs,
    customLearningRate,
    setCustomLearningRate,
    customBatchSize,
    setCustomBatchSize,
    customPatience,
    setCustomPatience,
    customMinDelta,
    setCustomMinDelta,
    customLayers,
    addCustomLayer,
    updateCustomLayer,
    removeCustomLayer,
    moveCustomLayer,
    selectedTrainingConfig,
    estimatedTrainingLoad,
    progress,
    trainingHistory,
    train,
    resetStudio,
  }

  return {
    isOpen,
    onClose,
    runtimeEnabled,
    compact,
    tab,
    selectTab,
    floatingPosition,
    handleFloatingPointerMove,
    handleFloatingPointerUp,
    handleFloatingPointerDown,
    resetFloatingPosition,
    floatingVideoRef,
    floatingOverlayRef,
    mode,
    isSound,
    activeTitle,
    aiState,
    status,
    cameraActive,
    soundActive,
    stopInput,
    onGoToSimulation,
    store,
    viewModel,
  }

}
