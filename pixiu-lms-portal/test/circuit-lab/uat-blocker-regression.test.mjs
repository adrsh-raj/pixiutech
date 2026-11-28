/**
 * PIXIU TECH CYBERLAB — HUMAN UAT BLOCKER REGRESSION SUITE (B1–B10)
 *
 * Covers frontend health scoring, static reverse-polarity & code-to-pin detection,
 * component endpoint artwork & net resolution, repair deduplication & validation,
 * mounted Apply Fix & Undo Repair lifecycle, stopped simulator honesty, and Xen branding.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { JSDOM } from "jsdom"

const srcDir = fileURLToPath(new URL("../../src", import.meta.url))
const bundleDir = join(tmpdir(), `uat-blocker-reg-${Date.now()}`)

await build({
  entryPoints: {
    intel: join(srcDir, "lib/circuit-intelligence.ts"),
    doctor: join(srcDir, "lib/circuit-doctor.ts"),
    validator: join(srcDir, "lib/circuit-validator.ts"),
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
  alias: { "@": srcDir },
})

const { diagnoseCircuit } = await import(`file://${join(bundleDir, "doctor.js")}`)
const { validateProposedCircuit, computeCircuitHash } = await import(`file://${join(bundleDir, "validator.js")}`)
const {
  serializeCircuitContext,
  diagnoseCircuitIntelligence,
  generateCircuitRepairProposal,
  verifyCircuitWithSimulator,
  processCircuitCopilotQuery,
  buildEndpointNetLookup,
} = await import(`file://${join(bundleDir, "intel.js")}`)

const uiBundle = await build({
  stdin: {
    contents: `
      import React, { useState, useMemo, useCallback } from 'react';
      export { React, useState, useMemo, useCallback };
      export { createElement } from 'react';
      export { createRoot } from 'react-dom/client';
      export { CircuitDoctorHud } from './components/circuit-lab/circuit-doctor-hud.tsx';
      export { CircuitCopilotChat } from './components/circuit-lab/circuit-copilot-chat.tsx';
      export { useCircuitCopilotAction } from './components/circuit-lab/use-circuit-copilot-action.ts';
      export { PartArt } from './components/circuit-lab/part-art.tsx';
      export { Multimeter } from './components/circuit-lab/multimeter.tsx';
      export { diagnoseCircuit } from './lib/circuit-doctor.ts';
      export { computeCircuitHash } from './lib/circuit-validator.ts';
    `,
    resolveDir: srcDir,
  },
  bundle: true,
  jsx: "automatic",
  format: "esm",
  write: false,
  platform: "browser",
  define: { "import.meta.env": JSON.stringify({ DEV: false }), "process.env.NODE_ENV": '"development"' },
  alias: { "@": srcDir },
})

const uiBundleUrl = `data:text/javascript;base64,${Buffer.from(uiBundle.outputFiles[0].contents).toString("base64")}`
let cachedUiMod = null

function withDom(fn) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "https://portal.example/simulation",
  })
  const { window } = dom
  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    DOMParser: globalThis.DOMParser,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    SVGElement: globalThis.SVGElement,
    Event: globalThis.Event,
    fetch: globalThis.fetch,
    AudioContext: globalThis.AudioContext,
  }
  Object.assign(globalThis, {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    Event: window.Event,
  })
  window.HTMLElement.prototype.scrollIntoView = () => {}
  window.HTMLElement.prototype.setPointerCapture = () => {}
  window.HTMLElement.prototype.releasePointerCapture = () => {}
  return Promise.resolve()
    .then(async () => {
      if (!cachedUiMod) cachedUiMod = await import(uiBundleUrl)
      return fn(dom, cachedUiMod)
    })
    .finally(async () => {
      await new Promise((r) => setTimeout(r, 25))
      Object.assign(globalThis, prev)
      dom.window.close()
    })
}

async function waitUntil(pred, timeout = 3000) {
  const deadline = Date.now() + timeout
  while (!pred()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for DOM condition: ${document.body.textContent?.slice(-500)}`)
    await new Promise((r) => setTimeout(r, 15))
  }
}

test("UAT-B1: Empty canvas reports null/N/A score and Empty Canvas HUD (never All Clear or 100%)", async () => {
  const empty = { parts: [], wires: [] }
  const report = diagnoseCircuit(empty)
  assert.equal(report.score, null)
  assert.equal(report.status, "empty")
  assert.equal(report.isEmpty, true)

  await withDom(async (_dom, uiMod) => {
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(uiMod.createElement(uiMod.CircuitDoctorHud, { report, isOpen: true, onClose: () => {} }))
      await waitUntil(() => document.body.textContent.includes("Empty Canvas"))
      assert.doesNotMatch(document.body.textContent, /All Clear|100%/i)
      assert.match(document.body.textContent, /N\/A/)
    } finally {
      root.unmount()
    }
  })
})

test("UAT-B3: Missing GND / disconnected LED cathode scores <100 (danger, never All Clear) in Doctor & context", async () => {
  const missingGndCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }

  const report = diagnoseCircuit(missingGndCircuit, {}, {})
  assert.ok(report.score !== null && report.score < 100, `Expected < 100, got ${report.score}`)
  assert.equal(report.status, "danger")
  assert.ok(report.criticalCount >= 1)

  const ctx = serializeCircuitContext(missingGndCircuit, { running: false })
  assert.ok(ctx.healthReport.score !== null && ctx.healthReport.score < 100)
  assert.ok(ctx.healthReport.criticalCount >= 1)

  await withDom(async (_dom, uiMod) => {
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(uiMod.createElement(uiMod.CircuitDoctorHud, { report, isOpen: true, onClose: () => {} }))
      await waitUntil(() => document.body.textContent.includes("Missing Ground Return on LED"))
      assert.doesNotMatch(document.body.textContent, /All Clear|100%/i)
    } finally {
      root.unmount()
    }
  })
})

test("UAT-B8: Physical D9 vs Blockly D5 code mismatch scores <100 (danger, never All Clear)", async () => {
  const mismatchCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const blocklyXml = '<xml><block type="digital_write"><field name="PIN">D5</field></block></xml>'

  const report = diagnoseCircuit(mismatchCircuit, {}, {}, { blocklyXml })
  assert.ok(report.score !== null && report.score < 100, `Expected < 100 on pin mismatch, got ${report.score}`)
  assert.equal(report.status, "danger")
  assert.ok(report.issues.some((i) => i.id === "code-pin-mismatch-d5"))

  await withDom(async (_dom, uiMod) => {
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(uiMod.createElement(uiMod.CircuitDoctorHud, { report, isOpen: true, onClose: () => {} }))
      await waitUntil(() => document.body.textContent.includes("Pin Mismatch"))
      assert.doesNotMatch(document.body.textContent, /All Clear|100%/i)
    } finally {
      root.unmount()
    }
  })
})

test("UAT-B7: Reversed LED polarity scores <100 when stopped (both source-side and ground-side resistor)", () => {
  // Topology A: resistor on GPIO/cathode side, anode directly on GND
  const revDirectGnd = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "cathode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "anode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const repA = diagnoseCircuit(revDirectGnd, {}, {}) // stopped: runtime={}
  assert.ok(repA.score !== null && repA.score < 100)
  assert.equal(repA.status, "danger")
  assert.ok(repA.issues.some((i) => i.id === "led-rev-pol-led1"))

  // Topology B: resistor on anode->GND leg, cathode directly on D13
  const revGndSideRes = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "led1", pinId: "cathode" }, color: "red" },
      { id: "w2", from: { partId: "led1", pinId: "anode" }, to: { partId: "r1", pinId: "a" }, color: "black" },
      { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const repB = diagnoseCircuit(revGndSideRes, {}, {})
  assert.ok(repB.score !== null && repB.score < 100)
  assert.equal(repB.status, "danger")
  assert.ok(repB.issues.some((i) => i.id === "led-rev-pol-led1"))

  const faultsB = diagnoseCircuitIntelligence(serializeCircuitContext(revGndSideRes, { running: false }))
  assert.ok(faultsB.some((f) => f.classification === "REVERSED_LED_POLARITY"))
})

test("UAT-B4: LED polarity +/- markers and Resistor T1/T2 artwork + independent net lookup", async () => {
  await withDom(async (_dom, uiMod) => {
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(
        uiMod.createElement(
          "svg",
          null,
          uiMod.createElement(uiMod.PartArt, { part: { id: "led1", type: "led", x: 0, y: 0, rotation: 0, props: { color: "red" } } }),
          uiMod.createElement(uiMod.PartArt, { part: { id: "r1", type: "resistor", x: 0, y: 0, rotation: 0, props: { resistance: 220 } } }),
        ),
      )
      await waitUntil(() => document.body.textContent.includes("T1"))
      const txt = document.body.textContent
      assert.ok(txt.includes("+") && txt.includes("−"), "LED artwork must render + and − polarity symbols")
      assert.ok(txt.includes("T1") && txt.includes("T2"), "Resistor artwork must render T1 and T2 labels")
    } finally {
      root.unmount()
    }
  })

  const revLedCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 100, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 200, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "cathode" }, color: "red" },
      { id: "w3", from: { partId: "led1", pinId: "anode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const { resistorTerminals, endpointLookup } = buildEndpointNetLookup(revLedCircuit)
  assert.ok(resistorTerminals[0].terminalA.directPeers.includes("uno:d9"))
  assert.ok(resistorTerminals[0].terminalB.directPeers.includes("led1:cathode"))
  const ctxRevLed = serializeCircuitContext(revLedCircuit)
  assert.ok(ctxRevLed.resistorTerminals[0].terminalA.boardPins.includes("uno:d9"))
  assert.equal(ctxRevLed.endpointLookup["led1:anode"].isGroundRail, true)
  assert.equal(ctxRevLed.endpointLookup["led1:cathode"].isGroundRail, false)
  assert.equal(Boolean(endpointLookup["led1:anode"]?.isConnected), true)
})

test("UAT-B5 & B6: Repair deduplicates wires on MISSING_GROUND+OPEN_CIRCUIT, aligns D9->D5 1:1, and validator rejects duplicates", () => {
  // 1. Missing GND / Open cathode double-fault must produce ONLY ONE cathode->gnd wire
  const openLedCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }
  const ctxOpen = serializeCircuitContext(openLedCircuit, { running: true })
  const faultsOpen = diagnoseCircuitIntelligence(ctxOpen)
  assert.ok(faultsOpen.some((f) => f.classification === "OPEN_CIRCUIT"))
  assert.ok(faultsOpen.some((f) => f.classification === "MISSING_GROUND"))

  const propOpen = generateCircuitRepairProposal(openLedCircuit, faultsOpen, "h1")
  const cathodeConnects = propOpen.actions.filter((a) => a.type === "connect" && a.from === "led1:cathode")
  assert.equal(cathodeConnects.length, 1, `Expected 1 cathode->gnd action, got ${propOpen.actions.length}`)
  assert.equal(propOpen.repairedCircuit.wires.length, 3, "Repaired circuit must contain exactly 3 wires")

  // Idempotency: running diagnosis+repair again produces 0 redundant wires
  const ctxAfter = serializeCircuitContext(propOpen.repairedCircuit, { running: true })
  const propSecond = generateCircuitRepairProposal(propOpen.repairedCircuit, diagnoseCircuitIntelligence(ctxAfter), "h2")
  assert.equal(propSecond.actions.length, 0)
  assert.equal(propSecond.repairedCircuit.wires.length, 3)

  // Validator rejects explicit duplicate undirected wires (reversed direction / alias)
  const dupCandidate = {
    parts: openLedCircuit.parts,
    wires: [
      ...propOpen.repairedCircuit.wires,
      { id: "w_dup", from: { partId: "uno", pinId: "gnd" }, to: { partId: "led1", pinId: "cathode" }, color: "black" },
    ],
  }
  const dupVal = validateProposedCircuit(dupCandidate)
  assert.equal(dupVal.valid, false)
  assert.ok(dupVal.notices.some((n) => n.ruleId.startsWith("schema-duplicate-wire-")))

  // 2. CODE_PIN_MISMATCH D9 vs D5 alignment: suggestedRepair aligns with physical move and repair fixes Doctor score
  const d9Circuit = {
    parts: openLedCircuit.parts,
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "green" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const blocklyXml = '<xml><block type="digital_write"><field name="PIN">D5</field></block></xml>'
  const ctxD9 = serializeCircuitContext(d9Circuit, { blocklyXml })
  const faultsD9 = diagnoseCircuitIntelligence(ctxD9)
  const mmFault = faultsD9.find((f) => f.classification === "CODE_PIN_MISMATCH")
  assert.ok(mmFault)
  assert.doesNotMatch(mmFault.suggestedRepair, /or update the program/i)
  const propD9 = generateCircuitRepairProposal(d9Circuit, faultsD9, "h_d9", blocklyXml)
  assert.ok(propD9.actions.some((a) => a.type === "disconnect" && a.wireId === "w1"))
  assert.ok(propD9.actions.some((a) => a.type === "connect" && a.from === "uno:d5"))
  const verD9 = verifyCircuitWithSimulator(d9Circuit, propD9.repairedCircuit, {}, blocklyXml)
  assert.equal(verD9.verified, true)
  const afterDoc = diagnoseCircuit(propD9.repairedCircuit, {}, {}, { blocklyXml })
  assert.equal(afterDoc.score, 100)
})

test("UAT-MultiRev: Same circuit across rev1 (faulted) -> rev2 (aligned) -> rev3 (missing GND) updates deterministically", () => {
  const xml = '<xml><block type="digital_write"><field name="PIN">D5</field></block></xml>'
  const rev1 = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 100, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 200, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d9" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "green" },
      { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
    ],
  }
  const rev2 = {
    ...rev1,
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "d5" }, to: { partId: "r1", pinId: "a" }, color: "green" },
      rev1.wires[1],
      rev1.wires[2],
    ],
  }
  const rev3 = { ...rev2, wires: [rev2.wires[0], rev2.wires[1]] }

  assert.equal(diagnoseCircuit(rev1, {}, {}, { blocklyXml: xml }).score, 65)
  assert.equal(diagnoseCircuit(rev2, {}, {}, { blocklyXml: xml }).score, 100)
  assert.equal(diagnoseCircuit(rev3, {}, {}, { blocklyXml: xml }).score, 65)
  assert.notEqual(computeCircuitHash(rev1, xml), computeCircuitHash(rev2, xml))
  assert.notEqual(computeCircuitHash(rev2, xml), computeCircuitHash(rev3, xml))
})

test("UAT-B2, B6 & B9 Mounted Chat: Xen branding (zero 8square), Apply Fix deduplicated, and Undo Repair restores exact pre-repair topology", async () => {
  const initialCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 120, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 240, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }
  const initialHash = computeCircuitHash(initialCircuit, "<xml/>")

  await withDom(async (_dom, uiMod) => {
    globalThis.fetch = async (url) => {
      const p = new URL(url, "https://portal.example").pathname
      if (p.endsWith("/xen/chat")) {
        return Response.json({ status: "queued", job_id: "offline-uat", worker_available: false, queue_position: 1 }, { status: 202 })
      }
      return Response.json({ status: "queued", worker_available: false, queue_position: 1, chunks: [] })
    }

    let latestState = { circuit: initialCircuit, rev: 1, hash: initialHash }

    function Harness() {
      const [circuit, setCircuit] = uiMod.useState(initialCircuit)
      const [xml, setXml] = uiMod.useState("<xml/>")
      const [rev, setRev] = uiMod.useState(1)
      const onApplyCircuit = uiMod.useCallback((nextCircuit, nextXml) => {
        setCircuit(nextCircuit)
        if (typeof nextXml === "string") setXml(nextXml)
        setRev((r) => {
          const nr = r + 1
          latestState = { circuit: nextCircuit, rev: nr, hash: uiMod.computeCircuitHash(nextCircuit, nextXml || xml) }
          return nr
        })
      }, [xml])

      const copilotAction = uiMod.useCircuitCopilotAction({
        currentCircuit: circuit,
        currentBlocklyXml: xml,
        onApplyCircuit,
      })

      return uiMod.createElement(uiMod.CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: circuit,
        currentBlocklyXml: xml,
        circuitRevision: rev,
        interactionRevision: 0,
        copilotAction,
        userRole: "trainer",
        offlineTimeoutMs: 40,
      })
    }

    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(uiMod.createElement(Harness))
      await waitUntil(() => document.body.textContent.includes("Circuit Copilot"))
      // B2 / #16: zero 8square anywhere in rendered DOM
      assert.doesNotMatch(document.body.textContent, /8square/i, "Rendered UI must not show legacy 8square branding")
      assert.ok(document.body.textContent.includes("Xen"))

      // Trigger missing-GND query
      const input = document.querySelector('[placeholder*="Ask about"]')
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set
      setter.call(input, "Why is my LED off?")
      input.dispatchEvent(new window.Event("input", { bubbles: true }))
      await waitUntil(() => !document.querySelector('[aria-label="Send message"]').disabled)
      document.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }))

      await waitUntil(() => document.body.textContent.includes("Apply Fix to Canvas"))
      // Verify ONLY ONE + WIRE card line rendered
      const wireBadges = Array.from(document.querySelectorAll("span")).filter((s) => s.textContent?.includes("+ WIRE"))
      assert.equal(wireBadges.length, 1, "Proposal card must render exactly 1 + WIRE operation")

      // Click Apply Fix to Canvas
      const applyBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Apply Fix to Canvas"))
      assert.ok(applyBtn)
      applyBtn.click()
      await waitUntil(() => document.body.textContent.includes("Undo Repair"))
      assert.equal(latestState.circuit.wires.length, 3, "Applied fix must produce exactly 3 wires")
      assert.equal(document.body.textContent.includes("Applied"), true)

      // Click Undo Repair (verifies handleUndoFix -> undoAction works without crashing)
      const undoBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Undo Repair"))
      assert.ok(undoBtn)
      undoBtn.click()
      await waitUntil(() => document.body.textContent.includes("Apply Fix to Canvas"))
      assert.equal(latestState.circuit.wires.length, 2, "Undo must restore exact 2-wire pre-repair topology")
      assert.equal(latestState.hash, initialHash, "Undo must restore exact initial circuit hash")
    } finally {
      root.unmount()
    }
  })
})

test("UAT-B9 Stopped Multimeter Honesty: renders Stopped badge when running=false", async () => {
  await withDom(async (_dom, uiMod) => {
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(
        uiMod.createElement(uiMod.Multimeter, {
          isOpen: true,
          onClose: () => {},
          state: { parts: [], wires: [] },
          runtime: {},
          pinStates: {},
          pressed: new Set(),
          running: false,
          probeRed: null,
          probeBlack: null,
          onSetProbeRed: () => {},
          onSetProbeBlack: () => {},
          activeProbeToPlace: null,
          onSetActiveProbeToPlace: () => {},
        }),
      )
      await waitUntil(() => document.body.textContent.includes("Digital Multimeter"))
      assert.ok(document.body.textContent.includes("Stopped"), "Stopped multimeter must show Stopped badge")
      assert.doesNotMatch(document.body.textContent, /MNA\s*·\s*Live/i)
    } finally {
      root.unmount()
    }
  })
})

test("UAT-B5/B6 Proposal Guard: useCircuitCopilotAction refuses duplicate-wire proposal and never marks applied", async () => {
  const baseCircuit = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} },
      { id: "r1", type: "resistor", x: 100, y: 0, rotation: 0, props: { resistance: 220 } },
      { id: "led1", type: "led", x: 200, y: 0, rotation: 0, props: { color: "red" } },
    ],
    wires: [
      { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "r1", pinId: "a" }, color: "red" },
      { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "red" },
    ],
  }
  const baseHash = computeCircuitHash(baseCircuit, "<xml/>")

  await withDom(async (_dom, uiMod) => {
    let applyCalls = 0
    let hookApi = null
    function Probe() {
      hookApi = uiMod.useCircuitCopilotAction({
        currentCircuit: baseCircuit,
        currentBlocklyXml: "<xml/>",
        onApplyCircuit: () => {
          applyCalls += 1
        },
      })
      return uiMod.createElement("div", null, hookApi.state)
    }
    const root = uiMod.createRoot(document.getElementById("root"))
    try {
      root.render(uiMod.createElement(Probe))
      await waitUntil(() => hookApi !== null)
      const dupProposal = {
        id: "dup_test",
        title: "Invalid Duplicate Repair",
        rationale: "Contains duplicate cathode wires",
        baseRevisionHash: baseHash,
        circuit: {
          parts: baseCircuit.parts,
          wires: [
            ...baseCircuit.wires,
            { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "black" },
            { id: "w4", from: { partId: "uno", pinId: "gnd" }, to: { partId: "led1", pinId: "cathode" }, color: "black" },
          ],
        },
      }
      const resStage = hookApi.proposeAction(dupProposal)
      assert.equal(resStage.valid, false)
      const applied = hookApi.applyProposal(dupProposal)
      assert.equal(applied, false)
      assert.equal(applyCalls, 0)
      await waitUntil(() => document.body.textContent.includes("rejected"))
    } finally {
      root.unmount()
    }
  })
})
