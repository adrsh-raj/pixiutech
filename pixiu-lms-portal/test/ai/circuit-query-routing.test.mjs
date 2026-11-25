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
