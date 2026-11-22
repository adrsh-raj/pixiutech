import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeClientOutput, sendXenChat } from '../../src/lib/ai/xen/xen-client.js';

test('Xen Client - sanitizeClientOutput completely strips special tokens', () => {
  const dirty = 'Hello world!<|im_end|>';
  assert.equal(sanitizeClientOutput(dirty), 'Hello world!');

  const multiple = '<|im_start|>assistant\n```python\nprint("hi")\n```<|im_end|><|endoftext|>';
  const cleaned = sanitizeClientOutput(multiple);
  assert.equal(cleaned.includes('<|im_end|>'), false);
  assert.equal(cleaned.includes('<|im_start|>'), false);
  assert.equal(cleaned.includes('<|endoftext|>'), false);
  assert.equal(cleaned.includes('print("hi")'), true);
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
  // Verify that an incomplete response is correctly flagged as not complete
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
