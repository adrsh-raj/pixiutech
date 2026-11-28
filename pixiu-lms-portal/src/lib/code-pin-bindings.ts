import { isBoardPart } from "./board-registry"
import { resolveCanonicalPin } from "./circuit-validator"

export interface CodePinBinding {
  pinId: string
  configuredMode: "OUTPUT" | "INPUT" | "PWM" | "SERVO" | "ANALOG_READ"
  codeSnippet: string
  source?: "blockly" | "cpp" | "both"
  rawPinToken?: string
}

export function normalizeCodePinToken(rawToken: string, boardPartType?: string): string | null {
  const clean = String(rawToken || "").trim()
  if (!clean) return null
  const upper = clean.toUpperCase()
  const targetType = boardPartType && isBoardPart(boardPartType) ? boardPartType : "arduino-uno"
  const mappedToken = upper === "LED_BUILTIN" ? "13" : clean
  const resolved = resolveCanonicalPin(targetType, mappedToken).toLowerCase()
  // Ensure resolved looks like a plausible pin id and not an unmapped constant name
  if (/^(d\d+|a\d+|gp\d+|gpio\d+|p\d+|tx\d*|rx\d*|sda|scl|mosi|miso|sck|ss|vp|vn|en|\d+)$/.test(resolved)) {
    return resolved
  }
  return null
}

/**
 * Extract canonical pin bindings from Blockly XML and generated Arduino C++ code.
 * Normalizes numeric Blockly pin tokens (e.g. "5", "13") via resolveCanonicalPin
 * so code references match physical board pins ("d5", "d13") reliably.
 */
export function extractCodePinBindings(
  blocklyXml?: string,
  generatedCode?: string,
  boardPartType?: string
): CodePinBinding[] {
  const merged = new Map<string, CodePinBinding>()

  const recordBinding = (
    rawToken: string,
    mode: CodePinBinding["configuredMode"],
    snippet: string,
    src: "blockly" | "cpp"
  ) => {
    const canonical = normalizeCodePinToken(rawToken, boardPartType)
    if (!canonical) return
    const key = `${canonical}:${mode}`
    const existing = merged.get(key)
    if (existing) {
      if (existing.source && existing.source !== src) {
        existing.source = "both"
      }
      return
    }
    merged.set(key, {
      pinId: canonical,
      configuredMode: mode,
      codeSnippet: snippet.slice(0, 120),
      source: src,
      rawPinToken: rawToken,
    })
  }

  if (blocklyXml && blocklyXml.trim()) {
    const fieldRe = /<field\s+name="(PIN|LED_PIN|BUTTON_PIN|BUZZER_PIN|SERVO_PIN|TRIG_PIN|ECHO_PIN)">([a-zA-Z0-9_]+)<\/field>/gi
    for (const match of blocklyXml.matchAll(fieldRe)) {
      const idx = match.index ?? 0
      const preceding = blocklyXml.slice(Math.max(0, idx - 240), idx).toLowerCase()
      const fieldName = match[1].toUpperCase()
      const rawPin = match[2]
      let mode: CodePinBinding["configuredMode"] = "OUTPUT"
      if (fieldName === "SERVO_PIN" || /servo/.test(preceding)) mode = "SERVO"
      else if (/pwm|analog_write/.test(preceding)) mode = "PWM"
      else if (/analog_read/.test(preceding)) mode = "ANALOG_READ"
      else if (fieldName === "BUTTON_PIN" || fieldName === "ECHO_PIN" || /digital_read|button/.test(preceding)) {
        mode = "INPUT"
      }
      recordBinding(rawPin, mode, match[0], "blockly")
    }
  }

  if (generatedCode && generatedCode.trim()) {
    const stripped = generatedCode
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")

    const symbolToPin = new Map<string, string>()
    for (const m of stripped.matchAll(/#define\s+([A-Za-z_]\w*)\s+([A-Za-z0-9_]+)/g)) {
      if (normalizeCodePinToken(m[2], boardPartType)) {
        symbolToPin.set(m[1], m[2])
      }
    }
    for (const m of stripped.matchAll(/\b(?:const\s+)?(?:int|uint8_t|byte)\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z0-9_]+)\s*;/g)) {
      if (normalizeCodePinToken(m[2], boardPartType)) {
        symbolToPin.set(m[1], m[2])
      }
    }

    const resolveArg = (arg: string): string => {
      const cleaned = arg.trim()
      return symbolToPin.get(cleaned) ?? cleaned
    }

    for (const m of stripped.matchAll(/\bpinMode\s*\(\s*([^,\s)]+)\s*,\s*(INPUT_PULLUP|INPUT|OUTPUT)\s*\)/g)) {
      const mode: CodePinBinding["configuredMode"] = m[2] === "OUTPUT" ? "OUTPUT" : "INPUT"
      recordBinding(resolveArg(m[1]), mode, m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\bdigitalWrite\s*\(\s*([^,\s)]+)\s*,/g)) {
      recordBinding(resolveArg(m[1]), "OUTPUT", m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\banalogWrite\s*\(\s*([^,\s)]+)\s*,/g)) {
      recordBinding(resolveArg(m[1]), "PWM", m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\btone\s*\(\s*([^,\s)]+)\s*,/g)) {
      recordBinding(resolveArg(m[1]), "PWM", m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\bdigitalRead\s*\(\s*([^,\s)]+)\s*\)/g)) {
      recordBinding(resolveArg(m[1]), "INPUT", m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\banalogRead\s*\(\s*([^,\s)]+)\s*\)/g)) {
      recordBinding(resolveArg(m[1]), "ANALOG_READ", m[0], "cpp")
    }
    for (const m of stripped.matchAll(/\.attach\s*\(\s*([^,\s)]+)\s*(?:,|\))/g)) {
      recordBinding(resolveArg(m[1]), "SERVO", m[0], "cpp")
    }
  }

  return Array.from(merged.values())
}
