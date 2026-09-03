"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PartType, PinRef, PlacedPart, Wire } from "@/lib/circuit-types"
import { CATALOG, PIN_KIND_COLOR } from "@/lib/components-catalog"
import { getPinRefPosition, wirePath } from "@/lib/geometry"
import { PartArt, type PartRuntime } from "./part-art"

interface View {
  scale: number
  tx: number
  ty: number
}

interface Props {
  parts: PlacedPart[]
  wires: Wire[]
  selectedId: string | null
  tool: "select" | "wire"
  wiring: PinRef | null
  runtime: Record<string, PartRuntime>
  running: boolean
  onSelect: (id: string | null) => void
  onMovePart: (id: string, x: number, y: number) => void
  onPinDown: (ref: PinRef) => void
  onCancelWire: () => void
  onDeleteWire: (id: string) => void
  onDropPart: (type: PartType, x: number, y: number) => void
  onInteract: (id: string, active: boolean) => void
}

export function CircuitCanvas(props: Props) {
  const {
    parts,
    wires,
    selectedId,
    tool,
    wiring,
    runtime,
    running,
    onSelect,
    onMovePart,
    onPinDown,
    onCancelWire,
    onDeleteWire,
    onDropPart,
    onInteract,
  } = props

  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 120, ty: 90 })
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [hoverPin, setHoverPin] = useState<string | null>(null)

  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null)
  const panRef = useRef<{ sx: number; sy: number; tx: number; ty: number } | null>(null)

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - view.tx) / view.scale,
        y: (clientY - rect.top - view.ty) / view.scale,
      }
    },
    [view],
  )

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const scale = Math.min(2.5, Math.max(0.3, v.scale * factor))
      const k = scale / v.scale
      return {
        scale,
        tx: mx - (mx - v.tx) * k,
        ty: my - (my - v.ty) * k,
      }
    })
  }, [])

  const onSvgPointerDown = (e: React.PointerEvent) => {
    // background: pan + deselect
    if (wiring) {
      onCancelWire()
      return
    }
    panRef.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty }
    svgRef.current?.setPointerCapture(e.pointerId)
    onSelect(null)
  }

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY)
    if (wiring) setCursor(w)

    if (dragRef.current) {
      const d = dragRef.current
      const snap = (n: number) => Math.round(n / 8) * 8
      onMovePart(d.id, snap(w.x - d.offX), snap(w.y - d.offY))
      return
    }
    if (panRef.current) {
      const p = panRef.current
      setView((v) => ({ ...v, tx: p.tx + (e.clientX - p.sx), ty: p.ty + (e.clientY - p.sy) }))
    }
  }

  const endInteraction = (e: React.PointerEvent) => {
    dragRef.current = null
    panRef.current = null
    try {
      svgRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const startPartDrag = (e: React.PointerEvent, part: PlacedPart) => {
    if (tool !== "select" || running) return
    e.stopPropagation()
    const w = toWorld(e.clientX, e.clientY)
    dragRef.current = { id: part.id, offX: w.x - part.x, offY: w.y - part.y }
    svgRef.current?.setPointerCapture(e.pointerId)
    onSelect(part.id)
  }

  const onPinPointerDown = (e: React.PointerEvent, ref: PinRef) => {
    e.stopPropagation()
    if (running) return
    onPinDown(ref)
  }

  // keyboard: escape cancels wiring
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelWire()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancelWire])

  const wiringPos = wiring ? getPinRefPosition(wiring, parts) : null

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-background"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const type = e.dataTransfer.getData("application/x-part") as PartType
        if (!type || !CATALOG[type]) return
        const w = toWorld(e.clientX, e.clientY)
        const def = CATALOG[type]
        onDropPart(type, Math.round(w.x - def.width / 2), Math.round(w.y - def.height / 2))
      }}
    >
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        style={{ cursor: wiring ? "crosshair" : panRef.current ? "grabbing" : "default" }}
        onWheel={handleWheel}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
      >
        <defs>
          <pattern id="grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--color-border)" strokeWidth={1} opacity={0.5} />
          </pattern>
          <pattern id="grid-lg" width={120} height={120} patternUnits="userSpaceOnUse">
            <path d="M 120 0 L 0 0 0 120" fill="none" stroke="var(--color-border)" strokeWidth={1.5} opacity={0.6} />
          </pattern>
        </defs>

        <rect x={0} y={0} width="100%" height="100%" fill="url(#grid)" />
        <rect x={0} y={0} width="100%" height="100%" fill="url(#grid-lg)" />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {/* wires */}
          {wires.map((wire) => {
            const a = getPinRefPosition(wire.from, parts)
            const b = getPinRefPosition(wire.to, parts)
            if (!a || !b) return null
            return (
              <g key={wire.id} className="group">
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke={wire.color}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  opacity={0.92}
                />
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (!running) onDeleteWire(wire.id)
                  }}
                >
                  <title>Click to delete wire</title>
                </path>
              </g>
            )
          })}

          {/* temp wire */}
          {wiringPos && cursor && (
            <path
              d={wirePath(wiringPos, cursor)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={3}
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
          )}

          {/* parts */}
          {parts.map((part) => {
            const def = CATALOG[part.type]
            const selected = part.id === selectedId
            const interactive = running && (part.type === "pushbutton" || part.type === "potentiometer")
            return (
              <g key={part.id} transform={`translate(${part.x} ${part.y})`}>
                <g transform={`rotate(${part.rotation} ${def.width / 2} ${def.height / 2})`}>
                  {selected && (
                    <rect
                      x={-6}
                      y={-6}
                      width={def.width + 12}
                      height={def.height + 12}
                      rx={8}
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                  )}
                  <g
                    onPointerDown={(e) => (interactive ? undefined : startPartDrag(e, part))}
                    onPointerUp={() => interactive && onInteract(part.id, false)}
                    onPointerLeave={() => interactive && onInteract(part.id, false)}
                    style={{ cursor: running ? (interactive ? "pointer" : "default") : "grab" }}
                  >
                    {/* hit area */}
                    <rect x={0} y={0} width={def.width} height={def.height} fill="transparent" />
                    <PartArt part={part} runtime={runtime[part.id]} />
                    {interactive && part.type === "pushbutton" && (
                      <rect
                        x={0}
                        y={0}
                        width={def.width}
                        height={def.height}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onInteract(part.id, true)
                        }}
                      />
                    )}
                  </g>

                  {/* pins */}
                  {def.pins.map((pin) => {
                    const key = `${part.id}:${pin.id}`
                    const isWiringStart = wiring && wiring.partId === part.id && wiring.pinId === pin.id
                    return (
                      <g key={pin.id}>
                        <circle
                          cx={pin.x}
                          cy={pin.y}
                          r={hoverPin === key ? 6 : 4}
                          fill={PIN_KIND_COLOR[pin.kind]}
                          stroke={isWiringStart ? "var(--color-primary)" : "var(--color-background)"}
                          strokeWidth={1.5}
                          className={running ? "" : "cursor-crosshair"}
                          onPointerDown={(e) => onPinPointerDown(e, { partId: part.id, pinId: pin.id })}
                          onPointerEnter={() => setHoverPin(key)}
                          onPointerLeave={() => setHoverPin((h) => (h === key ? null : h))}
                        >
                          <title>{`${def.name} · ${pin.label}`}</title>
                        </circle>
                        {hoverPin === key && (
                          <text
                            x={pin.x}
                            y={pin.y - 9}
                            textAnchor="middle"
                            fontSize={9}
                            fill="var(--color-foreground)"
                            fontFamily="monospace"
                            className="pointer-events-none"
                          >
                            {pin.label}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              </g>
            )
          })}
        </g>
      </svg>

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col overflow-hidden rounded-md border border-border bg-card/90 backdrop-blur">
        <button
          className="px-3 py-1.5 text-lg leading-none text-foreground hover:bg-secondary"
          onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.15) }))}
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="border-t border-border px-3 py-1 text-center font-mono text-[10px] text-muted-foreground">
          {Math.round(view.scale * 100)}%
        </div>
        <button
          className="border-t border-border px-3 py-1.5 text-lg leading-none text-foreground hover:bg-secondary"
          onClick={() => setView((v) => ({ ...v, scale: Math.max(0.3, v.scale / 1.15) }))}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {parts.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-pretty text-center font-mono text-sm text-muted-foreground">
            Drag a component from the left panel onto the canvas to begin.
          </p>
        </div>
      )}
    </div>
  )
}
