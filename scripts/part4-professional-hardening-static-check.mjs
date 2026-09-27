#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

const objectDetector = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const soundDetector = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const handDetector = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const faceDetector = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const poseDetector = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const cameraSession = read("pixiu-lms-portal/src/lib/ai/camera-session.ts")
const syncAssets = read("scripts/sync-ai-runtime-assets.mjs")
const vite = read("pixiu-lms-portal/vite.config.js")
const rootVite = read("vite.config.js")
const rootVercel = read("vercel.json")
const index = read("pixiu-lms-portal/index.html")
const vercel = read("pixiu-lms-portal/vercel.json")
const packageJson = JSON.parse(read("pixiu-lms-portal/package.json"))
const errorTaxonomy = read("pixiu-lms-portal/src/lib/ai/ai-errors.ts")
const studio = read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx")
const controller = read("pixiu-lms-portal/src/components/circuit-lab/use-ai-studio-controller.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const productionSmoke = read(".github/workflows/production-security-smoke.yml")

assert(objectDetector.includes('modelUrl: COCO_SSD_MODEL_URL'), "COCO-SSD is not explicitly bound to a same-origin model URL")
assert(objectDetector.includes('"/models/coco-ssd-lite-mobilenet-v2/model.json"'), "COCO-SSD local model path is missing")
assert(soundDetector.includes('SPEECH_MODEL_URL = "/models/speech-commands/18w/model.json"'), "Speech Commands local model URL is missing")
assert(soundDetector.includes('SPEECH_METADATA_URL = "/models/speech-commands/18w/metadata.json"'), "Speech Commands local metadata URL is missing")
assert(soundDetector.includes('"BROWSER_FFT",\n    null,\n    SPEECH_MODEL_URL,\n    SPEECH_METADATA_URL'), "Speech Commands does not use the supported custom local model API")
assert(!soundDetector.includes("modelArtifactsOrURL = SPEECH_MODEL_URL"), "Speech Commands still relies on private runtime model fields")
assert(!soundDetector.includes("https://storage.googleapis.com/tfjs-models/tfjs/speech-commands"), "Runtime speech detector still hardcodes a remote model URL")
assert(syncAssets.includes("COCO_SSD_SOURCE_URL"), "COCO-SSD asset provisioning is missing")
assert(syncAssets.includes("ensureGraphModel(COCO_SSD_SOURCE_URL"), "COCO-SSD weights are not provisioned from model.json manifest")
assert(syncAssets.includes('expectedFormat === "graph-model"') && syncAssets.includes('legacy-model-without-format'), "Graph-model validator must support legacy TF.js model.json files without a top-level format")
assert(syncAssets.includes('force: true'), "Invalid cached AI model.json files must be force-refetched")
assert(syncAssets.includes("SPEECH_METADATA_SOURCE_URL"), "Speech metadata provisioning is missing")
assert(syncAssets.includes("SPEECH_SOURCE_URL"), "Speech model provisioning is missing")
assert(vite.includes("sriAttributePlugin"), "Portal Vite production SRI plugin is missing")
assert(rootVite.includes("pixiu-root-sri-attributes"), "Root Vite production SRI plugin is missing")
assert(vite.includes("sha384-"), "Vite SRI plugin does not generate SHA-384 integrity")
assert(vite.includes("sri-manifest.json"), "Build does not emit an SRI manifest")
assert(syncAssets.includes("PIXIU-AI-RUNTIME-MANIFEST.json"), "Build does not generate AI runtime integrity manifest")
assert(!index.includes("fonts.googleapis.com"), "External Google Fonts stylesheet remains in portal HTML")
assert(!index.includes("fonts.gstatic.com"), "External Google Fonts preconnect remains in portal HTML")
assert(vercel.includes('"Content-Security-Policy"'), "Portal CSP header is missing")
assert(rootVercel.includes('"Content-Security-Policy"'), "Root CSP header is missing")
for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "script-src 'self'", "connect-src 'self' https:", "media-src 'self' blob:"]) {
  assert(vercel.includes(directive), "CSP directive missing: " + directive)
}
assert(packageJson.scripts?.["test:ai"], "AI unit-test script is missing")
assert(packageJson.scripts?.["qa:part4"], "Part 4 static gate script is missing")
for (const name of ["AiRuntimeError","AIModelLoadError","AIModelShapeError","AITensorShapeError","AIDatasetError","AIPermissionError","AICameraError","AIMicrophoneError","AIInferenceError","AIStorageError","AIUnsupportedBrowserError"]) {
  assert(errorTaxonomy.includes("class " + name), "Structured AI error class missing: " + name)
}
for (const file of [
  "pixiu-lms-portal/src/components/circuit-lab/ai-studio-view-model.ts",
  "pixiu-lms-portal/src/components/circuit-lab/ai-try-panel.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-teach-panel.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-understand-panel.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-training-diagnostics.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-dataset-panel.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-runtime-controls.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-permission-status.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/ai-studio-presenters.ts",
]) assert(existsSync(join(root, file)), "Split AI Studio module missing: " + file)
assert(studio.split("\n").length <= 400, "AI Studio view shell is too large")
assert(controller.split("\n").length <= 2000, "AI Studio controller exceeded the approved controller budget")
const unitDir = join(root, "pixiu-lms-portal/test/ai")
const unitFiles = readdirSync(unitDir).filter((name) => name.endsWith(".test.ts"))
assert(unitFiles.length >= 5, "Expected at least five AI module unit-test files")
assert(controller.includes('type ReadyResource ='), "Typed AI resource union is missing")
assert(!controller.match(/\bany\b/), "AI Studio controller still contains broad any")
assert(engine.includes("isCompatibleModelSummary"), "Central stored-model compatibility contract is missing")
assert(objectDetector.includes("objectDetectorReferences") && objectDetector.includes("objectDetectorInstance"), "Object detector shared-load ownership guard is missing")
assert(poseDetector.includes("moveNetReferences") && poseDetector.includes("moveNetInstance"), "MoveNet shared-load ownership guard is missing")
assert(!soundDetector.match(/\bany\b/), "Sound detector still contains broad any")
for (const [name, source] of [["Hand detector", handDetector], ["Face detector", faceDetector], ["Pose detector", poseDetector], ["Camera session", cameraSession]]) {
  assert(!source.match(/\bany\b/), name + " still contains broad any")
}
assert(productionSmoke.split("\n").length < 180, "Production security smoke workflow is unexpectedly large/corrupted")
assert(productionSmoke.includes("name: PIXIU Production Security Smoke") && productionSmoke.includes("jobs:") && productionSmoke.includes("Django health"), "Production security smoke workflow is incomplete")

if (failures.length) {
  console.error("PIXIU Part 4 professional hardening gate FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU Part 4 professional hardening gate PASSED")
console.log("Local model binding · CSP · SRI build hook · component split · AI unit coverage: PASS")
