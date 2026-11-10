import type { CircuitState, PinRef } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import type { ArduinoPinState } from "./simulation"
import { getBoardForPart, lookupBoardPinState } from "./board-registry"
import { normalizeBreadboardPinId } from "./breadboard-pins"
import { getLedElectricalModel } from "./electrical-model"
import { BREADBOARD_COLUMNS, CATALOG } from "./components-catalog"

export interface PinPotentialInfo {
  voltage: number
  netId: number
  sourceLabel?: string
  isDriven: boolean
  isGnd: boolean
  isDigitalLow?: boolean
  isFloating?: boolean
  isConflicted?: boolean
  digitalPinName?: string
}

export interface CircuitSolverDiagnostic {
  code: "source-conflict" | "diode-non-convergence"
  severity: "error" | "warning"
  message: string
  netId?: number
  sources?: string[]
}

export interface NodalSolution {
  pinPotentials: Map<string, PinPotentialInfo>
  netVoltages: Map<number, number>
  /** Signed solved DC branch current in mA; positive is pinA -> pinB. */
  branchCurrents: Map<string, number>
  diagnostics: CircuitSolverDiagnostic[]
  getBranchCurrent: (partId: string, pinA: string, pinB: string) => number
  /** Algebraic sum of solved branch currents leaving the given net (mA). */
  getNetCurrent: (netId: number) => number
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
const branchKey = (partId: string, pinA: string, pinB: string) => `${partId}:${pinA}->${pinB}`

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
  running: boolean = true,
  relayStates: Record<string, boolean> = {},
  runtime: Record<string, PartRuntime> = {},
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
      case "rgb-led":
        for (const pin of ["red", "green", "blue", "gnd"]) allPins.add(pinKey(part.id, pin))
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
      case "relay":
        for (const pin of ["vcc", "gnd", "in", "com", "no", "nc"]) allPins.add(pinKey(part.id, pin))
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
  const diagnostics: CircuitSolverDiagnostic[] = []
  const conflictedNets = new Set<number>()

  // Ideal voltage sources on one equipotential net must agree. Preserve the
  // first value for deterministic diagnostics, but invalidate the net.
  function setFixedNet(
    netId: number,
    info: { voltage: number; label: string; isDigitalLow?: boolean; digitalPinName?: string },
  ) {
    const previous = fixedNets.get(netId)
    if (previous && Math.abs(previous.voltage - info.voltage) > 1e-6) {
      conflictedNets.add(netId)
      if (!diagnostics.some((item) => item.code === "source-conflict" && item.netId === netId)) {
        diagnostics.push({
          code: "source-conflict",
          severity: "error",
          netId,
          sources: [previous.label, info.label],
          message: `Conflicting ideal voltage sources share one net: ${previous.label} (${previous.voltage}V) and ${info.label} (${info.voltage}V). Separate the sources or add a physically valid interface.`,
        })
      }
      return
    }
    if (!previous) fixedNets.set(netId, info)
  }

  for (const part of state.parts) {
    const board = getBoardForPart(part)
    if (board) {
      if (board.powerPins.v5) {
        for (const p of board.powerPins.v5) {
          setFixedNet(pinToNetId(part.id, p), { voltage: 5.0, label: `${board.shortName} 5V Power Rail` })
        }
      }
      if (board.powerPins.vin) {
        for (const p of board.powerPins.vin) {
          setFixedNet(pinToNetId(part.id, p), { voltage: 5.0, label: `${board.shortName} VIN (5.0V)` })
        }
      }
      if (board.powerPins.v33) {
        for (const p of board.powerPins.v33) {
          setFixedNet(pinToNetId(part.id, p), { voltage: 3.3, label: `${board.shortName} 3.3V Rail` })
        }
      }
      for (const g of board.powerPins.gnd) {
        setFixedNet(pinToNetId(part.id, g), { voltage: 0.0, label: "Ground (0V)" })
      }

      for (const pin of board.pins) {
        if (pin.kind === "digital" || pin.kind === "analog") {
          const pinId = pin.id
          const netD = pinToNetId(part.id, pinId)
          const pState = lookupBoardPinState(pinStates, pinId, board)

          const legacyPwmState =
            pState?.outputMode === undefined &&
            pState?.state === "HIGH" &&
            pState.value !== undefined &&
            pState.value > 1
          if (
            pState?.outputMode === "dac" &&
            pin.capabilities?.dac === true &&
            typeof pState.value === "number"
          ) {
            // True DAC output is continuous analog voltage, distinct from PWM.
            const vOut = Number((board.logicVoltage * Math.max(0, Math.min(1, pState.value / 255))).toFixed(3))
            setFixedNet(netD, {
              voltage: vOut,
              label: `${board.shortName} DAC Output ${pin.label} (${pState.value}/255 = ${vOut}V DC)`,
            })
          } else if (pState?.outputMode === "pwm" || legacyPwmState) {
            // A multimeter reports the DC average of a PWM signal; the
            // waveform sampler reports instantaneous HIGH/LOW pulses.
            const duty = Math.max(0, Math.min(1, (pState.value ?? 0) / 255))
            const vOut = Number((board.logicVoltage * duty).toFixed(3))
            setFixedNet(netD, {
              voltage: vOut,
              label: `${board.shortName} Pin ${pin.label} (PWM average ${pState.value}/255 = ${vOut}V)`,
            })
          } else if (pState?.outputMode === "tone") {
            const vOut = Number((board.logicVoltage * 0.5).toFixed(3))
            setFixedNet(netD, {
              voltage: vOut,
              label: `${board.shortName} Pin ${pin.label} (Tone waveform average = ${vOut}V)`,
            })
          } else if (pState?.outputMode === "servo") {
            const duty = (1 + Math.max(0, Math.min(180, pState.angle ?? 90)) / 180) / 20
            const vOut = Number((board.logicVoltage * duty).toFixed(3))
            setFixedNet(netD, {
              voltage: vOut,
              label: `${board.shortName} Pin ${pin.label} (Servo pulse average = ${vOut}V)`,
            })
          } else if (pState?.state === "HIGH") {
            setFixedNet(netD, { voltage: board.logicVoltage, label: `${board.shortName} Pin ${pin.label} (HIGH = ${board.logicVoltage}V)` })
          } else if (pState?.state === "LOW") {
            setFixedNet(netD, {
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
      const voltage = Number(part.props.voltage ?? 9)
      setFixedNet(netPos, { voltage, label: `${voltage}V Battery (+)` })
      const netNeg = pinToNetId(part.id, "neg")
      setFixedNet(netNeg, { voltage: 0.0, label: "Battery Ground (0V)" })
    }
  }

  // 5. Expose deterministic module outputs only when their power and ground
  // nets are actually connected to a fixed source/sink.
  for (const part of state.parts) {
    const poweredTypes = ["ir-sensor", "dht11", "oled-i2c", "joystick", "rotary-encoder", "soil-moisture", "tmp36", "mq2-gas"]
    if (!poweredTypes.includes(part.type)) continue
    const vccPin = pinToNetId(part.id, "vcc")
    const gndPin = pinToNetId(part.id, "gnd")
    if (!fixedNets.has(vccPin) || !fixedNets.has(gndPin)) continue

    const vSupply = fixedNets.get(vccPin)?.voltage ?? 5.0

    const setOutputIfFree = (pinId: string, voltage: number, label: string) => {
      const net = pinToNetId(part.id, pinId)
      if (!fixedNets.has(net)) setFixedNet(net, { voltage, label })
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
    } else if (part.type === "rotary-encoder") {
      setOutputIfFree("sw", String(part.props.pressed ?? "false") === "true" ? vSupply : 0, "Rotary encoder " + part.id + " SW")
    } else if (part.type === "soil-moisture") {
      setOutputIfFree("ao", Math.max(0, Math.min(vSupply, (Number(part.props.moisture ?? 620) / 1023) * vSupply)), "Soil moisture " + part.id + " AO")
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
    partId: string
    pinA: string
    pinB: string
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
        branches.push({ netA, netB, conductance: 1 / rVal, partId: part.id, pinA: "a", pinB: "b" })
        break
      }
      case "ldr": {
        const netT1 = pinToNetId(part.id, "t1")
        const netT2 = pinToNetId(part.id, "t2")
        const light = Math.max(0, Math.min(1023, Number(part.props.light ?? 512)))
        const rLdr = Math.max(200, Math.round(50000 / (1 + (light / 1023) * 99)))
        branches.push({ netA: netT1, netB: netT2, conductance: 1 / rLdr, partId: part.id, pinA: "t1", pinB: "t2" })
        break
      }
      case "potentiometer": {
        const netT1 = pinToNetId(part.id, "t1")
        const netWiper = pinToNetId(part.id, "wiper")
        const netT2 = pinToNetId(part.id, "t2")
        const val = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const rTotal = Math.max(1, Number(part.props.resistance ?? 10000))
        const r1 = Math.max(0.5, ((1023 - val) / 1023) * rTotal)
        const r2 = Math.max(0.5, (val / 1023) * rTotal)
        branches.push({ netA: netT1, netB: netWiper, conductance: 1 / r1, partId: part.id, pinA: "t1", pinB: "wiper" })
        branches.push({ netA: netWiper, netB: netT2, conductance: 1 / r2, partId: part.id, pinA: "wiper", pinB: "t2" })
        break
      }
      case "led": {
        const netA = pinToNetId(part.id, "anode")
        const netC = pinToNetId(part.id, "cathode")
        const { forwardVoltage } = getLedElectricalModel(part)
        branches.push({ netA, netB: netC, conductance: 1 / 10, partId: part.id, pinA: "anode", pinB: "cathode", isDiode: true, vForward: forwardVoltage })
        break
      }
      case "rgb-led": {
        const commonCathode = pinToNetId(part.id, "gnd")
        for (const channel of ["red", "green", "blue"] as const) {
          const netA = pinToNetId(part.id, channel)
          const { forwardVoltage } = getLedElectricalModel(part, channel)
          branches.push({
            netA,
            netB: commonCathode,
            conductance: 1 / 10,
            partId: part.id,
            pinA: channel,
            pinB: "gnd",
            isDiode: true,
            vForward: forwardVoltage,
          })
        }
        break
      }
      case "buzzer": {
        // A passive piezo is not a 100Ω DC resistor. Only use the simplified
        // equivalent while the runtime has an active tone/sound state.
        if ((runtime[part.id]?.level ?? 0) > 0) {
          const netA = pinToNetId(part.id, "pos")
          const netB = pinToNetId(part.id, "neg")
          branches.push({ netA, netB, conductance: 1 / 100, partId: part.id, pinA: "pos", pinB: "neg" })
        }
        break
      }
      case "dc-motor": {
        const netA = pinToNetId(part.id, "pos")
        const netB = pinToNetId(part.id, "neg")
        branches.push({ netA, netB, conductance: 1 / 50, partId: part.id, pinA: "pos", pinB: "neg" })
        break
      }
      case "relay": {
        // The normally-closed contact is the default physical state. When the
        // coil is energized, switch the low-resistance contact to COM–NO.
        const activeContact = relayStates[part.id] === true ? "no" : "nc"
        branches.push({
          netA: pinToNetId(part.id, "com"),
          netB: pinToNetId(part.id, activeContact),
          conductance: 1 / 0.05,
          partId: part.id,
          pinA: "com",
          pinB: activeContact,
        })
        break
      }
      case "npn-transistor": {
        if (runtime[part.id]?.conducting === true) {
          branches.push({
            netA: pinToNetId(part.id, "collector"),
            netB: pinToNetId(part.id, "emitter"),
            conductance: 1 / 0.2,
            partId: part.id,
            pinA: "collector",
            pinB: "emitter",
          })
        }
        break
      }
      case "seven-segment": {
        const activeSegments = runtime[part.id]?.segments ?? {}
        const commonAnode = String(part.props.commonType ?? "cathode") === "anode"
        const ledModel = getLedElectricalModel(part)
        for (const segment of ["a", "b", "c", "d", "e", "f", "g", "dp"]) {
          if (activeSegments[segment] !== true) continue
          branches.push({
            netA: pinToNetId(part.id, commonAnode ? "com" : segment),
            netB: pinToNetId(part.id, commonAnode ? segment : "com"),
            conductance: 1 / 10,
            partId: part.id,
            pinA: commonAnode ? "com" : segment,
            pinB: commonAnode ? segment : "com",
            isDiode: true,
            vForward: ledModel.forwardVoltage,
          })
        }
        break
      }
    }

    // Component-level supply loads are explicit catalogue equivalents. The
    // current scales with actual terminal voltage as a resistor model; their
    // provenance remains "module-estimate" until a concrete module is selected.
    const supplyLoads = CATALOG[part.type].electrical?.supplyLoads ?? []
    for (const load of supplyLoads) {
      const runtimeState = runtime[part.id]
      const active =
        load.activeWhen === "relay-energized" ? runtimeState?.relayActive === true :
        load.activeWhen === "servo-command" ? typeof runtimeState?.angle === "number" :
        load.activeWhen === "display-enabled" ? runtimeState?.lcdBacklight !== false :
        load.activeWhen === "pixels-lit" ? (runtimeState?.level ?? 0) > 0 :
        true
      const nominalCurrentMa = Number(part.props.supplyCurrentMa ?? load.nominalCurrentMa)
      if (!active || !Number.isFinite(nominalCurrentMa) || nominalCurrentMa <= 0 ||
          !Number.isFinite(load.nominalVoltage) || load.nominalVoltage <= 0) continue
      const conductance = (nominalCurrentMa / 1000) / load.nominalVoltage
      branches.push({
        netA: pinToNetId(part.id, load.positivePin),
        netB: pinToNetId(part.id, load.negativePin),
        conductance,
        partId: part.id,
        pinA: load.positivePin,
        pinB: load.negativePin,
      })
    }

    // WS2812-style pixels are variable-current loads: each full-brightness
    // colour channel is modelled as a 20mA channel. The pixel colour array is
    // the runtime output after show(); dark/idle pixels draw no LED-channel load.
    if (part.type === "neopixel-ring" && (runtime[part.id]?.level ?? 0) > 0) {
      const model = CATALOG[part.type].electrical
      const currentPerChannelMa = model?.pixelCurrentPerChannelMa ?? 0
      const referenceVoltage = model?.pixelReferenceVoltage ?? 0
      const offColor = (model?.pixelOffColor ?? "#0f172a").toLowerCase()
      const colors = runtime[part.id]?.pixelColors ?? []
      const currentMa = colors.reduce((total, color) => {
        const raw = String(color).trim().replace(/^#/, "")
        if (!/^[0-9a-fA-F]{6}$/.test(raw) || ("#" + raw).toLowerCase() === offColor) return total
        const red = parseInt(raw.slice(0, 2), 16)
        const green = parseInt(raw.slice(2, 4), 16)
        const blue = parseInt(raw.slice(4, 6), 16)
        return total + ((red + green + blue) / 255) * currentPerChannelMa
      }, 0)
      if (currentMa > 0 && referenceVoltage > 0) {
        branches.push({
          netA: pinToNetId(part.id, "vcc"),
          netB: pinToNetId(part.id, "gnd"),
          conductance: (currentMa / 1000) / referenceVoltage,
          partId: part.id,
          pinA: "vcc",
          pinB: "gnd",
        })
      }
    }
  }

  // 6. Modified Nodal Analysis (MNA) with a convergent piecewise-linear
  // diode active-set. Remove reverse/negative-current branches, add forward-
  // biased inactive branches, and continue until the set is stable.
  const netVoltages = new Map<number, number>()
  const unknownNets: number[] = []
  const netToUnknownIdx = new Map<number, number>()
  for (let id = 0; id < nextNetId; id++) {
    if (!fixedNets.has(id)) {
      netToUnknownIdx.set(id, unknownNets.length)
      unknownNets.push(id)
    }
  }

  const solveWithBranches = (solvedBranches: Branch[]) => {
    const voltages = new Map<number, number>()
    for (const [netId, info] of fixedNets.entries()) voltages.set(netId, info.voltage)
    const M = unknownNets.length
    if (M === 0) return voltages

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
      } else if (u !== undefined) {
        A[u][u] += G
        B[u] += G * (voltages.get(br.netB) ?? 0)
      } else if (v !== undefined) {
        A[v][v] += G
        B[v] += G * (voltages.get(br.netA) ?? 0)
      }
      if (br.isDiode && br.vForward) {
        const iEq = G * br.vForward
        if (u !== undefined) B[u] += iEq
        if (v !== undefined) B[v] -= iEq
      }
    }

    // This regularizer only stabilizes the matrix. Floating nets are tracked
    // separately and never reported as a valid grounded measurement.
    for (let i = 0; i < M; i++) A[i][i] += 1e-12
    const x = solveLinearSystem(A, B)
    for (let i = 0; i < M; i++) {
      voltages.set(unknownNets[i], Number.isFinite(x[i]) ? Number(x[i].toFixed(6)) : 0)
    }
    return voltages
  }

  const diodeIndices = branches
    .map((branch, index) => ({ branch, index }))
    .filter(({ branch }) => branch.isDiode && branch.vForward)
    .map(({ index }) => index)

  // Do not let an isolated diode self-bias to Vf through MNA regularization.
  // Seed a diode active only when its complete connected component contains
  // at least two distinct fixed-potential levels with enough available span.
  // This also supports multiple diodes in series: the source span is evaluated
  // over the entire component, not just through the diode's immediate terminals.
  const componentParent = new Map<number, number>()
  const componentFind = (net: number): number => {
    if (!componentParent.has(net)) componentParent.set(net, net)
    const parent = componentParent.get(net)!
    if (parent !== net) componentParent.set(net, componentFind(parent))
    return componentParent.get(net)!
  }
  const componentUnion = (a: number, b: number) => {
    const rootA = componentFind(a)
    const rootB = componentFind(b)
    if (rootA !== rootB) componentParent.set(rootA, rootB)
  }
  for (const branch of branches) {
    if (branch.netA !== branch.netB) componentUnion(branch.netA, branch.netB)
  }
  const componentVoltages = new Map<number, number[]>()
  for (const [netId, info] of fixedNets.entries()) {
    const root = componentFind(netId)
    componentVoltages.set(root, [...(componentVoltages.get(root) ?? []), info.voltage])
  }
  let activeDiodeIndices = new Set<number>(diodeIndices.filter((index) => {
    const diode = branches[index]
    const voltages = componentVoltages.get(componentFind(diode.netA)) ?? []
    if (voltages.length < 2) return false
    const span = Math.max(...voltages) - Math.min(...voltages)
    return span >= (diode.vForward ?? Infinity) - 0.1
  }))
  let converged = diodeIndices.length === 0
  let netVoltagesSolved = solveWithBranches(branches.filter((branch, index) => !branch.isDiode || activeDiodeIndices.has(index)))
  const seenDiodeSets = new Set<string>()
  const maxDiodeIterations = Math.max(8, diodeIndices.length * 4 + 4)

  for (let iteration = 0; iteration < maxDiodeIterations && !converged; iteration++) {
    const signature = [...activeDiodeIndices].sort((a, b) => a - b).join(",")
    if (seenDiodeSets.has(signature)) break
    seenDiodeSets.add(signature)

    const solvedBranches = branches.filter((branch, index) => !branch.isDiode || activeDiodeIndices.has(index))
    netVoltagesSolved = solveWithBranches(solvedBranches)
    const nextActive = new Set(activeDiodeIndices)
    for (const index of diodeIndices) {
      const diode = branches[index]
      const vA = netVoltagesSolved.get(diode.netA) ?? 0
      const vC = netVoltagesSolved.get(diode.netB) ?? 0
      const currentA = diode.conductance * (vA - vC - (diode.vForward ?? 0))
      if (activeDiodeIndices.has(index) && currentA < -1e-9) {
        nextActive.delete(index)
      } else if (!activeDiodeIndices.has(index) && vA - vC > (diode.vForward ?? 0) + 1e-4) {
        nextActive.add(index)
      }
    }
    converged = nextActive.size === activeDiodeIndices.size &&
      [...nextActive].every((index) => activeDiodeIndices.has(index))
    activeDiodeIndices = nextActive
  }

  if (!converged) {
    diagnostics.push({
      code: "diode-non-convergence",
      severity: "warning",
      message: "The diode active-set did not converge within the configured iteration budget. Diode branches were opened fail-safe for this solve; inspect the topology for interacting or contradictory diode paths.",
    })
    activeDiodeIndices.clear()
    netVoltagesSolved = solveWithBranches(branches.filter((branch) => !branch.isDiode))
  }

  for (const [netId, voltage] of netVoltagesSolved.entries()) netVoltages.set(netId, voltage)
  const activeBranches = branches.filter((branch, index) => !branch.isDiode || activeDiodeIndices.has(index))

  // Propagate an ideal-source conflict through the entire connected
  // conducting network. A neighbouring resistor branch is not physically
  // valid merely because its own two terminals do not directly contain the
  // conflicted source net.
  const invalidNets = new Set<number>(conflictedNets)
  const invalidQueue = [...invalidNets]
  for (let index = 0; index < invalidQueue.length; index++) {
    for (const neighbor of branchAdjacency.get(invalidQueue[index]) ?? []) {
      if (invalidNets.has(neighbor)) continue
      invalidNets.add(neighbor)
      invalidQueue.push(neighbor)
    }
  }

  // Detect floating nets using the final conducting branch set.
  const sourceReachable = new Set(fixedNets.keys())
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

  // Signed branch current (positive is pinA -> pinB). Conflicted voltage nets
  // fail closed so an impossible ideal-source short never yields fake current.
  const branchCurrents = new Map<string, number>()
  branches.forEach((branch, index) => {
    const invalid = invalidNets.has(branch.netA) || invalidNets.has(branch.netB)
    const inactiveDiode = Boolean(branch.isDiode && !activeDiodeIndices.has(index))
    const vA = netVoltages.get(branch.netA) ?? 0
    const vB = netVoltages.get(branch.netB) ?? 0
    const currentMa = invalid || inactiveDiode || branch.netA === branch.netB
      ? 0
      : branch.conductance * (vA - vB - (branch.isDiode ? (branch.vForward ?? 0) : 0)) * 1000
    branchCurrents.set(branchKey(branch.partId, branch.pinA, branch.pinB),
      Number.isFinite(currentMa) ? Number(currentMa.toFixed(6)) : 0)
  })

  // 7. Map calculated potentials to every pin
  const pinPotentials = new Map<string, PinPotentialInfo>()

  for (const pin of allPins) {
    const [partId, pinId] = pin.split(":")
    const netId = pinToNetId(partId, pinId)
    const fixedInfo = fixedNets.get(netId)
    const voltage = netVoltages.get(netId) ?? 0

    pinPotentials.set(pin, {
      voltage: floatingNets.has(netId) || invalidNets.has(netId) ? 0 : Number(voltage.toFixed(2)),
      netId,
      sourceLabel: invalidNets.has(netId)
        ? "Connected to conflicting ideal voltage sources"
        : fixedInfo?.label ?? (floatingNets.has(netId) ? "Floating / open circuit" : undefined),
      isDriven: !invalidNets.has(netId) && fixedInfo !== undefined && Math.abs(fixedInfo.voltage) > 1e-9,
      isGnd: !invalidNets.has(netId) && fixedInfo !== undefined && fixedInfo.voltage === 0 && !fixedInfo.isDigitalLow,
      isDigitalLow: fixedInfo?.isDigitalLow,
      isFloating: floatingNets.has(netId),
      isConflicted: invalidNets.has(netId),
      digitalPinName: fixedInfo?.digitalPinName,
    })
  }

  const getBranchCurrent = (partId: string, pinA: string, pinB: string) =>
    branchCurrents.get(branchKey(partId, pinA, pinB)) ?? 0

  const getNetCurrent = (netId: number) => branches.reduce((total, branch) => {
    const current = getBranchCurrent(branch.partId, branch.pinA, branch.pinB)
    if (branch.netA === netId) return total + current
    if (branch.netB === netId) return total - current
    return total
  }, 0)

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

    if (refA.partId === refB.partId && state.parts.find((p) => p.id === refA.partId)?.type === "led") {
      return {
        resistance: Infinity,
        explanation: "Open Circuit / Diode Junction (O.L)",
        subtext: "LEDs are semiconductor diodes (Vf ≈ 1.8V - 2.2V). Continuity/Ohmmeter test voltage (<0.4V) cannot overcome the p-n junction barrier.",
      }
    }

    // Equivalent resistance is the voltage produced by a 1A test source
    // across the complete passive network, including all parallel branches.
    const resistiveEdges: Array<{ u: number; v: number; resistance: number; name: string }> = []
    const addResistance = (u: number, v: number, resistance: number, name: string) => {
      if (u === v || !Number.isFinite(resistance) || resistance <= 0) return
      resistiveEdges.push({ u, v, resistance, name })
    }
    for (const part of state.parts) {
      if (part.type === "resistor") {
        const resistance = Math.max(0.1, Number(part.props.resistance || 220))
        addResistance(pinToNetId(part.id, "a"), pinToNetId(part.id, "b"), resistance, `${resistance}Ω Resistor`)
      } else if (part.type === "ldr") {
        const light = Math.max(0, Math.min(1023, Number(part.props.light ?? 512)))
        const resistance = Math.max(200, Math.round(50000 / (1 + (light / 1023) * 99)))
        addResistance(pinToNetId(part.id, "t1"), pinToNetId(part.id, "t2"), resistance, `${resistance}Ω LDR`)
      } else if (part.type === "potentiometer") {
        const u = pinToNetId(part.id, "t1")
        const w = pinToNetId(part.id, "wiper")
        const v = pinToNetId(part.id, "t2")
        const value = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const total = Math.max(1, Number(part.props.resistance ?? 10000))
        const r1 = Math.max(0.5, ((1023 - value) / 1023) * total)
        const r2 = Math.max(0.5, (value / 1023) * total)
        addResistance(u, w, r1, `Potentiometer T1-Wiper (${r1.toFixed(1)}Ω)`)
        addResistance(w, v, r2, `Potentiometer Wiper-T2 (${r2.toFixed(1)}Ω)`)
      } else if (part.type === "dc-motor") {
        addResistance(pinToNetId(part.id, "pos"), pinToNetId(part.id, "neg"), 50, "DC motor winding model (50Ω)")
      } else if (part.type === "buzzer") {
        addResistance(pinToNetId(part.id, "pos"), pinToNetId(part.id, "neg"), 100, "Buzzer resistive proxy (100Ω)")
      }
    }

    const adjacency = new Map<number, number[]>()
    for (const edge of resistiveEdges) {
      adjacency.set(edge.u, [...(adjacency.get(edge.u) ?? []), edge.v])
      adjacency.set(edge.v, [...(adjacency.get(edge.v) ?? []), edge.u])
    }
    const componentNets = new Set<number>([netA])
    const queue = [netA]
    for (let index = 0; index < queue.length; index++) {
      for (const neighbor of adjacency.get(queue[index]) ?? []) {
        if (componentNets.has(neighbor)) continue
        componentNets.add(neighbor)
        queue.push(neighbor)
      }
    }

    let bestR = Infinity
    let bestParts: string[] = []
    if (componentNets.has(netB)) {
      const unknown = [...componentNets].filter((net) => net !== netB)
      const indexByNet = new Map(unknown.map((net, index) => [net, index]))
      const A: number[][] = Array.from({ length: unknown.length }, () => new Array(unknown.length).fill(0))
      const B: number[] = new Array(unknown.length).fill(0)
      const sourceIndex = indexByNet.get(netA)
      if (sourceIndex !== undefined) B[sourceIndex] += 1

      for (const edge of resistiveEdges) {
        if (!componentNets.has(edge.u) || !componentNets.has(edge.v)) continue
        const conductance = 1 / edge.resistance
        const u = indexByNet.get(edge.u)
        const v = indexByNet.get(edge.v)
        if (u !== undefined && v !== undefined) {
          A[u][u] += conductance
          A[v][v] += conductance
          A[u][v] -= conductance
          A[v][u] -= conductance
        } else if (u !== undefined) {
          A[u][u] += conductance
        } else if (v !== undefined) {
          A[v][v] += conductance
        }
      }

      if (unknown.length > 0) {
        const voltages = solveLinearSystem(A, B)
        const result = sourceIndex === undefined ? 0 : voltages[sourceIndex]
        if (Number.isFinite(result) && result > 1e-9) {
          bestR = result
          bestParts = [...new Set(resistiveEdges
            .filter((edge) => componentNets.has(edge.u) && componentNets.has(edge.v))
            .map((edge) => edge.name))]
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
      explanation: `Equivalent Resistance: ${bestR >= 1000 ? (bestR / 1000).toFixed(2) + " kΩ" : bestR.toFixed(1) + " Ω"}`,
      subtext: bestParts.length > 0
        ? `Solved with a 1A test source across series and parallel branches: ${bestParts.join(" + ")}`
        : "Solved with a 1A test source across the passive network.",
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
      const currentMa = Math.abs(getBranchCurrent(red.partId, "a", "b"))
      const r = Number(state.parts.find((p) => p.id === red.partId)?.props.resistance || 220)
      return {
        currentMa: Number(currentMa.toFixed(3)),
        explanation: `Solved resistor branch current: ${currentMa.toFixed(3)} mA`,
        subtext: `MNA solved current using the connected network and configured ${r}Ω resistance.`,
      }
    }

    // 2. If probes are across an LED
    const ledPart = state.parts.find((p) => p.type === "led" && (p.id === red.partId || p.id === black.partId))
    if (ledPart) {
      const r = runtime[ledPart.id]
      const c = getBranchCurrent(ledPart.id, "anode", "cathode")
      return {
        currentMa: Number(c.toFixed(1)),
        explanation: `LED Branch Current: ${c.toFixed(1)} mA`,
        subtext: r?.burnt ? "⚠️ OVERCURRENT BURNOUT!" : "Diode is conducting forward current",
        isWarning: r?.burnt,
      }
    }

    // 3. Source-to-return measurement: sum the solver's signed branch
    // currents at the driven rail. Do not sum component runtime.currentMa,
    // which mixed PWM averages, stale values, and unrelated components.
    const infoRed = getPinInfo(red)
    const infoBlack = getPinInfo(black)
    const hasSource = (infoRed.isDriven && infoBlack.isGnd) || (infoBlack.isDriven && infoRed.isGnd)
    if (hasSource) {
      const sourceInfo = infoRed.isDriven ? infoRed : infoBlack
      const sourceRef = infoRed.isDriven ? red : black
      const currentMa = Math.abs(getNetCurrent(sourceInfo.netId))
      return {
        currentMa: Number(currentMa.toFixed(3)),
        explanation: `Solved source current at ${sourceRef.partId.toUpperCase()} (${sourceRef.pinId.toUpperCase()}): ${currentMa.toFixed(3)} mA`,
        subtext: "Algebraic sum of the MNA branch currents leaving the driven source net (KCL).",
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
    branchCurrents,
    diagnostics,
    getBranchCurrent,
    getNetCurrent,
    getPinVoltage,
    getPinInfo,
    getPotentialDifference,
    computeResistanceBetweenPins,
    computeCurrentBetweenPins,
  }
}
