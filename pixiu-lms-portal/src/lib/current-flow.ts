import type { CircuitState, PinRef } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { solveCircuitNodalPotentials } from "./circuit-solver"
import { getBoardForPart, lookupBoardPinState } from "./board-registry"
import { BREADBOARD_COLUMNS } from "./components-catalog"
import { getLegacyBreadboardPinMappings } from "./breadboard-pins"

export interface WireCurrentState {
  currentMa: number
  isForward: boolean
  period: number
}

type ConductorEdge = {
  a: string
  b: string
  resistanceOhms: number
  wireId?: string
}

const pinKey = (ref: PinRef) => ref.partId + ":" + ref.pinId

function solveDenseSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length
  if (n === 0) return []
  const augmented = matrix.map((row, index) => [...row, rhs[index]])

  for (let column = 0; column < n; column++) {
    let pivot = column
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-14) return null
    if (pivot !== column) {
      const temp = augmented[pivot]
      augmented[pivot] = augmented[column]
      augmented[column] = temp
    }

    const pivotValue = augmented[column][column]
    for (let row = column + 1; row < n; row++) {
      const factor = augmented[row][column] / pivotValue
      if (factor === 0) continue
      for (let entry = column; entry <= n; entry++) {
        augmented[row][entry] -= factor * augmented[column][entry]
      }
    }
  }

  const solution = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let value = augmented[row][n]
    for (let column = row + 1; column < n; column++) value -= augmented[row][column] * solution[column]
    solution[row] = value / augmented[row][row]
    if (!Number.isFinite(solution[row])) return null
  }
  return solution
}

/**
 * Resolve physical wire current from the component branch currents reported by
 * the same nodal solver used by the multimeter. Components inject/withdraw their
 * solved current at their pins; the wire-and-copper network then distributes it
 * using an explicit 10mΩ conductor model. This gives deterministic current
 * sharing in parallel wires and loops without choosing an arbitrary BFS path.
 */
export function computeWireCurrents(
  state: CircuitState,
  runtime: Record<string, PartRuntime>,
  pinStates: Record<string, ArduinoPinState> = {},
  pressed: Set<string> = new Set(),
): Record<string, WireCurrentState> {
  const result: Record<string, WireCurrentState> = {}
  const relayStates = Object.fromEntries(
    state.parts
      .filter((part) => part.type === "relay")
      .map((part) => [part.id, runtime[part.id]?.relayActive === true]),
  )
  const nodal = solveCircuitNodalPotentials(state, pressed, pinStates, true, relayStates, runtime)
  // The solver marks only source-conflicted connected nets as invalid; leave
  // independent valid circuits available for current-flow rendering.

  const edges: ConductorEdge[] = state.wires.map((wire) => ({
    a: pinKey(wire.from),
    b: pinKey(wire.to),
    resistanceOhms: 0.01,
    wireId: wire.id,
  }))
  // Only physical source terminals are fixed-voltage boundaries. The nodal
  // solver collapses wire-connected pins into one ideal net, so querying every
  // connected pin would incorrectly fix both ends of each wire to one voltage
  // and force its displayed current to zero.
  const anchorVoltages = new Map<string, number>()
  const addAnchor = (partId: string, pinId: string) => {
    const ref = { partId, pinId }
    const info = nodal.getPinInfo(ref)
    if (!info || info.isFloating || info.isConflicted) return
    anchorVoltages.set(partId + ":" + pinId, nodal.getPinVoltage(ref))
  }

  const addInternal = (partId: string, pinA: string, pinB: string, resistanceOhms = 0.001) => {
    if (pinA === pinB) return
    edges.push({
      a: partId + ":" + pinA,
      b: partId + ":" + pinB,
      resistanceOhms,
    })
  }

  for (const part of state.parts) {
    const board = getBoardForPart(part)
    if (board) {
      // Physical supply rails and ground headers are real fixed-voltage
      // terminals; component pins merely wired to them are not.
      for (const pin of board.powerPins.v5 ?? []) addAnchor(part.id, pin)
      for (const pin of board.powerPins.v33 ?? []) addAnchor(part.id, pin)
      for (const pin of board.powerPins.vin ?? []) addAnchor(part.id, pin)
      for (const pin of board.powerPins.gnd) addAnchor(part.id, pin)

      // A driven MCU GPIO is a real voltage-source boundary as well.
      for (const pin of board.pins) {
        if (pin.kind !== "digital" && pin.kind !== "analog") continue
        const pinState = lookupBoardPinState(pinStates, pin.id, board)
        if (!pinState) continue
        const activeOutput =
          // The nodal solver treats a stored LOW pin state as a fixed 0V
          // sink even for legacy pin-state records that only carry mode:"OUTPUT".
          pinState.state === "HIGH" ||
          pinState.state === "LOW" ||
          pinState.outputMode === "pwm" ||
          pinState.outputMode === "tone" ||
          pinState.outputMode === "servo" ||
          pinState.outputMode === "dac"
        if (activeOutput) addAnchor(part.id, pin.id)
      }

      // Alias labels and duplicate supply/ground headers are the same physical node.
      for (const pin of board.pins) {
        for (const alias of pin.alternateNames ?? []) addInternal(part.id, pin.id, alias.toLowerCase())
      }
      const commonGroups = [
        board.powerPins.v5 ?? [],
        board.powerPins.v33 ?? [],
        board.powerPins.gnd,
      ]
      for (const group of commonGroups) {
        for (let index = 1; index < group.length; index++) {
          addInternal(part.id, group[0], group[index])
        }
      }
      continue
    }

    if (part.type === "battery") {
      addAnchor(part.id, "pos")
      addAnchor(part.id, "neg")
    } else if (part.type === "l298n") {
      const driver = runtime[part.id]
      if ((driver?.motorARpm ?? 0) > 0 && driver?.motorADirection !== "stopped") {
        addAnchor(part.id, "out1")
        addAnchor(part.id, "out2")
      }
      if ((driver?.motorBRpm ?? 0) > 0 && driver?.motorBDirection !== "stopped") {
        addAnchor(part.id, "out3")
        addAnchor(part.id, "out4")
      }
    } else if (part.type === "breadboard") {
      const key = (pin: string) => pin
      for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
        const top = ["a", "b", "c", "d", "e"]
        const bottom = ["f", "g", "h", "i", "j"]
        for (let index = 0; index < top.length - 1; index++) {
          addInternal(part.id, key(top[index] + "_" + column), key(top[index + 1] + "_" + column))
        }
        for (let index = 0; index < bottom.length - 1; index++) {
          addInternal(part.id, key(bottom[index] + "_" + column), key(bottom[index + 1] + "_" + column))
        }
        if (column < BREADBOARD_COLUMNS) {
          for (const rail of ["pos_t", "neg_t", "pos_b", "neg_b"]) {
            addInternal(part.id, rail + "_" + column, rail + "_" + (column + 1))
          }
        }
      }
      addInternal(part.id, "pos_top", "pos_t_1")
      addInternal(part.id, "neg_top", "neg_t_1")
      addInternal(part.id, "pos_bot", "pos_b_1")
      addInternal(part.id, "neg_bot", "neg_b_1")
      for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) {
        addInternal(part.id, legacy, canonical)
      }
    } else if (part.type === "pushbutton") {
      // Each physical side is a permanent copper pair; the cross-contact is
      // normally open and closes only while the user presses the button.
      addInternal(part.id, "p1a", "p1b")
      addInternal(part.id, "p2a", "p2b")
      if (pressed.has(part.id)) addInternal(part.id, "p1a", "p2a", 0.05)
    } else if (part.type === "relay") {
      // Mirror the same contact state and contact resistance as the nodal solver.
      const activeContact = runtime[part.id]?.relayActive === true ? "no" : "nc"
      addInternal(part.id, "com", activeContact, 0.05)
    } else if (part.type === "npn-transistor" && runtime[part.id]?.conducting === true) {
      addInternal(part.id, "collector", "emitter", 0.2)
    }
  }

  const modelOutputPins: Partial<Record<string, string[]>> = {
    "ir-sensor": ["out"],
    "dht11": ["data"],
    "oled-i2c": ["sda", "scl"],
    "joystick": ["vrx", "vry", "sw"],
    "rotary-encoder": ["sw"],
    "soil-moisture": ["ao"],
    "tmp36": ["out", "vout"],
    "mq2-gas": ["ao", "do"],
  }
  for (const part of state.parts) {
    for (const pinId of modelOutputPins[part.type] ?? []) addAnchor(part.id, pinId)
  }

  const adjacency = new Map<string, Array<{ edge: ConductorEdge; next: string }>>()
  const nodes = new Set<string>()
  for (const edge of edges) {
    if (!Number.isFinite(edge.resistanceOhms) || edge.resistanceOhms <= 0 || edge.a === edge.b) continue
    nodes.add(edge.a)
    nodes.add(edge.b)
    adjacency.set(edge.a, [...(adjacency.get(edge.a) ?? []), { edge, next: edge.b }])
    adjacency.set(edge.b, [...(adjacency.get(edge.b) ?? []), { edge, next: edge.a }])
  }

  const injections = new Map<string, number>()
  // A positive component branch current travels pinA -> pinB. Current leaves
  // the conductor network at pinA and returns to it at pinB.
  for (const [key, currentMa] of nodal.branchCurrents.entries()) {
    const match = key.match(/^(.*):([^:]+)->(.+)$/)
    if (!match || !Number.isFinite(currentMa) || Math.abs(currentMa) < 0.000001) continue
    const partId = match[1]
    const pinAName = match[2]
    const pinBName = match[3]
    const part = state.parts.find((item) => item.id === partId)
    // Relay contacts and a conducting NPN transistor are already represented
    // as real low-resistance conductor edges below. Injecting their solved
    // branch current as well would double-count the same pass-through path.
    if (
      (part?.type === "relay" && pinAName === "com" && (pinBName === "no" || pinBName === "nc")) ||
      (part?.type === "npn-transistor" && pinAName === "collector" && pinBName === "emitter")
    ) continue
    const pinA = partId + ":" + pinAName
    const pinB = partId + ":" + pinBName
    nodes.add(pinA)
    nodes.add(pinB)
    const currentA = currentMa / 1000
    injections.set(pinA, (injections.get(pinA) ?? 0) - currentA)
    injections.set(pinB, (injections.get(pinB) ?? 0) + currentA)
  }

  const seen = new Set<string>()
  const voltageAt = new Map<string, number>()

  // Solve each independent conductor network separately.
  for (const first of nodes) {
    if (seen.has(first)) continue
    const component: string[] = []
    const queue = [first]
    seen.add(first)
    for (let index = 0; index < queue.length; index++) {
      const node = queue[index]
      component.push(node)
      for (const item of adjacency.get(node) ?? []) {
        if (seen.has(item.next)) continue
        seen.add(item.next)
        queue.push(item.next)
      }
    }

    const componentSet = new Set(component)
    const componentInjection = component.reduce((sum, node) => sum + (injections.get(node) ?? 0), 0)

    const fixed = new Map<string, number>()
    for (const node of component) {
      const voltage = anchorVoltages.get(node)
      if (voltage !== undefined) fixed.set(node, voltage)
    }

    // An ideal fixed-voltage source/return is a boundary condition: it can
    // absorb or provide whatever current is required by KCL. Only a floating
    // conductor island (no source or ground anchor) must have zero net injected
    // current in steady state.
    if (fixed.size === 0) {
      if (Math.abs(componentInjection) > 1e-8) continue
      fixed.set(component[0], 0)
    }

    const unknown = component.filter((node) => !fixed.has(node))
    const indexByNode = new Map(unknown.map((node, index) => [node, index]))
    const matrix: number[][] = Array.from({ length: unknown.length }, () => new Array(unknown.length).fill(0))
    const rhs: number[] = unknown.map((node) => injections.get(node) ?? 0)

    for (const edge of edges) {
      if (!componentSet.has(edge.a) || !componentSet.has(edge.b)) continue
      const conductance = 1 / edge.resistanceOhms
      const a = indexByNode.get(edge.a)
      const b = indexByNode.get(edge.b)
      const fixedA = fixed.get(edge.a)
      const fixedB = fixed.get(edge.b)

      if (a !== undefined && b !== undefined) {
        matrix[a][a] += conductance
        matrix[b][b] += conductance
        matrix[a][b] -= conductance
        matrix[b][a] -= conductance
      } else if (a !== undefined && fixedB !== undefined) {
        matrix[a][a] += conductance
        rhs[a] += conductance * fixedB
      } else if (b !== undefined && fixedA !== undefined) {
        matrix[b][b] += conductance
        rhs[b] += conductance * fixedA
      }
    }

    const solved = solveDenseSystem(matrix, rhs)
    if (!solved && unknown.length > 0) continue
    for (const [node, voltage] of fixed.entries()) voltageAt.set(node, voltage)
    for (let index = 0; index < unknown.length; index++) voltageAt.set(unknown[index], solved?.[index] ?? 0)
  }

  for (const edge of edges) {
    if (!edge.wireId) continue
    const voltageA = voltageAt.get(edge.a)
    const voltageB = voltageAt.get(edge.b)
    if (voltageA === undefined || voltageB === undefined) continue
    const currentMa = ((voltageA - voltageB) / edge.resistanceOhms) * 1000
    if (!Number.isFinite(currentMa) || Math.abs(currentMa) < 0.001) continue
    const magnitude = Math.abs(currentMa)
    result[edge.wireId] = {
      currentMa: Number(magnitude.toFixed(3)),
      isForward: currentMa >= 0,
      period: Math.max(0.25, Math.min(2.5, Number((20 / Math.max(0.5, magnitude)).toFixed(2)))),
    }
  }

  return result
}
