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

const camera = read("pixiu-lms-portal/src/lib/ai/camera-session.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const panel = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const pose = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const hands = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const face = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const sound = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const objects = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const packageJson = JSON.parse(read("pixiu-lms-portal/package.json"))
const packageLock = JSON.parse(read("pixiu-lms-portal/package-lock.json"))
const sync = read("scripts/sync-ai-runtime-assets.mjs")

// Major Phase 2 — Inference performance.
assert(
  camera.includes("let captureResource: CaptureResource | null = null") &&
    camera.includes("document.createElement(\"canvas\")") &&
    camera.includes("captureResource?.canvas ?? document.createElement(\"canvas\")"),
  "Camera frame capture must reuse a module-level canvas instead of allocating one per frame",
)
assert(
  camera.includes("captureResource.width !== width || captureResource.height !== height"),
  "Reusable camera canvas must resize only when dimensions change",
)
assert(
  camera.includes("disposeCaptureFrameResource()") &&
    camera.includes("captureResource.canvas.width = 1") &&
    camera.includes("captureResource.canvas.height = 1"),
  "Camera capture resource must be released on stop",
)
assert(
  engine.includes("export async function predictAiVideo(") &&
    engine.includes("extractMyAiEmbedding(video)") &&
    engine.includes("return predictAiEmbedding(embeddingValues, summary)"),
  "My AI must expose a direct video inference path",
)
assert(
  panel.includes("const result = await predictAiVideo(video, store.model)") &&
    !panel.includes("const frame = captureVideoFrame(video, 640)"),
  "Continuous trained inference must use direct video embeddings without a JPEG/base64 roundtrip",
)
assert(
  panel.includes("const elapsed = performance.now() - started") &&
    panel.includes("Math.max(180, 280 - elapsed)"),
  "Live inference must retain a bounded frame cadence instead of an unrestricted tight loop",
)
assert(
  panel.includes("busyRef.current") &&
    panel.includes("busyRef.current = true") &&
    panel.includes("busyRef.current = false"),
  "Live inference must prevent overlapping inference jobs",
)

// Major Phase 3 — local runtime migration.
assert(
  pose.includes('const MOVENET_URL = "/models/movenet/model.json"') &&
    pose.includes("tf.loadGraphModel(MOVENET_URL)") &&
    !pose.includes("fromTFHub"),
  "MoveNet must load a same-origin local GraphModel without TF Hub runtime dependency",
)
assert(
  sync.includes("PIXIU_MOVENET_SOURCE_URL") &&
    sync.includes("weightsManifest") &&
    sync.includes("await ensureRemoteFile(url, destination)"),
  "Build asset sync must provision the real MoveNet model JSON and every required shard",
)
assert(
  hands.includes('const HANDS_SCRIPT = "/vendor/mediapipe/hands/hands.js"') &&
    hands.includes('const HANDS_ASSET_BASE = "/vendor/mediapipe/hands/"') &&
    !hands.includes("cdn.jsdelivr.net") &&
    !hands.includes("unpkg.com"),
  "Hands runtime must execute from same-origin local assets",
)
assert(
  face.includes('const FACE_MESH_SCRIPT = "/vendor/mediapipe/face_mesh/face_mesh.js"') &&
    face.includes('const FACE_MESH_ASSET_BASE = "/vendor/mediapipe/face_mesh/"') &&
    !face.includes("cdn.jsdelivr.net") &&
    !face.includes("unpkg.com"),
  "FaceMesh runtime must execute from same-origin local assets",
)
assert(
  sound.includes('const SPEECH_SCRIPT = "/vendor/tfjs/speech-commands/speech-commands.min.js"') &&
    sound.includes("await loadScript(SPEECH_SCRIPT)") &&
    !sound.includes("SPEECH_SOURCES") &&
    !sound.includes("cdn.jsdelivr.net") &&
    !sound.includes("unpkg.com"),
  "Speech Commands must use one same-origin local runtime asset without remote runtime fallback",
)
assert(
  sound.includes("window.tf = tf"),
  "Speech Commands global TensorFlow.js bridge must remain until a verified replacement runtime is used",
)
assert(
  sync.includes("copyDirectoryAssets(HANDS_SOURCE, HANDS_DIR)") &&
    sync.includes("copyDirectoryAssets(FACE_SOURCE, FACE_DIR)"),
  "Build asset sync must copy MediaPipe runtime assets from pinned npm packages",
)
assert(
  sync.includes("PIXIU_SPEECH_COMMANDS_SOURCE_URL") &&
    sync.includes("speech-commands.min.js"),
  "Build asset sync must provision the pinned Speech Commands browser runtime",
)

// Package/type contract for object detector: preserve existing supported handle type.
assert(
  objects.includes("export type ObjectDetector = cocoSsd.ObjectDetection"),
  "COCO-SSD object detector handle type must remain aligned with the installed package contract",
)
assert(
  packageJson.dependencies?.["@mediapipe/hands"] === "0.4.1675469240" &&
    packageJson.dependencies?.["@mediapipe/face_mesh"] === "0.4.1633559619",
  "MediaPipe runtime package versions must remain pinned",
)
assert(
  packageLock.packages?.["node_modules/@mediapipe/hands"]?.version === "0.4.1675469240" &&
    packageLock.packages?.["node_modules/@mediapipe/face_mesh"]?.version === "0.4.1633559619",
  "package-lock must pin the same MediaPipe versions as package.json",
)
assert(
  packageJson.scripts?.predev === "npm run sync:ai-runtime-assets" &&
    packageJson.scripts?.prebuild === "npm run sync:ai-runtime-assets" &&
    packageJson.scripts?.["qa:phase2-3"] === "node ../scripts/phase2-3-inference-runtime-static-check.mjs",
  "Phase 2-3 build and QA entrypoints must be wired",
)

if (failures.length) {
  console.error("PIXIU Phase 2-3 static gate FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU Phase 2-3 static gate PASSED")
console.log("Camera reuse · direct video inference · cadence/overlap guards · local MoveNet/MediaPipe/Speech runtimes · object contract: PASS")
