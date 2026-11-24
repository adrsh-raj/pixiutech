// Run with a local portal at /simulation. Every API request is isolated from production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)('playwright');
const origin = process.env.PORTAL_TEST_ORIGIN || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Local portal required');
const output = process.env.BROWSER_EVIDENCE_DIR;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
try {
  for (const [width, height] of [[1366,768], [1440,900], [1280,720], [375,812]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(() => {
      sessionStorage.setItem('pixiu_session_role', 'trainer');
      localStorage.setItem('pixiu-virtual-lab-launchpad-v2', 'seen');
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/api/')) {
        let body = {};
        if (url.pathname.endsWith('/auth/csrf/')) body = {csrfToken:'fixture'};
        if (url.pathname.endsWith('/auth/refresh/')) body = {access:'fixture'};
        if (url.pathname.endsWith('/auth/me/')) body = {user:{id:102,role:'trainer',status:'active'}};
        return route.fulfill({json:body});
      }
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + '/simulation');
    await page.getByLabel('Open 8square AI Circuit Copilot').click();
    const panel = page.getByLabel('8square Circuit Copilot Panel');
    await panel.waitFor();
    assert.equal(new URL(page.url()).pathname, '/simulation');
    if (output) await page.screenshot({path:output + '/panel-' + width + '.png'});
    const header = await panel.locator('header').boundingBox();
    await page.mouse.move(header.x + 18, header.y + 12);
    await page.mouse.down();
    await page.mouse.move(0, 0, {steps:5});
    await page.mouse.up();
    const box = await panel.boundingBox();
    assert.equal(Math.round(box.x), 8);
    assert.equal(Math.round(box.y), 8);
    await panel.getByLabel('Minimize 8square Window').click();
    await page.getByLabel('Expand 8square Window').click();
    assert.equal(Math.round((await panel.boundingBox()).x), 8);
    await panel.getByLabel('Close 8square Panel').click();
    await page.getByLabel('Open 8square AI Circuit Copilot').waitFor();
    await page.close();
  }
} finally {
  await browser.close();
}
