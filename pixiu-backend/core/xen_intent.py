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
        "2. Do NOT provide Python code blocks or implementation solutions.\n"
        "3. Use valid Markdown: format bold text as **bold text** without spaces immediately inside asterisks (e.g. **apple**, never ** apple**).\n"
        "4. Enclose inline formulas in $...$ (e.g. $V = I \\times R$) and display equations in $$...$$ (e.g. $$\\mathrm{KE} = \\frac{1}{2}mv^2$$) with balanced LaTeX braces.\n"
        "5. Use \\frac{a}{b} for fractions and \\mathrm{...} for upright multi-letter physical quantities (e.g. \\mathrm{KE}, \\mathrm{PE})."
    ),
    XenResponseMode.CODE_AND_EXPLANATION: (
        "MANDATORY FORMAT DIRECTIVE — CODE AND EXPLANATION MODE:\n"
        "1. Provide a clean, natural Python implementation in a ```python block, followed by a concise, step-by-step line explanation.\n"
        "2. Format bold as **bold** without spaces inside asterisks, inline math in $...$, and display equations in $$...$$ with balanced LaTeX braces (using \\frac{a}{b} for fractions and \\mathrm{...} for upright physical quantities like \\mathrm{KE} = \\frac{1}{2}mv^2)."
    ),
    XenResponseMode.DEFAULT_EDUCATIONAL: (
        "FORMATTING DIRECTIVE — MARKDOWN & MATHEMATICAL NOTATION:\n"
        "1. Use valid Markdown: format bold text as **bold text** without spaces immediately inside the asterisks (e.g. **apple**, never ** apple**).\n"
        "2. Enclose inline mathematics and formulas in single dollar signs: $...$ (e.g. $V = I \\times R$).\n"
        "3. Enclose standalone display equations in double dollar signs on their own lines: $$...$$ (e.g. $$\\mathrm{KE} = \\frac{1}{2}mv^2$$).\n"
        "4. Use valid LaTeX commands with balanced braces: use \\frac{a}{b} for fractions, \\mathrm{...} for multi-letter physical quantities in upright roman font (e.g. \\mathrm{KE} = \\frac{1}{2}mv^2, \\mathrm{PE} = mgh), \\Omega for ohms, \\approx for approximations, subscripts like R_{\\mathrm{total}}, superscripts like x^2.\n"
        "5. Define variables and explain formulas when educational context requires it. Do not invent formulas or alter established scientific laws."
    ),
}


# ---------------------------------------------------------------------------
# CyberLab Grounding Directive & Affirmative Resolution
# ---------------------------------------------------------------------------

CYBERLAB_GROUNDING_DIRECTIVE = (
    "You are 8square, embedded inside Pixiu CyberLab. The application provides a structured snapshot of the student's active virtual circuit and its available simulator state in the mission context. Inspect and use that data before answering questions about the circuit.\n"
    "You can inspect the circuit components, board, pin connections, electrical nets, code context and simulator evidence that the application has shared.\n"
    "Do not claim that you cannot see the circuit or ask the user to describe components that are already present in the provided context.\n"
    "When the user asks why a component is not working, analyse its actual connections and relevant electrical evidence.\n"
    "Name the observed board, components and relevant pin connections when useful.\n"
    "Distinguish simulator-computed values from hardware measurements.\n"
    "Do not claim access to the user's full desktop, browser tabs, webcam or operating system.\n"
    "Do not invent visual observations. Structured circuit data is not the same as a pixel screenshot.\n"
    "If the user asks 'Can you see my screen?': Explain truthfully: 'I can inspect the live circuit and simulator data that CyberLab shares with me. I cannot inspect your entire desktop or other browser tabs.' Then inspect the circuit context and answer the actual circuit question."
)

CYBERLAB_GROUNDING_DIRECTIVE_COMPACT = (
    "You are 8square in Pixiu CyberLab. Inspect active virtual circuit components, board, pin connections, and simulator data in mission context before answering. Do not claim you cannot see the circuit."
)

CYBERLAB_EMPTY_CANVAS_DIRECTIVE = (
    "You are 8square, embedded inside Pixiu CyberLab. The student is asking about their circuit, but the active workspace canvas currently has 0 components and 0 wires connected to the board.\n"
    "Explain truthfully and clearly that the canvas is currently empty with no components or wires placed on the breadboard.\n"
    "Guide the student on which specific components to add from the catalogue (e.g. place an LED and a 220-ohm resistor on the canvas) so you can inspect and troubleshoot the circuit.\n"
    "Do NOT claim that circuit context was not shared or that there is an inspection error. Explicitly state that the canvas is currently empty."
)

CYBERLAB_EMPTY_CANVAS_DIRECTIVE_COMPACT = (
    "You are 8square in Pixiu CyberLab. The student asks about their circuit, but the canvas has 0 components and 0 wires. Explain that the canvas is currently empty and guide them on what components to add."
)


def get_cyberlab_grounding_directive(
    envelope: Optional[Dict[str, Any]] = None,
    compact: bool = False,
) -> str:
    """
    Returns the CYBERLAB_GROUNDING_DIRECTIVE when valid circuit context is present in envelope.
    Distinguishes an empty canvas (0 parts, 0 wires) from an populated circuit with live components.
    """
    if not isinstance(envelope, dict):
        return ""
    circuit = envelope.get("circuit")
    if not isinstance(circuit, dict) or not circuit:
        return ""
    has_data = any(
        circuit.get(k)
        for k in (
            "board", "parts", "wires", "readings", "health_score",
            "issues", "parts_count", "wires_count", "simulator_running"
        )
    )
    if not has_data:
        return ""

    parts = circuit.get("parts") or []
    wires = circuit.get("wires") or []
    parts_count = circuit.get("parts_count", len(parts))
    wires_count = circuit.get("wires_count", len(wires))

    # If canvas is completely empty (no parts and no wires)
    if parts_count == 0 and wires_count == 0:
        content = CYBERLAB_EMPTY_CANVAS_DIRECTIVE_COMPACT if compact else CYBERLAB_EMPTY_CANVAS_DIRECTIVE
        return f"[CYBERLAB GROUNDING DIRECTIVE:\n{content}]"

    content = CYBERLAB_GROUNDING_DIRECTIVE_COMPACT if compact else CYBERLAB_GROUNDING_DIRECTIVE
    return f"[CYBERLAB GROUNDING DIRECTIVE:\n{content}]"


# General academic / STEM / Physics / Chemistry / Math keywords and patterns
_ACADEMIC_STEM_PATTERNS = re.compile(
    r"\b("
    # Kinetic / Potential / Mechanical / Energy with typos and Hinglish
    r"k[ie]n[eai]t[ie]c\s*(?:energy|enerfy|urja)?"
    r"|kitnetic\s*(?:energy|enerfy|urja)?"
    r"|kenetic\s*(?:energy|enerfy|urja)?"
    r"|knetic\s*(?:energy|enerfy|urja)?"
    r"|kintik\s*(?:energy|enerfy|urja)?"
    r"|enerf[yi]"
    r"|gatij\s*(?:urja)?"
    r"|sthitij\s*(?:urja)?"
    r"|poten[ct]ial\s*energy"
    # Physics laws and mechanics
    r"|newton'?s?\s*(?:first|second|third|1st|2nd|3rd|\w+)?\s*(?:law|niyam)?"
    r"|laws?\s+of\s+motion"
    r"|momentum|accelerat[ie]on|velocit[ye]|gravit[ye]|gravitat[ie]on|inertia|friction"
    r"|thermodynamic|entropy|speed\s+of\s+light|relativit[ye]"
    r"|work\s+done|conservation\s+of\s+energy"
    # Chemistry / Biology / Math
    r"|photosynthesis|mitochondria|chemical\s+equation|periodic\s+table"
    r"|pythagor(?:as|ean)|trigonometr|calculus|derivative|integral|quadratic\s+equation"
    r")\b",
    re.IGNORECASE,
)

# Explicit circuit hardware, components, pins, wiring, and canvas tokens
_CIRCUIT_HARDWARE_PATTERNS = re.compile(
    r"\b("
    # Canvas / Screen / Inspection
    r"circuit"
    r"|on\s+(?:the\s+)?canvas|in\s+(?:the\s+)?canvas|workspace"
    r"|see\s+my\s+screen|screen"
    r"|circuit\s+doctor|simulator|simulation"
    # Specific components
    r"|led\d*|resistor\d*|resister\d*|registor\d*|capacitor\d*|buzzer\d*|buzer\d*"
    r"|servo\d*|motor\d*|relay\d*|potentiometer\d*|pot\d*|ldr\d*|sensor\d*"
    r"|pushbutton\d*|switch\d*|diode\d*|breadboard|neopixel|ultrasonic"
    r"|arduino|esp32|pico|microbit"
    # Pins, rails, terminals
    r"|pin\s*[a-d]?\d+|[ad]\d{1,2}\s+pin|pin\b"
    r"|anode|cathode|gpio\d*|pwm|gnd|ground|vcc|5v|3v3|3\.3v|vin|vsys"
    # Wiring and connections
    r"|wire\d*|wires|wiring|taar|wireing"
    r"|connect(?:ed|ing|ion)?|disconnect(?:ed|ing)?|short\s*circuit|open\s*circuit"
    # Component behaviors / fault states
    r"|glow(?:ing)?|jal(?:o)?|blink(?:ing)?|burnout|burned|fused"
    # Code keywords tied to pins/hardware
    r"|pinmode|digitalwrite|digitalread|analogwrite|analogread"
    r")\b",
    re.IGNORECASE,
)


def is_circuit_specific_query(
    prompt: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> bool:
    """
    Query-sensitive context router:
    Returns True if the user question is specifically about the virtual circuit,
    hardware components, pins, wiring, canvas inspection, or simulation.
    Returns False for general educational questions (Physics formulas, Newton's laws,
    definitions, mathematics, biology, chemistry) even if asked inside CyberLab.
    """
    if not prompt or not isinstance(prompt, str):
        return False
    cleaned = prompt.strip()
    if not cleaned:
        return False

    has_hardware_tokens = bool(_CIRCUIT_HARDWARE_PATTERNS.search(cleaned))
    has_academic_tokens = bool(_ACADEMIC_STEM_PATTERNS.search(cleaned))

    # Explicit general educational indicators (e.g. "BHAI KINETIC ENERFY AK FORMULA", "KITNETIC ENERGY")
    if has_academic_tokens:
        # If it asks for an academic concept/formula and does NOT explicitly ask about "my circuit", pins, or wires:
        # e.g., "kinetic energy formula" vs "why is led in my circuit not glowing"
        if not re.search(r"\b(my\s+circuit|mera\s+circuit|on\s+canvas|this\s+circuit|why\s+is\s+my|pin\s*[a-d]?\d+|d\d+|wire|gnd)\b", cleaned, re.IGNORECASE):
            return False

    # Explicit circuit / hardware question
    if has_hardware_tokens:
        return True

    # Multi-turn context resolution:
    # If the current prompt is a short follow-up or affirmative ("what is m?", "units kya hai", "how to fix it", "kar do")
    if history and isinstance(history, list):
        last_asst_content = ""
        for turn in reversed(history):
            if isinstance(turn, dict) and turn.get("role") == "assistant":
                content = turn.get("content") or ""
                if content.strip():
                    last_asst_content = content.strip().lower()
                    break

        if last_asst_content:
            # If the previous assistant message was diagnosing circuit faults (cathode, GND, wiring, pin, etc.)
            last_was_circuit = any(k in last_asst_content for k in [
                "circuit", "diagnos", "fault", "wiring", "cathode", "anode", "gnd", "pin", "wire", "breadboard", "resistor", "led1", "circuit doctor", "wiring mistake"
            ])
            # If the previous assistant message was explaining a general physics/math formula (kinetic energy, newton, etc.)
            last_was_academic = any(k in last_asst_content for k in [
                "kinetic energy", "velocity", "potential energy", "newton", "acceleration", "joule"
            ])

            if last_was_circuit and not last_was_academic:
                # Follow up to circuit diagnosis
                if len(cleaned.split()) <= 8:
                    return True
            elif last_was_academic:
                # Follow up to academic formula (e.g. "what is m here?", "units?")
                return False

    # Default fallback: If no explicit circuit hardware is mentioned, do not assume circuit intent
    return False


_AFFIRMATIVE_PROMPT_PATTERNS = re.compile(
    r"^\s*(?:yes|yeah|yep|yup|sure|ok|okay|k|fine|alright|all\s+right|go\s+ahead|do\s+it|do\s+that|please\s+do|please|yes\s+please|sure\s+thing|of\s+course|definitely|absolutely|proceed|carry\s+on|haan|ha|haa|han|kar\s*do|kardo|kar\s*do\s*bhai|theek\s+hai|thik\s+hai|sahi\s+hai|chalega|bilkul|jaroor|zaroor|karo|kar\s*dijiye)(?:[,\s]+(?:please|kar\s*do|kardo|do\s+it|go\s+ahead|proceed|bhai|yaar|ji|na))*\s*[.!?]*$",
    re.IGNORECASE,
)


def resolve_affirmative_action(
    prompt: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Deterministic Multi-Turn Affirmative Resolution:
    If user prompt is affirmative ("yeah", "yes", "sure", "ok", "haan", "kar do", "do it", etc.)
    and the previous assistant message offered an action (like formatting a formula in LaTeX,
    diagnosing a circuit, or generating code):
    Generate an explicit directive:
    `[AFFIRMATIVE ACTION DIRECTIVE: The student has confirmed and approved the offered action: '{action_summary}'. Immediately execute and complete this action now without asking for permission again. If LaTeX formatting was offered, output the formula using $$...$$ / $...$ and explain symbols if required.]`
    """
    if not prompt or not isinstance(prompt, str):
        return ""
    cleaned = prompt.strip()
    if not _AFFIRMATIVE_PROMPT_PATTERNS.match(cleaned):
        return ""

    if not history or not isinstance(history, list):
        return ""

    last_assistant_msg = ""
    for turn in reversed(history):
        if isinstance(turn, dict) and turn.get("role") == "assistant":
            content = turn.get("content") or ""
            if content.strip():
                last_assistant_msg = content.strip()
                break

    if not last_assistant_msg:
        return ""

    asst_lower = last_assistant_msg.lower()
    has_offer_signal = any(phrase in asst_lower for phrase in [
        "would you like", "should i", "shall i", "do you want",
        "can i", "may i", "want me to", "if you'd like", "if you like",
        "kya aap chahte", "kya main", "kya mai", "kya hum", "batao agar",
        "let me know if you want", "let me know if you'd like",
    ]) or ("?" in asst_lower and any(w in asst_lower for w in ["help", "explain", "format", "write", "check", "diagnose", "show"]))

    if not has_offer_signal:
        return ""

    # Extract specific topic / formula being discussed across the turns
    combined_context = (last_assistant_msg + " " + " ".join(
        t.get("content", "") for t in history if isinstance(t, dict) and t.get("role") == "user"
    )).lower()

    topic = ""
    topic_match = re.search(r"(?:format|calculate|explain|derive)\s+(?:the\s+)?([a-zA-Z0-9_\s\-]+?(?:formula|equation|code|circuit|value))", last_assistant_msg, re.IGNORECASE)
    if topic_match:
        topic = topic_match.group(1).strip()
    elif "kinetic energy" in combined_context:
        topic = "the kinetic energy formula (\\mathrm{KE} = \\frac{1}{2}mv^2)"
    elif "ohm" in combined_context:
        topic = "Ohm's law formula (V = IR)"
    elif "potential energy" in combined_context:
        topic = "the potential energy formula (\\mathrm{PE} = mgh)"

    if any(k in asst_lower for k in ["latex", "formula", "equation", "mathematical notation", "math format", "sutra"]):
        action_summary = f"formatting {topic or 'the formula'} in LaTeX"
    elif any(k in asst_lower for k in ["diagnos", "circuit", "wiring", "connection", "mistake", "error in the circuit", "short circuit", "fault"]):
        action_summary = f"diagnosing {topic or 'the circuit'}"
    elif any(k in asst_lower for k in ["code", "sketch", "python", "blockly", "script", "program", "implementation"]):
        action_summary = f"generating {topic or 'the code'}"
    else:
        m = re.search(r"(?:would you like me to|should i|shall i|do you want me to|want me to|can i)\s+([^?.!\n]+)", last_assistant_msg, re.IGNORECASE)
        if m:
            action_summary = m.group(1).strip()
        else:
            action_summary = "the offered action"

    return (
        f"[AFFIRMATIVE ACTION DIRECTIVE: The student has confirmed and approved the offered action: "
        f"'{action_summary}'. Immediately execute and complete this action now using the earlier conversation context without asking for confirmation, permission or re-entering data. "
        f"If LaTeX formatting was offered, output the formula using $$...$$ / $...$ and explain symbols if required.]"
    )


def get_additive_mode_instruction(mode: XenResponseMode) -> str:
    """Returns the runtime additive formatting directive for the given mode."""
    if mode == XenResponseMode.DEFAULT_EDUCATIONAL:
        return ""
    return ADDITIVE_MODE_DIRECTIVES.get(mode, "")


def sanitize_context_envelope(envelope: Any) -> Dict[str, Any]:
    """
    Sanitizes and extracts safe, non-PII mission and circuit context from client envelope.
    Enforces strict typing, string limits, array bounds, and numerical ranges.
    """
    if not isinstance(envelope, dict):
        return {}

    sanitized: Dict[str, Any] = {}

    def text(value: Any, limit: int) -> str:
        return value[:limit] if isinstance(value, str) else ""

    def items(value: Any, limit: int) -> list:
        return list(value[:limit]) if isinstance(value, (list, tuple)) else []

    def safe_int(value: Any, min_val: int = 0, max_val: int = 1_000_000) -> Optional[int]:
        if type(value) is int and min_val <= value <= max_val:
            return value
        return None

    def safe_float(value: Any, min_val: float = -1e9, max_val: float = 1e9) -> Optional[float]:
        if type(value) in (int, float) and min_val <= value <= max_val:
            return float(value)
        return None

    # 1. Lesson Curriculum
    lesson = envelope.get("lesson")
    if isinstance(lesson, dict):
        clean_lesson: Dict[str, Any] = {}
        for key, limit in (
            ("id", 64), ("title", 128), ("short_title", 128),
            ("description", 300), ("difficulty", 32),
            ("final_goal", 200), ("target_board", 40)
        ):
            val = text(lesson.get(key), limit)
            if val:
                clean_lesson[key] = val
        clean_lesson["concepts"] = [text(c, 64) for c in items(lesson.get("concepts"), 8) if isinstance(c, str)]
        for field in ("steps", "completed_step_ids", "required_parts", "starter_parts"):
            clean_lesson[field] = [text(v, 72) for v in items(lesson.get(field), 16) if isinstance(v, str)]
        step = lesson.get("active_step")
        if isinstance(step, dict):
            clean_lesson["active_step"] = {
                key: text(step.get(key), 180) for key in ("kind", "title", "instructions") if isinstance(step.get(key), str)
            }
        sanitized["lesson"] = clean_lesson

    # 2. Circuit & Simulator Context
    circuit = envelope.get("circuit")
    if isinstance(circuit, dict):
        result: Dict[str, Any] = {
            "diagnostic_source": text(circuit.get("diagnostic_source") or circuit.get("source"), 64) or "static circuit checks",
        }

        # Board extraction: id, name, logic_voltage, power_pins
        board_raw = circuit.get("board") or envelope.get("board")
        if isinstance(board_raw, dict):
            clean_board: Dict[str, Any] = {}
            if board_raw.get("id"):
                clean_board["id"] = text(board_raw["id"], 64)
            if board_raw.get("name"):
                clean_board["name"] = text(board_raw["name"], 64)
            lv = safe_float(board_raw.get("logic_voltage"), 0.0, 24.0)
            if lv is not None:
                clean_board["logic_voltage"] = lv
            if isinstance(board_raw.get("power_pins"), list):
                clean_board["power_pins"] = [text(p, 32) for p in items(board_raw["power_pins"], 16) if isinstance(p, str)]
            elif isinstance(board_raw.get("power_pins"), dict):
                clean_board["power_pins"] = {
                    text(k, 16): [text(p, 32) for p in items(v, 16) if isinstance(p, str)]
                    for k, v in list(board_raw["power_pins"].items())[:8] if isinstance(k, str) and isinstance(v, list)
                }
            if clean_board:
                result["board"] = clean_board
        elif isinstance(board_raw, str) and board_raw.strip():
            result["board"] = {"id": text(board_raw.strip(), 64), "name": text(board_raw.strip(), 64)}

        # Metadata: revision, partial, timestamp
        rev = text(circuit.get("revision") or envelope.get("revision"), 80)
        if rev:
            result["revision"] = rev
        if circuit.get("partial") is True or envelope.get("partial") is True:
            result["partial"] = True
        ts = circuit.get("timestamp") or envelope.get("timestamp")
        if isinstance(ts, (int, float)) and 0 <= ts <= 2e12:
            result["timestamp"] = ts

        # Counts
        parts_count = safe_int(circuit.get("parts_count"))
        if parts_count is not None:
            result["parts_count"] = parts_count
        wires_count = safe_int(circuit.get("wires_count"))
        if wires_count is not None:
            result["wires_count"] = wires_count

        # Health & Simulator State
        sim_running = circuit.get("simulator_running")
        if type(sim_running) is bool:
            result["simulator_running"] = sim_running
        elif type(circuit.get("running")) is bool:
            result["simulator_running"] = circuit["running"]

        health_score = safe_int(circuit.get("health_score"), 0, 100)
        if health_score is not None:
            result["health_score"] = health_score

        critical_count = safe_int(circuit.get("critical_count"), 0, 1000)
        if critical_count is not None:
            result["critical_count"] = critical_count

        warning_count = safe_int(circuit.get("warning_count"), 0, 1000)
        if warning_count is not None:
            result["warning_count"] = warning_count

        # Issues: list of { rule_id, severity, title, message }
        raw_issues = circuit.get("issues")
        if isinstance(raw_issues, list):
            clean_issues = []
            for iss in items(raw_issues, 16):
                if isinstance(iss, dict):
                    clean_issues.append({
                        "rule_id": text(iss.get("rule_id"), 64),
                        "severity": text(iss.get("severity"), 16),
                        "title": text(iss.get("title"), 128),
                        "message": text(iss.get("message"), 256),
                    })
                elif isinstance(iss, str) and iss.strip():
                    clean_issues.append({
                        "rule_id": "diagnostic",
                        "severity": "warning",
                        "title": text(iss.strip(), 128),
                        "message": text(iss.strip(), 256),
                    })
            result["issues"] = clean_issues
        elif isinstance(raw_issues, str) and raw_issues.strip():
            result["issues"] = [{
                "rule_id": "diagnostic",
                "severity": "warning",
                "title": text(raw_issues.strip(), 128),
                "message": text(raw_issues.strip(), 200),
            }]

        # Readings: instrument, value, unit, probeA, probeB, source="simulated"
        clean_readings = []
        for r in items(circuit.get("readings"), 8):
            if not isinstance(r, dict) or r.get("instrument") not in ("multimeter", "oscilloscope"):
                continue
            reading: Dict[str, Any] = {"instrument": r["instrument"], "source": "unknown"}
            if r.get("source") == "simulated" and type(r.get("value")) in (int, float) and -1e9 <= r["value"] <= 1e9:
                reading.update(
                    source="simulated",
                    value=r["value"],
                    unit=text(r.get("unit"), 8),
                    probeA=text(r.get("probeA"), 64),
                    probeB=text(r.get("probeB"), 64),
                )
            clean_readings.append(reading)
        result["readings"] = clean_readings

        # Nodal summary
        ns = circuit.get("nodal_summary")
        if isinstance(ns, dict):
            clean_ns = {}
            for nk, nv in list(ns.items())[:24]:
                if isinstance(nk, str) and type(nv) in (int, float) and -1e6 <= nv <= 1e6:
                    clean_ns[text(nk, 32)] = round(float(nv), 4)
            if clean_ns:
                result["nodal_summary"] = clean_ns
        elif isinstance(ns, str) and ns.strip():
            result["nodal_summary"] = text(ns.strip(), 500)

        # Components (parts): id, type, name, safe props (resistance, color, unit), pins
        clean_parts = []
        for p in items(circuit.get("parts"), 32):
            if isinstance(p, dict):
                clean_part: Dict[str, Any] = {
                    "id": text(p.get("id"), 48),
                    "type": text(p.get("type"), 40),
                }
                if p.get("name"):
                    clean_part["name"] = text(p.get("name"), 64)
                if isinstance(p.get("props"), dict):
                    clean_props = {}
                    for pk, pv in list(p["props"].items())[:12]:
                        if isinstance(pk, str) and len(pk) <= 32:
                            if type(pv) in (int, float) and -1e9 <= pv <= 1e9:
                                clean_props[pk] = pv
                            elif isinstance(pv, str):
                                clean_props[pk] = text(pv, 64)
                            elif isinstance(pv, bool):
                                clean_props[pk] = pv
                    if clean_props:
                        clean_part["props"] = clean_props
                if isinstance(p.get("pins"), list):
                    clean_pins = [text(pin if isinstance(pin, str) else pin.get("id", ""), 32) for pin in items(p["pins"], 32)]
                    if clean_pins:
                        clean_part["pins"] = clean_pins
                clean_parts.append(clean_part)
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                clean_parts.append({
                    "id": text(p[0], 48),
                    "type": text(p[1], 40),
                })
        result["parts"] = clean_parts

        # Connections (wires): from { partId, pinId, label }, to { partId, pinId, label }, net_id, nominal_voltage
        clean_wires = []
        for wire in items(circuit.get("wires"), 64):
            if isinstance(wire, dict) and isinstance(wire.get("from"), dict) and isinstance(wire.get("to"), dict):
                clean_wire: Dict[str, Any] = {
                    "from": {
                        "partId": text(wire["from"].get("partId"), 48),
                        "pinId": text(wire["from"].get("pinId"), 32),
                    },
                    "to": {
                        "partId": text(wire["to"].get("partId"), 48),
                        "pinId": text(wire["to"].get("pinId"), 32),
                    },
                }
                if wire["from"].get("label"):
                    clean_wire["from"]["label"] = text(wire["from"]["label"], 32)
                if wire["to"].get("label"):
                    clean_wire["to"]["label"] = text(wire["to"]["label"], 32)
                if "net_id" in wire and isinstance(wire["net_id"], (int, str)):
                    clean_wire["net_id"] = wire["net_id"] if isinstance(wire["net_id"], int) else text(wire["net_id"], 32)
                if "nominal_voltage" in wire and type(wire["nominal_voltage"]) in (int, float) and -1000 <= wire["nominal_voltage"] <= 1000:
                    clean_wire["nominal_voltage"] = round(float(wire["nominal_voltage"]), 3)
                clean_wires.append(clean_wire)
            elif isinstance(wire, (list, tuple)) and len(wire) >= 2:
                end1, end2 = wire[0], wire[1]
                if isinstance(end1, (list, tuple)) and isinstance(end2, (list, tuple)) and len(end1) >= 2 and len(end2) >= 2:
                    clean_wires.append({
                        "from": {"partId": text(end1[0], 48), "pinId": text(end1[1], 32)},
                        "to": {"partId": text(end2[0], 48), "pinId": text(end2[1], 32)},
                    })
        result["wires"] = clean_wires
        sanitized["circuit"] = result

    # 3. Code & Blockly Context: summary, blocks, pin_bindings
    blockly = envelope.get("blockly") or envelope.get("code")
    if isinstance(blockly, dict):
        clean_blockly: Dict[str, Any] = {
            "summary": text(blockly.get("summary"), 200),
            "blocks": [text(b, 72) for b in items(blockly.get("blocks"), 20) if isinstance(b, str)],
        }
        pb = blockly.get("pin_bindings")
        if isinstance(pb, dict):
            clean_pb = {
                text(k, 16): text(v, 64)
                for k, v in list(pb.items())[:16] if isinstance(k, str) and isinstance(v, str)
            }
            if clean_pb:
                clean_blockly["pin_bindings"] = clean_pb
        elif isinstance(pb, list):
            clean_pb_list = [
                {"pin": text(item.get("pin"), 16), "target": text(item.get("target"), 64)}
                for item in items(pb, 16) if isinstance(item, dict)
            ]
            if clean_pb_list:
                clean_blockly["pin_bindings"] = clean_pb_list
        sanitized["blockly"] = clean_blockly

    return sanitized


def format_context_envelope(envelope: Dict[str, Any], max_chars: int = 2800) -> str:
    """
    Formats the sanitized context envelope into a clean, bounded text prompt prefix.
    Clamped by max_chars (up to 2800) so combined prompt + mode directive + context stays within serving limits.

    Priority-based truncation when len(body) > limit:
    1. Keep board identity and pin map
    2. Keep components and their electrically relevant properties (resistance, color)
    3. Keep connections and netlist
    4. Keep critical health findings and simulator readings
    5. Keep blockly pin bindings
    6. Drop lesson details FIRST (lesson description, steps, concepts, completed_steps, final_goal).
    7. If still over limit, drop non-critical warnings and secondary wires/parts with partial: true and specify omitted_fields.
    Never represents a partial graph as complete.
    """
    if not envelope:
        return ""
    limit = max(0, min(2800, int(max_chars)))
    if limit < 40:
        return ""

    data = {**envelope, "version": 1}
    omitted_fields: List[str] = []

    if "circuit" in data:
        data["circuit"] = dict(data["circuit"])
        circuit = data["circuit"]
        for field, count in (("parts", "parts_count"), ("wires", "wires_count")):
            if len(circuit.get(field, [])) < circuit.get(count, 0):
                circuit["partial"] = True
                omitted_fields.append(f"circuit.{field}")

    def encode(d: Dict[str, Any]) -> str:
        raw = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        for char in "<>":
            raw = raw.replace(char, f"\\u{ord(char):04x}")
        return raw.replace("[MISSION CONTEXT]", "\\u005bMISSION CONTEXT]").replace("[/MISSION CONTEXT]", "\\u005b/MISSION CONTEXT]")

    body = encode(data)
    if len(body) <= limit:
        return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # Priority 6: Drop lesson details FIRST (description, steps, concepts, completed_steps, final_goal)
    if "lesson" in data:
        data["lesson"] = dict(data["lesson"])
        lesson = data["lesson"]
        lesson_fields_to_drop = [
            "final_goal", "description", "steps", "completed_step_ids",
            "concepts", "required_parts", "starter_parts", "active_step"
        ]
        for lfield in lesson_fields_to_drop:
            if lfield in lesson:
                del lesson[lfield]
                omitted_fields.append(f"lesson.{lfield}")
                lesson["partial"] = True
                data["partial"] = True
                data["omitted_fields"] = omitted_fields
                body = encode(data)
                if len(body) <= limit:
                    return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        # If still over limit, reduce lesson to minimal id/title or drop entirely
        if len(lesson) > 2:
            data["lesson"] = {k: lesson[k] for k in ("id", "title") if k in lesson}
            data["lesson"]["partial"] = True
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        del data["lesson"]
        omitted_fields.append("lesson")
        data["partial"] = True
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # Priority 7: If still over limit:
    circuit = data.get("circuit")

    # 7.1 Drop non-critical warnings, keeping critical issues
    if circuit and "issues" in circuit:
        issues = circuit["issues"]
        if isinstance(issues, list):
            critical_issues = [iss for iss in issues if isinstance(iss, dict) and iss.get("severity") == "critical"]
            if len(critical_issues) < len(issues):
                circuit["issues"] = critical_issues
                circuit["partial"] = True
                data["partial"] = True
                omitted_fields.append("circuit.non_critical_issues")
                data["omitted_fields"] = omitted_fields
                body = encode(data)
                if len(body) <= limit:
                    return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.2 Drop nodal summary
    if circuit and "nodal_summary" in circuit:
        del circuit["nodal_summary"]
        circuit["partial"] = True
        data["partial"] = True
        omitted_fields.append("circuit.nodal_summary")
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.3 Drop secondary wires progressively from end
    if circuit and circuit.get("wires"):
        while circuit["wires"] and len(body) > limit:
            circuit["wires"].pop()
            circuit["partial"] = True
            data["partial"] = True
            if "circuit.wires" not in omitted_fields:
                omitted_fields.append("circuit.wires")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.4 Drop blockly blocks (keep pin_bindings)
    if data.get("blockly", {}).get("blocks"):
        data["blockly"]["blocks"] = []
        data["blockly"]["partial"] = True
        data["partial"] = True
        omitted_fields.append("blockly.blocks")
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.5 Drop secondary parts progressively from end (preserving board and essential components)
    if circuit and circuit.get("parts"):
        while len(circuit["parts"]) > 1 and len(body) > limit:
            circuit["parts"].pop()
            circuit["partial"] = True
            data["partial"] = True
            if "circuit.parts" not in omitted_fields:
                omitted_fields.append("circuit.parts")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.6 Drop blockly entirely
    if "blockly" in data:
        del data["blockly"]
        omitted_fields.append("blockly")
        data["partial"] = True
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.7 Drop readings
    if circuit and circuit.get("readings"):
        circuit["readings"] = []
        circuit["partial"] = True
        data["partial"] = True
        omitted_fields.append("circuit.readings")
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.8 Drop remaining parts
    if circuit and circuit.get("parts"):
        circuit["parts"] = []
        circuit["partial"] = True
        data["partial"] = True
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    if len(body) <= limit:
        return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    return ""


def build_xen_effective_prompt(
    prompt: str,
    format_mode: XenResponseMode,
    mode_directive: str = "",
    context_envelope: Optional[Dict[str, Any]] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    max_chars: int = 4000,
) -> str:
    """
    Constructs the authoritative effective prompt with priority budgeting:
    1. Affirmative action directive (if user confirmed an offered action)
    2. CyberLab grounding directive (if valid circuit data is present)
    3. Mode formatting directive (compacted if budget is tight)
    4. Mission & circuit context envelope (dynamically budgeted & priority-truncated)
    5. User prompt text
    Enforces that the combined effective prompt strictly stays <= max_chars.
    """
    max_limit = max(100, int(max_chars))
    is_circuit_query = is_circuit_specific_query(prompt, history)
    affirmative_directive = resolve_affirmative_action(prompt, history)
    has_circuit = bool(context_envelope and context_envelope.get("circuit"))
    grounding_directive = get_cyberlab_grounding_directive(context_envelope) if (has_circuit and is_circuit_query) else ""

    # Mode directive budgeting
    effective_mode_directive = mode_directive or get_additive_mode_instruction(format_mode)
    overhead_so_far = len(prompt) + (len(affirmative_directive) + 2 if affirmative_directive else 0)
    if effective_mode_directive and overhead_so_far + len(effective_mode_directive) + 4 > max_limit:
        compact_directives = {
            "CODE_ONLY": "MODE: CODE ONLY — output only one executable code fence, zero prose.",
            "OUTPUT_ONLY": "MODE: OUTPUT ONLY — return only expected output.",
            "EXPLANATION_ONLY": "MODE: EXPLANATION ONLY — conceptual prose only, no code blocks.",
            "CODE_AND_EXPLANATION": "MODE: CODE + EXPLANATION — working code plus concise explanation.",
            "DEFAULT_EDUCATIONAL": "MODE: Format math as $...$ or $$...$$, bold as **text**.",
        }
        compact = compact_directives.get(format_mode.value, "")
        if compact and overhead_so_far + len(compact) + 4 <= max_limit:
            effective_mode_directive = compact

    mode_overhead = (len(effective_mode_directive) + 4) if effective_mode_directive else 0
    affirmative_overhead = (len(affirmative_directive) + 2) if affirmative_directive else 0
    base_overhead = len(prompt) + mode_overhead + affirmative_overhead

    # Grounding directive budgeting: if room is tight, prefer compact grounding to leave room for context
    effective_grounding = grounding_directive
    if effective_grounding:
        remaining_budget = max_limit - base_overhead - len(effective_grounding) - 94
        if remaining_budget < 500:
            compact_grounding = get_cyberlab_grounding_directive(context_envelope, compact=True)
            if base_overhead + len(compact_grounding) + 2 <= max_limit:
                effective_grounding = compact_grounding
            else:
                effective_grounding = ""

    grounding_overhead = (len(effective_grounding) + 2) if effective_grounding else 0
    total_non_context_overhead = base_overhead + grounding_overhead

    # Budget remaining characters for context envelope:
    # Only include circuit context if this is a circuit-specific query!
    max_context_body = max_limit - total_non_context_overhead - 94
    if is_circuit_query:
        context_prefix = format_context_envelope(context_envelope, max_chars=max_context_body) if max_context_body >= 40 else ""
    else:
        # For general educational questions, do NOT inject circuit data!
        # If envelope has lesson info without circuit, we can format it, but drop the circuit object
        if context_envelope and any(k for k in context_envelope if k != "circuit"):
            non_circuit_envelope = {k: v for k, v in context_envelope.items() if k != "circuit"}
            context_prefix = format_context_envelope(non_circuit_envelope, max_chars=max_context_body) if max_context_body >= 40 else ""
        else:
            context_prefix = ""

    # Assemble parts
    parts = []
    if affirmative_directive:
        parts.append(affirmative_directive)
    if effective_grounding:
        parts.append(effective_grounding)
    if effective_mode_directive:
        mode_str = f"[{effective_mode_directive}]" if not effective_mode_directive.startswith("[") else effective_mode_directive
        parts.append(mode_str)
    if context_prefix:
        parts.append(context_prefix)
    parts.append(prompt)

    effective_prompt = "\n\n".join(parts)

    # Final safety clamp: if still over limit, drop context_prefix
    if len(effective_prompt) > max_limit and context_prefix:
        parts = [p for p in parts if p != context_prefix]
        effective_prompt = "\n\n".join(parts)

    return effective_prompt
