/**
 * PIXIU TECH CYBERLAB — PHASE 1E AI TUTOR & LEARNING-DATA FOUNDATION TESTS
 * 
 * Verifies all Phase 1E acceptance criteria:
 * 1. Bilingual Tutoring Response Contract (Proposals + Separate Explanations, Science Q&A, Truthfulness)
 * 2. Language & Teaching Behavior (English, Hinglish, Overrides, Depth, Grade-Aware Safety Preservation)
 * 3. Data Boundaries & Governance (5 Concepts, Consent Separation, State Machine Transitions, No Online Learning)
 * 4. Privacy & Deletion Semantics (Scoped Deletions, Audit Trails)
 * 
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const bundleDir = join(tmpdir(), `copilot-phase1e-tutor-test-${Date.now()}`)

await build({
  entryPoints: {
    tutor: new URL("../../src/lib/ai/copilot/tutor-response-contract.ts", import.meta.url).pathname,
    events: new URL("../../src/lib/ai/copilot/conversation-event-schema.ts", import.meta.url).pathname,
    lifecycle: new URL("../../src/lib/ai/copilot/learning-data-lifecycle.ts", import.meta.url).pathname,
    validator: new URL("../../src/lib/circuit-validator.ts", import.meta.url).pathname,
  },
  bundle: true,
  format: "esm",
  outdir: bundleDir,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const tutorMod = await import(`file://${join(bundleDir, "tutor.js")}`)
const eventsMod = await import(`file://${join(bundleDir, "events.js")}`)
const lifecycleMod = await import(`file://${join(bundleDir, "lifecycle.js")}`)
const validatorMod = await import(`file://${join(bundleDir, "validator.js")}`)

const {
  validateTutorResponse,
  detectPromptLanguage,
  resolveExplanationDepth,
  containsRoboticOpeningCliché,
} = tutorMod

const {
  createTutorInteractionEvent,
  createTutorFeedbackEvent,
  createDataDeletionRequest,
} = eventsMod

const {
  createLearningCandidateFromEvent,
  transitionCandidateState,
  triggerOnlineModelWeightUpdate,
  scrubPii,
  detectPotentialIdentityLeakage,
  isLearningDataIntakeEnabled,
  DEFAULT_LEARNING_DATA_INTAKE_CONFIG,
  intakeLearningCandidate,
  ALLOWED_LIFECYCLE_STATES,
} = lifecycleMod

const { validateProposedCircuit } = validatorMod

// ============================================================================
// GROUP 1: RESPONSE CONTRACT & TRUTHFULNESS
// ============================================================================

test("P1E-1: Tutor response can return both a structured circuit proposal and a separate explanation", () => {
  const payload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "build_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "middle_school",
    direct_answer: "Here is a safe LED blink circuit for Arduino Uno with a current-limiting resistor.",
    circuit_proposal: {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "led_control",
      summary: "Arduino Uno D13 LED Blink",
      assumptions: ["Standard 5mm Red LED", "220Ω resistor"],
      needs_clarification: [],
      proposal: {
        circuit: {
          parts: [
            { id: "uno", type: "arduino-uno", x: 50, y: 50, rotation: 0, props: {} },
            { id: "led1", type: "led", x: 150, y: 50, rotation: 0, props: {} },
            { id: "r1", type: "resistor", x: 250, y: 50, rotation: 0, props: { resistance: 220 } },
          ],
          wires: [
            { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "led1", pinId: "anode" } },
            { id: "w2", from: { partId: "led1", pinId: "cathode" }, to: { partId: "r1", pinId: "a" } },
            { id: "w3", from: { partId: "r1", pinId: "b" }, to: { partId: "uno", pinId: "gnd" } },
          ],
        },
        code: null,
        explanation: "D13 toggles HIGH and LOW while 220Ω limits current to ~15mA.",
      },
      capabilities: {
        simulation: "supported",
        compilation: "not_tested",
        physical_hardware: "not_verified",
      },
    },
    component_roles: [
      { partId: "uno", role: "Microcontroller", whyNeeded: "Generates digital HIGH/LOW control signal on D13" },
      { partId: "r1", role: "Current Limiter", whyNeeded: "Protects LED from burning out due to excessive current" },
      { partId: "led1", role: "Visual Indicator", whyNeeded: "Emits light when current passes forward" },
    ],
    operating_sequence: [
      "Pin D13 goes HIGH (5V relative to GND).",
      "Current flows through the LED anode to cathode.",
      "The 220Ω resistor limits the current to safe operating limits (~15mA).",
      "Current returns through the GND rail to complete the loop.",
    ],
    code_logic_walkthrough: {
      summary: "Digital write blink loop with 1-second delay intervals",
      steps: [
        "Configure pin 13 as OUTPUT mode.",
        "Set pin 13 HIGH, wait 1000ms.",
        "Set pin 13 LOW, wait 1000ms.",
      ],
      language: "cpp",
    },
    science_concept: {
      title: "Ohm's Law & Current Limitation",
      explanation: "Current is directly proportional to voltage and inversely proportional to resistance (I = V / R).",
      formulas: [
        { name: "Ohm's Law", formula: "I = (V_supply - V_forward) / R", units: "Amperes (A)", assumptions: "V_forward ≈ 2.0V for Red LED" },
      ],
      common_misconceptions: [
        "An LED can be directly connected to 5V without a resistor (FALSE: will burn out within seconds).",
      ],
    },
    evidence_status: {
      circuit_validation: {
        status: "passed",
        validator_version: "1.0.0",
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        truth: "verified_by_validator",
      },
      simulation: {
        status: "not_run",
        truth: "not_tested",
      },
      compilation: {
        status: "not_run",
        truth: "not_tested",
      },
      knowledge_source: {
        status: "curriculum_grounded",
        source_reference: "Pixiu Lesson 1: Basic LED Blink",
        truth: "retrieved_source",
      },
    },
    assumptions_and_limitations: ["Assumes 5V logic board with 2.0V forward LED drop."],
    safety_notes: ["Never connect an LED directly between 5V and GND without a series resistor."],
    next_question_or_action: "Would you like to preview this on the breadboard or adjust the blink frequency?",
  }

  const result = validateTutorResponse(payload)
  assert.equal(result.valid, true, `Validation failed: ${result.errors.join(", ")}`)
  assert.ok(result.response !== null)
  assert.equal(result.response.component_roles.length, 3)
})

test("P1E-1: Priority 3 Regression — Tutor response contract accepts static-rule-inference matching telemetry truth source", () => {
  const telemetryTruthPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "explain_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "middle_school",
    direct_answer: "Based on static topology, resistor R1 is connected in series with the LED.",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: null,
    evidence_status: {
      circuit_validation: {
        status: "not_applicable",
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        truth: "static-rule-inference", // Hyphenated directly from circuit-telemetry.ts!
      },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "inferred", truth: "inferred" },
    },
    assumptions_and_limitations: [],
    safety_notes: ["Standard lab safety."],
    next_question_or_action: null,
  }

  const result = validateTutorResponse(telemetryTruthPayload)
  assert.equal(result.valid, true, `Validation failed: ${result.errors.join(", ")}`)
  assert.equal(result.response?.evidence_status.circuit_validation.truth, "static-rule-inference")
})

test("P1E-1: Science-only question does NOT require a circuit proposal", () => {
  const scienceOnlyPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "science_question",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "high_school",
    direct_answer: "Ohm's Law describes the relationship between voltage, current, and resistance in an electrical circuit.",
    circuit_proposal: null, // NO CIRCUIT PROPOSAL
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: {
      title: "Ohm's Law",
      explanation: "The current through a conductor between two points is directly proportional to the voltage across the two points.",
      formulas: [
        { name: "Ohm's Law", formula: "V = I * R", units: "Volts (V)", assumptions: "Constant temperature conductor" },
      ],
      common_misconceptions: [
        "Resistance increases when voltage increases (FALSE: resistance is an intrinsic property of the component).",
      ],
    },
    evidence_status: {
      circuit_validation: {
        status: "not_applicable",
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        truth: "not_tested",
      },
      simulation: {
        status: "not_run",
        truth: "not_tested",
      },
      compilation: {
        status: "not_run",
        truth: "not_tested",
      },
      knowledge_source: {
        status: "curriculum_grounded",
        source_reference: "Pixiu Physics Curriculum: Section 3",
        truth: "retrieved_source",
      },
    },
    assumptions_and_limitations: ["Applies to ohmic conductors under steady-state conditions."],
    safety_notes: ["High voltages (>30V) pose severe electrical shock hazards; always use low-voltage lab benches."],
    next_question_or_action: "Would you like to calculate the resistance required for a specific current?",
  }

  const result = validateTutorResponse(scienceOnlyPayload)
  assert.equal(result.valid, true, `Expected valid response: ${result.errors.join(", ")}`)
  assert.equal(result.response?.circuit_proposal, null)
})

test("P1E-1: Critical Truthfulness — Rejected circuit CANNOT be labeled safe or verified_by_validator", () => {
  // Build a dangerous dead short circuit
  const deadShortCircuit = {
    parts: [{ id: "uno", type: "arduino-uno", x: 0, y: 0, rotation: 0, props: {} }],
    wires: [{ id: "w_short", from: { partId: "uno", pinId: "5v" }, to: { partId: "uno", pinId: "gnd" } }],
  }
  const realValidatorResult = validateProposedCircuit(deadShortCircuit)
  assert.equal(realValidatorResult.valid, false, "Live validator must reject dead short")

  // Untrusted response attempting to lie that the circuit passed
  const lyingTutorPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "build_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "middle_school",
    direct_answer: "Here is your power circuit.",
    circuit_proposal: {
      schema_version: "pixiu-copilot-proposal-v1",
      task_type: "led_control",
      summary: "Short circuit proposal",
      assumptions: [],
      needs_clarification: [],
      proposal: {
        circuit: deadShortCircuit,
        code: null,
        explanation: "Short circuit",
      },
      capabilities: { simulation: "not_tested", compilation: "not_tested", physical_hardware: "not_verified" },
    },
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: null,
    evidence_status: {
      circuit_validation: {
        status: "passed", // LIE!
        truth: "verified_by_validator", // LIE!
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
      },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "inferred", truth: "inferred" },
    },
    assumptions_and_limitations: [],
    safety_notes: [],
    next_question_or_action: null,
  }

  const check = validateTutorResponse(lyingTutorPayload, { validatorResult: realValidatorResult })
  assert.equal(check.valid, false, "Must reject lying validation claim")
  assert.ok(
    check.errors.some(e => /circuit failed validator but evidence claims status 'passed'/i.test(e)),
    "Must catch validator status lie"
  )
  assert.ok(
    check.errors.some(e => /rejected circuit cannot be labeled 'verified_by_validator'/i.test(e)),
    "Must catch truth label lie"
  )
})

test("P1E-1: Critical Truthfulness — Fabricated simulation claims without tests are strictly rejected", () => {
  const fabricatedSimPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "science_question",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "quick",
    grade_band: "general",
    direct_answer: "This simulates 15mA through the diode.",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: null,
    evidence_status: {
      circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
      simulation: {
        status: "not_run", // NOT RUN!
        truth: "simulated", // FABRICATED!
      },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "inferred", truth: "inferred" },
    },
    assumptions_and_limitations: [],
    safety_notes: ["Low-voltage lab safe."],
    next_question_or_action: null,
  }

  const result = validateTutorResponse(fabricatedSimPayload)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => /simulation\.status is 'not_run' but truth claims 'simulated'/i.test(e)))
})

test("P1E-1: Response validator strictly rejects malformed schema or unexpected fields", () => {
  const invalidPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "invalid_intent_xyz", // INVALID INTENT
    unknown_hack_field: "injected", // UNEXPECTED ROOT FIELD
  }

  const result = validateTutorResponse(invalidPayload)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some(e => /Unexpected root field.*unknown_hack_field/i.test(e)))
  assert.ok(result.errors.some(e => /Invalid or missing intent/i.test(e)))
})

// ============================================================================
// GROUP 2: BILINGUAL BEHAVIOR & TEACHING PERSONA
// ============================================================================

test("P1E-2: Language detector selects English by default for English prompts", () => {
  const result = detectPromptLanguage("Can you show me how to wire a buzzer with an ultrasonic sensor?")
  assert.equal(result.language, "english")
  assert.equal(result.isOverride, false)
})

test("P1E-2: Language detector detects Hinglish for Romanized Hindi prompts", () => {
  const result1 = detectPromptLanguage("bhai LED ko resistor ke sath kaise jodein taaki bulb kharaab na ho?")
  assert.equal(result1.language, "hinglish")
  assert.equal(result1.isOverride, false)

  const result2 = detectPromptLanguage("servo motor ko arduino se jodna hai, kaun sa pin lagayein?")
  assert.equal(result2.language, "hinglish")
  assert.equal(result2.isOverride, false)
})

test("P1E-2: Explicit language override strictly takes precedence over prompt detection", () => {
  // English text overridden to Hinglish
  const resHinglish = detectPromptLanguage("Please explain how the potentiometer controls the servo.", "hinglish")
  assert.equal(resHinglish.language, "hinglish")
  assert.equal(resHinglish.isOverride, true)

  // Hinglish text overridden to English
  const resEnglish = detectPromptLanguage("bhai resistor kyun lagana padta hai?", "english")
  assert.equal(resEnglish.language, "english")
  assert.equal(resEnglish.isOverride, true)
})

test("P1E-2: Explanation depth resolution supports quick, student, and deep_dive modes", () => {
  assert.equal(resolveExplanationDepth("quick"), "quick")
  assert.equal(resolveExplanationDepth("student"), "student")
  assert.equal(resolveExplanationDepth("deep_dive"), "deep_dive")
  assert.equal(resolveExplanationDepth("random_invalid"), "student") // Safe default
})

test("P1E-2: Grade-aware explanation MUST NEVER omit safety notes even for elementary band", () => {
  const elementaryResponse = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "explain_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "quick",
    grade_band: "elementary",
    direct_answer: "The resistor protects the tiny LED bulb so it doesn't get too hot and pop!",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: null,
    evidence_status: {
      circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "curriculum_grounded", truth: "retrieved_source" },
    },
    assumptions_and_limitations: ["Uses low-voltage 5V lab power."],
    safety_notes: [
      "Always ask a teacher before plugging in power. Never short-circuit wires together.",
    ],
    next_question_or_action: "Do you want to see what happens when we change the color?",
  }

  const result = validateTutorResponse(elementaryResponse)
  assert.equal(result.valid, true)
  assert.ok(result.response?.safety_notes.length > 0, "Safety notes must be present even in elementary mode")
})

test("P1E-2: Robotic cliché detector catches generic non-teacher openings", () => {
  assert.equal(containsRoboticOpeningCliché("Certainly! Here is your circuit."), true)
  assert.equal(containsRoboticOpeningCliché("Great question! Let me explain."), true)
  assert.equal(containsRoboticOpeningCliché("Absolutely! We can wire that."), true)
  assert.equal(containsRoboticOpeningCliché("To blink an LED, let's start by understanding why a resistor is needed."), false)
  assert.equal(containsRoboticOpeningCliché("LED ko safe rakhne ke liye pehle 220 ohm ka resistor lagate hain."), false)
})

// ============================================================================
// GROUP 3: DATA BOUNDARIES, PRIVACY & GOVERNANCE STATE MACHINE
// ============================================================================

test("P1E-3: The 5 core concepts are distinguishable and cannot be conflated", () => {
  const sessionCtx = {
    concept_type: "session_context",
    sessionId: "sess-1",
    activeTab: "circuit",
    selectedPartIds: ["led1"],
    activeBoard: "arduino-uno",
    recentTokenEstimate: 140,
    ephemeralScratchPad: {},
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  }

  const savedHistory = {
    concept_type: "saved_conversation_history",
    conversationId: "conv-1",
    userId: "usr-42",
    projectId: "proj-99",
    historyRetentionConsent: true,
    retentionPolicy: "30_days",
    messages: [],
    updatedAt: Date.now(),
  }

  const projectMemory = {
    concept_type: "saved_project_memory",
    projectId: "proj-99",
    userId: "usr-42",
    facts: [
      {
        factId: "f-1",
        category: "hardware_config",
        key: "board",
        value: "arduino-uno",
        confirmedByStudent: true,
        savedAt: Date.now(),
      },
    ],
    lastModifiedAt: Date.now(),
  }

  const preferences = {
    concept_type: "user_preferences",
    userId: "usr-42",
    preferredLanguage: "hinglish",
    preferredDepth: "student",
    updatedAt: Date.now(),
  }

  assert.equal(sessionCtx.concept_type, "session_context")
  assert.equal(savedHistory.concept_type, "saved_conversation_history")
  assert.equal(projectMemory.concept_type, "saved_project_memory")
  assert.equal(preferences.concept_type, "user_preferences")
  assert.notEqual(sessionCtx.concept_type, savedHistory.concept_type)
  assert.notEqual(savedHistory.concept_type, projectMemory.concept_type)
})

test("P1E-3: Storing conversation history DOES NOT imply consent for model training", () => {
  const event = createTutorInteractionEvent({
    conversationId: "conv-101",
    messageId: "msg-1",
    userId: "student-1",
    projectId: "project-alpha",
    userPrompt: "How do I connect the buzzer?",
    tutorResponse: {
      schema_version: "pixiu-tutor-response-v1",
      intent: "explain_circuit",
      language: "english",
      language_detected: "english",
      language_override_applied: false,
      depth: "student",
      grade_band: "middle_school",
      direct_answer: "Connect the positive pin of the buzzer to digital pin D8 and negative to GND.",
      circuit_proposal: null,
      component_roles: [],
      operating_sequence: [],
      code_logic_walkthrough: null,
      science_concept: null,
      evidence_status: {
        circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
        simulation: { status: "not_run", truth: "not_tested" },
        compilation: { status: "not_run", truth: "not_tested" },
        knowledge_source: { status: "inferred", truth: "inferred" },
      },
      assumptions_and_limitations: [],
      safety_notes: ["Buzzer polarity matters: inverted polarity may silence the buzzer."],
      next_question_or_action: null,
    },
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    historyRetentionConsent: true, // User consents to history retention
    trainingCandidateConsent: false, // User DOES NOT consent to training!
  })

  assert.equal(event.historyRetentionConsent, true)
  assert.equal(event.trainingCandidateConsent, false)

  // Create learning candidate record
  const candidate = createLearningCandidateFromEvent(event)
  assert.equal(candidate.state, "INTERACTION_OCCURRED")

  // Transition to SESSION_HANDLED
  const step1 = transitionCandidateState(candidate, "SESSION_HANDLED")
  assert.equal(step1.success, true)

  // Attempt transition to TRAINING_CONSENT_VERIFIED must FAIL and route to REJECTED_INELIGIBLE
  const step2 = transitionCandidateState(candidate, "TRAINING_CONSENT_VERIFIED")
  assert.equal(step2.success, false)
  assert.equal(step2.currentState, "REJECTED_INELIGIBLE")
  assert.equal(candidate.rejectionReason, "REJECTED_MISSING_EXPLICIT_TRAINING_CONSENT")
})

test("P1E-3: Feedback submission strictly DOES NOT grant training consent", () => {
  const feedback = createTutorFeedbackEvent({
    interactionEventId: "evt-123",
    conversationId: "conv-101",
    userId: "student-1",
    rating: "thumbs_up",
    comment: "This helped me solve the lab mission!",
  })

  assert.equal(feedback.trainingConsentGranted, false, "Feedback event must never grant implicit training rights")
})

test("P1E-3: Candidate CANNOT bypass human review to enter approved dataset", () => {
  const event = createTutorInteractionEvent({
    conversationId: "conv-999",
    messageId: "msg-2",
    userId: "student-2",
    projectId: "project-beta",
    userPrompt: "Sample prompt",
    tutorResponse: {
      schema_version: "pixiu-tutor-response-v1",
      intent: "science_question",
      language: "english",
      language_detected: "english",
      language_override_applied: false,
      depth: "student",
      grade_band: "high_school",
      direct_answer: "Sample answer",
      circuit_proposal: null,
      component_roles: [],
      operating_sequence: [],
      code_logic_walkthrough: null,
      science_concept: null,
      evidence_status: {
        circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
        simulation: { status: "not_run", truth: "not_tested" },
        compilation: { status: "not_run", truth: "not_tested" },
        knowledge_source: { status: "inferred", truth: "inferred" },
      },
      assumptions_and_limitations: [],
      safety_notes: ["Lab safety notes."],
      next_question_or_action: null,
    },
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    trainingCandidateConsent: true,
  })

  const candidate = createLearningCandidateFromEvent(event)
  transitionCandidateState(candidate, "SESSION_HANDLED")
  // Fabricated caller-supplied consent record strictly FAILS CLOSED
  const consentResult = transitionCandidateState(candidate, "TRAINING_CONSENT_VERIFIED", {
    authoritativeConsentRecord: {
      consentId: "mock-consent-p1e",
      subjectId: "student-p1e",
      consentType: "learning_data_research_and_benchmarking",
      grantedAtUtc: new Date().toISOString(),
      policyVersion: "v1.0",
      verificationStatus: "VERIFIED_ACTIVE",
      authorityProvider: "district_portal_mock",
    },
  })
  assert.equal(consentResult.success, false, "Fabricated consent record must fail closed")
  assert.equal(candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(candidate.rejectionReason, "REJECTED_UNVERIFIED_CONSENT_AUTHORITY")

  // 1. Attempting to enqueue via pre-filled redactionResult while intake is disabled strictly FAILS CLOSED
  const redactCandidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-redact-mock",
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const queueResult = transitionCandidateState(redactCandidate, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: true,
      redactedPrompt: "Clean prompt",
      redactedResponseSummary: "Clean summary",
      piiDetected: false,
      piiTypes: [],
    },
  })
  assert.equal(queueResult.success, false, "Pre-filled redactionResult bypass must be blocked when intake is disabled")
  assert.equal(redactCandidate.state, "REJECTED_INELIGIBLE")
  assert.equal(redactCandidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(redactCandidate.redaction, null)

  // 2. Direct state-transition attempt to HUMAN_REVIEW_PENDING while intake is disabled strictly FAILS CLOSED
  const queuedCand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-queued-mock",
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "CANDIDATE_QUEUED",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: {
      isRedacted: true,
      redactedPrompt: "Clean prompt",
      redactedResponseSummary: "Clean summary",
      piiDetected: false,
      piiTypes: [],
    },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const reviewResult = transitionCandidateState(queuedCand, "HUMAN_REVIEW_PENDING")
  assert.equal(reviewResult.success, false, "Direct transition to HUMAN_REVIEW_PENDING must fail while intake is disabled")
  assert.equal(queuedCand.state, "REJECTED_INELIGIBLE")
  assert.equal(queuedCand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(queuedCand.redaction, null)

  // 3. Human review bypass protection: Candidate in HUMAN_REVIEW_PENDING cannot approve WITHOUT human signature
  const reviewCand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-review-mock",
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: {
      isRedacted: true,
      redactedPrompt: "Clean prompt",
      redactedResponseSummary: "Clean summary",
      piiDetected: false,
      piiTypes: [],
    },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const badApproval = transitionCandidateState(reviewCand, "APPROVED_FOR_DATASET")
  assert.equal(badApproval.success, false)
  assert.equal(reviewCand.state, "REJECTED_INELIGIBLE")
  assert.equal(reviewCand.rejectionReason, "REJECTED_MISSING_OR_INVALID_HUMAN_SIGNATURE")
})

test("P1E-3: Priority 1 Regression — Forged reviewer signature without authoritative verifier strictly FAILS CLOSED", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-forge-test",
    sourceEventId: "evt-f",
    sourceConversationId: "conv-f",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Caller attempts to forge a human approval string without an authoritative verifier
  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "aditya-lead-mentor-forged-string",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "electrical_validity",
      evidenceNotes: "Attempted unverified bypass",
    },
    // No trusted verifier supplied!
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_AUTHORITATIVE_VERIFIER_UNAVAILABLE")
  assert.ok(/No authoritative reviewer-verification integration available/i.test(result.error || ""))
})

test("P1E-3: Priority 1 Regression — Reviewer signature with automated bot label strictly FAILS CLOSED", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-auto-bot",
    sourceEventId: "evt-ab",
    sourceConversationId: "conv-ab",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "system-qa-bot-verifier",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "pedagogical_clarity",
      evidenceNotes: "Automated test label",
    },
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_AUTOMATED_REVIEWER_LABEL")
})

test("P1E-3: Security Hardening — Supplied mock verifier cannot approve candidate through production API (fails closed)", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-verified",
    sourceEventId: "evt-v",
    sourceConversationId: "conv-v",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const authoritativeVerifier = (sig) => {
    if (sig.reviewerId === "dr-sharma-curriculum-lead") {
      return { verified: true }
    }
    return { verified: false, failureReason: "UNAUTHORIZED_REVIEWER" }
  }

  // Attempt 1: Supplying reviewerVerifier in context fails closed
  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "dr-sharma-curriculum-lead",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "pedagogical_clarity",
      evidenceNotes: "Verified textbook pedagogical compliance.",
    },
    reviewerVerifier: authoritativeVerifier,
  })

  assert.equal(result.success, false, "Caller-supplied verifier callback must fail closed")
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_CALLER_INJECTED_VERIFIER_FORBIDDEN")

  // Attempt 2: Passing __testOnly_mockAuthorization fails closed
  const cand2 = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-verified-2",
    sourceEventId: "evt-v2",
    sourceConversationId: "conv-v2",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result2 = transitionCandidateState(cand2, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "dr-sharma-curriculum-lead",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "pedagogical_clarity",
      evidenceNotes: "Verified textbook pedagogical compliance.",
    },
    __testOnly_mockAuthorization: {
      isUnitTestMock: true,
      mockVerifier: authoritativeVerifier,
    },
  })

  assert.equal(result2.success, false, "Passing __testOnly_mockAuthorization must fail closed")
  assert.equal(cand2.state, "REJECTED_INELIGIBLE")
  assert.equal(cand2.rejectionReason, "REJECTED_CALLER_INJECTED_VERIFIER_FORBIDDEN")
})

test("P1E-3: Priority 2 Regression — Redaction strictly rejects raw student PII even if caller claims isRedacted: true", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-pii-leak",
    sourceEventId: "evt-pii",
    sourceConversationId: "conv-pii",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Caller claims isRedacted: true, but passes unredacted student email and phone
  const leakResult = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: true,
      redactedPrompt: "Hi my name is Rohan, email rohan@school.edu and call me at 9876543210",
      redactedResponseSummary: "uncleaned",
      piiDetected: true,
      piiTypes: ["email", "phone"],
    },
  })

  assert.equal(leakResult.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
  assert.ok(/Raw PII detected in redactedPrompt payload/i.test(leakResult.error || ""))
})

test("P1E-3: Priority 2 Regression — Redaction performs real scrubbing of email and phone from raw prompt", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-real-scrub",
    sourceEventId: "evt-rs",
    sourceConversationId: "conv-rs",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "Student query from priya@delhischool.edu (phone: 9812345678): How do I connect the ultrasonic sensor?"
  
  // 1. Standalone scrubber scrubs structured PII
  const scrubResult = scrubPii(raw)
  assert.equal(scrubResult.isFullyScrubbed, true)
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_EMAIL]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_PHONE]"))
  assert.ok(!scrubResult.sanitizedText.includes("priya@delhischool.edu"))
  assert.ok(!scrubResult.sanitizedText.includes("9812345678"))
  assert.ok(scrubResult.detectedPiiTypes.includes("email"))
  assert.ok(scrubResult.detectedPiiTypes.includes("phone"))

  // 2. State machine candidate intake is disabled by default for raw free-text prompts
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    rawPrompt: raw,
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
})

test("P1E-3: Privacy Hardening — Redaction scrubs student names, schools, classes, student IDs, and government IDs", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-full-scrub",
    sourceEventId: "evt-fs",
    sourceConversationId: "conv-fs",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "I am Priya Patel from Class 8B at Delhi Public School with roll no: 23, aadhaar 2345 6789 0123, and secret bearer abcdef1234567890xyz. How to connect LED?"

  // 1. Standalone scrubber verifies all identifier patterns
  const scrubResult = scrubPii(raw)
  assert.equal(scrubResult.isFullyScrubbed, true)
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_STUDENT_NAME]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_CLASS]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_SCHOOL]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_STUDENT_ID]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_GOV_ID]"))
  assert.ok(scrubResult.sanitizedText.includes("[REDACTED_SECRET]"))
  assert.ok(!scrubResult.sanitizedText.includes("Priya Patel"))
  assert.ok(!scrubResult.sanitizedText.includes("Delhi Public School"))
  assert.ok(!scrubResult.sanitizedText.includes("2345 6789 0123"))
  assert.ok(!scrubResult.sanitizedText.includes("abcdef1234567890xyz"))

  // 2. Candidate intake fails closed by default for raw free-text prompts
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })
  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
})

test("P1E-3: Privacy Hardening — Uncertain student identity markers fail closed", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-uncertain-pii",
    sourceEventId: "evt-unc",
    sourceConversationId: "conv-unc",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "hello my name is unknown_student and my school is greenwood, please help with circuit."
  
  // 1. Leakage detector identifies uncertainty markers
  const identityCheck = detectPotentialIdentityLeakage(raw)
  assert.equal(identityCheck.hasPotentialIdentity, true)

  // 2. State machine candidate intake fails closed by default
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
  assert.ok(!result.error?.includes("unknown_student"))
  assert.ok(!result.error?.includes("greenwood"))
})

test("P1E-3: Privacy Hardening — Adversarial caller falsely claiming isRedacted: true with school and student ID strictly fails closed", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-adv-bypass",
    sourceEventId: "evt-adv",
    sourceConversationId: "conv-adv",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: true,
      redactedPrompt: "Student from Kendriya Vidyalaya with roll number 45 asks why servo is shaking",
      redactedResponseSummary: "claimed_clean",
      piiDetected: false,
      piiTypes: [],
    },
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
  assert.ok(/Raw PII detected in redactedPrompt payload/i.test(result.error || ""))
  assert.ok(!result.error?.includes("Kendriya Vidyalaya"))
  assert.ok(!result.error?.includes("roll number 45"))
})

test("P1E-3: Privacy Hardening — Normal tutoring succeeds independently when training candidate is rejected", () => {
  // A student prompt containing uncertain personal data asking a physics/circuit question
  const studentPrompt = "hello my name is unknown_student and my school is greenwood, why is my LED burning out on 5V?"

  // 1. Normal tutoring response contract validates the teacher's educational answer
  const tutorPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "explain_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "middle_school",
    direct_answer: "Your LED is burning out because 5V exceeds its forward voltage without a current-limiting resistor.",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: {
      title: "Ohm's Law",
      explanation: "Current through a conductor is proportional to voltage.",
      formulas: [{ name: "Ohm's Law", formula: "I = V/R", units: "A" }],
      common_misconceptions: ["LEDs limit their own current"],
    },
    evidence_status: {
      circuit_validation: { status: "not_applicable", truth: "not_tested" },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "curriculum_grounded", source_reference: "Lesson 1", truth: "retrieved_source" },
    },
    assumptions_and_limitations: ["Assumes 2.0V red LED forward drop"],
    safety_notes: ["Always place a series resistor (e.g. 220Ω) with LEDs on 5V."],
    next_question_or_action: "Would you like to calculate the exact resistor needed?",
  }

  const tutorValidation = validateTutorResponse(tutorPayload)
  assert.equal(tutorValidation.valid, true, "Normal tutoring response must validate cleanly")
  assert.ok(tutorValidation.response !== null)

  // 2. Downstream learning candidate fails closed due to unscrubbed or rejected student PII
  const candidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-tutoring-sep",
    sourceEventId: "evt-sep",
    sourceConversationId: "conv-sep",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: false, // E.g., student opted out or PII was detected
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Attempting to enqueue without consent fails closed
  const enqueueResult = transitionCandidateState(candidate, "CANDIDATE_QUEUED", {
    rawPrompt: studentPrompt,
  })
  // Candidate is safely blocked from entering dataset
  assert.equal(enqueueResult.success, false)
  assert.equal(candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(candidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(candidate.redaction, null)
  assert.ok(!("rawPrompt" in candidate))

  // Crucial invariant: The student still received their full pedagogical explanation above!
  assert.equal(tutorValidation.response.direct_answer.includes("burning out"), true)
})

test("P1E-3: Privacy Regression — Free-text names in natural sentences fail closed (Aarav Sharma told Rahul)", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-sentence-names",
    sourceEventId: "evt-sn",
    sourceConversationId: "conv-sn",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "Aarav Sharma told Rahul that his Arduino LED stopped working."
  
  // 1. Leakage detector identifies unrecognized proper nouns
  const identityCheck = detectPotentialIdentityLeakage(raw)
  assert.equal(identityCheck.hasPotentialIdentity, true)

  // 2. State machine candidate intake fails closed by default
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
  assert.ok(!result.error?.includes("Aarav Sharma"))
  assert.ok(!result.error?.includes("Rahul"))
})

test("P1E-3: Privacy Regression — Lowercase names and unfamiliar school names fail closed", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-lower-unfamiliar",
    sourceEventId: "evt-lu",
    sourceConversationId: "conv-lu",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "rohan from greenwood says the buzzer is quiet."
  
  // 1. Leakage detector identifies informal school reference
  const identityCheck = detectPotentialIdentityLeakage(raw)
  assert.equal(identityCheck.hasPotentialIdentity, true)

  // 2. State machine candidate intake fails closed by default
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
  assert.ok(!result.error?.includes("rohan"))
  assert.ok(!result.error?.includes("greenwood"))
})

test("P1E-3: Privacy Regression — Informal student IDs fail closed", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-informal-id",
    sourceEventId: "evt-ii",
    sourceConversationId: "conv-ii",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "my id is 4021 and my roll is 12, why is the servo shaking?"
  
  // 1. Leakage detector identifies student ID reference
  const identityCheck = detectPotentialIdentityLeakage(raw)
  assert.equal(identityCheck.hasPotentialIdentity, true)

  // 2. State machine candidate intake fails closed by default
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
  assert.ok(!result.error?.includes("4021"))
  assert.ok(!result.error?.includes("12"))
})

test("P1E-3: Privacy Conservative Invariant — Raw free-text prompt intake is strictly blocked by default even for clean questions", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-clean-electronics",
    sourceEventId: "evt-ce",
    sourceConversationId: "conv-ce",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const raw = "Why does the LED need a current-limiting resistor with Arduino Uno?"
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: raw })

  // Free-text intake is strictly disabled by default: raw free-text must NOT enter review queue
  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
})

test("P1E-3: Privacy Regression — Prompt rejected for learning data while normal tutoring succeeds completely (Aarav Sharma told Rahul)", () => {
  const studentPrompt = "Aarav Sharma told Rahul that his Arduino LED stopped working."

  // 1. Normal tutoring response contract validates the teacher's educational answer
  const tutorPayload = {
    schema_version: "pixiu-tutor-response-v1",
    intent: "diagnose",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "middle_school",
    direct_answer: "If the LED stopped working, check three common failure points: check polarity (long leg to positive), ensure a 220Ω resistor is present, and verify pin 13 is configured as OUTPUT in setup().",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: {
      title: "LED Polarity & Diode Conduction",
      explanation: "LEDs only conduct current in the forward direction from anode to cathode.",
      formulas: [],
      common_misconceptions: ["LEDs work in either direction like resistors"],
    },
    evidence_status: {
      circuit_validation: { status: "not_applicable", truth: "not_tested" },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "curriculum_grounded", source_reference: "Lesson 1", truth: "retrieved_source" },
    },
    assumptions_and_limitations: ["Assumes red LED on 5V pin with series resistor"],
    safety_notes: ["Never connect an LED directly across 5V and GND."],
    next_question_or_action: "Would you like to test the LED polarity or check your code?",
  }

  const tutorValidation = validateTutorResponse(tutorPayload)
  assert.equal(tutorValidation.valid, true, "Tutoring response must validate and succeed for the student")
  assert.ok(tutorValidation.response !== null)

  // 2. Downstream learning candidate fails closed due to free-text intake disabled
  const candidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-tutoring-success-names",
    sourceEventId: "evt-tsn",
    sourceConversationId: "conv-tsn",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(candidate, "CANDIDATE_QUEUED", {
    rawPrompt: studentPrompt,
  })

  // Candidate is safely blocked from entering dataset
  assert.equal(result.success, false)
  assert.equal(candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(candidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(candidate.redaction, null)
  assert.ok(!("rawPrompt" in candidate))
  assert.ok(!result.error?.includes("Aarav Sharma"))

  // Crucial invariant: The student was not blocked and received full pedagogical diagnosis!
  assert.equal(tutorValidation.response.direct_answer.includes("check polarity"), true)
})

test("P1E-3: Privacy Regression — Clean prompt paired with summary containing student name or ID strictly fails closed", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-dirty-summary",
    sourceEventId: "evt-ds",
    sourceConversationId: "conv-ds",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Clean prompt, but summary contains student name and student roll ID!
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: true,
      redactedPrompt: "Why does the LED need a current-limiting resistor with Arduino Uno?",
      redactedResponseSummary: "Student Aarav Sharma (roll: 12) asked why LED burned out",
      piiDetected: false,
      piiTypes: [],
    },
  })

  assert.equal(result.success, false, "Candidate must fail closed when response summary contains student PII")
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
  assert.equal(cand.redaction, null, "No redaction payload may be attached to rejected candidate")
  assert.ok(/Raw PII or identifiable student data detected in redactedResponseSummary/i.test(result.error || ""))
  assert.ok(!result.error?.includes("Aarav Sharma"), "Error message must never leak student name")
  assert.ok(!result.error?.includes("12"), "Error message must never leak student roll number")
})

test("P1E-3: Privacy Regression — Forged isRedacted: true payload with raw PII and false piiDetected fails closed and overrides caller claims", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-forged-pii-flags",
    sourceEventId: "evt-fpii",
    sourceConversationId: "conv-fpii",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Adversary supplies raw bearer token and phone, claiming isRedacted: true and piiDetected: false
  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: true,
      redactedPrompt: "Use bearer secret_tok_1234567890abcdef and call 9876543210 to test LED",
      redactedResponseSummary: "claimed_clean",
      piiDetected: false, // Forged
      piiTypes: [],       // Forged
    },
  })

  assert.equal(result.success, false, "Must not trust caller isRedacted or piiDetected flags")
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
  assert.equal(cand.redaction, null)
  assert.ok(/Raw PII detected in redactedPrompt payload/i.test(result.error || ""))
  assert.ok(!result.error?.includes("secret_tok_1234567890abcdef"))
  assert.ok(!result.error?.includes("9876543210"))
})

test("P1E-3: Privacy Regression — Reviewer evidence notes containing student PII fails closed on dataset approval", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-reviewer-pii",
    sourceEventId: "evt-rpii",
    sourceConversationId: "conv-rpii",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: {
      isRedacted: true,
      redactedPrompt: "Why does the LED need a current-limiting resistor with Arduino Uno?",
      redactedResponseSummary: "clean",
      piiDetected: false,
      piiTypes: [],
    },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "lead-curriculum-reviewer-1",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "electrical_validity",
      evidenceNotes: "Student Aarav Sharma (roll 12) tested this and verified 220 ohm works.", // Contains PII!
    },
  })

  assert.equal(result.success, false, "Dataset approval must fail closed if reviewer evidence notes leak student PII")
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
  assert.ok(/Raw PII or identifiable student data detected in reviewer evidence notes/i.test(result.error || ""))
  assert.ok(!result.error?.includes("Aarav Sharma"))
})

test("P1E-3: Priority 3 Negative Test — Transition fails closed when policyPassed is false", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-pol-fail",
    sourceEventId: "evt-pf",
    sourceConversationId: "conv-pf",
    state: "TRAINING_CONSENT_VERIFIED",
    trainingConsentGranted: true,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "POLICY_AND_RIGHTS_EVALUATED", { policyPassed: false })
  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_FAILED_POLICY_CHECK")
})

test("P1E-3: Priority 3 Negative Test — Transition fails closed when isRedacted is explicitly false", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-redact-false",
    sourceEventId: "evt-rf",
    sourceConversationId: "conv-rf",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "CANDIDATE_QUEUED", {
    redactionResult: {
      isRedacted: false,
      redactedPrompt: "Prompt",
      redactedResponseSummary: "Summary",
      piiDetected: false,
      piiTypes: [],
    },
  })
  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNREDACTED_PII")
})

test("P1E-3: Priority 3 Negative Test — Terminal sink invariant: candidate in REJECTED_INELIGIBLE cannot transition anywhere", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-terminal",
    sourceEventId: "evt-t",
    sourceConversationId: "conv-t",
    state: "REJECTED_INELIGIBLE",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "SESSION_HANDLED")
  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.ok(/Illegal state transition from REJECTED_INELIGIBLE/i.test(result.error || ""))
})

test("P1E-3: Priority 3 Negative Test — Illegal skip transition: candidate cannot jump from INTERACTION_OCCURRED directly to APPROVED_FOR_DATASET", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-skip",
    sourceEventId: "evt-s",
    sourceConversationId: "conv-s",
    state: "INTERACTION_OCCURRED",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET")
  assert.equal(result.success, false)
  assert.equal(cand.state, "INTERACTION_OCCURRED")
})

test("P1E-3: Priority 3 Negative Test — Release transition fails when datasetVersion is missing", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-rel-fail",
    sourceEventId: "evt-rf2",
    sourceConversationId: "conv-rf2",
    state: "APPROVED_FOR_DATASET",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: { reviewerId: "dr-sharma", reviewedAtUtc: new Date().toISOString(), decision: "APPROVED", reviewCategory: "pedagogical_clarity", evidenceNotes: "ok" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const result = transitionCandidateState(cand, "VERSIONED_DATASET_RELEASED", { datasetVersion: "" })
  assert.equal(result.success, false)
  assert.equal(cand.state, "APPROVED_FOR_DATASET")
})

test("P1E-3: Architectural Invariant — Online model weight update from raw chat is strictly blocked", () => {
  assert.throws(
    () => {
      triggerOnlineModelWeightUpdate()
    },
    {
      name: "Error",
      message: /GOVERNANCE VIOLATION: Online learning or automatic model weight updates from raw chats is strictly prohibited/i,
    }
  )
})

test("P1E-4: Priority 3 Regression — Default retention policy is explicitly pending_owner_approval, not silent 30_days", () => {
  const event = createTutorInteractionEvent({
    conversationId: "conv-ret-test",
    messageId: "msg-ret",
    userId: "usr-ret",
    projectId: "proj-ret",
    userPrompt: "Sample prompt",
    tutorResponse: {
      schema_version: "pixiu-tutor-response-v1",
      intent: "science_question",
      language: "english",
      language_detected: "english",
      language_override_applied: false,
      depth: "student",
      grade_band: "general",
      direct_answer: "Sample answer",
      circuit_proposal: null,
      component_roles: [],
      operating_sequence: [],
      code_logic_walkthrough: null,
      science_concept: null,
      evidence_status: {
        circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
        simulation: { status: "not_run", truth: "not_tested" },
        compilation: { status: "not_run", truth: "not_tested" },
        knowledge_source: { status: "inferred", truth: "inferred" },
      },
      assumptions_and_limitations: [],
      safety_notes: ["Safety note"],
      next_question_or_action: null,
    },
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    // No retentionPolicy specified
  })

  assert.equal(event.retentionPolicy, "pending_owner_approval")
})

test("P1E-4: Privacy Deletion Request generates verifiable audit records", () => {
  const delReq = createDataDeletionRequest({
    userId: "student-to-delete-123",
    projectId: "project-456",
    targetScope: "learning_candidates",
  })

  assert.equal(delReq.schema_version, "pixiu-privacy-deletion-v1")
  assert.equal(delReq.targetScope, "learning_candidates")
  assert.equal(delReq.status, "pending")
  assert.ok(delReq.auditLogId.startsWith("audit-del-"))
})

test("P1E-3: Security Hardening — Forged caller boolean trainingConsent: true strictly FAILS CLOSED", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-forge-consent",
    sourceEventId: "evt-fc",
    sourceConversationId: "conv-fc",
    state: "SESSION_HANDLED",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Caller attempts to establish consent by supplying boolean trainingConsent: true without authoritative consent record
  const result = transitionCandidateState(cand, "TRAINING_CONSENT_VERIFIED", {
    trainingConsent: true,
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_CALLER_CONTROLLED_CONSENT_FORBIDDEN")
  assert.ok(/Raw caller-supplied boolean trainingConsent: true is prohibited/i.test(result.error || ""))
})

test("P1E-3: Security Hardening — Caller-injected reviewerVerifier function strictly FAILS CLOSED", () => {
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-injected-verifier",
    sourceEventId: "evt-iv",
    sourceConversationId: "conv-iv",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // Caller attempts to establish authorization by injecting an inline verifier function returning true
  const result = transitionCandidateState(cand, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "arbitrary-caller-claimed-reviewer",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "electrical_validity",
      evidenceNotes: "Attempting arbitrary verifier injection",
    },
    reviewerVerifier: () => ({ verified: true }),
  })

  assert.equal(result.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_CALLER_INJECTED_VERIFIER_FORBIDDEN")
  assert.ok(/Caller-injected reviewerVerifier functions are strictly prohibited/i.test(result.error || ""))
})

test("P1E-3: Conservative Privacy Invariant — Learning-data intake is disabled by default across raw prompts while tutoring operates fully", () => {
  // 1. Verify default intake policy flag is disabled
  assert.equal(isLearningDataIntakeEnabled(), false, "Learning-data intake must be disabled by default")
  assert.equal(DEFAULT_LEARNING_DATA_INTAKE_CONFIG.freeTextIntakeEnabled, false)
  assert.equal(DEFAULT_LEARNING_DATA_INTAKE_CONFIG.defaultRejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")

  // 2. Normal tutoring interaction succeeds completely for a clean prompt
  const cleanPrompt = "How do I wire a servo motor with external power to Arduino Uno?"
  const tutorResp = validateTutorResponse({
    schema_version: "pixiu-tutor-response-v1",
    intent: "science_question",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "general",
    direct_answer: "Connect servo signal to pin 9, VCC to external 5V battery pack, and tie both external battery GND and Arduino GND together.",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: {
      title: "Common Ground Reference",
      explanation: "A common ground provides a shared 0V reference point between separate power supplies.",
      formulas: [],
      common_misconceptions: ["Separate power supplies do not need connected grounds (FALSE)."],
    },
    evidence_status: {
      circuit_validation: {
        status: "not_applicable",
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        truth: "not_tested",
      },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "inferred", truth: "inferred" },
    },
    assumptions_and_limitations: ["Assumes 5V standard hobby servo."],
    safety_notes: ["Always connect external power GND to Arduino GND for a common reference."],
    next_question_or_action: null,
  })
  assert.equal(tutorResp.valid, true, `Tutoring response contract must succeed: ${tutorResp.errors?.join(", ")}`)
  assert.ok(tutorResp.response.direct_answer.includes("external 5V"))

  // 3. Attempt candidate intake from this interaction
  const event = createTutorInteractionEvent({
    conversationId: "conv-intake-test",
    messageId: "msg-intake",
    userId: "student-safe-1",
    projectId: "proj-safe-1",
    userPrompt: cleanPrompt,
    tutorResponse: tutorResp.response,
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    trainingCandidateConsent: true,
  })

  // 4. Ingest candidate via intakeLearningCandidate
  const intakeResult = intakeLearningCandidate(event)
  assert.equal(intakeResult.accepted, false, "Candidate intake must be rejected by default")
  assert.equal(intakeResult.reasonCode, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(intakeResult.candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(intakeResult.candidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(intakeResult.candidate.redaction, null)
  assert.ok(!("rawPrompt" in intakeResult.candidate))
  assert.ok(!("userPrompt" in intakeResult.candidate))

  // 5. Direct state transition attempt with rawPrompt is strictly blocked from review queue
  const cand = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-direct-queue-attempt",
    sourceEventId: event.eventId,
    sourceConversationId: event.conversationId,
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const queueTransition = transitionCandidateState(cand, "CANDIDATE_QUEUED", { rawPrompt: cleanPrompt })
  assert.equal(queueTransition.success, false)
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(cand.redaction, null)
  assert.ok(!("rawPrompt" in cand))
})

test("P1E-3: Privacy Regression — Pre-filled clean redactionResult and direct review transitions fail closed under default disabled intake", () => {
  // Scenario 1: Intake is disabled by default
  assert.equal(isLearningDataIntakeEnabled(), false)

  // Scenario 2: Supplying pre-filled clean redactionResult cannot bypass disabled intake
  const candidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-bypass-probe-1",
    sourceEventId: "evt-bypass-1",
    sourceConversationId: "conv-bypass-1",
    state: "REDACTION_AND_MINIMIZATION",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const cleanPayload = {
    isRedacted: true,
    redactedPrompt: "Why does the LED need a current-limiting resistor?",
    redactedResponseSummary: "Explained current limiting resistor value calculation",
    piiDetected: false,
    piiTypes: [],
  }

  const queueResult = transitionCandidateState(candidate, "CANDIDATE_QUEUED", {
    redactionResult: cleanPayload,
  })

  assert.equal(queueResult.success, false, "Queue transition must fail under default intake policy")
  assert.equal(queueResult.currentState, "REJECTED_INELIGIBLE")
  assert.equal(candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(candidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(candidate.redaction, null, "No redaction metadata may persist on rejected candidate")
  assert.ok(!("rawPrompt" in candidate))

  // Scenario 3: Direct transition attempt to HUMAN_REVIEW_PENDING cannot bypass intake policy
  const queuedCandidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-bypass-probe-2",
    sourceEventId: "evt-bypass-2",
    sourceConversationId: "conv-bypass-2",
    state: "CANDIDATE_QUEUED",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: cleanPayload,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const reviewResult = transitionCandidateState(queuedCandidate, "HUMAN_REVIEW_PENDING")
  assert.equal(reviewResult.success, false, "Review queue transition must fail under default intake policy")
  assert.equal(reviewResult.currentState, "REJECTED_INELIGIBLE")
  assert.equal(queuedCandidate.state, "REJECTED_INELIGIBLE")
  assert.equal(queuedCandidate.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
  assert.equal(queuedCandidate.redaction, null)

  // Scenario 4: Normal tutoring remains completely independent and successful
  const tutorResp = validateTutorResponse({
    schema_version: "pixiu-tutor-response-v1",
    intent: "explain_circuit",
    language: "english",
    language_detected: "english",
    language_override_applied: false,
    depth: "student",
    grade_band: "general",
    direct_answer: "The resistor limits the electric current through the LED to prevent thermal burnout.",
    circuit_proposal: null,
    component_roles: [],
    operating_sequence: [],
    code_logic_walkthrough: null,
    science_concept: null,
    evidence_status: {
      circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
      simulation: { status: "not_run", truth: "not_tested" },
      compilation: { status: "not_run", truth: "not_tested" },
      knowledge_source: { status: "inferred", truth: "inferred" },
    },
    assumptions_and_limitations: [],
    safety_notes: ["Always calculate resistor value with Ohm's Law: (Vsource - Vf) / I."],
    next_question_or_action: null,
  })
  assert.equal(tutorResp.valid, true)
  assert.ok(tutorResp.response.direct_answer.includes("thermal burnout"))
})

test("P1E-3: Security Hardening — Policy immutability & rejection of fabricated states under disabled intake", () => {
  // 1. Attempting to mutate DEFAULT_LEARNING_DATA_INTAKE_CONFIG throws TypeError in strict mode and cannot change setting
  assert.throws(
    () => {
      // @ts-ignore
      DEFAULT_LEARNING_DATA_INTAKE_CONFIG.freeTextIntakeEnabled = true
    },
    { name: "TypeError" }
  )
  assert.equal(isLearningDataIntakeEnabled(), false, "Intake must remain strictly disabled")
  assert.equal(DEFAULT_LEARNING_DATA_INTAKE_CONFIG.freeTextIntakeEnabled, false)

  // 2. Fabricated candidate in HUMAN_REVIEW_PENDING cannot reach APPROVED_FOR_DATASET
  const candReview = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-fab-review",
    sourceEventId: "evt-fab-1",
    sourceConversationId: "conv-fab-1",
    state: "HUMAN_REVIEW_PENDING",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const approveResult = transitionCandidateState(candReview, "APPROVED_FOR_DATASET", {
    humanReviewSignature: {
      reviewerId: "real-mentor-aditya",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "electrical_validity",
      evidenceNotes: "Genuine review notes without PII",
    },
  })
  assert.equal(approveResult.success, false, "Dataset approval must fail closed")
  assert.equal(candReview.state, "REJECTED_INELIGIBLE")
  assert.equal(candReview.rejectionReason, "REJECTED_AUTHORITATIVE_VERIFIER_UNAVAILABLE")

  // 3. Fabricated candidate in APPROVED_FOR_DATASET cannot reach VERSIONED_DATASET_RELEASED under disabled intake
  const candApproved = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-fab-approved",
    sourceEventId: "evt-fab-2",
    sourceConversationId: "conv-fab-2",
    state: "APPROVED_FOR_DATASET",
    trainingConsentGranted: true,
    policyCheckPassed: true,
    redaction: { isRedacted: true, redactedPrompt: "clean", redactedResponseSummary: "clean", piiDetected: false, piiTypes: [] },
    humanReview: {
      reviewerId: "real-mentor-aditya",
      reviewedAtUtc: new Date().toISOString(),
      decision: "APPROVED",
      reviewCategory: "electrical_validity",
      evidenceNotes: "Notes",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const releaseResult = transitionCandidateState(candApproved, "VERSIONED_DATASET_RELEASED", {
    datasetVersion: "v1.0.0",
  })
  assert.equal(releaseResult.success, false, "Dataset release must fail closed under disabled intake")
  assert.equal(candApproved.state, "REJECTED_INELIGIBLE")
  assert.equal(candApproved.rejectionReason, "REJECTED_LEARNING_DATA_INTAKE_DISABLED")
})

test("P1E-3: Security Hardening — Fabricated consent record cannot establish authoritative consent", () => {
  const event = createTutorInteractionEvent({
    conversationId: "conv-consent-fab",
    messageId: "msg-cf",
    userId: "student-cf",
    projectId: "project-cf",
    userPrompt: "Clean electronics question about resistor.",
    tutorResponse: {
      schema_version: "pixiu-tutor-response-v1",
      intent: "explain_circuit",
      language: "english",
      language_detected: "english",
      language_override_applied: false,
      depth: "student",
      grade_band: "middle_school",
      direct_answer: "Use 220 ohm resistor for LED.",
      circuit_proposal: null,
      component_roles: [],
      operating_sequence: [],
      code_logic_walkthrough: null,
      science_concept: null,
      evidence_status: {
        circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
        simulation: { status: "not_run", truth: "not_tested" },
        compilation: { status: "not_run", truth: "not_tested" },
        knowledge_source: { status: "inferred", truth: "inferred" },
      },
      assumptions_and_limitations: [],
      safety_notes: ["Keep current low."],
      next_question_or_action: null,
    },
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    trainingCandidateConsent: true,
  })

  const cand = createLearningCandidateFromEvent(event)
  transitionCandidateState(cand, "SESSION_HANDLED")

  // Caller constructs an object claiming VERIFIED_ACTIVE
  const result = transitionCandidateState(cand, "TRAINING_CONSENT_VERIFIED", {
    authoritativeConsentRecord: {
      consentId: "forged-active-consent-id",
      subjectId: "student-cf",
      consentType: "learning_data_research_and_benchmarking",
      grantedAtUtc: new Date().toISOString(),
      policyVersion: "v1.0",
      verificationStatus: "VERIFIED_ACTIVE",
      authorityProvider: "caller_fabricated_district_authority",
    },
  })

  assert.equal(result.success, false, "Fabricated consent record must fail closed")
  assert.equal(cand.state, "REJECTED_INELIGIBLE")
  assert.equal(cand.rejectionReason, "REJECTED_UNVERIFIED_CONSENT_AUTHORITY")
  assert.equal(cand.trainingConsentGranted, false, "Consent grant must remain false")
})

test("P1E-3: Security Hardening — Caller-provided event consent cannot establish consent on candidate creation or intake", () => {
  const event = createTutorInteractionEvent({
    conversationId: "conv-caller-consent-check",
    messageId: "msg-ccc",
    userId: "student-ccc",
    projectId: "project-ccc",
    userPrompt: "How do I connect an LED with Uno?",
    tutorResponse: {
      schema_version: "pixiu-tutor-response-v1",
      intent: "explain_circuit",
      language: "english",
      language_detected: "english",
      language_override_applied: false,
      depth: "student",
      grade_band: "middle_school",
      direct_answer: "Connect LED anode to digital pin and cathode through 220 ohm resistor to GND.",
      circuit_proposal: null,
      component_roles: [],
      operating_sequence: [],
      code_logic_walkthrough: null,
      science_concept: null,
      evidence_status: {
        circuit_validation: { status: "not_applicable", issues_count: 0, critical_count: 0, warning_count: 0, truth: "not_tested" },
        simulation: { status: "not_run", truth: "not_tested" },
        compilation: { status: "not_run", truth: "not_tested" },
        knowledge_source: { status: "inferred", truth: "inferred" },
      },
      assumptions_and_limitations: [],
      safety_notes: ["Use a resistor."],
      next_question_or_action: null,
    },
    modelAdapterId: "deterministic-stub",
    promptVersion: "v1.0",
    trainingCandidateConsent: true, // Caller claims consent in event
  })

  // 1. Raw candidate creation must initialize trainingConsentGranted to false
  const rawCandidate = createLearningCandidateFromEvent(event)
  assert.equal(rawCandidate.trainingConsentGranted, false, "Raw candidate must initialize consent to false")
  assert.equal(rawCandidate.state, "INTERACTION_OCCURRED")

  // 2. High-level intake entry point must ensure rejected candidate has trainingConsentGranted === false
  const intakeResult = intakeLearningCandidate(event)
  assert.equal(intakeResult.accepted, false)
  assert.equal(intakeResult.candidate.state, "REJECTED_INELIGIBLE")
  assert.equal(intakeResult.candidate.trainingConsentGranted, false, "Rejected intake candidate must have consent false")
})

test("P1E-3: State Machine Robustness — Malformed or unknown candidate states fail safely without TypeError or state advancement", () => {
  const baseCandidate = {
    concept_type: "learning_data_candidate",
    candidateId: "cand-malformed-state-test",
    sourceEventId: "evt-mfs",
    sourceConversationId: "conv-mfs",
    trainingConsentGranted: false,
    policyCheckPassed: false,
    redaction: null,
    humanReview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  // 1. Unknown string state: never appears as a valid CandidateLifecycleState in previousState or currentState
  const candUnknown = { ...baseCandidate, state: "NON_EXISTENT_STATE_XYZ" }
  // @ts-ignore
  const resultUnknown = transitionCandidateState(candUnknown, "SESSION_HANDLED")
  assert.equal(resultUnknown.success, false, "Unknown state transition must fail safely")
  assert.equal(resultUnknown.previousState, "REJECTED_INELIGIBLE", "previousState must be valid CandidateLifecycleState")
  assert.equal(resultUnknown.currentState, "REJECTED_INELIGIBLE", "currentState must be valid CandidateLifecycleState")
  assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultUnknown.previousState), "previousState must belong to ALLOWED_LIFECYCLE_STATES")
  assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultUnknown.currentState), "currentState must belong to ALLOWED_LIFECYCLE_STATES")
  assert.notEqual(resultUnknown.previousState, "NON_EXISTENT_STATE_XYZ", "Unknown state string must NEVER appear in previousState")
  assert.notEqual(resultUnknown.currentState, "NON_EXISTENT_STATE_XYZ", "Unknown state string must NEVER appear in currentState")
  assert.notEqual(candUnknown.state, "SESSION_HANDLED", "Candidate state must not advance")
  assert.equal(candUnknown.state, "REJECTED_INELIGIBLE", "Candidate state safely sinks to REJECTED_INELIGIBLE")
  assert.ok(/Invalid or unknown candidate state/i.test(resultUnknown.error || ""))

  // 2. Prototype property names: must not pass as valid lifecycle states
  for (const protoKey of ["toString", "constructor", "__proto__", "valueOf"]) {
    const candProto = { ...baseCandidate, state: protoKey }
    // @ts-ignore
    const resultProto = transitionCandidateState(candProto, "SESSION_HANDLED")
    assert.equal(resultProto.success, false, `Prototype property '${protoKey}' must fail safely`)
    assert.equal(resultProto.previousState, "REJECTED_INELIGIBLE")
    assert.equal(resultProto.currentState, "REJECTED_INELIGIBLE")
    assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultProto.previousState))
    assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultProto.currentState))
    assert.notEqual(resultProto.previousState, protoKey)
    assert.notEqual(resultProto.currentState, protoKey)
    assert.notEqual(candProto.state, "SESSION_HANDLED")
  }

  // 3. Empty string state
  const candEmpty = { ...baseCandidate, state: "" }
  // @ts-ignore
  const resultEmpty = transitionCandidateState(candEmpty, "SESSION_HANDLED")
  assert.equal(resultEmpty.success, false, "empty string state must fail safely")
  assert.equal(resultEmpty.previousState, "REJECTED_INELIGIBLE")
  assert.equal(resultEmpty.currentState, "REJECTED_INELIGIBLE")
  assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultEmpty.previousState))
  assert.ok(ALLOWED_LIFECYCLE_STATES.includes(resultEmpty.currentState))
  assert.notEqual(candEmpty.state, "SESSION_HANDLED")

  // 4. Malformed candidate: null and undefined
  // @ts-ignore
  const resultNull = transitionCandidateState(null, "SESSION_HANDLED")
  assert.equal(resultNull.success, false, "null candidate must fail safely without throwing")
  assert.equal(resultNull.previousState, "REJECTED_INELIGIBLE")
  assert.equal(resultNull.currentState, "REJECTED_INELIGIBLE")
  assert.ok(resultNull.candidate && typeof resultNull.candidate === "object")
  assert.equal(resultNull.candidate.state, "REJECTED_INELIGIBLE")

  // @ts-ignore
  const resultUndefined = transitionCandidateState(undefined, "SESSION_HANDLED")
  assert.equal(resultUndefined.success, false, "undefined candidate must fail safely without throwing")
  assert.equal(resultUndefined.previousState, "REJECTED_INELIGIBLE")
  assert.equal(resultUndefined.currentState, "REJECTED_INELIGIBLE")
  assert.ok(resultUndefined.candidate && typeof resultUndefined.candidate === "object")

  // 5. Malformed candidate: non-object primitives
  for (const primitive of ["string-candidate", 12345, true, Symbol("test")]) {
    // @ts-ignore
    const resultPrim = transitionCandidateState(primitive, "SESSION_HANDLED")
    assert.equal(resultPrim.success, false, `Primitive candidate (${String(primitive)}) must fail safely`)
    assert.equal(resultPrim.previousState, "REJECTED_INELIGIBLE")
    assert.equal(resultPrim.currentState, "REJECTED_INELIGIBLE")
    assert.ok(resultPrim.candidate && typeof resultPrim.candidate === "object")
  }

  // 6. Frozen candidate with unknown state cannot throw TypeError
  const frozenCand = Object.freeze({ ...baseCandidate, state: "FROZEN_UNKNOWN_XYZ" })
  // @ts-ignore
  const resultFrozen = transitionCandidateState(frozenCand, "SESSION_HANDLED")
  assert.equal(resultFrozen.success, false, "Frozen candidate must fail safely without throwing")
  assert.equal(resultFrozen.previousState, "REJECTED_INELIGIBLE")
  assert.equal(resultFrozen.currentState, "REJECTED_INELIGIBLE")

  // 7. Unknown or malformed targetState
  const validCand = { ...baseCandidate, state: "INTERACTION_OCCURRED" }
  // @ts-ignore
  const resultBogusTarget = transitionCandidateState(validCand, "NON_EXISTENT_TARGET_STATE")
  assert.equal(resultBogusTarget.success, false, "Unknown targetState must fail safely")
  assert.equal(resultBogusTarget.previousState, "INTERACTION_OCCURRED")
  assert.equal(resultBogusTarget.currentState, "INTERACTION_OCCURRED")
  assert.notEqual(resultBogusTarget.currentState, "NON_EXISTENT_TARGET_STATE")
  assert.equal(validCand.state, "INTERACTION_OCCURRED", "Candidate state must not change on bogus targetState")
})




