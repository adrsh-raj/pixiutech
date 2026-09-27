import test from "node:test"
import assert from "node:assert/strict"
import { createAiVisionState } from "../../src/lib/ai/vision-state.ts"

test("creates safe default object state", () => {
  const state = createAiVisionState("objects")
  assert.equal(state.enabled, false)
  assert.equal(state.detectedClass, "none")
  assert.equal(state.confidence, 0)
  assert.equal(state.confidenceThreshold, 60)
  assert.equal(state.decisionReason, "no_input")
  assert.deepEqual(state.allDetections, [])
})

test("creates trained and numbers-specific state contracts", () => {
  const trained = createAiVisionState("trained")
  assert.equal(trained.modelSource, "trained")
  assert.equal(trained.confidenceThreshold, 62)
  const numbers = createAiVisionState("numbers")
  assert.equal(numbers.fingerCount, 0)
  assert.equal(numbers.handedness, "none")
  assert.deepEqual(numbers.modelClasses, ["0", "1", "2", "3", "4", "5"])
})
