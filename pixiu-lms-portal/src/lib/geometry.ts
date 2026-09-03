import type { PinRef, PlacedPart, Wire } from "./circuit-types"
import { CATALOG } from "./components-catalog"

export interface Point {
  x: number
  y: number
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

/** Absolute world position of a pin, accounting for the part's rotation. */
export function getPinPosition(part: PlacedPart, pinId: string): Point | null {
  const def = CATALOG[part.type]
  const pin = def.pins.find((p) => p.id === pinId)
  if (!pin) return null
  const cx = def.width / 2
  const cy = def.height / 2
  const local = rotatePoint(pin.x, pin.y, cx, cy, part.rotation)
  return { x: part.x + local.x, y: part.y + local.y }
}

export function getPinRefPosition(ref: PinRef, parts: PlacedPart[]): Point | null {
  const part = parts.find((p) => p.id === ref.partId)
  if (!part) return null
  return getPinPosition(part, ref.pinId)
}

/** Smooth, natural jumper-wire curve between two pins. */
export function wirePath(a: Point, b: Point): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const bend = Math.min(Math.max(Math.abs(dx) * 0.5, 35), 140)
  const c1x = a.x + Math.sign(dx || 1) * bend
  const c1y = a.y + (dy * 0.12)
  const c2x = b.x - Math.sign(dx || 1) * bend
  const c2y = b.y - (dy * 0.12)
  return `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${b.x} ${b.y}`
}

export function samePin(a: PinRef, b: PinRef): boolean {
  return a.partId === b.partId && a.pinId === b.pinId
}

export function wireTouchesPart(wire: Wire, partId: string): boolean {
  return wire.from.partId === partId || wire.to.partId === partId
}
