"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type { CircuitState, PartType, PinRef, PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"
import { samePin } from "@/lib/geometry"
import { computeRuntime } from "@/lib/simulation"
import { CircuitCanvas } from "./circuit-canvas"
import { Inspector } from "./inspector"
import { Palette } from "./palette"
import { Toolbar, type WorkbenchView } from "./toolbar"

const WIRE_COLORS = ["#39d98a", "#4d9bff", "#ffd23f", "#c084fc", "#fb923c"]

function pinKindColorForWire(ref: PinRef, parts: PlacedPart[]): string {
  const part = parts.find((p) => p.id === ref.partId)
  if (!part) return WIRE_COLORS[0]
  const pin = CATALOG[part.type].pins.find((p) => p.id === ref.pinId)
  if (pin?.kind === "power") return "#ef4444"
  if (pin?.kind === "ground") return "#64748b"
  return WIRE_COLORS[0]
}

export function Workbench() {
  const [state, setState] = useState<CircuitState>({ parts: [], wires: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [wiring, setWiring] = useState<PinRef | null>(null)
  const [running, setRunning] = useState(false)
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [view, setView] = useState<WorkbenchView>("circuit")
  const addCounter = useRef(0)

  const selected = state.parts.find((p) => p.id === selectedId) ?? null

  const runtime = useMemo(
    () => (running ? computeRuntime(state, pressed) : {}),
    [running, state, pressed],
  )

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random()}`

  const addPart = useCallback((type: PartType, x?: number, y?: number) => {
    const def = CATALOG[type]
    const n = addCounter.current++
    const part: PlacedPart = {
      id: newId(),
      type,
      x: x ?? 160 + (n % 4) * 190,
      y: y ?? 120 + (Math.floor(n / 4) % 3) * 150,
      rotation: 0,
      props: { ...(def.defaults ?? {}) },
    }
    setState((s) => ({ ...s, parts: [...s.parts, part] }))
    setSelectedId(part.id)
  }, [])

  const movePart = useCallback((id: string, x: number, y: number) => {
    setState((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, x, y } : p)) }))
  }, [])

  const changeProp = useCallback((id: string, k: string, value: string | number) => {
    setState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, [k]: value } } : p)),
    }))
  }, [])

  const rotatePart = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    }))
  }, [])

  const deletePart = useCallback((id: string) => {
    setState((s) => ({
      parts: s.parts.filter((p) => p.id !== id),
      wires: s.wires.filter((w) => w.from.partId !== id && w.to.partId !== id),
    }))
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [])

  const duplicatePart = useCallback((id: string) => {
    setState((s) => {
      const src = s.parts.find((p) => p.id === id)
      if (!src) return s
      const copy: PlacedPart = { ...src, id: newId(), x: src.x + 24, y: src.y + 24, props: { ...src.props } }
      return { ...s, parts: [...s.parts, copy] }
    })
  }, [])

  const deleteWire = useCallback((id: string) => {
    setState((s) => ({ ...s, wires: s.wires.filter((w) => w.id !== id) }))
  }, [])

  const handlePinDown = useCallback(
    (ref: PinRef) => {
      setWiring((current) => {
        if (!current) return ref
        if (samePin(current, ref)) return null
        setState((s) => {
          const exists = s.wires.some(
            (w) =>
              (samePin(w.from, current) && samePin(w.to, ref)) || (samePin(w.from, ref) && samePin(w.to, current)),
          )
          if (exists) return s
          return {
            ...s,
            wires: [
              ...s.wires,
              { id: newId(), from: current, to: ref, color: pinKindColorForWire(current, s.parts) },
            ],
          }
        })
        return null
      })
    },
    [],
  )

  const interact = useCallback((id: string, active: boolean) => {
    setPressed((prev) => {
      const next = new Set(prev)
      if (active) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setState({ parts: [], wires: [] })
    setSelectedId(null)
    setWiring(null)
    setRunning(false)
    setPressed(new Set())
  }, [])

  const toggleRun = useCallback(() => {
    setRunning((r) => {
      const next = !r
      if (next) {
        setWiring(null)
        setSelectedId(null)
      } else {
        setPressed(new Set())
      }
      return next
    })
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Toolbar view={view} onViewChange={setView} running={running} onToggleRun={toggleRun} onClear={clearAll} />
      <div className="flex min-h-0 flex-1">
        <Palette onQuickAdd={(t) => addPart(t)} />
        <main className="relative min-w-0 flex-1">
          <CircuitCanvas
            parts={state.parts}
            wires={state.wires}
            selectedId={selectedId}
            tool="select"
            wiring={wiring}
            runtime={runtime}
            running={running}
            onSelect={setSelectedId}
            onMovePart={movePart}
            onPinDown={handlePinDown}
            onCancelWire={() => setWiring(null)}
            onDeleteWire={deleteWire}
            onDropPart={addPart}
            onInteract={interact}
          />
          {running && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 font-mono text-xs text-accent">
              ● simulation running — press buttons, drag sliders in the inspector
            </div>
          )}
        </main>
        <Inspector
          part={selected}
          partCount={state.parts.length}
          wireCount={state.wires.length}
          onChangeProp={changeProp}
          onRotate={rotatePart}
          onDelete={deletePart}
          onDuplicate={duplicatePart}
        />
      </div>
    </div>
  )
}
