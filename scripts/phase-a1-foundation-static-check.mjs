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
const pose = read("pixiu-lms-portal/src/lib/ai/pose-detector.ts")
const extractor = read("pixiu-lms-portal/src/lib/ai/my-ai-feature-extractor.ts")
const engine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const packageJson = read("pixiu-lms-portal/package.json")

// Phase A(1) — Pose type contract.
assert(
  /export type PoseKeypoint\s*=/.test(vision) &&
    /export type PoseResult\s*=/.test(vision),
  "PoseKeypoint/PoseResult must remain exported by vision-types.ts",
)
assert(
  pose.includes('import type { PoseKeypoint, PoseResult } from "./vision-types"'),
  "pose-detector.ts must consume the shared pose types",
)

// Phase A(1) — Tensor ownership in My AI.
assert(
  extractor.includes("const warmupMean = tf.mean(warmup)") &&
    extractor.includes("warmupMean.dispose()") &&
    extractor.includes("warmup.dispose()"),
  "My AI warmup tensors must dispose both the derived mean tensor and warmup tensor",
)
assert(
  /const embedding = tf\.tidy\(\(\) =>/.test(extractor) &&
    extractor.includes("embedding.dispose()"),
  "My AI embedding inference must use tf.tidy and explicitly dispose the returned tensor",
)
assert(
  !/tf\.tidy\(\s*async\b/.test(extractor),
  "tf.tidy callback must not be async",
)
assert(
  extractor.includes("const sumSquares = tf.sum(tf.square(combined), 1, true)") &&
    extractor.includes("const norm = tf.sqrt("),
  "My AI normalization should keep tensor intermediates inside the tidy scope",
)

// Phase A(1) — MoveNet temporary tensors.
assert(
  pose.includes("const rawOutput = model.execute(warmup)") &&
    pose.includes("disposeGraphOutput(rawOutput)") &&
    pose.includes("warmup.dispose()"),
  "MoveNet warmup graph outputs and input tensor must be disposed",
)
assert(
  /const output = tf\.tidy\(\(\) =>/.test(pose) &&
    pose.includes("output.dispose()"),
  "MoveNet inference output must be returned from tidy and explicitly disposed after data()",
)
assert(
  !/tf\.tidy\(\s*async\b/.test(pose),
  "MoveNet tf.tidy callback must not be async",
)

// Phase A(1) — Classifier tensor ownership.
assert(
  engine.includes("const labelTensor = tf.tensor1d(labels, \"int32\")") &&
    engine.includes("labelTensor?.dispose()") &&
    engine.includes("ys?.dispose()") &&
    engine.includes("xs.dispose()"),
  "Training tensor-pair helper must clean up partial allocations on failure",
)
assert(
  engine.includes("trainXs?.dispose()") &&
    engine.includes("trainYs?.dispose()") &&
    engine.includes("validationXs?.dispose()") &&
    engine.includes("validationYs?.dispose()"),
  "Training tensors must be disposed in the outer finally block",
)
assert(
  engine.includes("const weightsToRestore = bestWeights") &&
    engine.includes("weightsToRestore.forEach((weight) => weight.dispose())") &&
    engine.includes("bestWeights?.forEach((weight) => weight.dispose())") &&
    engine.includes("bestWeights = null"),
  "Best-weight snapshots must be disposed on cancellation/error and after restore",
)
assert(
  engine.includes("validationValues.forEach((value) => value.dispose())") &&
    engine.includes("trainValues.forEach((value) => value.dispose())"),
  "evaluate() tensors must be disposed",
)
assert(
  engine.includes("predictionTensor.dispose()"),
  "Validation prediction tensor must be disposed",
)
assert(
  engine.includes("output?.dispose()") &&
    engine.includes("feature.dispose()"),
  "Prediction output and input feature tensors must be disposed",
)
assert(
  !engine.includes("tf.linalg.l2Normalize"),
  "Do not reintroduce unsupported tf.linalg.l2Normalize usage",
)

// Guard against the specific async-tidy misuse documented by TensorFlow.js.
for (const [name, source] of [
  ["my-ai-feature-extractor.ts", extractor],
  ["pose-detector.ts", pose],
  ["ai-studio-engine.ts", engine],
]) {
  assert(
    !/tf\.tidy\(\s*async\b/.test(source),
    name + ": async callbacks inside tf.tidy are forbidden",
  )
}

// Provide a stable package-level QA entrypoint for this phase.
assert(
  packageJson.includes('\"qa:phase-a1\": \"node ../scripts/phase-a1-foundation-static-check.mjs\"'),
  "pixiu-lms-portal must expose qa:phase-a1",
)

if (failures.length) {
  console.error("PIXIU Phase A(1) static gate FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}

console.log("PIXIU Phase A(1) static gate PASSED")
console.log("Pose contract · warmup disposal · inference tensor ownership · evaluation/prediction cleanup · async-tidy guard: PASS")
