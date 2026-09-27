import test from "node:test"
import assert from "node:assert/strict"
import {
  AIDatasetError,
  AIModelShapeError,
  AIPermissionError,
  toAiRuntimeError,
} from "../../src/lib/ai/ai-errors.ts"

test("dataset and model-shape failures preserve typed categories", () => {
  assert.equal(new AIDatasetError().kind, "storage")
  assert.equal(new AIModelShapeError().kind, "model")
})

test("media permission errors retain permission classification", () => {
  const camera = toAiRuntimeError(
    new Error("Camera permission is blocked for this site."),
    "Camera",
  )
  assert.ok(camera instanceof AIPermissionError)
  assert.equal(camera.kind, "permission")
})
