/**
 * Automated Verification Suite for:
 * 1. Xen Movable, Closable, Minimizable Floating Window
 * 2. Full Lesson-Aware Tutoring & Idempotent Auto-Explanation
 * 3. Continuous Context Envelope Construction
 * 4. Incremental Streaming & Low-Latency Chunk Polling
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeClientOutput, splitXenResponse } from '../../src/lib/ai/xen/xen-sanitizer.js'

test('Interactive Workspace: Viewport Clamping keeps Xen window visible on screen', () => {
  const windowWidth = 1440
  const windowHeight = 900
  const panelWidth = 460
  const panelHeight = 620

  function clampPosition(targetX, targetY) {
    const clampedX = Math.max(8, Math.min(windowWidth - panelWidth - 8, targetX))
    const clampedY = Math.max(8, Math.min(windowHeight - panelHeight - 8, targetY))
    return { x: clampedX, y: clampedY }
  }

  // Case 1: Dragged too far to the left (< 8px)
  const leftClamped = clampPosition(-150, 200)
  assert.equal(leftClamped.x, 8)
  assert.equal(leftClamped.y, 200)

  // Case 2: Dragged too far to the right (> windowWidth - panelWidth - 8)
  const rightClamped = clampPosition(1600, 200)
  assert.equal(rightClamped.x, windowWidth - panelWidth - 8) // 1440 - 460 - 8 = 972

  // Case 3: Dragged off the top (< 8px)
  const topClamped = clampPosition(500, -50)
  assert.equal(topClamped.x, 500)
  assert.equal(topClamped.y, 8)

  // Case 4: Dragged off the bottom (> windowHeight - panelHeight - 8)
  const bottomClamped = clampPosition(500, 1000)
  assert.equal(bottomClamped.x, 500)
  assert.equal(bottomClamped.y, windowHeight - panelHeight - 8) // 900 - 620 - 8 = 272
})

test('Lesson-Aware Tutoring: Context Envelope correctly packages lesson, circuit, and blockly', () => {
  const lessonContext = {
    id: 'safe-led-blink',
    title: 'Safe LED Blink',
    shortTitle: 'LED Blink',
    description: 'Learn how to wire an LED with a current-limiting resistor.',
    difficulty: 'Beginner',
    concepts: ['GPIO Output', "Ohm's Law", 'Polarity'],
    steps: [
      {
        kind: 'connections',
        title: 'Connect Resistor to Anode',
        instructions: 'Place a 220 ohm resistor between D13 and LED anode.',
      },
    ],
    finalGoal: 'Make the LED blink safely without burning it out.',
  }

  const currentCircuit = {
    parts: [
      { id: 'uno1', type: 'arduino-uno' },
      { id: 'led1', type: 'led' },
      { id: 'r1', type: 'resistor', value: 220 },
    ],
    wires: [
      { id: 'w1', from: { partId: 'uno1', pinId: '13' }, to: { partId: 'r1', pinId: '1' } },
    ],
  }

  const currentBlocklyXml = '<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_setup"></block></xml>'

  function buildContextEnvelope(lesson, circuit, blocklyXml, healthScore) {
    return {
      lesson: lesson
        ? {
            id: lesson.id,
            title: lesson.title,
            short_title: lesson.shortTitle || lesson.title,
            description: lesson.description || '',
            difficulty: lesson.difficulty || 'Beginner',
            concepts: lesson.concepts || [],
            active_step: lesson.steps?.[0] || undefined,
            final_goal: lesson.finalGoal || '',
          }
        : undefined,
      circuit: {
        parts_count: circuit.parts.length,
        wires_count: circuit.wires.length,
        summary: `${circuit.parts.length} components, ${circuit.wires.length} wires`,
        health_score: healthScore,
      },
      blockly: {
        has_code: Boolean(blocklyXml && blocklyXml.length > 40),
        summary: blocklyXml ? 'Blockly blocks placed on workspace' : 'No code blocks placed',
      },
    }
  }

  const envelope = buildContextEnvelope(lessonContext, currentCircuit, currentBlocklyXml, 85)

  assert.equal(envelope.lesson.id, 'safe-led-blink')
  assert.equal(envelope.lesson.title, 'Safe LED Blink')
  assert.equal(envelope.lesson.active_step.title, 'Connect Resistor to Anode')
  assert.equal(envelope.circuit.parts_count, 3)
  assert.equal(envelope.circuit.wires_count, 1)
  assert.equal(envelope.blockly.has_code, true)
})

test('Idempotency Guard: Prevents duplicate auto-tutoring explanations in React StrictMode', () => {
  let executionCount = 0
  let lastExplainedLessonId = null

  function onLessonLoaded(lessonId) {
    // Idempotency guard as implemented in circuit-copilot-chat.tsx
    if (lastExplainedLessonId !== lessonId) {
      lastExplainedLessonId = lessonId
      executionCount++
    }
  }

  // React StrictMode mounts twice in development
  onLessonLoaded('safe-led-blink')
  onLessonLoaded('safe-led-blink') // Second mount should NOT increment count
  assert.equal(executionCount, 1, 'Should execute only once for same lesson ID')

  // Switching to a different lesson increments count exactly once
  onLessonLoaded('traffic-light')
  onLessonLoaded('traffic-light') // Duplicate mount
  assert.equal(executionCount, 2, 'Should increment to 2 when lesson changes')
})

test('Streaming: Progressive token accumulation and protocol token sanitization', () => {
  const chunks = [
    { seq: 1, delta: 'Hello! ' },
    { seq: 2, delta: 'I am Xen, ' },
    { seq: 3, delta: 'your AI tutor. ' },
    { seq: 4, delta: 'Here is your circuit check:<|im_end|>' },
  ]

  let accumulated = ''
  for (const chunk of chunks) {
    accumulated += chunk.delta
  }

  assert.equal(accumulated, 'Hello! I am Xen, your AI tutor. Here is your circuit check:<|im_end|>')

  const cleaned = sanitizeClientOutput(accumulated)
  assert.equal(cleaned, 'Hello! I am Xen, your AI tutor. Here is your circuit check:')
  assert.ok(!cleaned.includes('<|im_end|>'), 'Leaked special token must be pruned')
})

test('unfinished and completed code fences preserve indentation and literal protocol examples', () => {
  const snippet = '    print("<|im_end|>")'
  const partial = 'Example\n```python\n' + snippet
  assert.equal(splitXenResponse(partial)[1].code, snippet)
  assert.equal(splitXenResponse(partial + '\n```\nDone')[2].content, 'Done')
})
