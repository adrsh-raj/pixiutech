import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { getBoardForPart } from "./board-registry"

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

    const board = getBoardForPart(part)
    if (board) {
      if (board.powerPins.v5) {
        for (const p of board.powerPins.v5) activeSources.push({ key: k(p), voltage: 5.0 })
      }
      if (board.powerPins.v33) {
        for (const p of board.powerPins.v33) activeSources.push({ key: k(p), voltage: 3.3 })
      }
      if (board.powerPins.vin) {
        for (const p of board.powerPins.vin) activeSources.push({ key: k(p), voltage: 5.0 })
      }
      for (const g of board.powerPins.gnd) {
        groundSinks.push(k(g))
      }

      // Check digital and analog pins
      for (const pin of board.pins) {
        if (pin.kind === "digital" || pin.kind === "analog") {
          const pinId = pin.id
          const altId = pinId.replace(/^d|^gpio/, "")
          const pState = pinStates[pinId] ?? pinStates[altId]
          if (pState?.state === "HIGH" || (pState?.value ?? 0) > 0) {
            const duty = pState.value !== undefined ? pState.value / 255 : 1.0
            activeSources.push({ key: k(pinId), voltage: board.logicVoltage * duty })
          } else {
            // LOW digital pin acts as Ground sink
            groundSinks.push(k(pinId))
          }
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

  function hasExternalPower(partId: string, vccPin = "vcc", gndPin = "gnd"): boolean {
    const vccPath = shortestResistance(activeSources, key(partId, vccPin))
    const gndPath = shortestResistance(
      groundSinks.map((g) => ({ key: g })),
      key(partId, gndPin),
    )
    return Boolean(vccPath && gndPath)
  }

  const runtime: Record<string, PartRuntime> = {}

  // 4. Solve for each component in the circuit
  for (const part of state.parts) {
    const k = (pin: string) => key(part.id, pin)

    const board = getBoardForPart(part)
    if (board) {
      const activePins: Record<string, boolean | number> = {}
      for (const pin of board.pins) {
        const pinId = pin.id
        const altId = pinId.replace(/^d|^gpio/, "")
        const pState = pinStates[pinId] ?? pinStates[altId]
        if (pState?.state === "HIGH") {
          activePins[pinId] = true
          activePins[altId] = true
        } else if ((pState?.value ?? 0) > 0) {
          activePins[pinId] = pState.value!
          activePins[altId] = pState.value!
        }
      }

      // Check board built-in LED state (D13 on Uno, D2 on ESP32)
      const ledPState = board.builtInLedPin
        ? pinStates[board.builtInLedPin] ??
          pinStates[board.builtInLedPin.replace(/^d|^gpio/, "")] ??
          pinStates[`gpio${board.builtInLedPin.replace(/^d|^gpio/, "")}`]
        : undefined
      const isBuiltInLedActive = Boolean(ledPState && (ledPState.state === "HIGH" || (ledPState.value ?? 0) > 0))

      runtime[part.id] = {
        pin13High: board.id === "arduino-uno" ? isBuiltInLedActive : undefined,
        pin2High: board.id === "esp32-devkit" ? isBuiltInLedActive : undefined,
        activePins,
      }
    } else if (part.type === "led") {
      const anodeKey = k("anode")
      const cathodeKey = k("cathode")

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
    } else if (part.type === "rgb-led") {
      const gndKey = k("gnd")
      const toGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), gndKey)
      if (toGnd) {
        const getLevel = (pinId: string) => {
          const pk = k(pinId)
          const path = shortestResistance(activeSources, pk)
          if (!path) return 0
          const totalR = path.resistance + toGnd.resistance
          if (totalR < 60) return 0 // burnt without resistor
          const current = (Math.max(0, path.voltage - 2.0) / (totalR + 0.1)) * 1000
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
    } else if (part.type === "neopixel-ring") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const diKey = k("di")
      const hasSignal = shortestResistance(activeSources, diKey)
      const numPixels = Number(part.props.numPixels ?? 8)
      const pattern = String(part.props.pattern ?? "rainbow")
      const customColor = String(part.props.color ?? "#38bdf8")

      const colors: string[] = []
      if (powered && (hasSignal || pattern !== "off")) {
        const rainbowPalette = [
          "#ef4444", "#f97316", "#eab308", "#22c55e",
          "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
        ]
        for (let i = 0; i < numPixels; i++) {
          if (pattern === "rainbow") {
            colors.push(rainbowPalette[i % rainbowPalette.length])
          } else if (pattern === "chase") {
            const step = Math.floor(Date.now() / 200) % numPixels
            colors.push(i === step ? customColor : "#1e293b")
          } else if (pattern === "solid") {
            colors.push(customColor)
          } else {
            colors.push(customColor)
          }
        }
      } else {
        for (let i = 0; i < numPixels; i++) {
          colors.push("#0f172a")
        }
      }
      runtime[part.id] = {
        pixelColors: colors,
        level: powered ? 1 : 0,
      }
    } else if (part.type === "mq2-gas") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const gasLevel = Number(part.props.gasLevel ?? 150)
      const threshold = Number(part.props.threshold ?? 350)
      const gasAlert = powered && gasLevel >= threshold
      runtime[part.id] = {
        gasLevel: powered ? gasLevel : 0,
        gasAlert,
        sensorValue: powered ? gasLevel : undefined,
        level: gasAlert ? 1 : 0,
      }
    } else if (part.type === "buzzer") {
      const posKey = k("pos")
      const negKey = k("neg")
      const toPos = shortestResistance(activeSources, posKey)
      const toNeg = shortestResistance(groundSinks.map((g) => ({ key: g })), negKey)
      const active = Boolean(toPos && toNeg)
      runtime[part.id] = { level: active ? 1 : 0 }
    } else if (part.type === "servo") {
      const sigKey = k("sig")
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
    } else if (part.type === "seven-segment") {
      const comKey = k("com")
      const toComGnd = shortestResistance(groundSinks.map((g) => ({ key: g })), comKey)
      const segments: Record<string, boolean> = {}
      if (toComGnd) {
        for (const segId of ["a", "b", "c", "d", "e", "f", "g", "dp"]) {
          const segKey = k(segId)
          const path = shortestResistance(activeSources, segKey)
          segments[segId] = Boolean(path)
        }
      }
      runtime[part.id] = { segments }
    } else if (part.type === "lcd-i2c") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      runtime[part.id] = {
        lcdBacklight: powered,
        lcdLine1: powered ? String(pinStates["lcd_line1"] ?? part.props.line1 ?? "") : "",
        lcdLine2: powered ? String(pinStates["lcd_line2"] ?? part.props.line2 ?? "") : "",
      }
    } else if (part.type === "oled-i2c") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      runtime[part.id] = {
        lcdBacklight: powered,
        lcdLine1: powered ? String(pinStates["oled_line1"] ?? part.props.line1 ?? "") : "",
        lcdLine2: powered ? String(pinStates["oled_line2"] ?? part.props.line2 ?? "") : "",
      }
    } else if (part.type === "ultrasonic") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const dist = powered ? Number(part.props.distance ?? 42) : undefined
      runtime[part.id] = { sensorValue: dist }
    } else if (part.type === "pir-sensor") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const triggered = powered && String(part.props.motion ?? "false") === "true"
      runtime[part.id] = { level: triggered ? 1 : 0 }
    } else if (part.type === "ldr") {
      const lightValue = Number(part.props.light ?? 512)
      runtime[part.id] = { sensorValue: lightValue }
    } else if (part.type === "tmp36") {
      const powered = hasExternalPower(part.id, "vcc", "gnd")
      const temp = powered ? Number(part.props.temperature ?? 25) : undefined
      runtime[part.id] = { sensorValue: temp }
    } else if (part.type === "dc-motor") {
      const posKey = k("pos")
      const negKey = k("neg")
      const toPos = shortestResistance(activeSources, posKey)
      const toNeg = shortestResistance(groundSinks.map((g) => ({ key: g })), negKey)
      if (toPos && toNeg) {
        const voltage = toPos.voltage
        const rpm = Math.round(voltage * 200)
        runtime[part.id] = { rpm, motorDirection: "cw" }
      } else {
        runtime[part.id] = { rpm: 0, motorDirection: "stopped" }
      }
    } else if (part.type === "npn-transistor") {
      const baseKey = k("base")
      const toBase = shortestResistance(activeSources, baseKey)
      const conducting = Boolean(toBase)
      runtime[part.id] = { conducting }
      if (conducting) {
        addEdge(k("collector"), k("emitter"), 0.2)
      }
    } else if (part.type === "relay") {
      const inKey = k("in")
      const hasSignal = shortestResistance(activeSources, inKey)
      const energized = Boolean(hasSignal && hasExternalPower(part.id, "vcc", "gnd"))
      runtime[part.id] = { relayActive: energized }
      if (energized) {
        addEdge(k("com"), k("no"), 0.1)
      } else {
        addEdge(k("com"), k("nc"), 0.1)
      }
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
        if (!stateForPin) {
          return { connected: false, enabled: false, pwm: 0 }
        }
        const pwm = clampPwm(
          stateForPin.value ?? (stateForPin.state === "HIGH" ? 255 : 0),
        )
        return { connected: true, enabled: pwm > 0, pwm }
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
      const speedA = enaDrive.connected ? enaDrive.pwm : clampPwm(part.props.speedA ?? 0)
      const speedB = enbDrive.connected ? enbDrive.pwm : clampPwm(part.props.speedB ?? 0)
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
    }
  }

  return runtime
}
