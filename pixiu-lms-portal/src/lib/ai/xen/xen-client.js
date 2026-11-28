/**
 * Client library for Xen AI Tutor API (powered by Xen Step-700).
 * Connects strictly to authenticated Django backend endpoints (/api/v1/xen/...)
 * Never communicates directly with private GPU inference servers.
 */

import { apiFetch } from '../../../context/AuthContext.jsx';
import { sanitizeClientOutput, sanitizeStreamingOutput } from './xen-sanitizer.js';
export { sanitizeClientOutput, sanitizeStreamingOutput };

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

function extractContextMeta(contextEnvelope) {
  if (!contextEnvelope || typeof contextEnvelope !== 'object') {
    return {
      session_id: null,
      circuit_revision: null,
      context_schema_version: null,
    };
  }
  const circuit = contextEnvelope.circuit && typeof contextEnvelope.circuit === 'object'
    ? contextEnvelope.circuit
    : {};
  const sessionId =
    (typeof contextEnvelope.session_id === 'string' && contextEnvelope.session_id.trim()) ||
    (typeof circuit.session_id === 'string' && circuit.session_id.trim()) ||
    null;
  let circuitRevision = null;
  for (const cand of [
    contextEnvelope.circuit_revision,
    circuit.circuit_revision,
    contextEnvelope.state_revision,
    circuit.state_revision,
  ]) {
    if (Number.isInteger(cand)) {
      circuitRevision = cand;
      break;
    }
  }
  const schemaVersion =
    (typeof contextEnvelope.schema_version === 'string' && contextEnvelope.schema_version.trim()) ||
    (typeof circuit.schema_version === 'string' && circuit.schema_version.trim()) ||
    null;
  return {
    session_id: sessionId,
    circuit_revision: circuitRevision,
    context_schema_version: schemaVersion,
  };
}

export function normalizeResponseProvenance({
  apiData = null,
  contextMeta = {},
  fallbackSource = 'unknown',
  fallbackStatus = 'unknown',
  jobId = null,
  workerId = null,
  fallbackReason = null,
} = {}) {
  const apiProv = apiData && typeof apiData.provenance === 'object' && apiData.provenance !== null
    ? apiData.provenance
    : {};
  let responseSource = apiProv.response_source;
  if (!['xen_step700', 'local_fallback', 'cache', 'error'].includes(responseSource)) {
    responseSource = apiData?.cached === true ? 'cache'
      : fallbackSource === 'error' ? 'error' : 'unknown';
  }
  const resolvedCircuitRev = Number.isInteger(apiProv.circuit_revision)
    ? apiProv.circuit_revision
    : Number.isInteger(contextMeta.circuit_revision)
      ? contextMeta.circuit_revision
      : null;

  return {
    response_source: responseSource,
    job_id: apiProv.job_id ?? jobId ?? apiData?.job_id ?? null,
    worker_id: apiProv.worker_id ?? workerId ?? apiData?.worker_id ?? null,
    session_id: apiProv.session_id ?? contextMeta.session_id ?? null,
    circuit_revision: resolvedCircuitRev,
    context_schema_version: apiProv.context_schema_version ?? contextMeta.context_schema_version ?? null,
    response_status: apiProv.response_status ?? fallbackStatus ?? apiData?.status ?? 'unknown',
    fallback_reason: apiProv.fallback_reason ?? fallbackReason ?? null,
  };
}

/** Only the backend's circuit grounding substitution may claim a local-engine answer. */
export function copilotCompletionSource(provenance, verification) {
  if (provenance?.response_source === 'xen_step700') return 'xen_step_700';
  if (provenance?.response_source === 'cache') return 'cache';
  if (provenance?.response_source === 'local_fallback' &&
      provenance.response_status === 'grounding_fallback' &&
      provenance.fallback_reason === 'GROUNDING_VERIFICATION_FAILED' &&
      verification?.fallback_applied === true &&
      verification.final_output_source === 'deterministic_grounded_fallback') {
    return 'local_circuit_engine';
  }
  return 'unknown';
}

/**
 * Send a chat/tutoring prompt to the Django Xen endpoint.
 * Supports both immediate response (synchronous) and 202 job queue polling.
 */
export async function sendXenChat({
  prompt,
  intent = 'TEACHING',
  formatPreference = null,
  contextEnvelope = null,
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
  const contextMeta = extractContextMeta(contextEnvelope);
  let trackedJobId = null;

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
        ...(formatPreference ? { format_preference: formatPreference } : {}),
        ...(contextEnvelope ? { context_envelope: contextEnvelope } : {}),
        ...(useQueue ? { job_mode: true } : {}),
      }),
    });

    if (response.status === 202) {
      const queueData = await response.json();
      const jobId = queueData.job_id;
      trackedJobId = jobId || null;
      if (!jobId) {
        return {
          success: false,
          provenance: normalizeResponseProvenance({
            apiData: queueData,
            contextMeta,
            fallbackSource: 'error',
            fallbackStatus: 'error',
            fallbackReason: 'INVALID_QUEUE_RESPONSE',
          }),
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
          const errCode = errData.code || 'POLL_FAILED';
          return {
            success: false,
            provenance: normalizeResponseProvenance({
              apiData: errData,
              contextMeta,
              fallbackSource: 'error',
              fallbackStatus: 'error',
              jobId,
              fallbackReason: errCode,
            }),
            error: {
              status: pollRes.status,
              code: errCode,
              message: errData.error || `Polling failed (HTTP ${pollRes.status}).`,
            },
          };
        }

        const jobData = await pollRes.json();
        if (jobData.status === 'completed') {
          const rawText = jobData?.response?.text || '';
          const cleanText = sanitizeClientOutput(rawText);
          const formatMode = jobData?.format_mode || jobData?.intent || intent;
          return {
            success: true,
            requestId: jobData?.request_id || jobId,
            assistant: jobData?.assistant ?? null,
            model: jobData?.model ?? null,
            intent: jobData?.intent || intent,
            formatMode,
            provenance: normalizeResponseProvenance({
              apiData: jobData,
              contextMeta,
              fallbackSource: 'xen_step700',
              fallbackStatus: 'completed',
              jobId,
            }),
            groundingVerification: jobData?.grounding_verification || null,
            response: {
              text: cleanText,
              is_complete: Boolean(jobData?.response?.is_complete),
              completion_status: jobData?.response?.completion_status || 'COMPLETED',
              syntax_valid: Boolean(jobData?.response?.syntax_valid),
              display_ast_valid: Boolean(jobData?.response?.display_ast_valid),
              format_valid: Boolean(jobData?.response?.format_valid ?? true),
              tested: Boolean(jobData?.response?.tested),
              code_leakage_detected: Boolean(jobData?.response?.code_leakage_detected),
            },
            usage: jobData?.usage || {},
          };
        }

        if (jobData.status === 'failed') {
          const errCode = jobData.error?.code || 'INFERENCE_FAILED';
          return {
            success: false,
            provenance: normalizeResponseProvenance({
              apiData: jobData,
              contextMeta,
              fallbackSource: 'error',
              fallbackStatus: 'failed',
              jobId,
              fallbackReason: errCode,
            }),
            error: {
              status: 500,
              code: errCode,
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
      const errCode = errorJson.code || 'UPSTREAM_ERROR';
      return {
        success: false,
        provenance: normalizeResponseProvenance({
          apiData: errorJson,
          contextMeta,
          fallbackSource: 'error',
          fallbackStatus: 'error',
          jobId: trackedJobId,
          fallbackReason: errCode,
        }),
        error: {
          status: response.status,
          code: errCode,
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
    const formatMode = data?.format_mode || data?.intent || intent;

    return {
      success: true,
      requestId: data?.request_id || data?.id || null,
      assistant: data?.assistant ?? null,
      model: data?.model ?? null,
      intent: data?.intent || intent,
      formatMode,
      provenance: normalizeResponseProvenance({
        apiData: data,
        contextMeta,
        fallbackSource: data?.cached ? 'cache' : 'xen_step700',
        fallbackStatus: data?.cached ? 'cached' : 'completed',
        jobId: data?.job_id || null,
      }),
      groundingVerification: data?.grounding_verification || null,
      response: {
        text: cleanText,
        is_complete: Boolean(data?.response?.is_complete),
        completion_status: data?.response?.completion_status || 'COMPLETED',
        syntax_valid: Boolean(data?.response?.syntax_valid),
        display_ast_valid: Boolean(data?.response?.display_ast_valid),
        format_valid: Boolean(data?.response?.format_valid ?? true),
        tested: Boolean(data?.response?.tested),
        code_leakage_detected: Boolean(data?.response?.code_leakage_detected),
      },
      usage: data?.usage || {},
    };
  } catch {
    const isAborted = activeSignal.aborted;
    const errCode = signal?.aborted ? 'CANCELLED' : isAborted ? 'TIMEOUT' : 'NETWORK_ERROR';
    return {
      success: false,
      provenance: normalizeResponseProvenance({
        contextMeta,
        fallbackSource: 'error',
        fallbackStatus: errCode.toLowerCase(),
        jobId: trackedJobId,
        fallbackReason: errCode,
      }),
      error: {
        status: isAborted ? 499 : 500,
        code: errCode,
        message: signal?.aborted ? 'Request cancelled.' : isAborted ? 'Xen request timed out.' : 'Network request failed.',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Stream a chat/tutoring prompt from the Django Xen endpoint with progressive token rendering.
 * Uses low-latency cursor polling (250-300ms) against /xen/jobs/<id>/chunks.
 */
export async function streamXenChat({
  prompt,
  intent = 'TEACHING',
  formatPreference = null,
  contextEnvelope = null,
  history = [],
  maxTokens = 1024,
  temperature = 0.0,
  signal = null,
  idempotencyKey = crypto.randomUUID(),
  timeoutMs = 120000,
  offlineTimeoutMs = 0,
  onStatusUpdate = null,
  onChunk = null,
  useQueue = true,
}) {
  const controller = new AbortController();
  const activeSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const contextMeta = extractContextMeta(contextEnvelope);
  let trackedJobId = null;
  let offlineSince = null;

  const formatQueueMessage = (payload) => {
    const pos = payload?.queue_position || 1;
    const workerAvail = payload?.worker_available ?? true;
    if (!workerAvail) {
      return payload?.lease_expired
        ? 'GPU worker lease expired · waiting for Kaggle worker reconnect...'
        : `In queue (position ${pos}) · Kaggle GPU worker offline...`;
    }
    if (pos > 1) return `In queue (position ${pos})...`;
    return 'In queue · Xen preparing response...';
  };

  try {
    onStatusUpdate?.({
      status: 'sending',
      message: 'Connecting to Xen...',
      queuePosition: 0,
    });

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
        ...(formatPreference ? { format_preference: formatPreference } : {}),
        ...(contextEnvelope ? { context_envelope: contextEnvelope } : {}),
        ...(useQueue ? { job_mode: true } : {}),
      }),
    });

    if (response.status === 202) {
      const queueData = await response.json();
      const jobId = queueData.job_id;
      trackedJobId = jobId || null;
      if (!jobId) {
        return {
          success: false,
          provenance: normalizeResponseProvenance({
            apiData: queueData,
            contextMeta,
            fallbackSource: 'error',
            fallbackStatus: 'error',
            fallbackReason: 'INVALID_QUEUE_RESPONSE',
          }),
          error: {
            status: 500,
            code: 'INVALID_QUEUE_RESPONSE',
            message: 'Queue job ID was missing from server response.',
          },
        };
      }

      if (queueData.worker_available === false) {
        offlineSince = Date.now();
      }
      onStatusUpdate?.({
        status: queueData.status || 'queued',
        message: formatQueueMessage(queueData),
        queuePosition: queueData.queue_position || 1,
        workerAvailable: queueData.worker_available ?? true,
      });

      let lastSeq = 0;
      let accumulatedText = '';
      let attempt;
      let delay = 280;
      let isCompleted = false;
      let transientErrors = 0;

      // Low-latency chunk polling (250-300ms intervals)
      while (!activeSignal.aborted && !isCompleted) {
        if (offlineTimeoutMs > 0 && offlineSince !== null && Date.now() - offlineSince >= offlineTimeoutMs) {
          return {
            success: false,
            provenance: normalizeResponseProvenance({
              contextMeta,
              fallbackSource: 'error',
              fallbackStatus: 'worker_offline',
              jobId,
              fallbackReason: 'WORKER_OFFLINE',
            }),
            error: {
              status: 503,
              code: 'WORKER_OFFLINE',
              message: 'Kaggle GPU worker is offline.',
            },
          };
        }
        await waitSignal(delay, activeSignal);
        if (activeSignal.aborted) break;

        let chunksRes;
        try {
          chunksRes = await apiFetch(`/xen/jobs/${jobId}/chunks?after=${lastSeq}${attempt == null ? "" : "&attempt=" + attempt}`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            signal: activeSignal,
          });
        } catch (pollErr) {
          if (activeSignal.aborted) break;
          transientErrors += 1;
          if (transientErrors > 4) throw pollErr;
          delay = Math.min(2000, delay + 350);
          continue;
        }

        if (!chunksRes.ok) {
          if ([429, 502, 503, 504].includes(chunksRes.status) && transientErrors < 4) {
            transientErrors += 1;
            delay = Math.min(2000, delay + 400);
            continue;
          }
          if (![404, 405].includes(chunksRes.status)) {
            return {
              success: false,
              provenance: normalizeResponseProvenance({
                contextMeta,
                fallbackSource: 'error',
                fallbackStatus: 'error',
                jobId,
                fallbackReason: 'POLL_FAILED',
              }),
              error: { status: chunksRes.status, code: "POLL_FAILED", message: "Unable to read this response." },
            };
          }
          delay = 1200;
          // Compatibility with a backend without a chunk route.
          const pollRes = await apiFetch(`/xen/jobs/${jobId}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: activeSignal,
          });
          if (!pollRes.ok) {
            return {
              success: false,
              provenance: normalizeResponseProvenance({
                contextMeta,
                fallbackSource: 'error',
                fallbackStatus: 'error',
                jobId,
                fallbackReason: 'POLL_FAILED',
              }),
              error: { status: pollRes.status, code: "POLL_FAILED", message: "Unable to read this job." },
            };
          }
          const jobData = await pollRes.json();
          transientErrors = 0;
          if (jobData.worker_available === false) {
            offlineSince = offlineSince ?? Date.now();
          } else {
            offlineSince = null;
          }
          if (jobData.status === 'completed') {
            const cleanText = sanitizeClientOutput(jobData?.response?.text || '');
            onChunk?.(cleanText, cleanText);
            return {
              success: true,
              requestId: jobData?.request_id || jobId,
              assistant: jobData?.assistant ?? null,
              model: jobData?.model ?? null,
              intent: jobData?.intent || intent,
              formatMode: jobData?.format_mode || jobData?.intent || intent,
              provenance: normalizeResponseProvenance({
                apiData: jobData,
                contextMeta,
                fallbackSource: 'xen_step700',
                fallbackStatus: 'completed',
                jobId,
              }),
              groundingVerification: jobData?.grounding_verification || null,
              response: {
                ...jobData.response,
                text: cleanText,
              },
              usage: jobData?.usage || {},
            };
          } else if (jobData.status === 'failed') {
            const errObj = jobData.error || { code: 'INFERENCE_FAILED', message: 'Inference failed on GPU worker.' };
            return {
              success: false,
              provenance: normalizeResponseProvenance({
                apiData: jobData,
                contextMeta,
                fallbackSource: 'error',
                fallbackStatus: 'failed',
                jobId,
                fallbackReason: errObj.code || 'INFERENCE_FAILED',
              }),
              error: errObj,
            };
          }
          onStatusUpdate?.({
            status: jobData.status || 'queued',
            message: jobData.status === 'queued' ? formatQueueMessage(jobData) : 'Xen is thinking...',
            queuePosition: jobData.queue_position || 0,
            workerAvailable: jobData.worker_available ?? true,
          });
          continue;
        }

        transientErrors = 0;
        const data = await chunksRes.json();
        const incomingChunks = Array.isArray(data.chunks) ? data.chunks : [];
        if (data.worker_available === false) {
          offlineSince = offlineSince ?? Date.now();
        } else {
          offlineSince = null;
        }

        if (attempt != null && data.attempt !== attempt) {
          lastSeq = 0;
          accumulatedText = "";
          onChunk?.("", "");
        }
        attempt = data.attempt;
        delay = incomingChunks.length ? 280 : Math.min(data.status === "queued" ? 1200 : 600, delay + 140);
        if (incomingChunks.length > 0) {
          for (const ch of incomingChunks) {
            const seq = ch.seq;
            if (!Number.isSafeInteger(seq) || seq < 1 || seq > lastSeq + 1) {
              return {
                success: false,
                provenance: normalizeResponseProvenance({
                  apiData: data,
                  contextMeta,
                  fallbackSource: 'error',
                  fallbackStatus: 'error',
                  jobId,
                  fallbackReason: 'INVALID_SEQUENCE',
                }),
                error: { code: "INVALID_SEQUENCE", message: "The response stream lost its place. Retry to reconnect." },
              };
            }
            if (seq > lastSeq) {
              lastSeq = seq;
              const delta = ch.delta || ch.text || '';
              accumulatedText += delta;
              onChunk?.(delta, sanitizeStreamingOutput(accumulatedText));
            }
          }
          onStatusUpdate?.({
            status: 'streaming',
            message: 'Xen is replying...',
            queuePosition: 0,
            workerAvailable: data.worker_available ?? true,
          });
        } else if (!lastSeq && (data.status === 'claimed' || data.status === 'running')) {
          onStatusUpdate?.({
            status: data.status === 'claimed' ? 'running' : 'running',
            message: data.lease_expired && data.worker_available === false
              ? 'GPU worker lease expired · waiting for recovery...'
              : 'Xen is thinking...',
            queuePosition: 0,
            workerAvailable: data.worker_available ?? true,
          });
        } else if (!lastSeq && data.status === 'queued') {
          onStatusUpdate?.({
            status: 'queued',
            message: formatQueueMessage(data),
            queuePosition: data.queue_position || 1,
            workerAvailable: data.worker_available ?? true,
          });
        }

        if (data.is_complete || data.status === 'completed') {
          isCompleted = true;
          const finalRaw = data?.response?.text ?? accumulatedText;
          const cleanText = sanitizeClientOutput(finalRaw);
          if (cleanText !== accumulatedText) {
            onChunk?.(cleanText.startsWith(accumulatedText) ? cleanText.slice(accumulatedText.length) : "", cleanText);
          }
          return {
            success: true,
            formatMode: data.format_mode,
            usage: data.usage || {},
            deliveryMode: data.delivery_mode || "batch_fallback",
            requestId: data?.request_id || jobId,
            assistant: data?.assistant ?? null,
            model: data?.model ?? null,
            intent: data?.intent || intent,
            workerAvailable: data?.worker_available ?? null,
            provenance: normalizeResponseProvenance({
              apiData: data,
              contextMeta,
              fallbackSource: 'xen_step700',
              fallbackStatus: 'completed',
              jobId,
            }),
            groundingVerification: data?.grounding_verification || null,
            response: {
              ...(data?.response || {}),
              text: cleanText,
            },
          };
        }

        if (data.is_failed || ['failed', 'expired', 'cancelled'].includes(data.status)) {
          const errObj = data.error || { code: 'INFERENCE_FAILED', message: 'Execution failed on GPU worker.' };
          return {
            success: false,
            provenance: normalizeResponseProvenance({
              apiData: data,
              contextMeta,
              fallbackSource: 'error',
              fallbackStatus: data.status || 'failed',
              jobId,
              fallbackReason: errObj.code || 'INFERENCE_FAILED',
            }),
            error: errObj,
          };
        }
      }
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errCode = errorJson.code || 'UPSTREAM_ERROR';
      return {
        success: false,
        provenance: normalizeResponseProvenance({
          apiData: errorJson,
          contextMeta,
          fallbackSource: 'error',
          fallbackStatus: 'error',
          jobId: trackedJobId,
          fallbackReason: errCode,
        }),
        error: {
          status: response.status,
          code: errCode,
          message: errorJson.error || `Xen request failed (HTTP ${response.status}).`,
          requestId: errorJson.request_id || null,
        },
      };
    }

    const data = await response.json();
    const rawText = data?.response?.text || '';
    const cleanText = sanitizeClientOutput(rawText);
    onChunk?.(cleanText, cleanText);

    return {
      success: true,
      requestId: data?.request_id || data?.id || null,
      assistant: data?.assistant ?? null,
      model: data?.model ?? null,
      intent: data?.intent || intent,
      formatMode: data?.format_mode || data?.intent || intent,
      provenance: normalizeResponseProvenance({
        apiData: data,
        contextMeta,
        fallbackSource: data?.cached ? 'cache' : 'xen_step700',
        fallbackStatus: data?.cached ? 'cached' : 'completed',
        jobId: data?.job_id || null,
      }),
      groundingVerification: data?.grounding_verification || null,
      response: {
        ...data?.response,
        text: cleanText,
      },
      usage: data?.usage || {},
    };
  } catch {
    const isAborted = activeSignal.aborted;
    const errCode = signal?.aborted ? 'CANCELLED' : isAborted ? 'TIMEOUT' : 'NETWORK_ERROR';
    return {
      success: false,
      provenance: normalizeResponseProvenance({
        contextMeta,
        fallbackSource: 'error',
        fallbackStatus: errCode.toLowerCase(),
        jobId: trackedJobId,
        fallbackReason: errCode,
      }),
      error: {
        status: isAborted ? 499 : 500,
        code: errCode,
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
      assistant: data.assistant || 'Xen',
      model: data.model || 'xen-step-700',
    };
  } catch {
    return { success: false, error: 'Failed to contact Xen status endpoint' };
  }
}

/**
 * Sync semantic CyberLab circuit/wire lifecycle state to the backend session store.
 */
export async function syncCyberLabContext({
  sessionId,
  eventType,
  eventId,
  eventSeq,
  circuitRevision,
  interactionRevision,
  contextEnvelope,
  signal,
}) {
  try {
    const res = await apiFetch('/xen/cyberlab/context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: eventType,
        event_id: eventId,
        event_seq: eventSeq,
        circuit_revision: circuitRevision,
        interaction_revision: interactionRevision,
        context_envelope: contextEnvelope,
      }),
      signal,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        stale: res.status === 409 && data?.code === 'STALE_CONTEXT_REVISION',
        error: data,
      };
    }
    return {
      success: true,
      status: res.status,
      data,
    };
  } catch (err) {
    return {
      success: false,
      status: signal?.aborted ? 499 : 500,
      error: err?.name === 'AbortError' ? { code: 'ABORTED' } : { code: 'NETWORK_ERROR' },
    };
  }
}

/**
 * Retrieve the latest persisted CyberLab circuit context snapshot for the authenticated user & session.
 */
export async function fetchCyberLabContext(sessionId, { signal } = {}) {
  try {
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    const res = await apiFetch(`/xen/cyberlab/context${query}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) return { success: false, status: res.status, error: data };
    return { success: true, status: res.status, data };
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR' } };
  }
}
