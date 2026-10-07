import test from "node:test"
import assert from "node:assert/strict"

import { countExtendedFingers } from "../../src/lib/ai/hand-detector.ts"
import { normalizeAiDecision } from "../../src/lib/ai/ai-result-normalizer.ts"

test("hand contract counts an extended five-finger pose", () => {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  points[0] = { x: 0, y: 0, z: 0 }
  points[1] = { x: 8, y: -4, z: 0 }
  points[2] = { x: 15, y: -8, z: 0 }
  points[3] = { x: 30, y: -10, z: 0 }
  points[4] = { x: 45, y: -12, z: 0 }
  for (const [mcp, pip, dip, tip, x] of [
    [5, 6, 7, 8, 20],
    [9, 10, 11, 12, 30],
    [13, 14, 15, 16, 40],
    [17, 18, 19, 20, 50],
  ]) {
    points[mcp] = { x, y: 0, z: 0 }
    points[pip] = { x, y: -20, z: 0 }
    points[dip] = { x, y: -40, z: 0 }
    points[tip] = { x, y: -60, z: 0 }
  }
  assert.equal(countExtendedFingers(points), 5)
})

test("AI normalization turns low-confidence detections into unknown", () => {
  const result = normalizeAiDecision("cell phone", 51)
  assert.equal(result.candidate, "unknown")
  assert.equal(result.unknown, true)
  assert.equal(result.lowConfidence, true)
  assert.equal(result.reason, "low_confidence")
})

test("AI normalization preserves a recognized high-confidence class", () => {
  const result = normalizeAiDecision("PERSON", 94)
  assert.equal(result.candidate, "person")
  assert.equal(result.confidence, 94)
  assert.equal(result.unknown, false)
})
