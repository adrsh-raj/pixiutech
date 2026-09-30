#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { constants } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative, resolve, sep } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const portalRoot = join(root, "pixiu-lms-portal")
const publicRoot = join(portalRoot, "public")

const HANDS_SOURCE = join(
  portalRoot,
  "node_modules",
  "@mediapipe",
  "hands",
)
const FACE_SOURCE = join(
  portalRoot,
  "node_modules",
  "@mediapipe",
  "face_mesh",
)

// The original TF Hub GCS bucket (tfhub-tfjs-modules) now returns 403.
// MoveNet model files are bundled in git under public/models/movenet/.
// Bundled local MoveNet model source: singlepose/lightning/4/model.json
// Set PIXIU_MOVENET_SOURCE_URL to a custom mirror if needed.
const MOVENET_SOURCE_URL =
  process.env.PIXIU_MOVENET_SOURCE_URL ?? ""
const COCO_SSD_SOURCE_URL =
  process.env.PIXIU_COCO_SSD_SOURCE_URL ??
  "https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json"
const SPEECH_SOURCE_URL =
  process.env.PIXIU_SPEECH_COMMANDS_SOURCE_URL ??
  "https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/model.json"
const SPEECH_METADATA_SOURCE_URL =
  process.env.PIXIU_SPEECH_METADATA_SOURCE_URL ??
  "https://storage.googleapis.com/tfjs-models/tfjs/speech-commands/v0.5/browser_fft/18w/metadata.json"
const SPEECH_SCRIPT_SOURCE_URL =
  process.env.PIXIU_SPEECH_COMMANDS_SCRIPT_SOURCE_URL ??
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js"

const COCO_SSD_DIR = join(publicRoot, "models", "coco-ssd-lite-mobilenet-v2")
const MOVENET_DIR = join(publicRoot, "models", "movenet")
const SPEECH_MODEL_DIR = join(publicRoot, "models", "speech-commands", "18w")
const SPEECH_DIR = join(
  publicRoot,
  "vendor",
  "tfjs",
  "speech-commands",
)
const HANDS_DIR = join(publicRoot, "vendor", "mediapipe", "hands")
const FACE_DIR = join(
  publicRoot,
  "vendor",
  "mediapipe",
  "face_mesh",
)

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function fetchBytes(url, attempts = 3) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          accept: "application/json, text/plain, */*",
        },
      })

      const contentType = response.headers.get("content-type") ?? ""
      const finalUrl = response.url || url

      if (!response.ok) {
        throw new Error(
          "HTTP " +
            response.status +
            " (" +
            response.statusText +
            ") for " +
            url +
            " [final: " +
            finalUrl +
            "]",
        )
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      if (!bytes.length) {
        throw new Error("Downloaded empty response from " + finalUrl)
      }

      return {
        bytes,
        finalUrl,
        contentType,
      }
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 500 * attempt),
        )
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to download " + url)
}

async function ensureRemoteFile(url, destination, options = {}) {
  const force = options.force === true
  if (!force && (await exists(destination))) {
    const info = await stat(destination)
    if (info.size > 0) return null
  }

  await mkdir(dirname(destination), { recursive: true })
  const result = await fetchBytes(url)
  if (!result.bytes.length) throw new Error("Downloaded empty asset: " + url)

  // Write only the completed payload so a failed download cannot leave a
  // partially-written model/shard for the next cached deployment.
  const temporary = destination + ".tmp-" + process.pid + "-" + Date.now()
  try {
    await writeFile(temporary, result.bytes)
    await rename(temporary, destination)
  } finally {
    await rm(temporary, { force: true })
  }

  return result.finalUrl
}

async function copyDirectoryAssets(sourceDir, destinationDir) {
  if (!(await exists(sourceDir))) {
    throw new Error(
      "Required MediaPipe package is missing: " +
        relative(portalRoot, sourceDir) +
        ". Run npm ci first.",
    )
  }

  await mkdir(destinationDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const ignored = new Set([
    "package.json",
    "index.d.ts",
    "README.md",
  ])

  for (const entry of entries) {
    if (!entry.isFile() || ignored.has(entry.name)) continue
    await copyFile(join(sourceDir, entry.name), join(destinationDir, entry.name))
  }

  const required = [
    "hands.js",
    "hands.binarypb",
    "hands_solution_packed_assets.data",
    "hands_solution_packed_assets_loader.js",
  ]
  if (sourceDir.endsWith("@mediapipe" + sep + "face_mesh")) {
    required.splice(
      0,
      required.length,
      "face_mesh.js",
      "face_mesh.binarypb",
      "face_mesh_solution_packed_assets.data",
      "face_mesh_solution_packed_assets_loader.js",
    )
  }

  for (const file of required) {
    const target = join(destinationDir, file)
    if (!(await exists(target))) {
      throw new Error("Missing required local MediaPipe asset: " + target)
    }
    if ((await stat(target)).size <= 0) {
      throw new Error("Local MediaPipe asset is empty: " + target)
    }
  }

  const wasmFiles = (await readdir(destinationDir))
    .filter((file) => file.endsWith(".wasm"))
  if (!wasmFiles.length) {
    throw new Error("Local MediaPipe runtime is missing its WASM binary: " + destinationDir)
  }
}

async function ensureMoveNet() {
  await ensureGraphModel(
    MOVENET_SOURCE_URL,
    MOVENET_DIR,
    "MoveNet",
    "graph-model",
  )

  console.log(
    "MoveNet local assets ready:",
    join("public", "models", "movenet", "model.json"),
  )
}

async function listFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files.sort()
}

async function writeRuntimeManifest() {
  const roots = [
    { dir: COCO_SSD_DIR, prefix: "models/coco-ssd-lite-mobilenet-v2/" },
    { dir: MOVENET_DIR, prefix: "models/movenet/" },
    { dir: SPEECH_MODEL_DIR, prefix: "models/speech-commands/18w/" },
    { dir: HANDS_DIR, prefix: "vendor/mediapipe/hands/" },
    { dir: FACE_DIR, prefix: "vendor/mediapipe/face_mesh/" },
    { dir: SPEECH_DIR, prefix: "vendor/tfjs/speech-commands/" },
  ]

  const files = {}
  for (const { dir, prefix } of roots) {
    for (const fullPath of await listFilesRecursive(dir)) {
      const fileName = fullPath.split(sep).pop() || ""
      if (fileName.startsWith(".")) continue
      const body = await readFile(fullPath)
      const relativeToDir = relative(dir, fullPath).split(sep).join("/")
      files[prefix + relativeToDir] = {
        size: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
      }
    }
  }

  const manifest = {
    version: 1,
    algorithm: "sha256",
    models: {
      cocoSsd: "lite_mobilenet_v2",
      moveNet: "singlepose-lightning-v4",
      speechCommands: "0.5.4/18w",
      mediaPipeHands: "0.4.1675469240",
      mediaPipeFaceMesh: "0.4.1633559619",
    },
    files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b))),
  }

  await mkdir(join(publicRoot, "vendor"), { recursive: true })
  await writeFile(
    join(publicRoot, "vendor", "PIXIU-AI-RUNTIME-MANIFEST.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  )
}

function isExpectedModelFormat(model, expectedFormat) {
  if (!expectedFormat) return true
  if (model.format === expectedFormat) return true

  // Some legacy TF.js-hosted graph models omit the optional top-level
  // format field. For graph models, modelTopology + weightsManifest is the
  // runtime contract consumed by tf.loadGraphModel()/loadGraphModel().
  if (
    expectedFormat === "graph-model" &&
    model.format == null &&
    model.modelTopology &&
    typeof model.modelTopology === "object" &&
    Array.isArray(model.weightsManifest) &&
    model.weightsManifest.length > 0
  ) {
    return true
  }

  // Speech Commands is a LayersModel. Accept the legacy topology shape only
  // when its Keras model_config proves that this is a layers model.
  if (
    expectedFormat === "layers-model" &&
    model.format == null &&
    model.modelTopology &&
    typeof model.modelTopology === "object" &&
    model.modelTopology.model_config &&
    typeof model.modelTopology.model_config === "object"
  ) {
    return true
  }

  return false
}

function describeModelFormat(model) {
  if (typeof model.format === "string" && model.format.trim()) {
    return model.format
  }
  if (model.modelTopology && typeof model.modelTopology === "object") {
    return "legacy-model-without-format"
  }
  return "unknown"
}

async function readModelJson(modelPath, label) {
  const text = await readFile(modelPath, "utf8")
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(label + " model.json is not valid JSON.")
  }
}

function validateModelManifest(model, label, expectedFormat) {
  if (!isExpectedModelFormat(model, expectedFormat)) {
    throw new Error(
      label +
        " model format mismatch: expected " +
        expectedFormat +
        ", got " +
        describeModelFormat(model),
    )
  }

  if (!Array.isArray(model.weightsManifest) || !model.weightsManifest.length) {
    throw new Error(label + " model.json has no weightsManifest.")
  }

  let shardCount = 0
  for (const manifest of model.weightsManifest) {
    if (!Array.isArray(manifest?.paths) || !manifest.paths.length) {
      throw new Error(label + " weightsManifest entry has no paths.")
    }

    for (const assetPath of manifest.paths) {
      if (
        typeof assetPath !== "string" ||
        !assetPath ||
        assetPath.includes("..") ||
        assetPath.startsWith("/")
      ) {
        throw new Error(
          "Unsafe " + label + " shard path: " + String(assetPath),
        )
      }
      shardCount += 1
    }
  }

  if (!shardCount) {
    throw new Error(label + " model.json declares no weight shards.")
  }
}

async function ensureGraphModel(modelSourceUrl, destinationDir, label, expectedFormat) {
  const modelPath = join(destinationDir, "model.json")
  const sourcePath = join(destinationDir, ".source-url")
  // The canonical source passed by the caller is authoritative. A cached
  // .source-url must never redirect future builds to an obsolete provider.
  const modelSource = modelSourceUrl
  let model = null

  if (await exists(modelPath)) {
    try {
      model = await readModelJson(modelPath, label)
      validateModelManifest(model, label, expectedFormat)
    } catch {
      // Deployment caches may contain an older model format, HTML from a
      // redirect, or an interrupted artifact. Re-fetch from the canonical
      // model source and validate the replacement.
      model = null
    }
  }

  if (!model && modelSource) {
    const result = await fetchBytes(modelSource)
    const contentType = result.contentType.toLowerCase()
    if (
      label === "MoveNet" &&
      contentType &&
      !contentType.includes("application/json") &&
      !contentType.includes("text/json")
    ) {
      throw new Error(
        label +
          " model endpoint returned non-JSON content-type " +
          JSON.stringify(result.contentType) +
          " from " +
          result.finalUrl,
      )
    }

    const temporary = modelPath + ".tmp-" + process.pid + "-" + Date.now()
    try {
      await mkdir(dirname(modelPath), { recursive: true })
      await writeFile(temporary, result.bytes)
      await rename(temporary, modelPath)
    } finally {
      await rm(temporary, { force: true })
    }

    await writeFile(sourcePath, modelSource + "\n")
    model = await readModelJson(modelPath, label)
  }

  if (!model) {
    throw new Error(
      label +
        " model.json not found at " +
        modelPath +
        " and no remote source URL is configured. " +
        "Ensure model files are bundled or set the corresponding PIXIU_*_SOURCE_URL env var.",
    )
  }

  validateModelManifest(model, label, expectedFormat)

  for (const manifest of model.weightsManifest) {
    for (const assetPath of manifest.paths) {
      const destination = join(destinationDir, assetPath)
      if (modelSource) {
        const url = new URL(assetPath, modelSource).toString()
        await ensureRemoteFile(url, destination)
      } else if (!(await exists(destination)) || (await stat(destination)).size === 0) {
        throw new Error(
          label +
            " weight shard " +
            assetPath +
            " is missing and no remote source URL is configured.",
        )
      }
    }
  }

  return modelPath
}

async function ensureSpeechCommands() {
  const destination = join(SPEECH_DIR, "speech-commands.min.js")
  await ensureRemoteFile(SPEECH_SCRIPT_SOURCE_URL, destination)

  await ensureGraphModel(
    SPEECH_SOURCE_URL,
    SPEECH_MODEL_DIR,
    "Speech Commands",
    "layers-model",
  )
  const metadataPath = join(SPEECH_MODEL_DIR, "metadata.json")
  await ensureRemoteFile(SPEECH_METADATA_SOURCE_URL, metadataPath)

  const text = await readFile(destination, "utf8")
  if (
    !text.includes("speechCommands") &&
    !text.includes("Speech Command Recognizer")
  ) {
    throw new Error(
      "Speech Commands asset did not contain the expected browser runtime.",
    )
  }

  let metadata
  try {
    metadata = JSON.parse(await readFile(metadataPath, "utf8"))
  } catch {
    throw new Error("Speech Commands metadata.json is not valid JSON.")
  }

  // The Speech Commands runtime officially supports both the current
  // "wordLabels" field and the legacy "words" field.
  const labels = Array.isArray(metadata.wordLabels)
    ? metadata.wordLabels
    : Array.isArray(metadata.words)
      ? metadata.words
      : null

  if (
    !labels ||
    labels.length < 18 ||
    labels.some((label) => typeof label !== "string" || !label.trim())
  ) {
    throw new Error(
      "Speech Commands metadata has no valid wordLabels/words vocabulary (expected at least 18 labels).",
    )
  }

  console.log(
    "Speech Commands local assets ready:",
    join("public", "models", "speech-commands", "18w"),
  )
  console.log(
    "Speech Commands runtime ready:",
    join("public", "vendor", "tfjs", "speech-commands", "speech-commands.min.js"),
  )
}

async function main() {
  await Promise.all([
    copyDirectoryAssets(HANDS_SOURCE, HANDS_DIR),
    copyDirectoryAssets(FACE_SOURCE, FACE_DIR),
    ensureGraphModel(COCO_SSD_SOURCE_URL, COCO_SSD_DIR, "COCO-SSD", "graph-model"),
    ensureMoveNet(),
    ensureSpeechCommands(),
  ])

  await writeRuntimeManifest()

  const notice = [
    "PIXIU AI local runtime assets",
    "",
    "MediaPipe Hands: @mediapipe/hands 0.4.1675469240 (Apache-2.0)",
    "MediaPipe Face Mesh: @mediapipe/face_mesh 0.4.1633559619 (Apache-2.0)",
    "TensorFlow Speech Commands browser runtime: 0.5.4 (Apache-2.0)",
    "MoveNet SinglePose Lightning: TensorFlow Hub/Kaggle published model asset.",
    "",
    "These files are provisioned from pinned package/model sources during build.",
  ].join("\n")

  await mkdir(join(publicRoot, "vendor"), { recursive: true })
  await writeFile(
    join(publicRoot, "vendor", "PIXIU-AI-RUNTIME-NOTICE.txt"),
    notice + "\n",
  )
}

main().catch((error) => {
  console.error("PIXIU AI runtime asset sync FAILED")
  console.error(error instanceof Error ? error.message : error)
  console.error(
    "Cached model.json files are revalidated and replaced automatically when malformed or incompatible.",
  )
  process.exit(1)
})
