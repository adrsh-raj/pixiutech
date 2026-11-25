/**
 * Multi-Turn Affirmative Continuation Detector for 8square / Xen Copilot.
 *
 * Detects affirmative user responses (e.g. "yes", "yeah", "yep", "sure", "ok",
 * "okay", "do it", "haan", "kar do", "bilkul", "go ahead") across English,
 * Hinglish, and colloquial conversational forms.
 *
 * When affirmative intent is detected, inspects the previous assistant message
 * for offered actions (LaTeX formatting, circuit diagnosis, code generation,
 * explanation) and produces an affirmativeAction descriptor so the assistant
 * executes immediately without repeating the offer.
 */

const AFFIRMATIVE_REGEX = /^(yes|yeah|yep|yup|sure|sure thing|ok|okay|do it|haan|ha|kar do|kardo|bilkul|go ahead|proceed|definitely|absolutely|theek hai|thik hai)(\s+(please|pls|bhai|yaar|ji|karo|kar do|kar dijiye))?[.!?]*$/i;
const PREFIX_REGEX = /^(please\s+|pls\s+)?(do it|proceed|go ahead)(\s+please|\s+pls)?[.!?]*$/i;

export function isAffirmativeResponse(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return AFFIRMATIVE_REGEX.test(trimmed) || PREFIX_REGEX.test(trimmed);
}

export function extractOfferedAction(assistantText) {
  if (!assistantText || typeof assistantText !== 'string') {
    return {
      actionType: 'general_continuation',
      action: 'execute_offered_action',
      description: 'Continue with the next step or recommended action',
      previousOffer: '',
    };
  }

  const text = assistantText.toLowerCase();

  // 1. LaTeX formatting / mathematical equations
  if (
    /latex|formula|equation|mathematical|math\b|derivation|ohm'?s law formula|\$\$.*?\$\$|\$.*?\$/i.test(
      assistantText
    ) ||
    /would you like (to see|me to show|a formula)/i.test(text)
  ) {
    return {
      actionType: 'latex_formatting',
      action: 'show_latex_formula',
      description: 'Display formal LaTeX formula, mathematical derivation, and calculations',
      previousOffer: assistantText.slice(-300).trim(),
    };
  }

  // 2. Code generation (Arduino sketch, Blockly, C++, Python)
  if (
    /code|sketch|arduino|blockly|c\+\+|program\b|function\b|void setup/i.test(
      assistantText
    ) &&
    /write|generate|show|provide|create|code/i.test(text)
  ) {
    return {
      actionType: 'code_generation',
      action: 'generate_code',
      description: 'Generate complete, functional code for the circuit',
      previousOffer: assistantText.slice(-300).trim(),
    };
  }

  // 3. Circuit diagnosis / wiring repair
  if (
    /repair|fix|wiring|wire|connect|resistor|short circuit|pin\b|voltage|fault|component|burnout/i.test(
      assistantText
    )
  ) {
    return {
      actionType: 'circuit_diagnosis',
      action: 'execute_circuit_repair',
      description: 'Diagnose circuit fault and provide wiring repair instructions',
      previousOffer: assistantText.slice(-300).trim(),
    };
  }

  // 4. Pedagogical explanation / conceptual walkthrough
  if (/explain|explanation|detail|deep dive|step-by-step/i.test(assistantText)) {
    return {
      actionType: 'explanation',
      action: 'provide_explanation',
      description: 'Provide detailed step-by-step pedagogical explanation',
      previousOffer: assistantText.slice(-300).trim(),
    };
  }

  return {
    actionType: 'general_continuation',
    action: 'execute_offered_action',
    description: 'Execute the action offered in previous response',
    previousOffer: assistantText.slice(-300).trim(),
  };
}

export function detectAffirmativeContinuation(userPrompt, lastAssistantMessage) {
  if (!isAffirmativeResponse(userPrompt)) {
    return null;
  }

  const asstText =
    typeof lastAssistantMessage === 'string'
      ? lastAssistantMessage
      : lastAssistantMessage?.text || lastAssistantMessage?.content || '';

  const offered = extractOfferedAction(asstText);

  return {
    detected: true,
    userResponse: userPrompt.trim(),
    actionType: offered.actionType,
    action: offered.action,
    description: offered.description,
    previousOffer: offered.previousOffer,
    directive: `The user responded affirmatively ("${userPrompt.trim()}"). Execute the offered action (${offered.description}) IMMEDIATELY and deterministically without asking for confirmation again.`,
  };
}
