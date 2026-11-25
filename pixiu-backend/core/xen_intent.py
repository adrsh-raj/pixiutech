"""
Xen / 8square AI Response-Mode Intent Classification and Preference Engine.

Authoritative intent and format contract implementation:
- Deterministic, multi-lingual (English, Hindi, Hinglish) rule-based intent classification.
- Response Modes:
  * CODE_ONLY: Executable code block only; 0 intro prose, 0 trailing explanation, 0 comments.
  * CODE_AND_EXPLANATION: Python code block + line-by-line / pedagogical explanation.
  * OUTPUT_ONLY: Execution output only (labeled 'Expected output (not executed)' if not sandboxed).
  * EXPLANATION_ONLY: Pure conceptual explanation without code fences.
  * DEFAULT_EDUCATIONAL: Standard Grade 6 Computational Thinking pedagogy (Condition A1).
- Conversation-scoped sticky format preference tracking.
- Contextual reminder handling (standalone 'bhai' after failed format compliance).
"""

import json
from enum import Enum
import re
from typing import Any, Dict, List, Optional, Tuple


class XenResponseMode(str, Enum):
    CODE_ONLY = "CODE_ONLY"
    CODE_AND_EXPLANATION = "CODE_AND_EXPLANATION"
    OUTPUT_ONLY = "OUTPUT_ONLY"
    EXPLANATION_ONLY = "EXPLANATION_ONLY"
    DEFAULT_EDUCATIONAL = "DEFAULT_EDUCATIONAL"


# ---------------------------------------------------------------------------
# Regex Patterns for English & Hinglish Format Detection
# ---------------------------------------------------------------------------

# Negative constraints indicating code-only (e.g., "output nahi", "explanation mat do")
_NO_EXPLANATION_PATTERNS = [
    re.compile(r"\bno\s+explanation\b", re.IGNORECASE),
    re.compile(r"\bwithout\s+explanation\b", re.IGNORECASE),
    re.compile(r"\bdon'?t\s+explain\b", re.IGNORECASE),
    re.compile(r"\bstop\s+explaining\b", re.IGNORECASE),
    re.compile(r"\bexplain\s+mat\s+karo\b", re.IGNORECASE),
    re.compile(r"\bsamjha(?:o|na)\s+mat\b", re.IGNORECASE),
    re.compile(r"\bexplanation\s+na?h?i\b", re.IGNORECASE),
    re.compile(r"\bsamjhana\s+na?h?i\b", re.IGNORECASE),
    re.compile(r"\bcomments?\s+ke\s+bina\b", re.IGNORECASE),
    re.compile(r"\bwithout\s+comments?\b", re.IGNORECASE),
]

_NO_OUTPUT_PATTERNS = [
    re.compile(r"\bno\s+output\b", re.IGNORECASE),
    re.compile(r"\bwithout\s+output\b", re.IGNORECASE),
    re.compile(r"\boutput\s+na?h?i\b", re.IGNORECASE),
    re.compile(r"\boutput\s+mat\b", re.IGNORECASE),
    re.compile(r"\boutput\s+na?h?i\s+cha[hi]*ye\b", re.IGNORECASE),
]

# Explicit CODE_ONLY triggers
_CODE_ONLY_EXPLICIT_PATTERNS = [
    re.compile(r"\bcode\s+only\b", re.IGNORECASE),
    re.compile(r"\bjust\s+code\b", re.IGNORECASE),
    re.compile(r"\bonly\s+(?:give\s+me\s+)?code\b", re.IGNORECASE),
    re.compile(r"\bsirf\s+(?:python\s+)?code\b", re.IGNORECASE),
    re.compile(r"\bbas\s+(?:python\s+)?code\b", re.IGNORECASE),
    re.compile(r"\bonly\s+source\s+code\b", re.IGNORECASE),
    re.compile(r"\bsource\s+code\s+only\b", re.IGNORECASE),
    re.compile(r"\bsirf\s+code\s+likho\b", re.IGNORECASE),
    re.compile(r"\bpython\s+code\s+cha[hi]*ye\b", re.IGNORECASE),
    re.compile(r"\bcode\s+cha[hi]*ye\b", re.IGNORECASE),
]

# Explicit CODE_AND_EXPLANATION triggers
_CODE_AND_EXPLANATION_PATTERNS = [
    re.compile(r"\bexplain\s+each\s+line\b", re.IGNORECASE),
    re.compile(r"\bexplain\s+the\s+code\b", re.IGNORECASE),
    re.compile(r"\bexplain\s+this\s+code\b", re.IGNORECASE),
    re.compile(r"\bcode\s+(?:and|aur|\+)\s+explanation\b", re.IGNORECASE),
    re.compile(r"\bcode\s+aur\s+explain\s+dono\b", re.IGNORECASE),
    re.compile(r"\bboth\s+code\s+and\s+explanation\b", re.IGNORECASE),
    re.compile(r"\bteach\s+.*how.*code\b", re.IGNORECASE),
    re.compile(r"\bcode\s+bhi\s+aur\s+explanation\s+bhi\b", re.IGNORECASE),
]

# Explicit OUTPUT_ONLY triggers
_OUTPUT_ONLY_PATTERNS = [
    re.compile(r"\bshow\s+(?:me\s+)?(?:the\s+)?output\b", re.IGNORECASE),
    re.compile(r"\boutput\s+only\b", re.IGNORECASE),
    re.compile(r"\bjust\s+output\b", re.IGNORECASE),
    re.compile(r"\bsirf\s+output\b", re.IGNORECASE),
    re.compile(r"\boutput\s+dikha(?:o)?\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+is\s+the\s+output\b", re.IGNORECASE),
    re.compile(r"\bexpected\s+output\b", re.IGNORECASE),
]

# Explicit EXPLANATION_ONLY triggers
_EXPLANATION_ONLY_PATTERNS = [
    re.compile(r"\bexplain\s+(?:the\s+concept\s+)?without\s+code\b", re.IGNORECASE),
    re.compile(r"\bno\s+code\b", re.IGNORECASE),
    re.compile(r"\bcode\s+mat\s+do\b", re.IGNORECASE),
    re.compile(r"\bcode\s+na?h?i\s+cha[hi]*ye\b", re.IGNORECASE),
    re.compile(r"\bbina\s+code\s+ke\s+samjha(?:o)?\b", re.IGNORECASE),
    re.compile(r"\bexplanation\s+only\b", re.IGNORECASE),
    re.compile(r"\bonly\s+explanation\b", re.IGNORECASE),
]

# Standalone contextual reminder triggers (e.g., user is nudging/correcting)
_CONTEXTUAL_REMINDER_PATTERNS = [
    re.compile(r"^\s*bhai[.!\s]*$", re.IGNORECASE),
    re.compile(r"^\s*bhaiya[.!\s]*$", re.IGNORECASE),
    re.compile(r"^\s*bro[.!\s]*$", re.IGNORECASE),
    re.compile(r"^\s*dude[.!\s]*$", re.IGNORECASE),
    re.compile(r"^\s*yaar[.!\s]*$", re.IGNORECASE),
]

# Context-dependent programming continuation (e.g. "write code of it")
_CODE_CONTINUATION_PATTERNS = [
    re.compile(r"\bwrite\s+code\s+of\s+it\b", re.IGNORECASE),
    re.compile(r"\bwrite\s+the\s+code\b", re.IGNORECASE),
    re.compile(r"\bgive\s+code\b", re.IGNORECASE),
    re.compile(r"\bcode\s+do\b", re.IGNORECASE),
    re.compile(r"\biska\s+code\s+do\b", re.IGNORECASE),
    re.compile(r"\bcode\s+likh\s*do\b", re.IGNORECASE),
]


def is_contextual_reminder(text: str) -> bool:
    """Returns True if user sent a bare contextual nudge like 'bhai', 'bhai...', 'bro'."""
    if not text or not isinstance(text, str):
        return False
    cleaned = text.strip()
    return any(p.match(cleaned) for p in _CONTEXTUAL_REMINDER_PATTERNS)


def classify_raw_prompt_intent(prompt: str) -> Optional[XenResponseMode]:
    """
    Direct lexical / semantic classification of the latest prompt text alone.
    Returns None if no specific format mode pattern is matched.
    """
    if not prompt or not isinstance(prompt, str):
        return None

    cleaned = prompt.strip()

    # 1. Check EXPLANATION_ONLY
    for p in _EXPLANATION_ONLY_PATTERNS:
        if p.search(cleaned):
            return XenResponseMode.EXPLANATION_ONLY

    # 2. Check OUTPUT_ONLY
    for p in _OUTPUT_ONLY_PATTERNS:
        if p.search(cleaned):
            return XenResponseMode.OUTPUT_ONLY

    # 3. Check CODE_AND_EXPLANATION (must precede code-only check to avoid conflict)
    for p in _CODE_AND_EXPLANATION_PATTERNS:
        if p.search(cleaned):
            return XenResponseMode.CODE_AND_EXPLANATION

    # 4. Check negative instructions: e.g. "python code chaiye output nhi" -> CODE_ONLY
    has_no_explanation = any(p.search(cleaned) for p in _NO_EXPLANATION_PATTERNS)
    has_no_output = any(p.search(cleaned) for p in _NO_OUTPUT_PATTERNS)

    if has_no_explanation or has_no_output:
        # If user explicitly rejects output or explanation while asking for code or in general
        return XenResponseMode.CODE_ONLY

    # 5. Check explicit CODE_ONLY
    for p in _CODE_ONLY_EXPLICIT_PATTERNS:
        if p.search(cleaned):
            return XenResponseMode.CODE_ONLY

    return None


def resolve_xen_response_mode(
    prompt: str,
    history: Optional[List[Dict[str, Any]]] = None,
    active_sticky_preference: Optional[str] = None,
) -> Tuple[XenResponseMode, str]:
    """
    Authoritative multi-turn response mode resolution engine.
    Priority order (Part 7.3):
    1. Latest explicit user instruction.
    2. Contextual correction / reminder ('bhai') preserving prior preference.
    3. Active sticky response-format preference.
    4. Code continuation in established programming context ('write code of it').
    5. Default A1 educational response style.

    Returns:
      (resolved_mode, resolution_source)
    """
    cleaned_prompt = (prompt or "").strip()
    history = history or []

    # Priority 1: Direct lexical classification of the latest user prompt
    direct_mode = classify_raw_prompt_intent(cleaned_prompt)
    if direct_mode is not None:
        return direct_mode, "latest_explicit_instruction"

    # Priority 2: Standalone contextual reminder (e.g. 'bhai', 'bhai...')
    if is_contextual_reminder(cleaned_prompt):
        # Check if previous turn established a preference or if last turn was a failed format request
        if active_sticky_preference and active_sticky_preference in XenResponseMode.__members__:
            return XenResponseMode(active_sticky_preference), "contextual_reminder_sticky"
        
        # Look backwards in history for the last explicit user instruction
        for turn in reversed(history):
            if turn.get("role") == "user":
                prior_direct = classify_raw_prompt_intent(turn.get("content", ""))
                if prior_direct is not None:
                    return prior_direct, "contextual_reminder_prior_turn"

        # Fallback if no prior context exists for 'bhai'
        return XenResponseMode.DEFAULT_EDUCATIONAL, "contextual_reminder_no_prior_context"

    # Priority 3: Code continuation patterns in established programming context
    # (e.g. User previously asked for program, now says "write code of it")
    is_code_continuation = any(p.search(cleaned_prompt) for p in _CODE_CONTINUATION_PATTERNS)
    if is_code_continuation:
        # If sticky preference is active, keep it; otherwise in program context default to CODE_ONLY
        if active_sticky_preference == XenResponseMode.CODE_ONLY.value:
            return XenResponseMode.CODE_ONLY, "code_continuation_sticky"
        # If user explicitly said "write code of it", it's a code-focused turn
        return XenResponseMode.CODE_ONLY, "code_continuation_in_context"

    # Priority 4: Active sticky format preference from current conversation session
    if active_sticky_preference and active_sticky_preference in XenResponseMode.__members__:
        # Only preserve CODE_ONLY if current prompt is not asking for explanation
        return XenResponseMode(active_sticky_preference), "active_sticky_preference"

    # Priority 5: Default educational response style (Condition A1)
    return XenResponseMode.DEFAULT_EDUCATIONAL, "default_a1_pedagogy"


# ---------------------------------------------------------------------------
# Additive System Prompt Instructions for Strict Modes
# ---------------------------------------------------------------------------

ADDITIVE_MODE_DIRECTIVES: Dict[XenResponseMode, str] = {
    XenResponseMode.CODE_ONLY: (
        "MANDATORY FORMAT DIRECTIVE — STRICT CODE_ONLY MODE:\n"
        "The student has explicitly requested SOURCE CODE ONLY. Obey these constraints strictly:\n"
        "1. Output exactly ONE fenced ```python code block containing the complete, correct Python code.\n"
        "2. Do NOT write any greeting, introductory text, or prose before the code block.\n"
        "3. Do NOT write any explanation, bullet points, notes, or descriptions after the code block.\n"
        "4. Do NOT include explanatory comments (#) inside the code block.\n"
        "5. Do NOT include program output demonstrations or execution logs.\n"
        "6. Use clean, natural, idiomatic Python (e.g. use 'for i in range(1, 6): print(i)' rather than repeated print statements).\n"
        "7. Your entire response must consist solely of the ```python ... ``` block."
    ),
    XenResponseMode.OUTPUT_ONLY: (
        "MANDATORY FORMAT DIRECTIVE — STRICT OUTPUT_ONLY MODE:\n"
        "The student has requested PROGRAM OUTPUT ONLY. Obey these constraints strictly:\n"
        "1. Provide ONLY the expected execution output of the program.\n"
        "2. If this is a simulated response (not executed in a live sandbox), format the header as: 'Expected output (not executed)' followed by the raw output.\n"
        "3. Do NOT provide Python source code blocks.\n"
        "4. Do NOT provide conceptual explanations."
    ),
    XenResponseMode.EXPLANATION_ONLY: (
        "MANDATORY FORMAT DIRECTIVE — STRICT EXPLANATION_ONLY MODE:\n"
        "The student has requested CONCEPTUAL EXPLANATION ONLY. Obey these constraints strictly:\n"
        "1. Explain the concept clearly using step-by-step reasoning and age-appropriate examples.\n"
        "2. Do NOT provide Python code blocks or implementation solutions."
    ),
    XenResponseMode.CODE_AND_EXPLANATION: (
        "MANDATORY FORMAT DIRECTIVE — CODE AND EXPLANATION MODE:\n"
        "Provide a clean, natural Python implementation in a ```python block, followed by a concise, step-by-step line explanation."
    ),
    XenResponseMode.DEFAULT_EDUCATIONAL: "",
}


def get_additive_mode_instruction(mode: XenResponseMode) -> str:
    """Returns the runtime additive formatting directive for the given mode."""
    return ADDITIVE_MODE_DIRECTIVES.get(mode, "")


def sanitize_context_envelope(envelope: Any) -> Dict[str, Any]:
    """
    Sanitizes and extracts safe, non-PII mission and circuit context from client envelope.
    """
    if not isinstance(envelope, dict):
        return {}

    sanitized: Dict[str, Any] = {}

    def text(value, limit):
        return value[:limit] if isinstance(value, str) else ""

    def items(value, limit):
        return value[:limit] if isinstance(value, list) else []

    lesson = envelope.get("lesson")
    if isinstance(lesson, dict):
        sanitized["lesson"] = {key: text(lesson.get(key), limit) for key, limit in (
            ("id", 64), ("title", 128), ("description", 300), ("difficulty", 32), ("final_goal", 200), ("target_board", 40)
        )}
        sanitized["lesson"]["concepts"] = [text(c, 64) for c in items(lesson.get("concepts"), 8)]
        for field in ("steps", "completed_step_ids", "required_parts", "starter_parts"):
            sanitized["lesson"][field] = [text(v, 72) for v in items(lesson.get(field), 16) if isinstance(v, str)]
        step = lesson.get("active_step")
        if isinstance(step, dict):
            sanitized["lesson"]["active_step"] = {key: text(step.get(key), 180) for key in ("kind", "title", "instructions")}

    circuit = envelope.get("circuit")
    if isinstance(circuit, dict):
        result = {"diagnostic_source": "static circuit checks", "revision": text(circuit.get("revision"), 80), "board": text(circuit.get("board"), 32), "issues": text(circuit.get("issues"), 200)}
        for key in ("parts_count", "wires_count", "health_score"):
            value = circuit.get(key)
            if type(value) is int and value >= 0:
                result[key] = value
        if type(circuit.get("running")) is bool:
            result["simulator_running"] = circuit["running"]
        result["readings"] = []
        for r in items(circuit.get("readings"), 4):
            if not isinstance(r, dict) or r.get("instrument") not in ("multimeter", "oscilloscope"):
                continue
            reading = {"instrument": r["instrument"], "source": "unknown"}
            if r.get("source") == "simulated" and type(r.get("value")) in (int, float) and -1e9 <= r["value"] <= 1e9:
                reading.update(source="simulated", value=r["value"], unit=text(r.get("unit"), 8),
                               probeA=text(r.get("probeA"), 64), probeB=text(r.get("probeB"), 64))
            result["readings"].append(reading)
        result["parts"] = [[text(p.get("id"), 48), text(p.get("type"), 40)]
                           for p in items(circuit.get("parts"), 32) if isinstance(p, dict)]
        result["wires"] = []
        for wire in items(circuit.get("wires"), 32):
            if isinstance(wire, dict) and all(isinstance(wire.get(end), dict) for end in ("from", "to")):
                result["wires"].append([[text(wire[end].get("partId"), 48), text(wire[end].get("pinId"), 32)]
                                        for end in ("from", "to")])
        sanitized["circuit"] = result
    blockly = envelope.get("blockly")
    if isinstance(blockly, dict):
        sanitized["blockly"] = {"summary": text(blockly.get("summary"), 200),
                                "blocks": [text(b, 72) for b in items(blockly.get("blocks"), 20)]}
    return sanitized


def format_context_envelope(envelope: Dict[str, Any], max_chars: int = 2800) -> str:
    """
    Formats the sanitized context envelope into a clean, bounded text prompt prefix.
    Clamped by max_chars (up to 2800) so combined prompt + mode directive + context stays within serving limits.
    """
    if not envelope:
        return ""
    limit = max(0, min(2800, int(max_chars)))
    if limit < 40:
        return ""

    # Keep a valid JSON document even for a large circuit. Preserve real counts
    # and identify omission explicitly instead of presenting a partial graph as complete.
    data = {**envelope, "version": 1}
    if "circuit" in data:
        data["circuit"] = dict(data["circuit"])
        circuit = data["circuit"]
        for field, count in (("parts", "parts_count"), ("wires", "wires_count")):
            if len(circuit.get(field, [])) < circuit.get(count, 0):
                circuit["partial"] = True
    def encode():
        raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        for char in "<>":
            raw = raw.replace(char, f"\\u{ord(char):04x}")
        return raw.replace("[MISSION CONTEXT]", "\\u005bMISSION CONTEXT]").replace("[/MISSION CONTEXT]", "\\u005b/MISSION CONTEXT]")
    body = encode()
    while len(body) > limit:
        circuit = data.get("circuit", {})
        field = max(("parts", "wires"), key=lambda key: len(circuit.get(key, [])))
        if circuit.get(field):
            circuit[field] = circuit[field][:-1]
            circuit["partial"] = True
        elif data.get("blockly", {}).get("blocks"):
            data["blockly"] = {**data["blockly"], "blocks": [], "partial": True}
        elif circuit.get("readings"):
            circuit["readings"] = []
            circuit["partial"] = True
        else:
            lesson = data.get("lesson", {})
            longest = max(("steps", "required_parts", "starter_parts", "completed_step_ids", "concepts"),
                          key=lambda key: len(lesson.get(key, [])))
            if lesson.get(longest):
                data["lesson"] = {**lesson, longest: lesson[longest][:-1], "partial": True}
            elif "circuit" in data and data.get("lesson"):
                # Keep core circuit summary and lesson id/title under strict tiny budgets
                trimmed_lesson = {k: v for k, v in data["lesson"].items() if k in ("id", "title")}
                if trimmed_lesson != data["lesson"]:
                    data["lesson"] = {**trimmed_lesson, "partial": True}
                else:
                    return ""
            else:
                return ""
        body = encode()
    return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"
