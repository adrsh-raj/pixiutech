import { Camera, CameraOff, Plus, Upload } from "lucide-react"
import { addAiClass } from "@/lib/ai-studio-engine"
import type { AiStudioViewModel } from "./ai-studio-view-model"

export function AiDatasetPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    store, label, setLabel, datasetStats, cameraActive, runtimeEnabled, training,
    addSampleFromCamera, importSample, commitStore, setStatus, teachVideoRef,
    startTeachCamera, stopInput,
  } = viewModel

  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-white">6H · Build My AI dataset</p>
            <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-400">
              Create concepts, capture or import examples, rename classes, remove mistakes, and balance the dataset before training.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-right">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">Dataset</p>
            <p className="mt-1 text-sm font-black text-violet-200">{datasetStats.sampleCount} samples · {datasetStats.classCount} classes</p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Concept name · e.g. bottle"
            maxLength={32}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-[10px] outline-none focus:border-violet-400 text-white"
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
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-[10px] font-black text-white hover:bg-violet-600 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Plus size={13} /> Add concept
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (cameraActive ? void addSampleFromCamera() : void startTeachCamera())}
            disabled={(!cameraActive ? false : !label.trim()) || runtimeEnabled || training}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-slate-950 px-3.5 py-2 text-[10px] font-black text-violet-200 disabled:opacity-30 cursor-pointer hover:bg-slate-900 transition-colors"
          >
            <Camera size={13} /> {cameraActive ? "Capture example" : "Start camera"}
          </button>
          {cameraActive && (
            <button
              type="button"
              onClick={stopInput}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <CameraOff size={13} /> Stop camera
            </button>
          )}
          <label className={"inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-[10px] font-black text-slate-300 " + (runtimeEnabled || training ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-slate-900")}>
            <Upload size={13} /> Import images
            <input hidden multiple type="file" accept="image/*" onChange={importSample} disabled={runtimeEnabled || training} />
          </label>
          <span className="text-[9px] text-slate-500 font-mono">Recommended: 8+ / concept (min 3)</span>
        </div>

        {/* Live Teach Camera Viewfinder */}
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-black aspect-video min-h-[220px]">
          <video
            ref={teachVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/92 backdrop-blur-xs">
              <Camera size={32} className="text-violet-400/70 mb-2" />
              <p className="text-xs font-black text-white">Teach Camera Off</p>
              <p className="mt-1 text-[10px] text-slate-400 max-w-xs leading-4">
                Turn on your camera to capture examples for &quot;{label.trim() || "your selected concept"}&quot; directly from your webcam.
              </p>
              <button
                type="button"
                disabled={runtimeEnabled || training}
                onClick={() => void startTeachCamera()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black text-white hover:bg-violet-500 disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-violet-600/20"
              >
                <Camera size={13} /> Turn On Camera
              </button>
            </div>
          )}

          {cameraActive && (
            <>
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-slate-950/85 px-2.5 py-1 text-[8px] font-mono text-emerald-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                TEACH CAM · LIVE
              </div>
              <button
                type="button"
                onClick={stopInput}
                className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-slate-950/85 px-2.5 py-1 font-mono text-[8px] text-rose-300 backdrop-blur hover:bg-rose-500/20 transition-all cursor-pointer"
                title="Turn off teach camera"
              >
                <CameraOff size={10} /> Turn Off Camera
              </button>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-950/90 px-3 py-2 backdrop-blur-md">
                <div className="min-w-0">
                  <span className="block truncate text-[9px] font-mono text-slate-300">
                    Target concept: <strong className="text-violet-200">{label.trim() ? label : "Enter/select concept"}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!label.trim() || runtimeEnabled || training}
                  onClick={() => void addSampleFromCamera()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[9px] font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Camera size={12} /> Capture Sample
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
        <p className="text-xs font-black text-white">Dataset health</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["Concepts", String(datasetStats.classCount)],
            ["Samples", String(datasetStats.sampleCount)],
            ["Min / class", String(datasetStats.minSamples)],
            ["Balance", datasetStats.balanced ? "Balanced" : "Needs balance"],
          ].map(([name, value]) => (
            <div key={name} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-[8px] font-mono uppercase tracking-[0.14em] text-slate-500">{name}</p>
              <p className="mt-1 text-xs font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-500/[0.03] p-3 text-[10px] leading-5 text-slate-400">
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
