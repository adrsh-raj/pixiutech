import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `circuit-copilot-test-${Date.now()}`)
await build({
  entryPoints: {
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
    telemetry: new URL("../../src/lib/circuit-telemetry.ts", import.meta.url).pathname,
    action: new URL("../../src/components/circuit-lab/use-circuit-copilot-action.ts", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const validatorMod = await import(
  `file://${join(bundleDir, "validator.js")}`
)
const telemetryMod = await import(
  `file://${join(bundleDir, "telemetry.js")}`
)
const actionMod = await import(
  `file://${join(bundleDir, "action.js")}`
)

const { validateProposedCircuit, resolveCanonicalPin, computeCircuitHash } = validatorMod
const { serializeCircuitTelemetry } = telemetryMod
const { computeCircuitDiff } = actionMod

test("Circuit Validator: Rejects direct 5V to GND dead short with critical error", () => {
  const shortCircuit = {
    parts: [{ id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} }],
    wires: [
      { id: "w_short", from: { partId: "uno", pinId: "5v" }, to: { partId: "uno", pinId: "gnd" } },
    ],
  }
  const result = validateProposedCircuit(shortCircuit)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => /Short Circuit.*5V/i.test(e)))
  assert.equal(result.metrics.shortCircuitsFound, 1)
})

test("Circuit Validator: Rejects naked LED without series current-limiting resistor", () => {
  const nakedLedCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "led1", type: "led", x: 300, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "led1", pinId: "anode" } },
      { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" } },
    ],
  }
  const result = validateProposedCircuit(nakedLedCircuit)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((e) => /LED Overcurrent Burnout/i.test(e)))
  assert.equal(result.metrics.overcurrentRisks, 1)
})

test("Circuit Validator: Accepts LED with proper 220Ω series resistor", () => {
  const safeCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 320, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" } },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" } },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" } },
    ],
  }
  const result = validateProposedCircuit(safeCircuit)
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
})

test("Circuit Validator: Resolves pin aliases (+/-, 1/2, w/out, D13) into canonical pin IDs", () => {
  const aliasedCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 320, y: 110, rotation: 0, props: { color: "green" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "D13" }, to: { partId: "r1", pinId: "1" } },
      { id: "w2", from: { partId: "r1", pinId: "2" }, to: { partId: "led1", pinId: "+" } },
      { id: "w3", from: { partId: "led1", pinId: "-" }, to: { partId: "uno", pinId: "GND" } },
    ],
  }
  const result = validateProposedCircuit(aliasedCircuit)
  assert.equal(result.valid, true)
  assert.ok(result.normalizedCircuit)
  assert.equal(result.normalizedCircuit.wires[0].to.pinId, "a")
  assert.equal(result.normalizedCircuit.wires[1].to.pinId, "anode")
  assert.equal(result.normalizedCircuit.wires[2].from.pinId, "cathode")
  assert.equal(result.normalizedCircuit.wires[2].to.pinId, "gnd")
})

test("Revision Hash: Generates deterministic, permutation-invariant 16-hex hash", () => {
  const c1 = {
    parts: [
      { id: "p1", type: "led", x: 10, y: 20, rotation: 0, props: {} },
      { id: "p2", type: "resistor", x: 30, y: 40, rotation: 0, props: {} },
    ],
    wires: [],
  }
  const c2 = {
    parts: [
      { id: "p2", type: "resistor", x: 30, y: 40, rotation: 0, props: {} },
      { id: "p1", type: "led", x: 10, y: 20, rotation: 0, props: {} },
    ],
    wires: [],
  }
  assert.equal(computeCircuitHash(c1), computeCircuitHash(c2))
})

test("Circuit Telemetry: Serializes state with truth-labels and token bounds", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "led1", type: "led", x: 300, y: 110, rotation: 0, props: { color: "red" } },
      { id: "r1", type: "resistor", x: 200, y: 110, rotation: 0, props: { resistance: 220 } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" } },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" } },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" } },
    ],
  }
  const telemetry = serializeCircuitTelemetry({
    circuit,
    pinStates: { d13: { state: "HIGH", value: 255 } },
    runtime: { led1: { currentMa: 18.2, burnt: false } },
  })
  assert.equal(telemetry.schemaVersion, "1.0.0")
  assert.equal(telemetry.board?.truth, "simulated")
  assert.equal(telemetry.diagnostics.truth, "static-rule-inference")
  assert.ok(telemetry.compactPromptString.includes("[PIXIU CYBERLAB TELEMETRY"))
  assert.ok(telemetry.tokenCountEstimate < 300)
})

test("Circuit Diff: Computes added and removed components and wires accurately", () => {
  const current = {
    parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }],
    wires: [],
  }
  const proposed = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "buzz", type: "buzzer", x: 100, y: 0, rotation: 0, props: {} },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzz", pinId: "pos" }, color: "#eab308" },
      { id: "w2", from: { partId: "buzz", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    ],
  }
  const diff = computeCircuitDiff(current, proposed)
  assert.equal(diff.addedParts.length, 1)
  assert.equal(diff.addedParts[0].id, "buzz")
  assert.equal(diff.addedWires.length, 2)
  assert.equal(diff.removedParts.length, 0)
  assert.equal(diff.removedWires.length, 0)
})
