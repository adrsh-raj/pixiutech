#!/usr/bin/env node

/**
 * Phase 5 Automated QA Gate: Raspberry Pi Pico & BBC micro:bit v2 Verification
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")

console.log("=== Pixiu CyberLab Phase 5: RPi Pico & BBC micro:bit v2 QA Gate ===")

const readSource = (relativePath) => {
  const fullPath = path.join(rootDir, relativePath)
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relativePath}`)
  return fs.readFileSync(fullPath, "utf8")
}

const boardRegistrySrc = readSource("pixiu-lms-portal/src/lib/board-registry.ts")
const microbitPatternsSrc = readSource("pixiu-lms-portal/src/lib/microbit-patterns.ts")
const partArtSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/part-art.tsx")
const canvasSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/circuit-canvas.tsx")
const arduinoBlocksSrc = readSource("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const blocklyRunnerSrc = readSource("pixiu-lms-portal/src/lib/blockly-runner.ts")
const simulationSrc = readSource("pixiu-lms-portal/src/lib/simulation.ts")
const workbenchSrc = readSource("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")

// ---------------------------------------------------------------------------
// Step 1: Raspberry Pi Pico (RP2040) Hardware Registry & Specs
// ---------------------------------------------------------------------------
console.log("\n[Test 1] Verifying Raspberry Pi Pico (RP2040) Board Registry...")

assert.ok(boardRegistrySrc.includes('id: "rpi-pico"'), "Pico must have registered ID 'rpi-pico'")
assert.ok(boardRegistrySrc.includes('mcu: "RP2040"'), "Pico MCU must be RP2040")
assert.ok(boardRegistrySrc.includes("clockSpeedMhz: 133"), "Pico clock speed must be 133MHz")
assert.ok(boardRegistrySrc.includes("adcResolutionBits: 12"), "Pico ADC must be 12-bit (0..4095)")
assert.ok(boardRegistrySrc.includes('builtInLedPin: "gp25"'), "Pico built-in LED must be GP25")
assert.ok(boardRegistrySrc.includes("supportsMicroPython: true"), "Pico must support MicroPython")
console.log("✔ Step 1 Passed: Raspberry Pi Pico board specs & RP2040 parameters verified.")

// ---------------------------------------------------------------------------
// Step 2: BBC micro:bit v2 Hardware Registry & Specs
// ---------------------------------------------------------------------------
console.log("\n[Test 2] Verifying BBC micro:bit v2 Board Registry...")

assert.ok(boardRegistrySrc.includes('id: "microbit-v2"'), "micro:bit v2 must have registered ID 'microbit-v2'")
assert.ok(boardRegistrySrc.includes('mcu: "nRF52833"'), "micro:bit MCU must be Nordic nRF52833")
assert.ok(boardRegistrySrc.includes("clockSpeedMhz: 64"), "micro:bit clock speed must be 64MHz")
assert.ok(boardRegistrySrc.includes("hasBle: true"), "micro:bit must declare BLE hardware support")
assert.ok(boardRegistrySrc.includes('{ id: "p0", label: "P0"'), "micro:bit must define Edge Pin P0")
assert.ok(boardRegistrySrc.includes('{ id: "p1", label: "P1"'), "micro:bit must define Edge Pin P1")
assert.ok(boardRegistrySrc.includes('{ id: "p2", label: "P2"'), "micro:bit must define Edge Pin P2")
assert.ok(boardRegistrySrc.includes('{ id: "3v", label: "3V"'), "micro:bit must define 3V power pin")
assert.ok(boardRegistrySrc.includes('{ id: "gnd", label: "GND"'), "micro:bit must define GND edge pin")
console.log("✔ Step 2 Passed: BBC micro:bit v2 specs & edge pin connector verified.")

// ---------------------------------------------------------------------------
// Step 3: micro:bit 5x5 Matrix Icons & Fonts
// ---------------------------------------------------------------------------
console.log("\n[Test 3] Verifying 5x5 LED Matrix Font & Icon Bitmaps...")

assert.ok(microbitPatternsSrc.includes("heart:"), "micro:bit patterns must include heart icon")
assert.ok(microbitPatternsSrc.includes("smile:"), "micro:bit patterns must include smile icon")
assert.ok(microbitPatternsSrc.includes("check:"), "micro:bit patterns must include check icon")
assert.ok(microbitPatternsSrc.includes("sad:"), "micro:bit patterns must include sad icon")
assert.ok(microbitPatternsSrc.includes("ghost:"), "micro:bit patterns must include ghost icon")
assert.ok(microbitPatternsSrc.includes("square:"), "micro:bit patterns must include square icon")
assert.ok(microbitPatternsSrc.includes("MICROBIT_DIGITS: boolean[][][]"), "micro:bit patterns must export numeric digits 0..9")
assert.ok(microbitPatternsSrc.includes("createEmptyMatrix()"), "micro:bit patterns must export createEmptyMatrix")
console.log("✔ Step 3 Passed: 5x5 LED matrix icons & numeric bitmaps verified.")

// ---------------------------------------------------------------------------
// Step 4: Vector Artwork & Dynamic Visual Feedback
// ---------------------------------------------------------------------------
console.log("\n[Test 4] Verifying Vector Artwork & Dynamic Illumination...")

// Pico GP25 Green LED
assert.ok(partArtSrc.includes('case "rpi-pico":'), "PartArt must handle rpi-pico")
assert.ok(partArtSrc.includes("runtime?.pin25High"), "Pico artwork must react to runtime.pin25High")
assert.ok(partArtSrc.includes("GP25"), "Pico silkscreen must show GP25 label")

// micro:bit 5x5 Matrix & Buttons
assert.ok(partArtSrc.includes('case "microbit-v2":'), "PartArt must handle microbit-v2")
assert.ok(partArtSrc.includes("runtime?.matrix5x5"), "micro:bit artwork must react to runtime.matrix5x5")
assert.ok(partArtSrc.includes("runtime?.btnAPressed"), "micro:bit artwork must reflect Button A press")
assert.ok(partArtSrc.includes("runtime?.btnBPressed"), "micro:bit artwork must reflect Button B press")
console.log("✔ Step 4 Passed: Pico GP25 user LED & micro:bit 5x5 matrix vector artwork verified.")

// ---------------------------------------------------------------------------
// Step 5: Interactive Tactile Buttons on Canvas
// ---------------------------------------------------------------------------
console.log("\n[Test 5] Verifying Canvas Clickable Targets for micro:bit Buttons...")

assert.ok(canvasSrc.includes('"microbit-v2"'), "CircuitCanvas interactive types must include microbit-v2")
assert.ok(canvasSrc.includes('onInteract(`${part.id}_a`, true)'), "Button A must trigger onInteract with active=true")
assert.ok(canvasSrc.includes('onInteract(`${part.id}_a`, false)'), "Button A must trigger onInteract with active=false on release")
assert.ok(canvasSrc.includes('onInteract(`${part.id}_b`, true)'), "Button B must trigger onInteract with active=true")
assert.ok(canvasSrc.includes('onInteract(`${part.id}_b`, false)'), "Button B must trigger onInteract with active=false on release")
console.log("✔ Step 5 Passed: Tactile Button A and Button B canvas hit testing verified.")

// ---------------------------------------------------------------------------
// Step 6: Blockly Blocks, Generators & Simulation Runtime
// ---------------------------------------------------------------------------
console.log("\n[Test 6] Verifying Blockly micro:bit Blocks, C++ Generators & Runtime...")

assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['microbit_show_icon']"), "microbit_show_icon block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['microbit_show_number']"), "microbit_show_number block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['microbit_show_string']"), "microbit_show_string block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['microbit_clear']"), "microbit_clear block must be defined")
assert.ok(arduinoBlocksSrc.includes("Blockly.Blocks['microbit_button_pressed']"), "microbit_button_pressed block must be defined")

assert.ok(arduinoBlocksSrc.includes("uBit.display.show(IconNames::"), "C++ generator must emit uBit.display.show")
assert.ok(arduinoBlocksSrc.includes("uBit.display.print("), "C++ generator must emit uBit.display.print")
assert.ok(arduinoBlocksSrc.includes("uBit.display.scroll("), "C++ generator must emit uBit.display.scroll")
assert.ok(arduinoBlocksSrc.includes("uBit.display.clear()"), "C++ generator must emit uBit.display.clear")
assert.ok(arduinoBlocksSrc.includes("uBit.button"), "C++ generator must emit uBit.button isPressed")

// Runner & Simulation runtime
assert.ok(blocklyRunnerSrc.includes('case "microbit_show_icon":'), "Runner must handle microbit_show_icon")
assert.ok(blocklyRunnerSrc.includes('case "microbit_show_number":'), "Runner must handle microbit_show_number")
assert.ok(blocklyRunnerSrc.includes('case "microbit_show_string":'), "Runner must handle microbit_show_string")
assert.ok(blocklyRunnerSrc.includes('case "microbit_clear":'), "Runner must handle microbit_clear")
assert.ok(simulationSrc.includes('pin25High: board.id === "rpi-pico"'), "simulation.ts must compute Pico GP25 state")
assert.ok(workbenchSrc.includes("showMatrixIcon:"), "workbench must wire showMatrixIcon")
assert.ok(workbenchSrc.includes("showMatrixNumber:"), "workbench must wire showMatrixNumber")
assert.ok(workbenchSrc.includes("isButtonPressed:"), "workbench must wire isButtonPressed")
console.log("✔ Step 6 Passed: micro:bit blocks, generators, and simulation runtime verified.")

console.log("\n=======================================================")
console.log("🎉 ALL PHASE 5 RPI PICO & MICRO:BIT V2 CHECKS PASSED!")
console.log("=======================================================")
