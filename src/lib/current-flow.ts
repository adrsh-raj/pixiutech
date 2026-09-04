import type { CircuitState, PinRef } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { solveCircuitNodalPotentials } from "./circuit-solver"

export interface WireCurrentState {
  currentMa: number
  isForward: boolean // true = from -> to, false = to -> from
  period: number // animation duration in seconds (smaller = faster)
}

const pinKey = (ref: PinRef) => `${ref.partId}:${ref.pinId}`

/**
 * Computes the electrical current magnitude and direction through every wire on the canvas.
 * Used to drive 60fps animated SVG dashoffset electron/charge flow lines.
 * Fully supports LEDs, Buzzers, Motors, and standalone Multiple Resistor / Voltage Divider networks.
 */
export function computeWireCurrents(
  state: CircuitState,
  runtime: Record<string, PartRuntime>,
  pinStates: Record<string, ArduinoPinState> = {},
): Record<string, WireCurrentState> {
  const result: Record<string, WireCurrentState> = {}

  // 1. Solve exact nodal potentials across circuit
  const nodal = solveCircuitNodalPotentials(state, new Set(), pinStates, true)

  // 2. Identify active power sources and ground sinks
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
        const pState = pinStates[String(i)] || pinStates[`d${i}`]
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

  // 3. Build internal part connection mappings (e.g. breadboard rows, resistors, buttons)
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
      for (let c = 1; c < 20; c++) {
        linkInternal(k(`pos_t_${c}`), k(`pos_t_${c + 1}`))
        linkInternal(k(`neg_t_${c}`), k(`neg_t_${c + 1}`))
        linkInternal(k(`pos_b_${c}`), k(`pos_b_${c + 1}`))
        linkInternal(k(`neg_b_${c}`), k(`neg_b_${c + 1}`))
      }
      linkInternal(k("pos_top"), k("pos_t_1"))
      linkInternal(k("neg_top"), k("neg_t_1"))
      linkInternal(k("pos_bot"), k("pos_b_1"))
      linkInternal(k("neg_bot"), k("neg_b_1"))
    } else if (part.type === "resistor") {
      linkInternal(k("a"), k("b"))
    } else if (part.type === "pushbutton") {
      linkInternal(k("p1a"), k("p1b"))
      linkInternal(k("p2a"), k("p2b"))
      linkInternal(k("p1a"), k("p2a"))
    }
  }

  // 4. Trace current through each active consumer or conducting resistor
  function markWireFlow(wireId: string, current: number, isForward: boolean, period: number) {
    result[wireId] = {
      currentMa: current,
      isForward,
      period,
    }
  }

  function traceComponentFlow(loadInPin: string, loadOutPin: string, currentMa: number) {
    const effectiveMa = Math.max(0.5, currentMa)
    const period = Math.max(0.25, Math.min(2.5, Number((20 / effectiveMa).toFixed(2))))

    const upstreamVisited = new Set<string>()
    const downstreamVisited = new Set<string>()

    // BFS Upstream: towards power source
    const queueUp: { pin: string; pathWires: { id: string; forward: boolean }[] }[] = [
      { pin: loadInPin, pathWires: [] },
    ]
    upstreamVisited.add(loadInPin)

    while (queueUp.length > 0) {
      const { pin, pathWires } = queueUp.shift()!
      if (powerPins.has(pin)) {
        for (const w of pathWires) {
          markWireFlow(w.id, effectiveMa, w.forward, period)
        }
        break
      }

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

      const internalLinks = partInternalLinks.get(pin) || []
      for (const nextPin of internalLinks) {
        if (!upstreamVisited.has(nextPin)) {
          upstreamVisited.add(nextPin)
          queueUp.push({ pin: nextPin, pathWires })
        }
      }
    }

    // BFS Downstream: towards ground sink
    const queueDown: { pin: string; pathWires: { id: string; forward: boolean }[] }[] = [
      { pin: loadOutPin, pathWires: [] },
    ]
    downstreamVisited.add(loadOutPin)

    while (queueDown.length > 0) {
      const { pin, pathWires } = queueDown.shift()!
      if (groundPins.has(pin)) {
        for (const w of pathWires) {
          markWireFlow(w.id, effectiveMa, w.forward, period)
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

  // A. Check active consumers in runtime
  for (const part of state.parts) {
    const r = runtime[part.id]
    const currentMa = r?.currentMa ?? (r?.level && r.level > 0 ? 15.0 : 0)
    if (currentMa <= 0 && !r?.burnt) continue

    let loadInPin = ""
    let loadOutPin = ""
    if (part.type === "led") {
      loadInPin = `${part.id}:anode`
      loadOutPin = `${part.id}:cathode`
    } else if (part.type === "buzzer" || part.type === "dc-motor") {
      loadInPin = `${part.id}:pos`
      loadOutPin = `${part.id}:neg`
    } else if (part.type === "rgb-led") {
      loadInPin = `${part.id}:red`
      loadOutPin = `${part.id}:gnd`
    }

    if (loadInPin && loadOutPin) {
      traceComponentFlow(loadInPin, loadOutPin, r?.burnt ? 45.0 : currentMa)
    }
  }

  // B. Check pure resistor networks (e.g. voltage dividers, multiple series/parallel resistors)
  for (const part of state.parts) {
    if (part.type === "resistor") {
      const vA = nodal.getPinVoltage({ partId: part.id, pinId: "a" })
      const vB = nodal.getPinVoltage({ partId: part.id, pinId: "b" })
      const diff = Math.abs(vA - vB)
      const rVal = Math.max(0.1, Number(part.props.resistance || 220))
      const rCurrentMa = (diff / rVal) * 1000

      if (rCurrentMa > 0.2) {
        const inPin = vA >= vB ? `${part.id}:a` : `${part.id}:b`
        const outPin = vA >= vB ? `${part.id}:b` : `${part.id}:a`
        traceComponentFlow(inPin, outPin, rCurrentMa)
      }
    }
  }

  return result
}
