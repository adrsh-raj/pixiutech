import type { AiModelSummary, AiTrainingHistoryPoint } from "@/lib/ai-studio-engine"

function metricValues(
  points: AiTrainingHistoryPoint[],
  key: "loss" | "valLoss" | "accuracy" | "valAccuracy",
) {
  return points
    .map((point) => point[key])
    .filter((value): value is number => value != null && Number.isFinite(value))
}

function metricPath(
  points: AiTrainingHistoryPoint[],
  key: "loss" | "valLoss" | "accuracy" | "valAccuracy",
) {
  const values = metricValues(points, key)
  if (!values.length) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1e-6, max - min)
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100
      const y = 46 - ((value - min) / range) * 38
      return `${x},${y}`
    })
    .join(" ")
}

function MetricChart({
  title,
  points,
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  title: string
  points: AiTrainingHistoryPoint[]
  primary: "loss" | "accuracy"
  secondary: "valLoss" | "valAccuracy"
  primaryLabel: string
  secondaryLabel: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-slate-600">{title}</p>
        <span className="text-[8px] text-slate-700">{points.length} epochs</span>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg bg-slate-950">
        {points.length ? (
          <svg viewBox="0 0 100 50" className="h-28 w-full">
            <polyline points={metricPath(points, primary)} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-300" />
            {metricValues(points, secondary).length > 1 && <polyline points={metricPath(points, secondary)} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" className="text-cyan-300" />}
          </svg>
        ) : (
          <div className="grid h-28 place-items-center text-[9px] text-slate-700">Training metrics will appear here.</div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[8px] font-mono text-slate-600">
        <span>— {primaryLabel}</span>
        {metricValues(points, secondary).length > 1 && <span>-- {secondaryLabel}</span>}
      </div>
    </div>
  )
}

function ConfusionMatrix({ classes, matrix }: { classes: string[]; matrix?: number[][] }) {
  if (!matrix?.length) return null
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-slate-600">Validation confusion matrix</p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-[8px] font-mono">
          <thead><tr><th className="p-1 text-left text-slate-700">actual \ predicted</th>{classes.map((name)=><th key={name} className="p-1 text-right text-slate-600">{name}</th>)}</tr></thead>
          <tbody>{matrix.map((row,rowIndex)=><tr key={classes[rowIndex] ?? rowIndex}><th className="p-1 text-left text-slate-600">{classes[rowIndex] ?? rowIndex}</th>{row.map((value,columnIndex)=><td key={columnIndex} className="p-1 text-right text-slate-400">{value}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

export function AiTrainingDiagnostics({
  training,
  progress,
  trainingHistory,
  model,
}: {
  training: boolean
  progress: { epoch: number; total: number; accuracy: number; valAccuracy: number | null; stage: string }
  trainingHistory: AiTrainingHistoryPoint[]
  model: AiModelSummary | null
}) {
  if (!training && !model?.trainingHistory?.length) return null
  return (
    <div className="space-y-3 rounded-2xl border border-cyan-300/10 bg-cyan-500/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black">6I · Training diagnostics</p>
        <span className="text-[8px] font-mono text-slate-600">
          Epoch {training ? progress.epoch + "/" + progress.total : model?.epochs ?? 0}
          {" · "}Train {training ? Math.round(progress.accuracy * 100) : model?.trainAccuracy ?? 0}%
          {" · "}Val {training ? (progress.valAccuracy == null ? "—" : Math.round(progress.valAccuracy * 100) + "%") : model?.validationAvailable ? (model.validationAccuracy ?? 0) + "%" : "—"}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <MetricChart title="Loss · lower is better" points={training ? trainingHistory : model?.trainingHistory ?? []} primary="loss" secondary="valLoss" primaryLabel="Training loss" secondaryLabel="Validation loss" />
        <MetricChart title="Accuracy · higher is better" points={training ? trainingHistory : model?.trainingHistory ?? []} primary="accuracy" secondary="valAccuracy" primaryLabel="Training accuracy" secondaryLabel="Validation accuracy" />
      </div>
      {!training && model && (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Best epoch</p><p className="text-sm font-black">{model.bestEpoch ?? "—"}</p></div>
            <div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Parameters</p><p className="text-sm font-black">{(model.parameterCount ?? 0).toLocaleString()}</p></div>
            <div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Validation</p><p className="text-sm font-black">{model.validationAvailable ? "Available" : "Not available"}</p></div>
            <div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Gap</p><p className="text-sm font-black">{model.validationAvailable ? (model.generalizationGap ?? 0) + "%" : "—"}</p></div>
            <div className="rounded-xl border border-slate-800 p-3"><p className="text-[8px] text-slate-600">Stopping</p><p className="text-sm font-black">{model.earlyStopped ? "Early" : "Max epochs"}</p></div>
          </div>
          <ConfusionMatrix classes={model.classes} matrix={model.validationConfusionMatrix} />
        </>
      )}
    </div>
  )
}
