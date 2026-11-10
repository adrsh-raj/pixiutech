import type { CircuitState, PinRef } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { solveCircuitNodalPotentials } from "./circuit-solver"
import { getBoardForPart, lookupBoardPinState } from "./board-registry"
import { BREADBOARD_COLUMNS } from "./components-catalog"
import { getLegacyBreadboardPinMappings } from "./breadboard-pins"

export interface WireCurrentState {
  currentMa: number
  isForward: boolean // true = from -> to, false = to -> from
  period: number // animation duration in seconds (smaller = faster)
}

const pinKey = (ref: PinRef) => `${ref.partId}:${ref.pinId}`

/**
 * Computes the electrical current magnitude and direction through wires on the canvas.
 * Used to drive 60fps animated SVG dashoffset electron/charge flow lines.
 *
 * STRICT PHYSICAL LAW ENFORCEMENT:
 * Current flows IF AND ONLY IF:
 * 1. The component/load is actively ON and conducting (e.g. LED level > 0, Buzzer sounding, Motor rotating).
 * 2. There is a complete CLOSED circuit path to BOTH an active Power Source AND a Ground Sink.
 * 3. When a bulb/LED or buzzer is OFF, its current is STRICTLY 0 mA (zero electron movement).
 */
export function computeWireCurrents(
  state: CircuitState,
  runtime: Record<string, PartRuntime>,
  pinStates: Record<string, ArduinoPinState> = {},
  pressed: Set<string> = new Set(),
): Record<string, WireCurrentState> {
  const result: Record<string, WireCurrentState> = {}

  // 1. Solve exact nodal potentials across circuit
  const nodal = solveCircuitNodalPotentials(state, pressed, pinStates, true)

  // 2. Identify active power sources and ground sinks
  const powerPins = new Set<string>()
  const groundPins = new Set<string>()
  // Signal outputs (GPIO HIGH/PWM/tone) and signal sinks (GPIO LOW) are
  // distinct from board supply rails. Load types choose which domain is valid.
  const signalPowerPins = new Set<string>()
  const signalGroundPins = new Set<string>()

  for (const part of state.parts) {
    const k = (pin: string) => `${part.id}:${pin}`

    const board = getBoardForPart(part)
    if (board) {
      const addSupply = (pinId: string) => {
        powerPins.add(k(pinId))
        signalPowerPins.add(k(pinId))
      }
      const addReturn = (pinId: string) => {
        groundPins.add(k(pinId))
        signalGroundPins.add(k(pinId))
      }
      if (board.powerPins.v5) for (const pinId of board.powerPins.v5) addSupply(pinId)
      if (board.powerPins.v33) for (const pinId of board.powerPins.v33) addSupply(pinId)
      if (board.powerPins.vin) for (const pinId of board.powerPins.vin) addSupply(pinId)
      for (const pinId of board.powerPins.gnd) addReturn(pinId)

      for (const pin of board.pins) {
        if (pin.kind !== "digital" && pin.kind !== "analog") continue
        const pState = lookupBoardPinState(pinStates, pin.id, board)
        if (!pState) continue
        const aliases = new Set([pin.id, ...(pin.alternateNames ?? [])])
        for (const alias of aliases) {
          if (pState.state === "HIGH" || (pState.value ?? 0) > 0) {
            signalPowerPins.add(k(alias))
          } else if (
            pState.state === "LOW" &&
            (pState.outputMode === "digital" || pState.outputMode === "pwm" || pState.outputMode === "tone")
          ) {
            // A driven LOW pin can sink signal current, but is not a supply
            // return and is never inserted into groundPins.
            signalGroundPins.add(k(alias))
          }
        }
      }
    } else if (part.type === "battery") {
      powerPins.add(k("pos"))
      groundPins.add(k("neg"))
      signalPowerPins.add(k("pos"))
      signalGroundPins.add(k("neg"))
    }
  }

  // A NeoPixel show() transfers a frame over the physically connected DI wire.
  // Treat only that board pin as an active signal source for this data-frame path;
  // do not mutate the student's ordinary GPIO state just to animate the transfer.
  for (const ring of state.parts.filter((part) => part.type === "neopixel-ring")) {
    const ringRuntime = runtime[ring.id]
    const dataPin = ringRuntime?.neopixelDataActive ? ringRuntime.neopixelDataPin : undefined
    if (!dataPin) continue
    const boardPart = state.parts.find((part) => part.id === dataPin.partId)
    const board = boardPart ? getBoardForPart(boardPart) : undefined
    if (!board) continue
    const raw = dataPin.pinId.toLowerCase()
    const boardPin = board.pins.find((pin) =>
      pin.id.toLowerCase() === raw ||
      pin.label.toLowerCase() === raw ||
      (pin.alternateNames ?? []).some((alias) => alias.toLowerCase() === raw),
    )
    if (!boardPin || (boardPin.kind !== "digital" && boardPin.kind !== "analog")) continue
    // Keep the exact endpoint spelling used by the student's wire graph as
    // well as the board's canonical ID and any registered pin aliases.
    signalPowerPins.add(`${dataPin.partId}:${raw}`)
    signalPowerPins.add(`${dataPin.partId}:${boardPin.id}`)
    for (const alias of boardPin.alternateNames ?? []) {
      signalPowerPins.add(`${dataPin.partId}:${alias.toLowerCase()}`)
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
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const topRows = ["a", "b", "c", "d", "e"]
        for (let i = 0; i < topRows.length - 1; i++) {
          linkInternal(k(`${topRows[i]}_${c}`), k(`${topRows[i + 1]}_${c}`))
        }
        const botRows = ["f", "g", "h", "i", "j"]
        for (let i = 0; i < botRows.length - 1; i++) {
          linkInternal(k(`${botRows[i]}_${c}`), k(`${botRows[i + 1]}_${c}`))
        }
      }
      for (let c = 1; c < BREADBOARD_COLUMNS; c++) {
        linkInternal(k(`pos_t_${c}`), k(`pos_t_${c + 1}`))
        linkInternal(k(`neg_t_${c}`), k(`neg_t_${c + 1}`))
        linkInternal(k(`pos_b_${c}`), k(`pos_b_${c + 1}`))
        linkInternal(k(`neg_b_${c}`), k(`neg_b_${c + 1}`))
      }
      linkInternal(k("pos_top"), k("pos_t_1"))
      linkInternal(k("neg_top"), k("neg_t_1"))
      linkInternal(k("pos_bot"), k("pos_b_1"))
      linkInternal(k("neg_bot"), k("neg_b_1"))
      for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) {
        linkInternal(k(legacy), k(canonical))
      }
    } else if (part.type === "resistor" || part.type === "ldr") {
      linkInternal(k(part.type === "ldr" ? "t1" : "a"), k(part.type === "ldr" ? "t2" : "b"))
    } else if (part.type === "potentiometer") {
      linkInternal(k("t1"), k("wiper"))
      linkInternal(k("wiper"), k("t2"))
    } else if (part.type === "pushbutton") {
      linkInternal(k("p1a"), k("p1b"))
      linkInternal(k("p2a"), k("p2b"))
      // ONLY conduct across switch when pressed!
      if (pressed.has(part.id)) {
        linkInternal(k("p1a"), k("p2a"))
      }
    } else if (part.type === "relay") {
      // The runtime contract exposes relay coil state as relayActive.
      // Match the same NO/NC contact topology used by simulation.ts.
      if (runtime[part.id]?.relayActive === true) {
        linkInternal(k("com"), k("no"))
      } else {
        linkInternal(k("com"), k("nc"))
      }
    } else if (part.type === "l298n") {
      const driver = runtime[part.id]
      if ((driver?.motorARpm ?? 0) > 0) linkInternal(k("out1"), k("out2"))
      if ((driver?.motorBRpm ?? 0) > 0) linkInternal(k("out3"), k("out4"))
    }
  }

  // 4. Trace current through each active consumer or conducting resistor
  function markWireFlow(wireId: string, current: number, isForward: boolean, period: number) {
    if (!Number.isFinite(current) || current <= 0) return
    const existing = result[wireId]
    // A shared feed/return wire carries the algebraic sum of every branch
    // attached to it; last-branch-wins hid the total current in parallel loads.
    const signedCurrent =
      (existing ? (existing.isForward ? existing.currentMa : -existing.currentMa) : 0) +
      (isForward ? current : -current)
    const magnitude = Math.abs(signedCurrent)
    if (magnitude < 0.001) {
      delete result[wireId]
      return
    }
    result[wireId] = {
      currentMa: Number(magnitude.toFixed(3)),
      isForward: signedCurrent >= 0,
      period: Math.max(0.25, Math.min(2.5, Number((20 / Math.max(0.5, magnitude)).toFixed(2)))),
    }
  }

  function traceComponentFlow(
    loadInPin: string,
    loadOutPin: string,
    currentMa: number,
    signalPath = false,
  ) {
    if (currentMa <= 0) return
    const activeSources = signalPath ? signalPowerPins : powerPins
    const activeReturns = signalPath ? signalGroundPins : groundPins
    const effectiveMa = currentMa
    const period = Math.max(0.25, Math.min(2.5, Number((20 / Math.max(0.001, effectiveMa)).toFixed(2))))

    const upstreamVisited = new Set<string>()
    const downstreamVisited = new Set<string>()

    // BFS Upstream: towards power source
    const queueUp: { pin: string; pathWires: { id: string; forward: boolean }[] }[] = [
      { pin: loadInPin, pathWires: [] },
    ]
    upstreamVisited.add(loadInPin)

    let foundUpstreamWires: { id: string; forward: boolean }[] | null = null
    while (queueUp.length > 0) {
      const { pin, pathWires } = queueUp.shift()!
      if (activeSources.has(pin)) {
        foundUpstreamWires = pathWires
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

    let foundDownstreamWires: { id: string; forward: boolean }[] | null = null
    while (queueDown.length > 0) {
      const { pin, pathWires } = queueDown.shift()!
      if (activeReturns.has(pin)) {
        foundDownstreamWires = pathWires
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

    // STRICT PHYSICAL LAW: Current can ONLY flow if the circuit is a CLOSED LOOP
    // Connected to BOTH an active Power Source AND a Ground Sink!
    // If either side is missing or open, current is STRICTLY ZERO!
    if (foundUpstreamWires !== null && foundDownstreamWires !== null) {
      for (const w of foundUpstreamWires) {
        markWireFlow(w.id, effectiveMa, w.forward, period)
      }
      for (const w of foundDownstreamWires) {
        markWireFlow(w.id, effectiveMa, w.forward, period)
      }
    }
  }

  // A. Check active consumers in runtime
  for (const part of state.parts) {
    const r = runtime[part.id]

    if (part.type === "led") {
      // LED MUST be actively ON (level > 0 or burnt) to conduct!
      // When bulb is OFF (level === 0), current is STRICTLY ZERO!
      if ((r?.level && r.level > 0) || r?.burnt || (r?.currentMa && r.currentMa > 0)) {
        const current = r?.currentMa ?? (r?.level ? r.level * 18.0 : 15.0)
        traceComponentFlow(`${part.id}:anode`, `${part.id}:cathode`, current, true)
      }
    } else if (part.type === "buzzer") {
      // Derive the energized branch current from the same solved circuit model.
      if (r?.level && r.level > 0) {
        const current = nodal.computeCurrentBetweenPins(
          { partId: part.id, pinId: "pos" },
          { partId: part.id, pinId: "neg" },
          runtime,
        ).currentMa
        traceComponentFlow(`${part.id}:pos`, `${part.id}:neg`, current, true)
      }
    } else if (part.type === "dc-motor") {
      // Simulation motors report RPM/direction, not LED-style level/speed.
      const isRunning =
        (r?.rpm ?? 0) > 0 ||
        r?.motorDirection === "cw" ||
        r?.motorDirection === "ccw" ||
        (r?.level ?? 0) > 0 ||
        (r?.speed ?? 0) !== 0
      if (isRunning) {
        const current = nodal.computeCurrentBetweenPins(
          { partId: part.id, pinId: "pos" },
          { partId: part.id, pinId: "neg" },
          runtime,
        ).currentMa
        traceComponentFlow(`${part.id}:pos`, `${part.id}:neg`, current)
      }
    } else if (part.type === "rgb-led") {
      // Only conduct on channels that are actively illuminated
      if (r?.redLevel && r.redLevel > 0) {
        traceComponentFlow(`${part.id}:red`, `${part.id}:gnd`, r.redCurrentMa ?? r.redLevel * 15.0, true)
      }
      if (r?.greenLevel && r.greenLevel > 0) {
        traceComponentFlow(`${part.id}:green`, `${part.id}:gnd`, r.greenCurrentMa ?? r.greenLevel * 15.0, true)
      }
      if (r?.blueLevel && r.blueLevel > 0) {
        traceComponentFlow(`${part.id}:blue`, `${part.id}:gnd`, r.blueCurrentMa ?? r.blueLevel * 15.0, true)
      }
    } else if (part.type === "seven-segment") {
      // ONLY conduct through segment pins that are ACTUALLY ON!
      const segs = r?.segments ?? {}
      for (const segId of ["a", "b", "c", "d", "e", "f", "g", "dp"]) {
        if (segs[segId]) {
          traceComponentFlow(`${part.id}:${segId}`, `${part.id}:com`, 15.0, true)
        }
      }
    } else if (part.type === "servo") {
      // Servo power wires
      traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 10.0)
      // Signal wire carries pulse current only when driven
      if (r?.angle !== undefined) {
        traceComponentFlow(`${part.id}:sig`, `${part.id}:gnd`, 5.0, true)
      }
    } else if (part.type === "lcd-i2c" || part.type === "oled-i2c") {
      // Only powered displays conduct
      if (r?.lcdBacklight !== false) {
        traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 15.0)
        traceComponentFlow(`${part.id}:sda`, `${part.id}:gnd`, 4.0)
        traceComponentFlow(`${part.id}:scl`, `${part.id}:gnd`, 4.0)
      }
    } else if (part.type === "ultrasonic") {
      traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 10.0)
      traceComponentFlow(`${part.id}:trig`, `${part.id}:gnd`, 4.0, true)
      traceComponentFlow(`${part.id}:echo`, `${part.id}:gnd`, 4.0, true)
    } else if (part.type === "mq2-gas" || part.type === "soil-moisture") {
      traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 12.0)
      traceComponentFlow(`${part.id}:ao`, `${part.id}:gnd`, 4.0, true)
    } else if (part.type === "dht11") {
      traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 8.0)
      traceComponentFlow(`${part.id}:data`, `${part.id}:gnd`, 4.0, true)
    } else if (part.type === "pir-sensor" || part.type === "ir-sensor") {
      traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 8.0)
      if (r?.level && r.level > 0) {
        traceComponentFlow(`${part.id}:out`, `${part.id}:gnd`, 6.0, true)
      }
    } else if (part.type === "potentiometer" || part.type === "ldr") {
      // Current through the passive divider is derived from its solved
      // terminal voltages and effective resistance, not a visual constant.
      const firstPin = part.type === "potentiometer" ? "t1" : "t1"
      const lastPin = part.type === "potentiometer" ? "t2" : "t2"
      const current = nodal.computeCurrentBetweenPins(
        { partId: part.id, pinId: firstPin },
        { partId: part.id, pinId: lastPin },
        runtime,
      ).currentMa
      traceComponentFlow(`${part.id}:${firstPin}`, `${part.id}:${lastPin}`, current)
    } else if (part.type === "relay") {
      // The relay's coil is an energized load, not a passive rail-to-ground
      // branch. Neither coil nor input current should animate while de-energized.
      if (r?.relayActive === true) {
        traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 12.0)
        traceComponentFlow(`${part.id}:in`, `${part.id}:gnd`, 6.0, true)
      }
    } else if (part.type === "neopixel-ring") {
      if (r?.level && r.level > 0) {
        traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 20.0)
      }
      if (r?.neopixelDataActive) {
        traceComponentFlow(`${part.id}:di`, `${part.id}:gnd`, 6.0, true)
      }
    } else if (part.type === "neopixel-strip") {
      if (r?.level && r.level > 0) traceComponentFlow(`${part.id}:vcc`, `${part.id}:gnd`, 20.0)
      traceComponentFlow(`${part.id}:din`, `${part.id}:gnd`, 6.0, true)
    } else if (part.type === "l298n") {
      const loadInPin = `${part.id}:vs`
      const loadOutPin = `${part.id}:gnd`
      traceComponentFlow(loadInPin, loadOutPin, 25.0)
      // The catalogue exposes the driver's logic supply as 5v (not vcc).
      traceComponentFlow(`${part.id}:5v`, `${part.id}:gnd`, 15.0)
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

      // ONLY trace if there is an ACTUAL non-zero potential difference (> 0.2V) across the resistor!
      if (diff > 0.2 && rCurrentMa > 0.5) {
        const inPin = vA >= vB ? `${part.id}:a` : `${part.id}:b`
        const outPin = vA >= vB ? `${part.id}:b` : `${part.id}:a`
        traceComponentFlow(inPin, outPin, rCurrentMa, true)
      }
    }
  }

  // NOTICE: No Section C fallback!
  // Any wire that is connected to an OFF device or an OPEN circuit receives ZERO current.
  return result
}
