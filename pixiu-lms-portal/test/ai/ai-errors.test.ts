import test from "node:test"
import assert from "node:assert/strict"
import {
  AICameraError,
  AIInferenceError,
  AIMicrophoneError,
  AIModelLoadError,
  AITensorShapeError,
  AIPermissionError,
  toAiRuntimeError,
} from "../../src/lib/ai/ai-errors.ts"

test("structured media errors preserve specific kinds", () => {
  assert.equal(new AICameraError().kind, "permission")
  assert.equal(new AIMicrophoneError().kind, "permission")
  assert.equal(new AIPermissionError().kind, "permission")
})

test("runtime wrapper maps tensor, model and inference failures", () => {
  assert.equal(toAiRuntimeError(new Error("tensor rank mismatch")).kind, "inference")
  assert.equal(toAiRuntimeError(new Error("MoveNet model failed"), "Pose").kind, "model")
  assert.equal(toAiRuntimeError(new Error("generic inference failure")).kind, "inference")
})

test("existing structured runtime errors are returned unchanged", () => {
  const error = new AIInferenceError()
  assert.equal(toAiRuntimeError(error), error)
  assert.equal(toAiRuntimeError(error).userMessage.length > 0, true)
})
