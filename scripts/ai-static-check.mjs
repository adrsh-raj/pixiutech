import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const portal = join(root, "pixiu-lms-portal", "src")
const read = (path) => readFileSync(join(root, path), "utf8")

const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const runtime = read("pixiu-lms-portal/src/lib/ai-ready-runtime.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const types = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
const objectAdapter = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const poseAdapter = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const visionState = read("pixiu-lms-portal/src/lib/ai/vision-state.ts")

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
  "loadFaceEmotion",
  "loadSpeechRecognizer",
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
  "SINGLEPOSE_LIGHTNING",
  "MOVENET_KEYPOINT_NAMES",
  "disposeMoveNet",
]) requireText(poseAdapter, marker, "6C GraphModel adapter")

requireText(visionState, "createAiVisionState", "6.0 normalized state factory")
requireText(panel, "createAiVisionState", "6.0 state integration")

for (const forbidden of [
  'cocoSsd.load({ base: "mobilenet_v2" })',
  "resourceRef.current.detect(",
  "resourceRef.current.estimatePoses(",
  "loadPoseDetector()",
]) forbidText(panel, forbidden, "6A-6C old active path")

const stopProgramSection = workbench.slice(
  workbench.indexOf("const stopProgram"),
  workbench.indexOf("const startProgram"),
)
if (/setAiRuntimeEnabled|setAiCameraCompact|setIsAiCameraOpen/.test(stopProgramSection)) {
  failures.push("AI lifecycle: stopProgram still directly mutates AI runtime/presentation state")
}
requireText(workbench, "const stopAiRuntime = useCallback", "AI lifecycle decoupling")
requireText(workbench, "stopAiRuntime()", "AI lifecycle shutdown")
requireText(workbench, "setAiCamera: (enabled)", "AI camera bridge")
requireText(workbench, "setAiCameraCompact(enabled)", "AI camera compact bridge")

for (const marker of ["ai_is_detected", "ai_get_detected_class", "ai_confidence", "ai_camera_enable"]) {
  requireText(blocks, marker, "Blockly AI block")
  requireText(runner, marker, "Blockly runtime")
}
requireText(workbench, "AiStudioPanel", "Workbench AI panel")
requireText(workbench, "isAiDetected:", "AI runtime bridge")
requireText(workbench, "getAiDetectedClass:", "AI class bridge")
requireText(workbench, "getAiConfidence:", "AI confidence bridge")
requireText(workbench, "setAiCamera:", "AI camera bridge")

for (const needle of ["frameBusyRef", "setTestImage", "inFlightRef"]) {
  forbidText(panel, needle, "AI panel legacy reference")
}
requireText(engine, 'const LEGACY_STORE_KEY = "pixiu-ai-studio-v1"', "legacy cleanup key")
requireText(engine, 'const LEGACY_MODEL_KEY = "pixiu-ai-studio-model-v1"', "legacy cleanup model key")
requireText(engine, 'STORE_KEY = "pixiu-ai-studio-v2"', "AI store version")
requireText(engine, 'MODEL_KEY = "pixiu-ai-studio-model-v2"', "AI model version")
requireText(runtime, "loadAny", "AI CDN fallback")
for (const forbidden of [
  "@tensorflow-models/pose-detection",
  "createDetector(",
]) forbidText(runtime, forbidden, "6C generic runtime separation")
requireText(runtime, "stopSpeechRecognizer", "AI audio cleanup")

// 6D / 6E / 6F dedicated runtime gates.
requireText(runtime, '@vladmandic/human@3.3.6/dist/human.js', "6D/6E maintained Human runtime")
requireText(runtime, 'HUMAN_VERSION = "3.3.6"', "6D/6E pinned Human version")
requireText(runtime, 'handlandmark-lite.json', "6D hand landmark model")
requireText(runtime, 'handtrack.json', "6D hand detector model")
requireText(runtime, 'emotion.json', "6E emotion model")
requireText(runtime, 'mesh: { enabled: true', "6E face mesh")
requireText(runtime, 'detector: {', "6E face detector")
requireText(runtime, '@tensorflow-models/speech-commands@0.5.4', "6F speech model version")
requireText(panel, "soundActive", "6F microphone lifecycle")
requireText(panel, "6F Sound listening", "6F UI runtime state")

// The old unmaintained face-api / MediaPipe Hands CDN paths must not remain
// active in the runtime adapter.
for (const needle of ["face-api.min.js", "@mediapipe/hands/hands.js", "window.faceapi", "window.Hands"]) {
  forbidText(runtime, needle, "legacy 6D/6E runtime")
}

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
console.log("Legacy AI camera implementation: removed")
