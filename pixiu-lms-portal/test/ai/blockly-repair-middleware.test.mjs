import test from 'node:test'
import assert from 'node:assert/strict'
import {
  repairBlocklyXml,
  wrapCopilotPrompt,
  VERIFIED_BLOCK_ALIASES,
  UNKNOWN_UNSUPPORTED_BLOCKS,
} from '../../src/lib/ai/copilot/blockly-repair-middleware.js'

test('Blockly Repair Middleware Suite', async (t) => {
  await t.test('Case 1: Clean well-formed XML with Google namespace passes untouched', () => {
    const input = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" id="ROOT" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
    </statement>
  </block>
</xml>`
    const res = repairBlocklyXml(input)
    assert.equal(res.success, true)
    assert.equal(res.isHealed, false)
    assert.equal(res.unsupportedBlocks.length, 0)
    assert.ok(res.repairedXml.includes('xmlns="https://developers.google.com/blockly/xml"'))
  })

  await t.test('Case 2: Heals truncated XML (token cut-off before </xml>)', () => {
    const truncated = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" id="ROOT">
    <statement name="LOOP">
      <block type="io_digitalwrite">
        <field name="PIN">12</field>
        <field name="STATE">LOW</field>
        <next>` // Truncated mid-stream
    const res = repairBlocklyXml(truncated)
    assert.equal(res.success, true)
    assert.equal(res.isHealed, true)
    assert.ok(res.repairedXml.endsWith('</xml>'))
    assert.ok(res.actions.includes('HEALED_TRUNCATED_TAGS'))
  })

  await t.test('Case 3: Injects Google standard XML namespace if missing', () => {
    const bare = `<xml><block type="arduino_program"></block></xml>`
    const res = repairBlocklyXml(bare)
    assert.equal(res.success, true)
    assert.ok(res.repairedXml.includes('xmlns="https://developers.google.com/blockly/xml"'))
    assert.ok(res.actions.includes('INJECTED_GOOGLE_XML_NAMESPACE'))
  })

  await t.test('Case 4: Normalizes verified block aliases', () => {
    const withAliases = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program">
    <statement name="LOOP">
      <block type="pir_motion_detected"><field name="PIN">7</field></block>
      <block type="lcd_setup"><field name="ADDR">0x27</field></block>
      <block type="actuator_servo_write"><field name="PIN">9</field></block>
    </statement>
  </block>
</xml>`
    const res = repairBlocklyXml(withAliases)
    assert.equal(res.success, true)
    assert.ok(res.repairedXml.includes('type="pir_motion"'))
    assert.ok(res.repairedXml.includes('type="lcd_clear"'))
    assert.ok(res.repairedXml.includes('type="servo_write"'))
  })

  await t.test('Case 5: Safely rejects unsupported peripherals', () => {
    const unsupported = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program">
    <statement name="LOOP">
      <block type="max6675_read"><field name="CS">10</field></block>
    </statement>
  </block>
</xml>`
    const res = repairBlocklyXml(unsupported)
    assert.equal(res.success, false)
    assert.deepEqual(res.unsupportedBlocks, ['max6675_read'])
    assert.ok(res.error.includes('Unsupported peripheral blocks detected'))
  })

  await t.test('Case 6: Idempotency — running repair twice preserves exact output', () => {
    const input = `<xml><block type="pir_motion_detected"><field name="PIN">7</field></block></xml>`
    const run1 = repairBlocklyXml(input)
    const run2 = repairBlocklyXml(run1.repairedXml)
    assert.equal(run1.repairedXml, run2.repairedXml)
  })

  await t.test('Case 7: Prompt wrapping applies pedagogical and safety guardrails', () => {
    const mathPrompt = wrapCopilotPrompt('Solve 2x + 4 = 10', { domain: 'math' })
    assert.ok(mathPrompt.includes('PEDAGOGICAL GUARDRAIL'))
    assert.ok(mathPrompt.includes('diagnostic guiding question'))

    const motorPrompt = wrapCopilotPrompt('Drive DC motor at pin 9', { domain: 'circuit', hasInductiveLoad: true })
    assert.ok(motorPrompt.includes('HARDWARE SAFETY GUARDRAIL'))
    assert.ok(motorPrompt.includes('1N4007 flyback protection diode'))
  })
})
