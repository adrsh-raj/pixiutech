import type { CircuitState, PinRef } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"
import { getBoardForPart, lookupBoardPinState } from "./board-registry"
import { MinPriorityQueue } from "./min-priority-queue"
import { normalizeBreadboardPinId } from "./breadboard-pins"
import { BREADBOARD_COLUMNS } from "./components-catalog"

export interface PinPotentialInfo {
  voltage: number
  netId: number
  sourceLabel?: string
  isDriven: boolean
  isGnd: boolean
  isDigitalLow?: boolean
  isFloating?: boolean
  digitalPinName?: string
}

export interface NodalSolution {
  pinPotentials: Map<string, PinPotentialInfo>
  netVoltages: Map<number, number>
  getPinVoltage: (ref: PinRef | null) => number
  getPinInfo: (ref: PinRef | null) => PinPotentialInfo
  getPotentialDifference: (
    red: PinRef | null,
    black: PinRef | null,
    state: CircuitState,
    pinStates: Record<string, ArduinoPinState>
  ) => {
    diff: number
    vRed: number
    vBlack: number
    explanation: string
    subtext?: string
    isWarning?: boolean
  }
  computeResistanceBetweenPins: (
    refA: PinRef | null,
    refB: PinRef | null
  ) => {
    resistance: number
    explanation: string
    subtext?: string
  }
  computeCurrentBetweenPins: (
    red: PinRef | null,
    black: PinRef | null,
    runtime: Record<string, PartRuntime>
  ) => {
    currentMa: number
    explanation: string
    subtext?: string
    isWarning?: boolean
  }
}

const pinKey = (partId: string, pinId: string) => `${partId}:${pinId}`

/**
 * Solves arbitrary linear system Ax = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length
  if (n === 0) return []

  const M: number[][] = A.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k
      }
    }

    if (Math.abs(M[maxRow][i]) < 1e-12) {
      continue
    }

    const temp = M[i]
    M[i] = M[maxRow]
    M[maxRow] = temp

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i]
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j]
      }
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-12) {
      x[i] = 0
      continue
    }
    let sum = M[i][n]
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j]
    }
    x[i] = sum / M[i][i]
  }

  return x
}

/**
 * Dynamic Electrical Network & Nodal Potential Solver:
 * - Solves exact electrical potentials (Volts) for EVERY pin in the circuit.
 * - Handles arbitrary networks of MULTIPLE resistors (series, parallel, voltage dividers).
 * - Computes real equivalent resistance and active branch currents across any two probed pins.
 */
export function solveCircuitNodalPotentials(
  state: CircuitState,
  pressed: Set<string> = new Set(),
  pinStates: Record<string, ArduinoPinState> = {},
  running: boolean = true
): NodalSolution {
  // 1. Gather all pins across all placed components
  const allPins = new Set<string>()
  const breadboardIds = new Set(state.parts.filter((part) => part.type === "breadboard").map((part) => part.id))
  const wirePinKey = (partId: string, pinId: string) =>
    pinKey(partId, breadboardIds.has(partId) ? normalizeBreadboardPinId(pinId) : pinId)
  for (const part of state.parts) {
    const board = getBoardForPart(part)
    if (board) {
      for (const pin of board.pins) {
        allPins.add(pinKey(part.id, pin.id))
        allPins.add(pinKey(part.id, pin.id.toLowerCase()))
        allPins.add(pinKey(part.id, pin.label.toLowerCase()))
        const num = pin.id.replace(/^(gpio|gp|d|p)/i, "")
        if (num && num !== pin.id) {
          allPins.add(pinKey(part.id, num))
        }
        for (const alt of pin.alternateNames ?? []) {
          allPins.add(pinKey(part.id, alt.toLowerCase()))
        }
      }
      for (const g of board.powerPins.gnd) {
        allPins.add(pinKey(part.id, g))
      }
      continue
    }

    switch (part.type) {
      case "resistor":
        allPins.add(pinKey(part.id, "a"))
        allPins.add(pinKey(part.id, "b"))
        break
      case "led":
        allPins.add(pinKey(part.id, "anode"))
        allPins.add(pinKey(part.id, "cathode"))
        break
      case "potentiometer":
        allPins.add(pinKey(part.id, "t1"))
        allPins.add(pinKey(part.id, "wiper"))
        allPins.add(pinKey(part.id, "t2"))
        break
      case "pushbutton":
        allPins.add(pinKey(part.id, "p1a"))
        allPins.add(pinKey(part.id, "p1b"))
        allPins.add(pinKey(part.id, "p2a"))
        allPins.add(pinKey(part.id, "p2b"))
        break
      case "battery":
      case "buzzer":
      case "dc-motor":
        allPins.add(pinKey(part.id, "pos"))
        allPins.add(pinKey(part.id, "neg"))
        break
      case "servo":
        allPins.add(pinKey(part.id, "vcc"))
        allPins.add(pinKey(part.id, "gnd"))
        allPins.add(pinKey(part.id, "sig"))
        break
      case "ir-sensor":
        for (const pin of ["vcc", "out", "gnd"]) allPins.add(pinKey(part.id, pin))
        break
      case "dht11":
        for (const pin of ["vcc", "data", "gnd"]) allPins.add(pinKey(part.id, pin))
        break
      case "oled-i2c":
        for (const pin of ["gnd", "vcc", "scl", "sda"]) allPins.add(pinKey(part.id, pin))
        break
      case "joystick":
        for (const pin of ["gnd", "vcc", "vrx", "vry", "sw"]) allPins.add(pinKey(part.id, pin))
        break
      case "l298n":
        for (const pin of ["vs", "gnd", "5v", "ena", "in1", "in2", "out1", "out2", "enb", "in3", "in4", "out3", "out4"]) {
          allPins.add(pinKey(part.id, pin))
        }
        break
      case "rotary-encoder":
        for (const pin of ["gnd", "vcc", "clk", "dt", "sw"]) allPins.add(pinKey(part.id, pin))
        break
      case "soil-moisture":
        for (const pin of ["vcc", "ao", "gnd"]) allPins.add(pinKey(part.id, pin))
        break
      case "ldr":
        for (const pin of ["t1", "t2", "ao", "vcc", "gnd"]) allPins.add(pinKey(part.id, pin))
        break
      case "tmp36":
        for (const pin of ["vcc", "out", "vout", "gnd"]) allPins.add(pinKey(part.id, pin))
        break
      case "mq2-gas":
        for (const pin of ["vcc", "gnd", "do", "ao"]) allPins.add(pinKey(part.id, pin))
        break
      case "keypad-4x4":
        for (const pin of ["r1", "r2", "r3", "r4", "c1", "c2", "c3", "c4"]) allPins.add(pinKey(part.id, pin))
        break
      case "breadboard": {
        for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
          for (const r of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) {
            allPins.add(pinKey(part.id, `${r}_${c}`))
          }
          allPins.add(pinKey(part.id, `pos_t_${c}`))
          allPins.add(pinKey(part.id, `neg_t_${c}`))
          allPins.add(pinKey(part.id, `pos_b_${c}`))
          allPins.add(pinKey(part.id, `neg_b_${c}`))
        }
        allPins.add(pinKey(part.id, "pos_top"))
        allPins.add(pinKey(part.id, "neg_top"))
        allPins.add(pinKey(part.id, "pos_bot"))
        allPins.add(pinKey(part.id, "neg_bot"))
        break
      }
      default:
        allPins.add(pinKey(part.id, "vcc"))
        allPins.add(pinKey(part.id, "gnd"))
        break
    }
  }

  for (const w of state.wires) {
    allPins.add(wirePinKey(w.from.partId, w.from.pinId))
    allPins.add(wirePinKey(w.to.partId, w.to.pinId))
  }

  // 2. Disjoint Set Union (DSU) to group directly wired pins into equipotential Nets
  const parent = new Map<string, string>()
  function find(u: string): string {
    if (!parent.has(u)) parent.set(u, u)
    if (parent.get(u) !== u) {
      parent.set(u, find(parent.get(u)!))
    }
    return parent.get(u)!
  }
  function union(u: string, v: string) {
    const rootU = find(u)
    const rootV = find(v)
    if (rootU !== rootV) {
      parent.set(rootU, rootV)
    }
  }

  for (const w of state.wires) {
    union(wirePinKey(w.from.partId, w.from.pinId), wirePinKey(w.to.partId, w.to.pinId))
  }

  for (const part of state.parts) {
    if (part.type === "breadboard") {
      const k = (pin: string) => pinKey(part.id, pin)
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const top = ["a", "b", "c", "d", "e"]
        for (let i = 0; i < top.length - 1; i++) {
          union(k(`${top[i]}_${c}`), k(`${top[i + 1]}_${c}`))
        }
        const bot = ["f", "g", "h", "i", "j"]
        for (let i = 0; i < bot.length - 1; i++) {
          union(k(`${bot[i]}_${c}`), k(`${bot[i + 1]}_${c}`))
        }
      }
      for (let c = 1; c < BREADBOARD_COLUMNS; c++) {
        union(k(`pos_t_${c}`), k(`pos_t_${c + 1}`))
        union(k(`neg_t_${c}`), k(`neg_t_${c + 1}`))
        union(k(`pos_b_${c}`), k(`pos_b_${c + 1}`))
        union(k(`neg_b_${c}`), k(`neg_b_${c + 1}`))
      }
      union(k("pos_top"), k("pos_t_1"))
      union(k("neg_top"), k("neg_t_1"))
      union(k("pos_bot"), k("pos_b_1"))
      union(k("neg_bot"), k("neg_b_1"))
      for (const [index, row] of ["a", "b", "c", "d", "e"].entries()) {
        const column = (index + 1) * 3
        union(k(`${row}1`), k(`${row}_${column}`))
        const bottomRow = String.fromCharCode(row.charCodeAt(0) + 5)
        union(k(`${row}2`), k(`${bottomRow}_${column}`))
      }
    } else if (part.type === "pushbutton") {
      const k = (pin: string) => pinKey(part.id, pin)
      union(k("p1a"), k("p1b"))
      union(k("p2a"), k("p2b"))
      if (pressed.has(part.id)) {
        union(k("p1a"), k("p2a"))
      }
    } else {
      const board = getBoardForPart(part)
      if (board) {
        const k = (pin: string) => pinKey(part.id, pin)
        // Union all ground pins together and with standard gnd alias
        const gnds = board.powerPins.gnd ?? []
        for (let i = 0; i < gnds.length; i++) {
          allPins.add(k(gnds[i]))
          allPins.add(k("gnd"))
          union(k(gnds[0]), k(gnds[i]))
          union(k(gnds[i]), k("gnd"))
        }
        // Union all 3.3V power pins
        const v33s = board.powerPins.v33 ?? []
        for (let i = 0; i < v33s.length; i++) {
          allPins.add(k(v33s[i]))
          allPins.add(k("3v3"))
          allPins.add(k("3.3v"))
          union(k(v33s[0]), k(v33s[i]))
          union(k(v33s[i]), k("3v3"))
          union(k(v33s[i]), k("3.3v"))
        }
        // Union all 5V power pins
        const v5s = board.powerPins.v5 ?? []
        for (let i = 0; i < v5s.length; i++) {
          allPins.add(k(v5s[i]))
          allPins.add(k("5v"))
          union(k(v5s[0]), k(v5s[i]))
          union(k(v5s[i]), k("5v"))
        }
        // Union all pin aliases
        for (const bp of board.pins) {
          allPins.add(k(bp.id))
          const stripped = bp.id.replace(/^(gpio|gp|d|p)/i, "")
          if (stripped) {
            allPins.add(k(stripped))
            allPins.add(k(`d${stripped}`))
            allPins.add(k(`gpio${stripped}`))
            allPins.add(k(`gp${stripped}`))
            allPins.add(k(`p${stripped}`))
            union(k(bp.id), k(stripped))
            union(k(bp.id), k(`d${stripped}`))
            union(k(bp.id), k(`gpio${stripped}`))
            union(k(bp.id), k(`gp${stripped}`))
            union(k(bp.id), k(`p${stripped}`))
          }
          for (const alt of bp.alternateNames ?? []) {
            allPins.add(k(alt.toLowerCase()))
            union(k(bp.id), k(alt.toLowerCase()))
          }
        }
      }
    }
  }

  // 3. Map roots to unique Net numbers (0..N-1)
  const rootToNetId = new Map<string, number>()
  let nextNetId = 0
  for (const p of allPins) {
    const root = find(p)
    if (!rootToNetId.has(root)) {
      rootToNetId.set(root, nextNetId++)
    }
  }

  const pinToNetId = (partId: string, pinId: string) => {
    return rootToNetId.get(find(pinKey(partId, pinId))) ?? 0
  }

  // 4. Identify Fixed Voltage Nets
  const fixedNets = new Map<number, { voltage: number; label: string; isDigitalLow?: boolean; digitalPinName?: string }>()

  for (const part of state.parts) {
    const board = getBoardForPart(part)
    if (board) {
      if (board.powerPins.v5) {
        for (const p of board.powerPins.v5) {
          fixedNets.set(pinToNetId(part.id, p), { voltage: 5.0, label: `${board.shortName} 5V Power Rail` })
        }
      }
      if (board.powerPins.vin) {
        for (const p of board.powerPins.vin) {
          fixedNets.set(pinToNetId(part.id, p), { voltage: 5.0, label: `${board.shortName} VIN (5.0V)` })
        }
      }
      if (board.powerPins.v33) {
        for (const p of board.powerPins.v33) {
          fixedNets.set(pinToNetId(part.id, p), { voltage: 3.3, label: `${board.shortName} 3.3V Rail` })
        }
      }
      for (const g of board.powerPins.gnd) {
        fixedNets.set(pinToNetId(part.id, g), { voltage: 0.0, label: "Ground (0V)" })
      }

      for (const pin of board.pins) {
        if (pin.kind === "digital" || pin.kind === "analog") {
          const pinId = pin.id
          const netD = pinToNetId(part.id, pinId)
          const pState = lookupBoardPinState(pinStates, pinId, board)

          if (pState?.state === "HIGH") {
            fixedNets.set(netD, { voltage: board.logicVoltage, label: `${board.shortName} Pin ${pin.label} (HIGH = ${board.logicVoltage}V)` })
          } else if (pState?.value !== undefined && pState.value > 0) {
            const isDac = pin.capabilities?.dac === true
            const vOut = Number((board.logicVoltage * (pState.value / 255)).toFixed(2))
            const label = isDac
              ? `${board.shortName} DAC Output ${pin.label} (${pState.value}/255 = ${vOut}V DC)`
              : `${board.shortName} Pin ${pin.label} (PWM ${pState.value}/255 = ${vOut}V)`
            fixedNets.set(netD, { voltage: vOut, label })
          } else if (pState?.state === "LOW") {
            fixedNets.set(netD, {
              voltage: 0.0,
              label: `${board.shortName} Pin ${pin.label} (OUTPUT LOW = 0.0V)`,
              isDigitalLow: true,
              digitalPinName: pin.label,
            })
          }
        }
      }
    } else if (part.type === "battery") {
      const netPos = pinToNetId(part.id, "pos")
      const voltage = Math.max(0, Number(part.props.voltage ?? 9))
      fixedNets.set(netPos, { voltage, label: `${voltage}V Battery (+)` })
      const netNeg = pinToNetId(part.id, "neg")
      fixedNets.set(netNeg, { voltage: 0.0, label: "Battery Ground (0V)" })
    }
  }

  // 5. Expose deterministic module outputs only when their power and ground
  // nets are actually connected to a fixed source/sink.
  for (const part of state.parts) {
    const poweredTypes = ["ir-sensor", "dht11", "oled-i2c", "joystick", "soil-moisture", "ldr", "tmp36", "mq2-gas"]
    if (!poweredTypes.includes(part.type)) continue
    const vccPin = pinToNetId(part.id, "vcc")
    const gndPin = pinToNetId(part.id, "gnd")
    if (!fixedNets.has(vccPin) || !fixedNets.has(gndPin)) continue

    const vSupply = fixedNets.get(vccPin)?.voltage ?? 5.0

    const setOutputIfFree = (pinId: string, voltage: number, label: string) => {
      const net = pinToNetId(part.id, pinId)
      if (!fixedNets.has(net)) fixedNets.set(net, { voltage, label })
    }

    if (part.type === "ir-sensor") {
      setOutputIfFree("out", String(part.props.detected ?? "false") === "true" ? vSupply : 0, "IR sensor " + part.id + " OUT")
    } else if (part.type === "dht11") {
      setOutputIfFree("data", Math.min(3.3, vSupply), "DHT11 " + part.id + " DATA")
    } else if (part.type === "oled-i2c") {
      setOutputIfFree("sda", Math.min(3.3, vSupply), "OLED " + part.id + " SDA")
      setOutputIfFree("scl", Math.min(3.3, vSupply), "OLED " + part.id + " SCL")
    } else if (part.type === "joystick") {
      setOutputIfFree("vrx", Math.max(0, Math.min(vSupply, (Number(part.props.x ?? 512) / 1023) * vSupply)), "Joystick " + part.id + " VRx")
      setOutputIfFree("vry", Math.max(0, Math.min(vSupply, (Number(part.props.y ?? 512) / 1023) * vSupply)), "Joystick " + part.id + " VRy")
      setOutputIfFree("sw", String(part.props.pressed ?? "false") === "true" ? vSupply : 0, "Joystick " + part.id + " SW")
    } else if (part.type === "soil-moisture") {
      setOutputIfFree("ao", Math.max(0, Math.min(vSupply, (Number(part.props.moisture ?? 620) / 1023) * vSupply)), "Soil moisture " + part.id + " AO")
    } else if (part.type === "ldr") {
      setOutputIfFree("ao", Math.max(0, Math.min(vSupply, (Number(part.props.light ?? 512) / 1023) * vSupply)), "LDR " + part.id + " AO")
    } else if (part.type === "tmp36") {
      const vTemp = Math.max(0, Math.min(vSupply, (Number(part.props.temperature ?? 25) * 0.01) + 0.5))
      setOutputIfFree("out", vTemp, "TMP36 " + part.id + " OUT")
      setOutputIfFree("vout", vTemp, "TMP36 " + part.id + " VOUT")
    } else if (part.type === "mq2-gas") {
      const gas = Number(part.props.gasLevel ?? part.props.gasPpm ?? 150)
      const thresh = Number(part.props.threshold ?? 350)
      setOutputIfFree("ao", Math.max(0, Math.min(vSupply, (gas / 1000) * vSupply)), "MQ-2 " + part.id + " AO")
      setOutputIfFree("do", gas >= thresh ? vSupply : 0, "MQ-2 " + part.id + " DO")
    }
  }

  // 5. Build component branches
  interface Branch {
    netA: number
    netB: number
    conductance: number
    isDiode?: boolean
    vForward?: number
  }

  const branches: Branch[] = []

  for (const part of state.parts) {
    switch (part.type) {
      case "resistor": {
        const netA = pinToNetId(part.id, "a")
        const netB = pinToNetId(part.id, "b")
        const rVal = Math.max(0.1, Number(part.props.resistance || 220))
        branches.push({ netA, netB, conductance: 1 / rVal })
        break
      }
      case "ldr": {
        const netT1 = pinToNetId(part.id, "t1")
        const netT2 = pinToNetId(part.id, "t2")
        const light = Math.max(0, Math.min(1023, Number(part.props.light ?? 512)))
        const rLdr = Math.max(200, Math.round(50000 / (1 + (light / 1023) * 99)))
        branches.push({ netA: netT1, netB: netT2, conductance: 1 / rLdr })
        break
      }
      case "potentiometer": {
        const netT1 = pinToNetId(part.id, "t1")
        const netWiper = pinToNetId(part.id, "wiper")
        const netT2 = pinToNetId(part.id, "t2")
        const val = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const rTotal = Math.max(1, Number(part.props.resistance ?? 10000))
        const r1 = Math.max(0.5, (val / 1023) * rTotal)
        const r2 = Math.max(0.5, ((1023 - val) / 1023) * rTotal)
        branches.push({ netA: netT1, netB: netWiper, conductance: 1 / r1 })
        branches.push({ netA: netWiper, netB: netT2, conductance: 1 / r2 })
        break
      }
      case "led": {
        const netA = pinToNetId(part.id, "anode")
        const netC = pinToNetId(part.id, "cathode")
        const color = String(part.props.color ?? "red").toLowerCase()
        const vf = color.includes("white") ? 3.3 : color.includes("blue") ? 3.2 : color.includes("green") ? 2.1 : color.includes("yellow") ? 2.0 : 1.9
        branches.push({ netA, netB: netC, conductance: 1 / 10, isDiode: true, vForward: vf })
        break
      }
      case "buzzer": {
        const netA = pinToNetId(part.id, "pos")
        const netB = pinToNetId(part.id, "neg")
        branches.push({ netA, netB, conductance: 1 / 100 })
        break
      }
      case "dc-motor": {
        const netA = pinToNetId(part.id, "pos")
        const netB = pinToNetId(part.id, "neg")
        branches.push({ netA, netB, conductance: 1 / 50 })
        break
      }
    }
  }

  // A diode's piecewise-linear forward drop is a model of a conducting diode,
  // not an independent voltage source. Decide whether it can conduct from the
  // open-diode network first. This prevents an unpowered LED branch from
  // self-biasing to Vf (for example, showing 1.9V after the MCU output is reset).
  const passiveAdjacency = new Map<number, number[]>()
  for (const branch of branches) {
    if (branch.isDiode || branch.netA === branch.netB) continue
    passiveAdjacency.set(branch.netA, [...(passiveAdjacency.get(branch.netA) ?? []), branch.netB])
    passiveAdjacency.set(branch.netB, [...(passiveAdjacency.get(branch.netB) ?? []), branch.netA])
  }
  const reachableSourceVoltages = (startNet: number) => {
    const seen = new Set<number>([startNet])
    const queue = [startNet]
    const voltages: number[] = []
    for (let index = 0; index < queue.length; index += 1) {
      const netId = queue[index]
      const fixed = fixedNets.get(netId)
      if (fixed) voltages.push(fixed.voltage)
      for (const neighbor of passiveAdjacency.get(netId) ?? []) {
        if (seen.has(neighbor)) continue
        seen.add(neighbor)
        queue.push(neighbor)
      }
    }
    return voltages
  }
  const activeBranches = branches.filter((branch) => {
    if (!branch.isDiode || !branch.vForward) return true
    const anodeSources = reachableSourceVoltages(branch.netA)
    const cathodeSources = reachableSourceVoltages(branch.netB)
    return anodeSources.some((anodeV) =>
      cathodeSources.some((cathodeV) => anodeV - cathodeV >= branch.vForward! - 0.1),
    )
  })

  // Identify electrically floating networks before numerical regularization.
  // The tiny diagonal term below stabilizes the matrix, but must not make an
  // open circuit look like a real 0V measurement.
  const sourceReachable = new Set(fixedNets.keys())
  const branchAdjacency = new Map<number, number[]>()
  for (const branch of activeBranches) {
    if (branch.netA === branch.netB) continue
    branchAdjacency.set(branch.netA, [...(branchAdjacency.get(branch.netA) ?? []), branch.netB])
    branchAdjacency.set(branch.netB, [...(branchAdjacency.get(branch.netB) ?? []), branch.netA])
  }
  const reachableQueue = [...sourceReachable]
  for (let index = 0; index < reachableQueue.length; index++) {
    for (const neighbor of branchAdjacency.get(reachableQueue[index]) ?? []) {
      if (sourceReachable.has(neighbor)) continue
      sourceReachable.add(neighbor)
      reachableQueue.push(neighbor)
    }
  }
  const floatingNets = new Set<number>()
  for (let id = 0; id < nextNetId; id++) {
    if (!sourceReachable.has(id)) floatingNets.add(id)
  }

  // 6. Modified Nodal Analysis (MNA)
  const netVoltages = new Map<number, number>()
  for (const [netId, info] of fixedNets.entries()) {
    netVoltages.set(netId, info.voltage)
  }

  const unknownNets: number[] = []
  const netToUnknownIdx = new Map<number, number>()
  for (let id = 0; id < nextNetId; id++) {
    if (!fixedNets.has(id)) {
      netToUnknownIdx.set(id, unknownNets.length)
      unknownNets.push(id)
    }
  }

  const M = unknownNets.length

  if (M > 0) {
    let solvedBranches = activeBranches.slice()

    for (let pass = 0; pass < 2; pass++) {
      const A: number[][] = Array.from({ length: M }, () => new Array(M).fill(0))
      const B: number[] = new Array(M).fill(0)

      for (const br of solvedBranches) {
        if (br.netA === br.netB) continue

        const G = br.conductance
        const u = netToUnknownIdx.get(br.netA)
        const v = netToUnknownIdx.get(br.netB)

        if (u !== undefined && v !== undefined) {
          A[u][u] += G
          A[v][v] += G
          A[u][v] -= G
          A[v][u] -= G
        } else if (u !== undefined && v === undefined) {
          const vFixed = netVoltages.get(br.netB) ?? 0
          A[u][u] += G
          B[u] += G * vFixed
        } else if (u === undefined && v !== undefined) {
          const vFixed = netVoltages.get(br.netA) ?? 0
          A[v][v] += G
          B[v] += G * vFixed
        }

        if (br.isDiode && br.vForward) {
          const iEq = G * br.vForward
          // Model a forward diode as I = G * (Va - Vc - Vf). In the
          // nodal equation, the forward-voltage source contributes +G*Vf
          // to the anode RHS and -G*Vf to the cathode RHS. The old signs
          // drove a valid LED series node below ground, then the diode was
          // removed as reverse-biased; that made both resistor terminals
          // appear to be at the same supply voltage in the DMM.
          if (u !== undefined) B[u] += iEq
          if (v !== undefined) B[v] -= iEq
        }
      }

      for (let i = 0; i < M; i++) {
        A[i][i] += 1e-9
      }

      const x = solveLinearSystem(A, B)
      for (let i = 0; i < M; i++) {
        const netId = unknownNets[i]
        const vSolved = Math.max(0, Number(x[i].toFixed(3)))
        netVoltages.set(netId, vSolved)
      }

      let recheckNeeded = false
      solvedBranches = solvedBranches.filter((br) => {
        if (br.isDiode && br.vForward) {
          const vA = netVoltages.get(br.netA) ?? 0
          const vC = netVoltages.get(br.netB) ?? 0
          if (vA - vC < br.vForward - 0.1) {
            recheckNeeded = true
            return false
          }
        }
        return true
      })

      if (!recheckNeeded) break
    }
  }

  // 7. Map calculated potentials to every pin
  const pinPotentials = new Map<string, PinPotentialInfo>()

  for (const pin of allPins) {
    const [partId, pinId] = pin.split(":")
    const netId = pinToNetId(partId, pinId)
    const fixedInfo = fixedNets.get(netId)
    const voltage = netVoltages.get(netId) ?? 0

    pinPotentials.set(pin, {
      voltage: floatingNets.has(netId) ? 0 : Number(voltage.toFixed(2)),
      netId,
      sourceLabel: fixedInfo?.label ?? (floatingNets.has(netId) ? "Floating / open circuit" : undefined),
      isDriven: fixedInfo !== undefined && fixedInfo.voltage > 0,
      isGnd: fixedInfo !== undefined && fixedInfo.voltage === 0 && !fixedInfo.isDigitalLow,
      isDigitalLow: fixedInfo?.isDigitalLow,
      isFloating: floatingNets.has(netId),
      digitalPinName: fixedInfo?.digitalPinName,
    })
  }

  const getPinVoltage = (ref: PinRef | null): number => {
    if (!ref) return 0
    return pinPotentials.get(pinKey(ref.partId, ref.pinId))?.voltage ?? 0
  }

  const getPinInfo = (ref: PinRef | null): PinPotentialInfo => {
    if (!ref) {
      return { voltage: 0, netId: -1, isDriven: false, isGnd: false }
    }
    return pinPotentials.get(pinKey(ref.partId, ref.pinId)) ?? {
      voltage: 0,
      netId: -1,
      isDriven: false,
      isGnd: false,
    }
  }

  const computeResistanceBetweenPins = (
    refA: PinRef | null,
    refB: PinRef | null
  ): { resistance: number; explanation: string; subtext?: string } => {
    if (!refA || !refB) {
      return { resistance: Infinity, explanation: "Clip both probes to measure resistance" }
    }

    if (refA.partId === refB.partId && refA.pinId === refB.pinId) {
      return { resistance: 0, explanation: "0.0 Ω (Direct short / same terminal)" }
    }

    const netA = pinToNetId(refA.partId, refA.pinId)
    const netB = pinToNetId(refB.partId, refB.pinId)

    if (netA === netB) {
      return {
        resistance: 0,
        explanation: "0.0 Ω (Direct wire / continuous tie-point)",
        subtext: "Both probes are clipped to the same electrical net",
      }
    }

    if (refA.partId === refB.partId && state.parts.find((p) => p.id === refA.partId)?.type === "resistor") {
      const p = state.parts.find((p) => p.id === refA.partId)!
      const r = Number(p.props.resistance || 220)
      return {
        resistance: r,
        explanation: `Component Resistance: ${r.toFixed(1)} Ω`,
        subtext: `Marking bands denote ${r}Ω nominal resistance`,
      }
    }

    if (refA.partId === refB.partId && state.parts.find((p) => p.id === refA.partId)?.type === "led") {
      return {
        resistance: Infinity,
        explanation: "Open Circuit / Diode Junction (O.L)",
        subtext: "LEDs are semiconductor diodes (Vf ≈ 1.8V - 2.2V). Continuity/Ohmmeter test voltage (<0.4V) cannot overcome the p-n junction barrier.",
      }
    }

    const adj = new Map<number, { to: number; r: number; partName: string }[]>()
    function addR(u: number, v: number, r: number, name: string) {
      if (!adj.has(u)) adj.set(u, [])
      if (!adj.has(v)) adj.set(v, [])
      adj.get(u)!.push({ to: v, r, partName: name })
      adj.get(v)!.push({ to: u, r, partName: name })
    }

    for (const part of state.parts) {
      if (part.type === "resistor") {
        const u = pinToNetId(part.id, "a")
        const v = pinToNetId(part.id, "b")
        const r = Math.max(0.1, Number(part.props.resistance || 220))
        addR(u, v, r, `${r}Ω Resistor`)
      } else if (part.type === "potentiometer") {
        const u = pinToNetId(part.id, "t1")
        const w = pinToNetId(part.id, "wiper")
        const v = pinToNetId(part.id, "t2")
        const val = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const rTotal = Math.max(1, Number(part.props.resistance ?? 10000))
        const r1 = Math.max(0.5, (val / 1023) * rTotal)
        const r2 = Math.max(0.5, ((1023 - val) / 1023) * rTotal)
        addR(u, w, r1, "Potentiometer T1-Wiper")
        addR(w, v, r2, "Potentiometer Wiper-T2")
      }
      // Note: LEDs are semiconductor diodes with non-linear p-n barrier voltage (Vf ≈ 1.8V-2.2V).
      // They do not act as low-resistance ohmic conductors for continuity or resistance measurement.
    }

    const dist = new Map<number, number>()
    const visited = new Set<number>()
    const pq = new MinPriorityQueue<{ net: number; d: number; parts: string[] }>((a, b) => a.d - b.d)
    pq.push({ net: netA, d: 0, parts: [] })
    dist.set(netA, 0)

    let bestR = Infinity
    let bestParts: string[] = []

    while (pq.size > 0) {
      const { net, d, parts } = pq.pop()!

      if (net === netB) {
        bestR = d
        bestParts = parts
        break
      }

      if (visited.has(net)) continue
      visited.add(net)

      const edges = adj.get(net) || []
      for (const e of edges) {
        const newD = d + e.r
        if (newD < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, newD)
          pq.push({ net: e.to, d: newD, parts: [...parts, e.partName] })
        }
      }
    }

    if (bestR === Infinity) {
      // Check if probes are directly on or connected across an LED
      const ledPart = state.parts.find((p) => {
        if (p.type !== "led") return false
        const anodeNet = pinToNetId(p.id, "anode")
        const cathodeNet = pinToNetId(p.id, "cathode")
        return (
          (netA === anodeNet && netB === cathodeNet) ||
          (netA === cathodeNet && netB === anodeNet) ||
          p.id === refA.partId ||
          p.id === refB.partId
        )
      })

      if (ledPart) {
        return {
          resistance: Infinity,
          explanation: "Open Circuit / Diode Junction (O.L)",
          subtext: "LEDs are semiconductor diodes (Vf ≈ 1.8V - 2.2V). Multimeter continuity/ohmmeter test voltage (<0.4V) cannot forward-bias the p-n barrier.",
        }
      }

      return {
        resistance: Infinity,
        explanation: "Open Circuit / High Resistance path (O.L)",
        subtext: "Probes are not connected by a continuous resistive path",
      }
    }

    return {
      resistance: Number(bestR.toFixed(1)),
      explanation: `Path Resistance: ${bestR >= 1000 ? (bestR / 1000).toFixed(2) + " kΩ" : bestR.toFixed(1) + " Ω"}`,
      subtext: bestParts.length > 0 ? `Through: ${bestParts.join(" + ")}` : undefined,
    }
  }

  const getPotentialDifference = (
    red: PinRef | null,
    black: PinRef | null,
    circuit: CircuitState,
    states: Record<string, ArduinoPinState>
  ) => {
    if (!red && !black) {
      return {
        diff: 0,
        vRed: 0,
        vBlack: 0,
        explanation: "Clip RED (+) or BLACK (-) probe to measure voltage",
        subtext: "Single-probe mode will automatically measure potential referenced to Ground (0V).",
      }
    }

    const formatPinLabel = (ref: PinRef) => {
      const p = circuit.parts.find((item) => item.id === ref.partId)
      const pName = p ? p.type.replace("-", " ").toUpperCase() : ref.partId
      return `${pName} (${ref.pinId})`
    }

    // Single-probe mode: Red probe only (Auto-referenced to Ground 0V)
    if (red && !black) {
      const infoRed = getPinInfo(red)
      const vRed = infoRed.voltage
      const label = formatPinLabel(red)

      if (infoRed.isFloating) {
        return {
          diff: 0,
          vRed: 0,
          vBlack: 0,
          explanation: `${label} is an open circuit — no defined voltage`,
          subtext: "Connect this pin to a powered circuit to measure its potential.",
          isWarning: true,
        }
      }

      if (infoRed.isDigitalLow) {
        return {
          diff: 0,
          vRed: 0,
          vBlack: 0,
          explanation: `Single Probe: ${label} is OUTPUT LOW (0.00V)`,
          subtext: `Referenced to Ground (0V). Set ${infoRed.digitalPinName || red.pinId} HIGH in code to output voltage.`,
          isWarning: true,
        }
      }

      return {
        diff: Number(vRed.toFixed(2)),
        vRed,
        vBlack: 0,
        explanation: `Single Probe: ${label} = ${vRed >= 0 ? "+" : ""}${vRed.toFixed(2)}V (Referenced to Ground)`,
        subtext: "Auto-GND active. Clip Black probe (-) to any other pin for differential ΔV measurement.",
      }
    }

    // Single-probe mode: Black probe only (Referenced to Ground 0V)
    if (!red && black) {
      const infoBlack = getPinInfo(black)
      const vBlack = infoBlack.voltage
      const label = formatPinLabel(black)

      if (infoBlack.isFloating) {
        return {
          diff: 0,
          vRed: 0,
          vBlack: 0,
          explanation: `${label} is an open circuit — no defined voltage`,
          subtext: "Connect this pin to a powered circuit to measure its potential.",
          isWarning: true,
        }
      }

      return {
        diff: Number((-vBlack).toFixed(2)),
        vRed: 0,
        vBlack,
        explanation: `Single Probe: Black on ${label} = ${vBlack.toFixed(2)}V (Referenced to Ground)`,
        subtext: "Clip Red probe (+) to a signal or power pin to measure positive potential.",
      }
    }

    // Dual-probe mode: Both probes connected
    const infoRed = getPinInfo(red)
    const infoBlack = getPinInfo(black)
    const vRed = infoRed.voltage
    const vBlack = infoBlack.voltage
    if (infoRed.isFloating || infoBlack.isFloating) {
      const openPin = infoRed.isFloating ? red : black
      return {
        diff: 0,
        vRed: 0,
        vBlack: 0,
        explanation: `${formatPinLabel(openPin)} is an open circuit — no defined voltage`,
        subtext: "Connect both probe points into a powered circuit to measure voltage.",
        isWarning: true,
      }
    }
    const diff = Number((vRed - vBlack).toFixed(2))

    // Check if probing directly across a resistor
    const sameResistor =
      red.partId === black.partId &&
      circuit.parts.find((p) => p.id === red.partId)?.type === "resistor"

    if (sameResistor) {
      const part = circuit.parts.find((p) => p.id === red.partId)!
      const rOhms = Number(part.props.resistance || 220)
      const currentMa = rOhms > 0 ? (Math.abs(diff) / rOhms) * 1000 : 0

      if (Math.abs(diff) > 0.05) {
        return {
          diff,
          vRed,
          vBlack,
          explanation: `Voltage Drop across ${rOhms}Ω Resistor: ${Math.abs(diff).toFixed(2)}V (Current: ${currentMa.toFixed(1)} mA)`,
          subtext: `Ohm's Law: ΔV = I × R = ${currentMa.toFixed(1)}mA × ${rOhms}Ω. Resistor drops ${Math.abs(diff).toFixed(2)}V to protect load!`,
        }
      } else {
        if (infoRed.isDigitalLow || infoBlack.isDigitalLow) {
          const pinName = infoRed.digitalPinName || infoBlack.digitalPinName || "Digital Pin"
          return {
            diff: 0,
            vRed,
            vBlack,
            explanation: `Arduino ${pinName} is currently OUTPUT LOW (0.00V)`,
            subtext: `Connect to 5V pin (bottom header) for continuous 5.0V, or set ${pinName} HIGH in code.`,
            isWarning: true,
          }
        }
        if (vRed > 0.5 && vBlack > 0.5) {
          return {
            diff: 0,
            vRed,
            vBlack,
            explanation: `No current flowing through resistor (Open circuit / disconnected load)`,
            subtext: `Both ends at ${vRed.toFixed(2)}V because I = 0A (Ohm's Law: ΔV = 0 × R = 0V)`,
          }
        }
        return {
          diff: 0,
          vRed,
          vBlack,
          explanation: "Resistor is not powered (0.00V at both terminals)",
          subtext: "Connect to Arduino 5V or an active HIGH digital pin to supply voltage.",
        }
      }
    }

    // Check if one probe is on a digital pin that is LOW
    if (infoRed.isDigitalLow && !infoBlack.isDriven && vBlack === 0) {
      return {
        diff: 0,
        vRed,
        vBlack,
        explanation: `Arduino ${infoRed.digitalPinName} is set to LOW (0.00V)`,
        subtext: `Connect wire to 5V pin (bottom header) or set ${infoRed.digitalPinName} HIGH in Blockly.`,
        isWarning: true,
      }
    }

    // Check if probing across an LED
    const sameLed =
      red.partId === black.partId &&
      circuit.parts.find((p) => p.id === red.partId)?.type === "led"

    if (sameLed) {
      return {
        diff,
        vRed,
        vBlack,
        explanation: `LED Diode Voltage (Vf): ${Math.abs(diff).toFixed(2)}V DC`,
        subtext: "Forward voltage drop across LED semiconductor diode junction.",
      }
    }

    // Check if probing a voltage divider node
    const isDividerNode =
      (vRed > 0.1 && vRed < 4.9 && infoBlack.isGnd) ||
      (vBlack > 0.1 && vBlack < 4.9 && infoRed.isGnd)

    if (isDividerNode) {
      return {
        diff,
        vRed,
        vBlack,
        explanation: `Voltage Divider Node Potential: ${diff >= 0 ? "+" : ""}${diff.toFixed(2)}V DC`,
        subtext: `Voltage divided across series resistors: Red (${vRed.toFixed(2)}V) minus Black (${vBlack.toFixed(2)}V).`,
      }
    }

    // Check if both probes are attached to the SAME electrical power rail / net (Equipotential)
    if (Math.abs(diff) < 0.05 && vRed > 0.5 && vBlack > 0.5) {
      const netLabel = infoRed.sourceLabel || infoBlack.sourceLabel || `+${vRed.toFixed(2)}V Power Rail`
      return {
        diff: 0,
        vRed,
        vBlack,
        explanation: `⚡ Equipotential Rail: Both probes are attached to the same +${vRed.toFixed(2)}V line (${netLabel})!`,
        subtext: `The multimeter measures potential difference (ΔV = V_Red - V_Black). Across the same wire or rail, ΔV = 0.00V. Move the BLACK probe (-) to Ground (0V) to measure supply voltage.`,
        isWarning: true,
      }
    }

    // Check if both probes are attached to Ground
    if (Math.abs(diff) < 0.05 && infoRed.isGnd && infoBlack.isGnd) {
      return {
        diff: 0,
        vRed: 0,
        vBlack: 0,
        explanation: "Both probes are connected to Ground (GND = 0.00V)",
        subtext: "Common ground reference. Connect Red probe (+) to a power or signal pin to measure voltage.",
      }
    }

    // Reversed polarity note
    let polarityNote = ""
    if (diff < 0) {
      polarityNote = ` (Reversed Polarity: Black probe is on higher potential +${vBlack.toFixed(2)}V)`
      return {
        diff,
        vRed,
        vBlack,
        explanation: `Potential Difference: Red (${vRed.toFixed(2)}V) minus Black (${vBlack.toFixed(2)}V)${polarityNote}`,
        subtext: `Reversed polarity: Connect Red (+) to higher potential and Black (-) to Ground for positive reading. Click [Swap Probes] to flip.`,
      }
    }

    return {
      diff,
      vRed,
      vBlack,
      explanation: `Potential Difference: Red (${vRed.toFixed(2)}V) minus Black (${vBlack.toFixed(2)}V)`,
      subtext: infoBlack.isGnd
        ? "Absolute potential measured relative to Ground (0V reference)."
        : "Differential voltage between two circuit nodes.",
    }
  }

  const computeCurrentBetweenPins = (
    red: PinRef | null,
    black: PinRef | null,
    runtime: Record<string, PartRuntime>
  ): { currentMa: number; explanation: string; subtext?: string; isWarning?: boolean } => {
    if (!red || !black) {
      return { currentMa: 0, explanation: "Clip both probes to measure current" }
    }

    const pd = getPotentialDifference(red, black, state, pinStates)

    // 1. If probes are across a single resistor
    if (red.partId === black.partId && state.parts.find((p) => p.id === red.partId)?.type === "resistor") {
      const part = state.parts.find((p) => p.id === red.partId)!
      const r = Number(part.props.resistance || 220)
      const currentMa = r > 0 ? (Math.abs(pd.diff) / r) * 1000 : 0
      return {
        currentMa: Number(currentMa.toFixed(1)),
        explanation: `Branch Current through Resistor: ${currentMa.toFixed(1)} mA`,
        subtext: `Ohm's Law: I = ΔV / R = ${Math.abs(pd.diff).toFixed(2)}V / ${r}Ω`,
      }
    }

    // 2. If probes are across an LED
    const ledPart = state.parts.find((p) => p.type === "led" && (p.id === red.partId || p.id === black.partId))
    if (ledPart) {
      const r = runtime[ledPart.id]
      const c = r?.currentMa ?? (r?.level ? 15.0 : 0)
      return {
        currentMa: Number(c.toFixed(1)),
        explanation: `LED Branch Current: ${c.toFixed(1)} mA`,
        subtext: r?.burnt ? "⚠️ OVERCURRENT BURNOUT!" : "Diode is conducting forward current",
        isWarning: r?.burnt,
      }
    }

    // 3. If probes are across power source and ground (e.g. Arduino Pin D13 & GND, or 5V & GND)
    const infoRed = getPinInfo(red)
    const infoBlack = getPinInfo(black)
    const hasSource = (infoRed.isDriven && infoBlack.isGnd) || (infoBlack.isDriven && infoRed.isGnd)
    if (hasSource) {
      const sourceRef = infoRed.isDriven ? red : black
      const sourcePinName = sourceRef.pinId.toUpperCase()
      let totalLoadMa = 0
      const activeComponents: string[] = []

      for (const part of state.parts) {
        const r = runtime[part.id]
        if (r && (r.currentMa || r.level)) {
          const ma = r.currentMa ?? 15.0
          totalLoadMa += ma
          activeComponents.push(part.type.toUpperCase())
        }
      }

      if (totalLoadMa > 0) {
        return {
          currentMa: Number(totalLoadMa.toFixed(1)),
          explanation: `Total Circuit Current supplied by ${sourceRef.partId.toUpperCase()} (${sourcePinName}): ${totalLoadMa.toFixed(1)} mA`,
          subtext: `Active loads: ${activeComponents.slice(0, 3).join(", ")} drawing power to Ground.`,
        }
      }
    }

    // 4. Default: If non-zero voltage drop across resistive path
    const rInfo = computeResistanceBetweenPins(red, black)
    if (rInfo.resistance > 0 && rInfo.resistance < Infinity && Math.abs(pd.diff) > 0.05) {
      const iMa = (Math.abs(pd.diff) / rInfo.resistance) * 1000
      return {
        currentMa: Number(iMa.toFixed(1)),
        explanation: `Path Current: ${iMa.toFixed(1)} mA`,
        subtext: `Ohm's Law: I = ΔV (${Math.abs(pd.diff).toFixed(2)}V) / R (${rInfo.resistance.toFixed(1)}Ω)`,
      }
    }

    return {
      currentMa: 0,
      explanation: "0.0 mA (No active current loop between probed terminals)",
      subtext: "Clip probes across an active component, source pin, or inline load during simulation.",
    }
  }

  return {
    pinPotentials,
    netVoltages,
    getPinVoltage,
    getPinInfo,
    getPotentialDifference,
    computeResistanceBetweenPins,
    computeCurrentBetweenPins,
  }
}
