import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"
import { JSDOM } from "jsdom"

const bundleDir = join(tmpdir(), `xen-live-phase-a-${Date.now()}`)
await build({
  entryPoints: {
    solver: new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname,
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
    doctor: new URL("../../src/lib/circuit-doctor.ts", import.meta.url).pathname,
    intel: new URL("../../src/lib/circuit-intelligence.ts", import.meta.url).pathname,
    bridge: new URL("../../src/lib/live-circuit-bridge.ts", import.meta.url).pathname,
    classifier: new URL("../../src/lib/ai/xen/circuit-query-classifier.js", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})

const { solveCircuitNodalPotentials } = await import(`file://${join(bundleDir, "solver.js")}`)
const { validateCandidateWire } = await import(`file://${join(bundleDir, "validator.js")}`)
const { diagnoseCircuit } = await import(`file://${join(bundleDir, "doctor.js")}`)
const { serializeCircuitContext, diagnoseCircuitIntelligence, processCircuitCopilotQuery } = await import(
  `file://${join(bundleDir, "intel.js")}`
)
const { buildCanonicalCircuitContextV3, validateCanonicalCircuitContextV3, LiveCircuitContextBridge } = await import(
  `file://${join(bundleDir, "bridge.js")}`
)
const { isCircuitSpecificQuery } = await import(`file://${join(bundleDir, "classifier.js")}`)

test("Phase A1: Canonical netlist resolves breadboard columns/rails, legacy aliases, and button state without duplicate UnionFind", () => {
  const circuit = {
    parts: [
      { id: "esp", type: "esp32-devkit", x: 0, y: 0, rotation: 0, props: {} },
      { id: "bb", type: "breadboard", x: 100, y: 0, rotation: 0, props: {} },
      { id: "btn", type: "pushbutton", x: 200, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 300, y: 0, rotation: 0, props: { resistance: 220 } },
    ],
    wires: [
      { id: "w1", from: { partId: "esp", pinId: "3v3" }, to: { partId: "bb", pinId: "pos_top" }, color: "red" },
      { id: "w2", from: { partId: "bb", pinId: "pos_t_12" }, to: { partId: "btn", pinId: "p1a" }, color: "red" },
      { id: "w3", from: { partId: "btn", pinId: "p2b" }, to: { partId: "bb", pinId: "b1" }, color: "green" }, // b1 -> b_6
      { id: "w4", from: { partId: "bb", pinId: "d_6" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      { id: "w5", from: { partId: "r1", pinId: "b" }, to: { partId: "esp", pinId: "gnd_l" }, color: "black" },
    ],
  }

  const releasedCtx = serializeCircuitContext(circuit, { running: true })
  assert.equal(releasedCtx.nodalSolution.arePinsConnected({ partId: "esp", pinId: "3v3" }, { partId: "btn", pinId: "p1a" }), true)
  assert.equal(releasedCtx.nodalSolution.arePinsConnected({ partId: "btn", pinId: "p2b" }, { partId: "r1", pinId: "a" }), true)
  assert.equal(releasedCtx.nodalSolution.arePinsConnected({ partId: "btn", pinId: "p1a" }, { partId: "btn", pinId: "p2b" }), false)

  // Button pressed bridges p1a-p2b
  const pressedCtx = serializeCircuitContext(circuit, { running: true, pressed: new Set(["btn"]) })
  assert.equal(pressedCtx.nodalSolution.arePinsConnected({ partId: "esp", pinId: "3v3" }, { partId: "r1", pinId: "a" }), true)
  // Ground check must recognize ESP32 gnd_l and Pico gnd_1 (not emit false MISSING_GROUND)
  const faults = diagnoseCircuitIntelligence(pressedCtx)
  assert.equal(faults.some((f) => f.classification === "MISSING_GROUND"), false)

  const picoCircuit = {
    parts: [
      { id: "pico", type: "rpi-pico", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 220 } },
    ],
    wires: [
      { id: "w1", from: { partId: "pico", pinId: "3v3" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "pico", pinId: "gnd_1" }, color: "black" },
    ],
  }
  const picoCtx = serializeCircuitContext(picoCircuit, { running: true })
  assert.equal(diagnoseCircuitIntelligence(picoCtx).some((f) => f.classification === "MISSING_GROUND"), false)
})

test("Phase A2: validateCandidateWire detects self-loop, duplicate (including aliases), same-net, short hazard, and compatible wires", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "bb", type: "breadboard", x: 100, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 300, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "bb", pinId: "pos_t_1" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "green" },
    ],
  }

  const samePinRes = validateCandidateWire(circuit, { partId: "uno", pinId: "d13" }, { partId: "uno", pinId: "13" })
  assert.equal(samePinRes.placementAllowed, false)
  assert.equal(samePinRes.isSamePin, true)
  assert.equal(samePinRes.compatibilityStatus, "blocked_invalid_target")

  // Duplicate wire detection across breadboard legacy alias pos_top == pos_t_1
  const dupRes = validateCandidateWire(circuit, { partId: "bb", pinId: "pos_top" }, { partId: "uno", pinId: "5v" })
  assert.equal(dupRes.placementAllowed, false)
  assert.equal(dupRes.isDuplicateWire, true)
  assert.equal(dupRes.compatibilityStatus, "blocked_invalid_target")

  // Redundant same-net check inside breadboard column
  const sameNetRes = validateCandidateWire(circuit, { partId: "bb", pinId: "a_4" }, { partId: "bb", pinId: "e_4" })
  assert.equal(sameNetRes.placementAllowed, true)
  assert.equal(sameNetRes.isAlreadySameNet, true)
  assert.equal(sameNetRes.compatibilityStatus, "redundant_same_net")

  // Short circuit hazard 5V -> GND
  const shortRes = validateCandidateWire(circuit, { partId: "uno", pinId: "5v" }, { partId: "uno", pinId: "gnd" })
  assert.equal(shortRes.placementAllowed, true)
  assert.equal(shortRes.compatibilityStatus, "electrical_hazard")
  assert.ok(shortRes.reasons.some((r) => /short/i.test(r.title)))

  // Valid compatible wire: led1:cathode -> uno:gnd
  const okRes = validateCandidateWire(circuit, { partId: "led1", pinId: "cathode" }, { partId: "uno", pinId: "gnd" })
  assert.equal(okRes.placementAllowed, true)
  assert.equal(okRes.compatibilityStatus, "compatible")
})

test("Phase A3: Empty and unwired canvas never report 100/100 health score or 'connections intact'", () => {
  const emptyCircuit = { parts: [], wires: [] }
  const emptyHealth = diagnoseCircuit(emptyCircuit)
  assert.equal(emptyHealth.score, null)
  assert.equal(emptyHealth.status, "empty")
  assert.equal(emptyHealth.isEmpty, true)

  const emptyCtx = serializeCircuitContext(emptyCircuit)
  const emptyReply = processCircuitCopilotQuery("check my circuit", emptyCtx)
  assert.doesNotMatch(emptyReply.reply, /100\/100|connections are intact|electrically sound/i)
  assert.match(emptyReply.reply, /empty|0 components/i)

  const unwiredCircuit = { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }], wires: [] }
  const unwiredHealth = diagnoseCircuit(unwiredCircuit)
  assert.equal(unwiredHealth.score, null)
  assert.equal(unwiredHealth.status, "unwired")
  const unwiredCtx = serializeCircuitContext(unwiredCircuit)
  const unwiredReply = processCircuitCopilotQuery("is my circuit complete?", unwiredCtx)
  assert.doesNotMatch(unwiredReply.reply, /100\/100|connections are intact|electrically sound/i)
  assert.match(unwiredReply.reply, /0 completed wire/i)
})

test("Phase C1: Schema v3.0 builds all 21 keys, preserves recent_target when pointer leaves pin, and separates draft vs completed wires", () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 100, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 320, y: 100, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
    ],
  }
  const ctx = serializeCircuitContext(circuit, { running: true, blocklyXml: '<xml><field name="PIN">D13</field></xml>' })
  const v3 = buildCanonicalCircuitContextV3({
    circuit,
    circuitContext: ctx,
    sessionId: "sess-1",
    circuitRevision: 3,
    interactionRevision: 5,
    eventSeq: 8,
    wiring: { partId: "r1", pinId: "b" },
    hoverPin: null,
    recentTarget: { partId: "led1", pinId: "anode", leftAt: "2026-11-26T12:00:00.000Z" },
    meterTelemetry: { isOpen: true, mode: "voltage", value: "4.98", unit: "V", explanation: "DC", isContinuityBeep: false },
    scopeTelemetry: { isOpen: true, isHold: false, timebaseLabel: "50ms", windowMs: 500, ch1: null, ch2: null },
  })

  for (const key of [
    "schema_version",
    "session_id",
    "circuit_revision",
    "interaction_revision",
    "state_revision",
    "captured_at",
    "board",
    "components",
    "component_catalogue_metadata",
    "pins",
    "connections",
    "in_progress_connection",
    "selected_component",
    "hovered_component",
    "hovered_pin",
    "netlist",
    "simulation",
    "pin_states",
    "meter",
    "scope",
    "diagnostics",
    "blockly_context",
    "runtime_status",
  ]) {
    assert.ok(key in v3, `Missing required v3 key: ${key}`)
  }

  assert.equal(v3.connections.length, 1)
  assert.equal(v3.connections[0].status, "complete")
  assert.equal(v3.hovered_pin, null)
  assert.ok(v3.in_progress_connection)
  assert.equal(v3.in_progress_connection.source_part_id, "r1")
  assert.equal(v3.in_progress_connection.source_pin_id, "b")
  assert.equal(v3.in_progress_connection.candidate_target, null)
  assert.equal(v3.in_progress_connection.recent_target.part_id, "led1")
  assert.equal(v3.in_progress_connection.recent_target.pin_id, "anode")
  assert.equal(v3.in_progress_connection.recent_target.currently_hovered, false)
  assert.equal(v3.in_progress_connection.status, "valid")

  const validation = validateCanonicalCircuitContextV3(v3)
  assert.equal(validation.valid, true, validation.errors.join("; "))
})

test("Phase C2: Schema v3.0 validator rejects inconsistent references, drafts in connections, leaked secrets, and fake empty health", () => {
  const emptyCtx = serializeCircuitContext({ parts: [], wires: [] })
  const validEmpty = buildCanonicalCircuitContextV3({
    circuit: { parts: [], wires: [] },
    circuitContext: emptyCtx,
    sessionId: "sess-empty",
    circuitRevision: 0,
    interactionRevision: 0,
  })
  assert.equal(validEmpty.board, null)
  assert.equal(validEmpty.diagnostics.health_score, null)
  assert.equal(validateCanonicalCircuitContextV3(validEmpty).valid, true)

  // Invalid: draft wire placed in connections
  const badDraftInConnections = structuredClone(validEmpty)
  badDraftInConnections.components = [{ id: "uno", type: "arduino-uno", name: "Uno", category: "board", x: 0, y: 0, rotation: 0, props: {} }]
  badDraftInConnections.connections = [{ id: "w_bad", from_part_id: "uno", from_pin_id: "5v", to_part_id: "uno", to_pin_id: "gnd", from: "uno:5v", to: "uno:gnd", color: "red", status: "draft" }]
  assert.equal(validateCanonicalCircuitContextV3(badDraftInConnections).valid, false)

  // Invalid: dangling connection endpoint + leaked token + contradictory empty score
  const badRefAndSecret = structuredClone(validEmpty)
  badRefAndSecret.connections = [{ id: "w_ghost", from_part_id: "ghost", from_pin_id: "5v", to_part_id: "uno", to_pin_id: "gnd", from: "ghost:5v", to: "uno:gnd", color: "red", status: "complete" }]
  badRefAndSecret.secret_api_token = "leak"
  badRefAndSecret.diagnostics.health_score = 100
  const check = validateCanonicalCircuitContextV3(badRefAndSecret)
  assert.equal(check.valid, false)
  assert.ok(check.errors.length >= 3)
})

test("Phase C3: LiveCircuitContextBridge filters non-semantic noise, coalesces hover, and triggers resync after failure", async () => {
  const sent = []
  let failNext = true
  const bridge = new LiveCircuitContextBridge(
    async (req) => {
      sent.push(req)
      if (failNext) {
        failNext = false
        return { success: false }
      }
      return { success: true }
    },
    { coalesceMs: 10 },
  )

  const snap = buildCanonicalCircuitContextV3({
    circuit: { parts: [], wires: [] },
    circuitContext: serializeCircuitContext({ parts: [], wires: [] }),
    sessionId: "s-bridge",
    circuitRevision: 1,
    interactionRevision: 1,
  })

  assert.equal(bridge.shouldTransmitEvent("wire_start"), true)
  assert.equal(bridge.shouldTransmitEvent("hovered_component"), false)

  bridge.enqueueLifecycleEvent(
    {
      event_id: "ev-1",
      event_seq: 1,
      event_type: "wire_start",
      session_id: "s-bridge",
      circuit_revision: 1,
      interaction_revision: 1,
      occurred_at: new Date().toISOString(),
      payload: {},
    },
    snap,
  )
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(sent.length, 1)
  assert.equal(bridge.getSyncMetadata().needsResync, true)

  // Next semantic event must automatically upgrade to full circuit_snapshot for reconciliation
  bridge.enqueueLifecycleEvent(
    {
      event_id: "ev-2",
      event_seq: 2,
      event_type: "wire_cancel",
      session_id: "s-bridge",
      circuit_revision: 1,
      interaction_revision: 2,
      occurred_at: new Date().toISOString(),
      payload: {},
    },
    snap,
  )
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(sent.length, 2)
  assert.equal(sent[1].eventType, "circuit_snapshot")
  assert.equal(bridge.getSyncMetadata().needsResync, false)
  bridge.dispose()
})

test("Phase E/F1: Query routing covers live wiring and instruments without breaking Physics queries", () => {
  assert.equal(isCircuitSpecificQuery("What am I connecting right now?"), true)
  assert.equal(isCircuitSpecificQuery("Why won't my draft wire attach?"), true)
  assert.equal(isCircuitSpecificQuery("What is the multimeter voltage reading?"), true)
  assert.equal(isCircuitSpecificQuery("What is kinetic energy?"), false)
  assert.equal(isCircuitSpecificQuery("BHAI KINETIC ENERFY AK FORMULA"), false)
})

test("Phase E/F2: CircuitCopilotChat shows Xen identity, empty state, offline local label, and stale warning on text replies", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "https://portal.example/simulation",
  })
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  const prevElement = globalThis.Element
  const prevHTMLElement = globalThis.HTMLElement
  const prevNode = globalThis.Node
  const prevDOMParser = globalThis.DOMParser
  const prevFetch = globalThis.fetch

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.Node = dom.window.Node
  globalThis.DOMParser = dom.window.DOMParser
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}

  const srcDir = new URL("../../src", import.meta.url).pathname
  const uiBundle = await build({
    stdin: {
      contents: `
        export { createElement } from 'react';
        export { createRoot } from 'react-dom/client';
        export { CircuitCopilotChat, buildCleanCopilotHistory } from './components/circuit-lab/circuit-copilot-chat.tsx';
        export { CircuitDoctorHud } from './components/circuit-lab/circuit-doctor-hud.tsx';
      `,
      resolveDir: srcDir,
    },
    bundle: true,
    jsx: "automatic",
    format: "esm",
    write: false,
    platform: "browser",
    define: { "import.meta.env": JSON.stringify({ DEV: false }) },
    alias: { "@": srcDir },
  })
  const b64 = Buffer.from(uiBundle.outputFiles[0].text, "utf8").toString("base64")
  const { createElement, createRoot, CircuitCopilotChat, buildCleanCopilotHistory, CircuitDoctorHud } = await import(`data:text/javascript;base64,${b64}`)

  globalThis.fetch = async (url) => {
    const p = new URL(url, "https://portal.example").pathname
    if (p.endsWith("/xen/chat")) {
      return Response.json({ status: "queued", job_id: "offline-test", worker_available: false, queue_position: 1 }, { status: 202 })
    }
    if (p.includes("/chunks")) {
      return Response.json({ status: "queued", worker_available: false, queue_position: 1, chunks: [] })
    }
    return Response.json({})
  }

  const root = createRoot(document.getElementById("root"))
  const until = async (pred, timeout = 2000) => {
    const start = Date.now()
    while (!pred()) {
      if (Date.now() - start > timeout) throw new Error("Timed out waiting for condition")
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  try {
    // 1. Empty canvas -> Empty badge, Xen panel label, zero "100%" or "8square AI"
    root.render(
      createElement(CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: { parts: [], wires: [] },
        circuitRevision: 0,
        interactionRevision: 0,
        userRole: "trainer",
        offlineTimeoutMs: 80,
      }),
    )
    await until(() => document.querySelector('[aria-label="Xen Circuit Copilot Panel"]'))
    assert.ok(document.body.textContent.includes("Empty"))
    assert.doesNotMatch(document.body.textContent, /8square AI/i)
    assert.doesNotMatch(document.body.textContent, /100%/)
    assert.ok(document.querySelector('[data-response-source="local_educational_fallback"]'), "Welcome greeting records local educational provenance")

    // Trigger query on empty canvas with offline GPU worker -> explicit local fallback notice + empty truth
    const ta = document.querySelector('[placeholder*="Ask about"]') || document.querySelector("textarea")
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), "value").set
    setter.call(ta, "Check my circuit")
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    await until(() => {
      const btn = document.querySelector('[aria-label="Send message"]')
      return btn && !btn.disabled
    })
    document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))

    await until(() => document.body.textContent.includes("Xen model is unavailable"))
    assert.match(document.body.textContent, /0 components placed/i)
    assert.doesNotMatch(document.body.textContent, /100\/100|connections are intact/i)
    const fallbackNodes = document.querySelectorAll('[data-response-source="local_circuit_engine"]')
    assert.equal(fallbackNodes.length, 1)
    assert.equal(fallbackNodes[0].dataset.diagnosticState, 'EMPTY_CANVAS')
    assert.ok(document.body.textContent.includes("Local Circuit Engine"))

    // 2. Advance interactionRevision (e.g. wire started/hovered) -> text-only reply must show stale-context notice & Not Wired badge!
    root.render(
      createElement(CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: { parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }], wires: [] },
        circuitRevision: 1,
        interactionRevision: 1,
        userRole: "trainer",
        offlineTimeoutMs: 80,
      }),
    )
    await until(() => document.body.textContent.includes("Not Wired"))
    await until(() => document.body.textContent.includes("Canvas or live wiring state changed after this reply"))
    assert.doesNotMatch(document.body.textContent, /100%/)

    // 3. Offline academic query has its own provenance and a bounded local explanation.
    setter.call(ta, "What is kinetic energy?")
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    await until(() => {
      const btn = document.querySelector('[aria-label="Send message"]')
      return btn && !btn.disabled
    })
    document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
    await until(() => document.body.textContent.includes("Kinetic energy is the energy of motion"))
    const education = [...document.querySelectorAll('[data-response-source="local_educational_fallback"]')].at(-1)
    assert.match(education.textContent, /Xen is unavailable/)
    assert.match(education.textContent, /doubling speed gives four times/)

    // 4. Online Xen Step-700 response and cached response record distinct response_source + job_id
    let callMode = "live"
    globalThis.fetch = async (url) => {
      const p = new URL(url, "https://portal.example").pathname
      if (p.endsWith("/xen/chat")) {
        if (callMode === "cache") {
          return Response.json({
            status: "completed",
            job_id: "cached-job-99",
            worker_id: "kaggle-dual-t4-811fd9cd",
            cached: true,
            provenance: {
              response_source: "cache",
              job_id: "cached-job-99",
              worker_id: "kaggle-dual-t4-811fd9cd",
              session_id: "sess-ui-prov",
              circuit_revision: 1,
              context_schema_version: "3.0",
              response_status: "cached",
              fallback_reason: null,
            },
            response: { text: "Cached board explanation.", is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
          })
        }
        return Response.json({ status: "queued", job_id: "live-job-88", worker_available: true, queue_position: 1 }, { status: 202 })
      }
      if (p.includes("/chunks")) {
        return Response.json({
          status: "completed",
          job_id: "live-job-88",
          worker_id: "kaggle-dual-t4-811fd9cd",
          is_complete: true,
          worker_available: true,
          provenance: {
            response_source: "xen_step700",
            job_id: "live-job-88",
            worker_id: "kaggle-dual-t4-811fd9cd",
            session_id: "sess-ui-prov",
            circuit_revision: 1,
            context_schema_version: "3.0",
            response_status: "completed",
            fallback_reason: null,
          },
          response: { text: "Arduino Uno placed with 0 wires.", is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
        })
      }
      return Response.json({})
    }

    setter.call(ta, "Which board is placed?")
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    await until(() => {
      const btn = document.querySelector('[aria-label="Send message"]')
      return btn && !btn.disabled
    })
    document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
    await until(() => document.querySelector('[data-response-source="xen_step_700"][data-job-id="live-job-88"]'))

    callMode = "cache"
    setter.call(ta, "Check board again")
    ta.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    await until(() => {
      const btn = document.querySelector('[aria-label="Send message"]')
      return btn && !btn.disabled
    })
    document.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
    await until(() => document.querySelector('[data-response-source="cache"][data-job-id="cached-job-99"]'))
    assert.ok(document.body.textContent.includes("Cached response"))

    // 5. CircuitDoctorHud never displays 100% or "No issues found" on empty or unwired reports
    root.render(
      createElement(CircuitDoctorHud, {
        isOpen: true,
        report: { score: null, status: "empty", issues: [], criticalCount: 0, warningCount: 0, tipCount: 0, isEmpty: true },
      }),
    )
    await until(() => document.body.textContent.includes("Empty Canvas"))
    assert.match(document.body.textContent, /health score N\/A/i)
    assert.doesNotMatch(document.body.textContent, /100%|No .*issues found/i)

    root.render(
      createElement(CircuitDoctorHud, {
        isOpen: true,
        report: { score: null, status: "unwired", issues: [], criticalCount: 0, warningCount: 0, tipCount: 0, isEmpty: false },
      }),
    )
    await until(() => document.body.textContent.includes("Not Wired"))
    assert.match(document.body.textContent, /not wired yet/i)
    assert.doesNotMatch(document.body.textContent, /100%|No .*issues found/i)
  } finally {
    root.unmount()
    await new Promise((r) => setTimeout(r, 30))
    globalThis.window = prevWindow
    globalThis.document = prevDocument
    globalThis.Element = prevElement
    globalThis.HTMLElement = prevHTMLElement
    globalThis.Node = prevNode
    globalThis.DOMParser = prevDOMParser
    globalThis.fetch = prevFetch
    dom.window.close()
  }
})

test("Phase 2: V3 snapshot includes deterministic resistor_terminals/cross_layer_led and buildCleanCopilotHistory excludes poisoned/error turns", async () => {
  const circuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 100, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 200, y: 100, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 320, y: 100, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#000" },
    ],
  }
  const ctx = serializeCircuitContext(circuit, {
    blocklyXml: '<xml><block type="arduino_digital_write"><field name="PIN">5</field></block></xml>',
    generatedCode: "digitalWrite(5, HIGH);",
    running: false,
  })
  const v3 = buildCanonicalCircuitContextV3({
    circuit,
    circuitContext: ctx,
    sessionId: "sess-p2-ui",
    circuitRevision: 7,
    interactionRevision: 2,
    eventSeq: 4,
    generatedCode: "digitalWrite(5, HIGH);",
    running: false,
  })
  assert.equal(validateCanonicalCircuitContextV3(v3).valid, true)
  assert.equal(v3.resistor_terminals.length, 1)
  assert.deepEqual(v3.resistor_terminals[0].terminal_a.direct_peers, ["uno:d9"])
  assert.deepEqual(v3.resistor_terminals[0].terminal_b.direct_peers, ["led1:anode"])
  assert.equal(v3.cross_layer_led.length, 1)
  assert.deepEqual(v3.cross_layer_led[0].physical_pins, ["d9"])
  assert.deepEqual(v3.cross_layer_led[0].code_pins, ["d5"])
  assert.equal(v3.cross_layer_led[0].matches_physical_pin, false)
  assert.equal(v3.cross_layer_led[0].observed_state, "stopped_not_running")

  const srcDir = new URL("../../src", import.meta.url).pathname
  const helperBundle = await build({
    stdin: {
      contents: `export { buildCleanCopilotHistory } from './components/circuit-lab/circuit-copilot-chat.tsx';`,
      resolveDir: srcDir,
    },
    bundle: true,
    jsx: "automatic",
    format: "esm",
    write: false,
    platform: "browser",
    define: { "import.meta.env": JSON.stringify({ DEV: false }) },
    alias: { "@": srcDir },
  })
  const hb64 = Buffer.from(helperBundle.outputFiles[0].text, "utf8").toString("base64")
  const { buildCleanCopilotHistory } = await import(`data:text/javascript;base64,${hb64}`)

  const cleaned = buildCleanCopilotHistory([
    { id: "welcome_1", role: "assistant", text: "Welcome", timestamp: 1 },
    { id: "u1", role: "user", text: "Check my circuit", timestamp: 2 },
    { id: "a_bad", role: "assistant", text: "Hallucinated 100/100", groundingVerified: false, timestamp: 3, baseCircuitRev: 1 },
    { id: "a_err", role: "assistant", text: "Offline error", source: "offline_unavailable", provenance: { response_source: "error" }, timestamp: 4 },
    { id: "u2", role: "user", text: "Check resistor", timestamp: 5 },
    { id: "a_ok", role: "assistant", text: "r1 connects d9 to led1", source: "xen", baseCircuitRev: 7, groundingVerified: true, timestamp: 6 },
  ])
  assert.equal(cleaned.length, 2)
  assert.equal(cleaned[0].role, "user")
  assert.equal(cleaned[0].content, "Check resistor")
  assert.equal(cleaned[1].role, "assistant")
  assert.equal(cleaned[1].provenance.circuit_revision, 7)
  assert.equal(cleaned[1].provenance.grounding_verified, true)
})


