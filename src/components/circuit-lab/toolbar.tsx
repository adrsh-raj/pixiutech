import { Link } from "react-router-dom"
import { CircuitBoard, Play, Square, Trash2, ArrowLeft, Undo2, Redo2, Save, Terminal, Volume2, VolumeX, Sparkles, Camera } from "lucide-react"

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-2 sm:px-4 gap-1.5 sm:gap-2 overflow-x-auto min-w-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Portal</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#00878F] text-white shadow-sm">
            <CircuitBoard className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-xs sm:text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span>Pixiu CyberLab</span>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
              Virtual Arduino & Circuit Studio
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="hidden md:flex items-center gap-1 bg-background p-1 rounded-lg border border-border">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent text-muted-foreground hover:text-foreground transition"
          >
            <Redo2 size={15} />
          </button>
        </div>

        {/* View mode switcher */}
        <nav className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => !v.soon && onViewChange(v.id)}
              disabled={v.soon}
              className={`relative rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition ${
                view === v.id
                  ? "bg-primary text-primary-foreground"
                  : v.soon
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
              {v.soon && <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">soon</span>}
            </button>
          ))}
        </nav>

        {/* Starter Templates button */}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 text-xs font-semibold transition shrink-0"
            title="Browse Curriculum Project Templates"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">Templates</span>
          </button>
        )}

        {/* Wire Color Palette */}
        {view === "circuit" && onSelectWireColor && (
          <div className="hidden lg:flex items-center gap-1 bg-background px-2 py-1 rounded-lg border border-border">
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
            className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 text-red-400 hover:bg-red-500/25 px-2.5 py-1.5 text-xs font-semibold transition animate-in fade-in"
            title="Delete Selected Wire (or press Delete / Backspace)"
          >
            <Trash2 size={13} />
            <span>Delete Wire</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* AI Vision Camera Toggle */}
        {onToggleAiCamera && (
          <button
            onClick={onToggleAiCamera}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
              isAiCameraOpen
                ? "border-purple-500 bg-purple-500/20 text-purple-300 shadow-sm shadow-purple-500/30"
                : "border-border text-muted-foreground hover:bg-purple-950/20 hover:text-purple-300 hover:border-purple-500/40"
            }`}
            title="Toggle AI Vision Camera (PictoBlox AI Engine)"
          >
            <Camera className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">AI Camera</span>
          </button>
        )}

        {/* Serial Monitor Toggle */}
        <button
          onClick={onToggleSerial}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-mono transition ${
            isSerialOpen
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
          title="Toggle Serial Monitor"
        >
          <Terminal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Serial</span>
        </button>

        {/* Mute Audio */}
        <button
          onClick={onToggleMute}
          className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Save */}
        {onSave && (
          <button
            onClick={onSave}
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            title="Save Circuit to Browser"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>
        )}

        {/* Clear */}
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs sm:text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </button>

        {/* Simulate / Stop */}
        <button
          onClick={onToggleRun}
          className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition ${
            running
              ? "bg-destructive text-white hover:opacity-90"
              : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
          }`}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          {running ? "Stop" : "Simulate"}
        </button>
      </div>
    </header>
  )
}
