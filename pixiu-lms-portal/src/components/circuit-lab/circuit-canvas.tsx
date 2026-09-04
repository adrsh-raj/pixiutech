"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PartType, PinRef, PlacedPart, Wire } from "@/lib/circuit-types"
import { CATALOG, PIN_KIND_COLOR } from "@/lib/components-catalog"
import { getPinRefPosition, wirePath } from "@/lib/geometry"
import { PartArt, type PartRuntime } from "./part-art"
import { Maximize2, Plus, Minus } from "lucide-react"

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
  onDeleteWire: (id: string) => void
  onDropPart: (type: PartType, x: number, y: number) => void
  onInteract: (id: string, active: boolean) => void
  selectedWireId?: string | null
  onSelectWire?: (id: string | null) => void
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
    selectedWireId,
    onSelectWire,
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

  const fitToScreen = useCallback(() => {
    if (!parts.length || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of parts) {
      const def = CATALOG[p.type]
      const w = def?.width || 100
      const h = def?.height || 100
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + w)
      maxY = Math.max(maxY, p.y + h)
    }
    const padding = 28
    const boundsW = Math.max(100, maxX - minX + padding * 2)
    const boundsH = Math.max(100, maxY - minY + padding * 2)
    const scale = Math.min(rect.width / boundsW, rect.height / boundsH)
    const finalScale = Math.max(0.3, Math.min(scale, 1.0))
    const tx = (rect.width - (maxX - minX) * finalScale) / 2 - minX * finalScale
    const ty = (rect.height - (maxY - minY) * finalScale) / 2 - minY * finalScale
    setView({ scale: finalScale, tx, ty })
  }, [parts])

  const initialFitDone = useRef(false)
  useEffect(() => {
    if (!initialFitDone.current && parts.length > 0) {
      const timer = setTimeout(() => {
        fitToScreen()
        initialFitDone.current = true
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [parts.length, fitToScreen])

  const onSvgPointerDown = (e: React.PointerEvent) => {
    // background: pan + deselect
    if (wiring) {
      onCancelWire()
      return
    }
    panRef.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty }
    svgRef.current?.setPointerCapture(e.pointerId)
    onSelect(null)
    onSelectWire?.(null)
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
          {/* 1. Component Bodies (CHASSIS & ARTWORK) */}
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
                </g>
              </g>
            )
          })}

          {/* 2. Wires Layer (ON TOP OF COMPONENTS - NEVER COVERED BY BOARDS!) */}
          {wires.map((wire) => {
            const a = getPinRefPosition(wire.from, parts)
            const b = getPinRefPosition(wire.to, parts)
            if (!a || !b) return null
            const isSelected = selectedWireId === wire.id
            return (
              <g key={wire.id} className="group">
                {/* Active selection glow */}
                {isSelected && (
                  <path
                    d={wirePath(a, b)}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray="6 5"
                    opacity={0.9}
                  />
                )}
                {/* Depth drop shadow */}
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                  transform="translate(0, 1.5)"
                />
                {/* Core wire path */}
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke={wire.color}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  opacity={0.98}
                />
                {/* Wire terminal dots */}
                <circle cx={a.x} cy={a.y} r={3} fill={wire.color} stroke="#ffffff" strokeWidth={1} />
                <circle cx={b.x} cy={b.y} r={3} fill={wire.color} stroke="#ffffff" strokeWidth={1} />
                {/* Hit area */}
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (!running) {
                      onSelect(null)
                      onSelectWire?.(wire.id)
                    }
                  }}
                >
                  <title>Click to select wire (Delete key to remove)</title>
                </path>
              </g>
            )
          })}

          {/* 3. Temp Wire being dragged */}
          {wiringPos && cursor && (
            <path
              d={wirePath(wiringPos, cursor)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={3.5}
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
          )}

          {/* 4. Interactive Pins (TOPMOST - NEVER BLOCKED BY WIRES) */}
          {parts.map((part) => {
            const def = CATALOG[part.type]
            return (
              <g key={`pins-${part.id}`} transform={`translate(${part.x} ${part.y})`}>
                <g transform={`rotate(${part.rotation} ${def.width / 2} ${def.height / 2})`}>
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
                            className="pointer-events-none font-bold"
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

      {/* Overcurrent Burnout Alert */}
      {Object.values(runtime).some((r) => r?.burnt) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950/95 border-2 border-red-500 text-red-100 px-4 py-2.5 rounded-2xl text-xs shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-3 z-30 max-w-lg">
          <span className="text-2xl animate-bounce">💥</span>
          <div className="leading-snug">
            <div className="font-bold text-red-300 text-[13px] flex items-center gap-1.5">
              <span>LED Burned Out from Overcurrent!</span>
            </div>
            <div className="text-slate-300 text-[11px] mt-0.5">
              Direct connection without a current-limiting resistor delivers excessive current (&gt;100 mA).
              <span className="text-amber-300 font-semibold ml-1">Connect a 220Ω resistor in series to protect the LED!</span>
            </div>
          </div>
        </div>
      )}

      {/* Zoom & Fit Controls */}
      <div className="absolute right-3 top-3 md:top-auto md:bottom-6 z-20 flex flex-col overflow-hidden rounded-xl border border-border bg-card/90 backdrop-blur-md shadow-lg">
        <button
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-90 flex items-center justify-center cursor-pointer"
          onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.2) }))}
          title="Zoom In"
          aria-label="Zoom in"
        >
          <Plus size={15} />
        </button>
        <button
          className="border-t border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-90 flex items-center justify-center cursor-pointer"
          onClick={fitToScreen}
          title="Fit to Screen"
          aria-label="Fit to Screen"
        >
          <Maximize2 size={13} />
        </button>
        <button
          className="border-t border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition active:scale-90 flex items-center justify-center cursor-pointer"
          onClick={() => setView((v) => ({ ...v, scale: Math.max(0.25, v.scale / 1.2) }))}
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <Minus size={15} />
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
