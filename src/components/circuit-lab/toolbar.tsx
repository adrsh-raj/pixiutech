import { Link } from "react-router-dom"
import { CircuitBoard, Play, Square, Trash2, ArrowLeft, Undo2, Redo2, Save, Terminal, Volume2, VolumeX, Sparkles, Camera, Gauge } from "lucide-react"

export type WorkbenchView = "circuit" | "code" | "3d"

const WIRE_COLOR_OPTIONS = [
  { name: "Green", color: "#22c55e" },
  { name: "Red (5V)", color: "#ef4444" },
  { name: "Black (GND)", color: "#1e293b" },
  { name: "Yellow", color: "#eab308" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Orange", color: "#f97316" },
  { name: "White", color: "#f8fafc" },
  { name: "Purple", color: "#a855f7" },
]

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
  onSave?: () => void
  isSerialOpen?: boolean
  onToggleSerial?: () => void
  isDmmOpen?: boolean
  onToggleDmm?: () => void
  isAiCameraOpen?: boolean
  onToggleAiCamera?: () => void
  isMuted?: boolean
  onToggleMute?: () => void
  onOpenTemplates?: () => void
  activeWireColor?: string
  onSelectWireColor?: (color: string) => void
  selectedWireId?: string | null
  onDeleteSelectedWire?: () => void
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
  onSave,
  isSerialOpen = false,
  onToggleSerial,
  isDmmOpen = false,
  onToggleDmm,
  isAiCameraOpen = false,
  onToggleAiCamera,
  isMuted = false,
  onToggleMute,
  onOpenTemplates,
  activeWireColor = "#22c55e",
  onSelectWireColor,
  selectedWireId,
  onDeleteSelectedWire,
}: Props) {
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
          <div className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-lg bg-[#00878F] text-white shadow-sm shrink-0">
            <CircuitBoard className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-xs sm:text-sm font-bold tracking-tight text-foreground">
              <span>CyberLab</span>
            </div>
            <div className="hidden lg:block text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
              Virtual Arduino & Circuit Studio
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Circuit / Code Mode Toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 sm:p-1 shrink-0">
        <button
          onClick={() => onViewChange("circuit")}
          className={`rounded-md px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-semibold transition ${
            view === "circuit"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Circuit
        </button>
        <button
          onClick={() => onViewChange("code")}
          className={`rounded-md px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm font-semibold transition ${
            view === "code"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Code
        </button>
        <button
          disabled
          className="hidden sm:inline-flex rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground/50 cursor-not-allowed"
        >
          3D <span className="ml-1 text-[8px] uppercase tracking-wider opacity-60">soon</span>
        </button>
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Templates (Desktop) */}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2.5 py-1.5 text-xs font-semibold transition"
            title="Browse Curriculum Project Templates"
          >
            <Sparkles size={14} />
            <span>Templates</span>
          </button>
        )}

        {/* Wire Color Palette (Desktop) */}
        {view === "circuit" && onSelectWireColor && (
          <div className="hidden xl:flex items-center gap-1 bg-background px-2 py-1 rounded-lg border border-border">
            <span className="text-[10px] font-mono text-muted-foreground mr-0.5">Wire:</span>
            {WIRE_COLOR_OPTIONS.map((c) => (
              <button
                key={c.color}
                onClick={() => onSelectWireColor(c.color)}
                title={c.name}
                className={`h-4 w-4 rounded-full transition-all cursor-pointer ${
                  activeWireColor === c.color
                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                    : "hover:scale-110 opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
        )}

        {/* Delete Selected Wire button */}
        {selectedWireId && onDeleteSelectedWire && (
          <button
            onClick={onDeleteSelectedWire}
            className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 text-red-400 px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition"
            title="Delete Selected Wire"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        {/* AI Vision Camera Toggle */}
        {onToggleAiCamera && (
          <button
            onClick={onToggleAiCamera}
            title="Toggle AI Vision Camera (Pixiu AI Vision Engine)"
            className={`flex items-center gap-1 rounded-lg border px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition ${
              isAiCameraOpen
                ? "border-purple-500 bg-purple-500/25 text-purple-300 shadow-sm shadow-purple-500/30"
                : "border-border text-muted-foreground hover:bg-purple-950/20 hover:text-purple-300 hover:border-purple-500/40"
            }`}
          >
            <Camera className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">AI Camera</span>
          </button>
        )}

        {/* Digital Multimeter Toggle */}
        {onToggleDmm && (
          <button
            onClick={onToggleDmm}
            title="Toggle Digital Multimeter (DMM)"
            className={`flex items-center gap-1 rounded-lg border px-2 sm:px-2.5 py-1.5 text-xs font-semibold transition ${
              isDmmOpen
                ? "border-amber-500 bg-amber-500/25 text-amber-300 shadow-sm shadow-amber-500/30"
                : "border-border text-muted-foreground hover:bg-amber-950/20 hover:text-amber-300 hover:border-amber-500/40"
            }`}
          >
            <Gauge className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Multimeter</span>
          </button>
        )}

        {/* Serial Monitor Toggle (Desktop) */}
        {onToggleSerial && (
          <button
            onClick={onToggleSerial}
            className={`hidden md:flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-mono transition ${
              isSerialOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title="Toggle Serial Monitor"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Serial</span>
          </button>
        )}

        {/* Mute Audio (Desktop) */}
        <button
          onClick={onToggleMute}
          className="hidden md:flex p-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Clear (Desktop) */}
        <button
          onClick={onClear}
          className="hidden md:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear</span>
        </button>

        {/* ALWAYS-VISIBLE RUN / STOP SIMULATION BUTTON */}
        <button
          onClick={onToggleRun}
          className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer ${
            running
              ? "bg-destructive text-white hover:opacity-90 animate-pulse"
              : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/25"
          }`}
        >
          {running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          <span>{running ? "Stop" : "Run"}</span>
        </button>
      </div>
    </header>
  )
}
