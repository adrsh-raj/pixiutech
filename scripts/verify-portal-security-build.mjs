#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "pixiu-lms-portal", "dist")
const read = (p) => readFile(join(dist, p), "utf8")

function fail(message) {
  console.error("PIXIU production security verification FAILED")
  console.error(" - " + message)
  process.exit(1)
}

const html = await read("index.html")
const manifestText = await read("security/sri-manifest.json")
const manifest = JSON.parse(manifestText)
if (manifest.algorithm !== "sha384" || !manifest.resources || typeof manifest.resources !== "object") {
  fail("Invalid SRI manifest.")
}

const resourcePattern = /<(script|link)[^>]*?(?:src|href)="(/[^"]+.(?:js|css))"[^>]*>/gi
let resourceCount = 0

for (const match of html.matchAll(resourcePattern)) {
  resourceCount += 1
  const tag = match[0]
  const url = match[2]
  const integrity = tag.match(/integrity="([^"]+)"/i)?.[1]
  if (!integrity) fail("Missing SRI integrity on " + url)
  if (!/crossorigin="anonymous"/i.test(tag)) fail("Missing crossorigin=anonymous on " + url)

  const expected = manifest.resources[url]
  if (expected !== integrity) fail("SRI manifest mismatch for " + url)

  const body = await readFile(join(dist, decodeURIComponent(url.slice(1))))
  const actual = "sha384-" + createHash("sha384").update(body).digest("base64")
  if (actual !== integrity) fail("SRI hash does not match built bytes for " + url)
}

if (!resourceCount) fail("No build script/style resources were found for SRI verification.")
if (/<(script|link)[^>]*(?:src|href)="https?:///i.test(html)) {
  fail("Build output still contains a remote script or stylesheet resource.")
}

for (const file of [
  "models/coco-ssd-lite-mobilenet-v2/model.json",
  "models/movenet/model.json",
  "models/speech-commands/18w/model.json",
  "models/speech-commands/18w/metadata.json",
  "vendor/mediapipe/hands/hands.js",
  "vendor/mediapipe/face_mesh/face_mesh.js",
  "vendor/tfjs/speech-commands/speech-commands.min.js",
]) {
  try {
    const info = await stat(join(dist, file))
    if (!info.isFile() || info.size <= 0) fail("Missing or empty local AI runtime asset: " + file)
  } catch {
    fail("Missing local AI runtime asset: " + file)
  }
}

console.log("PIXIU production security verification PASSED")
console.log("SRI byte verification · no remote script/style tags · local AI runtime assets: PASS")
