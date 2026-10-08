import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outfile = join(tmpdir(), `current-flow-bundle-${Date.now()}.mjs`)
await build({
  entryPoints: [new URL("../../src/lib/current-flow.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const { computeWireCurrents } = await import(`file://${outfile}`)

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
