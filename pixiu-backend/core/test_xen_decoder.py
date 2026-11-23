"""
Unit tests for core.xen_decoder
Verifies token-aware boundary trimming, preservation of literal strings in code,
AST validation, truncation policy, and hint-only safety.
"""

from django.test import SimpleTestCase
from core.xen_decoder import (
    decode_model_response,
    trim_trailing_protocol_tokens,
    check_fence_completeness,
    validate_python_code,
    sanitize_testing_claims,
    detect_code_in_explanation,
)


class XenDecoderUnitTests(SimpleTestCase):
    def test_trim_trailing_protocol_tokens(self):
        # Trims trailing protocol marker
        text = "Hello world!<|im_end|>"
        cleaned, stripped = trim_trailing_protocol_tokens(text)
        self.assertEqual(cleaned, "Hello world!")
        self.assertIn("<|im_end|>", stripped)

        # Trims leading ChatML header if present
        multi_text = "<|im_start|>assistant\nContent here.<|im_end|>"
        cleaned_m, stripped_m = trim_trailing_protocol_tokens(multi_text)
        self.assertEqual(cleaned_m, "Content here.")

    def test_preserve_literal_special_tokens_in_code_and_docs(self):
        # CRITICAL TEST: Legitimate literal strings must NOT be removed from code or documentation
        literal_code = (
            "Here is how to print special tokens in Python:\n\n"
            "```python\n"
            "# The end of turn marker for Qwen is <|im_end|>\n"
            "print('<|im_end|>')\n"
            "print('<|im_start|>')\n"
            "print('<|endoftext|>')\n"
            "```\n"
            "Explain that <|im_end|> terminates the turn.<|im_end|>"
        )

        res = decode_model_response(literal_code, finish_reason="stop")
        # Trailing protocol marker is stripped
        self.assertFalse(res["text"].endswith("<|im_end|>"))
        # Literal strings INSIDE code and documentation are strictly preserved!
        self.assertIn("print('<|im_end|>')", res["text"])
        self.assertIn("print('<|im_start|>')", res["text"])
        self.assertIn("print('<|endoftext|>')", res["text"])
        self.assertIn("Explain that <|im_end|> terminates the turn.", res["text"])
        self.assertTrue(res["is_complete"])
        self.assertTrue(res["syntax_valid"])
        self.assertTrue(res["display_ast_valid"])

    def test_m2_synth_01_greeting(self):
        m2_raw = "Hello! How can I help you today with your STEM or programming questions?<|im_end|>"
        res = decode_model_response(m2_raw, finish_reason="stop")
        self.assertEqual(res["text"], "Hello! How can I help you today with your STEM or programming questions?")
        self.assertTrue(res["is_complete"])
        self.assertFalse(res["has_unclosed_fence"])

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

        res_untested = decode_model_response(m2_raw, finish_reason="stop", actually_executed=False)
        self.assertFalse(res_untested["text"].endswith("<|im_end|>"))
        self.assertIn("complete Python implementation (syntax verified)", res_untested["text"])
        self.assertNotIn("complete, tested Python implementation", res_untested["text"])
        self.assertTrue(res_untested["is_complete"])
        self.assertTrue(res_untested["syntax_valid"])
        self.assertTrue(res_untested["display_ast_valid"])
        self.assertFalse(res_untested["tested"])

    def test_truncated_output_policy_finish_reason_length(self):
        code_truncated = (
            "```python\n"
            "def add(a, b):\n"
            "    return a + b\n"
            "```\n"
            "Next function:\n"
            "```python\n"
            "def sub(a, b):"
        )
        res = decode_model_response(code_truncated, finish_reason="length")
        self.assertFalse(res["is_complete"])
        self.assertEqual(res["completion_status"], "TRUNCATED_MAX_TOKENS")
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
        hint_with_def = "Here is a hint: def solve(): pass"
        flagged, _ = detect_code_in_explanation(hint_with_def)
        self.assertTrue(flagged)

        hint_with_assignment = "Think about variable initialization:\nx = 10"
        flagged, _ = detect_code_in_explanation(hint_with_assignment)
        self.assertTrue(flagged)

        hint_with_loop = "You need to iterate:\nfor i in range(5):"
        flagged, _ = detect_code_in_explanation(hint_with_loop)
        self.assertTrue(flagged)

        hint_with_print = "Output the value:\nprint(i)"
        flagged, _ = detect_code_in_explanation(hint_with_print)
        self.assertTrue(flagged)

        hint_with_return = "Finally you must emit the value:\nreturn result"
        flagged, _ = detect_code_in_explanation(hint_with_return)
        self.assertTrue(flagged)

        hint_with_comprehension = "You can build the list directly:\nevens = [x for x in items if x % 2 == 0]"
        flagged, _ = detect_code_in_explanation(hint_with_comprehension)
        self.assertTrue(flagged)

        pure_hint = "Consider using a loop that steps through each character and checks if it belongs to a vowel set."
        flagged, _ = detect_code_in_explanation(pure_hint)
        self.assertFalse(flagged)
