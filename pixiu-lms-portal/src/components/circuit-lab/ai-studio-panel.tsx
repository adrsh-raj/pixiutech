"use client"

import { Brain, GripVertical, Layers3, Mic, Sparkles, X } from "lucide-react"
import "./pixiu-brand.css"
import { AiTryPanel } from "./ai-try-panel"
import { AiTeachPanel } from "./ai-teach-panel"
import { AiUnderstandPanel } from "./ai-understand-panel"
import { AiPermissionStatus } from "./ai-permission-status"
import { useAiStudioController, type AiStudioPanelProps } from "./use-ai-studio-controller"

export type { AiVisionState, ReadyAiMode } from "@/lib/ai/vision-types"

export function AiStudioPanel(props: AiStudioPanelProps) {
  const controller = useAiStudioController(props)
  const {
    isOpen, onClose, runtimeEnabled, compact, tab, selectTab,
    floatingPosition, handleFloatingPointerMove, handleFloatingPointerUp,
    handleFloatingPointerDown, resetFloatingPosition,
    floatingVideoRef, floatingOverlayRef, mode, isSound, activeTitle,
    aiState, status, cameraActive, soundActive, stopInput,
    onGoToSimulation, store, viewModel,
  } = controller

  if (!isOpen && !runtimeEnabled) return null

  // Compact is an explicit presentation mode. It must win over isOpen so
  // an automatically opened AI camera can never cover the workspace.
  if (compact || (runtimeEnabled && !isOpen)) {
    const floatingStyle = floatingPosition
      ? { left: floatingPosition.left, top: floatingPosition.top }
      : { right: 16, bottom: 76 }

    return (
      <div
        className="pixiu-ai-floating fixed z-[70] w-[min(300px,calc(100vw-20px))] overflow-hidden rounded-2xl border bg-slate-950/96 text-white shadow-2xl ring-1 ring-black/50 select-none"
        style={floatingStyle}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={handleFloatingPointerUp}
        onPointerCancel={handleFloatingPointerUp}
      >
        <div
          className="pixiu-ai-floating-header flex cursor-move touch-none items-center justify-between border-b bg-slate-950/95 px-3 py-2"
          onPointerDown={handleFloatingPointerDown}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripVertical size={12} className="shrink-0 text-slate-500" />
            <div className="min-w-0">
              <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-cyan-200">PIXIU VISION CORE</p>
              <p className="truncate text-[10px] font-black">{activeTitle} · {mode === "sound" ? "MIC" : "CAMERA"}</p>
            </div>
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={resetFloatingPosition}
              className="rounded-md px-1.5 py-1 text-[8px] font-mono text-slate-500 hover:bg-slate-800 hover:text-white"
              title="Reset camera position"
            >
              RESET
            </button>
            <span className="pixiu-ai-live-chip rounded-full border px-2 py-1 text-[8px] font-mono">LIVE FEED</span>
          </div>
        </div>

        <div className="relative aspect-video bg-black">
          {mode === "sound" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
              <Mic size={28} className={soundActive ? "text-violet-300 animate-pulse" : "text-slate-500"} />
              <p className="text-[10px] font-black">{aiState.detectedClass === "none" ? "Listening…" : aiState.detectedClass}</p>
              <p className="text-[8px] text-slate-600">{aiState.detail}</p>
            </div>
          ) : (
            <>
              <video ref={floatingVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <canvas ref={floatingOverlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
            </>
          )}
          <div className="absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-md bg-slate-950/85 px-2 py-1 text-[9px] font-mono">
            {aiState.detectedClass === "none" ? status : aiState.detectedClass + " · " + aiState.confidence + "%"}
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="pixiu-ai-shell fixed inset-0 z-[80] flex h-[100dvh] w-screen items-stretch justify-stretch overflow-hidden bg-slate-950/90">
      <div className="pixiu-ai-window flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#07111f] text-white shadow-2xl shadow-black/60">
        <header className="pixiu-ai-header flex shrink-0 items-center justify-between border-b bg-slate-950/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="pixiu-ai-mark grid h-9 w-9 place-items-center rounded-xl text-violet-300">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-violet-300">PIXIU AI STUDIO</p>
              <h2 className="text-sm font-black sm:text-base">EXPLORE AI · BUILD AI · UNDERSTAND AI</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Minimize AI Studio">
            <X size={17} />
          </button>
        </header>

        <nav className="pixiu-ai-nav flex items-center gap-1 border-b p-2">
          {([
            ["try", "Try", Sparkles],
            ["teach", "Teach", Brain],
            ["understand", "Understand", Layers3],
          ] as const).map(([value, title, Icon]) => (
            <button key={value} onClick={() => selectTab(value)} className={`pixiu-ai-tab flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black ${tab === value ? "pixiu-ai-tab-active" : "text-slate-500 hover:bg-slate-900 hover:text-slate-200"}`}>
              <Icon size={13} />{title}
            </button>
          ))}
          <span className="ml-auto hidden text-[9px] font-mono text-slate-600 sm:block">{store.samples.length} examples</span>
        </nav>

        <AiPermissionStatus
          cameraActive={cameraActive}
          soundActive={soundActive}
          stopInput={stopInput}
          onGoToSimulation={onGoToSimulation}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6">
          {tab === "try" && <AiTryPanel viewModel={viewModel} />}

          {tab === "teach" && <AiTeachPanel viewModel={viewModel} />}

          {tab === "understand" && <AiUnderstandPanel viewModel={viewModel} />}
        </div>
      </div>
    </div>
  )
}


