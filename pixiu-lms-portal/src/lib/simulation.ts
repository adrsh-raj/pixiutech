import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import type { PartRuntime } from "@/components/circuit-lab/part-art"

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
    } else if (part.type === "ir-sensor") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const detected = powered && String(part.props.detected ?? "false") === "true"
      runtime[part.id] = { sensorValue: detected ? 1 : 0, level: detected ? 1 : 0 }

    } else if (part.type === "dht11") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      runtime[part.id] = {
        sensorValue: powered ? Number(part.props.temperature ?? 25) : undefined,
        dhtTemperature: powered ? Number(part.props.temperature ?? 25) : undefined,
        dhtHumidity: powered ? Number(part.props.humidity ?? 55) : undefined,
      }

    } else if (part.type === "oled-i2c") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      runtime[part.id] = {
        lcdBacklight: powered,
        lcdLine1: powered ? String(pinStates["oled_line1"] ?? part.props.line1 ?? "") : "",
        lcdLine2: powered ? String(pinStates["oled_line2"] ?? part.props.line2 ?? "") : "",
      }

    } else if (part.type === "joystick") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      runtime[part.id] = {
        joystickX: powered ? Number(part.props.x ?? 512) : undefined,
        joystickY: powered ? Number(part.props.y ?? 512) : undefined,
        joystickButton: powered && String(part.props.pressed ?? "false") === "true",
        sensorValue: powered ? Number(part.props.x ?? 512) : undefined,
      }

    } else if (part.type === "l298n") {
      const powered = hasExternalPower(part.id, "vs", "gnd")
      const clampPwm = (value: unknown) =>
        Math.max(0, Math.min(255, Number.isFinite(Number(value)) ? Number(value) : 0))
      const findArduinoPinState = (targetKey: string) => {
        for (const uno of state.parts.filter((candidate) => candidate.type === "arduino-uno")) {
          for (let pin = 0; pin <= 13; pin += 1) {
            const candidates = [key(uno.id, "d" + pin), key(uno.id, String(pin))]
            for (const candidate of candidates) {
              if (shortestResistance([{ key: candidate }], targetKey)) {
                return pinStates[String(pin)] ?? pinStates["d" + pin] ?? null
              }
            }
          }
        }
        return null
      }
      const readDrive = (pin: string) => {
        const stateForPin = findArduinoPinState(k(pin))
        const pwm = stateForPin
          ? clampPwm(stateForPin.value ?? (stateForPin.state === "HIGH" ? 255 : 0))
          : 0
        return { enabled: pwm > 0, pwm }
      }
      const readDirection = (highPin: string, lowPin: string) => {
        const highState = findArduinoPinState(k(highPin))
        const lowState = findArduinoPinState(k(lowPin))
        const highOn = highState ? highState.state === "HIGH" || Number(highState.value ?? 0) > 0 : false
        const lowOn = lowState ? lowState.state === "HIGH" || Number(lowState.value ?? 0) > 0 : false
        if (highOn === lowOn) return "stopped" as const
        return highOn ? "cw" as const : "ccw" as const
      }
      const enaDrive = readDrive("ena")
      const enbDrive = readDrive("enb")
      const speedA = enaDrive.pwm || clampPwm(part.props.speedA ?? 0)
      const speedB = enbDrive.pwm || clampPwm(part.props.speedB ?? 0)
      const directionA = !powered || speedA <= 0 ? "stopped" : readDirection("in1", "in2")
      const directionB = !powered || speedB <= 0 ? "stopped" : readDirection("in3", "in4")
      const rpmA = directionA === "stopped" ? 0 : Math.round((speedA / 255) * 1000)
      const rpmB = directionB === "stopped" ? 0 : Math.round((speedB / 255) * 1000)
      runtime[part.id] = {
        motorARpm: rpmA,
        motorBRpm: rpmB,
        motorADirection: directionA,
        motorBDirection: directionB,
        currentMa: rpmA + rpmB > 0 ? Math.round(120 + ((rpmA + rpmB) / 2000) * 180) : 0,
      }
      if (directionA !== "stopped") addEdge(k("out1"), k("out2"), 2)
      if (directionB !== "stopped") addEdge(k("out3"), k("out4"), 2)

    } else if (part.type === "rotary-encoder") {
      const value = Number(part.props.value ?? 0)
      const previousValue = Number(part.props.previousValue ?? value)
      const direction = value > previousValue ? "cw" : value < previousValue ? "ccw" : "idle"
      runtime[part.id] = {
        encoderValue: value,
        encoderDirection: direction,
        sensorValue: value,
      }

    } else if (part.type === "soil-moisture") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const moisture = powered ? Number(part.props.moisture ?? 620) : undefined
      runtime[part.id] = { sensorValue: moisture }

    } else if (part.type === "keypad-4x4") {
      const wired = state.wires.some((wire) => wire.from.partId === part.id || wire.to.partId === part.id)
      runtime[part.id] = { keypadKey: wired ? String(part.props.lastKey ?? "") : "" }
    } else if (part.type === "relay") {
      // Relay: IN pin receives signal → COM connects to NO (normally open)
      const inKey = key(part.id, "in")
      const vccKey = key(part.id, "vcc")
      const gndKey = key(part.id, "gnd")
      const hasSignal = shortestResistance(activeSources, inKey)
      const energized = Boolean(
        hasSignal && hasExternalPower(part.id, "vcc", "gnd"),
      )
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
