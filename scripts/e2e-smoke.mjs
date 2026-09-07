#!/usr/bin/env node

const baseUrl = process.env.E2E_BASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL;
const apiUrl = process.env.E2E_API_URL;

if (!baseUrl && !apiUrl) {
  console.error("Set E2E_BASE_URL and/or E2E_API_URL.");
  process.exit(2);
}

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function assertOk(url, label, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed: HTTP ${response.status} ${body.slice(0, 500)}`);
  }
  return response;
}

async function checkFrontendOrApiTarget(url) {
  const response = await assertOk(url, "Deployment target");
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    if (payload.status !== "ok") {
      throw new Error(`Deployment target returned unexpected JSON: ${JSON.stringify(payload)}`);
    }
    console.log(`Django deployment smoke test passed: ${url}`);
    return "api";
  }

  const html = await response.text();
  if (!/<html[\s>]/i.test(html) || !/(<script|root)/i.test(html)) {
    throw new Error("Deployment target is neither a recognizable Vite HTML app nor the Django health JSON endpoint.");
  }
  console.log(`Frontend deployment smoke test passed: ${url}`);
  return "frontend";
}

try {
  if (baseUrl) {
    await checkFrontendOrApiTarget(baseUrl);
  }

  if (apiUrl) {
    const health = await assertOk(joinUrl(apiUrl, "health/"), "Django health endpoint", {
      headers: { Accept: "application/json" },
    });
    const payload = await health.json();
    if (payload.status !== "ok") {
      throw new Error(`Django health endpoint returned unexpected payload: ${JSON.stringify(payload)}`);
    }
    console.log(`Django health smoke test passed: ${joinUrl(apiUrl, "health/")}`);

    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    const role = process.env.E2E_ROLE || "admin";
    if (username && password) {
      const login = await assertOk(joinUrl(apiUrl, "auth/login/"), "Django login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const loginPayload = await login.json();
      if (!loginPayload.access || !loginPayload.refresh || !loginPayload.user) {
        throw new Error("Login response is missing access, refresh, or user payload.");
      }

      const me = await assertOk(joinUrl(apiUrl, "auth/me/"), "Django /auth/me", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${loginPayload.access}`,
        },
      });
      const mePayload = await me.json();
      if (!mePayload.username || mePayload.role !== role) {
        throw new Error(`Unexpected /auth/me response: ${JSON.stringify(mePayload)}`);
      }
      console.log(`Django authenticated smoke test passed for role: ${role}`);
    } else {
      console.log("Authenticated smoke test skipped: E2E_USERNAME/E2E_PASSWORD are not configured.");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
