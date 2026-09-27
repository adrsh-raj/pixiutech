import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = (path) => readFileSync(join(root, path), "utf8")

const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const canvasPanel = read("pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx")
const templates = read("pixiu-lms-portal/src/lib/templates.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const types = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
const toolbox = read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx")
const objectAdapter = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const poseAdapter = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const handAdapter = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const faceAdapter = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const soundAdapter = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const gestureAdapter = read("pixiu-lms-portal/src/lib/ai/gesture-interpreter.ts")
const featureExtractor = read("pixiu-lms-portal/src/lib/ai/my-ai-feature-extractor.ts")
const resultNormalizer = read("pixiu-lms-portal/src/lib/ai/ai-result-normalizer.ts")
const cameraSession = read("pixiu-lms-portal/src/lib/ai/camera-session.ts")
const visionState = read("pixiu-lms-portal/src/lib/ai/vision-state.ts")
const currentFlow = read("pixiu-lms-portal/src/lib/current-flow.ts")
const lessonEngine = read("pixiu-lms-portal/src/lib/lesson-engine.ts")
const multimeter = read("pixiu-lms-portal/src/components/circuit-lab/multimeter.tsx")
const oscilloscope = read("pixiu-lms-portal/src/components/circuit-lab/oscilloscope.tsx")

const failures = []
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(label + ": missing " + needle)
}
const forbidText = (text, needle, label) => {
  if (text.includes(needle)) failures.push(label + ": forbidden " + needle)
}
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

if (!existsSync(join(root, "pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx"))) {
  failures.push("integrated AI Vision Canvas panel is missing")
}

const engineImportBlock =
  panel.match(/import\s*\{([\s\S]*?)\}\s*from\s*["']@\/lib\/ai-studio-engine["']/)?.[1] ?? ""
assert(
  !engineImportBlock.includes("MY_AI_FEATURE_SIZE"),
  "Phase 0: MY_AI_FEATURE_SIZE must not be imported from ai-studio-engine",
)
assert(
  /import\s*\{\s*MY_AI_FEATURE_SIZE\s*\}\s*from\s*["']@\/lib\/ai\/my-ai-feature-extractor["']/.test(panel),
  "Phase 0: MY_AI_FEATURE_SIZE direct extractor import is missing",
)
requireText(types, "export type PoseKeypoint", "Phase 0 pose typing")
requireText(types, "export type PoseResult", "Phase 0 pose result typing")

assert(engine.includes("function finiteNumber(value: unknown, fallback: number)"), "My AI training config does not sanitize non-finite numeric inputs")
assert(engine.includes("function safeActivation(value: unknown)"), "My AI layer activation is not allowlisted")

for (const name of ["trainEvaluation", "trainValues", "trainAccuracy"]) {
  const declarations =
    engine.match(new RegExp("\\b(?:const|let|var)\\s+" + name + "\\b", "g")) ?? []
  assert(
    declarations.length === 1,
    "Phase 1: expected exactly one " + name + " declaration, found " + declarations.length,
  )
}

for (const mode of ["objects", "pose", "hands", "emotion", "sound", "numbers"]) {
  requireText(types, mode, "6A vision mode")
  requireText(panel, 'id: "' + mode + '"', "6A panel mode")
}

for (const marker of [
  "loadObjectDetector",
  "loadMoveNet",
  "loadHandDetector",
  "loadFaceDetector",
  "loadSoundRecognizer",
  "trainAiModel",
  "predictAiImage",
]) requireText(panel, marker, "6A resource wiring")

for (const marker of [
  "lite_mobilenet_v2",
  "detectObjects",
  "normalizeObjectClass",
]) requireText(objectAdapter, marker, "6B object adapter")

for (const marker of [
  "tf.loadGraphModel",
  "singlepose/lightning/4",
  "MOVENET_KEYPOINT_NAMES",
]) requireText(poseAdapter, marker, "6C pose adapter")

for (const marker of [
  "const HAND_VERSION =",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
  "const HANDS_ASSET_BASE",
  "new window.Hands",
  "maxNumHands: maxHands",
  "getExtendedFingerMask",
  "window.Hands",
]) requireText(handAdapter, marker, "6D hand adapter")

for (const marker of [
  "const FACE_VERSION =",
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
  "const FACE_MESH_ASSET_BASE",
  "new window.FaceMesh",
  "minDetectionConfidence: 0.35",
  "refineLandmarks: true",
  "classifyExpression",
  "window.FaceMesh",
]) requireText(faceAdapter, marker, "6E face adapter")

for (const marker of [
  'SPEECH_VERSION = "0.5.4"',
  'create("BROWSER_FFT", "18w")',
  "probabilityThreshold: 0.72",
  "suppressionTimeMillis: 650",
  "generation",
  "Number.isFinite",
  "stopListening",
]) requireText(soundAdapter, marker, "6F sound adapter")

for (const marker of [
  "interpretHandGesture",
  "detectedGesture",
  "fingerCount",
  "handGestureHistoryRef",
  '["0", "1", "2", "3", "4", "5"]',
]) requireText(panel, marker, "6G gesture/number integration")

for (const marker of [
  "FingerMask",
  "getExtendedFingerMask",
  "extendedFingers",
]) requireText(handAdapter, marker, "6G finger mask")

for (const marker of [
  "HandGesture",
  "thumbs_up",
  "thumbs_down",
  "peace",
  "open_palm",
]) requireText(gestureAdapter, marker, "6G gesture interpreter")

for (const marker of [
  "ai_get_gesture",
  "ai_get_finger_count",
  "ai_is_gesture",
  "ai_is_unknown",
]) {
  requireText(blocks, marker, "6G/6K Blockly block")
  requireText(runner, marker, "6G/6K Blockly runner")
  requireText(toolbox, marker, "6G/6K Blockly toolbox")
}
for (const marker of ["getAiGesture", "getAiFingerCount", "isAiGesture", "isAiUnknown"]) {
  requireText(workbench, marker, "6G/6K Workbench bridge")
}

for (const marker of [
  "classes: string[]",
  "addAiClass",
  "renameAiClass",
  "removeAiClass",
  "addAiSample",
  "removeAiSample",
  "getAiDatasetStats",
  "getSampleAddError",
  "MAX_CLASSES = 8",
  "MAX_SAMPLES_PER_CLASS = 20",
  "MAX_TOTAL_SAMPLES = 80",
  'STORE_KEY = "pixiu-ai-studio-v4"',
  'MODEL_KEY = "pixiu-ai-studio-model-v4"',
]) requireText(engine, marker, "6H dataset contract")

for (const marker of [
  'MY_AI_FEATURE_VERSION = "vision-features-v4-local"',
  "MY_AI_INPUT_SIZE = 224",
  "MY_AI_FEATURE_SIZE = 512",
  "tf.browser.fromPixels",
  "tf.expandDims",
  "tf.image.resizeBilinear",
  "tf.mean",
  "tf.sum",
  "tf.sqrt",
  "tf.maximum",
  "tf.div",
  "MY_AI_PREDICTION_THRESHOLD = 0.62",
]) requireText(featureExtractor, marker, "6I/6J local feature extractor")

for (const marker of [
  "extractFeatures",
  "augmentImageForTraining",
  "classPrototypes",
  "buildTrainableLayers",
  "validateClassifierModelShape",
  "modelInputShape",
  "outputShape",
  "validationData",
  "trainingProfile: options.profile",
  "featureExtractor: MY_AI_FEATURE_VERSION",
  "predictionThreshold",
  "confidenceCalibration",
  "indexeddb://",
  "prototypeWeight",
  "lowMargin",
  "lowConfidence",
  "unknown",
]) requireText(engine, marker, "6I/6J training + prediction engine")

for (const forbidden of [
  "INPUT_W = 16",
  "INPUT_H = 16",
  "tf.layers.conv2d",
  "aiVision.isDetected(",
  "aiVision.getDetectedClass(",
  "aiVision.getConfidence(",
  "aiVision.setCamera(",
  "aiVision.setMicrophone(",
]) forbidText(engine + blocks, forbidden, "legacy/unsafe AI implementation")

for (const marker of [
  "normalizeAiDecision",
  "normalizeAiVisionState",
  "DEFAULT_AI_CONFIDENCE_THRESHOLD = 60",
  "SOUND_AI_CONFIDENCE_THRESHOLD = 72",
  "TRAINED_AI_CONFIDENCE_THRESHOLD = 62",
]) requireText(resultNormalizer, marker, "6J/6K result normalization")

for (const marker of [
  "cocoSsd.load",
  'base: "lite_mobilenet_v2"',
  "modelRef.current.detect(video)",
  "runtimeEnabled",
  "Vision Signal:",
  "PIXIU VISION CORE",
]) requireText(canvasPanel, marker, "Integrated AI Vision Canvas runtime")
for (const marker of [
  "lastParentXmlRef",
  "pendingExternalXmlRef",
  "externalLoadVersionRef",
  "genuine external loads",
  "lastParentXmlRef.current = expectedExternalXml",
  "onXmlChange?.(expectedExternalXml)",
]) requireText(read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx"), marker, "Blockly external XML hydration")

for (const marker of [
  "setAiRuntimeEnabled(false)",
  "setIsAiCameraOpen(false)",
  "setAiCameraCompact(false)",
  "setAiRequestedMode(null)",
  "if (usesAi && openAiHud)",
]) requireText(workbench, marker, "AI template → Vision Canvas lifecycle")

for (const marker of [
  'id: "ai-smart-barrier"',
  "ai_is_detected",
  '<field name="CLASS">car</field>',
  '<field name="PIN">6</field>',
  '<field name="NUM">90</field>',
]) requireText(templates, marker, "AI Smart Barrier template")

for (const marker of [
  'const AiCameraPanel = lazy(() => import("./ai-camera-panel")',
  "isAiStudioOpen",
  "handleToggleAiVision",
  "handleToggleAiStudio",
  "<AiCameraPanel",
  "<AiStudioPanel",
  "programAiMode",
  "if (usesAi && openAiHud)",
]) requireText(workbench, marker, "separate AI Canvas + AI Studio runtime")

for (const marker of [
  "isAiStudioOpen?: boolean",
  "onOpenAiStudio?: () => void",
  "AI Vision Canvas",
  "PIXIU AI Studio",
]) requireText(read("pixiu-lms-portal/src/components/circuit-lab/toolbar.tsx"), marker, "separate AI toolbar controls")

for (const marker of [
  "normalizeAiVisionState",
  "handleAiStateChange",
  "isAiUnknown:",
  "getAiDetectedClass:",
  "getAiConfidence:",
  "state.unknown",
  "state.detectedClass === \"unknown\"",
]) requireText(workbench, marker, "6K normalized AI bridge")

requireText(runner, "AI blocks are data/control inputs only", "6L AI data-source boundary")
requireText(blocks, "Browser AI generators", "6L compile-safe AI boundary")
const aiGeneratorSection = blocks.slice(blocks.indexOf("/* Browser AI generators"))
if (!aiGeneratorSection.length) {
  failures.push("6L: Browser AI generators section not found")
} else if (/digitalWrite|analogWrite|setDigitalPin|motor_driver_write/.test(aiGeneratorSection)) {
  failures.push("6L: AI generators directly mutate virtual hardware")
}

for (const marker of ["6M · How My AI learns", "DATASET", "MODEL", "TRAIN", "INFERENCE"]) {
  requireText(panel, marker, "6M Teach mode")
}
for (const marker of ["6N · Why did AI produce this result?", "Class probabilities", "explainCurrentAiResult"]) {
  requireText(panel, marker, "6N Understand mode")
}
for (const marker of ["CAMERA ·", "MIC ·", "Erase local AI data", "Samples stay in this browser"]) {
  requireText(panel, marker, "6O privacy controls")
}
for (const marker of ["getUserMedia", "isSecureContext", "HTTPS"]) {
  requireText(cameraSession, marker, "6O media permission boundary")
}
requireText(panel, "Permission blocked", "6O actionable permission error")
requireText(engine, "tf.io.removeModel", "6O persisted model cleanup")
requireText(engine, "localStorage.removeItem", "6O persisted dataset cleanup")
requireText(engine, "AI_DATASET_STORAGE_SOFT_LIMIT_BYTES", "6O dataset persistence guard")
requireText(panel, "stopInput", "6O runtime cleanup")
requireText(panel, "Dataset updated for this session, but browser storage is full", "6O dataset persistence feedback")

for (const marker of [
  "completedStepIds = Array.isArray(candidate.completedStepIds)",
  "Array.from(new Set(completedStepIds))",
  "Array.isArray(progress.completedStepIds)",
]) requireText(lessonEngine, marker, "Phase 5 progress-storage safety")
requireText(panel, "getActiveAiModel() === loaded", "6P stale model-load cleanup")
requireText(panel, "if (model) return", "6P trained-model double-load guard")
forbidText(panel, "disposeAiResource", "6P undefined trained-resource disposer")

for (const marker of [
  "sessionRef",
  "cameraRequestRef",
  "busySessionRef",
  "runtimeFailedRef",
  "trainingRunRef",
  "datasetVersionRef",
  "stopAll()",
  "stopInput()",
  "releaseCurrentResource",
  "stopCameraStream",
]) requireText(panel, marker, "6P restart/cleanup guard")

for (const marker of [
  "pressed.has(part.id)",
  "computeWireCurrents(state, runtime, pinStates, pressed)",
]) requireText(currentFlow + workbench, marker, "Phase 1/4 button-state propagation")

for (const marker of [
  "pressed: Set<string>",
  "solveCircuitNodalPotentials(state, pressed, pinStates, running)",
]) requireText(multimeter, marker, "Phase 4 DMM button-state propagation")

for (const marker of [
  "pressed: Set<string>",
  "const currentPressed = snapshot.pressed",
  "solveCircuitNodalPotentials(",
  "pressed={pressed}",
]) requireText(oscilloscope + workbench, marker, "Phase 4 scope button-state propagation")

for (const marker of [
  "runningRef.current = false",
  "setRunning(false)",
]) requireText(workbench, marker, "Phase 1 no-Arduino run-state safety")

for (const marker of ["objects", "pose", "hands", "emotion", "sound", "numbers", "trained"]) {
  requireText(panel, marker, "6P cross-mode coverage")
}

if (failures.length) {
  console.error("AI static contract check FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("AI static contract check PASSED")
console.log("6A Ready AI modes + resource lifecycle: present")
console.log("6B Object AI: present")
console.log("6C Pose AI + AI bridge: present")
console.log("6D Hand AI: present")
console.log("6E Face + expression AI: present")
console.log("6F Sound AI: present")
console.log("6G Numbers + Gesture AI: present")
console.log("6H My AI dataset workflow: present")
console.log("6I My AI local feature + configurable training engine: present")
console.log("6J Unknown/low-confidence prediction: present")
console.log("6K Normalized AI → Blockly boundary: present")
console.log("6L AI data-source / virtual-hardware boundary: present")
console.log("6M Teach mode: present")
console.log("6N Understand mode: present")
console.log("6O safety/privacy controls: present")
console.log("6P QA lifecycle contracts: present")

const engineSource = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
for (const marker of [
  "AI_TRAINING_PROFILES",
  "MAX_CONFIGURABLE_LAYERS = 8",
  "MY_AI_FEATURE_SIZE",
  "estimateTrainingLoad",
  "modelInputShape",
  "outputShape",
  "validateClassifierModelShape",
  "trainingProfile: options.profile",
]) requireText(engineSource, marker, "My AI training tuning")
requireText(engineSource, "embedding.length !== MY_AI_FEATURE_SIZE", "Phase 3 feature-size enforcement")
requireText(engineSource, "featureSize !== MY_AI_FEATURE_SIZE", "Phase 3 tensor-pair feature-size enforcement")
requireText(featureExtractor, "warmupMean.dispose()", "Phase 2 warmup tensor cleanup")

const handSource = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
for (const marker of [
  'modelType: "full"',
  "const MIN_HAND_SCORE = 0.15",
  "solutionPath",
  "dipAngle >= 135",
  "maxHands?: number",
]) requireText(handSource, marker, "Hand AI runtime")

const faceSource = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
for (const marker of [
  'const FACE_VERSION = "2.0.0"',
  'runtime: "mediapipe"',
  "solutionPath",
  "refineLandmarks: true",
  "function classifyExpression",
  "cornerLift",
]) requireText(faceSource, marker, "Face AI runtime")

const portalApp = read("pixiu-lms-portal/src/App.jsx")
for (const marker of [
  "const AIStudio = lazyWithChunkRecovery",
  'path="/ai-studio"',
]) requireText(portalApp, marker, "Portal AI Studio route")

const simulationPage = read("pixiu-lms-portal/src/pages/Simulation.jsx")
for (const marker of [
  "const Workbench = lazy",
  "Loading Virtual Arduino Lab",
]) requireText(simulationPage, marker, "Lazy Virtual Arduino Lab")

const aiStudioPage = read("pixiu-lms-portal/src/pages/AIStudio.jsx")
for (const marker of [
  "const AiStudioPanel = lazy",
  "Loading AI Workspace",
  "onGoToSimulation",
]) requireText(aiStudioPage, marker, "Lazy PIXIU AI Studio")

const panelSource = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
for (const marker of [
  "Training profile",
  "Advanced tuning",
  "Loading PIXIU AI is loading",
]) {
  if (marker === "Loading PIXIU AI is loading") continue
}
assert(panelSource.includes("PIXIU AI is loading"), "AI Studio branded model loading state missing")
assert(panelSource.includes("Training profile"), "AI Studio grade training profile control missing")
assert(panelSource.includes("Advanced tuning"), "AI Studio advanced tuning control missing")

if (failures.length) {
  console.error("AI static contract check FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}
