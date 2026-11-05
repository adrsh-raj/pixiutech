/**
 * PIXIU TECH CYBERLAB — BLOCKLY REPAIR & RUNTIME VALIDATION MIDDLEWARE
 * 
 * Enforces the canonical Blockly contract, XML namespace standardization,
 * robust truncated tag closure, semantic block alias normalization,
 * and pedagogical/hardware safety prompt wrappers for PixiuMind 14B inference.
 * 
 * Strict Section 2.3 Repair Integrity Rules:
 * - Deterministic and idempotent.
 * - Only verified semantic aliases (no blind string replacements).
 * - Safe rejection of unsupported peripherals (MAX6675 SPI, TM1637, serial packet reads).
 */

export interface RepairResult {
  repairedXml: string | null
  success: boolean
  isHealed: boolean
  actions: string[]
  unsupportedBlocks: string[]
  error?: string
}

// Canonical Aliases with 100% verified semantic equivalence in arduino-blocks.ts
export const VERIFIED_BLOCK_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  // pir_motion_detected has field PIN -> pir_motion has field PIN, generates digitalRead
  pir_motion_detected: "pir_motion",
  // actuator_servo_write has field PIN, value ANGLE -> servo_write has field PIN, value ANGLE
  actuator_servo_write: "servo_write",
  // io_tone -> tone_play
  io_tone: "tone_play",
  // io_notone -> tone_stop
  io_notone: "tone_stop",
})

// Unsupported peripherals that MUST be rejected safely rather than corrupted
export const UNKNOWN_UNSUPPORTED_BLOCKS: ReadonlySet<string> = new Set([
  "max6675_read",
  "max6675_init",
  "t777_display_write",
  "tm1637_init",
  "tm1637_display",
  "servo_read",
  "serial_read",
  "serial_available",
  "time_millis",
])

/**
 * Extracts, heals, and normalizes Blockly XML from raw LLM responses.
 */
export function repairBlocklyXml(rawText: string): RepairResult {
  if (!rawText || typeof rawText !== "string") {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions: [],
      unsupportedBlocks: [],
      error: "Empty or invalid response text",
    }
  }

  const actions: string[] = []

  // 1. Extract XML block from markdown code fence or bare tags
  let rawXml: string | null = null
  const fencedMatch = rawText.match(/```(?:xml)?\s*(<xml[\s\S]*?(?:<\/xml>|$))\s*```/i)
  if (fencedMatch) {
    rawXml = fencedMatch[1].trim()
  } else {
    const bareMatch = rawText.match(/(<xml[\s\S]*?(?:<\/xml>|$))/i)
    if (bareMatch) {
      rawXml = bareMatch[1].trim()
    } else {
      const rootBlockMatch = rawText.match(/(<block\s+type=["']arduino_program["'][\s\S]*)/i)
      if (rootBlockMatch) {
        rawXml = `<xml xmlns="https://developers.google.com/blockly/xml">\n${rootBlockMatch[1].trim()}\n</xml>`
        actions.push("WRAPPED_ROOT_BLOCK_IN_XML")
      }
    }
  }

  if (!rawXml) {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions,
      unsupportedBlocks: [],
      error: "No Blockly XML found in response text",
    }
  }

  let xml = rawXml.trim()

  // 2. Heal truncated XML (closing open tags if truncated before </xml>)
  let isHealed = false
  if (!xml.endsWith("</xml>")) {
    isHealed = true
    actions.push("HEALED_TRUNCATED_TAGS")
    // Strip trailing incomplete tag fragment (e.g., `<block type="io_d`)
    xml = xml.replace(/<[^>]*$/, "").trim()

    // Strip trailing empty container tags that require block children
    let stripped = true
    while (stripped) {
      const prev = xml
      xml = xml.replace(/<next>\s*$/i, "")
      xml = xml.replace(/<(?:value|statement)[^>]*>\s*$/i, "")
      stripped = xml !== prev
    }
    xml = xml.trim()

    // Match all tag tokens
    const tagMatches = xml.match(/<(\/?[a-zA-Z0-9_-]+)[^>]*>/g) || []
    const openStack: string[] = []
    const voidTags = new Set(["shadow"])

    for (const token of tagMatches) {
      const tagNameMatch = token.match(/<(\/?)([a-zA-Z0-9_-]+)/)
      if (!tagNameMatch) continue
      const isClosing = tagNameMatch[1] === "/"
      const tagName = tagNameMatch[2].toLowerCase()

      if (isClosing) {
        if (openStack.length > 0 && openStack[openStack.length - 1] === tagName) {
          openStack.pop()
        }
      } else {
        if (!token.endsWith("/>") && !voidTags.has(tagName)) {
          openStack.push(tagName)
        }
      }
    }

    // Close remaining open tags in reverse LIFO order
    for (let i = openStack.length - 1; i >= 0; i--) {
      xml += `</${openStack[i]}>`
    }
    if (!xml.endsWith("</xml>")) {
      xml += "</xml>"
    }
  }

  // Verify XML well-formedness
  let parseValid = true
  let parseErrorMsg = ""
  try {
    const openTags: string[] = []
    const tags = xml.match(/<(\/?[a-zA-Z0-9_-]+)[^>]*>/g) || []
    for (const t of tags) {
      const m = t.match(/<(\/?)([a-zA-Z0-9_-]+)/)
      if (!m) continue
      const isClose = m[1] === "/"
      const name = m[2].toLowerCase()
      if (t.endsWith("/>")) continue
      if (isClose) {
        const popped = openTags.pop()
        if (popped !== name) {
          parseValid = false
          parseErrorMsg = `Mismatched tag: expected </${popped}>, found </${name}>`
          break
        }
      } else {
        openTags.push(name)
      }
    }
    if (openTags.length > 0) {
      parseValid = false
      parseErrorMsg = `Unclosed tags remaining: ${openTags.join(", ")}`
    }
  } catch (err) {
    parseValid = false
    parseErrorMsg = err instanceof Error ? err.message : String(err)
  }

  if (!parseValid) {
    return {
      repairedXml: null,
      success: false,
      isHealed,
      actions,
      unsupportedBlocks: [],
      error: `XML healing failed: ${parseErrorMsg}`,
    }
  }

  // 3. Ensure Google standard XML namespace
  if (!xml.includes('xmlns="https://developers.google.com/blockly/xml"')) {
    xml = xml.replace(/<xml(?:\s+[^>]*)?>/i, '<xml xmlns="https://developers.google.com/blockly/xml">')
    actions.push("INJECTED_GOOGLE_XML_NAMESPACE")
  }

  // 4. Apply verified block aliases
  for (const [srcAlias, targetBlock] of Object.entries(VERIFIED_BLOCK_ALIASES)) {
    const pattern = new RegExp(`type=["']${srcAlias}["']`, "g")
    if (pattern.test(xml)) {
      xml = xml.replace(pattern, `type="${targetBlock}"`)
      actions.push(`ALIASED_${srcAlias}_TO_${targetBlock}`)
    }
  }

  // 5. Detect and reject unsupported blocks
  const detectedBlocks = Array.from(xml.matchAll(/type=["']([^"']+)["']/g)).map(m => m[1])
  const unsupported = detectedBlocks.filter(b => UNKNOWN_UNSUPPORTED_BLOCKS.has(b))

  if (unsupported.length > 0) {
    return {
      repairedXml: xml,
      success: false,
      isHealed,
      actions,
      unsupportedBlocks: Array.from(new Set(unsupported)),
      error: `Unsupported peripheral blocks detected: ${Array.from(new Set(unsupported)).join(", ")}. These hardware blocks are not defined in the Pixiu LMS toolbox.`,
    }
  }

  return {
    repairedXml: xml,
    success: true,
    isHealed,
    actions,
    unsupportedBlocks: [],
  }
}

/**
 * Wraps outgoing user requests with required pedagogical and hardware safety guardrails.
 */
export function wrapCopilotPrompt(
  prompt: string,
  options: {
    domain?: "math" | "circuit" | "general"
    hasInductiveLoad?: boolean
  } = {}
): string {
  const parts: string[] = []

  if (options.domain === "math") {
    parts.push(
      "[PEDAGOGICAL GUARDRAIL: In Math Teaching mode, ask the student a diagnostic guiding question first. Do not provide the complete algebraic solution in Turn 1.]"
    )
  }

  if (options.hasInductiveLoad) {
    parts.push(
      "[HARDWARE SAFETY GUARDRAIL: Inductive Load Protection (ATmega328P Datasheet Sec. 32): MCU pins cannot supply coil current (>20mA recommended continuous, 40mA absolute maximum). An external driver (BJT/MOSFET/relay module) is mandatory. Select flyback protection based on load switching frequency:\n" +
      "1) Low-frequency switching (<100Hz, DC relay coils): Standard silicon rectifier (1N4007, 1A/1000V, trr ≈ 30µs) is acceptable.\n" +
      "2) High-frequency PWM motor/fan control (Uno PWM 490/980Hz): Use a fast-recovery or Schottky diode (1N5819 / SS14 / 1N5822, trr < 10ns, VF ≤ 0.45V) to eliminate reverse-recovery heating, shoot-through spikes, and driver stress.\n" +
      "3) Micro servos (SG90): Internal H-bridge; control line draws <1mA logic pulses; provide external 5V/GND rail to prevent MCU brownout when stall current exceeds 20mA.]"
    )
  } else if (options.domain === "circuit") {
    parts.push(
      "[CIRCUIT GUARDRAIL: ATmega328P continuous DC current limit is 20mA per I/O pin (200mA total VCC/GND limit). Use series current-limiting resistors for all LEDs.]"
    )
  }

  parts.push(prompt.trim())
  return parts.join("\n\n")
}
