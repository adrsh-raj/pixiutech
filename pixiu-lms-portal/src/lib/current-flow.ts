import type { CircuitState, PinRef, PlacedPart } from "./circuit-types"
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

type PathEdge = {
  a: string
  b: string
  resistanceOhms: number
  wireId?: string
}

const pinKey = (ref: PinRef) => `${ref.partId}:${ref.pinId}`

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
    if (pivot !== column) [augmented[pivot], augmented[column]] = [augmented[column], augmented[pivot]]

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
 * Computes physical-wire animation from the solver's signed component branch
 * currents. The ideal-wire topology itself has no unique current division in a
 * loop, so the renderer uses a small, explicit conductor resistance and solves
 * the resulting path network. Component currents are never fabricated here.
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
  // A short between conflicting ideal sources has no physically valid solution.
  if (nodal.diagnostics.some((item) => item.code === "source-conflict")) return result

  const powerPins = new Set<string>()
  const groundPins = new Set<string>()
  const signalPowerPins = new Set<string>()
  const signalGroundPins = new Set<string>()

  const addBoardAliasEdges = (part: PlacedPart, edges: PathEdge[]) => {
    const board = getBoardForPart(part)
    if (!board) return
    const addInternal = (a: string, b: string, resistance = 0.001) => {
      edges.push({ a: `${part.id}:${a}`, b: `${part.id}:${b}`, resistanceOhms: resistance })
    }

    // Board aliases denote the same physical pin.
    for (const pin of board.pins) {
      for (const alias of pin.alternateNames ?? []) addInternal(pin.id, alias.toLowerCase())
    }
    // Header aliases for the same physical supply/ground rail are internally common.
    for (const group of [board.powerPins.v5 ?? [], board.powerPins.v33 ?? [], board.powerPins.vin ?? [], board.powerPins.gnd]) {
      for (let index = 1; index < group.length; index++) addInternal(group[0], group[index])
    }
  }

  const pathEdges: PathEdge[] = state.wires.map((wire) => ({
    a: pinKey(wire.from),
    b: pinKey(wire.to),
    // A small finite conductor resistance regularizes current division in
    // redundant wire loops. The solved component branch current remains exact
    // under the component's circuit model and is used to scale this allocation.
    resistanceOhms: 0.01,
    wireId: wire.id,
  }))

  for (const part of state.parts) {
    const k = (pin: string) => `${part.id}:${pin}`
    const board = getBoardForPart(part)
    if (board) {
      for (const pin of board.powerPins.v5 ?? []) {
        powerPins.add(k(pin))
        signalPowerPins.add(k(pin))
      }
      for (const pin of board.powerPins.v33 ?? []) {
        powerPins.add(k(pin))
        signalPowerPins.add(k(pin))
      }
      for (const pin of board.powerPins.vin ?? []) {
        powerPins.add(k(pin))
        signalPowerPins.add(k(pin))
      }
      for (const pin of board.powerPins.gnd) {
        groundPins.add(k(pin))
        signalGroundPins.add(k(pin))
      }

      for (const pin of board.pins) {
        if (pin.kind !== "digital" && pin.kind !== "analog") continue
        const pinState = lookupBoardPinState(pinStates, pin.id, board)
        if (!pinState) continue
        for (const alias of new Set([pin.id, ...(pin.alternateNames ?? [])])) {
          if (pinState.state === "HIGH" || (pinState.value ?? 0) > 0) {
            signalPowerPins.add(k(alias))
          } else if (
            pinState.state === "LOW" &&
            (pinState.outputMode === "digital" || pinState.outputMode === "pwm" || pinState.outputMode === "tone")
          ) {
            signalGroundPins.add(k(alias))
          }
        }
      }
      addBoardAliasEdges(part, pathEdges)
      continue
    }

    if (part.type === "battery") {
      powerPins.add(k("pos"))
      groundPins.add(k("neg"))
      signalPowerPins.add(k("pos"))
      signalGroundPins.add(k("neg"))
    } else if (part.type === "breadboard") {
      const addInternal = (a: string, b: string) => {
        pathEdges.push({ a: k(a), b: k(b), resistanceOhms: 0.001 })
      }
      for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
        const topRows = ["a", "b", "c", "d", "e"]
        const bottomRows = ["f", "g", "h", "i", "j"]
        for (let index = 0; index < topRows.length - 1; index++) {
          addInternal(`${topRows[index]}_${column}`, `${topRows[index + 1]}_${column}`)
        }
        for (let index = 0; index < bottomRows.length - 1; index++) {
          addInternal(`${bottomRows[index]}_${column}`, `${bottomRows[index + 1]}_${column}`)
        }
        if (column < BREADBOARD_COLUMNS) {
          for (const rail of ["pos_t", "neg_t", "pos_b", "neg_b"]) {
            addInternal(`${rail}_${column}`, `${rail}_${column + 1}`)
          }
        }
      }
      addInternal("pos_top", "pos_t_1")
      addInternal("neg_top", "neg_t_1")
      addInternal("pos_bot", "pos_b_1")
      addInternal("neg_bot", "neg_b_1")
      for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) addInternal(legacy, canonical)
    } else if (part.type === "resistor") {
      pathEdges.push({
        a: k("a"),
        b: k("b"),
        resistanceOhms: Math.max(0.1, Number(part.props.resistance || 220)),
      })
    } else if (part.type === "ldr") {
      const light = Math.max(0, Math.min(1023, Number(part.props.light ?? 512)))
      const resistance = Math.max(200, Math.round(50000 / (1 + (light / 1023) * 99)))
      pathEdges.push({ a: k("t1"), b: k("t2"), resistanceOhms: resistance })
    } else if (part.type === "potentiometer") {
      const value = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
      const total = Math.max(1, Number(part.props.resistance ?? 10000))
      const r1 = Math.max(0.5, ((1023 - value) / 1023) * total)
      const r2 = Math.max(0.5, (value / 1023) * total)
      pathEdges.push({ a: k("t1"), b: k("wiper"), resistanceOhms: r1 })
      pathEdges.push({ a: k("wiper"), b: k("t2"), resistanceOhms: r2 })
    } else if (part.type === "pushbutton") {
      pathEdges.push({ a: k("p1a"), b: k("p1b"), resistanceOhms: 0.001 })
      pathEdges.push({ a: k("p2a"), b: k("p2b"), resistanceOhms: 0.001 })
      if (pressed.has(part.id)) pathEdges.push({ a: k("p1a"), b: k("p2a"), resistanceOhms: 0.05 })
    } else if (part.type === "relay") {
      pathEdges.push({
        a: k("com"),
        b: k(runtime[part.id]?.relayActive === true ? "no" : "nc"),
        resistanceOhms: 0.05,
      })
    } else if (part.type === "npn-transistor" && runtime[part.id]?.conducting === true) {
      pathEdges.push({ a: k("collector"), b: k("emitter"), resistanceOhms: 0.2 })
    }
  }

  const adjacency = new Map<string, Array<{ edge: PathEdge; next: string }>>()
  for (const edge of pathEdges) {
    if (!Number.isFinite(edge.resistanceOhms) || edge.resistanceOhms <= 0 || edge.a === edge.b) continue
    adjacency.set(edge.a, [...(adjacency.get(edge.a) ?? []), { edge, next: edge.b }])
    adjacency.set(edge.b, [...(adjacency.get(edge.b) ?? []), { edge, next: edge.a }])
  }

  function getPinInfoForKey(key: string) {
    const separator = key.indexOf(":")
    if (separator < 0) return null
    return nodal.getPinInfo({ partId: key.slice(0, separator), pinId: key.slice(separator + 1) })
  }

  function markWireFlow(wireId: string, signedCurrentMa: number) {
    if (!Number.isFinite(signedCurrentMa) || Math.abs(signedCurrentMa) < 0.001) return
    const existing = result[wireId]
    const signedTotal =
      (existing ? (existing.isForward ? existing.currentMa : -existing.currentMa) : 0) + signedCurrentMa
    if (Math.abs(signedTotal) < 0.001) {
      delete result[wireId]
      return
    }
    const magnitude = Math.abs(signedTotal)
    result[wireId] = {
      currentMa: Number(magnitude.toFixed(3)),
      isForward: signedTotal >= 0,
      period: Math.max(0.25, Math.min(2.5, Number((20 / Math.max(0.5, magnitude)).toFixed(2)))),
    }
  }

  /**
   * Solve the passive connection graph with the source side at 1V and the
   * branch terminal at 0V (or vice versa). The resulting relative edge-current
   * distribution includes every parallel wire route and loop. It is scaled to
   * the actual branch current from the nodal solver.
   */
  function routeSolvedCurrent(
    startPin: string,
    terminalPins: Set<string>,
    currentMa: number,
    direction: "terminals-to-start" | "start-to-terminals",
  ) {
    if (Math.abs(currentMa) < 0.001) return
    const reverse = currentMa < 0
    const start = startPin
    const reachable = new Set<string>([start])
    const queue = [start]
    for (let index = 0; index < queue.length; index++) {
      for (const item of adjacency.get(queue[index]) ?? []) {
        if (reachable.has(item.next)) continue
        reachable.add(item.next)
        queue.push(item.next)
      }
    }

    const validTerminals = [...terminalPins].filter((pin) => {
      if (!reachable.has(pin) || pin === start) return false
      const info = getPinInfoForKey(pin)
      return Boolean(info && !info.isFloating && !info.isConflicted)
    })
    if (validTerminals.length === 0) return

    // A negative component branch current reverses the source/return domains.
    const effectiveDirection =
      reverse
        ? (direction === "terminals-to-start" ? "start-to-terminals" : "terminals-to-start")
        : direction
    const boundaryPins = new Set(validTerminals)
    const startVoltage = effectiveDirection === "terminals-to-start" ? 0 : 1
    const boundaryVoltage = effectiveDirection === "terminals-to-start" ? 1 : 0

    const nodes = [...reachable]
    const unknownNodes = nodes.filter((node) => node !== start && !boundaryPins.has(node))
    const indexByNode = new Map(unknownNodes.map((node, index) => [node, index]))
    const matrix: number[][] = Array.from({ length: unknownNodes.length }, () => new Array(unknownNodes.length).fill(0))
    const rhs: number[] = new Array(unknownNodes.length).fill(0)

    for (const edge of pathEdges) {
      if (!reachable.has(edge.a) || !reachable.has(edge.b) || edge.a === edge.b) continue
      const conductance = 1 / edge.resistanceOhms
      const u = indexByNode.get(edge.a)
      const v = indexByNode.get(edge.b)
      const fixedU = edge.a === start ? startVoltage : boundaryPins.has(edge.a) ? boundaryVoltage : undefined
      const fixedV = edge.b === start ? startVoltage : boundaryPins.has(edge.b) ? boundaryVoltage : undefined

      if (u !== undefined && v !== undefined) {
        matrix[u][u] += conductance
        matrix[v][v] += conductance
        matrix[u][v] -= conductance
        matrix[v][u] -= conductance
      } else if (u !== undefined && fixedV !== undefined) {
        matrix[u][u] += conductance
        rhs[u] += conductance * fixedV
      } else if (v !== undefined && fixedU !== undefined) {
        matrix[v][v] += conductance
        rhs[v] += conductance * fixedU
      }
    }

    const unknownVoltages = solveDenseSystem(matrix, rhs)
    if (!unknownVoltages && unknownNodes.length > 0) return
    const voltageAt = (pin: string) => {
      if (pin === start) return startVoltage
      if (boundaryPins.has(pin)) return boundaryVoltage
      return unknownVoltages?.[indexByNode.get(pin)!] ?? 0
    }

    let unitCurrentA = 0
    for (const item of adjacency.get(start) ?? []) {
      if (!reachable.has(item.next)) continue
      const delta = voltageAt(item.next) - startVoltage
      unitCurrentA += (effectiveDirection === "terminals-to-start" ? delta : -delta) / item.edge.resistanceOhms
    }
    // In either orientation, the test-network current must be positive.
    if (!Number.isFinite(unitCurrentA) || unitCurrentA <= 1e-12) return
    const scale = (Math.abs(currentMa) / 1000) / unitCurrentA

    for (const edge of pathEdges) {
      if (!edge.wireId || !reachable.has(edge.a) || !reachable.has(edge.b)) continue
      const edgeCurrentA = (voltageAt(edge.a) - voltageAt(edge.b)) / edge.resistanceOhms
      const signedWireCurrentMa = edgeCurrentA * scale * 1000
      if (Math.abs(signedWireCurrentMa) > 0.001) markWireFlow(edge.wireId, signedWireCurrentMa)
    }
  }

  function traceBranch(partId: string, pinA: string, pinB: string, signalPath = false) {
    const currentMa = nodal.getBranchCurrent(partId, pinA, pinB)
    if (!Number.isFinite(currentMa) || Math.abs(currentMa) < 0.001) return
    const start = `${partId}:${currentMa >= 0 ? pinA : pinB}`
    const end = `${partId}:${currentMa >= 0 ? pinB : pinA}`
    const sources = signalPath ? signalPowerPins : powerPins
    const returns = signalPath ? signalGroundPins : groundPins

    routeSolvedCurrent(start, sources, Math.abs(currentMa), "terminals-to-start")
    routeSolvedCurrent(end, returns, Math.abs(currentMa), "start-to-terminals")
  }

  // Trace only component branches represented by the same nodal model used for
  // DMM/current measurements. Missing internal load models deliberately do not
  // get synthetic 4mA/10mA/15mA visual currents.
  for (const part of state.parts) {
    if (part.type === "resistor") {
      traceBranch(part.id, "a", "b")
    } else if (part.type === "ldr") {
      traceBranch(part.id, "t1", "t2")
    } else if (part.type === "potentiometer") {
      traceBranch(part.id, "t1", "wiper")
      traceBranch(part.id, "wiper", "t2")
    } else if (part.type === "led") {
      if (!runtime[part.id]?.burnt) traceBranch(part.id, "anode", "cathode", true)
    } else if (part.type === "rgb-led") {
      traceBranch(part.id, "red", "gnd", true)
      traceBranch(part.id, "green", "gnd", true)
      traceBranch(part.id, "blue", "gnd", true)
    } else if (part.type === "buzzer") {
      if ((runtime[part.id]?.level ?? 0) > 0) traceBranch(part.id, "pos", "neg", true)
    } else if (part.type === "dc-motor") {
      const motor = runtime[part.id]
      const active =
        (motor?.rpm ?? 0) > 0 ||
        motor?.motorDirection === "cw" ||
        motor?.motorDirection === "ccw" ||
        (motor?.level ?? 0) > 0 ||
        (motor?.speed ?? 0) !== 0
      if (active) traceBranch(part.id, "pos", "neg")
    } else if (part.type === "relay") {
      const contact = runtime[part.id]?.relayActive === true ? "no" : "nc"
      traceBranch(part.id, "com", contact)
    }
  }

  return result
}
