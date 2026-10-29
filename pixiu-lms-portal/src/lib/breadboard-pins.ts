/** Resolve pin IDs from older breadboard layouts to the matching modern hole. */
export function normalizeBreadboardPinId(pinId: string): string {
  const pin = pinId.trim().toLowerCase()
  const railAliases: Record<string, string> = {
    pos_top: "pos_t_1",
    neg_top: "neg_t_1",
    pos_bot: "pos_b_1",
    neg_bot: "neg_b_1",
  }
  if (railAliases[pin]) return railAliases[pin]

  const legacyRow = /^([a-e])([12])$/.exec(pin)
  if (legacyRow) {
    const row = legacyRow[1]
    const column = (row.charCodeAt(0) - "a".charCodeAt(0) + 1) * 3
    const canonicalRow = legacyRow[2] === "1"
      ? row
      : String.fromCharCode(row.charCodeAt(0) + 5)
    return `${canonicalRow}_${column}`
  }

  return pinId
}

export function getLegacyBreadboardPinMappings(): Array<[legacy: string, canonical: string]> {
  const mappings: Array<[string, string]> = [
    ["pos_top", "pos_t_1"],
    ["neg_top", "neg_t_1"],
    ["pos_bot", "pos_b_1"],
    ["neg_bot", "neg_b_1"],
  ]
  for (const row of ["a", "b", "c", "d", "e"]) {
    const column = (row.charCodeAt(0) - "a".charCodeAt(0) + 1) * 3
    mappings.push([`${row}1`, `${row}_${column}`])
    mappings.push([`${row}2`, `${String.fromCharCode(row.charCodeAt(0) + 5)}_${column}`])
  }
  return mappings
}
