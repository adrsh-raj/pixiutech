/**
 * PIXIU TECH CYBERLAB — ACTION & STAGING CONTROLLER HOOK
 * 
 * Manages the deterministic lifecycle of AI-proposed circuit actions:
 *   idle -> proposed -> validating -> validated -> staged -> applying -> applied -> undone/rejected
 * 
 * Enforces:
 * 1. Stale proposal rejection via deterministic canvas revision hashing (revHash).
 * 2. Visual ghost preview & diff calculation before touching live canvas state.
 * 3. Atomic application of circuit + Blockly XML.
 * 4. Circular undo/redo snapshot buffer for instantaneous 1-click rollback.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { useState, useCallback, useRef, useMemo } from "react"
import type { CircuitState, PlacedPart, Wire } from "@/lib/circuit-types"
import {
  validateProposedCircuit,
  computeCircuitHash,
  type CircuitValidationResult,
  type DiagnosticNotice,
} from "@/lib/circuit-validator"

// ============================================================================
// Types & Contracts
// ============================================================================

export type CopilotActionState =
  | "idle"
  | "proposed"
  | "validating"
  | "validated"
  | "rejected"
  | "staged"
  | "applying"
  | "applied"
  | "undone"

export interface CircuitCopilotProposal {
  id: string
  title: string
  rationale: string
  baseRevisionHash: string
  circuit: CircuitState
  blocklyXml?: string
  codeLanguage?: "blockly" | "cpp" | "python"
}

export interface CircuitDiff {
  addedParts: PlacedPart[]
  removedParts: PlacedPart[]
  modifiedParts: PlacedPart[]
  addedWires: Wire[]
  removedWires: Wire[]
  partsChangedCount: number
  wiresChangedCount: number
}

export interface StagedPreview {
  proposal: CircuitCopilotProposal
  normalizedCircuit: CircuitState
  diff: CircuitDiff
  validation: CircuitValidationResult
  stale: boolean
}

interface UndoSnapshot {
  circuit: CircuitState
  blocklyXml?: string
  /** Fingerprint of the state saved in this snapshot. */
  revHash: string
  /** Fingerprint that must be current before this snapshot may be restored. */
  expectedCurrentHash: string
  timestamp: number
  description: string
}

/** Returns true only when history restoration cannot overwrite a newer canvas/workspace edit. */
export function canRestoreAtRevision(expectedCurrentHash: string, currentHash: string): boolean {
  return expectedCurrentHash === currentHash
}

function getProposalValidationCandidate(proposal: unknown): unknown {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return proposal
  const rawProposal = proposal as Record<string, unknown>
  const rawCircuit = rawProposal.circuit
  if (!rawCircuit || typeof rawCircuit !== "object" || Array.isArray(rawCircuit)) return rawCircuit
  const circuit = rawCircuit as Record<string, unknown>
  // Build a narrow object rather than spreading an untrusted payload into app state.
  return {
    parts: circuit.parts,
    wires: circuit.wires,
    blocklyXml: rawProposal.blocklyXml,
  }
}

function historyConflictNotice(action: "undo" | "redo"): DiagnosticNotice {
  return {
    ruleId: `copilot-${action}-blocked-after-manual-edit`,
    severity: "warning",
    category: "schema",
    title: `${action === "undo" ? "Undo" : "Redo"} Blocked to Preserve Newer Edits`,
    message: `The circuit or Blockly workspace changed after this AI action. ${action === "undo" ? "Undoing" : "Redoing"} it now could overwrite manual work, so the action was not applied.`,
    suggestion: "Keep the current edits, or restore the AI action only after reviewing/reconciling the current workspace.",
    involvedPartIds: [],
  }
}

export interface UseCircuitCopilotActionParams {
  currentCircuit: CircuitState
  currentBlocklyXml?: string
  onApplyCircuit: (circuit: CircuitState, blocklyXml?: string) => void
  maxUndoSnapshots?: number
}

// ============================================================================
// Helper: Circuit Diff Calculation
// ============================================================================

export function computeCircuitDiff(current: CircuitState, proposed: CircuitState): CircuitDiff {
  const currentPartMap = new Map(current.parts.map((p) => [p.id, p]))
  const proposedPartMap = new Map(proposed.parts.map((p) => [p.id, p]))

  const addedParts: PlacedPart[] = []
  const modifiedParts: PlacedPart[] = []
  const removedParts: PlacedPart[] = []

  for (const [id, propPart] of proposedPartMap.entries()) {
    const cur = currentPartMap.get(id)
    if (!cur) {
      addedParts.push(propPart)
    } else {
      // Check if modified
      const typeChanged = cur.type !== propPart.type
      const posChanged = cur.x !== propPart.x || cur.y !== propPart.y
      const rotChanged = (cur.rotation || 0) !== (propPart.rotation || 0)
      const propsChanged = JSON.stringify(cur.props || {}) !== JSON.stringify(propPart.props || {})
      if (typeChanged || posChanged || rotChanged || propsChanged) {
        modifiedParts.push(propPart)
      }
    }
  }

  for (const [id, curPart] of currentPartMap.entries()) {
    if (!proposedPartMap.has(id)) {
      removedParts.push(curPart)
    }
  }

  // Wires Diff
  const wireKey = (w: Wire) => {
    const e1 = `${w.from.partId}:${w.from.pinId}`
    const e2 = `${w.to.partId}:${w.to.pinId}`
    return e1 < e2 ? `${e1}<->${e2}` : `${e2}<->${e1}`
  }

  const currentWireKeys = new Set(current.wires.map(wireKey))
  const proposedWireKeys = new Set(proposed.wires.map(wireKey))

  const addedWires = proposed.wires.filter((w) => !currentWireKeys.has(wireKey(w)))
  const removedWires = current.wires.filter((w) => !proposedWireKeys.has(wireKey(w)))

  return {
    addedParts,
    removedParts,
    modifiedParts,
    addedWires,
    removedWires,
    partsChangedCount: addedParts.length + removedParts.length + modifiedParts.length,
    wiresChangedCount: addedWires.length + removedWires.length,
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCircuitCopilotAction({
  currentCircuit,
  currentBlocklyXml,
  onApplyCircuit,
  maxUndoSnapshots = 25,
}: UseCircuitCopilotActionParams) {
  const [state, setState] = useState<CopilotActionState>("idle")
  const [activeProposal, setActiveProposal] = useState<CircuitCopilotProposal | null>(null)
  const [stagedPreview, setStagedPreview] = useState<StagedPreview | null>(null)
  const [lastValidation, setLastValidation] = useState<CircuitValidationResult | null>(null)
  const [rejectionReasons, setRejectionReasons] = useState<DiagnosticNotice[]>([])

  // Circular Undo / Redo Buffers
  const undoStackRef = useRef<UndoSnapshot[]>([])
  const redoStackRef = useRef<UndoSnapshot[]>([])
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  // Current canvas revision hash
  const currentHash = useMemo(
    () => computeCircuitHash(currentCircuit, currentBlocklyXml),
    [currentCircuit, currentBlocklyXml],
  )

  /**
   * Receive and validate an incoming proposal from AI model or template generator.
   */
  const proposeAction = useCallback(
    (proposal: CircuitCopilotProposal): { valid: boolean; stale: boolean; result: CircuitValidationResult } => {
      setState("validating")
      setActiveProposal(proposal)

      // 1. Check for stale proposal. Missing or malformed revision metadata is never trusted.
      const isStale =
        !proposal ||
        typeof proposal !== "object" ||
        typeof proposal.baseRevisionHash !== "string" ||
        proposal.baseRevisionHash !== currentHash

      // 2. Validate both circuit and optional Blockly XML as one untrusted proposal envelope.
      const validation = validateProposedCircuit(getProposalValidationCandidate(proposal), {
        allowWarnings: true,
        baseCircuit: currentCircuit,
      })

      setLastValidation(validation)

      if (!validation.valid || isStale) {
        setState("rejected")
        const notices: DiagnosticNotice[] = [...validation.notices]
        if (isStale) {
          notices.unshift({
            ruleId: "copilot-stale-proposal-rejected",
            severity: "critical",
            category: "schema",
            title: "Stale Circuit Proposal Rejected",
            message: "The circuit canvas was modified after this AI proposal was generated. Applying it would overwrite your manual changes.",
            suggestion: "Request a fresh AI recommendation reflecting your latest circuit layout.",
            involvedPartIds: [],
          })
        }
        setRejectionReasons(notices)
        setStagedPreview(null)
        return { valid: false, stale: isStale, result: validation }
      }

      // Valid proposal
      setState("validated")
      setRejectionReasons([])
      return { valid: true, stale: false, result: validation }
    },
    [currentCircuit, currentHash],
  )

  /**
   * Stage proposal for visual ghost preview overlay on the CyberLab canvas.
   */
  const stageProposal = useCallback(
    (proposal?: CircuitCopilotProposal): boolean => {
      const target = proposal || activeProposal
      if (!target) return false

      const validation = validateProposedCircuit(getProposalValidationCandidate(target), { allowWarnings: true })
      if (!validation.valid || !validation.normalizedCircuit) {
        setState("rejected")
        setRejectionReasons(validation.notices)
        return false
      }

      const isStale = target.baseRevisionHash !== currentHash
      const diff = computeCircuitDiff(currentCircuit, validation.normalizedCircuit)

      const staged: StagedPreview = {
        proposal: target,
        normalizedCircuit: validation.normalizedCircuit,
        diff,
        validation,
        stale: isStale,
      }

      setStagedPreview(staged)
      setState("staged")
      return true
    },
    [activeProposal, currentCircuit, currentHash],
  )

  /**
   * Dismiss staged ghost preview without applying changes.
   */
  const dismissStaging = useCallback(() => {
    setStagedPreview(null)
    setActiveProposal(null)
    setState("idle")
  }, [])

  /**
   * Atomically apply proposed circuit changes to the live canvas.
   */
  const applyProposal = useCallback(
    (proposalToApply?: CircuitCopilotProposal): boolean => {
      const target = proposalToApply || activeProposal || stagedPreview?.proposal
      if (!target) return false

      // 1. Stale proposal protection
      if (target.baseRevisionHash !== currentHash) {
        setState("rejected")
        setRejectionReasons([
          {
            ruleId: "copilot-stale-proposal-blocked",
            severity: "critical",
            category: "schema",
            title: "Cannot Apply Stale Proposal",
            message: "Canvas layout changed since this recommendation was created. Stale action blocked to prevent state corruption.",
            suggestion: "Ask the AI Copilot to regenerate recommendations based on current wiring.",
            involvedPartIds: [],
          },
        ])
        return false
      }

      // 2. Validate proposed circuit
      const validation = validateProposedCircuit(getProposalValidationCandidate(target), { allowWarnings: true })
      if (!validation.valid || !validation.normalizedCircuit) {
        setState("rejected")
        setRejectionReasons(validation.notices)
        return false
      }

      setState("applying")

      // 3. Save pre-mutation snapshot to circular undo buffer
      const effectiveNextBlocklyXml =
        typeof target.blocklyXml === "string" ? target.blocklyXml : currentBlocklyXml
      const snapshot: UndoSnapshot = {
        circuit: JSON.parse(JSON.stringify(currentCircuit)),
        blocklyXml: currentBlocklyXml,
        revHash: currentHash,
        expectedCurrentHash: computeCircuitHash(validation.normalizedCircuit, effectiveNextBlocklyXml),
        timestamp: Date.now(),
        description: target.title || "AI Circuit Action",
      }

      undoStackRef.current.push(snapshot)
      if (undoStackRef.current.length > maxUndoSnapshots) {
        undoStackRef.current.shift()
      }
      redoStackRef.current = [] // clear redo buffer on new action

      setUndoCount(undoStackRef.current.length)
      setRedoCount(0)

      // 4. Atomic application via callback
      onApplyCircuit(validation.normalizedCircuit, effectiveNextBlocklyXml)

      setStagedPreview(null)
      setState("applied")
      return true
    },
    [
      activeProposal,
      stagedPreview,
      currentCircuit,
      currentBlocklyXml,
      currentHash,
      maxUndoSnapshots,
      onApplyCircuit,
    ],
  )

  /**
   * Revert the most recently applied action.
   */
  const undoAction = useCallback((): boolean => {
    if (undoStackRef.current.length === 0) return false

    const candidateSnapshot = undoStackRef.current[undoStackRef.current.length - 1]
    if (!canRestoreAtRevision(candidateSnapshot.expectedCurrentHash, currentHash)) {
      setState("rejected")
      setRejectionReasons([historyConflictNotice("undo")])
      return false
    }

    const previousSnapshot = undoStackRef.current.pop()!
    setUndoCount(undoStackRef.current.length)

    // Save the applied state to redo history. Redo is allowed only from the restored revision.
    const presentSnapshot: UndoSnapshot = {
      circuit: JSON.parse(JSON.stringify(currentCircuit)),
      blocklyXml: currentBlocklyXml,
      revHash: currentHash,
      expectedCurrentHash: previousSnapshot.revHash,
      timestamp: Date.now(),
      description: "Pre-Undo State",
    }
    redoStackRef.current.push(presentSnapshot)
    setRedoCount(redoStackRef.current.length)

    onApplyCircuit(previousSnapshot.circuit, previousSnapshot.blocklyXml)
    setState("undone")
    return true
  }, [currentCircuit, currentBlocklyXml, currentHash, onApplyCircuit])

  /**
   * Re-apply an undone action.
   */
  const redoAction = useCallback((): boolean => {
    if (redoStackRef.current.length === 0) return false

    const candidateSnapshot = redoStackRef.current[redoStackRef.current.length - 1]
    if (!canRestoreAtRevision(candidateSnapshot.expectedCurrentHash, currentHash)) {
      setState("rejected")
      setRejectionReasons([historyConflictNotice("redo")])
      return false
    }

    const nextSnapshot = redoStackRef.current.pop()!
    setRedoCount(redoStackRef.current.length)

    // Save the pre-redo state. Undo is allowed only from the re-applied revision.
    const presentSnapshot: UndoSnapshot = {
      circuit: JSON.parse(JSON.stringify(currentCircuit)),
      blocklyXml: currentBlocklyXml,
      revHash: currentHash,
      expectedCurrentHash: computeCircuitHash(nextSnapshot.circuit, nextSnapshot.blocklyXml),
      timestamp: Date.now(),
      description: "Pre-Redo State",
    }
    undoStackRef.current.push(presentSnapshot)
    if (undoStackRef.current.length > maxUndoSnapshots) undoStackRef.current.shift()
    setUndoCount(undoStackRef.current.length)

    onApplyCircuit(nextSnapshot.circuit, nextSnapshot.blocklyXml)
    setState("applied")
    return true
  }, [currentCircuit, currentBlocklyXml, currentHash, onApplyCircuit, maxUndoSnapshots])

  return {
    state,
    currentHash,
    activeProposal,
    stagedPreview,
    lastValidation,
    rejectionReasons,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undoCount,
    redoCount,
    proposeAction,
    stageProposal,
    dismissStaging,
    applyProposal,
    undoAction,
    redoAction,
  }
}
