import test from "node:test"
import assert from "node:assert/strict"
import { classifyAiRuntimeError, runtimeDetail } from "../../src/lib/ai/ai-runtime-state.ts"

for (const [name, input, expected] of [
  ["permission name", Object.assign(new Error("x"), { name: "NotAllowedError" }), "permission"],
  ["device missing", Object.assign(new Error("x"), { name: "NotFoundError" }), "unsupported"],
  ["model text", new Error("MoveNet model failed"), "model"],
  ["storage text", new Error("IndexedDB storage unavailable"), "storage"],
  ["cancel text", new Error("Training cancelled"), "cancelled"],
  ["inference text", new Error("Inference failed"), "inference"],
  ["unknown text", new Error("Something unexpected happened"), "unknown"],
] as const) {
  test("classifies " + name, () => {
    assert.equal(classifyAiRuntimeError(input), expected)
  })
}

test("runtime details remain mode-aware", () => {
  assert.equal(runtimeDetail("sound", "idle"), "Microphone idle")
  assert.equal(runtimeDetail("objects", "loading"), "Loading AI…")
  assert.equal(runtimeDetail("objects", "ready"), "AI ready")
})
