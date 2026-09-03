import type { PartDef, PartType, PinDef, PinKind } from "./circuit-types"

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

export const CATALOG: Record<PartType, PartDef> = {
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno",
    blurb: "ATmega328P microcontroller board",
    width: ARDUINO_W,
    height: ARDUINO_H,
    pins: [...topPins, ...bottomPins],
  },
  breadboard: {
    type: "breadboard",
    name: "Breadboard",
    blurb: "Full 20-column solderless prototyping breadboard with bus rails",
    width: 460,
    height: 214,
    pins: (() => {
      const pins: PinDef[] = []
      for (let c = 1; c <= 20; c++) {
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
  },
  battery: {
    type: "battery",
    name: "9V Battery",
    blurb: "DC power source",
    width: 62,
    height: 92,
    pins: [
      { id: "pos", label: "+", x: 20, y: 88, kind: "power" },
      { id: "neg", label: "-", x: 42, y: 88, kind: "ground" },
    ],
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
    defaults: { value: 512 },
  },
  servo: {
    type: "servo",
    name: "Servo Motor",
    blurb: "Positional rotation motor",
    width: 90,
    height: 60,
    pins: [
      { id: "sig", label: "Signal", x: 4, y: 16, kind: "digital" },
      { id: "vcc", label: "VCC", x: 4, y: 30, kind: "power" },
      { id: "gnd", label: "GND", x: 4, y: 44, kind: "ground" },
    ],
    defaults: { angle: 90 },
  },
  buzzer: {
    type: "buzzer",
    name: "Piezo Buzzer",
    blurb: "Produces tones",
    width: 56,
    height: 56,
    pins: [
      { id: "pos", label: "+", x: 20, y: 52, kind: "power" },
      { id: "neg", label: "-", x: 36, y: 52, kind: "ground" },
    ],
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
  },
  "dc-motor": {
    type: "dc-motor",
    name: "DC Motor",
    blurb: "Small brushed DC motor",
    width: 60,
    height: 60,
    pins: [
      { id: "pos", label: "M+", x: 15, y: 56, kind: "passive" },
      { id: "neg", label: "M-", x: 45, y: 56, kind: "passive" },
    ],
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
  },
  relay: {
    type: "relay",
    name: "Relay Module",
    blurb: "5V single-channel relay for high-voltage switching",
    width: 80,
    height: 70,
    pins: [
      { id: "vcc", label: "VCC", x: 15, y: 66, kind: "power" },
      { id: "gnd", label: "GND", x: 35, y: 66, kind: "ground" },
      { id: "in", label: "IN", x: 55, y: 66, kind: "passive" },
      { id: "com", label: "COM", x: 15, y: 4, kind: "passive" },
      { id: "no", label: "NO", x: 40, y: 4, kind: "passive" },
      { id: "nc", label: "NC", x: 65, y: 4, kind: "passive" },
    ],
  },
}

export const PALETTE_ORDER: PartType[] = [
  "arduino-uno",
  "breadboard",
  "led",
  "rgb-led",
  "seven-segment",
  "lcd-i2c",
  "resistor",
  "pushbutton",
  "potentiometer",
  "ldr",
  "ultrasonic",
  "pir-sensor",
  "tmp36",
  "servo",
  "dc-motor",
  "buzzer",
  "npn-transistor",
  "relay",
  "battery",
]

export const PIN_KIND_COLOR: Record<PinKind, string> = {
  power: "var(--color-destructive)",
  ground: "var(--color-foreground)",
  digital: "var(--color-primary)",
  analog: "var(--color-accent)",
  passive: "var(--color-muted-foreground)",
}
