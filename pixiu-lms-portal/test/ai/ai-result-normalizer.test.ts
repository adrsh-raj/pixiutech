import test from "node:test"
import assert from "node:assert/strict"
import { normalizeAiDecision, normalizeAiVisionState, getAiConfidenceThreshold } from "../../src/lib/ai/ai-result-normalizer.ts"

test("AI decision accepts recognized result at threshold", () => {
  const result = normalizeAiDecision("Bottle", 62, 62)
  assert.deepEqual(result, {
    candidate: "bottle",
    confidence: 62,
    accepted: true,
    unknown: false,
    lowConfidence: false,
    reason: "recognized",
  })
})

test("AI decision rejects none, unknown, and below-threshold results", () => {
  assert.equal(normalizeAiDecision("none", 99).reason, "no_input")
  assert.equal(normalizeAiDecision("unknown", 99).unknown, true)
  assert.equal(normalizeAiDecision("car", 59, 60).candidate, "unknown")
})

test("AI decision clamps malformed numeric confidence", () => {
  const result = normalizeAiDecision("car", Number.NaN, 60)
  assert.equal(result.confidence, 0)
  assert.equal(result.unknown, true)
})

test("vision state normalizes aliases, detections, probabilities, and finger count", () => {
  const state = normalizeAiVisionState({
    enabled: true,
    mode: "numbers",
    detectedClass: "CELL PHONE",
    confidence: 80,
    allDetections: [{ class: "Cell Phone", score: Number.NaN, bbox: [1, 2, -4, Number.NaN] }],
    fingerCount: 99,
    detail: "test",
  })
  assert.equal(state.detectedClass, "phone")
  assert.equal(state.confidence, 80)
  assert.equal(state.allDetections[0].class, "phone")
  assert.deepEqual(state.allDetections[0].bbox, [1, 2, 0, 0])
  assert.equal(state.fingerCount, 5)
  assert.equal(getAiConfidenceThreshold("sound"), 72)
  assert.equal(getAiConfidenceThreshold("trained"), 62)
})
