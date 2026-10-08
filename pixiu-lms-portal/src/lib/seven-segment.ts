/**
 * 7-Segment Display Utilities
 * Standard common-cathode / common-anode segment mappings, digit decoding,
 * and smart diagnostics for learning electronics.
 */

export const DIGIT_SEGMENTS: Record<number, string[]> = {
  0: ["a", "b", "c", "d", "e", "f"],
  1: ["b", "c"],
  2: ["a", "b", "d", "e", "g"],
  3: ["a", "b", "c", "d", "g"],
  4: ["b", "c", "f", "g"],
  5: ["a", "c", "d", "f", "g"],
  6: ["a", "c", "d", "e", "f", "g"],
  7: ["a", "b", "c"],
  8: ["a", "b", "c", "d", "e", "f", "g"],
  9: ["a", "b", "c", "d", "f", "g"],
}

const SEGMENT_IDS = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const

export function resolveSevenSegmentSegments(
  runtimeSegments?: Record<string, boolean>,
  previewDigit?: number,
): Record<string, boolean> {
  if (runtimeSegments !== undefined) {
    return Object.fromEntries(SEGMENT_IDS.map((segment) => [segment, Boolean(runtimeSegments[segment])]))
  }

  const digit = Number(previewDigit)
  const litSegments = Number.isInteger(digit) ? DIGIT_SEGMENTS[digit] : undefined
  return Object.fromEntries(SEGMENT_IDS.map((segment) => [segment, litSegments?.includes(segment) ?? false]))
}

export interface DecodedSevenSegment {
  digit?: number
  glyph?: string
  status: "digit" | "glyph" | "partial" | "blank"
  label: string
  activeSegments: string[]
  missingForDigit?: { targetDigit: number; missing: string[] }
  tip?: string
}

export function decodeSevenSegment(segments: Record<string, boolean> = {}): DecodedSevenSegment {
  const activeSegments = ["a", "b", "c", "d", "e", "f", "g", "dp"]
    .filter((s) => Boolean(segments[s]))

  if (activeSegments.length === 0) {
    return {
      status: "blank",
      label: "All segments OFF",
      activeSegments: [],
      tip: "Connect COM to GND and drive segment pins (a-g) HIGH to display numbers.",
    }
  }

  // Segment signature without DP
  const sig = ["a", "b", "c", "d", "e", "f", "g"]
    .filter((s) => Boolean(segments[s]))
    .sort()
    .join("")

  if (!sig) {
    return {
      glyph: ".",
      status: "glyph",
      label: "Decimal point only",
      activeSegments,
    }
  }

  // Check 0-9
  for (let d = 0; d <= 9; d++) {
    const dSig = [...DIGIT_SEGMENTS[d]].sort().join("")
    if (sig === dSig) {
      return {
        digit: d,
        glyph: String(d),
        status: "digit",
        label: `Digit ${d}`,
        activeSegments,
      }
    }
  }

  // Known alphanumeric characters
  const KNOWN_GLYPHS: Record<string, { glyph: string; name: string }> = {
    abcd: { glyph: "]", name: "Bracket ']' (a, b, c, d only)" },
    abcefg: { glyph: "A", name: "Letter 'A'" },
    cdefg: { glyph: "b", name: "Letter 'b'" },
    adef: { glyph: "C", name: "Letter 'C'" },
    bcdeg: { glyph: "d", name: "Letter 'd'" },
    adefg: { glyph: "E", name: "Letter 'E'" },
    aefg: { glyph: "F", name: "Letter 'F'" },
    bcefg: { glyph: "H", name: "Letter 'H'" },
    def: { glyph: "L", name: "Letter 'L'" },
    abefg: { glyph: "P", name: "Letter 'P'" },
    bcdef: { glyph: "U", name: "Letter 'U'" },
    g: { glyph: "-", name: "Dash '-'" },
  }

  const known = KNOWN_GLYPHS[sig]
  if (known) {
    let tip: string | undefined
    if (sig === "abcd") {
      tip = "Only bottom pins a, b, c, d are lit! Segments e, f, g (top pins) are unpowered. Connect Arduino pins to e, f, g to form digits 0-9."
    }
    return {
      glyph: known.glyph,
      status: sig === "abcd" ? "partial" : "glyph",
      label: known.name,
      activeSegments,
      missingForDigit: sig === "abcd" ? { targetDigit: 3, missing: ["g"] } : undefined,
      tip,
    }
  }

  // Check closest digit to suggest what's missing
  let bestDigit = 0
  let minMissing = 99
  let bestMissingList: string[] = []

  for (let d = 0; d <= 9; d++) {
    const required = DIGIT_SEGMENTS[d]
    const missing = required.filter((r) => !segments[r])
    const extra = activeSegments.filter((a) => a !== "dp" && !required.includes(a))
    const diff = missing.length + extra.length
    if (diff < minMissing) {
      minMissing = diff
      bestDigit = d
      bestMissingList = missing
    }
  }

  return {
    status: "partial",
    label: `Custom pattern (${activeSegments.join(", ")})`,
    activeSegments,
    missingForDigit: minMissing <= 3 ? { targetDigit: bestDigit, missing: bestMissingList } : undefined,
    tip:
      bestMissingList.length > 0
        ? `To display digit ${bestDigit}, also connect and energize segment pin(s): ${bestMissingList.map((m) => m.toUpperCase()).join(", ")}`
        : undefined,
  }
}
