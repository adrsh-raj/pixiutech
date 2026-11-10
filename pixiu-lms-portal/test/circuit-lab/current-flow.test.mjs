import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outfile = join(tmpdir(), `current-flow-bundle-${Date.now()}.mjs`)
await build({
  entryPoints: [
    new URL("../../src/lib/current-flow.ts", import.meta.url).pathname,
  ],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const { computeWireCurrents } = await import(`file://${outfile}`)
const solverOutfile = join(tmpdir(), `current-flow-solver-${Date.now()}.mjs`)
await build({
  entryPoints: [new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outfile: solverOutfile,
  platform: "neutral",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})
const { solveCircuitNodalPotentials } = await import(`file://${solverOutfile}`)

test("bulb/LED when OFF has ZERO current in its wires", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 260, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w_pwr", from: { partId: "uno", pinId: "d12" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "w_mid", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  // Pin 12 is LOW (0V). Bulb is OFF (level: 0, currentMa: 0).
  const runtime = {
    led1: { level: 0, currentMa: 0, burnt: false },
  }
  const pinStates = {
    "12": { mode: "OUTPUT", state: "LOW", value: 0 },
  }

  const currents = computeWireCurrents(circuitState, runtime, pinStates)

  assert.equal(currents["w_pwr"], undefined, "Wire from D12 to resistor must have NO current when LED is OFF")
  assert.equal(currents["w_mid"], undefined, "Wire between resistor and LED must have NO current when LED is OFF")
  assert.equal(currents["w_gnd"], undefined, "Wire from LED cathode to GND must have NO current when LED is OFF")
})

test("bulb/LED when ON has ACTIVE current in all loop wires", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 260, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w_pwr", from: { partId: "uno", pinId: "d12" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "w_mid", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  // Pin 12 is HIGH (5V). Bulb is ON (level: 1.0, currentMa: 15).
  const runtime = {
    led1: { level: 1.0, currentMa: 15.0, burnt: false },
  }
  const pinStates = {
    "12": { mode: "OUTPUT", state: "HIGH", value: 1 },
  }

  const currents = computeWireCurrents(circuitState, runtime, pinStates)
  const solved = solveCircuitNodalPotentials(circuitState, new Set(), pinStates, true, {}, runtime)
  console.log("CURRENT_FLOW_LED_LOOP_DEBUG", JSON.stringify(currents))
  console.log("CURRENT_FLOW_LED_BRANCH_DEBUG", JSON.stringify([...solved.branchCurrents.entries()]))
  console.log("CURRENT_FLOW_LED_PIN_DEBUG", JSON.stringify({
    resistorA: solved.getPinInfo({ partId: "r1", pinId: "a" }),
    resistorB: solved.getPinInfo({ partId: "r1", pinId: "b" }),
    ledAnode: solved.getPinInfo({ partId: "led1", pinId: "anode" }),
    ledCathode: solved.getPinInfo({ partId: "led1", pinId: "cathode" }),
  }))

  assert.ok(currents["w_pwr"] && currents["w_pwr"].currentMa > 0, "Power wire must carry active current when LED is ON")
  assert.ok(currents["w_mid"] && currents["w_mid"].currentMa > 0, "Middle wire must carry active current when LED is ON")
  assert.ok(currents["w_gnd"] && currents["w_gnd"].currentMa > 0, "Ground wire must carry active current when LED is ON")
})

test("buzzer when OFF has ZERO current in its wires", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "buzzer1", type: "buzzer", x: 200, y: 110, rotation: 0, props: {} },
    ],
    wires: [
      { id: "w_bzpos", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer1", pinId: "pos" }, color: "#ef4444" },
      { id: "w_bzgnd", from: { partId: "buzzer1", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  // Pin 8 is LOW. Buzzer is silent (level: 0).
  const runtime = {
    buzzer1: { level: 0 },
  }
  const pinStates = {
    "8": { mode: "OUTPUT", state: "LOW", value: 0 },
  }

  const currents = computeWireCurrents(circuitState, runtime, pinStates)

  assert.equal(currents["w_bzpos"], undefined, "Wire from D8 to buzzer must have NO current when buzzer is silent")
  assert.equal(currents["w_bzgnd"], undefined, "Wire from buzzer to GND must have NO current when buzzer is silent")
})


test("potentiometer current flow follows its real t1-to-t2 terminals", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "pot", type: "potentiometer", x: 240, y: 100, rotation: 0, props: { resistance: 10000, value: 512 } },
    ],
    wires: [
      { id: "pot-feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "pot", pinId: "t1" }, color: "#ef4444" },
      { id: "pot-wiper", from: { partId: "pot", pinId: "wiper" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
      { id: "pot-return", from: { partId: "pot", pinId: "t2" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.ok(currents["pot-feed"]?.currentMa > 0, "5V-to-t1 feed should show divider current")
  assert.ok(currents["pot-return"]?.currentMa > 0, "t2-to-GND return should show divider current")
  assert.equal(currents["pot-wiper"], undefined, "high-impedance analog wiper should not be rendered as a ground-current path")
})

test("NeoPixel Ring data current traces through its catalog DI pin", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "ring", type: "neopixel-ring", x: 280, y: 100, rotation: 0, props: {} },
    ],
    wires: [
      { id: "ring-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "ring", pinId: "vcc" }, color: "#ef4444" },
      { id: "ring-gnd", from: { partId: "ring", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      { id: "ring-di", from: { partId: "uno", pinId: "d6" }, to: { partId: "ring", pinId: "di" }, color: "#22c55e" },
    ],
  }
  const currents = computeWireCurrents(
    circuit,
    {
      ring: {
        level: 1,
        pixelColors: ["#ff0000"],
        neopixelDataActive: true,
        neopixelDataPin: { partId: "uno", pinId: "d6" },
      },
    },
    {},
  )
  assert.ok(currents["ring-vcc"]?.currentMa > 0, "illuminated pixels should draw supply current from their colour-dependent model")
  assert.equal(currents["ring-di"], undefined, "digital data pulses are not a continuous DC supply current")

  const idle = computeWireCurrents(circuit, {
    ring: { level: 0, pixelColors: ["#0f172a"], neopixelDataActive: false },
  }, {})
  assert.equal(idle["ring-vcc"], undefined, "an unlit ring must not draw the illuminated-pixel current")
  assert.equal(idle["ring-di"], undefined, "DI must remain idle until show() sends a frame")
})

test("L298N logic-supply current traces through the catalog 5v pin", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "driver", type: "l298n", x: 260, y: 100, rotation: 0, props: {} },
    ],
    wires: [
      { id: "logic-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "driver", pinId: "5v" }, color: "#ef4444" },
      { id: "logic-gnd", from: { partId: "driver", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.ok(currents["logic-vcc"]?.currentMa > 0, "L298N logic rail should trace through its 5v pin")
  assert.ok(currents["logic-gnd"]?.currentMa > 0, "L298N logic ground should complete the return path")
})

test("Pico relay current animation follows relayActive NO/NC state and motor RPM", () => {
  const circuit = {
    parts: [
      { id: "pico", type: "rpi-pico", x: 40, y: 100, rotation: 0, props: {} },
      { id: "relay", type: "relay", x: 260, y: 100, rotation: 0, props: {} },
      { id: "pump", type: "dc-motor", x: 480, y: 100, rotation: 0, props: {} },
    ],
    wires: [
      { id: "coil-vcc", from: { partId: "pico", pinId: "vbus" }, to: { partId: "relay", pinId: "vcc" }, color: "#ef4444" },
      { id: "coil-gnd", from: { partId: "relay", pinId: "gnd" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" },
      { id: "coil-input", from: { partId: "pico", pinId: "gp13" }, to: { partId: "relay", pinId: "in" }, color: "#facc15" },
      { id: "contact-feed", from: { partId: "pico", pinId: "vbus" }, to: { partId: "relay", pinId: "com" }, color: "#ef4444" },
      { id: "contact-pump", from: { partId: "relay", pinId: "no" }, to: { partId: "pump", pinId: "pos" }, color: "#f97316" },
      { id: "pump-return", from: { partId: "pump", pinId: "neg" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" },
    ],
  }

  const pinStates = { "13": { state: "HIGH", outputMode: "digital" } }
  const energized = computeWireCurrents(
    circuit,
    { relay: { relayActive: true }, pump: { rpm: 1000, motorDirection: "cw" } },
    pinStates,
  )
  console.log("CURRENT_FLOW_RELAY_DEBUG", JSON.stringify(energized))
  for (const wireId of ["coil-vcc", "coil-gnd", "contact-feed", "contact-pump", "pump-return"]) {
    assert.ok(energized[wireId]?.currentMa > 0, `${wireId} must show solved current while the relay coil is energized and the pump runs`)
  }
  assert.equal(energized["coil-input"], undefined, "a high-impedance relay control input does not draw a fabricated 6mA DC current")
  assert.ok(energized["contact-feed"].currentMa > 0, "solver must include the energized COM–NO contact in the pump's current loop")

  const deenergized = computeWireCurrents(
    circuit,
    { relay: { relayActive: false }, pump: { rpm: 0, motorDirection: "stopped" } },
    { "13": { state: "LOW", outputMode: "digital" } },
  )
  for (const wireId of ["coil-vcc", "coil-gnd", "coil-input", "contact-feed", "contact-pump", "pump-return"]) {
    assert.equal(deenergized[wireId], undefined, `${wireId} must have zero current when relay is de-energized and NO is open`)
  }
})

test("shared supply and return wires sum current from parallel resistor branches", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "bb", type: "breadboard", x: 150, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 300, y: 70, rotation: 0, props: { resistance: 1000 } },
      { id: "r2", type: "resistor", x: 300, y: 150, rotation: 0, props: { resistance: 2000 } },
    ],
    wires: [
      { id: "shared-feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "bb", pinId: "pos_t_1" }, color: "#ef4444" },
      { id: "feed-r1", from: { partId: "bb", pinId: "pos_t_2" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
      { id: "feed-r2", from: { partId: "bb", pinId: "pos_t_3" }, to: { partId: "r2", pinId: "a" }, color: "#ef4444" },
      { id: "return-r1", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
      { id: "return-r2", from: { partId: "r2", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.ok(Math.abs(currents["shared-feed"]?.currentMa - 7.5) < 0.1,
    `shared feed should carry 5mA + 2.5mA, received ${currents["shared-feed"]?.currentMa}mA`)
})

test("potentiometer current flow uses its solved divider current instead of a fixed visual value", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "pot", type: "potentiometer", x: 240, y: 100, rotation: 0, props: { resistance: 10000, value: 512 } },
    ],
    wires: [
      { id: "pot-feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "pot", pinId: "t1" }, color: "#ef4444" },
      { id: "pot-wiper", from: { partId: "pot", pinId: "wiper" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
      { id: "pot-return", from: { partId: "pot", pinId: "t2" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.ok(Math.abs(currents["pot-feed"]?.currentMa - 0.5) < 0.1)
  assert.ok(Math.abs(currents["pot-return"]?.currentMa - 0.5) < 0.1)
  assert.equal(currents["pot-wiper"], undefined)
})

test("LDR wire current follows the modeled light-dependent resistance below and above 0.5mA", () => {
  const makeCircuit = (light) => ({
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "ldr", type: "ldr", x: 240, y: 100, rotation: 0, props: { light } },
    ],
    wires: [
      { id: "ldr-feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "ldr", pinId: "t1" }, color: "#ef4444" },
      { id: "ldr-return", from: { partId: "ldr", pinId: "t2" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  })
  const dark = computeWireCurrents(makeCircuit(0), {}, {})
  const bright = computeWireCurrents(makeCircuit(1023), {}, {})
  assert.ok(dark["ldr-feed"]?.currentMa > 0.09 && dark["ldr-feed"]?.currentMa < 0.11,
    `dark LDR should draw about 0.1mA, received ${dark["ldr-feed"]?.currentMa}mA`)
  assert.ok(bright["ldr-feed"]?.currentMa > 9.5 && bright["ldr-feed"]?.currentMa < 10.5,
    `bright LDR should draw about 10mA, received ${bright["ldr-feed"]?.currentMa}mA`)
})


test("parallel physical wire routes share current by conductor resistance and conserve branch current", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r", type: "resistor", x: 260, y: 100, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "feed-a", from: { partId: "uno", pinId: "5v" }, to: { partId: "r", pinId: "a" }, color: "#ef4444" },
      { id: "feed-b", from: { partId: "uno", pinId: "5v" }, to: { partId: "r", pinId: "a" }, color: "#f97316" },
      { id: "return", from: { partId: "r", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.ok(Math.abs((currents["feed-a"]?.currentMa ?? 0) - 2.5) < 0.05,
    `first equal wire route should carry about 2.5mA, got ${currents["feed-a"]?.currentMa}`)
  assert.ok(Math.abs((currents["feed-b"]?.currentMa ?? 0) - 2.5) < 0.05,
    `second equal wire route should carry about 2.5mA, got ${currents["feed-b"]?.currentMa}`)
  assert.ok(Math.abs((currents["feed-a"].currentMa + currents["feed-b"].currentMa) - 5) < 0.05,
    "parallel feed routes must sum to the solved 5mA load current")
  assert.ok(Math.abs(currents["return"]?.currentMa - 5) < 0.05,
    "common return must carry the sum of both parallel routes")
})

test("a source-conflicted circuit does not suppress current animation in an independent valid circuit", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "esp", type: "esp32-devkit", x: 200, y: 100, rotation: 0, props: {} },
      { id: "bad-load", type: "resistor", x: 360, y: 100, rotation: 0, props: { resistance: 1000 } },
      { id: "battery", type: "battery", x: 40, y: 300, rotation: 0, props: { voltage: 9 } },
      { id: "good-load", type: "resistor", x: 260, y: 300, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "conflict", from: { partId: "uno", pinId: "5v" }, to: { partId: "esp", pinId: "3v3" }, color: "#ef4444" },
      { id: "common-ground", from: { partId: "uno", pinId: "gnd_pwr" }, to: { partId: "esp", pinId: "gnd" }, color: "#1e293b" },
      { id: "bad-feed", from: { partId: "uno", pinId: "5v" }, to: { partId: "bad-load", pinId: "a" }, color: "#ef4444" },
      { id: "bad-return", from: { partId: "bad-load", pinId: "b" }, to: { partId: "uno", pinId: "gnd_pwr" }, color: "#1e293b" },
      { id: "good-feed", from: { partId: "battery", pinId: "pos" }, to: { partId: "good-load", pinId: "a" }, color: "#f97316" },
      { id: "good-return", from: { partId: "good-load", pinId: "b" }, to: { partId: "battery", pinId: "neg" }, color: "#1e293b" },
    ],
  }
  const currents = computeWireCurrents(circuit, {}, {})
  assert.equal(currents["bad-feed"], undefined, "source-conflicted network must not fabricate current")
  assert.equal(currents["bad-return"], undefined, "source-conflicted return must not animate")
  assert.ok(currents["good-feed"]?.currentMa > 8.9 && currents["good-feed"]?.currentMa < 9.1,
    "independent 9V/1kΩ circuit must continue to animate at about 9mA")
  assert.ok(currents["good-return"]?.currentMa > 8.9 && currents["good-return"]?.currentMa < 9.1)
})
