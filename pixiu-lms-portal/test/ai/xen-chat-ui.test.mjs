import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal.example/xen' });
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  DOMParser: window.DOMParser,
  Element: window.Element,
});
window.HTMLElement.prototype.scrollIntoView = () => {};

const src = fileURLToPath(new URL('../../src', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `
      export { createElement } from 'react';
      export { createRoot } from 'react-dom/client';
      export { XenChat } from './components/xen/XenChat.jsx';
      export { CircuitCopilotChat } from './components/circuit-lab/circuit-copilot-chat.tsx';
    `,
    resolveDir: src,
  },
  alias: { '@': src },
  jsx: 'automatic',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' },
});

const { createElement: h, createRoot, XenChat, CircuitCopilotChat } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`
);

async function until(check, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out. Visible text: ' + document.body.textContent.slice(-500));
    }
    await new Promise((r) => setTimeout(r, 15));
  }
}

test('XenChat - student role initializes valid select option matching rendered options', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const p = new URL(url, 'https://portal.example').pathname;
    if (p.endsWith('/xen/status')) {
      return Response.json({ status: 'ok', worker_online: true, active_worker_count: 1, queued_jobs: 0 });
    }
    return Response.json({ csrfToken: 'c' });
  };
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(h(XenChat, { userRole: 'student' }));
    await until(() => document.querySelector('#intent-select'));
    const select = document.querySelector('#intent-select');
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    assert.equal(optionValues.includes('TEACHING'), true, `Expected TEACHING option, got [${optionValues}]`);
    assert.equal(select.value, 'TEACHING');
  } finally {
    root.unmount();
    globalThis.fetch = origFetch;
  }
});

test('XenChat - Retry after Cancel clears cancelled placeholder and keeps history clean', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const origFetch = globalThis.fetch;
  const chatRequests = [];
  let attempt = 0;

  globalThis.fetch = async (url, options = {}) => {
    const p = new URL(url, 'https://portal.example').pathname;
    if (p.endsWith('/xen/status')) return Response.json({ status: 'ok', worker_online: true, active_worker_count: 1 });
    if (p.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'c' });
    if (p.endsWith('/auth/refresh/')) return Response.json({ access: 'tok' });
    if (p.endsWith('/xen/chat')) {
      attempt++;
      chatRequests.push(JSON.parse(options.body));
      if (attempt === 1) {
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return Response.json({
        status: 'completed',
        intent: 'TEACHING',
        format_mode: 'DEFAULT_EDUCATIONAL',
        response: { text: 'Retried tutor answer.', is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
      });
    }
    return Response.json({});
  };

  window.sessionStorage.setItem('pixiu_session_role', 'trainer');
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(h(XenChat, { userRole: 'trainer' }));
    await until(() => document.querySelector('textarea'));
    const ta = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;
    setter.call(ta, 'Explain loops');
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => {
      const sendBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send'));
      return sendBtn && !sendBtn.disabled;
    });
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send')).click();
    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Cancel')));
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Cancel')).click();
    await until(() => document.body.textContent.includes('Generation cancelled by user.'));

    // Click Retry -> should succeed and replace the cancelled notice
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Retry')).click();
    await until(() => document.body.textContent.includes('Retried tutor answer.'));
    assert.equal(document.body.textContent.includes('Generation cancelled by user.'), false);

    // Send a second question and check history has single user+assistant pair (not duplicated cancelled user turns)
    setter.call(ta, 'Give example');
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Send') && !b.disabled));
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send')).click();
    await until(() => chatRequests.length === 3);
    assert.deepEqual(
      chatRequests[2].history.map((m) => m.role),
      ['user', 'assistant']
    );
  } finally {
    root.unmount();
    globalThis.fetch = origFetch;
  }
});

test('CircuitCopilotChat - offline GPU worker falls back quickly to local diagnosis and renders stale revision notice', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const p = new URL(url, 'https://portal.example').pathname;
    if (p.endsWith('/xen/chat')) {
      return Response.json({ status: 'queued', job_id: 'offline-job', worker_available: false, queue_position: 1 }, { status: 202 });
    }
    if (p.includes('/chunks')) {
      return Response.json({ status: 'queued', worker_available: false, queue_position: 1, chunks: [] });
    }
    return Response.json({});
  };

  const parts = [
    { id: 'uno1', type: 'arduino-uno', x: 40, y: 110, rotation: 0, props: {} },
    { id: 'r1', type: 'resistor', x: 220, y: 110, rotation: 0, props: { resistance: 220 } },
    { id: 'led1', type: 'led', x: 340, y: 110, rotation: 0, props: { color: 'red' } },
  ];
  const wires = [
    { id: 'w1', from: { partId: 'uno1', pinId: '5v' }, to: { partId: 'r1', pinId: 'a' }, color: 'red' },
    { id: 'w2', from: { partId: 'r1', pinId: 'b' }, to: { partId: 'led1', pinId: 'anode' }, color: 'red' },
  ];
  const circuit1 = { parts, wires };
  const circuit2 = {
    parts,
    wires: [...wires, { id: 'w3', from: { partId: 'led1', pinId: 'cathode' }, to: { partId: 'uno1', pinId: 'gnd1' }, color: 'black' }],
  };

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(
      h(CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: circuit1,
        currentBlocklyXml: '<xml/>',
        userRole: 'trainer',
        offlineTimeoutMs: 100,
      })
    );
    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Diagnose Circuit')));
    const t0 = Date.now();
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Diagnose Circuit')).click();
    await until(() => document.body.textContent.includes('Local circuit guidance') && document.body.textContent.includes('Apply Fix to Canvas'), 2500);
    assert.equal(Date.now() - t0 < 2000, true);
    assert.equal(document.body.textContent.includes('GPU worker offline'), true);

    // Mutate circuit revision while repair card is still shown -> disabled state + stale notice
    root.render(
      h(CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: circuit2,
        currentBlocklyXml: '<xml/>',
        userRole: 'trainer',
        offlineTimeoutMs: 100,
      })
    );
    await until(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Apply Fix to Canvas'));
      return btn && btn.disabled;
    });
    const applyBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Apply Fix to Canvas'));
    assert.equal(applyBtn.className.includes('disabled:opacity-50'), true);
    assert.equal(document.body.textContent.includes('Canvas changed since this diagnosis'), true);
  } finally {
    root.unmount();
    globalThis.fetch = origFetch;
  }
});
