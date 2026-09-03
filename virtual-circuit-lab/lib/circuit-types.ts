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
  | "breadboard"
  | "led"
  | "resistor"
  | "pushbutton"
  | "battery"
  | "potentiometer"
  | "servo"
  | "buzzer"

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
