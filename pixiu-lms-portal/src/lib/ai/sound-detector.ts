import * as tf from "@tensorflow/tfjs"

export type SoundDetection = {
  label: string
  confidence: number
  scores: Record<string, number>
  isActionable: boolean
}

export type SoundRecognizer = {
  version: string
  labels: string[]
  isListening: () => boolean
  start: (
    onResult: (detection: SoundDetection) => void,
  ) => Promise<void>
  stop: () => Promise<void>
}

const SPEECH_VERSION = "0.5.4"
const SPEECH_SCRIPT = "/vendor/tfjs/speech-commands/speech-commands.min.js"

declare global {
  interface Window {
    tf?: typeof tf
    speechCommands?: {
      create: (inputType: string, vocabulary?: string) => any
    }
  }
}

const scriptLoads = new Map<string, Promise<void>>()

function ensureBrowserAudio() {
  if (typeof window === "undefined") {
    throw new Error("PIXIU Sound AI needs a browser.")
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone input.")
  }
}

async function loadScript(src: string): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser required.")
  if (window.speechCommands) return

  const existing = scriptLoads.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      `script[data-pixiu-speech-src="${src}"]`,
    )

    if (current && window.speechCommands) {
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
      if (window.speechCommands) resolve()
      else reject(new Error("Speech Commands loaded without its runtime."))
    }

    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error("Speech Commands could not be loaded."))
    }

    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", onError, { once: true })

    if (!current) {
      script.async = true
      script.src = src
      script.dataset.pixiuSpeechSrc = src
      document.head.appendChild(script)
    }

    window.setTimeout(() => {
      if (settled) return
      if (window.speechCommands) onLoad()
      else onError()
    }, 30000)
  })

  scriptLoads.set(src, promise)
  promise.catch(() => scriptLoads.delete(src))
  return promise
}

async function ensureSpeechRuntime() {
  ensureBrowserAudio()

  if (window.speechCommands) return

  await loadScript(SPEECH_SCRIPT)
  if (!window.speechCommands) {
    throw new Error("Local Speech Commands runtime loaded without its API.")
  }
}

function normalizeScores(labels: string[], scores: ArrayLike<number>) {
  const result: Record<string, number> = {}
  labels.forEach((label, index) => {
    result[label] = Math.round(Number(scores[index] ?? 0) * 100)
  })
  return result
}

export async function loadSoundRecognizer(): Promise<SoundRecognizer> {
  // Speech Commands uses TensorFlow.js through the browser global in its CDN build.
  if (typeof window !== "undefined") window.tf = tf
  await tf.ready()
  await ensureSpeechRuntime()

  const recognizer = window.speechCommands!.create("BROWSER_FFT", "18w")
  await recognizer.ensureModelLoaded()

  const labels = recognizer.wordLabels()
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error("Speech Commands model returned no vocabulary.")
  }

  let listening = false
  let starting = false
  let generation = 0
  return {
    version: SPEECH_VERSION,
    labels,
    isListening: () => listening || Boolean(recognizer.isListening?.()),
    async start(onResult) {
      if (listening || starting) return

      const request = ++generation
      starting = true
      // Mark the session active before listen() so the very first recognition
      // callback is not discarded while the underlying audio stream starts.
      listening = true

      try {
        await recognizer.listen(
          (result: any) => {
            if (request !== generation || !listening) return

            const rawScores = Array.from(result?.scores ?? []) as number[]
            // Some mobile/audio stacks can surface NaN probabilities. Never
            // leak NaN into the normalized AI state or UI percentages.
            const scores = rawScores.map((value) => {
              const numeric = Number(value)
              return Number.isFinite(numeric)
                ? Math.max(0, Math.min(1, numeric))
                : 0
            })

            let bestIndex = 0
            for (let index = 1; index < scores.length; index += 1) {
              if ((scores[index] ?? 0) > (scores[bestIndex] ?? 0)) {
                bestIndex = index
              }
            }

            const label = labels[bestIndex] ?? "unknown"
            const bestScore = Number(scores[bestIndex] ?? 0)
            const confidence = Math.round(bestScore * 100)
            const hasUsableSignal = scores.some((score) => score > 0)
            const isNoise =
              !hasUsableSignal ||
              label === "background_noise" ||
              label === "unknown"

            onResult({
              label: isNoise ? "none" : label,
              confidence: isNoise ? 0 : confidence,
              scores: normalizeScores(labels, scores),
              isActionable: !isNoise && confidence >= 72,
            })
          },
          {
            probabilityThreshold: 0.72,
            overlapFactor: 0.25,
            suppressionTimeMillis: 650,
            invokeCallbackOnNoiseAndUnknown: true,
            includeSpectrogram: false,
          },
        )

        if (request !== generation) {
          if (recognizer.isListening?.()) {
            try {
              await recognizer.stopListening()
            } catch {}
          }
          listening = false
          return
        }
      } catch (error) {
        // listen() can fail after the mic has already opened. Always tear down
        // the native recognizer before returning the error to the UI.
        if (recognizer.isListening?.()) {
          try {
            await recognizer.stopListening()
          } catch {}
        }
        if (request === generation) {
          listening = false
        }
        throw error
      } finally {
        starting = false
      }
    },
    async stop() {
      generation += 1
      if (!listening && !starting) return

      try {
        if (recognizer.isListening?.()) {
          await recognizer.stopListening()
        }
      } finally {
        listening = false
        starting = false
      }
    },
  }
}

export async function stopSoundRecognizer(recognizer: SoundRecognizer | null) {
  await recognizer?.stop()
}
