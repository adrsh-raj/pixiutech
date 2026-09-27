import test from "node:test"
import assert from "node:assert/strict"
import { interpretHandGesture } from "../../src/lib/ai/gesture-interpreter.ts"

function hand(mask: [boolean, boolean, boolean, boolean, boolean], score = 1, thumbTipY = 0.1) {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  points[0] = { x: 0, y: 0.5, z: 0 }
  points[2] = { x: 0, y: 0.4, z: 0 }
  points[4] = { x: 0, y: thumbTipY, z: 0 }
  return {
    score,
    boxScore: score,
    fingerScore: score,
    handedness: "Right",
    box: [0, 0, 1, 1] as [number, number, number, number],
    keypoints: points,
    extendedFingers: mask,
    fingerCount: mask.filter(Boolean).length,
  }
}

test("five extended fingers map to open palm", () => {
  const result = interpretHandGesture(hand([true, true, true, true, true]))
  assert.equal(result.gesture, "open_palm")
  assert.equal(result.number, 5)
  assert.equal(result.confidence, 96)
})

test("index-only maps to point", () => {
  const result = interpretHandGesture(hand([false, true, false, false, false]))
  assert.equal(result.gesture, "point")
  assert.equal(result.number, 1)
})

test("thumb direction distinguishes thumbs up", () => {
  const result = interpretHandGesture(hand([true, false, false, false, false], 1, -0.2))
  assert.equal(result.gesture, "thumbs_up")
})
