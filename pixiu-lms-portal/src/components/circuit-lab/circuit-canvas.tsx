"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { PartType, PinRef, PlacedPart, Wire, PinKind } from "@/lib/circuit-types"
import { CATALOG, PIN_KIND_COLOR } from "@/lib/components-catalog"
import { getBoardDefinition } from "@/lib/board-registry"
import { getPinRefPosition, wirePath } from "@/lib/geometry"
import { PartArt, type PartRuntime } from "./part-art"
import { SchematicPartArt } from "./schematic-art"
import { Maximize2, Plus, Minus } from "lucide-react"
import type { ContextMenuTarget } from "./context-menu"
import type { WireCurrentState } from "@/lib/current-flow"

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
  wireCurrents?: Record<string, WireCurrentState>
  probeRed?: PinRef | null
  probeBlack?: PinRef | null
  activeProbeToPlace?: "red" | "black" | null
  onProbeClip?: (ref: PinRef) => void
  scopeProbeCH1?: PinRef | null
  scopeProbeCH2?: PinRef | null
  activeScopeProbeToPlace?: "ch1" | "ch2" | null
  onScopeProbeClip?: (ref: PinRef) => void
  onSelect: (id: string | null) => void
  onMovePart: (id: string, x: number, y: number) => void
  onPinDown: (ref: PinRef) => void
  onCancelWire: () => void
  onDeleteWire: (id: string) => void
  onDropPart: (type: PartType, x: number, y: number) => void
  onInteract: (id: string, active: boolean) => void
  selectedWireId?: string | null
  onSelectWire?: (id: string | null) => void
  onCanvasContextMenu?: (e: React.MouseEvent, target: ContextMenuTarget) => void
  onChangeProp?: (id: string, prop: string, value: unknown) => void
  viewMode?: "physical" | "schematic"
  highlightPartIds?: string[]
  onResetMcu?: () => void
  isScopeOpen?: boolean
  activeWireColor?: string
}

function getPinDisplayInfo(type: PartType, pinId: string): { label: string; kind: PinKind; details?: string } {
  const boardDef = getBoardDefinition(type)
  if (boardDef) {
    const bp = boardDef.pins.find((p) => p.id === pinId)
    if (bp) {
      const tags: string[] = []
      if (bp.capabilities?.builtInLed) tags.push("LED")
      if (bp.capabilities?.touch) tags.push("Touch")
      if (bp.capabilities?.dac) tags.push("DAC")
      if (bp.capabilities?.adc) tags.push("ADC")
      if (bp.capabilities?.pwm) tags.push("PWM")
      if (bp.capabilities?.i2cRole) tags.push(`I2C ${bp.capabilities.i2cRole.toUpperCase()}`)
      if (bp.capabilities?.spiRole) tags.push(`SPI ${bp.capabilities.spiRole.toUpperCase()}`)
      if (bp.capabilities?.uartRole) tags.push(`UART ${bp.capabilities.uartRole.toUpperCase()}`)
      if (bp.capabilities?.inputOnly) tags.push("Input only")
      const details =
        tags.length > 0
          ? tags.join(" · ")
          : bp.alternateNames?.[0] || (bp.kind === "ground" ? "Ground (0V)" : bp.kind === "power" ? `${boardDef.logicVoltage}V Power` : undefined)
      return { label: bp.label, kind: bp.kind, details }
    }
  }
  const def = CATALOG[type]
  const pin = def?.pins.find((p) => p.id === pinId)
  if (!pin) return { label: pinId, kind: "digital" }
  let details: string | undefined
  if (pin.kind === "ground") details = "GND (0V)"
  else if (pin.kind === "power") details = "VCC Power"
  else if (pin.kind === "analog") details = "Analog"
  return { label: pin.label, kind: pin.kind, details }
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
    wireCurrents,
    probeRed,
    probeBlack,
    activeProbeToPlace,
    onProbeClip,
    scopeProbeCH1,
    scopeProbeCH2,
    activeScopeProbeToPlace,
    onScopeProbeClip,
    onSelect,
    onMovePart,
    onPinDown,
    onCancelWire,
    onDeleteWire,
    onDropPart,
    onInteract,
    selectedWireId,
    onSelectWire,
    onCanvasContextMenu,
    onChangeProp,
    viewMode = "physical",
    highlightPartIds = [],
    onResetMcu,
    isScopeOpen = false,
    activeWireColor = "#22c55e",
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

  useEffect(() => {
    const handleFit = () => fitToScreen()
    window.addEventListener("circuit-fit-screen", handleFit)
    return () => window.removeEventListener("circuit-fit-screen", handleFit)
  }, [fitToScreen])

  // Multi-Touch Pinch-to-Zoom & Long-Press Detection for Mobile & Tablet
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const prevPinchDistanceRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null)

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressPosRef.current = null
  }

  const startLongPress = (clientX: number, clientY: number, target: ContextMenuTarget) => {
    clearLongPress()
    longPressPosRef.current = { x: clientX, y: clientY }
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(40)
        } catch {
          /* noop */
        }
      }
      const syntheticEvent = {
        clientX,
        clientY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.MouseEvent
      onCanvasContextMenu?.(syntheticEvent, target)
      clearLongPress()
    }, 450)
  }

  const onSvgPointerDown = (e: React.PointerEvent) => {
    // background: pan + deselect
    if (wiring) {
      onCancelWire()
      return
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Two-finger touch detection: cancel long press and prepare pinch zoom
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values())
      prevPinchDistanceRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      clearLongPress()
      return
    }

    if (e.pointerType === "touch") {
      startLongPress(e.clientX, e.clientY, { type: "canvas" })
    }

    panRef.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty }
    svgRef.current?.setPointerCapture(e.pointerId)
    onSelect(null)
    onSelectWire?.(null)
  }

  const onSvgPointerMove = (e: React.PointerEvent) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    // Cancel long press if moved more than 8 pixels
    if (longPressPosRef.current) {
      const dist = Math.hypot(e.clientX - longPressPosRef.current.x, e.clientY - longPressPosRef.current.y)
      if (dist > 8) clearLongPress()
    }

    // Multi-touch Pinch to Zoom on Tablet / Mobile
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (prevPinchDistanceRef.current && prevPinchDistanceRef.current > 0) {
        const factor = dist / prevPinchDistanceRef.current
        const midX = (pts[0].x + pts[1].x) / 2
        const midY = (pts[0].y + pts[1].y) / 2
        setView((v) => {
          const nextScale = Math.max(0.2, Math.min(3, v.scale * factor))
          const ds = nextScale - v.scale
          return {
            scale: nextScale,
            tx: v.tx - (midX - v.tx) * (ds / v.scale),
            ty: v.ty - (midY - v.ty) * (ds / v.scale),
          }
        })
      }
      prevPinchDistanceRef.current = dist
      return
    }

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
    activePointersRef.current.delete(e.pointerId)
    if (activePointersRef.current.size < 2) {
      prevPinchDistanceRef.current = null
    }
    clearLongPress()
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

    if (e.pointerType === "touch") {
      startLongPress(e.clientX, e.clientY, { type: "part", id: part.id })
    }

    const w = toWorld(e.clientX, e.clientY)
    dragRef.current = { id: part.id, offX: w.x - part.x, offY: w.y - part.y }
    svgRef.current?.setPointerCapture(e.pointerId)
    onSelect(part.id)
  }

  const onPinPointerDown = (e: React.PointerEvent, ref: PinRef) => {
    e.stopPropagation()
    if (activeScopeProbeToPlace) {
      onScopeProbeClip?.(ref)
      return
    }
    if (activeProbeToPlace) {
      onProbeClip?.(ref)
      return
    }
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
      onContextMenu={(e) => {
        e.preventDefault()
        onCanvasContextMenu?.(e, { type: "canvas" })
      }}
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
          {/* Engineering Schematic Blueprint Grid */}
          <pattern id="grid-schematic" width={20} height={20} patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth={0.7} opacity={0.6} />
            <circle cx={20} cy={20} r={0.75} fill="#38bdf8" opacity={0.4} />
          </pattern>
          <pattern id="grid-schematic-lg" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#0369a1" strokeWidth={1} opacity={0.35} />
          </pattern>
        </defs>

        {viewMode === "schematic" && (
          <rect x={0} y={0} width="100%" height="100%" fill="#070c18" />
        )}

        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill={viewMode === "schematic" ? "url(#grid-schematic)" : "url(#grid)"}
          onContextMenu={(e) => {
            e.preventDefault()
            onCanvasContextMenu?.(e, { type: "canvas" })
          }}
        />
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill={viewMode === "schematic" ? "url(#grid-schematic-lg)" : "url(#grid-lg)"}
          onContextMenu={(e) => {
            e.preventDefault()
            onCanvasContextMenu?.(e, { type: "canvas" })
          }}
        />

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {/* 1. Component Bodies (CHASSIS & ARTWORK) */}
          {parts.map((part) => {
            const def = CATALOG[part.type]
            const selected = part.id === selectedId
            const interactive = running && ["pushbutton", "potentiometer", "ir-sensor", "joystick", "rotary-encoder", "keypad-4x4", "microbit-v2"].includes(part.type)
            return (
              <g
                key={part.id}
                transform={`translate(${part.x} ${part.y})`}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onSelect(part.id)
                  onCanvasContextMenu?.(e, { type: "part", id: part.id })
                }}
              >
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

                  {/* AI Circuit Doctor Highlight Beacon */}
                  {highlightPartIds?.includes(part.id) && (
                    <g>
                      <rect
                        x={-10}
                        y={-10}
                        width={def.width + 20}
                        height={def.height + 20}
                        rx={12}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        strokeDasharray="6 4"
                        className="animate-pulse"
                      />
                      <circle cx={def.width + 6} cy={-6} r={7} fill="#f43f5e" className="animate-ping" opacity={0.7} />
                      <circle cx={def.width + 6} cy={-6} r={5} fill="#f43f5e" />
                    </g>
                  )}

                  <g
                    onPointerDown={(e) => (interactive ? undefined : startPartDrag(e, part))}
                    onPointerUp={() => interactive && onInteract(part.id, false)}
                    onPointerLeave={() => interactive && onInteract(part.id, false)}
                    style={{ cursor: running ? (interactive ? "pointer" : "default") : "grab" }}
                  >
                    {/* hit area */}
                    <rect x={0} y={0} width={def.width} height={def.height} fill="transparent" />

                    {/* Artwork Rendering: Physical Breadboard View vs Professional IEEE Schematic */}
                    {viewMode === "schematic" ? (
                      <SchematicPartArt part={part} runtime={runtime[part.id]} />
                    ) : (
                      <PartArt part={part} runtime={runtime[part.id]} />
                    )}

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

                    {interactive && part.type === "microbit-v2" && (
                      <g>
                        <circle
                          cx={50}
                          cy={115}
                          r={16}
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_a`, true)
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_a`, false)
                          }}
                          onPointerLeave={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_a`, false)
                          }}
                        />
                        <circle
                          cx={270}
                          cy={115}
                          r={16}
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_b`, true)
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_b`, false)
                          }}
                          onPointerLeave={(e) => {
                            e.stopPropagation()
                            onInteract(`${part.id}_b`, false)
                          }}
                        />
                      </g>
                    )}

                    {interactive && part.type === "ir-sensor" && (
                      <rect
                        x={0}
                        y={0}
                        width={def.width}
                        height={def.height}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onChangeProp?.(part.id, "detected", part.props.detected === "true" ? "false" : "true")
                        }}
                      />
                    )}

                    {interactive && part.type === "joystick" && (
                      <circle
                        cx={def.width / 2}
                        cy={def.height / 2}
                        r={def.width / 2}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement | null)?.getBoundingClientRect()
                          if (!rect) return
                          const px = (e.clientX - rect.left - view.tx) / view.scale - part.x
                          const py = (e.clientY - rect.top - view.ty) / view.scale - part.y
                          const x = Math.round(Math.max(0, Math.min(1023, (px / def.width) * 1023)))
                          const y = Math.round(Math.max(0, Math.min(1023, (1 - py / def.height) * 1023)))
                          onChangeProp?.(part.id, "x", x)
                          onChangeProp?.(part.id, "y", y)
                        }}
                      />
                    )}

                    {interactive && part.type === "rotary-encoder" && (
                      <rect
                        x={0}
                        y={0}
                        width={def.width}
                        height={def.height}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onChangeProp?.(part.id, "value", Number(part.props.value ?? 0) + 1)
                        }}
                      />
                    )}

                    {interactive && part.type === "keypad-4x4" && (
                      <g>
                        {[
                          ["1", "2", "3", "A"],
                          ["4", "5", "6", "B"],
                          ["7", "8", "9", "C"],
                          ["CLR", "0", "OK", "D"],
                        ].flatMap((row, r) =>
                          row.map((label, col) => {
                            const kx = 10 + col * 26
                            const ky = 12 + r * 26
                            return (
                              <rect
                                key={label}
                                x={kx}
                                y={ky}
                                width={20}
                                height={20}
                                rx={5}
                                fill="rgba(0,0,0,0.001)"
                                pointerEvents="all"
                                className="cursor-pointer"
                                onPointerDown={(e) => {
                                  e.stopPropagation()
                                  const currentPin = String(part.props.enteredPin ?? "")
                                  if (label === "CLR") {
                                    onChangeProp?.(part.id, "enteredPin", "")
                                    onChangeProp?.(part.id, "lastKey", "")
                                  } else if (label === "OK") {
                                    const pinToSubmit = currentPin || "#"
                                    onChangeProp?.(part.id, "lastKey", pinToSubmit)
                                    onChangeProp?.(part.id, "enteredPin", "")
                                    setTimeout(() => {
                                      onChangeProp?.(part.id, "lastKey", "")
                                    }, 1200)
                                  } else {
                                    const newPin = (currentPin + label).slice(0, 8)
                                    onChangeProp?.(part.id, "enteredPin", newPin)
                                  }
                                }}
                              />
                            )
                          })
                        )}
                      </g>
                    )}

                    {/* Arduino Uno Interactive Reset Switch Hitbox */}
                    {part.type === "arduino-uno" && (
                      <circle
                        cx={49}
                        cy={105}
                        r={12}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onResetMcu?.()
                        }}
                      />
                    )}

                    {/* ESP32 Interactive EN Reset Switch Hitbox */}
                    {part.type === "esp32-devkit" && (
                      <circle
                        cx={39}
                        cy={339}
                        r={12}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onResetMcu?.()
                        }}
                      />
                    )}
                  </g>

                  {/* Direct Floating Potentiometer Knob / Range Slider on Canvas */}
                  {part.type === "potentiometer" && (
                    <foreignObject
                      x={-28}
                      y={-50}
                      width={120}
                      height={46}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-cyan-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex flex-col gap-0.5 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                          <span className="text-cyan-400 font-bold flex items-center gap-1">
                            <span>🎛️</span>
                            <span>Wiper</span>
                          </span>
                          <span className="text-cyan-200 font-extrabold font-mono bg-cyan-950/70 px-1 rounded border border-cyan-500/30 text-[9px]">
                            {((Number(part.props.value ?? 512) / 1023) * 5).toFixed(2)}V ({part.props.value ?? 512})
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1023}
                          value={Number(part.props.value ?? 512)}
                          onChange={(e) => {
                            e.stopPropagation()
                            onChangeProp?.(part.id, "value", Number(e.target.value))
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                        />
                      </div>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live Ultrasonic Draggable Distance Obstacle Slider */}
                  {part.type === "ultrasonic" && (
                    <>
                      <foreignObject
                        x={-24}
                        y={-54}
                        width={142}
                        height={48}
                        className="overflow-visible pointer-events-auto"
                      >
                        <div
                          className="bg-slate-950/95 border border-cyan-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex flex-col gap-0.5 select-none backdrop-blur-sm"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onContextMenu={(e) => {
                            e.stopPropagation()
                            onSelect(part.id)
                            onCanvasContextMenu?.(e, { type: "part", id: part.id })
                          }}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                            <span className="text-cyan-400 font-bold flex items-center gap-1">
                              <span>🎯</span>
                              <span>Target Dist</span>
                            </span>
                            <span className="text-cyan-200 font-extrabold font-mono bg-cyan-950/70 px-1 rounded border border-cyan-500/30 text-[9px]">
                              {part.props.distance ?? 42} cm
                            </span>
                          </div>
                          <input
                            type="range"
                            min={2}
                            max={400}
                            value={Number(part.props.distance ?? 42)}
                            onChange={(e) => {
                              e.stopPropagation()
                              onChangeProp?.(part.id, "distance", Number(e.target.value))
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                          />
                        </div>
                      </foreignObject>

                      {/* Animated Sonar Reflection Beam in World Coordinates */}
                      {running && (
                        <g opacity={0.7} className="pointer-events-none">
                          <line
                            x1={10}
                            y1={def.height + Math.min(70, Number(part.props.distance ?? 42) * 0.35)}
                            x2={def.width - 10}
                            y2={def.height + Math.min(70, Number(part.props.distance ?? 42) * 0.35)}
                            stroke="#06b6d4"
                            strokeWidth={3}
                            strokeDasharray="4 3"
                          />
                          <path
                            d={`M 26,${def.height + 4} Q 45,${def.height + 15} 64,${def.height + 4}`}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth={1.5}
                            className="animate-pulse"
                          />
                        </g>
                      )}
                    </>
                  )}

                  {/* On-Canvas Live LDR Torch / Ambient Light Lux Slider */}
                  {part.type === "ldr" && (
                    <foreignObject
                      x={-28}
                      y={-52}
                      width={138}
                      height={46}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-amber-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex flex-col gap-0.5 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span>☀️</span>
                            <span>Torch Lux</span>
                          </span>
                          <span className="text-amber-200 font-extrabold font-mono bg-amber-950/70 px-1 rounded border border-amber-500/30 text-[9px]">
                            {part.props.light ?? 512}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1023}
                          value={Number(part.props.light ?? 512)}
                          onChange={(e) => {
                            e.stopPropagation()
                            onChangeProp?.(part.id, "light", Number(e.target.value))
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                        />
                      </div>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live DHT11 Temp & Humidity Dual Sliders */}
                  {part.type === "dht11" && (
                    <foreignObject
                      x={-32}
                      y={-76}
                      width={146}
                      height={72}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-blue-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex flex-col gap-1 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                          <span className="text-blue-300 font-bold">🌡️ Temp</span>
                          <span className="text-blue-200 font-bold">{part.props.temperature ?? 25}°C</span>
                        </div>
                        <input
                          type="range"
                          min={-20}
                          max={80}
                          value={Number(part.props.temperature ?? 25)}
                          onChange={(e) => {
                            e.stopPropagation()
                            onChangeProp?.(part.id, "temperature", Number(e.target.value))
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="w-full accent-blue-400 cursor-pointer h-1 bg-slate-800 rounded"
                        />
                        <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                          <span className="text-cyan-300 font-bold">💧 Humidity</span>
                          <span className="text-cyan-200 font-bold">{part.props.humidity ?? 55}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Number(part.props.humidity ?? 55)}
                          onChange={(e) => {
                            e.stopPropagation()
                            onChangeProp?.(part.id, "humidity", Number(e.target.value))
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="w-full accent-cyan-400 cursor-pointer h-1 bg-slate-800 rounded"
                        />
                      </div>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live PIR Motion Sensor Trigger Button */}
                  {part.type === "pir-sensor" && (
                    <foreignObject
                      x={-16}
                      y={-44}
                      width={112}
                      height={40}
                      className="overflow-visible pointer-events-auto"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onChangeProp?.(part.id, "motion", part.props.motion === "true" ? "false" : "true")
                        }}
                        className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg ${
                          part.props.motion === "true"
                            ? "bg-rose-600 text-white animate-pulse border border-rose-400"
                            : "bg-slate-900/90 text-slate-200 border border-slate-700 hover:border-cyan-500"
                        }`}
                      >
                        <span>👋</span>
                        <span>{part.props.motion === "true" ? "Motion Active!" : "Wave Hand"}</span>
                      </button>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live MQ-2 Gas / Smoke Sensor Density Slider */}
                  {part.type === "mq2-gas" && (
                    <foreignObject
                      x={-28}
                      y={-52}
                      width={142}
                      height={48}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-amber-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex flex-col gap-0.5 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono leading-tight">
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span>💨</span>
                            <span>Gas PPM</span>
                          </span>
                          <span className={`font-mono text-[9px] font-extrabold px-1 rounded ${
                            Number(part.props.gasLevel ?? 150) >= Number(part.props.threshold ?? 350)
                              ? "bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse"
                              : "bg-slate-900 text-slate-300"
                          }`}>
                            {part.props.gasLevel ?? 150} ppm
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1000}
                          value={Number(part.props.gasLevel ?? 150)}
                          onChange={(e) => {
                            e.stopPropagation()
                            onChangeProp?.(part.id, "gasLevel", Number(e.target.value))
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
                        />
                      </div>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live NeoPixel RGB Ring Quick-Test Buttons */}
                  {part.type === "neopixel-ring" && (
                    <foreignObject
                      x={-26}
                      y={-48}
                      width={154}
                      height={44}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-purple-500/50 shadow-xl rounded-lg p-1 text-white flex flex-col gap-1 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center justify-between text-[8px] font-mono leading-tight">
                          <span className="text-purple-300 font-bold">✨ NeoPixel</span>
                          <span className="text-purple-400 uppercase font-mono text-[8px]">{String(part.props.pattern ?? "rainbow")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {(["rainbow", "chase", "solid", "off"] as const).map((pat) => (
                            <button
                              key={pat}
                              onClick={(e) => {
                                e.stopPropagation()
                                onChangeProp?.(part.id, "pattern", pat)
                              }}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-mono capitalize transition-colors ${
                                (part.props.pattern ?? "rainbow") === pat
                                  ? "bg-purple-600 text-white font-bold"
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              {pat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </foreignObject>
                  )}

                  {/* On-Canvas Live Keypad Quick Action Controller */}
                  {part.type === "keypad-4x4" && (
                    <foreignObject
                      x={-25}
                      y={-46}
                      width={175}
                      height={42}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-blue-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex items-center justify-between gap-1 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.stopPropagation()
                          onSelect(part.id)
                          onCanvasContextMenu?.(e, { type: "part", id: part.id })
                        }}
                      >
                        <div className="flex items-center gap-1 text-[9px] font-mono">
                          <span className="text-blue-400 font-bold">PIN:</span>
                          <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold tracking-wider min-w-[34px] text-center">
                            {part.props.enteredPin ? String(part.props.enteredPin) : "____"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {["1", "2", "3", "4"].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                const curr = String(part.props.enteredPin ?? "")
                                onChangeProp?.(part.id, "enteredPin", (curr + k).slice(0, 8))
                              }}
                              className="w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center border border-slate-700 bg-slate-800 text-slate-200 hover:border-blue-400 hover:bg-slate-700 active:scale-95"
                            >
                              {k}
                            </button>
                          ))}
                          <button
                            type="button"
                            title="Submit PIN"
                            onClick={() => {
                              const pin = String(part.props.enteredPin ?? "") || "#"
                              onChangeProp?.(part.id, "lastKey", pin)
                              onChangeProp?.(part.id, "enteredPin", "")
                              setTimeout(() => onChangeProp?.(part.id, "lastKey", ""), 1200)
                            }}
                            className="px-1.5 h-4 rounded text-[8px] font-bold flex items-center justify-center border border-emerald-500 bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white transition active:scale-95"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            title="Clear PIN"
                            onClick={() => {
                              onChangeProp?.(part.id, "enteredPin", "")
                              onChangeProp?.(part.id, "lastKey", "")
                            }}
                            className="px-1 h-4 rounded text-[8px] font-bold flex items-center justify-center border border-rose-500 bg-rose-600/30 text-rose-300 hover:bg-rose-600 hover:text-white transition active:scale-95"
                          >
                            CLR
                          </button>
                        </div>
                      </div>
                    </foreignObject>
                  )}
                  {/* On-Canvas Live 7-Segment Quick Action Digit Controller */}
                  {part.type === "seven-segment" && (
                    <foreignObject
                      x={-50}
                      y={-46}
                      width={170}
                      height={42}
                      className="overflow-visible pointer-events-auto"
                    >
                      <div
                        className="bg-slate-950/95 border border-red-500/50 shadow-xl rounded-lg px-2 py-1 text-white flex items-center justify-between gap-1 select-none backdrop-blur-sm"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-red-400">
                          <span>🔢</span>
                          <span className="text-white bg-red-950/80 px-1 py-0.5 rounded border border-red-500/40 font-bold min-w-[16px] text-center">
                            {part.props.digit !== undefined ? String(part.props.digit) : "0"}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => onChangeProp?.(part.id, "digit", d)}
                              className={`w-3.5 h-4 rounded text-[8px] font-mono font-bold flex items-center justify-center border transition-all ${
                                Number(part.props.digit ?? 0) === d
                                  ? "bg-red-600 text-white border-red-400 scale-110 shadow"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:border-red-400 hover:bg-slate-700 active:scale-95"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </foreignObject>
                  )}
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
                  stroke={viewMode === "schematic" ? "#38bdf8" : wire.color}
                  strokeWidth={viewMode === "schematic" ? 2.2 : 3.5}
                  strokeLinecap="round"
                  opacity={0.98}
                />
                {/* Animated Current Flow (Charge particles flowing along wire) */}
                {running && wireCurrents?.[wire.id] && wireCurrents[wire.id].currentMa > 0 && (
                  <path
                    d={wirePath(a, b)}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                    pointerEvents="none"
                    style={{
                      animation: `pixiuCurrentFlow ${wireCurrents[wire.id].period}s linear infinite ${
                        wireCurrents[wire.id].isForward ? "normal" : "reverse"
                      }`,
                      filter: "drop-shadow(0 0 3.5px #38bdf8)",
                    }}
                  />
                )}
                {/* Wire terminal dots / schematic junction nodes */}
                <circle cx={a.x} cy={a.y} r={viewMode === "schematic" ? 3.5 : 3} fill={viewMode === "schematic" ? "#38bdf8" : wire.color} stroke="#ffffff" strokeWidth={1} />
                <circle cx={b.x} cy={b.y} r={viewMode === "schematic" ? 3.5 : 3} fill={viewMode === "schematic" ? "#38bdf8" : wire.color} stroke="#ffffff" strokeWidth={1} />
                {/* Hit area */}
                <path
                  d={wirePath(a, b)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (!running) {
                      onSelect(null)
                      onSelectWire?.(wire.id)
                      if (e.pointerType === "touch") {
                        startLongPress(e.clientX, e.clientY, { type: "wire", id: wire.id })
                      }
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!running) {
                      onSelect(null)
                      onSelectWire?.(wire.id)
                    }
                    onCanvasContextMenu?.(e, { type: "wire", id: wire.id })
                  }}
                >
                  <title>Click to select wire (Delete key to remove)</title>
                </path>
              </g>
            )
          })}

          {/* 3. Temp Wire being dragged (with magnetic snap to hovered pin) */}
          {wiringPos && cursor && (() => {
            let snapPos = cursor
            if (hoverPin && (!wiring || hoverPin !== `${wiring.partId}:${wiring.pinId}`)) {
              const [hPartId, hPinId] = hoverPin.split(":")
              const hp = getPinRefPosition({ partId: hPartId, pinId: hPinId }, parts)
              if (hp) snapPos = hp
            }
            return (
              <path
                d={wirePath(wiringPos, snapPos)}
                fill="none"
                stroke={activeWireColor || "var(--color-primary, #38bdf8)"}
                strokeWidth={3.5}
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
            )
          })()}

          {/* 4. Interactive Pins (TOPMOST - NEVER BLOCKED BY WIRES) */}
          {parts.map((part) => {
            const def = CATALOG[part.type]
            const hitRadius = part.type === "breadboard" ? 5.5 : 10
            return (
              <g key={`pins-${part.id}`} transform={`translate(${part.x} ${part.y})`}>
                <g transform={`rotate(${part.rotation} ${def.width / 2} ${def.height / 2})`}>
                  {def.pins.map((pin) => {
                    const key = `${part.id}:${pin.id}`
                    const isWiringStart = wiring && wiring.partId === part.id && wiring.pinId === pin.id
                    const isHovered = hoverPin === key

                    return (
                      <g key={pin.id}>
                        {/* Wiring Start Origin Indicator Ripple */}
                        {isWiringStart && (
                          <>
                            <circle
                              cx={pin.x}
                              cy={pin.y}
                              r={9}
                              fill="none"
                              stroke="var(--color-primary, #38bdf8)"
                              strokeWidth={2}
                              className="animate-ping pointer-events-none"
                              opacity={0.7}
                            />
                            <circle
                              cx={pin.x}
                              cy={pin.y}
                              r={7.5}
                              fill="none"
                              stroke="var(--color-primary, #38bdf8)"
                              strokeWidth={1.8}
                              strokeDasharray="3 2"
                              className="pointer-events-none"
                            />
                          </>
                        )}

                        {/* Visible Pin Dot */}
                        <circle
                          cx={pin.x}
                          cy={pin.y}
                          r={isHovered ? 5.5 : 4}
                          fill={PIN_KIND_COLOR[pin.kind]}
                          stroke={isWiringStart ? "var(--color-primary, #38bdf8)" : isHovered ? "#ffffff" : "#090d16"}
                          strokeWidth={isHovered ? 2 : 1.2}
                          className="pointer-events-none transition-all duration-75"
                        />

                        {/* Generous Tactile Hit Target (20px diameter on ESP32/Arduino, 11px on Breadboard) */}
                        <circle
                          cx={pin.x}
                          cy={pin.y}
                          r={hitRadius}
                          fill="transparent"
                          className={running ? "" : "cursor-crosshair"}
                          onPointerDown={(e) => onPinPointerDown(e, { partId: part.id, pinId: pin.id })}
                          onPointerEnter={() => setHoverPin(key)}
                          onPointerLeave={() => setHoverPin((h) => (h === key ? null : h))}
                        >
                          <title>{`${def.name} · ${pin.label}`}</title>
                        </circle>
                      </g>
                    )
                  })}
                </g>
              </g>
            )
          })}

          {/* 4b. Floating High-Contrast World-Space Pin Tooltip Badge */}
          {hoverPin && (() => {
            const [hPartId, hPinId] = hoverPin.split(":")
            const hPart = parts.find((p) => p.id === hPartId)
            if (!hPart) return null
            const pos = getPinRefPosition({ partId: hPartId, pinId: hPinId }, parts)
            if (!pos) return null

            const info = getPinDisplayInfo(hPart.type, hPinId)
            const isNearTop = pos.y < 45
            const badgeY = isNearTop ? pos.y + 16 : pos.y - 14
            const kindColor = PIN_KIND_COLOR[info.kind] || "#38bdf8"
            const labelLen = info.label.length
            const detailsLen = info.details ? info.details.length : 0
            const badgeW = Math.max(64, labelLen * 8.5 + detailsLen * 7.2 + 34)

            return (
              <g transform={`translate(${pos.x} ${badgeY})`} className="pointer-events-none select-none z-50">
                {/* Pill Background with Drop Shadow */}
                <rect
                  x={-badgeW / 2}
                  y={-10}
                  width={badgeW}
                  height={20}
                  rx={5}
                  fill="#050811"
                  stroke="#334155"
                  strokeWidth={1}
                />
                {/* Accent border on top edge */}
                <line
                  x1={-badgeW / 2 + 5}
                  y1={-10}
                  x2={badgeW / 2 - 5}
                  y2={-10}
                  stroke={kindColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {/* Kind indicator dot */}
                <circle cx={-badgeW / 2 + 10} cy={0} r={3} fill={kindColor} />
                {/* Label & Educational Details */}
                <text
                  x={-badgeW / 2 + 17}
                  y={3.5}
                  fontSize={9.5}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={700}
                  fill="#f8fafc"
                >
                  {info.label}
                  {info.details && (
                    <tspan fill="#94a3b8" fontWeight={500} fontSize={8.5}>
                      {" · " + info.details}
                    </tspan>
                  )}
                </text>
              </g>
            )
          })()}
          {/* 5. Multimeter Probe Clips Overlay */}
          {probeRed && (() => {
            const pos = getPinRefPosition(probeRed, parts)
            if (!pos) return null
            return (
              <g transform={`translate(${pos.x} ${pos.y})`} className="pointer-events-none">
                <circle r={12} fill="#ef4444" opacity={0.35} className="animate-ping" />
                <circle r={6.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1.8} />
                <path d="M-2 -8 L2 -8 L1 -4 L-1 -4 Z" fill="#ef4444" />
                <g transform="translate(0, -12)">
                  <rect x={-20} y={-10} width={40} height={12} rx={3} fill="#991b1b" stroke="#fca5a5" strokeWidth={0.8} />
                  <text y={-1} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff" fontFamily="monospace">
                    RED (+)
                  </text>
                </g>
              </g>
            )
          })()}
          {probeBlack && (() => {
            const pos = getPinRefPosition(probeBlack, parts)
            if (!pos) return null
            return (
              <g transform={`translate(${pos.x} ${pos.y})`} className="pointer-events-none">
                <circle r={12} fill="#0f172a" opacity={0.35} className="animate-ping" />
                <circle r={6.5} fill="#1e293b" stroke="#ffffff" strokeWidth={1.8} />
                <path d="M-2 -8 L2 -8 L1 -4 L-1 -4 Z" fill="#1e293b" />
                <g transform="translate(0, -12)">
                  <rect x={-20} y={-10} width={40} height={12} rx={3} fill="#0f172a" stroke="#cbd5e1" strokeWidth={0.8} />
                  <text y={-1} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff" fontFamily="monospace">
                    BLK (-)
                  </text>
                </g>
              </g>
            )
          })()}
          {/* 6. Oscilloscope Probe Clips Overlay (CH1 Yellow / CH2 Cyan) - Only visible when Oscilloscope is open */}
          {isScopeOpen && scopeProbeCH1 && (() => {
            const pos = getPinRefPosition(scopeProbeCH1, parts)
            if (!pos) return null
            return (
              <g transform={`translate(${pos.x} ${pos.y})`} className="pointer-events-none">
                <circle r={5} fill="none" stroke="#facc15" strokeWidth={1.5} />
                <path d="M-2 -8 L2 -8 L1 -4 L-1 -4 Z" fill="#facc15" />
                <g transform="translate(0, -12)">
                  <rect x={-24} y={-10} width={48} height={12} rx={3} fill="#854d0e" stroke="#fef08a" strokeWidth={0.8} />
                  <text y={-1} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff" fontFamily="monospace">
                    CH1 (YEL)
                  </text>
                </g>
              </g>
            )
          })()}
          {isScopeOpen && scopeProbeCH2 && (() => {
            const pos = getPinRefPosition(scopeProbeCH2, parts)
            if (!pos) return null
            return (
              <g transform={`translate(${pos.x} ${pos.y})`} className="pointer-events-none">
                <circle r={5} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
                <path d="M-2 -8 L2 -8 L1 -4 L-1 -4 Z" fill="#06b6d4" />
                <g transform="translate(0, -12)">
                  <rect x={-24} y={-10} width={48} height={12} rx={3} fill="#0e7490" stroke="#a5f3fc" strokeWidth={0.8} />
                  <text y={-1} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff" fontFamily="monospace">
                    CH2 (CYAN)
                  </text>
                </g>
              </g>
            )
          })()}
        </g>
      </svg>
      <style>{`
        @keyframes pixiuCurrentFlow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

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
