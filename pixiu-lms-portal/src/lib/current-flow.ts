import type { CircuitState, PinRef } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"

export interface WireCurrentState {
  currentMa: number
  isForward: boolean // true = from -> to, false = to -> from
  period: number // animation duration in seconds (smaller = faster)
}

const pinKey = (ref: PinRef) => `${ref.partId}:${ref.pinId}`

/**
 * Computes the electrical current magnitude and direction through every wire on the canvas.
 * Used to drive 60fps animated SVG dashoffset electron/charge flow lines.
 */
export function computeWireCurrents(
  state: CircuitState,
  runtime: Record<string, PartRuntime>,
  pinStates: Record<string, ArduinoPinState> = {},
): Record<string, WireCurrentState> {
  const result: Record<string, WireCurrentState> = {}

  // 1. Identify active power sources and ground sinks
  const powerPins = new Set<string>()
  const groundPins = new Set<string>()

  for (const part of state.parts) {
    const k = (pin: string) => `${part.id}:${pin}`

    if (part.type === "arduino-uno") {
      powerPins.add(k("5v"))
      powerPins.add(k("3v3"))
      powerPins.add(k("vin"))

      groundPins.add(k("gnd"))
      groundPins.add(k("gnd_pwr"))

      // Digital pins d0..d13
      for (let i = 0; i <= 13; i++) {
        const pState = pinStates[String(i)]
        if (pState?.state === "HIGH" || (pState?.value ?? 0) > 0) {
          powerPins.add(k(`d${i}`))
          powerPins.add(k(String(i)))
        } else {
          groundPins.add(k(`d${i}`))
          groundPins.add(k(String(i)))
        }
      }
    } else if (part.type === "battery") {
      powerPins.add(k("pos"))
      groundPins.add(k("neg"))
    }
  }

  // 2. Build internal part connection mappings (e.g. breadboard rows, resistors, buttons)
  const partInternalLinks = new Map<string, string[]>()
  function linkInternal(a: string, b: string) {
    if (!partInternalLinks.has(a)) partInternalLinks.set(a, [])
    if (!partInternalLinks.has(b)) partInternalLinks.set(b, [])
    partInternalLinks.get(a)!.push(b)
    partInternalLinks.get(b)!.push(a)
  }

  for (const part of state.parts) {
    const k = (pin: string) => `${part.id}:${pin}`
    if (part.type === "breadboard") {
      // Columns a-e and f-j
      for (let c = 1; c <= 20; c++) {
        const topRows = ["a", "b", "c", "d", "e"]
        for (let i = 0; i < topRows.length - 1; i++) {
          linkInternal(k(`${topRows[i]}_${c}`), k(`${topRows[i + 1]}_${c}`))
        }
        const botRows = ["f", "g", "h", "i", "j"]
        for (let i = 0; i < botRows.length - 1; i++) {
          linkInternal(k(`${botRows[i]}_${c}`), k(`${botRows[i + 1]}_${c}`))
        }
      }
      // Power rails
      for (let c = 1; c < 20; c++) {
        linkInternal(k(`pos_t_${c}`), k(`pos_t_${c + 1}`))
        linkInternal(k(`neg_t_${c}`), k(`neg_t_${c + 1}`))
        linkInternal(k(`pos_b_${c}`), k(`pos_b_${c + 1}`))
        linkInternal(k(`neg_b_${c}`), k(`neg_b_${c + 1}`))
      }
      // Legacy breadboard pins
      linkInternal(k("pos_top"), k("pos_t_1"))
      linkInternal(k("neg_top"), k("neg_t_1"))
      linkInternal(k("pos_bot"), k("pos_b_1"))
      linkInternal(k("neg_bot"), k("neg_b_1"))
    } else if (part.type === "resistor") {
      linkInternal(k("a"), k("b"))
    } else if (part.type === "pushbutton") {
      linkInternal(k("p1a"), k("p1b"))
      linkInternal(k("p2a"), k("p2b"))
      linkInternal(k("p1a"), k("p2a")) // for flow tracking
    }
  }

  // 3. For each active consumer in runtime that has current > 0 (or burnt):
  // Trace the paths from power source -> load -> ground sink.
  for (const part of state.parts) {
    const r = runtime[part.id]
    const currentMa = r?.currentMa ?? (r?.level && r.level > 0 ? 15.0 : 0)
    if (currentMa <= 0 && !r?.burnt) continue

    const effectiveMa = Math.max(0.5, r?.burnt ? 45.0 : currentMa)
    // Animation period: faster current = smaller period (0.3s to 2.5s)
    const period = Math.max(0.25, Math.min(2.5, Number((20 / effectiveMa).toFixed(2))))

    // Pin pairs for this active part
    let loadInPin = ""
    let loadOutPin = ""
    if (part.type === "led") {
      loadInPin = `${part.id}:anode`
      loadOutPin = `${part.id}:cathode`
    } else if (part.type === "buzzer" || part.type === "dcmotor") {
      loadInPin = `${part.id}:pos`
      loadOutPin = `${part.id}:neg`
    } else if (part.type === "rgb-led") {
      loadInPin = `${part.id}:red`
      loadOutPin = `${part.id}:gnd`
    }

    if (!loadInPin || !loadOutPin) continue

    // Find wire paths connecting to loadInPin (upstream towards Power)
    // and loadOutPin (downstream towards Ground)
    const upstreamVisited = new Set<string>()
    const downstreamVisited = new Set<string>()

    function markWireFlow(wireId: string, current: number, isForward: boolean) {
      result[wireId] = {
        currentMa: current,
        isForward,
        period,
      }
    }

    // BFS Upstream: find wires connected to loadInPin towards powerPins
    const queueUp: { pin: string; pathWires: { id: string; forward: boolean }[] }[] = [
      { pin: loadInPin, pathWires: [] },
    ]
    upstreamVisited.add(loadInPin)

    while (queueUp.length > 0) {
      const { pin, pathWires } = queueUp.shift()!
      if (powerPins.has(pin)) {
        // We reached power! All wires in this path carry forward current (from source to load)
        for (const w of pathWires) {
          markWireFlow(w.id, effectiveMa, w.forward)
        }
        break
      }

      // Check wire connections
      for (const wire of state.wires) {
        const u = pinKey(wire.from)
        const v = pinKey(wire.to)
        if (u === pin && !upstreamVisited.has(v)) {
          upstreamVisited.add(v)
          queueUp.push({ pin: v, pathWires: [...pathWires, { id: wire.id, forward: false }] })
        } else if (v === pin && !upstreamVisited.has(u)) {
          upstreamVisited.add(u)
          queueUp.push({ pin: u, pathWires: [...pathWires, { id: wire.id, forward: true }] })
        }
      }

      // Check internal component bridges (e.g. breadboard, resistor)
      const internalLinks = partInternalLinks.get(pin) || []
      for (const nextPin of internalLinks) {
        if (!upstreamVisited.has(nextPin)) {
          upstreamVisited.add(nextPin)
          queueUp.push({ pin: nextPin, pathWires })
        }
      }
    }

    // BFS Downstream: find wires connected to loadOutPin towards groundPins
    const queueDown: { pin: string; pathWires: { id: string; forward: boolean }[] }[] = [
      { pin: loadOutPin, pathWires: [] },
    ]
    downstreamVisited.add(loadOutPin)

    while (queueDown.length > 0) {
      const { pin, pathWires } = queueDown.shift()!
      if (groundPins.has(pin)) {
        // We reached ground! All wires in this path carry forward current (from load to ground)
        for (const w of pathWires) {
          markWireFlow(w.id, effectiveMa, w.forward)
        }
        break
      }

      for (const wire of state.wires) {
        const u = pinKey(wire.from)
        const v = pinKey(wire.to)
        if (u === pin && !downstreamVisited.has(v)) {
          downstreamVisited.add(v)
          queueDown.push({ pin: v, pathWires: [...pathWires, { id: wire.id, forward: true }] })
        } else if (v === pin && !downstreamVisited.has(u)) {
          downstreamVisited.add(u)
          queueDown.push({ pin: u, pathWires: [...pathWires, { id: wire.id, forward: false }] })
        }
      }

      const internalLinks = partInternalLinks.get(pin) || []
      for (const nextPin of internalLinks) {
        if (!downstreamVisited.has(nextPin)) {
          downstreamVisited.add(nextPin)
          queueDown.push({ pin: nextPin, pathWires })
        }
      }
    }
  }

  return result
}
