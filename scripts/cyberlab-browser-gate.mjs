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
  const remoteAiRuntimeRequests = []
  page.on("request", (request) => {
    const url = request.url()
    if (/(tfhub\.dev|jsdelivr\.net|unpkg\.com|storage\.googleapis\.com)/i.test(url)) {
      const type = request.resourceType()
      if (type === "script" || type === "xhr" || type === "fetch" || type === "wasm") {
        remoteAiRuntimeRequests.push(url)
      }
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType()
    if (resourceType === "font") return
    failedRequests.push(request.url() + " [" + resourceType + "] :: " + (request.failure()?.errorText || "request failed"))
  })
  await mkdir(artifactDir, { recursive: true })

  await page.goto(baseUrl + "/simulation", { waitUntil: "networkidle" })
  if (!(await page.title()).includes("PIXIU CYBERLAB")) throw new Error("Virtual Lab route did not load")
  const welcomeClose = page.getByRole("button", { name: "Close welcome" })
  if (await welcomeClose.isVisible().catch(() => false)) {
    await welcomeClose.click()
  }

  // Template → Blockly
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByRole("menuitem", { name: /Templates/ }).click()
  await page.locator("h3").filter({ hasText: "Dual Alternating Police Strobe" }).click()
  await page.getByRole("button", { name: "Code" }).click()
  const blink = await page.locator("body").innerText()
  if (!/void setup\(\)/.test(blink) || !/digitalWrite|HIGH|LOW/.test(blink)) {
    throw new Error("Blink template did not hydrate Blockly/code")
  }
  await page.screenshot({ path: artifactDir + "/simulation-template.png", fullPage: true })

  // AI template → AI Blockly → automatic Pixiu runtime HUD
  await page.getByRole("button", { name: "Circuit" }).click()
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByRole("menuitem", { name: /Templates/ }).click()
  await page.locator("h3").filter({ hasText: "AI Vision Smart Boom Barrier Gate" }).click()
  await page.getByRole("button", { name: "Code" }).click()
  const aiCodeView = await page.locator("body").innerText()
  if (!/AI sees/.test(aiCodeView) || !/car/i.test(aiCodeView)) {
    throw new Error("AI template Blockly did not hydrate")
  }

  await page.getByRole("button", { name: "Circuit" }).click()
  await page.getByRole("button", { name: "Run" }).click()
  await page.getByText("PIXIU VISION CORE", { exact: true }).waitFor()
  if ((await page.locator("video").count()) < 1) throw new Error("AI camera video element did not mount")
  await page.getByText("LIVE FEED", { exact: true }).waitFor()

  // Object restart lifecycle
  await page.getByRole("button", { name: "Stop" }).click()
  await page.getByRole("button", { name: "Run" }).click()
  await page.getByText("LIVE FEED", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Stop" }).click()

  // Pose browser lifecycle
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByText("PIXIU AI Studio", { exact: true }).click()
  await page.getByText("Pose", { exact: true }).click()
  await page.getByRole("button", { name: "Turn On Camera" }).last().click()
  await page.getByText("6C Pose ready", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Turn Off Camera" }).last().click()
  await page.getByRole("button", { name: "Turn On Camera" }).last().click()
  await page.getByText("6C Pose ready", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Turn Off Camera" }).last().click()

  await page.getByText("Hands", { exact: true }).click()
  await page.getByRole("button", { name: "Turn On Camera" }).last().click()
  await page.getByText("6D Fingers ready", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Turn Off Camera" }).last().click()

  await page.getByText("Emotion", { exact: true }).click()
  await page.getByRole("button", { name: "Turn On Camera" }).last().click()
  await page.getByText("6E Emotion ready", { exact: true }).waitFor()
  await page.getByRole("button", { name: "Turn Off Camera" }).last().click()

  await page.getByText("Sound", { exact: true }).click()
  await page.getByRole("button", { name: "Turn On Microphone" }).last().click()
  await page.getByText(/6F Sound (ready|listening)/).waitFor()
  await page.getByRole("button", { name: "Turn Off Microphone" }).click()

  // Standalone portal AI Studio route + real My AI train/persist/predict flow.
  await page.goto(baseUrl + "/ai-studio", { waitUntil: "networkidle" })
  if (!(await page.title()).includes("PIXIU AI STUDIO")) throw new Error("Standalone AI Studio route did not load")
  await page.getByText("PIXIU AI STUDIO", { exact: true }).first().waitFor()

  const seededDataset = await page.evaluate(() => {
    const makeImage = (color) => {
      const canvas = document.createElement("canvas")
      canvas.width = 24
      canvas.height = 24
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Canvas is unavailable in browser gate.")
      context.fillStyle = color
      context.fillRect(0, 0, 24, 24)
      return canvas.toDataURL("image/png")
    }
    const classes = ["red", "blue"]
    const samples = classes.flatMap((label, classIndex) =>
      Array.from({ length: 3 }, (_, index) => ({
        id: label + "-" + index,
        label,
        dataUrl: makeImage(classIndex === 0 ? "#ef4444" : "#3b82f6"),
        createdAt: Date.now() + index,
      })),
    )
    localStorage.setItem("pixiu-ai-studio-v4", JSON.stringify({
      classes,
      samples,
      model: null,
    }))
    return samples.length
  })
  if (seededDataset !== 6) throw new Error("My AI browser dataset seed failed.")
  await page.reload({ waitUntil: "networkidle" })

  await page.getByText("Teach", { exact: true }).click()
  await page.getByRole("button", { name: "Train My AI", exact: true }).click()
  await page.getByText(/My AI learned 2 concepts/i).waitFor({ timeout: 90_000 })

  await page.getByText("Try", { exact: true }).click()
  const myAiButton = page.getByRole("button").filter({ hasText: /^My AI/i }).last()
  await myAiButton.click()
  await page.getByRole("button", { name: "Turn On Camera", exact: true }).last().click()
  await page.getByText("6I My AI ready", { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByRole("button", { name: "Turn Off Camera", exact: true }).last().click()

  await page.reload({ waitUntil: "networkidle" })
  await page.getByText("Try", { exact: true }).click()
  await page.getByRole("button").filter({ hasText: /^My AI/i }).last().click()
  await page.getByRole("button", { name: "Turn On Camera", exact: true }).last().click()
  await page.getByText("6I My AI ready", { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByRole("button", { name: "Turn Off Camera", exact: true }).click()

  await page.screenshot({ path: artifactDir + "/ai-studio.png", fullPage: true })

  if (remoteAiRuntimeRequests.length) throw new Error("AI runtime attempted a remote dependency: " + remoteAiRuntimeRequests.join(" | "))
  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join(" | "))
  if (consoleErrors.length) throw new Error("Browser console errors: " + consoleErrors.join(" | "))
  if (failedRequests.length) throw new Error("Browser request failures: " + failedRequests.join(" | "))
  if (remoteAiRuntimeRequests.length) {
    throw new Error("Runtime AI assets must stay same-origin; remote AI requests detected: " + remoteAiRuntimeRequests.join(" | "))
  }
  console.log("PIXIU CyberLab browser gate PASSED")
  console.log("Runtime AI origin policy · PASS")
 } finally {
  await browser.close()
}
