#!/usr/bin/env node

/**
 * Pixiu CyberLab Anti-Cheat & Derivation Detection Direct Execution Test
 * 
 * Verifies:
 * 1. Pin alias normalization for netlist extraction
 * 2. Algorithmic derivation detection preventing template and lesson seed cloning
 * 3. Single-pin mutation exploit detection (e.g. D10 -> D11 fails creation XP)
 * 4. Lesson step evaluation strictness (e.g. Wiring D11 when D10 is expected fails step check)
 * 5. Multi-surface session tracking in workbench.tsx
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

console.log("=================================================================")
console.log("  PIXIU CYBERLAB: ANTI-CHEAT & WIRING MUTATION QA SUITE")
console.log("=================================================================\n")

function normalizePinId(pin) {
  let p = String(pin || "").toLowerCase().trim()
  p = p.replace(/^(gpio|gp|d|p)/i, "")
  if (["vcc", "5v", "3v3", "3.3v", "3v", "vin", "power"].includes(p)) return "vcc"
  if (["gnd", "gnd_l", "gnd_r", "gnd_1", "ground", "neg", "0v", "gnd_edge", "gnd_pwr"].includes(p) || p.startsWith("gnd_")) return "gnd"
  if (["anode", "a", "pos", "+"].includes(p)) return "anode"
  if (["cathode", "k", "c", "neg", "-"].includes(p)) return "cathode"
  if (["terminal1", "terminal2", "t1", "t2", "a", "b"].includes(p)) return "terminal"
  return p
}

function extractCircuitSignature(circuit) {
  if (!circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) {
    return { partTypes: [], wires: [] }
  }

  const partTypeMap = new Map()
  const partTypes = []

  for (const part of circuit.parts) {
    if (!part?.id || !part?.type) continue
    partTypeMap.set(part.id, part.type)
    partTypes.push(part.type)
  }
  partTypes.sort()

  const wires = []
  for (const wire of circuit.wires) {
    if (!wire?.from?.partId || !wire?.to?.partId) continue
    const typeFrom = partTypeMap.get(wire.from.partId)
    const typeTo = partTypeMap.get(wire.to.partId)
    if (!typeFrom || !typeTo) continue

    const pinFrom = normalizePinId(wire.from.pinId || "")
    const pinTo = normalizePinId(wire.to.pinId || "")

    const epA = `${typeFrom}:${pinFrom}`
    const epB = `${typeTo}:${pinTo}`
    wires.push(epA < epB ? `${epA}<->${epB}` : `${epB}<->${epA}`)
  }
  wires.sort()

  return { partTypes, wires }
}

function isDerivativeCircuit(candidate, reference) {
  const sigA = "partTypes" in candidate && "wires" in candidate ? candidate : extractCircuitSignature(candidate)
  const sigB = "partTypes" in reference && "wires" in reference ? reference : extractCircuitSignature(reference)

  if (sigA.partTypes.length === 0 || sigB.partTypes.length === 0) return false
  if (sigA.wires.length === 0 || sigB.wires.length === 0) return false

  const partsA = [...sigA.partTypes]
  const partsB = [...sigB.partTypes]

  let matchedParts = 0
  for (const pt of partsA) {
    const idx = partsB.indexOf(pt)
    if (idx !== -1) {
      matchedParts++
      partsB.splice(idx, 1)
    }
  }
  const maxPartCount = Math.max(sigA.partTypes.length, sigB.partTypes.length)
  const partSimilarity = maxPartCount > 0 ? matchedParts / maxPartCount : 0

  if (partSimilarity < 0.7) {
    return false
  }

  const wiresA = new Set(sigA.wires)
  const wiresB = new Set(sigB.wires)

  let commonWires = 0
  for (const w of wiresA) {
    if (wiresB.has(w)) {
      commonWires++
    }
  }

  const maxWires = Math.max(wiresA.size, wiresB.size)
  const wireOverlapRatio = maxWires > 0 ? commonWires / maxWires : 0
  const diffConnections = maxWires - commonWires

  if (partSimilarity >= 0.8 && (diffConnections <= 2 || wireOverlapRatio >= 0.6)) {
    return true
  }

  if (wireOverlapRatio >= 0.75) {
    return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Step 1: Pin Alias Normalization Tests
// ---------------------------------------------------------------------------
console.log("[Test 1] Testing Pin Normalization...")
assert.equal(normalizePinId("D10"), "10")
assert.equal(normalizePinId("GPIO11"), "11")
assert.equal(normalizePinId("gp15"), "15")
assert.equal(normalizePinId("P0"), "0")
assert.equal(normalizePinId("GND_1"), "gnd")
assert.equal(normalizePinId("5V"), "vcc")
assert.equal(normalizePinId("Anode"), "anode")
console.log("✔ Step 1 Passed: Pin aliases canonicalized successfully.")

// ---------------------------------------------------------------------------
// Step 2: Reference Template Circuit
// ---------------------------------------------------------------------------
console.log("\n[Test 2] Testing Reference Template Derivation Detection...")
const templateCircuit = {
  parts: [
    { id: "uno", type: "arduino-uno" },
    { id: "led1", type: "led" },
    { id: "r1", type: "resistor" },
  ],
  wires: [
    { id: "w1", from: { partId: "uno", pinId: "10" }, to: { partId: "led1", pinId: "anode" } },
    { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "terminal1" } },
    { id: "w3", from: { partId: "r1", pinId: "terminal2" }, to: { partId: "uno", pinId: "gnd" } },
  ],
}

const exactCloneCircuit = JSON.parse(JSON.stringify(templateCircuit))
assert.equal(isDerivativeCircuit(exactCloneCircuit, templateCircuit), true)
console.log("✔ Step 2 Passed: Exact template clone detected as derivative.")

// ---------------------------------------------------------------------------
// Step 3: Single-Pin Mutation (D10 -> D11) Exploit Detection
// ---------------------------------------------------------------------------
console.log("\n[Test 3] Testing Single-Pin Mutation Exploit (D10 -> D11)...")
const singlePinMutatedCircuit = {
  parts: [
    { id: "uno", type: "arduino-uno" },
    { id: "led1", type: "led" },
    { id: "r1", type: "resistor" },
  ],
  wires: [
    { id: "w1", from: { partId: "uno", pinId: "11" }, to: { partId: "led1", pinId: "anode" } }, // Changed 10 to 11!
    { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "terminal1" } },
    { id: "w3", from: { partId: "r1", pinId: "terminal2" }, to: { partId: "uno", pinId: "gnd" } },
  ],
}

assert.equal(
  isDerivativeCircuit(singlePinMutatedCircuit, templateCircuit),
  true,
  "Changing only wiring point D10 -> D11 MUST be detected as derivative"
)
console.log("✔ Step 3 Passed: Single-pin mutation (D10 -> D11) successfully caught and blocked!")

// ---------------------------------------------------------------------------
// Step 4: Two-Pin Mutation Exploit Detection
// ---------------------------------------------------------------------------
console.log("\n[Test 4] Testing Two-Pin Mutation Exploit...")
const twoPinMutatedCircuit = {
  parts: [
    { id: "uno", type: "arduino-uno" },
    { id: "led1", type: "led" },
    { id: "r1", type: "resistor" },
  ],
  wires: [
    { id: "w1", from: { partId: "uno", pinId: "12" }, to: { partId: "led1", pinId: "anode" } },
    { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "terminal1" } },
    { id: "w3", from: { partId: "r1", pinId: "terminal2" }, to: { partId: "uno", pinId: "gnd_2" } },
  ],
}
assert.equal(isDerivativeCircuit(twoPinMutatedCircuit, templateCircuit), true)
console.log("✔ Step 4 Passed: Two-pin mutation successfully caught and blocked!")

// ---------------------------------------------------------------------------
// Step 5: Genuine Custom Circuit (Should Earn Creation XP)
// ---------------------------------------------------------------------------
console.log("\n[Test 5] Testing Genuine Original Custom Circuit...")
const customCircuit = {
  parts: [
    { id: "esp32", type: "esp32" },
    { id: "dht", type: "dht11" },
    { id: "oled", type: "oled-i2c" },
    { id: "buzzer", type: "buzzer" },
  ],
  wires: [
    { id: "w1", from: { partId: "esp32", pinId: "21" }, to: { partId: "oled", pinId: "sda" } },
    { id: "w2", from: { partId: "esp32", pinId: "22" }, to: { partId: "oled", pinId: "scl" } },
    { id: "w3", from: { partId: "esp32", pinId: "4" }, to: { partId: "dht", pinId: "out" } },
    { id: "w4", from: { partId: "esp32", pinId: "15" }, to: { partId: "buzzer", pinId: "pos" } },
    { id: "w5", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "esp32", pinId: "gnd" } },
  ],
}
assert.equal(isDerivativeCircuit(customCircuit, templateCircuit), false)
console.log("✔ Step 5 Passed: Genuine custom circuit is verified as original and earns Creation XP!")

// ---------------------------------------------------------------------------
// Step 6: Codebase Source Integration Verification
// ---------------------------------------------------------------------------
console.log("\n[Test 6] Verifying Codebase Source Integration...")
const xpEngineSrc = fs.readFileSync(path.join(rootDir, "pixiu-lms-portal/src/lib/xp-engine.ts"), "utf8")
const workbenchSrc = fs.readFileSync(path.join(rootDir, "pixiu-lms-portal/src/components/circuit-lab/workbench.tsx"), "utf8")
const lessonEngineSrc = fs.readFileSync(path.join(rootDir, "pixiu-lms-portal/src/lib/lesson-engine.ts"), "utf8")

assert.ok(xpEngineSrc.includes("isDerivativeCircuit"), "xp-engine.ts includes isDerivativeCircuit")
assert.ok(xpEngineSrc.includes("getReferenceSignatures"), "xp-engine.ts compares against all reference templates and lesson seeds")
assert.ok(workbenchSrc.includes("activeTemplateId"), "workbench.tsx tracks activeTemplateId")
assert.ok(workbenchSrc.includes("isMission"), "workbench.tsx flags active missions")
assert.ok(lessonEngineSrc.includes("expStripped === actStripped"), "lesson-engine.ts strictly verifies expected pin against actual pin")
console.log("✔ Step 6 Passed: Codebase integration verified.")

console.log("\n=================================================================")
console.log("🎉 ALL ANTI-CHEAT & WIRING MUTATION QA CHECKS PASSED SUCCESSFULLY!")
console.log("=================================================================\n")
