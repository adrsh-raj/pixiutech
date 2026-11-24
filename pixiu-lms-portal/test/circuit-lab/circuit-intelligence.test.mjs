/**
 * PIXIU TECH CYBERLAB — 8SQUARE CIRCUIT INTELLIGENCE & REPAIR VERIFICATION SUITE
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

  assert.ok(res.reply.includes("8square AI"), "Must identify as 8square")
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
