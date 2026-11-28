import type { CircuitState, PlacedPart } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { getBoardForPart, isBoardPart, type BoardDefinition } from "./board-registry"
import { BREADBOARD_COLUMNS, CATALOG } from "./components-catalog"
import { getLegacyBreadboardPinMappings } from "./breadboard-pins"
import { resolveCanonicalPin } from "./circuit-validator"
import { extractCodePinBindings, type CodePinBinding } from "./code-pin-bindings"

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
  score: number | null
  status: "empty" | "unwired" | "healthy" | "needs-attention" | "danger"
  issues: DiagnosticIssue[]
  criticalCount: number
  warningCount: number
  tipCount: number
  isEmpty?: boolean
}

export interface CircuitDoctorOptions {
  blocklyXml?: string
  generatedCode?: string
  codePinBindings?: CodePinBinding[]
}

const PASSIVE_SERIES_TYPES = new Set(["resistor", "pushbutton", "switch", "slide-switch"])

export function diagnoseCircuit(
  state: CircuitState,
  runtime: Record<string, PartRuntime> = {},
  _pinStates: Record<string, ArduinoPinState> = {},
  options: CircuitDoctorOptions = {},
): CircuitHealthReport {
  if (state.parts.length === 0) {
    return {
      score: null,
      status: "empty",
      issues: [],
      criticalCount: 0,
      warningCount: 0,
      tipCount: 0,
      isEmpty: true,
    }
  }

  const issues: DiagnosticIssue[] = []

  const partMap = new Map<string, PlacedPart>()
  for (const p of state.parts) {
    partMap.set(p.id, p)
  }

  // Build connected pins set and wire graph (canonicalizing legacy pin aliases)
  const pinWires = new Map<string, string[]>()
  for (const w of state.wires) {
    const p1 = partMap.get(w.from.partId)
    const p2 = partMap.get(w.to.partId)
    const pin1 = p1 ? resolveCanonicalPin(p1.type, w.from.pinId) : w.from.pinId.toLowerCase()
    const pin2 = p2 ? resolveCanonicalPin(p2.type, w.to.pinId) : w.to.pinId.toLowerCase()
    const k1 = `${w.from.partId}:${pin1}`
    const k2 = `${w.to.partId}:${pin2}`
    if (!pinWires.has(k1)) pinWires.set(k1, [])
    if (!pinWires.has(k2)) pinWires.set(k2, [])
    pinWires.get(k1)!.push(k2)
    pinWires.get(k2)!.push(k1)
  }

  const boardPart = state.parts.find((p) => isBoardPart(p.type))
  const boardDef = boardPart ? getBoardForPart(boardPart) : undefined

  // Identify real board/battery rails; GPIO outputs are deliberately excluded.
  const supplySources = new Set<string>()
  const groundSources = new Set<string>()
  for (const controller of state.parts.filter((part) => isBoardPart(part.type))) {
    const definition = getBoardForPart(controller)
    if (!definition) continue
    for (const pin of [
      ...(definition.powerPins.v5 ?? []),
      ...(definition.powerPins.v33 ?? []),
    ]) supplySources.add(`${controller.id}:${pin}`)
    for (const pin of definition.powerPins.gnd) groundSources.add(`${controller.id}:${pin}`)
  }
  for (const source of state.parts.filter((part) => part.type === "battery")) {
    supplySources.add(`${source.id}:pos`)
    groundSources.add(`${source.id}:neg`)
  }

  // Breadboard holes and rails are copper-connected internally; model those
  // physical ties so a module on a powered rail is not falsely flagged.
  const breadboardLinks = new Map<string, string[]>()
  const linkBreadboard = (partId: string, a: string, b: string) => {
    const keyA = `${partId}:${a}`
    const keyB = `${partId}:${b}`
    if (!breadboardLinks.has(keyA)) breadboardLinks.set(keyA, [])
    if (!breadboardLinks.has(keyB)) breadboardLinks.set(keyB, [])
    breadboardLinks.get(keyA)!.push(keyB)
    breadboardLinks.get(keyB)!.push(keyA)
  }
  for (const breadboard of state.parts.filter((part) => part.type === "breadboard")) {
    for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
      for (const rows of [["a", "b", "c", "d", "e"], ["f", "g", "h", "i", "j"]]) {
        for (let index = 1; index < rows.length; index++) {
          linkBreadboard(breadboard.id, `${rows[index - 1]}_${column}`, `${rows[index]}_${column}`)
        }
      }
      if (column < BREADBOARD_COLUMNS) {
        for (const rail of ["pos_t", "neg_t", "pos_b", "neg_b"]) {
          linkBreadboard(breadboard.id, `${rail}_${column}`, `${rail}_${column + 1}`)
        }
      }
    }
    for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) {
      linkBreadboard(breadboard.id, legacy, canonical)
    }
  }

  const reachesRail = (start: string, targets: Set<string>) => {
    const visited = new Set<string>()
    const queue = [start]
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      if (targets.has(current)) return true
      if (visited.has(current)) continue
      visited.add(current)
      for (const neighbor of pinWires.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor)
      }
      for (const neighbor of breadboardLinks.get(current) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor)
      }
    }
    return false
  }

  const traceLedLegReach = (startKey: string) => {
    const visited = new Set<string>()
    const queue = [startKey]
    const resistors = new Set<PlacedPart>()
    const boardGpioPins = new Set<string>()
    let hasGround = false
    let hasPower = false

    for (let idx = 0; idx < queue.length; idx++) {
      const current = queue[idx]
      if (visited.has(current)) continue
      visited.add(current)

      if (groundSources.has(current)) hasGround = true
      if (supplySources.has(current)) hasPower = true

      const [cPartId, cPinId] = current.split(":")
      const cPart = partMap.get(cPartId)
      if (cPart && isBoardPart(cPart.type)) {
        const bDef = getBoardForPart(cPart)
        const bPin = bDef?.pins.find((p) => p.id.toLowerCase() === cPinId?.toLowerCase())
        if (bPin && (bPin.kind === "digital" || bPin.kind === "analog")) {
          boardGpioPins.add(current)
        }
      }

      if (cPart?.type === "resistor") {
        resistors.add(cPart)
      }

      for (const n of pinWires.get(current) ?? []) {
        if (!visited.has(n)) queue.push(n)
      }
      for (const n of breadboardLinks.get(current) ?? []) {
        if (!visited.has(n)) queue.push(n)
      }

      // Traverse internally across opposite terminals of passive series parts (e.g. resistor on cathode/GND or anode leg)
      if (cPart && PASSIVE_SERIES_TYPES.has(cPart.type)) {
        const cDef = CATALOG[cPart.type]
        for (const pDef of cDef?.pins ?? []) {
          const sibKey = `${cPart.id}:${pDef.id}`
          if (sibKey !== current && !visited.has(sibKey) && (pinWires.has(sibKey) || breadboardLinks.has(sibKey))) {
            queue.push(sibKey)
          }
        }
      }
    }

    return {
      resistors: Array.from(resistors),
      boardGpioPins: Array.from(boardGpioPins),
      hasGround,
      hasPower,
    }
  }

  // 1. Check Overcurrent Burnout & Static Electrical Polarity/Ground/Safety on LEDs
  for (const part of state.parts) {
    if (part.type === "led") {
      const rt = runtime[part.id]
      const anodeKey = `${part.id}:anode`
      const cathodeKey = `${part.id}:cathode`
      const anodeWired = (pinWires.get(anodeKey)?.length ?? 0) > 0
      const cathodeWired = (pinWires.get(cathodeKey)?.length ?? 0) > 0
      let staticRevDetected = false

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
      } else if (state.wires.length > 0 && (anodeWired || cathodeWired)) {
        if (!anodeWired || !cathodeWired) {
          const missingPin = !cathodeWired ? "cathode" : "anode"
          issues.push({
            id: `led-open-circuit-${part.id}`,
            severity: "critical",
            title: missingPin === "cathode" ? "Missing Ground Return on LED" : "Open LED Anode Connection",
            message: `LED '${part.id}' ${missingPin} (${missingPin === "cathode" ? "-" : "+"}) is disconnected, leaving an open circuit with no closed current loop.`,
            suggestion:
              missingPin === "cathode"
                ? `Connect ${part.id} Cathode (-) to Ground (GND).`
                : `Connect ${part.id} Anode (+) through a 220Ω series resistor to a GPIO signal or power rail.`,
            involvedPartIds: [part.id],
            involvedPinIds: [missingPin],
            category: "wiring",
          })
        } else {
          const anodeReach = traceLedLegReach(anodeKey)
          const cathodeReach = traceLedLegReach(cathodeKey)
          const isStaticReverse =
            anodeReach.hasGround &&
            !anodeReach.hasPower &&
            anodeReach.boardGpioPins.length === 0 &&
            (cathodeReach.hasPower || cathodeReach.boardGpioPins.length > 0)

          if (isStaticReverse || rt?.warning?.includes("Reverse Polarity")) {
            staticRevDetected = true
            issues.push({
              id: `led-rev-pol-${part.id}`,
              severity: "critical",
              title: "LED Reverse Polarity",
              message: "The LED Anode (+) is wired toward Ground while Cathode (-) faces the voltage/signal source. Diodes only conduct in forward bias (and a series resistor does not protect against reverse polarity).",
              suggestion: "Swap the LED connections: wire Anode (+) toward the resistor/positive signal and Cathode (-) toward Ground.",
              involvedPartIds: [part.id],
              involvedPinIds: ["anode", "cathode"],
              category: "wiring",
            })
          } else if (!cathodeReach.hasGround) {
            issues.push({
              id: `led-missing-gnd-${part.id}`,
              severity: "critical",
              title: "Missing Ground Return on LED",
              message: `LED '${part.id}' Cathode (-) does not reach a valid Ground (GND) return path.`,
              suggestion: `Route ${part.id} Cathode (-) to a board or battery Ground (GND) pin.`,
              involvedPartIds: [part.id],
              involvedPinIds: ["cathode"],
              category: "wiring",
            })
          } else if (
            (anodeReach.hasPower || anodeReach.boardGpioPins.length > 0) &&
            anodeReach.resistors.length === 0 &&
            cathodeReach.resistors.length === 0
          ) {
            issues.push({
              id: `led-no-resistor-${part.id}`,
              severity: "critical",
              title: "Missing Series Current-Limiting Resistor",
              message: `LED '${part.id}' is in a closed drive path to GND without a series current-limiting resistor, risking overcurrent burnout.`,
              suggestion: `Insert a 220Ω–330Ω resistor in series with ${part.id}.`,
              involvedPartIds: [part.id],
              involvedPinIds: ["anode", "cathode"],
              category: "safety",
            })
          }
        }
      }

      if (!staticRevDetected && rt?.warning?.includes("Reverse Polarity") && !rt?.burnt) {
        issues.push({
          id: `led-rev-pol-${part.id}`,
          severity: "critical",
          title: "LED Reverse Polarity",
          message: "The LED Anode (+) is wired to Ground while Cathode (-) is wired to Power. Diodes only conduct in forward bias.",
          suggestion: "Flip the LED: connect Anode (+) to the positive voltage signal and Cathode (-) to Ground.",
          involvedPartIds: [part.id],
          involvedPinIds: ["anode", "cathode"],
          category: "wiring",
        })
      }
    } else if (part.type === "rgb-led") {
      const rt = runtime[part.id]
      if (rt?.warning?.includes("Reverse Polarity")) {
        issues.push({
          id: `rgb-led-rev-pol-${part.id}`,
          severity: "warning",
          title: "RGB LED Reverse Polarity",
          message: rt.warning,
          suggestion: "Connect the RGB LED common cathode (GND) to circuit ground, and route each red, green and blue anode through its own current-limiting resistor to its driver pin.",
          involvedPartIds: [part.id],
          involvedPinIds: ["red", "green", "blue", "gnd"],
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
          if (b?.powerPins.v5?.includes(pinId) || pinId === "5v") {
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

  // 4. Check missing supply/return wiring from component catalogue metadata.
  // Required pin groups define acceptable alternatives; keep diagnostics aligned
  // with the same pin metadata used by the template validator.
  for (const part of state.parts) {
    if (isBoardPart(part.type) || part.type === "battery" || part.type === "breadboard") continue

    const definition = CATALOG[part.type]
    if (!definition) continue

    const pinsById = new Map(definition.pins.map((pin) => [pin.id, pin]))
    const isWired = (pinId: string) => pinWires.has(part.id + ":" + pinId)
    const reachesSupply = (pinId: string) => reachesRail(part.id + ":" + pinId, supplySources)
    const reachesGround = (pinId: string) => reachesRail(part.id + ":" + pinId, groundSources)
    const requiredGroups = definition.requiredPinGroups ?? []
    const powerGroups = requiredGroups.filter((group) =>
      group.some((pinId) => pinsById.get(pinId)?.kind === "power"),
    )
    const groundGroups = requiredGroups.filter((group) =>
      group.some((pinId) => pinsById.get(pinId)?.kind === "ground"),
    )
    if (powerGroups.length === 0 || groundGroups.length === 0) continue
    if (!definition.pins.some((pin) => isWired(pin.id))) continue

    const missingPowerGroups = powerGroups.filter((group) => !group.some(reachesSupply))
    const missingGroundGroups = groundGroups.filter((group) => !group.some(reachesGround))
    if (missingPowerGroups.length === 0 && missingGroundGroups.length === 0) continue

    const describeGroup = (group: string[]) =>
      group.map((pinId) => pinsById.get(pinId)?.label ?? pinId).join(" / ")
    const missing = [
      ...missingPowerGroups.map((group) => "power (" + describeGroup(group) + ")"),
      ...missingGroundGroups.map((group) => "ground (" + describeGroup(group) + ")"),
    ]

    issues.push({
      id: "sensor-unpowered-" + part.id,
      severity: "warning",
      title: "Unpowered Module: " + definition.name,
      message: definition.name + " is wired into the circuit but is not connected to a real board/battery power rail and common ground for its required supply pins (" + missing.join(" and ") + "). A GPIO HIGH signal is not a substitute for module power.",
      suggestion: "Connect the module power pin group (" + powerGroups.map(describeGroup).join("; ") + ") to an appropriate supply and its ground pin group (" + groundGroups.map(describeGroup).join("; ") + ") to common ground.",
      involvedPartIds: [part.id],
      category: "wiring",
    })
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
          const isPwm = pin?.capabilities?.pwm === true
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

  // 7. Check Code-to-Wiring Pin Mismatch when Blockly XML / C++ code bindings are supplied
  if (boardDef && boardPart && state.wires.length > 0 && (options.blocklyXml || options.generatedCode || (options.codePinBindings && options.codePinBindings.length > 0))) {
    const codeBindings =
      options.codePinBindings ??
      extractCodePinBindings(options.blocklyXml, options.generatedCode, boardPart.type)

    if (codeBindings.length > 0) {
      const codePinSet = new Set(codeBindings.map((b) => b.pinId.toLowerCase()))
      const wiredDigitalPins: string[] = []
      for (const pin of boardDef.pins) {
        if (pin.kind === "digital" && (pinWires.get(`${boardPart.id}:${pin.id.toLowerCase()}`)?.length ?? 0) > 0) {
          wiredDigitalPins.push(pin.id.toLowerCase())
        }
      }
      const unreferencedDigital = wiredDigitalPins.filter((p) => !codePinSet.has(p))
      for (const binding of codeBindings) {
        if (binding.configuredMode !== "OUTPUT" && binding.configuredMode !== "PWM" && binding.configuredMode !== "SERVO") {
          continue
        }
        const codePin = binding.pinId.toLowerCase()
        const isCodePinWired = (pinWires.get(`${boardPart.id}:${codePin}`)?.length ?? 0) > 0
        if (!isCodePinWired && unreferencedDigital.length > 0) {
          const actualList = unreferencedDigital.map((p) => p.toUpperCase()).join(", ")
          issues.push({
            id: `code-pin-mismatch-${codePin}`,
            severity: "critical",
            title: `Code / Hardware Pin Mismatch (${codePin.toUpperCase()} vs ${actualList})`,
            message: `Program outputs to pin ${codePin.toUpperCase()}, whereas hardware is physically wired to pin ${actualList}. The driven signal will not reach the external load.`,
            suggestion: `Move the physical wire from ${actualList} to ${codePin.toUpperCase()} (or update the code block pin to match ${actualList}).`,
            involvedPartIds: [boardPart.id],
            involvedPinIds: [codePin, ...unreferencedDigital],
            category: "pinout",
          })
        }
      }
    }
  }

  // Deduplicate issues by ID
  const uniqueIssues = Array.from(new Map(issues.map((i) => [i.id, i])).values())

  const criticalCount = uniqueIssues.filter((i) => i.severity === "critical").length
  const warningCount = uniqueIssues.filter((i) => i.severity === "warning").length
  const tipCount = uniqueIssues.filter((i) => i.severity === "tip").length

  if (state.wires.length === 0) {
    return {
      score: null,
      status: "unwired",
      issues: uniqueIssues,
      criticalCount,
      warningCount,
      tipCount,
      isEmpty: false,
    }
  }

  const deductions = criticalCount * 35 + warningCount * 15 + tipCount * 5
  const score = Math.max(0, 100 - deductions)

  const status: CircuitHealthReport["status"] =
    criticalCount > 0 ? "danger" : warningCount > 0 ? "needs-attention" : "healthy"

  if (uniqueIssues.length === 0 && state.parts.length > 1 && state.wires.length > 0) {
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
    isEmpty: false,
  }
}
