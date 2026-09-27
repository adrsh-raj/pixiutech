import * as tf from "@tensorflow/tfjs"

export type AiRuntimeMetrics = {
  mode: string
  backend: string
  loadMs: number | null
  firstInferenceMs: number | null
  averageInferenceMs: number | null
  lastInferenceMs: number | null
  inferenceCount: number
  fps: number
  tensorCount: number | null
  tensorBytes: number | null
  tensorGrowthBytes: number | null
  jsHeapBytes: number | null
  jsHeapGrowthBytes: number | null
  hardwareConcurrency: number | null
}

export const AI_PERFORMANCE_BUDGETS = {
  modelLoadWarningMs: 10_000,
  firstInferenceWarningMs: 2_500,
  steadyInferenceWarningMs: 500,
  minimumLiveFps: 2,
  maxTensorGrowthBytes: 24 * 1024 * 1024,
} as const

type MemorySnapshot = {
  tensorCount: number
  tensorBytes: number
  jsHeapBytes: number | null
}

function readMemory(): MemorySnapshot {
  let tensorCount = 0
  let tensorBytes = 0

  try {
    const memory = tf.memory()
    tensorCount = Number(memory.numTensors) || 0
    tensorBytes = Number(memory.numBytes) || 0
  } catch {
    // TensorFlow.js memory APIs can be unavailable during early boot.
  }

  const performanceMemory =
    "memory" in performance
      ? (performance as Performance & {
          memory?: { usedJSHeapSize?: number }
        }).memory
      : undefined

  const jsHeapBytes =
    performanceMemory && Number.isFinite(Number(performanceMemory.usedJSHeapSize))
      ? Number(performanceMemory.usedJSHeapSize)
      : null

  return { tensorCount, tensorBytes, jsHeapBytes }
}

export function createAiRuntimeMetrics(mode: string) {
  const startedAt = performance.now()
  const before = readMemory()
  let loadMs: number | null = null
  let firstInferenceMs: number | null = null
  let lastInferenceMs: number | null = null
  let inferenceTotal = 0
  let inferenceCount = 0
  let windowStart = performance.now()
  let windowFrames = 0
  let fps = 0

  return {
    markReady() {
      loadMs = performance.now() - startedAt
    },

    recordInference(durationMs: number) {
      const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0
      if (firstInferenceMs == null) firstInferenceMs = safeDuration
      lastInferenceMs = safeDuration
      inferenceTotal += safeDuration
      inferenceCount += 1

      windowFrames += 1
      const elapsed = performance.now() - windowStart
      if (elapsed >= 1_000) {
        fps = (windowFrames * 1_000) / elapsed
        windowFrames = 0
        windowStart = performance.now()
      }
    },

    snapshot(): AiRuntimeMetrics {
      const memory = readMemory()
      let backend = "unknown"
      try {
        backend = tf.getBackend()
      } catch {
        // TFJS may not be ready for a runtime that does not use it.
      }

      return {
        mode,
        backend,
        loadMs,
        firstInferenceMs,
        averageInferenceMs: inferenceCount
          ? inferenceTotal / inferenceCount
          : null,
        lastInferenceMs,
        inferenceCount,
        fps,
        tensorCount: memory.tensorCount,
        tensorBytes: memory.tensorBytes,
        tensorGrowthBytes: Math.max(0, memory.tensorBytes - before.tensorBytes),
        jsHeapBytes: memory.jsHeapBytes,
        jsHeapGrowthBytes:
          memory.jsHeapBytes != null && before.jsHeapBytes != null
            ? Math.max(0, memory.jsHeapBytes - before.jsHeapBytes)
            : null,
        hardwareConcurrency:
          typeof navigator !== "undefined" &&
          Number.isFinite(Number(navigator.hardwareConcurrency))
            ? Number(navigator.hardwareConcurrency)
            : null,
      }
    },

    baseline: before,
  }
}

export function getTensorMemoryGrowthBytes(
  baseline: { tensorBytes: number } | null,
): number {
  if (!baseline) return 0
  const current = readMemory()
  return Math.max(0, current.tensorBytes - baseline.tensorBytes)
}

export function isBudgetExceeded(metrics: AiRuntimeMetrics) {
  return {
    load:
      metrics.loadMs != null &&
      metrics.loadMs > AI_PERFORMANCE_BUDGETS.modelLoadWarningMs,
    firstInference:
      metrics.firstInferenceMs != null &&
      metrics.firstInferenceMs > AI_PERFORMANCE_BUDGETS.firstInferenceWarningMs,
    steadyInference:
      metrics.averageInferenceMs != null &&
      metrics.averageInferenceMs > AI_PERFORMANCE_BUDGETS.steadyInferenceWarningMs,
    fps:
      metrics.inferenceCount > 0 &&
      metrics.fps > 0 &&
      metrics.fps < AI_PERFORMANCE_BUDGETS.minimumLiveFps,
    tensorGrowth:
      (metrics.tensorGrowthBytes ?? 0) >
      AI_PERFORMANCE_BUDGETS.maxTensorGrowthBytes,
  }
}
