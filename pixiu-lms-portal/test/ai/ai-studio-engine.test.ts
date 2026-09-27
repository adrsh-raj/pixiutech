import test from "node:test"
import assert from "node:assert/strict"
import {
  addAiClass,
  getAiDatasetStats,
  estimateTrainingLoad,
  MAX_CLASSES,
  MAX_SAMPLES_PER_CLASS,
  MAX_TOTAL_SAMPLES,
} from "../../src/lib/ai-studio-engine.ts"

function emptyStore() {
  return { classes: [], samples: [], model: null }
}

test("dataset contract enforces normalized unique classes and the eight-class cap", () => {
  let store = emptyStore()
  for (let index = 0; index < MAX_CLASSES + 3; index += 1) {
    store = addAiClass(store, " Class " + index + " ")
  }
  assert.equal(store.classes.length, MAX_CLASSES)
  const same = addAiClass(store, store.classes[0]!.toUpperCase())
  assert.equal(same.classes.length, MAX_CLASSES)
})

test("dataset readiness requires two classes with at least three samples each", () => {
  const store = {
    classes: ["Bottle", "Cup"],
    samples: [
      { id: "1", label: "Bottle", dataUrl: "data:image/png;base64,a", createdAt: 1 },
      { id: "2", label: "Bottle", dataUrl: "data:image/png;base64,b", createdAt: 2 },
      { id: "3", label: "Bottle", dataUrl: "data:image/png;base64,c", createdAt: 3 },
      { id: "4", label: "Cup", dataUrl: "data:image/png;base64,d", createdAt: 4 },
      { id: "5", label: "Cup", dataUrl: "data:image/png;base64,e", createdAt: 5 },
      { id: "6", label: "Cup", dataUrl: "data:image/png;base64,f", createdAt: 6 },
    ],
    model: null,
  }
  const stats = getAiDatasetStats(store)
  assert.equal(stats.ready, true)
  assert.equal(stats.minSamples, 3)
  assert.equal(stats.maxSamples, 3)
})

test("training-load estimation distinguishes browser-safe and heavy configurations", () => {
  const light = estimateTrainingLoad(
    [{ type: "dense", units: 64, activation: "relu" }],
    2,
    512,
    20,
    16,
    8,
  )
  const heavy = estimateTrainingLoad(
    Array.from({ length: 8 }, () => ({ type: "dense", units: 256, activation: "relu" })),
    8,
    512,
    150,
    MAX_TOTAL_SAMPLES,
    2,
  )
  assert.equal(light.label, "Light")
  assert.equal(heavy.label, "High")
  assert.ok(heavy.parameters > light.parameters)
})

test("documented sample limits remain encoded in the engine", () => {
  assert.equal(MAX_SAMPLES_PER_CLASS, 20)
  assert.equal(MAX_TOTAL_SAMPLES, 80)
})
