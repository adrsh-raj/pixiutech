#!/usr/bin/env node
import { mkdir } from "node:fs/promises"
import { chromium } from "playwright"

const baseUrl = (process.env.CYBERLAB_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "")
const artifactDir = process.env.CYBERLAB_ARTIFACT_DIR || "artifacts/cyberlab-browser"
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
})

try {
  const context = await browser.newContext({ permissions: ["camera", "microphone"] })
  await context.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    const json = (value) => new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input?.url || ""
      if (url.includes("/auth/csrf/")) return json({ csrfToken: "browser-gate-csrf" })
      if (url.includes("/auth/refresh/")) return json({ access: "browser-gate-access", refresh: "browser-gate-refresh" })
      if (url.includes("/auth/me/")) return json({ user: { id: "browser-gate", username: "browser-gate", role: "admin", name: "Browser Gate" } })
      return nativeFetch(input, init)
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  const pageErrors = []
  const consoleErrors = []
  const failedRequests = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("requestfailed", (request) => failedRequests.push(request.url() + " :: " + (request.failure()?.errorText || "request failed")))
  await mkdir(artifactDir, { recursive: true })

  await page.goto(baseUrl + "/simulation", { waitUntil: "networkidle" })
  if (!(await page.title()).includes("PIXIU CYBERLAB")) throw new Error("Virtual Lab route did not load")

  // Template → Blockly
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByRole("button", { name: /Templates/ }).click()
  await page.locator("h3").filter({ hasText: "Arduino Blink with 220Ω Resistor" }).click()
  await page.getByRole("button", { name: "Code" }).click()
  const blink = await page.locator("body").innerText()
  if (!/void setup\(\)/.test(blink) || !/digitalWrite|HIGH|LOW/.test(blink)) {
    throw new Error("Blink template did not hydrate Blockly/code")
  }
  await page.screenshot({ path: artifactDir + "/simulation-template.png", fullPage: true })

  // AI template → AI Blockly → automatic Pixiu runtime HUD
  await page.getByRole("button", { name: "Circuit" }).click()
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByRole("button", { name: /Templates/ }).click()
  await page.locator("h3").filter({ hasText: "AI Vision Smart Boom Barrier Gate" }).click()
  await page.getByRole("button", { name: "Code" }).click()
  const aiCodeView = await page.locator("body").innerText()
  if (!/AI sees/.test(aiCodeView) || !/car/i.test(aiCodeView)) {
    throw new Error("AI template Blockly did not hydrate")
  }

  await page.getByRole("button", { name: "Circuit" }).click()
  await page.getByRole("button", { name: "Run" }).click()
  await page.getByText("PIXIU AI VISION", { exact: true }).waitFor()
  if ((await page.locator("video").count()) < 1) throw new Error("AI camera video element did not mount")
  await page.getByText("PIXIU AI ACTIVE", { exact: true }).waitFor()

  // Pose browser lifecycle
  await page.getByRole("button", { name: "Stop" }).click()
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByText("AI Studio", { exact: true }).click()
  await page.getByText("Pose", { exact: true }).click()
  await page.getByRole("button", { name: "Start camera" }).click()
  await page.getByText("6C Pose ready", { exact: true }).waitFor()

  await page.getByText("Fingers", { exact: true }).click()
  await page.getByRole("button", { name: "Start camera" }).click()
  await page.getByText("6D Fingers ready", { exact: true }).waitFor()

  await page.getByText("Emotion", { exact: true }).click()
  await page.getByRole("button", { name: "Start camera" }).click()
  await page.getByText("6E Emotion ready", { exact: true }).waitFor()

  // Separate portal AI Studio route.
  await page.goto(baseUrl + "/ai-studio", { waitUntil: "networkidle" })
  if (!(await page.title()).includes("PIXIU AI STUDIO")) throw new Error("Standalone AI Studio route did not load")
  await page.getByText("PIXIU AI STUDIO", { exact: true }).first().waitFor()
  await page.screenshot({ path: artifactDir + "/ai-studio.png", fullPage: true })

  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join(" | "))
  if (consoleErrors.length) throw new Error("Browser console errors: " + consoleErrors.join(" | "))
  if (failedRequests.length) throw new Error("Browser request failures: " + failedRequests.join(" | "))
  console.log("PIXIU CyberLab browser gate PASSED")
 } finally {
  await browser.close()
}
