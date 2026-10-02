import type { CircuitState, PlacedPart } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { getBoardForPart, isBoardPart } from "./board-registry"

export type DiagnosticSeverity = "critical" | "warning" | "tip" | "success"

export interface DiagnosticIssue {
  id: string
  severity: DiagnosticSeverity
  title: string
  message: string
  suggestion: string
  involvedPartIds: string[]
  involvedPinIds?: string[]
  category: "safety" | "wiring" | "pinout" | "protocol"
}

export interface CircuitHealthReport {
  score: number
  status: "healthy" | "needs-attention" | "danger"
  issues: DiagnosticIssue[]
  criticalCount: number
  warningCount: number
  tipCount: number
}

const PWM_PINS = new Set(["d3", "d5", "d6", "d9", "d10", "d11", "3", "5", "6", "9", "10", "11"])
const SERIAL_PINS = new Set(["d0", "d1", "0", "1"])
const I2C_PINS = new Set(["a4", "a5", "sda", "scl"])

export function diagnoseCircuit(
  state: CircuitState,
  runtime: Record<string, PartRuntime> = {},
  _pinStates: Record<string, ArduinoPinState> = {},
): CircuitHealthReport {
  const issues: DiagnosticIssue[] = []

  const partMap = new Map<string, PlacedPart>()
  for (const p of state.parts) {
    partMap.set(p.id, p)
  }

  // Build connected pins set and wire graph
  const pinWires = new Map<string, string[]>()
  for (const w of state.wires) {
    const k1 = `${w.from.partId}:${w.from.pinId}`
    const k2 = `${w.to.partId}:${w.to.pinId}`
    if (!pinWires.has(k1)) pinWires.set(k1, [])
    if (!pinWires.has(k2)) pinWires.set(k2, [])
    pinWires.get(k1)!.push(k2)
    pinWires.get(k2)!.push(k1)
  }

  const boardPart = state.parts.find((p) => isBoardPart(p.type))
  const boardDef = boardPart ? getBoardForPart(boardPart) : undefined

  // 1. Check for Overcurrent Burnout on LEDs
  for (const part of state.parts) {
    if (part.type === "led") {
      const rt = runtime[part.id]
      if (rt?.burnt) {
        issues.push({
          id: `led-burnout-${part.id}`,
          severity: "critical",
          title: "💥 LED Overcurrent Burnout!",
          message: `The LED is connected directly across power without a current-limiting resistor. It absorbed ${rt.currentMa ?? 100}+ mA and burned out.`,
          suggestion: `Insert a 220Ω to 330Ω resistor in series between the ${boardDef?.name ?? "Arduino"} pin/power rail and the LED Anode (+).`,
          involvedPartIds: [part.id],
          involvedPinIds: ["anode", "cathode"],
          category: "safety",
        })
      } else if (rt?.warning?.includes("Reverse Polarity")) {
        issues.push({
          id: `led-rev-pol-${part.id}`,
          severity: "warning",
          title: "LED Reverse Polarity",
          message: "The LED Anode (+) is wired to Ground while Cathode (-) is wired to Power. Diodes only conduct in forward bias.",
          suggestion: "Flip the LED: connect Anode (+) to the positive voltage signal and Cathode (-) to Ground.",
          involvedPartIds: [part.id],
          involvedPinIds: ["anode", "cathode"],
          category: "wiring",
        })
      }
    }
  }

  // 2. Check for Direct Short Circuit between Board Power Rails and GND
  if (boardDef && boardPart) {
    const pwrPins: string[] = []
    if (boardDef.powerPins.v5) pwrPins.push(...boardDef.powerPins.v5.map((p) => `${boardPart.id}:${p}`))
    if (boardDef.powerPins.v33) pwrPins.push(...boardDef.powerPins.v33.map((p) => `${boardPart.id}:${p}`))
    if (boardDef.powerPins.vin) pwrPins.push(...boardDef.powerPins.vin.map((p) => `${boardPart.id}:${p}`))
    const gndPins = boardDef.powerPins.gnd.map((p) => `${boardPart.id}:${p}`)

    const isDirectlyConnected = (startPin: string, targetPins: string[]) => {
      const visited = new Set<string>()
      const queue = [startPin]
      while (queue.length > 0) {
        const cur = queue.shift()!
        if (targetPins.includes(cur)) return true
        if (visited.has(cur)) continue
        visited.add(cur)
        const neighbors = pinWires.get(cur) || []
        for (const n of neighbors) {
          const [nPartId] = n.split(":")
          const nPart = partMap.get(nPartId)
          if (nPart && nPart.type === "resistor") continue
          if (!visited.has(n)) queue.push(n)
        }
      }
      return false
    }

    for (const pwr of pwrPins) {
      if (isDirectlyConnected(pwr, gndPins)) {
        issues.push({
          id: `power-short-circuit-${boardPart.id}`,
          severity: "critical",
          title: "⚡ Direct Short Circuit Detected!",
          message: `${boardDef.name} power rail is shorted directly to GND with zero resistance. On a physical board, this triggers thermal shutdown or fries the voltage regulator!`,
          suggestion: "Remove the wire connecting power directly to Ground. Ensure a load or resistor separates power from ground.",
          involvedPartIds: [boardPart.id],
          category: "safety",
        })
        break
      }
    }
  }

  // 3. Check for 3.3V Logic Overvoltage Protection (e.g. 5V wired directly into ESP32 or Pico GPIO)
  if (boardDef && boardPart && boardDef.logicVoltage <= 3.3) {
    const isDirectlyConnectedToOvervoltage = (gpioPin: string) => {
      const visited = new Set<string>()
      const queue = [gpioPin]
      while (queue.length > 0) {
        const cur = queue.shift()!
        const [pId, pinId] = cur.split(":")
        const p = partMap.get(pId)
        if (p?.type === "battery" && pinId === "pos") return { dangerous: true, source: "9V Battery" }
        if (p && isBoardPart(p.type)) {
          const b = getBoardForPart(p)
          if (b?.powerPins.v5?.includes(pinId) || b?.powerPins.vin?.includes(pinId) || pinId === "vin" || pinId === "5v") {
            return { dangerous: true, source: "5V Power Rail" }
          }
        }
        if (visited.has(cur)) continue
        visited.add(cur)
        const neighbors = pinWires.get(cur) || []
        for (const n of neighbors) {
          const [nPartId] = n.split(":")
          const nPart = partMap.get(nPartId)
          if (nPart && nPart.type === "resistor") continue
          if (!visited.has(n)) queue.push(n)
        }
      }
      return { dangerous: false, source: "" }
    }

    for (const pin of boardDef.pins) {
      if (pin.kind === "digital" || pin.kind === "analog") {
        const pinKeyStr = `${boardPart.id}:${pin.id}`
        if (pinWires.has(pinKeyStr)) {
          const ovCheck = isDirectlyConnectedToOvervoltage(pinKeyStr)
          if (ovCheck.dangerous) {
            issues.push({
              id: `overvoltage-gpio-${boardPart.id}-${pin.id}`,
              severity: "critical",
              title: `⚡ 5V Overvoltage on 3.3V Pin ${pin.label}`,
              message: `${boardDef.name} pin ${pin.label} operates at 3.3V logic and is NOT 5V tolerant. Connecting ${ovCheck.source} directly without a divider will damage the MCU's internal protection diodes!`,
              suggestion: "Insert a voltage divider (e.g., 1kΩ / 2kΩ resistors) or a bidirectional logic level shifter to step down the signal to 3.3V.",
              involvedPartIds: [boardPart.id],
              involvedPinIds: [pin.id],
              category: "safety",
            })
          }
        }
      }
    }
  }

  // 4. Check for Active Sensors missing Power or Ground
  const activeSensorTypes = ["ultrasonic", "dht11", "mq2-gas", "neopixel-ring", "oled-i2c", "lcd-i2c", "joystick", "l298n"]
  for (const part of state.parts) {
    if (activeSensorTypes.includes(part.type)) {
      const vccPin = `${part.id}:vcc`
      const gndPin = `${part.id}:gnd`
      const vsPin = `${part.id}:vs`

      const hasVcc = pinWires.has(vccPin) || pinWires.has(vsPin)
      const hasGnd = pinWires.has(gndPin)

      const hasDataWires = state.wires.some(
        (w) =>
          (w.from.partId === part.id && w.from.pinId !== "vcc" && w.from.pinId !== "gnd" && w.from.pinId !== "vs") ||
          (w.to.partId === part.id && w.to.pinId !== "vcc" && w.to.pinId !== "gnd" && w.to.pinId !== "vs"),
      )

      if (hasDataWires && (!hasVcc || !hasGnd)) {
        issues.push({
          id: `sensor-unpowered-${part.id}`,
          severity: "warning",
          title: `Unpowered Module: ${partMap.get(part.id)?.type.toUpperCase()}`,
          message: `The ${part.type} has signal lines connected, but ${!hasVcc ? "VCC" : ""}${!hasVcc && !hasGnd ? " and " : ""}${!hasGnd ? "GND" : ""} is disconnected. Active IC modules cannot operate unpowered.`,
          suggestion: `Connect ${part.type}'s VCC to ${boardDef?.name ?? "Arduino"} power (${boardDef?.logicVoltage ?? 5}V) and GND to GND.`,
          involvedPartIds: [part.id],
          category: "wiring",
        })
      }
    }
  }

  // 5. Check for Hardware Serial Pin Conflicts
  if (boardDef && boardPart && boardDef.serialPins) {
    const serialSet = new Set([boardDef.serialPins.rx.toLowerCase(), boardDef.serialPins.tx.toLowerCase()])
    for (const w of state.wires) {
      const boardPin = w.from.partId === boardPart.id ? w.from.pinId : w.to.partId === boardPart.id ? w.to.pinId : null
      if (boardPin && serialSet.has(boardPin.toLowerCase())) {
        const otherPartId = w.from.partId === boardPart.id ? w.to.partId : w.from.partId
        issues.push({
          id: `serial-conflict-${boardPin}`,
          severity: "tip",
          title: `Hardware Serial Conflict on Pin ${boardPin.toUpperCase()}`,
          message: `Pin ${boardPin.toUpperCase()} is reserved for ${boardDef.name} USB hardware serial communications (RX/TX). Using it for external components can prevent sketch uploads and cause serial noise.`,
          suggestion: `Move the wire connected to ${boardPin.toUpperCase()} to another digital GPIO pin.`,
          involvedPartIds: [boardPart.id, otherPartId],
          category: "pinout",
        })
      }
    }
  }

  // 6. Check for Servo on Non-PWM Pin
  for (const part of state.parts) {
    if (part.type === "servo" && boardDef && boardPart) {
      const sigKey = `${part.id}:sig`
      const neighbors = pinWires.get(sigKey) || []
      for (const n of neighbors) {
        const [nPartId, nPinId] = n.split(":")
        if (nPartId === boardPart.id) {
          const pin = boardDef.pins.find((p) => p.id === nPinId.toLowerCase() || p.alternateNames?.includes(nPinId.toLowerCase()))
          const isPwm = pin?.capabilities?.pwm ?? PWM_PINS.has(nPinId.toLowerCase())
          if (!isPwm) {
            issues.push({
              id: `servo-non-pwm-${part.id}`,
              severity: "tip",
              title: "Servo on Non-PWM Pin",
              message: `Servo signal is wired to ${boardDef.name} Pin ${nPinId.toUpperCase()}. While software servo works on any pin, hardware PWM pins provide jitter-free pulse timing.`,
              suggestion: `Consider moving servo signal to a hardware PWM pin on ${boardDef.name}.`,
              involvedPartIds: [part.id, boardPart.id],
              category: "pinout",
            })
          }
        }
      }
    }
  }

  // 7. Check for I2C Displays on Non-I2C Pins
  for (const part of state.parts) {
    if ((part.type === "lcd-i2c" || part.type === "oled-i2c") && boardDef && boardPart) {
      const sdaKey = `${part.id}:sda`
      const sclKey = `${part.id}:scl`

      const sdaNeighbors = pinWires.get(sdaKey) || []
      const sclNeighbors = pinWires.get(sclKey) || []

      const targetSda = boardDef.i2cPins?.sda.toLowerCase() ?? "a4"
      const targetScl = boardDef.i2cPins?.scl.toLowerCase() ?? "a5"

      const checkI2c = (pinName: "sda" | "scl", neighbors: string[]) => {
        const expectedPin = pinName === "sda" ? targetSda : targetScl
        for (const n of neighbors) {
          const [nPartId, nPinId] = n.split(":")
          if (nPartId === boardPart.id) {
            const raw = nPinId.toLowerCase()
            const pinMatch = raw === expectedPin || (boardDef.pins.find((p) => p.id === raw)?.capabilities?.i2cRole === pinName)
            if (!pinMatch) {
              issues.push({
                id: `i2c-wrong-pin-${part.id}-${pinName}`,
                severity: "warning",
                title: `I2C ${pinName.toUpperCase()} Miswired`,
                message: `${part.type.toUpperCase()} ${pinName.toUpperCase()} is connected to ${boardDef.name} pin ${nPinId.toUpperCase()}. On ${boardDef.name}, I2C hardware bus is on ${targetSda.toUpperCase()} (SDA) and ${targetScl.toUpperCase()} (SCL).`,
                suggestion: `Connect SDA to Pin ${targetSda.toUpperCase()} and SCL to Pin ${targetScl.toUpperCase()} on ${boardDef.name}.`,
                involvedPartIds: [part.id, boardPart.id],
                category: "protocol",
              })
            }
          }
        }
      }

      checkI2c("sda", sdaNeighbors)
      checkI2c("scl", sclNeighbors)
    }
  }

  // Deduplicate issues by ID
  const uniqueIssues = Array.from(new Map(issues.map((i) => [i.id, i])).values())

  const criticalCount = uniqueIssues.filter((i) => i.severity === "critical").length
  const warningCount = uniqueIssues.filter((i) => i.severity === "warning").length
  const tipCount = uniqueIssues.filter((i) => i.severity === "tip").length

  const deductions = criticalCount * 35 + warningCount * 15 + tipCount * 5
  const score = Math.max(0, 100 - deductions)

  const status: CircuitHealthReport["status"] =
    criticalCount > 0 ? "danger" : warningCount > 0 ? "needs-attention" : "healthy"

  if (uniqueIssues.length === 0 && state.parts.length > 1) {
    uniqueIssues.push({
      id: "circuit-perfect",
      severity: "success",
      title: "Circuit 100% Healthy",
      message: "All electrical loops are closed, components are properly protected with series resistors, and no pin conflicts were detected.",
      suggestion: "Your circuit is ready for execution, simulation, or physical breadboard assembly!",
      involvedPartIds: [],
      category: "safety",
    })
  }

  return {
    score,
    status,
    issues: uniqueIssues,
    criticalCount,
    warningCount,
    tipCount,
  }
}
