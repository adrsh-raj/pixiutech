import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `copilot-phase3-step1-test-${Date.now()}`)

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

test("P3-0: Phase 3 experiment manifest exists and locks Phase 2 dataset checksum", () => {
  const root = resolve(new URL("../../..", import.meta.url).pathname)
  const expPath = resolve(root, "data/ai-copilot/phase3/experiment.json")
  assert.ok(existsSync(expPath), "data/ai-copilot/phase3/experiment.json must exist")

  const exp = JSON.parse(readFileSync(expPath, "utf8"))
  assert.equal(exp.phase2_data_readiness.dataset_version, "2.0.0")
  assert.equal(exp.phase2_data_readiness.locked_split_counts.train, 516)
  assert.equal(exp.phase2_data_readiness.locked_split_counts.validation, 146)
  assert.equal(exp.phase2_data_readiness.locked_split_counts.test, 134)

  const manifestPath = resolve(root, exp.phase2_data_readiness.manifest_path)
  const manifestContent = readFileSync(manifestPath, "utf8")
  const actualHash = createHash("sha256").update(manifestContent).digest("hex")
  assert.equal(exp.phase2_data_readiness.manifest_sha256, actualHash, "Manifest sha256 checksum must match live Phase 2 manifest")
})

// ============================================================================
// SUBPHASE 3.1: Contract Fit
// ============================================================================

test("P3-1: Live circuit validator is reusable without duplicate schema", () => {
  assert.equal(typeof validateProposedCircuit, "function")
  // Simple check that live validator works on minimal circuit
  const empty = { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }], wires: [] }
  const res = validateProposedCircuit(empty)
  assert.equal(res.valid, true)
})

// ============================================================================
// SUBPHASE 3.2: Baseline Model Adapter Robustness
// ============================================================================

test("P3-2: DeterministicStubAdapter generates valid proposals for all 4 task families", async () => {
  const adapter = new DeterministicStubAdapter()

  const tasks = [
    { prompt: "Blink an LED on Arduino Uno Pin 13", expectedTask: "led_control" },
    { prompt: "Automatic nightlight with LDR light sensor", expectedTask: "ldr_lighting" },
    { prompt: "Ultrasonic distance alert with buzzer", expectedTask: "ultrasonic_alert" },
    { prompt: "Move servo to 90 degrees", expectedTask: "servo_control" },
  ]

  for (const t of tasks) {
    const res = await adapter.generateProposal({
      requestId: `test-${t.expectedTask}`,
      prompt: t.prompt,
      context: { targetBoard: "arduino-uno" },
    })

    assert.equal(res.success, true)
    assert.ok(res.rawOutput.length > 0)
    assert.equal(res.metadata.provider, "deterministic-stub")
    assert.equal(res.metadata.model, "pixiu-baseline-qwen3-4b")

    const parsed = parseProposalPayload(res.rawOutput)
    assert.equal(parsed.valid, true)
    assert.equal(parsed.payload?.task_type, t.expectedTask)
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
// SUBPHASE 3.4: Proposal Schema & Strict Parser
// ============================================================================

test("P3-4: Parser handles code blocks and rejects schema violations", () => {
  const validEnvelope = {
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

  // Wrapped in markdown code fence
  const markdownJson = "```json\n" + JSON.stringify(validEnvelope) + "\n```"
  const parsed = parseProposalPayload(markdownJson)
  assert.equal(parsed.valid, true)
  assert.equal(parsed.payload?.summary, "LED Blink")

  // Wrong schema_version
  const badVersion = { ...validEnvelope, schema_version: "v2-invalid" }
  const badVerRes = parseProposalPayload(badVersion)
  assert.equal(badVerRes.valid, false)
  assert.ok(badVerRes.errors.some((e) => e.includes("schema_version")))

  // Unsupported task_type
  const badTask = { ...validEnvelope, task_type: "nuclear_reactor" }
  const badTaskRes = parseProposalPayload(badTask)
  assert.equal(badTaskRes.valid, false)
  assert.ok(badTaskRes.errors.some((e) => e.includes("Unsupported task_type")))
})

// ============================================================================
// SUBPHASE 3.5: Deterministic Validation & Policy Gate
// ============================================================================

test("P3-5: Gate passes clean calibrated LED proposal", () => {
  const adapter = new DeterministicStubAdapter()
  const cleanLed = adapter["buildLedProposal"]("arduino-uno")

  const gateResult = evaluateProposalGate(cleanLed, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, true)
  assert.equal(gateResult.canPreview, true)
  assert.equal(gateResult.canApply, true)
  assert.equal(gateResult.errors.length, 0)
})

test("P3-5: Gate blocks LED proposal missing current-limiting resistor", () => {
  const adapter = new DeterministicStubAdapter()
  const rawLed = adapter["buildLedProposal"]("arduino-uno")
  // Strip resistor
  const nakedLed = structuredClone(rawLed)
  nakedLed.proposal.circuit.parts = nakedLed.proposal.circuit.parts.filter((p) => p.type !== "resistor")

  const gateResult = evaluateProposalGate(nakedLed, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canPreview, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_MISSING_LED_RESISTOR"))
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
  assert.ok(gateResult.diagnosticCodes.some((code) => /short/i.test(code)))
})

test("P3-5: Gate blocks ultrasonic proposal with trigger and echo sharing same pin", () => {
  const conflictingUltrasonic = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Conflicting Pins Sonar",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" } },
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w_trig", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w_echo", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "echo" } }, // Pin conflict!
        ],
      },
      code: null,
      explanation: "Conflicting trigger/echo pins",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(conflictingUltrasonic, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canPreview, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_PIN_CONFLICT"))
})
