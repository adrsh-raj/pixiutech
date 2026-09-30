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
  if (/\bgit\s+push\b/i.test(source) || /\bgh\s+pr\s+merge\b/i.test(source)) {
    throw new Error("Controlled-push invariant violated by " + name)
  }
}

const requiredScripts = [
  "scripts/phase-a1-foundation-static-check.mjs",
  "scripts/phase2-3-inference-runtime-static-check.mjs",
  "scripts/phase4-6-static-check.mjs",
  "scripts/phase4-9-reliability-static-check.mjs",
  "scripts/ai-static-check.mjs",
  "scripts/ai-phase6-qa.mjs",
  "scripts/phase7-8-static-check.mjs",
  "scripts/security-static-check.mjs",
  "scripts/phase8-release-gate.mjs",
  "scripts/cyberlab-browser-gate.mjs",
  "scripts/part4-professional-hardening-static-check.mjs",
  "scripts/verify-portal-security-build.mjs",
  "scripts/verify-root-security-build.mjs",
]
for (const relative of requiredScripts) {
  if (!existsSync(join(repoRoot, relative))) throw new Error("Required release gate missing: " + relative)
}

run("npm", ["run", "lint"], portalRoot, "Portal lint")
run(process.execPath, ["scripts/part4-professional-hardening-static-check.mjs"], repoRoot, "Part 4 professional hardening gate")
run("npm", ["run", "test:ai"], portalRoot, "AI module unit tests")
run("npm", ["run", "qa:phase-a1"], portalRoot, "Phase A(1) foundation gate")
run("npm", ["run", "qa:phase2-3"], portalRoot, "Phase 2-3 inference/runtime gate")
run("npm", ["run", "qa:phase4-6"], portalRoot, "Phase 4-6 static gate")
run("npm", ["run", "qa:phase4-9"], portalRoot, "Phase 4-9 reliability gate")
run(process.execPath, ["scripts/ai-static-check.mjs"], repoRoot, "AI static contract gate")
run(process.execPath, ["--experimental-strip-types", "scripts/ai-phase6-qa.mjs"], repoRoot, "AI executable regression matrix")
run(process.execPath, ["scripts/phase7-8-static-check.mjs"], repoRoot, "Phase 7-8 static regression gate")
run(process.execPath, ["scripts/security-static-check.mjs"], repoRoot, "Cross-phase security static gate")
run("npm", ["run", "build"], portalRoot, "Portal production build")
run(process.execPath, ["scripts/verify-portal-security-build.mjs"], repoRoot, "Built SRI + local AI runtime verification")
run("npm", ["run", "build"], repoRoot, "Public website production build")
run(process.execPath, ["scripts/verify-root-security-build.mjs"], repoRoot, "Public website SRI verification")

process.stdout.write("\nPIXIU Phase 9 final green gate source/build portion PASSED\n")
process.stdout.write("Controlled push invariant: PASS (no workflow performs an automatic main/force push)\n")
