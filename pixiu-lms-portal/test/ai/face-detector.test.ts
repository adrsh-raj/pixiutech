import test from "node:test"
import assert from "node:assert/strict"
import { classifyExpression } from "../../src/lib/ai/face-detector.ts"

test("expression heuristic recognizes the documented happy-face geometry", () => {
  const points = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))
  points[61] = { x: 20, y: 50, z: 0 }
  points[291] = { x: 80, y: 50, z: 0 }
  points[13] = { x: 50, y: 47, z: 0 }
  points[14] = { x: 50, y: 53, z: 0 }
  points[159] = { x: 45, y: 40, z: 0 }
  points[145] = { x: 45, y: 45, z: 0 }
  points[386] = { x: 55, y: 40, z: 0 }
  points[374] = { x: 55, y: 45, z: 0 }
  const result = classifyExpression(points, [0, 0, 100, 100])
  assert.equal(result.emotion, "happy")
  assert.ok(result.score > 0.45)
})

test("expression classifier fails safely on an incomplete mesh", () => {
  const result = classifyExpression([], [0, 0, 0, 0])
  assert.equal(result.emotion, "neutral")
  assert.equal(result.score, 0.35)
})
