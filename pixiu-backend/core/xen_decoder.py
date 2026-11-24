"""
PixiuMind Xen Response Decoder & Output Sanitizer
Authoritative product-serving post-processor for Step-700 / Qwen3-14B inference responses.

Guarantees:
1. Token-aware protocol handling: Does NOT globally delete legitimate literal strings like print("<|im_end|>") from code/docs.
2. Output completeness: Identifies truncated outputs (finish_reason == "length", unclosed fences).
3. Syntax verification: AST validation (ast.parse) for Python code blocks.
4. Testing claim truthfulness: Corrects unverified "tested" claims when sandbox execution did not run.
5. Explanation / Hint safety: Prevents raw solution leakage when only hints or pedagogical guidance were requested.
"""

import ast
import re
from typing import Any, Dict, List, Optional, Tuple

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


def trim_trailing_protocol_tokens(text: str) -> Tuple[str, List[str]]:
    """
    Remove ONLY genuine protocol tokens from the boundaries of the generated stream.
    Does NOT strip literal occurrences of special token names embedded inside code or documentation.
    """
    if not text:
        return "", []

    stripped = []
    cleaned = text

    # Strip ChatML header prefixes if leaked at the very start of generation
    prefix_match = re.match(r"^<\|im_start\|>(?:assistant|user|system)?\s*", cleaned)
    if prefix_match:
        matched_str = prefix_match.group(0)
        stripped.append(matched_str.strip())
        cleaned = cleaned[len(matched_str):]

    # Strip trailing protocol token only if present at the end of output
    for suffix in ("<|im_end|>", "<|endoftext|>"):
        if cleaned.endswith(suffix):
            stripped.append(suffix)
            cleaned = cleaned[:-len(suffix)]

    return cleaned.rstrip(), stripped


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

    fence_matches = list(re.finditer(r"```([a-zA-Z0-9_-]*)\n?", text))
    fence_count = len(fence_matches)

    is_complete = (fence_count % 2 == 0)
    unclosed_count = 1 if (fence_count % 2 != 0) else 0

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

    if "```" in text:
        detected.append("FENCED_CODE")

    for pattern in PYTHON_CODE_SNIPPET_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            detected.append(f"UNFENCED_CODE_{pattern.pattern[:15]}")

    return (len(detected) > 0), detected


def validate_code_only_format(text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Specification Part 9.1:
    Validate strict CODE_ONLY response format:
    1. Exactly one fenced code block exists.
    2. No prose exists before the code block.
    3. No prose exists after the code block.
    4. No explanatory comments exist inside the code.
    Returns: (is_valid, error_reason, extracted_code)
    """
    if not text or not isinstance(text, str):
        return False, "EMPTY_RESPONSE", None

    cleaned = text.strip()
    code_blocks = re.findall(r"```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)```", cleaned)
    if len(code_blocks) != 1:
        return False, f"EXPECTED_EXACTLY_ONE_CODE_BLOCK_GOT_{len(code_blocks)}", None

    first_fence = cleaned.find("```")
    last_fence = cleaned.rfind("```")
    leading_text = cleaned[:first_fence].strip()
    trailing_text = cleaned[last_fence + 3:].strip()

    if leading_text:
        return False, f"PROSE_BEFORE_CODE: {leading_text[:50]}", None
    if trailing_text:
        return False, f"PROSE_AFTER_CODE: {trailing_text[:50]}", None

    code_content = code_blocks[0]
    lines = code_content.splitlines()
    for line in lines:
        stripped_line = line.strip()
        if stripped_line.startswith("#") and not stripped_line.startswith("#!"):
            return False, f"EXPLANATORY_COMMENT_DETECTED: {stripped_line[:40]}", code_content

    return True, None, code_content


def format_output_only_response(raw_text: str, actually_executed: bool = False) -> str:
    """
    Specification Part 10:
    For OUTPUT_ONLY: If actual sandbox execution did not take place, display:
    'Expected output (not executed)'
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    cleaned = raw_text.strip()
    fence_match = re.match(r"^```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)```$", cleaned)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    if actually_executed:
        return f"Executed output:\n{cleaned}"

    if cleaned.lower().startswith("expected output"):
        return cleaned

    return f"Expected output (not executed)\n\n{cleaned}"


def decode_model_response(
    raw_text: str,
    finish_reason: str = "stop",
    actually_executed: bool = False,
    intent: str = "CODE_GENERATION",
    format_mode: str = "DEFAULT_EDUCATIONAL",
) -> Dict[str, Any]:
    """
    Authoritative decoding pipeline for PixiuMind Step-700 responses.
    
    Guarantees:
    - Never leaks boundary protocol tokens into output.
    - Preserves legitimate literal strings in code (e.g. print("<|im_end|>")).
    - Never marks finish_reason == 'length' as a complete response.
    - Never awards valid_syntax badge if generation is incomplete/truncated.
    - Corrects unverified 'tested' claims unless actually_executed is True.
    - Flags code leakage in hint-only/explanation intents.
    - Enforces format validation contracts for CODE_ONLY and OUTPUT_ONLY modes.
    """
    # 1. Trim boundary protocol tokens only (preserves internal literal occurrences)
    cleaned_text, stripped_tokens = trim_trailing_protocol_tokens(raw_text)
    if cleaned_text.lstrip().startswith("<think>"):
        _, closed, answer = cleaned_text.partition("</think>")
        cleaned_text = answer.lstrip() if closed else ""


    # 2. Check fence completeness
    fences_closed, unclosed_count, code_blocks = check_fence_completeness(cleaned_text)

    # 3. Determine completeness
    is_truncated_by_length = (finish_reason == "length")
    has_unclosed_fence = not fences_closed

    is_complete_response = (
        not is_truncated_by_length
        and not has_unclosed_fence
        and bool(cleaned_text.strip())
        and (finish_reason in {"stop", "end_turn", "eos_token"})
    )

    completion_status = "COMPLETED"
    if is_truncated_by_length:
        completion_status = "TRUNCATED_MAX_TOKENS"
    elif has_unclosed_fence:
        completion_status = "UNCLOSED_CODE_FENCE"
    elif not is_complete_response:
        completion_status = "INCOMPLETE"

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

    # 6. Mode-specific format validation
    format_valid = True
    format_error = None
    extracted_code = None

    if format_mode == "CODE_ONLY":
        format_valid, format_error, extracted_code = validate_code_only_format(sanitized_text)
        # Suppress syntax badge from polluting code-only UI presentation
        display_ast_valid = False
    elif format_mode == "OUTPUT_ONLY":
        sanitized_text = format_output_only_response(sanitized_text, actually_executed=actually_executed)

    # 7. Check hint-only / explanation safety
    code_leakage_detected = False
    leakage_details = []
    if intent in {"HINT_ONLY", "EXPLANATION_ONLY", "PEDAGOGICAL_GUIDANCE"} or format_mode == "EXPLANATION_ONLY":
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
        "format_mode": format_mode,
        "format_valid": format_valid,
        "format_error": format_error,
        "extracted_code": extracted_code,
    }
