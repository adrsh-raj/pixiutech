/**
 * PIXIU TECH CYBERLAB — PHASE 2 DATASET PIPELINE BUNDLE HELPER
 * 
 * Provides bundled TypeScript access to CyberLab domain models, templates,
 * curriculum missions, and deterministic validation engine.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { execSync } from "node:child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const ROOT = resolve(__dirname, "../..")

const portalRequire = createRequire(resolve(ROOT, "pixiu-lms-portal", "package.json"))
const { build } = portalRequire("esbuild")

let bundleCache = null

export async function getBundledModules() {
  if (bundleCache) return bundleCache

  const outdir = join(tmpdir(), `phase2-bundle-${Date.now()}`)
  await build({
    entryPoints: {
      validator: resolve(ROOT, "pixiu-lms-portal/src/lib/circuit-validator.ts"),
      telemetry: resolve(ROOT, "pixiu-lms-portal/src/lib/circuit-telemetry.ts"),
      templates: resolve(ROOT, "pixiu-lms-portal/src/lib/templates.ts"),
      esp32: resolve(ROOT, "pixiu-lms-portal/src/lib/curriculum/esp32-curriculum.ts"),
      pico: resolve(ROOT, "pixiu-lms-portal/src/lib/curriculum/pico-curriculum.ts"),
      microbit: resolve(ROOT, "pixiu-lms-portal/src/lib/curriculum/microbit-curriculum.ts"),
      lessons: resolve(ROOT, "pixiu-lms-portal/src/lib/lesson-engine.ts"),
      doctor: resolve(ROOT, "pixiu-lms-portal/src/lib/circuit-doctor.ts"),
      catalog: resolve(ROOT, "pixiu-lms-portal/src/lib/components-catalog.ts"),
      boards: resolve(ROOT, "pixiu-lms-portal/src/lib/board-registry.ts"),
      componentDataset: resolve(ROOT, "pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.ts"),
    },
    bundle: true,
    format: "esm",
    outdir,
    platform: "neutral",
    alias: {
      "@": resolve(ROOT, "pixiu-lms-portal/src"),
    },
  })

  const [
    validator,
    telemetry,
    templates,
    esp32,
    pico,
    microbit,
    lessons,
    doctor,
    catalog,
    boards,
    componentDataset,
  ] = await Promise.all([
    import(`file://${join(outdir, "validator.js")}`),
    import(`file://${join(outdir, "telemetry.js")}`),
    import(`file://${join(outdir, "templates.js")}`),
    import(`file://${join(outdir, "esp32.js")}`),
    import(`file://${join(outdir, "pico.js")}`),
    import(`file://${join(outdir, "microbit.js")}`),
    import(`file://${join(outdir, "lessons.js")}`),
    import(`file://${join(outdir, "doctor.js")}`),
    import(`file://${join(outdir, "catalog.js")}`),
    import(`file://${join(outdir, "boards.js")}`),
    import(`file://${join(outdir, "componentDataset.js")}`),
  ])

  bundleCache = {
    validator,
    telemetry,
    templates,
    esp32,
    pico,
    microbit,
    lessons,
    doctor,
    catalog,
    boards,
    componentDataset,
  }

  return bundleCache
}

export function getCurrentCommitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim()
  } catch {
    return "unknown-commit-sha"
  }
}
