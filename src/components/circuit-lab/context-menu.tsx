"use client"

import { useEffect, useRef } from "react"
import {
  RotateCw,
  Copy,
  Trash2,
  PlusCircle,
  Maximize2,
  Code2,
  Terminal,
  Camera,
  FolderOpen,
  Play,
  Square,
  ShieldCheck,
  Palette,
  X,
} from "lucide-react"

export interface ContextMenuTarget {
  type: "part" | "wire" | "canvas"
  id?: string | null
}

interface Props {
  x: number
  y: number
  target: ContextMenuTarget
  partName?: string
  running: boolean
  activeWireColor?: string
  onClose: () => void
  onRotate?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onFitToScreen?: () => void
  onOpenPalette?: () => void
  onOpenTemplates?: () => void
  onToggleSerial?: () => void
  onToggleAiCamera?: () => void
  onSwitchToCode?: () => void
  onToggleRun?: () => void
  onClearCanvas?: () => void
  onChangeWireColor?: (color: string) => void
}

const WIRE_COLORS = [
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Yellow", value: "#eab308" },
  { label: "Purple", value: "#a855f7" },
  { label: "Black / GND", value: "#1e293b" },
  { label: "Orange", value: "#f97316" },
]

export function ContextMenu({
  x,
  y,
  target,
  partName,
  running,
  activeWireColor,
  onClose,
  onRotate,
  onDuplicate,
  onDelete,
  onFitToScreen,
  onOpenPalette,
  onOpenTemplates,
  onToggleSerial,
  onToggleAiCamera,
  onSwitchToCode,
  onToggleRun,
  onClearCanvas,
  onChangeWireColor,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Keep menu inside viewport boundaries
  const menuWidth = 240
  const menuHeight = target.type === "part" ? 340 : target.type === "wire" ? 280 : 360
  const posX = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - menuWidth - 10)
  const posY = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - menuHeight - 10)

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    const timer = setTimeout(() => {
      window.addEventListener("click", handleOutside)
      window.addEventListener("contextmenu", handleOutside)
      window.addEventListener("keydown", handleKey)
    }, 50)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("click", handleOutside)
      window.removeEventListener("contextmenu", handleOutside)
      window.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const action = (fn?: () => void) => {
    if (fn) fn()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      style={{ left: Math.max(10, posX), top: Math.max(10, posY) }}
      className="fixed z-50 w-[240px] rounded-2xl border border-slate-700/80 bg-slate-950/95 p-1.5 text-xs text-slate-200 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Branded Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800/80 mb-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="font-extrabold text-[11px] tracking-wider text-white">PIXIU CIRCUIT LAB</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition"
          aria-label="Close menu"
        >
          <X size={12} />
        </button>
      </div>

      {/* Target Info Badge */}
      {target.type === "part" && (
        <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-300/90 bg-cyan-950/40 rounded-lg border border-cyan-500/20 mb-1 flex items-center justify-between">
          <span className="truncate">{partName || "Component Selected"}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">PART</span>
        </div>
      )}

      {target.type === "wire" && (
        <div className="px-2.5 py-1 text-[10px] font-mono text-amber-300/90 bg-amber-950/40 rounded-lg border border-amber-500/20 mb-1 flex items-center justify-between">
          <span>Jumper Wire</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-400">WIRE</span>
        </div>
      )}

      <div className="space-y-0.5">
        {/* Component Actions */}
        {target.type === "part" && (
          <>
            <button
              onClick={() => action(onRotate)}
              disabled={running}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <RotateCw size={13} className="text-cyan-400" />
                <span>Rotate 90°</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">R</span>
            </button>

            <button
              onClick={() => action(onDuplicate)}
              disabled={running}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <Copy size={13} className="text-blue-400" />
                <span>Duplicate</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">D</span>
            </button>

            <button
              onClick={() => action(onDelete)}
              disabled={running}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-slate-200 hover:text-red-300 transition cursor-pointer disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <Trash2 size={13} className="text-red-400" />
                <span>Delete Component</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Del</span>
            </button>

            <div className="my-1 border-t border-slate-800/80" />
          </>
        )}

        {/* Wire Actions */}
        {target.type === "wire" && (
          <>
            <div className="px-2.5 py-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                <Palette size={11} />
                <span>Change Wire Color</span>
              </div>
              <div className="flex items-center gap-1.5 py-0.5">
                {WIRE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => action(() => onChangeWireColor?.(c.value))}
                    className={`h-4 w-4 rounded-full transition cursor-pointer border ${
                      activeWireColor === c.value ? "ring-2 ring-cyan-400 scale-110 border-white" : "border-slate-700 hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => action(onDelete)}
              disabled={running}
              className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-slate-200 hover:text-red-300 transition cursor-pointer disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                <Trash2 size={13} className="text-red-400" />
                <span>Delete Wire</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Del</span>
            </button>

            <div className="my-1 border-t border-slate-800/80" />
          </>
        )}

        {/* General Canvas & Workspace Actions */}
        <button
          onClick={() => action(onOpenPalette)}
          disabled={running}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer disabled:opacity-40"
        >
          <PlusCircle size={13} className="text-emerald-400" />
          <span>Add Component...</span>
        </button>

        <button
          onClick={() => action(onFitToScreen)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <Maximize2 size={13} className="text-sky-400" />
          <span>Fit / Center Canvas</span>
        </button>

        <button
          onClick={() => action(onToggleRun)}
          className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {running ? (
              <>
                <Square size={13} className="text-amber-400 fill-amber-400" />
                <span>Stop Simulation</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-400 fill-emerald-400" />
                <span>Run Simulation</span>
              </>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-500">Space</span>
        </button>

        <button
          onClick={() => action(onSwitchToCode)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <Code2 size={13} className="text-purple-400" />
          <span>View Blockly Code</span>
        </button>

        <button
          onClick={() => action(onToggleAiCamera)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <Camera size={13} className="text-purple-400" />
          <span>AI Vision Camera</span>
        </button>

        <button
          onClick={() => action(onToggleSerial)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <Terminal size={13} className="text-amber-400" />
          <span>Serial Monitor</span>
        </button>

        <button
          onClick={() => action(onOpenTemplates)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-slate-200 transition cursor-pointer"
        >
          <FolderOpen size={13} className="text-indigo-400" />
          <span>Project Templates</span>
        </button>

        {target.type === "canvas" && (
          <button
            onClick={() => action(onClearCanvas)}
            disabled={running}
            className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-slate-300 hover:text-red-300 transition cursor-pointer disabled:opacity-40"
          >
            <Trash2 size={13} className="text-red-400" />
            <span>Clear Canvas</span>
          </button>
        )}
      </div>

      {/* Security Environment Banner */}
      <div className="mt-1.5 px-2.5 py-1.5 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-center gap-2">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-300 leading-none truncate">Pixiu Protected Environment</p>
          <p className="text-[9px] text-slate-500 mt-0.5 leading-none truncate">Inspection & DevTools locked</p>
        </div>
      </div>
    </div>
  )
}
