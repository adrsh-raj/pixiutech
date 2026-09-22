import { Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { CircuitBoard, Play, Square, Trash2, ArrowLeft, Undo2, Redo2, FolderOpen, BookOpen, Terminal, Volume2, VolumeX, Sparkles, Camera, Sliders, Pause, StepForward, FastForward, MoreHorizontal, HelpCircle } from "lucide-react"

export type WorkbenchView = "circuit" | "code" | "3d"

interface Props {
  view: WorkbenchView
  onViewChange: (v: WorkbenchView) => void
  running: boolean
  onToggleRun: () => void
  onClear: () => void
  canUndo?: boolean
  onUndo?: () => void
  canRedo?: boolean
  onRedo?: () => void
  onOpenProjects?: () => void
  onOpenLessons?: () => void
  onOpenGuide?: () => void
  isSerialOpen?: boolean
  onToggleSerial?: () => void
  isAiCameraOpen?: boolean
  onToggleAiCamera?: () => void
  isInspectorOpen?: boolean
  onToggleInspector?: () => void
  isMuted?: boolean
  onToggleMute?: () => void
  onOpenTemplates?: () => void
  selectedWireId?: string | null
  onDeleteSelectedWire?: () => void
  // Stepping Debugger Props
  isPaused?: boolean
  onPause?: () => void
  onResume?: () => void
  onStepNext?: () => void
  debugSpeed?: "normal" | "slow" | "step"
  onDebugSpeedChange?: (speed: "normal" | "slow" | "step") => void
  activeStepLabel?: string | null
}

const VIEWS: { id: WorkbenchView; label: string; soon?: boolean }[] = [
  { id: "circuit", label: "Circuit Studio" },
  { id: "code", label: "Blockly Code" },
  { id: "3d", label: "3D View", soon: true },
]

export function Toolbar({
  view,
  onViewChange,
  running,
  onToggleRun,
  onClear,
  canUndo = false,
  onUndo,
  canRedo = false,
  onRedo,
  onOpenProjects,
  onOpenLessons,
  onOpenGuide,
  isSerialOpen = false,
  onToggleSerial,
  isAiCameraOpen = false,
  onToggleAiCamera,
  isInspectorOpen = true,
  onToggleInspector,
  isMuted = false,
  onToggleMute,
  onOpenTemplates,
  selectedWireId,
  onDeleteSelectedWire,
  isPaused = false,
  onPause,
  onResume,
  onStepNext,
  debugSpeed = "normal",
  onDebugSpeedChange,
  activeStepLabel,
}: Props) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setToolsOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  return (
    <header className="flex h-12 md:h-14 shrink-0 items-center justify-between border-b border-border bg-card px-2.5 sm:px-4 gap-1.5 sm:gap-2">
      {/* LEFT: Back + CyberLab Logo */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
          title="Back to Portal"
        >
          <ArrowLeft size={14} />
          <span className="hidden md:inline">Portal</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg bg-[#1D6EFF] text-white shadow-sm shrink-0">
            <CircuitBoard className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-xs sm:text-sm font-bold tracking-tight text-foreground">
              <span>PIXIU CYBERLAB</span>
            </div>
            <div className="hidden lg:block text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
              Virtual Arduino & Circuit Studio
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: View Switcher & Primary Execution/Stepping Controller */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mode Toggle: Circuit / Code */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 sm:p-1 shrink-0 shadow-xs">
          <button
            onClick={() => onViewChange("circuit")}
            className={`rounded-md px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              view === "circuit"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Circuit
          </button>
          <button
            onClick={() => onViewChange("code")}
            className={`rounded-md px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              view === "code"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Code
          </button>
          <button
            disabled
            className="hidden sm:inline-flex rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground/50 cursor-not-allowed"
          >
            3D <span className="ml-1 text-[8px] uppercase tracking-wider opacity-60">soon</span>
          </button>
        </div>

        {/* PRIMARY EXECUTION & STEPPING CONTROLLER (Always Front & Center, Never Cut Off) */}
        <div className="flex items-center gap-1 bg-background p-0.5 sm:p-1 rounded-lg border border-border shadow-xs shrink-0">
          {/* Main Run / Stop Simulation Button */}
          <button
            onClick={onToggleRun}
            className={`flex items-center gap-1.5 rounded-md px-2.5 sm:px-3.5 py-1 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95 ${
              running
                ? "bg-destructive text-white hover:opacity-90 animate-pulse"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/25"
            }`}
            title={running ? "Stop Simulation (Space)" : "Run Simulation Continuously (Space)"}
          >
            {running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{running ? "Stop" : "Run"}</span>
          </button>

          {/* Pause / Resume Button (when running) */}
          {running && (
            isPaused ? (
              <button
                onClick={onResume}
                className="flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition cursor-pointer"
                title="Resume continuous execution (P)"
              >
                <Play className="h-3 w-3 fill-current" />
                <span className="hidden sm:inline">Resume</span>
              </button>
            ) : (
              <button
                onClick={onPause}
                className="flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 transition cursor-pointer"
                title="Pause execution before next block (P)"
              >
                <Pause className="h-3 w-3 fill-current" />
                <span className="hidden sm:inline">Pause</span>
              </button>
            )
          )}

          {/* Step Next Button (available when paused or when stopped) */}
          {(!running || isPaused) && onStepNext && (
            <button
              onClick={onStepNext}
              className="flex items-center gap-1 rounded-md px-2 sm:px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 font-mono shadow-sm transition cursor-pointer active:scale-95"
              title="Execute next single block and pause (Step Debugger - F10)"
            >
              <StepForward className="h-3 w-3" />
              <span>Step</span>
            </button>
          )}

          {/* Speed Toggle: 1x / 0.5x Trace / Step */}
          {onDebugSpeedChange && (
            <button
              onClick={() => {
                const nextSpeed = debugSpeed === "normal" ? "slow" : debugSpeed === "slow" ? "step" : "normal"
                onDebugSpeedChange(nextSpeed)
              }}
              className="hidden md:flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
              title="Execution Speed: 1x (Normal) -> 0.5x (Slow Trace) -> Step by Step"
            >
              <FastForward size={11} className={debugSpeed !== "normal" ? "text-amber-400" : ""} />
              <span>{debugSpeed === "normal" ? "1x" : debugSpeed === "slow" ? "0.5x" : "Step"}</span>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT: compact grouped tools */}
      <div className="flex items-center gap-1.5 shrink-0" ref={toolsRef}>
        {onOpenProjects && (
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-100 transition hover:bg-blue-500/15 cursor-pointer"
            title="Projects: save, load, import and export"
          >
            <FolderOpen size={14} />
            <span className="hidden lg:inline">Projects</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setToolsOpen((value) => !value)}
            aria-expanded={toolsOpen}
            aria-haspopup="menu"
            className={"flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer " + (
              toolsOpen ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            title="Open lab tools"
          >
            <MoreHorizontal size={15} />
            <span className="hidden lg:inline">Tools</span>
          </button>

          {toolsOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+7px)] z-[70] w-64 overflow-hidden rounded-2xl border border-border bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              <div className="px-2 py-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500">Lab tools</div>

              {onOpenLessons && (
                <button
                  onClick={() => { setToolsOpen(false); onOpenLessons() }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <BookOpen size={14} className="text-cyan-300" />
                  <span><span className="block">Lessons</span><span className="text-[9px] font-normal text-slate-500">Guided projects with auto-checks</span></span>
                </button>
              )}

              {onOpenGuide && (
                <button
                  onClick={() => { setToolsOpen(false); onOpenGuide() }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <HelpCircle size={14} className="text-cyan-300" />
                  <span><span className="block">Guided tour</span><span className="text-[9px] font-normal text-slate-500">Learn the studio in one minute</span></span>
                </button>
              )}

              {onOpenTemplates && (
                <button
                  onClick={() => { setToolsOpen(false); onOpenTemplates() }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <Sparkles size={14} className="text-violet-300" />
                  <span><span className="block">Templates</span><span className="text-[9px] font-normal text-slate-500">Start from a curriculum project</span></span>
                </button>
              )}

              {onToggleAiCamera && (
                <button
                  onClick={() => { setToolsOpen(false); onToggleAiCamera() }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2"><Sparkles size={14} className="text-purple-300" />AI Studio</span>
                  <span className="text-[9px] text-slate-500">{isAiCameraOpen ? "OPEN" : "CLOSED"}</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-800" />

              {onToggleInspector && (
                <button
                  onClick={() => { setToolsOpen(false); onToggleInspector() }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2"><Sliders size={14} />Inspector</span>
                  <span className="text-[9px] text-slate-500">{isInspectorOpen ? "VISIBLE" : "HIDDEN"}</span>
                </button>
              )}

              {onToggleSerial && (
                <button
                  onClick={() => { setToolsOpen(false); onToggleSerial() }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2"><Terminal size={14} />Serial monitor</span>
                  <span className="text-[9px] text-slate-500">{isSerialOpen ? "OPEN" : "CLOSED"}</span>
                </button>
              )}

              {onToggleMute && (
                <button
                  onClick={() => { setToolsOpen(false); onToggleMute() }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2">{isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}Sound</span>
                  <span className="text-[9px] text-slate-500">{isMuted ? "MUTED" : "ON"}</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-800" />

              {onClear && (
                <button
                  onClick={() => { setToolsOpen(false); onClear() }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-red-300 hover:bg-red-500/10"
                  role="menuitem"
                >
                  <Trash2 size={14} />Clear canvas
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
