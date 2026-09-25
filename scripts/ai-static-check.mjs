import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const portal = join(root, "pixiu-lms-portal", "src")
const read = (path) => readFileSync(join(root, path), "utf8")

const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const types = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
const objectAdapter = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const poseAdapter = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const visionState = read("pixiu-lms-portal/src/lib/ai/vision-state.ts")
const handAdapter = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const faceAdapter = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const soundAdapter = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const gestureAdapter = read("pixiu-lms-portal/src/lib/ai/gesture-interpreter.ts")
const featureExtractor = read("pixiu-lms-portal/src/lib/ai/my-ai-feature-extractor.ts")

const failures = []
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(label + ": missing " + needle)
}
const forbidText = (text, needle, label) => {
  if (text.includes(needle)) failures.push(label + ": forbidden " + needle)
}

if (existsSync(join(root, "pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx"))) {
  failures.push("legacy ai-camera-panel.tsx still exists")
}

for (const mode of ["objects", "pose", "hands", "emotion", "sound", "numbers"]) {
  requireText(types, mode, "vision type")
  requireText(panel, `id: "${mode}"`, "AI mode")
}

for (const marker of [
  "loadHandDetector",
  "detectHands",
  "loadFaceDetector",
  "detectFaces",
  "loadSoundRecognizer",
  "trainAiModel",
  "predictAiImage",
  "getModelWeightShapes",
]) requireText(panel, marker, "panel integration")

for (const marker of [
  "loadObjectDetector",
  "detectObjects",
  "disposeObjectDetector",
  "loadMoveNet",
  "estimateMoveNetPose",
  "disposeMoveNet",
]) requireText(panel, marker, "active AI adapter wiring")

for (const marker of [
  "lite_mobilenet_v2",
  "DEFAULT_OBJECT_MIN_SCORE",
  "DEFAULT_OBJECT_MAX_BOXES",
  "NormalizedObjectDetection",
  "normalizeObjectClass",
]) requireText(objectAdapter, marker, "6B object adapter")

for (const marker of [
  "tf.loadGraphModel",
  "singlepose/lightning/4",
  "MOVENET_KEYPOINT_NAMES",
  "disposeMoveNet",
]) requireText(poseAdapter, marker, "6C GraphModel adapter")

requireText(visionState, "createAiVisionState", "6.0 normalized state factory")
requireText(panel, "createAiVisionState", "6.0 state integration")

for (const forbidden of [
  'cocoSsd.load({ base: "mobilenet_v2" })',
  "resourceRef.current.estimatePoses(",
]) forbidText(panel, forbidden, "6A-6C old active path")

const stopProgramSection = workbench.slice(
  workbench.indexOf("const stopProgram"),
  workbench.indexOf("const stopAiRuntime"),
)
if (/setAiRuntimeEnabled|setAiCameraCompact|setIsAiCameraOpen/.test(stopProgramSection)) {
  failures.push("AI lifecycle: stopProgram still directly mutates AI runtime/presentation state")
}
requireText(workbench, "const stopAiRuntime = useCallback", "AI lifecycle decoupling")
requireText(workbench, "stopAiRuntime()", "AI lifecycle shutdown")
requireText(workbench, "setAiCamera: (enabled)", "AI camera bridge")
requireText(workbench, "setAiCameraCompact(enabled)", "AI camera compact bridge")

for (const marker of ["ai_is_detected", "ai_get_detected_class", "ai_confidence", "ai_camera_enable", "ai_microphone_enable"]) {
  requireText(blocks, marker, "Blockly AI block")
  requireText(runner, marker, "Blockly runtime")
}
requireText(panel, "requestedMode", "panel requested-mode bridge")
requireText(workbench, "setAiMicrophone:", "AI microphone bridge")
requireText(read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx"), "ai_microphone_enable", "Blockly AI toolbox")
requireText(workbench, "AiStudioPanel", "Workbench AI panel")
requireText(workbench, "isAiDetected:", "AI runtime bridge")
requireText(workbench, "getAiDetectedClass:", "AI class bridge")
requireText(workbench, "getAiConfidence:", "AI confidence bridge")
requireText(workbench, "setAiCamera:", "AI camera bridge")
requireText(workbench, "setAiMicrophone:", "AI microphone bridge")
requireText(workbench, "requestedMode={aiRequestedMode}", "AI requested-mode bridge")

for (const needle of ["frameBusyRef", "setTestImage", "inFlightRef"]) {
  forbidText(panel, needle, "AI panel legacy reference")
}
requireText(engine, 'const LEGACY_STORE_KEY = "pixiu-ai-studio-v1"', "legacy cleanup key")
requireText(engine, 'const LEGACY_MODEL_KEY = "pixiu-ai-studio-model-v1"', "legacy cleanup model key")
requireText(engine, 'STORE_KEY = "pixiu-ai-studio-v3"', "AI store version")
requireText(engine, 'MODEL_KEY = "pixiu-ai-studio-model-v3"', "AI model version")
requireText(engine, '"pixiu-ai-studio-v2"', "legacy store migration")
requireText(engine, '"pixiu-ai-studio-model-v2"', "legacy model migration")

// 6D/6E share the application's existing TensorFlow.js runtime. Avoid a
// second bundled TensorFlow.js instance from a separate vision framework.
for (const marker of [
  "HAND_VERSION = \"2.0.1\"",
  "@tensorflow-models/hand-pose-detection@2.0.1",
  'SupportedModels.MediaPipeHands',
  'runtime: "tfjs"',
  "maxHands: MAX_HANDS",
  "countExtendedFingers",
  "detectHands",
  "window.tf = tf",
]) requireText(handAdapter, marker, "6D TFJS hand adapter")

for (const marker of [
  "FACE_VERSION = \"1.0.6\"",
  "@tensorflow-models/face-detection@1.0.3",
  "@tensorflow-models/face-landmarks-detection@1.0.6",
  'SupportedModels.MediaPipeFaceMesh',
  'runtime: "tfjs"',
  "maxFaces: MAX_FACES",
  "refineLandmarks: true",
  "classifyExpression",
  "detectFaces",
  "478",
  "window.tf = tf",
]) requireText(faceAdapter, marker, "6E TFJS face/mesh adapter")

for (const marker of [
  'SPEECH_VERSION = "0.5.4"',
  'create("BROWSER_FFT", "18w")',
  "probabilityThreshold: 0.72",
  "overlapFactor: 0.25",
  "suppressionTimeMillis: 650",
  "isListening",
  "try {\n            await recognizer.stopListening()",
  "generation",
  "generation",
  "window.tf = tf",
  "Number.isFinite",
  "stopListening",
]) requireText(soundAdapter, marker, "6F sound adapter")

for (const needle of [
  "face-api.min.js",
  "@mediapipe/hands/hands.js",
  "window.faceapi",
  "window.Hands",
  "@vladmandic/human",
  "loadFaceEmotion",
  "loadSpeechRecognizer",
]) forbidText(panel, needle, "legacy D-F runtime reference")

requireText(panel, "loadHandDetector", "panel D adapter")
requireText(panel, "detectHands", "panel D inference")
requireText(panel, "loadFaceDetector", "panel E adapter")
requireText(panel, "detectFaces", "panel E inference")
requireText(panel, "loadSoundRecognizer", "panel F adapter")
requireText(runner, 'case "ai_microphone_enable"', "Blockly Sound runtime execution")
requireText(blocks, "Browser AI Studio browser runtime: AI microphone", "Blockly Sound generator")
requireText(blocks, "Browser AI generators", "compile-safe AI generator contract")
for (const forbidden of ["aiVision.isDetected(", "aiVision.getDetectedClass(", "aiVision.getConfidence(", "aiVision.setCamera(", "aiVision.setMicrophone("]) {
  forbidText(blocks, forbidden, "AI browser/Arduino generator mismatch")
}
requireText(read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx"), 'type: "ai_microphone_enable"', "Blockly Sound toolbox")
requireText(panel, "requestedMode", "panel requested-mode bridge")
requireText(panel, "onRequestedModeHandled", "panel requested-mode acknowledgement")
requireText(panel, 'modelClasses: ["neutral", "happy", "surprised"]', "6E expression label contract")

for (const marker of [
  "interpretHandGesture",
  "detectedGesture",
  "fingerCount",
  "handGestureHistoryRef",
  '["0", "1", "2", "3", "4", "5"]',
]) requireText(panel, marker, "6G gesture/number integration")

for (const marker of ["FingerMask", "getExtendedFingerMask", "extendedFingers"]) {
  requireText(handAdapter, marker, "6G hand-layer contract")
}

for (const marker of [
  "HandGesture",
  "interpretHandGesture",
  "thumbs_up",
  "thumbs_down",
  "peace",
  "open_palm",
]) requireText(gestureAdapter, marker, "6G gesture interpreter")

for (const marker of [
  "classes: string[]",
  "addAiClass",
  "renameAiClass",
  "removeAiClass",
  "getAiDatasetStats",
  "getSampleAddError",
  "MAX_CLASSES = 8",
  "MAX_SAMPLES_PER_CLASS = 20",
  "MAX_TOTAL_SAMPLES = 80",
  'STORE_KEY = "pixiu-ai-studio-v3"',
  'MODEL_KEY = "pixiu-ai-studio-model-v3"',
]) requireText(engine, marker, "6H dataset contract")

for (const marker of [
  "MobileNetV2-0.5",
  "MY_AI_EMBEDDING_NODE",
  "tf.loadGraphModel",
  "model.execute(batched, MY_AI_EMBEDDING_NODE)",
  "extractMyAiEmbedding",
]) requireText(featureExtractor, marker, "6I transfer feature extractor")

for (const marker of [
  "extractFeatures",
  "Frozen MobileNetV2",
  "featureExtractor: MY_AI_FEATURE_VERSION",
  "Dense(96)",
  "validationData",
]) requireText(engine, marker, "6I transfer-learning training engine")

for (const forbidden of [
  "INPUT_W = 16",
  "INPUT_H = 16",
  "tf.layers.conv2d",
  "16×16 RGB → Conv2D",
]) forbidText(engine, forbidden, "6I old raw-pixel classifier")

for (const marker of ["ai_get_gesture", "ai_get_finger_count"]) {
  requireText(blocks, marker, "6G Blockly block")
  requireText(runner, marker, "6G Blockly runtime")
  requireText(read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx"), marker, "6G Blockly toolbox")
  requireText(workbench, marker, "6G Workbench bridge")
}
requireText(workbench, "getAiGesture", "6G gesture getter")
requireText(workbench, "getAiFingerCount", "6G finger getter")

requireText(panel, "const requestId = ++cameraRequestRef.current", "camera request generation")
requireText(panel, "if (requestId !== cameraRequestRef.current)", "camera stale-request guard")
requireText(panel, "function stopCameraStream()", "camera stream shutdown boundary")
requireText(panel, "busySessionRef", "inference overlap guard")
requireText(panel, "stopCamera(studioVideoRef.current, stream)", "full-video cleanup")
requireText(panel, "stopCamera(floatingVideoRef.current, stream)", "floating-video cleanup")

if (!panel.match(/function stopAll\(\)[\s\S]*?releaseCurrentResource\(\)/)) {
  failures.push("cleanup: stopAll does not release the current resource")
}

if (failures.length) {
  console.error("AI static contract check FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("AI static contract check PASSED")
console.log("6A Ready AI modes: 6")
console.log("6B Teach/Understand: present")
console.log("6C AI→Blockly bridge: present")
console.log("6D Hand AI runtime: present")
console.log("6E Face + emotion AI runtime: present")
console.log("6F Speech Commands runtime: present")
console.log("6G Numbers + Gesture runtime: present")
console.log("6H My AI dataset workflow: present")
console.log("6I Transfer-learning training engine: present")
console.log("Legacy AI camera implementation: removed")
