import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = (p) => readFileSync(join(root, p), "utf8")
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

assert(!existsSync(join(root, "api/enquiry.js")), "legacy Node/Vercel enquiry function still exists")
const enquiry = read("src/components/EnquiryForm.jsx")
assert(enquiry.includes("/public/enquiries"), "public enquiry form is not wired to Django /public/enquiries")
assert(enquiry.includes("VITE_API_URL"), "public enquiry form does not use canonical configurable API base")

const portalVercel = read("pixiu-lms-portal/vercel.json")
assert(!portalVercel.includes('"ignoreCommand": "exit 1"'), "portal Vercel config forces every commit to build")
assert(portalVercel.includes("git diff --quiet HEAD^ HEAD -- ."), "portal Vercel ignore command is not scoped to portal project changes")

const v1Urls = read("pixiu-backend/core/api_v1_urls.py")
assert(v1Urls.includes("public/enquiries"), "Django v1 public enquiry route missing")

const smoke = read("scripts/e2e-smoke.mjs")
assert(smoke.includes("E2E_PORTAL_URL"), "deployment smoke does not cover the portal")
assert(smoke.includes("/public/enquiries"), "deployment smoke still targets legacy enquiry route")
assert(smoke.includes("/simulation"), "deployment smoke does not cover the Virtual Lab route")

const objects = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
assert(objects.includes("COCO_SSD_CLASSES"), "COCO-SSD class registry missing")
assert(!objects.includes('["car", "truck", "bus", "motorcycle"].includes(lower)'), "vehicle classes are still collapsed to car")

const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
assert(blocks.includes("new Blockly.FieldDropdown(aiClassDropdown)"), "AI detection block still uses free-text class input")
for (const type of ["ai_get_object_count","pir_motion","ldr_read","tmp36_temperature","potentiometer_read","arduino_map"]) assert(blocks.includes("'" + type + "'"), "Block implementation missing " + type)

const toolbox = read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx")
for (const type of ["math_modulo","math_single","arduino_map","pir_motion","ldr_read","tmp36_temperature","potentiometer_read","ai_get_object_count"]) assert(toolbox.includes('type: "' + type + '"' ) || toolbox.includes("type: '" + type + "'"), "Blockly toolbox missing " + type)

const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
assert(runner.includes('case "controls_whileUntil"'), "Blockly while/until block has no simulator execution path")
assert(runner.includes("getAiObjectCount"), "Blockly runner lacks AI object count bridge")

if (failures.length) {
  console.error("PIXIU Phase 7-8 static contract check FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}
console.log("PIXIU Phase 7-8 static contract check PASSED")