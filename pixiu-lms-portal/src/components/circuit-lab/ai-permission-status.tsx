export function AiPermissionStatus({
  cameraActive,
  soundActive,
  stopInput,
  onToggleCamera,
  onToggleSound,
  onGoToSimulation,
}: {
  cameraActive: boolean
  soundActive: boolean
  stopInput: () => void
  onToggleCamera?: () => void
  onToggleSound?: () => void
  onGoToSimulation?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 bg-slate-950/80 px-4 py-2 text-[9px] font-mono sm:px-6">
      <span className="mr-1 uppercase tracking-[0.16em] text-slate-500 font-bold">Hardware</span>

      {onToggleCamera ? (
        <button
          type="button"
          onClick={onToggleCamera}
          className={
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all cursor-pointer " +
            (cameraActive
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-200"
              : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-violet-400/40 hover:text-white")
          }
          title={cameraActive ? "Camera is ACTIVE (click to turn OFF)" : "Camera is OFF (click to turn ON)"}
        >
          <span className={"inline-block h-1.5 w-1.5 rounded-full " + (cameraActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
          CAMERA · {cameraActive ? "ACTIVE (Click to Stop)" : "OFF (Click to Start)"}
        </button>
      ) : (
        <span className={"rounded-full border px-2 py-1 " + (cameraActive ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300" : "border-slate-800 text-slate-600")}>
          CAMERA · {cameraActive ? "ACTIVE" : "OFF"}
        </span>
      )}

      {onToggleSound ? (
        <button
          type="button"
          onClick={onToggleSound}
          className={
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all cursor-pointer " +
            (soundActive
              ? "border-violet-400/40 bg-violet-400/10 text-violet-300 hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-200"
              : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-violet-400/40 hover:text-white")
          }
          title={soundActive ? "Microphone is ACTIVE (click to turn OFF)" : "Microphone is OFF (click to turn ON)"}
        >
          <span className={"inline-block h-1.5 w-1.5 rounded-full " + (soundActive ? "bg-violet-400 animate-pulse" : "bg-slate-600")} />
          MIC · {soundActive ? "ACTIVE (Click to Stop)" : "OFF (Click to Start)"}
        </button>
      ) : (
        <span className={"rounded-full border px-2 py-1 " + (soundActive ? "border-violet-400/30 bg-violet-400/5 text-violet-300" : "border-slate-800 text-slate-600")}>
          MIC · {soundActive ? "ACTIVE" : "OFF"}
        </span>
      )}

      <span className="rounded-full border border-slate-800 px-2 py-1 text-slate-500">DATA · THIS BROWSER</span>

      {(cameraActive || soundActive) && (
        <button
          type="button"
          onClick={stopInput}
          className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          Stop inputs
        </button>
      )}

      <span className="hidden text-slate-600 xl:inline">No camera/mic stream is sent to the AI backend by this studio.</span>

      {onGoToSimulation && (
        <button
          type="button"
          onClick={onGoToSimulation}
          className="ml-auto rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[9px] font-black text-violet-200 hover:bg-violet-500/20"
        >
          Go to Simulation
        </button>
      )}
    </div>
  )
}
