import test from "node:test"
import assert from "node:assert/strict"
import { normalizeAiEmbeddingValues, MY_AI_FEATURE_SIZE } from "../../src/lib/ai/my-ai-feature-extractor.ts"

test("embedding contract requires exactly 512 finite values and returns unit norm", () => {
  const values = Array.from({ length: MY_AI_FEATURE_SIZE }, (_, index) => index + 1)
  const normalized = normalizeAiEmbeddingValues(values)
  assert.equal(normalized.length, MY_AI_FEATURE_SIZE)
  assert.equal(normalized.every(Number.isFinite), true)
  const norm = Math.sqrt(normalized.reduce((sum, value) => sum + value * value, 0))
  assert.ok(Math.abs(norm - 1) < 1e-10)
})

test("embedding contract rejects wrong length and non-finite values", () => {
  assert.throws(
    () => normalizeAiEmbeddingValues(new Array(511).fill(1)),
    /feature-size mismatch/i,
  )
  const values = new Array(MY_AI_FEATURE_SIZE).fill(1)
  values[10] = Number.NaN
  assert.throws(
    () => normalizeAiEmbeddingValues(values),
    /NaN or Infinity/i,
  )
})

test("embedding contract rejects the zero vector", () => {
  assert.throws(
    () => normalizeAiEmbeddingValues(new Array(MY_AI_FEATURE_SIZE).fill(0)),
    /cannot be normalized safely/i,
  )
})
