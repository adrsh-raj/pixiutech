#!/usr/bin/env node
import { chromium } from "playwright"

const baseUrl = (process.env.CYBERLAB_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "")
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
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  const pageErrors = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.goto(baseUrl + "/simulation", { waitUntil: "networkidle" })
  if (!(await page.title()).includes("PIXIU CYBERLAB")) throw new Error("Virtual Lab route did not load")

  // Template → Blockly
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByText("Templates", { exact: true }).click()
  await page.getByText("Arduino Blink with 220Ω Resistor", { exact: true }).click()
  await page.getByRole("button", { name: "Code" }).click()
  const blink = await page.locator("body").innerText()
  if (!/void setup\(\)/.test(blink) || !/digitalWrite|HIGH|LOW/.test(blink)) {
    throw new Error("Blink template did not hydrate Blockly/code")
  }

  // AI template → AI Blockly → automatic Pixiu runtime HUD
  await page.getByRole("button", { name: "Circuit" }).click()
  await page.getByRole("button", { name: "Tools" }).click()
  await page.getByText("Templates", { exact: true }).click()
  await page.getByText("AI Vision Smart Boom Barrier Gate (Pixiu AI)", { exact: false }).click()
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

  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join(" | "))
  console.log("PIXIU CyberLab browser gate PASSED")
} finally {
  await browser.close()
}
