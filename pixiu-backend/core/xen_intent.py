"""
Xen AI Response-Mode Intent Classification and Preference Engine.

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
        if is_small_talk_or_greeting(cleaned_prompt):
            return XenResponseMode.DEFAULT_EDUCATIONAL, "small_talk_default"
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
    "You are Xen, embedded inside Pixiu CyberLab. The application provides a structured live snapshot of the student's active virtual circuit, including placed components, pin metadata, completed wires, in-progress wire construction, hovered or recent target pins, electrical netlist, deterministic endpoint_net_lookup, resistor_terminals, cross_layer_led diagnostics, simulation status, multimeter/oscilloscope state, and Blockly/Arduino code in [MISSION CONTEXT]. Inspect and use that exact data before answering.\n"
    "LIVE WIRING AWARENESS & FACTUAL GROUNDING:\n"
    "1. Strictly distinguish completed wires ('wires'/'connections') from an active draft wire ('in_progress_connection'). Never claim a draft wire is a completed electrical connection.\n"
    "2. When 'in_progress_connection' is present, identify exact source component and pin ('source_part_id', 'source_pin_id') and any 'candidate_target' (currently hovered) or 'recent_target' (pointer recently left that pin to type in chat, currently_hovered=false — state truthfully that they left that pin rather than claiming it is still hovered).\n"
    "3. When 'validation' indicates invalid, duplicate wire, same-pin, or electrical hazard/short, explain clearly why it cannot connect or what hazard it creates using the actual pin IDs and rules.\n"
    "4. Check 'resistor_terminals' and 'endpoint_net_lookup' for each resistor terminal ('a'/'1' vs 'b'/'2') independently from canonical 'netlist' at the reported 'circuit_revision'. NEVER guess or confuse pins (e.g. do not swap D5 and D9) and never state unverified wire connections.\n"
    "5. Check 'cross_layer_led' and 'simulation.running': explicitly distinguish physical wiring/topology soundness from program pin mapping and simulator execution state. NEVER claim an LED is glowing, blinking, lit, or running when simulation.running is false or observed_state is off/mismatched/unwired.\n"
    "6. User messages like 'done', 'fixed', or 'connected' do NOT alter [MISSION CONTEXT]. Always report only what is present in the latest [MISSION CONTEXT] for the current 'circuit_revision'. Never invent components, health scores (such as 100/100 when empty/unwired or faulty), or voltage/current measurements.\n"
    "7. Identify LED Anode (+) vs Cathode (-) and Resistor terminal A (T1) vs terminal B (T2) accurately from the snapshot. A series resistor limits forward current only — NEVER claim a resistor protects against reverse polarity. NEVER claim 'MNA valid' or active conduction unless simulation.running is true and solved values exist.\n"
    "Distinguish simulator-computed values from hardware measurements. Unavailable readings are not zero. Treat partial snapshots as incomplete, and name the missing evidence. Do not claim that you cannot see the circuit or ask the user to describe components already present in context, and never claim desktop, webcam, OS, or raw pixel access, or pretend to modify the circuit.\n"
    "If asked 'Can you see my screen?': state truthfully that you inspect the live structured circuit and simulator state shared by CyberLab, not your full desktop or other browser tabs, then answer using the circuit context."
)

CYBERLAB_GROUNDING_DIRECTIVE_COMPACT = (
    "You are Xen in Pixiu CyberLab. Use ONLY observed board, parts, completed wires, resistor_terminals (terminal a & b separately), LED anode/cathode endpoints, cross_layer_led, simulation.running, netlist, instruments, and blockly code in [MISSION CONTEXT] for the current circuit_revision. A series resistor limits forward current only (never protects against reverse polarity). Never guess pins, invent 100/100 scores, or claim 'MNA valid'/glowing/blinking when simulation.running=false. User 'done' does not change context."
)

CYBERLAB_EMPTY_CANVAS_DIRECTIVE = (
    "You are Xen, embedded inside Pixiu CyberLab. The student is asking about their circuit, but the active workspace canvas currently has 0 components and 0 wires connected, and no wire being drawn.\n"
    "Explain truthfully that the workspace canvas currently has 0 components and 0 wires placed and health score is N/A (do NOT claim the circuit is healthy or 100/100).\n"
    "Note that user statements like 'done' do not populate the canvas if [MISSION CONTEXT] still shows 0 components.\n"
    "Guide the student on what to place first from the component palette (e.g., Arduino Uno, 220-ohm resistor, and LED)."
)

CYBERLAB_EMPTY_CANVAS_DIRECTIVE_COMPACT = (
    "You are Xen in Pixiu CyberLab. Canvas is currently empty (0 components, 0 wires, no draft wire, health_score=N/A). State truthfully it is empty (never 100/100 healthy) and guide what to place first."
)


def _extract_circuit_view(envelope: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(envelope, dict):
        return None
    circuit = envelope.get("circuit")
    if isinstance(circuit, dict) and circuit:
        return circuit
    # Support canonical v3.0 and v2 top-level structures directly
    if any(k in envelope for k in ("components", "connections", "parts", "wires", "board", "in_progress_connection", "diagnostics", "runtime_status", "netlist")):
        return envelope
    return None


def get_cyberlab_grounding_directive(
    envelope: Optional[Dict[str, Any]] = None,
    compact: bool = False,
) -> str:
    """
    Returns the CYBERLAB_GROUNDING_DIRECTIVE when valid circuit context is present in envelope.
    Distinguishes an empty canvas (0 parts, 0 wires, no draft connection) from a populated circuit.
    """
    circuit = _extract_circuit_view(envelope)
    if not circuit:
        return ""
    has_data = any(
        circuit.get(k) is not None
        for k in (
            "board", "parts", "components", "wires", "connections", "readings",
            "health_score", "issues", "diagnostics", "parts_count", "wires_count",
            "simulator_running", "simulation", "in_progress_connection", "hovered_pin",
            "recent_target_pin", "netlist", "runtime_status", "meter", "scope"
        )
    )
    if not has_data:
        return ""

    parts = circuit.get("parts") or circuit.get("components") or []
    wires = circuit.get("wires") or circuit.get("connections") or []
    rt_status = circuit.get("runtime_status") if isinstance(circuit.get("runtime_status"), dict) else {}
    parts_count = circuit.get("parts_count")
    if parts_count is None:
        parts_count = rt_status.get("component_count", len(parts))
    wires_count = circuit.get("wires_count")
    if wires_count is None:
        wires_count = rt_status.get("wire_count", len(wires))

    ipc = circuit.get("in_progress_connection") or (envelope.get("in_progress_connection") if isinstance(envelope, dict) else None)
    has_ipc = isinstance(ipc, dict) and (ipc.get("active") is True or ipc.get("status") in ("draft", "valid", "warning", "invalid"))

    if parts_count == 0 and wires_count == 0 and not has_ipc:
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
    r"|ohm'?s?\s+law|kirchhoff(?:'?s)?\s+(?:law|laws|rule|voltage\s+law|current\s+law)"
    r"|faraday(?:'?s)?\s+law|coulomb(?:'?s)?\s+law|joule(?:'?s)?\s+law"
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
    r"|(?:on|in)\s+(?:the|my|this|our)\s+canvas|canvas|workspace"
    r"|which\s+board|controller\s+board|microcontroller"
    r"|see\s+my\s+screen|screen"
    r"|circuit\s+doctor|simulator|simulation"
    r"|hover(?:ing|ed)?|cursor|pointing\s+at|mouse\s+over|drag(?:ging)?|candidate"
    r"|multimeter|oscilloscope|scope|dmm|continuity|probe\w*|reading\w*|netlist"
    r"|blockly|sketch|terminal\w*|breadboard\s+hole|attach(?:ed|ing)?|placed?"
    r"|draft\s+wire|cancel(?:led|ing)?|select(?:ed|ing)?|deleted?"
    r"|what\s+(?:am\s+i|are\s+we)\s+(?:connecting|wiring|hovering|building|making|creating|working\s+on|selecting|drawing)"
    r"|what\s+have\s+we\s+built|what\s+did\s+(?:i|we)\s+build"
    r"|what(?:'s|\s+is)\s+(?:on\s+(?:the|my|our)\s+(?:canvas|workspace|board)|built)"
    r"|what\s+(?:parts|components|wires|connections)\b"
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


_WORKSPACE_COMPLETION_FOLLOWUP_RE = re.compile(
    r"^\s*(?:i(?:'m|\s+am)?\s+done|done|finished|completed|fixed(?:\s+it)?|connected(?:\s+it)?|wired(?:\s+it)?|check(?:\s+it)?(?:\s+again)?|check\s+now|now\??|ho\s*gaya|kar\s*diya|bana\s*diya)[.!?]*$",
    re.IGNORECASE,
)

_SMALL_TALK_OR_GREETING_RE = re.compile(
    r"^\s*(?:"
    r"(?:hi+|hii+|hey+|hello+|helo|namaste|yo|hola|good\s+(?:morning|afternoon|evening|night))"
    r"(?:\s+(?:xen|bro|bhai|bhaiya|dude|yaar|sir|friend|there))?"
    r"(?:[,\s]+(?:how\s+(?:are|r)\s+(?:you|u)(?:\s+(?:doing|bro|bhai|dude|yaar))?|how'?s\s+it\s+going|what'?s\s+up|wassup|kya\s+haal(?:\s+hai)?|kaise\s+ho))?"
    r"|how\s+(?:are|r)\s+(?:you|u)(?:\s+(?:doing|today|now|bro|bhai|bhaiya|dude|yaar|xen))?"
    r"(?:\s*,?\s*(?:and\s+)?(?:introduce\s+yourself(?:\s+a?\s*lil\s+bit)?|how\s+about\s+you)?)?"
    r"|what'?s\s+up|wassup|kya\s+haal(?:\s+hai)?|kaise\s+ho(?:\s+(?:bhai|bro|xen))?|sab\s+theek(?:\s+hai)?"
    r"|(?:ok(?:ay)?[,\s]+)?(?:thank\s+you|thanks(?:\s+a\s+lot)?|thx|ty|shukriya|dhanyavaad|bahut\s+shukriya)"
    r"(?:\s+(?:xen|bro|bhai|bhaiya|dude|yaar|so\s+much))?"
    r"|you(?:'re|\s+are)\s+(?:awesome|helpful|great|cool)|got\s+it|makes\s+sense|understood"
    r"|(?:cool|nice|awesome|great|amazing)(?:\s+(?:xen|bro|bhai))?"
    r"|bye|goodbye|see\s+(?:you|ya)(?:\s+later)?"
    r"|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|introduce\s+yourself|tell\s+me\s+about\s+yourself"
    r")[,!?\s.]*$",
    re.IGNORECASE,
)


def is_small_talk_or_greeting(prompt: str) -> bool:
    """Returns True for casual social banter/greetings/thanks/identity without circuit intent."""
    if not prompt or not isinstance(prompt, str):
        return False
    cleaned = prompt.strip()
    if not cleaned:
        return False
    if _CIRCUIT_HARDWARE_PATTERNS.search(cleaned) or _WORKSPACE_COMPLETION_FOLLOWUP_RE.match(cleaned):
        return False
    return bool(_SMALL_TALK_OR_GREETING_RE.match(cleaned))


def is_circuit_specific_query(
    prompt: str,
    history: Optional[List[Dict[str, Any]]] = None,
    context_envelope: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Query-sensitive context router:
    Returns True if the user question is specifically about the virtual circuit,
    hardware components, pins, wiring, canvas inspection, or simulation.
    Returns False for general educational questions (Physics formulas, Newton's laws,
    definitions, mathematics, biology, chemistry) and casual small talk even if asked inside CyberLab.
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
        # If it asks for an academic concept/formula and does NOT explicitly ask about "my circuit", pins, components, or wires:
        # e.g., "kinetic energy formula" / "What is Ohm's Law?" vs "why is led1 in my circuit not glowing" / "Why does led1 need a resistor for Ohm's Law?"
        if not re.search(
            r"\b(my\s+circuit|mera\s+circuit|on\s+canvas|this\s+circuit|why\s+is\s+my|led\d*|resistor\d*|arduino|esp32|pico|microbit|breadboard|buzzer\d*|servo\d*|multimeter|oscilloscope|pin\s*[a-d]?\d+|d\d+|a\d|wire\w*|gnd|anode|cathode)\b",
            cleaned,
            re.IGNORECASE,
        ):
            return False

    # Casual greetings, well-being banter, gratitude, farewells, and identity small talk
    # must NEVER receive CyberLab grounding directives, even immediately after a circuit turn.
    if not has_hardware_tokens and _SMALL_TALK_OR_GREETING_RE.match(cleaned):
        return False

    # Explicit circuit / hardware question
    if has_hardware_tokens and not re.fullmatch(r"which arduino pin[.!?]*", cleaned, re.I):
        if re.match(r"^(?:what is (?:a |an )?(?:resistor|led|pin|ground)|define|explain (?:how )?(?:a resistor|leds|resistors|voltage|current))\b", cleaned, re.I) and not re.search(r"\b(?:my|this|our|canvas|workspace)\b", cleaned, re.I):
            return False
        return True

    followup = re.fullmatch(
        r"(?:can you check(?: it| again)?|is (?:it|that) correct|why|what about (?:it|that)|"
        r"how to fix it|check(?: it| again)?|which arduino pin)[.!?]*", cleaned, re.I,
    )
    affirmative = bool(_AFFIRMATIVE_PROMPT_PATTERNS.match(cleaned) and resolve_affirmative_action(cleaned, history))
    if followup or affirmative or _WORKSPACE_COMPLETION_FOLLOWUP_RE.match(cleaned):
        for turn in reversed(history or []):
            if not isinstance(turn, dict) or turn.get("role") != "user":
                continue
            content = turn.get("content") or ""
            if not isinstance(content, str) or not content.strip() or _SMALL_TALK_OR_GREETING_RE.match(content):
                continue
            if _WORKSPACE_COMPLETION_FOLLOWUP_RE.match(content):
                continue
            if is_circuit_specific_query(content):
                return True
            break
        return (
            _extract_circuit_view(context_envelope) is not None
            and bool(re.match(r"^(?:i(?:'m| am)? )?(?:done|finished|completed|fixed|connected|wired|ho gaya|kar diya|bana diya)\b", cleaned, re.I))
        )
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


def first_non_none(*vals: Any) -> Any:
    for v in vals:
        if v is not None:
            return v
    return None


def _canon_pin_py(part_type: str, pin_id: Any, is_board: bool = False) -> str:
    raw = str(pin_id or "").strip().lower()
    if not raw:
        return ""
    ptype = str(part_type or "").strip().lower()
    if ptype == "resistor":
        if raw in ("a", "1", "t1", "pin1", "term1"):
            return "a"
        if raw in ("b", "2", "t2", "pin2", "term2"):
            return "b"
    elif ptype in ("led", "diode"):
        if raw in ("anode", "a", "+", "plus", "pos"):
            return "anode"
        if raw in ("cathode", "k", "c", "-", "minus", "neg"):
            return "cathode"
    elif ptype == "battery":
        if raw in ("pos", "+", "plus", "vcc"):
            return "pos"
        if raw in ("neg", "-", "minus", "gnd"):
            return "neg"
    if is_board or any(b in ptype for b in ("arduino", "uno", "esp32", "pico", "microbit", "nano", "mega")):
        if raw == "led_builtin":
            return "d13"
        if raw in ("v5", "5v"):
            return "5v"
        if raw in ("3v3", "3.3v", "v33"):
            return "3v3"
        if raw == "ground":
            return "gnd"
        if raw.isdigit():
            if "pico" in ptype:
                return f"gp{raw}"
            if "microbit" in ptype:
                return f"p{raw}"
            return f"d{raw}"
    return raw


def _extract_cpp_pin_bindings_py(code_str: str, board_type: str = "arduino-uno") -> List[Dict[str, str]]:
    if not code_str or not isinstance(code_str, str):
        return []
    stripped = re.sub(r"/\*[\s\S]*?\*/", " ", code_str)
    stripped = re.sub(r"//[^\n]*", " ", stripped)
    sym_map: Dict[str, str] = {}
    for m in re.finditer(r"#define\s+([A-Za-z_]\w*)\s+([A-Za-z0-9_]+)", stripped):
        sym_map[m.group(1)] = m.group(2)
    for m in re.finditer(r"\b(?:const\s+)?(?:int|uint8_t|byte)\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z0-9_]+)\s*;", stripped):
        sym_map[m.group(1)] = m.group(2)

    bindings: List[Dict[str, str]] = []
    seen = set()

    def _add(arg: str, mode: str) -> None:
        tok = sym_map.get(arg.strip(), arg.strip())
        canon = _canon_pin_py(board_type, tok, is_board=True)
        if re.match(r"^(?:d\d+|a\d+|gp\d+|gpio\d+|p\d+|tx\d*|rx\d*)$", canon):
            key = (canon, mode)
            if key not in seen:
                seen.add(key)
                bindings.append({"pin": canon, "target": mode})

    for m in re.finditer(r"\bpinMode\s*\(\s*([^,\s)]+)\s*,\s*(INPUT_PULLUP|INPUT|OUTPUT)\s*\)", stripped):
        _add(m.group(1), "OUTPUT" if m.group(2) == "OUTPUT" else "INPUT")
    for m in re.finditer(r"\bdigitalWrite\s*\(\s*([^,\s)]+)\s*,", stripped):
        _add(m.group(1), "OUTPUT")
    for m in re.finditer(r"\banalogWrite\s*\(\s*([^,\s)]+)\s*,", stripped):
        _add(m.group(1), "PWM")
    for m in re.finditer(r"\btone\s*\(\s*([^,\s)]+)\s*,", stripped):
        _add(m.group(1), "PWM")
    return bindings


def _reconcile_deterministic_topology(circuit_res: Dict[str, Any], blockly_res: Optional[Dict[str, Any]] = None) -> None:
    """
    Deterministically computes endpoint_net_lookup, resistor_terminals (A & B independently),
    and cross_layer_led diagnostics from canonical netlist + wires + Blockly/C++ code so legacy
    v2 envelopes or partial payloads receive identical endpoint accuracy as v3 snapshots.
    """
    parts = circuit_res.get("parts") or []
    wires = circuit_res.get("wires") or []
    netlist = circuit_res.get("netlist") or []
    if not isinstance(parts, list):
        return

    part_by_id: Dict[str, Dict[str, Any]] = {}
    board_ids = set()
    board_type = "arduino-uno"
    for p in parts:
        if isinstance(p, dict) and p.get("id"):
            pid = str(p["id"])
            part_by_id[pid] = p
            ptype = str(p.get("type") or "").lower()
            if any(b in ptype for b in ("arduino", "uno", "esp32", "pico", "microbit", "nano", "mega")):
                board_ids.add(pid)
                board_type = ptype
    board_meta = circuit_res.get("board")
    if isinstance(board_meta, dict):
        if board_meta.get("part_id"):
            board_ids.add(str(board_meta["part_id"]))
        elif board_meta.get("id") and board_meta["id"] in part_by_id:
            board_ids.add(str(board_meta["id"]))
        if board_meta.get("id") and "uno" in str(board_meta["id"]).lower():
            board_type = str(board_meta["id"])

    def _canon_ep(part_id: str, pin_id: Any) -> str:
        pid = str(part_id or "").strip()
        p = part_by_id.get(pid, {})
        ptype = str(p.get("type") or "")
        return f"{pid}:{_canon_pin_py(ptype, pin_id, is_board=(pid in board_ids))}"

    direct_peers: Dict[str, set] = {}
    known_eps = set()
    for p in parts:
        if not isinstance(p, dict) or not p.get("id"):
            continue
        pid = str(p["id"])
        ptype = str(p.get("type") or "").lower()
        if ptype == "resistor":
            known_eps.update((f"{pid}:a", f"{pid}:b"))
        elif ptype == "led":
            known_eps.update((f"{pid}:anode", f"{pid}:cathode"))

    for w in wires:
        if not isinstance(w, dict):
            continue
        frm = w.get("from") or {}
        to = w.get("to") or {}
        fpid, fpin = frm.get("partId") or frm.get("part_id"), frm.get("pinId") or frm.get("pin_id")
        tpid, tpin = to.get("partId") or to.get("part_id"), to.get("pinId") or to.get("pin_id")
        if fpid and fpin and tpid and tpin:
            ka = _canon_ep(fpid, fpin)
            kb = _canon_ep(tpid, tpin)
            known_eps.add(ka)
            known_eps.add(kb)
            direct_peers.setdefault(ka, set()).add(kb)
            direct_peers.setdefault(kb, set()).add(ka)

    # Map nets from explicit canonical netlist first, else connected components of wires
    ep_to_net: Dict[str, Dict[str, Any]] = {}
    ep_to_net_id: Dict[str, Any] = {}
    net_members: Dict[str, List[str]] = {}
    if isinstance(netlist, list) and netlist:
        for idx, net in enumerate(netlist):
            if not isinstance(net, dict):
                continue
            nid = first_non_none(net.get("net_id"), net.get("id"), net.get("label"), idx + 1)
            nkey = str(nid)
            raw_pins = net.get("pins") or net.get("pin_keys") or net.get("endpoints") or []
            cset = []
            for rp in raw_pins:
                if isinstance(rp, str) and ":" in rp:
                    pr, pn = rp.split(":", 1)
                    cep = _canon_ep(pr, pn)
                    known_eps.add(cep)
                    ep_to_net[cep] = net
                    ep_to_net_id[cep] = nid
                    if cep not in cset:
                        cset.append(cep)
            net_members[nkey] = sorted(cset)
    elif direct_peers:
        # Derive connected components deterministically when netlist omitted
        visited = set()
        comp_idx = 0
        for start in sorted(direct_peers.keys()):
            if start in visited:
                continue
            comp_idx += 1
            queue = [start]
            comp = []
            visited.add(start)
            while queue:
                cur = queue.pop(0)
                comp.append(cur)
                for nxt in sorted(direct_peers.get(cur, ())):
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)
            is_gnd = any(ep.split(":", 1)[1].startswith("gnd") or ep.endswith(":neg") for ep in comp)
            is_pwr = any(ep.split(":", 1)[1] in ("5v", "3v3", "vin", "vcc", "pos") for ep in comp)
            synth_net = {
                "net_id": comp_idx,
                "name": "GND" if is_gnd else ("VCC" if is_pwr else f"Net-{comp_idx}"),
                "is_ground": is_gnd,
                "is_power": is_pwr,
                "pins": sorted(comp),
            }
            nkey = str(comp_idx)
            net_members[nkey] = sorted(comp)
            for ep in comp:
                ep_to_net[ep] = synth_net
                ep_to_net_id[ep] = comp_idx

    # Populate / reconcile endpoint_net_lookup if not already populated cleanly
    existing_lookup = circuit_res.get("endpoint_net_lookup")
    built_lookup: Dict[str, Dict[str, Any]] = {}
    for ep in sorted(known_eps):
        pid, pin = ep.split(":", 1)
        part = part_by_id.get(pid, {})
        net = ep_to_net.get(ep)
        nid = first_non_none(ep_to_net_id.get(ep), (net or {}).get("net_id"), (net or {}).get("id"), (net or {}).get("label"))
        net_label = first_non_none((net or {}).get("name"), (net or {}).get("label"))
        same_net_all = net_members.get(str(nid), []) if nid is not None else []
        same_net = [k for k in same_net_all if k != ep]
        d_peers = sorted(direct_peers.get(ep, ()))
        is_conn = bool(d_peers or same_net)
        if not is_conn and pid in board_ids:
            continue
        is_gnd = bool(net.get("is_ground") if net else (pin.startswith("gnd") and is_conn))
        is_pwr = bool(net.get("is_power") if net else (pin in ("5v", "3v3", "vin", "vcc") and is_conn))
        board_pins = sorted([k for k in (set(same_net) | set(d_peers)) if k.split(":", 1)[0] in board_ids])
        v_raw = (net or {}).get("solved_voltage")
        if v_raw is None:
            v_raw = (net or {}).get("nominal_voltage")
        built_lookup[ep] = {
            "part_id": pid,
            "part_type": str(part.get("type") or ""),
            "pin_id": pin,
            "net_id": nid,
            "net_name": net_label,
            "is_connected": is_conn,
            "is_power_rail": is_pwr,
            "is_ground_rail": is_gnd,
            "voltage_v": round(float(v_raw), 3) if type(v_raw) in (int, float) else None,
            "direct_peers": d_peers[:12],
            "same_net_endpoints": same_net[:16],
            "board_pins": board_pins[:8],
        }

    # Prefer server-reconciled netlist/wire entries when direct_peers or netlist exist; fill missing from existing_lookup
    if built_lookup:
        if isinstance(existing_lookup, dict):
            for k, v in existing_lookup.items():
                if k not in built_lookup and isinstance(v, dict):
                    built_lookup[k] = v
        circuit_res["endpoint_net_lookup"] = built_lookup

    eff_lookup = circuit_res.get("endpoint_net_lookup") or {}

    # Build/verify resistor_terminals independently for terminal_a and terminal_b
    resistors = sorted(
        [p for p in parts if isinstance(p, dict) and str(p.get("type") or "").lower() == "resistor" and p.get("id")],
        key=lambda x: str(x["id"]),
    )
    if resistors and (wires or netlist or not circuit_res.get("resistor_terminals")):
        rt_list = []
        for r in resistors[:16]:
            rid = str(r["id"])
            ohm = (r.get("props") or {}).get("resistance", 220) if isinstance(r.get("props"), dict) else 220

            def _term_info(side: str) -> Dict[str, Any]:
                entry = eff_lookup.get(f"{rid}:{side}", {})
                return {
                    "pin_id": side,
                    "net_id": entry.get("net_id"),
                    "net_name": entry.get("net_name"),
                    "is_connected": bool(entry.get("is_connected")),
                    "direct_peers": list(entry.get("direct_peers") or []),
                    "same_net_peers": list(entry.get("same_net_endpoints") or []),
                    "board_pins": list(entry.get("board_pins") or []),
                    "voltage_v": entry.get("voltage_v"),
                }

            ta = _term_info("a")
            tb = _term_info("b")

            def _fmt(lbl: str, t: Dict[str, Any]) -> str:
                if not t["is_connected"]:
                    return f"{lbl}->UNCONNECTED"
                peers = t["direct_peers"] or t["same_net_peers"]
                ntag = f"{t['net_name']}(net {t['net_id']})" if t.get("net_name") else f"net {t.get('net_id')}"
                return f"{lbl}->{ntag}:[{','.join(peers)}]"

            rt_list.append({
                "part_id": rid,
                "resistance_ohm": ohm,
                "terminal_a": ta,
                "terminal_b": tb,
                "path_summary": f"{rid}({ohm}ohm): {_fmt('a', ta)} | {_fmt('b', tb)}",
            })
        circuit_res["resistor_terminals"] = rt_list

    # Extract normalized code pins from blockly_res (pin_bindings + code)
    code_pins: List[str] = []
    if isinstance(blockly_res, dict):
        pb = blockly_res.get("pin_bindings")
        if isinstance(pb, list):
            for item in pb:
                if isinstance(item, dict) and item.get("pin"):
                    cp = _canon_pin_py(board_type, item["pin"], is_board=True)
                    if cp and cp not in code_pins:
                        code_pins.append(cp)
        elif isinstance(pb, dict):
            for pk in pb.keys():
                cp = _canon_pin_py(board_type, pk, is_board=True)
                if cp and cp not in code_pins:
                    code_pins.append(cp)
        if not code_pins and isinstance(blockly_res.get("code"), str):
            for cb in _extract_cpp_pin_bindings_py(blockly_res["code"], board_type):
                if cb["pin"] not in code_pins:
                    code_pins.append(cb["pin"])

    # Compute/reconcile cross_layer_led if not supplied (or code/sim updated)
    leds = sorted(
        [p for p in parts if isinstance(p, dict) and str(p.get("type") or "").lower() == "led" and p.get("id")],
        key=lambda x: str(x["id"]),
    )
    if leds and not circuit_res.get("cross_layer_led"):
        sim_obj = circuit_res.get("simulation") if isinstance(circuit_res.get("simulation"), dict) else {}
        sim_running = bool(first_non_none(circuit_res.get("simulator_running"), sim_obj.get("running"), False))
        sim_paused = bool(sim_obj.get("paused", False))
        sim_status = "paused" if (sim_running and sim_paused) else ("running" if sim_running else "ready")
        comp_rt = dict(sim_obj.get("component_runtime") if isinstance(sim_obj.get("component_runtime"), dict) else {})
        rt_out_list = (circuit_res.get("runtime_status") or {}).get("outputs") if isinstance(circuit_res.get("runtime_status"), dict) else None
        if isinstance(rt_out_list, list):
            for out_item in rt_out_list:
                if isinstance(out_item, dict) and out_item.get("part_id"):
                    oid = str(out_item["part_id"])
                    if oid not in comp_rt:
                        st_s = str(out_item.get("state") or "").upper()
                        comp_rt[oid] = {
                            "level": 1.0 if "ILLUMINATED" in st_s else 0.0,
                            **({"currentMa": out_item["current_ma"]}
                               if type(out_item.get("current_ma")) in (int, float)
                               and -1e9 <= out_item["current_ma"] <= 1e9 else {}),
                            "burnt": bool(out_item.get("burnt")),
                        }

        cl_list = []
        passive_types = {"resistor", "pushbutton", "switch", "slide-switch", "diode"}
        power_pin_names = {"gnd", "gnd_l", "gnd_r", "gnd_pwr", "5v", "3v3", "vin", "vcc"}
        for led in leds[:12]:
            lid = str(led["id"])

            def _trace(start_ep: str) -> Dict[str, Any]:
                start = eff_lookup.get(start_ep)
                if not start or not start.get("is_connected"):
                    return {"resistors": [], "gpio": [], "gnd": False, "pwr": False}
                q = [start]
                seen = {start_ep}
                r_ids, g_pins = set(), set()
                has_gnd, has_pwr = False, False
                while q:
                    cur = q.pop(0)
                    if cur.get("is_ground_rail"):
                        has_gnd = True
                    if cur.get("is_power_rail"):
                        has_pwr = True
                    peers = cur.get("same_net_endpoints") or cur.get("direct_peers") or []
                    for pk in peers:
                        if ":" not in pk:
                            continue
                        ppid, ppin = pk.split(":", 1)
                        if ppid in board_ids:
                            pe = eff_lookup.get(pk, {})
                            if ppin not in power_pin_names and not pe.get("is_ground_rail") and not pe.get("is_power_rail"):
                                g_pins.add(ppin)
                            elif ppin.startswith("gnd"):
                                has_gnd = True
                            elif ppin in ("5v", "3v3", "vin"):
                                has_pwr = True
                            continue
                        ppart = part_by_id.get(ppid, {})
                        pptype = str(ppart.get("type") or "").lower()
                        if pptype == "resistor":
                            r_ids.add(ppid)
                        if pptype in passive_types:
                            for cand_k, cand_v in eff_lookup.items():
                                if cand_v.get("part_id") == ppid and cand_k != pk and cand_v.get("is_connected") and cand_k not in seen:
                                    seen.add(cand_k)
                                    q.append(cand_v)
                return {"resistors": sorted(r_ids), "gpio": sorted(g_pins), "gnd": has_gnd, "pwr": has_pwr}

            a_ep = eff_lookup.get(f"{lid}:anode", {})
            c_ep = eff_lookup.get(f"{lid}:cathode", {})
            a_reach = _trace(f"{lid}:anode")
            c_reach = _trace(f"{lid}:cathode")
            a_conn = bool(a_ep.get("is_connected"))
            c_conn = bool(c_ep.get("is_connected"))
            s_res = sorted(set(a_reach["resistors"]) | set(c_reach["resistors"]))
            phys_pins = sorted(set(a_reach["gpio"]) | set(c_reach["gpio"]))
            has_gnd = bool(c_ep.get("is_ground_rail") or c_reach["gnd"])
            rev = bool(a_ep.get("is_ground_rail") and not c_ep.get("is_ground_rail"))
            shorted = a_ep.get("net_id") is not None and a_ep.get("net_id") == c_ep.get("net_id")
            top_ok = bool(a_conn and c_conn and not rev and not shorted and has_gnd and (phys_pins or a_reach["pwr"] or a_ep.get("is_power_rail")))
            ohms = [float((part_by_id[rid].get("props") or {}).get("resistance", 220)) for rid in s_res if rid in part_by_id]
            lrt = comp_rt.get(lid) if isinstance(comp_rt.get(lid), dict) else {}
            burnt = bool(lrt.get("burnt"))
            safety_ok = bool(s_res and not burnt and all(100 <= o <= 100000 for o in ohms))
            matches_code = True
            mismatch_reason = None
            if code_pins and phys_pins:
                matches_code = any(pp in code_pins for pp in phys_pins)
                if not matches_code:
                    mismatch_reason = f"{lid} wired to {','.join(p.upper() for p in phys_pins)} while code targets {','.join(c.upper() for c in code_pins)}."
            cur_ma = float(lrt.get("currentMa", 0) or 0)
            lvl = float(lrt.get("level", 0) or 0)
            if burnt:
                obs = "burnt"
            elif not sim_running:
                obs = "stopped_not_running"
            elif sim_paused:
                obs = "paused"
            elif not top_ok:
                obs = "off_unwired_or_fault"
            elif code_pins and not matches_code:
                obs = "off_code_mismatch"
            elif lvl > 0.05 or cur_ma > 2.0:
                obs = "illuminated"
            else:
                obs = "off_pin_low_or_unstarted"
            cl_list.append({
                "led_id": lid,
                "topology_ok": top_ok,
                "safety_ok": safety_ok,
                "pin_compatibility_ok": bool(phys_pins or a_reach["pwr"]),
                "matches_physical_pin": matches_code,
                "simulation_status": sim_status,
                "observed_state": obs,
                "physical_pins": phys_pins,
                "code_pins": code_pins,
                "series_resistors": s_res,
                "has_ground_return": has_gnd,
                "reversed_polarity": rev,
                "shorted": shorted,
                "mismatch_reason": mismatch_reason,
                **({"current_ma": round(cur_ma, 2)} if "currentMa" in lrt else {}),
                "summary": f"{lid}: topo={'OK' if top_ok else 'FAULT'} phys=[{','.join(phys_pins)}] code=[{','.join(code_pins)}] sim={sim_status} obs={obs}",
            })
        circuit_res["cross_layer_led"] = cl_list


def sanitize_context_envelope(envelope: Any) -> Dict[str, Any]:
    """
    Sanitizes and extracts safe, non-PII mission and circuit context from client envelope.
    Supports both legacy v2.0 nested 'circuit' envelopes and canonical v3.0 top-level snapshots.
    Enforces strict allowlisting, type bounds, non-negative revision preservation (including 0),
    and strict separation of draft vs completed connections.
    """
    if not isinstance(envelope, dict):
        return {}

    sanitized: Dict[str, Any] = {}

    def text(value: Any, limit: int) -> str:
        return value[:limit] if isinstance(value, str) else ""

    def items(value: Any, limit: int) -> list:
        return list(value[:limit]) if isinstance(value, (list, tuple)) else []

    def safe_int(value: Any, min_val: int = 0, max_val: int = 10_000_000) -> Optional[int]:
        if type(value) is int and min_val <= value <= max_val:
            return value
        return None

    def safe_float(value: Any, min_val: float = -1e9, max_val: float = 1e9) -> Optional[float]:
        if type(value) in (int, float) and min_val <= value <= max_val:
            return float(value)
        return None

    def sanitize_pin_ref_or_target(raw_tgt: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(raw_tgt, dict):
            return None
        p_id = text(raw_tgt.get("part_id") or raw_tgt.get("partId"), 48)
        pin_id = text(raw_tgt.get("pin_id") or raw_tgt.get("pinId"), 32)
        if not p_id and not pin_id:
            return None
        out: Dict[str, Any] = {
            "part_id": p_id,
            "pin_id": pin_id,
        }
        canon = text(raw_tgt.get("canonical_pin_id") or raw_tgt.get("canonicalPinId"), 32)
        if canon:
            out["canonical_pin_id"] = canon
        if raw_tgt.get("part_name") or raw_tgt.get("partName"):
            out["part_name"] = text(raw_tgt.get("part_name") or raw_tgt.get("partName"), 64)
        if raw_tgt.get("pin_label") or raw_tgt.get("pinLabel") or raw_tgt.get("label"):
            out["pin_label"] = text(raw_tgt.get("pin_label") or raw_tgt.get("pinLabel") or raw_tgt.get("label"), 32)
        if raw_tgt.get("pin_kind") or raw_tgt.get("pinKind") or raw_tgt.get("kind"):
            out["pin_kind"] = text(raw_tgt.get("pin_kind") or raw_tgt.get("pinKind") or raw_tgt.get("kind"), 20)
        if "currently_hovered" in raw_tgt and type(raw_tgt.get("currently_hovered")) is bool:
            out["currently_hovered"] = raw_tgt["currently_hovered"]
        if raw_tgt.get("left_at"):
            out["left_at"] = text(raw_tgt.get("left_at"), 40)
        if "net_id" in raw_tgt and type(raw_tgt.get("net_id")) is int:
            out["net_id"] = raw_tgt["net_id"]
        if type(raw_tgt.get("voltage")) in (int, float) and -1000 <= raw_tgt["voltage"] <= 1000:
            out["voltage"] = round(float(raw_tgt["voltage"]), 3)
        return out

    # Top-level v3.0 session & monotonic revision metadata
    sid = text(envelope.get("session_id"), 128)
    if sid and re.match(r"^[a-zA-Z0-9._:-]+$", sid):
        sanitized["session_id"] = sid
    sv_top = text(envelope.get("schema_version"), 16)
    if sv_top:
        sanitized["schema_version"] = sv_top
    for rk in ("circuit_revision", "interaction_revision", "state_revision", "event_seq"):
        rv = safe_int(envelope.get(rk))
        if rv is not None:
            sanitized[rk] = rv
    eid = text(envelope.get("event_id"), 128)
    if eid:
        sanitized["event_id"] = eid
    cat = text(envelope.get("captured_at"), 40)
    if cat:
        sanitized["captured_at"] = cat

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

    # 2. Circuit & Simulator Context (accept nested 'circuit' or canonical v3.0 top-level keys)
    circuit_nested = envelope.get("circuit") if isinstance(envelope.get("circuit"), dict) else None
    has_top_v3 = any(
        k in envelope
        for k in ("components", "connections", "parts", "wires", "board", "in_progress_connection", "diagnostics", "runtime_status", "netlist", "pins", "meter", "scope")
    )
    if circuit_nested is not None or has_top_v3:
        circuit = circuit_nested if circuit_nested is not None else envelope
        result: Dict[str, Any] = {
            "diagnostic_source": text(
                first_non_none(circuit.get("diagnostic_source"), circuit.get("source"), envelope.get("diagnostic_source")), 64
            ) or "static circuit checks",
        }

        # Board extraction: None on empty/unplaced canvas, never default to Arduino Uno
        if "board" in circuit or "board" in envelope:
            board_raw = circuit.get("board") if "board" in circuit else envelope.get("board")
            if board_raw is None:
                result["board"] = None
            elif isinstance(board_raw, dict) and (board_raw.get("id") or board_raw.get("name")):
                clean_board: Dict[str, Any] = {}
                if board_raw.get("id"):
                    clean_board["id"] = text(board_raw["id"], 64)
                if board_raw.get("part_id") or board_raw.get("partId"):
                    clean_board["part_id"] = text(board_raw.get("part_id") or board_raw.get("partId"), 48)
                if board_raw.get("name"):
                    clean_board["name"] = text(board_raw["name"], 64)
                if board_raw.get("architecture"):
                    clean_board["architecture"] = text(board_raw["architecture"], 32)
                lv = safe_float(first_non_none(board_raw.get("logic_voltage"), board_raw.get("logicVoltage")), 0.0, 24.0)
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

        # Metadata: session, revision tuple, partial, timestamp
        if "session_id" in sanitized:
            result["session_id"] = sanitized["session_id"]
        rev = text(first_non_none(circuit.get("revision"), envelope.get("revision")), 80)
        if rev:
            result["revision"] = rev
        if circuit.get("partial") is True or envelope.get("partial") is True:
            result["partial"] = True
            omitted = first_non_none(circuit.get("omitted_fields"), envelope.get("omitted_fields"))
            if isinstance(omitted, list):
                result["omitted_fields"] = [text(field, 48) for field in items(omitted, 12)
                                            if isinstance(field, str) and re.fullmatch(r"[a-z_.]+", field)]
        ts = first_non_none(circuit.get("timestamp"), envelope.get("timestamp"))
        if isinstance(ts, (int, float)) and 0 <= ts <= 2e12:
            result["timestamp"] = ts

        rt_status_raw = envelope.get("runtime_status") or circuit.get("runtime_status")
        sim_raw = circuit.get("simulation") if isinstance(circuit.get("simulation"), dict) else (envelope.get("simulation") if isinstance(envelope.get("simulation"), dict) else {})

        # Counts
        parts_raw = first_non_none(circuit.get("parts"), envelope.get("components"), circuit.get("components"))
        wires_raw = first_non_none(circuit.get("wires"), envelope.get("connections"), circuit.get("connections"))
        parts_count = safe_int(first_non_none(circuit.get("parts_count"), rt_status_raw.get("component_count") if isinstance(rt_status_raw, dict) else None))
        if parts_count is not None:
            result["parts_count"] = parts_count
        elif isinstance(parts_raw, list):
            result["parts_count"] = len(parts_raw)
        wires_count = safe_int(first_non_none(circuit.get("wires_count"), rt_status_raw.get("wire_count") if isinstance(rt_status_raw, dict) else None))
        if wires_count is not None:
            result["wires_count"] = wires_count
        elif isinstance(wires_raw, list):
            result["wires_count"] = len(wires_raw)

        # Simulator state & pin_states & runtime outputs
        sim_running = first_non_none(
            circuit.get("simulator_running"),
            circuit.get("running"),
            sim_raw.get("running") if isinstance(sim_raw, dict) else None,
        )
        if type(sim_running) is bool:
            result["simulator_running"] = sim_running
        if isinstance(sim_raw, dict):
            clean_sim: Dict[str, Any] = {}
            if type(sim_raw.get("running")) is bool:
                clean_sim["running"] = sim_raw["running"]
            if type(sim_raw.get("paused")) is bool:
                clean_sim["paused"] = sim_raw["paused"]
            if sim_raw.get("status"):
                clean_sim["status"] = text(sim_raw["status"], 24)
            if isinstance(sim_raw.get("pressed_parts"), list):
                clean_sim["pressed_parts"] = [text(p, 48) for p in items(sim_raw["pressed_parts"], 16) if isinstance(p, str)]
            if isinstance(sim_raw.get("serial_tail"), list):
                clean_sim["serial_tail"] = [text(line, 120) for line in items(sim_raw["serial_tail"], 6) if isinstance(line, str)]
            raw_comp_rt = first_non_none(sim_raw.get("component_runtime"), sim_raw.get("componentRuntime"))
            if isinstance(raw_comp_rt, dict) and raw_comp_rt:
                clean_crt: Dict[str, Any] = {}
                for cpid, cval in list(raw_comp_rt.items())[:24]:
                    if isinstance(cpid, str) and isinstance(cval, dict):
                        c_entry: Dict[str, Any] = {}
                        if type(cval.get("level")) in (int, float):
                            c_entry["level"] = round(float(cval["level"]), 3)
                        current = safe_float(cval.get("currentMa"))
                        if current is not None:
                            c_entry["currentMa"] = round(current, 2)
                        if "burnt" in cval:
                            c_entry["burnt"] = bool(cval["burnt"])
                        if c_entry:
                            clean_crt[text(cpid, 48)] = c_entry
                if clean_crt:
                    clean_sim["component_runtime"] = clean_crt
            if clean_sim:
                result["simulation"] = clean_sim

        raw_pin_states = first_non_none(envelope.get("pin_states"), circuit.get("pin_states"), sim_raw.get("pinStates") if isinstance(sim_raw, dict) else None)
        if isinstance(raw_pin_states, dict) and raw_pin_states:
            clean_pstates: Dict[str, Any] = {}
            for pk, pv in list(raw_pin_states.items())[:24]:
                if isinstance(pk, str) and isinstance(pv, dict):
                    clean_pv: Dict[str, Any] = {}
                    if pv.get("state") is not None:
                        clean_pv["state"] = text(str(pv["state"]), 16)
                    om = pv.get("output_mode") or pv.get("outputMode")
                    if om:
                        clean_pv["output_mode"] = text(om, 24)
                    if type(pv.get("value")) in (int, float) and -1e6 <= pv["value"] <= 1e6:
                        clean_pv["value"] = round(float(pv["value"]), 3)
                    if type(pv.get("angle")) in (int, float):
                        clean_pv["angle"] = round(float(pv["angle"]), 1)
                    if type(pv.get("tone_hz") or pv.get("toneHz")) in (int, float):
                        clean_pv["tone_hz"] = round(float(pv.get("tone_hz") or pv.get("toneHz")), 1)
                    if clean_pv:
                        clean_pstates[text(pk, 24)] = clean_pv
            if clean_pstates:
                result["pin_states"] = clean_pstates

        # Diagnostics / Health Report (preserve structured issues & nullable score on empty/unwired)
        diag_raw = envelope.get("diagnostics") if isinstance(envelope.get("diagnostics"), dict) else (circuit.get("diagnostics") if isinstance(circuit.get("diagnostics"), dict) else None)
        hr_nested = sim_raw.get("healthReport") if isinstance(sim_raw, dict) and isinstance(sim_raw.get("healthReport"), dict) else {}

        health_status = text(first_non_none(diag_raw.get("health_status") if diag_raw else None, hr_nested.get("status")), 24)
        if health_status:
            result["health_status"] = health_status

        hs_raw = first_non_none(diag_raw.get("health_score") if diag_raw else None, circuit.get("health_score"), hr_nested.get("score"))
        if hs_raw is None:
            if health_status in ("empty", "unwired"):
                result["health_score"] = None
        else:
            health_score = safe_int(hs_raw, 0, 100)
            if health_score is not None:
                result["health_score"] = health_score

        critical_count = safe_int(first_non_none(diag_raw.get("critical_count") if diag_raw else None, circuit.get("critical_count"), hr_nested.get("criticalCount")), 0, 1000)
        if critical_count is not None:
            result["critical_count"] = critical_count
        warning_count = safe_int(first_non_none(diag_raw.get("warning_count") if diag_raw else None, circuit.get("warning_count"), hr_nested.get("warningCount")), 0, 1000)
        if warning_count is not None:
            result["warning_count"] = warning_count

        raw_issues = first_non_none(diag_raw.get("issues") if diag_raw else None, circuit.get("issues"), hr_nested.get("issues"))
        if isinstance(raw_issues, list):
            clean_issues = []
            for iss in items(raw_issues, 16):
                if isinstance(iss, dict):
                    item: Dict[str, Any] = {
                        "rule_id": text(iss.get("rule_id") or iss.get("ruleId") or iss.get("id"), 64),
                        "severity": text(iss.get("severity"), 16),
                        "title": text(iss.get("title"), 128),
                        "message": text(iss.get("message"), 256),
                    }
                    if iss.get("category"):
                        item["category"] = text(iss["category"], 24)
                    if iss.get("suggestion"):
                        item["suggestion"] = text(iss["suggestion"], 180)
                    inv_parts = iss.get("involved_part_ids") or iss.get("involvedPartIds")
                    if isinstance(inv_parts, list):
                        item["involved_part_ids"] = [text(p, 48) for p in items(inv_parts, 8) if isinstance(p, str)]
                    inv_pins = iss.get("involved_pin_ids") or iss.get("involvedPinIds")
                    if isinstance(inv_pins, list):
                        item["involved_pin_ids"] = [text(p, 32) for p in items(inv_pins, 8) if isinstance(p, str)]
                    clean_issues.append(item)
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

        if diag_raw and isinstance(diag_raw.get("solver_diagnostics"), list):
            result["solver_diagnostics"] = [
                {
                    "code": text(sd.get("code"), 40),
                    "severity": text(sd.get("severity"), 16),
                    "message": text(sd.get("message"), 200),
                }
                for sd in items(diag_raw["solver_diagnostics"], 8) if isinstance(sd, dict)
            ]

        def measurement_state(raw: Dict[str, Any], configured: bool) -> str:
            state = raw.get("state")
            value = raw.get("value")
            if state in ("unavailable", "invalid", "not_configured"):
                return state
            if not configured:
                return "not_configured"
            if raw.get("source") != "simulated" or state not in (None, "available"):
                return "unavailable"
            if type(value) is not int and type(value) is not float:
                return "invalid"
            return "available" if -1e9 <= value <= 1e9 else "invalid"

        # Meter & Scope (v3.0 telemetry)
        meter_raw = envelope.get("meter") or circuit.get("meter")
        if isinstance(meter_raw, dict):
            state = measurement_state(meter_raw, bool(
                meter_raw.get("red_probe") and meter_raw.get("black_probe") and meter_raw.get("mode") != "off"
            ))
            result["meter"] = {
                "is_open": bool(meter_raw.get("is_open")),
                "mode": text(meter_raw.get("mode"), 24),
                "red_probe": text(meter_raw.get("red_probe"), 64) if meter_raw.get("red_probe") else None,
                "black_probe": text(meter_raw.get("black_probe"), 64) if meter_raw.get("black_probe") else None,
                "state": state,
                "source": "simulated" if state == "available" else "unknown",
                "value": meter_raw["value"] if state == "available" else None,
                "unit": text(meter_raw.get("unit"), 8),
            }
            if meter_raw.get("explanation"):
                result["meter"]["explanation"] = text(meter_raw["explanation"], 180)
        scope_raw = envelope.get("scope") or circuit.get("scope")
        if isinstance(scope_raw, dict):
            result["scope"] = {
                "is_open": bool(scope_raw.get("is_open")),
                "is_hold": bool(scope_raw.get("is_hold")),
                "timebase_label": text(scope_raw.get("timebase_label"), 16),
                "ch1_probe": text(scope_raw.get("ch1_probe"), 64) if scope_raw.get("ch1_probe") else None,
                "ch2_probe": text(scope_raw.get("ch2_probe"), 64) if scope_raw.get("ch2_probe") else None,
            }
            for ch_key in ("ch1", "ch2"):
                ch_val = scope_raw.get(ch_key)
                if isinstance(ch_val, dict) and result["scope"].get(f"{ch_key}_probe"):
                    result["scope"][ch_key] = {
                        k: round(float(ch_val[k]), 3)
                        for k in ("currentV", "vMax", "vMin", "vpp", "frequencyHz", "dutyCyclePct")
                        if type(ch_val.get(k)) in (int, float) and -1e9 <= ch_val[k] <= 1e9
                    }

        # Readings: instrument, value, unit, probeA, probeB, mode, source="simulated"
        clean_readings = []
        for r in items(circuit.get("readings"), 8):
            if not isinstance(r, dict) or r.get("instrument") not in ("multimeter", "oscilloscope"):
                continue
            probe_a = text(r.get("probeA"), 64)
            probe_b = text(r.get("probeB"), 64)
            state = measurement_state(r, bool(probe_a and (probe_b or r["instrument"] == "oscilloscope")))
            reading = {
                "instrument": r["instrument"], "state": state,
                "source": "simulated" if state == "available" else "unknown",
                "unit": text(r.get("unit"), 8), "probeA": probe_a, "probeB": probe_b,
                "mode": text(r.get("mode"), 24), "notes": text(r.get("notes"), 180),
            }
            if state == "available":
                reading["value"] = r["value"]
            clean_readings.append(reading)
        result["readings"] = clean_readings

        # Nodal summary & Runtime status
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

        if isinstance(rt_status_raw, dict):
            clean_rt: Dict[str, Any] = {
                "is_empty": bool(rt_status_raw.get("is_empty")),
                "component_count": safe_int(rt_status_raw.get("component_count")) or 0,
                "wire_count": safe_int(rt_status_raw.get("wire_count")) or 0,
            }
            if type(rt_status_raw.get("total_current_ma")) in (int, float):
                clean_rt["total_current_ma"] = round(float(rt_status_raw["total_current_ma"]), 2)
            if isinstance(rt_status_raw.get("outputs"), list):
                clean_rt["outputs"] = [
                    {
                        "part_id": text(o.get("part_id"), 48),
                        "type": text(o.get("type"), 40),
                        "state": text(o.get("state"), 64),
                        **({"current_ma": safe_float(o.get("current_ma"))}
                           if safe_float(o.get("current_ma")) is not None else {}),
                    }
                    for o in items(rt_status_raw["outputs"], 12) if isinstance(o, dict)
                ]
            result["runtime_status"] = clean_rt

        # Components (parts): id, type, name, safe props, state_summary, bounded pins
        clean_parts = []
        for p in items(parts_raw, 32):
            if isinstance(p, dict):
                clean_part: Dict[str, Any] = {
                    "id": text(p.get("id"), 48),
                    "type": text(p.get("type"), 40),
                }
                if p.get("name"):
                    clean_part["name"] = text(p.get("name"), 64)
                if p.get("state_summary"):
                    clean_part["state_summary"] = text(p.get("state_summary"), 64)
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

        # Component catalogue metadata (deduplicated per placed component type)
        raw_cat_meta = first_non_none(envelope.get("component_catalogue_metadata"), circuit.get("component_catalogue_metadata"))
        if isinstance(raw_cat_meta, dict) and raw_cat_meta:
            clean_cat_meta = {}
            for ck, cv in list(raw_cat_meta.items())[:16]:
                if isinstance(ck, str) and isinstance(cv, dict):
                    entry: Dict[str, Any] = {
                        "type": text(cv.get("type") or ck, 40),
                        "name": text(cv.get("name"), 64),
                        "category": text(cv.get("category"), 32),
                    }
                    ec = cv.get("electrical_contract")
                    if isinstance(ec, dict):
                        entry["electrical_contract"] = {
                            "fidelity": text(ec.get("fidelity"), 24),
                            "note": text(ec.get("note"), 140),
                        }
                    clean_cat_meta[text(ck, 40)] = entry
            if clean_cat_meta:
                result["catalogue_metadata"] = clean_cat_meta

        # Active pins summary (wired / driven / draft / hovered prioritized)
        raw_pins_list = first_non_none(envelope.get("pins"), circuit.get("pins"))
        if isinstance(raw_pins_list, list) and raw_pins_list:
            clean_pins_top = []
            for pv in items(raw_pins_list, 48):
                if isinstance(pv, dict) and (pv.get("part_id") or pv.get("id")):
                    p_entry: Dict[str, Any] = {
                        "id": text(pv.get("id"), 64),
                        "part_id": text(pv.get("part_id"), 48),
                        "pin_id": text(pv.get("pin_id"), 32),
                        "kind": text(pv.get("kind"), 20),
                        "wired": bool(pv.get("wired")),
                    }
                    if "voltage" in pv and type(pv["voltage"]) in (int, float) and -1000 <= pv["voltage"] <= 1000:
                        p_entry["voltage"] = round(float(pv["voltage"]), 3)
                    if "net_id" in pv and type(pv["net_id"]) is int:
                        p_entry["net_id"] = pv["net_id"]
                    if pv.get("is_floating") is True:
                        p_entry["is_floating"] = True
                    if pv.get("is_conflicted") is True:
                        p_entry["is_conflicted"] = True
                    clean_pins_top.append(p_entry)
            if clean_pins_top:
                result["pins"] = clean_pins_top

        # Completed connections (wires): reject any non-complete / draft entries
        clean_wires = []
        for wire in items(wires_raw, 64):
            if isinstance(wire, dict):
                if wire.get("status") and wire.get("status") != "complete":
                    continue
                if isinstance(wire.get("from"), dict) and isinstance(wire.get("to"), dict):
                    clean_wire: Dict[str, Any] = {
                        "from": {
                            "partId": text(wire["from"].get("partId") or wire["from"].get("part_id"), 48),
                            "pinId": text(wire["from"].get("pinId") or wire["from"].get("pin_id"), 32),
                        },
                        "to": {
                            "partId": text(wire["to"].get("partId") or wire["to"].get("part_id"), 48),
                            "pinId": text(wire["to"].get("pinId") or wire["to"].get("pin_id"), 32),
                        },
                        "status": "complete",
                    }
                    if wire.get("id"):
                        clean_wire["id"] = text(wire["id"], 64)
                    if wire["from"].get("label"):
                        clean_wire["from"]["label"] = text(wire["from"]["label"], 32)
                    if wire["to"].get("label"):
                        clean_wire["to"]["label"] = text(wire["to"]["label"], 32)
                    if "net_id" in wire and isinstance(wire["net_id"], (int, str)):
                        clean_wire["net_id"] = wire["net_id"] if isinstance(wire["net_id"], int) else text(wire["net_id"], 32)
                    if "nominal_voltage" in wire and type(wire["nominal_voltage"]) in (int, float) and -1000 <= wire["nominal_voltage"] <= 1000:
                        clean_wire["nominal_voltage"] = round(float(wire["nominal_voltage"]), 3)
                    clean_wires.append(clean_wire)
                elif wire.get("from_part_id") and wire.get("to_part_id"):
                    clean_wire = {
                        "id": text(wire.get("id"), 64),
                        "from": {
                            "partId": text(wire.get("from_part_id"), 48),
                            "pinId": text(wire.get("from_pin_id"), 32),
                        },
                        "to": {
                            "partId": text(wire.get("to_part_id"), 48),
                            "pinId": text(wire.get("to_pin_id"), 32),
                        },
                        "status": "complete",
                    }
                    if "net_id" in wire and isinstance(wire["net_id"], int):
                        clean_wire["net_id"] = wire["net_id"]
                    if wire.get("net_name"):
                        clean_wire["net_name"] = text(wire["net_name"], 32)
                    clean_wires.append(clean_wire)
            elif isinstance(wire, (list, tuple)) and len(wire) >= 2:
                end1, end2 = wire[0], wire[1]
                if isinstance(end1, (list, tuple)) and isinstance(end2, (list, tuple)) and len(end1) >= 2 and len(end2) >= 2:
                    clean_wires.append({
                        "from": {"partId": text(end1[0], 48), "pinId": text(end1[1], 32)},
                        "to": {"partId": text(end2[0], 48), "pinId": text(end2[1], 32)},
                        "status": "complete",
                    })
        result["wires"] = clean_wires

        # Live Canvas Awareness (v2.0 + v3.0): strictly exclude cancelled or completed drafts
        ipc = first_non_none(circuit.get("in_progress_connection"), envelope.get("in_progress_connection"))
        if isinstance(ipc, dict):
            ipc_status = text(ipc.get("status"), 24).lower()
            is_v2_active = ipc.get("active") is True
            is_v3_active = ipc_status in ("draft", "valid", "warning", "invalid")
            if (is_v2_active or is_v3_active) and ipc_status not in ("cancelled", "complete") and ipc.get("active") is not False:
                clean_ipc: Dict[str, Any] = {
                    "active": True,
                    "status": ipc_status or "draft",
                }
                if ipc.get("draft_id"):
                    clean_ipc["draft_id"] = text(ipc["draft_id"], 80)

                src = ipc.get("source")
                if isinstance(src, dict):
                    clean_ipc["source"] = sanitize_pin_ref_or_target(src)
                elif ipc.get("source_part_id"):
                    clean_ipc["source"] = {
                        "part_id": text(ipc.get("source_part_id"), 48),
                        "pin_id": text(ipc.get("source_pin_id"), 32),
                        "canonical_pin_id": text(ipc.get("source_pin_canonical"), 32),
                    }

                cand = sanitize_pin_ref_or_target(ipc.get("candidate_target"))
                if cand:
                    cand["currently_hovered"] = True
                    clean_ipc["candidate_target"] = cand

                recent = sanitize_pin_ref_or_target(ipc.get("recent_target"))
                if recent and not cand:
                    recent["currently_hovered"] = False
                    clean_ipc["recent_target"] = recent

                val = ipc.get("validation")
                if isinstance(val, dict):
                    clean_val: Dict[str, Any] = {
                        "placement_allowed": bool(val.get("placement_allowed")),
                        "compatibility_status": text(val.get("compatibility_status"), 32),
                        "is_same_pin": bool(val.get("is_same_pin")),
                        "is_duplicate_wire": bool(val.get("is_duplicate_wire")),
                        "is_already_same_net": bool(val.get("is_already_same_net")),
                    }
                    if isinstance(val.get("reasons"), list):
                        clean_val["reasons"] = [
                            {
                                "rule_id": text(r.get("rule_id"), 64),
                                "severity": text(r.get("severity"), 16),
                                "title": text(r.get("title"), 100),
                                "message": text(r.get("message"), 200),
                            }
                            for r in items(val["reasons"], 4) if isinstance(r, dict)
                        ]
                    clean_ipc["validation"] = clean_val
                else:
                    vs = text(ipc.get("validation_status"), 24)
                    if vs:
                        clean_ipc["validation_status"] = vs
                    vm = text(ipc.get("validation_message"), 256)
                    if vm:
                        clean_ipc["validation_message"] = vm

                if isinstance(ipc.get("cursor"), dict) and type(ipc["cursor"].get("x")) in (int, float) and type(ipc["cursor"].get("y")) in (int, float):
                    clean_ipc["cursor"] = {
                        "x": round(float(ipc["cursor"]["x"]), 1),
                        "y": round(float(ipc["cursor"]["y"]), 1),
                    }
                color = text(ipc.get("color"), 16)
                if color:
                    clean_ipc["color"] = color
                result["in_progress_connection"] = clean_ipc

        # Hovered component, Hovered pin (currently_hovered=True), Recent target pin (currently_hovered=False)
        hc = first_non_none(circuit.get("hovered_component"), envelope.get("hovered_component"))
        if isinstance(hc, dict) and hc.get("id"):
            result["hovered_component"] = {
                "id": text(hc.get("id"), 48),
                "type": text(hc.get("type"), 40),
                "name": text(hc.get("name"), 64),
            }

        hp = sanitize_pin_ref_or_target(first_non_none(circuit.get("hovered_pin"), envelope.get("hovered_pin")))
        if hp:
            hp["currently_hovered"] = True
            result["hovered_pin"] = hp

        rtp = sanitize_pin_ref_or_target(first_non_none(circuit.get("recent_target_pin"), envelope.get("recent_target_pin")))
        if rtp and not hp:
            rtp["currently_hovered"] = False
            result["recent_target_pin"] = rtp

        # Selected component or wire
        sc = first_non_none(circuit.get("selected_component"), envelope.get("selected_component"))
        if isinstance(sc, dict) and sc.get("id"):
            clean_sc: Dict[str, Any] = {
                "kind": text(sc.get("kind"), 16) or "part",
                "id": text(sc.get("id"), 48),
            }
            if sc.get("type"):
                clean_sc["type"] = text(sc.get("type"), 40)
            if sc.get("name"):
                clean_sc["name"] = text(sc.get("name"), 64)
            result["selected_component"] = clean_sc

        sw = first_non_none(circuit.get("selected_wire"), envelope.get("selected_wire"))
        if isinstance(sw, dict) and sw.get("id"):
            result["selected_wire"] = {
                "id": text(sw.get("id"), 64),
                "from": text(sw.get("from"), 64),
                "to": text(sw.get("to"), 64),
                "color": text(sw.get("color"), 16),
            }

        # Electrical netlist (supports is_power/is_power_rail & is_ground/is_ground_rail)
        raw_netlist = first_non_none(circuit.get("netlist"), envelope.get("netlist"))
        if isinstance(raw_netlist, list):
            clean_netlist = []
            for net in items(raw_netlist, 20):
                if isinstance(net, dict):
                    clean_net: Dict[str, Any] = {}
                    raw_nid = first_non_none(net.get("net_id"), net.get("id"))
                    if raw_nid is not None:
                        clean_net["net_id"] = raw_nid if isinstance(raw_nid, int) else text(raw_nid, 32)
                    raw_nname = first_non_none(net.get("name"), net.get("label"))
                    if raw_nname:
                        clean_net["name"] = text(raw_nname, 32)
                    if type(net.get("nominal_voltage")) in (int, float) and -1000 <= net["nominal_voltage"] <= 1000:
                        clean_net["nominal_voltage"] = round(float(net["nominal_voltage"]), 3)
                    if type(net.get("solved_voltage")) in (int, float) and -1000 <= net["solved_voltage"] <= 1000:
                        clean_net["solved_voltage"] = round(float(net["solved_voltage"]), 3)
                    pins_val = net.get("pins") or net.get("pin_keys") or net.get("endpoints") or []
                    if isinstance(pins_val, list):
                        clean_net["pins"] = [text(k, 48) for k in items(pins_val, 12) if isinstance(k, str)]
                    is_pwr = net.get("is_power") if "is_power" in net else net.get("is_power_rail")
                    if is_pwr is not None:
                        clean_net["is_power"] = bool(is_pwr)
                    is_gnd = net.get("is_ground") if "is_ground" in net else net.get("is_ground_rail")
                    if is_gnd is not None:
                        clean_net["is_ground"] = bool(is_gnd)
                    if "is_floating" in net:
                        clean_net["is_floating"] = bool(net["is_floating"])
                    if "is_conflicted" in net:
                        clean_net["is_conflicted"] = bool(net["is_conflicted"])
                    clean_netlist.append(clean_net)
            if clean_netlist:
                result["netlist"] = clean_netlist

        # Schema version & revisions (preserve 0 cleanly via first_non_none)
        sv = text(first_non_none(circuit.get("schema_version"), envelope.get("schema_version")), 16)
        if sv:
            result["schema_version"] = sv
        sr = safe_int(first_non_none(circuit.get("state_revision"), envelope.get("state_revision")))
        if sr is not None:
            result["state_revision"] = sr
        cr = safe_int(first_non_none(circuit.get("circuit_revision"), envelope.get("circuit_revision")))
        if cr is not None:
            result["circuit_revision"] = cr
        ir = safe_int(first_non_none(circuit.get("interaction_revision"), envelope.get("interaction_revision")))
        if ir is not None:
            result["interaction_revision"] = ir

        # Sanitize Phase 2 endpoint_net_lookup, resistor_terminals, cross_layer_led if supplied
        raw_ep_lookup = first_non_none(circuit.get("endpoint_net_lookup"), envelope.get("endpoint_net_lookup"))
        if isinstance(raw_ep_lookup, dict) and raw_ep_lookup:
            clean_lookup: Dict[str, Any] = {}
            for ep_key, ep_val in list(raw_ep_lookup.items())[:64]:
                if isinstance(ep_key, str) and isinstance(ep_val, dict):
                    ep_nid = ep_val.get("net_id")
                    clean_lookup[text(ep_key, 64)] = {
                        "part_id": text(ep_val.get("part_id"), 48),
                        "part_type": text(ep_val.get("part_type"), 32),
                        "pin_id": text(ep_val.get("pin_id"), 24),
                        "net_id": ep_nid if isinstance(ep_nid, int) else (text(ep_nid, 32) or None),
                        "net_name": text(ep_val.get("net_name"), 32) or None,
                        "is_connected": bool(ep_val.get("is_connected")),
                        "is_power_rail": bool(ep_val.get("is_power_rail")),
                        "is_ground_rail": bool(ep_val.get("is_ground_rail")),
                        "voltage_v": round(float(ep_val["voltage_v"]), 3) if type(ep_val.get("voltage_v")) in (int, float) else None,
                        "direct_peers": [text(p, 48) for p in items(ep_val.get("direct_peers"), 12) if isinstance(p, str)],
                        "same_net_endpoints": [text(p, 48) for p in items(ep_val.get("same_net_endpoints"), 16) if isinstance(p, str)],
                        "board_pins": [text(p, 48) for p in items(ep_val.get("board_pins"), 8) if isinstance(p, str)],
                    }
            if clean_lookup:
                result["endpoint_net_lookup"] = clean_lookup

        raw_res_terms = first_non_none(circuit.get("resistor_terminals"), envelope.get("resistor_terminals"))
        if isinstance(raw_res_terms, list) and raw_res_terms:
            clean_rt = []
            for rt in items(raw_res_terms, 16):
                if isinstance(rt, dict) and rt.get("part_id"):
                    def _clean_side(s_raw: Any, default_pin: str) -> Dict[str, Any]:
                        sr_d = s_raw if isinstance(s_raw, dict) else {}
                        sr_nid = sr_d.get("net_id")
                        return {
                            "pin_id": text(sr_d.get("pin_id"), 12) or default_pin,
                            "net_id": sr_nid if isinstance(sr_nid, int) else (text(sr_nid, 32) or None),
                            "net_name": text(sr_d.get("net_name"), 32) or None,
                            "is_connected": bool(sr_d.get("is_connected")),
                            "direct_peers": [text(p, 48) for p in items(sr_d.get("direct_peers"), 8) if isinstance(p, str)],
                            "same_net_peers": [text(p, 48) for p in items(sr_d.get("same_net_peers"), 12) if isinstance(p, str)],
                            "board_pins": [text(p, 48) for p in items(sr_d.get("board_pins"), 6) if isinstance(p, str)],
                            "voltage_v": round(float(sr_d["voltage_v"]), 3) if type(sr_d.get("voltage_v")) in (int, float) else None,
                        }
                    clean_rt.append({
                        "part_id": text(rt.get("part_id"), 48),
                        "resistance_ohm": rt.get("resistance_ohm", 220),
                        "terminal_a": _clean_side(rt.get("terminal_a"), "a"),
                        "terminal_b": _clean_side(rt.get("terminal_b"), "b"),
                        "path_summary": text(rt.get("path_summary"), 240),
                    })
            if clean_rt:
                result["resistor_terminals"] = clean_rt

        raw_cl = first_non_none(circuit.get("cross_layer_led"), envelope.get("cross_layer_led"))
        if isinstance(raw_cl, list) and raw_cl:
            clean_cl = []
            for cl in items(raw_cl, 12):
                if isinstance(cl, dict) and cl.get("led_id"):
                    clean_cl.append({
                        "led_id": text(cl.get("led_id"), 48),
                        "topology_ok": bool(cl.get("topology_ok")),
                        "safety_ok": bool(cl.get("safety_ok")),
                        "pin_compatibility_ok": bool(cl.get("pin_compatibility_ok")),
                        "matches_physical_pin": bool(cl.get("matches_physical_pin", True)),
                        "simulation_status": text(cl.get("simulation_status"), 16) or "ready",
                        "observed_state": text(cl.get("observed_state"), 32),
                        "physical_pins": [text(p, 24) for p in items(cl.get("physical_pins"), 8) if isinstance(p, str)],
                        "code_pins": [text(p, 24) for p in items(cl.get("code_pins"), 8) if isinstance(p, str)],
                        "series_resistors": [text(p, 32) for p in items(cl.get("series_resistors"), 6) if isinstance(p, str)],
                        "has_ground_return": bool(cl.get("has_ground_return")),
                        "reversed_polarity": bool(cl.get("reversed_polarity")),
                        "shorted": bool(cl.get("shorted")),
                        "mismatch_reason": text(cl.get("mismatch_reason"), 180) or None,
                        **({"current_ma": round(safe_float(cl["current_ma"]), 2)}
                           if safe_float(cl.get("current_ma")) is not None else {}),
                        "summary": text(cl.get("summary"), 200),
                    })
            if clean_cl:
                result["cross_layer_led"] = clean_cl

        sanitized["circuit"] = result

    # 3. Code & Blockly Context: blocks, normalized pin_bindings, bounded code
    raw_circuit_sub = envelope.get("circuit") if isinstance(envelope.get("circuit"), dict) else {}
    blockly = first_non_none(
        envelope.get("blockly_context"),
        envelope.get("blockly"),
        envelope.get("code"),
        raw_circuit_sub.get("code"),
    )
    board_ctx = sanitized.get("circuit", {}).get("board") if isinstance(sanitized.get("circuit"), dict) else None
    board_hint = str((board_ctx or {}).get("id") or "arduino-uno")
    if isinstance(blockly, dict):
        clean_blockly: Dict[str, Any] = {}
        if "has_program" in blockly or "has_code" in blockly:
            clean_blockly["has_program"] = bool(first_non_none(blockly.get("has_program"), blockly.get("has_code")))
        if blockly.get("summary"):
            clean_blockly["summary"] = text(blockly.get("summary"), 200)
        if isinstance(blockly.get("blocks"), list):
            clean_blockly["blocks"] = [text(b, 72) for b in items(blockly.get("blocks"), 20) if isinstance(b, str)]
        if blockly.get("active_step_label"):
            clean_blockly["active_step_label"] = text(blockly.get("active_step_label"), 80)
        raw_code_str = blockly.get("code") or blockly.get("generated_code")
        if isinstance(raw_code_str, str) and raw_code_str.strip():
            clean_blockly["code"] = text(raw_code_str, 500)
        pb = blockly.get("pin_bindings")
        if isinstance(pb, dict):
            clean_pb = {
                text(k, 16): text(v, 64)
                for k, v in list(pb.items())[:16] if isinstance(k, str) and isinstance(v, str)
            }
            if clean_pb:
                clean_blockly["pin_bindings"] = clean_pb
        elif isinstance(pb, list):
            clean_pb_list = []
            for item in items(pb, 16):
                if isinstance(item, dict):
                    raw_pin_tok = text(item.get("pin") or item.get("pin_id") or item.get("pinId"), 16)
                    clean_pb_list.append({
                        "pin": _canon_pin_py(board_hint, raw_pin_tok, is_board=True) if raw_pin_tok else "",
                        "target": text(item.get("target") or item.get("mode") or item.get("configuredMode"), 64),
                    })
            if clean_pb_list:
                clean_blockly["pin_bindings"] = clean_pb_list
        if not clean_blockly.get("pin_bindings") and clean_blockly.get("code"):
            extracted = _extract_cpp_pin_bindings_py(clean_blockly["code"], board_hint)
            if extracted:
                clean_blockly["pin_bindings"] = extracted
        if clean_blockly:
            sanitized["blockly"] = clean_blockly

    if isinstance(sanitized.get("circuit"), dict):
        _reconcile_deterministic_topology(sanitized["circuit"], sanitized.get("blockly"))

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
    omitted_fields: List[str] = list((data.get("circuit") or {}).get("omitted_fields") or [])
    if omitted_fields:
        data["partial"] = True
        data["omitted_fields"] = omitted_fields

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

    # Priority 7: Progressive pruning that NEVER silently drops live draft wiring, board, hovered pin, or primary diagnostics
    circuit = data.get("circuit")

    # 7.0 Drop verbose catalogue metadata, full pin list, and Blockly code body first
    for heavy_key in ("catalogue_metadata", "pins"):
        if circuit and heavy_key in circuit:
            del circuit[heavy_key]
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append(f"circuit.{heavy_key}")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    if circuit and isinstance(circuit.get("parts"), list):
        trimmed_any = False
        for part_entry in circuit["parts"]:
            if isinstance(part_entry, dict) and "pins" in part_entry:
                del part_entry["pins"]
                trimmed_any = True
        if trimmed_any:
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.parts.pins")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

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

    # 7.1.1 Drop inactive/default telemetry, redundant power_pins, and boilerplate Blockly BEFORE wires/parts
    if circuit:
        m = circuit.get("meter")
        if isinstance(m, dict) and not m.get("is_open") and not m.get("red_probe") and not m.get("black_probe"):
            del circuit["meter"]
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.meter")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        sc = circuit.get("scope")
        if isinstance(sc, dict) and not sc.get("is_open") and not sc.get("ch1_probe") and not sc.get("ch2_probe"):
            del circuit["scope"]
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.scope")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        rd = circuit.get("readings")
        if isinstance(rd, list) and (
            not rd
            or all(
                isinstance(r, dict) and not r.get("probeA") and not r.get("probeB") and r.get("value", 0) in (0, 0.0, None)
                for r in rd
            )
        ):
            del circuit["readings"]
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.readings")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        for compact_key in ("runtime_status", "diagnostic_source", "solver_diagnostics"):
            if compact_key in circuit and (compact_key != "solver_diagnostics" or not circuit[compact_key]):
                del circuit[compact_key]
                circuit["partial"] = True
                data["partial"] = True
                omitted_fields.append(f"circuit.{compact_key}")
                data["omitted_fields"] = omitted_fields
                body = encode(data)
                if len(body) <= limit:
                    return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        b_obj = circuit.get("board")
        if isinstance(b_obj, dict) and "power_pins" in b_obj:
            b_obj = dict(b_obj)
            b_obj.pop("power_pins", None)
            circuit["board"] = b_obj
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.board.power_pins")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

        sim = circuit.get("simulation")
        if isinstance(sim, dict) and (len(sim) > 2 or "pressed_parts" in sim or "serial_tail" in sim):
            circuit["simulation"] = {
                "running": bool(sim.get("running", False)),
                "status": sim.get("status", "ready"),
            }
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append("circuit.simulation.details")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.1.2 Drop verbose endpoint_net_lookup & full blockly code/blocks BEFORE resistor_terminals/cross_layer_led/wires
    if circuit and "endpoint_net_lookup" in circuit:
        del circuit["endpoint_net_lookup"]
        circuit["partial"] = True
        data["partial"] = True
        omitted_fields.append("circuit.endpoint_net_lookup")
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    if isinstance(data.get("blockly"), dict) and (data["blockly"].get("blocks") or data["blockly"].get("code")):
        data["blockly"].pop("code", None)
        data["blockly"]["blocks"] = []
        data["blockly"]["partial"] = True
        data["partial"] = True
        omitted_fields.append("blockly.blocks")
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.2 Drop nodal summary, pin_states, active telemetry, netlist BEFORE resistor_terminals & cross_layer_led
    for optional_sub in ("nodal_summary", "pin_states", "readings", "meter", "scope", "runtime_status", "netlist"):
        if circuit and optional_sub in circuit:
            del circuit[optional_sub]
            circuit["partial"] = True
            data["partial"] = True
            omitted_fields.append(f"circuit.{optional_sub}")
            data["omitted_fields"] = omitted_fields
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.3 Drop verbose fields inside resistor_terminals & cross_layer_led (keeping compact summaries & terminal bindings)
    if circuit and isinstance(circuit.get("resistor_terminals"), list):
        compact_rt = [
            rt.get("path_summary") or f"{rt.get('part_id')}:a->{(rt.get('terminal_a') or {}).get('direct_peers')},b->{(rt.get('terminal_b') or {}).get('direct_peers')}"
            for rt in circuit["resistor_terminals"]
            if isinstance(rt, dict)
        ]
        if compact_rt:
            circuit["resistor_terminals"] = compact_rt
            circuit["partial"] = True
            data["partial"] = True
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    if circuit and isinstance(circuit.get("cross_layer_led"), list):
        compact_cl = [
            cl.get("summary") or f"{cl.get('led_id')}:phys={cl.get('physical_pins')},code={cl.get('code_pins')},obs={cl.get('observed_state')}"
            for cl in circuit["cross_layer_led"]
            if isinstance(cl, dict)
        ]
        if compact_cl:
            circuit["cross_layer_led"] = compact_cl
            circuit["partial"] = True
            data["partial"] = True
            body = encode(data)
            if len(body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.4 Drop secondary wires progressively from end
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

    # 7.5 Drop remaining blockly shell if still tight
    if "blockly" in data:
        del data["blockly"]
        if "blockly" not in omitted_fields:
            omitted_fields.append("blockly")
        data["partial"] = True
        data["omitted_fields"] = omitted_fields
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # 7.6 Drop secondary parts progressively from end (preserving board and draft/hovered endpoints)
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

    # 7.7 Drop remaining parts list while ALWAYS keeping live draft wire, hovered/recent pin, board, revision, simulation, resistor_terminals, cross_layer_led, and primary diagnostics
    if circuit and circuit.get("parts"):
        circuit["parts"] = []
        circuit["partial"] = True
        data["partial"] = True
        body = encode(data)
        if len(body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{body}\n[/MISSION CONTEXT]"

    # Ultra-compact critical live floor if still slightly over limit
    if circuit:
        sim_floor = circuit.get("simulation")
        sim_running_flag = bool(
            circuit.get("simulator_running")
            if circuit.get("simulator_running") is not None
            else (sim_floor.get("running") if isinstance(sim_floor, dict) else False)
        )
        rt_floor = [
            rt.get("path_summary") if isinstance(rt, dict) else str(rt)
            for rt in (circuit.get("resistor_terminals") or [])[:4]
        ]
        cl_floor = [
            cl.get("summary") if isinstance(cl, dict) else str(cl)
            for cl in (circuit.get("cross_layer_led") or [])[:4]
        ]
        wire_floor = [
            f"{(w.get('from') or {}).get('partId')}:{(w.get('from') or {}).get('pinId')}->{(w.get('to') or {}).get('partId')}:{(w.get('to') or {}).get('pinId')}"
            for w in (circuit.get("wires") or [])[:8]
            if isinstance(w, dict)
        ]
        critical_summary: Dict[str, Any] = {
            "version": 1,
            "partial": True,
            **({"omitted_fields": list(dict.fromkeys(omitted_fields))} if omitted_fields else {"omitted_fields": ["circuit.parts", "circuit.wires"]}),
            "session_id": data.get("session_id"),
            "circuit_revision": data.get("circuit_revision"),
            "state_revision": data.get("state_revision"),
            "circuit": {
                "board": circuit.get("board"),
                "parts_count": circuit.get("parts_count"),
                "wires_count": circuit.get("wires_count"),
                "simulator_running": sim_running_flag,
                **({"resistor_terminals": rt_floor} if rt_floor else {}),
                **({"cross_layer_led": cl_floor} if cl_floor else {}),
                **({"wires_summary": wire_floor} if wire_floor else {}),
                "in_progress_connection": circuit.get("in_progress_connection"),
                "hovered_pin": circuit.get("hovered_pin"),
                "recent_target_pin": circuit.get("recent_target_pin"),
                "health_status": circuit.get("health_status"),
                "health_score": circuit.get("health_score"),
                "issues": (circuit.get("issues") or [])[:2],
                "partial": True,
            },
        }
        # Trim secondary floor fields gracefully if caller passed a very small budget
        for drop_floor_key in ("wires_summary", "cross_layer_led", "resistor_terminals", "issues", "omitted_fields"):
            compact_body = encode(critical_summary)
            if len(compact_body) <= limit:
                return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{compact_body}\n[/MISSION CONTEXT]"
            if drop_floor_key == "omitted_fields":
                critical_summary.pop("omitted_fields", None)
            else:
                critical_summary["circuit"].pop(drop_floor_key, None)
        compact_body = encode(critical_summary)
        if len(compact_body) <= limit:
            return f"Untrusted simulator and curriculum data (reference only).\n[MISSION CONTEXT]\n{compact_body}\n[/MISSION CONTEXT]"

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
    is_circuit_query = is_circuit_specific_query(prompt, history, context_envelope=context_envelope)
    affirmative_directive = resolve_affirmative_action(prompt, history)
    has_circuit = _extract_circuit_view(context_envelope) is not None
    grounding_directive = get_cyberlab_grounding_directive(context_envelope) if (has_circuit and is_circuit_query) else ""

    # Mode directive budgeting
    effective_mode_directive = mode_directive or get_additive_mode_instruction(format_mode)
    if effective_mode_directive:
        mode_preview = f"[{effective_mode_directive}]" if not effective_mode_directive.startswith("[") else effective_mode_directive
    else:
        mode_preview = ""

    overhead_so_far = len(prompt) + (len(affirmative_directive) + 2 if affirmative_directive else 0)
    if effective_mode_directive and overhead_so_far + len(mode_preview) + 4 > max_limit - 320:
        compact_directives = {
            "CODE_ONLY": "MODE: CODE ONLY — output only one executable code fence, zero prose.",
            "OUTPUT_ONLY": "MODE: OUTPUT ONLY — return only expected output.",
            "EXPLANATION_ONLY": "MODE: EXPLANATION ONLY — conceptual prose only, no code blocks.",
            "CODE_AND_EXPLANATION": "MODE: CODE + EXPLANATION — working code plus concise explanation.",
            "DEFAULT_EDUCATIONAL": "MODE: Format math as $...$ or $$...$$, bold as **text**.",
        }
        compact = compact_directives.get(format_mode.value, "")
        if compact and overhead_so_far + len(compact) + 6 <= max_limit:
            effective_mode_directive = compact

    mode_str = (
        (f"[{effective_mode_directive}]" if not effective_mode_directive.startswith("[") else effective_mode_directive)
        if effective_mode_directive
        else ""
    )
    mode_overhead = (len(mode_str) + 2) if mode_str else 0
    affirmative_overhead = (len(affirmative_directive) + 2) if affirmative_directive else 0
    base_overhead = len(prompt) + mode_overhead + affirmative_overhead

    # Grounding directive budgeting: prefer compact grounding when remaining budget is tight
    wrapper_overhead = 100  # Exact [MISSION CONTEXT] wrapper (95 chars) + "\n\n" separator (2 chars) + safety margin
    effective_grounding = grounding_directive
    if effective_grounding:
        remaining_budget = max_limit - base_overhead - (len(effective_grounding) + 2) - wrapper_overhead
        if remaining_budget < 1100:
            compact_grounding = get_cyberlab_grounding_directive(context_envelope, compact=True)
            if compact_grounding and base_overhead + (len(compact_grounding) + 2) + wrapper_overhead + 120 <= max_limit:
                effective_grounding = compact_grounding
            elif remaining_budget < 120:
                effective_grounding = ""

    grounding_overhead = (len(effective_grounding) + 2) if effective_grounding else 0
    total_non_context_overhead = base_overhead + grounding_overhead

    # Budget remaining characters for context envelope strictly inside max_limit
    max_context_body = max_limit - total_non_context_overhead - wrapper_overhead
    if is_circuit_query and isinstance(context_envelope, dict) and context_envelope:
        context_prefix = format_context_envelope(context_envelope, max_chars=max_context_body) if max_context_body >= 80 else ""
    elif isinstance(context_envelope, dict) and context_envelope:
        non_circuit_envelope = {
            k: v for k, v in context_envelope.items()
            if k in ("lesson", "affirmativeAction", "affirmative_action") and v
        }
        context_prefix = format_context_envelope(non_circuit_envelope, max_chars=max_context_body) if (non_circuit_envelope and max_context_body >= 80) else ""
    else:
        context_prefix = ""

    # Assemble parts
    parts = []
    if affirmative_directive:
        parts.append(affirmative_directive)
    if effective_grounding:
        parts.append(effective_grounding)
    if mode_str:
        parts.append(mode_str)
    if context_prefix:
        parts.append(context_prefix)
    parts.append(prompt)

    effective_prompt = "\n\n".join(parts)

    # Final safety clamp: tighten context_prefix budget if unexpectedly over max_limit rather than blindly deleting first
    if len(effective_prompt) > max_limit and context_prefix:
        overflow = len(effective_prompt) - max_limit
        adjusted_budget = max(0, max_context_body - overflow - 16)
        shrunk_prefix = format_context_envelope(context_envelope, max_chars=adjusted_budget) if adjusted_budget >= 80 else ""
        if shrunk_prefix and len("\n\n".join([*(p for p in parts if p != context_prefix), shrunk_prefix])) <= max_limit:
            parts = [shrunk_prefix if p == context_prefix else p for p in parts]
        else:
            parts = [p for p in parts if p != context_prefix]
        effective_prompt = "\n\n".join(parts)

    return effective_prompt
