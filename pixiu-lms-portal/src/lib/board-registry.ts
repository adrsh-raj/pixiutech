import type { CircuitState, PartType, PinDef, PinKind, PlacedPart } from "./circuit-types"

export type BoardId = "arduino-uno" | "esp32-devkit" | "rpi-pico" | "microbit-v2"
export type BoardFamily = "avr" | "xtensa" | "arm"

export interface BoardPinCapabilities {
  pwm?: boolean
  adc?: boolean
  dac?: boolean
  touch?: boolean
  i2cRole?: "sda" | "scl"
  spiRole?: "mosi" | "miso" | "sck" | "ss"
  uartRole?: "tx" | "rx"
  builtInLed?: boolean
  inputOnly?: boolean
  voltage?: number
}

export interface BoardPin extends PinDef {
  capabilities?: BoardPinCapabilities
  alternateNames?: string[]
}

export interface BoardCapabilities {
  hasWifi: boolean
  hasBluetooth: boolean
  hasBle: boolean
  hasDac: boolean
  hasTouchPins: boolean
  hasBuiltInLed: boolean
  supportsMicroPython: boolean
  supportsCpp: boolean
}

export interface BoardPowerPins {
  v5?: string[]
  v33?: string[]
  gnd: string[]
  vin?: string[]
}

export interface BoardDefinition {
  id: BoardId
  partType: PartType
  name: string
  shortName: string
  mcu: string
  family: BoardFamily
  blurb: string
  width: number
  height: number
  logicVoltage: number
  supplyVoltages: number[]
  adcResolutionBits: number
  adcMaxVoltage: number
  pwmResolutionBits: number
  pwmFrequencyDefaultHz: number
  maxGpioCurrentMa: number
  clockSpeedMhz: number
  flashSizeKb: number
  ramSizeKb: number
  capabilities: BoardCapabilities
  pins: BoardPin[]
  powerPins: BoardPowerPins
  builtInLedPin?: string
  i2cPins?: { sda: string; scl: string }
  serialPins?: { rx: string; tx: string }
  documentationUrl?: string
  visualColors: {
    pcbColor: string
    accentColor: string
  }
}

// ---------------------------------------------------------------------------
// 1. Arduino Uno R3 Definition
// ---------------------------------------------------------------------------
const ARDUINO_W = 320
const ARDUINO_H = 200

function distributePins(
  labels: { label: string; kind: PinKind; caps?: BoardPinCapabilities; alt?: string[] }[],
  left: number,
  right: number,
  y: number,
): BoardPin[] {
  const n = labels.length
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind,
      capabilities: l.caps,
      alternateNames: l.alt,
    }
  })
}

const unoTopPins: BoardPin[] = distributePins(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground", alt: ["gnd_top"] },
    { label: "D13", kind: "digital", caps: { builtInLed: true }, alt: ["13"] },
    { label: "D12", kind: "digital", alt: ["12"] },
    { label: "D11", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["11"] },
    { label: "D10", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["10"] },
    { label: "D9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
    { label: "D8", kind: "digital", alt: ["8"] },
    { label: "D7", kind: "digital", alt: ["7"] },
    { label: "D6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
    { label: "D5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
    { label: "D4", kind: "digital", alt: ["4"] },
    { label: "D3", kind: "digital", caps: { pwm: true }, alt: ["3"] },
    { label: "D2", kind: "digital", alt: ["2"] },
    { label: "D1", kind: "digital", caps: { uartRole: "tx" }, alt: ["1", "tx"] },
    { label: "D0", kind: "digital", caps: { uartRole: "rx" }, alt: ["0", "rx"] },
  ],
  22,
  ARDUINO_W - 22,
  8,
)

const unoBottomPins: BoardPin[] = distributePins(
  [
    { label: "5V", kind: "power", alt: ["v5", "5v_pwr"] },
    { label: "3V3", kind: "power", alt: ["3.3v", "v33"] },
    { label: "RST", kind: "digital", alt: ["reset"] },
    { label: "VIN", kind: "power", alt: ["vin_pwr"] },
    { label: "GND", kind: "ground", alt: ["gnd_bot"] },
    { label: "A0", kind: "analog", caps: { adc: true }, alt: ["0"] },
    { label: "A1", kind: "analog", caps: { adc: true }, alt: ["1"] },
    { label: "A2", kind: "analog", caps: { adc: true }, alt: ["2"] },
    { label: "A3", kind: "analog", caps: { adc: true }, alt: ["3"] },
    { label: "A4", kind: "analog", caps: { adc: true, i2cRole: "sda" }, alt: ["sda", "4"] },
    { label: "A5", kind: "analog", caps: { adc: true, i2cRole: "scl" }, alt: ["scl", "5"] },
  ],
  40,
  ARDUINO_W - 40,
  ARDUINO_H - 8,
).map((p) => (p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p))

export const ARDUINO_UNO_BOARD: BoardDefinition = {
  id: "arduino-uno",
  partType: "arduino-uno",
  name: "Arduino Uno R3",
  shortName: "Uno",
  mcu: "ATmega328P",
  family: "avr",
  blurb: "Industry-standard 8-bit AVR microcontroller board (5V Logic, 16MHz)",
  width: ARDUINO_W,
  height: ARDUINO_H,
  logicVoltage: 5.0,
  supplyVoltages: [5.0, 3.3],
  adcResolutionBits: 10, // 0..1023
  adcMaxVoltage: 5.0,
  pwmResolutionBits: 8, // 0..255
  pwmFrequencyDefaultHz: 490,
  maxGpioCurrentMa: 20,
  clockSpeedMhz: 16,
  flashSizeKb: 32,
  ramSizeKb: 2,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: false,
    supportsCpp: true,
  },
  pins: [...unoTopPins, ...unoBottomPins],
  powerPins: {
    v5: ["5v"],
    v33: ["3v3"],
    gnd: ["gnd", "gnd_pwr"],
    vin: ["vin"],
  },
  builtInLedPin: "d13",
  i2cPins: { sda: "a4", scl: "a5" },
  serialPins: { rx: "d0", tx: "d1" },
  documentationUrl: "https://docs.arduino.cc/hardware/uno-rev3",
  visualColors: {
    pcbColor: "#008184",
    accentColor: "#00979d",
  },
}

// ---------------------------------------------------------------------------
// 2. ESP32 DevKit V1 (30-Pin NodeMCU-32S Form Factor)
// ---------------------------------------------------------------------------
const ESP32_W = 240
const ESP32_H = 370

// Left header (x=12) and Right header (x=ESP32_W-12=228) with 15 pins each:
const esp32LeftSpecs: { id: string; label: string; kind: PinKind; caps?: BoardPinCapabilities; alt?: string[] }[] = [
  { id: "en", label: "EN", kind: "digital", alt: ["rst", "reset"] },
  { id: "vp", label: "VP", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio36", "36", "adc1_0"] },
  { id: "vn", label: "VN", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio39", "39", "adc1_3"] },
  { id: "d34", label: "D34", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio34", "34"] },
  { id: "d35", label: "D35", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio35", "35"] },
  { id: "d32", label: "D32", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio32", "32"] },
  { id: "d33", label: "D33", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio33", "33"] },
  { id: "d25", label: "D25", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio25", "25", "dac1"] },
  { id: "d26", label: "D26", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio26", "26", "dac2"] },
  { id: "d27", label: "D27", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio27", "27"] },
  { id: "d14", label: "D14", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "sck" }, alt: ["gpio14", "14"] },
  { id: "d12", label: "D12", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "miso" }, alt: ["gpio12", "12"] },
  { id: "d13", label: "D13", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "mosi" }, alt: ["gpio13", "13"] },
  { id: "gnd_l", label: "GND", kind: "ground", alt: ["gnd", "gnd1"] },
  { id: "vin", label: "VIN", kind: "power", alt: ["5v", "v5"] },
]

const esp32RightSpecs: { id: string; label: string; kind: PinKind; caps?: BoardPinCapabilities; alt?: string[] }[] = [
  { id: "d23", label: "D23", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["gpio23", "23"] },
  { id: "d22", label: "D22", kind: "digital", caps: { pwm: true, i2cRole: "scl" }, alt: ["gpio22", "22", "scl"] },
  { id: "tx0", label: "TX0", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio1", "1", "tx"] },
  { id: "rx0", label: "RX0", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio3", "3", "rx"] },
  { id: "d21", label: "D21", kind: "digital", caps: { pwm: true, i2cRole: "sda" }, alt: ["gpio21", "21", "sda"] },
  { id: "d19", label: "D19", kind: "digital", caps: { pwm: true, spiRole: "miso" }, alt: ["gpio19", "19"] },
  { id: "d18", label: "D18", kind: "digital", caps: { pwm: true, spiRole: "sck" }, alt: ["gpio18", "18"] },
  { id: "d5", label: "D5", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["gpio5", "5"] },
  { id: "tx2", label: "TX2", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio17", "17"] },
  { id: "rx2", label: "RX2", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio16", "16"] },
  { id: "d4", label: "D4", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio4", "4"] },
  { id: "d2", label: "D2", kind: "digital", caps: { adc: true, touch: true, pwm: true, builtInLed: true }, alt: ["gpio2", "2", "led"] },
  { id: "d15", label: "D15", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "ss" }, alt: ["gpio15", "15"] },
  { id: "gnd_r", label: "GND", kind: "ground", alt: ["gnd", "gnd2"] },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v", "v33"] },
]

const esp32Pins: BoardPin[] = [
  ...esp32LeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt,
  })),
  ...esp32RightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: ESP32_W - 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt,
  })),
]

export const ESP32_DEVKIT_BOARD: BoardDefinition = {
  id: "esp32-devkit",
  partType: "esp32-devkit",
  name: "ESP32 DevKit V1",
  shortName: "ESP32",
  mcu: "ESP32-D0WDQ6",
  family: "xtensa",
  blurb: "Dual-Core 240MHz 32-bit MCU with WiFi, Bluetooth BLE, 2x DAC & 10x Touch (3.3V Logic)",
  width: ESP32_W,
  height: ESP32_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5.0],
  adcResolutionBits: 12, // 0..4095
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8, // 0..255 (expandable to 16)
  pwmFrequencyDefaultHz: 5000,
  maxGpioCurrentMa: 12, // ESP32 recommended max 12mA per GPIO
  clockSpeedMhz: 240,
  flashSizeKb: 4096,
  ramSizeKb: 520,
  capabilities: {
    hasWifi: true,
    hasBluetooth: true,
    hasBle: true,
    hasDac: true,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true,
  },
  pins: esp32Pins,
  powerPins: {
    v33: ["3v3"],
    gnd: ["gnd_l", "gnd_r"],
    vin: ["vin"],
  },
  builtInLedPin: "d2",
  i2cPins: { sda: "d21", scl: "d22" },
  serialPins: { rx: "rx0", tx: "tx0" },
  documentationUrl: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html",
  visualColors: {
    pcbColor: "#121316",
    accentColor: "#06b6d4",
  },
}

// ---------------------------------------------------------------------------
// 3. Raspberry Pi Pico (RP2040 Dual ARM Cortex-M0+)
// ---------------------------------------------------------------------------
const PICO_W = 220
const PICO_H = 380

const picoLeftSpecs: { id: string; label: string; kind: PinKind; caps?: BoardPinCapabilities; alt?: string[] }[] = [
  { id: "gp0", label: "GP0", kind: "digital", caps: { uartRole: "tx", i2cRole: "sda", pwm: true }, alt: ["0"] },
  { id: "gp1", label: "GP1", kind: "digital", caps: { uartRole: "rx", i2cRole: "scl", pwm: true }, alt: ["1"] },
  { id: "gnd_1", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp2", label: "GP2", kind: "digital", caps: { i2cRole: "sda", pwm: true }, alt: ["2"] },
  { id: "gp3", label: "GP3", kind: "digital", caps: { i2cRole: "scl", pwm: true }, alt: ["3"] },
  { id: "gp4", label: "GP4", kind: "digital", caps: { pwm: true }, alt: ["4"] },
  { id: "gp5", label: "GP5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
  { id: "gnd_2", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp6", label: "GP6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
  { id: "gp7", label: "GP7", kind: "digital", caps: { pwm: true }, alt: ["7"] },
  { id: "gp8", label: "GP8", kind: "digital", caps: { pwm: true }, alt: ["8"] },
  { id: "gp9", label: "GP9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
  { id: "gnd_3", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp10", label: "GP10", kind: "digital", caps: { pwm: true }, alt: ["10"] },
  { id: "gp11", label: "GP11", kind: "digital", caps: { pwm: true }, alt: ["11"] },
  { id: "gp12", label: "GP12", kind: "digital", caps: { pwm: true }, alt: ["12"] },
  { id: "gp13", label: "GP13", kind: "digital", caps: { pwm: true }, alt: ["13"] },
  { id: "gnd_4", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp14", label: "GP14", kind: "digital", caps: { pwm: true }, alt: ["14"] },
  { id: "gp15", label: "GP15", kind: "digital", caps: { pwm: true }, alt: ["15"] },
]

const picoRightSpecs: { id: string; label: string; kind: PinKind; caps?: BoardPinCapabilities; alt?: string[] }[] = [
  { id: "vbus", label: "VBUS", kind: "power", alt: ["5v", "vin"] },
  { id: "vsys", label: "VSYS", kind: "power" },
  { id: "gnd_8", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "3v3_en", label: "3V3_EN", kind: "digital" },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v"] },
  { id: "adc_vref", label: "ADC_VREF", kind: "power" },
  { id: "gp28", label: "GP28", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc2", "28"] },
  { id: "gnd_7", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp27", label: "GP27", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc1", "27"] },
  { id: "gp26", label: "GP26", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc0", "26"] },
  { id: "run", label: "RUN", kind: "digital", alt: ["rst"] },
  { id: "gp22", label: "GP22", kind: "digital", caps: { pwm: true }, alt: ["22"] },
  { id: "gnd_6", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp21", label: "GP21", kind: "digital", caps: { pwm: true }, alt: ["21"] },
  { id: "gp20", label: "GP20", kind: "digital", caps: { pwm: true }, alt: ["20"] },
  { id: "gp19", label: "GP19", kind: "digital", caps: { pwm: true }, alt: ["19"] },
  { id: "gp18", label: "GP18", kind: "digital", caps: { pwm: true }, alt: ["18"] },
  { id: "gnd_5", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp17", label: "GP17", kind: "digital", caps: { pwm: true }, alt: ["17"] },
  { id: "gp16", label: "GP16", kind: "digital", caps: { pwm: true }, alt: ["16"] },
]

const picoPins: BoardPin[] = [
  ...picoLeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt,
  })),
  ...picoRightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: PICO_W - 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt,
  })),
]

export const RPI_PICO_BOARD: BoardDefinition = {
  id: "rpi-pico",
  partType: "rpi-pico",
  name: "Raspberry Pi Pico",
  shortName: "Pico",
  mcu: "RP2040",
  family: "arm",
  blurb: "Dual ARM Cortex-M0+ @ 133MHz with 12-bit ADC & MicroPython support (3.3V Logic)",
  width: PICO_W,
  height: PICO_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5.0],
  adcResolutionBits: 12,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 16,
  pwmFrequencyDefaultHz: 1000,
  maxGpioCurrentMa: 12,
  clockSpeedMhz: 133,
  flashSizeKb: 2048,
  ramSizeKb: 264,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true,
  },
  pins: picoPins,
  powerPins: {
    v5: ["vbus"],
    v33: ["3v3"],
    gnd: ["gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"],
    vin: ["vbus", "vsys"],
  },
  builtInLedPin: "gp25",
  i2cPins: { sda: "gp4", scl: "gp5" },
  serialPins: { rx: "gp1", tx: "gp0" },
  documentationUrl: "https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html",
  visualColors: {
    pcbColor: "#059669",
    accentColor: "#10b981",
  },
}

// ---------------------------------------------------------------------------
// 4. BBC micro:bit v2 (nRF52833 ARM Cortex-M4 @ 64MHz)
// ---------------------------------------------------------------------------
const MICROBIT_W = 320
const MICROBIT_H = 260

const microbitPins: BoardPin[] = [
  { id: "p0", label: "P0", x: 40, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["0"] },
  { id: "p1", label: "P1", x: 100, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["1"] },
  { id: "p2", label: "P2", x: 160, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["2"] },
  { id: "3v", label: "3V", x: 220, y: MICROBIT_H - 12, kind: "power", alternateNames: ["3v3", "vcc"] },
  { id: "gnd", label: "GND", x: 280, y: MICROBIT_H - 12, kind: "ground", alternateNames: ["gnd_edge"] },
]

export const MICROBIT_V2_BOARD: BoardDefinition = {
  id: "microbit-v2",
  partType: "microbit-v2",
  name: "BBC micro:bit v2",
  shortName: "micro:bit",
  mcu: "nRF52833",
  family: "arm",
  blurb: "ARM Cortex-M4 @ 64MHz with BLE 5.0, 5x5 LED Matrix, Speaker & Mic (3.3V Logic)",
  width: MICROBIT_W,
  height: MICROBIT_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3],
  adcResolutionBits: 10,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8,
  pwmFrequencyDefaultHz: 50,
  maxGpioCurrentMa: 5,
  clockSpeedMhz: 64,
  flashSizeKb: 512,
  ramSizeKb: 128,
  capabilities: {
    hasWifi: false,
    hasBluetooth: true,
    hasBle: true,
    hasDac: false,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true,
  },
  pins: microbitPins,
  powerPins: {
    v33: ["3v"],
    gnd: ["gnd"],
  },
  visualColors: {
    pcbColor: "#1e1e24",
    accentColor: "#fbbf24",
  },
}

// ---------------------------------------------------------------------------
// Board Registry Map & Lookup Functions
// ---------------------------------------------------------------------------
export const BOARD_REGISTRY: Record<BoardId, BoardDefinition> = {
  "arduino-uno": ARDUINO_UNO_BOARD,
  "esp32-devkit": ESP32_DEVKIT_BOARD,
  "rpi-pico": RPI_PICO_BOARD,
  "microbit-v2": MICROBIT_V2_BOARD,
}

const BOARD_TYPE_SET = new Set<string>(Object.keys(BOARD_REGISTRY))

/**
 * Check if a given part type is a registered controller board.
 */
export function isBoardPart(type: PartType | string): boolean {
  return BOARD_TYPE_SET.has(type)
}
export const isBoardType = isBoardPart

/**
 * Returns the BoardDefinition for the given board ID or part type.
 */
export function getBoardDefinition(idOrType: string): BoardDefinition | undefined {
  return BOARD_REGISTRY[idOrType as BoardId]
}

/**
 * Returns the default board (Arduino Uno R3).
 */
export function getDefaultBoard(): BoardDefinition {
  return ARDUINO_UNO_BOARD
}

/**
 * Returns all registered boards.
 */
export function getAllRegisteredBoards(): BoardDefinition[] {
  return Object.values(BOARD_REGISTRY)
}

/**
 * Returns the active board definition for a placed part, if it represents a board.
 */
export function getBoardForPart(part: PlacedPart | PartType | string): BoardDefinition | undefined {
  const type = typeof part === "string" ? part : "type" in part ? part.type : ""
  return getBoardDefinition(type)
}

/**
 * Finds the active controller board in a circuit state, falling back to Arduino Uno.
 */
export function getActiveBoard(circuit: CircuitState): BoardDefinition {
  const boardPart = circuit.parts.find((p) => isBoardPart(p.type))
  if (boardPart) {
    const def = getBoardDefinition(boardPart.type)
    if (def) return def
  }
  return getDefaultBoard()
}

/**
 * Scale a normalized [0..1] input ratio to the board's native ADC discrete integer range.
 * - Arduino Uno: 10-bit -> 0 to 1023
 * - ESP32: 12-bit -> 0 to 4095
 * - Pico: 12-bit -> 0 to 4095
 */
export function scaleAdcReading(normalizedRatio: number, boardOrId?: BoardDefinition | string): number {
  const board = typeof boardOrId === "string" ? getBoardDefinition(boardOrId) : boardOrId
  const bits = board?.adcResolutionBits ?? 10
  const maxVal = Math.pow(2, bits) - 1
  const clamped = Math.max(0, Math.min(1, normalizedRatio))
  return Math.round(clamped * maxVal)
}

/**
 * Normalize a raw ADC integer reading back to [0..1] based on the board's resolution.
 */
export function normalizeAdcReading(rawReading: number, boardOrId?: BoardDefinition | string): number {
  const board = typeof boardOrId === "string" ? getBoardDefinition(boardOrId) : boardOrId
  const bits = board?.adcResolutionBits ?? 10
  const maxVal = Math.pow(2, bits) - 1
  return Math.max(0, Math.min(1, rawReading / maxVal))
}

/**
 * Determine the physical output voltage for a pin given its state (HIGH, LOW, or PWM duty 0..255).
 */
export function getPinVoltage(
  board: BoardDefinition,
  pinId: string,
  state: "HIGH" | "LOW" | number,
): number {
  const pin = board.pins.find((p) => p.id === pinId.toLowerCase() || p.alternateNames?.includes(pinId.toLowerCase()))
  if (pin?.kind === "power") {
    if (board.powerPins.v5?.includes(pin.id)) return 5.0
    if (board.powerPins.v33?.includes(pin.id)) return 3.3
    if (board.powerPins.vin?.includes(pin.id)) return 5.0
  }
  if (pin?.kind === "ground") return 0.0

  const logicV = pin?.capabilities?.voltage ?? board.logicVoltage
  if (state === "HIGH") return logicV
  if (state === "LOW") return 0.0
  if (typeof state === "number") {
    const duty = Math.max(0, Math.min(255, state)) / 255
    return Number((logicV * duty).toFixed(2))
  }
  return 0.0
}

/**
 * Check if an applied voltage is safe for a board's GPIO pin.
 * Detects 5V overvoltage on 3.3V boards (e.g. ESP32, Pico).
 */
export function validatePinVoltageTolerance(
  board: BoardDefinition,
  pinId: string,
  appliedVoltage: number,
): { safe: boolean; warning?: string } {
  const pin = board.pins.find((p) => p.id === pinId.toLowerCase() || p.alternateNames?.includes(pinId.toLowerCase()))
  if (!pin) return { safe: true }

  if (pin.kind === "ground" && appliedVoltage > 0.5) {
    return {
      safe: false,
      warning: `Applying ${appliedVoltage}V directly to Ground pin ${pin.label} causes a short circuit!`,
    }
  }

  // 3.3V Logic Overvoltage Protection (e.g. ESP32, Pico)
  if (board.logicVoltage <= 3.3 && (pin.kind === "digital" || pin.kind === "analog")) {
    if (appliedVoltage > 3.6) {
      return {
        safe: false,
        warning: `Pin ${pin.label} on ${board.name} operates at 3.3V logic and is NOT 5V tolerant! Applying ${appliedVoltage}V can permanently destroy the microcontroller's GPIO stage. Use a resistor voltage divider or logic level converter.`,
      }
    }
  }

  return { safe: true }
}
