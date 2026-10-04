"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, CameraOff, Sparkles, X, Minimize2, Maximize2 } from "lucide-react"
import {
  DEFAULT_OBJECT_MAX_BOXES,
  detectObjects,
  disposeObjectDetector,
  loadObjectDetector,
  type ObjectDetector,
} from "@/lib/ai/object-detector"
import {
  startCamera,
  stopCamera,
} from "@/lib/ai/camera-session"
import type { AiRuntimeErrorKind } from "@/lib/ai/ai-runtime-state"
import { toAiRuntimeError } from "@/lib/ai/ai-errors"
import type { AiVisionState } from "@/lib/ai/vision-types"
import { createAiVisionState } from "@/lib/ai/vision-state"
import "./pixiu-brand.css"

export type { AiVisionState }

function formatAiObjectLabel(value: string) {
  const normalized = String(value || "unknown").trim().toLowerCase()
  if (!normalized || normalized === "none" || normalized === "unknown") return "Unknown"
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function aiObjectIcon(value: string) {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "person") return "👤"
  if (normalized === "car") return "🚗"
  if (normalized === "dog") return "🐕"
  if (normalized === "cat") return "🐈"
  if (normalized === "bird") return "🐦"
  if (normalized === "cell phone" || normalized === "phone") return "📱"
  return "◉"
}

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning?: boolean
  runtimeEnabled?: boolean
  onStartSim?: () => void
}

export function AiCameraPanel({
  isOpen,
  onClose,
  aiState,
  onAiStateChange,
  isSimRunning = false,
  runtimeEnabled = false,
  onStartSim,
}: Props) {
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<ObjectDetector | null>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const busyRef = useRef(false)
  const aiStateRef = useRef(aiState)

  useEffect(() => {
    aiStateRef.current = aiState
  }, [aiState])

  function clearLoop() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    busyRef.current = false
  }

  function releaseResources() {
    clearLoop()
    const model = modelRef.current
    modelRef.current = null
    if (model) disposeObjectDetector(model)

    const stream = streamRef.current
    streamRef.current = null
    stopCamera(videoRef.current, stream)
  }

  function stopRuntime() {
    sessionRef.current += 1
    releaseResources()
    setCameraActive(false)
    setModelLoaded(false)
    setModelLoading(false)
    onAiStateChange({
      ...createAiVisionState(aiStateRef.current.mode),
      runtimeStatus: "stopped",
      detail: "AI stopped",
    })
  }

  useEffect(() => {
    if (!isOpen || !runtimeEnabled) {
      sessionRef.current += 1
      releaseResources()
      setCameraActive(false)
      setModelLoaded(false)
      setModelLoading(false)
      return
    }

    const activeSession = ++sessionRef.current
    let disposed = false

    async function boot() {
      setCameraError(null)
      setModelLoading(true)
      onAiStateChange({
        ...aiStateRef.current,
        mode: "objects",
        runtimeStatus: "loading",
        runtimeError: undefined,
        runtimeErrorKind: undefined,
        detail: "Starting camera…",
      })

      try {
        const video = videoRef.current
        if (!video) throw new Error("Camera preview is not mounted.")

        const stream = await startCamera(video, {
          width: 640,
          height: 480,
          frameRate: 15,
        })

        if (disposed || activeSession !== sessionRef.current) {
          stopCamera(video, stream)
          return
        }

        streamRef.current = stream
        setCameraActive(true)
        onAiStateChange({
          ...aiStateRef.current,
          enabled: true,
          mode: "objects",
          runtimeStatus: "loading",
          runtimeError: undefined,
          runtimeErrorKind: undefined,
          detail: "Camera live · loading AI",
        })

        const model = await loadObjectDetector()

        if (disposed || activeSession !== sessionRef.current) {
          disposeObjectDetector(model)
          return
        }

        modelRef.current = model
        setModelLoaded(true)
        setModelLoading(false)
        onAiStateChange({
          ...aiStateRef.current,
          enabled: true,
          mode: "objects",
          runtimeStatus: "ready",
          runtimeError: undefined,
          runtimeErrorKind: undefined,
          detail: "AI ready",
        })

        const tick = async () => {
          if (disposed || activeSession !== sessionRef.current) return

          const videoElement = videoRef.current
          const modelElement = modelRef.current
          if (!streamRef.current || !videoElement || !modelElement || busyRef.current) {
            timerRef.current = window.setTimeout(tick, 150)
            return
          }

          if (
            videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            !videoElement.videoWidth ||
            !videoElement.videoHeight
          ) {
            timerRef.current = window.setTimeout(tick, 100)
            return
          }

          busyRef.current = true
          const started = performance.now()

          try {
            // detectObjects(modelRef.current, video
            const predictions = await detectObjects(
              modelElement,
              videoElement,
              {
                maxNumBoxes: DEFAULT_OBJECT_MAX_BOXES,
                minScore: 0.45,
              },
            )

            if (disposed || activeSession !== sessionRef.current) return

            const canvas = canvasRef.current
            const ctx = canvas?.getContext("2d")
            if (canvas && ctx) {
              if (
                canvas.width !== videoElement.videoWidth ||
                canvas.height !== videoElement.videoHeight
              ) {
                canvas.width = videoElement.videoWidth
                canvas.height = videoElement.videoHeight
              }

              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.lineWidth = 3
              ctx.font = "bold 12px monospace"

              for (const prediction of predictions) {
                const [x, y, width, height] = prediction.bbox
                ctx.strokeStyle = "#a78bfa"
                ctx.strokeRect(x, y, width, height)

                const label = prediction.class.toUpperCase() + " " + Math.round(prediction.score * 100) + "%"
                const textWidth = ctx.measureText(label).width + 10
                ctx.fillStyle = "#a78bfa"
                ctx.fillRect(x, Math.max(0, y - 20), textWidth, 20)
                ctx.fillStyle = "#020617"
                ctx.fillText(label, x + 5, Math.max(14, y - 5))
              }
            }

            const primary = predictions[0]
            onAiStateChange({
              enabled: true,
              mode: "objects",
              runtimeStatus: "running",
              detectedClass: primary?.class ?? "none",
              confidence: primary ? Math.round(primary.score * 100) : 0,
              allDetections: predictions,
              modelSource: "ready",
              detail: primary
                ? String(predictions.length) +
                  " object" +
                  (predictions.length === 1 ? "" : "s") +
                  " detected"
                : "Looking…",
            })
          } catch (error) {
            if (disposed || activeSession !== sessionRef.current) return
            const structuredError = toAiRuntimeError(error, "Vision")
            const errorKind = structuredError.kind
            const message = structuredError.userMessage
            onAiStateChange({
              ...aiStateRef.current,
              enabled: false,
              mode: "objects",
              runtimeStatus: "error",
              runtimeErrorKind: errorKind,
              runtimeError: message,
              detail: "Vision inference unavailable · retrying",
            })
          } finally {
            busyRef.current = false
            if (!disposed && activeSession === sessionRef.current) {
              const elapsed = performance.now() - started
              timerRef.current = window.setTimeout(
                tick,
                Math.max(180, 280 - elapsed),
              )
            }
          }
        }

        timerRef.current = window.setTimeout(tick, 0)
      } catch (error) {
        if (disposed || activeSession !== sessionRef.current) return

        const structuredError = toAiRuntimeError(error, "Camera")
        const errorKind = structuredError.kind
        const message = structuredError.userMessage

        releaseResources()
        setCameraActive(false)
        setModelLoaded(false)
        setModelLoading(false)
        setCameraError(message)

        onAiStateChange({
          ...createAiVisionState("objects"),
          enabled: false,
          runtimeStatus: "error",
          runtimeErrorKind: errorKind,
          runtimeError: message,
          detail: message,
        })
      }
    }

    void boot()

    return () => {
      disposed = true
      sessionRef.current += 1
      releaseResources()
      setCameraActive(false)
      setModelLoaded(false)
      setModelLoading(false)
    }
  }, [isOpen, runtimeEnabled])

  if (!isOpen) return null

  return (
    <div
      className={`pixiu-ai-floating fixed bottom-12 right-6 z-40 flex flex-col rounded-2xl border bg-slate-950/95 shadow-2xl backdrop-blur-md text-white overflow-hidden transition-all duration-300 ${minimized ? "w-64" : "w-80 sm:w-96"}`}
      style={{ boxShadow: "0 10px 35px -5px rgba(168, 85, 247, 0.35)" }}
    >
      <div className="pixiu-ai-floating-header flex items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b">
        <div className="flex items-center gap-2">
          <div className="pixiu-ai-mark h-6 w-6 rounded-lg flex items-center justify-center">
            <Sparkles size={13} className={modelLoading ? "animate-spin" : ""} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>PIXIU AI VISION</span>
              <span className="pixiu-ai-live-chip text-[9px] font-mono px-1.5 py-0.2 rounded-full border">
                PIXIU VISION CORE
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 hover:text-white rounded hover:bg-white/10 transition"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            onClick={() => {
              stopRuntime()
              onClose()
            }}
            className="p-1 hover:text-white rounded hover:bg-red-500/20 hover:text-red-300 transition"
            title="Close Pixiu AI Vision"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
            {modelLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
                <div className="px-5 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl border border-violet-400/30 bg-violet-500/10 flex items-center justify-center">
                    <Sparkles size={22} className="text-violet-300 animate-pulse" />
                  </div>
                  <p className="mt-3 text-xs font-black text-white">
                    Loading PIXIU Vision Model
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Camera is starting. Preparing local object recognition…
                  </p>
                </div>
              </div>
            )}

            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full pointer-events-none"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <CameraOff size={20} />
                </div>
                <div className="text-xs font-semibold text-slate-300">
                  Vision Runtime Not Started
                </div>
                <p className="text-[11px] text-slate-500 max-w-[220px]">
                  {cameraError ?? "Run an AI program to activate PIXIU Vision Core."}
                </p>
              </div>
            )}

            {cameraActive && (
              <button
                onClick={stopRuntime}
                className="absolute top-2 right-2 rounded-md bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-slate-300 p-1 text-xs transition"
                title="Turn off webcam"
              >
                <CameraOff size={13} />
              </button>
            )}

            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300">
              <span
                className={`h-1.5 w-1.5 rounded-full ${modelLoaded ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
              />
              <span>
                {modelLoading
                  ? "Loading…"
                  : modelLoaded
                    ? "PIXIU AI ACTIVE"
                    : "Idle"}
              </span>
            </div>
          </div>

          {cameraError && (
            <div className="bg-amber-950/40 border-y border-amber-500/30 px-3 py-1.5 text-[10px] text-amber-300">
              {cameraError}
            </div>
          )}

          <div className="pixiu-ai-signal-card flex items-center justify-between px-3 py-2 border-b text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Vision Signal:</span>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border bg-slate-800 border-slate-700 text-slate-200">
                {aiState.detectedClass !== "none" && !aiState.unknown
                  ? `${aiObjectIcon(aiState.detectedClass)} ${formatAiObjectLabel(aiState.detectedClass)}`
                  : "LOOKING AT VIDEO..."}
              </span>
            </div>
            {aiState.detectedClass !== "none" && (
              <span className="font-mono text-xs font-bold text-purple-300">
                {aiState.confidence}%
              </span>
            )}
          </div>

          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isSimRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
              />
              <span className="text-[11px] text-slate-300">
                {isSimRunning ? "Circuit Runtime · Live" : "Circuit Runtime Stopped"}
              </span>
            </div>
            {!isSimRunning && onStartSim && (
              <button
                onClick={onStartSim}
                className="pixiu-ai-command flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold text-white transition shadow-sm cursor-pointer"
              >
                <span>Launch Runtime</span>
              </button>
            )}
          </div>

          <div className="px-3.5 py-2.5 bg-slate-950 border-t border-slate-900">
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Show a visible object from the AI program. PIXIU Vision Core keeps
              camera access active only while the AI runtime is running.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
