import type { PartType, PlacedPart } from "./circuit-types"
import { CATALOG } from "./components-catalog"

export interface LedElectricalModel {
  forwardVoltage: number
  maxForwardCurrentMa: number
  nominalForwardCurrentMa: number
}

/**
 * Resolve LED electrical characteristics from the component catalogue, with
 * per-instance overrides for experiments. Simulation and nodal analysis must
 * use this same source of truth.
 */
export function getLedElectricalModel(part: PlacedPart, colorOverride?: string): LedElectricalModel {
  if (part.type !== "led" && part.type !== "rgb-led") {
    throw new Error(`LED electrical model requested for non-LED component: ${part.type}`)
  }

  const metadata = CATALOG[part.type].electrical
  const voltageByColor = metadata?.forwardVoltageByColor
  if (!voltageByColor || Object.keys(voltageByColor).length === 0) {
    throw new Error(`Missing forward-voltage metadata for component type ${part.type}`)
  }

  const defaultColor = String(CATALOG[part.type].defaults?.color ?? "red").toLowerCase()
  const color = String(colorOverride ?? part.props.color ?? defaultColor).trim().toLowerCase()
  const configuredVoltage = Number(part.props.forwardVoltage)
  const forwardVoltage =
    Number.isFinite(configuredVoltage) && configuredVoltage > 0
      ? configuredVoltage
      : voltageByColor[color] ?? voltageByColor[defaultColor] ?? Object.values(voltageByColor)[0]

  const configuredMaximum = Number(part.props.maxForwardCurrentMa)
  const configuredNominal = Number(part.props.nominalForwardCurrentMa)
  const maxForwardCurrentMa =
    Number.isFinite(configuredMaximum) && configuredMaximum > 0
      ? configuredMaximum
      : metadata.maxForwardCurrentMa ?? 30
  const nominalForwardCurrentMa =
    Number.isFinite(configuredNominal) && configuredNominal > 0
      ? configuredNominal
      : metadata.nominalForwardCurrentMa ?? 15

  return {
    forwardVoltage,
    maxForwardCurrentMa,
    nominalForwardCurrentMa,
  }
}

/** Convert the Blockly analogWrite 8-bit value to a normalized PWM duty. */
export function getPwmDutyCycle(value: number, fullScale = 255): number {
  if (!Number.isFinite(value) || !Number.isFinite(fullScale) || fullScale <= 0) return 0
  return Math.max(0, Math.min(1, value / fullScale))
}

/** A driven pin has full logic-level pulse amplitude; duty controls average load. */
export function getPwmDrive(value: number, fullScale = 255): { duty: number; isActive: boolean } {
  const duty = getPwmDutyCycle(value, fullScale)
  return { duty, isActive: duty > 0 }
}
