#!/usr/bin/env node

const baseUrl = process.env.E2E_BASE_URL
const portalUrl = process.env.E2E_PORTAL_URL
const apiUrl = process.env.E2E_API_URL

if (!baseUrl || !portalUrl || !apiUrl) {
  console.error("Set E2E_BASE_URL, E2E_PORTAL_URL and E2E_API_URL.")
  process.exit(2)
}

const join = (base, path) => String(base).replace(/\/+$/, "") + "/" + String(path).replace(/^\/+/, "")

async function expectOk(url, label, options) {
  const response = await fetch(url, options || {})
  if (!response.ok) {
    const body = await response.text()
    throw new Error(label + " failed: HTTP " + response.status + " " + body.slice(0, 500))
  }
  return response
}

async function expectStatus(url, expected, label, options) {
  const response = await fetch(url, options || {})
  if (response.status !== expected) {
    const body = await response.text()
    throw new Error(label + " expected HTTP " + expected + ", got " + response.status + ": " + body.slice(0, 500))
  }
  return response
}

async function main() {
  await expectOk(join(baseUrl, "/"), "Public website")
  await expectOk(join(portalUrl, "/simulation"), "Portal Virtual Lab")
  const health = await expectOk(join(apiUrl, "/health/"), "Django v1 health")
  const payload = await health.json()
  if (payload.status !== "ok" || payload.version !== "v1") throw new Error("Django health contract is not v1/{status: ok}")

  await expectStatus(join(apiUrl, "/public/enquiries"), 400, "Django public enquiry validation", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ school: "", person: "", phone: "", email: "", website: "" }),
  })

  const legacy = await fetch(join(baseUrl, "/api/enquiry"), { redirect: "follow" })
  const legacyType = legacy.headers.get("content-type") || ""
  if (!legacyType.includes("text/html")) throw new Error("Legacy /api/enquiry endpoint still appears active: HTTP " + legacy.status + " " + legacyType)

  if (process.env.E2E_USERNAME && process.env.E2E_PASSWORD) {
    const login = await expectOk(join(apiUrl, "/auth/login/"), "Django v1 login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: process.env.E2E_USERNAME, password: process.env.E2E_PASSWORD, role: process.env.E2E_ROLE || "admin" }),
    })
    const loginPayload = await login.json()
    if (!loginPayload.access || !loginPayload.refresh || !loginPayload.user) throw new Error("Django login contract is incomplete")
    await expectOk(join(apiUrl, "/auth/me/"), "Django v1 auth/me", {
      headers: { Accept: "application/json", Authorization: "Bearer " + loginPayload.access },
    })
  }

  console.log("PIXIU Phase 8 production release gate PASSED")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})