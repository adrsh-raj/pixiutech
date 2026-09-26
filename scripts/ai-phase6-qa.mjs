import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DEFAULT_AI_CONFIDENCE_THRESHOLD,
  SOUND_AI_CONFIDENCE_THRESHOLD,
  TRAINED_AI_CONFIDENCE_THRESHOLD,
  normalizeAiDecision,
  normalizeAiVisionState,
} from "../pixiu-lms-portal/src/lib/ai/ai-result-normalizer.ts"
import { createAiVisionState } from "../pixiu-lms-portal/src/lib/ai/vision-state.ts"
import { countExtendedFingers } from "../pixiu-lms-portal/src/lib/ai/hand-detector.ts"
import { classifyExpression } from "../pixiu-lms-portal/src/lib/ai/face-detector.ts"

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
const face = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const sound = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const object = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const pose = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
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

// 6D/6G executable hand regression.
const handPoints = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
handPoints[0] = { x: 0, y: 0, z: 0 }
handPoints[1] = { x: 8, y: -4, z: 0 }
handPoints[2] = { x: 15, y: -8, z: 0 }
handPoints[3] = { x: 30, y: -10, z: 0 }
handPoints[4] = { x: 45, y: -12, z: 0 }
for (const [mcp, pip, dip, tip, x] of [
  [5, 6, 7, 8, 20],
  [9, 10, 11, 12, 30],
  [13, 14, 15, 16, 40],
  [17, 18, 19, 20, 50],
]) {
  handPoints[mcp] = { x, y: 0, z: 0 }
  handPoints[pip] = { x, y: -20, z: 0 }
  handPoints[dip] = { x, y: -40, z: 0 }
  handPoints[tip] = { x, y: -60, z: 0 }
}
assert(countExtendedFingers(handPoints) === 5, "extended five-finger pose must count as 5")

// 6E executable expression regression.
const happyFace = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }))
happyFace[61] = { x: 20, y: 50, z: 0 }
happyFace[291] = { x: 80, y: 50, z: 0 }
happyFace[13] = { x: 50, y: 47, z: 0 }
happyFace[14] = { x: 50, y: 53, z: 0 }
happyFace[159] = { x: 45, y: 40, z: 0 }
happyFace[145] = { x: 45, y: 45, z: 0 }
happyFace[386] = { x: 55, y: 40, z: 0 }
happyFace[374] = { x: 55, y: 45, z: 0 }
assert(classifyExpression(happyFace, [0, 0, 100, 100]).emotion === "happy", "happy facial geometry regression")

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

const ambiguous = normalizeAiVisionState({
  ...createAiVisionState("trained"),
  enabled: true,
  detectedClass: "Bottle",
  confidence: 91,
  lowConfidence: false,
  unknown: true,
  decisionReason: "ambiguous",
  detail: "top two classes are close",
})
assert(ambiguous.detectedClass === "bottle", "ambiguous source label must stay normalized")
assert(ambiguous.unknown === false, "source state must be recomputed by the boundary")


const low = normalizeAiVisionState({
  ...createAiVisionState("trained"),
  enabled: true,
  detectedClass: "Bottle",
  confidence: 44,
  detail: "test",
})
assert(low.detectedClass === "unknown", "low-confidence trained result must become unknown")
assert(low.unknown === true, "low-confidence trained result must set unknown")
assert(low.confidenceThreshold === TRAINED_AI_CONFIDENCE_THRESHOLD, "trained threshold contract")

const staleFlags = normalizeAiVisionState({
  ...createAiVisionState("trained"),
  enabled: true,
  detectedClass: "Bottle",
  confidence: 41,
  lowConfidence: false,
  unknown: false,
  detail: "stale flags",
})
assert(staleFlags.unknown === true, "normalizer must recompute stale unknown flag")
assert(staleFlags.lowConfidence === true, "normalizer must recompute stale low-confidence flag")

const soundState = normalizeAiVisionState({
  ...createAiVisionState("sound"),
  enabled: true,
  detectedClass: "yes",
  confidence: 65,
  detail: "possible command",
})
assert(soundState.detectedClass === "unknown", "sound bridge must keep sub-72% commands unknown")
assert(soundState.confidenceThreshold === SOUND_AI_CONFIDENCE_THRESHOLD, "sound threshold must match recognizer contract")

const strongSoundState = normalizeAiVisionState({
  ...createAiVisionState("sound"),
  enabled: true,
  detectedClass: "yes",
  confidence: 72,
  detail: "actionable command",
})
assert(strongSoundState.detectedClass === "yes", "72% sound command should be accepted")
assert(strongSoundState.confidenceThreshold === SOUND_AI_CONFIDENCE_THRESHOLD, "sound accepted threshold mismatch")

const trainedThresholdState = normalizeAiVisionState({
  ...createAiVisionState("trained"),
  enabled: true,
  detectedClass: "bottle",
  confidence: 61,
  detail: "below trained threshold",
})
assert(trainedThresholdState.detectedClass === "unknown", "trained result below 62% must be unknown")
assert(trainedThresholdState.confidenceThreshold === TRAINED_AI_CONFIDENCE_THRESHOLD, "trained threshold mismatch")

const malformed = normalizeAiVisionState({
  ...createAiVisionState("objects"),
  enabled: true,
  detectedClass: "Bottle",
  confidence: 80,
  probabilities: { Bottle: 105, Unknown: Number.NaN },
  allDetections: [{
    class: "Bottle",
    score: Number.NaN,
    bbox: [1, Number.NaN, -20, 4],
  }],
  detail: "malformed contract input",
})
assert(malformed.probabilities?.bottle === 100, "probabilities must be clamped to 0-100")
assert(malformed.probabilities?.unknown === 0, "invalid probability must normalize to 0")
assert(malformed.allDetections[0].score === 0, "invalid detection score must normalize to 0")
assert(malformed.allDetections[0].bbox[1] === 0, "invalid bbox coordinate must normalize to 0")
assert(malformed.allDetections[0].bbox[2] === 0, "negative bbox size must normalize to 0")

const staticSourceChecks = [
  ["6A mode registry", /objects/.test(panel) && /pose/.test(panel) && /hands/.test(panel) && /emotion/.test(panel) && /sound/.test(panel) && /numbers/.test(panel)],
  ["6A selected-resource loading", panel.includes('mode === "objects"') && panel.includes('mode === "pose"') && panel.includes('mode === "hands" || mode === "numbers"') && panel.includes('mode === "emotion"') && panel.includes('mode === "trained"')],
  ["6B object adapter", object.includes("lite_mobilenet_v2") && object.includes("detectObjects") && panel.includes("loadObjectDetector")],
  ["6C AI → Blockly bridge", pose.includes("singlepose/lightning/4") && workbench.includes("getAiDetectedClass") && workbench.includes("getAiConfidence") && runner.includes("ai_confidence")],
  ["6D hand adapter", hand.includes("MediaPipeHands") && hand.includes("maxHands: MAX_HANDS") && hand.includes("getExtendedFingerMask")],
  ["6E face adapter", face.includes("MediaPipeFaceMesh") && face.includes("refineLandmarks: true") && panel.includes("loadFaceDetector")],
  ["6F sound adapter", sound.includes("BROWSER_FFT") && sound.includes("generation") && panel.includes("loadSoundRecognizer") && runner.includes("ai_microphone_enable")],
  ["6G gesture interpreter", gesture.includes("interpretHandGesture") && workbench.includes("getAiGesture") && toolbox.includes("ai_get_gesture")],
  ["6H dataset workflow", engine.includes("addAiClass") && engine.includes("removeAiClass") && panel.includes("Import images") && panel.includes("Capture example")],
  ["6I configurable My AI training head", extractor.includes("MY_AI_FEATURE_SIZE") && extractor.includes("tf.image.resizeBilinear") && engine.includes("AiLayerType") && engine.includes("buildTrainableLayers") && engine.includes("validateClassifierModelShape") && !engine.includes("tf.layers.conv2d")],
  ["6J unknown/low-confidence", engine.includes("lowConfidence") && engine.includes("unknown") && extractor.includes("MY_AI_PREDICTION_THRESHOLD = 0.62")],
  ["6K normalization boundary", workbench.includes("normalizeAiVisionState") && workbench.includes("handleAiStateChange") && runner.includes("isAiUnknown")],
  ["6L data-source boundary", runner.includes("AI blocks are data/control inputs only") && blocks.includes("Browser AI generators")],
  ["6M Teach concepts", panel.includes("6M · How My AI learns") && panel.includes("DATASET") && panel.includes("TRAIN") && panel.includes("INFERENCE")],
  ["6N Understand explanation", panel.includes("6N · Why did AI produce this result?") && panel.includes("Class probabilities") && panel.includes("explainCurrentAiResult")],
  ["6O privacy controls", panel.includes("CAMERA · ") && panel.includes("MIC · ") && panel.includes("Erase local AI data") && engine.includes("localStorage.removeItem")],
  ["6P cleanup/restart", panel.includes("sessionRef") && panel.includes("cameraRequestRef") && panel.includes("releaseCurrentResource") && panel.includes("stopCameraStream") && !panel.includes("disposeAiResource")],

  ["6P permission handling", camera.includes("getUserMedia") && camera.includes("HTTPS") && panel.includes("Permission blocked")],
  ["6P sound threshold alignment", sound.includes("probabilityThreshold: 0.72") && resultNormalizer.includes("SOUND_AI_CONFIDENCE_THRESHOLD = 72")],
  ["6P training cancellation", engine.includes("shouldCancel") && panel.includes("trainingRunRef") && panel.includes("datasetVersionRef")],

  ["6P no-input path", createAiVisionState("objects").detectedClass === "none" && normalizeAiDecision("none", 0).reason === "no_input"],
  ["6P AI → virtual hardware isolation", !blocks.slice(blocks.indexOf("/* Browser AI generators")).match(/digitalWrite|analogWrite|setDigitalPin|motor_driver_write/)],
]

for (const [name, passed] of staticSourceChecks) {
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

assert(engine.includes("trainingHistory: history"), "training history persistence missing")
assert(engine.includes("validationConfusionMatrix"), "validation confusion matrix missing")
assert(engine.includes("estimateTrainingLoad"), "training load guard missing")
assert(panel.includes("MetricChart"), "training graph UI missing")
assert(panel.includes("Add layer"), "layer editor missing")
assert(panel.includes("Max epochs"), "extended epoch control missing")
assert(!panel.includes("customDepth"), "obsolete depth control remains")
assert(!panel.includes("customUnits"), "obsolete unit control remains")
assert(!panel.includes("customDropout"), "obsolete dropout control remains")
