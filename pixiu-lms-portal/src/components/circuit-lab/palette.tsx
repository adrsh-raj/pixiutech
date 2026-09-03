"use client"

import React, { useState, useMemo } from "react"
import type { PartType } from "@/lib/circuit-types"
import { CATALOG, PALETTE_ORDER } from "@/lib/components-catalog"
import { PartArt } from "./part-art"
import { Search } from "lucide-react"

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

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "basic", label: "Basic" },
  { id: "outputs", label: "Outputs" },
  { id: "sensors", label: "Sensors" },
] as const

const PART_CATEGORIES: Record<string, string> = {
  "arduino-uno": "basic",
  "breadboard": "basic",
  "resistor": "basic",
  "pushbutton": "basic",
  "potentiometer": "basic",
  "battery": "basic",
  "npn-transistor": "basic",
  "led": "outputs",
  "rgb-led": "outputs",
  "seven-segment": "outputs",
  "lcd-i2c": "outputs",
  "buzzer": "outputs",
  "servo": "outputs",
  "dc-motor": "outputs",
  "relay": "outputs",
  "ultrasonic": "sensors",
  "pir-sensor": "sensors",
  "ldr": "sensors",
  "tmp36": "sensors",
}

interface Props {
  onQuickAdd: (type: PartType) => void
  isOpen?: boolean
  onClose?: () => void
}

export function Palette({ onQuickAdd, isOpen = false, onClose }: Props) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const onDragStart = (e: React.DragEvent, type: PartType) => {
    e.dataTransfer.setData("application/x-part", type)
    e.dataTransfer.effectAllowed = "copy"
  }

  const filteredParts = useMemo(() => {
    return PALETTE_ORDER.filter((type) => {
      const def = CATALOG[type]
      if (!def) return false
      const matchesSearch =
        def.name.toLowerCase().includes(search.toLowerCase()) ||
        def.blurb.toLowerCase().includes(search.toLowerCase())
      const matchesCategory =
        activeCategory === "all" || PART_CATEGORIES[type] === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [search, activeCategory])

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
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Components ({PALETTE_ORDER.length})</h2>
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
            placeholder="Search parts (e.g. sensor, led)..."
            className="w-full bg-background border border-border rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition shrink-0 ${
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
      <div className="flex-1 overflow-y-auto p-2">
        {filteredParts.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No components match "{search}"
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {filteredParts.map((type) => {
              const def = CATALOG[type]
              return (
                <li key={type}>
                  <button
                    draggable
                    onDragStart={(e) => onDragStart(e, type)}
                    onClick={() => onQuickAdd(type)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-all hover:border-border hover:bg-secondary/70 cursor-grab active:cursor-grabbing"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-lg bg-background/80 ring-1 ring-border shadow-xs shrink-0">
                      <Thumb type={type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-xs text-foreground group-hover:text-primary transition">
                        {def.name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {def.blurb}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  </>
)
}
