/**
 * PIXIU TECH CYBERLAB — CONVERSATION & FEEDBACK EVENT CONTRACT
 * 
 * Defines the versioned `pixiu-tutor-event-v1` schema for interactions,
 * user feedback, data retention policies, and privacy-governed lifecycles.
 * 
 * Crucial Architectural Separation (5 Distinct Concepts):
 * - A. Session Context: Ephemeral context needed for the active turn.
 * - B. Saved Conversation History: User-facing message log under explicit consent.
 * - C. Saved Project Memory: Deliberately saved circuit/project facts.
 * - D. User Preferences: User-controlled language & explanation preferences.
 * - E. Learning-Data Candidates: Records eligible for future governed review.
 * 
 * Invariants:
 * 1. Storing history DOES NOT imply consent for model training.
 * 2. User feedback DOES NOT automatically grant training rights.
 * 3. Deletion requests strictly govern retention states.
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import type { PixiuTutorResponseV1, TutorLanguage, ExplanationDepth } from "./tutor-response-contract"

// ============================================================================
// 1. Five Distinct Concept Models
// ============================================================================

/**
 * Concept A: Session Context
 * Temporary, ephemeral in-memory context required to resolve the immediate query.
 * Must NOT be permanently retained or used for model training.
 */
export interface SessionContext {
  concept_type: "session_context"
  sessionId: string
  activeTab: "editor" | "circuit" | "simulation" | "docs"
  selectedPartIds: string[]
  activeBoard: string
  recentTokenEstimate: number
  ephemeralScratchPad: Record<string, unknown>
  createdAt: number
  expiresAt: number
}

/**
 * Concept B: Saved Conversation History
 * Stored under explicit user consent for student review and continuity.
 * Preserving history NEVER automatically makes the conversation a training candidate.
 */
export interface SavedHistoryMessage {
  messageId: string
  sender: "student" | "tutor" | "system"
  text: string
  structuredResponse?: PixiuTutorResponseV1
  timestamp: number
}

export type RetentionPolicy =
  | "session_only"
  | "until_deleted"
  | "pending_owner_approval"
  | "30_days"
  | "90_days"

export interface SavedConversationHistory {
  concept_type: "saved_conversation_history"
  conversationId: string
  userId: string
  projectId: string
  historyRetentionConsent: boolean
  retentionPolicy: RetentionPolicy
  messages: SavedHistoryMessage[]
  updatedAt: number
}

/**
 * Concept C: Saved Project Memory
 * Project-specific knowledge explicitly confirmed or pinned by the student/teacher.
 * Prevents dumping raw noisy chat transcripts into project state.
 */
export interface ProjectMemoryFact {
  factId: string
  category: "hardware_config" | "mission_objective" | "student_note"
  key: string
  value: string
  confirmedByStudent: boolean
  savedAt: number
}

export interface SavedProjectMemory {
  concept_type: "saved_project_memory"
  projectId: string
  userId: string
  pinnedRevisionHash?: string
  facts: ProjectMemoryFact[]
  lastModifiedAt: number
}

/**
 * Concept D: User Preferences
 * Student preferences that control language, explanation depth, and accessibility.
 * Logically separated from messages and project state.
 */
export interface UserPreferences {
  concept_type: "user_preferences"
  userId: string
  preferredLanguage: TutorLanguage | "auto"
  preferredDepth: ExplanationDepth
  gradeBand?: "elementary" | "middle_school" | "high_school" | "college" | "general"
  highContrastUi?: boolean
  updatedAt: number
}

// ============================================================================
// 2. Interaction & Feedback Event Contracts
// ============================================================================

export type FeedbackReasonCode =
  | "wrong_wiring"
  | "factual_error"
  | "unclear_explanation"
  | "wrong_language"
  | "incomplete_answer"
  | "hazardous_circuit"
  | "other"

export const ALLOWED_FEEDBACK_REASONS: readonly FeedbackReasonCode[] = [
  "wrong_wiring",
  "factual_error",
  "unclear_explanation",
  "wrong_language",
  "incomplete_answer",
  "hazardous_circuit",
  "other",
] as const

export interface TutorFeedbackEvent {
  schema_version: "pixiu-tutor-feedback-v1"
  feedbackId: string
  interactionEventId: string
  conversationId: string
  userId: string
  rating: "thumbs_up" | "thumbs_down"
  reasonCode?: FeedbackReasonCode
  comment?: string
  timestamp: number
  /** Invariant: Submitting feedback does NOT grant training consent */
  trainingConsentGranted: false
}

export interface TutorInteractionEvent {
  schema_version: "pixiu-tutor-event-v1"
  eventId: string
  conversationId: string
  messageId: string
  userId: string
  projectId: string
  timestamp: number

  // User input
  userPrompt: string
  baseRevisionHash?: string

  // Output & Resolution
  tutorResponse: PixiuTutorResponseV1
  language: TutorLanguage
  depth: ExplanationDepth

  // Provenance & Versioning
  modelAdapterId: string
  promptVersion: string
  responseSchemaVersion: "pixiu-tutor-response-v1"

  // Storage & Consent flags
  historyRetentionConsent: boolean
  trainingCandidateConsent: boolean
  retentionPolicy: RetentionPolicy
}

// ============================================================================
// 3. User Privacy, Export & Deletion Contracts
// ============================================================================

export type DeletionScope =
  | "conversation_history"
  | "project_memory"
  | "learning_candidates"
  | "all_student_data"

export interface DataDeletionRequest {
  schema_version: "pixiu-privacy-deletion-v1"
  requestId: string
  userId: string
  projectId?: string
  targetScope: DeletionScope
  requestedAt: number
  status: "pending" | "processed" | "verified"
  affectedRecordTypes: string[]
  auditLogId: string
}

export interface DataExportRequest {
  schema_version: "pixiu-privacy-export-v1"
  requestId: string
  userId: string
  format: "json" | "csv"
  requestedAt: number
  status: "ready" | "expired"
  downloadUrl?: string
  expiresAt: number
}

// ============================================================================
// Factory Helpers & Validators
// ============================================================================

export function createTutorInteractionEvent(params: {
  conversationId: string
  messageId: string
  userId: string
  projectId: string
  userPrompt: string
  baseRevisionHash?: string
  tutorResponse: PixiuTutorResponseV1
  modelAdapterId: string
  promptVersion: string
  historyRetentionConsent?: boolean
  trainingCandidateConsent?: boolean
  retentionPolicy?: RetentionPolicy
}): TutorInteractionEvent {
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
    retentionPolicy: params.retentionPolicy ?? "pending_owner_approval",
  }
}

export function createTutorFeedbackEvent(params: {
  interactionEventId: string
  conversationId: string
  userId: string
  rating: "thumbs_up" | "thumbs_down"
  reasonCode?: FeedbackReasonCode
  comment?: string
}): TutorFeedbackEvent {
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
    trainingConsentGranted: false, // Strict default: feedback does not grant training rights
  }
}

export function createDataDeletionRequest(params: {
  userId: string
  projectId?: string
  targetScope: DeletionScope
}): DataDeletionRequest {
  return {
    schema_version: "pixiu-privacy-deletion-v1",
    requestId: `del-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: params.userId,
    projectId: params.projectId,
    targetScope: params.targetScope,
    requestedAt: Date.now(),
    status: "pending",
    affectedRecordTypes: [params.targetScope],
    auditLogId: `audit-del-${Date.now()}`,
  }
}
