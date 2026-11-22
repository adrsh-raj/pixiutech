// src/lib/ai/copilot/blockly-repair-middleware.ts
var VERIFIED_BLOCK_ALIASES = Object.freeze({
  // pir_motion_detected has field PIN -> pir_motion has field PIN, generates digitalRead
  pir_motion_detected: "pir_motion",
  // actuator_servo_write has field PIN, value ANGLE -> servo_write has field PIN, value ANGLE
  actuator_servo_write: "servo_write",
  // io_tone -> tone_play
  io_tone: "tone_play",
  // io_notone -> tone_stop
  io_notone: "tone_stop"
});
var UNKNOWN_UNSUPPORTED_BLOCKS = /* @__PURE__ */ new Set([
  "max6675_read",
  "max6675_init",
  "t777_display_write",
  "tm1637_init",
  "tm1637_display",
  "servo_read",
  "serial_read",
  "serial_available",
  "time_millis"
]);
function repairBlocklyXml(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions: [],
      unsupportedBlocks: [],
      error: "Empty or invalid response text"
    };
  }
  const actions = [];
  let rawXml = null;
  const fencedMatch = rawText.match(/```(?:xml)?\s*(<xml[\s\S]*?(?:<\/xml>|$))\s*```/i);
  if (fencedMatch) {
    rawXml = fencedMatch[1].trim();
  } else {
    const bareMatch = rawText.match(/(<xml[\s\S]*?(?:<\/xml>|$))/i);
    if (bareMatch) {
      rawXml = bareMatch[1].trim();
    } else {
      const rootBlockMatch = rawText.match(/(<block\s+type=["']arduino_program["'][\s\S]*)/i);
      if (rootBlockMatch) {
        rawXml = `<xml xmlns="https://developers.google.com/blockly/xml">
${rootBlockMatch[1].trim()}
</xml>`;
        actions.push("WRAPPED_ROOT_BLOCK_IN_XML");
      }
    }
  }
  if (!rawXml) {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions,
      unsupportedBlocks: [],
      error: "No Blockly XML found in response text"
    };
  }
  let xml = rawXml.trim();
  let isHealed = false;
  if (!xml.endsWith("</xml>")) {
    isHealed = true;
    actions.push("HEALED_TRUNCATED_TAGS");
    xml = xml.replace(/<[^>]*$/, "").trim();
    let stripped = true;
    while (stripped) {
      const prev = xml;
      xml = xml.replace(/<next>\s*$/i, "");
      xml = xml.replace(/<(?:value|statement)[^>]*>\s*$/i, "");
      stripped = xml !== prev;
    }
    xml = xml.trim();
    const tagMatches = xml.match(/<(\/?[a-zA-Z0-9_-]+)[^>]*>/g) || [];
    const openStack = [];
    const voidTags = /* @__PURE__ */ new Set(["shadow"]);
    for (const token of tagMatches) {
      const tagNameMatch = token.match(/<(\/?)([a-zA-Z0-9_-]+)/);
      if (!tagNameMatch) continue;
      const isClosing = tagNameMatch[1] === "/";
      const tagName = tagNameMatch[2].toLowerCase();
      if (isClosing) {
        if (openStack.length > 0 && openStack[openStack.length - 1] === tagName) {
          openStack.pop();
        }
      } else {
        if (!token.endsWith("/>") && !voidTags.has(tagName)) {
          openStack.push(tagName);
        }
      }
    }
    for (let i = openStack.length - 1; i >= 0; i--) {
      xml += `</${openStack[i]}>`;
    }
    if (!xml.endsWith("</xml>")) {
      xml += "</xml>";
    }
  }
  let parseValid = true;
  let parseErrorMsg = "";
  try {
    const openTags = [];
    const tags = xml.match(/<(\/?[a-zA-Z0-9_-]+)[^>]*>/g) || [];
    for (const t of tags) {
      const m = t.match(/<(\/?)([a-zA-Z0-9_-]+)/);
      if (!m) continue;
      const isClose = m[1] === "/";
      const name = m[2].toLowerCase();
      if (t.endsWith("/>")) continue;
      if (isClose) {
        const popped = openTags.pop();
        if (popped !== name) {
          parseValid = false;
          parseErrorMsg = `Mismatched tag: expected </${popped}>, found </${name}>`;
          break;
        }
      } else {
        openTags.push(name);
      }
    }
    if (openTags.length > 0) {
      parseValid = false;
      parseErrorMsg = `Unclosed tags remaining: ${openTags.join(", ")}`;
    }
  } catch (err) {
    parseValid = false;
    parseErrorMsg = err instanceof Error ? err.message : String(err);
  }
  if (!parseValid) {
    return {
      repairedXml: null,
      success: false,
      isHealed,
      actions,
      unsupportedBlocks: [],
      error: `XML healing failed: ${parseErrorMsg}`
    };
  }
  if (!xml.includes('xmlns="https://developers.google.com/blockly/xml"')) {
    xml = xml.replace(/<xml(?:\s+[^>]*)?>/i, '<xml xmlns="https://developers.google.com/blockly/xml">');
    actions.push("INJECTED_GOOGLE_XML_NAMESPACE");
  }
  for (const [srcAlias, targetBlock] of Object.entries(VERIFIED_BLOCK_ALIASES)) {
    const pattern = new RegExp(`type=["']${srcAlias}["']`, "g");
    if (pattern.test(xml)) {
      xml = xml.replace(pattern, `type="${targetBlock}"`);
      actions.push(`ALIASED_${srcAlias}_TO_${targetBlock}`);
    }
  }
  const detectedBlocks = Array.from(xml.matchAll(/type=["']([^"']+)["']/g)).map((m) => m[1]);
  const unsupported = detectedBlocks.filter((b) => UNKNOWN_UNSUPPORTED_BLOCKS.has(b));
  if (unsupported.length > 0) {
    return {
      repairedXml: xml,
      success: false,
      isHealed,
      actions,
      unsupportedBlocks: Array.from(new Set(unsupported)),
      error: `Unsupported peripheral blocks detected: ${Array.from(new Set(unsupported)).join(", ")}. These hardware blocks are not defined in the Pixiu LMS toolbox.`
    };
  }
  return {
    repairedXml: xml,
    success: true,
    isHealed,
    actions,
    unsupportedBlocks: []
  };
}
function wrapCopilotPrompt(prompt, options = {}) {
  const parts = [];
  if (options.domain === "math") {
    parts.push(
      "[PEDAGOGICAL GUARDRAIL: In Math Teaching mode, ask the student a diagnostic guiding question first. Do not provide the complete algebraic solution in Turn 1.]"
    );
  }
  if (options.hasInductiveLoad) {
    parts.push(
      "[HARDWARE SAFETY GUARDRAIL: Inductive Load Protection (ATmega328P Datasheet Sec. 32): MCU pins cannot supply coil current (>20mA recommended continuous, 40mA absolute maximum). An external driver (BJT/MOSFET/relay module) is mandatory. Select flyback protection based on load switching frequency:\n1) Low-frequency switching (<100Hz, DC relay coils): Standard silicon rectifier (1N4007, 1A/1000V, trr \u2248 30\xB5s) is acceptable.\n2) High-frequency PWM motor/fan control (Uno PWM 490/980Hz): Use a fast-recovery or Schottky diode (1N5819 / SS14 / 1N5822, trr < 10ns, VF \u2264 0.45V) to eliminate reverse-recovery heating, shoot-through spikes, and driver stress.\n3) Micro servos (SG90): Internal H-bridge; control line draws <1mA logic pulses; provide external 5V/GND rail to prevent MCU brownout when stall current exceeds 20mA.]"
    );
  } else if (options.domain === "circuit") {
    parts.push(
      "[CIRCUIT GUARDRAIL: ATmega328P continuous DC current limit is 20mA per I/O pin (200mA total VCC/GND limit). Use series current-limiting resistors for all LEDs.]"
    );
  }
  parts.push(prompt.trim());
  return parts.join("\n\n");
}

// src/lib/ai/copilot/task-router.ts
var SUPPORTED_BOARDS = [
  "arduino-uno",
  "esp32-devkit",
  "microbit-v2",
  "rpi-pico"
];
function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function routeUserRequest(prompt, context = {}) {
  const norm = normalizeText(prompt);
  const targetBoard = (context.targetBoard || "arduino-uno").toLowerCase();
  const highRiskPatterns = [
    /\b(220v|110v|mains|ac voltage|high voltage|socket|power outlet|relay 240v)\b/i,
    /\b(hack|exploit|short circuit the mains|burn)\b/i
  ];
  for (const pattern of highRiskPatterns) {
    if (pattern.test(norm)) {
      return {
        route: "unsupported",
        confidence: 1,
        normalizedGoal: "High-voltage or mains power request",
        targetBoard,
        missingContext: [],
        riskFlags: ["HIGH_VOLTAGE_MAINS_SAFETY_VIOLATION"],
        clarificationPrompt: "Pixiu CyberLab only simulates safe low-voltage DC microcontrollers (3.3V / 5V). Mains electricity (110V/220V AC) is strictly unsupported for safety."
      };
    }
  }
  const isSupportedBoard = SUPPORTED_BOARDS.includes(targetBoard);
  if (!isSupportedBoard) {
    return {
      route: "unsupported",
      confidence: 0.9,
      normalizedGoal: "Unsupported board target",
      targetBoard,
      missingContext: ["target_board"],
      riskFlags: ["UNSUPPORTED_BOARD"],
      clarificationPrompt: `The board '${targetBoard}' is not supported in Phase 3. Supported boards are: ${SUPPORTED_BOARDS.join(", ")}.`
    };
  }
  const ultrasonicMatches = [
    /\b(ultrasonic|sonar|distance|range|hc\s*sr04|obstacle|proximity)\b/i,
    /\b(door\s*sensor|barrier\s*sonar|object\s*detect)\b/i,
    /\b(doori|durie|distance\s*measure)\b/i
    // Hinglish
  ];
  const isUltrasonic = ultrasonicMatches.some((re) => re.test(norm));
  const servoMatches = [
    /\b(servo|angle|motor\s*position|boom\s*barrier|gate\s*servo|swing\s*arm)\b/i,
    /\b(ghuma|ghumana|rotate\s*servo|degree)\b/i
    // Hinglish
  ];
  const isServo = servoMatches.some((re) => re.test(norm));
  const ldrMatches = [
    /\b(ldr|light\s*sensor|photoresistor|night\s*light|nightlight|automatic\s*light|street\s*light)\b/i,
    /\b(roshni|andhera|light\s*detect|darkness\s*sensor)\b/i
    // Hinglish
  ];
  const isLdr = ldrMatches.some((re) => re.test(norm));
  const ledMatches = [
    /\b(led|blink|blinking|flash|glow|turn\s*on\s*led|toggle\s*led)\b/i,
    /\b(chalao|jalao|batti|light\s*on)\b/i
    // Hinglish
  ];
  const isLed = ledMatches.some((re) => re.test(norm));
  const matchedTasks = [];
  if (isUltrasonic) matchedTasks.push("ultrasonic_alert");
  if (isServo) matchedTasks.push("servo_control");
  if (isLdr) matchedTasks.push("ldr_lighting");
  if (isLed && matchedTasks.length === 0) matchedTasks.push("led_control");
  if (isUltrasonic && isServo) {
    if (norm.includes("distance") || norm.includes("buzzer") || norm.includes("detect")) {
      return {
        route: "ultrasonic_alert",
        taskType: "ultrasonic_alert",
        confidence: 0.88,
        normalizedGoal: "Ultrasonic distance alert with warning buzzer",
        targetBoard,
        missingContext: [],
        riskFlags: []
      };
    }
    return {
      route: "servo_control",
      taskType: "servo_control",
      confidence: 0.88,
      normalizedGoal: "Servo gate positioning",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  if (isUltrasonic) {
    return {
      route: "ultrasonic_alert",
      taskType: "ultrasonic_alert",
      confidence: 0.95,
      normalizedGoal: "Ultrasonic obstacle/distance detection with buzzer",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  if (isServo) {
    return {
      route: "servo_control",
      taskType: "servo_control",
      confidence: 0.95,
      normalizedGoal: "Servo motor angle and position control",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  if (isLdr) {
    return {
      route: "ldr_lighting",
      taskType: "ldr_lighting",
      confidence: 0.95,
      normalizedGoal: "LDR voltage divider automatic light control",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  if (isLed) {
    return {
      route: "led_control",
      taskType: "led_control",
      confidence: 0.95,
      normalizedGoal: "LED digital state and blink control",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  const mathMatches = [
    /\b(math|algebra|equation|solve|calculate|theorem|fraction|pythagor|quadratic|triangle|geometry|derivation)\b/i
  ];
  const isMath = mathMatches.some((re) => re.test(norm));
  if (isMath && !isLed && !isLdr && !isServo && !isUltrasonic) {
    return {
      route: "math_teaching",
      taskType: "math_teaching",
      confidence: 0.95,
      normalizedGoal: "Mathematics tutoring and concept scaffolding",
      targetBoard,
      missingContext: [],
      riskFlags: []
    };
  }
  if (norm.length < 15 || /^(help|circuit|bana do|project|make something|hi|hello)$/i.test(norm)) {
    return {
      route: "needs_clarification",
      confidence: 0.4,
      normalizedGoal: "Vague or underspecified circuit request",
      targetBoard,
      missingContext: ["task_goal", "components"],
      riskFlags: ["UNDERSPECIFIED_INTENT"],
      clarificationPrompt: "What kind of circuit would you like to build? You can ask for: 1) LED blink, 2) Automatic nightlight with LDR, 3) Ultrasonic distance alert with buzzer, or 4) Servo motor angle control."
    };
  }
  return {
    route: "unsupported",
    confidence: 0.9,
    normalizedGoal: "Unsupported general query",
    targetBoard,
    missingContext: [],
    riskFlags: ["OUT_OF_SCOPE_REQUEST"],
    clarificationPrompt: "This request is outside the 4 supported Phase 3 circuit tasks. Please choose from: LED blink, LDR automatic lighting, Ultrasonic alert, or Servo control."
  };
}

// src/lib/ai/copilot/model-adapter.ts
var HttpBaselineModelAdapter = class {
  baseUrl;
  apiKey;
  model;
  defaultTimeoutMs;
  constructor(config = {}) {
    const rawUrl = config.baseUrl ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_ENDPOINT_URL : void 0) ?? "";
    this.baseUrl = rawUrl.trim().replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_API_KEY : void 0);
    this.model = config.model ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_MODEL_ID : void 0) ?? "pixiumind-14b-checkpoint-400";
    this.defaultTimeoutMs = config.defaultTimeoutMs || 1e4;
  }
  async generateProposal(request, options = {}) {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    if (!this.baseUrl) {
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "http-openai-compatible",
          model: this.model,
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: 0,
          finishReason: "error"
        },
        error: {
          code: "PROVIDER_ERROR",
          message: "PIXIUMIND_ENDPOINT_URL is not configured. No active GPU inference service is reachable."
        }
      };
    }
    const controller = new AbortController();
    let timeoutId;
    let abortListener;
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
            finishReason: "cancelled"
          },
          error: {
            code: "CANCELLED",
            message: "Request was cancelled before invocation."
          }
        };
      }
      abortListener = () => controller.abort();
      options.signal.addEventListener("abort", abortListener, { once: true });
    }
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    const systemPrompt = `You are the Pixiu CyberLab Circuit Copilot.
You must propose structured circuit plans conforming strictly to the "pixiu-copilot-proposal-v1" schema.
Output ONLY a raw JSON object with keys: schema_version, task_type, summary, assumptions, needs_clarification, proposal, capabilities.
Do not wrap in markdown or add conversational filler.`;
    const wrappedPrompt = wrapCopilotPrompt(request.prompt, {
      domain: "circuit",
      hasInductiveLoad: /motor|servo|fan|relay|pump|solenoid/i.test(request.prompt)
    });
    const userPrompt = `Target Board: ${request.context.targetBoard}
Prompt: ${wrappedPrompt}
Context: ${JSON.stringify(request.context)}`;
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 1024
        })
      });
      const durationMs = Date.now() - startTime;
      if (!res.ok) {
        let errorMsg = `Inference provider HTTP error ${res.status}: ${res.statusText}`;
        let errorCode = "PROVIDER_ERROR";
        if (res.status === 429) {
          errorCode = "RATE_LIMIT";
          errorMsg = "Rate limit exceeded by inference provider.";
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
            finishReason: "error"
          },
          error: {
            code: errorCode,
            message: errorMsg
          }
        };
      }
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        if (controller.signal.aborted) {
          throw jsonErr;
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
            finishReason: "error"
          },
          error: {
            code: "PROVIDER_ERROR",
            message: `Failed to parse JSON response from inference provider: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`
          }
        };
      }
      const content = data?.choices?.[0]?.message?.content || "";
      const inputTokens = data?.usage?.prompt_tokens;
      const outputTokens = data?.usage?.completion_tokens;
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
            finishReason: "stop"
          },
          error: {
            code: "EMPTY",
            message: "Inference provider returned an empty response string."
          }
        };
      }
      let normalizedContent = content;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.proposal?.code && typeof parsed.proposal.code === "string") {
            const repair = repairBlocklyXml(parsed.proposal.code);
            if (repair.repairedXml && (repair.isHealed || repair.actions.length > 0)) {
              parsed.proposal.code = repair.repairedXml;
              normalizedContent = JSON.stringify(parsed, null, 2);
            }
          }
        }
      } catch {
      }
      return {
        rawOutput: normalizedContent,
        success: true,
        metadata: {
          provider: "http-openai-compatible",
          model: this.model,
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          inputTokens,
          outputTokens,
          finishReason: "stop"
        }
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (controller.signal.aborted) {
        const isTimeout = String(err).includes("Timeout") || !options.signal?.aborted;
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "http-openai-compatible",
            model: this.model,
            version: "1.0.0",
            requestId: request.requestId,
            durationMs,
            finishReason: isTimeout ? "timeout" : "cancelled"
          },
          error: {
            code: isTimeout ? "TIMEOUT" : "CANCELLED",
            message: isTimeout ? `Model call exceeded timeout limit of ${timeoutMs}ms.` : "Request was cancelled by user."
          }
        };
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
          finishReason: "error"
        },
        error: {
          code: "PROVIDER_ERROR",
          message: `Inference provider connection failed: ${err instanceof Error ? err.message : String(err)}`
        }
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (options.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
    }
  }
};
var BackendProxyModelAdapter = class {
  proxyUrl;
  defaultTimeoutMs;
  constructor(proxyUrl = "/api/v1/copilot/propose", defaultTimeoutMs = 3e4) {
    this.proxyUrl = proxyUrl;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }
  async generateProposal(request, options = {}) {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    let timeoutId;
    let abortListener;
    if (options.signal) {
      if (options.signal.aborted) {
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "lms-backend-proxy",
            model: "pixiumind-14b-checkpoint-400",
            version: "1.0.0",
            requestId: request.requestId,
            durationMs: 0,
            finishReason: "cancelled"
          },
          error: {
            code: "CANCELLED",
            message: "Request was cancelled by caller before execution."
          }
        };
      }
      abortListener = () => controller.abort();
      options.signal.addEventListener("abort", abortListener);
    }
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(this.proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          task: request.prompt,
          context: {
            board: request.context.targetBoard,
            gradeBand: request.context.gradeBand,
            availableComponents: request.context.availableComponents
          },
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 1024
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "lms-backend-proxy",
            model: "pixiumind-14b-checkpoint-400",
            version: "1.0.0",
            requestId: request.requestId,
            durationMs: Date.now() - startTime,
            finishReason: "error"
          },
          error: {
            code: "PROVIDER_ERROR",
            message: errorData?.error || `Backend proxy HTTP ${response.status}`
          }
        };
      }
      const data = await response.json();
      const proposalText = data?.proposal || "";
      return {
        rawOutput: proposalText,
        success: true,
        metadata: {
          provider: "lms-backend-proxy",
          model: data?.model || "pixiumind-14b-checkpoint-400",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "stop"
        }
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (controller.signal.aborted) {
        const isTimeout = !options.signal?.aborted;
        return {
          rawOutput: "",
          success: false,
          metadata: {
            provider: "lms-backend-proxy",
            model: "pixiumind-14b-checkpoint-400",
            version: "1.0.0",
            requestId: request.requestId,
            durationMs,
            finishReason: isTimeout ? "timeout" : "cancelled"
          },
          error: {
            code: isTimeout ? "TIMEOUT" : "CANCELLED",
            message: isTimeout ? `Proxy request timed out after ${timeoutMs}ms.` : "Request was cancelled."
          }
        };
      }
      return {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "lms-backend-proxy",
          model: "pixiumind-14b-checkpoint-400",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs,
          finishReason: "error"
        },
        error: {
          code: "PROVIDER_ERROR",
          message: `Backend proxy connection failed: ${err instanceof Error ? err.message : String(err)}`
        }
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (options.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
    }
  }
};
var DeterministicStubAdapter = class {
  defaultTimeoutMs;
  constructor(defaultTimeoutMs = 1e4) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }
  async generateProposal(request, options = {}) {
    const startTime = Date.now();
    const scenario = options.simulateScenario || "success";
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
          finishReason: "cancelled"
        },
        error: {
          code: "CANCELLED",
          message: "Request was cancelled by caller."
        }
      };
    }
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
          finishReason: "timeout"
        },
        error: {
          code: "TIMEOUT",
          message: `Model call exceeded timeout limit of ${options.timeoutMs || this.defaultTimeoutMs}ms.`
        }
      };
    }
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
          finishReason: "error"
        },
        error: {
          code: "RATE_LIMIT",
          message: "Rate limit exceeded. Too many requests per second."
        }
      };
    }
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
          finishReason: "stop"
        }
      };
    }
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
          finishReason: "stop"
        },
        error: {
          code: "EMPTY",
          message: "Model returned an empty response string."
        }
      };
    }
    if (scenario === "oversized") {
      return {
        rawOutput: '{"huge_padding": "' + "x".repeat(25e4) + '"}',
        success: true,
        metadata: {
          provider: "deterministic-stub",
          model: "pixiu-baseline-qwen3-4b",
          version: "1.0.0",
          requestId: request.requestId,
          durationMs: Date.now() - startTime,
          finishReason: "length"
        },
        error: {
          code: "OVERSIZED",
          message: "Model output exceeded maximum permitted payload size."
        }
      };
    }
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
          finishReason: "error"
        },
        error: {
          code: "PROVIDER_ERROR",
          message: "Inference provider HTTP 503 service unavailable."
        }
      };
    }
    const cleanPrompt = request.prompt.replace(/\[(?:PEDAGOGICAL|HARDWARE|CIRCUIT)[^\]]*\]/g, "").toLowerCase();
    const board = (request.context.targetBoard || "arduino-uno").toLowerCase();
    let payload;
    if (cleanPrompt.includes("led") || cleanPrompt.includes("blink")) {
      payload = this.buildLedProposal(board);
    } else if (cleanPrompt.includes("ldr") || cleanPrompt.includes("light") || cleanPrompt.includes("nightlight")) {
      payload = this.buildLdrProposal(board);
    } else if (cleanPrompt.includes("ultrasonic") || cleanPrompt.includes("sonar") || cleanPrompt.includes("distance") || cleanPrompt.includes("buzzer")) {
      payload = this.buildUltrasonicProposal(board);
    } else if (cleanPrompt.includes("servo") || cleanPrompt.includes("barrier") || cleanPrompt.includes("motor") || cleanPrompt.includes("angle")) {
      payload = this.buildServoProposal(board);
    } else {
      payload = this.buildLedProposal(board);
    }
    const duration = Math.max(5, Date.now() - startTime);
    const rawOutput = JSON.stringify(payload, null, 2);
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
        finishReason: "stop"
      }
    };
  }
  buildLedProposal(board) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "LED blink on ESP32 DevKit GPIO 2 with 220\u03A9 series resistor",
        assumptions: [
          "GPIO Pin D2 used as output pin",
          "220\u03A9 resistor protects LED on 3.3V power rail"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "r1", type: "resistor", x: 300, y: 100, rotation: 0, props: { resistance: 220 } },
              { id: "led1", type: "led", x: 420, y: 100, rotation: 0, props: { color: "blue" } }
            ],
            wires: [
              { id: "w1", from: { partId: "esp32", pinId: "d2" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Connected an indicator LED to ESP32 Pin D2 via a 220\u03A9 resistor to GND_R on the 3.3V logic rail."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "LED blink on Raspberry Pi Pico GPIO 15 with 220\u03A9 resistor",
        assumptions: [
          "GP15 digital pin used for pulse signal",
          "220\u03A9 resistor drops 3.3V logic to safe forward voltage"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "r1", type: "resistor", x: 300, y: 100, rotation: 0, props: { resistance: 220 } },
              { id: "led1", type: "led", x: 420, y: 100, rotation: 0, props: { color: "green" } }
            ],
            wires: [
              { id: "w1", from: { partId: "pico", pinId: "gp15" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Connected Green LED to Raspberry Pi Pico Pin GP15 with 220\u03A9 resistor to GND_1."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "led_control",
        summary: "External LED blink on micro:bit Pin P0 with 220\u03A9 series resistor",
        assumptions: [
          "micro:bit Pin P0 used as digital output",
          "220\u03A9 resistor prevents LED burnout on 3.3V logic"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "microbit", type: "microbit-v2", x: 100, y: 100, rotation: 0, props: {} },
              { id: "led1", type: "led", x: 340, y: 100, rotation: 0, props: { color: "red" } },
              { id: "r1", type: "resistor", x: 340, y: 200, rotation: 0, props: { resistance: 220 } }
            ],
            wires: [
              { id: "w_sig", from: { partId: "microbit", pinId: "p0" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
              { id: "w_res", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "r1", pinId: "b" }, to: { partId: "microbit", pinId: "gnd" }, color: "#1e293b" }
            ]
          },
          code: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="microbit_display_show" x="40" y="40"></block></xml>',
          explanation: "Connected an external Red LED to micro:bit Pin P0 via a 220\u03A9 current-limiting resistor to protect the 3.3V GPIO."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "led_control",
      summary: "LED blink on Arduino Uno Digital Pin 13 with 220\u03A9 current-limiting resistor",
      assumptions: [
        "Digital Pin 13 used for LED pulse signal",
        "220\u03A9 resistor used to safely drop 5V logic to LED forward voltage"
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "led1", type: "led", x: 420, y: 120, rotation: 0, props: { color: "red" } },
            { id: "r1", type: "resistor", x: 420, y: 220, rotation: 0, props: { resistance: 220 } }
          ],
          wires: [
            { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
            { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
            { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" }
          ]
        },
        code: '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="40" y="40"><statement name="SETUP"><block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block></statement><statement name="LOOP"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next><block type="time_delay"><value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value><next><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next><block type="time_delay"><value name="MS"><block type="math_number"><field name="NUM">1000</field></block></value></block></next></block></next></block></next></block></statement></block></xml>',
        explanation: "Connected Red LED to Arduino Uno Pin D13 with a 220\u03A9 resistor protecting against overcurrent on the 5V rail."
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified"
      }
    };
  }
  buildLdrProposal(board) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on ESP32 ADC Pin D34 with indicator LED on D2",
        assumptions: [
          "10k\u03A9 resistor forms voltage divider with LDR",
          "ADC Pin D34 reads analog light level"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 1e4 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } }
            ],
            wires: [
              { id: "w1", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "esp32", pinId: "d34" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" },
              { id: "w5", from: { partId: "esp32", pinId: "d2" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "esp32", pinId: "gnd_l" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Formed an LDR voltage divider on ESP32 3.3V rail with Pin D34 reading light levels."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on Raspberry Pi Pico ADC0 (GP26)",
        assumptions: [
          "10k\u03A9 pull-down resistor on ADC Pin GP26",
          "GP14 digital pin controls indicator LED"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 1e4 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } }
            ],
            wires: [
              { id: "w1", from: { partId: "pico", pinId: "3v3" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "pico", pinId: "gp26" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "pico", pinId: "gnd_1" }, color: "#1e293b" },
              { id: "w5", from: { partId: "pico", pinId: "gp14" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "pico", pinId: "gnd_2" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Constructed an LDR voltage divider on Raspberry Pi Pico ADC Pin GP26."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ldr_lighting",
        summary: "LDR voltage divider on micro:bit Pin P0 with external LED on Pin P1",
        assumptions: [
          "10k\u03A9 divider resistor on analog pin P0",
          "Digital pin P1 drives external LED"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "ldr1", type: "ldr", x: 300, y: 100, rotation: 0, props: {} },
              { id: "r_div", type: "resistor", x: 300, y: 200, rotation: 0, props: { resistance: 1e4 } },
              { id: "led1", type: "led", x: 450, y: 100, rotation: 0, props: { color: "green" } },
              { id: "r_led", type: "resistor", x: 450, y: 200, rotation: 0, props: { resistance: 220 } }
            ],
            wires: [
              { id: "w1", from: { partId: "mb", pinId: "3v" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
              { id: "w2", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
              { id: "w3", from: { partId: "ldr1", pinId: "b" }, to: { partId: "mb", pinId: "p0" }, color: "#eab308" },
              { id: "w4", from: { partId: "r_div", pinId: "b" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" },
              { id: "w5", from: { partId: "mb", pinId: "p1" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
              { id: "w6", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
              { id: "w7", from: { partId: "led1", pinId: "cathode" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Configured an LDR divider on micro:bit Pin P0 with output alert on Pin P1."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "ldr_lighting",
      summary: "Light-Activated LED Nightlight with LDR voltage divider on Analog Pin A0",
      assumptions: [
        "10k\u03A9 pull-down resistor forms voltage divider with LDR",
        "Analog Pin A0 samples light intensity"
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "ldr1", type: "ldr", x: 360, y: 80, rotation: 0, props: {} },
            { id: "r_div", type: "resistor", x: 360, y: 170, rotation: 0, props: { resistance: 1e4 } },
            { id: "led1", type: "led", x: 500, y: 120, rotation: 0, props: { color: "green" } },
            { id: "r_led", type: "resistor", x: 500, y: 220, rotation: 0, props: { resistance: 220 } }
          ],
          wires: [
            { id: "w_5v", from: { partId: "uno", pinId: "5v" }, to: { partId: "ldr1", pinId: "a" }, color: "#ef4444" },
            { id: "w_div", from: { partId: "ldr1", pinId: "b" }, to: { partId: "r_div", pinId: "a" }, color: "#eab308" },
            { id: "w_a0", from: { partId: "ldr1", pinId: "b" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
            { id: "w_gnd1", from: { partId: "r_div", pinId: "b" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_d12", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
            { id: "w_anode", from: { partId: "r_led", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
            { id: "w_gnd2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" }
          ]
        },
        code: null,
        explanation: "Constructed an LDR voltage divider on Analog Pin A0 with a 10k\u03A9 resistor, driving an indicator LED on Digital Pin 12."
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified"
      }
    };
  }
  buildUltrasonicProposal(board) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on ESP32 DevKit with buzzer alert",
        assumptions: [
          "Trigger on Pin D5, Echo on Pin D18",
          "Warning buzzer on Pin D23"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "esp32", pinId: "gnd_l" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "esp32", pinId: "d5" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "esp32", pinId: "d18" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "esp32", pinId: "d23" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "esp32", pinId: "gnd_r" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Ultrasonic sensor on ESP32 with Trigger on D5 and Echo on D18, with buzzer on D23."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on Raspberry Pi Pico",
        assumptions: [
          "Trigger on GP14, Echo on GP15",
          "Buzzer on GP13"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "pico", pinId: "3v3" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "pico", pinId: "gnd_2" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "pico", pinId: "gp14" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "pico", pinId: "gp15" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "pico", pinId: "gp13" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "pico", pinId: "gnd_3" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Ultrasonic sensor on Raspberry Pi Pico Trigger GP14, Echo GP15, with buzzer on GP13."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "ultrasonic_alert",
        summary: "Ultrasonic Distance Alert on micro:bit V2",
        assumptions: [
          "Trigger on Pin P0, Echo on Pin P1",
          "Buzzer on Pin P2"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
              { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "mb", pinId: "3v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd1", from: { partId: "mb", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_trig", from: { partId: "mb", pinId: "p0" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
              { id: "w_echo", from: { partId: "mb", pinId: "p1" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
              { id: "w_bz_pos", from: { partId: "mb", pinId: "p2" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
              { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "mb", pinId: "gnd" }, color: "#1e293b" }
            ]
          },
          code: null,
          explanation: "Ultrasonic sensor on micro:bit with Trigger on P0, Echo on P1, and buzzer on P2."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "ultrasonic_alert",
      summary: "Ultrasonic Distance Alert with HC-SR04 sonar and active buzzer",
      assumptions: [
        "Trigger on D9, Echo on D10",
        "Buzzer on D8 triggers below distance threshold"
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "sonar", type: "ultrasonic", x: 380, y: 70, rotation: 0, props: { distance: 30 } },
            { id: "bz", type: "buzzer", x: 420, y: 220, rotation: 0, props: {} }
          ],
          wires: [
            { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
            { id: "w_gnd1", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_trig", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" }, color: "#3b82f6" },
            { id: "w_echo", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" }, color: "#06b6d4" },
            { id: "w_bz_pos", from: { partId: "uno", pinId: "d8" }, to: { partId: "bz", pinId: "pos" }, color: "#f59e0b" },
            { id: "w_bz_gnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" }
          ]
        },
        code: null,
        explanation: "HC-SR04 ultrasonic sensor connected to 5V rail with Trigger on D9 and Echo on D10, accompanied by a warning buzzer on D8."
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified"
      }
    };
  }
  buildServoProposal(board) {
    if (board === "esp32-devkit") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on ESP32 PWM Pin D13",
        assumptions: [
          "Servo signal connected to PWM Pin D13",
          "Servo VCC connected to 3.3V power rail with shared ground"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "esp32", type: "esp32-devkit", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "esp32", pinId: "3v3" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "esp32", pinId: "gnd_r" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "esp32", pinId: "d13" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" }
            ]
          },
          code: null,
          explanation: "Servo motor attached to ESP32 Pin D13 for angle positioning."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "rpi-pico") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on Raspberry Pi Pico GP16",
        assumptions: [
          "Servo signal connected to PWM GP16",
          "Servo VCC connected to 3.3V rail with shared ground"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "pico", type: "rpi-pico", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "pico", pinId: "3v3" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "pico", pinId: "gnd_1" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "pico", pinId: "gp16" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" }
            ]
          },
          code: null,
          explanation: "Servo motor connected to Raspberry Pi Pico GP16 for servo angle positioning."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    if (board === "microbit-v2") {
      return {
        schema_version: "pixiu-copilot-proposal-v1",
        task_type: "servo_control",
        summary: "Servo motor angle controller on micro:bit Pin P0",
        assumptions: [
          "Servo signal on analog/PWM pin P0",
          "Servo power on 3V with shared ground"
        ],
        needs_clarification: [],
        proposal: {
          circuit: {
            parts: [
              { id: "mb", type: "microbit-v2", x: 60, y: 100, rotation: 0, props: {} },
              { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } }
            ],
            wires: [
              { id: "w_vcc", from: { partId: "mb", pinId: "3v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
              { id: "w_gnd", from: { partId: "mb", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
              { id: "w_sig", from: { partId: "mb", pinId: "p0" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" }
            ]
          },
          code: null,
          explanation: "Servo motor connected to micro:bit Pin P0 for angle positioning."
        },
        capabilities: {
          simulation: "supported",
          compilation: "not_tested",
          physical_hardware: "not_verified"
        }
      };
    }
    return {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "servo_control",
      summary: "Servo motor angle controller connected to PWM Pin D9",
      assumptions: [
        "Servo signal connected to PWM-capable Digital Pin D9",
        "Servo VCC connected to 5V power rail with shared ground"
      ],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
            { id: "servo1", type: "servo", x: 400, y: 120, rotation: 0, props: { angle: 90 } }
          ],
          wires: [
            { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
            { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
            { id: "w_sig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#f97316" }
          ]
        },
        code: null,
        explanation: "Servo motor attached to 5V, GND, and PWM pin D9 for angle positioning."
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified"
      }
    };
  }
};
function createBaselineModelAdapter(config) {
  if (config?.mode === "stub") {
    return new DeterministicStubAdapter(config?.defaultTimeoutMs);
  }
  if (config?.mode === "proxy") {
    return new BackendProxyModelAdapter(config?.proxyUrl, config?.defaultTimeoutMs);
  }
  return new HttpBaselineModelAdapter({
    baseUrl: config?.baseUrl ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_ENDPOINT_URL : void 0),
    model: config?.model ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_MODEL_ID : void 0) ?? "pixiumind-14b-checkpoint-400",
    apiKey: config?.apiKey ?? (typeof process !== "undefined" ? process.env.PIXIUMIND_API_KEY : void 0),
    defaultTimeoutMs: config?.defaultTimeoutMs
  });
}

// src/lib/ai/copilot/proposal-schema.ts
var SUPPORTED_TASK_FAMILIES = [
  "led_control",
  "ldr_lighting",
  "ultrasonic_alert",
  "servo_control"
];
var ALLOWED_CAPABILITY_STATUSES = [
  "supported",
  "partial",
  "unsupported",
  "not_tested",
  "unknown"
];
var ALLOWED_ROOT_KEYS = /* @__PURE__ */ new Set([
  "schema_version",
  "task_type",
  "summary",
  "assumptions",
  "needs_clarification",
  "proposal",
  "capabilities"
]);
var ALLOWED_PROPOSAL_KEYS = /* @__PURE__ */ new Set([
  "circuit",
  "code",
  "explanation"
]);
var ALLOWED_CAPABILITY_KEYS = /* @__PURE__ */ new Set([
  "simulation",
  "compilation",
  "physical_hardware"
]);
function extractCleanJsonString(raw) {
  if (typeof raw !== "string") return "";
  let text = raw.trim();
  if (text.startsWith("```json")) {
    text = text.slice(7);
  } else if (text.startsWith("```")) {
    text = text.slice(3);
  }
  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }
  return text.trim();
}
function parseProposalPayload(input) {
  const errors = [];
  let parsed;
  let rawStr = "";
  if (typeof input === "string") {
    rawStr = extractCleanJsonString(input);
    if (!rawStr) {
      return { valid: false, payload: null, errors: ["Empty or whitespace-only response string."], rawTrimmed: "" };
    }
    try {
      parsed = JSON.parse(rawStr);
    } catch (err) {
      return {
        valid: false,
        payload: null,
        errors: [`Malformed JSON: ${err instanceof Error ? err.message : String(err)}`],
        rawTrimmed: rawStr.slice(0, 200)
      };
    }
  } else if (input && typeof input === "object") {
    parsed = input;
    rawStr = JSON.stringify(input);
  } else {
    return { valid: false, payload: null, errors: ["Input must be a JSON string or object."], rawTrimmed: "" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, payload: null, errors: ["Proposal root must be a JSON object."], rawTrimmed: rawStr };
  }
  const obj = parsed;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      errors.push(`Disallowed extra property in proposal root: '${key}'.`);
    }
  }
  if (obj.schema_version !== "pixiu-copilot-proposal-v1") {
    errors.push(`Invalid schema_version: expected 'pixiu-copilot-proposal-v1', got '${String(obj.schema_version)}'.`);
  }
  if (!SUPPORTED_TASK_FAMILIES.includes(obj.task_type)) {
    errors.push(`Unsupported task_type: '${String(obj.task_type)}'. Allowed: ${SUPPORTED_TASK_FAMILIES.join(", ")}.`);
  }
  if (typeof obj.summary !== "string" || !obj.summary.trim()) {
    errors.push("Missing or invalid 'summary' string.");
  }
  if (!Array.isArray(obj.assumptions)) {
    errors.push("'assumptions' must be an array of strings.");
  } else {
    for (let i = 0; i < obj.assumptions.length; i++) {
      if (typeof obj.assumptions[i] !== "string" || !String(obj.assumptions[i]).trim()) {
        errors.push(`assumptions[${i}] must be a non-empty string.`);
      }
    }
  }
  if (!Array.isArray(obj.needs_clarification)) {
    errors.push("'needs_clarification' must be an array of strings.");
  } else {
    for (let i = 0; i < obj.needs_clarification.length; i++) {
      if (typeof obj.needs_clarification[i] !== "string" || !String(obj.needs_clarification[i]).trim()) {
        errors.push(`needs_clarification[${i}] must be a non-empty string.`);
      }
    }
  }
  if (!obj.proposal || typeof obj.proposal !== "object" || Array.isArray(obj.proposal)) {
    errors.push("Missing or invalid 'proposal' object.");
  } else {
    const prop = obj.proposal;
    for (const key of Object.keys(prop)) {
      if (!ALLOWED_PROPOSAL_KEYS.has(key)) {
        errors.push(`Disallowed extra property in proposal: '${key}'.`);
      }
    }
    if (typeof prop.explanation !== "string" || !prop.explanation.trim()) {
      errors.push("Proposal must include a non-empty 'explanation' string.");
    }
    if (prop.circuit !== null) {
      if (!prop.circuit || typeof prop.circuit !== "object" || Array.isArray(prop.circuit)) {
        errors.push("Proposal 'circuit' must be an object with parts and wires, or null.");
      } else {
        const circ = prop.circuit;
        if (!Array.isArray(circ.parts)) {
          errors.push("Proposal circuit must contain a 'parts' array.");
        } else {
          for (let i = 0; i < circ.parts.length; i++) {
            const p = circ.parts[i];
            if (!p || typeof p !== "object" || Array.isArray(p)) {
              errors.push(`circuit.parts[${i}] must be a part object.`);
            } else {
              const partObj = p;
              if (typeof partObj.id !== "string" || !partObj.id.trim()) errors.push(`circuit.parts[${i}].id must be a string.`);
              if (typeof partObj.type !== "string" || !partObj.type.trim()) errors.push(`circuit.parts[${i}].type must be a string.`);
              if (typeof partObj.x !== "number" || typeof partObj.y !== "number") errors.push(`circuit.parts[${i}] must have numeric x, y.`);
            }
          }
        }
        if (!Array.isArray(circ.wires)) {
          errors.push("Proposal circuit must contain a 'wires' array.");
        } else {
          for (let i = 0; i < circ.wires.length; i++) {
            const w = circ.wires[i];
            if (!w || typeof w !== "object" || Array.isArray(w)) {
              errors.push(`circuit.wires[${i}] must be a wire object.`);
            } else {
              const wireObj = w;
              if (typeof wireObj.id !== "string" || !wireObj.id.trim()) errors.push(`circuit.wires[${i}].id must be a string.`);
              const from = wireObj.from;
              const to = wireObj.to;
              if (!from || typeof from.partId !== "string" || typeof from.pinId !== "string") {
                errors.push(`circuit.wires[${i}].from must have partId and pinId strings.`);
              }
              if (!to || typeof to.partId !== "string" || typeof to.pinId !== "string") {
                errors.push(`circuit.wires[${i}].to must have partId and pinId strings.`);
              }
            }
          }
        }
      }
    }
    if (prop.code !== null && typeof prop.code !== "string") {
      errors.push("Proposal 'code' must be a string or null.");
    }
  }
  if (!obj.capabilities || typeof obj.capabilities !== "object" || Array.isArray(obj.capabilities)) {
    errors.push("Missing 'capabilities' object.");
  } else {
    const caps = obj.capabilities;
    for (const key of Object.keys(caps)) {
      if (!ALLOWED_CAPABILITY_KEYS.has(key)) {
        errors.push(`Disallowed extra property in capabilities: '${key}'.`);
      }
    }
    if (!ALLOWED_CAPABILITY_STATUSES.includes(caps.simulation)) {
      errors.push(`Invalid capabilities.simulation status: '${String(caps.simulation)}'. Allowed: ${ALLOWED_CAPABILITY_STATUSES.join(", ")}.`);
    }
    if (!ALLOWED_CAPABILITY_STATUSES.includes(caps.compilation)) {
      errors.push(`Invalid capabilities.compilation status: '${String(caps.compilation)}'. Allowed: ${ALLOWED_CAPABILITY_STATUSES.join(", ")}.`);
    }
    if (caps.physical_hardware !== "not_verified") {
      errors.push("capabilities.physical_hardware must be 'not_verified'.");
    }
  }
  if (errors.length > 0) {
    return { valid: false, payload: null, errors, rawTrimmed: rawStr.slice(0, 200) };
  }
  return {
    valid: true,
    payload: parsed,
    errors: [],
    rawTrimmed: rawStr
  };
}

// src/lib/board-registry.ts
var ARDUINO_W = 320;
var ARDUINO_H = 200;
function distributePins(labels, left, right, y) {
  const n = labels.length;
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind,
      capabilities: l.caps,
      alternateNames: l.alt
    };
  });
}
var unoTopPins = distributePins(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground", alt: ["gnd_top"] },
    { label: "D13", kind: "digital", caps: { builtInLed: true }, alt: ["13"] },
    { label: "D12", kind: "digital", alt: ["12"] },
    { label: "D11", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["11"] },
    { label: "D10", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["10"] },
    { label: "D9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
    { label: "D8", kind: "digital", alt: ["8"] },
    { label: "D7", kind: "digital", alt: ["7"] },
    { label: "D6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
    { label: "D5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
    { label: "D4", kind: "digital", alt: ["4"] },
    { label: "D3", kind: "digital", caps: { pwm: true }, alt: ["3"] },
    { label: "D2", kind: "digital", alt: ["2"] },
    { label: "D1", kind: "digital", caps: { uartRole: "tx" }, alt: ["1", "tx"] },
    { label: "D0", kind: "digital", caps: { uartRole: "rx" }, alt: ["0", "rx"] }
  ],
  22,
  ARDUINO_W - 22,
  8
);
var unoBottomPins = distributePins(
  [
    { label: "5V", kind: "power", alt: ["v5", "5v_pwr"] },
    { label: "3V3", kind: "power", alt: ["3.3v", "v33"] },
    { label: "RST", kind: "digital", alt: ["reset"] },
    { label: "VIN", kind: "power", alt: ["vin_pwr"] },
    { label: "GND", kind: "ground", alt: ["gnd_bot"] },
    { label: "A0", kind: "analog", caps: { adc: true }, alt: ["0"] },
    { label: "A1", kind: "analog", caps: { adc: true }, alt: ["1"] },
    { label: "A2", kind: "analog", caps: { adc: true }, alt: ["2"] },
    { label: "A3", kind: "analog", caps: { adc: true }, alt: ["3"] },
    { label: "A4", kind: "analog", caps: { adc: true, i2cRole: "sda" }, alt: ["sda", "4"] },
    { label: "A5", kind: "analog", caps: { adc: true, i2cRole: "scl" }, alt: ["scl", "5"] }
  ],
  40,
  ARDUINO_W - 40,
  ARDUINO_H - 8
).map((p) => p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p);
var ARDUINO_UNO_BOARD = {
  id: "arduino-uno",
  partType: "arduino-uno",
  name: "Arduino Uno R3",
  shortName: "Uno",
  mcu: "ATmega328P",
  family: "avr",
  blurb: "Industry-standard 8-bit AVR microcontroller board (5V Logic, 16MHz)",
  width: ARDUINO_W,
  height: ARDUINO_H,
  logicVoltage: 5,
  supplyVoltages: [5, 3.3],
  adcResolutionBits: 10,
  // 0..1023
  adcMaxVoltage: 5,
  pwmResolutionBits: 8,
  // 0..255
  pwmFrequencyDefaultHz: 490,
  maxGpioCurrentMa: 20,
  clockSpeedMhz: 16,
  flashSizeKb: 32,
  ramSizeKb: 2,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: false,
    supportsCpp: true
  },
  pins: [...unoTopPins, ...unoBottomPins],
  powerPins: {
    v5: ["5v"],
    v33: ["3v3"],
    gnd: ["gnd", "gnd_pwr"],
    vin: ["vin"]
  },
  builtInLedPin: "d13",
  i2cPins: { sda: "a4", scl: "a5" },
  serialPins: { rx: "d0", tx: "d1" },
  documentationUrl: "https://docs.arduino.cc/hardware/uno-rev3",
  visualColors: {
    pcbColor: "#008184",
    accentColor: "#00979d"
  }
};
var ESP32_W = 240;
var ESP32_H = 370;
var esp32LeftSpecs = [
  { id: "en", label: "EN", kind: "digital", alt: ["rst", "reset"] },
  { id: "vp", label: "VP", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio36", "36", "adc1_0"] },
  { id: "vn", label: "VN", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio39", "39", "adc1_3"] },
  { id: "d34", label: "D34", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio34", "34"] },
  { id: "d35", label: "D35", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio35", "35"] },
  { id: "d32", label: "D32", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio32", "32"] },
  { id: "d33", label: "D33", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio33", "33"] },
  { id: "d25", label: "D25", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio25", "25", "dac1"] },
  { id: "d26", label: "D26", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio26", "26", "dac2"] },
  { id: "d27", label: "D27", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio27", "27"] },
  { id: "d14", label: "D14", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "sck" }, alt: ["gpio14", "14"] },
  { id: "d12", label: "D12", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "miso" }, alt: ["gpio12", "12"] },
  { id: "d13", label: "D13", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "mosi" }, alt: ["gpio13", "13"] },
  { id: "gnd_l", label: "GND", kind: "ground", alt: ["gnd", "gnd1"] },
  { id: "vin", label: "VIN", kind: "power", alt: ["5v", "v5"] }
];
var esp32RightSpecs = [
  { id: "d23", label: "D23", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["gpio23", "23"] },
  { id: "d22", label: "D22", kind: "digital", caps: { pwm: true, i2cRole: "scl" }, alt: ["gpio22", "22", "scl"] },
  { id: "tx0", label: "TX0", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio1", "1", "tx"] },
  { id: "rx0", label: "RX0", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio3", "3", "rx"] },
  { id: "d21", label: "D21", kind: "digital", caps: { pwm: true, i2cRole: "sda" }, alt: ["gpio21", "21", "sda"] },
  { id: "d19", label: "D19", kind: "digital", caps: { pwm: true, spiRole: "miso" }, alt: ["gpio19", "19"] },
  { id: "d18", label: "D18", kind: "digital", caps: { pwm: true, spiRole: "sck" }, alt: ["gpio18", "18"] },
  { id: "d5", label: "D5", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["gpio5", "5"] },
  { id: "tx2", label: "TX2", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio17", "17"] },
  { id: "rx2", label: "RX2", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio16", "16"] },
  { id: "d4", label: "D4", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio4", "4"] },
  { id: "d2", label: "D2", kind: "digital", caps: { adc: true, touch: true, pwm: true, builtInLed: true }, alt: ["gpio2", "2", "led"] },
  { id: "d15", label: "D15", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "ss" }, alt: ["gpio15", "15"] },
  { id: "gnd_r", label: "GND", kind: "ground", alt: ["gnd", "gnd2"] },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v", "v33"] }
];
var esp32Pins = [
  ...esp32LeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  })),
  ...esp32RightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: ESP32_W - 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  }))
];
var ESP32_DEVKIT_BOARD = {
  id: "esp32-devkit",
  partType: "esp32-devkit",
  name: "ESP32 DevKit V1",
  shortName: "ESP32",
  mcu: "ESP32-D0WDQ6",
  family: "xtensa",
  blurb: "Dual-Core 240MHz 32-bit MCU with WiFi, Bluetooth BLE, 2x DAC & 10x Touch (3.3V Logic)",
  width: ESP32_W,
  height: ESP32_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5],
  adcResolutionBits: 12,
  // 0..4095
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8,
  // 0..255 (expandable to 16)
  pwmFrequencyDefaultHz: 5e3,
  maxGpioCurrentMa: 12,
  // ESP32 recommended max 12mA per GPIO
  clockSpeedMhz: 240,
  flashSizeKb: 4096,
  ramSizeKb: 520,
  capabilities: {
    hasWifi: true,
    hasBluetooth: true,
    hasBle: true,
    hasDac: true,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: esp32Pins,
  powerPins: {
    v33: ["3v3"],
    gnd: ["gnd_l", "gnd_r"],
    vin: ["vin"]
  },
  builtInLedPin: "d2",
  i2cPins: { sda: "d21", scl: "d22" },
  serialPins: { rx: "rx0", tx: "tx0" },
  documentationUrl: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html",
  visualColors: {
    pcbColor: "#121316",
    accentColor: "#06b6d4"
  }
};
var PICO_W = 220;
var PICO_H = 380;
var picoLeftSpecs = [
  { id: "gp0", label: "GP0", kind: "digital", caps: { uartRole: "tx", i2cRole: "sda", pwm: true }, alt: ["0"] },
  { id: "gp1", label: "GP1", kind: "digital", caps: { uartRole: "rx", i2cRole: "scl", pwm: true }, alt: ["1"] },
  { id: "gnd_1", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp2", label: "GP2", kind: "digital", caps: { i2cRole: "sda", pwm: true }, alt: ["2"] },
  { id: "gp3", label: "GP3", kind: "digital", caps: { i2cRole: "scl", pwm: true }, alt: ["3"] },
  { id: "gp4", label: "GP4", kind: "digital", caps: { pwm: true }, alt: ["4"] },
  { id: "gp5", label: "GP5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
  { id: "gnd_2", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp6", label: "GP6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
  { id: "gp7", label: "GP7", kind: "digital", caps: { pwm: true }, alt: ["7"] },
  { id: "gp8", label: "GP8", kind: "digital", caps: { pwm: true }, alt: ["8"] },
  { id: "gp9", label: "GP9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
  { id: "gnd_3", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp10", label: "GP10", kind: "digital", caps: { pwm: true }, alt: ["10"] },
  { id: "gp11", label: "GP11", kind: "digital", caps: { pwm: true }, alt: ["11"] },
  { id: "gp12", label: "GP12", kind: "digital", caps: { pwm: true }, alt: ["12"] },
  { id: "gp13", label: "GP13", kind: "digital", caps: { pwm: true }, alt: ["13"] },
  { id: "gnd_4", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp14", label: "GP14", kind: "digital", caps: { pwm: true }, alt: ["14"] },
  { id: "gp15", label: "GP15", kind: "digital", caps: { pwm: true }, alt: ["15"] }
];
var picoRightSpecs = [
  { id: "vbus", label: "VBUS", kind: "power", alt: ["5v", "vin"] },
  { id: "vsys", label: "VSYS", kind: "power" },
  { id: "gnd_8", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "3v3_en", label: "3V3_EN", kind: "digital" },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v"] },
  { id: "adc_vref", label: "ADC_VREF", kind: "power" },
  { id: "gp28", label: "GP28", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc2", "28"] },
  { id: "gnd_7", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp27", label: "GP27", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc1", "27"] },
  { id: "gp26", label: "GP26", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc0", "26"] },
  { id: "run", label: "RUN", kind: "digital", alt: ["rst"] },
  { id: "gp22", label: "GP22", kind: "digital", caps: { pwm: true }, alt: ["22"] },
  { id: "gnd_6", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp21", label: "GP21", kind: "digital", caps: { pwm: true }, alt: ["21"] },
  { id: "gp20", label: "GP20", kind: "digital", caps: { pwm: true }, alt: ["20"] },
  { id: "gp19", label: "GP19", kind: "digital", caps: { pwm: true }, alt: ["19"] },
  { id: "gp18", label: "GP18", kind: "digital", caps: { pwm: true }, alt: ["18"] },
  { id: "gnd_5", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp17", label: "GP17", kind: "digital", caps: { pwm: true }, alt: ["17"] },
  { id: "gp16", label: "GP16", kind: "digital", caps: { pwm: true }, alt: ["16"] }
];
var picoPins = [
  ...picoLeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  })),
  ...picoRightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: PICO_W - 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  }))
];
var RPI_PICO_BOARD = {
  id: "rpi-pico",
  partType: "rpi-pico",
  name: "Raspberry Pi Pico",
  shortName: "Pico",
  mcu: "RP2040",
  family: "arm",
  blurb: "Dual ARM Cortex-M0+ @ 133MHz with 12-bit ADC & MicroPython support (3.3V Logic)",
  width: PICO_W,
  height: PICO_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5],
  adcResolutionBits: 12,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 16,
  pwmFrequencyDefaultHz: 1e3,
  maxGpioCurrentMa: 12,
  clockSpeedMhz: 133,
  flashSizeKb: 2048,
  ramSizeKb: 264,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: picoPins,
  powerPins: {
    v5: ["vbus"],
    v33: ["3v3"],
    gnd: ["gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"],
    vin: ["vbus", "vsys"]
  },
  builtInLedPin: "gp25",
  i2cPins: { sda: "gp4", scl: "gp5" },
  serialPins: { rx: "gp1", tx: "gp0" },
  documentationUrl: "https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html",
  visualColors: {
    pcbColor: "#059669",
    accentColor: "#10b981"
  }
};
var MICROBIT_W = 320;
var MICROBIT_H = 260;
var microbitPins = [
  { id: "p0", label: "P0", x: 40, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["0"] },
  { id: "p1", label: "P1", x: 100, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["1"] },
  { id: "p2", label: "P2", x: 160, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["2"] },
  { id: "3v", label: "3V", x: 220, y: MICROBIT_H - 12, kind: "power", alternateNames: ["3v3", "vcc"] },
  { id: "gnd", label: "GND", x: 280, y: MICROBIT_H - 12, kind: "ground", alternateNames: ["gnd_edge"] }
];
var MICROBIT_V2_BOARD = {
  id: "microbit-v2",
  partType: "microbit-v2",
  name: "BBC micro:bit v2",
  shortName: "micro:bit",
  mcu: "nRF52833",
  family: "arm",
  blurb: "ARM Cortex-M4 @ 64MHz with BLE 5.0, 5x5 LED Matrix, Speaker & Mic (3.3V Logic)",
  width: MICROBIT_W,
  height: MICROBIT_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3],
  adcResolutionBits: 10,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8,
  pwmFrequencyDefaultHz: 50,
  maxGpioCurrentMa: 5,
  clockSpeedMhz: 64,
  flashSizeKb: 512,
  ramSizeKb: 128,
  capabilities: {
    hasWifi: false,
    hasBluetooth: true,
    hasBle: true,
    hasDac: false,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: microbitPins,
  powerPins: {
    v33: ["3v"],
    gnd: ["gnd"]
  },
  visualColors: {
    pcbColor: "#1e1e24",
    accentColor: "#fbbf24"
  }
};
var BOARD_REGISTRY = {
  "arduino-uno": ARDUINO_UNO_BOARD,
  "esp32-devkit": ESP32_DEVKIT_BOARD,
  "rpi-pico": RPI_PICO_BOARD,
  "microbit-v2": MICROBIT_V2_BOARD
};
var BOARD_TYPE_SET = new Set(Object.keys(BOARD_REGISTRY));
function isBoardPart(type) {
  return BOARD_TYPE_SET.has(type);
}
function getBoardDefinition(idOrType) {
  return BOARD_REGISTRY[idOrType];
}
function getBoardForPart(part) {
  const type = typeof part === "string" ? part : "type" in part ? part.type : "";
  return getBoardDefinition(type);
}

// src/lib/ai/pixiu-components-dataset.ts
var PIXIU_COMPONENTS_DATASET = {
  // ==========================================
  // 1. MICROCONTROLLERS (4 BOARDS)
  // ==========================================
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno R3",
    category: "microcontroller",
    blurb: "ATmega328P 8-bit AVR microcontroller development board with 14 digital I/O pins, 6 analog inputs, and 16 MHz crystal oscillator.",
    dimensions: { width: 320, height: 200 },
    electrical: {
      operatingVoltage: "5V (USB) or 7-12V (VIN)",
      logicLevel: "5V",
      maxCurrentMa: 200,
      polaritySensitive: true
    },
    pins: [
      { id: "5v", label: "5V", kind: "power", aliases: ["5v_pwr", "vcc", "+5v"], role: "Regulated 5V power supply output" },
      { id: "3v3", label: "3.3V", kind: "power", aliases: ["3v3_pwr", "3.3v", "+3v3"], role: "Regulated 3.3V power supply output (max 50mA)" },
      { id: "vin", label: "VIN", kind: "power", aliases: ["vin_pwr", "raw"], role: "External unregulated DC input voltage (7-12V)" },
      { id: "gnd", label: "GND (Top)", kind: "ground", aliases: ["ground", "gnd_top"], role: "System ground reference (0V)" },
      { id: "gnd_pwr", label: "GND (Bottom)", kind: "ground", aliases: ["ground_pwr", "gnd2", "gnd3"], role: "System ground reference (0V)" },
      { id: "aref", label: "AREF", kind: "digital", aliases: ["ref"], role: "Analog reference voltage input" },
      { id: "rst", label: "RESET", kind: "digital", aliases: ["reset"], role: "Active-low microcontroller reset line" },
      { id: "d0", label: "D0 (RX)", kind: "digital", aliases: ["rx", "0"], role: "Digital I/O and Serial Receive" },
      { id: "d1", label: "D1 (TX)", kind: "digital", aliases: ["tx", "1"], role: "Digital I/O and Serial Transmit" },
      { id: "d2", label: "D2", kind: "digital", aliases: ["2"], role: "Digital I/O and External Interrupt 0" },
      { id: "d3", label: "D3 (~)", kind: "digital", aliases: ["3"], role: "Digital I/O, PWM output, and External Interrupt 1", pwmSupported: true },
      { id: "d4", label: "D4", kind: "digital", aliases: ["4"], role: "Digital I/O" },
      { id: "d5", label: "D5 (~)", kind: "digital", aliases: ["5"], role: "Digital I/O and PWM output", pwmSupported: true },
      { id: "d6", label: "D6 (~)", kind: "digital", aliases: ["6"], role: "Digital I/O and PWM output", pwmSupported: true },
      { id: "d7", label: "D7", kind: "digital", aliases: ["7"], role: "Digital I/O" },
      { id: "d8", label: "D8", kind: "digital", aliases: ["8"], role: "Digital I/O" },
      { id: "d9", label: "D9 (~)", kind: "digital", aliases: ["9"], role: "Digital I/O and PWM output (Servo recommended)", pwmSupported: true },
      { id: "d10", label: "D10 (~)", kind: "digital", aliases: ["10"], role: "Digital I/O, PWM output, and SPI SS", pwmSupported: true },
      { id: "d11", label: "D11 (~)", kind: "digital", aliases: ["11"], role: "Digital I/O, PWM output, and SPI MOSI", pwmSupported: true },
      { id: "d12", label: "D12", kind: "digital", aliases: ["12"], role: "Digital I/O and SPI MISO" },
      { id: "d13", label: "D13", kind: "digital", aliases: ["13", "led_builtin"], role: "Digital I/O, SPI SCK, and Built-in LED" },
      { id: "a0", label: "A0", kind: "analog", aliases: ["0"], role: "10-bit Analog Input (0-1023) or Digital I/O (D14)", adcSupported: true },
      { id: "a1", label: "A1", kind: "analog", aliases: ["1"], role: "10-bit Analog Input (0-1023) or Digital I/O (D15)", adcSupported: true },
      { id: "a2", label: "A2", kind: "analog", aliases: ["2"], role: "10-bit Analog Input (0-1023) or Digital I/O (D16)", adcSupported: true },
      { id: "a3", label: "A3", kind: "analog", aliases: ["3"], role: "10-bit Analog Input (0-1023) or Digital I/O (D17)", adcSupported: true },
      { id: "a4", label: "A4 (SDA)", kind: "analog", aliases: ["sda", "4"], role: "10-bit Analog Input or I2C Data (SDA)", adcSupported: true },
      { id: "a5", label: "A5 (SCL)", kind: "analog", aliases: ["scl", "5"], role: "10-bit Analog Input or I2C Clock (SCL)", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Arduino.h>"],
      blocklyBlockTypes: ["arduino_program", "io_pinmode", "io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread", "time_delay", "serial_begin", "serial_println"]
    },
    wiringRules: [
      { ruleId: "uno-gnd-required", type: "mandatory", description: "All active peripheral circuits must share a common GND connection with the Arduino board." },
      { ruleId: "uno-pwm-pins", type: "recommended", description: "Use PWM-capable pins for analogWrite motor-speed control. Hobby servos driven by the standard Servo library use timer-based control pulses and do not require hardware PWM." },
      { ruleId: "uno-i2c-pins", type: "mandatory", description: "I2C displays (LCD 1602, OLED) must connect to A4 (SDA) and A5 (SCL)." }
    ],
    trainingKeywords: ["uno", "arduino", "atmega328p", "microcontroller", "main board", "controller"],
    standardTopologies: ["single-board microcontroller hub", "i2c bus master", "adc voltage sensing hub", "pwm actuator driver"]
  },
  "esp32-devkit": {
    type: "esp32-devkit",
    name: "ESP32 DevKit V1",
    category: "microcontroller",
    blurb: "Dual-core Xtensa 32-bit LX6 microcontroller with integrated 2.4 GHz Wi-Fi, Bluetooth 4.2 BLE, 12-bit ADC, and 3.3V logic.",
    dimensions: { width: 180, height: 280 },
    electrical: {
      operatingVoltage: "5V (VIN) or 3.3V",
      logicLevel: "3.3V",
      maxCurrentMa: 500,
      polaritySensitive: true
    },
    pins: [
      { id: "3v3", label: "3V3", kind: "power", aliases: ["3.3v", "vcc"], role: "3.3V Regulated Output" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground (0V)" },
      { id: "vin", label: "VIN", kind: "power", aliases: ["5v"], role: "5V DC External Input" },
      { id: "d2", label: "GPIO2", kind: "digital", aliases: ["2", "gpio2"], role: "Built-in Blue LED, PWM", pwmSupported: true },
      { id: "d4", label: "GPIO4", kind: "digital", aliases: ["4", "gpio4"], role: "General I/O, ADC2, Touch0", pwmSupported: true, adcSupported: true },
      { id: "d15", label: "GPIO15", kind: "digital", aliases: ["15", "gpio15"], role: "General I/O, PWM", pwmSupported: true },
      { id: "d21", label: "GPIO21 (SDA)", kind: "digital", aliases: ["21", "sda"], role: "I2C Data line (SDA)" },
      { id: "d22", label: "GPIO22 (SCL)", kind: "digital", aliases: ["22", "scl"], role: "I2C Clock line (SCL)" },
      { id: "d34", label: "GPIO34", kind: "analog", aliases: ["34", "gpio34"], role: "Input-only, 12-bit ADC1", adcSupported: true },
      { id: "d35", label: "GPIO35", kind: "analog", aliases: ["35", "gpio35"], role: "Input-only, 12-bit ADC1", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<WiFi.h>", "<WebServer.h>"],
      blocklyBlockTypes: ["wifi_connect", "wifi_server_begin", "wifi_server_on", "wifi_server_send", "wifi_local_ip"]
    },
    wiringRules: [
      { ruleId: "esp32-voltage-tolerance", type: "mandatory", description: "ESP32 GPIO pins tolerate max 3.3V. 5V sensors require voltage dividers." },
      { ruleId: "esp32-i2c-pins", type: "mandatory", description: "Default I2C bus pins are GPIO21 (SDA) and GPIO22 (SCL)." }
    ],
    trainingKeywords: ["esp32", "wifi", "iot", "web server", "smart home", "internet of things"],
    standardTopologies: ["iot web server controller", "wifi telemetry client", "smart home hub"]
  },
  "rpi-pico": {
    type: "rpi-pico",
    name: "Raspberry Pi Pico",
    category: "microcontroller",
    blurb: "RP2040 dual-core ARM Cortex-M0+ microcontroller with 3.3V logic, programmable I/O (PIO), and 12-bit ADC.",
    dimensions: { width: 140, height: 320 },
    electrical: {
      operatingVoltage: "5V (VBUS) or 3.3V",
      logicLevel: "3.3V",
      maxCurrentMa: 300,
      polaritySensitive: true
    },
    pins: [
      { id: "vbus", label: "VBUS (5V)", kind: "power", aliases: ["5v"], role: "USB 5V input power" },
      { id: "3v3", label: "3V3 (OUT)", kind: "power", aliases: ["3.3v"], role: "Regulated 3.3V power output" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "gp0", label: "GP0", kind: "digital", aliases: ["0"], role: "GPIO, UART0 TX, I2C0 SDA", pwmSupported: true },
      { id: "gp1", label: "GP1", kind: "digital", aliases: ["1"], role: "GPIO, UART0 RX, I2C0 SCL", pwmSupported: true },
      { id: "gp25", label: "GP25", kind: "digital", aliases: ["25", "led_builtin"], role: "Built-in Green LED" },
      { id: "gp26", label: "GP26 (ADC0)", kind: "analog", aliases: ["26", "a0"], role: "12-bit ADC0 channel", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<pico/stdlib.h>"],
      blocklyBlockTypes: ["io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "pico-3v3-logic", type: "mandatory", description: "Raspberry Pi Pico uses 3.3V logic level." }
    ],
    trainingKeywords: ["pico", "rp2040", "raspberry pi pico", "arm cortex"],
    standardTopologies: ["embedded edge controller", "pwm audio/motor station"]
  },
  "microbit-v2": {
    type: "microbit-v2",
    name: "BBC micro:bit v2",
    category: "microcontroller",
    blurb: "Educational nRF52833 board featuring 5x5 LED display matrix, A/B tactile buttons, MEMS microphone, and edge connector.",
    dimensions: { width: 260, height: 210 },
    electrical: {
      operatingVoltage: "3V (Battery) or 5V (USB)",
      logicLevel: "3.3V",
      maxCurrentMa: 150,
      polaritySensitive: true
    },
    pins: [
      { id: "3v", label: "3V", kind: "power", aliases: ["3v3", "vcc"], role: "3V Power Rail" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "p0", label: "P0", kind: "analog", aliases: ["0"], role: "Touch pin, ADC, buzzer audio output", adcSupported: true },
      { id: "p1", label: "P1", kind: "analog", aliases: ["1"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "p2", label: "P2", kind: "analog", aliases: ["2"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "btn_a", label: "Button A", kind: "digital", aliases: ["a"], role: "Integrated left tactile button" },
      { id: "btn_b", label: "Button B", kind: "digital", aliases: ["b"], role: "Integrated right tactile button" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Adafruit_Microbit.h>"],
      blocklyBlockTypes: ["microbit_show_icon", "microbit_show_number", "microbit_show_string", "microbit_clear", "microbit_button_pressed"]
    },
    wiringRules: [
      { ruleId: "microbit-edge-alligator", type: "recommended", description: "P0, P1, P2 and 3V/GND large rings are designed for alligator clips." }
    ],
    trainingKeywords: ["microbit", "bbc micro:bit", "5x5 led matrix", "stem edtech"],
    standardTopologies: ["wearable interactive badge", "gesture badge", "educational sensory game"]
  },
  // ==========================================
  // 2. DISCRETE & PASSIVE ELECTRONICS
  // ==========================================
  led: {
    type: "led",
    name: "Standard 5mm LED",
    category: "actuator",
    blurb: "Polarized semiconductor light-emitting diode. Requires current limiting resistor.",
    dimensions: { width: 44, height: 66 },
    electrical: {
      operatingVoltage: "1.8V - 2.2V forward drop (typical)",
      logicLevel: "passive",
      maxCurrentMa: 20,
      polaritySensitive: true
    },
    pins: [
      { id: "anode", label: "Anode (+)", kind: "passive", aliases: ["a", "pos", "+", "anode_+"], role: "Longer positive lead. Connects to control signal via current-limiting resistor." },
      { id: "cathode", label: "Cathode (-)", kind: "passive", aliases: ["k", "neg", "-", "cathode_-"], role: "Shorter negative lead with flat lens edge. Connects to Ground (0V)." }
    ],
    properties: [
      { key: "color", type: "string", defaultValue: "red", allowedValues: ["red", "green", "blue", "yellow", "white"], description: "Color of the emitted light" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite", "io_analogwrite"],
      standardPinModes: { "anode": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "led-series-resistor", type: "mandatory", description: "Must ALWAYS have a 220\u03A9-1k\u03A9 resistor in series with Anode or Cathode to prevent burnout.", circuitDoctorCheckId: "led_burnout" },
      { ruleId: "led-polarity", type: "mandatory", description: "Anode must receive positive potential relative to Cathode (forward bias) to conduct current.", circuitDoctorCheckId: "led_reversed" }
    ],
    trainingKeywords: ["led", "light", "indicator", "lamp", "diode", "blinking led", "traffic light"],
    standardTopologies: ["digital indicator loop: Pin -> 220\u03A9 Resistor -> LED Anode -> LED Cathode -> GND", "pwm dimming indicator"]
  },
  resistor: {
    type: "resistor",
    name: "Through-Hole Resistor",
    category: "passive",
    blurb: "Fixed linear passive component that restricts electrical current according to Ohm's Law (V = IR).",
    dimensions: { width: 88, height: 26 },
    electrical: {
      operatingVoltage: "0V - 50V",
      logicLevel: "passive",
      polaritySensitive: false
    },
    pins: [
      { id: "a", label: "Terminal 1", kind: "passive", aliases: ["t1", "1", "lead1"], role: "Symmetrical passive terminal" },
      { id: "b", label: "Terminal 2", kind: "passive", aliases: ["t2", "2", "lead2"], role: "Symmetrical passive terminal" }
    ],
    properties: [
      { key: "resistance", type: "number", defaultValue: 220, allowedValues: [100, 220, 330, 1e3, 4700, 1e4, 1e5], description: "Resistance value in Ohms (\u03A9)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "resistor-symmetry", type: "recommended", description: "Terminals a and b are electrically symmetrical; either can connect to source or ground." }
    ],
    trainingKeywords: ["resistor", "resistance", "ohms", "current limiter", "pull-up", "pull-down", "voltage divider"],
    standardTopologies: ["current-limiting series resistor", "voltage divider lower arm (10k)", "pull-up resistor"]
  },
  pushbutton: {
    type: "pushbutton",
    name: "Momentary Tactile Pushbutton",
    category: "sensor",
    blurb: "Normally-open momentary mechanical switch. Closes circuit between internal pin pairs when pressed.",
    dimensions: { width: 60, height: 60 },
    electrical: {
      operatingVoltage: "0V - 12V",
      logicLevel: "passive",
      polaritySensitive: false
    },
    pins: [
      { id: "p1a", label: "Terminal 1a", kind: "passive", aliases: ["1a", "a1"], role: "Contact pair 1 (internally connected to 1b)" },
      { id: "p1b", label: "Terminal 1b", kind: "passive", aliases: ["1b", "b1"], role: "Contact pair 1 (internally connected to 1a)" },
      { id: "p2a", label: "Terminal 2a", kind: "passive", aliases: ["2a", "a2"], role: "Contact pair 2 (internally connected to 2b)" },
      { id: "p2b", label: "Terminal 2b", kind: "passive", aliases: ["2b", "b2"], role: "Contact pair 2 (internally connected to 2a)" }
    ],
    properties: [
      { key: "pressed", type: "boolean", defaultValue: false, description: "True when button is held down by user" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pushbutton_read", "io_digitalread"],
      standardPinModes: { "signal": "INPUT_PULLUP" }
    },
    wiringRules: [
      { ruleId: "button-pullup-recommended", type: "recommended", description: "Connect one terminal to GND and configure pin with INPUT_PULLUP to avoid floating state.", circuitDoctorCheckId: "floating_input" }
    ],
    trainingKeywords: ["button", "pushbutton", "switch", "press", "trigger", "key", "doorbell"],
    standardTopologies: ["active-low input with internal pullup", "voltage divider active-high button"]
  },
  potentiometer: {
    type: "potentiometer",
    name: "Rotary Potentiometer (10k\u03A9)",
    category: "sensor",
    blurb: "Three-terminal manual variable resistor acting as an adjustable voltage divider.",
    dimensions: { width: 64, height: 64 },
    electrical: {
      operatingVoltage: "0V - 5V",
      logicLevel: "universal",
      polaritySensitive: false
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["vcc", "left"], role: "High-side reference voltage (usually 5V or 3.3V)" },
      { id: "wiper", label: "Wiper", kind: "passive", aliases: ["w", "out", "sig", "center"], role: "Adjustable analog tap. Connects to microcontroller ADC (e.g. A0)" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["gnd", "right"], role: "Low-side reference voltage (GND)" }
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 512, description: "Wiper position ADC reading (0 to 1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["potentiometer_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "pot-wiper-to-adc", type: "mandatory", description: "Wiper terminal must connect to an Analog ADC pin (A0-A5 on Uno)." }
    ],
    trainingKeywords: ["potentiometer", "knob", "dial", "volume control", "analog input", "speed control"],
    standardTopologies: ["standard 3-terminal voltage divider: 5V -> T1, GND -> T2, A0 -> Wiper"]
  },
  battery: {
    type: "battery",
    name: "9V Alkaline Battery",
    category: "power",
    blurb: "Independent 9V direct-current power supply for high-load actuators, relays, and motor drivers.",
    dimensions: { width: 62, height: 92 },
    electrical: {
      operatingVoltage: "9V DC",
      logicLevel: "power",
      maxCurrentMa: 1e3,
      polaritySensitive: true
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "vcc", "vin"], role: "Positive 9V terminal" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground / 0V return terminal" }
    ],
    properties: [
      { key: "voltage", type: "number", defaultValue: 9, description: "Nominal terminal voltage (V)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "battery-common-ground", type: "mandatory", description: "Negative terminal must share a common GND with the microcontroller if driving shared logic." }
    ],
    trainingKeywords: ["battery", "9v", "power source", "external power", "power supply"],
    standardTopologies: ["high-current actuator supply for motors and relays"]
  },
  // ==========================================
  // 3. MOTORS & ACTUATORS
  // ==========================================
  servo: {
    type: "servo",
    name: "SG90 Micro Servo Motor",
    category: "actuator",
    blurb: "Precision gear-driven position motor capable of 0\xB0 to 180\xB0 rotation using standard 50Hz PWM signals.",
    dimensions: { width: 90, height: 60 },
    electrical: {
      operatingVoltage: "4.8V - 6.0V DC",
      logicLevel: "5V",
      maxCurrentMa: 550,
      polaritySensitive: true
    },
    pins: [
      { id: "sig", label: "Signal (Orange/Yellow)", kind: "digital", aliases: ["signal", "pwm", "s"], role: "PWM control signal (1ms=0\xB0, 1.5ms=90\xB0, 2ms=180\xB0)" },
      { id: "vcc", label: "VCC (Red)", kind: "power", aliases: ["5v", "power"], role: "5V Power Supply" },
      { id: "gnd", label: "GND (Brown/Black)", kind: "ground", aliases: ["ground"], role: "System Ground Reference" }
    ],
    properties: [
      { key: "angle", type: "number", defaultValue: 90, description: "Current horn angle in degrees (0 to 180)" }
    ],
    codeInterface: {
      cppLibraries: ["<Servo.h>"],
      blocklyBlockTypes: ["servo_write", "actuator_servo_write"],
      standardPinModes: { "sig": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "servo-signal-gpio", type: "mandatory", description: "Signal pin must connect to a valid digital GPIO. The standard Arduino Servo library generates timer-based control pulses and does not require hardware PWM; D9/D10 are examples, not mandatory pins." },
      { ruleId: "servo-vcc-5v", type: "mandatory", description: "VCC must connect to 5V (not 3.3V) for sufficient motor torque." }
    ],
    trainingKeywords: ["servo", "motor", "robotic arm", "barrier gate", "lock", "vault", "steering", "angle"],
    standardTopologies: ["barrier gate control", "smart door lock actuator", "gauge meter pointer"]
  },
  buzzer: {
    type: "buzzer",
    name: "Piezoelectric Sound Buzzer",
    category: "actuator",
    blurb: "Acoustic audio transducer that converts electrical frequency signals into audible tones.",
    dimensions: { width: 56, height: 56 },
    electrical: {
      operatingVoltage: "3V - 12V DC",
      logicLevel: "universal",
      maxCurrentMa: 30,
      polaritySensitive: true
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "sig", "p"], role: "Positive tone signal input" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground return (0V)" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tone_play", "tone_stop", "io_tone", "io_notone"],
      standardPinModes: { "pos": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "buzzer-pos-to-pin", type: "mandatory", description: "Positive pin connects to digital output pin (e.g. D8, D11); negative connects to GND." }
    ],
    trainingKeywords: ["buzzer", "piezo", "chime", "alarm", "speaker", "audio alert", "siren"],
    standardTopologies: ["audio alert siren", "confirmation chime", "doorbell chime"]
  },
  "dc-motor": {
    type: "dc-motor",
    name: "Small Brushed DC Motor",
    category: "actuator",
    blurb: "Rotational direct-current motor. High inductive load; requires transistor, relay, or motor driver.",
    dimensions: { width: 60, height: 60 },
    electrical: {
      operatingVoltage: "3V - 9V DC",
      logicLevel: "passive",
      maxCurrentMa: 800,
      polaritySensitive: false
    },
    pins: [
      { id: "pos", label: "M+ (Terminal 1)", kind: "passive", aliases: ["t1", "lead1"], role: "Motor coil terminal" },
      { id: "neg", label: "M- (Terminal 2)", kind: "passive", aliases: ["t2", "lead2"], role: "Motor coil terminal" }
    ],
    properties: [
      { key: "rpm", type: "number", defaultValue: 0, description: "Rotational speed in revolutions per minute" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write", "io_analogwrite"]
    },
    wiringRules: [
      { ruleId: "dc-motor-driver-required", type: "mandatory", description: "Do NOT connect DC motor directly to Arduino GPIO pins. Must use transistor, relay, or L298N driver." }
    ],
    trainingKeywords: ["dc motor", "fan", "propeller", "wheel", "motor", "rotational power"],
    standardTopologies: ["transistor-switched fan", "l298n h-bridge dual drive"]
  },
  relay: {
    type: "relay",
    name: "5V Electromechanical Relay Module",
    category: "driver",
    blurb: "Opto-isolated magnetic switch allowing low-voltage microcontrollers to switch high-voltage loads safely.",
    dimensions: { width: 80, height: 70 },
    electrical: {
      operatingVoltage: "5V DC Coil",
      logicLevel: "5V",
      maxCurrentMa: 70,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Relay coil 5V power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "in", label: "IN", kind: "passive", aliases: ["sig", "control"], role: "Digital control signal from Arduino (e.g. D8)" },
      { id: "com", label: "COM", kind: "passive", aliases: ["common"], role: "Common switch terminal" },
      { id: "no", label: "NO", kind: "passive", aliases: ["normally_open"], role: "Normally-Open contact (closes when IN is HIGH)" },
      { id: "nc", label: "NC", kind: "passive", aliases: ["normally_closed"], role: "Normally-Closed contact (opens when IN is HIGH)" }
    ],
    properties: [
      { key: "closed", type: "boolean", defaultValue: false, description: "State of the NO contact" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"],
      standardPinModes: { "in": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "relay-coil-power", type: "mandatory", description: "VCC connects to 5V, GND to GND, and IN to digital control pin." }
    ],
    trainingKeywords: ["relay", "switch", "high voltage", "home automation", "smart plug", "ac switch"],
    standardTopologies: ["home automation high power switch: Battery -> COM, NO -> Load -> Battery GND"]
  },
  l298n: {
    type: "l298n",
    name: "L298N Dual H-Bridge Motor Driver",
    category: "driver",
    blurb: "High-power dual DC motor and stepper driver module supporting bidirectional speed and direction control.",
    dimensions: { width: 120, height: 96 },
    electrical: {
      operatingVoltage: "5V - 35V Motor Power (VS)",
      logicLevel: "5V",
      maxCurrentMa: 2e3,
      polaritySensitive: true
    },
    pins: [
      { id: "vs", label: "VMotor (VS)", kind: "power", aliases: ["12v", "bat"], role: "External motor power supply (e.g. 9V battery)" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Common ground reference" },
      { id: "5v", label: "5V Logic", kind: "power", aliases: ["vcc"], role: "5V onboard logic power" },
      { id: "ena", label: "ENA", kind: "digital", aliases: ["speed_a"], role: "Motor A PWM speed enable (e.g. D5)" },
      { id: "in1", label: "IN1", kind: "digital", aliases: ["dir1_a"], role: "Motor A Direction 1 (e.g. D7)" },
      { id: "in2", label: "IN2", kind: "digital", aliases: ["dir2_a"], role: "Motor A Direction 2 (e.g. D8)" },
      { id: "out1", label: "OUT1", kind: "passive", aliases: ["motor_a_1"], role: "Motor A Output Terminal 1" },
      { id: "out2", label: "OUT2", kind: "passive", aliases: ["motor_a_2"], role: "Motor A Output Terminal 2" },
      { id: "enb", label: "ENB", kind: "digital", aliases: ["speed_b"], role: "Motor B PWM speed enable (e.g. D6)" },
      { id: "in3", label: "IN3", kind: "digital", aliases: ["dir1_b"], role: "Motor B Direction 1 (e.g. D9)" },
      { id: "in4", label: "IN4", kind: "digital", aliases: ["dir2_b"], role: "Motor B Direction 2 (e.g. D10)" },
      { id: "out3", label: "OUT3", kind: "passive", aliases: ["motor_b_1"], role: "Motor B Output Terminal 1" },
      { id: "out4", label: "OUT4", kind: "passive", aliases: ["motor_b_2"], role: "Motor B Output Terminal 2" }
    ],
    properties: [
      { key: "speedA", type: "number", defaultValue: 0, description: "Motor A PWM Speed (0-255)" },
      { key: "speedB", type: "number", defaultValue: 0, description: "Motor B PWM Speed (0-255)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write"]
    },
    wiringRules: [
      { ruleId: "l298n-common-ground", type: "mandatory", description: "L298N GND must be connected to BOTH battery GND and Arduino GND." }
    ],
    trainingKeywords: ["l298n", "h-bridge", "motor driver", "rover", "robot car", "dual motor"],
    standardTopologies: ["differential steering 2WD robot chassis"]
  },
  // ==========================================
  // 4. SENSORS (INPUT DEVICES)
  // ==========================================
  ultrasonic: {
    type: "ultrasonic",
    name: "HC-SR04 Ultrasonic Distance Sensor",
    category: "sensor",
    blurb: "Non-contact sonar ranging module measuring distances from 2 cm to 400 cm with 3mm precision.",
    dimensions: { width: 100, height: 56 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 15,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "trig", label: "Trig", kind: "passive", aliases: ["trigger", "t"], role: "Trigger input pulse (10\xB5s TTL pulse)" },
      { id: "echo", label: "Echo", kind: "passive", aliases: ["e"], role: "Echo output pulse proportional to distance" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" }
    ],
    properties: [
      { key: "distance", type: "number", defaultValue: 100, description: "Simulated target distance in centimeters" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ultrasonic_read"],
      standardPinModes: { "trig": "OUTPUT", "echo": "INPUT" }
    },
    wiringRules: [
      { ruleId: "ultrasonic-5v-required", type: "mandatory", description: "HC-SR04 requires 5V VCC to emit ultrasonic bursts reliably." }
    ],
    trainingKeywords: ["ultrasonic", "sonar", "distance", "hc-sr04", "radar", "proximity", "obstacle detector"],
    standardTopologies: ["obstacle avoidance radar", "smart trash can opener", "distance meter"]
  },
  ldr: {
    type: "ldr",
    name: "Light Dependent Resistor (Photoresistor)",
    category: "sensor",
    blurb: "CdS semiconductor sensor whose resistance decreases as ambient light intensity increases.",
    dimensions: { width: 40, height: 50 },
    electrical: {
      operatingVoltage: "0V - 5V",
      logicLevel: "passive",
      polaritySensitive: false
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["1", "a"], role: "Passive resistor lead" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["2", "b"], role: "Passive resistor lead" }
    ],
    properties: [
      { key: "light", type: "number", defaultValue: 512, description: "Simulated ambient illumination level (0 to 1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ldr_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "ldr-voltage-divider", type: "mandatory", description: "Must be wired in series with a 10k\u03A9 fixed resistor between 5V and GND, tapping junction to A0.", circuitDoctorCheckId: "floating_analog" }
    ],
    trainingKeywords: ["ldr", "photoresistor", "light sensor", "night light", "solar tracker", "ambient light"],
    standardTopologies: ["voltage divider with 10k resistor: 5V -> LDR -> Junction(A0) -> 10k\u03A9 -> GND"]
  },
  "pir-sensor": {
    type: "pir-sensor",
    name: "HC-SR501 PIR Motion Sensor",
    category: "sensor",
    blurb: "Pyroelectric infrared motion sensor that outputs a digital HIGH signal upon detecting human infrared movement.",
    dimensions: { width: 60, height: 70 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "3.3V/5V TTL Output",
      maxCurrentMa: 65,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V DC Power Input" },
      { id: "out", label: "OUT", kind: "passive", aliases: ["sig", "data"], role: "Digital output: HIGH when motion detected, LOW when idle" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" }
    ],
    properties: [
      { key: "motion", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Current motion detection state" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pir_motion", "io_digitalread"],
      standardPinModes: { "out": "INPUT" }
    },
    wiringRules: [
      { ruleId: "pir-out-to-digital", type: "mandatory", description: "OUT pin connects to a digital input pin (e.g. D2, D7)." }
    ],
    trainingKeywords: ["pir", "motion", "burglar alarm", "occupancy", "security", "infrared motion"],
    standardTopologies: ["intruder alarm security station", "automatic room light controller"]
  },
  dht11: {
    type: "dht11",
    name: "DHT11 Temperature & Humidity Sensor",
    category: "sensor",
    blurb: "Single-wire digital climate sensor reading 20-90% relative humidity and 0-50\xB0C temperature.",
    dimensions: { width: 72, height: 66 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      maxCurrentMa: 2.5,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "Power supply" },
      { id: "data", label: "DATA", kind: "digital", aliases: ["out", "sig"], role: "Single-bus bidirectional serial data line" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Ambient temperature in \xB0C" },
      { key: "humidity", type: "number", defaultValue: 55, description: "Relative humidity in %" }
    ],
    codeInterface: {
      cppLibraries: ["<DHT.h>"],
      blocklyBlockTypes: ["dht_temperature", "dht_humidity"]
    },
    wiringRules: [
      { ruleId: "dht-data-pin", type: "mandatory", description: "DATA pin connects to a digital pin (e.g. D2, D4)." }
    ],
    trainingKeywords: ["dht11", "temperature", "humidity", "weather station", "climate", "thermostat"],
    standardTopologies: ["smart weather station with lcd", "greenhouse automated climate monitor"]
  },
  tmp36: {
    type: "tmp36",
    name: "TMP36 Precision Temperature Sensor",
    category: "sensor",
    blurb: "Linear analog temperature sensor outputting 10 mV/\xB0C with a 500 mV offset at 0\xB0C (-40\xB0C to +125\xB0C).",
    dimensions: { width: 40, height: 50 },
    electrical: {
      operatingVoltage: "2.7V - 5.5V DC",
      logicLevel: "universal",
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "VOUT", kind: "passive", aliases: ["vout", "analog"], role: "Analog voltage proportional to temperature" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Simulated temperature in \xB0C" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tmp36_temperature", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "tmp36-out-to-adc", type: "mandatory", description: "VOUT must connect to an Analog ADC pin (e.g. A0, A1)." }
    ],
    trainingKeywords: ["tmp36", "temperature sensor", "thermometer", "analog temp", "heat sensor"],
    standardTopologies: ["analog thermometer with led indicator bar"]
  },
  "mq2-gas": {
    type: "mq2-gas",
    name: "MQ-2 Flammable Gas & Smoke Sensor",
    category: "sensor",
    blurb: "Chemical semiconductor gas sensor sensitive to LPG, propane, methane, hydrogen, and smoke.",
    dimensions: { width: 80, height: 90 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 150,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Heater & Circuit Power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" },
      { id: "do", label: "DO (Digital Out)", kind: "digital", aliases: ["d0"], role: "Threshold comparator digital alert" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0"], role: "Analog gas concentration output" }
    ],
    properties: [
      { key: "gasLevel", type: "number", defaultValue: 150, description: "Gas concentration level in PPM" },
      { key: "threshold", type: "number", defaultValue: 350, description: "Alert trigger threshold" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["mq2_gas_read", "io_analogread", "io_digitalread"]
    },
    wiringRules: [
      { ruleId: "mq2-5v-required", type: "mandatory", description: "MQ-2 internal tin dioxide sensor heater requires 5V supply." }
    ],
    trainingKeywords: ["mq2", "gas sensor", "smoke detector", "fire alarm", "pollution", "lpg leak"],
    standardTopologies: ["kitchen safety smoke alarm with buzzer and led"]
  },
  "soil-moisture": {
    type: "soil-moisture",
    name: "Soil Moisture Sensor",
    category: "sensor",
    blurb: "Resistive soil hygrometer measuring volumetric water content in soil.",
    dimensions: { width: 72, height: 84 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Probe Power" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0", "sig"], role: "Analog moisture signal (high when dry, low when wet)" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "moisture", type: "number", defaultValue: 620, description: "ADC reading (0-1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["soil_moisture_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "soil-ao-to-adc", type: "mandatory", description: "AO connects to an Analog ADC pin (e.g. A0, A2)." }
    ],
    trainingKeywords: ["soil moisture", "hygrometer", "plant watering", "smart agriculture", "irrigation"],
    standardTopologies: ["automated plant watering system with servo valve"]
  },
  "ir-sensor": {
    type: "ir-sensor",
    name: "IR Optical Obstacle Sensor",
    category: "sensor",
    blurb: "Infrared emitter/photodiode pair for close-range line following and obstacle detection.",
    dimensions: { width: 76, height: 64 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "OUT", kind: "digital", aliases: ["sig"], role: "Active-low digital output when obstacle reflected" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "detected", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Reflection detected status" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ir_read", "io_digitalread"]
    },
    wiringRules: [
      { ruleId: "ir-out-to-digital", type: "mandatory", description: "OUT connects to digital input pin." }
    ],
    trainingKeywords: ["ir sensor", "infrared", "line tracker", "obstacle detector", "proximity"],
    standardTopologies: ["conveyor belt counter", "line-following robot sensor"]
  },
  joystick: {
    type: "joystick",
    name: "Dual-Axis Thumbstick & Switch",
    category: "sensor",
    blurb: "Two orthogonal 10k\u03A9 potentiometers for X and Y analog deflection plus integrated tactile push switch.",
    dimensions: { width: 86, height: 86 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Common ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V reference power" },
      { id: "vrx", label: "VRx", kind: "analog", aliases: ["x"], role: "Horizontal X-axis analog output (A0)" },
      { id: "vry", label: "VRy", kind: "analog", aliases: ["y"], role: "Vertical Y-axis analog output (A1)" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push-button digital switch (D2)" }
    ],
    properties: [
      { key: "x", type: "number", defaultValue: 512, description: "X-axis position (0 to 1023)" },
      { key: "y", type: "number", defaultValue: 512, description: "Y-axis position (0 to 1023)" },
      { key: "pressed", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "SW switch state" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["joystick_x", "joystick_y", "joystick_button"]
    },
    wiringRules: [
      { ruleId: "joystick-adc-pair", type: "mandatory", description: "VRx and VRy must connect to two separate Analog pins (A0, A1)." }
    ],
    trainingKeywords: ["joystick", "thumbstick", "gamepad", "pan tilt", "steer", "controller"],
    standardTopologies: ["rover drive controller", "pan-tilt camera mount"]
  },
  "rotary-encoder": {
    type: "rotary-encoder",
    name: "Quadrature Rotary Encoder",
    category: "sensor",
    blurb: "Infinite rotation dual-phase encoder outputting quadrature Gray-code pulses for angular step detection.",
    dimensions: { width: 74, height: 82 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "clk", label: "CLK (A)", kind: "digital", aliases: ["a"], role: "Channel A pulse output" },
      { id: "dt", label: "DT (B)", kind: "digital", aliases: ["b"], role: "Channel B quadrature phase output" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push switch" }
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 0, description: "Current relative step counter" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["encoder_read"]
    },
    wiringRules: [
      { ruleId: "encoder-interrupt-recommended", type: "recommended", description: "Connect CLK to interrupt pin D2 or D3 for zero-miss step tracking." }
    ],
    trainingKeywords: ["encoder", "rotary encoder", "scroll wheel", "menu selector", "dial"],
    standardTopologies: ["digital menu navigation", "precision motor step odometer"]
  },
  "keypad-4x4": {
    type: "keypad-4x4",
    name: "4x4 Matrix Keypad",
    category: "sensor",
    blurb: "16-button membrane matrix keypad with 4 row lines and 4 column lines for PIN and code entry.",
    dimensions: { width: 118, height: 120 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "universal",
      polaritySensitive: false
    },
    pins: [
      { id: "r1", label: "Row 1", kind: "digital", aliases: ["row1"], role: "Row 1 scan line (keys 1, 2, 3, A) -> D2" },
      { id: "r2", label: "Row 2", kind: "digital", aliases: ["row2"], role: "Row 2 scan line (keys 4, 5, 6, B) -> D3" },
      { id: "r3", label: "Row 3", kind: "digital", aliases: ["row3"], role: "Row 3 scan line (keys 7, 8, 9, C) -> D4" },
      { id: "r4", label: "Row 4", kind: "digital", aliases: ["row4"], role: "Row 4 scan line (keys CLR, 0, OK, D) -> D5" },
      { id: "c1", label: "Col 1", kind: "digital", aliases: ["col1"], role: "Col 1 scan line -> D6" },
      { id: "c2", label: "Col 2", kind: "digital", aliases: ["col2"], role: "Col 2 scan line -> D7" },
      { id: "c3", label: "Col 3", kind: "digital", aliases: ["col3"], role: "Col 3 scan line -> D8" },
      { id: "c4", label: "Col 4", kind: "digital", aliases: ["col4"], role: "Col 4 scan line -> D9" }
    ],
    properties: [
      { key: "lastKey", type: "string", defaultValue: "", description: "Submitted key or PIN string upon pressing OK" },
      { key: "enteredPin", type: "string", defaultValue: "", description: "Uncommitted live typing buffer" }
    ],
    codeInterface: {
      cppLibraries: ["<Keypad.h>"],
      blocklyBlockTypes: ["keypad_read", "keypad_check_pin", "keypad_clear_pin"]
    },
    wiringRules: [
      { ruleId: "keypad-pin-sequence", type: "mandatory", description: "Rows connect to D2-D5 sequentially; Cols connect to D6-D9 sequentially." }
    ],
    trainingKeywords: ["keypad", "pin entry", "password", "matrix keypad", "access control", "safe lock", "security"],
    standardTopologies: ["security safe vault authentication station with servo and lcd"]
  },
  // ==========================================
  // 5. DISPLAYS & LIGHTING
  // ==========================================
  "lcd-i2c": {
    type: "lcd-i2c",
    name: "16x2 Character LCD with I2C Backpack",
    category: "display",
    blurb: "Two-line, 16-character alphanumeric Liquid Crystal Display module driven over a 2-wire I2C bus.",
    dimensions: { width: 180, height: 80 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V (I2C address 0x27)",
      maxCurrentMa: 80,
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Power ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "sda", label: "SDA", kind: "passive", aliases: ["data"], role: "I2C Serial Data (Uno: A4, ESP32: GPIO21)" },
      { id: "scl", label: "SCL", kind: "passive", aliases: ["clock"], role: "I2C Serial Clock (Uno: A5, ESP32: GPIO22)" }
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU CYBERLAB", description: "Top 16-character line" },
      { key: "line2", type: "string", defaultValue: "SYSTEM READY", description: "Bottom 16-character line" }
    ],
    codeInterface: {
      cppLibraries: ["<LiquidCrystal_I2C.h>", "<Wire.h>"],
      blocklyBlockTypes: ["lcd_print", "lcd_print_line", "lcd_set_cursor", "lcd_clear"]
    },
    wiringRules: [
      { ruleId: "lcd-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Arduino Uno." },
      { ruleId: "lcd-vcc-5v", type: "mandatory", description: "LCD backlight requires 5V for readable character contrast." }
    ],
    trainingKeywords: ["lcd", "display", "screen", "16x2", "i2c lcd", "text display", "message"],
    standardTopologies: ["dashboard telemetry screen", "passcode prompt display"]
  },
  "oled-i2c": {
    type: "oled-i2c",
    name: "0.96-inch Monochrome OLED Display",
    category: "display",
    blurb: "128x64 high-contrast blue/white organic LED display powered by SSD1306 driver over I2C.",
    dimensions: { width: 150, height: 92 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal (I2C address 0x3C)",
      maxCurrentMa: 25,
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "3.3V or 5V Power" },
      { id: "scl", label: "SCL", kind: "digital", aliases: ["clock"], role: "I2C Clock line (A5 on Uno)" },
      { id: "sda", label: "SDA", kind: "digital", aliases: ["data"], role: "I2C Data line (A4 on Uno)" }
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU TECH", description: "Header text line" },
      { key: "line2", type: "string", defaultValue: "READY", description: "Primary message line" },
      { key: "line3", type: "string", defaultValue: "", description: "Status footer line" }
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_GFX.h>", "<Adafruit_SSD1306.h>", "<Wire.h>"],
      blocklyBlockTypes: ["oled_print", "oled_clear"]
    },
    wiringRules: [
      { ruleId: "oled-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Uno." }
    ],
    trainingKeywords: ["oled", "display", "ssd1306", "graphics screen", "0.96 inch"],
    standardTopologies: ["compact wearable HUD display", "telemetry monitor"]
  },
  "neopixel-ring": {
    type: "neopixel-ring",
    name: "NeoPixel WS2812B 8-LED Ring",
    category: "display",
    blurb: "Individually-addressable 24-bit RGB smart LEDs chained on a single high-speed digital timing wire.",
    dimensions: { width: 100, height: 100 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 480,
      polaritySensitive: true
    },
    pins: [
      { id: "di", label: "DI (Data In)", kind: "digital", aliases: ["din", "data", "in"], role: "800kHz single-wire serial data in (e.g. D6)" },
      { id: "vcc", label: "VCC (5V)", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "do", label: "DO (Data Out)", kind: "digital", aliases: ["dout"], role: "Chaining data out to next NeoPixel module" }
    ],
    properties: [
      { key: "numPixels", type: "number", defaultValue: 8, description: "Total pixel count" },
      { key: "brightness", type: "number", defaultValue: 200, description: "Brightness level (0-255)" },
      { key: "pattern", type: "string", defaultValue: "rainbow", description: "Active animation pattern" },
      { key: "color", type: "string", defaultValue: "#38bdf8", description: "Active hex color" }
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_NeoPixel.h>"],
      blocklyBlockTypes: ["neopixel_set_color", "neopixel_show"],
      standardPinModes: { "di": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "neopixel-di-pin", type: "mandatory", description: "DI connects to high-speed digital pin (D6 recommended)." }
    ],
    trainingKeywords: ["neopixel", "ws2812b", "addressable led", "rgb ring", "smart led", "rainbow"],
    standardTopologies: ["mood lighting ring", "audio visualizer ring", "speedometer gauge"]
  },
  "seven-segment": {
    type: "seven-segment",
    name: "Common-Cathode 7-Segment Display",
    category: "display",
    blurb: "Eight individual LED segments (a, b, c, d, e, f, g, dp) arranged in figure-8 configuration to render decimal digits.",
    dimensions: { width: 60, height: 80 },
    electrical: {
      operatingVoltage: "2V forward drop per segment",
      logicLevel: "passive",
      polaritySensitive: true
    },
    pins: [
      { id: "a", label: "Seg A", kind: "passive", aliases: ["sega"], role: "Top horizontal bar -> D2" },
      { id: "b", label: "Seg B", kind: "passive", aliases: ["segb"], role: "Top-right vertical bar -> D3" },
      { id: "c", label: "Seg C", kind: "passive", aliases: ["segc"], role: "Bottom-right vertical bar -> D4" },
      { id: "d", label: "Seg D", kind: "passive", aliases: ["segd"], role: "Bottom horizontal bar -> D5" },
      { id: "e", label: "Seg E", kind: "passive", aliases: ["sege"], role: "Bottom-left vertical bar -> D6" },
      { id: "f", label: "Seg F", kind: "passive", aliases: ["segf"], role: "Top-left vertical bar -> D7" },
      { id: "g", label: "Seg G", kind: "passive", aliases: ["segg"], role: "Middle horizontal bar -> D8" },
      { id: "dp", label: "DP", kind: "passive", aliases: ["dot"], role: "Decimal point" },
      { id: "com", label: "Common Cathode", kind: "passive", aliases: ["gnd", "k"], role: "Common Cathode pin -> GND" }
    ],
    properties: [
      { key: "digit", type: "number", defaultValue: 0, description: "Active displayed digit (0-9)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["seven_segment_write", "seven_segment_clear"]
    },
    wiringRules: [
      { ruleId: "seven-seg-pins", type: "mandatory", description: "Segments a-g connect sequentially to digital pins D2 through D8. Common connects to GND." }
    ],
    trainingKeywords: ["7 segment", "seven segment", "counter", "digital display", "scoreboard", "digits"],
    standardTopologies: ["decade counter 0-9", "dice roller", "digital countdown timer"]
  },
  "rgb-led": {
    type: "rgb-led",
    name: "Common-Cathode RGB LED",
    category: "actuator",
    blurb: "Four-pin diffused LED packaging red, green, and blue diodes with a shared common cathode lead.",
    dimensions: { width: 50, height: 70 },
    electrical: {
      operatingVoltage: "2.0V - 3.2V forward drop",
      logicLevel: "passive",
      polaritySensitive: true
    },
    pins: [
      { id: "red", label: "Red Anode", kind: "passive", aliases: ["r"], role: "Red diode anode via 220\u03A9 resistor (PWM pin D9)" },
      { id: "gnd", label: "Common Cathode (-)", kind: "passive", aliases: ["k", "cathode"], role: "Common negative cathode -> GND" },
      { id: "green", label: "Green Anode", kind: "passive", aliases: ["g"], role: "Green diode anode via 220\u03A9 resistor (PWM pin D10)" },
      { id: "blue", label: "Blue Anode", kind: "passive", aliases: ["b"], role: "Blue diode anode via 220\u03A9 resistor (PWM pin D11)" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_analogwrite", "io_digitalwrite"]
    },
    wiringRules: [
      { ruleId: "rgb-resistors", type: "mandatory", description: "Each color anode (Red, Green, Blue) requires its own 220\u03A9 current-limiting resistor." },
      { ruleId: "rgb-pwm-pins", type: "recommended", description: "Connect to PWM pins (D9, D10, D11) for full 16-million color mixing." }
    ],
    trainingKeywords: ["rgb led", "multi color led", "color mixing", "tricolor led"],
    standardTopologies: ["mood lamp color fader", "traffic light single bulb"]
  },
  // ==========================================
  // 6. DISCRETE SEMICONDUCTORS & BREADBOARD
  // ==========================================
  "npn-transistor": {
    type: "npn-transistor",
    name: "2N2222 NPN Bipolar Junction Transistor",
    category: "driver",
    blurb: "Current-controlled electronic switch allowing a small base current to switch larger collector-emitter currents.",
    dimensions: { width: 40, height: 56 },
    electrical: {
      operatingVoltage: "Up to 40V VCEO",
      logicLevel: "passive",
      maxCurrentMa: 800,
      polaritySensitive: true
    },
    pins: [
      { id: "emitter", label: "Emitter (E)", kind: "passive", aliases: ["e"], role: "Connects to Ground (0V)" },
      { id: "base", label: "Base (B)", kind: "passive", aliases: ["b"], role: "Control terminal. Connects to digital pin via 1k\u03A9 base resistor." },
      { id: "collector", label: "Collector (C)", kind: "passive", aliases: ["c"], role: "Load connection to ground return" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"]
    },
    wiringRules: [
      { ruleId: "transistor-base-resistor", type: "mandatory", description: "Must ALWAYS have a 1k\u03A9 resistor between microcontroller digital pin and Base terminal to prevent burning GPIO." }
    ],
    trainingKeywords: ["transistor", "npn", "2n2222", "electronic switch", "amplifier"],
    standardTopologies: ["low-side switch for DC motor or high-power buzzer"]
  },
  breadboard: {
    type: "breadboard",
    name: "Solderless Prototyping Breadboard",
    category: "prototyping",
    blurb: "Full-size solderless breadboard with interconnected terminal strips (a-e, f-j) and full-length power distribution rails.",
    dimensions: { width: 460, height: 214 },
    electrical: {
      operatingVoltage: "0V - 12V",
      logicLevel: "passive",
      polaritySensitive: false
    },
    pins: [
      { id: "pos_top", label: "+ Rail (Top)", kind: "power", aliases: ["+top"], role: "Continuous positive 5V power bus" },
      { id: "neg_top", label: "- Rail (Top)", kind: "ground", aliases: ["-top"], role: "Continuous ground 0V bus" },
      { id: "pos_bot", label: "+ Rail (Bottom)", kind: "power", aliases: ["+bot"], role: "Continuous positive 5V power bus" },
      { id: "neg_bot", label: "- Rail (Bottom)", kind: "ground", aliases: ["-bot"], role: "Continuous ground 0V bus" },
      { id: "a1", label: "Row a1", kind: "passive", aliases: [], role: "5-pin tie-point column" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "breadboard-rails", type: "recommended", description: "Use top and bottom rails for 5V and GND distribution." }
    ],
    trainingKeywords: ["breadboard", "prototyping", "solderless", "tie points"],
    standardTopologies: ["central wiring breadboard bus"]
  }
};

// src/lib/components-catalog.ts
function distribute(labels, left, right, y) {
  const n = labels.length;
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind
    };
  });
}
var ARDUINO_W2 = 320;
var ARDUINO_H2 = 200;
var BREADBOARD_COLUMNS = 20;
var topPins = distribute(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground" },
    { label: "D13", kind: "digital" },
    { label: "D12", kind: "digital" },
    { label: "D11", kind: "digital" },
    { label: "D10", kind: "digital" },
    { label: "D9", kind: "digital" },
    { label: "D8", kind: "digital" },
    { label: "D7", kind: "digital" },
    { label: "D6", kind: "digital" },
    { label: "D5", kind: "digital" },
    { label: "D4", kind: "digital" },
    { label: "D3", kind: "digital" },
    { label: "D2", kind: "digital" },
    { label: "D1", kind: "digital" },
    { label: "D0", kind: "digital" }
  ],
  22,
  ARDUINO_W2 - 22,
  8
);
var bottomPins = distribute(
  [
    { label: "5V", kind: "power" },
    { label: "3V3", kind: "power" },
    { label: "RST", kind: "digital" },
    { label: "VIN", kind: "power" },
    { label: "GND", kind: "ground" },
    { label: "A0", kind: "analog" },
    { label: "A1", kind: "analog" },
    { label: "A2", kind: "analog" },
    { label: "A3", kind: "analog" },
    { label: "A4", kind: "analog" },
    { label: "A5", kind: "analog" }
  ],
  40,
  ARDUINO_W2 - 40,
  ARDUINO_H2 - 8
).map(
  (p, i) => (
    // disambiguate the two GND ids across headers
    p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p
  )
);
var CATALOG = {
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno",
    blurb: "ATmega328P microcontroller board",
    width: ARDUINO_W2,
    height: ARDUINO_H2,
    pins: [...topPins, ...bottomPins]
  },
  "esp32-devkit": {
    type: "esp32-devkit",
    name: ESP32_DEVKIT_BOARD.name,
    blurb: ESP32_DEVKIT_BOARD.blurb,
    width: ESP32_DEVKIT_BOARD.width,
    height: ESP32_DEVKIT_BOARD.height,
    pins: ESP32_DEVKIT_BOARD.pins
  },
  "rpi-pico": {
    type: "rpi-pico",
    name: RPI_PICO_BOARD.name,
    blurb: RPI_PICO_BOARD.blurb,
    width: RPI_PICO_BOARD.width,
    height: RPI_PICO_BOARD.height,
    pins: RPI_PICO_BOARD.pins
  },
  "microbit-v2": {
    type: "microbit-v2",
    name: MICROBIT_V2_BOARD.name,
    blurb: MICROBIT_V2_BOARD.blurb,
    width: MICROBIT_V2_BOARD.width,
    height: MICROBIT_V2_BOARD.height,
    pins: MICROBIT_V2_BOARD.pins
  },
  breadboard: {
    type: "breadboard",
    name: "Breadboard",
    blurb: "Full 20-column solderless prototyping breadboard with bus rails",
    width: 460,
    height: 214,
    pins: (() => {
      const pins = [];
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const x = 40 + (c - 1) * 20;
        pins.push({ id: `pos_t_${c}`, label: `+ rail (col ${c})`, x, y: 16, kind: "power" });
        pins.push({ id: `neg_t_${c}`, label: `- rail (col ${c})`, x, y: 28, kind: "ground" });
        pins.push({ id: `a_${c}`, label: `a${c}`, x, y: 50, kind: "passive" });
        pins.push({ id: `b_${c}`, label: `b${c}`, x, y: 62, kind: "passive" });
        pins.push({ id: `c_${c}`, label: `c${c}`, x, y: 74, kind: "passive" });
        pins.push({ id: `d_${c}`, label: `d${c}`, x, y: 86, kind: "passive" });
        pins.push({ id: `e_${c}`, label: `e${c}`, x, y: 98, kind: "passive" });
        pins.push({ id: `f_${c}`, label: `f${c}`, x, y: 118, kind: "passive" });
        pins.push({ id: `g_${c}`, label: `g${c}`, x, y: 130, kind: "passive" });
        pins.push({ id: `h_${c}`, label: `h${c}`, x, y: 142, kind: "passive" });
        pins.push({ id: `i_${c}`, label: `i${c}`, x, y: 154, kind: "passive" });
        pins.push({ id: `j_${c}`, label: `j${c}`, x, y: 166, kind: "passive" });
        pins.push({ id: `pos_b_${c}`, label: `+ rail (col ${c})`, x, y: 186, kind: "power" });
        pins.push({ id: `neg_b_${c}`, label: `- rail (col ${c})`, x, y: 198, kind: "ground" });
      }
      pins.push({ id: "pos_top", label: "+ rail (top)", x: 40, y: 16, kind: "power" });
      pins.push({ id: "neg_top", label: "- rail (top)", x: 40, y: 28, kind: "ground" });
      pins.push({ id: "pos_bot", label: "+ rail (bot)", x: 40, y: 186, kind: "power" });
      pins.push({ id: "neg_bot", label: "- rail (bot)", x: 40, y: 198, kind: "ground" });
      pins.push({ id: "a1", label: "row A", x: 80, y: 50, kind: "passive" });
      pins.push({ id: "b1", label: "row B", x: 140, y: 50, kind: "passive" });
      pins.push({ id: "c1", label: "row C", x: 200, y: 50, kind: "passive" });
      pins.push({ id: "d1", label: "row D", x: 260, y: 50, kind: "passive" });
      pins.push({ id: "e1", label: "row E", x: 320, y: 50, kind: "passive" });
      pins.push({ id: "a2", label: "row A", x: 80, y: 118, kind: "passive" });
      pins.push({ id: "b2", label: "row B", x: 140, y: 118, kind: "passive" });
      pins.push({ id: "c2", label: "row C", x: 200, y: 118, kind: "passive" });
      pins.push({ id: "d2", label: "row D", x: 260, y: 118, kind: "passive" });
      pins.push({ id: "e2", label: "row E", x: 320, y: 118, kind: "passive" });
      return pins;
    })()
  },
  led: {
    type: "led",
    name: "LED",
    blurb: "Light-emitting diode",
    width: 44,
    height: 66,
    pins: [
      { id: "anode", label: "Anode (+)", x: 14, y: 62, kind: "passive" },
      { id: "cathode", label: "Cathode (-)", x: 30, y: 62, kind: "passive" }
    ],
    defaults: { color: "red" }
  },
  resistor: {
    type: "resistor",
    name: "Resistor",
    blurb: "Limits current flow",
    width: 88,
    height: 26,
    pins: [
      { id: "a", label: "Terminal 1", x: 3, y: 13, kind: "passive" },
      { id: "b", label: "Terminal 2", x: 85, y: 13, kind: "passive" }
    ],
    defaults: { resistance: 220 }
  },
  pushbutton: {
    type: "pushbutton",
    name: "Pushbutton",
    blurb: "Momentary tactile switch",
    width: 60,
    height: 60,
    pins: [
      { id: "p1a", label: "1a", x: 6, y: 8, kind: "passive" },
      { id: "p2a", label: "2a", x: 54, y: 8, kind: "passive" },
      { id: "p1b", label: "1b", x: 6, y: 52, kind: "passive" },
      { id: "p2b", label: "2b", x: 54, y: 52, kind: "passive" }
    ]
  },
  battery: {
    type: "battery",
    name: "Battery",
    blurb: "DC power source",
    width: 62,
    height: 92,
    pins: [
      { id: "pos", label: "+", x: 20, y: 88, kind: "power" },
      { id: "neg", label: "-", x: 42, y: 88, kind: "ground" }
    ],
    defaults: { voltage: 9 }
  },
  potentiometer: {
    type: "potentiometer",
    name: "Potentiometer",
    blurb: "Variable resistor / knob",
    width: 64,
    height: 64,
    pins: [
      { id: "t1", label: "Terminal 1", x: 12, y: 60, kind: "passive" },
      { id: "wiper", label: "Wiper", x: 32, y: 60, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 52, y: 60, kind: "passive" }
    ],
    defaults: { value: 512, resistance: 1e4 }
  },
  servo: {
    type: "servo",
    name: "Servo Motor",
    blurb: "Positional rotation motor",
    width: 100,
    height: 70,
    pins: [
      { id: "sig", label: "Signal", x: 4, y: 18, kind: "digital" },
      { id: "vcc", label: "VCC", x: 4, y: 35, kind: "power" },
      { id: "gnd", label: "GND", x: 4, y: 52, kind: "ground" }
    ],
    defaults: { angle: 90 }
  },
  buzzer: {
    type: "buzzer",
    name: "Piezo Buzzer",
    blurb: "Produces tones",
    width: 56,
    height: 56,
    pins: [
      { id: "pos", label: "+", x: 20, y: 52, kind: "power" },
      { id: "neg", label: "-", x: 36, y: 52, kind: "ground" }
    ]
  },
  "rgb-led": {
    type: "rgb-led",
    name: "RGB LED",
    blurb: "Common-cathode RGB light-emitting diode",
    width: 50,
    height: 70,
    pins: [
      { id: "red", label: "Red", x: 8, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 18, y: 66, kind: "passive" },
      { id: "green", label: "Green", x: 28, y: 66, kind: "passive" },
      { id: "blue", label: "Blue", x: 38, y: 66, kind: "passive" }
    ]
  },
  "seven-segment": {
    type: "seven-segment",
    name: "7-Segment Display",
    blurb: "Single digit numeric display",
    width: 60,
    height: 80,
    pins: [
      { id: "a", label: "Seg A", x: 5, y: 76, kind: "passive" },
      { id: "b", label: "Seg B", x: 15, y: 76, kind: "passive" },
      { id: "c", label: "Seg C", x: 25, y: 76, kind: "passive" },
      { id: "d", label: "Seg D", x: 35, y: 76, kind: "passive" },
      { id: "e", label: "Seg E", x: 5, y: 4, kind: "passive" },
      { id: "f", label: "Seg F", x: 15, y: 4, kind: "passive" },
      { id: "g", label: "Seg G", x: 25, y: 4, kind: "passive" },
      { id: "dp", label: "DP", x: 35, y: 4, kind: "passive" },
      { id: "com", label: "Common", x: 55, y: 40, kind: "passive" }
    ]
  },
  "lcd-i2c": {
    type: "lcd-i2c",
    name: "LCD 16\xD72 (I2C)",
    blurb: "Two-line alphanumeric display with I2C backpack",
    width: 180,
    height: 80,
    pins: [
      { id: "gnd", label: "GND", x: 30, y: 76, kind: "ground" },
      { id: "vcc", label: "VCC", x: 60, y: 76, kind: "power" },
      { id: "sda", label: "SDA", x: 90, y: 76, kind: "passive" },
      { id: "scl", label: "SCL", x: 120, y: 76, kind: "passive" }
    ]
  },
  ultrasonic: {
    type: "ultrasonic",
    name: "Ultrasonic Sensor",
    blurb: "HC-SR04 distance measurement (2-400cm)",
    width: 100,
    height: 56,
    pins: [
      { id: "vcc", label: "VCC", x: 20, y: 52, kind: "power" },
      { id: "trig", label: "Trig", x: 40, y: 52, kind: "passive" },
      { id: "echo", label: "Echo", x: 60, y: 52, kind: "passive" },
      { id: "gnd", label: "GND", x: 80, y: 52, kind: "ground" }
    ]
  },
  "pir-sensor": {
    type: "pir-sensor",
    name: "PIR Motion Sensor",
    blurb: "Passive infrared motion detector",
    width: 60,
    height: 70,
    pins: [
      { id: "vcc", label: "VCC", x: 10, y: 66, kind: "power" },
      { id: "out", label: "OUT", x: 30, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 50, y: 66, kind: "ground" }
    ]
  },
  ldr: {
    type: "ldr",
    name: "Photoresistor (LDR)",
    blurb: "Light-dependent resistor for light sensing",
    width: 40,
    height: 50,
    pins: [
      { id: "t1", label: "Terminal 1", x: 10, y: 46, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 30, y: 46, kind: "passive" }
    ]
  },
  tmp36: {
    type: "tmp36",
    name: "Temperature Sensor",
    blurb: "TMP36 analog temperature sensor (-40 to 125\xB0C)",
    width: 40,
    height: 50,
    pins: [
      { id: "vcc", label: "VCC", x: 6, y: 46, kind: "power" },
      { id: "out", label: "Vout", x: 20, y: 46, kind: "passive" },
      { id: "gnd", label: "GND", x: 34, y: 46, kind: "ground" }
    ]
  },
  "dc-motor": {
    type: "dc-motor",
    name: "DC Motor",
    blurb: "Small brushed DC motor",
    width: 108,
    height: 72,
    pins: [
      { id: "pos", label: "M+", x: 34, y: 68, kind: "passive" },
      { id: "neg", label: "M-", x: 76, y: 68, kind: "passive" }
    ]
  },
  "npn-transistor": {
    type: "npn-transistor",
    name: "NPN Transistor",
    blurb: "2N2222 general-purpose NPN switching transistor",
    width: 40,
    height: 56,
    pins: [
      { id: "emitter", label: "Emitter (E)", x: 8, y: 52, kind: "passive" },
      { id: "base", label: "Base (B)", x: 20, y: 52, kind: "passive" },
      { id: "collector", label: "Collector (C)", x: 32, y: 52, kind: "passive" }
    ]
  },
  relay: {
    type: "relay",
    name: "Relay Module",
    blurb: "5V single-channel relay for high-voltage switching",
    width: 112,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 28, y: 80, kind: "power" },
      { id: "gnd", label: "GND", x: 56, y: 80, kind: "ground" },
      { id: "in", label: "IN", x: 84, y: 80, kind: "passive" },
      { id: "com", label: "COM", x: 72, y: 4, kind: "passive" },
      { id: "no", label: "NO", x: 86, y: 4, kind: "passive" },
      { id: "nc", label: "NC", x: 100, y: 4, kind: "passive" }
    ]
  },
  "ir-sensor": {
    type: "ir-sensor",
    name: "IR Obstacle Sensor",
    blurb: "Digital infrared obstacle / line sensor",
    width: 76,
    height: 64,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 60, kind: "power" },
      { id: "out", label: "OUT", x: 38, y: 60, kind: "digital" },
      { id: "gnd", label: "GND", x: 64, y: 60, kind: "ground" }
    ],
    defaults: { detected: "false" }
  },
  "dht11": {
    type: "dht11",
    name: "DHT11 Climate Sensor",
    blurb: "Temperature + humidity digital sensor",
    width: 72,
    height: 66,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 62, kind: "power" },
      { id: "data", label: "DATA", x: 36, y: 62, kind: "digital" },
      { id: "gnd", label: "GND", x: 60, y: 62, kind: "ground" }
    ],
    defaults: { temperature: 25, humidity: 55 }
  },
  "oled-i2c": {
    type: "oled-i2c",
    name: "OLED 0.96\u2033 I2C",
    blurb: "128\xD764 monochrome I2C display",
    width: 150,
    height: 92,
    pins: [
      { id: "gnd", label: "GND", x: 28, y: 88, kind: "ground" },
      { id: "vcc", label: "VCC", x: 58, y: 88, kind: "power" },
      { id: "scl", label: "SCL", x: 88, y: 88, kind: "digital" },
      { id: "sda", label: "SDA", x: 118, y: 88, kind: "digital" }
    ],
    defaults: { line1: "PIXIU TECH", line2: "READY", line3: "" }
  },
  "joystick": {
    type: "joystick",
    name: "2-Axis Joystick",
    blurb: "X/Y analog control + push button",
    width: 86,
    height: 86,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 82, kind: "ground" },
      { id: "vcc", label: "VCC", x: 28, y: 82, kind: "power" },
      { id: "vrx", label: "VRx", x: 46, y: 82, kind: "analog" },
      { id: "vry", label: "VRy", x: 64, y: 82, kind: "analog" },
      { id: "sw", label: "SW", x: 78, y: 82, kind: "digital" }
    ],
    defaults: { x: 512, y: 512, pressed: "false" }
  },
  "l298n": {
    type: "l298n",
    name: "L298N Motor Driver",
    blurb: "Dual H-bridge for two DC motors",
    width: 150,
    height: 112,
    pins: [
      { id: "vs", label: "VMotor", x: 24, y: 8, kind: "power" },
      { id: "gnd", label: "GND", x: 48, y: 8, kind: "ground" },
      { id: "5v", label: "5V", x: 72, y: 8, kind: "power" },
      { id: "ena", label: "ENA", x: 30, y: 104, kind: "digital" },
      { id: "in1", label: "IN1", x: 46, y: 104, kind: "digital" },
      { id: "in2", label: "IN2", x: 62, y: 104, kind: "digital" },
      { id: "out1", label: "OUT1", x: 8, y: 39, kind: "passive" },
      { id: "out2", label: "OUT2", x: 8, y: 66, kind: "passive" },
      { id: "out3", label: "OUT3", x: 142, y: 39, kind: "passive" },
      { id: "out4", label: "OUT4", x: 142, y: 66, kind: "passive" },
      { id: "enb", label: "ENB", x: 110, y: 104, kind: "digital" },
      { id: "in3", label: "IN3", x: 78, y: 104, kind: "digital" },
      { id: "in4", label: "IN4", x: 94, y: 104, kind: "digital" }
    ],
    defaults: { speedA: 0, speedB: 0 }
  },
  "rotary-encoder": {
    type: "rotary-encoder",
    name: "Rotary Encoder",
    blurb: "Incremental dial with push switch",
    width: 74,
    height: 82,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 78, kind: "ground" },
      { id: "vcc", label: "VCC", x: 25, y: 78, kind: "power" },
      { id: "clk", label: "CLK", x: 40, y: 78, kind: "digital" },
      { id: "dt", label: "DT", x: 55, y: 78, kind: "digital" },
      { id: "sw", label: "SW", x: 68, y: 78, kind: "digital" }
    ],
    defaults: { value: 0, pressed: "false" }
  },
  "soil-moisture": {
    type: "soil-moisture",
    name: "Soil Moisture Sensor",
    blurb: "Analog probe for smart farming projects",
    width: 72,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 14, y: 80, kind: "power" },
      { id: "ao", label: "AO", x: 36, y: 80, kind: "analog" },
      { id: "gnd", label: "GND", x: 58, y: 80, kind: "ground" }
    ],
    defaults: { moisture: 620 }
  },
  "keypad-4x4": {
    type: "keypad-4x4",
    name: "4\xD74 Matrix Keypad",
    blurb: "Sixteen-key matrix input for access and control",
    width: 118,
    height: 120,
    pins: [
      { id: "r1", label: "R1", x: 12, y: 116, kind: "digital" },
      { id: "r2", label: "R2", x: 42, y: 116, kind: "digital" },
      { id: "r3", label: "R3", x: 72, y: 116, kind: "digital" },
      { id: "r4", label: "R4", x: 102, y: 116, kind: "digital" },
      { id: "c1", label: "C1", x: 12, y: 4, kind: "digital" },
      { id: "c2", label: "C2", x: 42, y: 4, kind: "digital" },
      { id: "c3", label: "C3", x: 72, y: 4, kind: "digital" },
      { id: "c4", label: "C4", x: 102, y: 4, kind: "digital" }
    ],
    defaults: { lastKey: "" }
  },
  "neopixel-ring": {
    type: "neopixel-ring",
    name: "NeoPixel RGB Ring (8x)",
    blurb: "Addressable WS2812B 8-LED circular ring module",
    width: 100,
    height: 100,
    pins: [
      { id: "di", label: "DI", x: 22, y: 92, kind: "digital" },
      { id: "vcc", label: "VCC (5V)", x: 40, y: 92, kind: "power" },
      { id: "gnd", label: "GND", x: 60, y: 92, kind: "ground" },
      { id: "do", label: "DO", x: 78, y: 92, kind: "digital" }
    ],
    defaults: { numPixels: 8, brightness: 200, pattern: "rainbow", color: "#38bdf8" }
  },
  "mq2-gas": {
    type: "mq2-gas",
    name: "MQ-2 Gas / Smoke Sensor",
    blurb: "LPG, propane, methane, hydrogen and smoke detection module",
    width: 80,
    height: 90,
    pins: [
      { id: "vcc", label: "VCC", x: 16, y: 84, kind: "power" },
      { id: "gnd", label: "GND", x: 32, y: 84, kind: "ground" },
      { id: "do", label: "DO", x: 48, y: 84, kind: "digital" },
      { id: "ao", label: "AO", x: 64, y: 84, kind: "analog" }
    ],
    defaults: { gasLevel: 150, threshold: 350 }
  }
};

// src/lib/breadboard-pins.ts
function getLegacyBreadboardPinMappings() {
  const mappings = [
    ["pos_top", "pos_t_1"],
    ["neg_top", "neg_t_1"],
    ["pos_bot", "pos_b_1"],
    ["neg_bot", "neg_b_1"]
  ];
  for (const row of ["a", "b", "c", "d", "e"]) {
    const column = (row.charCodeAt(0) - "a".charCodeAt(0) + 1) * 3;
    mappings.push([`${row}1`, `${row}_${column}`]);
    mappings.push([`${row}2`, `${String.fromCharCode(row.charCodeAt(0) + 5)}_${column}`]);
  }
  return mappings;
}

// src/lib/circuit-validator.ts
var PIN_ALIAS_MAP = {
  led: {
    a: "anode",
    pos: "anode",
    "+": "anode",
    p: "anode",
    plus: "anode",
    k: "cathode",
    neg: "cathode",
    "-": "cathode",
    c: "cathode",
    minus: "cathode"
  },
  resistor: {
    t1: "a",
    "1": "a",
    pin1: "a",
    term1: "a",
    t2: "b",
    "2": "b",
    pin2: "b",
    term2: "b"
  },
  pushbutton: {
    "1a": "p1a",
    t1a: "p1a",
    terminal1a: "p1a",
    "1b": "p1b",
    t1b: "p1b",
    terminal1b: "p1b",
    "2a": "p2a",
    t2a: "p2a",
    terminal2a: "p2a",
    "2b": "p2b",
    t2b: "p2b",
    terminal2b: "p2b"
  },
  potentiometer: {
    t1: "t1",
    "1": "t1",
    pin1: "t1",
    vcc: "t1",
    "5v": "t1",
    wiper: "wiper",
    w: "wiper",
    out: "wiper",
    sig: "wiper",
    "2": "wiper",
    pin2: "wiper",
    t2: "t2",
    "3": "t2",
    pin3: "t2",
    gnd: "t2"
  },
  battery: {
    pos: "pos",
    "+": "pos",
    positive: "pos",
    vcc: "pos",
    "9v": "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    negative: "neg",
    gnd: "neg",
    black: "neg"
  },
  servo: {
    sig: "sig",
    signal: "sig",
    pwm: "sig",
    control: "sig",
    orange: "sig",
    yellow: "sig",
    data: "sig",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    red: "vcc",
    pos: "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    black: "gnd",
    brown: "gnd",
    neg: "gnd",
    "-": "gnd"
  },
  buzzer: {
    pos: "pos",
    "+": "pos",
    anode: "pos",
    sig: "pos",
    signal: "pos",
    pin1: "pos",
    vcc: "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    cathode: "neg",
    gnd: "neg",
    ground: "neg",
    pin2: "neg",
    black: "neg"
  },
  "rgb-led": {
    r: "red",
    anode_r: "red",
    gnd: "gnd",
    com: "gnd",
    cathode: "gnd",
    c: "gnd",
    "-": "gnd",
    g: "green",
    anode_g: "green",
    b: "blue",
    anode_b: "blue"
  },
  ultrasonic: {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    trig: "trig",
    trigger: "trig",
    echo: "echo",
    gnd: "gnd",
    ground: "gnd"
  },
  dht11: {
    vcc: "vcc",
    "+": "vcc",
    power: "vcc",
    data: "data",
    out: "data",
    sig: "data",
    signal: "data",
    pin2: "data",
    gnd: "gnd",
    "-": "gnd",
    ground: "gnd"
  },
  "pir-sensor": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  tmp36: {
    vcc: "vcc",
    vs: "vcc",
    power: "vcc",
    out: "out",
    vout: "out",
    sig: "out",
    signal: "out",
    analog: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  ldr: {
    t1: "t1",
    "1": "t1",
    a: "t1",
    pin1: "t1",
    t2: "t2",
    "2": "t2",
    b: "t2",
    pin2: "t2"
  },
  relay: {
    vcc: "vcc",
    power: "vcc",
    gnd: "gnd",
    ground: "gnd",
    in: "in",
    sig: "in",
    signal: "in",
    control: "in",
    input: "in",
    com: "com",
    common: "com",
    no: "no",
    normally_open: "no",
    nc: "nc",
    normally_closed: "nc"
  },
  l298n: {
    vs: "vs",
    vcc: "vs",
    power: "vs",
    "12v": "vs",
    "9v": "vs",
    gnd: "gnd",
    ground: "gnd",
    "5v": "5v",
    logic_vcc: "5v",
    ena: "ena",
    enb: "enb",
    in1: "in1",
    in2: "in2",
    in3: "in3",
    in4: "in4",
    out1: "out1",
    out2: "out2",
    out3: "out3",
    out4: "out4"
  },
  "lcd-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    sda: "sda",
    data: "sda",
    scl: "scl",
    clk: "scl",
    clock: "scl"
  },
  "oled-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "3v3": "vcc",
    "5v": "vcc",
    scl: "scl",
    clk: "scl",
    clock: "scl",
    sda: "sda",
    data: "sda"
  },
  "neopixel-ring": {
    di: "di",
    din: "di",
    data: "di",
    in: "di",
    sig: "di",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    "-": "gnd",
    do: "do",
    dout: "do",
    out: "do"
  },
  "mq2-gas": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    gnd: "gnd",
    ground: "gnd",
    do: "do",
    digital: "do",
    dout: "do",
    ao: "ao",
    analog: "ao",
    aout: "ao"
  },
  "soil-moisture": {
    vcc: "vcc",
    power: "vcc",
    ao: "ao",
    analog: "ao",
    out: "ao",
    sig: "ao",
    signal: "ao",
    gnd: "gnd",
    ground: "gnd"
  },
  "ir-sensor": {
    vcc: "vcc",
    power: "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  joystick: {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    vrx: "vrx",
    x: "vrx",
    vx: "vrx",
    vry: "vry",
    y: "vry",
    vy: "vry",
    sw: "sw",
    btn: "sw",
    switch: "sw",
    button: "sw"
  },
  "rotary-encoder": {
    gnd: "gnd",
    vcc: "vcc",
    clk: "clk",
    a: "clk",
    dt: "dt",
    b: "dt",
    sw: "sw",
    btn: "sw"
  },
  "dc-motor": {
    pos: "pos",
    "+": "pos",
    "m+": "pos",
    pin1: "pos",
    neg: "neg",
    "-": "neg",
    "m-": "neg",
    pin2: "neg"
  },
  "npn-transistor": {
    collector: "collector",
    c: "collector",
    base: "base",
    b: "base",
    emitter: "emitter",
    e: "emitter"
  },
  "seven-segment": {
    com: "com",
    common: "com",
    gnd: "com",
    cathode: "com",
    dp: "dp",
    dot: "dp"
  }
};
function resolveCanonicalPin(partType, pinId) {
  const clean = pinId.trim().toLowerCase();
  if (!clean) return clean;
  const partAliases = PIN_ALIAS_MAP[partType];
  if (partAliases && partAliases[clean]) {
    return partAliases[clean];
  }
  if (partType === "breadboard") {
    if (clean === "pos_top" || clean === "+top" || clean === "top_+") return "pos_top";
    if (clean === "neg_top" || clean === "-top" || clean === "top_-") return "neg_top";
    if (clean === "pos_bot" || clean === "+bot" || clean === "bot_+") return "pos_bot";
    if (clean === "neg_bot" || clean === "-bot" || clean === "bot_-") return "neg_bot";
    return clean.replace(/[-]/g, "_");
  }
  if (isBoardPart(partType)) {
    const board = getBoardDefinition(partType);
    if (board) {
      for (const p of board.pins) {
        if (p.id.toLowerCase() === clean || p.label.toLowerCase() === clean) {
          return p.id;
        }
        if (p.alternateNames?.some((alt) => alt.toLowerCase() === clean)) {
          return p.id;
        }
      }
      if (clean === "5v" || clean === "v5") return "5v";
      if (clean === "v33" || clean === "3v3" || clean === "3.3v" || clean === "3v") {
        return board.powerPins.v33?.[0] ?? "3v3";
      }
      if (clean === "vin" || clean === "v_in") return "vin";
      if (clean === "gnd" || clean.startsWith("gnd")) {
        return board.powerPins.gnd[0] ?? "gnd";
      }
      const numOnly = clean.replace(/^(gpio|gp|d|p)/, "");
      if (/^\d+$/.test(numOnly)) {
        for (const p of board.pins) {
          const bpNum = p.id.replace(/^(gpio|gp|d|p)/, "");
          if (bpNum === numOnly) return p.id;
        }
      }
    }
  }
  const catalogDefinition = CATALOG[partType];
  const componentPins = PIXIU_COMPONENTS_DATASET[partType]?.pins ?? [];
  const datasetPin = componentPins.find(
    (pin) => pin.id.toLowerCase() === clean || pin.label.trim().toLowerCase() === clean || pin.aliases.some((alias) => alias.trim().toLowerCase() === clean)
  );
  if (datasetPin && catalogDefinition?.pins.some((pin) => pin.id.toLowerCase() === datasetPin.id.toLowerCase())) {
    return datasetPin.id;
  }
  const catalogPin = catalogDefinition?.pins.find(
    (pin) => pin.id.toLowerCase() === clean || pin.label.trim().toLowerCase() === clean
  );
  if (catalogPin) return catalogPin.id;
  return clean;
}
function isRegisteredPin(partType, pinId) {
  const definition = CATALOG[partType];
  return Boolean(definition?.pins.some((pin) => pin.id.toLowerCase() === pinId.toLowerCase()));
}
function computeCircuitHash(circuit, blocklyXml) {
  const sortedParts = [...circuit.parts].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({
    id: p.id,
    type: p.type,
    // Preserve sub-pixel edits; revision guards must not round away real mutations.
    x: Object.is(p.x, -0) ? 0 : p.x,
    y: Object.is(p.y, -0) ? 0 : p.y,
    rotation: Object.is(p.rotation || 0, -0) ? 0 : p.rotation || 0,
    props: Object.keys(p.props || {}).sort().reduce((acc, k) => {
      acc[k] = p.props[k];
      return acc;
    }, {})
  }));
  const sortedWires = [...circuit.wires].sort((a, b) => {
    const kA = `${a.from.partId}:${a.from.pinId}->${a.to.partId}:${a.to.pinId}`;
    const kB = `${b.from.partId}:${b.from.pinId}->${b.to.partId}:${b.to.pinId}`;
    return kA.localeCompare(kB);
  }).map((w) => ({
    from: `${w.from.partId}:${w.from.pinId}`,
    to: `${w.to.partId}:${w.to.pinId}`,
    color: w.color || "#38bdf8"
  }));
  const canonicalStr = JSON.stringify({
    parts: sortedParts,
    wires: sortedWires,
    blocklyXml: blocklyXml ?? null
  });
  let h1 = 2166136261;
  let h2 = 2166136261 ^ 1540483477;
  for (let i = 0; i < canonicalStr.length; i++) {
    const code = canonicalStr.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 16777619);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${p1}${p2}`;
}
var DisjointSet = class {
  parent = /* @__PURE__ */ new Map();
  find(item) {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
      return item;
    }
    const root = this.parent.get(item);
    if (root === item) return item;
    const resolved = this.find(root);
    this.parent.set(item, resolved);
    return resolved;
  }
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
  connected(a, b) {
    return this.find(a) === this.find(b);
  }
  allNodes() {
    return Array.from(this.parent.keys());
  }
};
function validateProposedCircuit(candidate, options = {}) {
  const allowWarnings = options.allowWarnings ?? true;
  const notices = [];
  const errors = [];
  const warnings = [];
  const metrics = {
    partCount: 0,
    wireCount: 0,
    unconnectedPins: 0,
    powerRailsOk: true,
    shortCircuitsFound: 0,
    overcurrentRisks: 0,
    overvoltageRisks: 0,
    unpoweredModules: 0,
    missingReturnPaths: 0
  };
  const addNotice = (notice) => {
    notices.push(notice);
    if (notice.severity === "critical") {
      errors.push(`${notice.title}: ${notice.message}`);
    } else if (notice.severity === "warning") {
      warnings.push(`${notice.title}: ${notice.message}`);
    }
  };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    addNotice({
      ruleId: "schema-envelope-invalid",
      severity: "critical",
      category: "schema",
      title: "Malformed Circuit Payload",
      message: "The circuit proposal is not a valid JSON object.",
      suggestion: "Provide a JSON object containing 'parts' and 'wires' arrays.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  const rawCandidate = candidate;
  if (!Array.isArray(rawCandidate.parts)) {
    addNotice({
      ruleId: "schema-parts-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Parts Array",
      message: "Proposed circuit object must contain a 'parts' array.",
      suggestion: "Include 'parts: []' in the proposed circuit structure.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  if (!Array.isArray(rawCandidate.wires)) {
    addNotice({
      ruleId: "schema-wires-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Wires Array",
      message: "Proposed circuit object must contain a 'wires' array.",
      suggestion: "Include 'wires: []' in the proposed circuit structure.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  const partMap = /* @__PURE__ */ new Map();
  const validPartIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawCandidate.parts.length; i++) {
    const rawPart = rawCandidate.parts[i];
    if (!rawPart || typeof rawPart !== "object") {
      addNotice({
        ruleId: `schema-part-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Part Entry",
        message: `Part at index ${i} is not a valid object.`,
        suggestion: "Ensure all items in the 'parts' array are valid PlacedPart objects.",
        involvedPartIds: []
      });
      continue;
    }
    const p = rawPart;
    if (!p.id || typeof p.id !== "string" || !p.id.trim()) {
      addNotice({
        ruleId: `schema-part-${i}-missing-id`,
        severity: "critical",
        category: "schema",
        title: "Missing Part ID",
        message: `Part at index ${i} is missing a valid string 'id'.`,
        suggestion: "Assign a unique string identifier (e.g., 'uno', 'led-1') to every part.",
        involvedPartIds: []
      });
      continue;
    }
    const normalizedPartId = p.id.trim();
    if (validPartIds.has(normalizedPartId)) {
      addNotice({
        ruleId: `schema-duplicate-part-id-${normalizedPartId}`,
        severity: "critical",
        category: "schema",
        title: "Duplicate Part ID",
        message: `Multiple components share the normalized ID '${normalizedPartId}'. Part IDs must be unique after trimming whitespace.`,
        suggestion: `Rename one of the parts with ID '${normalizedPartId}' to a distinct identifier.`,
        involvedPartIds: [normalizedPartId]
      });
      continue;
    }
    if (!p.type || typeof p.type !== "string") {
      addNotice({
        ruleId: `schema-part-${p.id}-missing-type`,
        severity: "critical",
        category: "schema",
        title: "Missing Part Type",
        message: `Component '${p.id}' does not specify a valid 'type'.`,
        suggestion: "Specify a recognized component type from the Pixiu CyberLab catalog.",
        involvedPartIds: [p.id]
      });
      continue;
    }
    const coordinateFields = [
      { field: "x", value: p.x },
      { field: "y", value: p.y },
      { field: "rotation", value: p.rotation }
    ];
    const malformedCoordinate = coordinateFields.find(
      ({ value }) => value !== void 0 && (typeof value !== "number" || !Number.isFinite(value))
    );
    const coordinateOutOfBounds = typeof p.x === "number" && Math.abs(p.x) > 1e5 || typeof p.y === "number" && Math.abs(p.y) > 1e5 || typeof p.rotation === "number" && Math.abs(p.rotation) > 3600;
    if (malformedCoordinate || coordinateOutOfBounds) {
      const field = malformedCoordinate?.field ?? "x/y/rotation";
      addNotice({
        ruleId: `schema-part-${normalizedPartId}-coordinate-invalid`,
        severity: "critical",
        category: "schema",
        title: "Invalid Component Coordinates",
        message: malformedCoordinate ? `Component '${normalizedPartId}' has a non-finite or non-numeric '${field}' value.` : `Component '${normalizedPartId}' exceeds the allowed canvas coordinate/rotation bounds.`,
        suggestion: "Use finite numeric x/y/rotation values; x/y must be within \xB1100,000 canvas units and rotation within \xB13,600 degrees.",
        involvedPartIds: [normalizedPartId]
      });
      continue;
    }
    const placed = {
      id: normalizedPartId,
      type: p.type.trim(),
      x: Number.isFinite(p.x) ? Number(p.x) : 100,
      y: Number.isFinite(p.y) ? Number(p.y) : 100,
      rotation: Number.isFinite(p.rotation) ? Number(p.rotation) : 0,
      props: p.props && typeof p.props === "object" ? { ...p.props } : {}
    };
    validPartIds.add(placed.id);
    partMap.set(placed.id, placed);
  }
  metrics.partCount = partMap.size;
  const validComponentTypes = /* @__PURE__ */ new Set([
    ...Object.keys(PIXIU_COMPONENTS_DATASET),
    ...Object.keys(CATALOG),
    "arduino-uno",
    "esp32-devkit",
    "rpi-pico",
    "microbit-v2"
  ]);
  for (const part of partMap.values()) {
    if (!validComponentTypes.has(part.type)) {
      addNotice({
        ruleId: `identity-unknown-part-type-${part.type}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Type",
        message: `Component '${part.id}' specifies unrecognized type '${part.type}'.`,
        suggestion: `Use one of the supported 32 components in Pixiu CyberLab.`,
        involvedPartIds: [part.id]
      });
    }
  }
  const normalizedWires = [];
  const wireIdSet = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawCandidate.wires.length; i++) {
    const rawWire = rawCandidate.wires[i];
    if (!rawWire || typeof rawWire !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Wire Entry",
        message: `Wire at index ${i} is not a valid object.`,
        suggestion: "Ensure each wire specifies 'from' and 'to' endpoints.",
        involvedPartIds: []
      });
      continue;
    }
    const w = rawWire;
    if (!w.from || typeof w.from !== "object" || !w.to || typeof w.to !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-missing-endpoints`,
        severity: "critical",
        category: "schema",
        title: "Incomplete Wire Endpoints",
        message: `Wire at index ${i} is missing 'from' or 'to' endpoint definitions.`,
        suggestion: "Each wire must define { from: { partId, pinId }, to: { partId, pinId } }.",
        involvedPartIds: []
      });
      continue;
    }
    const fromPartId = String(w.from.partId || "").trim();
    const fromPinRaw = String(w.from.pinId || "").trim();
    const toPartId = String(w.to.partId || "").trim();
    const toPinRaw = String(w.to.pinId || "").trim();
    if (!fromPartId || !fromPinRaw || !toPartId || !toPinRaw) {
      addNotice({
        ruleId: `schema-wire-${i}-empty-endpoint-ids`,
        severity: "critical",
        category: "schema",
        title: "Empty Wire Endpoint Identifiers",
        message: `Wire at index ${i} has empty partId or pinId fields.`,
        suggestion: "Specify non-empty partId and pinId strings for both endpoints.",
        involvedPartIds: []
      });
      continue;
    }
    const fromPart = partMap.get(fromPartId);
    const toPart = partMap.get(toPartId);
    if (!fromPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${fromPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Origin Part Not Found",
        message: `Wire starts at component '${fromPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${fromPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [fromPartId]
      });
      continue;
    }
    if (!toPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${toPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Target Part Not Found",
        message: `Wire ends at component '${toPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${toPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [toPartId]
      });
      continue;
    }
    const canonicalFromPin = resolveCanonicalPin(fromPart.type, fromPinRaw);
    const canonicalToPin = resolveCanonicalPin(toPart.type, toPinRaw);
    let invalidPinEndpoint = false;
    if (!isRegisteredPin(fromPart.type, canonicalFromPin)) {
      invalidPinEndpoint = true;
      addNotice({
        ruleId: `identity-unknown-pin-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${fromPinRaw}' resolves to '${canonicalFromPin}', which is not registered on component '${fromPartId}' (${fromPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin]
      });
    }
    if (!isRegisteredPin(toPart.type, canonicalToPin)) {
      invalidPinEndpoint = true;
      addNotice({
        ruleId: `identity-unknown-pin-${toPartId}-${canonicalToPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${toPinRaw}' resolves to '${canonicalToPin}', which is not registered on component '${toPartId}' (${toPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [toPartId],
        involvedPinIds: [canonicalToPin]
      });
    }
    if (invalidPinEndpoint) continue;
    if (fromPartId === toPartId && canonicalFromPin === canonicalToPin) {
      addNotice({
        ruleId: `safety-self-loop-wire-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "safety",
        title: "Redundant Self-Connecting Wire Loop",
        message: `Wire connects pin '${canonicalFromPin}' on '${fromPartId}' to itself.`,
        suggestion: "Remove redundant loop wire connecting the same pin to itself.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin]
      });
      continue;
    }
    const wireId = w.id && typeof w.id === "string" && !wireIdSet.has(w.id) ? w.id : `w_${fromPartId}_${canonicalFromPin}_${toPartId}_${canonicalToPin}_${i}`;
    wireIdSet.add(wireId);
    normalizedWires.push({
      id: wireId,
      from: { partId: fromPartId, pinId: canonicalFromPin },
      to: { partId: toPartId, pinId: canonicalToPin },
      color: typeof w.color === "string" && w.color ? w.color : "#38bdf8"
    });
  }
  metrics.wireCount = normalizedWires.length;
  const normalizedParts = Array.from(partMap.values());
  const normalizedCircuit = {
    parts: normalizedParts,
    wires: normalizedWires
  };
  const revHash = computeCircuitHash(
    normalizedCircuit,
    typeof rawCandidate.blocklyXml === "string" ? rawCandidate.blocklyXml : void 0
  );
  const boardParts = normalizedParts.filter((p) => isBoardPart(p.type));
  const primaryBoardPart = boardParts[0];
  const boardDef = primaryBoardPart ? getBoardForPart(primaryBoardPart) : void 0;
  if (boardParts.length > 1) {
    addNotice({
      ruleId: "budget-multiple-boards-detected",
      severity: "warning",
      category: "budget",
      title: "Multiple Microcontrollers Detected",
      message: `The canvas contains ${boardParts.length} microcontroller boards (${boardParts.map((b) => b.id).join(", ")}).`,
      suggestion: "Ensure shared common ground continuity across all microcontrollers.",
      involvedPartIds: boardParts.map((b) => b.id)
    });
  }
  const netlist = new DisjointSet();
  const pinKey = (partId, pinId) => `${partId}:${pinId}`;
  for (const w of normalizedWires) {
    netlist.union(pinKey(w.from.partId, w.from.pinId), pinKey(w.to.partId, w.to.pinId));
  }
  for (const part of normalizedParts) {
    if (part.type === "breadboard") {
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const topRow = ["a", "b", "c", "d", "e"];
        for (let r = 0; r < topRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${topRow[r]}_${c}`), pinKey(part.id, `${topRow[r + 1]}_${c}`));
        }
        const botRow = ["f", "g", "h", "i", "j"];
        for (let r = 0; r < botRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${botRow[r]}_${c}`), pinKey(part.id, `${botRow[r + 1]}_${c}`));
        }
      }
      for (let c = 1; c < BREADBOARD_COLUMNS; c++) {
        netlist.union(pinKey(part.id, `pos_t_${c}`), pinKey(part.id, `pos_t_${c + 1}`));
        netlist.union(pinKey(part.id, `neg_t_${c}`), pinKey(part.id, `neg_t_${c + 1}`));
        netlist.union(pinKey(part.id, `pos_b_${c}`), pinKey(part.id, `pos_b_${c + 1}`));
        netlist.union(pinKey(part.id, `neg_b_${c}`), pinKey(part.id, `neg_b_${c + 1}`));
      }
      for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) {
        netlist.union(pinKey(part.id, legacy), pinKey(part.id, canonical));
      }
    } else if (part.type === "pushbutton") {
      netlist.union(pinKey(part.id, "p1a"), pinKey(part.id, "p1b"));
      netlist.union(pinKey(part.id, "p2a"), pinKey(part.id, "p2b"));
    }
  }
  const v5Pins = [];
  const v33Pins = [];
  const gndPins = [];
  const batteryPosPins = [];
  const batteryNegPins = [];
  for (const bPart of boardParts) {
    const b = getBoardForPart(bPart);
    if (!b) continue;
    if (b.powerPins.v5) {
      v5Pins.push(...b.powerPins.v5.map((p) => pinKey(bPart.id, p)));
    }
    if (b.powerPins.v33) {
      v33Pins.push(...b.powerPins.v33.map((p) => pinKey(bPart.id, p)));
    }
    if (b.powerPins.vin) {
      v5Pins.push(...b.powerPins.vin.map((p) => pinKey(bPart.id, p)));
    }
    gndPins.push(...b.powerPins.gnd.map((p) => pinKey(bPart.id, p)));
  }
  for (const part of normalizedParts) {
    if (part.type === "battery") {
      batteryPosPins.push(pinKey(part.id, "pos"));
      batteryNegPins.push(pinKey(part.id, "neg"));
    }
  }
  for (const pwr of v5Pins) {
    for (const gnd of gndPins) {
      if (netlist.connected(pwr, gnd)) {
        metrics.shortCircuitsFound++;
        metrics.powerRailsOk = false;
        addNotice({
          ruleId: "safety-direct-power-short-5v",
          severity: "critical",
          category: "safety",
          title: "Direct Short Circuit Detected (5V to GND)",
          message: "The 5V power supply rail is connected directly to Ground with zero resistance. On hardware, this causes an overcurrent shutdown or burns out the onboard voltage regulator.",
          suggestion: "Remove the wire connecting 5V directly to Ground. Ensure a load or resistor separates power from ground.",
          involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
          involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]]
        });
        break;
      }
    }
    if (!metrics.powerRailsOk) break;
  }
  if (metrics.powerRailsOk) {
    for (const pwr of v33Pins) {
      for (const gnd of gndPins) {
        if (netlist.connected(pwr, gnd)) {
          metrics.shortCircuitsFound++;
          metrics.powerRailsOk = false;
          addNotice({
            ruleId: "safety-direct-power-short-3v3",
            severity: "critical",
            category: "safety",
            title: "Direct Short Circuit Detected (3.3V to GND)",
            message: "The 3.3V power supply rail is connected directly to Ground with zero resistance.",
            suggestion: "Remove the wire bridging 3.3V to Ground. Add a load or circuit component between them.",
            involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
            involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]]
          });
          break;
        }
      }
      if (!metrics.powerRailsOk) break;
    }
  }
  if (metrics.powerRailsOk) {
    for (const v5 of v5Pins) {
      for (const v33 of v33Pins) {
        if (netlist.connected(v5, v33)) {
          metrics.shortCircuitsFound++;
          metrics.powerRailsOk = false;
          addNotice({
            ruleId: "safety-rail-conflict-5v-3v3",
            severity: "critical",
            category: "safety",
            title: "Voltage Rail Conflict (5V Shorted to 3.3V)",
            message: "The 5V power rail is tied directly to the 3.3V low-dropout regulator rail without a level shifter or regulator.",
            suggestion: "Disconnect the direct link between 5V and 3.3V power buses.",
            involvedPartIds: [v5.split(":")[0], v33.split(":")[0]],
            involvedPinIds: [v5.split(":")[1], v33.split(":")[1]]
          });
          break;
        }
      }
      if (!metrics.powerRailsOk) break;
    }
  }
  for (const bPos of batteryPosPins) {
    const batPartId = bPos.split(":")[0];
    const bNeg = pinKey(batPartId, "neg");
    if (netlist.connected(bPos, bNeg)) {
      metrics.shortCircuitsFound++;
      metrics.powerRailsOk = false;
      addNotice({
        ruleId: `safety-battery-short-${batPartId}`,
        severity: "critical",
        category: "safety",
        title: "Battery Terminal Short Circuit",
        message: `9V Battery '${batPartId}' positive and negative terminals are connected together with 0\u03A9 resistance. This causes thermal runaway and battery rupture.`,
        suggestion: "Remove direct short between battery positive and negative terminals.",
        involvedPartIds: [batPartId],
        involvedPinIds: ["pos", "neg"]
      });
    }
  }
  const resistiveGraph = /* @__PURE__ */ new Map();
  const addResistiveEdge = (u, v, r) => {
    if (!resistiveGraph.has(u)) resistiveGraph.set(u, []);
    if (!resistiveGraph.has(v)) resistiveGraph.set(v, []);
    resistiveGraph.get(u).push({ to: v, resistance: r });
    resistiveGraph.get(v).push({ to: u, resistance: r });
  };
  for (const node of netlist.allNodes()) {
    const root = netlist.find(node);
    if (root !== node) {
      addResistiveEdge(node, root, 0);
    }
  }
  for (const part of normalizedParts) {
    if (part.type === "resistor") {
      const rVal = Math.max(1, Number(part.props.resistance || 220));
      addResistiveEdge(pinKey(part.id, "a"), pinKey(part.id, "b"), rVal);
    }
  }
  const findMinResistance = (startPin, targetPins) => {
    const targetSet = new Set(targetPins);
    const dist = /* @__PURE__ */ new Map();
    const queue = [{ node: startPin, d: 0 }];
    dist.set(startPin, 0);
    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const { node: cur, d } = queue.shift();
      if (targetSet.has(cur)) return d;
      const neighbors = resistiveGraph.get(cur) || [];
      for (const edge of neighbors) {
        const nextDist = d + edge.resistance;
        if (!dist.has(edge.to) || nextDist < dist.get(edge.to)) {
          dist.set(edge.to, nextDist);
          queue.push({ node: edge.to, d: nextDist });
        }
      }
    }
    return Infinity;
  };
  const allPowerPins = [...v5Pins, ...v33Pins];
  if (primaryBoardPart && boardDef) {
    for (const bp of boardDef.pins) {
      if (bp.kind === "digital") {
        allPowerPins.push(pinKey(primaryBoardPart.id, bp.id));
      }
    }
  }
  for (const part of normalizedParts) {
    if (part.type === "led") {
      const anodePin = pinKey(part.id, "anode");
      const cathodePin = pinKey(part.id, "cathode");
      const anodeConnected = resistiveGraph.has(anodePin);
      const cathodeConnected = resistiveGraph.has(cathodePin);
      if (anodeConnected && cathodeConnected) {
        const rToPower = findMinResistance(anodePin, allPowerPins);
        const rToGnd = findMinResistance(cathodePin, gndPins);
        const rRevToPower = findMinResistance(cathodePin, allPowerPins);
        const rRevToGnd = findMinResistance(anodePin, gndPins);
        const totalLoopRes = Math.min(rToPower + rToGnd, rRevToPower + rRevToGnd);
        if (Number.isFinite(totalLoopRes) && totalLoopRes < 100) {
          metrics.overcurrentRisks++;
          addNotice({
            ruleId: `safety-led-burnout-${part.id}`,
            severity: "critical",
            category: "safety",
            title: `LED Overcurrent Burnout Risk (${part.id})`,
            message: `LED '${part.id}' is wired directly across power and ground with only ${totalLoopRes.toFixed(1)}\u03A9 series resistance. Operating an LED without a 220\u03A9\u20131k\u03A9 current-limiting resistor causes thermal burnout within milliseconds!`,
            suggestion: `Insert a 220\u03A9 or 330\u03A9 resistor in series with LED '${part.id}' Anode (+) or Cathode (-).`,
            involvedPartIds: [part.id],
            involvedPinIds: ["anode", "cathode"]
          });
        }
      }
    }
  }
  if (primaryBoardPart && boardDef && boardDef.logicVoltage <= 3.3) {
    const dangerousSources = [...v5Pins, ...batteryPosPins];
    for (const pin of boardDef.pins) {
      if (pin.kind === "digital" || pin.kind === "analog") {
        const boardPinKey = pinKey(primaryBoardPart.id, pin.id);
        if (resistiveGraph.has(boardPinKey)) {
          const minResToOvervoltage = findMinResistance(boardPinKey, dangerousSources);
          if (Number.isFinite(minResToOvervoltage)) {
            const referencePathResistance = findMinResistance(boardPinKey, [...gndPins, ...v33Pins]);
            const seriesOnlyOrLowResistance = minResToOvervoltage < 500 || !Number.isFinite(referencePathResistance);
            metrics.overvoltageRisks++;
            addNotice({
              ruleId: `safety-overvoltage-gpio-${primaryBoardPart.id}-${pin.id}`,
              severity: seriesOnlyOrLowResistance ? "critical" : "warning",
              category: "safety",
              title: `5V Overvoltage on 3.3V MCU Pin (${pin.label})`,
              message: seriesOnlyOrLowResistance ? `A ${minResToOvervoltage.toFixed(0)}\u03A9 path connects a 5V/9V source to ${pin.label} on ${boardDef.name} without a modeled safe divider/reference return. A series resistor alone does not prove 3.3V-safe logic.` : `A ${minResToOvervoltage.toFixed(0)}\u03A9 path connects a 5V/9V source to ${pin.label} on ${boardDef.name}. A return/reference path exists, but this static validator cannot prove the resulting node voltage or divider ratio.`,
              suggestion: "Use a verified resistor-divider topology or a suitable logic-level shifter; do not rely on a series resistor alone.",
              involvedPartIds: [primaryBoardPart.id],
              involvedPinIds: [pin.id]
            });
          }
        }
      }
    }
  }
  if (primaryBoardPart && boardDef) {
    const boardGpioPins = boardDef.pins.filter((p) => p.kind === "digital").map((p) => pinKey(primaryBoardPart.id, p.id));
    for (const part of normalizedParts) {
      if (part.type === "dc-motor") {
        const mPos = pinKey(part.id, "pos");
        const mNeg = pinKey(part.id, "neg");
        const posConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mPos, bp));
        const negConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mNeg, bp));
        if (posConnectedToGpio || negConnectedToGpio) {
          addNotice({
            ruleId: `safety-motor-direct-gpio-${part.id}`,
            severity: "warning",
            category: "safety",
            title: `Inductive Overload Risk (DC Motor ${part.id})`,
            message: `DC Motor '${part.id}' is wired directly to microcontroller GPIO pins. Real physical motors require 200mA\u20131000mA (MCU pins can only supply 20mA\u201340mA) and generate inductive back-EMF spikes that damage pins. In physical assembly, use an L298N driver or relay.`,
            suggestion: "In physical breadboard assembly, use an L298N motor driver or relay module with external battery power to control the motor.",
            involvedPartIds: [part.id, primaryBoardPart.id],
            involvedPinIds: ["pos", "neg"]
          });
        }
      }
    }
  }
  const activeModuleTypes = [
    "ultrasonic",
    "dht11",
    "mq2-gas",
    "neopixel-ring",
    "oled-i2c",
    "lcd-i2c",
    "servo",
    "l298n",
    "pir-sensor",
    "ir-sensor"
  ];
  for (const part of normalizedParts) {
    if (activeModuleTypes.includes(part.type) && primaryBoardPart) {
      const moduleGnd = pinKey(part.id, "gnd");
      const hasWires = normalizedWires.some(
        (w) => w.from.partId === part.id || w.to.partId === part.id
      );
      if (hasWires) {
        const hasGndContinuity = gndPins.some((gnd) => netlist.connected(moduleGnd, gnd));
        if (!hasGndContinuity) {
          metrics.missingReturnPaths++;
          addNotice({
            ruleId: `wiring-missing-ground-return-${part.id}`,
            severity: "warning",
            category: "wiring",
            title: `Missing Ground Return Path (${part.id})`,
            message: `Active component '${part.id}' (${part.type}) is connected to the microcontroller but its Ground (GND) pin is not connected to common circuit GND. Without a closed return path, signals cannot flow.`,
            suggestion: `Connect '${part.id}' pin 'gnd' to microcontroller GND rail.`,
            involvedPartIds: [part.id],
            involvedPinIds: ["gnd"]
          });
        }
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawCandidate, "blocklyXml") && rawCandidate.blocklyXml !== void 0) {
    if (typeof rawCandidate.blocklyXml !== "string") {
      addNotice({
        ruleId: "syntax-blockly-xml-type-invalid",
        severity: "critical",
        category: "syntax",
        title: "Invalid Blockly XML Payload",
        message: "Blockly XML must be a string when supplied.",
        suggestion: "Send a serialized Blockly workspace XML string or omit blocklyXml.",
        involvedPartIds: []
      });
    } else {
      const xml = rawCandidate.blocklyXml.trim();
      const hasXmlRoot = /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?>[\s\S]*<\/xml>\s*$/i.test(xml) || /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?\/>\s*$/i.test(xml);
      const unsafeXmlPattern = /<!DOCTYPE|<!ENTITY|<\s*script\b|<\s*(?:iframe|object|embed|foreignObject|html|body)\b|javascript\s*:|\bon[a-z]+\s*=/i;
      if (xml.length > 2e5) {
        addNotice({
          ruleId: "syntax-blockly-xml-size-limit",
          severity: "critical",
          category: "syntax",
          title: "Blockly XML Payload Too Large",
          message: "Blockly XML exceeds the 200,000-character safety limit.",
          suggestion: "Reduce the workspace payload and submit a smaller Blockly program.",
          involvedPartIds: []
        });
      } else if (xml && !hasXmlRoot) {
        addNotice({
          ruleId: "syntax-blockly-xml-root-invalid",
          severity: "critical",
          category: "syntax",
          title: "Malformed Blockly XML",
          message: "Blockly workspace payload must have a single <xml> root element.",
          suggestion: "Send XML exported from the Blockly workspace serializer.",
          involvedPartIds: []
        });
      } else if (unsafeXmlPattern.test(xml)) {
        addNotice({
          ruleId: "syntax-script-injection-blocked",
          severity: "critical",
          category: "syntax",
          title: "Unsafe Blockly XML Blocked",
          message: "Blockly XML contains a forbidden active-content, script, or event-handler pattern.",
          suggestion: "Remove script/active-content markup and regenerate the workspace XML.",
          involvedPartIds: []
        });
      }
    }
  }
  const criticalCount = notices.filter((n) => n.severity === "critical").length;
  const warningCount = notices.filter((n) => n.severity === "warning").length;
  const valid = criticalCount === 0 && (allowWarnings || warningCount === 0);
  return {
    valid,
    errors,
    warnings,
    notices,
    normalizedCircuit: valid ? normalizedCircuit : void 0,
    metrics,
    revHash
  };
}

// src/lib/ai/copilot/proposal-gate.ts
var POWER_PINS = /* @__PURE__ */ new Set(["5v", "3v3", "3v", "vin", "vsys", "vbus", "3v3_en"]);
var GND_PINS = /* @__PURE__ */ new Set(["gnd", "gnd_pwr", "gnd_l", "gnd_r", "gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"]);
var ANALOG_PINS = /* @__PURE__ */ new Set([
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "d34",
  "d35",
  "d32",
  "d33",
  "vp",
  "vn",
  "gp26",
  "gp27",
  "gp28",
  "p0",
  "p1",
  "p2"
]);
function evaluateProposalGate(proposal, options = {}) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const errors = [];
  const warnings = [];
  const diagnosticCodes = [];
  if (!proposal) {
    return {
      passed: false,
      canPreview: false,
      canApply: false,
      proposal: null,
      circuitValidation: null,
      errors: ["No proposal object provided to validation gate."],
      warnings: [],
      diagnosticCodes: ["ERR_NULL_PROPOSAL"],
      validatedAt: timestamp
    };
  }
  const candidateCircuit = proposal.proposal?.circuit;
  if (!candidateCircuit || !Array.isArray(candidateCircuit.parts) || !Array.isArray(candidateCircuit.wires)) {
    return {
      passed: false,
      canPreview: false,
      canApply: false,
      proposal,
      circuitValidation: null,
      errors: ["Proposal does not contain a valid circuit payload with parts and wires."],
      warnings: [],
      diagnosticCodes: ["ERR_MISSING_CIRCUIT_STRUCTURE"],
      validatedAt: timestamp
    };
  }
  const targetBoard = (options.currentBoard || "arduino-uno").toLowerCase();
  const boardPart = candidateCircuit.parts.find((p) => p.type === targetBoard);
  if (!boardPart) {
    errors.push(`Circuit must contain the target microcontroller board: '${targetBoard}'.`);
    diagnosticCodes.push("ERR_BOARD_MISMATCH");
  }
  const validatorResult = validateProposedCircuit(candidateCircuit, {
    targetBoard,
    allowWarnings: true
  });
  if (!validatorResult.valid) {
    for (const err of validatorResult.errors) {
      errors.push(err);
      if (/short\s*circuit/i.test(err)) {
        diagnosticCodes.push("ELECTRICAL_SHORT_CIRCUIT");
      }
    }
  }
  for (const warn of validatorResult.warnings) {
    warnings.push(warn);
  }
  for (const notice of validatorResult.notices || []) {
    if (notice.ruleId && !diagnosticCodes.includes(notice.ruleId)) {
      diagnosticCodes.push(notice.ruleId);
    }
  }
  if (boardPart) {
    const boardDef = getBoardDefinition(boardPart.type) || getBoardDefinition(targetBoard);
    runTaskWiringPolicyChecks(
      proposal.task_type,
      candidateCircuit,
      boardPart.id,
      boardDef,
      errors,
      warnings,
      diagnosticCodes
    );
  }
  const passed = errors.length === 0;
  return {
    passed,
    canPreview: passed,
    canApply: passed,
    proposal,
    circuitValidation: validatorResult,
    errors,
    warnings,
    diagnosticCodes,
    validatedAt: timestamp
  };
}
function isPinConnected(partId, pinId, wires) {
  return wires.some(
    (w) => w.from.partId === partId && w.from.pinId.toLowerCase() === pinId.toLowerCase() || w.to.partId === partId && w.to.pinId.toLowerCase() === pinId.toLowerCase()
  );
}
function getConnectedPins(partId, pinId, wires) {
  const result = [];
  for (const w of wires) {
    if (w.from.partId === partId && w.from.pinId.toLowerCase() === pinId.toLowerCase()) {
      result.push({ partId: w.to.partId, pinId: w.to.pinId });
    } else if (w.to.partId === partId && w.to.pinId.toLowerCase() === pinId.toLowerCase()) {
      result.push({ partId: w.from.partId, pinId: w.from.pinId });
    }
  }
  return result;
}
function getBoardPinsFor(partId, pinId, boardId, wires) {
  return getConnectedPins(partId, pinId, wires).filter((n) => n.partId === boardId).map((n) => n.pinId.toLowerCase());
}
function resolveBoardPinDef(boardDef, pinId) {
  if (!boardDef) return void 0;
  const lower = pinId.toLowerCase();
  return boardDef.pins.find(
    (p) => p.id.toLowerCase() === lower || p.label.toLowerCase() === lower || p.alternateNames?.some((alt) => alt.toLowerCase() === lower)
  );
}
function isOutputCapableGpio(boardDef, pinId) {
  const lower = pinId.toLowerCase();
  if (POWER_PINS.has(lower)) {
    return { valid: false, reason: "Pin is a power rail and cannot drive output" };
  }
  if (GND_PINS.has(lower)) {
    return { valid: false, reason: "Pin is a ground rail and cannot drive output" };
  }
  if (boardDef) {
    const pinDef = resolveBoardPinDef(boardDef, pinId);
    if (!pinDef) {
      return { valid: false, reason: `Pin '${pinId}' does not exist on board '${boardDef.name}'` };
    }
    if (pinDef.kind === "power" || pinDef.kind === "ground") {
      return { valid: false, reason: `Pin '${pinId}' is a ${pinDef.kind} rail` };
    }
    if (pinDef.capabilities?.inputOnly) {
      return { valid: false, reason: `Pin '${pinId}' is an input-only pin on ${boardDef.name}` };
    }
    if (["en", "run", "rst", "reset", "3v3_en", "adc_vref"].includes(pinDef.id.toLowerCase())) {
      return { valid: false, reason: `Pin '${pinId}' is a dedicated system control pin` };
    }
  }
  return { valid: true };
}
function isInputCapableGpio(boardDef, pinId) {
  const lower = pinId.toLowerCase();
  if (POWER_PINS.has(lower)) {
    return { valid: false, reason: "Pin is a power rail and cannot receive GPIO input" };
  }
  if (GND_PINS.has(lower)) {
    return { valid: false, reason: "Pin is a ground rail and cannot receive GPIO input" };
  }
  if (boardDef) {
    const pinDef = resolveBoardPinDef(boardDef, pinId);
    if (!pinDef) {
      return { valid: false, reason: `Pin '${pinId}' does not exist on board '${boardDef.name}'` };
    }
    if (pinDef.kind === "power" || pinDef.kind === "ground") {
      return { valid: false, reason: `Pin '${pinId}' is a ${pinDef.kind} rail` };
    }
    if (["en", "run", "rst", "reset", "3v3_en", "adc_vref"].includes(pinDef.id.toLowerCase())) {
      return { valid: false, reason: `Pin '${pinId}' is a dedicated system control pin` };
    }
  }
  return { valid: true };
}
function runTaskWiringPolicyChecks(taskType, circuit, boardId, boardDef, errors, warnings, diagnosticCodes) {
  const parts = circuit.parts;
  const wires = circuit.wires;
  if (taskType === "led_control") {
    const leds = parts.filter((p) => p.type === "led");
    const resistors = parts.filter((p) => p.type === "resistor");
    if (leds.length === 0) {
      errors.push("LED control task requires at least one LED component.");
      diagnosticCodes.push("POLICY_MISSING_LED");
      return;
    }
    if (resistors.length === 0) {
      errors.push("LED control task requires a current-limiting resistor to protect the circuit.");
      diagnosticCodes.push("POLICY_MISSING_LED_RESISTOR");
      return;
    }
    for (const led of leds) {
      const anodeConnected = isPinConnected(led.id, "anode", wires);
      const cathodeConnected = isPinConnected(led.id, "cathode", wires);
      if (!anodeConnected || !cathodeConnected) {
        errors.push(`LED '${led.id}' is disconnected or missing complete loop connection.`);
        diagnosticCodes.push("POLICY_INCOMPLETE_LED_LOOP");
        continue;
      }
      const anodeNeighbors = getConnectedPins(led.id, "anode", wires);
      const cathodeNeighbors = getConnectedPins(led.id, "cathode", wires);
      const seriesResistor = resistors.find(
        (r) => [...anodeNeighbors, ...cathodeNeighbors].some((n) => n.partId === r.id)
      );
      if (!seriesResistor) {
        errors.push(`Resistor is not connected in series with LED '${led.id}' (floating or bypassed).`);
        diagnosticCodes.push("POLICY_DISCONNECTED_LED_RESISTOR");
        continue;
      }
      const anodePins = getBoardPinsFor(led.id, "anode", boardId, wires);
      const cathodePins = getBoardPinsFor(led.id, "cathode", boardId, wires);
      const resAPins = getBoardPinsFor(seriesResistor.id, "a", boardId, wires);
      const resBPins = getBoardPinsFor(seriesResistor.id, "b", boardId, wires);
      for (const [termName, pins] of [
        ["LED anode", anodePins],
        ["LED cathode", cathodePins],
        ["Resistor pin A", resAPins],
        ["Resistor pin B", resBPins]
      ]) {
        const unique = [...new Set(pins)];
        if (unique.length > 1) {
          errors.push(`${termName} has multiple conflicting board pin connections: '${unique.join(", ")}'.`);
          diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
        }
      }
      const allBranchPins = [
        ...anodePins,
        ...cathodePins,
        ...resAPins,
        ...resBPins
      ];
      if (allBranchPins.some((p) => POWER_PINS.has(p))) {
        errors.push("LED control task requires microcontroller GPIO control, but is wired directly to a power rail.");
        diagnosticCodes.push("POLICY_LED_INVALID_POWER_DESTINATION");
      }
      const hasGnd = allBranchPins.some((p) => GND_PINS.has(p));
      const hasGpio = allBranchPins.some((p) => !GND_PINS.has(p) && !POWER_PINS.has(p));
      if (!hasGnd || !hasGpio) {
        errors.push(`LED circuit loop must connect to a digital control pin on one end and GND on the other end.`);
        diagnosticCodes.push("POLICY_LED_INVALID_LOOP_DESTINATION");
      }
      const gpioPins = allBranchPins.filter((p) => !GND_PINS.has(p) && !POWER_PINS.has(p));
      for (const p of gpioPins) {
        const outCheck = isOutputCapableGpio(boardDef, p);
        if (!outCheck.valid) {
          errors.push(`LED control pin '${p}' cannot drive output: ${outCheck.reason}.`);
          diagnosticCodes.push("POLICY_LED_INVALID_LOOP_DESTINATION");
          diagnosticCodes.push("POLICY_GPIO_CAPABILITY_MISMATCH");
        }
      }
    }
  }
  if (taskType === "ldr_lighting") {
    const ldrs = parts.filter((p) => p.type === "ldr");
    const resistors = parts.filter((p) => p.type === "resistor");
    if (ldrs.length === 0) {
      errors.push("LDR lighting task requires at least one LDR photoresistor.");
      diagnosticCodes.push("POLICY_MISSING_LDR");
      return;
    }
    if (resistors.length === 0) {
      errors.push("LDR lighting circuit requires a fixed resistor to form a voltage divider.");
      diagnosticCodes.push("POLICY_MISSING_DIVIDER_RESISTOR");
      return;
    }
    for (const ldr of ldrs) {
      const pinAConnected = isPinConnected(ldr.id, "a", wires);
      const pinBConnected = isPinConnected(ldr.id, "b", wires);
      if (!pinAConnected || !pinBConnected) {
        errors.push(`LDR '${ldr.id}' has disconnected terminals.`);
        diagnosticCodes.push("POLICY_INCOMPLETE_LDR_DIVIDER");
        continue;
      }
      const aNeighbors = getConnectedPins(ldr.id, "a", wires);
      const bNeighbors = getConnectedPins(ldr.id, "b", wires);
      let midpointFound = false;
      let dividerResistorId = "";
      for (const { neighbors } of [{ neighbors: aNeighbors }, { neighbors: bNeighbors }]) {
        const resistorNeighbor = neighbors.find((n) => resistors.some((r) => r.id === n.partId));
        const analogNeighbor = neighbors.find((n) => n.partId === boardId && ANALOG_PINS.has(n.pinId.toLowerCase()));
        if (resistorNeighbor && analogNeighbor) {
          midpointFound = true;
          dividerResistorId = resistorNeighbor.partId;
          break;
        }
      }
      if (!midpointFound) {
        errors.push("LDR and resistor do not form a valid voltage divider tapped into an analog/ADC pin.");
        diagnosticCodes.push("POLICY_DISCONNECTED_DIVIDER");
        continue;
      }
      const ldrAPins = getBoardPinsFor(ldr.id, "a", boardId, wires);
      const ldrBPins = getBoardPinsFor(ldr.id, "b", boardId, wires);
      const divResAPins = getBoardPinsFor(dividerResistorId, "a", boardId, wires);
      const divResBPins = getBoardPinsFor(dividerResistorId, "b", boardId, wires);
      for (const [termName, pins] of [
        ["LDR terminal A", ldrAPins],
        ["LDR terminal B", ldrBPins],
        ["Divider resistor terminal A", divResAPins],
        ["Divider resistor terminal B", divResBPins]
      ]) {
        const unique = [...new Set(pins)];
        if (unique.length > 1) {
          errors.push(`${termName} has multiple conflicting board pin connections: '${unique.join(", ")}'.`);
          diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
        }
      }
      const allDividerBoardPins = [
        ...ldrAPins,
        ...ldrBPins,
        ...divResAPins,
        ...divResBPins
      ];
      const hasPower = allDividerBoardPins.some((p) => POWER_PINS.has(p));
      const hasGnd = allDividerBoardPins.some((p) => GND_PINS.has(p));
      if (!hasPower || !hasGnd) {
        errors.push("LDR voltage divider must be powered across a board power rail and ground.");
        diagnosticCodes.push("POLICY_LDR_INVALID_DIVIDER_DESTINATION");
      }
    }
  }
  if (taskType === "ultrasonic_alert") {
    const sonars = parts.filter((p) => p.type === "ultrasonic");
    if (sonars.length === 0) {
      errors.push("Ultrasonic alert task requires an HC-SR04 ultrasonic sensor.");
      diagnosticCodes.push("POLICY_MISSING_ULTRASONIC");
      return;
    }
    for (const sonar of sonars) {
      const vccBoardPins = getBoardPinsFor(sonar.id, "vcc", boardId, wires);
      const gndBoardPins = getBoardPinsFor(sonar.id, "gnd", boardId, wires);
      const trigBoardPins = getBoardPinsFor(sonar.id, "trig", boardId, wires);
      const echoBoardPins = getBoardPinsFor(sonar.id, "echo", boardId, wires);
      if (vccBoardPins.length === 0 || gndBoardPins.length === 0 || trigBoardPins.length === 0 || echoBoardPins.length === 0) {
        errors.push(`Ultrasonic sensor '${sonar.id}' has unconnected pins (all 4 pins VCC, GND, Trig, Echo must be wired to board).`);
        diagnosticCodes.push("POLICY_UNCONNECTED_ULTRASONIC_PIN");
        continue;
      }
      const vccAllPower = vccBoardPins.every((p) => POWER_PINS.has(p));
      if (!vccAllPower) {
        errors.push(`Ultrasonic VCC must connect to a board power rail, got: '${vccBoardPins.join(", ")}'.`);
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_POWER_DESTINATION");
      }
      const uniqueVcc = [...new Set(vccBoardPins)];
      if (uniqueVcc.length > 1) {
        errors.push(`Ultrasonic VCC has multiple conflicting board pin connections: '${uniqueVcc.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const gndAllGnd = gndBoardPins.every((p) => GND_PINS.has(p));
      if (!gndAllGnd) {
        errors.push(`Ultrasonic GND must connect to a board ground pin, got: '${gndBoardPins.join(", ")}'.`);
        diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_GROUND_DESTINATION");
      }
      const uniqueGnd = [...new Set(gndBoardPins)];
      if (uniqueGnd.length > 1) {
        errors.push(`Ultrasonic GND has multiple conflicting board pin connections: '${uniqueGnd.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const uniqueTrig = [...new Set(trigBoardPins)];
      for (const p of uniqueTrig) {
        const outCheck = isOutputCapableGpio(boardDef, p);
        if (!outCheck.valid) {
          errors.push(`Ultrasonic Trig must connect to an output-capable digital GPIO pin, got: '${p}': ${outCheck.reason}.`);
          diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_TRIG_DESTINATION");
          diagnosticCodes.push("POLICY_GPIO_CAPABILITY_MISMATCH");
        }
      }
      if (uniqueTrig.length > 1) {
        errors.push(`Ultrasonic Trig has multiple conflicting board pin connections: '${uniqueTrig.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const uniqueEcho = [...new Set(echoBoardPins)];
      for (const p of uniqueEcho) {
        const inCheck = isInputCapableGpio(boardDef, p);
        if (!inCheck.valid) {
          errors.push(`Ultrasonic Echo must connect to an input-capable digital GPIO pin, got: '${p}': ${inCheck.reason}.`);
          diagnosticCodes.push("POLICY_ULTRASONIC_INVALID_ECHO_DESTINATION");
          diagnosticCodes.push("POLICY_GPIO_CAPABILITY_MISMATCH");
        }
      }
      if (uniqueEcho.length > 1) {
        errors.push(`Ultrasonic Echo has multiple conflicting board pin connections: '${uniqueEcho.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const sharedTrigEcho = uniqueTrig.filter((p) => uniqueEcho.includes(p));
      if (sharedTrigEcho.length > 0) {
        errors.push(`Ultrasonic trigger and echo cannot share the same pin ('${sharedTrigEcho.join(", ")}').`);
        diagnosticCodes.push("POLICY_ULTRASONIC_PIN_CONFLICT");
      }
      const allSonarPins = [
        ...uniqueVcc.map((p) => ({ pin: p, role: "VCC" })),
        ...uniqueGnd.map((p) => ({ pin: p, role: "GND" })),
        ...uniqueTrig.map((p) => ({ pin: p, role: "Trig" })),
        ...uniqueEcho.map((p) => ({ pin: p, role: "Echo" }))
      ];
      const seenSonarPins = /* @__PURE__ */ new Map();
      for (const entry of allSonarPins) {
        if (seenSonarPins.has(entry.pin)) {
          const prevRole = seenSonarPins.get(entry.pin);
          if (prevRole !== entry.role) {
            errors.push(`Ultrasonic ${prevRole} and ${entry.role} shorted to the same board pin ('${entry.pin}').`);
            diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
          }
        } else {
          seenSonarPins.set(entry.pin, entry.role);
        }
      }
    }
  }
  if (taskType === "servo_control") {
    const servos = parts.filter((p) => p.type === "servo");
    if (servos.length === 0) {
      errors.push("Servo control task requires a servo motor component.");
      diagnosticCodes.push("POLICY_MISSING_SERVO");
      return;
    }
    for (const servo of servos) {
      const vccBoardPins = getBoardPinsFor(servo.id, "vcc", boardId, wires);
      const gndBoardPins = getBoardPinsFor(servo.id, "gnd", boardId, wires);
      const sigBoardPins = getBoardPinsFor(servo.id, "sig", boardId, wires);
      if (vccBoardPins.length === 0 || gndBoardPins.length === 0 || sigBoardPins.length === 0) {
        errors.push(`Servo motor '${servo.id}' has unconnected terminals (VCC, GND, and Sig must all be wired to board).`);
        diagnosticCodes.push("POLICY_UNCONNECTED_SERVO_PIN");
        continue;
      }
      const vccAllPower = vccBoardPins.every((p) => POWER_PINS.has(p));
      if (!vccAllPower) {
        errors.push(`Servo VCC must connect to a board power rail, got: '${vccBoardPins.join(", ")}'.`);
        diagnosticCodes.push("POLICY_SERVO_INVALID_POWER_DESTINATION");
      }
      const uniqueVcc = [...new Set(vccBoardPins)];
      if (uniqueVcc.length > 1) {
        errors.push(`Servo VCC has multiple conflicting board pin connections: '${uniqueVcc.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const gndAllGnd = gndBoardPins.every((p) => GND_PINS.has(p));
      if (!gndAllGnd) {
        errors.push(`Servo GND must connect to a board ground pin, got: '${gndBoardPins.join(", ")}'.`);
        diagnosticCodes.push("POLICY_SERVO_INVALID_GROUND_DESTINATION");
      }
      const uniqueGnd = [...new Set(gndBoardPins)];
      if (uniqueGnd.length > 1) {
        errors.push(`Servo GND has multiple conflicting board pin connections: '${uniqueGnd.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const uniqueSig = [...new Set(sigBoardPins)];
      for (const p of uniqueSig) {
        const outCheck = isOutputCapableGpio(boardDef, p);
        if (!outCheck.valid) {
          errors.push(`Servo signal must connect to an output-capable digital/PWM pin, got '${p}': ${outCheck.reason}.`);
          diagnosticCodes.push("POLICY_SERVO_INVALID_SIGNAL_DESTINATION");
          diagnosticCodes.push("POLICY_GPIO_CAPABILITY_MISMATCH");
        }
      }
      if (uniqueSig.length > 1) {
        errors.push(`Servo signal has multiple conflicting board pin connections: '${uniqueSig.join(", ")}'.`);
        diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
      }
      const allServoPins = [
        ...uniqueVcc.map((p) => ({ pin: p, role: "VCC" })),
        ...uniqueGnd.map((p) => ({ pin: p, role: "GND" })),
        ...uniqueSig.map((p) => ({ pin: p, role: "Signal" }))
      ];
      const seenServoPins = /* @__PURE__ */ new Map();
      for (const entry of allServoPins) {
        if (seenServoPins.has(entry.pin)) {
          const prevRole = seenServoPins.get(entry.pin);
          if (prevRole !== entry.role) {
            errors.push(`Servo ${prevRole} and ${entry.role} shorted to the same board pin ('${entry.pin}').`);
            diagnosticCodes.push("POLICY_CONFLICTING_PIN_CONNECTIONS");
          }
        } else {
          seenServoPins.set(entry.pin, entry.role);
        }
      }
    }
  }
}

// src/lib/ai/copilot/request-handler.ts
async function handleCopilotRequest(input) {
  const targetBoard = input.targetBoard || "arduino-uno";
  const revHash = input.currentRevisionHash || "0000000000000000";
  const route = routeUserRequest(input.prompt, { targetBoard });
  if (route.route === "unsupported" || route.route === "needs_clarification") {
    return {
      requestId: input.requestId,
      success: false,
      route,
      modelResponse: {
        rawOutput: "",
        success: false,
        metadata: {
          provider: "task-router",
          model: "router-v1",
          version: "1.0.0",
          requestId: input.requestId,
          durationMs: 0
        }
      },
      parseResult: { valid: false, payload: null, errors: [route.normalizedGoal], rawTrimmed: "" },
      repairResult: null,
      gateResult: null,
      proposal: null,
      replyText: route.clarificationPrompt || "Your request is outside the supported circuit tasks.",
      error: route.riskFlags.join(", ") || "ROUTING_REJECTED"
    };
  }
  const domain = route.route === "math_teaching" ? "math" : "circuit";
  const hasInductiveLoad = domain === "circuit" && /\b(motor|fan|relay|pump|solenoid|coil)\b/i.test(input.prompt);
  const wrappedPrompt = wrapCopilotPrompt(input.prompt, {
    domain,
    hasInductiveLoad
  });
  const adapter = input.modelAdapter || createBaselineModelAdapter();
  const modelReq = {
    requestId: input.requestId,
    prompt: wrappedPrompt,
    context: {
      targetBoard,
      canvasRevisionHash: revHash
    }
  };
  const modelRes = await adapter.generateProposal(modelReq, {
    timeoutMs: input.timeoutMs || 1e4
  });
  if (!modelRes.success) {
    return {
      requestId: input.requestId,
      success: false,
      route,
      modelResponse: modelRes,
      parseResult: { valid: false, payload: null, errors: [modelRes.error?.message || "Inference error"], rawTrimmed: "" },
      repairResult: null,
      gateResult: null,
      proposal: null,
      replyText: `Inference endpoint error (${adapter.constructor.name}): ${modelRes.error?.message || "Unknown error"}`,
      error: modelRes.error?.code || "INFERENCE_FAILED"
    };
  }
  if (route.route === "math_teaching") {
    return {
      requestId: input.requestId,
      success: true,
      route,
      modelResponse: modelRes,
      parseResult: { valid: true, payload: null, errors: [], rawTrimmed: modelRes.rawOutput.slice(0, 200) },
      repairResult: null,
      gateResult: null,
      proposal: null,
      replyText: modelRes.rawOutput
    };
  }
  const parsed = parseProposalPayload(modelRes.rawOutput);
  if (!parsed.valid || !parsed.payload) {
    return {
      requestId: input.requestId,
      success: false,
      route,
      modelResponse: modelRes,
      parseResult: parsed,
      repairResult: null,
      gateResult: null,
      proposal: null,
      replyText: `Model generated invalid JSON payload: ${parsed.errors.join("; ")}`,
      error: "SCHEMA_PARSING_FAILED"
    };
  }
  let repair = null;
  let effectiveXml = void 0;
  if (parsed.payload.proposal.code && typeof parsed.payload.proposal.code === "string") {
    repair = repairBlocklyXml(parsed.payload.proposal.code);
    if (!repair.success) {
      return {
        requestId: input.requestId,
        success: false,
        route,
        modelResponse: modelRes,
        parseResult: parsed,
        repairResult: repair,
        gateResult: null,
        proposal: null,
        replyText: `\u26A0\uFE0F **Unsupported Hardware Detected**
${repair.error}
Please use standard supported components from the CyberLab toolbox.`,
        error: "UNSUPPORTED_HARDWARE_REJECTED"
      };
    }
    effectiveXml = repair.repairedXml || parsed.payload.proposal.code;
  }
  const gateOpts = {
    currentBoard: targetBoard,
    currentRevisionHash: revHash,
    expectedRevisionHash: revHash
  };
  const gateResult = evaluateProposalGate(parsed.payload, gateOpts);
  if (!gateResult.passed || !gateResult.canApply) {
    return {
      requestId: input.requestId,
      success: false,
      route,
      modelResponse: modelRes,
      parseResult: parsed,
      repairResult: repair,
      gateResult,
      proposal: null,
      replyText: `Safety validation rejected proposal:
${gateResult.errors.join("\n")}`,
      error: "POLICY_GATE_REJECTED"
    };
  }
  const circuitPayload = parsed.payload.proposal.circuit || { parts: [], wires: [] };
  const finalProposal = {
    id: `prop-${input.requestId}`,
    title: parsed.payload.summary || "AI Circuit Recommendation",
    rationale: parsed.payload.proposal.explanation || parsed.payload.summary,
    baseRevisionHash: revHash,
    circuit: circuitPayload,
    blocklyXml: effectiveXml,
    codeLanguage: "blockly"
  };
  return {
    requestId: input.requestId,
    success: true,
    route,
    modelResponse: modelRes,
    parseResult: parsed,
    repairResult: repair,
    gateResult,
    proposal: finalProposal,
    replyText: `\u{1F4A1} **AI Proposal Created: ${finalProposal.title}**
${finalProposal.rationale}`
  };
}

// src/lib/ai/copilot/tutor-response-contract.ts
var ALLOWED_TUTOR_INTENTS = [
  "build_circuit",
  "modify_circuit",
  "diagnose",
  "explain_circuit",
  "science_question",
  "code_help",
  "clarify"
];
var ALLOWED_TUTOR_LANGUAGES = [
  "english",
  "hinglish"
];
var ALLOWED_EXPLANATION_DEPTHS = [
  "quick",
  "student",
  "deep_dive"
];
var ALLOWED_GRADE_BANDS = [
  "elementary",
  "middle_school",
  "high_school",
  "college",
  "general"
];
var ALLOWED_EVIDENCE_LABELS = [
  "verified_by_validator",
  "simulated",
  "compiled",
  "static-rule-inference",
  "static_rule_inference",
  "retrieved_source",
  "inferred",
  "not_tested",
  "unknown"
];
var HINGLISH_INDICATORS = /* @__PURE__ */ new Set([
  "kya",
  "kyu",
  "kyun",
  "kaise",
  "kisko",
  "kis",
  "kaha",
  "kahan",
  "batao",
  "samjhao",
  "bataiye",
  "sikhao",
  "dekho",
  "dekhiye",
  "hai",
  "hain",
  "tha",
  "the",
  "hoga",
  "hogi",
  "honge",
  "karna",
  "karu",
  "karun",
  "karein",
  "lagana",
  "lagaye",
  "lagayein",
  "jodna",
  "jodein",
  "jodo",
  "nikalo",
  "hatao",
  "badlo",
  "pehle",
  "baad",
  "wala",
  "wali",
  "wale",
  "chahiye",
  "hota",
  "hoti",
  "nahi",
  "mat",
  "jalega",
  "chalega",
  "kharaab",
  "galti",
  "sahi",
  "roshni",
  "doori",
  "ghumaao",
  "awaz",
  "taar",
  "jhatka"
]);
function detectPromptLanguage(prompt, override) {
  if (override && (override === "english" || override === "hinglish")) {
    return { language: override, isOverride: true };
  }
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return { language: "english", isOverride: false };
  }
  const normalized = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  let hindiKeywordCount = 0;
  for (const word of words) {
    if (HINGLISH_INDICATORS.has(word)) {
      hindiKeywordCount++;
    }
  }
  const isHinglish = hindiKeywordCount >= 2 || words.length > 0 && hindiKeywordCount / words.length >= 0.2;
  return {
    language: isHinglish ? "hinglish" : "english",
    isOverride: false
  };
}
function resolveExplanationDepth(depth) {
  if (depth === "quick" || depth === "student" || depth === "deep_dive") {
    return depth;
  }
  return "student";
}
function containsRoboticOpeningClich\u00E9(text) {
  if (typeof text !== "string") return false;
  const t = text.trim();
  return /^certainly[!,.]/i.test(t) || /^absolutely[!,.]/i.test(t) || /^great question[!,.]/i.test(t) || /^sure thing[!,.]/i.test(t) || /^of course[!,.]/i.test(t) || /^as an ai[!,.]/i.test(t);
}
var ALLOWED_ROOT_KEYS2 = /* @__PURE__ */ new Set([
  "schema_version",
  "intent",
  "language",
  "language_detected",
  "language_override_applied",
  "depth",
  "grade_band",
  "direct_answer",
  "circuit_proposal",
  "component_roles",
  "operating_sequence",
  "code_logic_walkthrough",
  "science_concept",
  "evidence_status",
  "assumptions_and_limitations",
  "safety_notes",
  "next_question_or_action"
]);
function validateTutorResponse(raw, options) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ["Response must be a non-null JSON object"],
      response: null
    };
  }
  const payload = raw;
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_ROOT_KEYS2.has(key)) {
      errors.push(`Unexpected root field in tutor response: "${key}"`);
    }
  }
  if (payload.schema_version !== "pixiu-tutor-response-v1") {
    errors.push(`Invalid schema_version: expected "pixiu-tutor-response-v1", got "${payload.schema_version}"`);
  }
  if (!ALLOWED_TUTOR_INTENTS.includes(payload.intent)) {
    errors.push(`Invalid or missing intent: "${payload.intent}"`);
  }
  if (!ALLOWED_TUTOR_LANGUAGES.includes(payload.language)) {
    errors.push(`Invalid or missing language: "${payload.language}"`);
  }
  if (!ALLOWED_TUTOR_LANGUAGES.includes(payload.language_detected)) {
    errors.push(`Invalid or missing language_detected: "${payload.language_detected}"`);
  }
  if (typeof payload.language_override_applied !== "boolean") {
    errors.push("language_override_applied must be a boolean");
  }
  if (!ALLOWED_EXPLANATION_DEPTHS.includes(payload.depth)) {
    errors.push(`Invalid or missing depth: "${payload.depth}"`);
  }
  if (!ALLOWED_GRADE_BANDS.includes(payload.grade_band)) {
    errors.push(`Invalid or missing grade_band: "${payload.grade_band}"`);
  }
  if (typeof payload.direct_answer !== "string" || payload.direct_answer.trim().length === 0) {
    errors.push("direct_answer must be a non-empty string");
  }
  if (!Array.isArray(payload.component_roles)) {
    errors.push("component_roles must be an array");
  } else {
    for (let i = 0; i < payload.component_roles.length; i++) {
      const cr = payload.component_roles[i];
      if (!cr || typeof cr !== "object" || typeof cr.partId !== "string" || typeof cr.role !== "string" || typeof cr.whyNeeded !== "string") {
        errors.push(`component_roles[${i}] must have string fields (partId, role, whyNeeded)`);
      }
    }
  }
  if (!Array.isArray(payload.operating_sequence)) {
    errors.push("operating_sequence must be an array of strings");
  }
  if (payload.code_logic_walkthrough !== null && payload.code_logic_walkthrough !== void 0) {
    if (typeof payload.code_logic_walkthrough !== "object" || Array.isArray(payload.code_logic_walkthrough)) {
      errors.push("code_logic_walkthrough must be null or an object");
    } else {
      const cw = payload.code_logic_walkthrough;
      if (typeof cw.summary !== "string" || !Array.isArray(cw.steps)) {
        errors.push("code_logic_walkthrough must contain summary (string) and steps (array)");
      }
    }
  }
  if (payload.science_concept !== null && payload.science_concept !== void 0) {
    if (typeof payload.science_concept !== "object" || Array.isArray(payload.science_concept)) {
      errors.push("science_concept must be null or an object");
    } else {
      const sc = payload.science_concept;
      if (typeof sc.title !== "string" || typeof sc.explanation !== "string") {
        errors.push("science_concept must contain title and explanation strings");
      }
    }
  }
  if (!Array.isArray(payload.safety_notes)) {
    errors.push("safety_notes must be an array of strings");
  }
  if (!Array.isArray(payload.assumptions_and_limitations)) {
    errors.push("assumptions_and_limitations must be an array of strings");
  }
  const ev = payload.evidence_status;
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
    errors.push("evidence_status must be an object");
  } else {
    if (!ev.circuit_validation || !ALLOWED_EVIDENCE_LABELS.includes(ev.circuit_validation.truth)) {
      errors.push("evidence_status.circuit_validation has invalid or missing truth label");
    }
    if (!ev.simulation || !ALLOWED_EVIDENCE_LABELS.includes(ev.simulation.truth)) {
      errors.push("evidence_status.simulation has invalid or missing truth label");
    }
    if (!ev.compilation || !ALLOWED_EVIDENCE_LABELS.includes(ev.compilation.truth)) {
      errors.push("evidence_status.compilation has invalid or missing truth label");
    }
    if (!ev.knowledge_source || !ALLOWED_EVIDENCE_LABELS.includes(ev.knowledge_source.truth)) {
      errors.push("evidence_status.knowledge_source has invalid or missing truth label");
    }
    if (ev.simulation && ev.simulation.status === "not_run" && ev.simulation.truth === "simulated") {
      errors.push("Truthfulness violation: simulation.status is 'not_run' but truth claims 'simulated'");
    }
    if (ev.compilation && ev.compilation.status === "not_run" && ev.compilation.truth === "compiled") {
      errors.push("Truthfulness violation: compilation.status is 'not_run' but truth claims 'compiled'");
    }
  }
  const proposal = payload.circuit_proposal;
  if (proposal) {
    if (typeof proposal !== "object" || proposal.schema_version !== "pixiu-copilot-proposal-v1") {
      errors.push("circuit_proposal must match 'pixiu-copilot-proposal-v1' schema");
    }
    if (options?.validatorResult) {
      const vRes = options.validatorResult;
      if (!vRes.valid && ev?.circuit_validation?.status === "passed") {
        errors.push("Truthfulness violation: circuit failed validator but evidence claims status 'passed'");
      }
      if (!vRes.valid && ev?.circuit_validation?.truth === "verified_by_validator") {
        errors.push("Truthfulness violation: rejected circuit cannot be labeled 'verified_by_validator'");
      }
      if (!vRes.valid) {
        const hasWarningInSafetyNotes = payload.safety_notes.some(
          (n) => /error|hazard|warning|short|resistor|burnout|reject|invalid/i.test(n)
        );
        if (!hasWarningInSafetyNotes) {
          errors.push("Safety violation: validator detected hazards but safety_notes contains no warning");
        }
      }
    }
  } else {
    if (ev && ev.circuit_validation && ev.circuit_validation.status === "passed") {
      errors.push("Truthfulness violation: cannot claim circuit_validation 'passed' when no circuit_proposal exists");
    }
  }
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      response: null
    };
  }
  return {
    valid: true,
    errors: [],
    response: payload
  };
}

// src/lib/ai/copilot/conversation-event-schema.ts
var ALLOWED_FEEDBACK_REASONS = [
  "wrong_wiring",
  "factual_error",
  "unclear_explanation",
  "wrong_language",
  "incomplete_answer",
  "hazardous_circuit",
  "other"
];
function createTutorInteractionEvent(params) {
  return {
    schema_version: "pixiu-tutor-event-v1",
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: params.conversationId,
    messageId: params.messageId,
    userId: params.userId,
    projectId: params.projectId,
    timestamp: Date.now(),
    userPrompt: params.userPrompt,
    baseRevisionHash: params.baseRevisionHash,
    tutorResponse: params.tutorResponse,
    language: params.tutorResponse.language,
    depth: params.tutorResponse.depth,
    modelAdapterId: params.modelAdapterId,
    promptVersion: params.promptVersion,
    responseSchemaVersion: "pixiu-tutor-response-v1",
    historyRetentionConsent: Boolean(params.historyRetentionConsent),
    trainingCandidateConsent: Boolean(params.trainingCandidateConsent),
    retentionPolicy: params.retentionPolicy ?? "pending_owner_approval"
  };
}
function createTutorFeedbackEvent(params) {
  return {
    schema_version: "pixiu-tutor-feedback-v1",
    feedbackId: `fbk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    interactionEventId: params.interactionEventId,
    conversationId: params.conversationId,
    userId: params.userId,
    rating: params.rating,
    reasonCode: params.reasonCode,
    comment: params.comment,
    timestamp: Date.now(),
    trainingConsentGranted: false
    // Strict default: feedback does not grant training rights
  };
}
function createDataDeletionRequest(params) {
  return {
    schema_version: "pixiu-privacy-deletion-v1",
    requestId: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: params.userId,
    projectId: params.projectId,
    targetScope: params.targetScope,
    requestedAt: Date.now(),
    status: "pending",
    affectedRecordTypes: [params.targetScope],
    auditLogId: `audit-del-${Date.now()}`
  };
}

// src/lib/ai/copilot/learning-data-lifecycle.ts
var ALLOWED_LIFECYCLE_STATES = [
  "INTERACTION_OCCURRED",
  "SESSION_HANDLED",
  "TRAINING_CONSENT_VERIFIED",
  "POLICY_AND_RIGHTS_EVALUATED",
  "REDACTION_AND_MINIMIZATION",
  "CANDIDATE_QUEUED",
  "HUMAN_REVIEW_PENDING",
  "APPROVED_FOR_DATASET",
  "REJECTED_INELIGIBLE",
  "VERSIONED_DATASET_RELEASED"
];
var EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
var PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b[6-9]\d{9}\b/g;
var AUTH_SECRET_PATTERN = /\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?)\b/gi;
var GOV_ID_PATTERN = /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/g;
var STUDENT_ID_PATTERN = /\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id|reg(?:istration)?\s*(?:no\.?|number)?)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+\b|\b(?:DPS|KV|SCH|STU|ADM)[-_]\d{4}[-_]\d{3,6}\b/gi;
var CLASS_GRADE_PATTERN = /\b(?:class|grade|standard|std\.?)\s*(?:1[0-2]|[1-9]|X|XI|XII|IX|VIII|VII|VI|V|IV|III|II|I)(?:th|st|nd|rd)?(?:\s*[-/]?\s*(?:sec(?:tion)?\s*)?[A-Za-z])?\b|\b(?:sec(?:tion)?)\s*[-/:]?\s*[A-Fa-f]\b/gi;
var SCHOOL_PATTERN = /\b(?:Delhi\s+Public\s+School|Kendriya\s+Vidyalaya|DPS\s+[A-Za-z]+|St\.?\s+[A-Za-z]+(?:'s)?\s+School)\b|\b(?:[A-Z][a-zA-Z0-9.'-]*\s+){1,4}(?:Public\s+School|High\s+School|Grammar\s+School|International\s+School|Vidyalaya|Vidyamandir|Convent|Academy|Secondary\s+School)\b/g;
var STUDENT_NAME_DISCLOSURE_PATTERN = /(?:\b(?:[mM]y\s+[nN]ame\s+[iI]s|[tT]his\s+[iI]s|[mM]yself|[cC]all\s+[mM]e)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b)|(?:\b[iI]\s+[aA]m\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b)/g;
var UNCERTAIN_DISCLOSURE_PATTERN = /\b(?:my\s+name\s+is|call\s+me|myself|i\s+am\s+a\s+student\s+at|my\s+school\s+is|i\s+study\s+at|my\s+class\s+is|my\s+roll\s+is|my\s+teacher\s+is|my\s+mentor\s+is|contact\s+me\s+at|reach\s+me\s+at)\b/i;
var KNOWN_TECHNICAL_TERMS = /* @__PURE__ */ new Set([
  "how",
  "why",
  "what",
  "when",
  "where",
  "which",
  "who",
  "does",
  "do",
  "is",
  "are",
  "can",
  "could",
  "should",
  "would",
  "will",
  "if",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "of",
  "and",
  "or",
  "not",
  "no",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "it",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "me",
  "him",
  "us",
  "them",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "need",
  "needs",
  "needed",
  "use",
  "uses",
  "used",
  "using",
  "connect",
  "connects",
  "connected",
  "connecting",
  "wire",
  "wires",
  "wired",
  "wiring",
  "work",
  "works",
  "worked",
  "working",
  "stop",
  "stops",
  "stopped",
  "stopping",
  "fail",
  "fails",
  "failed",
  "failing",
  "burn",
  "burns",
  "burned",
  "burning",
  "out",
  "blink",
  "blinks",
  "blinked",
  "blinking",
  "turn",
  "turns",
  "turned",
  "turning",
  "run",
  "runs",
  "ran",
  "running",
  "read",
  "reads",
  "reading",
  "write",
  "writes",
  "writing",
  "set",
  "sets",
  "setting",
  "drive",
  "drives",
  "driven",
  "driving",
  "measure",
  "measures",
  "measured",
  "measuring",
  "calculate",
  "calculates",
  "calculated",
  "calculating",
  "explain",
  "explains",
  "explained",
  "explaining",
  "help",
  "helps",
  "helped",
  "helping",
  "arduino",
  "uno",
  "r3",
  "mega",
  "nano",
  "esp32",
  "raspberry",
  "pi",
  "pico",
  "microbit",
  "led",
  "gnd",
  "vcc",
  "pin",
  "pins",
  "resistor",
  "resistors",
  "capacitor",
  "capacitors",
  "potentiometer",
  "servo",
  "servos",
  "buzzer",
  "buzzers",
  "sensor",
  "sensors",
  "ultrasonic",
  "hc-sr04",
  "dht11",
  "dht22",
  "ldr",
  "breadboard",
  "breadboards",
  "voltage",
  "current",
  "amp",
  "amps",
  "amperes",
  "milliamp",
  "milliamps",
  "ma",
  "volt",
  "volts",
  "v",
  "ohm",
  "ohms",
  "ground",
  "power",
  "rail",
  "rails",
  "digital",
  "analog",
  "pwm",
  "gpio",
  "circuit",
  "circuits",
  "multimeter",
  "dmm",
  "switch",
  "pushbutton",
  "button",
  "transistor",
  "mosfet",
  "relay",
  "motor",
  "dc",
  "ac",
  "battery",
  "batteries",
  "diode",
  "diodes",
  "ic",
  "chip",
  "i2c",
  "spi",
  "uart",
  "tx",
  "rx",
  "scl",
  "sda",
  "logic",
  "high",
  "low",
  "input",
  "output",
  "pullup",
  "pulldown",
  "board",
  "boards",
  "hardware",
  "code",
  "sketch",
  "telemetry",
  "doctor",
  "student",
  "query",
  "prompt",
  "question",
  "answer",
  "phone",
  "email",
  "redacted",
  "5v",
  "3.3v",
  "9v",
  "12v",
  "ohms",
  "law",
  "formula",
  "v=ir",
  "milliseconds",
  "ms",
  "seconds",
  "d13",
  "d12",
  "d11",
  "d10",
  "d9",
  "d8",
  "d7",
  "d6",
  "d5",
  "d4",
  "d3",
  "d2",
  "d1",
  "d0",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "d34",
  "d35",
  "current-limiting",
  "series",
  "parallel"
]);
var INTERPERSONAL_DIALOGUE_PATTERN = /\b(?:told|asked|says|said|informed|explained\s+to|showed|working\s+with|partner|classmate|teammate|friend|brother|sister)\b/i;
var UNFAMILIAR_SCHOOL_PATTERN = /\b(?:from|at|in|studies\s+at|goes\s+to)\s+([A-Za-z0-9.'\-_]+(?:\s+[A-Za-z0-9.'\-_]+){0,3}\s+(?:school|campus|academy|vidyalaya|vidyamandir|institute|college|institution|center))\b/i;
var INFORMAL_SCHOOL_PATTERN = /\b(?:from|at)\s+(?:greenwood|riverdale|sunset|hillside|st\.?\s+[a-z]+|dps|kv|convent)\b/i;
var INFORMAL_STUDENT_ID_PATTERN = /\b(?:student\s*id|roll\s*(?:no\.?|num|number)?|adm(?:ission)?\s*(?:no\.?|num|number|id)?|reg(?:istration)?\s*(?:no\.?|number)?|my\s+id\s+is|my\s+roll\s+is)\s*[:=#\-]?\s*#?\s*[0-9A-Za-z\-_]+\b|\b(?:student|candidate)\s*#\s*\d+\b|\b#(?:[0-9]{3,8})\b|\bid\s*[:=]\s*\d+\b/i;
function detectPotentialIdentityLeakage(text) {
  const reasons = [];
  if (INTERPERSONAL_DIALOGUE_PATTERN.test(text)) {
    reasons.push("interpersonal_dialogue_marker");
  }
  if (UNFAMILIAR_SCHOOL_PATTERN.test(text) || INFORMAL_SCHOOL_PATTERN.test(text)) {
    reasons.push("informal_or_unfamiliar_school_reference");
  }
  if (INFORMAL_STUDENT_ID_PATTERN.test(text)) {
    reasons.push("informal_student_id");
  }
  if (UNCERTAIN_DISCLOSURE_PATTERN.test(text)) {
    reasons.push("self_disclosure_marker");
  }
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const raw = words[i].replace(/[^A-Za-z0-9]/g, "");
    const lower = raw.toLowerCase();
    if (!raw || lower.length < 2) continue;
    const isCap = /^[A-Z][a-z]+$/.test(raw);
    if (isCap) {
      const isStartOfSentence = i === 0 || /[.!?]$/.test(words[i - 1]);
      if (!KNOWN_TECHNICAL_TERMS.has(lower)) {
        if (!isStartOfSentence) {
          reasons.push(`unrecognized_proper_noun:${raw}`);
        } else if (i + 1 < words.length && /^[A-Z][a-z]+$/.test(words[i + 1].replace(/[^A-Za-z0-9]/g, ""))) {
          const nextLower = words[i + 1].replace(/[^A-Za-z0-9]/g, "").toLowerCase();
          if (!KNOWN_TECHNICAL_TERMS.has(nextLower)) {
            reasons.push(`consecutive_unrecognized_proper_nouns:${raw}_${words[i + 1]}`);
          }
        }
      }
    }
  }
  return {
    hasPotentialIdentity: reasons.length > 0,
    reasons
  };
}
function containsRawPii(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { hasRawPii: false };
  }
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "email" };
  }
  if (/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b[6-9]\d{9}\b/.test(text)) {
    return { hasRawPii: true, matchedType: "phone" };
  }
  if (/\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{8,}['"]?)\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "auth_token_or_secret" };
  }
  if (/\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    return { hasRawPii: true, matchedType: "government_id" };
  }
  if (/\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id|reg(?:istration)?\s*(?:no\.?|number)?)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+\b|\b(?:DPS|KV|SCH|STU|ADM)[-_]\d{4}[-_]\d{3,6}\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "student_roll_or_admission_id" };
  }
  if (/\b(?:class|grade|standard|std\.?)\s*(?:1[0-2]|[1-9]|X|XI|XII|IX|VIII|VII|VI|V|IV|III|II|I)(?:th|st|nd|rd)?(?:\s*[-/]?\s*(?:sec(?:tion)?\s*)?[A-Za-z])?\b|\b(?:sec(?:tion)?)\s*[-/:]?\s*[A-Fa-f]\b/i.test(text)) {
    return { hasRawPii: true, matchedType: "class_grade_section" };
  }
  if (/\b(?:Delhi\s+Public\s+School|Kendriya\s+Vidyalaya|DPS\s+[A-Za-z]+|St\.?\s+[A-Za-z]+(?:'s)?\s+School)\b|\b(?:[A-Z][a-zA-Z0-9.'-]*\s+){1,4}(?:Public\s+School|High\s+School|Grammar\s+School|International\s+School|Vidyalaya|Vidyamandir|Convent|Academy|Secondary\s+School)\b/.test(text)) {
    return { hasRawPii: true, matchedType: "school_name" };
  }
  if (/(?:(?:[mM]y\s+[nN]ame\s+[iI]s|[tT]his\s+[iI]s|[mM]yself|[cC]all\s+[mM]e)\s+[A-Z][a-z]+)|(?:[iI]\s+[aA]m\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/.test(text)) {
    return { hasRawPii: true, matchedType: "student_name" };
  }
  if (UNCERTAIN_DISCLOSURE_PATTERN.test(text)) {
    return { hasRawPii: true, matchedType: "uncertain_disclosure" };
  }
  return { hasRawPii: false };
}
function sanitizeRejectionReason(callerReason, defaultReason) {
  if (!callerReason || typeof callerReason !== "string") {
    return defaultReason;
  }
  const trimmed = callerReason.trim();
  if (/^[A-Z0-9_]{3,64}$/.test(trimmed)) {
    return trimmed;
  }
  return defaultReason;
}
function scrubPii(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { sanitizedText: "", detectedPiiTypes: [], isFullyScrubbed: false, hasUncertainIdentity: false };
  }
  const detected = [];
  let result = text;
  let before = result;
  result = result.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
  if (result !== before) detected.push("email");
  before = result;
  result = result.replace(PHONE_PATTERN, "[REDACTED_PHONE]");
  if (result !== before) detected.push("phone");
  before = result;
  result = result.replace(AUTH_SECRET_PATTERN, "[REDACTED_SECRET]");
  if (result !== before) detected.push("auth_token_or_secret");
  before = result;
  result = result.replace(GOV_ID_PATTERN, "[REDACTED_GOV_ID]");
  if (result !== before) detected.push("government_id");
  before = result;
  result = result.replace(STUDENT_ID_PATTERN, "[REDACTED_STUDENT_ID]");
  if (result !== before) detected.push("student_roll_or_admission_id");
  before = result;
  result = result.replace(CLASS_GRADE_PATTERN, "[REDACTED_CLASS]");
  if (result !== before) detected.push("class_grade_section");
  before = result;
  result = result.replace(SCHOOL_PATTERN, "[REDACTED_SCHOOL]");
  if (result !== before) detected.push("school_name");
  before = result;
  result = result.replace(STUDENT_NAME_DISCLOSURE_PATTERN, "[REDACTED_STUDENT_NAME]");
  if (result !== before) detected.push("student_name");
  const residualEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.test(result);
  const residualPhone = /\b[6-9]\d{9}\b|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(result);
  const residualGovId = /\b[2-9]\d{3}[\s-]\d{4}[\s-]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/.test(result);
  const residualStudentId = /\b(?:roll\s*(?:no\.?|number|num)?|adm(?:ission)?\s*(?:no\.?|number|id)?|student\s*id)\s*[:=–-]?\s*[A-Za-z0-9\-_/]+/i.test(result);
  const residualSecret = /\b(?:bearer\s+[a-zA-Z0-9_\-\.]{16,}|(?:api[_-]?key|secret|password|token)\s*[:=])/i.test(result);
  const identityCheck = detectPotentialIdentityLeakage(result);
  const hasUncertainIdentity = identityCheck.hasPotentialIdentity;
  const uncertaintyReasons = [...identityCheck.reasons];
  if (residualEmail || residualPhone || residualGovId || residualStudentId || residualSecret) {
    uncertaintyReasons.push("residual_structured_identifier");
  }
  const isFullyScrubbed = !residualEmail && !residualPhone && !residualGovId && !residualStudentId && !residualSecret && !hasUncertainIdentity;
  return {
    sanitizedText: result,
    detectedPiiTypes: [...new Set(detected)],
    isFullyScrubbed,
    hasUncertainIdentity,
    uncertaintyReasons: uncertaintyReasons.length > 0 ? uncertaintyReasons : void 0
  };
}
var VALID_TRANSITIONS = {
  INTERACTION_OCCURRED: ["SESSION_HANDLED", "REJECTED_INELIGIBLE"],
  SESSION_HANDLED: ["TRAINING_CONSENT_VERIFIED", "REJECTED_INELIGIBLE"],
  TRAINING_CONSENT_VERIFIED: ["POLICY_AND_RIGHTS_EVALUATED", "REJECTED_INELIGIBLE"],
  POLICY_AND_RIGHTS_EVALUATED: ["REDACTION_AND_MINIMIZATION", "REJECTED_INELIGIBLE"],
  REDACTION_AND_MINIMIZATION: ["CANDIDATE_QUEUED", "REJECTED_INELIGIBLE"],
  CANDIDATE_QUEUED: ["HUMAN_REVIEW_PENDING", "REJECTED_INELIGIBLE"],
  HUMAN_REVIEW_PENDING: ["APPROVED_FOR_DATASET", "REJECTED_INELIGIBLE"],
  APPROVED_FOR_DATASET: ["VERSIONED_DATASET_RELEASED", "REJECTED_INELIGIBLE"],
  REJECTED_INELIGIBLE: [],
  // Terminal sink
  VERSIONED_DATASET_RELEASED: []
  // Terminal released
};
var DEFAULT_LEARNING_DATA_INTAKE_CONFIG = Object.freeze({
  freeTextIntakeEnabled: false,
  defaultRejectionReason: "REJECTED_LEARNING_DATA_INTAKE_DISABLED"
});
function isLearningDataIntakeEnabled() {
  return DEFAULT_LEARNING_DATA_INTAKE_CONFIG.freeTextIntakeEnabled;
}
function intakeLearningCandidate(event) {
  const candidate = createLearningCandidateFromEvent(event);
  candidate.state = "REJECTED_INELIGIBLE";
  candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason;
  candidate.trainingConsentGranted = false;
  candidate.redaction = null;
  candidate.updatedAt = Date.now();
  return {
    accepted: false,
    candidate,
    reasonCode: DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason
  };
}
function createLearningCandidateFromEvent(event) {
  return {
    concept_type: "learning_data_candidate",
    candidateId: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "INTERACTION_OCCURRED",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
function createFallbackRejectedCandidate(reason) {
  return {
    concept_type: "learning_data_candidate",
    candidateId: "cand-malformed-fallback",
    sourceEventId: "unknown",
    sourceConversationId: "unknown",
    state: "REJECTED_INELIGIBLE",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    rejectionReason: reason,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
function transitionCandidateState(candidate, targetState, context = {}) {
  if (!candidate || typeof candidate !== "object") {
    return {
      success: false,
      previousState: "REJECTED_INELIGIBLE",
      currentState: "REJECTED_INELIGIBLE",
      error: "Malformed candidate: candidate must be an object",
      candidate: createFallbackRejectedCandidate("REJECTED_MALFORMED_CANDIDATE")
    };
  }
  const rawState = candidate.state;
  const isKnownState = typeof rawState === "string" && Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, rawState);
  if (!isKnownState) {
    const rawStateStr = String(rawState);
    try {
      if (!Object.isFrozen(candidate)) {
        candidate.state = "REJECTED_INELIGIBLE";
        candidate.rejectionReason = "REJECTED_INVALID_STATE";
        candidate.updatedAt = Date.now();
      }
    } catch {
    }
    return {
      success: false,
      previousState: "REJECTED_INELIGIBLE",
      currentState: "REJECTED_INELIGIBLE",
      error: `Invalid or unknown candidate state: ${rawStateStr}`,
      candidate
    };
  }
  const isKnownTargetState = typeof targetState === "string" && Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, targetState);
  if (!isKnownTargetState) {
    return {
      success: false,
      previousState: candidate.state,
      currentState: candidate.state,
      error: `Invalid or unknown target state: ${String(targetState)}`,
      candidate
    };
  }
  const previousState = candidate.state;
  const allowedNext = VALID_TRANSITIONS[previousState];
  if (!allowedNext || !allowedNext.includes(targetState)) {
    return {
      success: false,
      previousState,
      currentState: previousState,
      error: `Illegal state transition from ${previousState} to ${targetState}`,
      candidate
    };
  }
  if (targetState === "TRAINING_CONSENT_VERIFIED") {
    if (context.trainingConsent === true && !context.authoritativeConsentRecord) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_CALLER_CONTROLLED_CONSENT_FORBIDDEN";
      candidate.trainingConsentGranted = false;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Raw caller-supplied boolean trainingConsent: true is prohibited. An authoritative consent record verified by a trusted consent service is required.",
        candidate
      };
    }
    if (context.authoritativeConsentRecord) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_UNVERIFIED_CONSENT_AUTHORITY";
      candidate.trainingConsentGranted = false;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Caller-provided consent record cannot establish authenticity. Trusted district consent verification service integration is required.",
        candidate
      };
    }
    candidate.state = "REJECTED_INELIGIBLE";
    candidate.rejectionReason = "REJECTED_MISSING_EXPLICIT_TRAINING_CONSENT";
    candidate.trainingConsentGranted = false;
    candidate.updatedAt = Date.now();
    return {
      success: false,
      previousState,
      currentState: "REJECTED_INELIGIBLE",
      error: "Candidate rejected: No active authoritative consent record available from integrated consent service.",
      candidate
    };
  }
  if (targetState === "POLICY_AND_RIGHTS_EVALUATED") {
    if (!context.policyPassed) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = sanitizeRejectionReason(context.rejectionReason, "REJECTED_FAILED_POLICY_CHECK");
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Failed privacy/school policy or IP rights evaluation",
        candidate
      };
    }
    candidate.policyCheckPassed = true;
  }
  if (targetState === "CANDIDATE_QUEUED") {
    let sanitizedPrompt = "";
    let sanitizedSummary = "";
    const detectedPiiTypes = /* @__PURE__ */ new Set();
    if (context.rawPrompt) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason;
      candidate.redaction = null;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake for raw free-text prompts is disabled by default until reliable identity screening and authoritative consent verification are integrated.",
        candidate
      };
    } else if (context.redactionResult) {
      if (!context.redactionResult.isRedacted) {
        candidate.state = "REJECTED_INELIGIBLE";
        candidate.rejectionReason = "REJECTED_UNREDACTED_PII";
        candidate.redaction = null;
        candidate.updatedAt = Date.now();
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Payload explicitly marked unredacted",
          candidate
        };
      }
      const promptText = context.redactionResult.redactedPrompt;
      if (!promptText || typeof promptText !== "string" || promptText.trim().length === 0) {
        candidate.state = "REJECTED_INELIGIBLE";
        candidate.rejectionReason = "REJECTED_MISSING_REDACTION_PAYLOAD";
        candidate.redaction = null;
        candidate.updatedAt = Date.now();
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Missing or invalid sanitized prompt payload",
          candidate
        };
      }
      const promptRawCheck = containsRawPii(promptText);
      const promptLeakage = detectPotentialIdentityLeakage(promptText);
      const promptScrubbed = scrubPii(promptText);
      if (promptRawCheck.hasRawPii || promptLeakage.hasPotentialIdentity || !promptScrubbed.isFullyScrubbed || promptScrubbed.hasUncertainIdentity) {
        candidate.state = "REJECTED_INELIGIBLE";
        candidate.rejectionReason = promptRawCheck.hasRawPii ? "REJECTED_UNREDACTED_PII" : promptLeakage.hasPotentialIdentity || promptScrubbed.hasUncertainIdentity ? "REJECTED_UNCERTAIN_STUDENT_PII" : "REJECTED_UNREDACTED_PII";
        candidate.redaction = null;
        candidate.updatedAt = Date.now();
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Raw PII detected in redactedPrompt payload. Identifiable student data and blind isRedacted flags are not trusted.",
          candidate
        };
      }
      for (const t of promptScrubbed.detectedPiiTypes) {
        detectedPiiTypes.add(t);
      }
      if (/\[REDACTED_EMAIL\]/.test(promptText)) detectedPiiTypes.add("email");
      if (/\[REDACTED_PHONE\]/.test(promptText)) detectedPiiTypes.add("phone");
      if (/\[REDACTED_SECRET\]/.test(promptText)) detectedPiiTypes.add("auth_token_or_secret");
      if (/\[REDACTED_GOV_ID\]/.test(promptText)) detectedPiiTypes.add("government_id");
      if (/\[REDACTED_STUDENT_ID\]/.test(promptText)) detectedPiiTypes.add("student_roll_or_admission_id");
      if (/\[REDACTED_CLASS\]/.test(promptText)) detectedPiiTypes.add("class_grade_section");
      if (/\[REDACTED_SCHOOL\]/.test(promptText)) detectedPiiTypes.add("school_name");
      if (/\[REDACTED_STUDENT_NAME\]/.test(promptText)) detectedPiiTypes.add("student_name");
      sanitizedPrompt = promptText;
      const summaryText = context.redactionResult.redactedResponseSummary ?? "sanitized_for_review";
      if (summaryText !== "sanitized_for_review") {
        const summaryRawCheck = containsRawPii(summaryText);
        const summaryLeakage = detectPotentialIdentityLeakage(summaryText);
        const summaryScrubbed = scrubPii(summaryText);
        if (summaryRawCheck.hasRawPii || summaryLeakage.hasPotentialIdentity || !summaryScrubbed.isFullyScrubbed || summaryScrubbed.hasUncertainIdentity) {
          candidate.state = "REJECTED_INELIGIBLE";
          candidate.rejectionReason = summaryRawCheck.hasRawPii ? "REJECTED_UNREDACTED_PII" : summaryLeakage.hasPotentialIdentity || summaryScrubbed.hasUncertainIdentity ? "REJECTED_UNCERTAIN_STUDENT_PII" : "REJECTED_UNREDACTED_PII";
          candidate.redaction = null;
          candidate.updatedAt = Date.now();
          return {
            success: false,
            previousState,
            currentState: "REJECTED_INELIGIBLE",
            error: "Candidate rejected: Raw PII or identifiable student data detected in redactedResponseSummary payload.",
            candidate
          };
        }
        for (const t of summaryScrubbed.detectedPiiTypes) {
          detectedPiiTypes.add(t);
        }
        if (/\[REDACTED_EMAIL\]/.test(summaryText)) detectedPiiTypes.add("email");
        if (/\[REDACTED_PHONE\]/.test(summaryText)) detectedPiiTypes.add("phone");
        if (/\[REDACTED_SECRET\]/.test(summaryText)) detectedPiiTypes.add("auth_token_or_secret");
        if (/\[REDACTED_GOV_ID\]/.test(summaryText)) detectedPiiTypes.add("government_id");
        if (/\[REDACTED_STUDENT_ID\]/.test(summaryText)) detectedPiiTypes.add("student_roll_or_admission_id");
        if (/\[REDACTED_CLASS\]/.test(summaryText)) detectedPiiTypes.add("class_grade_section");
        if (/\[REDACTED_SCHOOL\]/.test(summaryText)) detectedPiiTypes.add("school_name");
        if (/\[REDACTED_STUDENT_NAME\]/.test(summaryText)) detectedPiiTypes.add("student_name");
        sanitizedSummary = summaryText;
      } else {
        sanitizedSummary = "sanitized_for_review";
      }
    } else {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_MISSING_REDACTION_PAYLOAD";
      candidate.redaction = null;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Must undergo verified PII redaction and payload minimization before queueing",
        candidate
      };
    }
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason;
      candidate.redaction = null;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default until reliable identity screening and authoritative consent verification are integrated.",
        candidate
      };
    }
    candidate.redaction = {
      isRedacted: true,
      redactedPrompt: sanitizedPrompt,
      redactedResponseSummary: sanitizedSummary,
      piiDetected: detectedPiiTypes.size > 0,
      piiTypes: Array.from(detectedPiiTypes)
    };
  }
  if (targetState === "HUMAN_REVIEW_PENDING") {
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason;
      candidate.redaction = null;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default. Human review queue cannot accept candidates while intake is disabled.",
        candidate
      };
    }
  }
  if (targetState === "APPROVED_FOR_DATASET") {
    const sig = context.humanReviewSignature;
    if (!sig || sig.decision !== "APPROVED" || !sig.reviewerId || !sig.reviewedAtUtc) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_MISSING_OR_INVALID_HUMAN_SIGNATURE";
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Cannot approve without a genuine, evidenced human review signature",
        candidate
      };
    }
    const isAutoReviewer = /(?:^system-|generator|verifier|automation|automated|(?:^|[-_])bot(?:$|[-_]))/i.test(sig.reviewerId);
    if (isAutoReviewer) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_AUTOMATED_REVIEWER_LABEL";
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Reviewer ID indicates an automated generator/verifier, not an independent human reviewer",
        candidate
      };
    }
    if (typeof sig.evidenceNotes === "string" && sig.evidenceNotes.trim().length > 0) {
      const evidenceRawPii = containsRawPii(sig.evidenceNotes);
      const evidenceLeakage = detectPotentialIdentityLeakage(sig.evidenceNotes);
      if (evidenceRawPii.hasRawPii || evidenceLeakage.hasPotentialIdentity) {
        candidate.state = "REJECTED_INELIGIBLE";
        candidate.rejectionReason = evidenceRawPii.hasRawPii ? "REJECTED_UNREDACTED_PII" : evidenceLeakage.hasPotentialIdentity ? "REJECTED_UNCERTAIN_STUDENT_PII" : "REJECTED_UNREDACTED_PII";
        candidate.updatedAt = Date.now();
        return {
          success: false,
          previousState,
          currentState: "REJECTED_INELIGIBLE",
          error: "Candidate rejected: Raw PII or identifiable student data detected in reviewer evidence notes.",
          candidate
        };
      }
    }
    if (context.reviewerVerifier || context.__testOnly_mockAuthorization) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = "REJECTED_CALLER_INJECTED_VERIFIER_FORBIDDEN";
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Dataset approval blocked: Caller-injected reviewerVerifier functions are strictly prohibited. A user-supplied function cannot establish reviewer authorization.",
        candidate
      };
    }
    candidate.state = "REJECTED_INELIGIBLE";
    candidate.rejectionReason = "REJECTED_AUTHORITATIVE_VERIFIER_UNAVAILABLE";
    candidate.updatedAt = Date.now();
    return {
      success: false,
      previousState,
      currentState: "REJECTED_INELIGIBLE",
      error: "Dataset approval blocked: No authoritative reviewer-verification integration available to verify reviewer identity and permission.",
      candidate
    };
  }
  if (targetState === "VERSIONED_DATASET_RELEASED") {
    if (!context.datasetVersion) {
      return {
        success: false,
        previousState,
        currentState: previousState,
        error: "Cannot release without a pinned target dataset version (e.g. 'v2.1.0')",
        candidate
      };
    }
    if (!isLearningDataIntakeEnabled()) {
      candidate.state = "REJECTED_INELIGIBLE";
      candidate.rejectionReason = DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason;
      candidate.updatedAt = Date.now();
      return {
        success: false,
        previousState,
        currentState: "REJECTED_INELIGIBLE",
        error: "Candidate rejected: Learning-data intake is disabled by default. Cannot release dataset while intake is disabled.",
        candidate
      };
    }
    candidate.targetDatasetVersion = context.datasetVersion;
  }
  if (targetState === "REJECTED_INELIGIBLE") {
    candidate.rejectionReason = sanitizeRejectionReason(context.rejectionReason, "REJECTED_UNSPECIFIED");
  }
  candidate.state = targetState;
  candidate.updatedAt = Date.now();
  return {
    success: true,
    previousState,
    currentState: targetState,
    candidate
  };
}
function triggerOnlineModelWeightUpdate() {
  throw new Error(
    "GOVERNANCE VIOLATION: Online learning or automatic model weight updates from raw chats is strictly prohibited. All model enhancements must proceed via governed Phase 4/5 batch retraining."
  );
}
export {
  ALLOWED_CAPABILITY_STATUSES,
  ALLOWED_EVIDENCE_LABELS,
  ALLOWED_EXPLANATION_DEPTHS,
  ALLOWED_FEEDBACK_REASONS,
  ALLOWED_GRADE_BANDS,
  ALLOWED_LIFECYCLE_STATES,
  ALLOWED_TUTOR_INTENTS,
  ALLOWED_TUTOR_LANGUAGES,
  ANALOG_PINS,
  BackendProxyModelAdapter,
  DEFAULT_LEARNING_DATA_INTAKE_CONFIG,
  DeterministicStubAdapter,
  GND_PINS,
  HttpBaselineModelAdapter,
  POWER_PINS,
  SUPPORTED_BOARDS,
  SUPPORTED_TASK_FAMILIES,
  UNKNOWN_UNSUPPORTED_BLOCKS,
  VERIFIED_BLOCK_ALIASES,
  containsRawPii,
  containsRoboticOpeningClich\u00E9,
  createBaselineModelAdapter,
  createDataDeletionRequest,
  createLearningCandidateFromEvent,
  createTutorFeedbackEvent,
  createTutorInteractionEvent,
  detectPotentialIdentityLeakage,
  detectPromptLanguage,
  evaluateProposalGate,
  extractCleanJsonString,
  handleCopilotRequest,
  intakeLearningCandidate,
  isInputCapableGpio,
  isLearningDataIntakeEnabled,
  isOutputCapableGpio,
  parseProposalPayload,
  repairBlocklyXml,
  resolveBoardPinDef,
  resolveExplanationDepth,
  routeUserRequest,
  sanitizeRejectionReason,
  scrubPii,
  transitionCandidateState,
  triggerOnlineModelWeightUpdate,
  validateTutorResponse,
  wrapCopilotPrompt
};
