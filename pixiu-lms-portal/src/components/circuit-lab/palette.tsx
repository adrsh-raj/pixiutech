"use client"

import React, { useState, useMemo } from "react"
import type { PartType } from "@/lib/circuit-types"
import { CATALOG, PALETTE_ORDER } from "@/lib/components-catalog"
import { COMPONENT_GROUPS, getComponentMeta } from "@/lib/component-registry"
import { PartArt } from "./part-art"
import { Search, X } from "lucide-react"

export interface WireColorOption {
  name: string
  color: string
}

export const WIRE_COLOR_OPTIONS: WireColorOption[] = [
  { name: "Green", color: "#22c55e" },
  { name: "Red (5V)", color: "#ef4444" },
  { name: "Black (GND)", color: "#1e293b" },
  { name: "Yellow", color: "#eab308" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Orange", color: "#f97316" },
  { name: "White", color: "#f8fafc" },
  { name: "Purple", color: "#a855f7" },
]

/** A scaled, non-interactive thumbnail of a part for the palette. */
function Thumb({ type }: { type: PartType }) {
  const def = CATALOG[type]
  if (!def) return null
  const box = 56
  const scale = Math.min(box / def.width, box / def.height) * 0.92
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className="h-14 w-14 shrink-0">
      <g transform={`translate(${(box - def.width * scale) / 2} ${(box - def.height * scale) / 2}) scale(${scale})`}>
        <PartArt part={{ id: "thumb", type, x: 0, y: 0, rotation: 0, props: def.defaults ?? {} }} />
      </g>
    </svg>
  )
}

function WireThumb({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0">
      <rect x="4" y="4" width="48" height="48" rx="8" fill="#090d16" stroke="#1e293b" strokeWidth="1" />
      {/* Wire loop */}
      <path
        d="M 12 38 C 16 12, 40 44, 44 18"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Dupont connector pin A */}
      <rect x="9" y="35" width="6" height="6" rx="1" fill="#64748b" />
      <line x1="8" y1="43" x2="12" y2="43" stroke="#94a3b8" strokeWidth="1.5" />
      {/* Dupont connector pin B */}
      <rect x="41" y="15" width="6" height="6" rx="1" fill="#64748b" />
      <line x1="44" y1="13" x2="48" y2="13" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  )
}

function MultimeterThumb() {
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0">
      {/* Rugged Outer Yellow Bumper */}
      <rect x="10" y="4" width="36" height="48" rx="6" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2" />
      {/* Dark Inner Face */}
      <rect x="13" y="7" width="30" height="42" rx="4" fill="#090d16" />
      {/* 7-Segment LCD Display */}
      <rect x="16" y="10" width="24" height="12" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      <text x="28" y="19" textAnchor="middle" fill="#fde047" fontSize="7" fontFamily="monospace" fontWeight="bold">
        5.00V
      </text>
      {/* Rotary Selection Dial */}
      <circle cx="28" cy="30" r="6" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      <line x1="28" y1="26" x2="28" y2="30" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      {/* Probe Input Jacks */}
      <circle cx="20" cy="42" r="2.2" fill="#090d16" stroke="#ef4444" strokeWidth="1.2" />
      <circle cx="28" cy="42" r="2.2" fill="#090d16" stroke="#94a3b8" strokeWidth="1.2" />
      <circle cx="36" cy="42" r="2.2" fill="#090d16" stroke="#ef4444" strokeWidth="1.2" />
    </svg>
  )
}

function OscilloscopeThumb() {
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0">
      {/* Scope Chassis */}
      <rect x="6" y="6" width="44" height="44" rx="6" fill="#0b1120" stroke="#1e293b" strokeWidth="1.2" />
      {/* CRT Screen */}
      <rect x="10" y="10" width="36" height="26" rx="3" fill="#022c22" stroke="#065f46" strokeWidth="1" />
      {/* Phosphor Grid */}
      <line x1="10" y1="23" x2="46" y2="23" stroke="#047857" strokeWidth="0.5" strokeDasharray="1 2" />
      <line x1="28" y1="10" x2="28" y2="36" stroke="#047857" strokeWidth="0.5" strokeDasharray="1 2" />
      {/* CH1 Waveform (Yellow square/PWM) */}
      <path d="M 12 30 L 18 30 L 18 16 L 24 16 L 24 30 L 30 30 L 30 16 L 36 16 L 36 30 L 44 30" fill="none" stroke="#facc15" strokeWidth="1.4" />
      {/* CH2 Waveform (Cyan) */}
      <path d="M 12 24 Q 18 17 24 24 T 36 24 T 44 24" fill="none" stroke="#06b6d4" strokeWidth="1.2" opacity="0.85" />
      {/* Controls / BNC jacks */}
      <circle cx="16" cy="43" r="3" fill="#1e293b" stroke="#facc15" strokeWidth="1.2" />
      <circle cx="26" cy="43" r="3" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.2" />
      <rect x="34" y="41" width="12" height="4" rx="2" fill="#334155" />
    </svg>
  )
}

function IotThumb() {
  return (
    <svg viewBox="0 0 56 56" className="h-10 w-10">
      <rect x="6" y="8" width="44" height="40" rx="6" fill="#0f172a" stroke="#0284c7" strokeWidth="1.5" />
      <rect x="6" y="8" width="44" height="12" rx="4" fill="#0369a1" />
      <circle cx="12" cy="14" r="2" fill="#f87171" />
      <circle cx="18" cy="14" r="2" fill="#facc15" />
      <circle cx="24" cy="14" r="2" fill="#4ade80" />
      <rect x="30" y="11" width="16" height="6" rx="2" fill="#0c4a6e" />
      {/* Wi-Fi Waves */}
      <path d="M 18 36 A 12 12 0 0 1 38 36" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M 22 40 A 7 7 0 0 1 34 40" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="28" cy="43" r="2" fill="#38bdf8" />
    </svg>
  )
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "controller", label: "Boards" },
  { id: "basic", label: "Build" },
  { id: "input", label: "Input" },
  { id: "sensor", label: "Sensors" },
  { id: "output", label: "Output" },
  { id: "display", label: "Displays" },
  { id: "motor", label: "Motion" },
  { id: "driver", label: "Drivers" },
] as const

interface Props {
  onQuickAdd: (type: PartType) => void
  isOpen?: boolean
  onClose?: () => void
  isDmmOpen?: boolean
  onToggleDmm?: () => void
  isScopeOpen?: boolean
  onToggleScope?: () => void
  isIotOpen?: boolean
  onToggleIot?: () => void
  wifiRunning?: boolean
  activeWireColor?: string
  onSelectWireColor?: (color: string) => void
}

export function Palette({
  onQuickAdd,
  isOpen = false,
  onClose,
  isDmmOpen = false,
  onToggleDmm,
  isScopeOpen = false,
  onToggleScope,
  isIotOpen = false,
  onToggleIot,
  wifiRunning = false,
  activeWireColor = "#22c55e",
  onSelectWireColor,
}: Props) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const onDragStart = (e: React.DragEvent, type: PartType) => {
    e.dataTransfer.setData("application/x-part", type)
    e.dataTransfer.effectAllowed = "copy"
  }

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return PALETTE_ORDER.filter((type) => {
      const def = CATALOG[type]
      const meta = getComponentMeta(type)
      if (!def || !meta) return false
      const matchesSearch =
        !query ||
        def.name.toLowerCase().includes(query) ||
        def.blurb.toLowerCase().includes(query) ||
        meta.educational.concept.toLowerCase().includes(query)
      const matchesCategory =
        activeCategory === "all" || meta.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

  const showTools = activeCategory === "all" || activeCategory === "basic"

  const matchesWireSearch =
    !search ||
    "jumper wire cable connection color".toLowerCase().includes(search.toLowerCase())

  const matchesDmmSearch =
    !search ||
    "digital multimeter dmm voltage current resistance continuity tester probe meter".toLowerCase().includes(search.toLowerCase())

  const matchesScopeSearch =
    !search ||
    "oscilloscope scope logic waveform grapher signal analyzer pwm frequency voltage crt".toLowerCase().includes(search.toLowerCase())

  const matchesIotSearch =
    !search ||
    "wifi wi-fi web server iot browser http internet esp32 smart home".toLowerCase().includes(search.toLowerCase())

  const activeColorObj = WIRE_COLOR_OPTIONS.find((c) => c.color === activeWireColor)

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-xs z-30 md:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 md:z-10 flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header & Search */}
        <div className="border-b border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Components ({PALETTE_ORDER.length + 3})
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary cursor-pointer"
                title="Close Components"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parts, multimeter, scope, wire..."
              className="w-full bg-background border border-border rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Category Pills */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition shrink-0 cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Component List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* 1. Digital Multimeter Component in Palette */}
          {showTools && matchesDmmSearch && (
            <div
              onClick={onToggleDmm}
              className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                isDmmOpen
                  ? "border-amber-500/60 bg-amber-500/10 shadow-xs"
                  : "border-transparent hover:border-border hover:bg-secondary/70"
              }`}
              title={isDmmOpen ? "Multimeter is active on canvas (Click to close)" : "Open Digital Multimeter on canvas"}
            >
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                <MultimeterThumb />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="block truncate font-bold text-xs text-foreground group-hover:text-primary transition">
                    Digital Multimeter
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase font-mono ${
                      isDmmOpen
                        ? "bg-amber-500/25 text-amber-300 border border-amber-500/50"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isDmmOpen ? "Active" : "Open"}
                  </span>
                </span>
                <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                  Measure DC Voltage, Current, Resistance & Continuity with test probes.
                </span>
              </span>
            </div>
          )}

          {/* 2. Mini Oscilloscope & Logic Waveform Grapher in Palette */}
          {showTools && matchesScopeSearch && (
            <div
              onClick={onToggleScope}
              className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                isScopeOpen
                  ? "border-cyan-500/60 bg-cyan-500/10 shadow-xs"
                  : "border-transparent hover:border-border hover:bg-secondary/70"
              }`}
              title={isScopeOpen ? "Oscilloscope is active on canvas (Click to close)" : "Open Mini Oscilloscope on canvas"}
            >
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                <OscilloscopeThumb />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="block truncate font-bold text-xs text-foreground group-hover:text-primary transition">
                    Oscilloscope (Dual Ch)
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase font-mono ${
                      isScopeOpen
                        ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/50"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isScopeOpen ? "Active" : "Open"}
                  </span>
                </span>
                <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                  Dual-channel real-time signal grapher for PWM, digital clock pulses & analog voltages.
                </span>
              </span>
            </div>
          )}

          {/* 3. Virtual Wi-Fi & Web Browser in Palette */}
          {showTools && matchesIotSearch && (
            <div
              onClick={onToggleIot}
              className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all cursor-pointer ${
                isIotOpen
                  ? "border-sky-500/60 bg-sky-500/10 shadow-xs"
                  : "border-transparent hover:border-border hover:bg-secondary/70"
              }`}
              title={isIotOpen ? "IoT Web Browser is active (Click to close)" : "Open Virtual IoT Web Browser"}
            >
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                <IotThumb />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="block truncate font-bold text-xs text-foreground group-hover:text-primary transition">
                    IoT Web Browser
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase font-mono ${
                      wifiRunning
                        ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50"
                        : isIotOpen
                        ? "bg-sky-500/25 text-sky-300 border border-sky-500/50"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {wifiRunning ? "Live :80" : isIotOpen ? "Active" : "Open"}
                  </span>
                </span>
                <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                  Virtual 192.168.1.105 web browser & HTTP traffic inspector for ESP32 IoT projects.
                </span>
              </span>
            </div>
          )}

          {/* 4. Jumper Wires Tool in Palette */}
          {showTools && matchesWireSearch && (
            <div className="rounded-xl border border-border/80 bg-card/60 p-2.5 space-y-2 hover:border-primary/40 transition">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                  <WireThumb color={activeWireColor} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="block truncate font-bold text-xs text-foreground">Jumper Wire</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {activeColorObj?.name ?? "Active"}
                    </span>
                  </div>
                  <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                    Click any pin on Arduino or breadboard to connect wire.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/60">
                <span className="text-[9px] font-mono uppercase text-muted-foreground mr-0.5">Color:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {WIRE_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.color}
                      onClick={() => onSelectWireColor?.(c.color)}
                      title={c.name}
                      className={`h-4 w-4 rounded-full transition-all cursor-pointer ${
                        activeWireColor === c.color
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-card scale-110"
                          : "hover:scale-110 opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grouped hardware library */}
          {filteredParts.length === 0 && (!showTools || (!matchesWireSearch && !matchesDmmSearch)) ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No components match "{search}"
            </div>
          ) : (
            <div className="space-y-2">
              {COMPONENT_GROUPS.map((group) => {
                const groupParts = filteredParts.filter((type) => getComponentMeta(type).category === group.id)
                if (groupParts.length === 0) return null
                return (
                  <details key={group.id} open={Boolean(search) || activeCategory !== "all"} className="rounded-xl border border-border/70 bg-card/35 overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-secondary/50">
                      <span className="flex items-center gap-1.5">
                        <span className="text-primary">{group.icon}</span>
                        {group.label}
                      </span>
                      <span className="rounded-full bg-background px-1.5 py-0.5 font-mono text-[9px]">{groupParts.length}</span>
                    </summary>
                    <div className="space-y-0.5 border-t border-border/60 p-1.5">
                      {groupParts.map((type) => {
                        const def = CATALOG[type]
                        return (
                          <button
                            key={type}
                            draggable
                            onDragStart={(e) => onDragStart(e, type)}
                            onClick={() => onQuickAdd(type)}
                            className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition-all hover:border-border hover:bg-secondary/70 cursor-grab active:cursor-grabbing"
                          >
                            <span className="grid h-11 w-11 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                              <Thumb type={type} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-[11px] text-foreground group-hover:text-primary transition">
                                {def.name}
                              </span>
                              <span className="block text-[9px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                                {def.blurb}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
