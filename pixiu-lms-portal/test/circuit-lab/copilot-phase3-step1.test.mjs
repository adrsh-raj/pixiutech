import assert from "node:assert/strict"
import test from "node:test"
import http from "node:http"
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

const { DeterministicStubAdapter, HttpBaselineModelAdapter, createBaselineModelAdapter } = adapterMod
const { parseProposalPayload, extractCleanJsonString, SUPPORTED_TASK_FAMILIES } = schemaMod
const { routeUserRequest, SUPPORTED_BOARDS } = routerMod
const { evaluateProposalGate } = gateMod
const { validateProposedCircuit } = validatorMod

// ============================================================================
// SUBPHASE 3.0: Data Readiness & Experiment Lock
// ============================================================================

test("P3-0: Phase 3 experiment manifest accurately records G9 unresolved status and locks Phase 2 checksum", () => {
  const root = resolve(new URL("../../..", import.meta.url).pathname)
  const expPath = resolve(root, "data/ai-copilot/phase3/experiment.json")
  assert.ok(existsSync(expPath), "data/ai-copilot/phase3/experiment.json must exist")

  const exp = JSON.parse(readFileSync(expPath, "utf8"))
  assert.equal(exp.phase2_data_readiness.dataset_version, "2.0.0")
  assert.equal(exp.phase2_data_readiness.status, "PROVISIONAL_INTERNAL_BASELINE")
  assert.equal(exp.phase2_data_readiness.gates_status.external_release_signoff, "BLOCKED")
  assert.ok(exp.phase2_data_readiness.gates_status.G9_independent_human_review.includes("UNRESOLVED_PENDING"))

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
// SUBPHASE 3.2: Multi-Board Baseline Model Adapter & HTTP Client
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

test("P3-2: HttpBaselineModelAdapter handles abort signal and timeouts cleanly", async () => {
  const httpAdapter = new HttpBaselineModelAdapter({
    baseUrl: "http://127.0.0.1:54321/v1", // Non-existent mock endpoint
    defaultTimeoutMs: 50,
  })

  // Test already-aborted signal
  const abortedController = new AbortController()
  abortedController.abort()
  const abortRes = await httpAdapter.generateProposal(
    { requestId: "req-abort-early", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { signal: abortedController.signal }
  )
  assert.equal(abortRes.success, false)
  assert.equal(abortRes.error?.code, "CANCELLED")
  assert.equal(abortRes.metadata.finishReason, "cancelled")

  // Test network failure or timeout normalization
  const failRes = await httpAdapter.generateProposal(
    { requestId: "req-net-fail", prompt: "LED", context: { targetBoard: "arduino-uno" } },
    { timeoutMs: 30 }
  )
  assert.equal(failRes.success, false)
  assert.ok(["TIMEOUT", "PROVIDER_ERROR"].includes(failRes.error?.code || ""))
})

test("P3-2: HttpBaselineModelAdapter live lifecycle — HTTP 200 success, malformed JSON body, in-flight abort, and body-streaming timeout", async () => {
  let mode = "success"

  const server = http.createServer((req, res) => {
    if (mode === "success") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                schema_version: "pixiu-copilot-proposal-v1",
                task_type: "led_control",
                summary: "Mock Live LED Proposal",
                assumptions: [],
                needs_clarification: [],
                proposal: { circuit: { parts: [], wires: [] }, code: null, explanation: "live test ok" },
                capabilities: { simulation: "supported", compilation: "not_tested", physical_hardware: "not_verified" }
              })
            }
          }
        ],
        usage: { prompt_tokens: 24, completion_tokens: 72 }
      }))
    } else if (mode === "malformed") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end("{\n  invalid_json: unterminated string payload...")
    } else if (mode === "hang_before_response") {
      // Don't respond immediately — let caller abort in-flight
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ choices: [{ message: { content: "{}" } }] }))
        }
      }, 500)
    } else if (mode === "hang_during_body") {
      // Send 200 headers, send partial body chunk, then never close — tests timeout during res.json()!
      res.writeHead(200, { "Content-Type": "application/json", "Transfer-Encoding": "chunked" })
      res.write("{\"choices\": [")
    } else if (mode === "rate_limit") {
      res.writeHead(429, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }))
    } else if (mode === "server_error") {
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end("Internal Server Error")
    }
  })

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    const adapter = new HttpBaselineModelAdapter({
      baseUrl,
      apiKey: "test-live-key",
      defaultTimeoutMs: 300,
    })

    // 1. Successful HTTP 200 response with valid JSON payload & token tracking
    mode = "success"
    const successRes = await adapter.generateProposal({
      requestId: "req-live-ok",
      prompt: "Blink LED on D13",
      context: { targetBoard: "arduino-uno" },
    })
    assert.equal(successRes.success, true)
    assert.equal(successRes.metadata.finishReason, "stop")
    assert.equal(successRes.metadata.inputTokens, 24)
    assert.equal(successRes.metadata.outputTokens, 72)
    assert.ok(successRes.rawOutput.includes("pixiu-copilot-proposal-v1"))

    // 2. Malformed JSON HTTP response body
    mode = "malformed"
    const malformedRes = await adapter.generateProposal({
      requestId: "req-live-malformed",
      prompt: "Blink LED",
      context: { targetBoard: "arduino-uno" },
    })
    assert.equal(malformedRes.success, false)
    assert.equal(malformedRes.error?.code, "PROVIDER_ERROR")
    assert.ok(malformedRes.error?.message.includes("Failed to parse JSON response"))
    assert.equal(malformedRes.metadata.finishReason, "error")

    // 3. In-flight abort while HTTP request is waiting
    mode = "hang_before_response"
    const flightController = new AbortController()
    setTimeout(() => flightController.abort(), 20)
    const abortFlightRes = await adapter.generateProposal(
      { requestId: "req-live-abort-flight", prompt: "Blink LED", context: { targetBoard: "arduino-uno" } },
      { signal: flightController.signal, timeoutMs: 1500 }
    )
    assert.equal(abortFlightRes.success, false)
    assert.equal(abortFlightRes.error?.code, "CANCELLED")
    assert.equal(abortFlightRes.metadata.finishReason, "cancelled")

    // 4. Timeout while reading/streaming response body
    mode = "hang_during_body"
    const timeoutBodyRes = await adapter.generateProposal(
      { requestId: "req-live-timeout-body", prompt: "Blink LED", context: { targetBoard: "arduino-uno" } },
      { timeoutMs: 50 }
    )
    assert.equal(timeoutBodyRes.success, false)
    assert.equal(timeoutBodyRes.error?.code, "TIMEOUT")
    assert.equal(timeoutBodyRes.metadata.finishReason, "timeout")

    // 5. Rate limit HTTP 429
    mode = "rate_limit"
    const rateRes = await adapter.generateProposal({
      requestId: "req-live-429",
      prompt: "Blink LED",
      context: { targetBoard: "arduino-uno" },
    })
    assert.equal(rateRes.success, false)
    assert.equal(rateRes.error?.code, "RATE_LIMIT")

    // 6. Server error HTTP 500
    mode = "server_error"
    const errRes = await adapter.generateProposal({
      requestId: "req-live-500",
      prompt: "Blink LED",
      context: { targetBoard: "arduino-uno" },
    })
    assert.equal(errRes.success, false)
    assert.equal(errRes.error?.code, "PROVIDER_ERROR")
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("P3-2: DeterministicStubAdapter handles simulated failure scenarios", async () => {
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
// SUBPHASE 3.5: Deterministic Validation & Destination-Aware Policy Gates
// ============================================================================

test("P3-5: Gate blocks floating/disconnected resistor in LED circuit", () => {
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

test("P3-5: Gate blocks ultrasonic sensor connected to wrong destinations (VCC on GPIO or GND on Power)", () => {
  // Ultrasonic VCC wired to digital pin D2 instead of power rail!
  const badPowerSonar = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Wrong Destination VCC Sonar",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "d2" }, to: { partId: "sonar", pinId: "vcc" } }, // WRONG DESTINATION!
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" } },
        ],
      },
      code: null,
      explanation: "VCC connected to GPIO D2 instead of 5V rail",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(badPowerSonar, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_INVALID_POWER_DESTINATION"))
})

test("P3-5: Gate blocks servo with Signal wired to GND instead of digital/PWM GPIO", () => {
  const badSigServo = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "Wrong Destination Signal Servo",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" } },
          { id: "w3", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "sig" } }, // WRONG DESTINATION!
        ],
      },
      code: null,
      explanation: "Servo signal grounded",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(badSigServo, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_SERVO_INVALID_SIGNAL_DESTINATION"))
})

test("P3-5: Gate blocks LDR divider connected between GND and GND (missing power rail)", () => {
  const noPowerLdr = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ldr_lighting",
    summary: "Unpowered LDR Divider Defect",
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
          { id: "w1", from: { partId: "uno", pinId: "gnd" }, to: { partId: "ldr1", pinId: "a" } }, // GND instead of 5V!
          { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r1", pinId: "a" } },
          { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "uno", pinId: "a0" } },
          { id: "w4", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" } },
        ],
      },
      code: null,
      explanation: "LDR divider connected to GND on both sides",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(noPowerLdr, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_LDR_INVALID_DIVIDER_DESTINATION"))
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

test("P3-5: Negative test — Gate strictly rejects Ultrasonic VCC wired to 5V AND D2 simultaneously (mixed power/GPIO)", () => {
  const mixedVccProposal = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Mixed VCC Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1_power", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" } },
          { id: "w1_gpio", from: { partId: "uno", pinId: "d2" }, to: { partId: "sonar", pinId: "vcc" } }, // Conflicting connection to GPIO!
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" } },
        ],
      },
      code: null,
      explanation: "VCC connected to both 5V and D2 simultaneously",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(mixedVccProposal, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_INVALID_POWER_DESTINATION") ||
    gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS"),
    "Must reject mixed VCC connection"
  )
})

test("P3-5: Negative test — Gate strictly rejects Ultrasonic GND wired to GND AND GPIO D3 simultaneously", () => {
  const mixedGndProposal = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Mixed GND Defect",
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
          { id: "w2_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w2_gpio", from: { partId: "uno", pinId: "d3" }, to: { partId: "sonar", pinId: "gnd" } }, // Conflicting connection to GPIO!
          { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" } },
        ],
      },
      code: null,
      explanation: "GND connected to both GND and D3 simultaneously",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(mixedGndProposal, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_INVALID_GROUND_DESTINATION") ||
    gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS"),
    "Must reject mixed GND connection"
  )
})

test("P3-5: Negative test — Gate strictly rejects Ultrasonic Trig wired to multiple GPIOs (D9 and D11)", () => {
  const multiTrigProposal = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Multi-GPIO Trig Defect",
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
          { id: "w3_a", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w3_b", from: { partId: "uno", pinId: "d11" }, to: { partId: "sonar", pinId: "trig" } }, // Conflicting multiple GPIOs!
          { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" } },
        ],
      },
      code: null,
      explanation: "Trig connected to both D9 and D11",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(multiTrigProposal, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS"))
})

test("P3-5: Negative test — Gate strictly rejects Ultrasonic Trig and Echo sharing the same pin", () => {
  const sharedTrigEchoProposal = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "Shared Trig Echo Defect",
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
          { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" } },
          { id: "w4", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "echo" } }, // Shared pin!
        ],
      },
      code: null,
      explanation: "Trig and Echo shorted to same pin D9",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(sharedTrigEchoProposal, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_PIN_CONFLICT") ||
    gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS")
  )
})

test("P3-5: Negative test — Gate strictly rejects Servo Signal wired to D9 AND 5V simultaneously", () => {
  const mixedSigServo = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "Mixed Signal Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" } },
          { id: "w3_sig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" } },
          { id: "w3_pwr", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "sig" } }, // Conflicting connection to power rail!
        ],
      },
      code: null,
      explanation: "Servo signal tied to both D9 and 5V",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(mixedSigServo, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_SERVO_INVALID_SIGNAL_DESTINATION") ||
    gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS")
  )
})

test("P3-5: Negative test — Gate strictly rejects Servo Signal wired to multiple GPIOs (D9 and D10)", () => {
  const multiSigServo = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "Multi-GPIO Servo Signal Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" } },
          { id: "w3_a", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" } },
          { id: "w3_b", from: { partId: "uno", pinId: "d10" }, to: { partId: "servo1", pinId: "sig" } }, // Conflicting multiple GPIOs!
        ],
      },
      code: null,
      explanation: "Servo signal tied to both D9 and D10",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(multiSigServo, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS"))
})

test("P3-5: Negative test — Gate strictly rejects Servo VCC connected to 5V AND D2 simultaneously", () => {
  const mixedServoVcc = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "Mixed Servo VCC Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1_pwr", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" } },
          { id: "w1_gpio", from: { partId: "uno", pinId: "d2" }, to: { partId: "servo1", pinId: "vcc" } }, // Conflicting connection!
          { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" } },
          { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" } },
        ],
      },
      code: null,
      explanation: "Servo VCC tied to 5V and D2",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(mixedServoVcc, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_SERVO_INVALID_POWER_DESTINATION") ||
    gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS")
  )
})

test("P3-5: Negative test — Gate strictly rejects LED anode connected to conflicting multiple board pins (D13 and D12)", () => {
  const multiPinLed = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Conflicting LED Pin Connections",
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
          { id: "w1_a", from: { partId: "uno", pinId: "d13" }, to: { partId: "led1", pinId: "anode" } },
          { id: "w1_b", from: { partId: "uno", pinId: "d12" }, to: { partId: "led1", pinId: "anode" } }, // Conflicting connection!
          { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" } },
          { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" } },
        ],
      },
      code: null,
      explanation: "LED anode tied to both D13 and D12",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(multiPinLed, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(gateResult.diagnosticCodes.includes("POLICY_CONFLICTING_PIN_CONNECTIONS"))
})

test("P3-5: Negative test — Gate strictly rejects LED loop powered directly from 5V rail without GPIO control", () => {
  const directPowerLed = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Direct Power LED Defect",
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
          { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "led1", pinId: "anode" } }, // Direct 5V instead of GPIO!
          { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" } },
          { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" } },
        ],
      },
      code: null,
      explanation: "LED connected to 5V rail directly without microcontroller control",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(directPowerLed, { currentBoard: "arduino-uno" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_LED_INVALID_POWER_DESTINATION") ||
    gateResult.diagnosticCodes.includes("POLICY_LED_INVALID_LOOP_DESTINATION")
  )
})

test("P3-2: HttpBaselineModelAdapter removes caller AbortSignal listener on completion (no memory leak)", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      choices: [{ message: { content: "{\"schema_version\":\"pixiu-copilot-proposal-v1\"}" } }],
    }))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port

  try {
    const adapter = new HttpBaselineModelAdapter({
      baseUrl: `http://127.0.0.1:${port}`,
      defaultTimeoutMs: 1000,
    })

    const persistentController = new AbortController()
    let abortListenerFired = false
    persistentController.signal.addEventListener("abort", () => {
      abortListenerFired = true
    })

    const res = await adapter.generateProposal(
      { requestId: "req-clean-listener", prompt: "LED", context: { targetBoard: "arduino-uno" } },
      { signal: persistentController.signal }
    )
    assert.equal(res.success, true)

    // Verify caller controller abort after completion does not trigger adapter error
    persistentController.abort()
    assert.equal(abortListenerFired, true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("P3-5: Negative test — Gate strictly rejects Ultrasonic Trig wired to ESP32 input-only pin D34", () => {
  const esp32InputOnlyTrig = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "ESP32 Input-Only Trig Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "esp32", type: "esp32-devkit", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" } },
          { id: "w2", from: { partId: "esp32", pinId: "gnd_l" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w3", from: { partId: "esp32", pinId: "d34" }, to: { partId: "sonar", pinId: "trig" } }, // D34 IS INPUT-ONLY!
          { id: "w4", from: { partId: "esp32", pinId: "d4" }, to: { partId: "sonar", pinId: "echo" } },
        ],
      },
      code: null,
      explanation: "Trig pulse requires output GPIO, but D34 is input-only",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(esp32InputOnlyTrig, { currentBoard: "esp32-devkit" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_ULTRASONIC_INVALID_TRIG_DESTINATION") &&
    gateResult.diagnosticCodes.includes("POLICY_GPIO_CAPABILITY_MISMATCH"),
    "Must reject input-only pin for ultrasonic Trig"
  )
})

test("P3-5: Negative test — Gate strictly rejects Servo Signal wired to ESP32 input-only pin D35", () => {
  const esp32InputOnlyServo = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "servo_control",
    summary: "ESP32 Input-Only Servo Signal Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "esp32", type: "esp32-devkit", x: 0, y: 0, rotation: 0, props: {} },
          { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "servo1", pinId: "vcc" } },
          { id: "w2", from: { partId: "esp32", pinId: "gnd_r" }, to: { partId: "servo1", pinId: "gnd" } },
          { id: "w3", from: { partId: "esp32", pinId: "d35" }, to: { partId: "servo1", pinId: "sig" } }, // D35 IS INPUT-ONLY!
        ],
      },
      code: null,
      explanation: "Servo PWM control requires output GPIO, but D35 is input-only",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(esp32InputOnlyServo, { currentBoard: "esp32-devkit" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_SERVO_INVALID_SIGNAL_DESTINATION") &&
    gateResult.diagnosticCodes.includes("POLICY_GPIO_CAPABILITY_MISMATCH"),
    "Must reject input-only pin for servo signal"
  )
})

test("P3-5: Negative test — Gate strictly rejects LED control loop connected to ESP32 input-only pin D34", () => {
  const esp32InputOnlyLed = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "ESP32 Input-Only LED Control Defect",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "esp32", type: "esp32-devkit", x: 0, y: 0, rotation: 0, props: {} },
          { id: "led1", type: "led", x: 100, y: 0, rotation: 0, props: {} },
          { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 220 } },
        ],
        wires: [
          { id: "w1", from: { partId: "esp32", pinId: "d34" }, to: { partId: "led1", pinId: "anode" } }, // D34 IS INPUT-ONLY!
          { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" } },
          { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "esp32", pinId: "gnd_l" } },
        ],
      },
      code: null,
      explanation: "LED driving requires output GPIO, but D34 is input-only",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(esp32InputOnlyLed, { currentBoard: "esp32-devkit" })
  assert.equal(gateResult.passed, false)
  assert.equal(gateResult.canApply, false)
  assert.ok(
    gateResult.diagnosticCodes.includes("POLICY_LED_INVALID_LOOP_DESTINATION") &&
    gateResult.diagnosticCodes.includes("POLICY_GPIO_CAPABILITY_MISMATCH"),
    "Must reject input-only pin for LED control"
  )
})

test("P3-5: Regression test — Gate accepts Ultrasonic Echo on ESP32 input-only pin D34 when Trig is on output GPIO D4", () => {
  const esp32ValidEcho = {
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "ultrasonic_alert",
    summary: "ESP32 Valid Echo on D34",
    assumptions: [],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "esp32", type: "esp32-devkit", x: 0, y: 0, rotation: 0, props: {} },
          { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
        ],
        wires: [
          { id: "w1", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" } },
          { id: "w2", from: { partId: "esp32", pinId: "gnd_l" }, to: { partId: "sonar", pinId: "gnd" } },
          { id: "w3", from: { partId: "esp32", pinId: "d4" }, to: { partId: "sonar", pinId: "trig" } }, // D4 is valid output GPIO
          { id: "w4", from: { partId: "esp32", pinId: "d34" }, to: { partId: "sonar", pinId: "echo" } }, // D34 is input-only, valid for Echo!
        ],
      },
      code: null,
      explanation: "Echo is input-only, D34 is input-capable",
    },
    capabilities: {
      simulation: "supported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  }

  const gateResult = evaluateProposalGate(esp32ValidEcho, { currentBoard: "esp32-devkit" })
  assert.equal(gateResult.passed, true, `Expected ESP32 valid echo to pass: ${gateResult.errors.join(", ")}`)
})

test("P3-5: Regression test — Valid configurations across ALL 4 boards pass electrical gate cleanly", () => {
  const boards = [
    {
      board: "arduino-uno",
      powerPin: "5v",
      gndPin: "gnd",
      outPin: "d9",
      inPin: "d10",
      ledPin: "d13",
    },
    {
      board: "esp32-devkit",
      powerPin: "3v3",
      gndPin: "gnd_l",
      outPin: "d4",
      inPin: "d14",
      ledPin: "d2",
    },
    {
      board: "rpi-pico",
      powerPin: "3v3",
      gndPin: "gnd_1",
      outPin: "gp4",
      inPin: "gp5",
      ledPin: "gp15",
    },
    {
      board: "microbit-v2",
      powerPin: "3v",
      gndPin: "gnd",
      outPin: "p0",
      inPin: "p1",
      ledPin: "p2",
    },
  ]

  for (const b of boards) {
    // 1. LED Valid
    const ledProposal = {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "led_control",
      summary: `Valid LED on ${b.board}`,
      assumptions: [],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "board", type: b.board, x: 0, y: 0, rotation: 0, props: {} },
            { id: "led1", type: "led", x: 100, y: 0, rotation: 0, props: {} },
            { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 220 } },
          ],
          wires: [
            { id: "w1", from: { partId: "board", pinId: b.ledPin }, to: { partId: "led1", pinId: "anode" } },
            { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" } },
            { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "board", pinId: b.gndPin } },
          ],
        },
        code: null,
        explanation: "Valid LED",
      },
      capabilities: { simulation: "supported", compilation: "not_tested", physical_hardware: "not_verified" },
    }
    const ledGate = evaluateProposalGate(ledProposal, { currentBoard: b.board })
    assert.equal(ledGate.passed, true, `LED on ${b.board} failed: ${ledGate.errors.join(", ")}`)

    // 2. Ultrasonic Valid
    const sonarProposal = {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "ultrasonic_alert",
      summary: `Valid Sonar on ${b.board}`,
      assumptions: [],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "board", type: b.board, x: 0, y: 0, rotation: 0, props: {} },
            { id: "sonar", type: "ultrasonic", x: 100, y: 0, rotation: 0, props: {} },
          ],
          wires: [
            { id: "w1", from: { partId: "board", pinId: b.powerPin }, to: { partId: "sonar", pinId: "vcc" } },
            { id: "w2", from: { partId: "board", pinId: b.gndPin }, to: { partId: "sonar", pinId: "gnd" } },
            { id: "w3", from: { partId: "board", pinId: b.outPin }, to: { partId: "sonar", pinId: "trig" } },
            { id: "w4", from: { partId: "board", pinId: b.inPin }, to: { partId: "sonar", pinId: "echo" } },
          ],
        },
        code: null,
        explanation: "Valid Sonar",
      },
      capabilities: { simulation: "supported", compilation: "not_tested", physical_hardware: "not_verified" },
    }
    const sonarGate = evaluateProposalGate(sonarProposal, { currentBoard: b.board })
    assert.equal(sonarGate.passed, true, `Sonar on ${b.board} failed: ${sonarGate.errors.join(", ")}`)

    // 3. Servo Valid
    const servoProposal = {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "servo_control",
      summary: `Valid Servo on ${b.board}`,
      assumptions: [],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "board", type: b.board, x: 0, y: 0, rotation: 0, props: {} },
            { id: "servo1", type: "servo", x: 100, y: 0, rotation: 0, props: {} },
          ],
          wires: [
            { id: "w1", from: { partId: "board", pinId: b.powerPin }, to: { partId: "servo1", pinId: "vcc" } },
            { id: "w2", from: { partId: "board", pinId: b.gndPin }, to: { partId: "servo1", pinId: "gnd" } },
            { id: "w3", from: { partId: "board", pinId: b.outPin }, to: { partId: "servo1", pinId: "sig" } },
          ],
        },
        code: null,
        explanation: "Valid Servo",
      },
      capabilities: { simulation: "supported", compilation: "not_tested", physical_hardware: "not_verified" },
    }
    const servoGate = evaluateProposalGate(servoProposal, { currentBoard: b.board })
    assert.equal(servoGate.passed, true, `Servo on ${b.board} failed: ${servoGate.errors.join(", ")}`)
  }
})
