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
    new URL("../../src/lib/waveform-sampler.ts", import.meta.url).pathname,
    new URL("../../src/lib/board-registry.ts", import.meta.url).pathname,
    new URL("../../src/lib/pin-state.ts", import.meta.url).pathname,
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
const { samplePinVoltage } = await import(`file://${join(outdir, "waveform-sampler.js")}`)
const { getBoardForPart, lookupBoardPinState } = await import(`file://${join(outdir, "board-registry.js")}`)
const { writePinStateAliases } = await import(`file://${join(outdir, "pin-state.js")}`)

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

test("10kΩ button pull-down keeps the input LOW at rest and HIGH only while pressed", () => {
  const circuit = {
    parts: [
      part("uno", "arduino-uno"),
      part("button", "pushbutton"),
      part("pull", "resistor", { resistance: 10000 }),
    ],
    wires: [
      wire("signal-to-button", "uno", "d2", "button", "p1a"),
      wire("button-to-5v", "button", "p2a", "uno", "5v"),
      wire("signal-to-pulldown", "uno", "d2", "pull", "a"),
      wire("pulldown-to-gnd", "pull", "b", "uno", "gnd"),
    ],
  }
  const inputPin = { partId: "uno", pinId: "d2" }
  const idle = solveCircuitNodalPotentials(circuit, new Set())
  assert.ok(Math.abs(idle.getPinVoltage(inputPin)) < 0.01, "released input should be held at 0V")
  assert.equal(idle.getPinInfo(inputPin).isFloating, false, "released input must not float")

  const pressed = solveCircuitNodalPotentials(circuit, new Set(["button"]))
  assert.ok(pressed.getPinVoltage(inputPin) > 4.5, "pressed button should drive the input to the 5V rail")
  assert.equal(pressed.getPinInfo(inputPin).isFloating, false, "pressed input must remain electrically defined")
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


test("component power requires dedicated supply and ground rails, not GPIO output levels", () => {
  const gpioHighSupply = {
    parts: [part("uno", "arduino-uno"), part("sensor", "dht11")],
    wires: [
      wire("gpio-to-vcc", "uno", "d2", "sensor", "vcc"),
      wire("sensor-ground", "sensor", "gnd", "uno", "gnd"),
    ],
  }
  const gpioPowered = computeRuntime(gpioHighSupply, new Set(), { "2": { state: "HIGH", value: 255 } })
  assert.equal(gpioPowered.sensor.dhtTemperature, undefined, "a HIGH GPIO must not count as a DHT11 supply rail")

  const gpioGround = {
    parts: [part("uno", "arduino-uno"), part("sensor", "dht11")],
    wires: [
      wire("supply", "uno", "5v", "sensor", "vcc"),
      wire("gpio-as-ground", "sensor", "gnd", "uno", "d3"),
    ],
  }
  const gpioGrounded = computeRuntime(gpioGround, new Set(), { "3": { state: "LOW", value: 0 } })
  assert.equal(gpioGrounded.sensor.dhtTemperature, undefined, "a LOW GPIO must not count as a component ground rail")

  const correctlyPowered = {
    parts: [part("uno", "arduino-uno"), part("sensor", "dht11")],
    wires: [
      wire("supply", "uno", "5v", "sensor", "vcc"),
      wire("ground", "sensor", "gnd", "uno", "gnd"),
    ],
  }
  const powered = computeRuntime(correctlyPowered, new Set())
  assert.equal(powered.sensor.dhtTemperature, 25, "a real 5V/GND connection must power the sensor")
})

test("L298N requires a real motor supply and common ground before driving a motor", () => {
  const controls = {
    "9": { state: "HIGH", value: 128 },
    "8": { state: "HIGH", value: 255 },
    "7": { state: "LOW", value: 0 },
  }
  const makeDriverCircuit = (supplyMode, groundMode) => {
    const parts = [part("uno", "arduino-uno"), part("driver", "l298n"), part("motor", "dc-motor")]
    const wires = [
      wire("ena", "uno", "d9", "driver", "ena"),
      wire("in1", "uno", "d8", "driver", "in1"),
      wire("in2", "uno", "d7", "driver", "in2"),
      wire("motor-pos", "driver", "out1", "motor", "pos"),
      wire("motor-neg", "driver", "out2", "motor", "neg"),
    ]
    if (supplyMode === "battery") {
      parts.push(part("battery", "battery", { voltage: 9 }))
      wires.push(wire("vs", "battery", "pos", "driver", "vs"))
    } else {
      wires.push(wire("vs", "uno", "d6", "driver", "vs"))
    }
    if (groundMode === "battery") {
      wires.push(wire("battery-ground", "battery", "neg", "driver", "gnd"))
      wires.push(wire("board-common-ground", "uno", "gnd", "driver", "gnd"))
    } else if (groundMode === "gpio") {
      wires.push(wire("gpio-ground", "uno", "d5", "driver", "gnd"))
    } else {
      wires.push(wire("common-ground", "uno", "gnd", "driver", "gnd"))
    }
    return { parts, wires }
  }

  const gpioOnly = computeRuntime(makeDriverCircuit("gpio", "board"), new Set(), {
    ...controls,
    "6": { state: "HIGH", value: 255 },
  })
  assert.equal(gpioOnly.driver.motorARpm, 0, "a HIGH GPIO must not supply the L298N motor rail")

  const falseGround = computeRuntime(makeDriverCircuit("battery", "gpio"), new Set(), {
    ...controls,
    "5": { state: "LOW", value: 0 },
  })
  assert.equal(falseGround.driver.motorARpm, 0, "a LOW GPIO must not replace the L298N common ground")

  const validPower = computeRuntime(makeDriverCircuit("battery", "battery"), new Set(), controls)
  assert.ok(validPower.driver.motorARpm > 0, "a battery supply with a common return should drive the motor")
})



test("potentiometer divider paths do not create false LED reverse-polarity warnings", () => {
  const circuit = {
    parts: [
      part("uno", "arduino-uno"),
      part("pot", "potentiometer", { value: 380, resistance: 10000 }),
      part("blue-r", "resistor", { resistance: 220 }),
      part("blue", "led", { color: "blue" }),
      part("green-r", "resistor", { resistance: 220 }),
      part("green", "led", { color: "green" }),
    ],
    wires: [
      wire("pot-high", "uno", "5v", "pot", "t1"),
      wire("pot-low", "pot", "t2", "uno", "gnd"),
      wire("pot-wiper", "pot", "wiper", "uno", "a0"),
      wire("blue-drive", "uno", "d9", "blue-r", "a"),
      wire("blue-series", "blue-r", "b", "blue", "anode"),
      wire("blue-return", "blue", "cathode", "uno", "gnd"),
      wire("green-drive", "uno", "d10", "green-r", "a"),
      wire("green-series", "green-r", "b", "green", "anode"),
      wire("green-return", "green", "cathode", "uno", "gnd"),
    ],
  }
  const runtime = computeRuntime(circuit, new Set(), {
    "9": { state: "HIGH", value: 95 },
    "10": { state: "LOW", value: 0 },
  })

  assert.equal(runtime.green.level, 0, "the LOW-driven green LED should stay off")
  assert.equal(runtime.green.warning, undefined, "a potentiometer divider must not be diagnosed as reversed LED polarity")
  assert.ok(runtime.blue.level > 0, "the PWM-driven blue LED must illuminate at a non-zero duty")
  assert.equal(runtime.blue.warning, undefined, "a valid PWM LED path must not receive a polarity warning")
  assert.ok(runtime.blue.currentMa > 0 && runtime.blue.currentMa < 8.5, "reported LED current should be PWM-averaged")
})

test("genuine reversed LED wiring is still detected from signed node potentials", () => {
  const circuit = {
    parts: [
      part("battery", "battery", { voltage: 5 }),
      part("r", "resistor", { resistance: 220 }),
      part("led", "led", { color: "red" }),
    ],
    wires: [
      wire("positive-to-resistor", "battery", "pos", "r", "a"),
      wire("resistor-to-cathode", "r", "b", "led", "cathode"),
      wire("anode-to-negative", "led", "anode", "battery", "neg"),
    ],
  }
  const runtime = computeRuntime(circuit, new Set())
  assert.equal(runtime.led.level, 0)
  assert.match(runtime.led.warning, /Reverse Polarity/)
})

test("PWM LED brightness follows duty cycle while pulse amplitude stays at logic HIGH", () => {
  const circuit = {
    parts: [
      part("uno", "arduino-uno"),
      part("r", "resistor", { resistance: 220 }),
      part("led", "led", { color: "red" }),
    ],
    wires: [
      wire("drive", "uno", "d9", "r", "a"),
      wire("series", "r", "b", "led", "anode"),
      wire("return", "led", "cathode", "uno", "gnd"),
    ],
  }
  const levelAt = (value) => computeRuntime(circuit, new Set(), {
    "9": { state: value > 0 ? "HIGH" : "LOW", value },
  }).led

  const off = levelAt(0)
  const quarter = levelAt(64)
  const half = levelAt(128)
  const full = levelAt(255)
  assert.equal(off.level, 0)
  assert.equal(off.currentMa ?? 0, 0)
  assert.ok(quarter.level > 0)
  assert.ok(half.level > quarter.level)
  assert.ok(full.level > half.level)
  assert.ok(full.currentMa > half.currentMa)
  assert.ok(full.currentMa > 10 && full.currentMa < 20)
})

test("per-instance LED forward-voltage overrides use the shared electrical model", () => {
  const makeCircuit = (forwardVoltage) => ({
    parts: [
      part("battery", "battery", { voltage: 3 }),
      part("r", "resistor", { resistance: 1000 }),
      part("led", "led", { color: "white", forwardVoltage }),
    ],
    wires: [
      wire("source", "battery", "pos", "r", "a"),
      wire("forward", "r", "b", "led", "anode"),
      wire("return", "led", "cathode", "battery", "neg"),
    ],
  })
  const defaultModel = computeRuntime(makeCircuit(undefined), new Set())
  const overriddenModel = computeRuntime(makeCircuit(2.5), new Set())
  assert.equal(defaultModel.led.level, 0, "white LED default Vf should exceed 3V supply")
  assert.ok(overriddenModel.led.level > 0, "a component Vf override should affect the shared solver and runtime")
})

test("pin output mode changes replace stale PWM, tone, and servo state across aliases", () => {
  const pwm = writePinStateAliases({}, "D9", { state: "HIGH", value: 128 })
  assert.equal(pwm["9"].value, 128)
  assert.equal(pwm.d9.value, 128)

  const digital = writePinStateAliases(pwm, "9", { state: "LOW" })
  assert.equal(digital["9"].state, "LOW")
  assert.equal(digital.d9.state, "LOW")
  assert.equal(digital.gpio9.value, undefined, "digitalWrite must clear prior PWM duty")
  assert.equal(digital.gp9.value, undefined)

  const tone = writePinStateAliases(digital, "9", { state: "HIGH", value: 255, toneHz: 880 })
  assert.equal(tone["9"].toneHz, 880)
  const servo = writePinStateAliases(tone, "9", { state: "LOW", angle: 90 })
  assert.equal(servo["9"].angle, 90)
  assert.equal(servo["9"].toneHz, undefined, "servoWrite must clear prior tone state")
  assert.equal(servo["9"].value, undefined)
})


test("PWM pin has full pulse voltage but nodal/DC meter reads average voltage", () => {
  const circuit = { parts: [part("uno", "arduino-uno")], wires: [] }
  const pwm = { "9": { state: "HIGH", value: 128, outputMode: "pwm" } }
  const nodal = solveCircuitNodalPotentials(circuit, new Set(), pwm)
  const average = nodal.getPinVoltage({ partId: "uno", pinId: "d9" })
  assert.ok(Math.abs(average - (5 * 128 / 255)) < 0.02, "DMM/nodal DC view should report average PWM voltage")
  const definition = getBoardForPart(part("uno", "arduino-uno"))
  const period = 1000 / definition.pwmFrequencyDefaultHz
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d9" }, circuit, pwm, period * 0.25), 5)
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d9" }, circuit, pwm, period * 0.75), 0)
})

test("true DAC output stays continuous DC while analogWrite on a DAC-capable pin remains PWM", () => {
  const circuit = { parts: [part("esp", "esp32-devkit")], wires: [] }
  const dac = { "25": { state: "HIGH", value: 128, outputMode: "dac" } }
  const pwm = { "25": { state: "HIGH", value: 128, outputMode: "pwm" } }
  const dacVoltage = samplePinVoltage({ partId: "esp", pinId: "d25" }, circuit, dac, 0.75)
  assert.ok(Math.abs(dacVoltage - (3.3 * 128 / 255)) < 0.02)
  const definition = getBoardForPart(part("esp", "esp32-devkit"))
  const period = 1000 / definition.pwmFrequencyDefaultHz
  assert.equal(samplePinVoltage({ partId: "esp", pinId: "d25" }, circuit, pwm, period * 0.25), 3.3)
  assert.equal(samplePinVoltage({ partId: "esp", pinId: "d25" }, circuit, pwm, period * 0.75), 0)
})

test("tone and servo outputs are sampled as their own timed pulse waveforms", () => {
  const circuit = { parts: [part("uno", "arduino-uno")], wires: [] }
  const tone = { "8": { state: "HIGH", value: 255, toneHz: 440, outputMode: "tone" } }
  const tonePeriod = 1000 / 440
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d8" }, circuit, tone, tonePeriod * 0.25), 5)
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d8" }, circuit, tone, tonePeriod * 0.75), 0)

  const servo = { "9": { state: "HIGH", value: 19, angle: 90, outputMode: "servo" } }
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d9" }, circuit, servo, 0.75), 5)
  assert.equal(samplePinVoltage({ partId: "uno", pinId: "d9" }, circuit, servo, 3), 0)
})


test("board pin aliases preserve explicit digital PWM tone servo and DAC signal modes", () => {
  const board = getBoardForPart(part("esp", "esp32-devkit"))
  const modes = [
    ["GPIO25", { state: "HIGH", value: 128, outputMode: "pwm" }, "pwm"],
    ["25", { state: "HIGH", value: 128, outputMode: "dac" }, "dac"],
    ["gpio2", { state: "HIGH", value: 255, toneHz: 440, outputMode: "tone" }, "tone"],
    ["d4", { state: "HIGH", value: 19, angle: 90, outputMode: "servo" }, "servo"],
    ["D15", { state: "HIGH", outputMode: "digital" }, "digital"],
  ]
  for (const [alias, pinState, expected] of modes) {
    const resolved = lookupBoardPinState({ [alias]: pinState }, alias, board)
    assert.equal(resolved.outputMode, expected, `pin alias ${alias} should preserve ${expected} mode`)
  }
})


test("Pico relay energizes only through its coil and switches VBUS through COM/NO to the pump", () => {
  const circuit = {
    parts: [
      part("pico", "rpi-pico"),
      part("soil", "soil-moisture", { moisture: 350 }),
      part("rly", "relay"),
      part("pump", "dc-motor"),
    ],
    wires: [
      wire("soil-vcc", "pico", "3v3", "soil", "vcc"),
      wire("soil-gnd", "pico", "gnd_7", "soil", "gnd"),
      wire("soil-ao", "pico", "gp27", "soil", "ao"),
      wire("relay-vcc", "pico", "vbus", "rly", "vcc"),
      wire("relay-gnd", "pico", "gnd_1", "rly", "gnd"),
      wire("relay-in", "pico", "gp13", "rly", "in"),
      wire("contact-feed", "pico", "vbus", "rly", "com"),
      wire("contact-pump", "rly", "no", "pump", "pos"),
      wire("pump-return", "pump", "neg", "pico", "gnd_1"),
    ],
  }

  const on = computeRuntime(circuit, new Set(), {
    "13": { state: "HIGH", outputMode: "digital" },
  })
  assert.equal(on.rly.relayActive, true, "GP13 HIGH plus real VBUS/GND should energize relay coil")
  assert.ok(on.pump.rpm > 0, "energized COM-NO contact should power the pump motor")

  const off = computeRuntime(circuit, new Set(), {
    "13": { state: "LOW", outputMode: "digital" },
  })
  assert.equal(off.rly.relayActive, false, "GP13 LOW should de-energize relay coil")
  assert.equal(off.pump.rpm, 0, "open NO contact must leave the pump motor unpowered")
})
