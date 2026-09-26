import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(process.cwd())
const files = [
  "pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx",
  "pixiu-lms-portal/src/components/circuit-lab/toolbar.tsx",
  "pixiu-lms-portal/src/pages/Simulation.jsx",
  "src/pages/Simulation.jsx",
]

const forbidden = [
  /pictoblox/gi,
  /green flag/gi,
  /stage mode/gi,
  /upload mode/gi,
]

const required = [
  [/PIXIU VISION CORE/, "PIXIU VISION CORE"],
  [/PIXIU AI STUDIO/, "PIXIU AI STUDIO"],
  [/PIXIU/, "PIXIU"],
]

let failed = false

for (const relative of files) {
  const path = resolve(root, relative)
  let source = ""
  try {
    source = await readFile(path, "utf8")
  } catch {
    continue
  }

  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      failed = true
      console.error(`[brand] Forbidden legacy wording in ${relative}: ${pattern}`)
    }
  }

  if (relative.endsWith("ai-studio-panel.tsx")) {
    for (const [pattern, label] of required) {
      if (!pattern.test(source)) {
        failed = true
        console.error(`[brand] Missing PIXIU brand marker ${label} in ${relative}`)
      }
    }
  }
}

if (failed) {
  process.exit(1)
}

console.log("[brand] Pixiu UI identity check passed.")
