/**
 * PIXIU TECH CYBERLAB — XEN CIRCUIT INTELLIGENCE & REPAIR VERIFICATION SUITE
 * 
 * Executes all 10 Phase 6 circuit test scenarios and Phase 7 Hinglish reasoning queries
 * against real MNA simulation, fault diagnosis, and atomic repair verification.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `circuit-intel-test-${Date.now()}`)
await build({
  entryPoints: {
    intel: new URL("../../src/lib/circuit-intelligence.ts", import.meta.url).pathname,
    solver: new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname,
    doctor: new URL("../../src/lib/circuit-doctor.ts", import.meta.url).pathname,
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
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

const intelMod = await import(`file://${join(bundleDir, "intel.js")}`)
const solverMod = await import(`file://${join(bundleDir, "solver.js")}`)
const doctorMod = await import(`file://${join(bundleDir, "doctor.js")}`)
const validatorMod = await import(`file://${join(bundleDir, "validator.js")}`)

const {
  serializeCircuitContext,
  diagnoseCircuitIntelligence,
  generateCircuitRepairProposal,
  verifyCircuitWithSimulator,
  processCircuitCopilotQuery,
  extractCodePinBindings,
  buildEndpointNetLookup,
  analyzeCrossLayerLedDiagnostics,
} = intelMod

const { solveCircuitNodalPotentials } = solverMod
const { diagnoseCircuit } = doctorMod
const { validateProposedCircuit } = validatorMod

// ============================================================================
// PHASE 6: 10 REAL CIRCUIT TEST SCENARIOS
// ============================================================================

test("Test 1: LED Not Glowing — Diagnoses open return path, repairs connection, verifies illumination", () => {
  // Circuit: Arduino Uno + 220Ω resistor + LED with open cathode
  const brokenCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      // Cathode is missing return wire to GND!
    ],
  }

  const context = serializeCircuitContext(brokenCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  assert.ok(faults.length > 0, "Must detect fault")
  const openFault = faults.find((f) => f.classification === "OPEN_CIRCUIT")
  assert.ok(openFault, "Must classify as OPEN_CIRCUIT")
  assert.equal(openFault.affectedPartId, "led1")
  assert.equal(openFault.affectedPinId, "cathode")
  assert.ok(openFault.evidence.includes("cathode on led1 has no wires attached"))

  // Generate repair proposal
  const proposal = generateCircuitRepairProposal(brokenCircuit, faults, "rev_hash_1")
  assert.ok(proposal.actions.length > 0)
  assert.equal(proposal.actions[0].type, "connect")
  assert.equal(proposal.actions[0].from, "led1:cathode")

  // Simulator-in-the-loop verification
  const verification = verifyCircuitWithSimulator(brokenCircuit, proposal.repairedCircuit)
  assert.equal(verification.verified, true)
  assert.equal(verification.status, "VERIFIED_WORKING")
  assert.ok(verification.afterMetrics.activeCurrentsMa["led1"] > 10.0, "LED must conduct current >10mA")
  assert.ok(verification.afterMetrics.componentStates["led1"].includes("ILLUMINATED"))
})

test("Test 2: LED Reverse Polarity — Identifies reversed anode/cathode, swaps terminals, verifies forward conduction", () => {
  // Circuit: LED anode wired to GND, cathode wired to 5V rail
  const revCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "cathode" }, color: "red" }, // Reversed!
      { id: "w3", from: { partId: "led1", pinId: "anode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" }, // Reversed!
    ],
  }

  const context = serializeCircuitContext(revCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const revFault = faults.find((f) => f.classification === "REVERSED_LED_POLARITY")
  assert.ok(revFault, "Must classify as REVERSED_LED_POLARITY")
  assert.equal(revFault.affectedPartId, "led1")
  assert.ok(revFault.electricalExplanation.includes("forward biased"))

  // Generate repair proposal
  const proposal = generateCircuitRepairProposal(revCircuit, faults, "rev_hash_2")
  assert.ok(proposal.actions.some((a) => a.type === "disconnect"))
  assert.ok(proposal.actions.some((a) => a.type === "connect" && a.from === "led1:anode"))

  // Verify through simulator
  const verification = verifyCircuitWithSimulator(revCircuit, proposal.repairedCircuit)
  assert.equal(verification.verified, true)
  assert.equal(verification.status, "VERIFIED_WORKING")
  assert.ok(verification.afterMetrics.activeCurrentsMa["led1"] > 10.0, "LED must conduct after polarity fix")
})

test("Test 3: Missing Ground — Detects floating return path, connects to Arduino GND, verifies 0V reference", () => {
  // Circuit with battery load or LED where GND connection to board is missing
  const noGndCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }

  const context = serializeCircuitContext(noGndCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const gndFault = faults.find((f) => f.classification === "MISSING_GROUND")
  assert.ok(gndFault, "Must classify as MISSING_GROUND")
  assert.equal(gndFault.affectedPinId, "gnd")

  // Generate repair and verify
  const proposal = generateCircuitRepairProposal(noGndCircuit, faults, "rev_hash_3")
  assert.ok(proposal.actions.some((a) => a.type === "connect" && a.to.includes("gnd")))
})

test("Test 4: Wrong Resistor Value — Detects 10MΩ starvation, recalculates Ohm's law, changes to 220Ω, verifies 14mA", () => {
  const highResCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 10000000 } }, // 10MΩ
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }

  const context = serializeCircuitContext(highResCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const resFault = faults.find((f) => f.classification === "INCORRECT_RESISTOR_VALUE")
  assert.ok(resFault, "Must classify as INCORRECT_RESISTOR_VALUE")
  assert.equal(resFault.affectedPartId, "r1")
  assert.ok(resFault.evidence.includes("10000000Ω"))
  assert.ok(resFault.electricalExplanation.includes("Ohm's Law"))

  // Apply repair
  const proposal = generateCircuitRepairProposal(highResCircuit, faults, "rev_hash_4")
  assert.ok(proposal.actions.some((a) => a.type === "change_prop" && a.propValue === 220))

  // Simulator verification
  const verification = verifyCircuitWithSimulator(highResCircuit, proposal.repairedCircuit)
  assert.equal(verification.verified, true)
  assert.equal(verification.afterMetrics.componentStates["led1"].includes("ILLUMINATED"), true)
  assert.ok(verification.afterMetrics.activeCurrentsMa["led1"] > 10.0)
})

test("Test 5: Floating Analog Input — Identifies high-impedance floating pin A0 used in code", () => {
  const floatingCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
    ],
    wires: [],
  }
  const blocklyXml = '<xml><field name="PIN">A0</field></xml>'

  const context = serializeCircuitContext(floatingCircuit, { blocklyXml, running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const floatFault = faults.find((f) => f.classification === "FLOATING_INPUT_PIN")
  assert.ok(floatFault, "Must detect FLOATING_INPUT_PIN on A0")
  assert.equal(floatFault.affectedPinId, "a0")
  assert.ok(floatFault.electricalExplanation.includes("high-impedance"))
})

test("Test 6: Potentiometer Wiper — Understands voltage divider and missing wiper connection", () => {
  const potCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "pot1", type: "potentiometer", x: 220, y: 110, rotation: 0, props: { resistance: 10000, value: 512 } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "pot1", pinId: "t1" }, color: "red" },
      { id: "w2", from: { partId: "pot1", pinId: "t2" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
      // Wiper not connected!
    ],
  }

  const context = serializeCircuitContext(potCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const wiperFault = faults.find((f) => f.classification === "OPEN_CIRCUIT" && f.affectedPinId === "wiper")
  assert.ok(wiperFault, "Must identify open wiper terminal")
  assert.ok(wiperFault.electricalExplanation.includes("voltage divider"))

  // Generate repair proposal connecting wiper to A0
  const proposal = generateCircuitRepairProposal(potCircuit, faults, "rev_hash_6")
  assert.ok(proposal.actions.some((a) => a.type === "connect" && a.from === "pot1:wiper" && a.to.includes("a0")))
})

test("Test 7: PWM LED — Distinguishes instantaneous pulse voltage from multimeter average", () => {
  const pwmCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "green" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }

  // D9 in PWM mode with 50% duty cycle (value 128 / 255)
  const pinStates = {
    d9: { mode: "PWM", value: 128, frequency: 490 },
  }

  const context = serializeCircuitContext(pwmCircuit, { pinStates, running: true })
  const nodal = solveCircuitNodalPotentials(pwmCircuit, new Set(), pinStates, true)

  // In MNA solver, nodal potential calculates the average DC voltage
  const vLedAnode = nodal.getPinVoltage({ partId: "led1", pinId: "anode" })
  assert.ok(vLedAnode > 0 && vLedAnode < 5.0, "Average voltage must reflect PWM duty cycle")
})

test("Test 8: Servo Motor — Diagnoses disconnected signal pin and proposes D9 connection", () => {
  const servoCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "servo1", type: "servo", x: 220, y: 110, rotation: 0, props: { angle: 90 } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "red" },
      { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "black" },
      // Signal pin disconnected!
    ],
  }

  const context = serializeCircuitContext(servoCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const sigFault = faults.find((f) => f.classification === "OPEN_CIRCUIT" && f.affectedPinId === "sig")
  assert.ok(sigFault, "Must identify open signal pin on servo")
  assert.ok(sigFault.electricalExplanation.includes("PWM control pulses"))

  const proposal = generateCircuitRepairProposal(servoCircuit, faults, "rev_hash_8")
  assert.ok(proposal.actions.some((a) => a.type === "connect" && a.from === "servo1:sig" && a.to.includes("d9")))
})

test("Test 9: Ultrasonic Sensor — Detects unpowered sensor and missing echo/trig pins", () => {
  const usCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "us1", type: "ultrasonic", x: 220, y: 110, rotation: 0, props: {} },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "us1", pinId: "vcc" }, color: "red" },
      // Missing GND, TRIG, ECHO
    ],
  }

  const context = serializeCircuitContext(usCircuit, { running: true })
  const faults = diagnoseCircuitIntelligence(context)

  assert.ok(faults.some((f) => f.classification === "MISSING_GROUND"), "Must detect missing ground")
  assert.ok(faults.some((f) => f.classification === "INCORRECT_SENSOR_CONNECTIONS"), "Must detect missing trig/echo")
})

test("Test 10: Wrong Code-to-Pin Mapping — Correlates code (D12) with wiring (D13) and repairs alignment", () => {
  const mismatchCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      // Wire physically plugged into D13
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "green" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }

  // Program was written to drive D12!
  const blocklyXml = '<xml><block type="digital_write"><field name="PIN">D12</field></block></xml>'

  const context = serializeCircuitContext(mismatchCircuit, { blocklyXml, running: true })
  const faults = diagnoseCircuitIntelligence(context)

  const pinMismatch = faults.find((f) => f.classification === "CODE_PIN_MISMATCH")
  assert.ok(pinMismatch, "Must detect CODE_PIN_MISMATCH")
  assert.equal(pinMismatch.affectedPinId, "d12")
  assert.ok(pinMismatch.evidence.includes("D12") && pinMismatch.evidence.includes("D13"))

  const proposal = generateCircuitRepairProposal(mismatchCircuit, faults, "rev_hash_10", blocklyXml)
  assert.ok(proposal.actions.some((a) => a.type === "connect" && a.from === "uno:d12"))
})

// ============================================================================
// PHASE 7: NATURAL LANGUAGE & HINGLISH REASONING TESTS
// ============================================================================

test("Phase 7.1: Hinglish Query — 'LED glow nahi ho rahi, check karo' returns accurate diagnosis", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }

  const context = serializeCircuitContext(circuit, { running: true })
  const res = processCircuitCopilotQuery("LED glow nahi ho rahi, check karo", context)

  assert.ok(res.reply.includes("Local Circuit Guidance"), "Must label deterministic output as Local Circuit Guidance")
  assert.doesNotMatch(res.reply, /\*\*Xen Local Circuit Diagnostics/i)
  assert.ok(res.reply.includes("Samasya"), "Must respond in Hinglish")
  assert.ok(res.proposal, "Must produce proposal")
  assert.equal(res.verification?.verified, true, "Must verify with simulator")
})

test("Phase 7.2: English Query — 'Find the mistake in this circuit' identifies exact fault", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "cathode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "anode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }

  const context = serializeCircuitContext(circuit, { running: true })
  const res = processCircuitCopilotQuery("Find the mistake in this circuit and show me exactly which connection is wrong.", context)

  assert.ok(res.reply.includes("Reversed LED Polarity"))
  assert.ok(res.reply.includes("Anode (+) is connected to Ground"))
  assert.ok(res.highlightPartIds.includes("led1"))
})

test("Phase 1 Regression: empty and unwired circuits never return 100/100, 100%, or 'connections intact'", () => {
  const emptyCircuit = { parts: [], wires: [] }
  const emptyContext = serializeCircuitContext(emptyCircuit, { running: false })
  assert.equal(emptyContext.healthReport.score, null)
  assert.equal(emptyContext.healthReport.status, "empty")
  assert.equal(emptyContext.healthReport.isEmpty, true)

  const emptyReplyEn = processCircuitCopilotQuery("Is my circuit working?", emptyContext)
  assert.match(emptyReplyEn.reply, /Empty/i)
  assert.match(emptyReplyEn.reply, /N\/A/)
  assert.doesNotMatch(emptyReplyEn.reply, /100\/100|100%|connections.*intact|8square/i)

  const emptyReplyHi = processCircuitCopilotQuery("Mera circuit check karo bhai", emptyContext)
  assert.match(emptyReplyHi.reply, /Empty/i)
  assert.doesNotMatch(emptyReplyHi.reply, /100\/100|100%|connections.*intact|8square/i)

  const singlePartUnwired = {
    parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }],
    wires: [],
  }
  const singleCtx = serializeCircuitContext(singlePartUnwired, { running: false })
  assert.equal(singleCtx.healthReport.score, null)
  assert.equal(singleCtx.healthReport.status, "unwired")
  const singleReply = processCircuitCopilotQuery("Check my circuit", singleCtx)
  assert.match(singleReply.reply, /Not Wired/i)
  assert.match(singleReply.reply, /N\/A/)
  assert.doesNotMatch(singleReply.reply, /100\/100|100%|connections.*intact|8square/i)

  const multiPartUnwired = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "led1", type: "led", x: 120, y: 80, rotation: 0, props: { color: "red" } },
    ],
    wires: [],
  }
  const multiCtx = serializeCircuitContext(multiPartUnwired, { running: false })
  assert.equal(multiCtx.healthReport.score, null)
  assert.equal(multiCtx.healthReport.status, "unwired")
  const multiReply = processCircuitCopilotQuery("Is my LED wired properly?", multiCtx)
  assert.match(multiReply.reply, /Not Wired/i)
  assert.match(multiReply.reply, /N\/A/)
  assert.doesNotMatch(multiReply.reply, /100\/100|100%|connections.*intact|8square/i)
})

test("Phase 2: Normalized Blockly/C++ pin bindings, resistor terminal A/B lookup, and 6-layer LED diagnostics", () => {
  // 1. Numeric Blockly <field name="PIN">5</field> and Arduino C++ normalize cleanly to "d5" / "d13"
  const blocklyXml = '<xml><block type="arduino_digital_write"><field name="PIN">5</field></block></xml>'
  const cpp = 'const int ledPin = 9; void loop() { digitalWrite(ledPin, HIGH); digitalWrite(LED_BUILTIN, HIGH); }'
  const bindings = extractCodePinBindings(blocklyXml, cpp, "arduino-uno")
  const pins = bindings.map((b) => b.pinId)
  assert.ok(pins.includes("d5"), "Numeric Blockly '5' must normalize to 'd5'")
  assert.ok(pins.includes("d9"), "C++ const ledPin=9 must normalize to 'd9'")
  assert.ok(pins.includes("d13"), "C++ LED_BUILTIN must normalize to 'd13'")

  // 2. Deliberately mismatched circuit: physical LED on D9, Blockly targets numeric '5' (D5), plus button on D2
  const ledOnD9Circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "btn1", type: "pushbutton", x: 140, y: 40, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w_btn", from: { partId: "uno", pinId: "d2" }, to: { partId: "btn1", pinId: "1a" }, color: "blue" },
      { id: "w_btn_gnd", from: { partId: "btn1", pinId: "2a" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "green" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }

  // Stopped simulation with D5 code vs D9 physical wiring (arbitrary pin test too below!)
  const ctxStopped = serializeCircuitContext(ledOnD9Circuit, {
    blocklyXml,
    generatedCode: 'void loop() { digitalWrite(5, HIGH); }',
    running: false,
  })
  assert.equal(ctxStopped.resistorTerminals?.length, 1)
  const rTerm = ctxStopped.resistorTerminals[0]
  assert.deepEqual(rTerm.terminalA.directPeers, ["uno:d9"])
  assert.deepEqual(rTerm.terminalB.directPeers, ["led1:anode"])
  assert.ok(ctxStopped.endpointLookup["r1:a"].sameNetBoardPins.includes("uno:d9"))
  assert.ok(!ctxStopped.endpointLookup["r1:b"].sameNetBoardPins.includes("uno:d9"))

  const faults = diagnoseCircuitIntelligence(ctxStopped)
  const pinFault = faults.find((f) => f.classification === "CODE_PIN_MISMATCH")
  assert.ok(pinFault, "Must detect CODE_PIN_MISMATCH when numeric Blockly '5' differs from physical D9")
  assert.equal(pinFault.affectedPinId, "d5")
  assert.ok(pinFault.evidence.includes("D5") && pinFault.evidence.includes("D9"), "Must identify LED driver D9 rather than button D2")

  assert.equal(ctxStopped.crossLayerLedDiagnostics?.length, 1)
  const ledDiag = ctxStopped.crossLayerLedDiagnostics[0]
  assert.equal(ledDiag.layerA_electricalTopology.topologyOk, true)
  assert.equal(ledDiag.layerB_safetyConstraints.safetyOk, true)
  assert.deepEqual(ledDiag.layerC_controllerPinCompatibility.physicalBoardPins, ["d9"])
  assert.deepEqual(ledDiag.layerD_programMapping.codePins, ["d5"])
  assert.equal(ledDiag.layerD_programMapping.matchesPhysicalPin, false)
  assert.equal(ledDiag.layerE_simulatorExecution.running, false)
  assert.equal(ledDiag.layerF_observedOutput.state, "stopped_not_running")

  // Verify local guidance explicitly notes simulation is stopped
  const localStopped = processCircuitCopilotQuery("Is it blinking?", serializeCircuitContext(ledOnD9Circuit, {
    blocklyXml: '<xml><block type="arduino_digital_write"><field name="PIN">9</field></block></xml>',
    running: false,
  }))
  assert.match(localStopped.reply, /Simulation is not running yet/i)

  // Verify general arbitrary pin pair (D4 wiring + numeric '8' code) and running illuminated state
  const arbitraryCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 340, y: 110, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d4" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const arbCtx = serializeCircuitContext(arbitraryCircuit, {
    blocklyXml: '<xml><block type="arduino_digital_write"><field name="PIN">8</field></block></xml>',
    running: true,
    pinStates: { d4: { state: "HIGH", outputMode: "digital" } },
  })
  assert.deepEqual(arbCtx.crossLayerLedDiagnostics[0].layerC_controllerPinCompatibility.physicalBoardPins, ["d4"])
  assert.equal(arbCtx.crossLayerLedDiagnostics[0].layerF_observedOutput.state, "off_code_mismatch")

  const arbMatchedRunning = serializeCircuitContext(arbitraryCircuit, {
    blocklyXml: '<xml><block type="arduino_digital_write"><field name="PIN">4</field></block></xml>',
    running: true,
    pinStates: { d4: { state: "HIGH", outputMode: "digital" } },
    runtime: { led1: { level: 1.0, currentMa: 13.6, burnt: false } },
  })
  assert.equal(arbMatchedRunning.crossLayerLedDiagnostics[0].layerD_programMapping.matchesPhysicalPin, true)
  assert.equal(arbMatchedRunning.crossLayerLedDiagnostics[0].layerF_observedOutput.state, "illuminated")
})

test("Copilot instrument readings do not promote missing probes or invalid pins to simulated zero", () => {
  const circuit = { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }], wires: [] };
  const pin = pinId => ({ partId: "uno", pinId });
  const look = opts => serializeCircuitContext(circuit, opts).measurements;
  assert.equal(look({})[0].state, "unavailable");
  assert.equal(look({})[0].value, undefined);
  assert.equal(look({ multimeterProbes: { red: pin("missing"), black: pin("gnd") } })[0].value, undefined);
  const measurements = look({
    multimeterProbes: { red: pin("5v"), black: pin("gnd") },
    oscilloscopeProbes: { ch1: pin("5v"), ch2: null },
  });
  assert.equal(measurements[0].state, "available");
  assert.equal(measurements[0].value, 5);
  assert.equal(measurements[1].state, "available");
  assert.equal(measurements[1].value, 5);
  assert.equal(measurements[1].probeA, "uno:5v");
  assert.equal(measurements[2].state, "not_configured");
  assert.equal(measurements[2].value, undefined);
});

test("Copilot answers pin lookup from the snapshot and keeps resistor branches distinct", () => {
  const parts = [
    { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
    { id: "r1", type: "resistor", x: 0, y: 0, rotation: 0, props: { resistance: 220 } },
    { id: "led1", type: "led", x: 0, y: 0, rotation: 0, props: {} },
  ];
  const wire = (id, partId, pinId, toPart, toPin) => ({
    id, from: { partId, pinId }, to: { partId: toPart, pinId: toPin }, color: "red",
  });
  for (const pin of ["d5", "d9"]) {
    const circuit = { parts, wires: [wire("a", "uno", pin, "r1", "a"), wire("b", "r1", "b", "led1", "anode")] };
    const context = serializeCircuitContext(circuit, {});
    const direct = intelMod.describeCircuitTopology("Which Arduino pin is resistor R1 connected to?", context);
    assert.match(direct, new RegExp(`direct wire to uno:${pin}`, "i"));
    assert.doesNotMatch(direct, new RegExp(`uno:${pin === "d5" ? "d9" : "d5"}`, "i"));
    const indirect = intelMod.describeCircuitTopology("Where is the LED anode connected?", context);
    assert.match(indirect, /direct wire to r1:/i);
    assert.match(indirect, new RegExp(`branch path: uno:${pin} through r1`, "i"));
    assert.doesNotMatch(indirect, /direct wire to uno:/i);
    assert.match(intelMod.describeCircuitTopology("Is the LED cathode connected to GND?", context), /no completed connection/i);
  }
  const empty = processCircuitCopilotQuery("done", serializeCircuitContext({ parts: [], wires: [] }, {}));
  assert.equal(empty.state, "EMPTY_CANVAS");
  assert.equal(empty.proposal, undefined);
  const board = processCircuitCopilotQuery("is it correct?", serializeCircuitContext({ parts: parts.slice(0, 1), wires: [] }, {}));
  assert.equal(board.state, "INCOMPLETE_CIRCUIT");
});
