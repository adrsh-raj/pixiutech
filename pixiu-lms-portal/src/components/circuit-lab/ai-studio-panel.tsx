"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  Camera,
  CameraOff,
  CheckCircle2,
  CircleDot,
  Layers3,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import { loadObjectDetector, detectObjects, disposeObjectDetector } from "@/lib/ai/object-detector"
import {
  disposeMoveNet,
  estimateMoveNetPose,
  loadMoveNet,
  MOVENET_EDGES,
} from "@/lib/ai/pose-detector"
import {
  captureVideoFrame,
  startCamera,
  stopCamera,
} from "@/lib/ai/camera-session"
import type { AiDetection, AiVisionMode, AiVisionState, PoseResult } from "@/lib/ai/vision-types"

export type { AiVisionState }

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning?: boolean
  onStartSim?: () => void
}

type ModelResource = cocoSsd.ObjectDetection | import("@tensorflow/tfjs").GraphModel

const MODES: Array<{
  id: AiVisionMode
  title: string
  subtitle: string
  phase: string
}> = [
  { id: "camera", title: "Camera", subtitle: "6A - live camera engine", phase: "6A" },
  { id: "objects", title: "Objects", subtitle: "6B - object detection", phase: "6B" },
  { id: "pose", title: "Pose", subtitle: "6C - 17 body keypoints", phase: "6C" },
]

const INITIAL_AI: AiVisionState = {
  enabled: false,
  mode: "camera",
  detectedClass: "none",
  confidence: 0,
  allDetections: [],
  detail: "Camera idle",
}

function emptyState(mode: AiVisionMode): AiVisionState {
  return {
    enabled: false,
    mode,
    detectedClass: "none",
    confidence: 0,
    allDetections: [],
    detail: mode === "camera" ? "Camera idle" : "AI idle",
  }
}

function drawObjectOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  predictions: cocoSsd.DetectedObject[],
) {
  const width = video.videoWidth || 640
  const height = video.videoHeight || 480
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineWidth = Math.max(2, width / 320)
  context.font = "700 13px system-ui, sans-serif"

  predictions.forEach((prediction) => {
    if (prediction.score < 0.45) return

    const [x, y, w, h] = prediction.bbox
    context.strokeStyle = "#a78bfa"
    context.strokeRect(x, y, w, h)

    const label = `${prediction.class} ${Math.round(prediction.score * 100)}%`
    const labelWidth = context.measureText(label).width + 14
    const labelY = Math.max(0, y - 22)

    context.fillStyle = "#a78bfa"
    context.fillRect(x, labelY, labelWidth, 22)
    context.fillStyle = "#0f172a"
    context.fillText(label, x + 7, labelY + 15)
  })
}

function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  pose: PoseResult | null,
) {
  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!pose) return

  context.lineWidth = 3
  context.strokeStyle = "#22c55e"
  context.fillStyle = "#f8fafc"

  for (const [from, to] of MOVENET_EDGES) {
    const a = pose.keypoints[from]
    const b = pose.keypoints[to]
    if (!a || !b || a.score < 0.25 || b.score < 0.25) continue

    context.beginPath()
    context.moveTo(a.x, a.y)
    context.lineTo(b.x, b.y)
    context.stroke()
  }

  for (const point of pose.keypoints) {
    if (point.score < 0.25) continue
    context.beginPath()
    context.arc(point.x, point.y, 5, 0, Math.PI * 2)
    context.fill()
  }
}

export function AiStudioPanel({
  isOpen,
  onClose,
  aiState,
  onAiStateChange,
  isSimRunning = false,
  onStartSim,
}: Props) {
  const [mode, setMode] = useState<AiVisionMode>("camera")
  const [cameraActive, setCameraActive] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("Camera idle")
  const [fps, setFps] = useState(0)
  const [lastCapture, setLastCapture] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<ModelResource | null>(null)
  const modelModeRef = useRef<AiVisionMode>("camera")
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const inFlightRef = useRef(false)
  const frameCounterRef = useRef(0)
  const fpsWindowStartRef = useRef(0)

  useEffect(() => {
    if (!isOpen) {
      stopAll()
      return
    }

    setMode("camera")
    setCameraActive(false)
    setModelLoading(false)
    setError(null)
    setStatus("Camera idle")
    setFps(0)
    setLastCapture(null)
    onAiStateChange({ ...INITIAL_AI })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !cameraActive) {
      return
    }

    let cancelled = false
    const session = ++sessionRef.current

    const loadSelectedModel = async () => {
      disposeCurrentModel()

      if (mode === "camera") {
        setModelLoading(false)
        setStatus("6A camera ready")
        return
      }

      setModelLoading(true)
      setError(null)
      setStatus(mode === "objects" ? "Loading object model..." : "Loading MoveNet...")

      try {
        const resource =
          mode === "objects"
            ? await loadObjectDetector()
            : await loadMoveNet()

        if (cancelled || session !== sessionRef.current) {
          disposeResource(resource)
          return
        }

        modelRef.current = resource
        modelModeRef.current = mode
        setModelLoading(false)
        setStatus(mode === "objects" ? "6B object AI ready" : "6C pose AI ready")
        startInferenceLoop(session)
      } catch (loadError) {
        if (cancelled || session !== sessionRef.current) return
        setModelLoading(false)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The AI model could not be loaded.",
        )
        setStatus("Model unavailable")
        setCameraActive(false)
        onAiStateChange(emptyState(mode))
      }
    }

    void loadSelectedModel()

    return () => {
      cancelled = true
      sessionRef.current += 1
      stopInferenceLoop()
    }
  }, [isOpen, cameraActive, mode])

  useEffect(() => {
    if (!cameraActive || mode !== "camera") {
      stopInferenceLoop()
      if (cameraActive && mode === "camera") {
        setStatus("6A camera ready")
      }
    }
  }, [cameraActive, mode])

  function disposeResource(resource: ModelResource | null) {
    if (!resource) return

    if ("detect" in resource) {
      disposeObjectDetector(resource)
    } else {
      disposeMoveNet(resource)
    }
  }

  function disposeCurrentModel() {
    const resource = modelRef.current
    modelRef.current = null
    modelModeRef.current = "camera"
    disposeResource(resource)
  }

  function stopInferenceLoop() {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    inFlightRef.current = false
    frameCounterRef.current = 0
    fpsWindowStartRef.current = 0
    if (overlayRef.current) {
      const context = overlayRef.current.getContext("2d")
      context?.clearRect(
        0,
        0,
        overlayRef.current.width,
        overlayRef.current.height,
      )
    }
  }

  function startInferenceLoop(session: number) {
    stopInferenceLoop()
    const activeSession = sessionRef.current = session

    const tick = async () => {
      if (
        !isOpen ||
        !cameraActive ||
        activeSession !== sessionRef.current ||
        !videoRef.current ||
        !modelRef.current ||
        modelModeRef.current === "camera"
      ) {
        return
      }

      if (inFlightRef.current) {
        timerRef.current = window.setTimeout(tick, 80)
        return
      }

      const video = videoRef.current
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) {
        timerRef.current = window.setTimeout(tick, 120)
        return
      }

      inFlightRef.current = true
      const started = performance.now()

      try {
        if (modelModeRef.current === "objects") {
          const predictions = await detectObjects(
            modelRef.current as cocoSsd.ObjectDetection,
            video,
          )
          if (activeSession !== sessionRef.current) return

          const overlay = overlayRef.current
          if (overlay) drawObjectOverlay(overlay, video, predictions)

          const visible = predictions.filter((item) => item.score >= 0.45)
          const primary = visible[0]

          onAiStateChange({
            enabled: true,
            mode: "objects",
            detectedClass: primary?.class ?? "none",
            confidence: primary ? Math.round(primary.score * 100) : 0,
            allDetections: visible.map((item) => ({
              class: item.class,
              score: Number(item.score),
              bbox: [
                Number(item.bbox[0]),
                Number(item.bbox[1]),
                Number(item.bbox[2]),
                Number(item.bbox[3]),
              ],
            })),
            detail: primary
              ? `${visible.length} object${visible.length === 1 ? "" : "s"} detected`
              : "Looking for objects...",
          })
        } else {
          const pose = await estimateMoveNetPose(
            modelRef.current as import("@tensorflow/tfjs").GraphModel,
            video,
          )
          if (activeSession !== sessionRef.current) return

          const overlay = overlayRef.current
          if (overlay) {
            const width = video.videoWidth || 640
            const height = video.videoHeight || 480
            if (overlay.width !== width || overlay.height !== height) {
              overlay.width = width
              overlay.height = height
            }
            drawPoseOverlay(overlay, pose)
          }

          onAiStateChange({
            enabled: true,
            mode: "pose",
            detectedClass: pose ? "person" : "none",
            confidence: pose ? Math.round(pose.score * 100) : 0,
            allDetections: [],
            detail: pose
              ? `${pose.keypoints.filter((point) => point.score >= 0.25).length}/17 keypoints tracked`
              : "No person detected",
          })
        }

        frameCounterRef.current += 1
        const now = performance.now()
        if (!fpsWindowStartRef.current) fpsWindowStartRef.current = now
        if (now - fpsWindowStartRef.current >= 1000) {
          const elapsed = now - fpsWindowStartRef.current
          setFps(Math.round((frameCounterRef.current * 1000) / elapsed))
          frameCounterRef.current = 0
          fpsWindowStartRef.current = now
        }
      } catch (inferenceError) {
        if (activeSession === sessionRef.current) {
          setError(
            inferenceError instanceof Error
              ? inferenceError.message
              : "AI inference failed.",
          )
          setStatus("Inference paused")
        }
      } finally {
        inFlightRef.current = false
      }

      if (activeSession === sessionRef.current && cameraActive) {
        const elapsed = performance.now() - started
        timerRef.current = window.setTimeout(tick, Math.max(120, 180 - elapsed))
      }
    }

    timerRef.current = window.setTimeout(tick, 0)
  }

  async function startLiveCamera() {
    if (cameraActive) return

    setError(null)
    setStatus("Starting camera...")
    try {
      const video = videoRef.current
      if (!video) throw new Error("Camera preview is not ready.")

      const stream = await startCamera(video)
      streamRef.current = stream
      setCameraActive(true)
      onAiStateChange({
        enabled: true,
        mode,
        detectedClass: "none",
        confidence: 0,
        allDetections: [],
        detail: mode === "camera" ? "6A camera live" : `6A camera live - starting ${mode === "objects" ? "6B" : "6C"}`,
      })
      setStatus(mode === "camera" ? "6A camera live" : "Camera live - loading AI")
    } catch (cameraError) {
      setError(
        cameraError instanceof Error
          ? cameraError.message
          : "Camera permission was denied or unavailable.",
      )
      setStatus("Camera unavailable")
      setCameraActive(false)
    }
  }

  function stopLiveCamera() {
    stopAll()
    onAiStateChange(emptyState(mode))
  }

  function stopAll() {
    sessionRef.current += 1
    stopInferenceLoop()
    disposeCurrentModel()

    if (streamRef.current || videoRef.current) {
      stopCamera(videoRef.current, streamRef.current)
    }

    streamRef.current = null
    setCameraActive(false)
    setModelLoading(false)
    setFps(0)
  }

  async function captureFrame() {
    const video = videoRef.current
    if (!video || !cameraActive) return

    const image = captureVideoFrame(video)
    if (!image) {
      setError("No camera frame is available yet.")
      return
    }

    setLastCapture(image)
    setStatus("Frame captured locally")
  }

  function selectMode(next: AiVisionMode) {
    if (next === mode) return
    setError(null)
    setStatus(next === "camera" ? "6A camera mode" : next === "objects" ? "Preparing 6B..." : "Preparing 6C...")
    if (mode !== "camera") {
      disposeCurrentModel()
      stopInferenceLoop()
    }
    setMode(next)
    onAiStateChange(emptyState(next))
  }

  if (!isOpen) return null

  const selectedMode = MODES.find((item) => item.id === mode) ?? MODES[0]
  const aiLive = cameraActive && mode !== "camera" && !modelLoading && !error
  const cameraLive = cameraActive

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(92vh,880px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-400/20 bg-[#07111f] text-white shadow-2xl shadow-black/60">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-violet-300">
                PIXIU CYBERLAB
              </p>
              <h2 className="text-sm font-black sm:text-base">AI Vision Studio - Phase 6</h2>
            </div>
          </div>
          <button
            onClick={() => {
              stopAll()
              onClose()
            }}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
            aria-label="Close AI Studio"
          >
            <X size={17} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectMode(item.id)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      mode === item.id
                        ? "border-violet-400/40 bg-violet-500/[0.08]"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black">{item.title}</span>
                      <span className={`font-mono text-[9px] ${
                        mode === item.id ? "text-violet-300" : "text-slate-600"
                      }`}>{item.phase}</span>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-slate-500">{item.subtitle}</p>
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
                <div className="relative aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />

                  {!cameraLive && (
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/95 p-6 text-center">
                      <div>
                        <Camera size={32} className="mx-auto text-violet-300" />
                        <p className="mt-3 text-sm font-black">Camera is off</p>
                        <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">
                          6A must be stable by itself. Start the camera first; AI models load only for 6B or 6C.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/85 px-2.5 py-1 font-mono text-[9px]">
                    <CircleDot size={10} className={cameraLive ? "text-emerald-300" : "text-slate-600"} />
                    <span className={cameraLive ? "text-emerald-300" : "text-slate-500"}>
                      {cameraLive ? (aiLive ? `${selectedMode.title} LIVE` : "CAMERA LIVE") : "READY"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-3 py-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">
                      {selectedMode.phase} / {selectedMode.title}
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {aiState.detectedClass === "none" ? status : aiState.detectedClass}
                    </p>
                    <p className="mt-0.5 text-[9px] text-slate-600">{aiState.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-violet-300">{fps ? `${fps} FPS` : "—"}</span>
                    <span className="font-mono text-sm font-black text-violet-200">
                      {aiState.confidence ? `${aiState.confidence}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-3 text-[10px] leading-5 text-amber-200">
                  <Activity size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={cameraLive ? stopLiveCamera : startLiveCamera}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-[10px] font-black text-white hover:bg-violet-400"
                >
                  {cameraLive ? <CameraOff size={15} /> : <Camera size={15} />}
                  {cameraLive ? "Stop camera" : "Start camera"}
                </button>

                <button
                  onClick={() => void captureFrame()}
                  disabled={!cameraLive}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-[10px] font-black text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <CircleDot size={15} />
                  Capture frame
                </button>

                <button
                  onClick={() => {
                    stopAll()
                    setError(null)
                    setStatus("Session reset")
                    onAiStateChange(emptyState(mode))
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-[10px] font-black text-slate-200 hover:bg-slate-800"
                >
                  <RefreshCcw size={15} />
                  Reset session
                </button>
              </div>

              {lastCapture && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
                      Local frame capture
                    </p>
                    <span className="text-[9px] text-emerald-300">not uploaded by this action</span>
                  </div>
                  <img
                    src={lastCapture}
                    alt="Captured camera frame"
                    className="mt-2 max-h-40 w-auto rounded-xl border border-slate-800"
                  />
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-t border-slate-800 bg-slate-950/45 p-4 lg:border-l lg:border-t-0 sm:p-6">
            <div className="space-y-4">
              <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <Layers3 size={15} className="text-violet-300" />
                  <span className="text-xs font-black">Built in layers</span>
                </div>
                <div className="mt-3 space-y-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-300" />
                    <span>6A Camera session is model-free.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-300" />
                    <span>6B Object AI loads only when selected.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-300" />
                    <span>6C MoveNet loads only when selected.</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex items-center gap-2">
                  <Zap size={15} className="text-violet-300" />
                  <span className="text-xs font-black">Current phase</span>
                  {modelLoading && <LoaderCircle size={13} className="ml-auto animate-spin text-amber-300" />}
                </div>
                <p className="mt-2 text-[11px] font-black text-slate-200">
                  {selectedMode.phase} - {selectedMode.title}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  {mode === "camera"
                    ? "Camera, permissions, frame readiness and cleanup are tested before any model exists."
                    : mode === "objects"
                      ? "COCO-SSD Lite detects multiple objects and exposes bounding boxes plus confidence."
                      : "MoveNet Lightning estimates 17 body keypoints and draws a skeleton over the live frame."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="text-xs font-black">AI status</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-950/70 p-3">
                    <p className="text-[9px] text-slate-600">Camera</p>
                    <p className="mt-1 text-xs font-black">{cameraLive ? "LIVE" : "OFF"}</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/70 p-3">
                    <p className="text-[9px] text-slate-600">Model</p>
                    <p className="mt-1 text-xs font-black">
                      {modelLoading ? "LOADING" : mode === "camera" ? "NONE" : aiLive ? "READY" : "IDLE"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-500/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-emerald-300" />
                  <span className="text-xs font-black">AI - Circuit bridge</span>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  The latest normalized AI result remains available to the Blockly runtime. Hardware actions stay outside the vision engine.
                </p>
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 font-mono text-[9px] text-slate-600">
                  detectedClass · confidence · detections
                </div>
                {onStartSim && !isSimRunning && (
                  <button
                    onClick={onStartSim}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-[10px] font-black text-slate-950"
                  >
                    Run circuit
                  </button>
                )}
              </div>

              <p className="px-1 text-[9px] leading-4 text-slate-600">
                Phase 6D+ stays locked until 6A, 6B and 6C pass their own end-to-end gates.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
