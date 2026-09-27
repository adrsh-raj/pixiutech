#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFileSync(join(root, path), "utf8")
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const vision = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const runtimeState = read("pixiu-lms-portal/src/lib/ai/ai-runtime-state.ts")
const performance = read("pixiu-lms-portal/src/lib/ai/ai-performance.ts")
const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const visionCore = read("pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx")
const camera = read("pixiu-lms-portal/src/lib/ai/camera-session.ts")
const sound = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const hands = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const face = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const objectDetector = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const pose = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const pkg = JSON.parse(read("pixiu-lms-portal/package.json"))

const statuses = ["idle","loading","ready","running","error","stopped"]
for (const status of statuses) {
  assert(
    vision.includes('"' + status + '"'),
    "Vision contract missing runtime status: " + status,
  )
}
for (const kind of ["permission","unsupported","model","inference","storage","cancelled","unknown"]) {
  assert(
    runtimeState.includes('"' + kind + '"'),
    "Runtime error contract missing kind: " + kind,
  )
}
assert(
  panel.includes('runtimeStatus: "loading"') &&
    panel.includes('runtimeStatus: "ready"') &&
    panel.includes('runtimeStatus: "running"') &&
    panel.includes('runtimeStatus: "error"') &&
    panel.includes('runtimeStatus: "stopped"'),
  "AI Studio does not publish the complete lifecycle state machine",
)
assert(
  visionCore.includes('runtimeStatus: "loading"') &&
    visionCore.includes('runtimeStatus: "ready"') &&
    visionCore.includes('runtimeStatus: "running"') &&
    visionCore.includes('runtimeStatus: "error"') &&
    visionCore.includes('runtimeStatus: "stopped"'),
  "Vision Core does not publish the complete lifecycle state machine",
)

// Permission UX and secure-context guards.
assert(camera.includes("getCameraPermissionState"), "Camera permission preflight is missing")
assert(sound.includes("getMicrophonePermissionState"), "Microphone permission preflight is missing")
assert(camera.includes("window.isSecureContext"), "Camera secure-context guard is missing")
assert(sound.includes("window.isSecureContext"), "Microphone secure-context guard is missing")
assert(panel.includes("classifyAiRuntimeError(cameraError)"), "Camera failures are not classified")
assert(panel.includes("classifyAiRuntimeError(soundError)"), "Microphone failures are not classified")

// Failure isolation: resource loading and inference errors are contained in-mode.
assert(
  panel.includes("setStatus(\"AI unavailable\")") &&
    panel.includes("runtimeErrorKind: errorKind") &&
    panel.includes("releaseCurrentResource()"),
  "AI Studio model failures are not isolated and cleaned up",
)
assert(
  panel.includes("setStatus(\"Inference error · retrying\")") &&
    panel.includes("window.setTimeout(tick, 600)"),
  "AI Studio inference failures do not degrade to retry mode",
)
assert(
  visionCore.includes("runtimeErrorKind: errorKind") &&
    visionCore.includes("releaseResources()"),
  "Vision Core startup failures are not isolated and cleaned up",
)

// Concurrency / lifecycle guards.
assert(
  objectDetector.includes("let objectDetectorLoadPromise: Promise<ObjectDetector> | null = null"),
  "Object detector has no in-flight load guard",
)
assert(
  pose.includes("let moveNetLoadPromise: Promise<tf.GraphModel> | null = null"),
  "MoveNet has no in-flight load guard",
)
assert(
  hands.includes("pending?.resolve([])") && face.includes("pending?.resolve([])"),
  "Hands/Face reset must settle pending detection promises",
)
assert(
  panel.includes("const activeSession = ++sessionRef.current") &&
    panel.includes("if (activeSession !== sessionRef.current)"),
  "AI Studio async resources are not protected by generation/session guards",
)
assert(
  visionCore.includes("const activeSession = ++sessionRef.current") &&
    visionCore.includes("activeSession !== sessionRef.current"),
  "Vision Core async boot is not protected by generation/session guards",
)
assert(
  panel.includes("busyRef.current") &&
    visionCore.includes("busyRef.current"),
  "Visual inference paths are missing overlap protection",
)

// Browser compatibility.
assert(
  camera.includes('video: true') &&
    camera.includes("OverconstrainedError"),
  "Camera compatibility fallback for constrained devices is missing",
)
assert(
  panel.includes('tf.getBackend') || performance.includes("tf.getBackend"),
  "TensorFlow backend visibility/fallback is not observable",
)
assert(
  pose.includes('await tf.setBackend("cpu")') &&
    engine.includes('await tf.setBackend("cpu")') === false,
  "MoveNet backend fallback must remain explicit; My AI fallback is handled by its extractor",
)

// Performance budget and memory diagnostics.
assert(
  performance.includes("AI_PERFORMANCE_BUDGETS") &&
    performance.includes("modelLoadWarningMs") &&
    performance.includes("firstInferenceWarningMs") &&
    performance.includes("steadyInferenceWarningMs"),
  "Classroom inference performance budget is not defined",
)
assert(
  performance.includes("tensorGrowthBytes") &&
    performance.includes("jsHeapGrowthBytes") &&
    performance.includes("hardwareConcurrency"),
  "Runtime memory/device diagnostics are incomplete",
)
assert(
  panel.includes("createAiRuntimeMetrics") &&
    panel.includes("recordInference") &&
    panel.includes("isBudgetExceeded"),
  "AI Studio is not collecting or applying performance metrics",
)

// Phase 2/3 continuity and local-runtime discipline.
assert(
  pose.includes('const MOVENET_URL = "/models/movenet/model.json"') &&
    hands.includes('const HANDS_SCRIPT = "/vendor/mediapipe/hands/hands.js"') &&
    face.includes('const FACE_MESH_SCRIPT = "/vendor/mediapipe/face_mesh/face_mesh.js"') &&
    sound.includes('const SPEECH_SCRIPT = "/vendor/tfjs/speech-commands/speech-commands.min.js"'),
  "Local AI runtime paths are not preserved",
)
assert(
  visionCore.includes('from "@/lib/ai/object-detector"') &&
    !visionCore.includes('@tensorflow-models/coco-ssd'),
  "Vision Core must use the shared COCO-SSD adapter",
)

// Exit gate wiring.
assert(
  pkg.scripts?.["qa:phase4-9"] === "node ../scripts/phase4-9-reliability-static-check.mjs",
  "Package script qa:phase4-9 is not wired",
)
assert(
  pkg.scripts?.predev === "npm run sync:ai-runtime-assets" &&
    pkg.scripts?.prebuild === "npm run sync:ai-runtime-assets",
  "Local AI runtime asset provisioning must remain before dev/build",
)

const requiredModules = [
  "my-ai-feature-extractor.ts",
  "pose-detector.ts",
  "hand-detector.ts",
  "face-detector.ts",
  "object-detector.ts",
  "sound-detector.ts",
]
for (const moduleName of requiredModules) {
  assert(
    read("pixiu-lms-portal/src/lib/ai/" + moduleName).length > 0,
    "Reliability matrix module missing: " + moduleName,
  )
}

if (failures.length) {
  console.error("PIXIU Phase 4-9 reliability static gate FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU Phase 4-9 reliability static gate PASSED")
console.log("State machine · failure isolation · permissions · concurrency · browser fallback · performance budget · lifecycle continuity: PASS")
