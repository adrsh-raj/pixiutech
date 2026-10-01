import { Camera, CameraOff, Mic } from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"

export function AiRuntimeControls({ viewModel }: { viewModel: AiStudioViewModel }) {
  const { isSound, cameraActive, soundActive, startSound, startCameraForMode, stopInput, activeTitle } = viewModel
  const isActive = isSound ? soundActive : cameraActive

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-white">Camera & Microphone</p>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[8px] font-mono " +
            (isActive
              ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              : "border border-slate-800 bg-slate-900 text-slate-500")
          }
        >
          {isActive ? "ACTIVE" : "STANDBY"}
        </span>
      </div>
      <p className="mt-1.5 text-[9.5px] leading-4 text-slate-400">
        {isSound
          ? "Microphone is used for speech recognition. Audio runs 100% locally in your browser."
          : `Vision camera feeds ${activeTitle.toLowerCase()} inference via TensorFlow.js. Frames stay in your local browser.`}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={
            isSound
              ? (soundActive ? stopInput : () => void startSound())
              : (cameraActive ? stopInput : () => void startCameraForMode())
          }
          className={
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black transition-all cursor-pointer " +
            (isActive
              ? "border border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
              : "bg-violet-600 text-white shadow-md shadow-violet-600/20 hover:bg-violet-500")
          }
        >
          {isActive ? (
            <>
              {isSound ? <Mic size={13} /> : <CameraOff size={13} />}
              {isSound ? "Turn Off Microphone" : "Turn Off Camera"}
            </>
          ) : (
            <>
              {isSound ? <Mic size={13} /> : <Camera size={13} />}
              {isSound ? "Turn On Microphone" : "Turn On Camera"}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
