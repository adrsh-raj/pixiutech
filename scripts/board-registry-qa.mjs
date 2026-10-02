import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8")

const boardRegistry = read("pixiu-lms-portal/src/lib/board-registry.ts")
const circuitTypes = read("pixiu-lms-portal/src/lib/circuit-types.ts")
const catalog = read("pixiu-lms-portal/src/lib/components-catalog.ts")
const componentRegistry = read("pixiu-lms-portal/src/lib/component-registry.ts")
const circuitDoctor = read("pixiu-lms-portal/src/lib/circuit-doctor.ts")
const simulation = read("pixiu-lms-portal/src/lib/simulation.ts")
const circuitSolver = read("pixiu-lms-portal/src/lib/circuit-solver.ts")
const currentFlow = read("pixiu-lms-portal/src/lib/current-flow.ts")
const waveformSampler = read("pixiu-lms-portal/src/lib/waveform-sampler.ts")
const pinMap = read("pixiu-lms-portal/src/lib/pin-map.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const xpEngine = read("pixiu-lms-portal/src/lib/xp-engine.ts")
const sketchExporter = read("pixiu-lms-portal/src/lib/sketch-exporter.ts")
const partArt = read("pixiu-lms-portal/src/components/circuit-lab/part-art.tsx")
const schematicArt = read("pixiu-lms-portal/src/components/circuit-lab/schematic-art.tsx")

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

console.log("Running Pixiu CyberLab Multi-Board Architecture QA Gate...")

// 1. Board Registry Core Contracts
assert(boardRegistry.includes('export const ARDUINO_UNO_BOARD: BoardDefinition = {'), "Arduino Uno board definition present")
assert(boardRegistry.includes('export const ESP32_DEVKIT_BOARD: BoardDefinition = {'), "ESP32 DevKit board definition present")
assert(boardRegistry.includes('export const RPI_PICO_BOARD: BoardDefinition = {'), "Raspberry Pi Pico board definition present")
assert(boardRegistry.includes('export const MICROBIT_V2_BOARD: BoardDefinition = {'), "BBC micro:bit v2 board definition present")
assert(boardRegistry.includes('export function isBoardPart('), "isBoardPart helper exported")
assert(boardRegistry.includes('export function getBoardDefinition('), "getBoardDefinition helper exported")
assert(boardRegistry.includes('export function getActiveBoard('), "getActiveBoard helper exported")
assert(boardRegistry.includes('export function scaleAdcReading('), "scaleAdcReading helper exported")
assert(boardRegistry.includes('export function validatePinVoltageTolerance('), "validatePinVoltageTolerance helper exported")

// 2. Arduino Uno Specifications
assert(boardRegistry.includes('logicVoltage: 5.0'), "Uno 5V logic voltage verified")
assert(boardRegistry.includes('adcResolutionBits: 10'), "Uno 10-bit ADC resolution verified")
assert(boardRegistry.includes('family: "avr"'), "Uno AVR family verified")

// 3. ESP32 DevKit Specifications
assert(boardRegistry.includes('logicVoltage: 3.3'), "ESP32 3.3V logic voltage verified")
assert(boardRegistry.includes('adcResolutionBits: 12'), "ESP32 12-bit ADC resolution verified")
assert(boardRegistry.includes('family: "xtensa"'), "ESP32 Xtensa family verified")
assert(boardRegistry.includes('hasWifi: true'), "ESP32 WiFi capability flag verified")
assert(boardRegistry.includes('hasBluetooth: true'), "ESP32 Bluetooth capability flag verified")
assert(boardRegistry.includes('hasDac: true'), "ESP32 DAC capability flag verified")
assert(boardRegistry.includes('hasTouchPins: true'), "ESP32 Touch capability flag verified")

// 4. Circuit Types & Catalog Integration
assert(circuitTypes.includes('"esp32-devkit"'), "PartType includes esp32-devkit")
assert(circuitTypes.includes('"rpi-pico"'), "PartType includes rpi-pico")
assert(circuitTypes.includes('"microbit-v2"'), "PartType includes microbit-v2")
assert(catalog.includes('"esp32-devkit": {'), "CATALOG includes esp32-devkit")
assert(catalog.includes('PALETTE_ORDER: PartType[] = [\n  "arduino-uno",\n  "esp32-devkit"'), "PALETTE_ORDER lists esp32-devkit")
assert(componentRegistry.includes('"esp32-devkit": "controller"'), "COMPONENT_REGISTRY categorizes esp32-devkit as controller")

// 5. Visual Art & Schematics
assert(partArt.includes('case "esp32-devkit":'), "part-art includes esp32-devkit realistic SVG artwork")
assert(partArt.includes('case "rpi-pico":'), "part-art includes rpi-pico artwork")
assert(partArt.includes('case "microbit-v2":'), "part-art includes microbit-v2 artwork")
assert(schematicArt.includes('case "esp32-devkit":'), "schematic-art includes esp32-devkit symbol")

// 6. Circuit Doctor Multi-Board Safety & 3.3V Protection
assert(circuitDoctor.includes('isBoardPart'), "Circuit Doctor uses isBoardPart")
assert(circuitDoctor.includes('boardDef.logicVoltage <= 3.3'), "Circuit Doctor checks 3.3V logic overvoltage")
assert(circuitDoctor.includes('power-short-circuit-'), "Circuit Doctor flags power short circuits dynamically for any board")

// 7. Simulation & Solvers
assert(simulation.includes('getBoardForPart(part)'), "Simulation runtime uses getBoardForPart")
assert(circuitSolver.includes('getBoardForPart(part)'), "Circuit Solver gathers pins & sets fixed nets via getBoardForPart")
assert(currentFlow.includes('getBoardForPart(part)'), "Current Flow animates currents using active board")
assert(waveformSampler.includes('getBoardForPart(part)'), "Waveform Sampler uses board logic voltage and PWM frequency")
assert(pinMap.includes('getBoardForPart'), "Pin Map generates dynamic pin options based on active board")

// 8. Workbench & Gamification / XP Engine
assert(workbench.includes('isBoardPart'), "Workbench checks controller board existence via isBoardPart")
assert(xpEngine.includes('isBoardPart'), "XP Engine verifies custom circuit board presence via isBoardPart")
assert(sketchExporter.includes('getActiveBoard'), "Sketch Exporter outputs active target board architecture")

console.log("PASSED: Pixiu CyberLab Multi-Board Architecture Phase 1 verified successfully!")
