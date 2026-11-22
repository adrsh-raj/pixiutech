"""
PixiuMind Xen Response Decoder & Output Sanitizer
Authoritative product-serving post-processor for Step-700 / Qwen3-14B inference responses.

Guarantees:
1. Zero token leakage: Strips <|im_end|>, <|im_start|>, <|endoftext|>, and ChatML artifacts.
2. Output completeness: Identifies truncated outputs (finish_reason == "length", unclosed fences).
3. Syntax verification: AST validation (ast.parse) for Python code blocks.
4. Testing claim truthfulness: Corrects unverified "tested" claims when sandbox execution did not run.
5. Explanation / Hint safety: Prevents raw solution leakage when only hints or pedagogical guidance were requested.
"""

import ast
import re
from typing import Any, Dict, List, Optional, Tuple

# Special tokens that must NEVER leak to the end user
# Sorted by length descending so longer compound tags are matched before sub-tags
SPECIAL_STOP_TOKENS = [
    "<|im_start|>assistant",
    "<|im_start|>user",
    "<|im_start|>system",
    "<|im_end|>",
    "<|im_start|>",
    "<|endoftext|>",
]

# Patterns for deceptive unverified "tested" claims
UNVERIFIED_TESTED_PATTERNS = [
    (re.compile(r"\bcomplete,\s*tested\s+Python\s+implementation\b", re.IGNORECASE), "complete Python implementation (syntax verified)"),
    (re.compile(r"\btested\s+and\s+verified\s+Python\s+implementation\b", re.IGNORECASE), "verified Python implementation"),
    (re.compile(r"\bfully\s+tested\s+code\b", re.IGNORECASE), "syntax-checked code"),
    (re.compile(r"\bhere\s+is\s+the\s+tested\s+code\b", re.IGNORECASE), "here is the code"),
    (re.compile(r"\btested\s+implementation\b", re.IGNORECASE), "implementation"),
]

# Patterns for raw code detection in hint-only / explanation outputs
PYTHON_CODE_SNIPPET_PATTERNS = [
    re.compile(r"(?:^|\s|:)def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(", re.MULTILINE),
    re.compile(r"(?:^|\s|:)class\s+[a-zA-Z_][a-zA-Z0-9_]*\s*[:\(]", re.MULTILINE),
    re.compile(r"(?:^|\s|:)for\s+[a-zA-Z_][a-zA-Z0-9_]*\s+in\s+", re.MULTILINE),
    re.compile(r"(?:^|\s|:)while\s+.*:\s*$", re.MULTILINE),
    re.compile(r"(?:^|\s|:)if\s+.*:\s*$", re.MULTILINE),
    re.compile(r"(?:^|\s|:)return\s+.*$", re.MULTILINE),
    re.compile(r"(?:^|\s)[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*\[.*for\s+.*in\s+.*\]", re.MULTILINE),  # list comprehension
    re.compile(r"(?:^|\s)print\s*\(.*?\)\s*$", re.MULTILINE),
    re.compile(r"(?:^|\s)[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*\d+\s*$", re.MULTILINE),  # x = 10
]


def strip_special_tokens(text: str) -> Tuple[str, List[str]]:
    """
    Remove all special tokens and ChatML boundary tags from generated output.
    Returns cleaned text and a list of tokens that were stripped.
    """
    if not text:
        return "", []

    stripped = []
    cleaned = text

    # Remove ChatML header directives like <|im_start|>assistant\n
    matches = re.findall(r"<\|im_start\|>(?:assistant|user|system)?", cleaned)
    if matches:
        stripped.extend(matches)
    cleaned = re.sub(r"<\|im_start\|>(?:assistant|user|system)?\s*", "", cleaned)

    for token in SPECIAL_STOP_TOKENS:
        if token in cleaned:
            stripped.append(token)
            cleaned = cleaned.replace(token, "")

    # Strip any trailing ChatML tag residuals like <|im_...
    cleaned = re.sub(r"<\|im_[a-z0-9_]*\|?>?", "", cleaned)

    return cleaned.strip(), stripped


def check_fence_completeness(text: str) -> Tuple[bool, int, List[str]]:
    """
    Inspect markdown code fences in the text.
    Returns:
      is_complete: True if all opened fences are closed.
      unclosed_count: Number of unclosed fences.
      fences: Extracted code blocks.
    """
    if not text:
        return True, 0, []

    # Count occurrences of triple backticks
    fence_matches = list(re.finditer(r"```([a-zA-Z0-9_-]*)\n?", text))
    fence_count = len(fence_matches)

    is_complete = (fence_count % 2 == 0)
    unclosed_count = 1 if (fence_count % 2 != 0) else 0

    # Extract complete code blocks
    code_blocks = []
    block_matches = re.findall(r"```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)```", text)
    code_blocks.extend(block_matches)

    return is_complete, unclosed_count, code_blocks


def validate_python_code(code: str) -> Tuple[bool, Optional[str]]:
    """
    Validate Python syntax using Python's authoritative ast.parse.
    """
    if not code or not code.strip():
        return True, None

    try:
        ast.parse(code)
        return True, None
    except SyntaxError as e:
        return False, f"SyntaxError at line {e.lineno}, col {e.offset}: {e.msg}"
    except Exception as e:
        return False, f"ParseException: {str(e)}"


def sanitize_testing_claims(text: str, actually_executed: bool = False) -> str:
    """
    If code was not actually executed in an isolated runtime sandbox,
    remove deceptive claims that the code is "tested".
    """
    if not text or actually_executed:
        return text

    sanitized = text
    for pattern, replacement in UNVERIFIED_TESTED_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    return sanitized


def detect_code_in_explanation(text: str) -> Tuple[bool, List[str]]:
    """
    Detect if explanation or hint output contains leaked code snippets
    (either within fences or as unlabelled multiline Python).
    """
    if not text:
        return False, []

    detected = []

    # Check for fenced code
    if "```" in text:
        detected.append("FENCED_CODE")

    # Check for unfenced raw Python definitions and statements
    for pattern in PYTHON_CODE_SNIPPET_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            detected.append(f"UNFENCED_CODE_{pattern.pattern[:15]}")

    return (len(detected) > 0), detected


def decode_model_response(
    raw_text: str,
    finish_reason: str = "stop",
    actually_executed: bool = False,
    intent: str = "CODE_GENERATION",
) -> Dict[str, Any]:
    """
    Authoritative decoding pipeline for PixiuMind Step-700 responses.
    
    Guarantees:
    - Never passes <|im_end|> to the client.
    - Never marks finish_reason == 'length' as a complete response.
    - Never awards valid_syntax badge if generation is incomplete/truncated.
    - Corrects unverified 'tested' claims unless actually_executed is True.
    - Flags code leakage in hint-only/explanation intents.
    """
    # 1. Strip special tokens
    cleaned_text, stripped_tokens = strip_special_tokens(raw_text)

    # 2. Check fence completeness
    fences_closed, unclosed_count, code_blocks = check_fence_completeness(cleaned_text)

    # 3. Determine completeness
    is_truncated_by_length = (finish_reason == "length")
    has_unclosed_fence = not fences_closed

    is_complete_response = (
        not is_truncated_by_length
        and not has_unclosed_fence
        and (finish_reason in {"stop", "end_turn", "eos_token"})
    )

    completion_status = "COMPLETED"
    if is_truncated_by_length:
        completion_status = "TRUNCATED_MAX_TOKENS"
    elif has_unclosed_fence:
        completion_status = "UNCLOSED_CODE_FENCE"

    # 4. Validate Python syntax across extracted code blocks
    all_blocks_valid = True
    syntax_errors = []

    for block in code_blocks:
        valid, err = validate_python_code(block)
        if not valid:
            all_blocks_valid = False
            syntax_errors.append(err)

    # Policy: An incomplete generation MUST NOT be awarded an AST-valid badge
    if not is_complete_response:
        display_ast_valid = False
    else:
        display_ast_valid = all_blocks_valid if len(code_blocks) > 0 else True

    # 5. Correct deceptive "tested" claims
    sanitized_text = sanitize_testing_claims(cleaned_text, actually_executed=actually_executed)

    # 6. Check hint-only / explanation safety
    code_leakage_detected = False
    leakage_details = []
    if intent in {"HINT_ONLY", "EXPLANATION_ONLY", "PEDAGOGICAL_GUIDANCE"}:
        code_leakage_detected, leakage_details = detect_code_in_explanation(sanitized_text)

    return {
        "text": sanitized_text,
        "raw_text": raw_text,
        "finish_reason": finish_reason,
        "completion_status": completion_status,
        "is_complete": is_complete_response,
        "has_unclosed_fence": has_unclosed_fence,
        "code_blocks_count": len(code_blocks),
        "syntax_valid": all_blocks_valid,
        "display_ast_valid": display_ast_valid,
        "syntax_errors": syntax_errors,
        "actually_executed": actually_executed,
        "tested": actually_executed,
        "tokens_stripped": stripped_tokens,
        "code_leakage_in_explanation": code_leakage_detected,
        "leakage_details": leakage_details,
    }
