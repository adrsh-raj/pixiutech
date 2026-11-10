import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outfile = join(tmpdir(), `circuit-solver-bundle-${Date.now()}.mjs`)
await build({
  entryPoints: [new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const { solveCircuitNodalPotentials } = await import(`file://${outfile}`)

test("DMM: Equipotential detection when probes are on the same 5V rail (Red on Uno 5V, Black on MQ2 VCC)", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "mq2", type: "mq2-gas", x: 260, y: 110, rotation: 0, props: { gasLevel: 150 } },
    ],
    wires: [
      { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "mq2", pinId: "vcc" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "mq2", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "uno", pinId: "5v" }
  const probeBlack = { partId: "mq2", pinId: "vcc" }

  const pd = solution.getPotentialDifference(probeRed, probeBlack, circuitState, {})

  assert.equal(pd.diff, 0, "Potential difference on same 5V wire must be 0.00V")
  assert.equal(pd.isWarning, true, "Must flag equipotential rail warning")
  assert.match(pd.explanation, /Equipotential Rail/i, "Explanation must mention Equipotential Rail")
  assert.match(pd.subtext, /BLACK probe.*to Ground/i, "Subtext must guide user to connect Black probe to Ground")
})

test("DMM: Single-Probe mode measures voltage referenced to Ground (Red on MQ2 VCC, Black null)", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "mq2", type: "mq2-gas", x: 260, y: 110, rotation: 0, props: { gasLevel: 150 } },
    ],
    wires: [
      { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "mq2", pinId: "vcc" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "mq2", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "mq2", pinId: "vcc" }

  const pd = solution.getPotentialDifference(probeRed, null, circuitState, {})

  assert.equal(pd.diff, 5, "Single probe on 5V pin must measure 5.00V referenced to GND")
  assert.match(pd.explanation, /Single Probe/i, "Explanation must indicate Single Probe mode")
  assert.match(pd.explanation, /5\.00V/i, "Explanation must show 5.00V")
  assert.match(pd.subtext, /Auto-GND active/i, "Subtext must mention Auto-GND")
})

test("DMM: Reversed Polarity detection with clear guidance", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
    ],
    wires: [],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "uno", pinId: "gnd" }
  const probeBlack = { partId: "uno", pinId: "5v" }

  const pd = solution.getPotentialDifference(probeRed, probeBlack, circuitState, {})

  assert.equal(pd.diff, -5, "Red on GND and Black on 5V must measure -5.00V")
  assert.match(pd.explanation, /Reversed Polarity/i, "Explanation must mention Reversed Polarity")
  assert.match(pd.subtext, /Swap Probes/i, "Subtext must guide user to swap probes")
})

for (const resistance of [220, 330, 10000]) {
  test(`DMM: ${resistance}Ω resistor in a driven LED loop uses its configured value`, () => {
    const circuitState = {
      parts: [
        { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
        { id: "r1", type: "resistor", x: 260, y: 110, rotation: 0, props: { resistance } },
        { id: "led1", type: "led", x: 420, y: 110, rotation: 0, props: { color: "red" } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
        { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    }
    const pinStates = { "13": { state: "HIGH" } }
    const solution = solveCircuitNodalPotentials(circuitState, new Set(), pinStates, true)
    const probeRed = { partId: "r1", pinId: "a" }
    const probeBlack = { partId: "r1", pinId: "b" }
    const pd = solution.getPotentialDifference(probeRed, probeBlack, circuitState, pinStates)
    const current = solution.computeCurrentBetweenPins(probeRed, probeBlack, {})
    const expectedCurrentMa = ((5 - 1.9) / (resistance + 10)) * 1000
    const expectedDrop = (expectedCurrentMa / 1000) * resistance

    assert.ok(
      Math.abs(pd.diff - expectedDrop) < 0.02,
      `Expected ${expectedDrop.toFixed(2)}V across ${resistance}Ω, got ${pd.diff}V`,
    )
    assert.match(pd.explanation, new RegExp(`Voltage Drop across ${resistance}Ω Resistor`, "i"))
    assert.ok(
      Math.abs(current.currentMa - expectedCurrentMa) < 0.11,
      `Expected ${expectedCurrentMa.toFixed(2)}mA through ${resistance}Ω, got ${current.currentMa}mA`,
    )
  })
}

test("DMM: stopping an unpowered MCU output does not create a phantom LED forward voltage", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 260, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 420, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, false)
  const resistorA = { partId: "r1", pinId: "a" }
  const resistorB = { partId: "r1", pinId: "b" }
  const reading = solution.getPotentialDifference(resistorA, resistorB, circuitState, {})

  assert.equal(reading.diff, 0)
  assert.equal(solution.getPinVoltage(resistorA), 0)
  assert.equal(solution.getPinVoltage(resistorB), 0)
  assert.equal(solution.getPinInfo(resistorA).isFloating, true)
})


test("DMM resistance measures parallel equivalent resistance, not the shortest single branch", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 60, rotation: 0, props: { resistance: 1000 } },
      { id: "r2", type: "resistor", x: 220, y: 140, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "feed1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "feed2", from: { partId: "uno", pinId: "5v" }, to: { partId: "r2", pinId: "a" }, color: "#ef4444" },
      { id: "return1", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
      { id: "return2", from: { partId: "r2", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const solved = solveCircuitNodalPotentials(circuit)
  const equivalent = solved.computeResistanceBetweenPins(
    { partId: "uno", pinId: "5v" },
    { partId: "uno", pinId: "gnd_pwr" },
  )
  assert.ok(Math.abs(equivalent.resistance - 500) < 0.1,
    `Two 1kΩ parallel resistors must measure 500Ω, got ${equivalent.resistance}Ω`)
  assert.match(equivalent.explanation, /Equivalent Resistance/i)
})


test("DMM resistance includes parallel branches even when probing one resistor's own terminals", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 60, rotation: 0, props: { resistance: 1000 } },
      { id: "r2", type: "resistor", x: 220, y: 140, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "feed1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "feed2", from: { partId: "uno", pinId: "5v" }, to: { partId: "r2", pinId: "a" }, color: "#ef4444" },
      { id: "return1", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
      { id: "return2", from: { partId: "r2", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const solved = solveCircuitNodalPotentials(circuit)
  const equivalent = solved.computeResistanceBetweenPins(
    { partId: "r1", pinId: "a" },
    { partId: "r1", pinId: "b" },
  )
  assert.ok(Math.abs(equivalent.resistance - 500) < 0.1,
    `Probing across r1 should still include r2 in parallel: expected 500Ω, received ${equivalent.resistance}Ω`)
})


test("DMM resistance includes alternate parallel branches when probes are on one resistor's terminals", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 60, rotation: 0, props: { resistance: 1000 } },
      { id: "r2", type: "resistor", x: 220, y: 140, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "feed1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "feed2", from: { partId: "uno", pinId: "5v" }, to: { partId: "r2", pinId: "a" }, color: "#ef4444" },
      { id: "return1", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
      { id: "return2", from: { partId: "r2", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const solved = solveCircuitNodalPotentials(circuit)
  const equivalent = solved.computeResistanceBetweenPins(
    { partId: "r1", pinId: "a" },
    { partId: "r1", pinId: "b" },
  )
  assert.ok(Math.abs(equivalent.resistance - 500) < 0.1,
    `Probing r1 terminals must include the parallel r2 branch: expected 500Ω, received ${equivalent.resistance}Ω`)
})


test("DMM resistance does not treat a passive piezo buzzer as a 100Ω DC resistor", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "buzzer", type: "buzzer", x: 240, y: 100, rotation: 0, props: {} },
    ],
    wires: [
      { id: "signal", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#ef4444" },
      { id: "ground", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const solved = solveCircuitNodalPotentials(circuit)
  const resistance = solved.computeResistanceBetweenPins(
    { partId: "buzzer", pinId: "pos" },
    { partId: "buzzer", pinId: "neg" },
  )
  assert.equal(resistance.resistance, Infinity,
    "a passive piezo is reactive/frequency-dependent, not a fixed 100Ω DC path")
  assert.match(resistance.explanation, /Open Circuit.*O\.L/i)
})


test("DMM branch-current mode reads RGB LED and seven-segment diode branches from MNA", () => {
  const rgbCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 100, rotation: 0, props: { resistance: 220 } },
      { id: "rgb", type: "rgb-led", x: 300, y: 100, rotation: 0, props: {} },
    ],
    wires: [
      { id: "feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "red-feed", from: { partId: "r1", pinId: "b" }, to: { partId: "rgb", pinId: "red" }, color: "#ef4444" },
      { id: "rgb-return", from: { partId: "rgb", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const rgbSolved = solveCircuitNodalPotentials(rgbCircuit)
  const rgbBranch = rgbSolved.getBranchCurrent("rgb", "red", "gnd")
  const rgbMeter = rgbSolved.computeCurrentBetweenPins(
    { partId: "rgb", pinId: "red" },
    { partId: "rgb", pinId: "gnd" },
    {},
  )
  assert.ok(rgbBranch > 0)
  assert.ok(Math.abs(rgbMeter.currentMa - Math.abs(rgbBranch)) < 0.001)

  const segmentCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 100, rotation: 0, props: { resistance: 220 } },
      { id: "display", type: "seven-segment", x: 300, y: 100, rotation: 0, props: { commonType: "cathode", color: "red" } },
    ],
    wires: [
      { id: "feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "segment-feed", from: { partId: "r1", pinId: "b" }, to: { partId: "display", pinId: "a" }, color: "#ef4444" },
      { id: "display-return", from: { partId: "display", pinId: "com" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const segmentRuntime = { display: { segments: { a: true } } }
  const segmentSolved = solveCircuitNodalPotentials(segmentCircuit, new Set(), {}, true, {}, segmentRuntime)
  const segmentBranch = segmentSolved.getBranchCurrent("display", "a", "com")
  const segmentMeter = segmentSolved.computeCurrentBetweenPins(
    { partId: "display", pinId: "a" },
    { partId: "display", pinId: "com" },
    segmentRuntime,
  )
  assert.ok(segmentBranch > 0)
  assert.ok(Math.abs(segmentMeter.currentMa - Math.abs(segmentBranch)) < 0.001)
})
