import test from "node:test"
import assert from "node:assert/strict"
import { isBudgetExceeded } from "../../src/lib/ai/ai-performance.ts"

const base = {
  mode: "objects",
  backend: "webgl",
  loadMs: 100,
  firstInferenceMs: 100,
  averageInferenceMs: 100,
  lastInferenceMs: 100,
  inferenceCount: 10,
  fps: 12,
  tensorCount: 1,
  tensorBytes: 1024,
  tensorGrowthBytes: 1024,
  jsHeapBytes: null,
  jsHeapGrowthBytes: null,
  hardwareConcurrency: 8,
}

test("performance budget stays green for normal metrics", () => {
  assert.deepEqual(isBudgetExceeded(base), {
    load: false,
    firstInference: false,
    steadyInference: false,
    fps: false,
    tensorGrowth: false,
  })
})

test("performance budget detects slow and memory-heavy runtime", () => {
  const result = isBudgetExceeded({
    ...base,
    loadMs: 11001,
    firstInferenceMs: 2501,
    averageInferenceMs: 501,
    fps: 1,
    tensorGrowthBytes: 25 * 1024 * 1024,
  })
  assert.deepEqual(result, {
    load: true,
    firstInference: true,
    steadyInference: true,
    fps: true,
    tensorGrowth: true,
  })
})
