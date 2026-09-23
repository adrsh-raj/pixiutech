"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  Brain,
  Camera,
  CameraOff,
  CheckCircle2,
  Layers3,
  Mic,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import {
  addAiSample,
  clearAiStudioStore,
  disposeActiveAiModel,
  getAiClasses,
  getModelWeightPreview,
  getModelWeightShapes,
  getSampleCounts,
  loadAiStudioStore,
  loadStoredAiModel,
  predictAiImage,
  removeAiSample,
  saveAiStudioStore,
  trainAiModel,
  type AiStudioStore,
} from "@/lib/ai-studio-engine"
import {
  disposeAiResource,
  estimateFaceEmotion,
  loadFaceEmotion,
  loadHandDetector,
  loadPoseDetector,
  loadSpeechRecognizer,
  stopSpeechRecognizer,
} from "@/lib/ai-ready-runtime"
import {
  captureVideoFrame,
  startCamera,
  stopCamera,
} from "@/lib/ai/camera-session"
import type { AiVisionMode, ReadyAiMode, AiVisionState } from "@/lib/ai/vision-types"

export type { AiVisionState, ReadyAiMode }

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning?: boolean
  runtimeEnabled?: boolean
  onStartSim?: () => void
}

type Tab = "try" | "teach" | "understand"
type ReadyResource = any

// Object detection tuning:
// - MobileNetV2 is the higher-accuracy COCO-SSD backbone.
// - A lower threshold makes smaller / harder COCO objects visible instead of
//   effectively restricting the live demo to only the easiest detections.
const OBJECT_MIN_SCORE = 0.30
const OBJECT_MAX_BOXES = 20

const MODES: Array<{ id: ReadyAiMode; title: string; subtitle: string }> = [
  { id: "objects", title: "Objects", subtitle: "COCO-SSD object boxes" },
  { id: "pose", title: "Pose", subtitle: "17 body keypoints" },
  { id: "hands", title: "Fingers", subtitle: "21 hand landmarks" },
  { id: "emotion", title: "Emotion", subtitle: "Expression demo" },
  { id: "sound", title: "Sound", subtitle: "Words + digits" },
  { id: "numbers", title: "Numbers", subtitle: "0–5 fingers" },
]

const INITIAL: AiVisionState = {
  enabled: false,
  mode: "objects",
  detectedClass: "none",
  confidence: 0,
  allDetections: [],
  modelSource: "ready",
  detail: "AI idle",
}

function emptyState(mode: AiVisionMode): AiVisionState {
  return {
    ...INITIAL,
    mode,
    modelClasses: mode === "numbers" ? ["0", "1", "2", "3", "4", "5"] : undefined,
    detail: mode === "trained" ? "My AI idle" : "AI idle",
  }
}

function canonicalObjectClass(name: string) {
  const lower = name.toLowerCase()
  if (lower === "cell phone") return "phone"
  if (["car", "truck", "bus", "motorcycle"].includes(lower)) return "car"
  return lower
}

function countFingers(landmarks: Array<{ x: number; y: number }>) {
  if (landmarks.length < 21) return 0
  const wrist = landmarks[0]
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)

  const tips = [4, 8, 12, 16, 20]
  const folds = [2, 6, 10, 14, 18]
  return tips.reduce((count, tipIndex, i) => {
    const tip = landmarks[tipIndex]
    const fold = landmarks[folds[i]]
    return dist(tip, wrist) > dist(fold, wrist) * 1.1 ? count + 1 : count
  }, 0)
}

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

function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, poses: any[]) {
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

  const pose = poses[0]
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

function drawHands(canvas: HTMLCanvasElement, video: HTMLVideoElement, results: any) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#38bdf8"

  for (const hand of results?.multiHandLandmarks ?? []) {
    for (const point of hand) {
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawFace(canvas: HTMLCanvasElement, video: HTMLVideoElement, result: any) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const box = result?.box
  if (Array.isArray(box) && box.length >= 4) {
    const [x, y, w, h] = box.map(Number)
    ctx.strokeStyle = "#f472b6"
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, w, h)
    const label = String(result.expression ?? "face")
    ctx.font = "700 13px system-ui"
    const tw = ctx.measureText(label).width + 12
    ctx.fillStyle = "#f472b6"
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22)
    ctx.fillStyle = "#0f172a"
    ctx.fillText(label, x + 6, Math.max(15, y - 7))
  }
}

export function AiStudioPanel({
  isOpen,
  onClose,
  aiState,
  onAiStateChange,
  isSimRunning = false,
  runtimeEnabled = false,
  onStartSim,
}: Props) {
  const [tab, setTab] = useState<Tab>("try")
  const [mode, setMode] = useState<ReadyAiMode | "trained">("objects")
  const [cameraActive, setCameraActive] = useState(false)
  const [soundActive, setSoundActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("AI idle")
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [capture, setCapture] = useState<string | null>(null)
  const [store, setStore] = useState<AiStudioStore>(() => ({ samples: [], model: null }))
  const [model, setModel] = useState<any>(null)
  const [label, setLabel] = useState("")
  const [training, setTraining] = useState(false)
  const [progress, setProgress] = useState({ epoch: 0, total: 0, accuracy: 0, loss: 0 })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const resourceRef = useRef<ReadyResource>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const busyRef = useRef(false)
  const fpsStartRef = useRef(0)
  const fpsFramesRef = useRef(0)

  const classes = useMemo(() => getAiClasses(store.samples), [store.samples])
  const counts = useMemo(() => getSampleCounts(store.samples), [store.samples])
  const canTrain =
    classes.length >= 2 && classes.every((name) => (counts[name] ?? 0) >= 3)

  useEffect(() => {
    if (!isOpen) {
      if (!runtimeEnabled) stopAll()
      return
    }
    setTab("try")
    setStore(loadAiStudioStore())
    setLoading(false)
    setError(null)
    setStatus(runtimeEnabled ? "AI runtime active" : "AI idle")
    setCapture(null)
    onAiStateChange(runtimeEnabled ? aiState : INITIAL)
  }, [isOpen])

  function bindExistingCameraToVisibleVideo() {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return false

    if (video.srcObject !== stream) {
      video.srcObject = stream
    }

    void video.play().catch(() => {
      // Autoplay may need a user gesture on some browsers; inference can still
      // resume once the browser allows playback.
    })

    return true
  }

  useEffect(() => {
    if (runtimeEnabled) {
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
  }, [runtimeEnabled, mode, isOpen])

  useEffect(() => {
    if (!store.model) {
      setModel(null)
      return
    }
    let cancelled = false
    void loadStoredAiModel(store.model).then((loaded) => {
      if (!cancelled) setModel(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [store.model])

  function clearOverlay() {
    const canvas = overlayRef.current
    if (!canvas) return
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  }

  function stopInference() {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    busyRef.current = false
    clearOverlay()
    fpsStartRef.current = 0
    fpsFramesRef.current = 0
    setFps(0)
  }

  function releaseCurrentResource() {
    const resource = resourceRef.current
    resourceRef.current = null

    if (mode === "sound") {
      void stopSpeechRecognizer(resource)
    } else if (mode === "trained") {
      disposeActiveAiModel()
      setModel(null)
    } else {
      disposeAiResource(resource)
    }
  }

  function stopAll() {
    releaseCurrentResource()
    stopInference()
    stopCamera(videoRef.current, streamRef.current)
    streamRef.current = null
    setCameraActive(false)
    setSoundActive(false)
    setLoading(false)
  }

  async function openCamera(withModel = true) {
    setError(null)
    setStatus("Starting camera...")
    stopInference()
    releaseCurrentResource()

    try {
      const video = videoRef.current
      if (!video) throw new Error("Camera preview is not ready.")
      const stream = await startCamera(video)
      streamRef.current = stream
      setCameraActive(true)
      setStatus(withModel ? "Camera live · loading AI" : "Camera live · ready to teach")
      onAiStateChange({
        ...emptyState(mode),
        enabled: true,
        detail: withModel ? "Camera live" : "Teach camera live",
      })
    } catch (cameraError) {
      setError(
        cameraError instanceof Error
          ? cameraError.message
          : "Camera permission was denied or unavailable.",
      )
      setStatus("Camera unavailable")
      setCameraActive(false)
      return
    }

    if (!withModel) return
    if (mode !== "sound") await startModeResource()
  }

  async function startCameraForMode() {
    await openCamera(true)
  }

  async function startTeachCamera() {
    await openCamera(false)
  }

  async function startModeResource() {
    const activeSession = ++sessionRef.current
    setLoading(true)
    setError(null)

    try {
      let resource: ReadyResource = null

      if (mode === "objects") {
        resource = await cocoSsd.load({ base: "mobilenet_v2" })
      } else if (mode === "pose") {
        resource = await loadPoseDetector()
      } else if (mode === "hands" || mode === "numbers") {
        resource = await loadHandDetector()
      } else if (mode === "emotion") {
        resource = await loadFaceEmotion()
      } else if (mode === "trained") {
        if (!store.model) throw new Error("Train My AI first, then start the live test.")
        resource = model ?? await loadStoredAiModel(store.model)
        if (!resource) throw new Error("Saved My AI model could not be loaded. Retrain the model.")
        if (!model) setModel(resource)
      }

      if (activeSession !== sessionRef.current) {
        if (resource && resource !== model) disposeAiResource(resource)
        return
      }

      resourceRef.current = resource
      setLoading(false)
      setStatus(
        mode === "objects" ? "6A Objects ready"
          : mode === "pose" ? "6A Pose ready"
          : mode === "hands" ? "6A Fingers ready"
          : mode === "numbers" ? "6A Numbers ready"
          : mode === "emotion" ? "6A Emotion ready"
          : "6B My AI ready",
      )

      if (mode !== "sound") startInferenceLoop(activeSession)
    } catch (resourceError) {
      if (activeSession !== sessionRef.current) return
      setLoading(false)
      setError(
        resourceError instanceof Error
          ? resourceError.message
          : "The selected AI could not start.",
      )
      setStatus("AI unavailable")
    }
  }

  async function startSound() {
    setError(null)
    stopInference()
    const activeSession = ++sessionRef.current
    setLoading(true)
    try {
      const recognizer = await loadSpeechRecognizer()
      if (activeSession !== sessionRef.current) {
        await stopSpeechRecognizer(recognizer)
        return
      }
      resourceRef.current = recognizer
      setLoading(false)
      setSoundActive(true)
      onAiStateChange({
        ...emptyState("sound"),
        enabled: true,
        detail: "Microphone listening",
      })
      setStatus("6F Sound listening")

      await recognizer.listen(
        (result: any) => {
          if (activeSession !== sessionRef.current) return
          const scores = Array.from(result?.scores ?? []) as number[]
          const labels = recognizer.wordLabels()
          let best = 0
          for (let i = 1; i < scores.length; i += 1) {
            if ((scores[i] ?? 0) > (scores[best] ?? 0)) best = i
          }

          const confidence = Math.round((scores[best] ?? 0) * 100)
          const word = labels[best] ?? "unknown"
          onAiStateChange({
            enabled: true,
            mode: "sound",
            detectedClass: word,
            confidence,
            allDetections: [],
            modelClasses: labels,
            modelSource: "ready",
            detail: confidence >= 65 ? `Heard “${word}”` : "Listening...",
          })
        },
        {
          probabilityThreshold: 0.65,
          invokeCallbackOnNoiseAndUnknown: true,
          includeSpectrogram: false,
        },
      )
    } catch (soundError) {
      if (activeSession !== sessionRef.current) return
      setLoading(false)
      setError(
        soundError instanceof Error
          ? soundError.message
          : "Microphone recognition could not start.",
      )
      setStatus("Sound AI unavailable")
    }
  }

  function startInferenceLoop(activeSession: number) {
    const tick = async () => {
      if (
        !streamRef.current ||
        !videoRef.current ||
        activeSession !== sessionRef.current ||
        !resourceRef.current ||
        busyRef.current
      ) {
        timerRef.current = window.setTimeout(tick, 150)
        return
      }

      const video = videoRef.current
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        timerRef.current = window.setTimeout(tick, 100)
        return
      }

      busyRef.current = true
      const started = performance.now()

      try {
        if (mode === "objects") {
          const predictions = await resourceRef.current.detect(
            video,
            OBJECT_MAX_BOXES,
            OBJECT_MIN_SCORE,
          )
          if (activeSession !== sessionRef.current) return
          // Keep every detection returned by COCO-SSD at/above our live-demo
          // threshold. Do not whitelist classes such as person/car/phone.
          const visible = predictions.filter(
            (p: any) => Number(p.score) >= OBJECT_MIN_SCORE,
          )
          drawBoxes(overlayRef.current!, video, visible.map((p: any) => ({
            class: p.class,
            score: p.score,
            bbox: p.bbox,
          })))
          const primary = visible[0]
          onAiStateChange({
            enabled: true,
            mode: "objects",
            detectedClass: primary ? canonicalObjectClass(primary.class) : "none",
            confidence: primary ? Math.round(primary.score * 100) : 0,
            allDetections: visible.map((p: any) => ({
              class: p.class,
              score: Number(p.score),
              bbox: [
                Number(p.bbox[0]), Number(p.bbox[1]),
                Number(p.bbox[2]), Number(p.bbox[3]),
              ],
            })),
            modelSource: "ready",
            detail: primary ? `${visible.length} object${visible.length === 1 ? "" : "s"} detected` : "Looking...",
          })
        } else if (mode === "pose") {
          const poses = await resourceRef.current.estimatePoses(video)
          if (activeSession !== sessionRef.current) return
          drawPose(overlayRef.current!, video, poses)
          const pose = poses?.[0]
          const visible = pose?.keypoints?.filter((p: any) => (p.score ?? 0) >= 0.25).length ?? 0
          const score = pose && visible ? pose.keypoints.reduce((s: number, p: any) => s + Number(p.score ?? 0), 0) / pose.keypoints.length : 0
          onAiStateChange({
            enabled: true,
            mode: "pose",
            detectedClass: pose ? "person" : "none",
            confidence: Math.round(score * 100),
            allDetections: [],
            modelSource: "ready",
            detail: pose ? `${visible}/17 keypoints tracked` : "No person detected",
          })
        } else if (mode === "hands" || mode === "numbers") {
          const result = await resourceRef.current.estimate(video)
          if (activeSession !== sessionRef.current) return
          drawHands(overlayRef.current!, video, result)
          const hand = result?.multiHandLandmarks?.[0]
          const score = hand ? 0.9 : 0
          const count = hand ? countFingers(hand) : 0
          onAiStateChange({
            enabled: true,
            mode,
            detectedClass: mode === "numbers" ? String(count) : hand ? "hand" : "none",
            confidence: hand ? Math.round(score * 100) : 0,
            allDetections: [],
            modelClasses: mode === "numbers" ? ["0", "1", "2", "3", "4", "5"] : ["hand"],
            modelSource: "ready",
            detail: hand
              ? mode === "numbers" ? `${count} finger${count === 1 ? "" : "s"} extended` : "Hand tracked"
              : "Show a hand",
          })
        } else if (mode === "emotion") {
          const result = await estimateFaceEmotion(resourceRef.current, video)
          if (activeSession !== sessionRef.current) return
          onAiStateChange({
            enabled: true,
            mode: "emotion",
            detectedClass: result?.expression ?? "none",
            confidence: result ? Math.round(result.score * 100) : 0,
            allDetections: [],
            modelSource: "ready",
            detail: result ? `${result.count} face${result.count === 1 ? "" : "s"} · ${result.expression}` : "Show your face",
          })
          if (result) drawFace(overlayRef.current!, video, result)
          else clearOverlay()
        } else if (mode === "trained") {
          const frame = captureVideoFrame(video, 640)
          const result = frame ? await predictAiImage(frame, store.model) : null
          if (activeSession !== sessionRef.current) return
          onAiStateChange({
            enabled: true,
            mode: "trained",
            detectedClass: result?.label ?? "none",
            confidence: result?.confidence ?? 0,
            allDetections: [],
            modelClasses: store.model?.classes ?? [],
            modelSource: "trained",
            detail: result ? Object.entries(result.probabilities).map(([k, v]) => `${k} ${v}%`).join(" · ") : "Show an example",
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
        busyRef.current = false
      }
    }

    timerRef.current = window.setTimeout(tick, 0)
  }

  function stopInput() {
    releaseCurrentResource()
    stopInference()
    stopCamera(videoRef.current, streamRef.current)
    streamRef.current = null
    setCameraActive(false)
    setSoundActive(false)
    onAiStateChange(emptyState(mode))
    setStatus("AI stopped")
  }

  function selectMode(next: ReadyAiMode | "trained") {
    stopInput()
    setMode(next)
    setError(null)
    setCapture(null)
    setStatus(next === "trained" ? "My AI selected" : `${MODES.find((item) => item.id === next)?.title ?? "AI"} selected`)
  }

  function selectTab(next: Tab) {
    stopInput()
    setTab(next)
  }

  function addSampleFromCamera() {
    if (!label.trim()) {
      setStatus("Enter a concept name first.")
      return
    }
    const frame = captureVideoFrame(videoRef.current!, 640)
    if (!frame) {
      setStatus("Start the camera first.")
      return
    }
    const next = addAiSample(store, label, frame)
    setStore(next)
    saveAiStudioStore(next)
    setLabel("")
    setStatus(`Added sample to “${next.samples[next.samples.length - 1]?.label ?? "concept"}”.`)
  }

  function importSample(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !label.trim()) {
      setStatus("Enter a concept name and choose an image.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setStatus("Image could not be read.")
        return
      }
      const next = addAiSample(store, label, reader.result)
      setStore(next)
      saveAiStudioStore(next)
      setLabel("")
      setStatus("Image added.")
    }
    reader.readAsDataURL(file)
  }

  async function train() {
    if (!canTrain || training) return
    setTraining(true)
    setError(null)
    setProgress({ epoch: 0, total: 18, accuracy: 0, loss: 0 })
    try {
      const result = await trainAiModel(store.samples, {
        epochs: 18,
        onEpoch: (epoch, total, accuracy, loss) =>
          setProgress({ epoch, total, accuracy, loss }),
      })
      const next = { ...store, model: result.summary }
      setStore(next)
      saveAiStudioStore(next)
      setModel(result.model)
      setMode("trained")
      setTab("try")
      setStatus(`My AI learned ${result.summary.classes.length} concepts.`)
    } catch (trainError) {
      setError(trainError instanceof Error ? trainError.message : "Training failed.")
    } finally {
      setTraining(false)
    }
  }

  async function resetStudio() {
    stopInput()
    await clearAiStudioStore()
    setStore({ samples: [], model: null })
    setModel(null)
    setLabel("")
    setCapture(null)
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

  if (!isOpen && runtimeEnabled) {
    return (
      <div className="fixed bottom-20 right-4 z-[70] w-[min(280px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/95 text-white shadow-2xl ring-1 ring-black/40">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-emerald-300">PIXIU AI RUNTIME</p>
            <p className="truncate text-[10px] font-black">{activeTitle} · {mode === "sound" ? "MIC" : "CAMERA"}</p>
          </div>
          <span className="ml-2 shrink-0 rounded-full border border-emerald-400/20 px-2 py-1 text-[8px] font-mono text-emerald-300">LIVE</span>
        </div>
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-md bg-slate-950/85 px-2 py-1 text-[9px] font-mono">
            {aiState.detectedClass === "none" ? status : aiState.detectedClass + " · " + aiState.confidence + "%"}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-400/20 bg-[#07111f] text-white shadow-2xl shadow-black/60">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-violet-300">PIXIU AI STUDIO</p>
              <h2 className="text-sm font-black sm:text-base">Try AI · Teach AI · Connect AI</h2>
            </div>
          </div>
          <button onClick={() => { stopInput(); onClose() }} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close AI Studio">
            <X size={17} />
          </button>
        </header>

        <nav className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/25 p-2">
          {([
            ["try", "Try", Sparkles],
            ["teach", "Teach", Brain],
            ["understand", "Understand", Layers3],
          ] as const).map(([value, title, Icon]) => (
            <button key={value} onClick={() => selectTab(value)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black ${tab === value ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"}`}>
              <Icon size={13} />{title}
            </button>
          ))}
          <span className="ml-auto hidden text-[9px] font-mono text-slate-600 sm:block">{store.samples.length} examples</span>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "try" && (
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
                {MODES.map((item) => (
                  <button key={item.id} onClick={() => selectMode(item.id)} className={`rounded-2xl border p-3 text-left ${mode === item.id ? "border-violet-400/35 bg-violet-500/[0.08]" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"}`}>
                    <p className="text-[10px] font-black">{item.title}</p>
                    <p className="mt-1 text-[9px] leading-4 text-slate-600">{item.subtitle}</p>
                  </button>
                ))}
                <button disabled={!store.model} onClick={() => selectMode("trained")} className={`rounded-2xl border p-3 text-left ${mode === "trained" ? "border-emerald-400/35 bg-emerald-500/[0.05]" : "border-slate-800 bg-slate-950/40"} disabled:opacity-35`}>
                  <p className="text-[10px] font-black">My AI</p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-600">Your trained model</p>
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
                <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
                  <div className="relative aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                    <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                    {!inputActive && (
                      <div className="absolute inset-0 grid place-items-center bg-slate-950/95 p-6 text-center">
                        {isSound ? <Mic size={32} className="mx-auto text-violet-300" /> : <Camera size={32} className="mx-auto text-violet-300" />}
                        <p className="mt-3 text-sm font-black">{isSound ? "Microphone off" : "Camera off"}</p>
                        <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">6A loads only the selected Ready AI. 6B uses My AI. 6C is the live Blockly bridge.</p>
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/85 px-2.5 py-1 font-mono text-[9px]">
                      {loading ? "LOADING" : inputActive ? (mode === "trained" ? "MY AI LIVE" : `${activeTitle.toUpperCase()} LIVE`) : "READY"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-3 py-3">
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">{activeTitle}</p>
                      <p className="mt-1 text-sm font-black">{aiState.detectedClass === "none" ? status : aiState.detectedClass}</p>
                      <p className="mt-0.5 text-[9px] text-slate-600">{aiState.detail}</p>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-violet-300">
                      <span className="text-[10px]">{fps ? `${fps} FPS` : "—"}</span>
                      <span className="text-sm font-black">{aiState.confidence ? `${aiState.confidence}%` : "—"}</span>
                    </div>
                  </div>
                </div>

                <aside className="space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <p className="text-xs font-black">6A · Ready AI</p>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      Objects, Pose, Fingers, Emotion, Sound and Numbers share one camera lifecycle. Models are loaded only when selected.
                    </p>
                    <button onClick={isSound ? (soundActive ? stopInput : startSound) : (cameraActive ? stopInput : startCameraForMode)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black">
                      {(isSound ? soundActive : cameraActive) ? (isSound ? <Mic size={13} /> : <CameraOff size={13} />) : isSound ? <Mic size={13} /> : <Camera size={13} />}
                      {(isSound ? soundActive : cameraActive) ? "Stop" : isSound ? "Start microphone" : "Start camera"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.03] p-4">
                    <div className="flex items-center gap-2"><Zap size={14} className="text-emerald-300" /><p className="text-xs font-black">6C · AI → Circuit</p></div>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">The Workbench receives detected class, confidence and detections. Blockly can use AI sees, AI class, AI confidence and AI camera ON/OFF.</p>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {["car", "person", "phone", "hand", "0", "3", "happy", "yes"].map((signal) => (
                        <button key={signal} onClick={() => onAiStateChange({ ...aiState, enabled: true, detectedClass: signal, confidence: 95, detail: `Test signal · ${signal}` })} className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5 text-[9px] font-mono text-slate-300 hover:border-emerald-400/30">
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
            <div className="mx-auto max-w-5xl grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <p className="text-xs font-black">6B · Teach My AI</p>
                  <p className="mt-1 text-[10px] leading-5 text-slate-500">Create at least 3 examples for each concept. Examples stay in this browser.</p>
                  <div className="mt-3 flex gap-2">
                    <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. bottle" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] outline-none focus:border-violet-400" />
                    <button onClick={cameraActive ? addSampleFromCamera : () => void startTeachCamera()} className="rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black">{cameraActive ? "Add example" : "Start camera"}</button>
                    <label className="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-black"><Upload size={13} className="inline mr-1" />Image<input hidden type="file" accept="image/*" onChange={importSample} /></label>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {classes.map((name) => (
                    <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between"><span className="text-xs font-black">{name}</span><span className="font-mono text-[9px] text-slate-500">{counts[name] ?? 0} samples</span></div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {store.samples.filter((sample) => sample.label === name).map((sample) => (
                          <div key={sample.id} className="relative">
                            <img src={sample.dataUrl} alt={name} className="h-16 w-20 rounded-lg object-cover border border-slate-800" />
                            <button onClick={() => { const next = removeAiSample(store, sample.id); setStore(next); saveAiStudioStore(next) }} className="absolute right-1 top-1 rounded-md bg-slate-950/80 p-1"><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs font-black">Train model</p><p className="mt-1 text-[10px] text-slate-500">{classes.length} classes · {store.samples.length} samples</p></div>
                    <button disabled={!canTrain || training} onClick={() => void train()} className="rounded-xl bg-violet-500 px-4 py-2 text-[10px] font-black disabled:opacity-30">{training ? `Training ${progress.epoch}/${progress.total}` : "Train My AI"}</button>
                  </div>
                  {training && <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-violet-400" style={{ width: `${Math.round((progress.epoch / Math.max(1, progress.total)) * 100)}%` }} /></div>}
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <p className="text-xs font-black">Teaching rules</p>
                  {["Two or more concepts", "Three examples per concept", "Keep lighting/background varied", "Train after the examples are balanced"].map((rule) => (
                    <div key={rule} className="mt-2 flex items-center gap-2 text-[10px] text-slate-500"><CheckCircle2 size={13} className="text-emerald-300" />{rule}</div>
                  ))}
                </div>
                <button onClick={() => void resetStudio()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-black text-slate-300"><RefreshCcw size={13} /> Reset AI Studio</button>
              </aside>
            </div>
          )}

          {tab === "understand" && (
            <div className="mx-auto max-w-5xl grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-center gap-2"><Layers3 size={15} className="text-violet-300" /><p className="text-xs font-black">6B · Understand My AI</p></div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">See the learned model without exposing raw implementation complexity to the student.</p>
                <div className="mt-3 rounded-xl bg-slate-950 p-3 font-mono text-[9px] text-slate-500">
                  {model ? getModelWeightShapes(model).map((shape) => <div key={shape} className="py-1">{shape}</div>) : <div>No trained model yet.</div>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <p className="text-xs font-black">Model weights preview</p>
                <div className="mt-3 grid gap-2">
                  {(model ? getModelWeightPreview(model) : []).slice(0, 8).map((row, index) => <div key={index} className="rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[8px] text-slate-500">{row.join(" · ")}</div>)}
                </div>
                {!model && <p className="mt-3 text-[10px] text-slate-600">Train My AI in the Teach tab to inspect its layers and weights.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
