/**
 * PIXIU TECH CYBERLAB — COPILOT APPLICATION REQUEST-PATH INTEGRATION TESTS
 * 
 * Tests the complete end-to-end call chain through the real application entry points:
 * Incoming Request
 *   → routeUserRequest
 *   → wrapCopilotPrompt (pedagogical & inductive safety guardrails)
 *   → modelAdapter.generateProposal
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

const bundleDir = join(tmpdir(), `copilot-request-path-test-${Date.now()}`)

await build({
  entryPoints: {
    copilot: new URL("../../src/lib/ai/copilot/index.ts", import.meta.url).pathname,
    action: new URL("../../src/components/circuit-lab/use-circuit-copilot-action.ts", import.meta.url).pathname,
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

const copilotMod = await import(`file://${join(bundleDir, "copilot.js")}`)
const actionMod = await import(`file://${join(bundleDir, "action.js")}`)
const validatorMod = await import(`file://${join(bundleDir, "validator.js")}`)

const {
  handleCopilotRequest,
  DeterministicStubAdapter,
  createBaselineModelAdapter,
  repairBlocklyXml,
  wrapCopilotPrompt,
} = copilotMod

const { computeCircuitHash, validateProposedCircuit } = validatorMod

// ============================================================================
// Integration Tests: Real Application Request Path
// ============================================================================

test("Integration 1: Full application call chain for standard LED Blink request", async () => {
  const reqId = "req-test-led-01"
  const prompt = "Please blink the onboard LED on digital pin 13 every second"
  const baseHash = "a1b2c3d4e5f60718"

  const output = await handleCopilotRequest({
    requestId: reqId,
    prompt,
    targetBoard: "arduino-uno",
    currentRevisionHash: baseHash,
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

test("Integration 2: Middleware automatically heals truncated XML emitted by model", async () => {
  const truncatedModelOutput = JSON.stringify({
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "LED Blink with truncated XML",
    assumptions: ["Arduino Uno 5V"],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
          { id: "r1", type: "resistor", x: 470, y: 140, rotation: 0, props: { resistance: 220 } },
          { id: "led1", type: "led", x: 470, y: 230, rotation: 0, props: { color: "red" } },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#38bdf8" },
          { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#38bdf8" },
          { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        ],
      },
      code: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="SETUP"><block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block></statement><statement name="LOOP"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next><block type="time_delay"><value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value>',
      explanation: "Blinks LED on D13",
    },
    capabilities: {
      simulation: "supported",
      compilation: "supported",
      physical_hardware: "not_verified",
    },
  })

  // Create mock adapter returning the truncated output
  const mockAdapter = {
    async generateProposal() {
      return {
        rawOutput: truncatedModelOutput,
        success: true,
        metadata: { provider: "mock", model: "qwen-14b", version: "1.0", requestId: "r-trunc", durationMs: 10 },
      }
    },
  }

  const output = await handleCopilotRequest({
    requestId: "r-trunc",
    prompt: "Blink LED",
    targetBoard: "arduino-uno",
    modelAdapter: mockAdapter,
  })

  assert.equal(output.success, true)
  assert.ok(output.repairResult?.isHealed, "Middleware must flag isHealed = true")
  assert.ok(output.proposal?.blocklyXml?.endsWith("</xml>"), "Repaired XML must properly close with </xml>")
  assert.ok(output.proposal?.blocklyXml?.includes("</statement></block></xml>"), "All open statement and block tags must be closed")
})

test("Integration 3: Middleware normalizes legacy block aliases (lcd_setup, io_tone)", async () => {
  const aliasModelOutput = JSON.stringify({
    schema_version: "pixiu-copilot-proposal-v1",
    task_type: "led_control",
    summary: "Proposal with legacy block aliases",
    assumptions: ["Arduino Uno"],
    needs_clarification: [],
    proposal: {
      circuit: {
        parts: [
          { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
          { id: "r1", type: "resistor", x: 470, y: 140, rotation: 0, props: { resistance: 220 } },
          { id: "led1", type: "led", x: 470, y: 230, rotation: 0, props: { color: "red" } },
        ],
        wires: [
          { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#38bdf8" },
          { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#38bdf8" },
          { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        ],
      },
      code: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="SETUP"><block type="lcd_setup"></block></statement><statement name="LOOP"><block type="io_tone"><field name="PIN">8</field></block></statement></block></xml>',
      explanation: "Sets up LCD and plays tone",
    },
    capabilities: {
      simulation: "supported",
      compilation: "supported",
      physical_hardware: "not_verified",
    },
  })

  const mockAdapter = {
    async generateProposal() {
      return {
        rawOutput: aliasModelOutput,
        success: true,
        metadata: { provider: "mock", model: "qwen-14b", version: "1.0", requestId: "r-alias", durationMs: 10 },
      }
    },
  }

  const output = await handleCopilotRequest({
    requestId: "r-alias",
    prompt: "Blink LED with buzzer",
    targetBoard: "arduino-uno",
    modelAdapter: mockAdapter,
  })

  assert.equal(output.success, true)
  assert.ok(output.proposal?.blocklyXml?.includes('type="lcd_clear"'), "lcd_setup must be aliased to lcd_clear")
  assert.ok(output.proposal?.blocklyXml?.includes('type="tone_play"'), "io_tone must be aliased to tone_play")
  assert.ok(!output.proposal?.blocklyXml?.includes('type="lcd_setup"'), "Old lcd_setup block must be gone")
})

test("Integration 4: Safe rejection of unsupported peripheral (MAX6675 SPI / TM1637)", async () => {
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

test("Integration 5: Inductive load prompt automatically wrapped with flyback protection diode guardrail", () => {
  const prompt = "Build a cooling fan controller with a DC motor"
  const wrapped = wrapCopilotPrompt(prompt, { domain: "circuit", hasInductiveLoad: true })

  assert.ok(wrapped.includes("HARDWARE SAFETY GUARDRAIL"), "Must include safety banner")
  assert.ok(wrapped.includes("1N4007 flyback protection diode"), "Must mandate 1N4007 flyback diode")
  assert.ok(wrapped.includes("ATmega328P pins cannot supply motor/pump/relay current (>20mA)"), "Must cite pin current limit")
  assert.ok(wrapped.endsWith("Build a cooling fan controller with a DC motor"), "Original prompt must be preserved at bottom")
})

test("Integration 6: proposeAction validates and repairs Blockly XML in circuit proposal envelope", async () => {
  const baseHash = "1234567890abcdef"
  const candidate = {
    id: "prop-test-heal",
    title: "Test Healed Proposal",
    rationale: "Testing XML healing in proposeAction",
    baseRevisionHash: baseHash,
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
        { id: "r1", type: "resistor", x: 470, y: 140, rotation: 0, props: { resistance: 220 } },
        { id: "led1", type: "led", x: 470, y: 230, rotation: 0, props: { color: "red" } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#38bdf8" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#38bdf8" },
        { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    // Truncated XML missing </xml> and statement closings
    blocklyXml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="SETUP"><block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block></statement><statement name="LOOP"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field>',
  }

  // Verify that repairBlocklyXml automatically heals this before validation
  const repair = repairBlocklyXml(candidate.blocklyXml)
  assert.equal(repair.success, true)
  assert.equal(repair.isHealed, true)

  const validation = validateProposedCircuit({
    parts: candidate.circuit.parts,
    wires: candidate.circuit.wires,
    blocklyXml: repair.repairedXml,
  })
  assert.equal(validation.valid, true, "Healed proposal must pass circuit validator")
})

test("Integration 7: proposeAction safely rejects proposal containing unsupported hardware", () => {
  const unsupportedCandidate = {
    id: "prop-test-unsupported",
    title: "Unsupported Thermocouple Proposal",
    rationale: "Testing hardware rejection",
    baseRevisionHash: "1234567890abcdef",
    circuit: { parts: [], wires: [] },
    blocklyXml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="LOOP"><block type="max6675_read"></block></statement></block></xml>',
  }

  const repair = repairBlocklyXml(unsupportedCandidate.blocklyXml)
  assert.equal(repair.success, false, "Must detect unsupported peripheral")
  assert.ok(repair.unsupportedBlocks.includes("max6675_read"))
  assert.ok(repair.error?.includes("These hardware blocks are not defined in the Pixiu LMS toolbox"))
})
