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
for (const type of ["math_modulo","math_single","arduino_map","pushbutton_read","pir_motion","ldr_read","tmp36_temperature","potentiometer_read","ai_get_object_count"]) assert(toolbox.includes('type: "' + type + '"' ) || toolbox.includes("type: '" + type + "'"), "Blockly toolbox missing " + type)


const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
assert(workbench.includes("const liveWorkspace = visualWorkspaceRef.current"), "Workbench runner is not using the mounted Blockly workspace")
assert(workbench.includes("const currentBlocklyXml = liveWorkspaceXml || blocklyXml"), "Workbench has no synchronized Blockly XML fallback")
assert(workbench.includes("No Arduino Program block found"), "Workbench silently permits a run with no Arduino Program block")
assert(workbench.includes("Pixiu Blockly runtime failed"), "Workbench runtime errors do not fail closed")

const blocklyEditor = read("pixiu-lms-portal/src/components/circuit-lab/blockly-editor.tsx")
assert(blocklyEditor.includes("externalLoadVersionRef"), "Blockly editor external-load versioning is missing")
assert(blocklyEditor.includes('timer = window.setTimeout(applyExternalXml, 0)'), "Blockly editor external template/project load is not scheduled")
assert(blocklyEditor.includes("lastParentXmlRef.current = expectedExternalXml"), "Blockly editor does not lock the completed external XML after hydration")

const runner = read("pixiu-lms-portal/src/lib/blockly-runner.ts")
const releaseGate = read("scripts/phase8-release-gate.mjs")
const browserGate = read("scripts/cyberlab-browser-gate.mjs")

assert(runner.includes('case "controls_whileUntil"'), "Blockly while/until block has no simulator execution path")
assert(releaseGate.includes("payload.service !== \"pixiu-django\"") && releaseGate.includes("payload.database !== \"ok\""), "Phase 8 release gate does not validate the live Django health contract")
assert(releaseGate.includes("/simulation"), "Phase 8 release gate does not cover the Virtual Lab route")
assert(releaseGate.includes("/public/enquiries"), "Phase 8 release gate does not cover public enquiry validation")
assert(browserGate.includes("browser.newContext"), "Phase 7 browser gate does not create an isolated browser context")
assert(browserGate.includes("context.addInitScript"), "Phase 7 browser gate does not isolate protected-route authentication")
assert(browserGate.includes("page.on(\"pageerror\""), "Phase 7 browser gate does not fail on page errors")
assert(browserGate.includes("page.on(\"console\""), "Phase 7 browser gate does not fail on console errors")
assert(browserGate.includes("page.on(\"requestfailed\""), "Phase 7 browser gate does not track failed requests")
assert(browserGate.includes("PIXIU CyberLab browser gate PASSED"), "Phase 7 browser gate completion marker missing")
assert(browserGate.includes("6C Pose ready") && browserGate.includes("6D Fingers ready") && browserGate.includes("6E Emotion ready"), "Phase 7 AI lifecycle coverage is incomplete")
assert(runner.includes("getAiObjectCount"), "Blockly runner lacks AI object count bridge")

if (failures.length) {
  console.error("PIXIU Phase 7-8 static contract check FAILED")
  for (const failure of failures) console.error(" - " + failure)
  process.exit(1)
}
console.log("PIXIU Phase 7-8 static contract check PASSED")
const templatesSource = read("pixiu-lms-portal/src/lib/templates.ts")
for (const marker of [
  'sensorBlock("pushbutton_read", "btn")',
  'sensorBlock("potentiometer_read", "pot")',
  'sensorBlock("ldr_read", "ldr")',
  'sensorBlock("pir_motion", "pir")',
  'sensorBlock("tmp36_temperature", "tmp")',
  'sensorBlock("ir_read", "ir")',
  'sensorBlock("soil_moisture_read", "soil")',
]) assert(templatesSource.includes(marker), "Template behavioral starter contract missing: " + marker)

const workbenchLiveInput = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
for (const marker of ["const pressedRef = useRef<Set<string>>", "pressedRef.current = next", "pressedRef.current.has(p.id)"]) {
  assert(workbenchLiveInput.includes(marker), "Pushbutton live Blockly bridge missing: " + marker)
}
