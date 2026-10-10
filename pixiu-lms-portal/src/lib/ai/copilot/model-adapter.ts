/**
 * PIXIU TECH CYBERLAB — AI COPILOT PHASE 3 BASELINE MODEL ADAPTER
 * 
 * Provider-neutral interface for baseline model adapters.
 * Implements deterministic stubbing for offline CI/testing and structured
 * metadata normalization (duration, token counts, error taxonomy).
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
  finishReason?: "stop" | "length" | "timeout" | "error"
}

export interface CopilotModelResponse {
  rawOutput: string
  metadata: ModelResponseMetadata
  success: boolean
  error?: {
    code: "TIMEOUT" | "RATE_LIMIT" | "PROVIDER_ERROR" | "MALFORMED" | "OVERSIZED" | "EMPTY"
    message: string
  }
}

export interface ModelAdapter {
  generateProposal(
    request: CopilotModelRequest,
    options?: ModelRequestOptions
  ): Promise<CopilotModelResponse>
}

/**
 * Deterministic Stub Adapter for offline CI and reproducible unit testing.
 * Emits schema-compliant, board-specific proposals for the 4 supported task families.
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

    // Standard Success Scenario: generate proposal based on task family inferred from prompt
    const promptLower = request.prompt.toLowerCase()
    const board = request.context.targetBoard || "arduino-uno"

    let payload: Record<string, unknown>

    if (promptLower.includes("ldr") || promptLower.includes("light") || promptLower.includes("nightlight")) {
      payload = this.buildLdrProposal(board)
    } else if (promptLower.includes("ultrasonic") || promptLower.includes("sonar") || promptLower.includes("distance") || promptLower.includes("buzzer")) {
      payload = this.buildUltrasonicProposal(board)
    } else if (promptLower.includes("servo") || promptLower.includes("barrier") || promptLower.includes("motor") || promptLower.includes("angle")) {
      payload = this.buildServoProposal(board)
    } else {
      // Default to LED control
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

  private buildLedProposal(board: string) {
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

  private buildLdrProposal(board: string) {
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

  private buildUltrasonicProposal(board: string) {
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

  private buildServoProposal(board: string) {
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
