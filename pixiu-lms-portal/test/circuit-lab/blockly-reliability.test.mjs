import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `blockly-reliability-${Date.now()}`)
await build({
  entryPoints: {
    history: new URL("../../src/lib/history.ts", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
})
const historyMod = await import(`file://${join(bundleDir, "history.js")}`)
const { createHistory, pushState, undo, redo, canUndo, canRedo } = historyMod

const workbenchPath = new URL("../../src/components/circuit-lab/workbench.tsx", import.meta.url)
const editorPath = new URL("../../src/components/circuit-lab/blockly-editor.tsx", import.meta.url)
const storagePath = new URL("../../src/lib/storage.ts", import.meta.url)
const xmlPath = new URL("../../src/lib/blockly-xml.ts", import.meta.url)
const copilotPath = new URL("../../src/components/circuit-lab/use-circuit-copilot-action.ts", import.meta.url)
const [workbench, editor, storage, xmlHelper, copilot] = await Promise.all([
  readFile(workbenchPath, "utf8"),
  readFile(editorPath, "utf8"),
  readFile(storagePath, "utf8"),
  readFile(xmlPath, "utf8"),
  readFile(copilotPath, "utf8"),
])

test("paired document history restores circuit and Blockly XML together", () => {
  const before = {
    circuit: { parts: [{ id: "led-before" }], wires: [] },
    blocklyXml: '<xml><block type="arduino_program"/></xml>',
  }
  const after = {
    circuit: { parts: [{ id: "led-after" }], wires: [] },
    blocklyXml: '<xml><block type="arduino_program"><statement name="DO"/></block></xml>',
  }
  const historyAfterApply = pushState(createHistory(before), after)
  assert.equal(canUndo(historyAfterApply), true)
  const undone = undo(historyAfterApply)
  assert.deepEqual(undone.present, before)
  assert.equal(canRedo(undone), true)
  assert.deepEqual(redo(undone).present, after)
})

test("Workbench keeps circuit and Blockly XML in the same history document", () => {
  assert.match(workbench, /HistoryState<WorkbenchDocument>/)
  assert.match(workbench, /const state = history\.present\.circuit/)
  assert.match(workbench, /const blocklyXml = history\.present\.blocklyXml/)
  assert.match(workbench, /blocklyXml: typeof nextBlocklyXml === "string" \? nextBlocklyXml : h\.present\.blocklyXml/)
  assert.match(workbench, /setHistory\(\(h\) => historyUndo\(h\)\)/)
  assert.match(workbench, /setHistory\(\(h\) => historyRedo\(h\)\)/)
})

test("Circuit Apply and template/lesson loads commit XML with circuit state", () => {
  assert.match(workbench, /updateState\(\(\) => newCircuit, typeof newBlocklyXml === "string" \? newBlocklyXml : undefined\)/)
  assert.match(workbench, /updateState\(\(\) => tmpl\.circuit, tmpl\.blocklyXml\)/)
  assert.match(workbench, /updateState\(\(\) => seed\.state, seed\.blocklyXml\)/)
  assert.match(copilot, /target\.baseRevisionHash !== currentHash/)
  assert.match(copilot, /onApplyCircuit\(validation\.normalizedCircuit, effectiveNextBlocklyXml\)/)
  assert.match(copilot, /expectedCurrentHash/)
})

test("Blockly keyboard shortcuts stay in Blockly instead of mutating the circuit", () => {
  assert.match(workbench, /eventTarget\?\.closest\("\.pixiu-blockly-host"\) \|\| activeEl\?\.closest\("\.pixiu-blockly-host"\)/)
})

test("malformed external Blockly XML is rejected before clear and has rollback/error UI", () => {
  const parseAt = editor.indexOf("parsedDom = parseWorkspaceXml(expectedExternalXml)")
  const clearAt = editor.indexOf("activeWorkspace.clear()", parseAt)
  assert.ok(parseAt >= 0 && clearAt > parseAt, "external XML must be parsed before clear()")
  assert.match(editor, /parseWorkspaceXml\(previousXml\)/)
  assert.match(editor, /role="alert"/)
  assert.match(editor, /The previous workspace was preserved/)
  assert.match(editor, /A safe empty Arduino Program was loaded instead/)
})

test("shared XML validator checks parser errors, root element, active tags and block types", () => {
  assert.match(xmlHelper, /new DOMParser\(\)\.parseFromString/)
  assert.match(xmlHelper, /parsererror/)
  assert.match(xmlHelper, /root\.tagName !== "xml"/)
  assert.match(xmlHelper, /forbiddenTags/)
  assert.match(xmlHelper, /knownBlockTypes/)
})

test("project import, save and export validate Blockly XML structure", () => {
  assert.match(storage, /validateBlocklyXmlEnvelope\(rawXml\)/)
  assert.equal((storage.match(/validateBlocklyXmlEnvelope\(blocklyXml\)/g) || []).length, 2)
  assert.match(storage, /blocklyXml: rawXml/)
  assert.match(storage, /blocklyXml,/)
})

test("Blockly drag/drop writes semantic events and suppresses UI-only changes", () => {
  assert.match(editor, /event && !event\.isUiEvent/)
  assert.match(editor, /onXmlChangeRef\.current\(text, \{ source: "workspace" \}\)/)
  assert.match(editor, /isDragging/)
  assert.match(editor, /pendingExternalXmlRef/)
})
