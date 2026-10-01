import { Camera, CameraOff, Mic, Sparkles, Zap } from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"
import { AiRuntimeControls } from "./ai-runtime-controls"

const MODES = [
  { id: "objects", title: "Objects", subtitle: "Detect common objects." },
  { id: "pose", title: "Pose", subtitle: "Track 17 body keypoints." },
  { id: "hands", title: "Hands", subtitle: "Gestures & 21 joints." },
  { id: "emotion", title: "Emotion", subtitle: "6 facial expressions." },
  { id: "sound", title: "Sound", subtitle: "Recognize spoken words." },
  { id: "numbers", title: "Numbers", subtitle: "Count fingers (0 to 5)." },
] as const

const GESTURE_LABELS: Record<string, { label: string; emoji: string }> = {
  thumbs_up: { label: "Thumbs Up", emoji: "👍" },
  thumbs_down: { label: "Thumbs Down", emoji: "👎" },
  peace: { label: "Peace", emoji: "✌️" },
  rock_on: { label: "Rock On", emoji: "🤘" },
  ok: { label: "OK Sign", emoji: "👌" },
  point: { label: "Point", emoji: "👉" },
  open_palm: { label: "Open Palm", emoji: "✋" },
  fist: { label: "Closed Fist", emoji: "✊" },
}

const EMOTION_LABELS: Record<string, { label: string; emoji: string }> = {
  happy: { label: "Happy", emoji: "😄" },
  surprised: { label: "Surprised", emoji: "😲" },
  sad: { label: "Sad", emoji: "😢" },
  angry: { label: "Angry", emoji: "😠" },
  thinking: { label: "Thinking", emoji: "🤔" },
  neutral: { label: "Neutral", emoji: "😐" },
}

function formatLiveResult(
  mode: string,
  detectedClass: string,
  fingerCount?: number,
  detectedGesture?: string,
  handedness?: string,
  isSound?: boolean,
): string {
  if (detectedClass === "none") {
    if (isSound) return "Listening…"
    if (mode === "emotion") return "No face detected"
    if (mode === "numbers") return "No hand detected · show fingers (0 to 5)"
    if (mode === "hands") return "No hand detected · show a gesture"
    return "No object detected"
  }

  if (mode === "numbers") {
    return `NUMBER: ${detectedClass} (${fingerCount ?? 0} finger${fingerCount === 1 ? "" : "s"})${handedness && handedness !== "none" ? ` · ${handedness}` : ""}`
  }

  if (mode === "hands") {
    const key = detectedClass in GESTURE_LABELS ? detectedClass : (detectedGesture ?? detectedClass)
    const meta = GESTURE_LABELS[key]
    const emoji = meta?.emoji ?? "✋"
    const label = meta?.label ?? key.replace(/_/g, " ").toUpperCase()
    return `${emoji} ${label}${handedness && handedness !== "none" ? ` · ${handedness}` : ""}`
  }

  if (mode === "emotion") {
    const meta = EMOTION_LABELS[detectedClass]
    const emoji = meta?.emoji ?? "😐"
    const label = meta?.label ?? detectedClass
    return `${emoji} ${label.toUpperCase()} Expression`
  }

  return detectedClass.replace(/_/g, " ")
}

export function AiTryPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    aiState, onAiStateChange, isSimRunning, onStartSim, onGoToSimulation,
    mode, isSound, activeTitle, loading, cameraActive, soundActive, inputActive,
    status, error, fps, store, studioVideoRef, overlayRef,
    stopInput, startSound, startCameraForMode, selectMode,
  } = viewModel

  return (
<div className="mx-auto max-w-none space-y-3">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                {MODES.map((item) => (
                  <button key={item.id} onClick={() => selectMode(item.id)} className={`pixiu-ai-mode-card rounded-xl border p-2 sm:p-2.5 text-left transition-all ${mode === item.id ? "pixiu-ai-mode-selected" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"}`}>
                    <p className="pixiu-ai-mode-kicker text-[10px] font-black">{item.title}</p>
                    <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-500 truncate">{item.subtitle}</p>
                  </button>
                ))}
                <button disabled={!store.model} onClick={() => selectMode("trained")} className={`pixiu-ai-mode-card rounded-xl border p-2 sm:p-2.5 text-left transition-all ${mode === "trained" ? "pixiu-ai-mode-selected" : "border-slate-800 bg-slate-950/40 hover:border-slate-700"} disabled:opacity-35`}>
                  <p className="text-[10px] font-black">My AI</p>
                  <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-500 truncate">Your trained model</p>
                </button>
              </div>

              <div className="grid gap-3.5 lg:grid-cols-[1.25fr_0.75fr] xl:grid-cols-[1.28fr_0.72fr]">
                <div className="pixiu-ai-preview overflow-hidden rounded-2xl border bg-black shadow-lg">
                  <div className="relative aspect-video max-h-[44vh] sm:max-h-[46vh] lg:max-h-[48vh] min-h-[220px] w-full mx-auto">
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
                        <p className="mt-3 text-sm font-black">{aiState.detectedClass === "none" ? (soundActive ? "Ready for a voice command · listening…" : "Microphone off") : aiState.detectedClass}</p>
                        <p className="mt-1 max-w-sm text-[10px] leading-5 text-slate-500">
                          {soundActive
                            ? aiState.detail
                            : "Turn on your microphone to recognize spoken words locally in your browser."}
                        </p>
                        <button
                          type="button"
                          onClick={soundActive ? stopInput : () => void startSound()}
                          className={
                            "mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer " +
                            (soundActive
                              ? "border border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                              : "bg-violet-600 text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500")
                          }
                        >
                          <Mic size={14} /> {soundActive ? "Turn Off Microphone" : "Turn On Microphone"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <video ref={studioVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                      </>
                    )}
                    {!inputActive && !isSound && (
                      <div className="absolute inset-0 grid place-items-center bg-slate-950/95 p-6 text-center">
                        <Camera size={36} className="mx-auto text-violet-400/80" />
                        <p className="mt-3 text-sm font-black text-white">Camera is off</p>
                        <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-400">
                          {mode === "trained"
                            ? "Turn on your camera to test your trained custom model in real time."
                            : `Turn on your camera to start ${activeTitle} vision AI in your browser.`}
                        </p>
                        <button
                          type="button"
                          onClick={() => void startCameraForMode()}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all cursor-pointer"
                        >
                          <Camera size={15} /> Turn On Camera
                        </button>
                      </div>
                    )}
                    {inputActive && !isSound && (
                      <button
                        type="button"
                        onClick={stopInput}
                        className="absolute right-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-slate-950/85 px-3 py-1 font-mono text-[9px] text-rose-300 backdrop-blur hover:bg-rose-500/20 transition-all cursor-pointer"
                        title="Click to turn off camera"
                      >
                        <CameraOff size={11} /> Turn Off Camera
                      </button>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 max-w-lg rounded-xl border border-cyan-300/20 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur-md">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[7.5px] font-mono uppercase tracking-[0.16em] text-cyan-200">LIVE RESULT</p>
                          <p className="mt-0.5 truncate text-sm font-black text-white sm:text-base">
                            {formatLiveResult(
                              mode,
                              aiState.detectedClass,
                              aiState.fingerCount,
                              aiState.detectedGesture,
                              aiState.handedness,
                              isSound,
                            )}
                          </p>
                          <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-400">
                            {aiState.detail}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-lg border border-violet-300/20 bg-slate-950 px-2.5 py-1 text-right">
                          <p className="text-[7px] font-mono uppercase tracking-[0.12em] text-slate-600">Confidence</p>
                          <p className="mt-0.5 text-base font-black text-violet-200">{aiState.confidence}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="pixiu-ai-preview-chip absolute left-3 top-3 rounded-full border px-2.5 py-1 font-mono text-[9px]">
                      {loading ? "LOADING" : inputActive ? (mode === "trained" ? "MY AI LIVE" : `${activeTitle.toUpperCase()} LIVE`) : "READY"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/60 px-3 py-2">
                    <div>
                      <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-600">{activeTitle}</p>
                      <p className="mt-0.5 text-xs font-black">{aiState.detectedClass === "none" ? status : aiState.detectedClass}</p>
                      <p className="mt-0.5 text-[8.5px] text-slate-600">{aiState.detail}</p>
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
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[8px] font-mono uppercase text-slate-500 mr-1">Digits:</span>
                          {["0", "1", "2", "3", "4", "5"].map((digit) => {
                            const isActive = aiState.detectedClass === digit
                            return (
                              <span
                                key={digit}
                                className={`rounded-lg border px-2 py-0.5 text-[8.5px] font-mono font-bold transition-all ${
                                  isActive
                                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-sm shadow-emerald-500/20"
                                    : "border-slate-800 bg-slate-950 text-slate-500"
                                }`}
                              >
                                {digit}
                              </span>
                            )
                          })}
                          <span className="ml-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-[8px] font-mono text-slate-400">
                            {aiState.fingerCount ?? 0} fingers · {aiState.handedness ?? "none"}
                          </span>
                        </div>
                      )}
                      {mode === "hands" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[8px] font-mono uppercase text-slate-500 mr-1">Signs:</span>
                          {[
                            { id: "thumbs_up", label: "👍 Up" },
                            { id: "thumbs_down", label: "👎 Down" },
                            { id: "peace", label: "✌️ Peace" },
                            { id: "rock_on", label: "🤘 Rock" },
                            { id: "ok", label: "👌 OK" },
                            { id: "point", label: "👉 Point" },
                            { id: "open_palm", label: "✋ Palm" },
                            { id: "fist", label: "✊ Fist" },
                          ].map((item) => {
                            const isActive =
                              aiState.detectedClass === item.id ||
                              aiState.detectedGesture === item.id
                            return (
                              <span
                                key={item.id}
                                className={`rounded-lg border px-2 py-0.5 text-[8.5px] font-mono font-bold transition-all ${
                                  isActive
                                    ? "border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-sm shadow-sky-500/20"
                                    : "border-slate-800 bg-slate-950 text-slate-500"
                                }`}
                              >
                                {item.label}
                              </span>
                            )
                          })}
                          {aiState.handedness && aiState.handedness !== "none" && (
                            <span className="ml-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-[8px] font-mono text-slate-400">
                              {aiState.handedness}
                            </span>
                          )}
                        </div>
                      )}
                      {mode === "emotion" && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[8px] font-mono uppercase text-slate-500 mr-1">Expressions:</span>
                          {[
                            { id: "happy", label: "😄 Happy" },
                            { id: "surprised", label: "😲 Surprised" },
                            { id: "sad", label: "😢 Sad" },
                            { id: "angry", label: "😠 Angry" },
                            { id: "thinking", label: "🤔 Thinking" },
                            { id: "neutral", label: "😐 Neutral" },
                          ].map((item) => {
                            const isActive = aiState.detectedClass === item.id
                            const prob = aiState.probabilities?.[item.id]
                            return (
                              <span
                                key={item.id}
                                className={`rounded-lg border px-2 py-0.5 text-[8.5px] font-mono font-bold transition-all ${
                                  isActive
                                    ? "border-pink-400/60 bg-pink-500/20 text-pink-200 shadow-sm shadow-pink-500/20"
                                    : "border-slate-800 bg-slate-950 text-slate-500"
                                }`}
                              >
                                {item.label}{prob !== undefined ? ` · ${prob}%` : ""}
                              </span>
                            )
                          })}
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

                <aside className="space-y-2.5">
                  <AiRuntimeControls viewModel={viewModel} />

                  <div className="rounded-xl border border-cyan-300/15 bg-slate-950/55 p-3 shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[7.5px] font-mono uppercase tracking-[0.16em] text-cyan-200">LIVE RESULT</p>
                        <p className="mt-0.5 truncate text-xs font-black text-white">
                          {formatLiveResult(
                            mode,
                            aiState.detectedClass,
                            aiState.fingerCount,
                            aiState.detectedGesture,
                            aiState.handedness,
                            isSound,
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[8px] text-violet-200">{aiState.confidence}%</span>
                    </div>
                    <p className="mt-0.5 text-[8.5px] leading-3.5 text-slate-500">{aiState.detail}</p>
                  </div>

                  <div className="pixiu-ai-signal-card rounded-xl border p-3">
                    <div className="flex items-center gap-2"><Zap size={13} className="text-cyan-300" /><p className="pixiu-ai-signal-title text-xs font-mono font-black">6K · AI → CIRCUIT SIGNAL</p></div>
                    <p className="mt-1.5 text-[9px] leading-4 text-slate-500">The Workbench receives detected class, confidence and detections. Blockly can use AI sees, AI class, AI confidence and AI camera ON/OFF.</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {["car", "person", "phone", "hand", "0", "3", "happy", "yes"].map((signal) => (
                        <button key={signal} onClick={() => onAiStateChange({ ...aiState, enabled: true, detectedClass: signal, confidence: 95, detail: `Test signal · ${signal}` })} className="pixiu-ai-signal-button rounded-lg border px-2 py-1 text-[8.5px] font-mono text-slate-300">
                          Test {signal}
                        </button>
                      ))}
                    </div>
                    {onStartSim && !isSimRunning && <button onClick={onStartSim} className="mt-2.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-[9.5px] font-black text-slate-950">Run circuit</button>}
                  </div>

                  {error && <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-2.5 text-[9.5px] leading-4 text-amber-200">{error}</div>}
                </aside>
              </div>
            </div>
  )
}
