import {
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Info,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"
import { AiDatasetPanel } from "./ai-dataset-panel"
import { AiTrainingDiagnostics } from "./ai-training-diagnostics"

export function AiTeachPanel({ viewModel }: { viewModel: AiStudioViewModel }) {
  const {
    store, classes, label, setLabel, datasetStats, cameraActive, runtimeEnabled,
    training, addSampleFromCamera, importSample, commitStore, renamingClass, renameValue,
    setRenamingClass, setRenameValue, removeAiClass, renameAiClass, removeAiSample,
    trainingProfile, setTrainingProfile, advancedTuning, setAdvancedTuning, customEpochs,
    setCustomEpochs, customLearningRate, setCustomLearningRate, customBatchSize,
    setCustomBatchSize, customPatience, setCustomPatience, customMinDelta, setCustomMinDelta,
    customLayers, addCustomLayer, updateCustomLayer, removeCustomLayer, moveCustomLayer,
    selectedTrainingConfig, estimatedTrainingLoad, progress, canTrain, train, resetStudio,
    model, trainingHistory, setStatus, error,
  } = viewModel
  return (
<div className="mx-auto max-w-5xl space-y-4">
              <AiDatasetPanel viewModel={viewModel} />

              <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={15} className="text-violet-300" />
                  <p className="text-xs font-black">6M · How My AI learns</p>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  {[
                    ["DATASET", "Examples + labels", "You teach what each concept looks like."],
                    ["MODEL", "Features + classifier", "A local vision feature extractor converts each image into a fixed-size visual feature vector."],
                    ["TRAIN", "Learn patterns", "Only the small classifier head is updated from your examples."],
                    ["INFERENCE", "Predict + confidence", "A new image is compared with learned class patterns and scored."],
                  ].map(([title, value, note]) => (
                    <div key={title} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <p className="text-[8px] font-mono tracking-[0.15em] text-violet-300">{title}</p>
                      <p className="mt-1 text-[10px] font-black">{value}</p>
                      <p className="mt-1 text-[9px] leading-4 text-slate-600">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <Info size={13} className="mt-0.5 shrink-0 text-slate-500" />
                  <p className="text-[9px] leading-4 text-slate-600">
                    Confidence is not a guarantee of truth. PIXIU treats a weak or ambiguous result as UNKNOWN instead of pretending it knows.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {classes.map((name) => {
                  const classSamples = store.samples.filter((sample) => sample.label === name)
                  const isRenaming = renamingClass === name

                  return (
                    <div key={name} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isRenaming ? (
                            <div className="flex gap-2">
                              <input
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] outline-none focus:border-violet-400"
                                maxLength={32}
                                autoFocus
                              />
                              <button
                                 disabled={runtimeEnabled || training}
                                 onClick={() => {
                                   const next = renameAiClass(store, name, renameValue)
                                  commitStore(next)
                                  setRenamingClass(null)
                                  setRenameValue("")
                                  setStatus(next === store ? "That concept name is already in use." : "Concept renamed.")
                                }}
                                className="rounded-lg bg-emerald-500/15 px-2 text-[9px] font-black text-emerald-300"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLabel(name)}
                              className="text-left"
                              title="Use this concept for capture"
                            >
                              <p className="truncate text-xs font-black">{name}</p>
                              <p className="mt-0.5 font-mono text-[8px] text-slate-600">{classSamples.length}/20 samples · click to select</p>
                            </button>
                          )}
                        </div>

                        {!isRenaming && (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={runtimeEnabled || training}
                              onClick={() => {
                                setRenamingClass(name)
                                setRenameValue(name)
                              }}
                              className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:text-white"
                              title="Rename concept"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              disabled={runtimeEnabled || training}
                              onClick={() => {
                                const next = removeAiClass(store, name)
                                commitStore(next)
                                if (label === name) setLabel("")
                                setRenamingClass(null)
                                setStatus("Concept removed with its examples.")
                              }}
                              className="rounded-lg border border-slate-800 p-1.5 text-slate-500 hover:text-rose-300"
                              title="Delete concept"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {classSamples.map((sample) => (
                          <div key={sample.id} className="relative">
                            <img
                              src={sample.dataUrl}
                              alt={name}
                              loading="lazy"
                              className="h-16 w-20 rounded-lg border border-slate-800 object-cover"
                            />
                            <button
                               disabled={runtimeEnabled || training}
                               onClick={() => {
                                 const next = removeAiSample(store, sample.id)
                                commitStore(next)
                              }}
                              className="absolute right-1 top-1 rounded-md bg-slate-950/85 p-1 text-slate-300 hover:text-rose-300"
                              title="Remove sample"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                        {!classSamples.length && (
                          <div className="grid h-16 w-full place-items-center rounded-lg border border-dashed border-slate-800 text-[9px] text-slate-600">
                            No examples yet
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {!classes.length && (
                  <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center">
                    <Brain size={24} className="mx-auto text-violet-300" />
                    <p className="mt-2 text-xs font-black">Start with your first concept</p>
                    <p className="mt-1 text-[10px] text-slate-600">Create a concept such as “bottle”, “pen”, or “red block”, then add examples.</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black">6I · Train My AI</p>
                      <p className="mt-1 text-[10px] leading-5 text-slate-500">
                        Local visual features feed a small classifier head. Grade-based profiles keep training light; advanced tuning is optional.
                      </p>
                    </div>
                    <button disabled={!canTrain || training || runtimeEnabled} onClick={() => void train()} className="shrink-0 rounded-xl bg-violet-500 px-4 py-2 text-[10px] font-black disabled:opacity-30">
                      {training ? (progress.stage || "Training…") : "Train My AI"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-300">Training profile</p><p className="mt-1 text-[9px] text-slate-600">Grade 6–8 presets plus Advanced tuning.</p></div>
                    <select value={trainingProfile} onChange={(event)=>setTrainingProfile(event.target.value as AiTrainingProfile)} disabled={training||runtimeEnabled||advancedTuning} className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] font-black text-white"><option value="grade6">Grade 6 · 20 max epochs</option><option value="grade7">Grade 7 · 35 max epochs</option><option value="grade8">Grade 8 · 50 max epochs</option></select></div>
                    <label className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold text-slate-400"><input type="checkbox" checked={advancedTuning} onChange={(event)=>setAdvancedTuning(event.target.checked)} disabled={training||runtimeEnabled}/>Advanced tuning</label>
                    {advancedTuning&&<div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <label className="text-[9px] font-mono text-slate-500">Max epochs<input type="number" min="8" max="150" value={customEpochs} onChange={(event)=>setCustomEpochs(Math.max(8,Math.min(150,Number(event.target.value)||40)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Learning rate<input type="number" min="0.0001" max="0.01" step="0.0001" value={customLearningRate} onChange={(event)=>setCustomLearningRate(Math.max(0.0001,Math.min(0.01,Number(event.target.value)||0.001)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Batch size<input type="number" min="2" max="32" value={customBatchSize} onChange={(event)=>setCustomBatchSize(Math.max(2,Math.min(32,Number(event.target.value)||8)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Patience<input type="number" min="2" max="20" value={customPatience} onChange={(event)=>setCustomPatience(Math.max(2,Math.min(20,Number(event.target.value)||8)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                        <label className="text-[9px] font-mono text-slate-500">Min improvement<input type="number" min="0.0001" max="0.05" step="0.0001" value={customMinDelta} onChange={(event)=>setCustomMinDelta(Math.max(0.0001,Math.min(0.05,Number(event.target.value)||0.001)))} disabled={training||runtimeEnabled} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-white"/></label>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-black text-cyan-200">Layer stack</p><p className="mt-1 text-[8px] text-slate-600">Dense / Linear, Normalization, Dropout and Activation. Conv2D is intentionally excluded.</p></div><button type="button" onClick={addCustomLayer} disabled={training||runtimeEnabled||customLayers.length>=8} className="rounded-lg bg-violet-500/15 px-2 py-1.5 text-[9px] font-black text-violet-200 disabled:opacity-30"><Plus size={11}/> Add layer</button></div>
                        <div className="mt-3 space-y-2">{customLayers.map((layer,index)=><div key={index} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2 lg:grid-cols-[28px_150px_1fr_auto] lg:items-center"><span className="text-center font-mono text-[9px] text-slate-700">{index+1}</span>
                          <select value={layer.type} onChange={(event)=>{const type=event.target.value as AiLayerSpec["type"];updateCustomLayer(index,type==="dense"?{type,units:layer.units??64,activation:layer.activation??"relu"}:type==="dropout"?{type,rate:layer.rate??0.2}:type==="activation"?{type,activation:layer.activation??"relu"}:{type})}} disabled={training||runtimeEnabled} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[9px] font-black text-white"><option value="dense">Dense / Linear</option><option value="batchNormalization">Normalization</option><option value="dropout">Dropout</option><option value="activation">Activation</option></select>
                          <div className="flex flex-wrap items-center gap-2">{layer.type==="dense"&&<><label className="text-[8px] font-mono text-slate-600">Units<input type="number" min="16" max="256" step="8" value={layer.units??64} onChange={(event)=>updateCustomLayer(index,{units:Math.max(16,Math.min(256,Number(event.target.value)||64))})} disabled={training||runtimeEnabled} className="ml-1 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white"/></label><label className="text-[8px] font-mono text-slate-600">Activation<select value={layer.activation??"relu"} onChange={(event)=>updateCustomLayer(index,{activation:event.target.value as AiLayerSpec["activation"]})} disabled={training||runtimeEnabled} className="ml-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[9px] text-white"><option value="relu">ReLU</option><option value="linear">Linear</option><option value="tanh">Tanh</option><option value="sigmoid">Sigmoid</option></select></label></>}</div>
                          <div className="flex items-center justify-end gap-1"><button type="button" onClick={()=>moveCustomLayer(index,-1)} disabled={training||runtimeEnabled||index===0} title="Move up" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-25"><ChevronUp size={12}/></button><button type="button" onClick={()=>moveCustomLayer(index,1)} disabled={training||runtimeEnabled||index===customLayers.length-1} title="Move down" className="rounded-lg border border-slate-800 p-1.5 disabled:opacity-25"><ChevronDown size={12}/></button><button type="button" onClick={()=>removeCustomLayer(index)} disabled={training||runtimeEnabled||customLayers.length<=1} title="Remove layer" className="rounded-lg border border-rose-400/10 p-1.5 text-slate-500 hover:text-rose-300 disabled:opacity-25"><Trash2 size={12}/></button></div>
                        </div>)}</div>
                      </div>
                    </div>}
                    <div className="mt-3 flex flex-wrap gap-2 text-[8px] font-mono"><span className="rounded-lg border border-slate-800 px-2 py-1">Epochs · {selectedTrainingConfig.epochs}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Layers · {selectedTrainingConfig.layers.length}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Patience · {selectedTrainingConfig.earlyStoppingPatience}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Load · {estimatedTrainingLoad.label}</span><span className="rounded-lg border border-slate-800 px-2 py-1">Params · {estimatedTrainingLoad.parameters.toLocaleString()}</span></div>
                    {estimatedTrainingLoad.warning&&<p className="mt-2 text-[8px] text-amber-300/80">{estimatedTrainingLoad.warning}</p>}
                  </div>
                  {training && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-600">
                        <span>{progress.stage}</span>
                        <span>{progress.epoch}/{progress.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-violet-400 transition-all" style={{ width: (progress.stage.startsWith("Extracting") ? 18 : 18 + Math.round((progress.epoch / Math.max(1, progress.total)) * 82)) + "%" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <AiTrainingDiagnostics training={training} progress={progress} trainingHistory={trainingHistory} model={store.model}/>

{error && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[10px] text-amber-200">
                  {error}
                </div>
              )}

              <button
                onClick={() => void resetStudio()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[10px] font-black text-slate-300"
              >
                <RefreshCcw size={13} /> Reset dataset + My AI
              </button>
            </div>
  )
}
