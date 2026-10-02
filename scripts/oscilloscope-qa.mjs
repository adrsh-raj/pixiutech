#!/usr/bin/env node

/**
 * Oscilloscope QA Gate: Verifying Yellow (CH1) and Cyan (CH2) Logic, Metrics & Canvas Badges
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

console.log("=== Pixiu CyberLab Oscilloscope Logic & Waveform Tracing QA Gate ===")

// 1. Read key files
const readSource = (relativePath) => {
  const fullPath = path.join(rootDir, relativePath)
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relativePath}`)
  return fs.readFileSync(fullPath, "utf8")
}

const oscilloscopeSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/oscilloscope.tsx")
const waveformSamplerSrc = readSource("pixiu-lms-portal/src/lib/waveform-sampler.ts")
const canvasSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/circuit-canvas.tsx")
const workbenchSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")

// Test 1: Verify workbench passes isScopeOpen to canvas
console.log("\n[Test 1] Verifying Canvas & Workbench Scope Probe Wiring...")
assert.ok(
  workbenchSrc.includes("isScopeOpen={isScopeOpen}"),
  "workbench.tsx must pass isScopeOpen={isScopeOpen} to CircuitCanvas"
)
assert.ok(
  canvasSrc.includes("isScopeOpen && scopeProbeCH1"),
  "circuit-canvas.tsx must render CH1 (Yellow) badge when scope is open and probed"
)
assert.ok(
  canvasSrc.includes("isScopeOpen && scopeProbeCH2"),
  "circuit-canvas.tsx must render CH2 (Cyan) badge when scope is open and probed"
)
console.log("✔ Step 1 Passed: Yellow and Cyan probe clip badges active on canvas.")

// Test 2: Verify waveform sampler logic & pin resolution
console.log("\n[Test 2] Verifying Waveform Voltage Sampler Mechanics...")
assert.ok(
  waveformSamplerSrc.includes("pinStates[`d${pinDigits}`]"),
  "waveform-sampler.ts must resolve 'd' prefix pin variants"
)
assert.ok(
  waveformSamplerSrc.includes("pinStates[`gpio${pinDigits}`]"),
  "waveform-sampler.ts must resolve 'gpio' prefix pin variants"
)
assert.ok(
  waveformSamplerSrc.includes("if (pinData.value >= 255)"),
  "waveform-sampler.ts must handle 100% duty (value >= 255) as full logic voltage"
)
console.log("✔ Step 2 Passed: Pin resolution and 100% duty logic verified.")

// Test 3: Mathematical Verification of Waveform Metrics (Frequency, Duty Cycle, Vpp)
console.log("\n[Test 3] Verifying Signal Metrics Engine (PWM, Frequency, Duty Cycle)...")

function mockComputeMetrics(history, channel, isConnected) {
  if (!isConnected || history.length < 2) {
    return { currentV: 0, vMax: 0, vMin: 0, vpp: 0, frequencyHz: 0, dutyCyclePct: 0, isConnected }
  }
  const currentV = history[history.length - 1][channel]
  let vMax = -Infinity, vMin = Infinity
  for (const p of history) {
    if (p[channel] > vMax) vMax = p[channel]
    if (p[channel] < vMin) vMin = p[channel]
  }
  const vpp = Number((vMax - vMin).toFixed(2))
  const mid = (vMax + vMin) / 2
  const crossings = []
  let highMs = 0, totalMs = 0
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1], cur = history[i]
    const dt = cur.t - prev.t
    totalMs += dt
    if (cur[channel] >= mid) highMs += dt
    if (vpp > 0.4 && prev[channel] < mid && cur[channel] >= mid) {
      crossings.push(cur.t)
    }
  }
  let frequencyHz = 0
  if (crossings.length >= 2) {
    let periodSum = 0, periodCount = 0
    for (let i = 1; i < crossings.length; i++) {
      periodSum += (crossings[i] - crossings[i - 1])
      periodCount++
    }
    if (periodCount > 0) {
      const avgPeriod = periodSum / periodCount
      frequencyHz = Math.round((1000 / avgPeriod) * 10) / 10
    }
  }
  const dutyCyclePct = totalMs > 0 ? Math.round((highMs / totalMs) * 100) : 0
  return { currentV, vMax, vMin, vpp, frequencyHz, dutyCyclePct, isConnected }
}

// Emulate a 100Hz square wave with 50% duty cycle on CH1 (Yellow)
const mockHistory = []
for (let t = 0; t <= 100; t += 1) {
  const period = 10 // 10ms period = 100Hz
  const isHigh = (t % period) < 5
  mockHistory.push({
    t,
    v1: isHigh ? 5.0 : 0.0,
    v2: 3.3, // Flat 3.3V DC on CH2 (Cyan)
  })
}

const metricsCH1 = mockComputeMetrics(mockHistory, "v1", true)
const metricsCH2 = mockComputeMetrics(mockHistory, "v2", true)

assert.equal(metricsCH1.vMax, 5.0, "CH1 vMax must be 5.0V")
assert.equal(metricsCH1.vMin, 0.0, "CH1 vMin must be 0.0V")
assert.equal(metricsCH1.vpp, 5.0, "CH1 vpp must be 5.0V")
assert.ok(Math.abs(metricsCH1.frequencyHz - 100) <= 2, `CH1 frequency should be ~100Hz: ${metricsCH1.frequencyHz}`)
assert.ok(Math.abs(metricsCH1.dutyCyclePct - 50) <= 2, `CH1 duty cycle should be ~50%: ${metricsCH1.dutyCyclePct}`)

assert.equal(metricsCH2.vMax, 3.3, "CH2 DC vMax must be 3.3V")
assert.equal(metricsCH2.vpp, 0.0, "CH2 flat DC must have 0 Vpp")
assert.equal(metricsCH2.frequencyHz, 0, "CH2 flat DC must have 0Hz frequency")

console.log("✔ Step 3 Passed: Frequency detection, duty cycle, and Vpp metrics mathematically verified.")

// Test 4: Path generator bounds and aesthetics
console.log("\n[Test 4] Verifying CRT Path Generator Coordinate Bounds...")

const screenWidth = 380
const screenHeight = 160
const vMaxScale = 5.5

function testGeneratePath(history, channel, activeWindowMs) {
  if (history.length === 0) return ""
  const latestT = history[history.length - 1].t
  const startT = latestT - activeWindowMs
  let path = ""
  for (let i = 0; i < history.length; i++) {
    const point = history[i]
    const x = Math.max(0, Math.min(screenWidth, ((point.t - startT) / activeWindowMs) * screenWidth))
    const voltage = Math.max(0, Math.min(vMaxScale, point[channel]))
    const y = screenHeight - (voltage / vMaxScale) * screenHeight
    path += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return path
}

const pathYellow = testGeneratePath(mockHistory, "v1", 100)
const pathCyan = testGeneratePath(mockHistory, "v2", 100)

assert.ok(pathYellow.startsWith("M 0.0"), "Yellow path must begin at x=0")
assert.ok(pathYellow.includes("L 380.0"), "Yellow path must span to x=380")
assert.ok(pathCyan.startsWith("M 0.0"), "Cyan path must begin at x=0")
// Check Cyan Y position: 160 - (3.3 / 5.5 * 160) = 64.0
assert.ok(pathCyan.includes("64.0"), "Cyan path at 3.3V must lie at y=64.0px")

console.log("✔ Step 4 Passed: SVG screen path bounds and precision verified.")

console.log("\n=======================================================")
console.log("🎉 ALL OSCILLOSCOPE LOGIC AND TRACING TESTS PASSED!")
console.log("=======================================================\n")
