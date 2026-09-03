"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Camera, CameraOff, Sparkles, X, Minimize2, Maximize2, Car, User, Smartphone, Ban, RefreshCw } from "lucide-react"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import "@tensorflow/tfjs"

export interface AiVisionState {
  enabled: boolean
  detectedClass: "car" | "person" | "phone" | "none"
  confidence: number
  allDetections?: { class: string; score: number; bbox: [number, number, number, number] }[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiVisionState
  onAiStateChange: (state: AiVisionState) => void
  isSimRunning?: boolean
  onStartSim?: () => void
}

export function AiCameraPanel({ isOpen, onClose, aiState, onAiStateChange, isSimRunning = false, onStartSim }: Props) {
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const manualOverrideRef = useRef<boolean>(false)

  // 1. Load COCO-SSD Neural Network Model
  useEffect(() => {
    if (!isOpen) return
    if (modelRef.current) return

    let isMounted = true
    setModelLoading(true)

    cocoSsd
      .load({ base: "lite_mobilenet_v2" })
      .then((m) => {
        if (!isMounted) return
        modelRef.current = m
        setModelLoaded(true)
        setModelLoading(false)
      })
      .catch((err) => {
        console.warn("Failed to load COCO-SSD model:", err)
        if (isMounted) setModelLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // 2. Real-time Object Detection Loop on Live Camera Stream
  const detectFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !cameraActive) {
      animFrameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    if (video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectFrame)
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Ensure canvas dimensions match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 240
    }

    try {
      // Run inference using TensorFlow.js MobileNet COCO-SSD
      const predictions = await modelRef.current.detect(video)

      // Clear canvas overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (predictions.length > 0) {
        // Find best prediction with score > 45%
        const valid = predictions.filter((p) => p.score >= 0.45)
        const primary = valid[0]

        // Draw bounding boxes for all detected objects
        valid.forEach((p) => {
          const [x, y, w, h] = p.bbox
          const isVehicle = p.class === "car" || p.class === "truck" || p.class === "bus" || p.class === "motorcycle"
          const isPerson = p.class === "person"
          const isPhone = p.class === "cell phone"

          const strokeColor = isVehicle ? "#22c55e" : isPerson ? "#38bdf8" : isPhone ? "#c084fc" : "#eab308"
          const bgColor = isVehicle ? "rgba(34, 197, 94, 0.15)" : isPerson ? "rgba(56, 189, 248, 0.15)" : "rgba(234, 179, 8, 0.15)"

          // Box
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 3
          ctx.strokeRect(x, y, w, h)
          ctx.fillStyle = bgColor
          ctx.fillRect(x, y, w, h)

          // Label badge
          const label = `${p.class.toUpperCase()} ${Math.round(p.score * 100)}%`
          ctx.font = "bold 12px monospace"
          const textWidth = ctx.measureText(label).width
          ctx.fillStyle = strokeColor
          ctx.fillRect(x, Math.max(0, y - 20), textWidth + 10, 20)
          ctx.fillStyle = "#020617"
          ctx.fillText(label, x + 5, Math.max(14, y - 5))
        })

        // If not manually overridden, update live AI state
        if (!manualOverrideRef.current && primary) {
          let mappedClass: "car" | "person" | "phone" | "none" = "none"
          if (primary.class === "car" || primary.class === "truck" || primary.class === "bus") {
            mappedClass = "car"
          } else if (primary.class === "person") {
            mappedClass = "person"
          } else if (primary.class === "cell phone") {
            mappedClass = "phone"
          }

          onAiStateChange({
            enabled: true,
            detectedClass: mappedClass,
            confidence: Math.round(primary.score * 100),
            allDetections: valid as any,
          })
        }
      } else {
        // No objects detected
        if (!manualOverrideRef.current) {
          onAiStateChange({
            enabled: true,
            detectedClass: "none",
            confidence: 0,
            allDetections: [],
          })
        }
      }
    } catch {
      // Ignore frame skip
    }

    // Schedule next frame
    animFrameRef.current = requestAnimationFrame(detectFrame)
  }, [cameraActive, onAiStateChange])

  // 3. Start / Stop Detection Loop
  useEffect(() => {
    if (cameraActive && modelLoaded) {
      animFrameRef.current = requestAnimationFrame(detectFrame)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [cameraActive, modelLoaded, detectFrame])

  // 4. Webcam MediaStream initialization
  useEffect(() => {
    if (!isOpen || !cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      return
    }

    let isMounted = true
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" } })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCameraError(null)
      })
      .catch((err) => {
        console.warn("Webcam access error:", err)
        setCameraError("Webcam permission denied or camera not found.")
        setCameraActive(false)
      })

    return () => {
      isMounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [isOpen, cameraActive])

  if (!isOpen) return null

  const handleManualTarget = (cls: "car" | "person" | "phone" | "none", conf = 94) => {
    manualOverrideRef.current = cls !== "none"
    onAiStateChange({
      ...aiState,
      detectedClass: cls,
      confidence: cls === "none" ? 0 : conf,
    })
  }

  const resetToRealCamera = () => {
    manualOverrideRef.current = false
    onAiStateChange({
      ...aiState,
      detectedClass: "none",
      confidence: 0,
    })
  }

  return (
    <div
      className={`fixed bottom-12 right-3 sm:right-6 z-40 flex flex-col rounded-2xl border border-purple-500/40 bg-slate-950/95 shadow-2xl backdrop-blur-md text-white overflow-hidden transition-all duration-300 max-w-[calc(100vw-24px)] ${
        minimized ? "w-60" : "w-80 sm:w-96"
      }`}
      style={{ boxShadow: "0 10px 35px -5px rgba(168, 85, 247, 0.35)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-950/90 to-slate-900 border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Sparkles size={13} className={modelLoading ? "animate-spin" : ""} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>AI Vision Camera</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40">
                PICTOBLOX AI
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
            onClick={onClose}
            className="p-1 hover:text-white rounded hover:bg-red-500/20 hover:text-red-300 transition"
            title="Close AI Camera"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Video Feed & Real-time Canvas Stage */}
          <div className="relative aspect-video w-full bg-slate-900 overflow-hidden flex items-center justify-center">
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
                <div className="text-xs font-semibold text-slate-300">Webcam Not Started</div>
                <p className="text-[11px] text-slate-500 max-w-[220px]">
                  {modelLoading
                    ? "Loading AI Vision Model..."
                    : "Turn on your webcam to detect objects and open the barrier gate!"}
                </p>
                <button
                  onClick={() => setCameraActive(true)}
                  disabled={modelLoading}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition shadow-md shadow-purple-500/20"
                >
                  <Camera size={13} />
                  <span>Start Live Webcam AI</span>
                </button>
              </div>
            )}

            {/* Camera Switch button (when active) */}
            {cameraActive && (
              <button
                onClick={() => setCameraActive(false)}
                className="absolute top-2 right-2 rounded-md bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-slate-300 p-1 text-xs transition"
                title="Turn off webcam"
              >
                <CameraOff size={13} />
              </button>
            )}

            {/* Model status indicator */}
            <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${modelLoaded ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              <span>{modelLoading ? "Loading..." : modelLoaded ? "AI Active" : "Initializing"}</span>
            </div>
          </div>

          {/* Camera Error Notice */}
          {cameraError && (
            <div className="bg-amber-950/40 border-y border-amber-500/30 px-3 py-1.5 text-[10px] text-amber-300">
              {cameraError}
            </div>
          )}

          {/* Live AI Status Pill */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Live Detection:</span>
              <span
                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  aiState.detectedClass === "car"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : aiState.detectedClass === "person"
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                    : aiState.detectedClass === "phone"
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {aiState.detectedClass !== "none"
                  ? `${aiState.detectedClass === "car" ? "🚗 CAR" : aiState.detectedClass === "person" ? "👤 PERSON" : "📱 PHONE"}`
                  : "LOOKING AT VIDEO..."}
              </span>
            </div>
            {aiState.detectedClass !== "none" && (
              <span className="font-mono text-xs font-bold text-purple-300">
                {aiState.confidence}%
              </span>
            )}
          </div>

          {/* Circuit Simulation Status / Quick Run Trigger */}
          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isSimRunning ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-[11px] text-slate-300">
                {isSimRunning ? "Circuit Running · Live" : "Circuit Simulation Stopped"}
              </span>
            </div>
            {!isSimRunning && onStartSim && (
              <button
                onClick={onStartSim}
                className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-sm cursor-pointer"
              >
                <span>▶️ Start Simulation</span>
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="px-3.5 py-2.5 bg-slate-950 border-t border-slate-900">
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Show a <strong className="text-emerald-400">Car / Vehicle</strong> (toy car or car photo on phone) to open the barrier gate!
            </p>
          </div>
        </>
      )}
    </div>
  )
}
