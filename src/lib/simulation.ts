import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import type { PartRuntime } from "@/components/part-art"

export interface ArduinoPinState {
  state: "HIGH" | "LOW"
  value?: number
  angle?: number
}

const key = (partId: string, pinId: string) => `${partId}:${pinId}`

interface GraphEdge {
  to: string
  resistance: number
}

/**
 * End-to-End Real Electrical Physics Solver:
 * - Solves circuit continuity via Dijkstra shortest-resistance path.
 * - Computes total loop resistance (R_series) around each component.
 * - Enforces Ohm's Law: I = (V_supply - V_forward) / R_total.
 * - Detects OVERCURRENT (>30mA) when an LED is connected without a current-limiting resistor!
 * - Detects Reverse-Polarity (anode to GND, cathode to V+).
 */
export function computeRuntime(
  state: CircuitState,
  pressed: Set<string>,
  pinStates: Record<string, ArduinoPinState> = {},
): Record<string, PartRuntime> {
  const graph = new Map<string, GraphEdge[]>()

  function addEdge(u: string, v: string, r: number) {
    if (!graph.has(u)) graph.set(u, [])
    if (!graph.has(v)) graph.set(v, [])
    graph.get(u)!.push({ to: v, resistance: r })
    graph.get(v)!.push({ to: u, resistance: r })
  }

  // 1. Add all jumper wires (copper wire resistance ~ 0.05 ohms)
  for (const w of state.wires) {
    addEdge(key(w.from.partId, w.from.pinId), key(w.to.partId, w.to.pinId), 0.05)
  }

  // 2. Add internal component connectivity & resistances
  for (const part of state.parts) {
    const k = (pin: string) => key(part.id, pin)
    switch (part.type) {
      case "resistor": {
        const rVal = Math.max(1, Number(part.props.resistance || 220))
        addEdge(k("a"), k("b"), rVal)
        break
      }

      case "breadboard": {
        // Vertical tie-points for all 20 columns: rows a-e (top half) and f-j (bottom half)
        for (let c = 1; c <= 20; c++) {
          addEdge(k(`a_${c}`), k(`b_${c}`), 0.01)
          addEdge(k(`b_${c}`), k(`c_${c}`), 0.01)
          addEdge(k(`c_${c}`), k(`d_${c}`), 0.01)
          addEdge(k(`d_${c}`), k(`e_${c}`), 0.01)

          addEdge(k(`f_${c}`), k(`g_${c}`), 0.01)
          addEdge(k(`g_${c}`), k(`h_${c}`), 0.01)
          addEdge(k(`h_${c}`), k(`i_${c}`), 0.01)
          addEdge(k(`i_${c}`), k(`j_${c}`), 0.01)
        }

        // Power rails continuous across entire breadboard
        for (let c = 1; c < 20; c++) {
          addEdge(k(`pos_t_${c}`), k(`pos_t_${c + 1}`), 0.01)
          addEdge(k(`neg_t_${c}`), k(`neg_t_${c + 1}`), 0.01)
          addEdge(k(`pos_b_${c}`), k(`pos_b_${c + 1}`), 0.01)
          addEdge(k(`neg_b_${c}`), k(`neg_b_${c + 1}`), 0.01)
        }

        // Legacy pin aliases
        addEdge(k("pos_top"), k("pos_t_1"), 0.01)
        addEdge(k("neg_top"), k("neg_t_1"), 0.01)
        addEdge(k("pos_bot"), k("pos_b_1"), 0.01)
        addEdge(k("neg_bot"), k("neg_b_1"), 0.01)
        addEdge(k("a1"), k("a_3"), 0.01)
        addEdge(k("b1"), k("b_3"), 0.01)
        addEdge(k("c1"), k("c_3"), 0.01)
        addEdge(k("d1"), k("d_3"), 0.01)
        addEdge(k("e1"), k("e_3"), 0.01)
        addEdge(k("a2"), k("f_3"), 0.01)
        addEdge(k("b2"), k("g_3"), 0.01)
        addEdge(k("c2"), k("h_3"), 0.01)
        addEdge(k("d2"), k("i_3"), 0.01)
        addEdge(k("e2"), k("j_3"), 0.01)
        break
      }

      case "pushbutton": {
        addEdge(k("p1a"), k("p1b"), 0.02)
        addEdge(k("p2a"), k("p2b"), 0.02)
        if (pressed.has(part.id)) {
          addEdge(k("p1a"), k("p2a"), 0.05)
        }
        break
      }

      case "potentiometer": {
        const val = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const rTotal = 10000
        const r1 = Math.max(0.1, (val / 1023) * rTotal)
        const r2 = Math.max(0.1, ((1023 - val) / 1023) * rTotal)
        addEdge(k("t1"), k("wiper"), r1)
        addEdge(k("wiper"), k("t2"), r2)
        break
      }

      default:
        break
    }
  }

  // 3. Catalog active Voltage Sources and Ground Sinks
  const activeSources: { key: string; voltage: number }[] = []
  const groundSinks: string[] = []

  for (const part of state.parts) {
    const k = (pin: string) => key(part.id, pin)

    if (part.type === "arduino-uno") {
      activeSources.push({ key: k("5v"), voltage: 5.0 })
      activeSources.push({ key: k("3v3"), voltage: 3.3 })
      activeSources.push({ key: k("vin"), voltage: 5.0 })

      groundSinks.push(k("gnd"))
      groundSinks.push(k("gnd_pwr"))

      // Check digital pins d0..d13
      for (let i = 0; i <= 13; i++) {
        const pinId = `d${i}`
        const pState = pinStates[String(i)]
        if (pState?.state === "HIGH" || (pState?.value ?? 0) > 0) {
          const duty = pState.value !== undefined ? pState.value / 255 : 1.0
          activeSources.push({ key: k(pinId), voltage: 5.0 * duty })
        } else {
          // LOW digital pin acts as Ground sink
          groundSinks.push(k(pinId))
        }
      }
    } else if (part.type === "battery") {
      activeSources.push({ key: k("pos"), voltage: 9.0 })
      groundSinks.push(k("neg"))
    }
  }

  // Helper: Dijkstra shortest resistance path from a list of start nodes to a target
  function shortestResistance(
    starts: { key: string; voltage?: number }[],
    target: string,
  ): { resistance: number; voltage: number } | null {
    const dist = new Map<string, number>()
    const voltageMap = new Map<string, number>()
    const visited = new Set<string>()

    const pq: { node: string; d: number }[] = []

    for (const s of starts) {
      dist.set(s.key, 0)
      if (s.voltage !== undefined) voltageMap.set(s.key, s.voltage)
      pq.push({ node: s.key, d: 0 })
    }

    while (pq.length > 0) {
      pq.sort((a, b) => a.d - b.d)
      const { node, d } = pq.shift()!

      if (node === target) {
        return { resistance: d, voltage: voltageMap.get(node) ?? 5.0 }
      }

      if (visited.has(node)) continue
      visited.add(node)

      const edges = graph.get(node) || []
      for (const e of edges) {
        const newD = d + e.resistance
        if (newD < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, newD)
          if (voltageMap.has(node)) {
            voltageMap.set(e.to, voltageMap.get(node)!)
          }
          pq.push({ node: e.to, d: newD })
        }
      }
    }

    return null
  }

  const runtime: Record<string, PartRuntime> = {}

  // 4. Solve for each component
  for (const part of state.parts) {
    if (part.type === "arduino-uno") {
      runtime[part.id] = {
        pin13High: pinStates["13"]?.state === "HIGH",
      }
    } else if (part.type === "led") {
      const anodeKey = key(part.id, "anode")
      const cathodeKey = key(part.id, "cathode")

      // Forward polarity path check
      const pathSourceToAnode = shortestResistance(activeSources, anodeKey)
      const pathCathodeToGround = shortestResistance(
        groundSinks.map((g) => ({ key: g })),
        cathodeKey,
      )

      if (pathSourceToAnode && pathCathodeToGround) {
        const totalResistance = pathSourceToAnode.resistance + pathCathodeToGround.resistance
        const vSupply = pathSourceToAnode.voltage
        const vForward = 2.0 // Typical 5mm red/green/yellow LED forward voltage
        const vResistor = Math.max(0, vSupply - vForward)
        const currentAmps = vResistor / (totalResistance + 0.1)
        const currentMa = currentAmps * 1000

        // ================= ELECTRICAL SAFETY CHECK =================
        // Safe LED current: 10 mA - 25 mA (ideal 220 - 330 ohm resistor)
        // Overcurrent: Without a resistor, resistance is near 0 ohms (< 60 ohms),
        // causing massive current (> 50 mA up to 1000 mA) which instantly burns the diode!
        if (totalResistance < 60) {
          runtime[part.id] = {
            burnt: true,
            level: 0,
            currentMa: Math.round(currentMa),
            resistorOhms: Math.round(totalResistance),
            warning: `💥 OVERCURRENT BURNOUT! Current was ${Math.round(currentMa)} mA (Max safe: 20 mA). Connect a 220Ω resistor in series!`,
          }
        } else if (totalResistance > 4700) {
          // Starved of current (e.g. 10k resistor): too dim to glow
          runtime[part.id] = {
            burnt: false,
            level: 0,
            currentMa: Number(currentMa.toFixed(2)),
            resistorOhms: Math.round(totalResistance),
            warning: `Current is too weak (${currentMa.toFixed(2)} mA) to illuminate LED.`,
          }
        } else {
          // Perfectly protected by current-limiting resistor!
          const brightness = Math.min(1.0, Math.max(0.3, currentMa / 15.0))
          runtime[part.id] = {
            burnt: false,
            level: brightness,
            currentMa: Number(currentMa.toFixed(1)),
            resistorOhms: Math.round(totalResistance),
          }
        }
      } else {
        // Check reverse polarity (Cathode to Source, Anode to Ground)
        const reverseSource = shortestResistance(activeSources, cathodeKey)
        const reverseGround = shortestResistance(
          groundSinks.map((g) => ({ key: g })),
          anodeKey,
        )
        if (reverseSource && reverseGround) {
          runtime[part.id] = {
            burnt: false,
            level: 0,
            warning: "Reverse Polarity: Anode (+) is wired to GND. Diodes block reverse current.",
          }
        } else {
          // Open circuit (not connected)
          runtime[part.id] = { burnt: false, level: 0 }
        }
      }
    } else if (part.type === "buzzer") {
      const posKey = key(part.id, "pos")
      const negKey = key(part.id, "neg")
      const toPos = shortestResistance(activeSources, posKey)
      const toNeg = shortestResistance(
        groundSinks.map((g) => ({ key: g })),
        negKey,
      )
      const active = Boolean(toPos && toNeg)
      runtime[part.id] = { level: active ? 1 : 0 }
    } else if (part.type === "servo") {
      const sigKey = key(part.id, "sig")
      let drivenAngle: number | undefined
      const unoPart = state.parts.find((pt) => pt.type === "arduino-uno")
      if (unoPart) {
        for (const [pinNum, p] of Object.entries(pinStates)) {
          if (p.angle !== undefined) {
            const cleanPin = pinNum.toLowerCase().replace(/^d/, "")
            const unoPinKey1 = key(unoPart.id, `d${cleanPin}`)
            const unoPinKey2 = key(unoPart.id, cleanPin)
            const path = shortestResistance([{ key: unoPinKey1 }, { key: unoPinKey2 }], sigKey)
            if (path) {
              drivenAngle = p.angle
              break
            }
          }
        }
      }
      runtime[part.id] = { angle: drivenAngle ?? Number(part.props.angle ?? 0) }
    } else if (part.type === "rgb-led") {
      // RGB LED: common-cathode, each color pin driven independently by PWM
      const gndKey = key(part.id, "gnd")
      const toGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      if (toGnd) {
        const getLevel = (pinId: string) => {
          const pk = key(part.id, pinId)
          const path = shortestResistance(activeSources, pk)
          if (!path) return 0
          const totalR = path.resistance + toGnd.resistance
          if (totalR < 60) return 0 // burnt without resistor
          const current = Math.max(0, path.voltage - 2.0) / (totalR + 0.1) * 1000
          return Math.min(1.0, Math.max(0, current / 15.0))
        }
        runtime[part.id] = {
          redLevel: getLevel("red"),
          greenLevel: getLevel("green"),
          blueLevel: getLevel("blue"),
        }
      } else {
        runtime[part.id] = { redLevel: 0, greenLevel: 0, blueLevel: 0 }
      }
    } else if (part.type === "seven-segment") {
      // 7-Segment: each segment pin checked for power
      const comKey = key(part.id, "com")
      const toComGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), comKey)
      const segments: Record<string, boolean> = {}
      if (toComGnd) {
        for (const segId of ["a", "b", "c", "d", "e", "f", "g", "dp"]) {
          const segKey = key(part.id, segId)
          const path = shortestResistance(activeSources, segKey)
          segments[segId] = Boolean(path)
        }
      }
      runtime[part.id] = { segments }
    } else if (part.type === "lcd-i2c") {
      // LCD: check power connectivity, text comes from pinStates
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasPower = shortestResistance(activeSources, vccKey)
      const hasGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      const powered = Boolean(hasPower && hasGnd)
      runtime[part.id] = {
        lcdBacklight: powered,
        lcdLine1: powered ? (pinStates["lcd_line1"] as unknown as string || "") : "",
        lcdLine2: powered ? (pinStates["lcd_line2"] as unknown as string || "") : "",
      }
    } else if (part.type === "ultrasonic") {
      // Ultrasonic sensor: powered = shows distance from inspector slider
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasPower = shortestResistance(activeSources, vccKey)
      const hasGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      const powered = Boolean(hasPower && hasGnd)
      const dist = powered ? Number(part.props.distance ?? 100) : undefined
      runtime[part.id] = { sensorValue: dist }
    } else if (part.type === "pir-sensor") {
      // PIR: shows HIGH when motion triggered via inspector
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasPower = shortestResistance(activeSources, vccKey)
      const hasGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      const powered = Boolean(hasPower && hasGnd)
      const triggered = powered && part.props.motion === "true"
      runtime[part.id] = { level: triggered ? 1 : 0 }
    } else if (part.type === "ldr") {
      // LDR: resistance varies with light (inspector slider)
      const lightValue = Number(part.props.light ?? 512)
      runtime[part.id] = { sensorValue: lightValue }
    } else if (part.type === "tmp36") {
      // TMP36: temperature from inspector slider
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasPower = shortestResistance(activeSources, vccKey)
      const hasGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      const powered = Boolean(hasPower && hasGnd)
      const temp = powered ? Number(part.props.temperature ?? 25) : undefined
      runtime[part.id] = { sensorValue: temp }
    } else if (part.type === "dc-motor") {
      // DC Motor: check power path
      const posKey = key(part.id, "pos")
      const negKey = key(part.id, "neg")
      const toPos = shortestResistance(activeSources, posKey)
      const toNeg = shortestResistance(groundSinks.map((g) => ({ key: g })), negKey)
      if (toPos && toNeg) {
        const voltage = toPos.voltage
        const rpm = Math.round(voltage * 200) // ~1000 RPM at 5V
        runtime[part.id] = { rpm, motorDirection: "cw" }
      } else {
        runtime[part.id] = { rpm: 0, motorDirection: "stopped" }
      }
    } else if (part.type === "npn-transistor") {
      // NPN: base receives signal → collector-emitter conducts
      const baseKey = key(part.id, "base")
      const toBase = shortestResistance(activeSources, baseKey)
      const conducting = Boolean(toBase)
      runtime[part.id] = { conducting }
      // When conducting, connect collector to emitter internally
      if (conducting) {
        addEdge(key(part.id, "collector"), key(part.id, "emitter"), 0.2)
      }
    } else if (part.type === "relay") {
      // Relay: IN pin receives signal → COM connects to NO (normally open)
      const inKey = key(part.id, "in")
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasSignal = shortestResistance(activeSources, inKey)
      const hasPower = shortestResistance(activeSources, vccKey)
      const hasGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      const energized = Boolean(hasSignal && hasPower && hasGnd)
      runtime[part.id] = { relayActive: energized }
      // When energized: COM ↔ NO; When not: COM ↔ NC
      if (energized) {
        addEdge(key(part.id, "com"), key(part.id, "no"), 0.1)
      } else {
        addEdge(key(part.id, "com"), key(part.id, "nc"), 0.1)
      }
    }
  }

  return runtime
}
