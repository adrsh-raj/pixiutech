import { Camera, CameraOff, Mic, Sparkles, Zap } from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"
import { AiRuntimeControls } from "./ai-runtime-controls"

const MODES = [
  { id: "objects", title: "Objects", subtitle: "Detect common objects." },
  { id: "pose", title: "Pose", subtitle: "Track 17 body keypoints." },
  { id: "hands", title: "Hands", subtitle: "Track hand landmarks." },
  { id: "emotion", title: "Emotion", subtitle: "Read simple facial geometry." },
  { id: "sound", title: "Sound", subtitle: "Recognize local spoken words." },
  { id: "numbers", title: "Numbers", subtitle: "Count fingers and gestures." },
] as const

export function AiTryPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    aiState, onAiStateChange, isSimRunning, onStartSim, onGoToSimulation,
    mode, isSound, activeTitle, loading, cameraActive, soundActive, inputActive,
    status, error, fps, store, studioVideoRef, overlayRef,
    stopInput, startSound, startCameraForMode, selectMode,
  } = viewModel

  return (
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
  )
}
