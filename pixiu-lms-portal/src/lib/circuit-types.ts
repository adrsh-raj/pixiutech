export type PinKind = "power" | "ground" | "digital" | "analog" | "passive"

export interface PinDef {
  /** stable id, unique within the part */
  id: string
  /** human label shown in tooltips / inspector */
  label: string
  /** local coordinates relative to the part origin (unrotated) */
  x: number
  y: number
  kind: PinKind
}

export type PartType =
  | "arduino-uno"
  | "esp32-devkit"
  | "rpi-pico"
  | "microbit-v2"
  | "breadboard"
  | "led"
  | "resistor"
  | "pushbutton"
  | "battery"
  | "potentiometer"
  | "servo"
  | "buzzer"
  | "rgb-led"
  | "seven-segment"
  | "lcd-i2c"
  | "ultrasonic"
  | "pir-sensor"
  | "ldr"
  | "tmp36"
  | "dc-motor"
  | "npn-transistor"
  | "relay"
  | "ir-sensor"
  | "dht11"
  | "oled-i2c"
  | "joystick"
  | "l298n"
  | "rotary-encoder"
  | "soil-moisture"
  | "keypad-4x4"
  | "neopixel-ring"
  | "mq2-gas"

export interface PartEducationalMeta {
  gradeBand: "6-8" | "8-10" | "9-11"
  concept: string
  realWorld: string
  experiment: string
  hint: string
}

export interface PartDef {
  type: PartType
  name: string
  /** short description shown in the palette */
  blurb: string
  /** bounding box of the artwork */
  width: number
  height: number
  pins: PinDef[]
  /** default editable properties */
  defaults?: Record<string, string | number>
  /** Registry metadata used by palette, simulator and Blockly integrations. */
  category?: "controller" | "input" | "sensor" | "output" | "display" | "motor" | "driver" | "logic"
  electricalModel?: string
  runtimeModel?: string
  blockIds?: string[]
  educational?: PartEducationalMeta
}

export interface PlacedPart {
  /** instance id */
  id: string
  type: PartType
  x: number
  y: number
  rotation: number
  /** editable per-instance properties (color, resistance, label...) */
  props: Record<string, string | number>
}

export interface Wire {
  id: string
  from: PinRef
  to: PinRef
  color: string
}

export interface PinRef {
  partId: string
  pinId: string
}

export interface CircuitState {
  parts: PlacedPart[]
  wires: Wire[]
}
