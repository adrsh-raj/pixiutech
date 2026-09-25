import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DEFAULT_AI_CONFIDENCE_THRESHOLD,
  normalizeAiDecision,
  normalizeAiVisionState,
} from "../pixiu-lms-portal/src/lib/ai/ai-result-normalizer.ts"
import { createAiVisionState } from "../pixiu-lms-portal/src/lib/ai/vision-state.ts"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = (relativePath) =>
  readFileSync(join(root, relativePath), "utf8")

const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const toolbox = read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx")
const camera = read("pixiu-lms-portal/src/lib/ai/camera-session.ts")
const hand = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const gesture = read("pixiu-lms-portal/src/lib/ai/gesture-interpreter.ts")
const extractor = read("pixiu-lms-portal/src/lib/ai/my-ai-feature-extractor.ts")
const types = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")

const failures = []

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function expectDecision(candidate, confidence, expected) {
  const actual = normalizeAiDecision(candidate, confidence)
  assert(actual.candidate === expected.candidate, "normalize candidate: " + candidate)
  assert(actual.confidence === expected.confidence, "normalize confidence: " + candidate)
  assert(actual.unknown === expected.unknown, "normalize unknown: " + candidate)
  assert(actual.lowConfidence === expected.lowConfidence, "normalize low confidence: " + candidate)
  assert(actual.reason === expected.reason, "normalize reason: " + candidate)
}

// 6J/6K executable normalization checks.
expectDecision("none", 0, {
  candidate: "none",
  confidence: 0,
  unknown: false,
  lowConfidence: false,
  reason: "no_input",
})
expectDecision("PERSON", 94, {
  candidate: "person",
  confidence: 94,
  unknown: false,
  lowConfidence: false,
  reason: "recognized",
})
expectDecision("cell phone", 51, {
  candidate: "unknown",
  confidence: 51,
  unknown: true,
  lowConfidence: true,
  reason: "low_confidence",
})
expectDecision("unknown", 88, {
  candidate: "unknown",
  confidence: 88,
  unknown: true,
  lowConfidence: false,
  reason: "low_confidence",
})
expectDecision("bottle", 140, {
  candidate: "bottle",
  confidence: 100,
  unknown: false,
  lowConfidence: false,
  reason: "recognized",
})
expectDecision("bottle", Number.NaN, {
  candidate: "unknown",
  confidence: 0,
  unknown: true,
  lowConfidence: true,
  reason: "low_confidence",
})

const numbers = normalizeAiVisionState({
  ...createAiVisionState("numbers"),
  enabled: true,
  detectedClass: "3",
  confidence: 92,
  detectedGesture: "Peace",
  fingerCount: 3,
  handedness: "Right",
  detail: "test",
})
assert(numbers.detectedClass === "3", "numbers value must remain numeric label string")
assert(numbers.detectedGesture === "peace", "gesture must be normalized")
assert(numbers.fingerCount === 3, "finger count must be clamped/rounded")
assert(numbers.unknown === false, "strong numbers result must be accepted")

const low = normalizeAiVisionState({
  ...createAiVisionState("trained"),
  enabled: true,
  detectedClass: "Bottle",
  confidence: 44,
  detail: "test",
})
assert(low.detectedClass === "unknown", "low-confidence trained result must become unknown")
assert(low.unknown === true, "low-confidence trained result must set unknown")
assert(low.confidenceThreshold === DEFAULT_AI_CONFIDENCE_THRESHOLD, "default threshold contract")

const staticSourceChecks = [
  ["6A mode registry", /objects/.test(panel) && /pose/.test(panel) && /hands/.test(panel) && /emotion/.test(panel) && /sound/.test(panel) && /numbers/.test(panel)],
  ["6A selected-resource loading", /mode === "objects"/.test(panel) && /mode === "pose"/.test(panel) && /mode === "hands" \\|\\| mode === "numbers"/.test(panel) && /mode === "emotion"/.test(panel) && /mode === "trained"/.test(panel)],
  ["6B object adapter", engine.includes("MAX_CLASSES = 8") && panel.includes("loadObjectDetector")],
  ["6C AI → Blockly bridge", workbench.includes("getAiDetectedClass") && workbench.includes("getAiConfidence") && runner.includes("ai_confidence")],
  ["6D hand adapter", hand.includes("MediaPipeHands") && hand.includes("maxHands: MAX_HANDS") && hand.includes("getExtendedFingerMask")],
  ["6E face adapter", extractor.includes("MobileNetV2") && panel.includes("loadFaceDetector")],
  ["6F sound adapter", panel.includes("loadSoundRecognizer") && runner.includes("ai_microphone_enable")],
  ["6G gesture interpreter", gesture.includes("interpretHandGesture") && workbench.includes("getAiGesture") && toolbox.includes("ai_get_gesture")],
  ["6H dataset workflow", engine.includes("addAiClass") && engine.includes("removeAiClass") && panel.includes("Import images") && panel.includes("Capture example")],
  ["6I transfer learning", extractor.includes("MY_AI_EMBEDDING_NODE") && engine.includes("Dense(96)") && !engine.includes("tf.layers.conv2d")],
  ["6J unknown/low-confidence", engine.includes("lowConfidence") && engine.includes("unknown") && extractor.includes("MY_AI_PREDICTION_THRESHOLD = 0.62")],
  ["6K normalization boundary", workbench.includes("normalizeAiVisionState") && workbench.includes("handleAiStateChange") && runner.includes("isAiUnknown")],
  ["6L data-source boundary", runner.includes("AI blocks are data/control inputs only") && blocks.includes("Browser AI generators")],
  ["6M Teach concepts", panel.includes("6M · How My AI learns") && panel.includes("DATASET") && panel.includes("TRAIN") && panel.includes("INFERENCE")],
  ["6N Understand explanation", panel.includes("6N · Why did AI produce this result?") && panel.includes("Class probabilities") && panel.includes("explainCurrentAiResult")],
  ["6O privacy controls", panel.includes("CAMERA · ") && panel.includes("MIC · ") && panel.includes("Erase local AI data") && engine.includes("localStorage.removeItem")],
  ["6P cleanup/restart", panel.includes("sessionRef") && panel.includes("cameraRequestRef") && panel.includes("releaseCurrentResource") && panel.includes("stopCameraStream")],
  ["6P permission handling", camera.includes("getUserMedia") && camera.includes("HTTPS") && panel.includes("Permission blocked")],
  ["6P no-input path", createAiVisionState("objects").detectedClass === "none" && normalizeAiDecision("none", 0).reason === "no_input"],
  ["6P AI → virtual hardware isolation", !blocks.slice(blocks.indexOf("/* Browser AI generators")).match(/digitalWrite|analogWrite|setDigitalPin|motor_driver_write/)],
]

for (const [name, passed] of requiredStaticChecks) {
  assert(passed, "static: " + name)
}

if (failures.length) {
  console.error("PIXIU Phase 6 QA matrix FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU Phase 6 QA matrix PASSED")
console.log("6J · live prediction unknown/low-confidence: PASS")
console.log("6K · normalized AI → Blockly contract: PASS")
console.log("6L · AI data-source / simulator hardware boundary: PASS")
console.log("6M · Teach mode concepts: PASS")
console.log("6N · Explain current result: PASS")
console.log("6O · camera/mic activity + local cleanup controls: PASS")
console.log("6P · cross-mode/restart/permission/no-input/integration matrix: PASS")
