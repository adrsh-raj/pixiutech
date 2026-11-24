/**
 * Client library for 8square AI Tutor API (powered by Xen).
 * Connects strictly to authenticated Django backend endpoints (/api/v1/xen/...)
 * Never communicates directly with private GPU inference servers.
 */

import { apiFetch } from '../../../context/AuthContext.jsx';

/**
 * Defensive client-side sanitizer to trim leaked protocol boundary markers
 * while strictly preserving legitimate literal strings in code and documentation.
 */
export function sanitizeClientOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  // Strip leaked ChatML header if present at the very start
  cleaned = cleaned.replace(/^<\|im_start\|>(?:assistant|user|system)?\s*/i, '');
  // Strip trailing protocol tokens only if at the end of the response
  for (const suffix of ['<|im_end|>', '<|endoftext|>']) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trimEnd();
    }
  }
  return cleaned;
}

// Keep one logical message across attempts, including a browser-side cancellation.
export function createXenRequestLifecycle() {
  let pending = null;
  let active = null;

  return {
    begin(message) {
      if (active) return null;
      if (message) pending = { ...message, idempotencyKey: crypto.randomUUID() };
      if (!pending) return null;
      active = new AbortController();
      return { ...pending, signal: active.signal };
    },
    finish(success) {
      if (success && !active.signal.aborted) pending = null;
      active = null;
    },
    cancel() {
      active?.abort();
    },
    clear() {
      if (!active) pending = null;
    },
  };
}

function waitSignal(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Send a chat/tutoring prompt to the Django Xen endpoint.
 * Supports both immediate response (synchronous) and 202 job queue polling.
 */
export async function sendXenChat({
  prompt,
  intent = 'TEACHING',
  history = [],
  maxTokens = 1024,
  temperature = 0.0,
  signal = null,
  idempotencyKey = crypto.randomUUID(),
  timeoutMs = 120000,
  onStatusUpdate = null,
  useQueue = true,
}) {
  const controller = new AbortController();
  const activeSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await apiFetch('/xen/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: activeSignal,
      timeoutMs,
      body: JSON.stringify({
        prompt,
        intent,
        history,
        max_tokens: maxTokens,
        temperature,
        idempotency_key: idempotencyKey,
        ...(useQueue ? { job_mode: true } : {}),
      }),
    });

    if (response.status === 202) {
      const queueData = await response.json();
      const jobId = queueData.job_id;
      if (!jobId) {
        return {
          success: false,
          error: {
            status: 500,
            code: 'INVALID_QUEUE_RESPONSE',
            message: 'Queue job ID was missing from server response.',
          },
        };
      }

      onStatusUpdate?.({
        status: queueData.status || 'queued',
        queuePosition: queueData.queue_position || 1,
        workerAvailable: queueData.worker_available ?? true,
      });

      // Poll until completion, failure, or cancellation
      while (!activeSignal.aborted) {
        await waitSignal(1500, activeSignal);
        if (activeSignal.aborted) break;

        const pollRes = await apiFetch(`/xen/jobs/${jobId}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          signal: activeSignal,
        });

        if (!pollRes.ok) {
          const errData = await pollRes.json().catch(() => ({}));
          return {
            success: false,
            error: {
              status: pollRes.status,
              code: errData.code || 'POLL_FAILED',
              message: errData.error || `Polling failed (HTTP ${pollRes.status}).`,
            },
          };
        }

        const jobData = await pollRes.json();
        if (jobData.status === 'completed') {
          const rawText = jobData?.response?.text || '';
          const cleanText = sanitizeClientOutput(rawText);
          return {
            success: true,
            requestId: jobData?.request_id || jobId,
            assistant: jobData?.assistant || '8square',
            model: jobData?.model || 'xen-step-700',
            intent: jobData?.intent || intent,
            response: {
              text: cleanText,
              is_complete: Boolean(jobData?.response?.is_complete),
              completion_status: jobData?.response?.completion_status || 'COMPLETED',
              syntax_valid: Boolean(jobData?.response?.syntax_valid),
              display_ast_valid: Boolean(jobData?.response?.display_ast_valid),
              tested: Boolean(jobData?.response?.tested),
              code_leakage_detected: Boolean(jobData?.response?.code_leakage_detected),
            },
            usage: jobData?.usage || {},
          };
        }

        if (jobData.status === 'failed') {
          return {
            success: false,
            error: {
              status: 500,
              code: jobData.error?.code || 'INFERENCE_FAILED',
              message: jobData.error?.message || 'Execution failed on GPU worker.',
            },
          };
        }

        onStatusUpdate?.({
          status: jobData.status,
          queuePosition: jobData.queue_position || 0,
          workerAvailable: jobData.worker_available ?? true,
        });
      }
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          status: response.status,
          code: errorJson.code || 'UPSTREAM_ERROR',
          message: response.status === 409 && errorJson.code === 'IDEMPOTENCY_IN_PROGRESS'
            ? 'Your previous request is still running. Try again shortly.'
            : response.status === 403
              ? 'This account does not have access to Xen.'
              : `Xen request failed (HTTP ${response.status}).`,
          requestId: errorJson.request_id || null,
        },
      };
    }

    const data = await response.json();
    const rawText = data?.response?.text || '';
    const cleanText = sanitizeClientOutput(rawText);

    return {
      success: true,
      requestId: data?.request_id || data?.id || null,
      assistant: data?.assistant || '8square',
      model: data?.model || 'xen-step-700',
      intent: data?.intent || intent,
      response: {
        text: cleanText,
        is_complete: Boolean(data?.response?.is_complete),
        completion_status: data?.response?.completion_status || 'COMPLETED',
        syntax_valid: Boolean(data?.response?.syntax_valid),
        display_ast_valid: Boolean(data?.response?.display_ast_valid),
        tested: Boolean(data?.response?.tested),
        code_leakage_detected: Boolean(data?.response?.code_leakage_detected),
      },
      usage: data?.usage || {},
    };
  } catch {
    const isAborted = activeSignal.aborted;
    return {
      success: false,
      error: {
        status: isAborted ? 499 : 500,
        code: signal?.aborted ? 'CANCELLED' : isAborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: signal?.aborted ? 'Request cancelled.' : isAborted ? 'Xen request timed out.' : 'Network request failed.',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Query the Xen server health status.
 */
export async function fetchXenHealth() {
  try {
    const res = await apiFetch('/xen/health', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { healthy: false, status: res.status };
    const data = await res.json();
    return { healthy: data.status === 'healthy', data };
  } catch {
    return { healthy: false, error: 'Failed to contact Xen health endpoint' };
  }
}

/**
 * Query the real-time Xen worker and queue status.
 */
export async function fetchXenStatus() {
  try {
    const res = await apiFetch('/xen/status', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { success: false, status: res.status };
    const data = await res.json();
    return {
      success: true,
      workerOnline: Boolean(data.worker_online),
      activeWorkerCount: data.active_worker_count || 0,
      queuedJobs: data.queued_jobs || 0,
      runningJobs: data.running_jobs || 0,
      assistant: data.assistant || '8square',
      model: data.model || 'xen-step-700',
    };
  } catch {
    return { success: false, error: 'Failed to contact Xen status endpoint' };
  }
}
