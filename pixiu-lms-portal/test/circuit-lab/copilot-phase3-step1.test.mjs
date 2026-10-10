import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `copilot-phase3-step1-hardened-test-${Date.now()}`)

await build({
  entryPoints: {
    adapter: new URL("../../src/lib/ai/copilot/model-adapter.ts", import.meta.url).pathname,
    schema: new URL("../../src/lib/ai/copilot/proposal-schema.ts", import.meta.url).pathname,
    router: new URL("../../src/lib/ai/copilot/task-router.ts", import.meta.url).pathname,
    gate: new URL("../../src/lib/ai/copilot/proposal-gate.ts", import.meta.url).pathname,
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const adapterMod = await import(`file://${join(bundleDir, "adapter.js")}`)
const schemaMod = await import(`file://${join(bundleDir, "schema.js")}`)
const routerMod = await import(`file://${join(bundleDir, "router.js")}`)
const gateMod = await import(`file://${join(bundleDir, "gate.js")}`)
const validatorMod = await import(`file://${join(bundleDir, "validator.js")}`)

const { DeterministicStubAdapter } = adapterMod
const { parseProposalPayload, extractCleanJsonString, SUPPORTED_TASK_FAMILIES } = schemaMod
const { routeUserRequest, SUPPORTED_BOARDS } = routerMod
const { evaluateProposalGate } = gateMod
const { validateProposedCircuit } = validatorMod

// ============================================================================
// SUBPHASE 3.0: Data Readiness & Experiment Lock
// ============================================================================

test("P3-0: Phase 3 experiment manifest locks Phase 2 checksum and provisional baseline status", () => {
  const root = resolve(new URL("../../..", import.meta.url).pathname)
  const expPath = resolve(root, "data/ai-copilot/phase3/experiment.json")
  assert.ok(existsSync(expPath), "data/ai-copilot/phase3/experiment.json must exist")

  const exp = JSON.parse(readFileSync(expPath, "utf8"))
  assert.equal(exp.phase2_data_readiness.dataset_version, "2.0.0")
  assert.equal(exp.phase2_data_readiness.status, "PROVISIONAL_INTERNAL_BASELINE")
  assert.equal(exp.phase2_data_readiness.locked_split_counts.train, 516)
  assert.equal(exp.phase2_data_readiness.locked_split_counts.validation, 146)
  assert.equal(exp.phase2_data_readiness.locked_split_counts.test, 134)

  const manifestPath = resolve(root, exp.phase2_data_readiness.manifest_path)
  const manifestContent = readFileSync(manifestPath, "utf8")
  const actualHash = createHash("sha256").update(manifestContent).digest("hex")
  assert.equal(exp.phase2_data_readiness.manifest_sha256, actualHash, "Manifest sha256 checksum must match live Phase 2 manifest")

  const manifestJson = JSON.parse(manifestContent)
  assert.equal(exp.phase2_data_readiness.manifest_commit_sha, manifestJson.commit_sha)
})

// ============================================================================
// SUBPHASE 3.1: Contract Fit
// ============================================================================

test("P3-1: Live circuit validator is reusable without duplicate schema", () => {
  assert.equal(typeof validateProposedCircuit, "function")
  const empty = { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }], wires: [] }
  const res = validateProposedCircuit(empty)
  assert.equal(res.valid, true)
})

// ============================================================================
// SUBPHASE 3.2: Multi-Board Baseline Model Adapter
// ============================================================================

test("P3-2: Adapter generates valid proposals across ALL 4 supported boards", async () => {
  const adapter = new DeterministicStubAdapter()
  const boards = ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"]

  for (const board of boards) {
    // 1. LED Control
    const ledRes = await adapter.generateProposal({
      requestId: `test-led-${board}`,
      prompt: `Blink LED on ${board}`,
      context: { targetBoard: board },
    })
    assert.equal(ledRes.success, true)
    const ledParsed = parseProposalPayload(ledRes.rawOutput)
    assert.equal(ledParsed.valid, true, `LED on ${board} must produce valid proposal schema`)
    const ledGate = evaluateProposalGate(ledParsed.payload, { currentBoard: board })
    assert.equal(ledGate.passed, true, `LED on ${board} must pass gate cleanly: ${ledGate.errors.join(", ")}`)

    // 2. LDR Lighting
    const ldrRes = await adapter.generateProposal({
      requestId: `test-ldr-${board}`,
      prompt: `Automatic light with LDR on ${board}`,
      context: { targetBoard: board },
    })
    assert.equal(ldrRes.success, true)
    const ldrParsed = parseProposalPayload(ldrRes.rawOutput)
    assert.equal(ldrParsed.valid, true, `LDR on ${board} must produce valid proposal schema`)
    const ldrGate = evaluateProposalGate(ldrParsed.payload, { currentBoard: board })
    assert.equal(ldrGate.passed, true, `LDR on ${board} must pass gate cleanly: ${ldrGate.errors.join(", ")}`)

    // 3. Ultrasonic Alert
    const usRes = await adapter.generateProposal({
      requestId: `test-us-${board}`,
      prompt: `Ultrasonic distance alert on ${board}`,
      context: { targetBoard: board },
    })
    assert.equal(usRes.success, true)
    const usParsed = parseProposalPayload(usRes.rawOutput)
    assert.equal(usParsed.valid, true, `Ultrasonic on ${board} must produce valid proposal schema`)
    const usGate = evaluateProposalGate(usParsed.payload, { currentBoard: board })
    assert.equal(usGate.passed, true, `Ultrasonic on ${board} must pass gate cleanly: ${usGate.errors.join(", ")}`)

    // 4. Servo Control
    const servoRes = await adapter.generateProposal({
      requestId: `test-servo-${board}`,
      prompt: `Rotate servo 90 degrees on ${board}`,
      context: { targetBoard: board },
    })
    assert.equal(servoRes.success, true)
    const servoParsed = parseProposalPayload(servoRes.rawOutput)
    assert.equal(servoParsed.valid, true, `Servo on ${board} must produce valid proposal schema`)
    const servoGate = evaluateProposalGate(servoParsed.payload, { currentBoard: board })
    assert.equal(servoGate.passed, true, `Servo on ${board} must pass gate cleanly: ${servoGate.errors.join(", ")}`)
  }
})

test("P3-2: Adapter handles timeout, rate limit, provider error and malformed scenarios", async () => {
  const adapter = new DeterministicStubAdapter()

  // Timeout
  const timeoutRes = await adapter.generateProposal(
    { requestId: "req-timeout", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { simulateScenario: "timeout", timeoutMs: 50 }
  )
  assert.equal(timeoutRes.success, false)
  assert.equal(timeoutRes.error?.code, "TIMEOUT")

  // Rate Limit
  const rateLimitRes = await adapter.generateProposal(
    { requestId: "req-rate", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { simulateScenario: "rate_limit" }
  )
  assert.equal(rateLimitRes.success, false)
  assert.equal(rateLimitRes.error?.code, "RATE_LIMIT")

  // Provider Error
  const providerErrRes = await adapter.generateProposal(
    { requestId: "req-500", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { simulateScenario: "provider_error" }
  )
  assert.equal(providerErrRes.success, false)
  assert.equal(providerErrRes.error?.code, "PROVIDER_ERROR")

  // Empty response
  const emptyRes = await adapter.generateProposal(
    { requestId: "req-empty", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { simulateScenario: "empty" }
  )
  assert.equal(emptyRes.success, false)
  assert.equal(emptyRes.error?.code, "EMPTY")

  // Malformed output handled safely by parser
  const malformedRes = await adapter.generateProposal(
    { requestId: "req-malformed", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { simulateScenario: "malformed" }
  )
  assert.equal(malformedRes.success, true)
  const parseRes = parseProposalPayload(malformedRes.rawOutput)
  assert.equal(parseRes.valid, false)
  assert.ok(parseRes.errors[0].includes("Malformed JSON"))
})

// ============================================================================
// SUBPHASE 3.3: Narrow Task Router & Intent Coverage
// ============================================================================

test("P3-3: Router accurately routes English, Hinglish, and colloquial prompts to 4 task families", () => {
  // LED
  const ledEn = routeUserRequest("Blink an LED on Arduino Uno pin 13")
  assert.equal(ledEn.route, "led_control")
  const ledHi = routeUserRequest("uno me led blink kar do digital pin pe")
  assert.equal(ledHi.route, "led_control")

  // LDR
  const ldrEn = routeUserRequest("Make an automatic nightlight with LDR and light sensor")
  assert.equal(ldrEn.route, "ldr_lighting")
  const ldrHi = routeUserRequest("andhere me automatic light on karne wala circuit ldr ke sath")
  assert.equal(ldrHi.route, "ldr_lighting")

  // Ultrasonic
  const usEn = routeUserRequest("Sonar distance obstacle detector with buzzer alert")
  assert.equal(usEn.route, "ultrasonic_alert")
  const usHi = routeUserRequest("ultrasonic doori sensor se buzzer bajao jab koi pass aaye")
  assert.equal(usHi.route, "ultrasonic_alert")

  // Servo
  const servoEn = routeUserRequest("Rotate servo motor to 90 degrees on PWM pin")
  assert.equal(servoEn.route, "servo_control")
  const servoHi = routeUserRequest("servo motor ka angle 90 degree ghuma do")
  assert.equal(servoHi.route, "servo_control")
})

test("P3-3: Router rejects unsafe high-voltage mains AC requests", () => {
  const mains = routeUserRequest("Connect 220V mains socket to light bulb")
  assert.equal(mains.route, "unsupported")
  assert.ok(mains.riskFlags.includes("HIGH_VOLTAGE_MAINS_SAFETY_VIOLATION"))
})

test("P3-3: Router asks clarification for underspecified requests and rejects unsupported boards", () => {
  const vague = routeUserRequest("help bana do")
  assert.equal(vague.route, "needs_clarification")
  assert.ok(vague.missingContext.includes("task_goal"))

  const badBoard = routeUserRequest("Blink LED", { targetBoard: "stm32f4" })
  assert.equal(badBoard.route, "unsupported")
  assert.ok(badBoard.riskFlags.includes("UNSUPPORTED_BOARD"))
})

// ============================================================================
// SUBPHASE 3.4: Proposal Schema Strictness
// ============================================================================

test("P3-4: Strict parser systematically rejects extra keys and invalid enums", () => {
  const baseValid = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "LED Blink",
    assumptions: ["Uno pin 13"],
    needs_clarification: [],
    proposal: {
      circuit: { parts: [], wires: [] },
      code: null,
      explanation: "Safe circuit",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  // 1. Extra top-level key rejected
  const extraRoot = { ...baseValid, injected_root_key: "danger" }
  const resExtraRoot = parseProposalPayload(extraRoot)
  assert.equal(resExtraRoot.valid, false)
  assert.ok(resExtraRoot.errors.some((e) => e.includes("Disallowed extra property in proposal root")))

  // 2. Extra key inside proposal rejected
  const extraProp = { ...baseValid, proposal: { ...baseValid.proposal, extra_action: "delete_files" } }
  const resExtraProp = parseProposalPayload(extraProp)
  assert.equal(resExtraProp.valid, false)
  assert.ok(resExtraProp.errors.some((e) => e.includes("Disallowed extra property in proposal")))

  // 3. Extra key inside capabilities rejected
  const extraCaps = { ...baseValid, capabilities: { ...baseValid.capabilities, extra_cap: "superpower" } }
  const resExtraCaps = parseProposalPayload(extraCaps)
  assert.equal(resExtraCaps.valid, false)
  assert.ok(resExtraCaps.errors.some((e) => e.includes("Disallowed extra property in capabilities")))

  // 4. Invalid capability status rejected
  const badCapStatus = {
    ...baseValid,
    capabilities: { ...baseValid.capabilities, simulation: "magic_unverified" },
  }
  const resBadCap = parseProposalPayload(badCapStatus)
  assert.equal(resBadCap.valid, false)
  assert.ok(resBadCap.errors.some((e) => e.includes("Invalid capabilities.simulation status")))

  // 5. Non-string assumption item rejected
  const badAssumption = { ...baseValid, assumptions: [12345] }
  const resBadAssump = parseProposalPayload(badAssumption)
  assert.equal(resBadAssump.valid, false)
  assert.ok(resBadAssump.errors.some((e) => e.includes("must be a non-empty string")))
})

// ============================================================================
// SUBPHASE 3.5: Deterministic Validation & Deep Wiring Policy Gates
// ============================================================================

test("P3-5: Gate blocks floating/disconnected resistor in LED circuit", () => {
  // LED present and resistor present, but resistor is NOT in series with LED
  const floatingResistorLed = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Floating Resistor Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "led1", type: "led", x: 100, y: 0, rotation: 0, props: {} },
          { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 220 } },
        ],
        wires: [
          // LED connected directly without resistor
          { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "led1", pinId: "anode" } },
          { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" } },
          // Resistor is floating!
        ],
      },
      code: null,
      explanation: "LED without series resistor connection",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(floatingResistorLed, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_DISCONNECTED_LED_RESISTOR"))
})

test("P3-5: Gate blocks LDR circuit with disconnected voltage divider", () => {
  const disconnectedDividerLdr = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ldr_lighting",
    summary: "Disconnected Divider Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "ldr1", type: "ldr", x: 100, y: 0, rotation: 0, props: {} },
          { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 10000 } },
        ],
        wires: [
          // LDR connected between 5V and GND without forming midpoint with resistor
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "ldr1", pinId: "a" } },
          { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" } },
          // Resistor is floating!
        ],
      },
      code: null,
      explanation: "LDR without divider",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(disconnectedDividerLdr, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_DISCONNECTED_DIVIDER"))
})

test("P3-5: Gate blocks ultrasonic sensor with missing/unconnected pins", () => {
  const missingPinsSonar = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Unconnected Ultrasonic Pins Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          // Only VCC and GND wired; Trig and Echo left unconnected!
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" } },
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" } },
        ],
      },
      code: null,
      explanation: "Sonar missing trigger and echo wires",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(missingPinsSonar, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_UNCONNECTED_ULTRASONIC_PIN"))
})

test("P3-5: Gate blocks servo with unconnected control or power terminals", () => {
  const unconnectedServo = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "Unconnected Servo Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          // Only VCC wired; signal and ground missing!
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
        ],
      },
      code: null,
      explanation: "Servo missing wires",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(unconnectedServo, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_UNCONNECTED_SERVO_PIN"))
})

test("P3-5: Critical Safety Invariant — Direct 5V-to-GND dead short CANNOT pass Apply gate", () => {
  const deadShortProposal = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Dead Short Hazard",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }],
        wires: [
          { id: "w_short", from: { partId: "uno", pinId: "5v" }, to: { partId: "uno", pinId: "gnd" }, color: "#ef4444" },
        ],
      },
      code: null,
      explanation: "Direct short danger",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(deadShortProposal, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canPreview, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("ELECTRICAL_SHORT_CIRCUIT"))
})
