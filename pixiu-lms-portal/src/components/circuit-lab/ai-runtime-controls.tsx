import { Camera, CameraOff, Mic } from "lucide-react"
import type { AiStudioViewModel } from "./ai-studio-view-model"

export function AiRuntimeControls({ viewModel }: { viewModel: AiStudioViewModel }) {
  const { isSound, cameraActive, soundActive, startSound, startCameraForMode, stopInput } = viewModel

  return (
<div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <p className="text-xs font-black">6B–6G · Ready AI</p>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      Objects, Pose, Fingers, Emotion and Numbers use the Vision camera. Sound uses a separate microphone lifecycle. Only the selected AI model loads.
                    </p>
                    <button onClick={isSound ? (soundActive ? stopInput : startSound) : (cameraActive ? stopInput : startCameraForMode)} className="pixiu-ai-command mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black">
                      {(isSound ? soundActive : cameraActive) ? (isSound ? <Mic size={13} /> : <CameraOff size={13} />) : isSound ? <Mic size={13} /> : <Camera size={13} />}
                      {(isSound ? soundActive : cameraActive) ? "Stop" : isSound ? "Start microphone" : "Start camera"}
                    </button>
                  </div>
  )
}
