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
    blurb: "Half+ solderless prototyping board",
    width: 420,
    height: 150,
    pins: [
      { id: "pos_top", label: "+ rail", x: 30, y: 14, kind: "power" },
      { id: "neg_top", label: "- rail", x: 30, y: 30, kind: "ground" },
      { id: "pos_bot", label: "+ rail", x: 30, y: 120, kind: "power" },
      { id: "neg_bot", label: "- rail", x: 30, y: 136, kind: "ground" },
      { id: "a1", label: "row A", x: 90, y: 62, kind: "passive" },
      { id: "b1", label: "row B", x: 150, y: 62, kind: "passive" },
      { id: "c1", label: "row C", x: 210, y: 62, kind: "passive" },
      { id: "d1", label: "row D", x: 270, y: 62, kind: "passive" },
      { id: "e1", label: "row E", x: 330, y: 62, kind: "passive" },
      { id: "a2", label: "row A", x: 90, y: 90, kind: "passive" },
      { id: "b2", label: "row B", x: 150, y: 90, kind: "passive" },
      { id: "c2", label: "row C", x: 210, y: 90, kind: "passive" },
      { id: "d2", label: "row D", x: 270, y: 90, kind: "passive" },
      { id: "e2", label: "row E", x: 330, y: 90, kind: "passive" },
    ],
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
}

export const PALETTE_ORDER: PartType[] = [
  "arduino-uno",
  "breadboard",
  "led",
  "resistor",
  "pushbutton",
  "potentiometer",
  "servo",
  "buzzer",
  "battery",
]

export const PIN_KIND_COLOR: Record<PinKind, string> = {
  power: "var(--color-destructive)",
  ground: "var(--color-foreground)",
  digital: "var(--color-primary)",
  analog: "var(--color-accent)",
  passive: "var(--color-muted-foreground)",
}
