import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { compileRecordSchema } from "./record-schema-validator.mjs"
import { getBundledModules, ROOT } from "./bundle-helper.mjs"
import { resolveBoardContext } from "./inventory-sources.mjs"

const schema = JSON.parse(readFileSync(resolve(ROOT, "scripts/copilot-dataset/schema/record-v1.schema.json"), "utf8"))
const validateRecord = compileRecordSchema(schema)
const trainPath = resolve(ROOT, "data/ai-copilot/phase2/splits/train.jsonl")
const firstRecord = JSON.parse(readFileSync(trainPath, "utf8").trim().split(/\r?\n/)[0])

test("record-v1 validator accepts an existing released record", () => {
  assert.equal(validateRecord(firstRecord), true, JSON.stringify(validateRecord.errors))
})

test("record-v1 validator rejects a missing required property", () => {
  const malformed = { ...firstRecord }
  delete malformed.record_id
  assert.equal(validateRecord(malformed), false)
  assert.ok(validateRecord.errors.some((error) => error.keyword === "required" && error.params?.missingProperty === "record_id"))
})

test("record-v1 validator rejects an unknown task type", () => {
  assert.equal(validateRecord({ ...firstRecord, task_type: "not-a-pixiu-task" }), false)
  assert.ok(validateRecord.errors.some((error) => error.keyword === "enum" && error.instancePath === "/task_type"))
})

test("TypeScript and JSON component registries contain the same keys", async () => {
  const modules = await getBundledModules()
  const json = JSON.parse(readFileSync(resolve(ROOT, "pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.json"), "utf8"))
  const typed = modules.componentDataset.PIXIU_COMPONENTS_DATASET
  assert.deepEqual(Object.keys(typed).sort(), Object.keys(json).sort())
})

test("committed source inventory counts and IDs reconcile", () => {
  const inventory = JSON.parse(readFileSync(resolve(ROOT, "data/ai-copilot/phase2/reports/source-inventory.json"), "utf8"))
  const items = inventory.items
  assert.equal(items.length, inventory.summary.total_sources_inventoried)
  assert.equal(new Set(items.map((item) => item.source_id)).size, items.length)
  assert.equal(items.filter((item) => item.disposition === "eligible").length, inventory.summary.eligible_candidates)
  assert.equal(items.filter((item) => item.disposition === "excluded").length, inventory.summary.excluded_candidates)
  assert.ok(items.filter((item) => item.disposition === "excluded").every((item) => Boolean(item.exclusion_reason)))
})

test("Phase 2 generator entrypoints are syntactically valid", () => {
  for (const path of [
    "scripts/copilot-dataset/bundle-helper.mjs",
    "scripts/copilot-dataset/inventory-sources.mjs",
    "scripts/copilot-dataset/split-by-family.mjs",
    "scripts/copilot-dataset/build-release-report.mjs",
    "scripts/copilot-dataset/record-schema-validator.mjs",
  ]) {
    execFileSync(process.execPath, ["--check", resolve(ROOT, path)], { cwd: ROOT, stdio: "pipe" })
  }
})

test("board resolver marks a seed/lesson board conflict instead of silently accepting it", () => {
  const result = resolveBoardContext({
    circuit: { parts: [{ id: "board", type: "esp32-devkit" }] },
    declaredBoard: "arduino-uno",
    defaultBoard: "arduino-uno",
    isBoardPart: (type) => ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].includes(type),
    circuitSource: "seed_circuit_board_component",
  })
  assert.equal(result.boardId, "esp32-devkit")
  assert.equal(result.conflict, true)
  assert.equal(result.resolution.explicit, true)
})

test("board resolver preserves explicit lesson metadata when no board is in the seed", () => {
  const result = resolveBoardContext({
    circuit: { parts: [{ id: "led", type: "led" }] },
    declaredBoard: "rpi-pico",
    defaultBoard: "arduino-uno",
    isBoardPart: (type) => ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].includes(type),
  })
  assert.equal(result.boardId, "rpi-pico")
  assert.equal(result.conflict, false)
  assert.equal(result.resolution.source, "lesson_metadata")
  assert.equal(result.resolution.used_fallback, false)
})

test("board resolver labels implicit fallback instead of claiming explicit context", () => {
  const result = resolveBoardContext({
    circuit: { parts: [{ id: "led", type: "led" }] },
    defaultBoard: "arduino-uno",
    isBoardPart: (type) => ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].includes(type),
  })
  assert.equal(result.boardId, "arduino-uno")
  assert.equal(result.resolution.explicit, false)
  assert.equal(result.resolution.used_fallback, true)
})

test("lesson-engine exports the Arduino-only source list separately from aggregate LESSONS", async () => {
  const modules = await getBundledModules()
  const { lessons, esp32, pico, microbit } = modules
  assert.ok(Array.isArray(lessons.UNO_LESSONS))
  assert.ok(lessons.UNO_LESSONS.length > 0)

  const specialisedIds = new Set([
    ...(esp32.ESP32_LESSONS || []).map((lesson) => lesson.id),
    ...(pico.PICO_LESSONS || []).map((lesson) => lesson.id),
    ...(microbit.MICROBIT_LESSONS || []).map((lesson) => lesson.id),
  ])
  assert.ok(lessons.UNO_LESSONS.every((lesson) => !specialisedIds.has(lesson.id)))
  assert.ok((lessons.LESSONS || []).length >= lessons.UNO_LESSONS.length)
})
