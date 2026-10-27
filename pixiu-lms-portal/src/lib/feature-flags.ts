/**
 * PIXIU TECH CYBERLAB — FEATURE FLAGS
 * 
 * Centralized feature flags for CyberLab and AI Copilot capabilities.
 * 
 * Core Invariants:
 * 1. Default-off for unreleased / draft features.
 * 2. Phase 2F Science Tutor is strictly disabled by default (opt-in only)
 *    because 8 science records remain draft, 24 rights decisions remain proposed,
 *    and 0 records are release-ready.
 * 3. Explicit opt-in requires VITE_ENABLE_PHASE2F_SCIENCE="true".
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

export interface FeatureFlags {
  enablePhase2fScienceTutor: boolean
  enablePixiuAiCopilot: boolean
}

/**
 * Returns whether Phase 2F draft science tutor answers are enabled.
 * Strictly default-off (false) in production and standard runtime.
 */
export function isPhase2fScienceTutorEnabled(): boolean {
  // Check Vite client-side environment (browser / bundle)
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      if (String(import.meta.env.VITE_ENABLE_PHASE2F_SCIENCE || "").toLowerCase() === "true") {
        return true
      }
    }
  } catch {}

  // Check Node.js / SSR / test environment
  try {
    if (typeof process !== "undefined" && process.env) {
      if (String(process.env.VITE_ENABLE_PHASE2F_SCIENCE || "").toLowerCase() === "true") {
        return true
      }
    }
  } catch {}

  return false
}

/**
 * Returns whether PixiuAI Copilot is enabled.
 * Enabled for CyberLab Virtual Lab with AI features unlocked.
 */
export function isPixiuAiCopilotEnabled(): boolean {
  return true
}

/**
 * Returns a snapshot of all active feature flags.
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    enablePhase2fScienceTutor: isPhase2fScienceTutorEnabled(),
    enablePixiuAiCopilot: isPixiuAiCopilotEnabled(),
  }
}
