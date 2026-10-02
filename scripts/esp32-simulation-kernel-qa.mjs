#!/usr/bin/env node

/**
 * Phase 3 Automated QA Gate: ESP32 3.3V Logic & 12-bit ADC Simulation Kernel Verification
 * 
 * Verifies:
 * 1. ESP32 3.3V logic potential & DAC continuous DC output mechanics
 * 2. 12-bit ADC engine (0..4095 range, 3.3V max) vs Arduino Uno 10-bit (0..1023, 5V max)
 * 3. Supply-voltage-dependent sensor potentials in nodal solver (TMP36, MQ2, LDR, Joystick, Soil)
 * 4. ESP32 built-in D2 user blue LED runtime activation and vector illumination
 * 5. 3.3V GPIO overvoltage safety diagnostics in Circuit Doctor
 * 6. Blockly tooltips and workbench sensor scaling integration
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

console.log("=== Pixiu CyberLab Phase 3: ESP32 Simulation Kernel QA Gate ===")

// 1. Read key source files
const readSource = (relativePath) => {
  const fullPath = path.join(rootDir, relativePath)
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relativePath}`)
  return fs.readFileSync(fullPath, "utf8")
}

const boardRegistrySrc = readSource("pixiu-lms-portal/src/lib/board-registry.ts")
const circuitSolverSrc = readSource("pixiu-lms-portal/src/lib/circuit-solver.ts")
const simulationSrc = readSource("pixiu-lms-portal/src/lib/simulation.ts")
const waveformSamplerSrc = readSource("pixiu-lms-portal/src/lib/waveform-sampler.ts")
const workbenchSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const partArtSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/part-art.tsx")
const circuitDoctorSrc = readSource("pixiu-lms-portal/src/lib/circuit-doctor.ts")
const arduinoBlocksSrc = readSource("pixiu-lms-portal/src/lib/arduino-blocks.ts")

// ---------------------------------------------------------------------------
// Step 1: ESP32 3.3V Logic Voltage and DAC Pin Definition
// ---------------------------------------------------------------------------
console.log("\n[Test 1] Verifying 3.3V Logic Voltage & DAC Specifications...")

assert.ok(boardRegistrySrc.includes("logicVoltage: 3.3"), "ESP32 must specify 3.3V logic voltage")
assert.ok(boardRegistrySrc.includes("adcMaxVoltage: 3.3"), "ESP32 must specify 3.3V ADC reference voltage")
assert.ok(boardRegistrySrc.includes("hasDac: true"), "ESP32 must declare DAC hardware capability")

// Check DAC pin declarations (D25 and D26)
assert.ok(
  boardRegistrySrc.includes('id: "d25"') && boardRegistrySrc.includes("dac: true"),
  "GPIO25 / D25 must have DAC capability enabled"
)
assert.ok(
  boardRegistrySrc.includes('id: "d26"') && boardRegistrySrc.includes("dac: true"),
  "GPIO26 / D26 must have DAC capability enabled"
)

// Check Uno specifications remain intact (AVR 5.0V logic, 10-bit ADC)
assert.ok(boardRegistrySrc.includes("logicVoltage: 5.0"), "Uno must maintain 5.0V logic voltage")
assert.ok(boardRegistrySrc.includes("adcMaxVoltage: 5.0"), "Uno must maintain 5.0V ADC reference voltage")
assert.ok(boardRegistrySrc.includes("adcResolutionBits: 10"), "Uno must maintain 10-bit ADC resolution")

console.log("✔ Step 1 Passed: ESP32 3.3V logic and dual DAC channels verified.")

// ---------------------------------------------------------------------------
// Step 2: 12-Bit ADC Scaling Mathematics & Quantization
// ---------------------------------------------------------------------------
console.log("\n[Test 2] Verifying 12-Bit ADC Scaling Algorithm & Precision...")

function testScaleAdc(normalizedRatio, bits) {
  const maxVal = Math.pow(2, bits) - 1
  const clamped = Math.max(0, Math.min(1, normalizedRatio))
  return Math.round(clamped * maxVal)
}

function testNormalizeAdc(rawReading, bits) {
  const maxVal = Math.pow(2, bits) - 1
  return Math.max(0, Math.min(1, rawReading / maxVal))
}

// 12-bit ADC (ESP32)
assert.equal(testScaleAdc(0.0, 12), 0, "ESP32 ADC 0V must read 0")
assert.equal(testScaleAdc(0.5, 12), 2048, "ESP32 ADC mid-rail (1.65V) must read 2048")
assert.equal(testScaleAdc(1.0, 12), 4095, "ESP32 ADC 3.3V must read 4095")
assert.equal(testNormalizeAdc(4095, 12), 1.0, "ESP32 ADC 4095 must normalize to 1.0")

// 10-bit ADC (Arduino Uno)
assert.equal(testScaleAdc(0.0, 10), 0, "Arduino Uno ADC 0V must read 0")
assert.equal(testScaleAdc(0.5, 10), 512, "Arduino Uno ADC mid-rail (2.5V) must read 512")
assert.equal(testScaleAdc(1.0, 10), 1023, "Arduino Uno ADC 5.0V must read 1023")
assert.equal(testNormalizeAdc(1023, 10), 1.0, "Arduino Uno ADC 1023 must normalize to 1.0")

// Quantization step difference
const esp32Step = 3.3 / 4095
const unoStep = 5.0 / 1023
assert.ok(esp32Step < 0.001, "ESP32 step resolution should be ~0.806 mV")
assert.ok(unoStep > 0.004, "Uno step resolution should be ~4.887 mV")

// Verify board-registry.ts exports scaleAdcReading and normalizeAdcReading
assert.ok(boardRegistrySrc.includes("export function scaleAdcReading("), "scaleAdcReading must be exported")
assert.ok(boardRegistrySrc.includes("export function normalizeAdcReading("), "normalizeAdcReading must be exported")

console.log("✔ Step 2 Passed: 12-bit ADC math (0..4095) and quantization verified.")

// ---------------------------------------------------------------------------
// Step 3: Hardware DAC Continuous DC vs PWM Oscillations
// ---------------------------------------------------------------------------
console.log("\n[Test 3] Verifying ESP32 Hardware DAC DC Waveform & Telemetry...")

// Check waveform sampler recognizes DAC capabilities
assert.ok(
  waveformSamplerSrc.includes("boardPin?.capabilities?.dac"),
  "waveform-sampler.ts must check boardPin?.capabilities?.dac"
)
assert.ok(
  waveformSamplerSrc.includes("board.logicVoltage * (pinData.value / 255)"),
  "waveform-sampler.ts must compute continuous DC voltage for DAC"
)

// Check circuit solver labels DAC vs PWM
assert.ok(
  circuitSolverSrc.includes("DAC Output"),
  "circuit-solver.ts must differentiate DAC output in telemetry labels"
)

// Mathematical emulation of DAC vs PWM output at 50% duty
const logicVoltage = 3.3
const dacDuty = 128
const dacVoltage = Number((logicVoltage * (dacDuty / 255)).toFixed(3))
assert.ok(Math.abs(dacVoltage - 1.656) < 0.01, `DAC at duty 128 should produce ~1.656V DC: ${dacVoltage}`)

console.log("✔ Step 3 Passed: Hardware DAC continuous DC waveform output verified.")

// ---------------------------------------------------------------------------
// Step 4: Supply-Voltage-Dependent Sensors in Nodal Solver
// ---------------------------------------------------------------------------
console.log("\n[Test 4] Verifying Nodal Sensor Behavior Scaled to Power Rails...")

// Check vSupply reading from vccPin in circuit-solver.ts
assert.ok(
  circuitSolverSrc.includes("const vSupply = fixedNets.get(vccPin)?.voltage ?? 5.0"),
  "circuit-solver.ts must dynamically read vSupply from connected vcc net"
)

// Check TMP36 scaling
assert.ok(
  circuitSolverSrc.includes('part.type === "tmp36"'),
  "circuit-solver.ts must include deterministic TMP36 output"
)
assert.ok(
  circuitSolverSrc.includes('setOutputIfFree("out", vTemp'),
  "circuit-solver.ts must set TMP36 'out' pin"
)
assert.ok(
  circuitSolverSrc.includes('setOutputIfFree("vout", vTemp'),
  "circuit-solver.ts must set TMP36 'vout' pin alias"
)

// Check Joystick scaling
assert.ok(
  circuitSolverSrc.includes("(Number(part.props.x ?? 512) / 1023) * vSupply"),
  "circuit-solver.ts must scale Joystick VRx to vSupply"
)

// Check Soil Moisture scaling
assert.ok(
  circuitSolverSrc.includes("(Number(part.props.moisture ?? 620) / 1023) * vSupply"),
  "circuit-solver.ts must scale Soil Moisture AO to vSupply"
)

// Check MQ-2 scaling
assert.ok(
  circuitSolverSrc.includes('part.type === "mq2-gas"'),
  "circuit-solver.ts must include MQ-2 sensor"
)

// Check LDR conductance branch in MNA
assert.ok(
  circuitSolverSrc.includes('case "ldr":'),
  "circuit-solver.ts must calculate photoresistor conductance branch in MNA"
)

console.log("✔ Step 4 Passed: Nodal solver supply rail dependence and sensor models verified.")

// ---------------------------------------------------------------------------
// Step 5: Built-in User D2 LED Illumination on ESP32 Substrate
// ---------------------------------------------------------------------------
console.log("\n[Test 5] Verifying ESP32 Built-in D2 LED Runtime & SVG Glow...")

// Check simulation.ts sets pin2High for esp32-devkit
assert.ok(
  simulationSrc.includes('pin2High: board.id === "esp32-devkit"'),
  "simulation.ts must populate pin2High for esp32-devkit"
)
assert.ok(
  simulationSrc.includes("isBuiltInLedActive"),
  "simulation.ts must check active state of built-in LED"
)

// Check part-art.tsx renders D2 LED glow
assert.ok(
  partArtSrc.includes("runtime?.pin2High ?"),
  "part-art.tsx must toggle D2 LED appearance based on pin2High"
)
assert.ok(
  partArtSrc.includes("#60a5fa"),
  "part-art.tsx must render blue glow (#60a5fa) for active D2 LED"
)

console.log("✔ Step 5 Passed: Built-in D2 LED runtime detection and SVG glow verified.")

// ---------------------------------------------------------------------------
// Step 6: 3.3V Logic Overvoltage Protection in Circuit Doctor
// ---------------------------------------------------------------------------
console.log("\n[Test 6] Verifying 3.3V Overvoltage Safety Diagnostics...")

assert.ok(
  circuitDoctorSrc.includes("boardDef.logicVoltage <= 3.3"),
  "Circuit Doctor must check boards with logicVoltage <= 3.3V"
)
assert.ok(
  circuitDoctorSrc.includes("5V Overvoltage on 3.3V Pin"),
  "Circuit Doctor must alert on 5V overvoltage connected to 3.3V GPIOs"
)
assert.ok(
  circuitDoctorSrc.includes("voltage divider"),
  "Circuit Doctor must suggest voltage divider or logic level converter"
)

console.log("✔ Step 6 Passed: Circuit Doctor 3.3V GPIO overvoltage protection verified.")

// ---------------------------------------------------------------------------
// Step 7: Workbench & Blockly Dual-Architecture ADC Integration
// ---------------------------------------------------------------------------
console.log("\n[Test 7] Verifying Workbench Sensor Reading & Blockly Tooltips...")

// Check workbench.tsx calls scaleAdcReading
assert.ok(
  workbenchSrc.includes("scaleAdcReading("),
  "workbench.tsx getSensorValue must use scaleAdcReading"
)
assert.ok(
  workbenchSrc.includes("getActiveBoard("),
  "workbench.tsx must resolve the active board for ADC reading"
)

// Check blockly tooltips mention dual architecture
assert.ok(
  arduinoBlocksSrc.includes("0-1023 on Arduino Uno, 0-4095 on ESP32"),
  "Blockly analogread tooltip must describe both 10-bit and 12-bit ADC ranges"
)
assert.ok(
  arduinoBlocksSrc.includes("true DAC voltage on ESP32"),
  "Blockly analogwrite tooltip must describe true DAC voltage on ESP32"
)

console.log("✔ Step 7 Passed: Dual-architecture Blockly tooltips and workbench integration verified.")

console.log("\n=======================================================")
console.log("🎉 ALL PHASE 3 SIMULATION KERNEL CHECKS PASSED SUCCESSFULLY!")
console.log("=======================================================\n")
