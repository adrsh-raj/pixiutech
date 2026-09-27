#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { execFileSync } from "node:child_process"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const portalRoot = join(repoRoot, "pixiu-lms-portal")

function run(command, args, cwd, label) {
  process.stdout.write("\n== " + label + " ==\n")
  execFileSync(command, args, { cwd, stdio: "inherit", env: process.env })
}

if (!existsSync(join(repoRoot, ".github/workflows/phase9-final-gate.yml"))) {
  throw new Error("Phase 9 workflow is missing")
}
if (!existsSync(join(repoRoot, "scripts/cyberlab-browser-gate.mjs"))) {
  throw new Error("Browser verification gate is missing")
}

const workflowDir = join(repoRoot, ".github/workflows")
for (const name of readdirSync(workflowDir)) {
  if (!/\.(yml|yaml)$/.test(name)) continue
  const source = readFileSync(join(workflowDir, name), "utf8")
  if (/git\s+push(?:\s+[^\n]*)?(?:--force|-f)?\s+(?:origin\s+)?main/i.test(source) || /git\s+push\s+--force/i.test(source)) {
    throw new Error("Controlled-push invariant violated by " + name)
  }
}

const requiredScripts = [
  "scripts/phase4-6-static-check.mjs",
  "scripts/ai-static-check.mjs",
  "scripts/ai-phase6-qa.mjs",
  "scripts/phase7-8-static-check.mjs",
  "scripts/phase8-release-gate.mjs",
  "scripts/cyberlab-browser-gate.mjs",
]
for (const relative of requiredScripts) {
  if (!existsSync(join(repoRoot, relative))) throw new Error("Required release gate missing: " + relative)
}

run("npm", ["run", "lint"], portalRoot, "Portal lint")
run("npm", ["run", "qa:phase4-6"], portalRoot, "Phase 4-6 static gate")
run(process.execPath, ["scripts/ai-static-check.mjs"], repoRoot, "AI static contract gate")
run(process.execPath, ["--experimental-strip-types", "scripts/ai-phase6-qa.mjs"], repoRoot, "AI executable regression matrix")
run(process.execPath, ["scripts/phase7-8-static-check.mjs"], repoRoot, "Phase 7-8 static regression gate")
run("npm", ["run", "build"], portalRoot, "Portal production build")

process.stdout.write("\nPIXIU Phase 9 final green gate source/build portion PASSED\n")
process.stdout.write("Controlled push invariant: PASS (no workflow performs an automatic main/force push)\n")
