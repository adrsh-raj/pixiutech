#!/usr/bin/env node
import assert from "node:assert/strict"
import { chromium } from "playwright"

const baseUrl = (process.env.CYBERLAB_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "")
const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
})
const failures = []
const PROGRAM_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="io_digitalwrite">
        <field name="PIN">13</field>
        <field name="STATE">HIGH</field>
        <next><block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block></next>
      </block>
    </statement>
  </block>
</xml>`
const PROGRAM_CHANGED_XML = PROGRAM_XML
  .replace('<field name="STATE">HIGH</field>', '<field name="STATE">LOW</field>')
  .replace('<field name="NUM">1000</field>', '<field name="NUM">1500</field>')
const MALFORMED_XML = '<xml><block type="arduino_program"><statement name="LOOP">'

async function makePage() {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, permissions: ["camera", "microphone"] })
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } })
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || ""
      if (url.includes("/auth/csrf/")) return json({ csrfToken: "blockly-e2e-csrf" })
      if (url.includes("/auth/refresh/")) return json({ access: "blockly-e2e-access", refresh: "blockly-e2e-refresh" })
      if (url.includes("/auth/me/")) return json({ user: { id: "blockly-e2e", username: "blockly-e2e", role: "admin", name: "Blockly E2E" } })
      if (url.includes("/api/v1/") || url.includes("onrender.com")) return json([])
      return nativeFetch(input, init)
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.on("dialog", (dialog) => void dialog.accept())
  await page.goto(baseUrl + "/simulation", { waitUntil: "networkidle" })
  assert.match(await page.title(), /PIXIU CYBERLAB/i, "CyberLab route must render")
  const closeWelcome = page.getByRole("button", { name: "Close welcome" })
  if (await closeWelcome.isVisible().catch(() => false)) await closeWelcome.click()
  await page.getByRole("button", { name: "Code", exact: true }).click()
  await page.locator(".pixiu-blockly-host").waitFor({ state: "visible" })
  await page.waitForFunction(() => Boolean(window.__PIXIU_BLOCKLY_E2E__))
  await page.waitForFunction(() => window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()?.blocks.some((block) => block.type === "arduino_program"))
  return { context, page }
}
async function api(page, method, ...args) {
  return page.evaluate(({ method, args }) => {
    const bridge = window.__PIXIU_BLOCKLY_E2E__
    if (!bridge || typeof bridge[method] !== "function") throw new Error("Missing E2E bridge method: " + method)
    return bridge[method](...args)
  }, { method, args })
}
async function loadXml(page, xml) {
  await api(page, "setXml", xml)
  await page.waitForFunction(() => {
    const state = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    const ws = window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()
    return Boolean(state && ws && ws.blocks.some((block) => block.type === "io_digitalwrite") && ws.blocks.some((block) => block.type === "time_delay"))
  })
  await page.waitForTimeout(150)
}
async function runCase(name, run) {
  let context, page
  try {
    ({ context, page } = await makePage())
    await run(page)
    console.log("PASS " + name)
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    failures.push({ name, message })
    console.error("FAIL " + name + "\n" + message)
    try { if (page) await page.screenshot({ path: "/tmp/blockly-e2e-failure-" + failures.length + ".png", fullPage: true }) } catch {}
  } finally {
    await context?.close()
  }
}
async function blockLocator(page, block) {
  if (block.dataId) {
    const loc = page.locator('.blocklyBlockCanvas .blocklyDraggable[data-id="' + block.dataId + '"]')
    if (await loc.count()) return loc.first()
  }
  if (block.svgId) return page.locator('[id="' + block.svgId + '"]')
  throw new Error("Block has no SVG selector: " + block.type + "/" + block.id)
}
async function dragBetween(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + (to.x - from.x) * 0.25, from.y + (to.y - from.y) * 0.25, { steps: 4 })
  await page.mouse.move(from.x + (to.x - from.x) * 0.55, from.y + (to.y - from.y) * 0.55, { steps: 5 })
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.waitForTimeout(100)
  await page.mouse.up()
  await page.waitForTimeout(350)
}
async function connectionPoint(page, block, connectionName) {
  const point = await api(page, "connectionPoint", block.id, connectionName)
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), "Could not locate " + connectionName + " on " + block.type)
  return point
}
async function dragConnection(page, block, sourceConnectionName, targetPoint) {
  const locator = await blockLocator(page, block)
  const box = await locator.boundingBox()
  assert.ok(box && box.width > 0 && box.height > 0, "Dragged block must be visible")
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const source = await connectionPoint(page, block, sourceConnectionName)
  await dragBetween(page, start, { x: start.x + targetPoint.x - source.x, y: start.y + targetPoint.y - source.y })
}

await runCase("1/7 workspace loads and real Blockly blocks visibly render", async (page) => {
  const ws = await api(page, "workspaceSnapshot")
  assert.ok(ws.blockCount > 0)
  assert.ok(ws.blocks.some((block) => block.type === "arduino_program"))
  const rendered = page.locator(".blocklyBlockCanvas .blocklyDraggable")
  assert.ok(await rendered.count() > 0, "Workspace SVG must render block elements")
  const box = await rendered.first().boundingBox()
  assert.ok(box && box.width > 0 && box.height > 0, "A rendered block needs visible geometry")
})

await runCase("2/7 pointer drag/drop, statement connect/disconnect and Delete", async (page) => {
  await loadXml(page, PROGRAM_XML)
  const before = await api(page, "workspaceSnapshot")
  const delay = before.blocks.find((block) => block.type === "time_delay")
  const write = before.blocks.find((block) => block.type === "io_digitalwrite")
  assert.ok(delay && write)
  const host = await page.locator(".pixiu-blockly-host").boundingBox()
  assert.ok(host && host.width > 300 && host.height > 300)
  const delayLoc = await blockLocator(page, delay)
  const box = await delayLoc.boundingBox()
  assert.ok(box)
  const free = { x: host.x + host.width - 55, y: host.y + host.height - 70 }
  await dragBetween(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, free)
  await page.waitForFunction((id) => window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()?.blocks.some((block) => block.id === id && block.parentId === null), delay.id)
  let ws = await api(page, "workspaceSnapshot")
  let writeLive = ws.blocks.find((block) => block.id === write.id)
  let delayLive = ws.blocks.find((block) => block.id === delay.id)
  assert.ok(delayLive && writeLive && delayLive.parentId === null, "Dragging should disconnect the statement")
  await dragConnection(page, delayLive, "previousConnection", await connectionPoint(page, writeLive, "nextConnection"))
  await page.waitForFunction(({ id, parent }) => window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()?.blocks.some((block) => block.id === id && block.parentId === parent), { id: delay.id, parent: write.id })
  ws = await api(page, "workspaceSnapshot")
  delayLive = ws.blocks.find((block) => block.id === delay.id)
  assert.equal(delayLive?.parentId, write.id, "Pointer drop on nextConnection should reconnect statements")
  const reconnectedLoc = await blockLocator(page, delayLive)
  const reconnectedBox = await reconnectedLoc.boundingBox()
  assert.ok(reconnectedBox)
  await dragBetween(page, { x: reconnectedBox.x + reconnectedBox.width / 2, y: reconnectedBox.y + reconnectedBox.height / 2 }, free)
  await page.waitForFunction((id) => window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()?.blocks.some((block) => block.id === id && block.parentId === null), delay.id)
  const detached = (await api(page, "workspaceSnapshot")).blocks.find((block) => block.id === delay.id)
  const detachedLoc = await blockLocator(page, detached)
  await detachedLoc.click({ position: { x: 15, y: 12 } })
  await page.keyboard.press("Delete")
  await page.waitForFunction((id) => !window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()?.blocks.some((block) => block.id === id), delay.id)
  assert.equal((await api(page, "workspaceSnapshot")).blocks.some((block) => block.type === "time_delay"), false)
})

await runCase("3/7 project save/reload preserves exact Blockly XML round-trip", async (page) => {
  await loadXml(page, PROGRAM_XML)
  await page.waitForFunction(() => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    const w = window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()
    return Boolean(s && w && s.blocklyXml === w.xml)
  })
  const savedXml = (await api(page, "workspaceSnapshot")).xml
  const projectName = "Blockly E2E Round Trip " + Date.now()
  await page.getByTitle("Projects: save, load, import and export").click()
  const dialog = page.getByRole("dialog", { name: "Project manager" })
  await dialog.waitFor({ state: "visible" })
  await dialog.getByText("Project name", { exact: true }).locator("xpath=following-sibling::input").fill(projectName)
  await dialog.getByRole("button", { name: "Save", exact: true }).click()
  await dialog.getByText(projectName, { exact: true }).waitFor()
  await dialog.getByRole("button", { name: "Done", exact: true }).click()
  await page.reload({ waitUntil: "networkidle" })
  const closeWelcome = page.getByRole("button", { name: "Close welcome" })
  if (await closeWelcome.isVisible().catch(() => false)) await closeWelcome.click()
  await page.getByRole("button", { name: "Code", exact: true }).click()
  await page.locator(".pixiu-blockly-host").waitFor({ state: "visible" })
  await page.waitForFunction(() => Boolean(window.__PIXIU_BLOCKLY_E2E__))
  await page.getByTitle("Projects: save, load, import and export").click()
  const reloadedDialog = page.getByRole("dialog", { name: "Project manager" })
  const card = reloadedDialog.locator("div.group").filter({ hasText: projectName })
  await card.getByRole("button", { name: "Open", exact: true }).click()
  await reloadedDialog.waitFor({ state: "hidden" })
  await page.waitForFunction((expected) => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    const w = window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()
    return Boolean(s && w && s.blocklyXml === expected && w.xml === expected)
  }, savedXml)
  assert.equal((await api(page, "workspaceSnapshot")).xml, savedXml)
})

async function makeLedProposal(page, ledId) {
  const before = await api(page, "snapshot")
  const next = JSON.parse(JSON.stringify(before.circuit))
  next.parts.push({ id: ledId, type: "led", x: 140, y: 100, rotation: 0, props: { color: "red" } })
  await api(page, "captureProposal", PROGRAM_CHANGED_XML, next)
  return api(page, "stageCapturedProposal")
}

await runCase("4/7 Copilot Circuit Apply atomically synchronizes circuit and Blockly XML", async (page) => {
  await loadXml(page, PROGRAM_XML)
  assert.deepEqual(await makeLedProposal(page, "e2e-led-apply"), { valid: true, stale: false, staged: true })
  assert.equal(await api(page, "applyCapturedProposal"), true)
  await page.waitForFunction(() => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    return Boolean(s && s.circuit.parts.some((part) => part.id === "e2e-led-apply") &&
      s.blocklyXml.includes('name="STATE">LOW') && s.blocklyXml.includes('name="NUM">1500'))
  })
  assert.ok((await api(page, "workspaceSnapshot")).blocks.some((block) => block.type === "io_digitalwrite" && block.fields.STATE === "LOW"))
})

await runCase("5/7 toolbar Undo/Redo restores circuit and Blockly as one document", async (page) => {
  await loadXml(page, PROGRAM_XML)
  assert.equal((await makeLedProposal(page, "e2e-led-history")).staged, true)
  assert.equal(await api(page, "applyCapturedProposal"), true)
  await page.waitForFunction(() => window.__PIXIU_BLOCKLY_E2E__?.snapshot().circuit.parts.some((part) => part.id === "e2e-led-history"))
  const undo = page.getByRole("button", { name: "Undo circuit and Blockly" })
  await undo.waitFor({ state: "visible" })
  assert.equal(await undo.isDisabled(), false)
  await undo.click()
  await page.waitForFunction(() => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    return Boolean(s && !s.circuit.parts.some((part) => part.id === "e2e-led-history") &&
      s.blocklyXml.includes('name="STATE">HIGH') && s.blocklyXml.includes('name="NUM">1000'))
  })
  const redo = page.getByRole("button", { name: "Redo circuit and Blockly" })
  await redo.waitFor({ state: "visible" })
  assert.equal(await redo.isDisabled(), false)
  await redo.click()
  await page.waitForFunction(() => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    return Boolean(s && s.circuit.parts.some((part) => part.id === "e2e-led-history") &&
      s.blocklyXml.includes('name="STATE">LOW') && s.blocklyXml.includes('name="NUM">1500'))
  })
  assert.ok((await api(page, "workspaceSnapshot")).blocks.some((block) => block.type === "io_digitalwrite" && block.fields.STATE === "LOW"))
})

await runCase("6/7 staged stale proposal cannot overwrite a newer workspace edit", async (page) => {
  await loadXml(page, PROGRAM_XML)
  assert.equal((await makeLedProposal(page, "e2e-stale-led")).staged, true)
  const manualXml = PROGRAM_XML.replace('<field name="NUM">1000</field>', '<field name="NUM">1750</field>')
  await api(page, "setXml", manualXml)
  await page.waitForFunction(() => window.__PIXIU_BLOCKLY_E2E__?.snapshot().blocklyXml.includes('name="NUM">1750'))
  assert.equal(await api(page, "applyCapturedProposal"), false)
  await page.waitForFunction(() => window.__PIXIU_BLOCKLY_E2E__?.snapshot().copilotState === "rejected")
  const after = await api(page, "snapshot")
  assert.equal(after.circuit.parts.some((part) => part.id === "e2e-stale-led"), false)
  assert.ok(after.blocklyXml.includes('name="NUM">1750'))
  assert.ok((await api(page, "workspaceSnapshot")).xml.includes('name="NUM">1750'))
})

await runCase("7/7 malformed XML is rejected, prior workspace preserved, accessible error shown", async (page) => {
  await loadXml(page, PROGRAM_XML)
  await page.waitForFunction(() => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    const w = window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()
    return Boolean(s && w && s.blocklyXml === w.xml)
  })
  const before = await api(page, "workspaceSnapshot")
  const priorXml = before.xml
  const priorTypes = before.blocks.map((block) => block.type).sort()
  await api(page, "setXml", MALFORMED_XML)
  const alert = page.getByRole("alert").filter({ hasText: /previous workspace was preserved/i })
  await alert.waitFor({ state: "visible" })
  assert.ok((await alert.innerText()).trim().length > 30)
  await alert.getByRole("button", { name: "Dismiss Blockly XML error" }).waitFor({ state: "visible" })
  await page.waitForFunction((expected) => {
    const s = window.__PIXIU_BLOCKLY_E2E__?.snapshot()
    const w = window.__PIXIU_BLOCKLY_E2E__?.workspaceSnapshot()
    return Boolean(s && w && s.blocklyXml === expected && w.xml === expected)
  }, priorXml)
  const after = await api(page, "workspaceSnapshot")
  assert.deepEqual(after.blocks.map((block) => block.type).sort(), priorTypes)
  assert.equal(after.xml, priorXml)
})

await browser.close()
if (failures.length) {
  console.error("\nDedicated Blockly browser acceptance failed: " + failures.length + "/7")
  for (const failure of failures) console.error("- " + failure.name)
  process.exitCode = 1
} else {
  console.log("\nAll seven dedicated Blockly browser acceptance scenarios passed.")
}
