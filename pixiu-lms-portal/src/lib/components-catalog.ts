import type { PartDef, PartType, PinDef, PinKind } from "./circuit-types"
import { ESP32_DEVKIT_BOARD, RPI_PICO_BOARD, MICROBIT_V2_BOARD } from "./board-registry"

function distribute(labels: { label: string; kind: PinKind }[], left: number, right: number, y: number): PinDef[] {
  const n = labels.length
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind,
    }
  })
}

const ARDUINO_W = 320
const ARDUINO_H = 200
export const BREADBOARD_COLUMNS = 20

const topPins = distribute(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground" },
    { label: "D13", kind: "digital" },
    { label: "D12", kind: "digital" },
    { label: "D11", kind: "digital" },
    { label: "D10", kind: "digital" },
    { label: "D9", kind: "digital" },
    { label: "D8", kind: "digital" },
    { label: "D7", kind: "digital" },
    { label: "D6", kind: "digital" },
    { label: "D5", kind: "digital" },
    { label: "D4", kind: "digital" },
    { label: "D3", kind: "digital" },
    { label: "D2", kind: "digital" },
    { label: "D1", kind: "digital" },
    { label: "D0", kind: "digital" },
  ],
  22,
  ARDUINO_W - 22,
  8,
)

const bottomPins = distribute(
  [
    { label: "5V", kind: "power" },
    { label: "3V3", kind: "power" },
    { label: "RST", kind: "digital" },
    { label: "VIN", kind: "power" },
    { label: "GND", kind: "ground" },
    { label: "A0", kind: "analog" },
    { label: "A1", kind: "analog" },
    { label: "A2", kind: "analog" },
    { label: "A3", kind: "analog" },
    { label: "A4", kind: "analog" },
    { label: "A5", kind: "analog" },
  ],
  40,
  ARDUINO_W - 40,
  ARDUINO_H - 8,
).map((p, i) =>
  // disambiguate the two GND ids across headers
  p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p,
)

const LED_ELECTRICAL_MODEL = {
  forwardVoltageByColor: {
    red: 1.9,
    yellow: 2.0,
    green: 2.1,
    blue: 3.2,
    white: 3.3,
  },
  maxForwardCurrentMa: 30,
  nominalForwardCurrentMa: 15,
} as const

// Generic module-load equivalents are explicitly labelled estimates because
// the catalogue does not identify an exact manufacturer/module revision.
// These figures are teaching-model defaults, not measured or datasheet limits.
const MODULE_LOAD_ESTIMATES = {
  servo: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 10,
    accuracy: "module-estimate",
    activeWhen: "servo-command",
    note: "Quiescent/commanded teaching estimate only; servo current varies with torque, motion and stall.",
  }],
  relay: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 12,
    accuracy: "module-estimate",
    activeWhen: "relay-energized",
    note: "Generic 5V relay-coil estimate; exact coil resistance and current depend on the selected relay module.",
  }],
  lcd: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 15,
    accuracy: "module-estimate",
    activeWhen: "display-enabled",
    note: "Generic backlit character-display estimate; backlight and backpack variants change consumption.",
  }],
  oled: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 3.3, nominalCurrentMa: 15,
    accuracy: "module-estimate",
    activeWhen: "display-enabled",
    note: "Generic small OLED module estimate; panel content, brightness and regulator variant change consumption.",
  }],
  ultrasonic: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 10,
    accuracy: "module-estimate",
    note: "Generic HC-SR04 teaching estimate; board revisions can differ.",
  }],
  pir: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 8,
    accuracy: "module-estimate",
    note: "Generic PIR module estimate; sensor board and regulator variant are unspecified.",
  }],
  ir: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 8,
    accuracy: "module-estimate",
    note: "Generic IR obstacle-module estimate; LED intensity and comparator board differ by module.",
  }],
  dht11: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 2.5,
    accuracy: "module-estimate",
    note: "Low-power sensor estimate; breakout pull-up and indicator LEDs are not included.",
  }],
  soil: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 12,
    accuracy: "module-estimate",
    note: "Generic resistive soil-probe module estimate; probe drive and module circuitry vary.",
  }],
  mq2: [{
    positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 150,
    accuracy: "module-estimate",
    note: "Heater-dominated MQ-2 module estimate; verify the exact sensor and breakout before hardware power budgeting.",
  }],
  l298nLogic: [{
    positivePin: "5v", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 15,
    accuracy: "module-estimate",
    note: "Logic-side teaching estimate only; excludes motor load and module regulator losses.",
  }],
  joystickTracks: [
    {
      positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 0.5,
      accuracy: "module-estimate",
      note: "One nominal 10kΩ potentiometer track; generic joystick track model.",
    },
    {
      positivePin: "vcc", negativePin: "gnd", nominalVoltage: 5, nominalCurrentMa: 0.5,
      accuracy: "module-estimate",
      note: "Second nominal 10kΩ potentiometer track; generic joystick track model.",
    },
  ],
} as const

export const CATALOG: Record<PartType, PartDef> = {
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno",
    blurb: "ATmega328P microcontroller board",
    width: ARDUINO_W,
    height: ARDUINO_H,
    pins: [...topPins, ...bottomPins],
  },
  "esp32-devkit": {
    type: "esp32-devkit",
    name: ESP32_DEVKIT_BOARD.name,
    blurb: ESP32_DEVKIT_BOARD.blurb,
    width: ESP32_DEVKIT_BOARD.width,
    height: ESP32_DEVKIT_BOARD.height,
    pins: ESP32_DEVKIT_BOARD.pins,
  },
  "rpi-pico": {
    type: "rpi-pico",
    name: RPI_PICO_BOARD.name,
    blurb: RPI_PICO_BOARD.blurb,
    width: RPI_PICO_BOARD.width,
    height: RPI_PICO_BOARD.height,
    pins: RPI_PICO_BOARD.pins,
  },
  "microbit-v2": {
    type: "microbit-v2",
    name: MICROBIT_V2_BOARD.name,
    blurb: MICROBIT_V2_BOARD.blurb,
    width: MICROBIT_V2_BOARD.width,
    height: MICROBIT_V2_BOARD.height,
    pins: MICROBIT_V2_BOARD.pins,
  },
  breadboard: {
    type: "breadboard",
    name: "Breadboard",
    blurb: "Full 20-column solderless prototyping breadboard with bus rails",
    width: 460,
    height: 214,
    pins: (() => {
      const pins: PinDef[] = []
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const x = 40 + (c - 1) * 20
        pins.push({ id: `pos_t_${c}`, label: `+ rail (col ${c})`, x, y: 16, kind: "power" })
        pins.push({ id: `neg_t_${c}`, label: `- rail (col ${c})`, x, y: 28, kind: "ground" })
        pins.push({ id: `a_${c}`, label: `a${c}`, x, y: 50, kind: "passive" })
        pins.push({ id: `b_${c}`, label: `b${c}`, x, y: 62, kind: "passive" })
        pins.push({ id: `c_${c}`, label: `c${c}`, x, y: 74, kind: "passive" })
        pins.push({ id: `d_${c}`, label: `d${c}`, x, y: 86, kind: "passive" })
        pins.push({ id: `e_${c}`, label: `e${c}`, x, y: 98, kind: "passive" })
        pins.push({ id: `f_${c}`, label: `f${c}`, x, y: 118, kind: "passive" })
        pins.push({ id: `g_${c}`, label: `g${c}`, x, y: 130, kind: "passive" })
        pins.push({ id: `h_${c}`, label: `h${c}`, x, y: 142, kind: "passive" })
        pins.push({ id: `i_${c}`, label: `i${c}`, x, y: 154, kind: "passive" })
        pins.push({ id: `j_${c}`, label: `j${c}`, x, y: 166, kind: "passive" })
        pins.push({ id: `pos_b_${c}`, label: `+ rail (col ${c})`, x, y: 186, kind: "power" })
        pins.push({ id: `neg_b_${c}`, label: `- rail (col ${c})`, x, y: 198, kind: "ground" })
      }
      pins.push({ id: "pos_top", label: "+ rail (top)", x: 40, y: 16, kind: "power" })
      pins.push({ id: "neg_top", label: "- rail (top)", x: 40, y: 28, kind: "ground" })
      pins.push({ id: "pos_bot", label: "+ rail (bot)", x: 40, y: 186, kind: "power" })
      pins.push({ id: "neg_bot", label: "- rail (bot)", x: 40, y: 198, kind: "ground" })
      pins.push({ id: "a1", label: "row A", x: 80, y: 50, kind: "passive" })
      pins.push({ id: "b1", label: "row B", x: 140, y: 50, kind: "passive" })
      pins.push({ id: "c1", label: "row C", x: 200, y: 50, kind: "passive" })
      pins.push({ id: "d1", label: "row D", x: 260, y: 50, kind: "passive" })
      pins.push({ id: "e1", label: "row E", x: 320, y: 50, kind: "passive" })
      pins.push({ id: "a2", label: "row A", x: 80, y: 118, kind: "passive" })
      pins.push({ id: "b2", label: "row B", x: 140, y: 118, kind: "passive" })
      pins.push({ id: "c2", label: "row C", x: 200, y: 118, kind: "passive" })
      pins.push({ id: "d2", label: "row D", x: 260, y: 118, kind: "passive" })
      pins.push({ id: "e2", label: "row E", x: 320, y: 118, kind: "passive" })
      return pins
    })(),
  },
  led: {
    type: "led",
    name: "LED",
    blurb: "Light-emitting diode",
    width: 44,
    height: 66,
    pins: [
      { id: "anode", label: "Anode (+)", x: 14, y: 62, kind: "passive" },
      { id: "cathode", label: "Cathode (-)", x: 30, y: 62, kind: "passive" },
    ],
    defaults: { color: "red" },
    electrical: LED_ELECTRICAL_MODEL,
    requiredPinGroups: [["anode"],["cathode"]],
  },
  resistor: {
    type: "resistor",
    name: "Resistor",
    blurb: "Limits current flow",
    width: 88,
    height: 26,
    pins: [
      { id: "a", label: "Terminal 1", x: 3, y: 13, kind: "passive" },
      { id: "b", label: "Terminal 2", x: 85, y: 13, kind: "passive" },
    ],
    defaults: { resistance: 220 },
    requiredPinGroups: [["a"],["b"]],
  },
  pushbutton: {
    type: "pushbutton",
    name: "Pushbutton",
    blurb: "Momentary tactile switch",
    width: 60,
    height: 60,
    pins: [
      { id: "p1a", label: "1a", x: 6, y: 8, kind: "passive" },
      { id: "p2a", label: "2a", x: 54, y: 8, kind: "passive" },
      { id: "p1b", label: "1b", x: 6, y: 52, kind: "passive" },
      { id: "p2b", label: "2b", x: 54, y: 52, kind: "passive" },
    ],
    requiredPinGroups: [["p1a","p1b"],["p2a","p2b"]],
  },
  battery: {
    type: "battery",
    name: "Battery",
    blurb: "DC power source",
    width: 62,
    height: 92,
    pins: [
      { id: "pos", label: "+", x: 20, y: 88, kind: "power" },
      { id: "neg", label: "-", x: 42, y: 88, kind: "ground" },
    ],
    defaults: { voltage: 9 },
    requiredPinGroups: [["pos"],["neg"]],
  },
  potentiometer: {
    type: "potentiometer",
    name: "Potentiometer",
    blurb: "Variable resistor / knob",
    width: 64,
    height: 64,
    pins: [
      { id: "t1", label: "Terminal 1", x: 12, y: 60, kind: "passive" },
      { id: "wiper", label: "Wiper", x: 32, y: 60, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 52, y: 60, kind: "passive" },
    ],
    defaults: { value: 512, resistance: 10000 },
    requiredPinGroups: [["t1"],["wiper"],["t2"]],
  },
  servo: {
    type: "servo",
    name: "Servo Motor",
    blurb: "Positional rotation motor",
    width: 100,
    height: 70,
    pins: [
      { id: "sig", label: "Signal", x: 4, y: 18, kind: "digital" },
      { id: "vcc", label: "VCC", x: 4, y: 35, kind: "power" },
      { id: "gnd", label: "GND", x: 4, y: 52, kind: "ground" },
    ],
    defaults: { angle: 90 },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.servo] },
    requiredPinGroups: [["sig"],["vcc"],["gnd"]],
  },
  buzzer: {
    type: "buzzer",
    name: "Piezo Buzzer",
    blurb: "Produces tones",
    width: 56,
    height: 56,
    pins: [
      { id: "pos", label: "+ / Signal", x: 20, y: 52, kind: "digital" },
      { id: "neg", label: "-", x: 36, y: 52, kind: "ground" },
    ],
    requiredPinGroups: [["pos"],["neg"]],
  },
  "rgb-led": {
    type: "rgb-led",
    name: "RGB LED",
    blurb: "Common-cathode RGB light-emitting diode",
    width: 50,
    height: 70,
    pins: [
      { id: "red", label: "Red", x: 8, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 18, y: 66, kind: "passive" },
      { id: "green", label: "Green", x: 28, y: 66, kind: "passive" },
      { id: "blue", label: "Blue", x: 38, y: 66, kind: "passive" },
    ],
    electrical: LED_ELECTRICAL_MODEL,
    requiredPinGroups: [["red"],["green"],["blue"],["gnd"]],
  },
  "seven-segment": {
    type: "seven-segment",
    name: "7-Segment Display",
    blurb: "Single digit numeric display",
    width: 60,
    height: 80,
    pins: [
      { id: "a", label: "Seg A", x: 5, y: 76, kind: "passive" },
      { id: "b", label: "Seg B", x: 15, y: 76, kind: "passive" },
      { id: "c", label: "Seg C", x: 25, y: 76, kind: "passive" },
      { id: "d", label: "Seg D", x: 35, y: 76, kind: "passive" },
      { id: "e", label: "Seg E", x: 5, y: 4, kind: "passive" },
      { id: "f", label: "Seg F", x: 15, y: 4, kind: "passive" },
      { id: "g", label: "Seg G", x: 25, y: 4, kind: "passive" },
      { id: "dp", label: "DP", x: 35, y: 4, kind: "passive" },
      { id: "com", label: "Common", x: 55, y: 40, kind: "passive" },
    ],
    defaults: { commonType: "cathode", color: "red" },
    electrical: LED_ELECTRICAL_MODEL,
    requiredPinGroups: [["a"],["b"],["c"],["d"],["e"],["f"],["g"],["com"]],
  },
  "lcd-i2c": {
    type: "lcd-i2c",
    name: "LCD 16×2 (I2C)",
    blurb: "Two-line alphanumeric display with I2C backpack",
    width: 180,
    height: 80,
    pins: [
      { id: "gnd", label: "GND", x: 30, y: 76, kind: "ground" },
      { id: "vcc", label: "VCC", x: 60, y: 76, kind: "power" },
      { id: "sda", label: "SDA", x: 90, y: 76, kind: "passive" },
      { id: "scl", label: "SCL", x: 120, y: 76, kind: "passive" },
    ],
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.lcd] },
    requiredPinGroups: [["gnd"],["vcc"],["sda"],["scl"]],
  },
  ultrasonic: {
    type: "ultrasonic",
    name: "Ultrasonic Sensor",
    blurb: "HC-SR04 distance measurement (2-400cm)",
    width: 100,
    height: 56,
    pins: [
      { id: "vcc", label: "VCC", x: 20, y: 52, kind: "power" },
      { id: "trig", label: "Trig", x: 40, y: 52, kind: "passive" },
      { id: "echo", label: "Echo", x: 60, y: 52, kind: "passive" },
      { id: "gnd", label: "GND", x: 80, y: 52, kind: "ground" },
    ],
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.ultrasonic] },
    requiredPinGroups: [["vcc"],["trig"],["echo"],["gnd"]],
  },
  "pir-sensor": {
    type: "pir-sensor",
    name: "PIR Motion Sensor",
    blurb: "Passive infrared motion detector",
    width: 60,
    height: 70,
    pins: [
      { id: "vcc", label: "VCC", x: 10, y: 66, kind: "power" },
      { id: "out", label: "OUT", x: 30, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 50, y: 66, kind: "ground" },
    ],
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.pir] },
    requiredPinGroups: [["vcc"],["out"],["gnd"]],
  },
  ldr: {
    type: "ldr",
    name: "Photoresistor (LDR)",
    blurb: "Light-dependent resistor for light sensing",
    width: 40,
    height: 50,
    pins: [
      { id: "t1", label: "Terminal 1", x: 10, y: 46, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 30, y: 46, kind: "passive" },
    ],
    requiredPinGroups: [["t1"],["t2"]],
  },
  tmp36: {
    type: "tmp36",
    name: "Temperature Sensor",
    blurb: "TMP36 analog temperature sensor (-40 to 125°C)",
    width: 40,
    height: 50,
    pins: [
      { id: "vcc", label: "VCC", x: 6, y: 46, kind: "power" },
      { id: "out", label: "Vout", x: 20, y: 46, kind: "passive" },
      { id: "gnd", label: "GND", x: 34, y: 46, kind: "ground" },
    ],
    electrical: {
      supplyLoads: [{
        positivePin: "vcc",
        negativePin: "gnd",
        nominalVoltage: 3.3,
        nominalCurrentMa: 0.05,
        accuracy: "module-estimate",
        note: "Low-current IC teaching estimate; breakout-board indicators and regulator losses are excluded.",
      }],
    },
    requiredPinGroups: [["vcc"],["out"],["gnd"]],
  },
  "dc-motor": {
    type: "dc-motor",
    name: "DC Motor",
    blurb: "Small brushed DC motor",
    width: 108,
    height: 72,
    pins: [
      { id: "pos", label: "M+", x: 34, y: 68, kind: "passive" },
      { id: "neg", label: "M-", x: 76, y: 68, kind: "passive" },
    ],
    requiredPinGroups: [["pos"],["neg"]],
  },
  "npn-transistor": {
    type: "npn-transistor",
    name: "NPN Transistor",
    blurb: "2N2222 general-purpose NPN switching transistor",
    width: 40,
    height: 56,
    pins: [
      { id: "emitter", label: "Emitter (E)", x: 8, y: 52, kind: "passive" },
      { id: "base", label: "Base (B)", x: 20, y: 52, kind: "passive" },
      { id: "collector", label: "Collector (C)", x: 32, y: 52, kind: "passive" },
    ],
    requiredPinGroups: [["emitter"],["base"],["collector"]],
  },
  relay: {
    type: "relay",
    name: "Relay Module",
    blurb: "5V single-channel relay for high-voltage switching",
    width: 112,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 28, y: 80, kind: "power" },
      { id: "gnd", label: "GND", x: 56, y: 80, kind: "ground" },
      { id: "in", label: "IN", x: 84, y: 80, kind: "passive" },
      { id: "com", label: "COM", x: 72, y: 4, kind: "passive" },
      { id: "no", label: "NO", x: 86, y: 4, kind: "passive" },
      { id: "nc", label: "NC", x: 100, y: 4, kind: "passive" },
    ],
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.relay] },
    requiredPinGroups: [["vcc"],["gnd"],["in"],["com"],["no","nc"]],
  },

  "ir-sensor": {
    type: "ir-sensor",
    name: "IR Obstacle Sensor",
    blurb: "Digital infrared obstacle / line sensor",
    width: 76,
    height: 64,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 60, kind: "power" },
      { id: "out", label: "OUT", x: 38, y: 60, kind: "digital" },
      { id: "gnd", label: "GND", x: 64, y: 60, kind: "ground" },
    ],
    defaults: { detected: "false" },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.ir] },
    requiredPinGroups: [["vcc"],["out"],["gnd"]],
  },
  "dht11": {
    type: "dht11",
    name: "DHT11 Climate Sensor",
    blurb: "Temperature + humidity digital sensor",
    width: 72,
    height: 66,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 62, kind: "power" },
      { id: "data", label: "DATA", x: 36, y: 62, kind: "digital" },
      { id: "gnd", label: "GND", x: 60, y: 62, kind: "ground" },
    ],
    defaults: { temperature: 25, humidity: 55 },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.dht11] },
    requiredPinGroups: [["vcc"],["data"],["gnd"]],
  },
  "oled-i2c": {
    type: "oled-i2c",
    name: "OLED 0.96″ I2C",
    blurb: "128×64 monochrome I2C display",
    width: 150,
    height: 92,
    pins: [
      { id: "gnd", label: "GND", x: 28, y: 88, kind: "ground" },
      { id: "vcc", label: "VCC", x: 58, y: 88, kind: "power" },
      { id: "scl", label: "SCL", x: 88, y: 88, kind: "digital" },
      { id: "sda", label: "SDA", x: 118, y: 88, kind: "digital" },
    ],
    defaults: { line1: "PIXIU TECH", line2: "READY", line3: "" },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.oled] },
    requiredPinGroups: [["gnd"],["vcc"],["scl"],["sda"]],
  },
  "joystick": {
    type: "joystick",
    name: "2-Axis Joystick",
    blurb: "X/Y analog control + push button",
    width: 86,
    height: 86,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 82, kind: "ground" },
      { id: "vcc", label: "VCC", x: 28, y: 82, kind: "power" },
      { id: "vrx", label: "VRx", x: 46, y: 82, kind: "analog" },
      { id: "vry", label: "VRy", x: 64, y: 82, kind: "analog" },
      { id: "sw", label: "SW", x: 78, y: 82, kind: "digital" },
    ],
    defaults: { x: 512, y: 512, pressed: "false" },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.joystickTracks] },
    requiredPinGroups: [["gnd"],["vcc"],["vrx"],["vry"]],
  },
  "l298n": {
    type: "l298n",
    name: "L298N Motor Driver",
    blurb: "Dual H-bridge for two DC motors",
    width: 150,
    height: 112,
    pins: [
      { id: "vs", label: "VMotor", x: 24, y: 8, kind: "power" },
      { id: "gnd", label: "GND", x: 48, y: 8, kind: "ground" },
      { id: "5v", label: "5V", x: 72, y: 8, kind: "power" },
      { id: "ena", label: "ENA", x: 30, y: 104, kind: "digital" },
      { id: "in1", label: "IN1", x: 46, y: 104, kind: "digital" },
      { id: "in2", label: "IN2", x: 62, y: 104, kind: "digital" },
      { id: "out1", label: "OUT1", x: 8, y: 39, kind: "passive" },
      { id: "out2", label: "OUT2", x: 8, y: 66, kind: "passive" },
      { id: "out3", label: "OUT3", x: 142, y: 39, kind: "passive" },
      { id: "out4", label: "OUT4", x: 142, y: 66, kind: "passive" },
      { id: "enb", label: "ENB", x: 110, y: 104, kind: "digital" },
      { id: "in3", label: "IN3", x: 78, y: 104, kind: "digital" },
      { id: "in4", label: "IN4", x: 94, y: 104, kind: "digital" },
    ],
    defaults: { speedA: 0, speedB: 0 },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.l298nLogic] },
    requiredPinGroups: [["vs"],["gnd"],["ena","enb"],["in1","in3"],["in2","in4"],["out1","out3"],["out2","out4"]],
  },
  "rotary-encoder": {
    type: "rotary-encoder",
    name: "Rotary Encoder",
    blurb: "Incremental dial with push switch",
    width: 74,
    height: 82,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 78, kind: "ground" },
      { id: "vcc", label: "VCC", x: 25, y: 78, kind: "power" },
      { id: "clk", label: "CLK", x: 40, y: 78, kind: "digital" },
      { id: "dt", label: "DT", x: 55, y: 78, kind: "digital" },
      { id: "sw", label: "SW", x: 68, y: 78, kind: "digital" },
    ],
    defaults: { value: 0, pressed: "false" },
    requiredPinGroups: [["gnd"],["vcc"],["clk"],["dt"]],
  },
  "soil-moisture": {
    type: "soil-moisture",
    name: "Soil Moisture Sensor",
    blurb: "Analog probe for smart farming projects",
    width: 72,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 14, y: 80, kind: "power" },
      { id: "ao", label: "AO", x: 36, y: 80, kind: "analog" },
      { id: "gnd", label: "GND", x: 58, y: 80, kind: "ground" },
    ],
    defaults: { moisture: 620 },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.soil] },
    requiredPinGroups: [["vcc"],["ao"],["gnd"]],
  },
  "keypad-4x4": {
    type: "keypad-4x4",
    name: "4×4 Matrix Keypad",
    blurb: "Sixteen-key matrix input for access and control",
    width: 118,
    height: 120,
    pins: [
      { id: "r1", label: "R1", x: 12, y: 116, kind: "digital" },
      { id: "r2", label: "R2", x: 42, y: 116, kind: "digital" },
      { id: "r3", label: "R3", x: 72, y: 116, kind: "digital" },
      { id: "r4", label: "R4", x: 102, y: 116, kind: "digital" },
      { id: "c1", label: "C1", x: 12, y: 4, kind: "digital" },
      { id: "c2", label: "C2", x: 42, y: 4, kind: "digital" },
      { id: "c3", label: "C3", x: 72, y: 4, kind: "digital" },
      { id: "c4", label: "C4", x: 102, y: 4, kind: "digital" },
    ],
    defaults: { lastKey: "" },
    requiredPinGroups: [["r1"],["r2"],["r3"],["r4"],["c1"],["c2"],["c3"],["c4"]],
  },
  "neopixel-ring": {
    type: "neopixel-ring",
    name: "NeoPixel RGB Ring (8x)",
    blurb: "Addressable WS2812B 8-LED circular ring module",
    width: 100,
    height: 100,
    pins: [
      { id: "di", label: "DI", x: 22, y: 92, kind: "digital" },
      { id: "vcc", label: "VCC (5V)", x: 40, y: 92, kind: "power" },
      { id: "gnd", label: "GND", x: 60, y: 92, kind: "ground" },
      { id: "do", label: "DO", x: 78, y: 92, kind: "digital" },
    ],
    defaults: { numPixels: 8, brightness: 200, pattern: "rainbow", color: "#38bdf8" },
    electrical: {
      pixelCurrentPerChannelMa: 20,
      pixelReferenceVoltage: 5,
      pixelOffColor: "#0f172a",
    },
    requiredPinGroups: [["di"],["vcc"],["gnd"]],
  },
  "mq2-gas": {
    type: "mq2-gas",
    name: "MQ-2 Gas / Smoke Sensor",
    blurb: "LPG, propane, methane, hydrogen and smoke detection module",
    width: 80,
    height: 90,
    pins: [
      { id: "vcc", label: "VCC", x: 16, y: 84, kind: "power" },
      { id: "gnd", label: "GND", x: 32, y: 84, kind: "ground" },
      { id: "do", label: "DO", x: 48, y: 84, kind: "digital" },
      { id: "ao", label: "AO", x: 64, y: 84, kind: "analog" },
    ],
    defaults: { gasLevel: 150, threshold: 350 },
    electrical: { supplyLoads: [...MODULE_LOAD_ESTIMATES.mq2] },
    requiredPinGroups: [["vcc"],["gnd"],["ao"]],
  },
}

export const PALETTE_ORDER: PartType[] = [
  "arduino-uno",
  "esp32-devkit",
  "rpi-pico",
  "microbit-v2",
  "breadboard",
  "led",
  "rgb-led",
  "neopixel-ring",
  "seven-segment",
  "lcd-i2c",
  "resistor",
  "pushbutton",
  "potentiometer",
  "ldr",
  "ultrasonic",
  "pir-sensor",
  "mq2-gas",
  "tmp36",
  "servo",
  "dc-motor",
  "buzzer",
  "npn-transistor",
  "relay",
  "ir-sensor",
  "dht11",
  "joystick",
  "l298n",
  "rotary-encoder",
  "soil-moisture",
  "keypad-4x4",
  "oled-i2c",
  "battery",
]

export const PIN_KIND_COLOR: Record<PinKind, string> = {
  power: "var(--color-destructive)",
  ground: "var(--color-foreground)",
  digital: "var(--color-primary)",
  analog: "var(--color-accent)",
  passive: "var(--color-muted-foreground)",
}


/**
 * Auditable scope/fidelity contract for every component in the Virtual Lab.
 * "estimated"/"partial" entries are not datasheet-certified measurements.
 * A component can have no static DC load while still acting as a signal source,
 * switch, or passive interconnect in the circuit topology.
 */
export interface ElectricalModelContract {
  model: string
  fidelity: "idealized" | "first-order" | "estimated" | "partial" | "signal-only"
  note: string
}

export const ELECTRICAL_MODEL_CONTRACT: Record<PartType, ElectricalModelContract> = {
  "arduino-uno": {
    model: "ideal-board-supply-and-GPIO-sources",
    fidelity: "idealized",
    note: "Board rails and configured GPIO outputs are ideal voltage boundaries; MCU quiescent current, regulator losses and GPIO output resistance are not included.",
  },
  "esp32-devkit": {
    model: "ideal-board-supply-and-GPIO-sources",
    fidelity: "idealized",
    note: "3.3V rail and configured GPIO/DAC/PWM outputs are ideal voltage boundaries; MCU, Wi-Fi and regulator consumption are not included.",
  },
  "rpi-pico": {
    model: "ideal-board-supply-and-GPIO-sources",
    fidelity: "idealized",
    note: "3.3V and VBUS rails and configured GPIO outputs are ideal voltage boundaries; RP2040 and regulator consumption are not included.",
  },
  "microbit-v2": {
    model: "ideal-board-supply-and-GPIO-sources",
    fidelity: "idealized",
    note: "Board rails and configured IO are ideal voltage boundaries; nRF52, LED matrix and regulator current are not included.",
  },
  breadboard: {
    model: "copper-interconnect-network",
    fidelity: "first-order",
    note: "Terminal strips and rails are connected with a small numerical conductor resistance for current sharing; contact resistance and rail breaks are simplified.",
  },
  led: {
    model: "piecewise-linear-diode",
    fidelity: "partial",
    note: "Colour-specific forward voltage plus a 10Ω dynamic-resistance proxy; external current limiting is solved, but temperature and thermal runaway are not.",
  },
  resistor: {
    model: "configured-ohmic-resistor",
    fidelity: "first-order",
    note: "Configured resistance is solved with Ohm's law; tolerance, temperature coefficient and power derating are not modeled.",
  },
  pushbutton: {
    model: "stateful-switch-contact",
    fidelity: "first-order",
    note: "Normally-open contact closes on press with a small contact resistance; bounce, wear and parasitic capacitance are not modeled.",
  },
  battery: {
    model: "ideal-configured-voltage-source",
    fidelity: "idealized",
    note: "Configured signed terminal voltage is ideal; internal resistance, state of charge and voltage sag are not modeled.",
  },
  potentiometer: {
    model: "two-section-variable-resistor",
    fidelity: "first-order",
    note: "Track resistance is split by the configured 0–1023 wiper position; a 0.5Ω floor regularizes endpoint resistance and wiper contact noise is omitted.",
  },
  servo: {
    model: "commanded-module-supply-estimate",
    fidelity: "estimated",
    note: "A labelled generic module current is applied when a valid servo command exists; torque, stall, acceleration and model-specific datasheet current are not represented.",
  },
  buzzer: {
    model: "active-piezo-resistive-proxy",
    fidelity: "partial",
    note: "An active tone uses a 100Ω first-order equivalent; real piezo impedance is frequency-dependent and cannot be inferred from this DC proxy.",
  },
  "rgb-led": {
    model: "three-piecewise-linear-diode-channels",
    fidelity: "partial",
    note: "Red, green and blue channels use separate colour-specific diode branches; resistor, PWM and reverse-bias behaviour are represented, thermal effects are not.",
  },
  "seven-segment": {
    model: "per-segment-diode-network",
    fidelity: "partial",
    note: "Each lit segment is a diode branch with common-anode/cathode polarity; current-limiting resistors must be external and multiplex timing is not modeled.",
  },
  "lcd-i2c": {
    model: "backlit-display-module-load-estimate",
    fidelity: "estimated",
    note: "Generic 5V display/backlight load estimate; exact LCD backpack, backlight setting and module revision are unspecified.",
  },
  ultrasonic: {
    model: "ultrasonic-module-supply-estimate",
    fidelity: "estimated",
    note: "Generic HC-SR04 supply-load estimate; echo/trig are signal interfaces and sensor timing/driver impedance are simplified.",
  },
  "pir-sensor": {
    model: "pir-module-supply-estimate",
    fidelity: "estimated",
    note: "Generic PIR module supply estimate; module revision and output-stage current are unspecified.",
  },
  ldr: {
    model: "light-dependent-resistor",
    fidelity: "first-order",
    note: "Configured light level sets a variable resistance that is solved in the network; spectral response and temperature dependence are simplified.",
  },
  tmp36: {
    model: "low-power-analog-sensor-estimate",
    fidelity: "estimated",
    note: "A labelled low-current sensor/breakout estimate and configured analog output voltage are modeled; exact breakout regulator/indicator current is unknown.",
  },
  "dc-motor": {
    model: "resistive-winding-proxy",
    fidelity: "partial",
    note: "A 50Ω winding proxy gives first-order current; back-EMF, inductance, stall transients, mechanical torque and speed-dependent load are not yet represented.",
  },
  "npn-transistor": {
    model: "switched-collector-emitter-resistance",
    fidelity: "partial",
    note: "Runtime-conducting state connects collector-emitter through a 0.2Ω switch proxy; base current, gain, saturation curves and thermal limits are omitted.",
  },
  relay: {
    model: "estimated-coil-and-switched-contact",
    fidelity: "partial",
    note: "Generic 5V coil-current estimate plus stateful COM–NO/NC contact resistance; flyback transient and exact relay coil specifications are not modeled.",
  },
  "ir-sensor": {
    model: "ir-module-supply-estimate-and-digital-output",
    fidelity: "estimated",
    note: "Generic module supply estimate and powered output level; IR LED/comparator revision and output impedance are not specified.",
  },
  dht11: {
    model: "low-power-digital-sensor-estimate",
    fidelity: "estimated",
    note: "Generic sensor supply estimate and a simplified data output; protocol timing, pull-up current and breakout indicators are not modeled.",
  },
  "oled-i2c": {
    model: "oled-display-module-load-estimate",
    fidelity: "estimated",
    note: "Generic OLED module supply estimate; panel content/brightness, regulator and I2C pull-up details vary by module.",
  },
  joystick: {
    model: "dual-potentiometer-track-and-switch",
    fidelity: "first-order",
    note: "Two nominal track-load estimates and powered analog output voltages are modeled; wiper contact noise and switch bounce are omitted.",
  },
  l298n: {
    model: "dual-hbridge-average-dc-proxy",
    fidelity: "partial",
    note: "Logic supply and derived motor VS current are solved; H-bridge outputs use average PWM voltage and motor branches use a 50Ω proxy without back-EMF or transistor voltage drops.",
  },
  "rotary-encoder": {
    model: "digital-encoder-output",
    fidelity: "signal-only",
    note: "Powered switch output and encoder reading are represented; quadrature edge timing, contact bounce and pull-up current are not simulated.",
  },
  "soil-moisture": {
    model: "resistive-sensor-module-estimate",
    fidelity: "estimated",
    note: "Generic module supply estimate and configured analog output level; probe excitation, soil conductivity and module revision are not specified.",
  },
  "keypad-4x4": {
    model: "matrix-contact-signal-interface",
    fidelity: "signal-only",
    note: "Rows/columns are digital signal interfaces; per-key contact closure topology and pull-up/pull-down current are not yet solved internally.",
  },
  "neopixel-ring": {
    model: "per-pixel-rgb-channel-load",
    fidelity: "estimated",
    note: "Each lit pixel channel uses a documented 20mA full-scale estimate; colour scales the load, while WS2812 timing, regulator loss and pixel revision are not modeled.",
  },
  "mq2-gas": {
    model: "heater-dominated-gas-module-estimate",
    fidelity: "estimated",
    note: "A labelled heater-dominated module supply estimate and simplified AO/DO outputs; warm-up, calibration, heater tolerance and module revision are not modeled.",
  },
}
