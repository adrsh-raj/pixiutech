import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"

export interface PinOption {
  /** numeric/label pin as used in code, e.g. "13" or "A0" */
  code: string
  /** dropdown label, e.g. "13 → LED (red)" */
  label: string
  /** true if something is wired to this Arduino pin */
  connected: boolean
}

/** Arduino Uno pin id -> code token used in generated sketches. */
const DIGITAL_PINS: { id: string; code: string }[] = Array.from({ length: 14 }, (_, i) => ({
  id: `d${i}`,
  code: String(i),
}))
const ANALOG_PINS: { id: string; code: string }[] = Array.from({ length: 6 }, (_, i) => ({
  id: `a${i}`,
  code: `A${i}`,
}))

/** Union-find over every pin connected by wires, so we can trace nets. */
function buildNets(circuit: CircuitState) {
  const parent = new Map<string, string>()
  const key = (partId: string, pinId: string) => `${partId}:${pinId}`
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x)
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const w of circuit.wires) {
    union(key(w.from.partId, w.from.pinId), key(w.to.partId, w.to.pinId))
  }
  return { find, key }
}

/** Human name for what a part contributes to a net. */
function partDescriptor(circuit: CircuitState, partId: string): string | null {
  const part = circuit.parts.find((p) => p.id === partId)
  if (!part || part.type === "arduino-uno") return null
  const def = CATALOG[part.type]
  if (part.type === "led") return `LED (${part.props.color ?? "red"})`
  return def.name
}

/**
 * Returns a pin dropdown option list for the current circuit. Pins wired to a
 * component are labeled with what they drive; everything else stays selectable.
 */
export function getPinOptions(circuit: CircuitState): PinOption[] {
  const arduino = circuit.parts.find((p) => p.type === "arduino-uno")
  const all = [...DIGITAL_PINS, ...ANALOG_PINS]
  if (!arduino) {
    return all.map((p) => ({ code: p.code, label: p.code, connected: false }))
  }

  const { find, key } = buildNets(circuit)

  // Map net-root -> descriptors of connected non-Arduino parts.
  const netParts = new Map<string, Set<string>>()
  for (const part of circuit.parts) {
    if (part.type === "arduino-uno") continue
    const def = CATALOG[part.type]
    const desc = partDescriptor(circuit, part.id)
    if (!desc) continue
    for (const pin of def.pins) {
      const root = find(key(part.id, pin.id))
      if (!netParts.has(root)) netParts.set(root, new Set())
      netParts.get(root)!.add(desc)
    }
  }

  return all.map((p) => {
    const root = find(key(arduino.id, p.id))
    const parts = netParts.get(root)
    if (parts && parts.size > 0) {
      return { code: p.code, label: `${p.code} → ${Array.from(parts).join(", ")}`, connected: true }
    }
    return { code: p.code, label: p.code, connected: false }
  })
}
