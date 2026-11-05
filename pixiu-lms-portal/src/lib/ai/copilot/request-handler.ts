/**
 * PIXIU TECH CYBERLAB — AI COPILOT CENTRAL REQUEST HANDLER
 * 
 * Authoritative application entry point connecting incoming AI requests to the
 * PixiuMind model adapter, Blockly repair middleware, and safety validation gate.
 * 
 * Call Chain:
 * Incoming Request
 *   → routeUserRequest (classify task family & target board)
 *   → wrapCopilotPrompt (pedagogical & inductive safety guardrails)
 *   → modelAdapter.generateProposal (execute inference against PixiuMind endpoint)
 *   → parseProposalPayload (validate strict JSON envelope)
 *   → repairBlocklyXml (heal dangling XML, normalize block aliases, reject unsupported hardware)
 *   → evaluateProposalGate (deterministic electrical safety and pin policy gate)
 *   → Output validated CircuitCopilotProposal ready for canvas and Blockly workspace
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { routeUserRequest, type TaskRouteResult } from "./task-router"
import {
  type ModelAdapter,
  type CopilotModelRequest,
  type CopilotModelResponse,
  createBaselineModelAdapter,
} from "./model-adapter"
import { parseProposalPayload, type CopilotProposalPayload, type ProposalParseResult } from "./proposal-schema"
import { evaluateProposalGate, type ProposalGateResult, type GateEvaluationOptions } from "./proposal-gate"
import { repairBlocklyXml, wrapCopilotPrompt, type RepairResult } from "./blockly-repair-middleware"
import type { CircuitCopilotProposal } from "@/components/circuit-lab/use-circuit-copilot-action"
import type { CircuitState } from "@/lib/circuit-types"

export interface CopilotRequestInput {
  requestId: string
  prompt: string
  targetBoard: string
  currentRevisionHash?: string
  currentCircuit?: CircuitState
  currentBlocklyXml?: string
  modelAdapter?: ModelAdapter
  timeoutMs?: number
}

export interface CopilotRequestOutput {
  requestId: string
  success: boolean
  route: TaskRouteResult
  modelResponse: CopilotModelResponse
  parseResult: ProposalParseResult
  repairResult: RepairResult | null
  gateResult: ProposalGateResult | null
  proposal: CircuitCopilotProposal | null
  replyText: string
  error?: string
}

/**
 * Executes a complete, end-to-end Copilot request through the application pipeline.
 */
export async function handleCopilotRequest(
  input: CopilotRequestInput
): Promise<CopilotRequestOutput> {
  const targetBoard = input.targetBoard || "arduino-uno"
  const revHash = input.currentRevisionHash || "0000000000000000"

  // 1. Task Classification & Routing
  const route = routeUserRequest(input.prompt, { targetBoard })
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
          durationMs: 0,
        },
      },
      parseResult: { valid: false, payload: null, errors: [route.normalizedGoal], rawTrimmed: "" },
      repairResult: null,
      gateResult: null,
      proposal: null,
      replyText: route.clarificationPrompt || "Your request is outside the supported circuit tasks.",
      error: route.riskFlags.join(", ") || "ROUTING_REJECTED",
    }
  }

  // 2. Derive domain dynamically from task route and prompt
  const domain: "math" | "circuit" | "general" =
    route.route === "math_teaching" ? "math" : "circuit"
  const hasInductiveLoad =
    domain === "circuit" && /\b(motor|fan|relay|pump|solenoid|coil)\b/i.test(input.prompt)

  const wrappedPrompt = wrapCopilotPrompt(input.prompt, {
    domain,
    hasInductiveLoad,
  })

  // 3. Inference execution via ModelAdapter (defaults to Checkpoint-400 HTTP endpoint)
  const adapter = input.modelAdapter || createBaselineModelAdapter()
  const modelReq: CopilotModelRequest = {
    requestId: input.requestId,
    prompt: wrappedPrompt,
    context: {
      targetBoard,
      canvasRevisionHash: revHash,
    },
  }

  const modelRes = await adapter.generateProposal(modelReq, {
    timeoutMs: input.timeoutMs || 10000,
  })

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
      error: modelRes.error?.code || "INFERENCE_FAILED",
    }
  }

  // 4. Handle Math Teaching Pedagogy Route
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
      replyText: modelRes.rawOutput,
    }
  }

  // 5. Strict Schema Parsing for Circuit Proposals
  const parsed = parseProposalPayload(modelRes.rawOutput)
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
      error: "SCHEMA_PARSING_FAILED",
    }
  }

  // 5. Middleware Blockly Healing & Normalization
  let repair: RepairResult | null = null
  let effectiveXml: string | undefined = undefined

  if (parsed.payload.proposal.code && typeof parsed.payload.proposal.code === "string") {
    repair = repairBlocklyXml(parsed.payload.proposal.code)
    if (!repair.success) {
      // Safe rejection of unsupported peripherals (MAX6675, TM1637, etc.)
      return {
        requestId: input.requestId,
        success: false,
        route,
        modelResponse: modelRes,
        parseResult: parsed,
        repairResult: repair,
        gateResult: null,
        proposal: null,
        replyText: `⚠️ **Unsupported Hardware Detected**\n${repair.error}\nPlease use standard supported components from the CyberLab toolbox.`,
        error: "UNSUPPORTED_HARDWARE_REJECTED",
      }
    }
    effectiveXml = repair.repairedXml || parsed.payload.proposal.code
  }

  // 6. Deterministic Safety & Policy Gate
  const gateOpts: GateEvaluationOptions = {
    currentBoard: targetBoard,
    currentRevisionHash: revHash,
    expectedRevisionHash: revHash,
  }
  const gateResult = evaluateProposalGate(parsed.payload, gateOpts)
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
      replyText: `Safety validation rejected proposal:\n${gateResult.errors.join("\n")}`,
      error: "POLICY_GATE_REJECTED",
    }
  }

  // 7. Construct Verified CircuitCopilotProposal
  const circuitPayload = parsed.payload.proposal.circuit || { parts: [], wires: [] }
  const finalProposal: CircuitCopilotProposal = {
    id: `prop-${input.requestId}`,
    title: parsed.payload.summary || "AI Circuit Recommendation",
    rationale: parsed.payload.proposal.explanation || parsed.payload.summary,
    baseRevisionHash: revHash,
    circuit: circuitPayload,
    blocklyXml: effectiveXml,
    codeLanguage: "blockly",
  }

  return {
    requestId: input.requestId,
    success: true,
    route,
    modelResponse: modelRes,
    parseResult: parsed,
    repairResult: repair,
    gateResult,
    proposal: finalProposal,
    replyText: `💡 **AI Proposal Created: ${finalProposal.title}**\n${finalProposal.rationale}`,
  }
}
