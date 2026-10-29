import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outdir = join(tmpdir(), `pixiu-runtime-core-${Date.now()}`)
await build({
  entryPoints: [
    new URL("../../src/lib/simulation.ts", import.meta.url).pathname,
    new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname,
    new URL("../../src/lib/blockly-runner.ts", import.meta.url).pathname,
    new URL("../../src/lib/circuit-doctor.ts", import.meta.url).pathname,
    new URL("../../src/lib/breadboard-pins.ts", import.meta.url).pathname,
  ],
  bundle: true,
  format: "esm",
  outdir,
  platform: "neutral",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})

const { computeRuntime } = await import(`file://${join(outdir, "simulation.js")}`)
const { solveCircuitNodalPotentials } = await import(`file://${join(outdir, "circuit-solver.js")}`)
const { runBlocklyProgram } = await import(`file://${join(outdir, "blockly-runner.js")}`)
const { diagnoseCircuit } = await import(`file://${join(outdir, "circuit-doctor.js")}`)
const { normalizeBreadboardPinId } = await import(`file://${join(outdir, "breadboard-pins.js")}`)

const part = (id, type, props = {}) => ({ id, type, x: 0, y: 0, rotation: 0, props })
const wire = (id, fromPart, fromPin, toPart, toPin) => ({
  id,
  from: { partId: fromPart, pinId: fromPin },
  to: { partId: toPart, pinId: toPin },
  color: "#22c55e",
})

test("simulation maps legacy breadboard holes to their actual columns", () => {
  const circuit = {
    parts: [part("battery", "battery"), part("board", "breadboard"), part("r", "resistor", { resistance: 330 }), part("led", "led", { color: "blue" })],
    wires: [
      wire("source", "battery", "pos", "board", "b1"),
      wire("to-r", "board", "b_6", "r", "a"),
      wire("to-led", "r", "b", "led", "anode"),
      wire("return", "led", "cathode", "battery", "neg"),
    ],
  }

  const runtime = computeRuntime(circuit, new Set())
  assert.equal(runtime.led.burnt, false)
  assert.ok(runtime.led.level > 0)
  assert.ok(runtime.led.currentMa < 30)
})

test("all legacy breadboard hole aliases resolve to the catalog coordinates", () => {
  assert.equal(normalizeBreadboardPinId("a1"), "a_3")
  assert.equal(normalizeBreadboardPinId("b1"), "b_6")
  assert.equal(normalizeBreadboardPinId("c1"), "c_9")
  assert.equal(normalizeBreadboardPinId("e1"), "e_15")
  assert.equal(normalizeBreadboardPinId("a2"), "f_3")
  assert.equal(normalizeBreadboardPinId("e2"), "j_15")
  assert.equal(normalizeBreadboardPinId("pos_top"), "pos_t_1")
})

test("Circuit Doctor reads PWM capabilities from the active board registry", () => {
  const circuitFor = (boardType, boardPin) => ({
    parts: [part("board", boardType), part("servo", "servo")],
    wires: [wire("signal", "servo", "sig", "board", boardPin)],
  })
  const esp32Report = diagnoseCircuit(circuitFor("esp32-devkit", "d4"))
  const unoReport = diagnoseCircuit(circuitFor("arduino-uno", "d2"))
  assert.equal(esp32Report.issues.some((issue) => issue.id === "servo-non-pwm-servo"), false)
  assert.equal(unoReport.issues.some((issue) => issue.id === "servo-non-pwm-servo"), true)
})

test("open circuit pins are reported as floating instead of a false 0V reading", () => {
  const circuit = { parts: [part("r", "resistor", { resistance: 220 })], wires: [] }
  const solution = solveCircuitNodalPotentials(circuit)
  const info = solution.getPinInfo({ partId: "r", pinId: "a" })
  const reading = solution.getPotentialDifference({ partId: "r", pinId: "a" }, null, circuit, {})

  assert.equal(info.isFloating, true)
  assert.match(reading.explanation, /open circuit/i)
  assert.equal(reading.isWarning, true)
})

test("a 3V source cannot illuminate a white LED with a 3.3V forward voltage", () => {
  const circuit = {
    parts: [part("battery", "battery", { voltage: 3 }), part("r", "resistor", { resistance: 1000 }), part("led", "led", { color: "white" })],
    wires: [
      wire("source", "battery", "pos", "r", "a"),
      wire("forward", "r", "b", "led", "anode"),
      wire("return", "led", "cathode", "battery", "neg"),
    ],
  }
  const runtime = computeRuntime(circuit, new Set())
  assert.equal(runtime.led.burnt, false)
  assert.equal(runtime.led.level, 0)
  assert.ok(runtime.led.currentMa < 1)
})

test("potentiometer resistance is configurable in the circuit solver", () => {
  const circuit = { parts: [part("pot", "potentiometer", { value: 512, resistance: 20000 })], wires: [] }
  const solution = solveCircuitNodalPotentials(circuit)
  const measured = solution.computeResistanceBetweenPins(
    { partId: "pot", pinId: "t1" },
    { partId: "pot", pinId: "t2" },
  )
  assert.equal(Math.round(measured.resistance), 20000)
})

test("buzzer runtime preserves tone frequency without treating Hz as PWM duty", async () => {
  const circuit = {
    parts: [part("uno", "arduino-uno"), part("buzzer", "buzzer")],
    wires: [
      wire("tone", "uno", "d8", "buzzer", "pos"),
      wire("gnd", "buzzer", "neg", "uno", "gnd_pwr"),
    ],
  }
  const runtime = computeRuntime(circuit, new Set(), {
    "8": { state: "HIGH", value: 255, toneHz: 440 },
  })

  assert.equal(runtime.buzzer.level, 1)
  assert.equal(runtime.buzzer.toneFrequency, 440)
})

test("concurrent Blockly programs keep LCD cursors isolated", async () => {
  const makeBlock = (id, text, next = null) => ({
    id,
    type: "lcd_print",
    getFieldValue: () => null,
    getInputTargetBlock: (name) => name === "TEXT"
      ? { type: "text_string", getFieldValue: () => text }
      : null,
    getNextBlock: () => next,
  })
  const makeProgram = (prefix) => {
    let active = true
    let count = 0
    const writes = []
    const second = makeBlock(`${prefix}-2`, `${prefix}2`)
    const first = makeBlock(`${prefix}-1`, `${prefix}1`, second)
    const root = {
      type: "arduino_program",
      getInputTargetBlock: (name) => name === "LOOP" ? first : null,
    }
    const env = {
      isRunning: () => active,
      sleep: async () => {},
      setLcdText: (col, row, text) => {
        writes.push([col, row, text])
        count += 1
        if (count === 2) active = false
      },
    }
    return { workspace: { getTopBlocks: () => [root] }, env, writes }
  }

  const a = makeProgram("A")
  const b = makeProgram("B")
  await Promise.all([
    runBlocklyProgram(a.workspace, a.env, new AbortController().signal),
    runBlocklyProgram(b.workspace, b.env, new AbortController().signal),
  ])

  assert.deepEqual(a.writes, [[0, 0, "A1"], [2, 0, "A2"]])
  assert.deepEqual(b.writes, [[0, 0, "B1"], [2, 0, "B2"]])
})

test("WiFi local IP reports 0.0.0.0 when the runtime has no connection", async () => {
  let active = true
  let printed = ""
  const value = { type: "wifi_local_ip" }
  const statement = {
    id: "print-ip",
    type: "serial_print",
    getFieldValue: () => null,
    getInputTargetBlock: (name) => name === "TEXT" ? value : null,
    getNextBlock: () => null,
  }
  const root = {
    type: "arduino_program",
    getInputTargetBlock: (name) => name === "LOOP" ? statement : null,
  }
  await runBlocklyProgram(
    { getTopBlocks: () => [root] },
    {
      isRunning: () => active,
      sleep: async () => { active = false },
      wifiGetIp: () => null,
      serialPrint: (text) => { printed = text; active = false },
    },
    new AbortController().signal,
  )
  assert.equal(printed, "0.0.0.0")
})

