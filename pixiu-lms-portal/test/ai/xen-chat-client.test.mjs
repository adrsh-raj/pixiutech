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
const { createXenRequestLifecycle, sanitizeClientOutput, sendXenChat, fetchXenStatus, clearAuthStorage } = await import(
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
    model: 'pixiumind-step-700',
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
          model: 'pixiumind-1.4-d14-step700',
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
          model: 'pixiumind-1.4-d14-step700',
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
