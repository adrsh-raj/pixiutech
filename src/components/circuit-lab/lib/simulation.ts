import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import type { PartRuntime } from "@/components/part-art"

/** Simple union-find over pin nodes. */
class DSU {
  private parent = new Map<string, string>()
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let root = x
    while (this.parent.get(root) !== root) root = this.parent.get(root)!
    let cur = x
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b))
  }
}

const key = (partId: string, pinId: string) => `${partId}:${pinId}`

/**
 * Milestone-1 connectivity model. Digital + power pins act as sources ("HIGH"),
 * ground pins act as sinks. An LED / buzzer activates when its + side reaches a
 * source and its - side reaches ground. Real per-pin control arrives with the
 * block-code simulator.
 */
export function computeRuntime(state: CircuitState, pressed: Set<string>): Record<string, PartRuntime> {
  const dsu = new DSU()

  // wires connect endpoints
  for (const w of state.wires) {
    dsu.union(key(w.from.partId, w.from.pinId), key(w.to.partId, w.to.pinId))
  }

  // internal connections
  for (const part of state.parts) {
    const k = (pin: string) => key(part.id, pin)
    switch (part.type) {
      case "resistor":
        dsu.union(k("a"), k("b"))
        break
      case "pushbutton":
        dsu.union(k("p1a"), k("p1b"))
        dsu.union(k("p2a"), k("p2b"))
        if (pressed.has(part.id)) {
          dsu.union(k("p1a"), k("p2a"))
        }
        break
      case "potentiometer":
        dsu.union(k("t1"), k("wiper"))
        dsu.union(k("wiper"), k("t2"))
        break
      default:
        break
    }
  }

  // classify every root as source / ground
  const sources = new Set<string>()
  const grounds = new Set<string>()
  for (const part of state.parts) {
    for (const pin of CATALOG[part.type].pins) {
      const kind = pin.kind
      const root = dsu.find(key(part.id, pin.id))
      if (kind === "power" || kind === "digital") sources.add(root)
      if (kind === "ground") grounds.add(root)
    }
  }

  const runtime: Record<string, PartRuntime> = {}

  for (const part of state.parts) {
    if (part.type === "led" || part.type === "buzzer") {
      const posPin = part.type === "led" ? "anode" : "pos"
      const negPin = part.type === "led" ? "cathode" : "neg"
      const posRoot = dsu.find(key(part.id, posPin))
      const negRoot = dsu.find(key(part.id, negPin))
      const lit = sources.has(posRoot) && grounds.has(negRoot)
      runtime[part.id] = { level: lit ? 1 : 0 }
    } else if (part.type === "servo") {
      runtime[part.id] = { angle: Number(part.props.angle ?? 90) }
    }
  }

  return runtime
}
