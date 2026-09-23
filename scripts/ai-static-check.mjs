import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const portal = join(root, "pixiu-lms-portal", "src")
const read = (path) => readFileSync(join(root, path), "utf8")

const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const cameraPanel = read("pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx")
const runtime = read("pixiu-lms-portal/src/lib/ai-ready-runtime.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const types = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")

const failures = []
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(label + ": missing " + needle)
}
const forbidText = (text, needle, label) => {
  if (text.includes(needle)) failures.push(label + ": forbidden " + needle)
}

if (!existsSync(join(root, "pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx"))) {
  failures.push("floating ai-camera-panel.tsx is missing")
}

for (const mode of ["objects", "pose", "hands", "emotion", "sound", "numbers"]) {
  requireText(types, mode, "vision type")
  requireText(panel, `id: "${mode}"`, "AI mode")
}

for (const marker of [
  "loadPoseDetector",
  "loadHandDetector",
  "loadFaceEmotion",
  "loadSpeechRecognizer",
  "cocoSsd.load",
  "trainAiModel",
  "predictAiImage",
  "getModelWeightShapes",
]) requireText(panel, marker, "panel integration")

for (const marker of ["ai_is_detected", "ai_get_detected_class", "ai_confidence", "ai_camera_enable"]) {
  requireText(blocks, marker, "Blockly AI block")
  requireText(runner, marker, "Blockly runtime")
}
requireText(workbench, "AiStudioPanel", "Workbench AI panel")
requireText(workbench, "isAiDetected:", "AI runtime bridge")
requireText(workbench, "getAiDetectedClass:", "AI class bridge")
requireText(workbench, "getAiConfidence:", "AI confidence bridge")
requireText(workbench, "setAiCamera:", "AI camera bridge")
requireText(panel, 'type: "io_analogread"', "analog read block")
requireText(panel, "analogPinDropdown", "analog read A0-A5 dropdown")
requireText(panel, 'type: "map_value"', "map value block")
requireText(panel, 'arduino.forBlock["map_value"]', "map value generator")

const stopProgramSection = workbench.slice(
  workbench.indexOf("const stopProgram"),
  workbench.indexOf("const stopAiRuntime"),
)
if (/setAiRuntimeEnabled|setIsAiCameraOpen/.test(stopProgramSection)) {
  failures.push("AI lifecycle: stopProgram still directly mutates AI runtime state")
}
requireText(workbench, "const stopAiRuntime = useCallback", "AI lifecycle decoupling")
requireText(workbench, "setIsAiCameraOpen(true)\n      setAiRuntimeEnabled(true)", "AI run opens floating camera")
requireText(workbench, "stopProgram()\n      stopAiRuntime()\n      return", "AI stops with Arduino")
requireText(workbench, "onClose={stopAiRuntime}", "Floating AI close handler")
requireText(workbench, "isAiStudioOpen", "AI Studio separate state")

for (const needle of ["frameBusyRef", "setTestImage", "inFlightRef"]) {
  forbidText(panel, needle, "AI panel legacy reference")
}

requireText(cameraPanel, "cocoSsd.load", "floating AI multi-object detector")
requireText(cameraPanel, "allDetections", "floating AI multi-object state")
requireText(cameraPanel, "runtimeEnabled", "floating AI Arduino runtime")
requireText(cameraPanel, "fixed bottom-12 right-6", "floating AI position")
requireText(cameraPanel, "valid.forEach", "floating AI multi-object overlay")
requireText(workbench, "const isAiStudioOpen", "separate AI Studio state")
requireText(engine, 'const LEGACY_STORE_KEY = "pixiu-ai-studio-v1"', "legacy cleanup key")
requireText(engine, 'const LEGACY_MODEL_KEY = "pixiu-ai-studio-model-v1"', "legacy cleanup model key")
requireText(engine, 'STORE_KEY = "pixiu-ai-studio-v2"', "AI store version")
requireText(engine, 'MODEL_KEY = "pixiu-ai-studio-model-v2"', "AI model version")
requireText(runtime, "loadAny", "AI CDN fallback")
requireText(runtime, "stopSpeechRecognizer", "AI audio cleanup")
// Analog / variables / mapping runtime parity.
requireText(workbench, "setIsAiCameraOpen(enabled)", "AI camera runtime bridge")
requireText(read("pixiu-lms-portal/src/lib/blockly-runner.ts"), "runtimeVariables", "Blockly variable runtime")
requireText(read("pixiu-lms-portal/src/lib/blockly-runner.ts"), 'target.type === "map_value"', "Blockly map runtime")
requireText(read("pixiu-lms-portal/src/lib/blockly-runner.ts"), 'case "variables_set"', "Blockly set-variable runtime")
requireText(read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx"), 'type: "map_value"', "map value toolbox")


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

if (!panel.match(/function stopAll\(\)[\s\S]*?releaseCurrentResource\(\)/)) {
  failures.push("cleanup: stopAll does not release the current resource")
}

const panelStopSection = panel.slice(panel.indexOf("  function stopInput()"), panel.indexOf("  function selectMode("))
if (!panelStopSection.includes("cameraRequestRef.current")) {
  failures.push("camera lifecycle: stopInput does not invalidate pending camera requests")
}
if (!panel.includes("GripVertical,")) {
  failures.push("floating runtime: GripVertical icon is not imported")
}
// The restored floating HUD owns its own simple camera lifecycle. The richer
// AI Studio has its own lifecycle and remains a separate UI surface.

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
console.log("Legacy AI Vision floating HUD: restored")
console.log("AI Studio: separate UI surface")
