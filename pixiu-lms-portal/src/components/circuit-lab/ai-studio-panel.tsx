"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, CameraOff, Brain, ChevronRight, FlaskConical, Layers3, Play, Sparkles, Trash2, Upload, X, Zap } from "lucide-react"
import * as cocoSsd from "@tensorflow-models/coco-ssd"
import "@tensorflow/tfjs"
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
import type * as tf from "@tensorflow/tfjs"

export interface AiStudioVisionState {
  enabled: boolean
  detectedClass: string
  confidence: number
  allDetections?: { class: string; score: number; bbox: [number, number, number, number] }[]
  modelClasses?: string[]
  modelSource?: "ready" | "trained"
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
  const [store, setStore] = useState<AiStudioStore>(() => ({ samples: [], model: null }))
  const [model, setModel] = useState<tf.LayersModel | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [readyLoading, setReadyLoading] = useState(false)
  const [readyLoaded, setReadyLoaded] = useState(false)
  const [training, setTraining] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState({ epoch: 0, total: 0, accuracy: 0, loss: 0 })
  const [label, setLabel] = useState("")
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof predictAiImage>>>(null)
  const [minimized, setMinimized] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [testImage, setTestImage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const readyModelRef = useRef<cocoSsd.ObjectDetection | null>(null)
  const animationRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)
  const lastDetectRef = useRef(0)

  const counts = useMemo(() => getSampleCounts(store.samples), [store.samples])
  const classes = useMemo(() => getAiClasses(store.samples), [store.samples])
  const canTrain = classes.length >= 2 && classes.every((name) => (counts[name] ?? 0) >= 2)

  useEffect(() => {
    if (!isOpen) return
    const loaded = loadAiStudioStore()
    setStore(loaded)
    setTestResult(null)
    setStatus(null)
    setMinimized(false)
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
    if (!isOpen || !cameraActive) {
      stopCameraTracks()
      return
    }

    let active = true
    navigator.mediaDevices
      ?.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: "user" },
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
        setCameraError(null)
      })
      .catch(() => {
        if (!active) return
        setCameraError("Camera permission is needed for live AI.")
        setCameraActive(false)
      })

    return () => {
      active = false
      stopCameraTracks()
    }
  }, [isOpen, tab, cameraActive])

  useEffect(() => {
    if (!cameraActive || tab !== "try") {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      return
    }

    const detect = async (time: number) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationRef.current = requestAnimationFrame(detect)
        return
      }

      if (time - lastDetectRef.current < 220 || inFlightRef.current) {
        animationRef.current = requestAnimationFrame(detect)
        return
      }

      lastDetectRef.current = time

      if (tryMode === "ready") {
        const detector = readyModelRef.current
        if (detector && overlayRef.current) {
          inFlightRef.current = true
          try {
            const predictions = await detector.detect(videoRef.current)
            const valid = predictions.filter((item) => item.score >= 0.45)
            drawDetections(valid.map((item) => ({ class: item.class, score: item.score, bbox: item.bbox as [number, number, number, number] })))
            const primary = valid[0]
            if (primary) {
              onAiStateChange({
                enabled: true,
                detectedClass: primary.class,
                confidence: Math.round(primary.score * 100),
                allDetections: valid.map((item) => ({ class: item.class, score: item.score, bbox: item.bbox as [number, number, number, number] })),
                modelClasses: [],
                modelSource: "ready",
              })
            } else {
              onAiStateChange({ enabled: true, detectedClass: "none", confidence: 0, allDetections: [], modelClasses: [], modelSource: "ready" })
            }
          } catch {
            // Skip a frame if inference is busy.
          } finally {
            inFlightRef.current = false
          }
        }
      } else if (model && store.model) {
        const frame = captureVideoFrame()
        if (frame) {
          inFlightRef.current = true
          try {
            const prediction = await predictAiImage(frame, store.model)
            if (prediction) {
              setTestResult(prediction)
              onAiStateChange({
                enabled: true,
                detectedClass: prediction.label,
                confidence: prediction.confidence,
                allDetections: [],
                modelClasses: store.model.classes,
                modelSource: "trained",
              })
            }
          } finally {
            inFlightRef.current = false
          }
        }
      }

      animationRef.current = requestAnimationFrame(detect)
    }

    animationRef.current = requestAnimationFrame(detect)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [cameraActive, tab, tryMode, model, store.model, onAiStateChange])

  useEffect(() => {
    if (!isOpen || tab !== "try" || tryMode !== "ready" || readyModelRef.current) return
    let cancelled = false
    setReadyLoading(true)
    void cocoSsd
      .load({ base: "lite_mobilenet_v2" })
      .then((loaded) => {
        if (cancelled) return
        readyModelRef.current = loaded
        setReadyLoaded(true)
        setReadyLoading(false)
      })
      .catch(() => {
        if (!cancelled) setReadyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, tab, tryMode])

  const train = async () => {
    if (!canTrain || training) return
    setTraining(true)
    setStatus(null)
    setTrainingProgress({ epoch: 0, total: 18, accuracy: 0, loss: 0 })
    try {
      const result = await trainAiModel(store.samples, {
        epochs: 18,
        onEpoch: (epoch, total, accuracy, loss) => setTrainingProgress({ epoch, total, accuracy, loss }),
      })
      const nextStore = { ...store, model: result.summary }
      setStore(nextStore)
      saveAiStudioStore(nextStore)
      setModel(result.model)
      setTryMode("trained")
      setTab("try")
      setStatus(`Model learned ${result.summary.classes.length} concepts from ${result.summary.sampleCount} examples.`)
      onAiStateChange({
        enabled: true,
        detectedClass: "none",
        confidence: 0,
        allDetections: [],
        modelClasses: result.summary.classes,
        modelSource: "trained",
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Training failed. Add a few more examples and try again.")
    } finally {
      setTraining(false)
    }
  }

  const addCapturedSample = async () => {
    const activeLabel = label.trim()
    if (!activeLabel) {
      setStatus("Name the concept first, such as Bottle or Paper.")
      return
    }
    const frame = captureVideoFrame()
    if (!frame) {
      setStatus("Start the camera to capture an example.")
      return
    }
    const next = addAiSample(store, activeLabel, frame)
    setStore(next)
    saveAiStudioStore(next)
    setLabel("")
    setStatus(`Added one example to “${activeLabel}”.`)
  }

  const importSample = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""
      if (!dataUrl) return
      const activeLabel = label.trim()
      if (!activeLabel) {
        setStatus("Name the concept first, then choose the image.")
        return
      }
      const next = addAiSample(store, activeLabel, dataUrl)
      setStore(next)
      saveAiStudioStore(next)
      setLabel("")
      setStatus(`Added one image to “${activeLabel}”.`)
    }
    reader.readAsDataURL(file)
  }

  const removeSample = (id: string) => {
    const next = removeAiSample(store, id)
    setStore(next)
    saveAiStudioStore(next)
  }

  const resetStudio = () => {
    clearAiStudioStore()
    setStore({ samples: [], model: null })
    setModel(null)
    setTryMode("ready")
    setTestResult(null)
    setStatus("AI Studio reset. Your saved examples and model were cleared.")
  }

  const runFilePrediction = async (dataUrl: string) => {
    if (!store.model) {
      setStatus("Train a model first.")
      return
    }
    setTestImage(dataUrl)
    const result = await predictAiImage(dataUrl, store.model)
    setTestResult(result)
    if (result) {
      onAiStateChange({
        enabled: true,
        detectedClass: result.label,
        confidence: result.confidence,
        allDetections: [],
        modelClasses: store.model.classes,
        modelSource: "trained",
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5">
      <div className={`flex w-full overflow-hidden rounded-3xl border border-violet-400/20 bg-[#07111f] text-white shadow-2xl shadow-black/60 ${minimized ? "max-w-xl h-auto" : "h-[min(90vh,860px)] max-w-6xl"}`}>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/55 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-violet-300">Pixiu AI Studio</p>
                <h2 className="truncate text-sm font-black sm:text-base">Teach a machine. Make it act.</h2>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized((value) => !value)} className="hidden rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white sm:block" title="Compact view">
                <ChevronRight size={16} className={minimized ? "rotate-180" : "rotate-0"} />
              </button>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={17} /></button>
            </div>
          </header>

          {!minimized && (
            <>
              <nav className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-950/25 p-2">
                {([
                  ["try", "Try", Sparkles],
                  ["teach", "Teach", Brain],
                  ["understand", "Understand", Layers3],
                ] as const).map(([value, text, Icon]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black transition ${tab === value ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"}`}
                  >
                    <Icon size={13} /> {text}
                  </button>
                ))}
                <div className="ml-auto hidden items-center gap-2 px-2 text-[9px] text-slate-500 sm:flex">
                  <span className={isSimRunning ? "text-emerald-300" : "text-slate-600"}>Circuit {isSimRunning ? "live" : "idle"}</span>
                  <span>·</span>
                  <span>{store.samples.length} examples</span>
                </div>
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {tab === "try" && (
                  <div className="mx-auto max-w-5xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black">See AI think</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Start simple. Use a ready-made AI now, or switch to your own trained model.</p>
                      </div>
                      <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
                        <button onClick={() => setTryMode("ready")} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${tryMode === "ready" ? "bg-slate-800 text-white" : "text-slate-500"}`}>Ready AI</button>
                        <button disabled={!store.model} onClick={() => setTryMode("trained")} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${tryMode === "trained" ? "bg-violet-600 text-white" : "text-slate-500"} disabled:opacity-30`}>My AI</button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
                        <div className="relative aspect-video">
                          {cameraActive ? (
                            <>
                              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                              <canvas ref={overlayRef} className="absolute inset-0 h-full w-full pointer-events-none" />
                            </>
                          ) : (
                            <div className="absolute inset-0 grid place-items-center p-6 text-center">
                              <div>
                                <Camera size={28} className="mx-auto text-violet-300" />
                                <p className="mt-3 text-sm font-bold">Camera off</p>
                                <p className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">Nothing starts until you press the camera button.</p>
                              </div>
                            </div>
                          )}
                          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[9px] font-mono">
                            <span className={tryMode === "ready" && readyLoaded ? "text-emerald-300" : tryMode === "trained" && model ? "text-emerald-300" : "text-amber-300"}>
                              {tryMode === "ready" ? (readyLoading ? "loading ready AI" : readyLoaded ? "ready AI" : "ready AI off") : model ? "my model ready" : "train a model"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-600">{tryMode === "ready" ? "Perception" : "Learning"}</p>
                            <p className="truncate text-xs font-bold text-slate-200">{aiState.detectedClass === "none" ? "Looking..." : aiState.detectedClass}</p>
                          </div>
                          <span className="font-mono text-xs font-black text-violet-300">{aiState.confidence ? `${aiState.confidence}%` : "—"}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Zap size={14} className="text-violet-300" /><span className="text-xs font-black">AI → Circuit</span></div>
                            <span className={isSimRunning ? "text-[9px] font-mono text-emerald-300" : "text-[9px] font-mono text-slate-600"}>{isSimRunning ? "LIVE" : "READY"}</span>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-slate-500">The current AI result is already available to Blockly.</p>
                          <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300">Use these blocks</p>
                            <p className="mt-1 text-[10px] leading-5 text-slate-300">AI sees · AI confidence · detected object</p>
                          </div>
                          {!isSimRunning && onStartSim && (
                            <button onClick={onStartSim} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black text-slate-950">
                              <Play size={12} fill="currentColor" /> Run circuit
                            </button>
                          )}
                        </div>

                        <label className="block rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-4 cursor-pointer hover:border-violet-400/30">
                          <div className="flex items-center gap-2"><Upload size={14} className="text-violet-300" /><span className="text-xs font-black">Test an image</span></div>
                          <p className="mt-1 text-[10px] leading-5 text-slate-500">Use this to test a trained model without changing your dataset.</p>
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ""
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = () => {
                              const dataUrl = typeof reader.result === "string" ? reader.result : ""
                              if (dataUrl) void runFilePrediction(dataUrl)
                            }
                            reader.readAsDataURL(file)
                          }} />
                        </label>

                        {testImage && testResult && (
                          <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-3">
                            <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300">Model result</p>
                            <div className="mt-2 flex items-end justify-between gap-2">
                              <span className="text-sm font-black">{testResult.label}</span>
                              <span className="font-mono text-xs font-bold text-violet-300">{testResult.confidence}%</span>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {Object.entries(testResult.probabilities).map(([name, probability]) => (
                                <div key={name}>
                                  <div className="flex justify-between text-[9px] text-slate-500"><span>{name}</span><span>{probability}%</span></div>
                                  <div className="mt-1 h-1 rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-400" style={{ width: `${probability}%` }} /></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setCameraActive((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black text-white hover:bg-violet-400">
                        {cameraActive ? <CameraOff size={13} /> : <Camera size={13} />}
                        {cameraActive ? "Stop camera" : "Start camera"}
                      </button>
                      {store.model && (
                        <button onClick={() => setTryMode("trained")} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[10px] font-black text-violet-200">
                          <Brain size={13} /> Use my model
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {tab === "teach" && (
                  <div className="mx-auto max-w-5xl space-y-4">
                    <div className="max-w-2xl">
                      <h3 className="text-lg font-black">Teach the machine</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Give each concept a few varied examples. The browser trains a tiny neural network from the image pixels.</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                        <div className="flex items-center gap-2 text-xs font-black"><Camera size={14} className="text-violet-300" /> Capture examples</div>
                        <div className="mt-3 rounded-xl border border-slate-800 bg-black overflow-hidden">
                          <div className="relative aspect-video">
                            {cameraActive ? (
                              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 grid place-items-center text-center p-5"><p className="text-[11px] text-slate-500">Start the camera to collect examples.</p></div>
                            )}
                          </div>
                        </div>
                        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Concept name: Bottle" className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs outline-none focus:border-violet-400/40" />
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => setCameraActive(true)} className="rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300">Start camera</button>
                          <button onClick={() => void addCapturedSample()} disabled={!cameraActive || !label.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-[10px] font-black text-white disabled:opacity-30"><Sparkles size={12} /> Add example</button>
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-bold text-slate-300">
                            <Upload size={12} /> Upload
                            <input type="file" accept="image/*" className="hidden" onChange={importSample} />
                          </label>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-black"><FlaskConical size={14} className="text-violet-300" /> My dataset</div><span className="text-[9px] font-mono text-slate-600">{store.samples.length} examples</span></div>
                        <div className="mt-3 space-y-2">
                          {classes.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-4 text-[10px] leading-5 text-slate-600">Start with two concepts. Example: Bottle and Paper.</p>}
                          {classes.map((name) => (
                            <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                              <div className="flex items-center justify-between"><span className="text-xs font-bold">{name}</span><span className="font-mono text-[9px] text-violet-300">{counts[name] ?? 0} examples</span></div>
                              <div className="mt-2 grid grid-cols-5 gap-1">
                                {store.samples.filter((sample) => sample.label === name).slice(-5).map((sample) => (
                                  <div key={sample.id} className="group relative aspect-square overflow-hidden rounded-lg bg-black">
                                    <img src={sample.dataUrl} alt="" className="h-full w-full object-cover" />
                                    <button onClick={() => removeSample(sample.id)} className="absolute right-1 top-1 hidden rounded-md bg-black/70 p-1 text-red-300 group-hover:block" title="Remove example"><Trash2 size={10} /></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-500/[0.04] p-3">
                          <div className="flex items-center justify-between text-[10px] font-bold"><span>{canTrain ? "Ready to learn" : "Add more examples"}</span><span>{classes.length} concepts</span></div>
                          <p className="mt-1 text-[9px] leading-4 text-slate-500">Aim for 4–8 varied examples per concept. Front, side, near, far and different backgrounds help the model see more than one situation.</p>
                          {store.model && !training && (
                            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                              <div className="rounded-lg bg-slate-900 px-2 py-1.5"><p className="text-[8px] text-slate-600">Train</p><p className="font-mono text-[10px] text-slate-300">{store.model.trainAccuracy}%</p></div>
                              <div className="rounded-lg bg-slate-900 px-2 py-1.5"><p className="text-[8px] text-slate-600">Validate</p><p className="font-mono text-[10px] text-slate-300">{store.model.validationAccuracy}%</p></div>
                              <div className="rounded-lg bg-slate-900 px-2 py-1.5"><p className="text-[8px] text-slate-600">Epochs</p><p className="font-mono text-[10px] text-slate-300">{store.model.epochs}</p></div>
                            </div>
                          )}
                          <button onClick={() => void train()} disabled={!canTrain || training} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-30">
                            <Brain size={13} /> {training ? `Learning… ${trainingProgress.epoch}/${trainingProgress.total}` : store.model ? "Retrain my AI" : "Train my AI"}
                          </button>
                          {training && (
                            <div className="mt-2">
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-violet-400 transition-all" style={{ width: `${Math.round((trainingProgress.epoch / Math.max(1, trainingProgress.total)) * 100)}%` }} /></div>
                              <div className="mt-1 flex justify-between text-[8px] font-mono text-slate-600"><span>loss {trainingProgress.loss.toFixed(2)}</span><span>acc {Math.round(trainingProgress.accuracy * 100)}%</span></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "understand" && (
                  <div className="mx-auto max-w-5xl space-y-4">
                    <div className="max-w-2xl">
                      <h3 className="text-lg font-black">Open the black box</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Curious students can go deeper without making the main screen harder for everyone else.</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-5">
                      {[
                        ["1", "Pixels", "A tiny 8×8 colour version of the image"],
                        ["2", "Weights", "Numbers the network learns"],
                        ["3", "Activation", "Patterns are combined and filtered"],
                        ["4", "Softmax", "Scores become probabilities"],
                        ["5", "Update", "Loss nudges weights to reduce mistakes"],
                      ].map(([step, title, text]) => (
                        <div key={step} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
                          <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/10 text-[10px] font-black text-violet-300">{step}</div>
                          <p className="mt-2 text-xs font-black">{title}</p>
                          <p className="mt-1 text-[9px] leading-4 text-slate-600">{text}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-violet-300">The path</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          {["image", "matrix × weights", "ReLU", "softmax", "prediction"].map((item, index) => (
                            <span key={item} className="flex items-center gap-2"><span className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5">{item}</span>{index < 4 && <ChevronRight size={11} className="text-slate-700" />}</span>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 p-3 font-mono text-[10px] leading-6 text-slate-400">
                          y = W·x + b
                          <br />ReLU(z) = max(0, z)
                          <br />softmax(zᵢ) = eᶻⁱ / Σeᶻ
                          <br />learn by reducing loss over repeated examples
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                        <div className="flex items-center gap-2 text-xs font-black"><Layers3 size={14} className="text-violet-300" /> Your network</div>
                        {store.model ? (
                          <>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {store.model.classes.map((name) => <div key={name} className="rounded-xl bg-slate-900 p-2 text-center text-[9px] font-bold">{name}</div>)}
                            </div>
                            <div className="mt-3 space-y-1.5">
                              {getModelWeightShapes(model).map((shape) => <div key={shape} className="rounded-lg border border-slate-800 px-2.5 py-2 font-mono text-[9px] text-slate-500">{shape}</div>)}
                            </div>
                            <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-500/[0.04] p-3">
                              <p className="text-[9px] font-mono uppercase tracking-wider text-violet-300">First learned numbers</p>
                              {getModelWeightPreview(model).slice(0, 2).map((row, index) => <p key={index} className="mt-1 font-mono text-[8px] leading-4 text-slate-500">[{row.join(", ")}]</p>)}
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-slate-800 p-5 text-[10px] leading-5 text-slate-600">Train your own model and this panel will show its real layer shapes and learned weights.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.03] p-4">
                      <p className="text-xs font-black text-amber-200">Break your AI</p>
                      <p className="mt-1 max-w-3xl text-[10px] leading-5 text-slate-500">Change the angle, lighting, distance or background. A confident wrong answer is useful: it tells you what your dataset never taught the model.</p>
                    </div>
                  </div>
                )}
              </div>

              {status && <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-2.5 text-[10px] text-violet-200 sm:px-6">{status}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )

  function captureVideoFrame() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    const canvas = sampleCanvasRef.current ?? document.createElement("canvas")
    sampleCanvasRef.current = canvas
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 360
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.76)
  }

  function drawDetections(detections: AiStudioVisionState["allDetections"]) {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 360
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    detections?.forEach((item) => {
      const [x, y, w, h] = item.bbox
      ctx.strokeStyle = "#a78bfa"
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
      ctx.fillStyle = "rgba(167, 139, 250, 0.9)"
      const text = `${item.class.toUpperCase()} ${Math.round(item.score * 100)}%`
      ctx.font = "bold 12px monospace"
      const width = ctx.measureText(text).width + 12
      ctx.fillRect(x, Math.max(0, y - 21), width, 21)
      ctx.fillStyle = "#09090b"
      ctx.fillText(text, x + 6, Math.max(15, y - 6))
    })
  }

  function stopCameraTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }
}
