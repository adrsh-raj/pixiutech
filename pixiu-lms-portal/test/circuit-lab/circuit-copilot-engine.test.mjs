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
const { canRestoreAtRevision } = actionMod
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

test("Pin alias normalization: maps v33 to the micro:bit 3V rail", () => {
  assert.equal(resolveCanonicalPin("microbit-v2", "v33"), "3v")
})

test("Circuit Validator: Rejects unknown pin IDs instead of accepting arbitrary endpoints", () => {
  const invalidPinCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "led1", type: "led", x: 300, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w_bad_pin", from: { partId: "uno", pinId: "D999" }, to: { partId: "led1", pinId: "anode" } },
    ],
  }
  const result = validateProposedCircuit(invalidPinCircuit)
  assert.equal(result.valid, false)
  assert.ok(result.notices.some((notice) => notice.ruleId.startsWith("identity-unknown-pin-")))
})

test("Circuit Validator: Rejects non-numeric and excessive component coordinates", () => {
  const board = { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} }
  const malformed = validateProposedCircuit({
    parts: [board, { id: "led1", type: "led", x: "300", y: 110, rotation: 0, props: {} }],
    wires: [],
  })
  assert.equal(malformed.valid, false)
  assert.ok(malformed.errors.some((message) => /Invalid Component Coordinates/i.test(message)))
  const excessive = validateProposedCircuit({
    parts: [board, { id: "led1", type: "led", x: 1e12, y: 110, rotation: 0, props: {} }],
    wires: [],
  })
  assert.equal(excessive.valid, false)
  assert.ok(excessive.errors.some((message) => /exceeds the allowed canvas/i.test(message)))
})

test("Circuit Validator: Rejects duplicate IDs after trimming whitespace", () => {
  const duplicateIds = {
    parts: [
      { id: "led1", type: "led", x: 100, y: 100, rotation: 0, props: {} },
      { id: " led1 ", type: "resistor", x: 200, y: 100, rotation: 0, props: { resistance: 220 } },
    ],
    wires: [],
  }
  const result = validateProposedCircuit(duplicateIds)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((message) => /Duplicate Part ID/i.test(message)))
})

test("Circuit Validator: Rejects unsafe Blockly XML regardless of tag case", () => {
  const result = validateProposedCircuit({
    parts: [],
    wires: [],
    blocklyXml: "<xml><SCRIPT>alert(1)</SCRIPT></xml>",
  })
  assert.equal(result.valid, false)
  assert.ok(result.notices.some((notice) => notice.ruleId === "syntax-script-injection-blocked"))
})

test("Circuit Validator: Rejects malformed Blockly payload types and roots", () => {
  assert.equal(validateProposedCircuit({ parts: [], wires: [], blocklyXml: {} }).valid, false)
  assert.equal(validateProposedCircuit({ parts: [], wires: [], blocklyXml: "<workspace/>" }).valid, false)
  assert.equal(validateProposedCircuit({ parts: [], wires: [], blocklyXml: "<xml></xml>" }).valid, true)
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
  const subPixelMutation = {
    ...c1,
    parts: [{ ...c1.parts[0], x: 10.25 }, c1.parts[1]],
  }
  assert.notEqual(computeCircuitHash(c1), computeCircuitHash(subPixelMutation), "Sub-pixel coordinate edits must change the revision")
  assert.notEqual(computeCircuitHash(c1), computeCircuitHash(c1, "<xml></xml>"), "Blockly edits must participate in the revision")
})

test("Undo/redo revision guard: refuses to restore over a newer manual edit", () => {
  assert.equal(canRestoreAtRevision("state-after-ai", "state-after-ai"), true)
  assert.equal(canRestoreAtRevision("state-after-ai", "state-after-manual-edit"), false)
})

test("Circuit Validator: Servo signal on a non-PWM Uno digital pin is not incorrectly flagged", () => {
  const servoCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "servo1", type: "servo", x: 240, y: 110, rotation: 0, props: {} },
    ],
    wires: [
      { id: "w_sig", from: { partId: "uno", pinId: "d4" }, to: { partId: "servo1", pinId: "sig" } },
      { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
      { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" } },
    ],
  }
  const result = validateProposedCircuit(servoCircuit)
  assert.equal(result.notices.some((notice) => /servo-non-pwm/.test(notice.ruleId)), false)
})

test("Circuit Validator: A series resistor alone does not make 5V safe for a 3.3V GPIO", () => {
  const overvoltageCircuit = {
    parts: [
      { id: "esp", type: "esp32-devkit", x: 30, y: 100, rotation: 0, props: {} },
      { id: "uno", type: "arduino-uno", x: 420, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 240, y: 100, rotation: 0, props: { resistance: 1000 } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" } },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "esp", pinId: "d21" } },
    ],
  }
  const result = validateProposedCircuit(overvoltageCircuit)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((message) => /Overvoltage on 3\.3V/i.test(message)))
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

test("Circuit Diff: Detects a component type replacement as a modification", () => {
  const current = {
    parts: [{ id: "part1", type: "led", x: 100, y: 100, rotation: 0, props: {} }],
    wires: [],
  }
  const proposed = {
    parts: [{ id: "part1", type: "buzzer", x: 100, y: 100, rotation: 0, props: {} }],
    wires: [],
  }
  const diff = computeCircuitDiff(current, proposed)
  assert.equal(diff.modifiedParts.length, 1)
  assert.equal(diff.modifiedParts[0].type, "buzzer")
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
