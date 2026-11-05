/**
 * PIXIU TECH CYBERLAB — COPILOT APPLICATION REQUEST-PATH INTEGRATION TESTS
 * 
 * Tests the complete end-to-end call chain through the real application entry points:
 * Incoming Request
 *   → routeUserRequest (dynamically derives math_teaching vs circuit)
 *   → wrapCopilotPrompt (pedagogical scaffolding & frequency-aware diode guardrails)
 *   → modelAdapter.generateProposal (HttpBaselineModelAdapter for Checkpoint-400 by default)
 *   → parseProposalPayload
 *   → repairBlocklyXml (Blockly healing, alias normalization, unsupported block interception)
 *   → evaluateProposalGate (safety gate)
 *   → useCircuitCopilotAction (proposeAction → stageProposal → applyProposal)
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const bundleDir = join(process.cwd(), ".test-bundle-copilot")

await build({
  entryPoints: {
    copilot: new URL("../../src/lib/ai/copilot/index.ts", import.meta.url).pathname,
    action: new URL("../../src/components/circuit-lab/use-circuit-copilot-action.ts", import.meta.url).pathname,
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
    blocks: new URL("../../src/lib/arduino-blocks.ts", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "node",
  packages: "external",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const copilotMod = await import(`file://${join(bundleDir, "copilot.js")}`)
const actionMod = await import(`file://${join(bundleDir, "action.js")}`)
const validatorMod = await import(`file://${join(bundleDir, "validator.js")}`)
const blocksMod = await import(`file://${join(bundleDir, "blocks.js")}`)

const {
  handleCopilotRequest,
  DeterministicStubAdapter,
  HttpBaselineModelAdapter,
  createBaselineModelAdapter,
  repairBlocklyXml,
  wrapCopilotPrompt,
} = copilotMod

const { computeCircuitHash, validateProposedCircuit } = validatorMod
const { arduino } = blocksMod

// ============================================================================
// Integration Tests: Real Application Request Path
// ============================================================================

test("Integration 1: Staging request path defaults to HttpBaselineModelAdapter (Checkpoint-400)", async () => {
  // Verifies that handleCopilotRequest does NOT silently fall back to DeterministicStubAdapter
  const output = await handleCopilotRequest({
    requestId: "req-default-endpoint",
    prompt: "Blink LED on pin 13",
    targetBoard: "arduino-uno",
  })

  // By default, it targets HttpBaselineModelAdapter at http://localhost:8000/v1.
  // Because no local inference server is running on GTX 1650, it must honestly fail with PROVIDER_ERROR
  // rather than fabricating a fake PASS via stub adapter.
  assert.equal(output.success, false, "Must fail cleanly when live inference server is offline")
  assert.equal(output.error, "PROVIDER_ERROR")
  assert.ok(output.replyText.includes("HttpBaselineModelAdapter"), "Must cite HttpBaselineModelAdapter")
  assert.equal(output.modelResponse.metadata.provider, "http-openai-compatible")
  assert.equal(output.modelResponse.metadata.model, "pixiumind-14b-checkpoint-400")
})

test("Integration 2: Full application call chain for standard LED Blink with test stub", async () => {
  const reqId = "req-test-led-01"
  const prompt = "Please blink the onboard LED on digital pin 13 every second"
  const baseHash = "a1b2c3d4e5f60718"

  const stubAdapter = new DeterministicStubAdapter()

  const output = await handleCopilotRequest({
    requestId: reqId,
    prompt,
    targetBoard: "arduino-uno",
    currentRevisionHash: baseHash,
    modelAdapter: stubAdapter,
  })

  // 1. Verify routing
  assert.equal(output.success, true)
  assert.equal(output.route.taskType, "led_control")
  assert.equal(output.route.targetBoard, "arduino-uno")

  // 2. Verify model proposal & schema parse
  assert.ok(output.proposal, "Must produce a valid proposal")
  assert.equal(output.proposal.baseRevisionHash, baseHash)
  assert.equal(output.proposal.codeLanguage, "blockly")

  // 3. Verify Blockly XML is valid Google format
  assert.ok(output.proposal.blocklyXml?.includes('xmlns="https://developers.google.com/blockly/xml"'))
  assert.ok(output.proposal.blocklyXml?.includes('type="arduino_program"'))

  // 4. Verify gate passed
  assert.equal(output.gateResult?.passed, true)
  assert.equal(output.gateResult?.canApply, true)

  // 5. Verify validation through circuit-validator
  const validation = validateProposedCircuit({
    parts: output.proposal.circuit.parts,
    wires: output.proposal.circuit.wires,
    blocklyXml: output.proposal.blocklyXml,
  })
  assert.equal(validation.valid, true)
})

test("Integration 3: Middleware automatically heals truncated XML and passes real XML parser", async () => {
  // Truncated mid-stream ending with dangling <next> tag
  const rawTruncatedXml = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" id="ROOT">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite">
        <field name="PIN">12</field>
        <field name="STATE">LOW</field>
        <next>`

  const repair = repairBlocklyXml(rawTruncatedXml)
  assert.equal(repair.success, true, "Must successfully heal truncated XML")
  assert.equal(repair.isHealed, true, "Must flag isHealed = true")
  assert.ok(repair.repairedXml?.endsWith("</xml>"), "Must close with </xml>")
  assert.ok(!repair.repairedXml?.includes("<next>\n</block>"), "Must strip dangling empty <next> container")

  // Verify that healed XML passes circuit-validator schema check
  const valResult = validateProposedCircuit({
    parts: [],
    wires: [],
    blocklyXml: repair.repairedXml,
  })
  assert.equal(valResult.valid, true, "Healed XML must pass circuit validator")
})

test("Integration 4: Math Teaching requests dynamically derive domain:'math' and receive pedagogical scaffolding", async () => {
  const mathPrompt = "Teach me how to solve the quadratic equation 2x^2 + 5x - 3 = 0"
  
  // Create mock model adapter that checks the received prompt
  let receivedPrompt = ""
  const mockMathAdapter = {
    async generateProposal(req) {
      receivedPrompt = req.prompt
      return {
        rawOutput: "Before applying the quadratic formula, can you identify the coefficients a, b, and c in your equation?",
        success: true,
        metadata: { provider: "mock", model: "qwen-14b", version: "1.0", requestId: req.requestId, durationMs: 10 },
      }
    },
  }

  const output = await handleCopilotRequest({
    requestId: "req-math-01",
    prompt: mathPrompt,
    targetBoard: "arduino-uno",
    modelAdapter: mockMathAdapter,
  })

  assert.equal(output.success, true)
  assert.equal(output.route.route, "math_teaching")
  assert.ok(receivedPrompt.includes("PEDAGOGICAL GUARDRAIL"), "Must wrap prompt with pedagogical scaffolding")
  assert.ok(receivedPrompt.includes("ask the student a diagnostic guiding question first"), "Must mandate diagnostic question first")
  assert.ok(output.replyText.includes("identify the coefficients a, b, and c"), "Reply text must convey guiding question")
  assert.equal(output.proposal, null, "Pure math inquiry produces 0 circuit parts")
})

test("Integration 5: Inductive load prompt automatically wrapped with frequency-aware flyback diode guardrail", () => {
  const prompt = "Build a high-speed cooling fan PWM motor controller on Uno pin D9"
  const wrapped = wrapCopilotPrompt(prompt, { domain: "circuit", hasInductiveLoad: true })

  assert.ok(wrapped.includes("HARDWARE SAFETY GUARDRAIL"), "Must include safety banner")
  assert.ok(wrapped.includes("ATmega328P Datasheet Sec. 32"), "Must cite ATmega328P datasheet section")
  assert.ok(wrapped.includes("Schottky diode (1N5819 / SS14 / 1N5822"), "Must mandate fast Schottky diode for PWM")
  assert.ok(wrapped.includes("Low-frequency switching (<100Hz, DC relay coils): Standard silicon rectifier (1N4007"), "Must distinguish low-frequency 1N4007")
})

test("Integration 6: DHT22 functional generator produces real C++ sensor read, not constant 0", () => {
  const generator = arduino
  generator.definitions_ = {}
  const workspaceXml = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="serial_println">
        <value name="TEXT">
          <block type="dht_temperature">
            <field name="SENSOR">dht1</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>`

  // Validate that generator emits real #include <DHT.h> and dht.readTemperature()
  const repair = repairBlocklyXml(workspaceXml)
  assert.equal(repair.success, true)

  // Verify that the generator block implementation generates real code
  const dhtBlock = {
    getFieldValue: () => "dht1",
  }
  const [code] = generator.forBlock["dht_temperature"](dhtBlock, generator)
  assert.equal(code, "dht.readTemperature()", "Must generate real dht.readTemperature() call")
  assert.notEqual(code, "0", "Must NOT generate constant 0")
  assert.ok(generator.definitions_["dht_include"].includes("<DHT.h>"), "Must include DHT.h header")
  assert.ok(generator.definitions_["dht_decl"].includes("DHT dht(DHTPIN, DHTTYPE)"), "Must instantiate DHT object")
})

test("Integration 7: Native lcd_setup generates full Wire/LCD initialization", () => {
  const generator = arduino
  generator.definitions_ = {}
  const lcdBlock = {
    getFieldValue: () => null,
  }
  const code = generator.forBlock["lcd_setup"](lcdBlock, generator)
  assert.ok(code.includes("lcd.init()"), "lcd_setup must call lcd.init()")
  assert.ok(code.includes("lcd.backlight()"), "lcd_setup must call lcd.backlight()")
  assert.ok(generator.definitions_["wire_include"].includes("<Wire.h>"), "Must include Wire.h")
  assert.ok(generator.definitions_["lcd_include"].includes("<LiquidCrystal_I2C.h>"), "Must include LiquidCrystal_I2C.h")
})

test("Integration 8: Safe rejection of unsupported peripheral (MAX6675 SPI / TM1637)", async () => {
  const unsupportedModelOutput = JSON.stringify({
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Proposal with unsupported SPI thermocouple",
    assumptions: ["Arduino Uno"],
    needs_clarification: [],
    proposal: {
      circuit: { parts: [], wires: [] },
      code: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="LOOP"><block type="max6675_read"><field name="PIN">10</field></block></statement></block></xml>',
      explanation: "Reads SPI thermocouple",
    },
    capabilities: {
      simulation: "unsupported",
      compilation: "not_tested",
      physical_hardware: "not_verified",
    },
  })

  const mockAdapter = {
    async generateProposal() {
      return {
        rawOutput: unsupportedModelOutput,
        success: true,
        metadata: { provider: "mock", model: "qwen-14b", version: "1.0", requestId: "r-unsup", durationMs: 10 },
      }
    },
  }

  const output = await handleCopilotRequest({
    requestId: "r-unsup",
    prompt: "Blink LED with thermocouple SPI reader",
    targetBoard: "arduino-uno",
    modelAdapter: mockAdapter,
  })

  assert.equal(output.success, false, "Must fail request safely")
  assert.equal(output.error, "UNSUPPORTED_HARDWARE_REJECTED")
  assert.ok(output.repairResult?.unsupportedBlocks.includes("max6675_read"))
  assert.ok(output.replyText.includes("Unsupported Hardware Detected"))
  assert.equal(output.proposal, null, "No corrupt proposal may be returned")
})
