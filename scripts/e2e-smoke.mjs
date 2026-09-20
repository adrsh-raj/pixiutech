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

async function checkPublicRoutes(baseUrl) {
  const routes = ['/', '/solutions', '/faq', '/careers', '/contact', '/verify', '/privacy', '/terms', '/robots.txt', '/sitemap.xml'];
  for (const route of routes) {
    const response = await fetch(joinUrl(baseUrl, route), { redirect: 'follow' });
    if (!response.ok) {
      throw new Error('Public route ' + route + ' failed: HTTP ' + response.status);
    }
  }

  const missing = await fetch(joinUrl(baseUrl, '/this-route-should-404'), { redirect: 'follow' });
  const missingType = missing.headers.get('content-type') || '';
  if (!missing.ok || !missingType.includes('text/html')) {
    throw new Error('SPA fallback for an unknown route did not return the public HTML shell.');
  }
  console.log('Public route smoke checks passed: ' + (routes.length + 1) + ' paths');
}

async function checkPublicFormValidation(baseUrl, apiBaseUrl) {
  const enquiry = await fetch(joinUrl(baseUrl, '/api/enquiry'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ school: '', person: '', phone: '', email: '', website: '' }),
  });
  if (enquiry.status < 400 || enquiry.status >= 500) {
    throw new Error('Public enquiry validation returned unexpected HTTP ' + enquiry.status + '.');
  }

  const career = await fetch(joinUrl(apiBaseUrl, '/public/careers/apply'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: (() => {
      const form = new FormData();
      form.set('name', 'Smoke Test');
      form.set('email', 'smoke@example.com');
      form.set('phone', '9876543210');
      form.set('cover_message', '');
      form.set('website', '');
      return form;
    })(),
  });
  if (career.status < 400 || career.status >= 500) {
    throw new Error('Career form validation returned unexpected HTTP ' + career.status + '.');
  }
  console.log('Public form validation smoke checks passed');
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
    await checkPublicRoutes(baseUrl);
  }

  if (baseUrl && apiUrl && process.env.E2E_TEST_FORMS === '1') {
    await checkPublicFormValidation(baseUrl, apiUrl);
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
