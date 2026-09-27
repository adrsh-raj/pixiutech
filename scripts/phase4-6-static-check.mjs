import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const read = (path) => readFileSync(join(root, path), "utf8")
const failures = []
const requireText = (source, needle, label) => {
  if (!source.includes(needle)) failures.push(label + ": missing " + needle)
}
const forbidText = (source, needle, label) => {
  if (source.includes(needle)) failures.push(label + ": forbidden " + needle)
}

const simulation = read("pixiu-lms-portal/src/lib/simulation.ts")
const solver = read("pixiu-lms-portal/src/lib/circuit-solver.ts")
const catalog = read("pixiu-lms-portal/src/lib/components-catalog.ts")
const registry = read("pixiu-lms-portal/src/lib/component-registry.ts")
const blocks = read("pixiu-lms-portal/src/lib/arduino-blocks.ts")
const templates = read("pixiu-lms-portal/src/lib/templates.ts")
const workbench = read("pixiu-lms-portal/src/components/circuit-lab/workbench.tsx")
const partArt = read("pixiu-lms-portal/src/components/circuit-lab/part-art.tsx")
const currentFlow = read("pixiu-lms-portal/src/lib/current-flow.ts")
const camera = read("pixiu-lms-portal/src/components/circuit-lab/ai-camera-panel.tsx")
const aiPanel = [
  read("pixiu-lms-portal/src/components/circuit-lab/ai-studio-panel.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/use-ai-studio-controller.ts"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-try-panel.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-teach-panel.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-understand-panel.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-training-diagnostics.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-permission-status.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-runtime-controls.tsx"),
  read("pixiu-lms-portal/src/components/circuit-lab/ai-dataset-panel.tsx"),
].join("\n")
const aiEngine = read("pixiu-lms-portal/src/lib/ai-studio-engine.ts")
const aiTypes = read("pixiu-lms-portal/src/lib/ai/vision-types.ts")
const normalizer = read("pixiu-lms-portal/src/lib/ai/ai-result-normalizer.ts")
const hand = read("pixiu-lms-portal/src/lib/ai/hand-detector.ts")
const face = read("pixiu-lms-portal/src/lib/ai/face-detector.ts")
const sound = read("pixiu-lms-portal/src/lib/ai/sound-detector.ts")
const object = read("pixiu-lms-portal/src/lib/ai/object-detector.ts")
const aiQa = read("scripts/ai-phase6-qa.mjs")
const aiStatic = read("scripts/ai-static-check.mjs")

// Phase 4 — catalog → solver → runtime → Blockly
requireText(simulation, 'from "@/components/circuit-lab/part-art"', "Phase 4 runtime import")
for (const type of ["ir-sensor","dht11","oled-i2c","joystick","l298n","rotary-encoder","soil-moisture","keypad-4x4"]) {
  requireText(simulation, 'part.type === "' + type + '"', "Phase 4 runtime case")
  requireText(catalog, '"' + type + '": {', "Phase 4 catalog entry")
  requireText(registry, '"' + type + '":', "Phase 4 component registry")
}
requireText(catalog, '{ id: "out3"', "Phase 4 L298N OUT3")
requireText(catalog, '{ id: "out4"', "Phase 4 L298N OUT4")
requireText(solver, '"out3"', "Phase 4 solver OUT3")
requireText(solver, '"out4"', "Phase 4 solver OUT4")
requireText(simulation, "hasExternalPower", "Phase 4 external power gating")
requireText(simulation, "findArduinoPinState", "Phase 4 live L298N control bridge")
requireText(simulation, 'addEdge(k("out3"), k("out4"), 2)', "Phase 4 channel B motor path")
requireText(workbench, 'joystick_x: "joystick"', "Phase 4 joystick binding")
requireText(workbench, "computeRuntime(state, pressedRef.current, pinStatesRef.current)", "Phase 4 live sensor bridge")
requireText(partArt, "runtime?.motorARpm", "Phase 4 motor visualization")
requireText(currentFlow, 'part.type === "l298n"', "Phase 4 L298N wire-flow integration")
requireText(currentFlow, 'loadInPin = \`${part.id}:vs\`', "Phase 4 L298N supply-flow input")
requireText(currentFlow, 'loadOutPin = \`${part.id}:gnd\`', "Phase 4 L298N supply-flow return")
for (const marker of ["ir_read","dht_temperature","dht_humidity","oled_print","oled_clear","joystick_x","joystick_y","joystick_button","motor_driver_write","encoder_read","soil_moisture_read","keypad_read"]) {
  requireText(blocks, marker, "Phase 4/5 block definition")
  requireText(registry, marker, "Phase 4 component registry block mapping")
}

// These generators are simulator-only placeholders and must stay compile-safe.
for (const marker of ["PIXIU simulated IR obstacle sensor","PIXIU simulated joystick X","PIXIU simulated joystick Y","PIXIU simulated joystick button","PIXIU simulated soil moisture"]) {
  requireText(blocks, marker, "Phase 4 compile-safe simulator generator")
}

// Phase 5 — template registry + hydration
const starterIds = [...templates.matchAll(/starter\("([^"]+)"/g)].map((m) => m[1])
const explicitIds = [...templates.matchAll(/^\s*id:\s*"([^"]+)"/gm)].map((m) => m[1])
const allIds = [...new Set([...starterIds, ...explicitIds])]
if (starterIds.length < 19) failures.push("Phase 5: fewer than 19 starter templates")
if (allIds.length < 20) failures.push("Phase 5: fewer than 20 total templates")
if (new Set(allIds).size !== allIds.length) failures.push("Phase 5: duplicate template IDs")
for (const id of ["g7-ir-obstacle","g7-encoder-menu","g7-servo-door","g8-lcd-weather","g8-oled-dashboard","g8-motor-driver","g8-joystick-rover","g8-keypad-lock","g8-relay-home"]) {
  if (!allIds.includes(id)) failures.push("Phase 5: missing template " + id)
}
requireText(templates, 'part("bat","battery"', "Phase 5 motor supply")
requireText(templates, 'wire("m","drv","out3","m2","pos"', "Phase 5 motor B output")
requireText(templates, 'wire("n","drv","out4","m2","neg"', "Phase 5 motor B return")
requireText(templates, 'serialPrintValue("joystick_x",{SENSOR:"joy"})', "Phase 5 joystick ID binding")
requireText(templates, 'serialPrintValue("keypad_read",{SENSOR:"keypad"})', "Phase 5 keypad ID binding")
requireText(workbench, "setBlocklyDocumentVersion((value) => value + 1)", "Phase 5 Blockly hydration")

// Phase 6 — shared AI runtime + My AI + normalization boundary
for (const mode of ["objects","pose","hands","emotion","sound","numbers","trained"]) requireText(aiTypes, '"' + mode + '"', "Phase 6 mode")
for (const marker of ["loadObjectDetector","loadMoveNet","loadHandDetector","loadFaceDetector","loadSoundRecognizer","trainAiModel","predictAiImage"]) requireText(aiPanel, marker, "Phase 6 Studio resource wiring")
requireText(camera, 'from "@/lib/ai/object-detector"', "Phase 6 shared object adapter")
requireText(camera, 'from "@/lib/ai/camera-session"', "Phase 6 shared camera session")
requireText(camera, "detectObjects(modelRef.current, video", "Phase 6 shared object detection")
requireText(workbench, "normalizeAiVisionState", "Phase 6 normalization boundary")
requireText(normalizer, "TRAINED_AI_CONFIDENCE_THRESHOLD = 62", "Phase 6 trained threshold")
requireText(aiEngine, "MY_AI_FEATURE_SIZE = 512", "Phase 6 feature contract")
requireText(aiEngine, "validateClassifierModelShape", "Phase 6 model shape validation")
requireText(aiEngine, "prototype.length === MY_AI_FEATURE_SIZE", "Phase 6 prototype length guard")
requireText(aiEngine, "indexeddb://", "Phase 6 persistence")
requireText(hand, "maxNumHands", "Phase 6 hand runtime")
requireText(face, "refineLandmarks: true", "Phase 6 face runtime")
requireText(sound, "probabilityThreshold: 0.72", "Phase 6 sound runtime")
requireText(object, 'base: "lite_mobilenet_v2"', "Phase 6 object model")
requireText(aiQa, "const resultNormalizer = read", "Phase 6 QA dependency")
requireText(aiStatic, "const assert = (condition, message)", "Phase 6 static assertion helper")

// Cross-phase cleanup invariants
forbidText(simulation, "from \"@/components/part-art\"", "Phase 4 stale UI import")
forbidText(aiEngine, "resizeWithPad", "Phase 6 historical feature API")
forbidText(aiEngine, "slice3D", "Phase 6 historical tensor API")
forbidText(aiPanel, "disposeAiResource", "Phase 6 undefined disposer")

if (failures.length) {
  console.error("PIXIU Phase 4-6 static gate FAILED")
  for (const item of failures) console.error(" - " + item)
  process.exit(1)
}

console.log("PIXIU Phase 4-6 static gate PASSED")
console.log("Phase 4 · hardware expansion/runtime/electrical integration: PASS")
console.log("Phase 5 · 20+ templates + Blockly bindings/hydration: PASS")
console.log("Phase 6 · shared AI runtime + My AI + normalized Blockly boundary: PASS")
