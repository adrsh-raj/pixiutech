import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { transform } from "esbuild"

const source = await readFile(new URL("../../src/lib/seven-segment.ts", import.meta.url), "utf8")
const { code } = await transform(source, { loader: "ts", format: "esm" })
const library = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
const { decodeSevenSegment, DIGIT_SEGMENTS, resolveSevenSegmentSegments } = library

test("runtime outputs take precedence over the stopped-circuit preview digit", () => {
  const segments = resolveSevenSegmentSegments(
    { a: false, b: false, c: false, d: false, e: false, f: false, g: false, dp: false },
    8,
  )

  assert.equal(decodeSevenSegment(segments).status, "blank")
  assert.deepEqual(Object.values(segments), Array(8).fill(false))
})

test("digit preview is available only when no runtime output exists", () => {
  const segments = resolveSevenSegmentSegments(undefined, 8)

  assert.equal(decodeSevenSegment(segments).digit, 8)
  assert.equal(decodeSevenSegment(resolveSevenSegmentSegments(undefined, 10)).status, "blank")
})

test("all supported digits decode and a decimal point alone is not mistaken for a digit", () => {
  for (const [digit, active] of Object.entries(DIGIT_SEGMENTS)) {
    const segments = Object.fromEntries(active.map((segment) => [segment, true]))
    assert.equal(decodeSevenSegment(segments).digit, Number(digit))
  }

  assert.notEqual(decodeSevenSegment(resolveSevenSegmentSegments({ a: true }, 8)).digit, 8)
  assert.deepEqual(decodeSevenSegment({ dp: true }), {
    glyph: ".",
    status: "glyph",
    label: "Decimal point only",
    activeSegments: ["dp"],
  })
})
