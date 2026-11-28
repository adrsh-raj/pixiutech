import test from 'node:test';
import assert from 'node:assert/strict';
import { isCircuitSpecificQuery } from '../../src/lib/ai/xen/circuit-query-classifier.js';

test('1. "BHAI KINETIC ENERFY AK FORMULA" is routed as general Physics (not circuit)', () => {
  assert.equal(isCircuitSpecificQuery("BHAI KINETIC ENERFY AK FORMULA"), false);
});

test('2. "KITNETIC ENERGY" is routed as general Physics (not circuit)', () => {
  assert.equal(isCircuitSpecificQuery("KITNETIC ENERGY"), false);
});

test('3. "What is kinetic energy?" is routed as general Physics', () => {
  assert.equal(isCircuitSpecificQuery("What is kinetic energy?"), false);
});

test('4. "Explain Newton\'s second law." is routed as general Physics', () => {
  assert.equal(isCircuitSpecificQuery("Explain Newton's second law."), false);
  assert.equal(isCircuitSpecificQuery("Newton ka dusra niyam kya hai bhai"), false);
});

test('5. "Why is my LED not glowing?" is routed as circuit diagnosis', () => {
  assert.equal(isCircuitSpecificQuery("Why is my LED not glowing?"), true);
  assert.equal(isCircuitSpecificQuery("LED glow nahi ho rahi check karo"), true);
});

test('6. "Can you inspect my screen and circuit?" is routed as circuit inspection', () => {
  assert.equal(isCircuitSpecificQuery("Can you inspect my screen and circuit?"), true);
  assert.equal(isCircuitSpecificQuery("Can you see my screen?"), true);
  assert.equal(isCircuitSpecificQuery("Mera circuit check karo bhai"), true);
});

test('7. "Arduino D13 pin is not working." is routed as circuit/code diagnosis', () => {
  assert.equal(isCircuitSpecificQuery("Arduino D13 pin is not working."), true);
  assert.equal(isCircuitSpecificQuery("Why is Arduino pin D13 not working?"), true);
});

test('8. Multi-turn Physics continuity preserves academic routing', () => {
  const physicsHistory = [
    { role: 'user', content: 'BHAI KINETIC ENERFY AK FORMULA' },
    { role: 'assistant', content: '**Kinetic Energy**\n\n$$KE = \\frac{1}{2}mv^2$$\n\nwhere $m$ is mass and $v$ is velocity.' },
  ];
  assert.equal(isCircuitSpecificQuery("what is m here?", physicsHistory), false);
  assert.equal(isCircuitSpecificQuery("units kya hai bhai", physicsHistory), false);
  assert.equal(isCircuitSpecificQuery("explain velocity", physicsHistory), false);
});

test('9. Multi-turn Circuit continuity preserves circuit diagnosis routing', () => {
  const circuitHistory = [
    { role: 'user', content: 'Why is my LED not glowing?' },
    { role: 'assistant', content: 'The cathode (-) of led1 is not connected to Arduino GND.' },
  ];
  assert.equal(isCircuitSpecificQuery("how to fix it", circuitHistory), true);
  assert.equal(isCircuitSpecificQuery("which pin should I connect?", circuitHistory), true);
});

test('10. Small talk & casual greetings are isolated from circuit context even right after circuit turns', () => {
  const circuitHistory = [
    { role: 'user', text: 'Why is LED1 not glowing?' },
    { role: 'assistant', text: 'The cathode (-) of led1 is not connected to Arduino GND.' },
  ];
  for (const msg of ['Hi Xen', 'Hello!', 'How are you bro?', 'Hey Xen, how are you', 'Thank you', 'Thanks a lot', 'Okay thanks', 'Who are you?', 'Bye']) {
    assert.equal(isCircuitSpecificQuery(msg, circuitHistory), false, `Small talk "${msg}" must not route as circuit`);
    assert.equal(isCircuitSpecificQuery(msg, [], { hasActiveCircuit: true }), false, `Small talk "${msg}" with active circuit must not route as circuit`);
  }
  assert.equal(isCircuitSpecificQuery("What is Ohm's Law?", circuitHistory), false);
  assert.equal(isCircuitSpecificQuery("Why does LED1 need a resistor for Ohm's Law?", circuitHistory), true);
});

test('11. Workspace building & completion follow-ups route to circuit inside CyberLab', () => {
  assert.equal(isCircuitSpecificQuery('What are we building?', []), true);
  assert.equal(isCircuitSpecificQuery('done', [], { hasActiveCircuit: true }), true);
  assert.equal(isCircuitSpecificQuery('fixed it', [], { hasActiveCircuit: true }), true);
  assert.equal(isCircuitSpecificQuery('done', []), false);
});

test('follow-ups use a circuit user turn, never assistant keywords or message length alone', () => {
  const userHistory = [
    { role: 'user', content: 'Check my LED wiring' },
    { role: 'assistant', content: 'The cathode is open. Would you like me to check it again?' },
  ];
  const assistantOnly = [{ role: 'assistant', content: 'Your resistor wiring and circuit pins.' }];
  for (const prompt of ['hi', 'hello', 'how are you?', 'how are you bro?', 'thanks', 'what is kinetic energy?', 'what is a resistor?', 'tell me a joke']) {
    assert.equal(isCircuitSpecificQuery(prompt, userHistory, { inCyberLab: true }), false, prompt);
  }
  for (const prompt of ['done', 'can you check?', 'is it correct?', 'which Arduino pin?', 'hi, check my LED wiring']) {
    assert.equal(isCircuitSpecificQuery(prompt, userHistory, { inCyberLab: true }), true, prompt);
  }
  assert.equal(isCircuitSpecificQuery('can you check?', assistantOnly, { inCyberLab: true }), false);
  assert.equal(isCircuitSpecificQuery('which Arduino pin?', [], { inCyberLab: true }), false);
  assert.equal(isCircuitSpecificQuery('okay', userHistory), true, 'an explicit inspection offer can be accepted');
  assert.equal(isCircuitSpecificQuery('okay', assistantOnly), false);
});
