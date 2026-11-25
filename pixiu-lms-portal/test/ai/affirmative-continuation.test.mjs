import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAffirmativeResponse,
  extractOfferedAction,
  detectAffirmativeContinuation,
} from '../../src/lib/ai/xen/affirmative-detector.js';

test('Affirmative Detection - detects core affirmative phrases', () => {
  const coreAffirmatives = [
    'yes',
    'yeah',
    'yep',
    'sure',
    'ok',
    'okay',
    'do it',
    'haan',
    'kar do',
    'bilkul',
    'go ahead',
  ];

  for (const phrase of coreAffirmatives) {
    assert.equal(
      isAffirmativeResponse(phrase),
      true,
      `Expected "${phrase}" to be recognized as affirmative`
    );
    assert.equal(
      isAffirmativeResponse(phrase.toUpperCase()),
      true,
      `Expected "${phrase.toUpperCase()}" to be recognized as affirmative`
    );
  }
});

test('Affirmative Detection - detects Hinglish and polite affirmative variations', () => {
  const variations = [
    'haan bhai',
    'kar do!',
    'bilkul bhai',
    'yes please',
    'sure thing',
    'do it please',
    'please do it',
    'pls do it',
    'go ahead please',
    'theek hai',
    'kardo',
  ];

  for (const phrase of variations) {
    assert.equal(
      isAffirmativeResponse(phrase),
      true,
      `Expected "${phrase}" to be recognized as affirmative`
    );
  }
});

test('Affirmative Detection - rejects non-affirmative queries', () => {
  const nonAffirmatives = [
    'No',
    'Explain Ohm law',
    'What is the resistance?',
    'Why is the LED not glowing?',
    'Replace resistor with 220 ohm',
    'disconnect wire 1',
  ];

  for (const phrase of nonAffirmatives) {
    assert.equal(
      isAffirmativeResponse(phrase),
      false,
      `Expected "${phrase}" NOT to be recognized as affirmative`
    );
  }
});

test('Offered Action Extraction - LaTeX formatting offer', () => {
  const asstMsg = "Would you like me to show the LaTeX formula and mathematical derivation for Ohm's law?";
  const action = extractOfferedAction(asstMsg);
  assert.equal(action.actionType, 'latex_formatting');
  assert.equal(action.action, 'show_latex_formula');
  assert.ok(action.description.includes('LaTeX'));
});

test('Offered Action Extraction - Circuit diagnosis & repair offer', () => {
  const asstMsg = "I see a wiring mistake with the LED without a series resistor. Shall I diagnose and fix the circuit wiring?";
  const action = extractOfferedAction(asstMsg);
  assert.equal(action.actionType, 'circuit_diagnosis');
  assert.equal(action.action, 'execute_circuit_repair');
  assert.ok(action.description.includes('wiring'));
});

test('Offered Action Extraction - Code generation offer', () => {
  const asstMsg = "Would you like me to write and generate the Arduino C++ sketch to blink this LED?";
  const action = extractOfferedAction(asstMsg);
  assert.equal(action.actionType, 'code_generation');
  assert.equal(action.action, 'generate_code');
  assert.ok(action.description.includes('code'));
});

test('detectAffirmativeContinuation - builds complete descriptor with directive', () => {
  const prevMsg = "Shall I inspect the connections and repair the circuit wiring?";
  const result = detectAffirmativeContinuation('kar do bhai', prevMsg);

  assert.ok(result);
  assert.equal(result.detected, true);
  assert.equal(result.userResponse, 'kar do bhai');
  assert.equal(result.actionType, 'circuit_diagnosis');
  assert.equal(result.action, 'execute_circuit_repair');
  assert.ok(result.directive.includes('IMMEDIATELY'));
  assert.ok(result.directive.includes('without asking'));
});
