/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 BASELINE MODEL ADAPTER
 * 
 * Provider-neutral interface for baseline model adapters.
 * Implements:
 * 1. `DeterministicStubAdapter` for offline CI and reproducible unit testing across all 4 boards.
 * 2. `HttpBaselineModelAdapter` for live OpenAI-compatible / Qwen inference endpoints via `fetch()`.
 * 3. Strict `AbortSignal` handling for request cancellation and timeouts.
 * 
 * Invariant: The model adapter is an UNTRUSTED PROPOSER. It never mutates
 * application state or canvas directly.
 */

export interface ModelRequestOptions {
  timeoutMs?: number
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  simulateScenario?: "success" | "timeout" | "malformed" | "rate_limit" | "empty" | "oversized" | "provider_error"
}

export interface CopilotModelRequest {
  requestId: string
  prompt: string
  context: {
    targetBoard: string
    gradeBand?: number
    canvasRevisionHash?: string
    availableComponents?: string[]
    activeTelemetry?: string
  }
}

export interface ModelResponseMetadata {
  provider: string
  model: string
  version: string
  requestId: string
  durationMs: number
  inputTokens?: number
  outputTokens?: number
  finishReason?: "stop" | "length" | "timeout" | "error" | "cancelled"
}

export interface CopilotModelResponse {
  rawOutput: string
  metadata: ModelResponseMetadata
  success: boolean
  error?: {
    code: "TIMEOUT" | "RATE_LIMIT" | "PROVIDER_ERROR" | "MALFORMED" | "OVERSIZED" | "EMPTY" | "CANCELLED"
    message: string
  }
}

export interface ModelAdapter {
  generateProposal(
    request: CopilotModelRequest,
    options?: ModelRequestOptions
  ): Promise<CopilotModelResponse>
}

export interface HttpAdapterConfig {
  baseUrl?: string // e.g. "http://localhost:11434/v1" or "/api/ai-copilot"
  apiKey?: string
  model?: string // e.g. "qwen2.5-coder-7b-instruct" or "pixiu-baseline-qwen3-4b"
  defaultTimeoutMs?: number
}

/**
 * Real HTTP Baseline Model Adapter for live model inference (OpenAI-compatible / Qwen / vLLM / Ollama).
 * Uses fetch() with strict AbortSignal cancellation and timeout management.
 */
export class HttpBaselineModelAdapter implements ModelAdapter {
  private readonly baseUrl: string
  private readonly apiKey?: string
  private readonly model: string
  private readonly defaultTimeoutMs: number

  constructor(config: HttpAdapterConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "")
    this.apiKey = config.apiKey
    this.model = config.model || "qwen2.5-coder-7b-instruct"
    this.defaultTimeoutMs = config.defaultTimeoutMs || 10000
  }

  async generateProposal(
    request: CopilotModelRequest,
    options: ModelRequestOptions = {}
  ): Promise<CopilotModelResponse> {
    const startTime = Date.now()
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs

    // Setup combined AbortController for timeout and caller signal
    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    if (options.signal) {
      if (options.signal.aborted) {
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs: 0,
            finishReason: "cancelled",
          },
          error: {
            code: "CANCELLED",
            message: "Request was cancelled before invocation.",
          },
        }
      }
      options.signal.addEventListener("abort", () => controller.abort(), { once: true })
    }

    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    const systemPrompt = `You are the Pixiu CyberLab Circuit Copilot.
You must propose structured circuit plans conforming strictly to the "pixiu-copilot-proposal-v1" schema.
Output ONLY a raw JSON object with keys: schema_version, task_type, summary, assumptions, needs_clarification, proposal, capabilities.
Do not wrap in markdown or add conversational filler.`

    const userPrompt = `Target Board: ${request.context.targetBoard}
Prompt: ${request.prompt}
Context: ${JSON.stringify(request.context)}`

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`
      }

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 1024,
        }),
      })

      const durationMs = Date.now() - startTime

      if (!res.ok) {
        let errorMsg = `Inference provider HTTP error ${res.status}: ${res.statusText}`
        let errorCode: "RATE_LIMIT" | "PROVIDER_ERROR" = "PROVIDER_ERROR"
        if (res.status === 429) {
          errorCode = "RATE_LIMIT"
          errorMsg = "Rate limit exceeded by inference provider."
        }
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs,
            finishReason: "error",
          },
          error: {
            code: errorCode,
            message: errorMsg,
          },
        }
      }

      let data: any
      try {
        data = await res.json()
      } catch (jsonErr) {
        if (controller.signal.aborted) {
          throw jsonErr
        }
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs: Date.now() - startTime,
            finishReason: "error",
          },
          error: {
            code: "PROVIDER_ERROR",
            message: `Failed to parse JSON response from inference provider: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
          },
        }
      }

      const content = data?.choices?.[0]?.message?.content || ""
      const inputTokens = data?.usage?.prompt_tokens
      const outputTokens = data?.usage?.completion_tokens

      if (!content.trim()) {
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs: Date.now() - startTime,
            finishReason: "stop",
          },
          error: {
            code: "EMPTY",
            message: "Inference provider returned an empty response string.",
          },
        }
      }

      return {
        rawOutput: content,
        success: true,
        metadata: {
          provider: "http-openai-compatible",
          model: this.model,
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          inputTokens,
          outputTokens,
          finishReason: "stop",
        },
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime

      if (controller.signal.aborted) {
        const isTimeout = String(err).includes("Timeout") || !options.signal?.aborted
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs,
            finishReason: isTimeout ? "timeout" : "cancelled",
          },
          error: {
            code: isTimeout ? "TIMEOUT" : "CANCELLED",
            message: isTimeout
              ? `Model call exceeded timeout limit of ${timeoutMs}ms.`
              : "Request was cancelled by user.",
          },
        }
      }

      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "http-openai-compatible",
          model: this.model,
          version: "1.0.0",
          requestId: request.requestId,
          durationMs,
          finishReason: "error",
        },
        error: {
          code: "PROVIDER_ERROR",
          message: `Inference provider connection failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

/**
 * Deterministic Stub Adapter for offline CI and reproducible unit testing.
 * Emits schema-compliant, board-specific proposals for all 4 supported boards:
 *   - arduino-uno
 *   - esp32-devkit
 *   - rpi-pico
 *   - microbit-v2
 */
export class DeterministicStubAdapter implements ModelAdapter {
  private readonly defaultTimeoutMs: number

  constructor(defaultTimeoutMs = 10000) {
    this.defaultTimeoutMs = defaultTimeoutMs
  }

  async generateProposal(
    request: CopilotModelRequest,
    options: ModelRequestOptions = {}
  ): Promise<CopilotModelResponse> {
    const startTime = Date.now()
    const scenario = options.simulateScenario || "success"

    // Honor caller abort signal
    if (options.signal?.aborted) {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: 0,
          finishReason: "cancelled",
        },
        error: {
          code: "CANCELLED",
          message: "Request was cancelled by caller.",
        },
      }
    }

    // Simulate timeout
    if (scenario === "timeout") {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: options.timeoutMs || this.defaultTimeoutMs,
          finishReason: "timeout",
        },
        error: {
          code: "TIMEOUT",
          message: `Model call exceeded timeout limit of ${options.timeoutMs || this.defaultTimeoutMs}ms.`,
        },
      }
    }

    // Simulate rate limit
    if (scenario === "rate_limit") {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "error",
        },
        error: {
          code: "RATE_LIMIT",
          message: "Rate limit exceeded. Too many requests per second.",
        },
      }
    }

    // Simulate malformed JSON
    if (scenario === "malformed") {
      return {
        rawOutput: '{"schema_version": "pixiu-copilot-proposal-v1", "proposal": { "circuit": malformed_json_here...',
        success: true,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "stop",
        },
      }
    }

    // Simulate empty response
    if (scenario === "empty") {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "stop",
        },
        error: {
          code: "EMPTY",
          message: "Model returned an empty response string.",
        },
      }
    }

    // Simulate oversized output
    if (scenario === "oversized") {
      return {
        rawOutput: '{"huge_padding": "' + "x".repeat(250000) + '"}',
        success: true,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "length",
        },
        error: {
          code: "OVERSIZED",
          message: "Model output exceeded maximum permitted payload size.",
        },
      }
    }

    // Simulate 500 provider error
    if (scenario === "provider_error") {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "error",
        },
        error: {
          code: "PROVIDER_ERROR",
          message: "Inference provider HTTP 503 service unavailable.",
        },
      }
    }

    // Standard Success Scenario: generate proposal based on task family and board
    const promptLower = request.prompt.toLowerCase()
    const board = (request.context.targetBoard || "arduino-uno").toLowerCase()

    let payload: Record<string, unknown>

    if (promptLower.includes("ldr") || promptLower.includes("light") || promptLower.includes("nightlight")) {
      payload = this.buildLdrProposal(board)
    } else if (promptLower.includes("ultrasonic") || promptLower.includes("sonar") || promptLower.includes("distance") || promptLower.includes("buzzer")) {
      payload = this.buildUltrasonicProposal(board)
    } else if (promptLower.includes("servo") || promptLower.includes("barrier") || promptLower.includes("motor") || promptLower.includes("angle")) {
      payload = this.buildServoProposal(board)
    } else {
      payload = this.buildLedProposal(board)
    }

    const duration = Math.max(5, Date.now() - startTime)
    const rawOutput = JSON.stringify(payload, null, 2)

    return {
      rawOutput,
      success: true,
      metadata: {
        provider: "deterministic-stub",
        model: "pixiu-baseline-qwen3-4b",
        version: "1.0.0",
        requestId: request.requestId,
        durationMs: duration,
        inputTokens: Math.ceil(request.prompt.length / 4) + 120,
        outputTokens: Math.ceil(rawOutput.length / 4),
        finishReason: "stop",
      },
    }
  }

  public buildLedProposal(board: string) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "LED blink on ESP32 DevKit GPIO 2 with 220Ω series resistor",
        assumptions: [
          "GPIO Pin D2 used as output pin",
          "220Ω resistor protects LED on 3.3V power rail",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "r1", type: "resistor", x: 300, y: 100, rotation: 0, props: { resistance: 220 } },
              { id: "led1", type: "led", x: 420, y: 100, rotation: 0, props: { color: "blue" } },
            ],
            wires: [
              { id: "w1", from: { partId: "esp32", pinId: "d2" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Connected an indicator LED to ESP32 Pin D2 via a 220Ω resistor to GND_R on the 3.3V logic rail.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "LED blink on Raspberry Pi Pico GPIO 15 with 220Ω resistor",
        assumptions: [
          "GP15 digital pin used for pulse signal",
          "220Ω resistor drops 3.3V logic to safe forward voltage",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "r1", type: "resistor", x: 300, y: 100, rotation: 0, props: { resistance: 220 } },
              { id: "led1", type: "led", x: 420, y: 100, rotation: 0, props: { color: "green" } },
            ],
            wires: [
              { id: "w1", from: { partId: "pico", pinId: "gp15" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Connected Green LED to Raspberry Pi Pico Pin GP15 with 220Ω resistor to GND_1.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "External LED blink on micro:bit Pin P0 with 220Ω series resistor",
        assumptions: [
          "micro:bit Pin P0 used as digital output",
          "220Ω resistor prevents LED burnout on 3.3V logic",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "microbit", type: "microbit-v2", x: 100, y: 100, rotation: 0, props: {} },
              { id: "led1", type: "led", x: 340, y: 100, rotation: 0, props: { color: "red" } },
              { id: "r1", type: "resistor", x: 340, y: 200, rotation: 0, props: { resistance: 220 } },
            ],
            wires: [
              { id: "w_sig", from: { partId: "microbit", pinId: "p0" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w_res", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "r1", pinId: "b" }, to: { partId: "microbit", pinId: "gnd" }, color: "#1e293b" },
            ],
          },
          code: "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"microbit_display_show\" x=\"40\" y=\"40\"></block></xml>",
          explanation: "Connected an external Red LED to micro:bit Pin P0 via a 220Ω current-limiting resistor to protect the 3.3V GPIO.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    // Default: Arduino Uno
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "led_control",
      summary: "LED blink on Arduino Uno Digital Pin 13 with 220Ω current-limiting resistor",
      assumptions: [
        "Digital Pin 13 used for LED pulse signal",
        "220Ω resistor used to safely drop 5V logic to LED forward voltage",
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "led1", type: "led", x: 420, y: 120, rotation: 0, props: { color: "red" } },
            { id: "r1", type: "resistor", x: 420, y: 220, rotation: 0, props: { resistance: 220 } },
          ],
          wires: [
            { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
            { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
            { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
          ],
        },
        code: "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"arduino_program\" x=\"40\" y=\"40\"><statement name=\"SETUP\"><block type=\"io_pinmode\"><field name=\"PIN\">13</field><field name=\"MODE\">OUTPUT</field></block></statement><statement name=\"LOOP\"><block type=\"io_digitalwrite\"><field name=\"PIN\">13</field><field name=\"STATE\">HIGH</field><next><block type=\"time_delay\"><value name=\"MS\"><block type=\"math_number\"><field name=\"NUM\">1000</field></block></value><next><block type=\"io_digitalwrite\"><field name=\"PIN\">13</field><field name=\"STATE\">LOW</field><next><block type=\"time_delay\"><value name=\"MS\"><block type=\"math_number\"><field name=\"NUM\">1000</field></block></value></block></next></block></next></block></next></block></statement></block></xml>",
        explanation: "Connected Red LED to Arduino Uno Pin D13 with a 220Ω resistor protecting against overcurrent on the 5V rail.",
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified",
      },
    }
  }

  public buildLdrProposal(board: string) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on ESP32 ADC Pin D34 with indicator LED on D2",
        assumptions: [
          "10kΩ resistor forms voltage divider with LDR",
          "ADC Pin D34 reads analog light level",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 10000 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } },
            ],
            wires: [
              { id: "w1", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "esp32", pinId: "d34" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" },
              { id: "w5", from: { partId: "esp32", pinId: "d2" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "esp32", pinId: "gnd_l" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Formed an LDR voltage divider on ESP32 3.3V rail with Pin D34 reading light levels.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on Raspberry Pi Pico ADC0 (GP26)",
        assumptions: [
          "10kΩ pull-down resistor on ADC Pin GP26",
          "GP14 digital pin controls indicator LED",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 10000 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } },
            ],
            wires: [
              { id: "w1", from: { partId: "pico", pinId: "3v3" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "pico", pinId: "gp26" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" },
              { id: "w5", from: { partId: "pico", pinId: "gp14" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "pico", pinId: "gnd_2" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Constructed an LDR voltage divider on Raspberry Pi Pico ADC Pin GP26.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on micro:bit Pin P0 with external LED on Pin P1",
        assumptions: [
          "10kΩ divider resistor on analog pin P0",
          "Digital pin P1 drives external LED",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 10000 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } },
            ],
            wires: [
              { id: "w1", from: { partId: "mb", pinId: "3v" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "mb", pinId: "p0" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" },
              { id: "w5", from: { partId: "mb", pinId: "p1" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Configured an LDR divider on micro:bit Pin P0 with output alert on Pin P1.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    // Default: Arduino Uno
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "ldr_lighting",
      summary: "Light-Activated LED Nightlight with LDR voltage divider on Analog Pin A0",
      assumptions: [
        "10kΩ pull-down resistor forms voltage divider with LDR",
        "Analog Pin A0 samples light intensity",
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "ldr1", type: "ldr", x: 360, y: 80, rotation: 0, props: {} },
            { id: "r_div", type: "resistor", x: 360, y: 170, rotation: 0, props: { resistance: 10000 } },
            { id: "led1", type: "led", x: 500, y: 120, rotation: 0, props: { color: "green" } },
            { id: "r_led", type: "resistor", x: 500, y: 220, rotation: 0, props: { resistance: 220 } },
          ],
          wires: [
            { id: "w_5v", from: { partId: "uno", pinId: "5v" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
            { id: "w_div", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
            { id: "w_a0", from: { partId: "ldr1", pinId: "b" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
            { id: "w_gnd1", from: { partId: "r_div", pinId: "b" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_d12", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
            { id: "w_anode", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
            { id: "w_gnd2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
          ],
        },
        code: null,
        explanation: "Constructed an LDR voltage divider on Analog Pin A0 with a 10kΩ resistor, driving an indicator LED on Digital Pin 12.",
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified",
      },
    }
  }

  public buildUltrasonicProposal(board: string) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on ESP32 DevKit with buzzer alert",
        assumptions: [
          "Trigger on Pin D5, Echo on Pin D18",
          "Warning buzzer on Pin D23",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "esp32", pinId: "gnd_l" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "esp32", pinId: "d5" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "esp32", pinId: "d18" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "esp32", pinId: "d23" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Ultrasonic sensor on ESP32 with Trigger on D5 and Echo on D18, with buzzer on D23.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on Raspberry Pi Pico",
        assumptions: [
          "Trigger on GP14, Echo on GP15",
          "Buzzer on GP13",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "pico", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "pico", pinId: "gnd_2" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "pico", pinId: "gp14" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "pico", pinId: "gp15" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "pico", pinId: "gp13" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "pico", pinId: "gnd_3" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Ultrasonic sensor on Raspberry Pi Pico Trigger GP14, Echo GP15, with buzzer on GP13.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on micro:bit V2",
        assumptions: [
          "Trigger on Pin P0, Echo on Pin P1",
          "Buzzer on Pin P2",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "mb", pinId: "3v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "mb", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "mb", pinId: "p0" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "mb", pinId: "p1" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "mb", pinId: "p2" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" },
            ],
          },
          code: null,
          explanation: "Ultrasonic sensor on micro:bit with Trigger on P0, Echo on P1, and buzzer on P2.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    // Default: Arduino Uno
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "ultrasonic_alert",
      summary: "Ultrasonic Distance Alert with HC-SR04 sonar and active buzzer",
      assumptions: [
        "Trigger on D9, Echo on D10",
        "Buzzer on D8 triggers below distance threshold",
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
            { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} },
          ],
          wires: [
            { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
            { id: "w_gnd1", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_trig", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
            { id: "w_echo", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
            { id: "w_bz_pos", from: { partId: "uno", pinId: "d8" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
            { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
          ],
        },
        code: null,
        explanation: "HC-SR04 ultrasonic sensor connected to 5V rail with Trigger on D9 and Echo on D10, accompanied by a warning buzzer on D8.",
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified",
      },
    }
  }

  public buildServoProposal(board: string) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on ESP32 PWM Pin D13",
        assumptions: [
          "Servo signal connected to PWM Pin D13",
          "Servo VCC connected to 3.3V power rail with shared ground",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "esp32", pinId: "gnd_r" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "esp32", pinId: "d13" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" },
            ],
          },
          code: null,
          explanation: "Servo motor attached to ESP32 Pin D13 for angle positioning.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on Raspberry Pi Pico GP16",
        assumptions: [
          "Servo signal connected to PWM GP16",
          "Servo VCC connected to 3.3V rail with shared ground",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "pico", pinId: "3v3" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "pico", pinId: "gnd_1" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "pico", pinId: "gp16" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" },
            ],
          },
          code: null,
          explanation: "Servo motor connected to Raspberry Pi Pico GP16 for servo angle positioning.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on micro:bit Pin P0",
        assumptions: [
          "Servo signal on analog/PWM pin P0",
          "Servo power on 3V with shared ground",
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } },
            ],
            wires: [
              { id: "w_vcc", from: { partId: "mb", pinId: "3v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "mb", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "mb", pinId: "p0" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" },
            ],
          },
          code: null,
          explanation: "Servo motor connected to micro:bit Pin P0 for angle positioning.",
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified",
        },
      }
    }

    // Default: Arduino Uno
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "servo_control",
      summary: "Servo motor angle controller connected to PWM Pin D9",
      assumptions: [
        "Servo signal connected to PWM-capable Digital Pin D9",
        "Servo VCC connected to 5V power rail with shared ground",
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } },
          ],
          wires: [
            { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
            { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_sig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" },
          ],
        },
        code: null,
        explanation: "Servo motor attached to 5V, GND, and PWM pin D9 for angle positioning.",
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified",
      },
    }
  }
}

/**
 * Factory function to create the active baseline model adapter.
 */
export function createBaselineModelAdapter(
  config?: Partial<HttpAdapterConfig> & { mode?: "stub" | "http" }
): ModelAdapter {
  if (config?.mode === "http") {
    return new HttpBaselineModelAdapter(config)
  }
  return new DeterministicStubAdapter(config?.defaultTimeoutMs)
}
