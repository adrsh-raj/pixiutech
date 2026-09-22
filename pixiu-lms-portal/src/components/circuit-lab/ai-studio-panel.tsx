"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  Brain,
  Camera,
  CameraOff,
  ChevronRight,
  Ear,
  FlaskConical,
  Hand,
  Layers3,
  Mic,
  MicOff,
  Play,
  ScanFace,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react"
import {
  addAiSample,
  clearAiStudioStore,
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
  loadFaceEmotion,
  loadHandDetector,
  loadPoseDetector,
  loadSpeechRecognizer,
  stopSpeechRecognizer,
} from "@/lib/ai-ready-runtime"
import type { LayersModel } from "@tensorflow/tfjs"

export type ReadyAiMode = "objects" | "pose" | "hands" | "emotion" | "sound" | "numbers"

export interface AiStudioVisionState {
  enabled: boolean
  mode?: ReadyAiMode | "trained"
  detectedClass: string
  confidence: number
  allDetections?: { class: string; score: number; bbox: [number, number, number, number] }[]
  modelClasses?: string[]
  modelSource?: "ready" | "trained"
  detail?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  aiState: AiStudioVisionState
  onAiStateChange: (state: AiStudioVisionState) => void
  isSimRunning?: boolean
  onStartSim?: () => void
}

type StudioTab = "try" | "teach" | "understand"
type TryMode = "ready" | "trained"

const READY_MODES: Array<{
  id: ReadyAiMode
  title: string
  subtitle: string
  icon: typeof Sparkles
}> = [
  { id: "objects", title: "Objects", subtitle: "See objects", icon: Sparkles },
  { id: "pose", title: "Pose", subtitle: "Track body", icon: Layers3 },
  { id: "hands", title: "Fingers", subtitle: "Find a hand", icon: Hand },
  { id: "emotion", title: "Emotion", subtitle: "Read expression", icon: ScanFace },
  { id: "sound", title: "Sound", subtitle: "Hear commands", icon: Ear },
  { id: "numbers", title: "Numbers", subtitle: "0–5 fingers", icon: Zap },
]

function modeLabel(mode: ReadyAiMode) {
  return READY_MODES.find((item) => item.id === mode)?.title ?? "AI"
}

function fingerCount(landmarks: number[][]) {
  const wrist = landmarks[0]
  if (!wrist) return 0

  const tipIds = [4, 8, 12, 16, 20]
  const foldIds = [2, 6, 10, 14, 18]
  const distance = (a: number[], b: number[]) =>
    Math.hypot((a?.[0] ?? 0) - (b?.[0] ?? 0), (a?.[1] ?? 0) - (b?.[1] ?? 0))

  return tipIds.reduce((count, tipId, index) => {
    const tip = landmarks[tipId]
    const fold = landmarks[foldIds[index]]
    return tip && fold && distance(tip, wrist) > distance(fold, wrist) * 1.12 ? count + 1 : count
  }, 0)
}

export function AiStudioPanel({
  isOpen,
  onClose,
  aiState,
  onAiStateChange,
  isSimRunning = false,
  onStartSim,
}: Props) {
  const [tab, setTab] = useState<StudioTab>("try")
  const [tryMode, setTryMode] = useState<TryMode>("ready")
  const [readyMode, setReadyMode] = useState<ReadyAiMode>("objects")
  const [inputActive, setInputActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [store, setStore] = useState<AiStudioStore>(() => ({ samples: [], model: null }))
  const [model, setModel] = useState<LayersModel | null>(null)
  const [training, setTraining] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState({
    epoch: 0,
    total: 0,
    accuracy: 0,
    loss: 0,
  })
  const [label, setLabel] = useState("")
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof predictAiImage>>>(null)
  const [testImage, setTestImage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const resourceRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const inFlightRef = useRef(false)
  const lastInferenceRef = useRef(0)

  const counts = useMemo(() => getSampleCounts(store.samples), [store.samples])
  const classes = useMemo(() => getAiClasses(store.samples), [store.samples])
  const canTrain =
    classes.length >= 2 &&
    classes.every((name) => (counts[name] ?? 0) >= 2)

  useEffect(() => {
    if (!isOpen) return
    setStore(loadAiStudioStore())
    setStatus(null)
    setCameraError(null)
    setTestResult(null)
    setTestImage(null)
    setTraining(false)
    setInputActive(false)
    setTab("try")
    setTryMode("ready")
    setReadyMode("objects")
  }, [isOpen])

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

  useEffect(() => {
    if (!isOpen || !inputActive || tab === "understand") {
      return
    }

    const session = ++sessionRef.current
    let cancelled = false

    const startInput = async () => {
      setLoading(true)
      setCameraError(null)
      setStatus(null)

      try {
        if (tryMode === "ready" && readyMode === "sound") {
          const recognizer = await loadSpeechRecognizer()

          if (cancelled || session !== sessionRef.current) {
            stopSpeechRecognizer(recognizer)
            return
          }

          resourceRef.current = recognizer
          setLoading(false)

          recognizer.listen(
            (result: { scores: Float32Array | number[] }) => {
              if (cancelled || session !== sessionRef.current) return

              const scores = Array.from(result.scores ?? [])
              const labels = recognizer.wordLabels()
              let bestIndex = 0

              for (let index = 1; index < scores.length; index += 1) {
                if ((scores[index] ?? 0) > (scores[bestIndex] ?? 0)) {
                  bestIndex = index
                }
              }

              const confidence = Math.round((scores[bestIndex] ?? 0) * 100)
              const word = labels[bestIndex] ?? "unknown"

              onAiStateChange({
                enabled: true,
                mode: "sound",
                detectedClass: word,
                confidence,
                allDetections: [],
                modelClasses: labels,
                modelSource: "ready",
                detail: confidence >= 70 ? `Heard “${word}”` : "Listening…",
              })
            },
            {
              probabilityThreshold: 0.65,
              invokeCallbackOnNoiseAndUnknown: true,
              includeSpectrogram: false,
            },
          )

          return
        }

        const stream = await navigator.mediaDevices?.getUserMedia({
          video: {
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 12, max: 15 },
            facingMode: "user",
          },
        })

        if (!stream) {
          throw new Error("This browser does not provide camera access.")
        }

        if (cancelled || session !== sessionRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }

        setLoading(false)
      } catch (error) {
        if (cancelled || session !== sessionRef.current) return
        setLoading(false)
        setCameraError(
          error instanceof Error
            ? error.message
            : "Camera or microphone could not be started.",
        )
        setInputActive(false)
      }
    }

    void startInput()

    return () => {
      cancelled = true
    }
  }, [isOpen, inputActive, tab, readyMode, tryMode, onAiStateChange])

  useEffect(() => {
    if (!isOpen || !inputActive || tab !== "try" || readyMode === "sound") {
      stopInferenceLoop()
      return
    }

    const session = ++sessionRef.current
    let cancelled = false

    const startInference = async () => {
      setLoading(true)

      try {
        let resource: any = null

        if (tryMode === "trained") {
          resource = null
        } else if (readyMode === "objects") {
          const coco = await import("@tensorflow-models/coco-ssd")
          resource = await coco.load({ base: "lite_mobilenet_v2" })
        } else if (readyMode === "pose") {
          resource = await loadPoseDetector()
        } else if (readyMode === "emotion") {
          resource = await loadFaceEmotion()
        } else {
          resource = await loadHandDetector()
        }

        if (cancelled || session !== sessionRef.current) {
          disposeAiResource(resource)
          return
        }

        resourceRef.current = resource
        setLoading(false)
        startInferenceLoop(session)
      } catch (error) {
        if (cancelled || session !== sessionRef.current) return
        setLoading(false)
        setStatus(
          error instanceof Error
            ? error.message
            : `Could not start ${tryMode === "trained" ? "your AI" : modeLabel(readyMode)}.`,
        )
        setInputActive(false)
      }
    }

    void startInference()

    return () => {
      cancelled = true
      stopInferenceLoop()

      const resource = resourceRef.current
      resourceRef.current = null
      disposeAiResource(resource)
    }
  }, [isOpen, inputActive, tab, readyMode, tryMode, model, store.model])

  useEffect(() => {
    if (!isOpen) {
      cleanupAll()
    }
  }, [isOpen])

  const stopInput = () => {
    setInputActive(false)
    cleanupAll()
    onAiStateChange({
      enabled: false,
      mode: tryMode === "trained" ? "trained" : readyMode,
      detectedClass: "none",
      confidence: 0,
      allDetections: [],
      modelClasses:
        tryMode === "trained" ? (store.model?.classes ?? []) : [],
      modelSource: tryMode === "trained" ? "trained" : "ready",
      detail: "Stopped",
    })
  }

  const startInput = () => {
    setCameraError(null)
    setStatus(null)
    setInputActive(true)
  }

  const selectTab = (nextTab: StudioTab) => {
    stopInput()
    setTab(nextTab)
  }

  const selectTryMode = (nextMode: TryMode) => {
    stopInput()
    setTryMode(nextMode)
    setTestResult(null)
    setTestImage(null)
    if (nextMode === "trained") setReadyMode("objects")
  }

  const selectReadyMode = (nextMode: ReadyAiMode) => {
    stopInput()
    setTryMode("ready")
    setReadyMode(nextMode)
    setStatus(null)
    setTestResult(null)
    setTestImage(null)
  }

  const addCapturedSample = () => {
    const cleanLabel = label.trim()

    if (!cleanLabel) {
      setStatus("Give this concept a name first.")
      return
    }

    const frame = captureVideoFrame()

    if (!frame) {
      setStatus("Start the camera first.")
      return
    }

    const next = addAiSample(store, cleanLabel, frame)
    setStore(next)
    saveAiStudioStore(next)
    setLabel("")
    setStatus(`Added one example to “${cleanLabel}”.`)
  }

  const importSample = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return

    const cleanLabel = label.trim()

    if (!cleanLabel) {
      setStatus("Give this concept a name first.")
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""

      if (!dataUrl) {
        setStatus("That image could not be read.")
        return
      }

      const next = addAiSample(store, cleanLabel, dataUrl)
      setStore(next)
      saveAiStudioStore(next)
      setLabel("")
      setStatus(`Added one image to “${cleanLabel}”.`)
    }

    reader.readAsDataURL(file)
  }

  const removeSampleAndPersist = (id: string) => {
    const next = removeAiSample(store, id)
    setStore(next)
    saveAiStudioStore(next)
  }

  const train = async () => {
    if (!canTrain || training) return

    setTraining(true)
    setStatus(null)
    setTrainingProgress({ epoch: 0, total: 18, accuracy: 0, loss: 0 })

    try {
      const result = await trainAiModel(store.samples, {
        epochs: 18,
        onEpoch: (epoch, total, accuracy, loss) =>
          setTrainingProgress({ epoch, total, accuracy, loss }),
      })

      const nextStore = { ...store, model: result.summary }
      setStore(nextStore)
      saveAiStudioStore(nextStore)
      setModel(result.model)
      setTryMode("trained")
      setTab("try")
      setStatus(
        `Learned ${result.summary.classes.length} concepts from ${result.summary.sampleCount} examples.`,
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Training failed. Add a few more examples and try again.",
      )
    } finally {
      setTraining(false)
    }
  }

  const runFilePrediction = async (dataUrl: string) => {
    if (!store.model) {
      setStatus("Teach your AI first.")
      return
    }

    setTestImage(dataUrl)
    setLoading(true)

    try {
      const result = await predictAiImage(dataUrl, store.model)
      setTestResult(result)

      if (result) {
        onAiStateChange({
          enabled: true,
          mode: "trained",
          detectedClass: result.label,
          confidence: result.confidence,
          allDetections: [],
          modelClasses: store.model.classes,
          modelSource: "trained",
          detail: Object.entries(result.probabilities)
            .map(([name, value]) => `${name} ${value}%`)
            .join(" · "),
        })
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Prediction failed.")
    } finally {
      setLoading(false)
    }
  }

  const resetStudio = () => {
    stopInput()
    clearAiStudioStore()
    setStore({ samples: [], model: null })
    setModel(null)
    setTryMode("ready")
    setReadyMode("objects")
    setTab("try")
    setLabel("")
    setTestResult(null)
    setTestImage(null)
    setStatus("AI Studio reset.")
  }

  if (!isOpen) return null

  const isSound = tryMode === "ready" && readyMode === "sound"
  const isCameraMode = !isSound
  const showLiveInput = inputActive && (tab === "try" || tab === "teach")

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(92vh,900px)] w-full max-w-6xl overflow-hidden rounded-3xl border border-violet-400/20 bg-[#07111f] text-white shadow-2xl shadow-black/60">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/55 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">
                  PIXIU AI STUDIO
                </p>
                <h2 className="truncate text-sm font-black sm:text-base">
                  Teach a machine. Make it act.
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
              aria-label="Close AI Studio"
            >
              <X size={17} />
            </button>
          </header>

          <nav className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-950/25 p-2">
            {([
              ["try", "Try", Sparkles],
              ["teach", "Teach", Brain],
              ["understand", "Understand", Layers3],
            ] as const).map(([value, title, Icon]) => (
              <button
                key={value}
                onClick={() => selectTab(value)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black transition ${
                  tab === value
                    ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20"
                    : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Icon size={13} />
                {title}
              </button>
            ))}

            <div className="ml-auto hidden items-center gap-2 px-2 text-[9px] text-slate-500 sm:flex">
              <span className={isSimRunning ? "text-emerald-300" : "text-slate-600"}>
                Circuit {isSimRunning ? "live" : "idle"}
              </span>
              <span>·</span>
              <span>{store.samples.length} examples</span>
            </div>
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {tab === "try" && (
              <div className="mx-auto max-w-5xl space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">Try AI</h3>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                      Pick one tool. Only that AI loads, and it stops when you stop.
                    </p>
                  </div>

                  <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
                    <button
                      onClick={() => selectTryMode("ready")}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
                        tryMode === "ready"
                          ? "bg-slate-800 text-white"
                          : "text-slate-500"
                      }`}
                    >
                      Ready AI
                    </button>
                    <button
                      disabled={!store.model}
                      onClick={() => selectTryMode("trained")}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
                        tryMode === "trained"
                          ? "bg-violet-600 text-white"
                          : "text-slate-500"
                      } disabled:opacity-30`}
                    >
                      My AI
                    </button>
                  </div>
                </div>

                {tryMode === "ready" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {READY_MODES.map(({ id, title, subtitle, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => selectReadyMode(id)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          readyMode === id
                            ? "border-violet-400/35 bg-violet-500/[0.08]"
                            : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                        }`}
                      >
                        <Icon size={16} className="text-violet-300" />
                        <p className="mt-2 text-[11px] font-black">{title}</p>
                        <p className="mt-0.5 text-[9px] leading-4 text-slate-600">
                          {subtitle}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr]">
                  <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
                    <div className="relative aspect-video">
                      {showLiveInput && isCameraMode ? (
                        <>
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
                        </>
                      ) : (
                        <div className="absolute inset-0 grid place-items-center p-6 text-center">
                          <div>
                            {isSound ? (
                              <Mic size={30} className="mx-auto text-violet-300" />
                            ) : (
                              <Camera size={30} className="mx-auto text-violet-300" />
                            )}
                            <p className="mt-3 text-sm font-bold">
                              {loading
                                ? "Loading AI…"
                                : isSound
                                  ? "Microphone off"
                                  : "Camera off"}
                            </p>
                            <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">
                              {isSound
                                ? "Start the microphone when you are ready."
                                : "Start the camera when you are ready."}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[9px] font-mono">
                        <span className={loading ? "text-amber-300" : inputActive ? "text-emerald-300" : "text-slate-400"}>
                          {loading
                            ? "loading"
                            : inputActive
                              ? tryMode === "trained"
                                ? "my AI live"
                                : `${modeLabel(readyMode)} live`
                              : "ready"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">
                          {tryMode === "trained" ? "My AI" : modeLabel(readyMode)}
                        </p>
                        <p className="truncate text-sm font-black text-slate-100">
                          {aiState.detectedClass === "none" ? "Ready" : aiState.detectedClass}
                        </p>
                        {aiState.detail && (
                          <p className="truncate text-[9px] text-slate-600">
                            {aiState.detail}
                          </p>
                        )}
                      </div>
                      <span className="font-mono text-sm font-black text-violet-300">
                        {aiState.confidence ? `${aiState.confidence}%` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <p className="text-xs font-black">
                        {tryMode === "trained"
                          ? "My trained model"
                          : `What ${modeLabel(readyMode)} does`}
                      </p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-500">
                        {tryMode === "trained"
                          ? "Runs your learned concepts against the live camera."
                          : readyMode === "objects"
                            ? "Find common objects and draw a confidence box."
                            : readyMode === "pose"
                              ? "Tracks the body and highlights keypoints."
                              : readyMode === "hands"
                                ? "Finds a hand and estimates its landmarks."
                                : readyMode === "emotion"
                                  ? "Estimates facial expression for a classroom demo."
                                  : readyMode === "sound"
                                    ? "Listens for simple spoken words and digits."
                                    : "Counts 0–5 extended fingers."}
                      </p>

                      <button
                        onClick={inputActive ? stopInput : startInput}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black text-white hover:bg-violet-400"
                      >
                        {inputActive
                          ? isSound
                            ? <MicOff size={13} />
                            : <CameraOff size={13} />
                          : isSound
                            ? <Mic size={13} />
                            : <Camera size={13} />}
                        {inputActive
                          ? "Stop"
                          : isSound
                            ? "Start microphone"
                            : "Start camera"}
                      </button>
                    </div>

                    <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-violet-300" />
                        <span className="text-xs font-black">AI → Circuit</span>
                        <span className={`ml-auto text-[9px] font-mono ${
                          isSimRunning ? "text-emerald-300" : "text-slate-600"
                        }`}>
                          {isSimRunning ? "LIVE" : "READY"}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-slate-500">
                        The latest AI result is available to the Lab and can drive AI Blockly logic.
                      </p>
                      <div className="mt-3 rounded-xl border border-violet-400/10 bg-black/10 p-2.5 text-[9px] font-mono text-slate-500">
                        AI sees · AI confidence · detected object
                      </div>
                      {onStartSim && !isSimRunning && (
                        <button
                          onClick={onStartSim}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black text-slate-950"
                        >
                          <Play size={12} fill="currentColor" />
                          Run circuit
                        </button>
                      )}
                    </div>

                    {tryMode === "trained" && store.model && (
                      <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-4 hover:border-violet-400/30">
                        <div className="flex items-center gap-2">
                          <Upload size={14} className="text-violet-300" />
                          <span className="text-xs font-black">Test an image</span>
                        </div>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500">
                          Try your model without changing the dataset.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ""
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = () => {
                              const dataUrl =
                                typeof reader.result === "string" ? reader.result : ""
                              if (dataUrl) void runFilePrediction(dataUrl)
                            }
                            reader.readAsDataURL(file)
                          }}
                        />
                      </label>
                    )}

                    {testResult && (
                      <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-3">
                        <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300">
                          Model result
                        </p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <span className="text-sm font-black">{testResult.label}</span>
                          <span className="font-mono text-xs font-bold text-violet-300">
                            {testResult.confidence}%
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {Object.entries(testResult.probabilities).map(
                            ([name, probability]) => (
                              <div key={name}>
                                <div className="flex justify-between text-[9px] text-slate-500">
                                  <span>{name}</span>
                                  <span>{probability}%</span>
                                </div>
                                <div className="mt-1 h-1 rounded-full bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-violet-400"
                                    style={{ width: `${probability}%` }}
                                  />
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "teach" && (
              <div className="mx-auto max-w-5xl space-y-4">
                <div>
                  <h3 className="text-lg font-black">Teach your AI</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    Make two concepts, give each a few varied examples, then train.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black">
                        <Camera size={14} className="text-violet-300" />
                        Capture examples
                      </div>
                      <span className="text-[9px] font-mono text-slate-600">
                        {inputActive ? "camera live" : "camera off"}
                      </span>
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-black">
                      <div className="relative aspect-video">
                        {inputActive ? (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center p-6 text-center">
                            <div>
                              <Camera size={28} className="mx-auto text-violet-300" />
                              <p className="mt-3 text-sm font-bold">Camera ready</p>
                              <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">
                                Start it here. You will stay on the Teach page.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Concept name: Bottle"
                      className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs outline-none focus:border-violet-400/40"
                    />

                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={inputActive ? stopInput : startInput}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-900"
                      >
                        {inputActive ? <CameraOff size={12} /> : <Camera size={12} />}
                        {inputActive ? "Stop camera" : "Start camera"}
                      </button>

                      <button
                        onClick={addCapturedSample}
                        disabled={!inputActive || !label.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Sparkles size={12} />
                        Add example
                      </button>

                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-slate-900">
                        <Upload size={12} />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={importSample}
                        />
                      </label>
                    </div>

                    {cameraError && (
                      <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3 text-[10px] leading-5 text-amber-200">
                        {cameraError}
                      </div>
                    )}

                    {status && (
                      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[10px] leading-5 text-violet-200">
                        {status}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black">
                        <FlaskConical size={14} className="text-violet-300" />
                        My dataset
                      </div>
                      <span className="text-[9px] font-mono text-slate-600">
                        {store.samples.length} examples
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {classes.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-800 p-4 text-[10px] leading-5 text-slate-600">
                          Start with two concepts, such as Bottle and Paper.
                        </div>
                      )}

                      {classes.map((name) => (
                        <div
                          key={name}
                          className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{name}</span>
                            <span className="font-mono text-[9px] text-violet-300">
                              {counts[name] ?? 0}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-5 gap-1">
                            {store.samples
                              .filter((sample) => sample.label === name)
                              .slice(-5)
                              .map((sample) => (
                                <div
                                  key={sample.id}
                                  className="group relative aspect-square overflow-hidden rounded-lg bg-black"
                                >
                                  <img
                                    src={sample.dataUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    onClick={() => removeSampleAndPersist(sample.id)}
                                    className="absolute right-1 top-1 hidden rounded-md bg-black/70 p-1 text-red-300 group-hover:block"
                                    title="Remove example"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-500/[0.04] p-3">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span>{canTrain ? "Ready to learn" : "Add more examples"}</span>
                        <span>{classes.length} concepts</span>
                      </div>

                      <p className="mt-1 text-[9px] leading-4 text-slate-500">
                        Aim for 4–8 varied examples per concept.
                      </p>

                      {store.model && !training && (
                        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                          <div className="rounded-lg bg-slate-900 px-2 py-1.5">
                            <p className="text-[8px] text-slate-600">Train</p>
                            <p className="font-mono text-[10px] text-slate-300">
                              {store.model.trainAccuracy}%
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-900 px-2 py-1.5">
                            <p className="text-[8px] text-slate-600">Validate</p>
                            <p className="font-mono text-[10px] text-slate-300">
                              {store.model.validationAccuracy}%
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-900 px-2 py-1.5">
                            <p className="text-[8px] text-slate-600">Epochs</p>
                            <p className="font-mono text-[10px] text-slate-300">
                              {store.model.epochs}
                            </p>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => void train()}
                        disabled={!canTrain || training}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Brain size={13} />
                        {training
                          ? `Learning… ${trainingProgress.epoch}/${trainingProgress.total}`
                          : store.model
                            ? "Retrain my AI"
                            : "Train my AI"}
                      </button>

                      {training && (
                        <div className="mt-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-violet-400 transition-all"
                              style={{
                                width: `${Math.round(
                                  (trainingProgress.epoch /
                                    Math.max(1, trainingProgress.total)) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="mt-1 flex justify-between text-[8px] font-mono text-slate-600">
                            <span>loss {trainingProgress.loss.toFixed(2)}</span>
                            <span>{Math.round(trainingProgress.accuracy * 100)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "understand" && (
              <div className="mx-auto max-w-5xl space-y-4">
                <div>
                  <h3 className="text-lg font-black">Open the black box</h3>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    Curious students can go deeper without making the main screen harder for everyone else.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  {[
                    ["1", "Pixels", "An image becomes numbers."],
                    ["2", "Weights", "The network learns useful values."],
                    ["3", "Activation", "Patterns are filtered and combined."],
                    ["4", "Softmax", "Scores become probabilities."],
                    ["5", "Update", "Loss nudges the weights."],
                  ].map(([step, title, description]) => (
                    <div
                      key={step}
                      className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3"
                    >
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/10 text-[10px] font-black text-violet-300">
                        {step}
                      </div>
                      <p className="mt-2 text-xs font-black">{title}</p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-600">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-violet-300">
                      The path
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      {["pixels", "matrix × weights", "ReLU", "softmax", "prediction"].map(
                        (item, index) => (
                          <span key={item} className="flex items-center gap-2">
                            <span className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5">
                              {item}
                            </span>
                            {index < 4 && (
                              <ChevronRight size={11} className="text-slate-700" />
                            )}
                          </span>
                        ),
                      )}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-3 font-mono text-[10px] leading-6 text-slate-400">
                      y = W·x + b
                      <br />
                      ReLU(z) = max(0, z)
                      <br />
                      softmax(zᵢ) = eᶻⁱ / Σeᶻ
                      <br />
                      learn by reducing loss over examples
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex items-center gap-2 text-xs font-black">
                      <Layers3 size={14} className="text-violet-300" />
                      Your network
                    </div>

                    {store.model ? (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {store.model.classes.map((name) => (
                            <div
                              key={name}
                              className="rounded-xl bg-slate-900 p-2 text-center text-[9px] font-bold"
                            >
                              {name}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 space-y-1.5">
                          {getModelWeightShapes(model).map((shape) => (
                            <div
                              key={shape}
                              className="rounded-lg border border-slate-800 px-2.5 py-2 font-mono text-[9px] text-slate-500"
                            >
                              {shape}
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-500/[0.04] p-3">
                          <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300">
                            First learned numbers
                          </p>
                          {getModelWeightPreview(model)
                            .slice(0, 2)
                            .map((row, index) => (
                              <p
                                key={index}
                                className="mt-1 break-all font-mono text-[8px] leading-4 text-slate-500"
                              >
                                [{row.join(", ")}]
                              </p>
                            ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-800 p-5 text-[10px] leading-5 text-slate-600">
                        Train a model in Teach to see real layer shapes and learned weights.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.03] p-4">
                  <p className="text-xs font-black text-amber-200">Break your AI</p>
                  <p className="mt-1 max-w-3xl text-[10px] leading-5 text-slate-500">
                    Change angle, lighting, distance or background. A confident wrong answer is useful:
                    it shows you what the dataset never taught the model.
                  </p>
                </div>
              </div>
            )}
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/35 px-4 py-2.5 text-[9px] text-slate-600 sm:px-6">
            <span>AI models load only when you start an activity.</span>
            <button onClick={resetStudio} className="text-slate-500 hover:text-slate-200">
              Reset AI Studio
            </button>
          </footer>
        </div>
      </div>
    </div>
  )

  function startInferenceLoop(session: number) {
    stopInferenceLoop()

    const tick = async () => {
      if (
        !isOpen ||
        !inputActive ||
        tab !== "try" ||
        session !== sessionRef.current
      ) {
        return
      }

      const now = performance.now()

      if (inFlightRef.current || now - lastInferenceRef.current < 250) {
        animationRef.current = window.setTimeout(tick, 140)
        return
      }

      const video = videoRef.current
      const detector = resourceRef.current

      if (
        tryMode !== "trained" &&
        (!video || video.readyState < 2 || !detector)
      ) {
        animationRef.current = window.setTimeout(tick, 140)
        return
      }

      inFlightRef.current = true
      lastInferenceRef.current = now

      try {
        if (tryMode === "trained" && model && store.model) {
          const frame = captureVideoFrame()
          if (frame) {
            const prediction = await predictAiImage(frame, store.model)

            onAiStateChange({
              enabled: true,
              mode: "trained",
              detectedClass: prediction?.label ?? "none",
              confidence: prediction?.confidence ?? 0,
              allDetections: [],
              modelClasses: store.model.classes,
              modelSource: "trained",
              detail: prediction
                ? Object.entries(prediction.probabilities)
                    .map(([name, value]) => `${name} ${value}%`)
                    .join(" · ")
                : "Looking…",
            })
          }
        } else if (readyMode === "objects") {
          const predictions = await detector.detect(video)
          const valid = predictions.filter((item: any) => item.score >= 0.45)
          drawObjectDetections(valid)

          const best = valid[0]

          onAiStateChange({
            enabled: true,
            mode: "objects",
            detectedClass: best?.class ?? "none",
            confidence: Math.round((best?.score ?? 0) * 100),
            allDetections: valid,
            modelClasses: [],
            modelSource: "ready",
            detail: best
              ? `${valid.length} object${valid.length === 1 ? "" : "s"}`
              : "Looking…",
          })
        } else if (readyMode === "pose") {
          const poses = await detector.estimatePoses(video, {
            flipHorizontal: true,
          })

          const pose = poses[0]
          drawPose(pose)

          const keypoints = pose?.keypoints ?? []
          const confident = keypoints.filter(
            (point: any) => (point.score ?? 0) >= 0.45,
          )

          const leftWrist = keypoints.find((point: any) =>
            /left.*wrist/i.test(point.name ?? ""),
          )
          const rightWrist = keypoints.find((point: any) =>
            /right.*wrist/i.test(point.name ?? ""),
          )
          const leftShoulder = keypoints.find((point: any) =>
            /left.*shoulder/i.test(point.name ?? ""),
          )
          const rightShoulder = keypoints.find((point: any) =>
            /right.*shoulder/i.test(point.name ?? ""),
          )

          const handsUp = Boolean(
            (leftWrist &&
              leftShoulder &&
              leftWrist.y < leftShoulder.y) ||
              (rightWrist &&
                rightShoulder &&
                rightWrist.y < rightShoulder.y),
          )

          onAiStateChange({
            enabled: true,
            mode: "pose",
            detectedClass: pose ? (handsUp ? "hands-up" : "person") : "none",
            confidence: Math.round(
              (pose?.score ?? confident[0]?.score ?? 0) * 100,
            ),
            allDetections: [],
            modelClasses: ["person", "hands-up"],
            modelSource: "ready",
            detail: pose
              ? `${confident.length} keypoints${handsUp ? " · hands up" : ""}`
              : "Show a person",
          })
        } else if (readyMode === "emotion") {
          const faceapi = detector
          const detections = await faceapi
            .detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({
                inputSize: 160,
                scoreThreshold: 0.5,
              }),
            )
            .withFaceExpressions()

          const first = detections[0]

          if (first) {
            const expressions = first.expressions as Record<string, number>
            const top = Object.entries(expressions).sort(
              (a, b) => b[1] - a[1],
            )[0]
            const box = first.detection.box

            drawEmotion(expressions, box)

            onAiStateChange({
              enabled: true,
              mode: "emotion",
              detectedClass: top?.[0] ?? "neutral",
              confidence: Math.round((top?.[1] ?? 0) * 100),
              allDetections: [],
              modelClasses: Object.keys(expressions),
              modelSource: "ready",
              detail: "Expression estimate · classroom demo",
            })
          } else {
            clearOverlay()

            onAiStateChange({
              enabled: true,
              mode: "emotion",
              detectedClass: "none",
              confidence: 0,
              allDetections: [],
              modelClasses: [],
              modelSource: "ready",
              detail: "Show your face",
            })
          }
        } else {
          const hands = await detector.estimateHands(video, {
            flipHorizontal: true,
          })

          const hand = hands[0]
          const landmarks = hand?.landmarks ?? []
          const fingers = hand ? fingerCount(landmarks) : 0
          const mode = readyMode === "numbers" ? "numbers" : "hands"

          drawHands(hand)

          onAiStateChange({
            enabled: true,
            mode,
            detectedClass: hand
              ? mode === "numbers"
                ? String(fingers)
                : "hand"
              : "none",
            confidence: Math.round(
              (hand?.handInViewConfidence ?? 0) * 100,
            ),
            allDetections: [],
            modelClasses:
              mode === "numbers"
                ? ["0", "1", "2", "3", "4", "5"]
                : ["hand"],
            modelSource: "ready",
            detail: hand
              ? `${fingers} finger${fingers === 1 ? "" : "s"} extended`
              : "Show one hand",
          })
        }
      } catch {
        // A slow/failed frame must never crash the lab.
      } finally {
        inFlightRef.current = false

        if (
          isOpen &&
          inputActive &&
          tab === "try" &&
          session === sessionRef.current
        ) {
          animationRef.current = window.setTimeout(tick, 40)
        }
      }
    }

    animationRef.current = window.setTimeout(tick, 0)
  }

  function stopInferenceLoop() {
    if (animationRef.current !== null) {
      window.clearTimeout(animationRef.current)
      animationRef.current = null
    }

    inFlightRef.current = false
    lastInferenceRef.current = 0

    if (overlayRef.current) {
      overlayRef.current
        .getContext("2d")
        ?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
    }
  }

  function stopCameraTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function cleanupAll() {
    sessionRef.current += 1
    stopInferenceLoop()
    stopCameraTracks()
    stopSpeechRecognizer(resourceRef.current)
    disposeAiResource(resourceRef.current)
    resourceRef.current = null
  }

  function captureVideoFrame() {
    const video = videoRef.current

    if (!video || video.readyState < 2) return null

    const canvas = sampleCanvasRef.current ?? document.createElement("canvas")
    sampleCanvasRef.current = canvas

    canvas.width = Math.min(video.videoWidth || 480, 480)
    canvas.height = Math.min(video.videoHeight || 360, 360)

    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.72)
  }

  function prepareOverlay() {
    const canvas = overlayRef.current
    const video = videoRef.current

    if (!canvas || !video) return null

    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 360

    const ctx = canvas.getContext("2d")

    if (!ctx) return null

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#a78bfa"
    ctx.fillStyle = "#a78bfa"

    return ctx
  }

  function clearOverlay() {
    const canvas = overlayRef.current
    if (!canvas) return
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  }

  function drawObjectDetections(
    items: Array<{
      class: string
      score: number
      bbox: [number, number, number, number]
    }>,
  ) {
    const ctx = prepareOverlay()
    if (!ctx) return

    items.forEach((item) => {
      const [x, y, width, height] = item.bbox
      ctx.strokeRect(x, y, width, height)

      const labelText = `${item.class} ${Math.round(item.score * 100)}%`
      ctx.font = "bold 12px monospace"

      const labelWidth = ctx.measureText(labelText).width + 12

      ctx.fillStyle = "rgba(167,139,250,0.9)"
      ctx.fillRect(x, Math.max(0, y - 21), labelWidth, 21)
      ctx.fillStyle = "#09090b"
      ctx.fillText(labelText, x + 6, Math.max(15, y - 6))
    })
  }

  function drawPose(pose: any) {
    const ctx = prepareOverlay()
    if (!ctx || !pose) return

    const keypoints = pose.keypoints || []
    const byName = new Map(keypoints.map((point: any) => [point.name, point]))

    const edges = [
      ["left_shoulder", "right_shoulder"],
      ["left_shoulder", "left_elbow"],
      ["left_elbow", "left_wrist"],
      ["right_shoulder", "right_elbow"],
      ["right_elbow", "right_wrist"],
      ["left_shoulder", "left_hip"],
      ["right_shoulder", "right_hip"],
      ["left_hip", "right_hip"],
      ["left_hip", "left_knee"],
      ["left_knee", "left_ankle"],
      ["right_hip", "right_knee"],
      ["right_knee", "right_ankle"],
    ]

    edges.forEach(([a, b]) => {
      const from = byName.get(a) as any
      const to = byName.get(b) as any

      if (!from || !to || (from.score ?? 0) < 0.4 || (to.score ?? 0) < 0.4) {
        return
      }

      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    })

    keypoints.forEach((point: any) => {
      if ((point.score ?? 0) < 0.4) return

      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function drawHands(hand: any) {
    const ctx = prepareOverlay()
    if (!ctx || !hand) return

    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [5, 9],
      [9, 13],
      [13, 17],
    ]

    edges.forEach(([a, b]) => {
      const from = hand.landmarks?.[a]
      const to = hand.landmarks?.[b]

      if (!from || !to) return

      ctx.beginPath()
      ctx.moveTo(from[0], from[1])
      ctx.lineTo(to[0], to[1])
      ctx.stroke()
    })

    hand.landmarks?.forEach((point: number[]) => {
      ctx.beginPath()
      ctx.arc(point[0], point[1], 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  function drawEmotion(
    expressions: Record<string, number>,
    box: { x: number; y: number; width: number; height: number },
  ) {
    const ctx = prepareOverlay()
    if (!ctx) return

    ctx.strokeRect(box.x, box.y, box.width, box.height)

    const top = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0]
    if (!top) return

    const labelText = `${top[0]} ${Math.round(top[1] * 100)}%`
    ctx.font = "bold 12px monospace"

    const labelWidth = ctx.measureText(labelText).width + 12

    ctx.fillStyle = "rgba(167,139,250,0.9)"
    ctx.fillRect(box.x, Math.max(0, box.y - 21), labelWidth, 21)
    ctx.fillStyle = "#09090b"
    ctx.fillText(labelText, box.x + 6, Math.max(15, box.y - 6))
  }
}
