"use client"

import { CircuitBoard, Play, Square, Trash2 } from "lucide-react"

export type WorkbenchView = "circuit" | "code" | "3d"

interface Props {
  view: WorkbenchView
  onViewChange: (v: WorkbenchView) => void
  running: boolean
  onToggleRun: () => void
  onClear: () => void
}

const VIEWS: { id: WorkbenchView; label: string; soon?: boolean }[] = [
  { id: "circuit", label: "Circuit" },
  { id: "code", label: "Code", soon: true },
  { id: "3d", label: "3D View", soon: true },
]

export function Toolbar({ view, onViewChange, running, onToggleRun, onClear }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
          <CircuitBoard className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-mono text-sm font-semibold tracking-tight text-foreground">CircuitLab</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">virtual arduino bench</div>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => !v.soon && onViewChange(v.id)}
            disabled={v.soon}
            className={`relative rounded-md px-4 py-1.5 text-sm transition ${
              view === v.id
                ? "bg-primary text-primary-foreground"
                : v.soon
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
            {v.soon && <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">soon</span>}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
        <button
          onClick={onToggleRun}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ${
            running
              ? "bg-destructive text-white hover:opacity-90"
              : "bg-accent text-accent-foreground hover:opacity-90"
          }`}
        >
          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Stop" : "Simulate"}
        </button>
      </div>
    </header>
  )
}
