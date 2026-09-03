"use client"

import type React from "react"
import type { PartType } from "@/lib/circuit-types"
import { CATALOG, PALETTE_ORDER } from "@/lib/components-catalog"
import { PartArt } from "./part-art"

/** A scaled, non-interactive thumbnail of a part for the palette. */
function Thumb({ type }: { type: PartType }) {
  const def = CATALOG[type]
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

export function Palette({ onQuickAdd }: { onQuickAdd: (type: PartType) => void }) {
  const onDragStart = (e: React.DragEvent, type: PartType) => {
    e.dataTransfer.setData("application/x-part", type)
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Components</h2>
        <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground/70">
          Drag onto the canvas or click to add.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1.5">
          {PALETTE_ORDER.map((type) => {
            const def = CATALOG[type]
            return (
              <li key={type}>
                <button
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  onClick={() => onQuickAdd(type)}
                  className="group flex w-full items-center gap-3 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-secondary"
                >
                  <span className="grid h-14 w-14 place-items-center rounded bg-background/60 ring-1 ring-border">
                    <Thumb type={type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-sm text-foreground">{def.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{def.blurb}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
