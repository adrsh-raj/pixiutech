import { BookOpen, Info, ShieldCheck } from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"
import { getModelWeightPreview, getModelWeightShapes } from "@/lib/ai-studio-engine"
import { formatDecisionReason } from "./ai-studio-presenters"

export function AiUnderstandPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    currentExplanation, aiState, store, model, cameraActive, soundActive,
    stopInput, resetStudio, loading,
  } = viewModel
  return (
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
  )
}
