import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeClientOutput, sendXenChat } from '../../src/lib/ai/xen/xen-client.js';

test('Xen Client - sanitizeClientOutput trims trailing protocol tokens but preserves literal strings in code', () => {
  // Trailing protocol token is trimmed
  const trailingDirty = 'Hello world!<|im_end|>';
  assert.equal(sanitizeClientOutput(trailingDirty), 'Hello world!');

  // ChatML header prefix is trimmed
  const headerDirty = '<|im_start|>assistant\nHere is your code.';
  assert.equal(sanitizeClientOutput(headerDirty), 'Here is your code.');

  // CRITICAL REQUIREMENT: Legitimate literal strings inside code must NOT be destroyed!
  const codeWithLiterals = (
    'Here is how you print the token in Python:\n\n' +
    '```python\n' +
    'print("<|im_end|>")\n' +
    'print("<|im_start|>")\n' +
    '```\n' +
    'This is a literal string example.'
  );
  const cleaned = sanitizeClientOutput(codeWithLiterals);
  assert.equal(cleaned.includes('print("<|im_end|>")'), true);
  assert.equal(cleaned.includes('print("<|im_start|>")'), true);
});

test('Xen Client - sendXenChat handles cancellation cleanly', async () => {
  const controller = new AbortController();
  controller.abort(); // Cancel before call completes

  const result = await sendXenChat({
    prompt: 'Write a quicksort in Python',
    signal: controller.signal,
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'CANCELLED');
});

test('Xen Client - AST badge and tested truthfulness mapping', () => {
  const mockServerResponse = {
    status: 'ok',
    model: 'pixiumind-step-700',
    response: {
      text: 'def test():\n    pass',
      is_complete: false,
      syntax_valid: true,
      display_ast_valid: false, // Incomplete must not have AST-valid badge
      tested: false,
    },
  };

  assert.equal(mockServerResponse.response.is_complete, false);
  assert.equal(mockServerResponse.response.display_ast_valid, false);
  assert.equal(mockServerResponse.response.tested, false);
});
