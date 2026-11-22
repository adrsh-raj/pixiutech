/**
 * Client library for PixiuMind Xen AI Tutor API.
 * Connects strictly to authenticated Django backend endpoints (/api/v1/xen/...)
 * Never communicates directly with private GPU inference servers.
 */

import { API_BASE } from '../../../config/api.js';

// Special tokens that must NEVER appear in the client DOM
const SPECIAL_STOP_TOKENS = [
  '<|im_end|>',
  '<|im_start|>',
  '<|endoftext|>',
  '<|im_start|>assistant',
  '<|im_start|>user',
  '<|im_start|>system',
];

/**
 * Defensive client-side sanitizer to prevent token leakage into the DOM.
 */
export function sanitizeClientOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  for (const token of SPECIAL_STOP_TOKENS) {
    if (cleaned.includes(token)) {
      cleaned = cleaned.replaceAll(token, '');
    }
  }
  // Strip any residual ChatML tags like <|im_...
  cleaned = cleaned.replace(/<\|im_[a-z0-9_]*\|?>?/gi, '');
  return cleaned.trim();
}

/**
 * Send a chat/tutoring prompt to the Django Xen endpoint.
 */
export async function sendXenChat({
  prompt,
  intent = 'TEACHING',
  history = [],
  maxTokens = 1024,
  temperature = 0.1,
  signal = null,
  timeoutMs = 60000,
}) {
  const controller = new AbortController();
  const activeSignal = signal || controller.signal;

  let timeoutId = null;
  if (!signal) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(`${API_BASE}/xen/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      signal: activeSignal,
      body: JSON.stringify({
        prompt,
        intent,
        history,
        max_tokens: maxTokens,
        temperature,
        idempotency_key: `xen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          status: response.status,
          code: errorJson.code || 'UPSTREAM_ERROR',
          message: errorJson.error || `HTTP ${response.status} error from Xen proxy.`,
        },
      };
    }

    const data = await response.json();
    const rawText = data?.response?.text || '';
    const cleanText = sanitizeClientOutput(rawText);

    return {
      success: true,
      model: data?.model || 'pixiumind-step-700',
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
  } catch (err) {
    const isAborted = activeSignal.aborted;
    return {
      success: false,
      error: {
        status: isAborted ? 499 : 500,
        code: isAborted ? 'CANCELLED' : 'NETWORK_ERROR',
        message: isAborted ? 'Request was cancelled by the user.' : (err?.message || 'Network request failed'),
      },
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Query the Xen server health status.
 */
export async function fetchXenHealth() {
  try {
    const res = await fetch(`${API_BASE}/xen/health`, {
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return { healthy: false, status: res.status };
    const data = await res.json();
    return { healthy: data.status === 'healthy', data };
  } catch {
    return { healthy: false, error: 'Failed to contact Xen health endpoint' };
  }
}
