import type { ArduinoPinState } from "./simulation"

export type PinStateUpdate = Pick<ArduinoPinState, "state"> &
  Partial<Pick<ArduinoPinState, "outputMode" | "value" | "angle" | "toneHz">>

/**
 * Replace a pin's complete runtime state across the legacy pin-name aliases.
 * Replacing (rather than merging) clears obsolete PWM, tone, or servo fields
 * when Blockly changes the same output pin to a different mode.
 */
export function writePinStateAliases(
  previous: Record<string, ArduinoPinState>,
  pin: string,
  state: PinStateUpdate,
): Record<string, ArduinoPinState> {
  const raw = String(pin).trim()
  if (!raw) return previous

  const digits = raw.replace(/^(gpio|gp|d|p)/i, "")
  const aliases = new Set([raw, raw.toLowerCase()])
  if (digits) {
    aliases.add(digits)
    aliases.add(`d${digits}`)
    aliases.add(`gpio${digits}`)
    aliases.add(`gp${digits}`)
    aliases.add(`p${digits}`)
  }

  const next = { ...previous }
  for (const alias of aliases) {
    next[alias] = { ...state }
  }
  return next
}
