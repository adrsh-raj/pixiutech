import type { CircuitState, PinRef } from "./circuit-types"
import type { ArduinoPinState } from "./simulation"

export interface PinPotentialInfo {
  voltage: number
  netId: number
  sourceLabel?: string
  isDriven: boolean
  isGnd: boolean
  isDigitalLow?: boolean
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
 * - Models LED forward-voltage drops (Vf ~ 2.0V) and potentiometer variable dividers.
 * - Accurately detects digital pin HIGH/LOW states and constant 5V/3.3V power rails.
 */
export function solveCircuitNodalPotentials(
  state: CircuitState,
  pressed: Set<string> = new Set(),
  pinStates: Record<string, ArduinoPinState> = {},
  running: boolean = true
): NodalSolution {
  // 1. Gather all pins across all placed components
  const allPins = new Set<string>()
  for (const part of state.parts) {
    // Generate common pins based on component type
    switch (part.type) {
      case "arduino-uno": {
        for (let i = 0; i <= 13; i++) {
          allPins.add(pinKey(part.id, `d${i}`))
          allPins.add(pinKey(part.id, String(i)))
        }
        allPins.add(pinKey(part.id, "5v"))
        allPins.add(pinKey(part.id, "3v3"))
        allPins.add(pinKey(part.id, "vin"))
        allPins.add(pinKey(part.id, "gnd"))
        allPins.add(pinKey(part.id, "gnd_pwr"))
        allPins.add(pinKey(part.id, "aref"))
        for (let i = 0; i <= 5; i++) allPins.add(pinKey(part.id, `a${i}`))
        break
      }
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
        allPins.add(pinKey(part.id, "pos"))
        allPins.add(pinKey(part.id, "neg"))
        break
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
      case "breadboard": {
        for (let c = 1; c <= 20; c++) {
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

  // Also ensure pins in wires exist
  for (const w of state.wires) {
    allPins.add(pinKey(w.from.partId, w.from.pinId))
    allPins.add(pinKey(w.to.partId, w.to.pinId))
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

  // Union wires
  for (const w of state.wires) {
    union(pinKey(w.from.partId, w.from.pinId), pinKey(w.to.partId, w.to.pinId))
  }

  // Union breadboard internal strips
  for (const part of state.parts) {
    if (part.type === "breadboard") {
      const k = (pin: string) => pinKey(part.id, pin)
      for (let c = 1; c <= 20; c++) {
        const top = ["a", "b", "c", "d", "e"]
        for (let i = 0; i < top.length - 1; i++) {
          union(k(`${top[i]}_${c}`), k(`${top[i + 1]}_${c}`))
        }
        const bot = ["f", "g", "h", "i", "j"]
        for (let i = 0; i < bot.length - 1; i++) {
          union(k(`${bot[i]}_${c}`), k(`${bot[i + 1]}_${c}`))
        }
      }
      for (let c = 1; c < 20; c++) {
        union(k(`pos_t_${c}`), k(`pos_t_${c + 1}`))
        union(k(`neg_t_${c}`), k(`neg_t_${c + 1}`))
        union(k(`pos_b_${c}`), k(`pos_b_${c + 1}`))
        union(k(`neg_b_${c}`), k(`neg_b_${c + 1}`))
      }
      union(k("pos_top"), k("pos_t_1"))
      union(k("neg_top"), k("neg_t_1"))
      union(k("pos_bot"), k("pos_b_1"))
      union(k("neg_bot"), k("neg_b_1"))
    } else if (part.type === "pushbutton") {
      const k = (pin: string) => pinKey(part.id, pin)
      union(k("p1a"), k("p1b"))
      union(k("p2a"), k("p2b"))
      if (pressed.has(part.id)) {
        union(k("p1a"), k("p2a"))
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

  // 4. Identify Fixed Voltage Nets (Dirichlet Boundary Conditions)
  const fixedNets = new Map<number, { voltage: number; label: string; isDigitalLow?: boolean; digitalPinName?: string }>()

  for (const part of state.parts) {
    if (part.type === "arduino-uno") {
      // 5V power rail
      const net5V = pinToNetId(part.id, "5v")
      fixedNets.set(net5V, { voltage: 5.0, label: "Arduino 5V Power Rail" })
      const netVin = pinToNetId(part.id, "vin")
      fixedNets.set(netVin, { voltage: 5.0, label: "Arduino VIN (5.0V)" })

      // 3.3V power rail
      const net3V3 = pinToNetId(part.id, "3v3")
      fixedNets.set(net3V3, { voltage: 3.3, label: "Arduino 3.3V Rail" })

      // Ground sinks
      const netGnd = pinToNetId(part.id, "gnd")
      fixedNets.set(netGnd, { voltage: 0.0, label: "Ground (0V)" })
      const netGndPwr = pinToNetId(part.id, "gnd_pwr")
      fixedNets.set(netGndPwr, { voltage: 0.0, label: "Ground (0V)" })

      // Digital pins
      for (let i = 0; i <= 13; i++) {
        const pinId = `d${i}`
        const netD = pinToNetId(part.id, pinId)
        const pState = pinStates[String(i)] || pinStates[pinId]

        if (pState?.state === "HIGH") {
          fixedNets.set(netD, { voltage: 5.0, label: `Arduino Pin D${i} (HIGH = 5.0V)` })
        } else if (pState?.value !== undefined && pState.value > 0) {
          const vPwm = Number((5.0 * (pState.value / 255)).toFixed(2))
          fixedNets.set(netD, { voltage: vPwm, label: `Arduino Pin D${i} (PWM ${pState.value}/255 = ${vPwm}V)` })
        } else if (pState?.state === "LOW") {
          // Explicitly driven LOW in code!
          fixedNets.set(netD, {
            voltage: 0.0,
            label: `Arduino Pin D${i} (OUTPUT LOW = 0.0V)`,
            isDigitalLow: true,
            digitalPinName: `D${i}`,
          })
        }
      }
    } else if (part.type === "battery") {
      const netPos = pinToNetId(part.id, "pos")
      fixedNets.set(netPos, { voltage: 9.0, label: "9V Battery (+)" })
      const netNeg = pinToNetId(part.id, "neg")
      fixedNets.set(netNeg, { voltage: 0.0, label: "Battery Ground (0V)" })
    }
  }

  // 5. Build component branches (Resistors, Potentiometers, LEDs, Loads)
  interface Branch {
    netA: number
    netB: number
    conductance: number // G = 1/R
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
      case "potentiometer": {
        const netT1 = pinToNetId(part.id, "t1")
        const netWiper = pinToNetId(part.id, "wiper")
        const netT2 = pinToNetId(part.id, "t2")
        const val = Math.max(0, Math.min(1023, Number(part.props.value ?? 512)))
        const rTotal = 10000
        const r1 = Math.max(0.5, (val / 1023) * rTotal)
        const r2 = Math.max(0.5, ((1023 - val) / 1023) * rTotal)
        branches.push({ netA: netT1, netB: netWiper, conductance: 1 / r1 })
        branches.push({ netA: netWiper, netB: netT2, conductance: 1 / r2 })
        break
      }
      case "led": {
        const netA = pinToNetId(part.id, "anode")
        const netC = pinToNetId(part.id, "cathode")
        const color = String(part.props.color || "red")
        const vf = color === "blue" || color === "white" ? 3.0 : 2.0
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

  // 6. Modified Nodal Analysis (MNA) Linear System
  const netVoltages = new Map<number, number>()
  for (const [netId, info] of fixedNets.entries()) {
    netVoltages.set(netId, info.voltage)
  }

  // Filter unknown nets
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
    // Run up to 2 passes to evaluate diode conduction
    let activeBranches = branches.slice()

    for (let pass = 0; pass < 2; pass++) {
      const A: number[][] = Array.from({ length: M }, () => new Array(M).fill(0))
      const B: number[] = new Array(M).fill(0)

      for (const br of activeBranches) {
        if (br.netA === br.netB) continue

        const G = br.conductance
        const u = netToUnknownIdx.get(br.netA)
        const v = netToUnknownIdx.get(br.netB)

        // Resistor / linear branch
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

        // Norton equivalent for conducting diode
        if (br.isDiode && br.vForward) {
          const iEq = G * br.vForward
          if (u !== undefined) B[u] -= iEq
          if (v !== undefined) B[v] += iEq
        }
      }

      // Add small shunt conductance to GND for floating nodes to ensure matrix non-singularity
      for (let i = 0; i < M; i++) {
        A[i][i] += 1e-9
      }

      const x = solveLinearSystem(A, B)
      for (let i = 0; i < M; i++) {
        const netId = unknownNets[i]
        const vSolved = Math.max(0, Number(x[i].toFixed(3)))
        netVoltages.set(netId, vSolved)
      }

      // Check diode condition: if V_anode - V_cathode < Vf, diode does not conduct
      let recheckNeeded = false
      activeBranches = activeBranches.filter((br) => {
        if (br.isDiode && br.vForward) {
          const vA = netVoltages.get(br.netA) ?? 0
          const vC = netVoltages.get(br.netB) ?? 0
          if (vA - vC < br.vForward - 0.1) {
            recheckNeeded = true
            return false // Diode OFF
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
      voltage: Number(voltage.toFixed(2)),
      netId,
      sourceLabel: fixedInfo?.label,
      isDriven: fixedInfo !== undefined && fixedInfo.voltage > 0,
      isGnd: fixedInfo !== undefined && fixedInfo.voltage === 0 && !fixedInfo.isDigitalLow,
      isDigitalLow: fixedInfo?.isDigitalLow,
      digitalPinName: fixedInfo?.digitalPinName,
    })
  }

  // Helpers
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

  const getPotentialDifference = (
    red: PinRef | null,
    black: PinRef | null,
    circuit: CircuitState,
    states: Record<string, ArduinoPinState>
  ) => {
    if (!red || !black) {
      return {
        diff: 0,
        vRed: 0,
        vBlack: 0,
        explanation: "Clip both RED (+) and BLACK (-) probes to measure",
      }
    }

    const infoRed = getPinInfo(red)
    const infoBlack = getPinInfo(black)
    const vRed = infoRed.voltage
    const vBlack = infoBlack.voltage
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
        // Drop is 0 across resistor! Why?
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

    // Standard potential difference readout
    return {
      diff,
      vRed,
      vBlack,
      explanation: `Potential Difference: Red (${vRed.toFixed(2)}V) minus Black (${vBlack.toFixed(2)}V)`,
      subtext: infoBlack.isGnd
        ? "Absolute potential measured relative to Ground (0V reference)."
        : undefined,
    }
  }

  return {
    pinPotentials,
    netVoltages,
    getPinVoltage,
    getPinInfo,
    getPotentialDifference,
  }
}
