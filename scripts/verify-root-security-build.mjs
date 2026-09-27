#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)), "dist")
const read = (p) => readFile(join(root, p), "utf8")

function fail(message) {
  console.error("PIXIU root production security verification FAILED")
  console.error(" - " + message)
  process.exit(1)
}

const html = await read("index.html")
const manifest = JSON.parse(await read("security/sri-manifest.json"))
if (manifest.algorithm !== "sha384" || !manifest.resources || typeof manifest.resources !== "object") {
  fail("Invalid root SRI manifest.")
}

const pattern = /<(script|link)\b[^>]*?(?:src|href)="(\/[^"]+\.(?:js|css))"[^>]*>/gi
let count = 0
for (const match of html.matchAll(pattern)) {
  count += 1
  const tag = match[0]
  const url = match[2]
  const integrity = tag.match(/\bintegrity="([^"]+)"/i)?.[1]
  if (!integrity) fail("Missing SRI integrity on " + url)
  if (!/\bcrossorigin="anonymous"/i.test(tag)) fail("Missing crossorigin=anonymous on " + url)
  if (manifest.resources[url] !== integrity) fail("SRI manifest mismatch for " + url)
  const body = await read(url.slice(1))
  const actual = "sha384-" + createHash("sha384").update(body).digest("base64")
  if (actual !== integrity) fail("SRI byte mismatch for " + url)
}
if (!count) fail("No build script/style resources were found.")
if (/<(script|link)\b[^>]*(?:src|href)="https?:\/\//i.test(html)) {
  fail("Root build output still contains a remote script or stylesheet resource.")
}
console.log("PIXIU root production security verification PASSED")
console.log("SRI byte verification · no remote script/style tags: PASS")
