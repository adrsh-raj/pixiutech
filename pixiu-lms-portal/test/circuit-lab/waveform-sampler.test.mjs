import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outfile = join(tmpdir(), `waveform-sampler-${Date.now()}.mjs`)
await build({
  entryPoints: [new URL("../../src/lib/waveform-sampler.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})

const { samplePinVoltage, computeChannelMetrics } = await import(`file://${outfile}`)

for (const resistance of [220, 330, 10000]) {
  test(`Oscilloscope channels show dynamic voltage across ${resistance}Ω resistor`, () => {
    const state = {
      parts: [
        { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
        { id: "r1", type: "resistor", x: 100, y: 0, rotation: 0, props: { resistance } },
        { id: "led1", type: "led", x: 200, y: 0, rotation: 0, props: { color: "red" } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "red" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
        { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
      ],
    }
    const pinStates = { "13": { state: "HIGH" } }
    const redProbe = { partId: "r1", pinId: "a" }
    const blackProbe = { partId: "r1", pinId: "b" }
    const redV = samplePinVoltage(redProbe, state, pinStates, 0)
    const blackV = samplePinVoltage(blackProbe, state, pinStates, 0)
    const expectedCurrent = (5 - 1.9) / (resistance + 10)
    const expectedDrop = expectedCurrent * resistance
    const channelHistory = [
      { t: 0, v1: redV, v2: blackV },
      { t: 1, v1: redV, v2: blackV },
    ]
    const channelOne = computeChannelMetrics(channelHistory, "v1", true)
    const channelTwo = computeChannelMetrics(channelHistory, "v2", true)

    assert.ok(Math.abs((redV - blackV) - expectedDrop) < 0.02)
    assert.ok(Math.abs((channelOne.currentV - channelTwo.currentV) - expectedDrop) < 0.02)
  })
}

test("Oscilloscope sampler preserves PWM transitions at the board's configured frequency", () => {
  const state = {
    parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }],
    wires: [],
  }
  const pinStates = { "9": { value: 128 } }
  const probe = { partId: "uno", pinId: "d9" }

  assert.equal(samplePinVoltage(probe, state, pinStates, 0), 5)
  assert.equal(samplePinVoltage(probe, state, pinStates, 1.1), 0)
})

test("Oscilloscope does not show an LED forward voltage when its MCU output is off", () => {
  const state = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 100, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 200, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const pinStates = {}
  const probeA = { partId: "r1", pinId: "a" }
  const probeB = { partId: "r1", pinId: "b" }
  const voltageA = samplePinVoltage(probeA, state, pinStates, 0)
  const voltageB = samplePinVoltage(probeB, state, pinStates, 0)

  assert.equal(voltageA, 0)
  assert.equal(voltageB, 0)
  assert.equal(voltageA - voltageB, 0)
})

test("Channel metrics calculate Vpp and frequency from sampled data", () => {
  const history = [
    { t: 0, v1: 0, v2: 1 },
    { t: 5, v1: 5, v2: 1 },
    { t: 10, v1: 0, v2: 1 },
    { t: 15, v1: 5, v2: 1 },
    { t: 20, v1: 0, v2: 1 },
  ]
  const metrics = computeChannelMetrics(history, "v1", true)

  assert.equal(metrics.vpp, 5)
  assert.equal(metrics.frequencyHz, 100)
})
