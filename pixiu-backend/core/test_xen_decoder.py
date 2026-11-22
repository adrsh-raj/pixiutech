"""
Unit tests for core.xen_decoder
Verifies output sanitization, token stripping, AST validation, truncation policy,
and hint-only safety against real M2 outputs and synthetic regression cases.
"""

from django.test import SimpleTestCase
from core.xen_decoder import (
    decode_model_response,
    strip_special_tokens,
    check_fence_completeness,
    validate_python_code,
    sanitize_testing_claims,
    detect_code_in_explanation,
)


class XenDecoderUnitTests(SimpleTestCase):
    def test_strip_special_tokens(self):
        text = "Hello world!<|im_end|>"
        cleaned, stripped = strip_special_tokens(text)
        self.assertEqual(cleaned, "Hello world!")
        self.assertIn("<|im_end|>", stripped)

        multi_text = "<|im_start|>assistant\nContent here.<|im_end|><|endoftext|>"
        cleaned_m, stripped_m = strip_special_tokens(multi_text)
        self.assertEqual(cleaned_m, "Content here.")
        self.assertIn("<|im_start|>assistant", stripped_m)
        self.assertIn("<|im_end|>", stripped_m)
        self.assertIn("<|endoftext|>", stripped_m)

    def test_m2_synth_01_greeting(self):
        m2_raw = "Hello! How can I help you today with your STEM or programming questions?<|im_end|>"
        res = decode_model_response(m2_raw, finish_reason="stop")
        self.assertEqual(res["text"], "Hello! How can I help you today with your STEM or programming questions?")
        self.assertTrue(res["is_complete"])
        self.assertFalse(res["has_unclosed_fence"])
        self.assertIn("<|im_end|>", res["tokens_stripped"])
        self.assertFalse("<|im_end|>" in res["text"])

    def test_m2_synth_03_reasoning_code_tested_claim_and_token(self):
        m2_raw = (
            "Here is the complete, tested Python implementation of `count_vowels(text)`:\n\n"
            "```python\n"
            "def count_vowels(text):\n"
            "    text = text.lower()\n"
            "    vowels = 'aeiou'\n"
            "    count = 0\n"
            "    for char in text:\n"
            "        if char in vowels:\n"
            "            count += 1\n"
            "    return count\n\n"
            "print(count_vowels('Hello World'))\n"
            "```\n\n"
            "### Explanation:\n"
            "1. Case insensitivity.\n"
            "Return the final vowel count.<|im_end|>"
        )

        # When actually_executed=False (standard inference without sandbox)
        res_untested = decode_model_response(m2_raw, finish_reason="stop", actually_executed=False)
        self.assertFalse("<|im_end|>" in res_untested["text"])
        self.assertIn("complete Python implementation (syntax verified)", res_untested["text"])
        self.assertNotIn("complete, tested Python implementation", res_untested["text"])
        self.assertTrue(res_untested["is_complete"])
        self.assertTrue(res_untested["syntax_valid"])
        self.assertTrue(res_untested["display_ast_valid"])
        self.assertFalse(res_untested["tested"])

        # When actually_executed=True (e.g. if run in sandbox)
        res_tested = decode_model_response(m2_raw, finish_reason="stop", actually_executed=True)
        self.assertTrue(res_tested["tested"])

    def test_truncated_output_policy_finish_reason_length(self):
        # Truncated at syntactically valid boundary
        code_truncated_valid = (
            "```python\n"
            "def add(a, b):\n"
            "    return a + b\n"
            "```\n"
            "Next function:\n"
            "```python\n"
            "def sub(a, b):"
        )
        res = decode_model_response(code_truncated_valid, finish_reason="length")
        self.assertFalse(res["is_complete"])
        self.assertEqual(res["completion_status"], "TRUNCATED_MAX_TOKENS")
        # Critical rule: NEVER show AST-valid badge if generation was truncated
        self.assertFalse(res["display_ast_valid"])

    def test_unclosed_code_fence(self):
        raw = "```python\ndef test():\n    pass"
        res = decode_model_response(raw, finish_reason="stop")
        self.assertFalse(res["is_complete"])
        self.assertTrue(res["has_unclosed_fence"])
        self.assertEqual(res["completion_status"], "UNCLOSED_CODE_FENCE")
        self.assertFalse(res["display_ast_valid"])

    def test_syntax_invalid_code_block(self):
        raw = "```python\ndef bad_syntax(\n    return 42\n```"
        res = decode_model_response(raw, finish_reason="stop")
        self.assertTrue(res["is_complete"])
        self.assertFalse(res["syntax_valid"])
        self.assertFalse(res["display_ast_valid"])
        self.assertTrue(len(res["syntax_errors"]) > 0)

    def test_hint_only_safety_raw_python_detection(self):
        # Snippets that should be blocked or flagged in hint-only mode
        hint_with_def = "Here is a hint: def solve(): pass"
        flagged, details = detect_code_in_explanation(hint_with_def)
        self.assertTrue(flagged)

        hint_with_assignment = "Think about variable initialization:\nx = 10"
        flagged, details = detect_code_in_explanation(hint_with_assignment)
        self.assertTrue(flagged)

        hint_with_loop = "You need to iterate:\nfor i in range(5):"
        flagged, details = detect_code_in_explanation(hint_with_loop)
        self.assertTrue(flagged)

        hint_with_print = "Output the value:\nprint(i)"
        flagged, details = detect_code_in_explanation(hint_with_print)
        self.assertTrue(flagged)

        hint_with_return = "Finally you must emit the value:\nreturn result"
        flagged, details = detect_code_in_explanation(hint_with_return)
        self.assertTrue(flagged)

        hint_with_comprehension = "You can build the list directly:\nevens = [x for x in items if x % 2 == 0]"
        flagged, details = detect_code_in_explanation(hint_with_comprehension)
        self.assertTrue(flagged)

        # Pure pedagogical guidance without code snippets
        pure_hint = "Consider using a loop that steps through each character and checks if it belongs to a vowel set."
        flagged, details = detect_code_in_explanation(pure_hint)
        self.assertFalse(flagged)
