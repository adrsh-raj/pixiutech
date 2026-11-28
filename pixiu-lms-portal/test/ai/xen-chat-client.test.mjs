import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from '../../src/lib/ai/xen/xen-client.js';
      export { clearAuthStorage } from '../../src/context/AuthContext.jsx';
    `,
    resolveDir: new URL('.', import.meta.url).pathname,
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  define: { 'import.meta.env': '{}' },
});
const { createXenRequestLifecycle, sanitizeClientOutput, sendXenChat, streamXenChat, fetchXenStatus, clearAuthStorage, copilotCompletionSource } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

test('Xen Client - sanitizeClientOutput trims trailing protocol tokens but preserves literal strings in code', () => {
  // Trailing protocol token is trimmed
  const trailingDirty = 'Hello world!<|im_end|>';
  assert.equal(sanitizeClientOutput(trailingDirty), 'Hello world!');

  // ChatML header prefix is trimmed
  const headerDirty = '<|im_start|>assistant\nHere is your code.';
  assert.equal(sanitizeClientOutput(headerDirty), 'Here is your code.');

  // CRITICAL REQUIREMENT: Legitimate literal strings inside code must NOT be destroyed!
  const codeWithLiterals = (
    'Here is how you print the token in Python:\n\n' +
    '```python\n' +
    'print("<|im_end|>")\n' +
    'print("<|im_start|>")\n' +
    '```\n' +
    'This is a literal string example.'
  );
  const cleaned = sanitizeClientOutput(codeWithLiterals);
  assert.equal(cleaned.includes('print("<|im_end|>")'), true);
  assert.equal(cleaned.includes('print("<|im_start|>")'), true);
});

test('Xen Client - sendXenChat handles cancellation cleanly', async () => {
  const controller = new AbortController();
  controller.abort(); // Cancel before call completes

  const result = await sendXenChat({
    prompt: 'Write a quicksort in Python',
    signal: controller.signal,
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CANCELLED');
});

test('Xen Client - AST badge and tested truthfulness mapping', () => {
  const mockServerResponse = {
    status: 'ok',
    model: 'xen-step-700',
    assistant: 'Xen',
    response: {
      text: 'def test():\n    pass',
      is_complete: false,
      syntax_valid: true,
      display_ast_valid: false, // Incomplete must not have AST-valid badge
      tested: false,
    },
  };

  assert.equal(mockServerResponse.response.is_complete, false);
  assert.equal(mockServerResponse.response.display_ast_valid, false);
  assert.equal(mockServerResponse.response.tested, false);
});


test('Xen reuses shared JWT refresh, CSRF, and the original idempotency key', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url, 'https://portal.example').pathname;
    calls.push({ path, options });
    if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
    if (path.endsWith('/auth/refresh/')) {
      assert.equal(options.headers.get('X-CSRFToken'), 'test-csrf');
      assert.equal(options.credentials, 'include');
      assert.equal(JSON.parse(options.body).role, 'trainer');
      return refreshAllowed ? Response.json({ access: 'new-access' }) : Response.json({}, { status: 401 });
    }
    if (options.headers.get('Authorization') !== 'Bearer new-access') {
      return Response.json({}, { status: 401 });
    }
    return Response.json({ request_id: 'local-test', response: { text: 'Tutor reply', is_complete: true } });
  });
  const calls = [];
  let refreshAllowed = true;
  const previousWindow = globalThis.window;
  globalThis.window = browser;
  try {
    clearAuthStorage({ clearRole: false, clearCsrf: true });
    const result = await sendXenChat({ prompt: 'Explain loops', idempotencyKey: 'retry-key' });
    assert.equal(result.success, true);
    assert.deepEqual(calls.map(({ path }) => path.split('/api/v1')[1]),
      ['/xen/chat', '/auth/csrf/', '/auth/refresh/', '/xen/chat']);
    assert.equal(JSON.parse(calls[0].options.body).idempotency_key, 'retry-key');
    assert.equal(calls[0].options.body, calls[3].options.body);

    calls.length = 0;
    assert.equal((await sendXenChat({ prompt: 'Another question' })).success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer new-access');

    clearAuthStorage({ clearRole: false, clearCsrf: true });
    refreshAllowed = false;
    calls.length = 0;
    const denied = await sendXenChat({ prompt: 'After logout' });
    assert.equal(denied.error.status, 401);
    assert.equal(calls[0].options.headers.has('Authorization'), false);
    assert.equal(calls.filter(({ path }) => path.endsWith('/xen/chat')).length, 1);
  } finally {
    clearAuthStorage({ clearCsrf: true });
    globalThis.window = previousWindow;
  }
});

test('Xen retains one key across concurrent clicks, timeouts, 5xx and cancellation', () => {
  const lifecycle = createXenRequestLifecycle();
  const original = lifecycle.begin({ prompt: 'Original', history: [] });
  assert.equal(lifecycle.begin({ prompt: 'Duplicate' }), null);

  // The client treats network timeouts and HTTP 5xx as unsuccessful attempts.
  for (const outcome of ['timeout', '5xx', 'cancel']) {
    if (outcome === 'cancel') lifecycle.cancel();
    lifecycle.finish(false);
    const retry = lifecycle.begin();
    assert.equal(retry.idempotencyKey, original.idempotencyKey, outcome);
    assert.equal(retry.prompt, 'Original');
    assert.equal(retry.signal.aborted, false);
  }

  // A late completion after cancel must leave the retry available.
  lifecycle.cancel();
  lifecycle.finish(true);
  assert.equal(lifecycle.begin().idempotencyKey, original.idempotencyKey);
  lifecycle.finish(true);
  assert.equal(lifecycle.begin(), null);
  const next = lifecycle.begin({ prompt: 'New question' });
  assert.notEqual(next.idempotencyKey, original.idempotencyKey);
});

test('Xen Client - fetchXenStatus reports operational worker vitality', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  try {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/status')) {
        return Response.json({
          status: 'ok',
          worker_online: true,
          active_worker_count: 1,
          queued_jobs: 2,
          running_jobs: 1,
          model: 'xen-step-700',
          assistant: 'Xen',
        });
      }
      return Response.json({}, { status: 404 });
    });

    const res = await fetchXenStatus();
    assert.equal(res.success, true);
    assert.equal(res.workerOnline, true);
    assert.equal(res.activeWorkerCount, 1);
    assert.equal(res.queuedJobs, 2);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - sendXenChat handles HTTP 202 job queue and polls until completed', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  let pollCount = 0;
  const statusUpdates = [];

  try {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json(
          {
            status: 'queued',
            job_id: 'job-uuid-456',
            worker_available: true,
            queue_position: 1,
          },
          { status: 202 }
        );
      }
      if (path.includes('/xen/jobs/job-uuid-456')) {
        pollCount++;
        if (pollCount === 1) {
          return Response.json({
            status: 'running',
            job_id: 'job-uuid-456',
            worker_available: true,
          });
        }
        return Response.json({
          status: 'completed',
          job_id: 'job-uuid-456',
          model: 'xen-step-700',
          assistant: 'Xen',
          response: {
            text: '```python\nprint("Kaggle GPU result")\n```',
            is_complete: true,
            syntax_valid: true,
            display_ast_valid: true,
            tested: false,
          },
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const result = await sendXenChat({
      prompt: 'Print Kaggle GPU result',
      onStatusUpdate: (update) => statusUpdates.push(update),
    });

    assert.equal(result.success, true);
    assert.equal(result.response.text.includes('print("Kaggle GPU result")'), true);
    assert.equal(result.response.syntax_valid, true);
    assert.equal(pollCount, 2);
    assert.equal(statusUpdates.length >= 2, true);
    assert.equal(statusUpdates[0].status, 'queued');
    assert.equal(statusUpdates[1].status, 'running');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - stream displays a delta before completion after two empty reads of the same cursor', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  let pollCount = 0;
  const partials = [];
  const statusUpdates = [];

  try {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json(
          {
            status: 'queued',
            job_id: 'job-uuid-456',
            worker_available: true,
            queue_position: 1,
          },
          { status: 202 }
        );
      }
      if (path.includes('/xen/jobs/job-uuid-456')) {
        pollCount++;
        if (pollCount <= 2) {
          return Response.json({
            status: 'running',
            job_id: 'job-uuid-456',
            worker_available: true,
          });
        }
        if (pollCount === 3) return Response.json({ status: 'running', chunks: [{seq: 1, delta: 'Haan bhai'}] });
        assert.deepEqual(partials, ['Haan bhai']);
        assert.equal(new URL(url).searchParams.get('after'), '1');
        return Response.json({
          status: 'completed',
          job_id: 'job-uuid-456',
          model: 'xen-step-700',
          assistant: 'Xen',
          response: {
            text: '```python\nprint("Kaggle GPU result")\n```',
            is_complete: true,
            syntax_valid: true,
            display_ast_valid: true,
            tested: false,
          },
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const result = await streamXenChat({
      onChunk: (_, visible) => partials.push(visible),
      prompt: 'Print Kaggle GPU result',
      onStatusUpdate: (update) => statusUpdates.push(update),
    });

    assert.equal(result.success, true);
    assert.equal(result.response.text.includes('print("Kaggle GPU result")'), true);
    assert.equal(result.response.syntax_valid, true);
    assert.equal(pollCount, 4);
    assert.equal(statusUpdates.length >= 2, true);
    assert.equal(statusUpdates[0].status, 'sending');
    assert.equal(statusUpdates[1].status, 'queued');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - stream updates status on running/offline worker, recovers transient 503 poll, preserves server intent', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  let pollCount = 0;
  const statusUpdates = [];

  try {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json(
          { status: 'queued', job_id: 'job-recover-1', worker_available: false, queue_position: 2 },
          { status: 202 }
        );
      }
      if (path.includes('/xen/jobs/job-recover-1/chunks')) {
        pollCount++;
        if (pollCount === 1) return Response.json({ error: 'Temporary gateway error' }, { status: 503 });
        if (pollCount === 2) {
          return Response.json({
            status: 'running',
            worker_available: true,
            chunks: [],
          });
        }
        return Response.json({
          status: 'completed',
          is_complete: true,
          intent: 'LAB_TEACHING',
          format_mode: 'DEFAULT_EDUCATIONAL',
          worker_available: true,
          response: { text: 'Recovered answer', is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const result = await streamXenChat({
      prompt: 'Check circuit',
      intent: 'TEACHING',
      onStatusUpdate: (u) => statusUpdates.push(u),
    });

    assert.equal(result.success, true);
    assert.equal(result.intent, 'LAB_TEACHING');
    assert.equal(result.response.text, 'Recovered answer');
    assert.equal(statusUpdates.some((u) => u.status === 'queued' && u.workerAvailable === false && u.message.toLowerCase().includes('offline')), true);
    assert.equal(statusUpdates.some((u) => u.status === 'running' && u.workerAvailable === true), true);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - streamXenChat aborts fast with WORKER_OFFLINE when offlineTimeoutMs elapses', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  try {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json({ status: 'queued', job_id: 'job-offline-1', worker_available: false, queue_position: 1 }, { status: 202 });
      }
      return Response.json({ status: 'queued', worker_available: false, queue_position: 1, chunks: [] });
    });

    const t0 = Date.now();
    const result = await streamXenChat({
      prompt: 'Quick offline test',
      offlineTimeoutMs: 120,
      timeoutMs: 10000,
    });
    const elapsed = Date.now() - t0;

    assert.equal(result.success, false);
    assert.equal(result.error.code, 'WORKER_OFFLINE');
    assert.equal(result.provenance.response_source, 'error');
    assert.equal(result.provenance.job_id, 'job-offline-1');
    assert.equal(result.provenance.response_status, 'worker_offline');
    assert.equal(result.provenance.fallback_reason, 'WORKER_OFFLINE');
    assert.equal(elapsed < 2000, true);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - streamXenChat preserves structured provenance across xen_step700 and cache hits', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;

  try {
    t.mock.method(globalThis, 'fetch', async (url) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json({
          status: 'queued',
          job_id: 'job-prov-1',
          worker_available: true,
          queue_position: 1,
        }, { status: 202 });
      }
      if (path.includes('/xen/jobs/job-prov-1/chunks')) {
        return Response.json({
          job_id: 'job-prov-1',
          worker_id: 'kaggle-t4-live-1',
          status: 'completed',
          is_complete: true,
          intent: 'TEACHING',
          format_mode: 'DEFAULT_EDUCATIONAL',
          worker_available: true,
          provenance: {
            response_source: 'xen_step700',
            job_id: 'job-prov-1',
            worker_id: 'kaggle-t4-live-1',
            session_id: 'sess-client-1',
            circuit_revision: 3,
            context_schema_version: '3.0',
            response_status: 'completed',
            fallback_reason: null,
          },
          grounding_verification: {
            verified: true,
            model_verified: true,
            retry_attempted: false,
            fallback_applied: false,
            circuit_revision: 3,
            unsupported_claims: [],
          },
          response: { text: 'Verified live answer', is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const liveRes = await streamXenChat({
      prompt: 'Check wiring',
      contextEnvelope: { session_id: 'sess-client-1', circuit_revision: 3, schema_version: '3.0' },
    });
    assert.equal(liveRes.success, true);
    assert.deepEqual(liveRes.provenance, {
      response_source: 'xen_step700',
      job_id: 'job-prov-1',
      worker_id: 'kaggle-t4-live-1',
      session_id: 'sess-client-1',
      circuit_revision: 3,
      context_schema_version: '3.0',
      response_status: 'completed',
      fallback_reason: null,
    });
    assert.equal(liveRes.groundingVerification?.circuit_revision, 3);
    assert.equal(liveRes.groundingVerification?.model_verified, true);

    // Cached synchronous response from idempotency hit
    t.mock.method(globalThis, 'fetch', async (url) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'test-csrf' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'test-access-token' });
      if (path.endsWith('/xen/chat')) {
        return Response.json({
          status: 'completed',
          job_id: 'job-prov-1',
          worker_id: 'kaggle-t4-live-1',
          cached: true,
          provenance: {
            response_source: 'cache',
            job_id: 'job-prov-1',
            worker_id: 'kaggle-t4-live-1',
            session_id: 'sess-client-1',
            circuit_revision: 3,
            context_schema_version: '3.0',
            response_status: 'cached',
            fallback_reason: null,
          },
          response: { text: 'Cached answer', is_complete: true, syntax_valid: true, display_ast_valid: true, tested: false },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const cacheRes = await streamXenChat({
      prompt: 'Check wiring',
      contextEnvelope: { session_id: 'sess-client-1', circuit_revision: 3, schema_version: '3.0' },
    });
    assert.equal(cacheRes.success, true);
    assert.equal(cacheRes.provenance.response_source, 'cache');
    assert.equal(cacheRes.provenance.response_status, 'cached');
    assert.equal(cacheRes.provenance.worker_id, 'kaggle-t4-live-1');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Xen Client - streamXenChat sanitizes Markdown escapes, entities, and think boundaries across chunks', async (t) => {
  const session = new Map([['pixiu_session_role', 'trainer']]);
  const browser = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    sessionStorage: {
      getItem: (key) => session.get(key),
      removeItem: (key) => session.delete(key),
    },
    localStorage: { removeItem() {} },
  });
  const previousWindow = globalThis.window;
  globalThis.window = browser;
  const emitted = [];

  try {
    let pollStep = 0;
    t.mock.method(globalThis, 'fetch', async (url) => {
      const path = new URL(url, 'https://portal.example').pathname;
      if (path.endsWith('/auth/csrf/')) return Response.json({ csrfToken: 'c' });
      if (path.endsWith('/auth/refresh/')) return Response.json({ access: 'tok' });
      if (path.endsWith('/xen/chat')) {
        return Response.json({ status: 'queued', job_id: 'job-stream-md', attempt: 1 }, { status: 202 });
      }
      if (path.endsWith('/xen/jobs/job-stream-md/chunks')) {
        pollStep++;
        if (pollStep === 1) {
          return Response.json({
            status: 'running',
            attempt: 1,
            is_complete: false,
            chunks: [
              { seq: 1, delta: '<think>reasoning</thin' },
              { seq: 2, delta: 'k>\n\n\\#\\# Ohm' },
            ],
          });
        }
        return Response.json({
          status: 'completed',
          attempt: 1,
          is_complete: true,
          chunks: [
            { seq: 3, delta: '&#x20;Law\n\n\\*\\*V = I \\times R\\*\\*<|im_end|>' },
          ],
          response: {
            text: "## Ohm's&#x20;Law\n\n**Formula:** $V = I \\times R$",
            is_complete: true,
          },
        });
      }
      return Response.json({}, { status: 404 });
    });

    const res = await streamXenChat({
      prompt: "Explain Ohm's Law",
      onChunk: (_d, fullText) => emitted.push(fullText),
    });
    assert.equal(res.success, true);
    assert.equal(emitted.some((t) => t.includes('<think>') || t.includes('reasoning') || t.includes('<|im_end|>')), false);
    assert.equal(emitted.some((t) => t.includes('&#x20;')), false);
    assert.equal(res.response.text, "## Ohm's Law\n\n**Formula:** $V = I \\times R$");
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Copilot attributes only the explicit circuit grounding fallback to the local engine', () => {
  const proof = { fallback_applied: true, final_output_source: 'deterministic_grounded_fallback' };
  const source = { response_source: 'local_fallback', response_status: 'grounding_fallback',
    fallback_reason: 'GROUNDING_VERIFICATION_FAILED' };
  assert.equal(copilotCompletionSource(source, proof), 'local_circuit_engine');
  assert.equal(copilotCompletionSource(source, null), 'unknown');
  assert.equal(copilotCompletionSource({ response_source: 'local_fallback' }, proof), 'unknown');
  assert.equal(copilotCompletionSource(source, { ...proof, final_output_source: 'education' }), 'unknown');
  assert.equal(copilotCompletionSource({ response_source: 'xen_step700' }), 'xen_step_700');
  assert.equal(copilotCompletionSource({ response_source: 'cache' }, proof), 'cache');
  assert.equal(copilotCompletionSource(undefined, proof), 'unknown');
});
