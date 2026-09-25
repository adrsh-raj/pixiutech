import * as tf from "@tensorflow/tfjs"

export const HUMAN_VERSION = "3.3.6"
export const HUMAN_CDN_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js",
  "https://unpkg.com/@vladmandic/human@3.3.6/dist/human.js",
]

declare global {
  interface Window {
    tf?: typeof tf
    Human?: {
      Human: new (config?: Record<string, unknown>) => any
    }
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PIXIU AI needs a browser."))
  }

  if (window.Human?.Human) return Promise.resolve()

  const existing = scriptLoads.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-human-src="${src}"]`,
    )

    if (current && window.Human?.Human) {
      resolve()
      return
    }

    const script = current ?? document.createElement("script")
    let settled = false

    const cleanup = () => {
      script.removeEventListener("load", onLoad)
      script.removeEventListener("error", onError)
    }

    const onLoad = () => {
      if (settled) return
      settled = true
      cleanup()
      if (window.Human?.Human) resolve()
      else reject(new Error(`Human AI ${HUMAN_VERSION} loaded without its runtime.`))
    }

    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error("Human AI runtime could not be loaded."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })

    if (!current) {
      script.async = true
      script.src = src
      script.dataset.pixiuHumanSrc = src
      document.head.appendChild(script)
    }

    window.setTimeout(() => {
      if (settled) return
      if (window.Human?.Human) onLoad()
      else onError()
    }, 30000)
  })

  scriptLoads.set(src, promise)
  promise.catch(() => scriptLoads.delete(src))
  return promise
}

export async function ensureHumanRuntime(): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("PIXIU AI needs a browser.")
  }

  window.tf = tf
  await tf.ready()

  if (window.Human?.Human) return

  let lastError: unknown = null
  for (const src of HUMAN_CDN_SOURCES) {
    try {
      await loadScript(src)
      if (window.Human?.Human) return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Human AI runtime could not be loaded.")
}

export async function createHuman(config: Record<string, unknown>): Promise<any> {
  await ensureHumanRuntime()

  const human = new window.Human!.Human({
    backend: "webgl",
    debug: false,
    cacheModels: true,
    cacheSensitivity: 0.01,
    modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/",
    filter: { enabled: false },
    face: { enabled: false },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: false },
    segmentation: { enabled: false },
    ...config,
  })

  await human.load()
  return human
}

export function disposeHuman(human: any): void {
  try {
    human?.models?.reset?.()
  } catch {}

  try {
    human?.reset?.()
  } catch {}
}
