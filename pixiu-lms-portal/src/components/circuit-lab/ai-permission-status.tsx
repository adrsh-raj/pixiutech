import type { AiVisionState } from "@/lib/ai/vision-types"
import type { Dispatch } from "react"

export function AiPermissionStatus({
  aiState,
  cameraActive,
  soundActive,
  stopInput,
  onGoToSimulation,
}: {
  aiState: AiVisionState
  cameraActive: boolean
  soundActive: boolean
  stopInput: () => void
  onGoToSimulation?: () => void
}) {
  return (
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono">
            <span className="mr-1 uppercase tracking-[0.16em] text-slate-600">Privacy</span>
            <span className={"rounded-full border px-2 py-1 " + (cameraActive ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300" : "border-slate-800 text-slate-600")}>
              CAMERA · {cameraActive ? "ACTIVE" : "OFF"}
            </span>
            <span className={"rounded-full border px-2 py-1 " + (soundActive ? "border-violet-400/30 bg-violet-400/5 text-violet-300" : "border-slate-800 text-slate-600")}>
              MIC · {soundActive ? "ACTIVE" : "OFF"}
            </span>
            <span className="rounded-full border border-slate-800 px-2 py-1 text-slate-600">DATA · THIS BROWSER</span>
            {(cameraActive || soundActive) && (
              <button
                type="button"
                onClick={stopInput}
                className="ml-auto rounded-full border border-rose-400/20 px-2 py-1 text-rose-300 hover:bg-rose-500/5"
              >
                Stop inputs
              </button>
            )}
            <span className="text-slate-700">No camera/mic stream is sent to the AI backend by this studio.</span>
            {onGoToSimulation && <button type="button" onClick={onGoToSimulation} className="ml-auto rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[9px] font-black text-violet-200 hover:bg-violet-500/20">Go to Simulation</button>}
          </div>

  )
}
