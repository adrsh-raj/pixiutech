import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outdir = join(tmpdir(), `pixiu-template-electrical-audit-${Date.now()}`)
await build({
  entryPoints: [
    new URL("../../src/lib/templates.ts", import.meta.url).pathname,
    new URL("../../src/lib/components-catalog.ts", import.meta.url).pathname,
    new URL("../../src/lib/board-registry.ts", import.meta.url).pathname,
    new URL("../../src/lib/lesson-engine.ts", import.meta.url).pathname,
  ],
  bundle: true,
  format: "esm",
  outdir,
  platform: "node",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})

const [{ TEMPLATES }, { CATALOG }, boardModule, { LESSONS }] = await Promise.all([
  import(`file://${join(outdir, "templates.js")}`),
  import(`file://${join(outdir, "components-catalog.js")}`),
  import(`file://${join(outdir, "board-registry.js")}`),
  import(`file://${join(outdir, "lesson-engine.js")}`),
])
const { getBoardForPart, isBoardPart } = boardModule

function normalize(value) {
  return String(value ?? "").trim().toLowerCase()
}

function resolveBoardPin(board, rawPin) {
  const raw = normalize(rawPin)
  if (!board || !raw) return null
  return board.pins.find((pin) =>
    normalize(pin.id) === raw ||
    normalize(pin.label) === raw ||
    (pin.alternateNames ?? []).some((alias) => normalize(alias) === raw),
  ) ?? null
}

function circuitGraph(circuit) {
  const partMap = new Map(circuit.parts.map((part) => [part.id, part]))
  const boardMap = new Map(circuit.parts.filter((part) => isBoardPart(part.type)).map((part) => [part.id, getBoardForPart(part)]))
  const normalizeNode = (partId, pinId) => {
    const board = boardMap.get(partId)
    if (board) {
      const pin = resolveBoardPin(board, pinId)
      if (pin) return `${partId}:${pin.id}`
      const raw = normalize(pinId)
      for (const rail of ["v5", "v33", "vin", "gnd"]) {
        if ((board.powerPins[rail] ?? []).some((item) => normalize(item) === raw)) return `${partId}:${raw}`
      }
    }
    return `${partId}:${normalize(pinId)}`
  }
  const adjacency = new Map()
  const add = (a, b, resistorId = null) => {
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a).push({ node: b, resistorId })
    adjacency.get(b).push({ node: a, resistorId })
  }

  for (const wire of circuit.wires) {
    add(
      normalizeNode(wire.from.partId, wire.from.pinId),
      normalizeNode(wire.to.partId, wire.to.pinId),
    )
  }
  for (const part of circuit.parts) {
    if (part.type === "resistor") add(`${part.id}:a`, `${part.id}:b`, part.id)
    if (part.type === "potentiometer") {
      // A potentiometer is an adjustable divider, not a fixed current-limiting
      // resistor. Never let it satisfy the LED series-protection audit.
      add(`${part.id}:t1`, `${part.id}:wiper`)
      add(`${part.id}:wiper`, `${part.id}:t2`)
    }
    if (part.type === "pushbutton") {
      add(`${part.id}:p1a`, `${part.id}:p1b`)
      add(`${part.id}:p2a`, `${part.id}:p2b`)
    }
    if (part.type === "relay") {
      // Topology audit considers both possible contact states. Runtime chooses
      // NO or NC from the relay coil state.
      add(`${part.id}:com`, `${part.id}:no`)
      add(`${part.id}:com`, `${part.id}:nc`)
    }
    if (isBoardPart(part.type)) {
      const board = getBoardForPart(part)
      for (const group of [board.powerPins.v5 ?? [], board.powerPins.v33 ?? [], board.powerPins.vin ?? [], board.powerPins.gnd ?? []]) {
        if (group.length > 1) {
          const first = normalizeNode(part.id, group[0])
          for (const pin of group.slice(1)) add(first, normalizeNode(part.id, pin))
        }
      }
    }
  }
  return { adjacency, partMap, boardMap, normalizeNode }
}

function pathToAny(adjacency, start, targets, { requireResistor = false } = {}) {
  const targetSet = new Set(targets)
  const queue = [{ node: start, hasResistor: false }]
  const visited = new Set([start + "|0"])
  while (queue.length) {
    const current = queue.shift()
    if (targetSet.has(current.node) && (!requireResistor || current.hasResistor)) {
      return { found: true, hasResistor: current.hasResistor }
    }
    for (const edge of adjacency.get(current.node) ?? []) {
      const hasResistor = current.hasResistor || Boolean(edge.resistorId)
      // A resistor-required search has two finite states per node: before and
      // after crossing at least one series resistor. Never count arbitrary
      // resistor loops as progressively "better" paths.
      const stateKey = current.node + "|" + Number(current.hasResistor)
      const nextKey = edge.node + "|" + Number(hasResistor)
      if (visited.has(nextKey)) continue
      visited.add(nextKey)
      queue.push({ node: edge.node, hasResistor })
    }
  }
  return { found: false, hasResistor: false }
}

function electricalNodes(circuit, graph) {
  const sources = []
  const grounds = []
  for (const part of circuit.parts) {
    if (isBoardPart(part.type)) {
      const board = getBoardForPart(part)
      for (const pin of [...(board.powerPins.v5 ?? []), ...(board.powerPins.v33 ?? []), ...(board.powerPins.vin ?? [])]) {
        sources.push(graph.normalizeNode(part.id, pin))
      }
      for (const pin of board.powerPins.gnd ?? []) grounds.push(graph.normalizeNode(part.id, pin))
      // A GPIO can source an LED when its corresponding Blockly output is HIGH.
      for (const pin of board.pins) {
        if (pin.kind === "digital" || pin.kind === "analog") sources.push(graph.normalizeNode(part.id, pin.id))
      }
    } else if (part.type === "battery") {
      sources.push(`${part.id}:pos`)
      grounds.push(`${part.id}:neg`)
    }
  }
  return { sources: [...new Set(sources)], grounds: [...new Set(grounds)] }
}

function blockInventory(xml) {
  const blocks = []
  const stack = []
  const pattern = /<block\b[^>]*\btype=["']([^"']+)["'][^>]*>|<\/block>|<field\b[^>]*\bname=["']([^"']+)["'][^>]*>([\s\S]*?)<\/field>/g
  for (const match of xml.matchAll(pattern)) {
    if (match[1]) {
      const entry = { type: match[1], fields: {} }
      blocks.push(entry)
      stack.push(entry)
    } else if (match[0] === "</block>") {
      stack.pop()
    } else if (stack.length && match[2]) {
      stack[stack.length - 1].fields[match[2]] = match[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    }
  }
  return blocks
}

function assertWellFormedXml(xml, label) {
  const stack = []
  const tokens = xml.match(/<\/?[A-Za-z][^>]*>/g) ?? []
  for (const token of tokens) {
    const closing = token.startsWith("</")
    const selfClosing = token.endsWith("/>")
    const tag = token.match(/^<\/?([A-Za-z][\w:-]*)/)?.[1]
    assert.ok(tag, `${label}: malformed XML token ${token}`)
    if (closing) assert.equal(stack.pop(), tag, `${label}: unexpected closing tag ${token}`)
    else if (!selfClosing) stack.push(tag)
  }
  assert.deepEqual(stack, [], `${label}: unclosed XML elements`)
}

function pathUsingOnlyWires(adjacency, start, targets) {
  const targetSet = new Set(targets)
  const queue = [start]
  const visited = new Set([start])
  while (queue.length) {
    const node = queue.shift()
    if (targetSet.has(node)) return true
    for (const edge of adjacency.get(node) ?? []) {
      // Fixed/variable passive devices have resistorId; this search intentionally
      // walks only wire, board-alias, breadboard, and internal switch continuity.
      if (edge.resistorId || visited.has(edge.node)) continue
      visited.add(edge.node)
      queue.push(edge.node)
    }
  }
  return false
}

function hasGroundPullResistor(circuit, graph, signalNode, grounds) {
  // A parallel wire-only path would short the pulled-down signal to ground
  // when the button drives it HIGH; the resistor must be the actual shunt.
  if (pathUsingOnlyWires(graph.adjacency, signalNode, grounds)) return false
  for (const part of circuit.parts.filter((item) => item.type === "resistor")) {
    const a = graph.normalizeNode(part.id, "a")
    const b = graph.normalizeNode(part.id, "b")
    const resistance = Number(part.props.resistance ?? 220)
    if (!Number.isFinite(resistance) || resistance < 1000 || resistance > 100000) continue
    const signalOnA = pathUsingOnlyWires(graph.adjacency, signalNode, [a])
    const signalOnB = pathUsingOnlyWires(graph.adjacency, signalNode, [b])
    if (signalOnA && pathUsingOnlyWires(graph.adjacency, b, grounds)) return true
    if (signalOnB && pathUsingOnlyWires(graph.adjacency, a, grounds)) return true
  }
  return false
}

function auditCircuit(label, circuit, xml, { strictLedProtection = true } = {}) {
  const errors = []
  const warnings = []
  if (!circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) {
    return { errors: [`${label}: missing circuit parts/wires`], warnings }
  }

  const ids = circuit.parts.map((part) => part.id)
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push(`${label}: duplicate/empty part IDs`)
  const wireIds = circuit.wires.map((wire) => wire.id)
  if (wireIds.some((id) => !id) || new Set(wireIds).size !== wireIds.length) errors.push(`${label}: duplicate/empty wire IDs`)
  const partMap = new Map(circuit.parts.map((part) => [part.id, part]))
  const boardParts = circuit.parts.filter((part) => isBoardPart(part.type))
  if (boardParts.length !== 1) errors.push(`${label}: expected exactly one MCU board, found ${boardParts.length}`)

  for (const part of circuit.parts) {
    if (!CATALOG[part.type]) errors.push(`${label}: unknown component type ${part.type} (${part.id})`)
    if (!part.id || typeof part.x !== "number" || typeof part.y !== "number") errors.push(`${label}: malformed part record ${part.id}`)
  }

  const graph = circuitGraph(circuit)
  const endpointSet = new Set()
  for (const wire of circuit.wires) {
    for (const [side, ref] of [["from", wire.from], ["to", wire.to]]) {
      const part = partMap.get(ref?.partId)
      if (!part) {
        errors.push(`${label}: wire ${wire.id} ${side} refers to missing part ${ref?.partId}`)
        continue
      }
      const board = graph.boardMap.get(part.id)
      if (board) {
        if (!resolveBoardPin(board, ref.pinId) &&
            !Object.values(board.powerPins).flat().some((pin) => normalize(pin) === normalize(ref.pinId)) &&
            normalize(board.builtInLedPin) !== normalize(ref.pinId)) {
          errors.push(`${label}: wire ${wire.id} uses unknown ${part.type} pin ${ref.pinId}`)
        }
      } else if (!(CATALOG[part.type]?.pins ?? []).some((pin) => normalize(pin.id) === normalize(ref.pinId))) {
        errors.push(`${label}: wire ${wire.id} uses unknown ${part.type} pin ${ref.pinId}`)
      }
    }
    const from = graph.normalizeNode(wire.from.partId, wire.from.pinId)
    const to = graph.normalizeNode(wire.to.partId, wire.to.pinId)
    if (from === to) errors.push(`${label}: wire ${wire.id} connects a pin to itself`)
    const key = [from, to].sort().join("|")
    if (endpointSet.has(key)) warnings.push(`${label}: duplicate parallel wire between ${from} and ${to}`)
    endpointSet.add(key)
  }

  const connected = new Set()
  for (const wire of circuit.wires) {
    connected.add(graph.normalizeNode(wire.from.partId, wire.from.pinId))
    connected.add(graph.normalizeNode(wire.to.partId, wire.to.pinId))
  }
  const byType = new Map(circuit.parts.map((part) => [part.id, part.type]))
  for (const part of circuit.parts) {
    const pinGroups = CATALOG[part.type]?.requiredPinGroups ?? []
    for (const group of pinGroups) {
      const groupConnected = group.some((pinId) => connected.has(graph.normalizeNode(part.id, pinId)))
      if (!groupConnected) {
        errors.push(`${label}: ${part.id} (${part.type}) has no connection for required pin group [${group.join(" / ")}]`)
      }
    }
  }

  const { sources, grounds } = electricalNodes(circuit, graph)

  // A tactile switch between a board supply rail and a digital/analog input
  // needs a defined idle state: either an explicit INPUT_PULLUP or a physical
  // pull-down resistor. A floating input must never be silently treated as LOW.
  for (const button of circuit.parts.filter((part) => part.type === "pushbutton")) {
    const signalPins = new Map()
    let hasSupplySide = false
    for (const wire of circuit.wires) {
      const refs = [
        wire.from.partId === button.id ? wire.to : wire.to.partId === button.id ? wire.from : null,
      ].filter(Boolean)
      for (const ref of refs) {
        const board = graph.boardMap.get(ref.partId)
        if (!board) continue
        const pin = resolveBoardPin(board, ref.pinId)
        if (!pin) continue
        if (pin.kind === "power") hasSupplySide = true
        if (pin.kind === "digital" || pin.kind === "analog") {
          signalPins.set(graph.normalizeNode(ref.partId, pin.id), { partId: ref.partId, pinId: pin.id, board })
        }
      }
    }
    if (!hasSupplySide || signalPins.size === 0) continue
    for (const [signalNode, signal] of signalPins) {
      if (!hasGroundPullResistor(circuit, graph, signalNode, grounds)) {
        // The current Blockly runtime does not model INPUT_PULLUP as an
        // internal resistor; a declared mode alone cannot make the node non-floating.
        errors.push(`${label}: pushbutton ${button.id} leaves ${signal.board.shortName} ${signal.pinId} floating; add a physical 1kΩ–100kΩ pull-down resistor to GND`)
      }
    }
  }

  for (const part of circuit.parts) {
    if (part.type === "seven-segment") {
      const common = graph.normalizeNode(part.id, "com")
      for (const segment of ["a", "b", "c", "d", "e", "f", "g"]) {
        const pin = graph.normalizeNode(part.id, segment)
        const protectedSegment = pathToAny(graph.adjacency, pin, sources, { requireResistor: true }).found
        const bypassLoop =
          pathUsingOnlyWires(graph.adjacency, pin, sources) &&
          pathUsingOnlyWires(graph.adjacency, common, grounds)
        if (!protectedSegment || bypassLoop) {
          errors.push(`${label}: seven-segment ${part.id} segment ${segment} lacks effective series-resistor protection`)
        }
      }
    }
    if (part.type === "rgb-led") {
      const common = graph.normalizeNode(part.id, "gnd")
      for (const channel of ["red", "green", "blue"]) {
        const pin = graph.normalizeNode(part.id, channel)
        const protectedChannel = pathToAny(graph.adjacency, pin, sources, { requireResistor: true }).found
        const bypassLoop =
          pathUsingOnlyWires(graph.adjacency, pin, sources) &&
          pathUsingOnlyWires(graph.adjacency, common, grounds)
        if (!protectedChannel || bypassLoop) {
          errors.push(`${label}: RGB LED ${part.id} channel ${channel} lacks effective series-resistor protection`)
        }
      }
    }
    if (part.type !== "led") continue
    const anode = graph.normalizeNode(part.id, "anode")
    const cathode = graph.normalizeNode(part.id, "cathode")
    const forwardSource = pathToAny(graph.adjacency, anode, sources)
    const forwardGround = pathToAny(graph.adjacency, cathode, grounds)
    const reverseSource = pathToAny(graph.adjacency, cathode, sources)
    const reverseGround = pathToAny(graph.adjacency, anode, grounds)
    if (forwardSource.found && forwardGround.found) {
      const hasSeriesResistor =
        pathToAny(graph.adjacency, anode, sources, { requireResistor: true }).found ||
        pathToAny(graph.adjacency, cathode, grounds, { requireResistor: true }).found
      const unprotectedParallelLoop =
        pathUsingOnlyWires(graph.adjacency, anode, sources) &&
        pathUsingOnlyWires(graph.adjacency, cathode, grounds)
      if (strictLedProtection && (!hasSeriesResistor || unprotectedParallelLoop)) {
        errors.push(`${label}: LED ${part.id} has a forward power/ground path without effective series-resistor protection`)
      }
    } else if (reverseSource.found && reverseGround.found) {
      errors.push(`${label}: LED ${part.id} is wired in reverse polarity`)
    } else {
      errors.push(`${label}: LED ${part.id} does not have a complete source-to-ground path`)
    }
  }

  if (typeof xml === "string" && xml.trim()) {
    try {
      assertWellFormedXml(xml, label)
    } catch (error) {
      errors.push(error.message)
    }
    const blocks = blockInventory(xml)
    const boardPart = boardParts[0]
    const board = boardPart ? getBoardForPart(boardPart) : null
    const wirePins = new Set()
    if (boardPart) {
      for (const wire of circuit.wires) {
        if (wire.from.partId === boardPart.id) wirePins.add(normalize(graph.normalizeNode(boardPart.id, wire.from.pinId).split(":")[1]))
        if (wire.to.partId === boardPart.id) wirePins.add(normalize(graph.normalizeNode(boardPart.id, wire.to.pinId).split(":")[1]))
      }
    }

    for (const block of blocks) {
      const pin = block.fields.PIN
      if (pin !== undefined && board) {
        const def = resolveBoardPin(board, pin)
        const builtInPinToken = normalize(board.builtInLedPin).replace(/^(gpio|gp|d|p)/i, "")
        const requestedPinToken = normalize(pin).replace(/^(gpio|gp|d|p)/i, "")
        const builtInLedPin = Boolean(builtInPinToken && builtInPinToken === requestedPinToken)
        if (!def && !builtInLedPin) {
          errors.push(`${label}: Blockly ${block.type} uses invalid board pin ${pin}`)
        } else {
          const pwmCapable = builtInLedPin || def?.capabilities?.pwm === true
          const adcCapable = def?.capabilities?.adc === true
          if (block.type === "io_analogwrite" && !pwmCapable) errors.push(`${label}: Blockly analogWrite pin ${pin} is not PWM-capable on ${board.shortName}`)
          if (block.type === "io_analogread" && !adcCapable) errors.push(`${label}: Blockly analogRead pin ${pin} is not ADC-capable on ${board.shortName}`)
          if (def?.capabilities?.inputOnly && ["io_digitalwrite", "io_analogwrite", "servo_write", "tone_play"].includes(block.type)) {
            errors.push(`${label}: Blockly ${block.type} drives input-only pin ${pin}`)
          }
          if (["io_digitalwrite", "io_analogwrite", "io_digitalread", "io_analogread", "servo_write", "tone_play", "tone_stop"].includes(block.type) && !builtInLedPin && !wirePins.has(normalize(def.id))) {
            errors.push(`${label}: Blockly ${block.type} uses unconnected board pin ${pin}`)
          }
        }
      }

      const sensorField = block.fields.SENSOR
      if (sensorField) {
        const expected = {
          potentiometer_read: "potentiometer",
          ldr_read: "ldr",
          tmp36_temperature: "tmp36",
          dht_temperature: "dht11",
          dht_humidity: "dht11",
          pir_motion: "pir-sensor",
          ir_read: "ir-sensor",
          ultrasonic_read: "ultrasonic",
          joystick_x: "joystick",
          joystick_y: "joystick",
          joystick_button: "joystick",
          soil_moisture_read: "soil-moisture",
          mq2_gas_read: "mq2-gas",
          encoder_read: "rotary-encoder",
          keypad_read: "keypad-4x4",
          neopixel_set_color: "neopixel-ring",
          neopixel_show: "neopixel-ring",
        }[block.type]
        if (expected && partMap.get(sensorField)?.type !== expected) {
          errors.push(`${label}: Blockly ${block.type} references ${sensorField}, expected component type ${expected}`)
        }
      }
    }
  }

  return { errors, warnings }
}

const templateIds = TEMPLATES.map((template) => template.id)
const lessonCircuits = LESSONS.filter((lesson) => lesson.seedCircuit)
const templateResults = TEMPLATES.map((template) =>
  ({ id: template.id, title: template.title, ...auditCircuit(`template ${template.id}`, template.circuit, template.blocklyXml) }),
)
const lessonResults = lessonCircuits.map((lesson) =>
  ({ id: lesson.id, title: lesson.title, ...auditCircuit(`lesson ${lesson.id}`, lesson.seedCircuit, lesson.seedBlocklyXml, { strictLedProtection: true }) }),
)
const allErrors = [...templateResults, ...lessonResults].flatMap((result) => result.errors)
const allWarnings = [...templateResults, ...lessonResults].flatMap((result) => result.warnings)

test("complete Virtual Lab project-template and curriculum circuit inventory is unique and audited", () => {
  assert.ok(TEMPLATES.length >= 20, `unexpectedly small project-template catalogue: ${TEMPLATES.length}`)
  assert.equal(new Set(templateIds).size, templateIds.length, "project-template IDs must be unique")
  assert.ok(lessonCircuits.length >= 35, `expected seeded circuits from all boards; got ${lessonCircuits.length}`)
  console.log(JSON.stringify({
    projectTemplates: TEMPLATES.length,
    curriculumLessons: LESSONS.length,
    curriculumSeedCircuits: lessonCircuits.length,
    totalCircuitsAudited: TEMPLATES.length + lessonCircuits.length,
    totalParts: [...TEMPLATES.map((item) => item.circuit.parts.length), ...lessonCircuits.map((item) => item.seedCircuit.parts.length)].reduce((a, b) => a + b, 0),
    totalWires: [...TEMPLATES.map((item) => item.circuit.wires.length), ...lessonCircuits.map((item) => item.seedCircuit.wires.length)].reduce((a, b) => a + b, 0),
    errorCount: allErrors.length,
    warningCount: allWarnings.length,
  }, null, 2))
  if (allErrors.length) {
    console.error("Virtual Lab electrical audit findings:\\n" + allErrors.map((error) => "- " + error).join("\\n"))
  }
  assert.deepEqual(allErrors, [], "all template and curriculum circuit electrical/topology checks must pass")
})
