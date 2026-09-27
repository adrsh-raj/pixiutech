import { Camera, Info, Plus, Upload } from "lucide-react"
import { addAiClass } from "@/lib/ai-studio-engine"
import type { AiStudioViewModel } from "./ai-studio-view-model"

export function AiDatasetPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    store, label, setLabel, datasetStats, cameraActive, runtimeEnabled, training,
    addSampleFromCamera, importSample, commitStore, setStatus,
  } = viewModel

  return (
<div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black">6H · Build My AI dataset</p>
                      <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
                        Create concepts, capture or import examples, rename classes, remove mistakes, and balance the dataset before training.
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right">
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">Dataset</p>
                      <p className="mt-1 text-sm font-black">{datasetStats.sampleCount} samples · {datasetStats.classCount} classes</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Concept name · e.g. bottle"
                      maxLength={32}
                      className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-[10px] outline-none focus:border-violet-400"
                    />
                    <button
                       disabled={runtimeEnabled || training}
                       onClick={() => {
                         const next = addAiClass(store, label)
                        commitStore(next)
                        if (next.classes.length === store.classes.length) {
                          setStatus("Concept already exists or the 8-concept limit is reached.")
                        } else {
                          const created = next.classes[next.classes.length - 1] ?? ""
                          setLabel(created)
                          setStatus("Concept created · capture examples for it.")
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2.5 text-[10px] font-black"
                    >
                      <Plus size={13} /> Add concept
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void addSampleFromCamera()}
                      disabled={!label.trim() || runtimeEnabled || training}
                       className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-slate-950 px-3 py-2 text-[10px] font-black disabled:opacity-30"
                    >
                      <Camera size={13} /> {cameraActive ? "Capture example" : "Start capture"}
                    </button>
                    <label className={"inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black " + (runtimeEnabled || training ? "cursor-not-allowed opacity-30" : "cursor-pointer")}>
                      <Upload size={13} /> Import images
                      <input hidden multiple type="file" accept="image/*" onChange={importSample} disabled={runtimeEnabled || training} />
                    </label>
                    <span className="text-[9px] text-slate-600">Recommended: 8+ / concept · minimum 3</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <p className="text-xs font-black">Dataset health</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ["Concepts", String(datasetStats.classCount)],
                      ["Samples", String(datasetStats.sampleCount)],
                      ["Min / class", String(datasetStats.minSamples)],
                      ["Balance", datasetStats.balanced ? "Balanced" : "Needs balance"],
                    ].map(([name, value]) => (
                      <div key={name} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-600">{name}</p>
                        <p className="mt-1 text-xs font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-500/[0.03] p-3 text-[10px] leading-5 text-slate-500">
                    {datasetStats.ready
                      ? datasetStats.recommended
                        ? "Ready · enough examples for a useful transfer-learning run."
                        : "Ready to train · more varied examples can improve generalization."
                      : "Training unlocks with 2 concepts and at least 3 examples per concept."}
                  </div>
                </div>
              </div>
  )
}
