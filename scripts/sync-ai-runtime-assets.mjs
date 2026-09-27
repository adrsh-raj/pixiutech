#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
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

const MOVENET_SOURCE_URL =
  process.env.PIXIU_MOVENET_SOURCE_URL ??
  "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/model.json"
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
      })
      if (!response.ok) {
        throw new Error("HTTP " + response.status + " for " + url)
      }

      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        finalUrl: response.url || url,
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

async function ensureRemoteFile(url, destination) {
  if (await exists(destination)) {
    const info = await stat(destination)
    if (info.size > 0) return null
  }

  await mkdir(dirname(destination), { recursive: true })
  const result = await fetchBytes(url)
  if (!result.bytes.length) throw new Error("Downloaded empty asset: " + url)
  await writeFile(destination, result.bytes)
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
  const modelPath = join(MOVENET_DIR, "model.json")
  const sourcePath = join(MOVENET_DIR, ".source-url")
  let modelSourceUrl = MOVENET_SOURCE_URL

  if (!(await exists(modelPath)) || (await stat(modelPath)).size === 0) {
    const finalUrl = await ensureRemoteFile(MOVENET_SOURCE_URL, modelPath)
    modelSourceUrl = finalUrl || MOVENET_SOURCE_URL
    await writeFile(sourcePath, modelSourceUrl + "\n")
  } else if (await exists(sourcePath)) {
    const storedSource = (await readFile(sourcePath, "utf8")).trim()
    if (storedSource) modelSourceUrl = storedSource
  }

  const model = JSON.parse(await readFile(modelPath, "utf8"))
  if (model.format !== "graph-model") {
    throw new Error("MoveNet local model.json is not a TensorFlow.js graph model.")
  }
  if (!Array.isArray(model.weightsManifest) || !model.weightsManifest.length) {
    throw new Error("MoveNet local model.json has no weightsManifest.")
  }

  const paths = []
  for (const manifest of model.weightsManifest) {
    if (!Array.isArray(manifest?.paths)) {
      throw new Error("MoveNet weightsManifest entry has no paths.")
    }
    for (const assetPath of manifest.paths) {
      if (typeof assetPath !== "string" || !assetPath || assetPath.includes("..")) {
        throw new Error("Unsafe MoveNet shard path: " + String(assetPath))
      }
      paths.push(assetPath)
    }
  }

  for (const assetPath of paths) {
    const destination = join(MOVENET_DIR, assetPath)
    const url = new URL(assetPath, modelSourceUrl).toString()
    await ensureRemoteFile(url, destination)
  }

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

async function ensureGraphModel(modelSourceUrl, destinationDir, label, expectedFormat) {
  const modelPath = join(destinationDir, "model.json")
  const sourcePath = join(destinationDir, ".source-url")
  let modelSource = modelSourceUrl

  if (!(await exists(modelPath)) || (await stat(modelPath)).size === 0) {
    const finalUrl = await ensureRemoteFile(modelSourceUrl, modelPath)
    modelSource = finalUrl || modelSourceUrl
    await writeFile(sourcePath, modelSource + "\n")
  } else if (await exists(sourcePath)) {
    const stored = (await readFile(sourcePath, "utf8")).trim()
    if (stored) modelSource = stored
  }

  const model = JSON.parse(await readFile(modelPath, "utf8"))
  if (expectedFormat && model.format !== expectedFormat) {
    throw new Error(label + " model format mismatch: expected " + expectedFormat + ", got " + String(model.format))
  }
  if (!Array.isArray(model.weightsManifest) || !model.weightsManifest.length) {
    throw new Error(label + " model.json has no weightsManifest.")
  }

  for (const manifest of model.weightsManifest) {
    if (!Array.isArray(manifest?.paths)) {
      throw new Error(label + " weightsManifest entry has no paths.")
    }
    for (const assetPath of manifest.paths) {
      if (typeof assetPath !== "string" || !assetPath || assetPath.includes("..") || assetPath.startsWith("/")) {
        throw new Error("Unsafe " + label + " shard path: " + String(assetPath))
      }
      const destination = join(destinationDir, assetPath)
      const url = new URL(assetPath, modelSource).toString()
      await ensureRemoteFile(url, destination)
    }
  }

  return modelPath
}

async function ensureSpeechCommands() {
  const destination = join(SPEECH_DIR, "speech-commands.min.js")
  await ensureRemoteFile(SPEECH_SCRIPT_SOURCE_URL, destination)

  const modelPath = await ensureGraphModel(
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

  const metadata = JSON.parse(await readFile(metadataPath, "utf8"))
  if (!Array.isArray(metadata.wordLabels) || metadata.wordLabels.length < 18) {
    throw new Error("Speech Commands metadata has an invalid wordLabels list.")
  }
  console.log("Speech Commands local assets ready:", join("public", "models", "speech-commands", "18w"))
  console.log("Speech Commands runtime ready:", join("public", "vendor", "tfjs", "speech-commands", "speech-commands.min.js"))
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
  process.exit(1)
})
