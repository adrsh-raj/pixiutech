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
      export { XenMarkdown } from './components/xen/XenMarkdown.jsx';
    `,
    resolveDir: src,
  },
  alias: { '@': src },
  jsx: 'automatic',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  write: false,
  loader: {
    '.css': 'empty',
    '.woff2': 'empty',
    '.woff': 'empty',
    '.ttf': 'empty',
    '.svg': 'empty',
    '.png': 'empty',
  },
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' },
});

const { createElement: h, createRoot, XenChat, CircuitCopilotChat, XenMarkdown } = await import(
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

test('XenMarkdown - typography renders bold font-bold, em italic, u/ins underline and del strikethrough without raw markdown', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  try {
    const welcome = "Hello! I am **8square**, your AI *Circuit Copilot* powered by **Xen Step-700**.\n\n<u>Underline</u> and <ins>Ins</ins> and ~~strikethrough~~ with $V=IR$.";
    root.render(h(XenMarkdown, { content: welcome }));
    await until(() => document.querySelector('.xen-markdown strong'));

    // strong: font-bold text-white
    const strongs = Array.from(document.querySelectorAll('strong'));
    assert.equal(strongs.length, 2);
    assert.equal(strongs[0].textContent, '8square');
    assert.equal(strongs[0].className.includes('font-bold'), true);
    assert.equal(strongs[0].className.includes('text-white'), true);
    assert.equal(strongs[1].textContent, 'Xen Step-700');
    assert.equal(strongs[1].className.includes('font-bold'), true);
    assert.equal(document.body.innerHTML.includes('**8square**'), false);

    // em: italic text-slate-200
    const em = document.querySelector('em');
    assert.ok(em);
    assert.equal(em.textContent, 'Circuit Copilot');
    assert.equal(em.className.includes('italic'), true);
    assert.equal(em.className.includes('text-slate-200'), true);

    // u & ins: underline underline-offset-2 text-cyan-300
    const underlines = Array.from(document.querySelectorAll('.underline'));
    assert.equal(underlines.length, 2);
    assert.equal(underlines[0].textContent, 'Underline');
    assert.equal(underlines[0].className.includes('text-cyan-300'), true);
    assert.equal(underlines[1].textContent, 'Ins');

    // del: line-through text-slate-400
    const del = document.querySelector('del');
    assert.ok(del);
    assert.equal(del.textContent, 'strikethrough');
    assert.equal(del.className.includes('line-through'), true);
  } finally {
    root.unmount();
  }
});

test('XenChat - multi-turn affirmative continuation passes affirmativeAction in context_envelope', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const origFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    const p = new URL(url, 'https://portal.example').pathname;
    if (p.endsWith('/xen/status')) return Response.json({ status: 'ok', worker_online: true, active_worker_count: 1 });
    if (p.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'c' });
    if (p.endsWith('/auth/refresh/')) return Response.json({ access: 'tok' });
    if (p.endsWith('/xen/chat')) {
      requests.push(JSON.parse(options.body));
      if (requests.length === 1) {
        return Response.json({
          status: 'completed',
          intent: 'TEACHING',
          format_mode: 'DEFAULT_EDUCATIONAL',
          response: {
            text: "Ohm's law relates voltage, current, and resistance. Would you like me to show the formula in LaTeX?",
            is_complete: true,
            syntax_valid: true,
            display_ast_valid: true,
            tested: false,
          },
        });
      }
      return Response.json({
        status: 'completed',
        intent: 'TEACHING',
        format_mode: 'DEFAULT_EDUCATIONAL',
        response: {
          text: "$$V = I \\times R$$",
          is_complete: true,
          syntax_valid: true,
          display_ast_valid: true,
          tested: false,
        },
      });
    }
    return Response.json({});
  };

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(h(XenChat, { userRole: 'student' }));
    await until(() => document.querySelector('textarea'));
    const ta = document.querySelector('textarea');
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;

    // First prompt: ask about Ohm's law
    setter.call(ta, "What is Ohm's law?");
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Send') && !b.disabled));
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send')).click();
    await until(() => document.body.textContent.includes('Would you like me to show the formula in LaTeX?'));

    // Second prompt: affirmative response "yes please"
    setter.call(ta, 'yes please');
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Send') && !b.disabled));
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Send')).click();
    await until(() => requests.length === 2);

    const secondReq = requests[1];
    assert.equal(secondReq.prompt, 'yes please');
    assert.ok(secondReq.context_envelope);
    assert.ok(secondReq.context_envelope.affirmativeAction);
    assert.equal(secondReq.context_envelope.affirmativeAction.detected, true);
    assert.equal(secondReq.context_envelope.affirmativeAction.actionType, 'latex_formatting');
    assert.equal(secondReq.context_envelope.affirmativeAction.action, 'show_latex_formula');
  } finally {
    root.unmount();
    globalThis.fetch = origFetch;
  }
});

test('CircuitCopilotChat - builds rich typed live circuit snapshot in context_envelope', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const origFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options = {}) => {
    const p = new URL(url, 'https://portal.example').pathname;
    if (p.endsWith('/xen/chat')) {
      requests.push(JSON.parse(options.body));
      return Response.json({
        status: 'completed',
        response: { text: 'Diagnostic complete.' },
      });
    }
    return Response.json({});
  };

  const parts = [
    { id: 'uno1', type: 'arduino-uno', x: 40, y: 110, rotation: 0, props: {} },
    { id: 'r1', type: 'resistor', x: 220, y: 110, rotation: 0, props: { resistance: 220, color: 'brown-black-brown' } },
    { id: 'led1', type: 'led', x: 340, y: 110, rotation: 0, props: { color: 'red' } },
  ];
  const wires = [
    { id: 'w1', from: { partId: 'uno1', pinId: 'd13' }, to: { partId: 'r1', pinId: '1' }, color: 'blue' },
    { id: 'w2', from: { partId: 'r1', pinId: '2' }, to: { partId: 'led1', pinId: 'anode' }, color: 'red' },
  ];

  const root = createRoot(document.getElementById('root'));
  try {
    root.render(
      h(CircuitCopilotChat, {
        isOpen: true,
        currentCircuit: { parts, wires },
        currentBlocklyXml: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_setup"></block></xml>',
        activeBoard: 'arduino-uno',
        running: true,
        runtime: { led1: { level: 1, currentMa: 15 } },
        pinStates: { '13': { state: 'HIGH', outputMode: 'digital', value: 1 } },
        userRole: 'student',
      })
    );

    await until(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Diagnose Circuit')));
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Diagnose Circuit')).click();
    await until(() => requests.length >= 1);

    const env = requests[0].context_envelope;
    assert.ok(env, 'context_envelope must be defined');
    assert.ok(env.circuit, 'circuit must be defined');

    // 1. Board
    assert.equal(env.circuit.board.id, 'arduino-uno');
    assert.equal(env.circuit.board.name, 'Arduino Uno R3');
    assert.equal(env.circuit.board.logicVoltage, 5.0);
    assert.ok(Array.isArray(env.circuit.board.powerPinIds));
    assert.ok(Array.isArray(env.circuit.board.groundPinIds));
    assert.ok(env.circuit.board.groundPinIds.includes('gnd'));

    // 2. Components
    assert.ok(Array.isArray(env.circuit.components));
    const resistor = env.circuit.components.find((c) => c.id === 'r1');
    assert.ok(resistor);
    assert.equal(resistor.type, 'resistor');
    assert.equal(resistor.name, 'Resistor');
    assert.equal(resistor.props.resistance, 220);
    assert.ok(Array.isArray(resistor.pins));

    // 3. Connections
    assert.ok(Array.isArray(env.circuit.connections));
    const conn1 = env.circuit.connections.find((c) => c.from.partId === 'uno1' && c.from.pinId === 'd13');
    assert.ok(conn1);
    assert.ok(conn1.from.label);
    assert.ok(conn1.to.label);

    // 4. Simulation
    assert.ok(env.circuit.simulation);
    assert.equal(env.circuit.simulation.running, true);
    assert.ok(env.circuit.simulation.pinStates);
    assert.ok(env.circuit.simulation.componentRuntime);
    assert.ok(Array.isArray(env.circuit.simulation.readings));
    assert.ok(env.circuit.simulation.healthReport);
    assert.equal(typeof env.circuit.simulation.healthReport.score, 'number');

    // 5. Code
    assert.ok(env.circuit.code);
    assert.ok(Array.isArray(env.circuit.code.block_types));
    assert.ok(env.circuit.code.block_types.includes('arduino_setup'));
    assert.ok(Array.isArray(env.circuit.code.pin_bindings));

    // 6. Metadata
    assert.ok(env.circuit.revision);
    assert.equal(typeof env.circuit.timestamp, 'number');
    assert.equal(env.circuit.partial, false);
  } finally {
    root.unmount();
    globalThis.fetch = origFetch;
  }
});
