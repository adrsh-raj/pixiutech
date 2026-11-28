"""
Xen Post-Generation Grounding Verifier & History Integrity Engine (Phase 2).

Enforces factual grounding of every Xen CyberLab response against authoritative
circuit, netlist, cross-layer LED, Blockly/C++, and simulator runtime evidence.
Supports:
- Authoritative grounding spec derivation from sanitized CyberLab snapshots
- History hygiene (quarantining ungrounded, offline-fallback, error, or
  stale-revision assistant claims so they cannot poison subsequent turns)
- Clause-level & structured factual-claim verification (handling negations,
  imperative suggestions, code fences, endpoint-to-net bindings, independent
  resistor terminal A/B checks, cross-layer LED states, and measurements)
- Single constrained regeneration prompt construction & deterministic fail-closed
  grounded fallback template builder.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
import json
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from core.xen_intent import (
    _canon_pin_py,
    _extract_circuit_view,
    first_non_none,
    format_context_envelope,
    sanitize_context_envelope,
)


_CODE_FENCE_RE = re.compile(r"```[\s\S]*?```")

_SUGGESTION_OR_HYPOTHETICAL_CUE_RE = re.compile(
    r"\b(?:"
    r"place|add|drag|connect|wire|attach|move|swap|change|replace|update|set|try|"
    r"recommend|suggest|should|could|would|need\s+to|must|have\s+to|"
    r"can\s+(?:place|add|connect|wire|use|run|start)|"
    r"if\s+you|once\s+you|after\s+(?:you|fixing|connecting|wiring|starting|changing)|"
    r"when\s+(?:you\s+start|you\s+run|the\s+pin|it\s+goes)|"
    r"to\s+(?:fix|make|let|allow|get|build|test|observe|verify|complete|limit|protect|power)|"
    r"will\s+(?:blink|glow|light|run|flash|turn\s+on|raise|improve|give|draw|flow)|"
    r"expected\s+to|for\s+example|e\.g\.|such\s+as|start\s+with|first,|next\s+step|"
    r"click\s+start|press\s+start|start\s+the\s+simulat|run\s+the\s+simulat|"
    r"jaise|rakhein|lagayein|jodein|karein|karna\s+hoga|chahiye|hona\s+chahiye"
    r")\b",
    re.IGNORECASE,
)

_NEGATION_PREFIX_RE = re.compile(
    r"\b(?:"
    r"no|not|never|none|neither|without|cannot|can't|won't|wouldn't|isn't|aren't|"
    r"doesn't|don't|didn't|haven't|hasn't|nahi|nhi|zero|empty|missing|"
    r"unconnected|disconnected|unwired|not\s+yet|n/a|stopped|paused|off|"
    r"fail(?:ed|s)?\s+to|unable\s+to|cannot\s+observe|can't\s+observe"
    r")\b",
    re.IGNORECASE,
)

_PART_TYPE_ALIASES: Dict[str, Set[str]] = {
    "arduino-uno": {"arduino-uno", "arduino", "uno"},
    "arduino-nano": {"arduino-nano", "arduino", "nano"},
    "arduino-mega": {"arduino-mega", "arduino", "mega"},
    "esp32-devkit": {"esp32-devkit", "esp32"},
    "rpi-pico": {"rpi-pico", "pico", "raspberry pi pico"},
    "microbit": {"microbit", "micro:bit"},
    "resistor": {"resistor", "resistors"},
    "led": {"led", "leds"},
    "pushbutton": {"pushbutton", "button", "switch"},
    "potentiometer": {"potentiometer", "pot"},
    "ultrasonic": {"ultrasonic", "hc-sr04", "hcsr04", "sensor"},
    "servo": {"servo", "servo motor"},
    "buzzer": {"buzzer", "piezo"},
    "breadboard": {"breadboard"},
    "battery": {"battery"},
    "diode": {"diode"},
    "capacitor": {"capacitor"},
}

_INSTANCE_ID_RE = re.compile(
    r"\b(uno\d*|esp32\d*|pico\d*|microbit\d*|led\d+|r\d+|res\d+|resistor\d+|bb\d+|breadboard\d*|"
    r"servo\d+|pot\d+|buzzer\d+|diode\d+|button\d+|pushbutton\d+|switch\d+|sensor\d+|ultrasonic\d+|battery\d+)\b",
    re.IGNORECASE,
)
_ENDPOINT_PAIR_RE = re.compile(r"\b([a-z][a-z0-9_-]{0,24}):([a-z0-9_-]{1,20})\b", re.IGNORECASE)
_GPIO_PIN_RE = re.compile(r"\b(?:pin\s*)?(d\d{1,2}|a\d|gp\d{1,2}|gpio\d{1,2})\b", re.IGNORECASE)

_HEALTH_SCORE_RE = re.compile(
    r"(?:"
    r"\b(\d{1,3})\s*/\s*100\b"
    r"|\bhealth\s+score\s*(?:is|of|:|=|\bis\s+at)?\s*(\d{1,3})\s*(%|/\s*100)?\b"
    r"|\bscore\s*(?:is|of|:|=)\s*(\d{1,3})\s*%"
    r")",
    re.IGNORECASE,
)

_POSITIVE_HEALTHY_RE = re.compile(
    r"\b(?:"
    r"(?:all\s+)?connections\s+(?:are\s+)?intact"
    r"|wiring\s+is\s+(?:intact|complete|correct|valid|healthy|good|sound)"
    r"|circuit\s+is\s+(?:healthy|valid|verified|working|intact|sound|completely\s+functional|functional)"
    r"|(?:no|zero)\s+(?:electrical\s+)?(?:faults|issues|errors|problems|defects)"
    r"|properly\s+wired"
    r"|everything\s+is\s+(?:connected|wired)\s+(?:properly|correctly)"
    r"|sab\s+theek\s+hai"
    r")\b",
    re.IGNORECASE,
)

_TOPOLOGY_ONLY_OK_RE = re.compile(
    r"\b(?:physical\s+wiring|electrical\s+(?:wiring|topology)|hardware\s+wiring)\s+is\s+(?:intact|valid|sound|correct)\b",
    re.IGNORECASE,
)

_UNFOUNDED_MNA_VALID_RE = re.compile(
    r"\b(?:mna\s*(?::|is|status\s*(?:is|:)?)?\s*(?:valid|passed|ok)|solver\s*(?:checks?\s*)?(?:is\s+|are\s+)?(?:valid|passed))\b",
    re.IGNORECASE,
)

_FALSE_REVERSE_PROTECTION_RE = re.compile(
    r"\b(?:"
    r"(?:resistor|resistance|\d+\s*(?:ohm|ohms|ω|kω))\s+(?:[\w\s,-]{0,45}\s+)?"
    r"(?:protects?|guards?|shields?|saves?|prevents?\s+(?:damage|burnout|failure)?(?:\s+from|\s+against)?)\s+"
    r"(?:[\w\s,-]{0,35}\s+)?reverse(?:\s*-\s*|\s+)polarity"
    r"|reverse(?:\s*-\s*|\s+)polarity\s+(?:is\s+)?(?:protected|prevented|safe|harmless)\s+by\s+(?:the\s+|a\s+)?(?:series\s+)?resistor"
    r"|protects?\s+against\s+reverse(?:\s*-\s*|\s+)polarity"
    r")\b",
    re.IGNORECASE,
)

_EMPTY_ASSERTED_PRESENCE_RE = re.compile(
    r"\b(?:"
    r"(?:i\s+(?:can\s+)?see|i\s+found|i\s+detected|there\s+(?:is|are)|your\s+(?:circuit|canvas|workspace)\s+(?:currently\s+)?has|"
    r"you\s+(?:currently\s+)?have|placed\s+on\s+(?:the\s+)?canvas)\s+"
    r"(?:an?\s+|the\s+|your\s+|[1-9]\d*\s+)?(?:arduino|uno|esp32|pico|resistor|led|wire|wires|breadboard|servo|buzzer|potentiometer|components?)"
    r"|(?:is|are)\s+(?:currently\s+)?(?:connected|wired|plugged)\s+(?:to|into|across)\b"
    r")",
    re.IGNORECASE,
)

_RUNTIME_ACTIVE_CLAIM_RE = re.compile(
    r"\b(?:"
    r"(?:is|are|currently)\s+(?:actively\s+|brightly\s+)?(?:blinking|flashing|glowing|lit(?:\s+up)?|illuminated|shining|on)"
    r"|(?:the\s+)?led\d*\s+(?:blinks|flashes|glows|lights\s+up|is\s+on)"
    r"|(?:the\s+)?simulat(?:ion|or)\s+is\s+(?:currently\s+|actively\s+)?running"
    r"|(?:is|are)\s+blinking\s+every\b"
    r")",
    re.IGNORECASE,
)

_PHYSICAL_CONNECTION_VERB_RE = re.compile(
    r"\b(?:"
    r"(?:is|are|was|currently|physically)\s+(?:wired|connected|plugged|attached|routed|tied)\s+(?:to|into|with|on)"
    r"|connects\s+(?:directly\s+)?to"
    r"|goes\s+(?:directly\s+)?to"
    r"|leads?\s+to"
    r"|wire\s+(?:between|from)\s+[a-z0-9_:]+\s+(?:and|to)\s+[a-z0-9_:]+"
    r")\b",
    re.IGNORECASE,
)

_CODE_ONLY_PIN_CLAUSE_RE = re.compile(
    r"\b(?:code|program|sketch|blockly|digitalwrite|analogwrite|pinmode|targets|writing\s+to|drives\s+in\s+code)\b",
    re.IGNORECASE,
)

_NUMERIC_RE = re.compile(
    r"(?<![\w:.])([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*-?\s*"
    r"(millivolts?|milliamps?|milliamperes?|volts?|amperes?|amps?|ohms?|mv|ma|v|a|ω)(?!\w)",
    re.I,
)
_UNIT_NAMES = {
    **dict.fromkeys(("volt", "volts", "v"), "v"),
    **dict.fromkeys(("millivolt", "millivolts", "mv"), "mv"),
    **dict.fromkeys(("milliamp", "milliamps", "milliampere", "milliamperes", "ma"), "ma"),
    **dict.fromkeys(("amp", "amps", "ampere", "amperes", "a"), "a"),
    **dict.fromkeys(("ohm", "ohms", "ω"), "ohm"),
}
_BOARD_PIN = r"(?:gpio\s*\d+|gp\d+|[dap]\d+|gnd(?:[_-][a-z0-9]+)?|ground|5v|v5|3v3|3\.3v|v33|vin|vbus|vsys|aref|tx\d*|rx\d*)"
_BOARD_PIN_RE = re.compile(rf"\b{_BOARD_PIN}\b", re.I)
_NUMERIC_ENDPOINT_RE = re.compile(r"\b[a-z][\w-]*:(?:3\.3v\b|[+-](?!\w)|[a-z0-9_][\w-]*\b)", re.I)
_INSTRUMENT_RE = re.compile(r"\b(multimeter|dmm|meter|oscilloscope|scope|ch\s*[12]|channel\s*[12])\b", re.I)
_READING_RE = re.compile(r"\b(?:measur\w*|read(?:s|ing)?|probe\w*)\b", re.I)
_SIMULATOR_RE = re.compile(r"\b(?:simulat\w*|solver|nodal|simulated)\b", re.I)
_HARDWARE_RE = re.compile(
    r"\b(?:hardware|(?:real|physical|actual)\s+(?:dmm|meter|multimeter|oscilloscope|board|circuit))\b",
    re.I,
)
_NUMERIC_CONTEXT_RE = re.compile(
    r"\b(?:voltage|current|resistance|logic level|potential|draws?|drops?|across|between)\b", re.I,
)
_INSTRUCTION_START_RE = re.compile(
    r"^\s*(?:\*+|[-•])?\s*(?:to\s+(?:start|fix|get started)|"
    r"if\s+(?:you|we)|for example|(?:please\s+)?(?:place|add|use|choose|connect|try|set|replace|move))\b",
    re.I,
)
_NUMERIC_NEGATION_RE = re.compile(
    r"\b(?:not|never|isn't|aren't|doesn't|cannot|can't|nahi|nhi)\s+"
    r"(?:(?:at|reading|read|measure|measuring|equal\s+to|showing)\s+)?$", re.I,
)


def _decimal_value(value: Any) -> Optional[Decimal]:
    if type(value) not in (int, float) or not -1e9 <= value <= 1e9:
        return None
    return Decimal(str(value))


def _unit_name(unit: Any) -> Optional[str]:
    return _UNIT_NAMES.get(str(unit).strip().lower())


class _NumericTopology:
    """Canonical identity from the same revision's reconciled endpoint/net index."""

    def __init__(self, spec: Dict[str, Any]):
        self.spec = spec
        self.endpoints = {}
        self.entries = {}
        self.nets = {}
        for key, entry in spec["endpoint_net_lookup"].items():
            ident = self.canonical(key)
            if ident:
                self.entries[ident] = entry
                self.endpoints[ident] = entry.get("net_id")
        for net in spec["netlist"]:
            net_id = first_non_none(net.get("net_id"), net.get("id"))
            if type(net_id) is not int and not isinstance(net_id, str):
                continue
            self.nets[net_id] = net
            for pin in net.get("pins") or net.get("pin_keys") or net.get("endpoints") or ():
                ident = self.canonical(pin)
                if ident:
                    self.endpoints[ident] = net_id

    def canonical(self, key: Any) -> Optional[Tuple[str, str]]:
        if not isinstance(key, str) or ":" not in key:
            return None
        part, pin = key.lower().strip().split(":", 1)
        if part not in self.spec["component_ids"] or not pin:
            return None
        ptype = self.spec["components_by_id"].get(part, {}).get("type") or (
            (self.spec.get("board") or {}).get("id") if part in self.spec["board_ids"] else ""
        )
        if part in self.spec["board_ids"] and re.fullmatch(r"gpio\s*\d+", pin):
            pin = re.sub(r"^gpio\s*", "", pin)
        return part, _canon_pin_py(ptype or "", pin, is_board=part in self.spec["board_ids"])

    def probe(self, key: Any) -> Optional[Tuple[str, str]]:
        ident = self.canonical(key)
        return ident if ident in self.endpoints else None

    def same(self, one: Tuple[str, str], two: Tuple[str, str]) -> bool:
        net = self.endpoints[one]
        return one == two or (net is not None and net == self.endpoints[two])

    def ground(self, ident: Tuple[str, str]) -> bool:
        net = self.nets.get(self.endpoints[ident], {})
        entry = self.entries.get(ident, {})
        return bool(net.get("is_ground") or entry.get("is_ground_rail") or (
            ident[0] in self.spec["board_ids"] and ident[1].startswith("gnd")
        ))

    def board_pin(self, pin: str) -> Optional[Tuple[str, str]]:
        options = [ident for part in self.spec["board_ids"] if (ident := self.probe(f"{part}:{pin}"))]
        if pin.lower() in {"gnd", "ground"}:
            options += [ident for ident in self.endpoints if ident[0] in self.spec["board_ids"]
                        and ident[1].startswith("gnd") and self.ground(ident)]
        return options[0] if options and all(self.same(options[0], other) for other in options) else None

    def solved_voltage(self, endpoint: Tuple[str, str]) -> Optional[Decimal]:
        net = self.nets.get(self.endpoints[endpoint], {})
        # Endpoint voltage_v can be nominal or a missing-pin sentinel. Use explicitly solved nets.
        if net.get("is_floating") is False and net.get("is_conflicted") is False:
            return _decimal_value(net.get("solved_voltage"))
        return None


def _numeric_claim_subjects(text: str, topology: _NumericTopology):
    endpoint_mentions = [(m.start(), m.end(), topology.probe(m.group())) for m in _NUMERIC_ENDPOINT_RE.finditer(text)]
    # "terminal A of R1" and "R1 terminal A" have the same identity as R1:a.
    named_terminal = re.compile(
        r"\b(?:([a-z][\w-]*)\s+(?:terminal|pin)\s+([ab12]|anode|cathode)\b(?!\s+of\b)|"
        r"(?:terminal\s+)?(anode|cathode|[ab12])\s+of\s+([a-z][\w-]*))\b", re.I,
    )
    for m in named_terminal.finditer(text):
        part, pin = (m[1], m[2]) if m[1] else (m[4], m[3])
        endpoint_mentions.append((m.start(), m.end(), topology.probe(f"{part}:{pin}")))
    for m in _BOARD_PIN_RE.finditer(text):
        if not any(start <= m.start() < end for start, end, _ in endpoint_mentions):
            endpoint_mentions.append((m.start(), m.end(), topology.board_pin(m.group())))
    for m in re.finditer(r"\bpin\s*#?\s*(\d+)\b", text, re.I):
        if not any(start <= m.start() < end for start, end, _ in endpoint_mentions):
            endpoint_mentions.append((m.start(), m.end(), topology.board_pin(m[1])))
    for m in re.finditer(r"\b(?:anode|cathode)\b", text, re.I):
        if not any(start <= m.start() < end for start, end, _ in endpoint_mentions):
            led = [part for part, data in topology.spec["components_by_id"].items() if data.get("type") == "led"]
            endpoint_mentions.append((m.start(), m.end(),
                                      topology.probe(f"{led[0]}:{m.group()}") if len(led) == 1 else None))
    parts = set()
    for match in re.finditer(r"\b[a-z][a-z0-9_-]*\b", text, re.I):
        token = match.group().lower()
        if (token in topology.spec["component_ids"] or _INSTANCE_ID_RE.fullmatch(token)) and not any(
            start <= match.start() < end for start, end, _ in endpoint_mentions
        ):
            parts.add(token)
    endpoints = list(dict.fromkeys(ident for _, _, ident in sorted(endpoint_mentions, key=lambda item: item[0])))
    return endpoints, parts


def _reading_values(spec, topology, unit, instrument, channel, targets, component_pair):
    for reading in spec["readings"]:
        if not isinstance(reading, dict) or reading.get("state") != "available" or reading.get("source") != "simulated":
            continue
        reading_type = reading.get("instrument")
        mode = str(reading.get("mode", "")).strip().lower()
        if _unit_name(reading.get("unit")) != unit or (instrument and reading_type != instrument):
            continue
        value = _decimal_value(reading.get("value"))
        a, b = topology.probe(reading.get("probeA")), topology.probe(reading.get("probeB"))
        if value is None or a is None:
            continue
        if reading_type == "oscilloscope":
            if unit not in {"v", "mv"} or mode not in {"ch1", "ch2"} or (channel and channel != mode):
                continue
            # The synthetic scope samples one node relative to circuit ground.
            configured = spec["scope"].get(f"{mode}_probe")
            if f"{mode}_probe" in spec["scope"] and topology.probe(configured) != a:
                continue
            if component_pair or reading.get("probeB") or (targets and not topology.same(a, targets[0])):
                continue
            if len(targets) == 2 and not topology.ground(targets[1]):
                continue
            yield value
            continue
        modes = {
            "v": {"voltage", "dc_v"}, "mv": {"voltage", "dc_v"},
            "ma": {"current", "ma", "dc_a"}, "a": {"current", "ma", "dc_a"},
            "ohm": {"resistance", "continuity", "ohms"},
        }
        if reading_type != "multimeter" or b is None or mode not in modes.get(unit, ()) or channel:
            continue
        if component_pair and (a[0] != component_pair or b[0] != component_pair):
            continue
        if not targets:
            yield value
        elif len(targets) == 1 and unit in {"v", "mv"}:
            if topology.same(a, targets[0]) and topology.ground(b):
                yield value
            elif topology.same(b, targets[0]) and topology.ground(a):
                yield -value
        elif len(targets) == 2:
            one, two = targets
            equal = topology.same if unit in {"v", "mv"} else lambda x, y: x == y
            if equal(a, one) and equal(b, two):
                yield value
            elif equal(b, one) and equal(a, two) and unit in {"v", "mv", "ohm"}:
                yield -value if unit in {"v", "mv"} else value


def _numeric_candidates(spec, topology, text, unit, endpoints, parts):
    if _HARDWARE_RE.search(text):
        return [], "physical hardware measurements are not available"
    if None in endpoints or len(endpoints) > 2 or (parts - spec["component_ids"]):
        return [], "named pin or component could not be resolved in this snapshot"

    instruments = _INSTRUMENT_RE.findall(text)
    scope_named = any(re.match(r"scope|oscilloscope|ch", name, re.I) for name in instruments)
    meter_named = any(name.lower() in {"meter", "multimeter", "dmm"} for name in instruments)
    channels = {f"ch{c}" for c in re.findall(r"\b(?:ch|channel)\s*(\d+)\b", text, re.I)}
    if (scope_named and meter_named) or len(channels) > 1 or channels - {"ch1", "ch2"}:
        return [], "instrument or channel is ambiguous"
    simulator = bool(_SIMULATOR_RE.search(text))
    instrument = "oscilloscope" if scope_named else "multimeter" if meter_named else None
    named_parts = parts - spec["board_ids"]
    component_pair = None
    generic_part = re.search(r"\bacross\s+(?:the\s+)?(resistor|led|diode)\b", text, re.I)
    if generic_part and not named_parts and not endpoints:
        named_parts = {part for part, data in spec["components_by_id"].items()
                       if data.get("type") == generic_part[1].lower()}
        if len(named_parts) != 1:
            return [], "component for the terminal pair is not unique in this snapshot"
    if len(named_parts) == 1 and not endpoints and re.search(r"\bacross\b", text, re.I):
        part = next(iter(named_parts))
        kind = spec["components_by_id"][part].get("type")
        pins = ("a", "b") if kind == "resistor" else ("anode", "cathode") if kind in {"led", "diode"} else ()
        endpoints = [topology.probe(f"{part}:{pin}") for pin in pins]
        if not pins or None in endpoints:
            return [], "component terminal pair is not established"
        component_pair = part

    if instrument or _READING_RE.search(text) or (not simulator and endpoints):
        if (named_parts and named_parts != ({component_pair} if component_pair else {pin[0] for pin in endpoints if pin[0] in named_parts})):
            return [], "a named component is not bound to the measurement probes"
        values = list(_reading_values(spec, topology, unit, instrument, next(iter(channels), None), endpoints, component_pair))
        if not endpoints and len(values) > 1:
            return [], "multiple readings require an explicit probe or channel"
        return values, "no available instrument reading with matching probe endpoints, reference, mode and unit"

    if simulator:
        if unit == "v" and endpoints and not (named_parts - {pin[0] for pin in endpoints}):
            if len(endpoints) == 1:
                grounds = [pin for pin in topology.endpoints if topology.ground(pin)]
                if not grounds or not all(topology.same(grounds[0], pin) for pin in grounds):
                    return [], "no unique solved ground reference"
                endpoints = [endpoints[0], grounds[0]]
            a, b = map(topology.solved_voltage, endpoints)
            return [a - b] if a is not None and b is not None else [], "no solved voltage for the named endpoints"
        if unit == "ma" and not endpoints and len(named_parts) == 1 and spec["simulation_running"] and not spec["simulation_paused"]:
            part = next(iter(named_parts))
            runtime = spec["component_runtime"].get(part, {})
            values = [_decimal_value(runtime.get("currentMa"))] if isinstance(runtime, dict) else []
            values.extend(_decimal_value(led.get("current_ma")) for led in spec["cross_layer_led"]
                          if str(led.get("led_id")).lower() == part and led.get("simulation_status") == "running")
            available = [v for v in values if v is not None]
            return available if len(set(available)) <= 1 else [], "no consistent active simulator current for this component"
        return [], "no matching structured simulator fact for this subject and unit"

    if not endpoints and unit == "ohm" and re.search(r"\b(?:resistor|nominal|resistance)\b", text, re.I):
        resistors = [(part, row) for part, row in spec["components_by_id"].items()
                     if row.get("type") == "resistor" and (not named_parts or part in named_parts)]
        if len(resistors) == 1 and len(named_parts) <= 1:
            _, resistor = resistors[0]
            props = resistor.get("props") or {}
            value = _decimal_value(props.get("resistance"))
            return [value] if value is not None else [], "no explicit nominal resistance for the named resistor"
    if not endpoints and unit == "v" and not named_parts and len(spec["board_ids"]) == 1 and re.search(
        r"\blogic\s+(?:voltage|level)\b", text, re.I,
    ):
        value = _decimal_value(spec["logic_voltage"])
        return [value] if value is not None else [], "no documented board logic voltage"
    return [], "no explicit component property or numeric evidence for this claim"


def _nominal_resistor_rating_candidates(spec: Dict[str, Any], prefix: str, tail: str, named_parts: Set[str]):
    """Resolves explicit nominal resistor rating syntax (e.g., 'r1(220ohm)', '220-ohm resistor') when not framed as a probe reading."""
    paren_part = re.search(r"\b([a-z][a-z0-9_-]*)\s*\(\s*$", prefix, re.I)
    if paren_part and re.match(r"^\s*\)", tail):
        pid = paren_part.group(1).lower()
        row = spec["components_by_id"].get(pid)
        if not row or str(row.get("type") or "").lower() != "resistor":
            return [], "parenthesized resistance refers to an unknown or non-resistor component"
        value = _decimal_value((row.get("props") or {}).get("resistance"))
        return [value] if value is not None else [], "no explicit nominal resistance for the named resistor"

    if re.match(r"^\s*-?\s*resistors?\b", tail, re.I) and not re.search(r"\b(?:across|between)\s*$", prefix, re.I):
        after_word = re.match(r"^\s*-?\s*resistors?\s+([a-z][a-z0-9_-]*)\b", tail, re.I)
        res_targets: List[Dict[str, Any]] = []
        if after_word and after_word.group(1).lower() in spec["components_by_id"]:
            pid = after_word.group(1).lower()
            row = spec["components_by_id"][pid]
            if str(row.get("type") or "").lower() == "resistor":
                res_targets = [row]
            else:
                return [], "named component adjacent to ohm label is not a resistor"
        else:
            named_res = [
                spec["components_by_id"][p] for p in named_parts
                if p in spec["components_by_id"] and str(spec["components_by_id"][p].get("type") or "").lower() == "resistor"
            ]
            if len(named_res) == 1:
                res_targets = named_res
            elif not named_res:
                res_targets = [row for row in spec["components_by_id"].values() if str(row.get("type") or "").lower() == "resistor"]
        if len(res_targets) == 1:
            value = _decimal_value((res_targets[0].get("props") or {}).get("resistance"))
            return [value] if value is not None else [], "no explicit nominal resistance for the resistor"

    return None, None


def _numeric_grounding(clause: str, topology: _NumericTopology):
    # Isolate independent assertions without splitting endpoint lists such as "between A and B".
    chunks = re.split(
        r"(?:,\s*|\s+and\s+)(?=(?:the\s+)?[\w:-]+\s+(?:is|reads|measures|shows|draws)\b)"
        r"|\s+(?:but|while)\s+",
        clause.replace("**", "").replace("`", ""),
        flags=re.I,
    )
    for text in chunks:
        matches = list(_NUMERIC_RE.finditer(text))
        for match in matches:
            prefix = text[:match.start()]
            tail = text[match.end():]
            # 5V/3.3V can name a terminal in a probe pair, rather than a second measurement.
            raw = match.group().lower()
            if raw in {"5v", "3.3v"}:
                if re.match(r"\s+(?:is|reads|measures|shows)\b", tail, re.I):
                    continue
                if re.search(r"\b(?:on|at|between|and|from|to|across)\s*$", prefix, re.I) and (
                    re.match(r"\s+(?:and|to|relative)\b", tail, re.I) or len(matches) > 1
                ):
                    continue
            if _NUMERIC_NEGATION_RE.search(prefix):
                continue
            subject_text = prefix + " " + tail
            endpoints, parts = _numeric_claim_subjects(subject_text, topology)
            signalled = bool(endpoints or parts or _INSTRUMENT_RE.search(text) or
                             _NUMERIC_CONTEXT_RE.search(text) or _READING_RE.search(text) or _HARDWARE_RE.search(text))
            if not signalled:
                continue
            if _INSTRUCTION_START_RE.search(text) and not re.search(
                r"\b(?:reads|measures|shows|draws|is at|has)\b", text, re.I,
            ):
                continue
            unit = _unit_name(match[2])
            try:
                value = Decimal(match[1])
            except InvalidOperation:
                yield False, f"{match.group()}: numeric value is outside the supported range"
                continue
            if re.search(r"\b(?:minus|negative)\s*$", prefix, re.I):
                value = -abs(value)
            candidates, reason = (None, None)
            if (
                unit == "ohm"
                and not _HARDWARE_RE.search(text)
                and not _INSTRUMENT_RE.search(text)
                and not _READING_RE.search(text)
                and not _SIMULATOR_RE.search(text)
            ):
                candidates, reason = _nominal_resistor_rating_candidates(topology.spec, prefix, tail, parts - topology.spec["board_ids"])
            if candidates is None and reason is None:
                candidates, reason = _numeric_candidates(topology.spec, topology, subject_text, unit, endpoints, parts)
            supported = abs(value) <= 1_000_000_000 and any(
                abs(value - expected) <= max(Decimal("0.005"), abs(expected) / 100)
                for expected in candidates
            )
            if candidates and not supported:
                reason = "matching evidence has a different numerical value"
            yield supported, f"{match.group()}: {reason}" if not supported else f"Verified {match.group()} against the identified evidence."


def build_authoritative_grounding_spec(envelope: Any) -> Dict[str, Any]:
    """
    Derives a deterministic, immutable ground-truth specification dictionary
    from a raw or sanitized CyberLab context envelope.
    """
    if not isinstance(envelope, dict) or not envelope:
        return {"has_circuit": False}

    # Sanitize & deterministically reconcile endpoint_net_lookup, resistor_terminals, cross_layer_led
    needs_sanitize = (
        not isinstance(envelope.get("circuit"), dict)
        or envelope.get("circuit", {}).get("endpoint_net_lookup") is None
        or envelope.get("circuit", {}).get("resistor_terminals") is None
    )
    sanitized = sanitize_context_envelope(envelope) if needs_sanitize else dict(envelope)
    circuit = sanitized.get("circuit")
    if not isinstance(circuit, dict):
        circuit_view = _extract_circuit_view(envelope)
        if not isinstance(circuit_view, dict):
            return {"has_circuit": False}
        sanitized = sanitize_context_envelope({"circuit": circuit_view})
        circuit = sanitized.get("circuit")
        if not isinstance(circuit, dict):
            return {"has_circuit": False}

    has_data = any(
        circuit.get(k) is not None
        for k in (
            "board", "parts", "wires", "readings", "health_score", "health_status",
            "issues", "parts_count", "wires_count", "simulator_running", "simulation",
            "in_progress_connection", "hovered_pin", "recent_target_pin", "netlist",
            "runtime_status", "endpoint_net_lookup", "resistor_terminals", "cross_layer_led",
        )
    )
    if not has_data:
        return {"has_circuit": False}

    parts = circuit.get("parts") if isinstance(circuit.get("parts"), list) else []
    wires = circuit.get("wires") if isinstance(circuit.get("wires"), list) else []
    parts_count = circuit.get("parts_count") if circuit.get("parts_count") is not None else len(parts)
    wires_count = circuit.get("wires_count") if circuit.get("wires_count") is not None else len(wires)

    ipc = circuit.get("in_progress_connection")
    has_ipc = isinstance(ipc, dict) and (
        ipc.get("active") is True or ipc.get("status") in ("draft", "valid", "warning", "invalid")
    )
    is_empty = parts_count == 0 and wires_count == 0 and not has_ipc
    is_unwired = parts_count > 0 and wires_count == 0 and not has_ipc

    component_ids: Set[str] = set()
    component_types: Set[str] = set()
    components_by_id: Dict[str, Dict[str, Any]] = {}
    board_ids: Set[str] = set()
    for p in parts:
        if isinstance(p, dict) and p.get("id"):
            pid = str(p["id"]).strip().lower()
            ptype = str(p.get("type") or "").strip().lower()
            component_ids.add(pid)
            if ptype:
                component_types.add(ptype)
                component_types.update(_PART_TYPE_ALIASES.get(ptype, set()))
            components_by_id[pid] = p
            if any(b in ptype for b in ("arduino", "uno", "esp32", "pico", "microbit", "nano", "mega")):
                board_ids.add(pid)

    board = circuit.get("board") if isinstance(circuit.get("board"), dict) else None
    if board:
        bpid = str(board.get("part_id") or "").strip().lower()
        bid = str(board.get("id") or "").strip().lower()
        if bpid:
            board_ids.add(bpid)
            component_ids.add(bpid)
        if bid:
            component_types.add(bid)
            component_types.update(_PART_TYPE_ALIASES.get(bid, set()))

    ep_lookup_raw = circuit.get("endpoint_net_lookup") if isinstance(circuit.get("endpoint_net_lookup"), dict) else {}
    endpoint_net_lookup: Dict[str, Dict[str, Any]] = {
        str(k).lower(): v for k, v in ep_lookup_raw.items() if isinstance(v, dict)
    }
    connected_board_pins: Set[str] = set()
    connected_endpoints: Set[str] = set()
    for ep_k, ep_v in endpoint_net_lookup.items():
        if ep_v.get("is_connected"):
            connected_endpoints.add(ep_k)
            pid_p = ep_k.split(":", 1)[0]
            if pid_p in board_ids:
                connected_board_pins.add(str(ep_v.get("pin_id") or ep_k.split(":", 1)[1]).lower())

    # Include direct wire board endpoints even if endpoint_net_lookup omitted board entries
    for w in wires:
        if isinstance(w, dict):
            for end in (w.get("from"), w.get("to")):
                if isinstance(end, dict):
                    ep_id = str(end.get("partId") or end.get("part_id") or "").strip().lower()
                    ep_pin = str(end.get("pinId") or end.get("pin_id") or "").strip().lower()
                    if ep_id and ep_pin:
                        connected_endpoints.add(f"{ep_id}:{ep_pin}")
                        if ep_id in board_ids:
                            connected_board_pins.add(ep_pin)

    rt_raw = circuit.get("resistor_terminals") if isinstance(circuit.get("resistor_terminals"), list) else []
    resistor_terminals: Dict[str, Dict[str, Any]] = {}
    for rt in rt_raw:
        if isinstance(rt, dict) and rt.get("part_id"):
            resistor_terminals[str(rt["part_id"]).strip().lower()] = rt

    cl_raw = circuit.get("cross_layer_led") if isinstance(circuit.get("cross_layer_led"), list) else []
    cross_layer_led: List[Dict[str, Any]] = [c for c in cl_raw if isinstance(c, dict) and c.get("led_id")]

    blockly = sanitized.get("blockly") if isinstance(sanitized.get("blockly"), dict) else {}
    board_hint_type = str((board or {}).get("id") or "arduino-uno")
    code_pins: Set[str] = set()
    pb = blockly.get("pin_bindings")
    if isinstance(pb, list):
        for item in pb:
            if isinstance(item, dict) and item.get("pin"):
                code_pins.add(_canon_pin_py(board_hint_type, item["pin"], is_board=True))
    elif isinstance(pb, dict):
        for k in pb.keys():
            code_pins.add(_canon_pin_py(board_hint_type, k, is_board=True))

    sim = circuit.get("simulation") if isinstance(circuit.get("simulation"), dict) else {}
    sim_running = bool(first_non_none(circuit.get("simulator_running"), sim.get("running"), False))
    sim_paused = bool(sim.get("paused", False))
    sim_status = str(sim.get("status") or ("paused" if (sim_running and sim_paused) else ("running" if sim_running else "ready"))).lower()
    comp_rt = {str(key).lower(): data for key, data in (sim.get("component_runtime") or {}).items()} if isinstance(sim.get("component_runtime"), dict) else {}
    rt_outputs = (circuit.get("runtime_status") or {}).get("outputs") if isinstance(circuit.get("runtime_status"), dict) else None
    if isinstance(rt_outputs, list):
        for out_item in rt_outputs:
            if isinstance(out_item, dict) and out_item.get("part_id"):
                oid = str(out_item["part_id"]).lower()
                if oid not in comp_rt:
                    st_s = str(out_item.get("state") or "").upper()
                    comp_rt[oid] = {
                        "level": 1.0 if "ILLUMINATED" in st_s else 0.0,
                        **({"currentMa": out_item["current_ma"]}
                           if _decimal_value(out_item.get("current_ma")) is not None else {}),
                        "burnt": bool(out_item.get("burnt")),
                    }

    any_led_illuminated = False
    for cl in cross_layer_led:
        if cl.get("observed_state") == "illuminated":
            any_led_illuminated = True
    for p_rt in comp_rt.values():
        if isinstance(p_rt, dict) and float(p_rt.get("level", 0) or 0) > 0.05:
            any_led_illuminated = True

    all_led_topology_ok = bool(cross_layer_led) and all(
        c.get("topology_ok") and c.get("safety_ok") for c in cross_layer_led
    )

    health_status = str(circuit.get("health_status") or ("empty" if is_empty else ("unwired" if is_unwired else "unknown"))).lower()
    health_score = circuit.get("health_score")
    if health_status in ("empty", "unwired"):
        health_score = None
    critical_count = int(circuit.get("critical_count") or 0)
    warning_count = int(circuit.get("warning_count") or 0)
    issues = circuit.get("issues") if isinstance(circuit.get("issues"), list) else []

    # Reconcile inconsistent frontend/tampered health status against authoritative cross-layer LED evidence
    led_fault_count = sum(
        1
        for cl in cross_layer_led
        if not cl.get("topology_ok", True)
        or not cl.get("safety_ok", True)
        or not cl.get("pin_mapping_ok", True)
        or cl.get("observed_state") in ("burnt", "off_code_mismatch", "off_unwired_or_fault")
    )
    if led_fault_count > 0 and not is_empty and not is_unwired:
        critical_count = max(critical_count, led_fault_count)
        if health_status in ("healthy", "unknown") or health_score == 100:
            health_status = "danger"
            health_score = max(0, 100 - critical_count * 35 - warning_count * 15)

    has_ground_connection = any(
        bool(ep_v.get("is_ground_rail")) and bool(ep_v.get("is_connected"))
        for ep_v in endpoint_net_lookup.values()
    ) or any(
        k.endswith(":gnd") or ":gnd_" in k or k.endswith(":neg")
        for k in connected_endpoints
    )

    readings = circuit.get("readings") if isinstance(circuit.get("readings"), list) else []
    meter = circuit.get("meter") if isinstance(circuit.get("meter"), dict) else {}
    scope = circuit.get("scope") if isinstance(circuit.get("scope"), dict) else {}

    return {
        "has_circuit": True,
        "session_id": first_non_none(sanitized.get("session_id"), circuit.get("session_id")),
        "circuit_revision": first_non_none(sanitized.get("circuit_revision"), circuit.get("circuit_revision")),
        "is_empty": is_empty,
        "is_unwired": is_unwired,
        "has_ground_connection": has_ground_connection,
        "board": board,
        "board_ids": board_ids,
        "logic_voltage": (board or {}).get("logic_voltage"),
        "parts": parts,
        "parts_count": parts_count,
        "wires": wires,
        "wires_count": wires_count,
        "component_ids": component_ids,
        "component_types": component_types,
        "components_by_id": components_by_id,
        "endpoint_net_lookup": endpoint_net_lookup,
        "netlist": [net for net in circuit.get("netlist") or [] if isinstance(net, dict)],
        "connected_board_pins": connected_board_pins,
        "connected_endpoints": connected_endpoints,
        "resistor_terminals": resistor_terminals,
        "cross_layer_led": cross_layer_led,
        "code_pins": code_pins,
        "has_program": bool(blockly.get("has_program") or code_pins or blockly.get("code")),
        "simulation_running": sim_running,
        "simulation_paused": sim_paused,
        "simulation_status": sim_status,
        "component_runtime": comp_rt,
        "any_led_illuminated": any_led_illuminated,
        "all_led_topology_ok": all_led_topology_ok,
        "health_status": health_status,
        "health_score": health_score,
        "critical_count": critical_count,
        "warning_count": warning_count,
        "issues": issues,
        "readings": readings,
        "meter": meter,
        "scope": scope,
        "in_progress_connection": ipc if has_ipc else None,
        "hovered_pin": circuit.get("hovered_pin"),
        "recent_target_pin": circuit.get("recent_target_pin"),
        "sanitized_envelope": sanitized,
    }


def _split_clauses_outside_code(text: str) -> List[str]:
    """Splits prose text into verifiable clauses while ignoring fenced code blocks."""
    prose_only = _CODE_FENCE_RE.sub(" ", text or "")
    raw_clauses = re.split(r"(?<=[.!?;])\s+|\n+", prose_only)
    return [c.strip() for c in raw_clauses if c and c.strip()]


def _has_local_negation(clause: str, match_start: int) -> bool:
    prefix = clause[max(0, match_start - 55):match_start]
    return bool(_NEGATION_PREFIX_RE.search(prefix))


def _is_suggestion_clause(clause: str) -> bool:
    return bool(_SUGGESTION_OR_HYPOTHETICAL_CUE_RE.search(clause))


def _normalize_pin_alias_for_check(tok: str) -> str:
    t = str(tok or "").strip().lower()
    if t.startswith("gpio"):
        return "d" + t[4:] if t[4:].isdigit() else t
    return t


def _endpoint_matches_target(target: str, term_dict: Dict[str, Any], board_ids: Set[str]) -> bool:
    """Returns True if target token (e.g. 'd9', 'uno:d9', 'led1:anode', 'anode', 'gnd') belongs to term_dict."""
    t = target.strip().lower()
    if not term_dict.get("is_connected"):
        return False
    peers = [
        str(p).lower()
        for p in (
            list(term_dict.get("direct_peers") or [])
            + list(term_dict.get("direct_wire_peers") or [])
            + list(term_dict.get("same_net_peers") or [])
            + list(term_dict.get("same_net_endpoints") or [])
        )
    ]
    bpins = [
        str(b).lower()
        for b in (list(term_dict.get("board_pins") or []) + list(term_dict.get("same_net_board_pins") or []))
    ]
    net_name = str(term_dict.get("net_name") or "").lower()

    if t in ("gnd", "ground") and term_dict.get("is_ground_rail"):
        return True
    if t in ("5v", "3v3", "3.3v", "vcc", "vin") and term_dict.get("is_power_rail"):
        for p in peers + bpins:
            _, p_pin = p.split(":", 1) if ":" in p else ("", p)
            if p_pin == t or (t in ("3v3", "3.3v") and p_pin in ("3v3", "3.3v", "3v")):
                return True
        if t in net_name:
            return True

    if t in peers or t in bpins:
        return True
    if ":" not in t:
        for p in peers + bpins:
            p_part, p_pin = p.split(":", 1) if ":" in p else ("", p)
            if p_pin == t or _normalize_pin_alias_for_check(p_pin) == _normalize_pin_alias_for_check(t):
                return True
            if p_part == t:
                return True
        if net_name and t == net_name:
            return True
    return False


def extract_and_validate_grounding_claims(
    response_text: str,
    spec: Dict[str, Any],
    prompt: str = "",
) -> Dict[str, Any]:
    """
    Validates factual claims in response_text against the authoritative circuit grounding spec.
    Handles negations, instructional suggestions, fenced code examples, independent
    resistor terminals (a vs b), D5/D9 pin contradictions, runtime status, and measurements.
    """
    if not isinstance(spec, dict) or not spec.get("has_circuit"):
        return {
            "verified": True,
            "unsupported_claims": [],
            "unsupported_clauses": [],
            "claim_ledger": [],
        }

    clauses = _split_clauses_outside_code(response_text)
    topology = _NumericTopology(spec)
    unsupported_claims: List[str] = []
    unsupported_clauses: List[str] = []
    claim_ledger: List[Dict[str, Any]] = []

    def _record_violation(domain: str, detail: str, clause: str) -> None:
        if detail not in unsupported_claims:
            unsupported_claims.append(detail)
        if clause and clause not in unsupported_clauses:
            unsupported_clauses.append(clause)
        claim_ledger.append({"domain": domain, "status": "unsupported", "detail": detail})

    def _record_supported(domain: str, detail: str) -> None:
        claim_ledger.append({"domain": domain, "status": "supported", "detail": detail})

    for clause in clauses:
        is_suggestion = _is_suggestion_clause(clause)

        # 1. Health Score Validation
        for hm in _HEALTH_SCORE_RE.finditer(clause):
            raw_num = next((g for g in hm.groups()[:4] if g and g.isdigit()), None)
            if not raw_num:
                continue
            if _has_local_negation(clause, hm.start()) or is_suggestion:
                continue
            claimed_score = int(raw_num)
            expected_score = spec["health_score"]
            if expected_score is None:
                _record_violation(
                    "health_score",
                    f"Asserted numeric health score {claimed_score}/100 when status is '{spec['health_status']}' (score=N/A).",
                    clause,
                )
            elif claimed_score != expected_score:
                _record_violation(
                    "health_score",
                    f"Asserted health score {claimed_score}/100 does not match authoritative score {expected_score}/100.",
                    clause,
                )
            else:
                _record_supported("health_score", f"Verified health score {claimed_score}/100.")

        # 2. Circuit Soundness / Intactness Validation
        for pm in _POSITIVE_HEALTHY_RE.finditer(clause):
            if is_suggestion:
                continue
            matched_phrase = pm.group(0)
            # Double check if phrase is itself "no faults"/"no issues" (negated fault = healthy claim)
            is_fault_negation = bool(re.match(r"^(?:no|zero)\s+", matched_phrase, re.IGNORECASE))
            if not is_fault_negation and _has_local_negation(clause, pm.start()):
                continue
            # Allow explicit qualified electrical-only statement if LEDs pass Layers A & B and critical_count == 0
            if _TOPOLOGY_ONLY_OK_RE.search(clause) and spec["critical_count"] == 0 and spec["all_led_topology_ok"]:
                _record_supported("topology_soundness", "Verified electrical topology intact (separate from code/runtime).")
                continue
            if spec["is_empty"] or spec["is_unwired"] or spec["critical_count"] > 0 or spec["health_status"] in ("empty", "unwired", "danger", "needs-attention"):
                _record_violation(
                    "health_status",
                    f"Asserted '{matched_phrase}' while authoritative health_status='{spec['health_status']}' (score={spec['health_score']}, critical={spec['critical_count']}, warnings={spec['warning_count']}).",
                    clause,
                )
            else:
                _record_supported("health_status", f"Verified '{matched_phrase}' against healthy circuit.")

        # 2b. Unfounded MNA / Solver Valid Claims (B9)
        for mm in _UNFOUNDED_MNA_VALID_RE.finditer(clause):
            if is_suggestion or _has_local_negation(clause, mm.start()):
                continue
            if (
                spec["is_empty"]
                or spec["is_unwired"]
                or not spec["simulation_running"]
                or spec["critical_count"] > 0
                or spec["health_status"] in ("empty", "unwired", "danger", "needs-attention")
                or not spec["netlist"]
            ):
                _record_violation(
                    "runtime_state",
                    f"Asserted '{mm.group(0)}' without valid active simulation/circuit proof (health_status='{spec['health_status']}', simulation_running={spec['simulation_running']}).",
                    clause,
                )
            else:
                _record_supported("runtime_state", f"Verified '{mm.group(0)}' against running solved circuit.")

        # 2c. False Series-Resistor Reverse-Polarity Protection Claim (B10)
        for rpm in _FALSE_REVERSE_PROTECTION_RE.finditer(clause):
            if _has_local_negation(clause, rpm.start()) or _NEGATION_PREFIX_RE.search(rpm.group(0)):
                continue
            _record_violation(
                "physics_safety",
                "Falsely claimed a series resistor protects against reverse polarity; a series resistor limits forward current only and cannot make a reverse-biased LED conduct or stay protected.",
                clause,
            )

        # 3. Empty Canvas Component / Wire Hallucination Check
        if spec["is_empty"] and not is_suggestion:
            em = _EMPTY_ASSERTED_PRESENCE_RE.search(clause)
            if em and not _has_local_negation(clause, em.start()):
                _record_violation(
                    "canvas_state",
                    f"Asserted present components or wires on an empty canvas (0 parts, 0 wires): '{em.group(0)}'.",
                    clause,
                )

        # 4. Component Instance IDs & Non-Existent Part Claims
        if not is_suggestion:
            for im in _INSTANCE_ID_RE.finditer(clause):
                raw_id = im.group(1).lower()
                # Require trailing digit or endpoint colon syntax so generic words ('uno', 'breadboard') don't collide
                has_digit = any(c.isdigit() for c in raw_id)
                after_ch = clause[im.end():im.end() + 1]
                if not has_digit and after_ch != ":":
                    continue
                if _has_local_negation(clause, im.start()):
                    continue
                # Skip common non-component technical tokens like SPI/I2C/AVR names if any (e.g. a0 already filtered)
                if raw_id not in spec["component_ids"]:
                    _record_violation(
                        "component_identity",
                        f"Referenced non-existent component ID '{im.group(1)}' not present in placed components {sorted(spec['component_ids'])}.",
                        clause,
                    )
                else:
                    _record_supported("component_identity", f"Verified component '{raw_id}'.")

        # 5. Physical Pin & Resistor Terminal A/B Grounding Checks
        is_code_only_clause = bool(_CODE_ONLY_PIN_CLAUSE_RE.search(clause)) and not bool(
            re.search(r"\b(?:physically|actual\s+wire|wired\s+to|plugged\s+into|terminal\s+[ab12])\b", clause, re.IGNORECASE)
        )
        if _PHYSICAL_CONNECTION_VERB_RE.search(clause) and not is_suggestion and not is_code_only_clause:
            # Skip negated physical claims (e.g. "D5 is NOT connected", "r1 is not connected to D5")
            conn_m = _PHYSICAL_CONNECTION_VERB_RE.search(clause)
            assert conn_m is not None
            if not _has_local_negation(clause, conn_m.start()):
                # Check resistor terminal A/B assertions explicitly
                res_in_clause = [rid for rid in spec["resistor_terminals"].keys() if re.search(rf"\b{re.escape(rid)}\b", clause, re.IGNORECASE)]
                if res_in_clause:
                    for rid in res_in_clause:
                        rinfo = spec["resistor_terminals"][rid]
                        term_matches = list(
                            re.finditer(
                                rf"\b(?:(?:{re.escape(rid)}\s*(?::|\s+terminal\s+|\s+pin\s+))?(a|b|1|2)(?:\s+(?:of\s+)?{re.escape(rid)})?|terminal\s+(a|b|1|2)\b)",
                                clause,
                                re.IGNORECASE,
                            )
                        )
                        # Require explicit resistor/terminal syntax (avoid matching article 'a')
                        filtered_terms = []
                        for tm in term_matches:
                            raw_txt = tm.group(0).lower()
                            if re.match(r"^(?:terminal|pin)\s+[ab12]$", raw_txt) or re.search(rf"{re.escape(rid)}\s*(?::|\s+terminal\s+|\s+pin\s+)", raw_txt):
                                filtered_terms.append(tm)
                        # Also match '<rid> terminal a' directly:
                        if not filtered_terms:
                            filtered_terms = list(
                                re.finditer(
                                    rf"\b(?:{re.escape(rid)}\s*(?::|\s+terminal\s+|\s+pin\s+)(a|b|1|2)|terminal\s+(a|b|1|2)(?:\s+of\s+{re.escape(rid)})?)\b",
                                    clause,
                                    re.IGNORECASE,
                                )
                            )

                        if filtered_terms:
                            for t_idx, tm in enumerate(filtered_terms):
                                span_start = tm.start()
                                span_end = filtered_terms[t_idx + 1].start() if t_idx + 1 < len(filtered_terms) else len(clause)
                                sub_span = clause[span_start:span_end]
                                # Trim trailing conjunctions/code subclauses so unrelated targets or code pins don't bleed across clauses
                                code_bleed = re.search(
                                    r"(?:\b(?:while|whereas|although|however|instead)\b"
                                    r"|\s+(?:and|but)\s+[a-z0-9_:-]+\s+(?:is|are|was|connects?|goes?|leads?|wired|connected|plugged)\b"
                                    r"|,\s*(?:which\s+|and\s+|but\s+|matching\s+code|code\s+targets|code\s+pin|program\s+targets)\b|;)",
                                    sub_span,
                                    re.IGNORECASE,
                                )
                                if code_bleed:
                                    sub_span = sub_span[:code_bleed.start()]
                                raw_side = (tm.group(1) or tm.group(2) or "").lower()
                                canon_side = "terminal_a" if raw_side in ("a", "1") else "terminal_b"
                                opp_side = "terminal_b" if canon_side == "terminal_a" else "terminal_a"
                                side_dict = rinfo.get(canon_side) or {}
                                opp_dict = rinfo.get(opp_side) or {}

                                pins_sub = [p.lower() for p in _GPIO_PIN_RE.findall(sub_span)]
                                eps_sub = [
                                    f"{m[0].lower()}:{m[1].lower()}"
                                    for m in _ENDPOINT_PAIR_RE.findall(sub_span)
                                    if m[0].lower() != rid
                                ]
                                named_targets = list(dict.fromkeys(pins_sub + eps_sub))
                                for extra_kw in ("anode", "cathode", "gnd", "5v", "3v3"):
                                    if re.search(rf"\b{extra_kw}\b", sub_span, re.IGNORECASE):
                                        named_targets.append(extra_kw)

                                for tgt in named_targets:
                                    if not _endpoint_matches_target(tgt, side_dict, spec["board_ids"]):
                                        if _endpoint_matches_target(tgt, opp_dict, spec["board_ids"]):
                                            _record_violation(
                                                "resistor_terminal",
                                                f"Swapped {rid} {canon_side}: claimed {tgt}, but {tgt} is actually connected to {opp_side}. True mapping: {rinfo.get('path_summary')}.",
                                                clause,
                                            )
                                        else:
                                            _record_violation(
                                                "resistor_terminal",
                                                f"Asserted {rid} {canon_side} connects to {tgt}, which does not match netlist ({rinfo.get('path_summary')}).",
                                                clause,
                                            )
                        else:
                            # Clause states general resistor-to-pin connection e.g. "r1 is connected to D5"
                            pins_in_clause = [p.lower() for p in _GPIO_PIN_RE.findall(clause)]
                            for pin_tok in pins_in_clause:
                                ta_ok = _endpoint_matches_target(pin_tok, rinfo.get("terminal_a") or {}, spec["board_ids"])
                                tb_ok = _endpoint_matches_target(pin_tok, rinfo.get("terminal_b") or {}, spec["board_ids"])
                                if not (ta_ok or tb_ok):
                                    _record_violation(
                                        "endpoint_connection",
                                        f"Asserted {rid} is connected to {pin_tok.upper()}, but neither terminal connects there ({rinfo.get('path_summary')}).",
                                        clause,
                                    )

                # 5b. LED Anode (+) / Cathode (-) Endpoint Grounding Checks (B4, B7)
                led_ids_all = [
                    cid for cid, cobj in spec["components_by_id"].items()
                    if str(cobj.get("type") or "").lower() == "led"
                ]
                led_term_re = re.compile(
                    r"\b(?:([a-z][\w-]*)\s*(?::|\s+pin\s+|\s+terminal\s+)?(anode|cathode)\b(?!\s+of\b)"
                    r"|(?:terminal\s+|pin\s+)?(anode|cathode)(?:\s+of\s+([a-z][\w-]*))?)\b",
                    re.IGNORECASE,
                )
                led_terms = list(led_term_re.finditer(clause))
                if led_terms:
                    for t_idx, lm in enumerate(led_terms):
                        explicit_lid = (lm.group(1) or lm.group(4) or "").lower()
                        side = (lm.group(2) or lm.group(3) or "").lower()
                        target_lids = (
                            [explicit_lid]
                            if explicit_lid in led_ids_all
                            else (led_ids_all if len(led_ids_all) == 1 else [])
                        )
                        if not target_lids:
                            continue
                        span_start = lm.end()
                        span_end = led_terms[t_idx + 1].start() if t_idx + 1 < len(led_terms) else len(clause)
                        sub_span = clause[span_start:span_end]
                        bleed = re.search(
                            r"(?:\b(?:while|whereas|although|however|instead)\b|,\s*(?:which\s+|and\s+|but\s+|matching\s+code|code\s+targets)\b|;)",
                            sub_span,
                            re.IGNORECASE,
                        )
                        if bleed:
                            sub_span = sub_span[:bleed.start()]
                        conn_v = _PHYSICAL_CONNECTION_VERB_RE.search(sub_span)
                        if not conn_v or _has_local_negation(clause, lm.start()) or _has_local_negation(sub_span, conn_v.start()):
                            continue
                        # Strip parenthetical provenance (e.g. "(from r1:a/D13)") before checking direct LED endpoint targets
                        direct_sub_span = re.sub(r"\([^)]*\)", " ", sub_span)
                        pins_sub = [p.lower() for p in _GPIO_PIN_RE.findall(direct_sub_span)]
                        eps_sub = [
                            f"{m[0].lower()}:{m[1].lower()}"
                            for m in _ENDPOINT_PAIR_RE.findall(direct_sub_span)
                            if m[0].lower() not in target_lids
                        ]
                        res_mentions = [
                            rid for rid in spec["resistor_terminals"].keys()
                            if re.search(rf"\b{re.escape(rid)}\b", direct_sub_span, re.IGNORECASE)
                        ]
                        named_targets = list(dict.fromkeys(pins_sub + eps_sub + res_mentions))
                        for extra_kw in ("gnd", "ground", "5v", "3v3"):
                            if re.search(rf"\b{extra_kw}\b", direct_sub_span, re.IGNORECASE):
                                named_targets.append("gnd" if extra_kw == "ground" else extra_kw)
                        for lid in target_lids:
                            opp_side = "cathode" if side == "anode" else "anode"
                            side_dict = spec["endpoint_net_lookup"].get(f"{lid}:{side}") or {}
                            opp_dict = spec["endpoint_net_lookup"].get(f"{lid}:{opp_side}") or {}
                            for tgt in named_targets:
                                if not _endpoint_matches_target(tgt, side_dict, spec["board_ids"]):
                                    if _endpoint_matches_target(tgt, opp_dict, spec["board_ids"]):
                                        _record_violation(
                                            "led_polarity",
                                            f"Swapped {lid} {side}: claimed {tgt}, but {tgt} is actually connected to {lid}:{opp_side}.",
                                            clause,
                                        )
                                    elif not side_dict.get("is_connected"):
                                        _record_violation(
                                            "endpoint_connection",
                                            f"Asserted {lid}:{side} connects to {tgt}, whereas {lid}:{side} is disconnected/unwired in the netlist.",
                                            clause,
                                        )
                                    else:
                                        _record_violation(
                                            "endpoint_connection",
                                            f"Asserted {lid}:{side} connects to {tgt}, which does not match netlist endpoints.",
                                            clause,
                                        )

                # Explicit GND / ground physical wiring check when canvas has no ground return
                gnd_conn_m = re.search(
                    r"\b(?:wired|connected|plugged|attached|routed|tied)\s+(?:to|into)\s+(?:the\s+|board\s+|arduino\s+|uno\s+)?(?:gnd|ground)\b",
                    clause,
                    re.IGNORECASE,
                )
                if gnd_conn_m and not _has_local_negation(clause, gnd_conn_m.start()) and not spec.get("has_ground_connection"):
                    _record_violation(
                        "pin_connection",
                        "Asserted physical connection to GND/ground, whereas no ground return wire is connected in the snapshot.",
                        clause,
                    )

                # General board GPIO pin wired check (outside resistor branch)
                for pm in _GPIO_PIN_RE.finditer(clause):
                    pin_tok = _normalize_pin_alias_for_check(pm.group(1))
                    if _has_local_negation(clause, pm.start()):
                        continue
                    local_left = clause[max(0, pm.start() - 36):pm.end() + 12]
                    if (
                        re.search(
                            r"\b(?:code|program|software|sketch|blockly|targets?|controls?|driv(?:es|ing)|digitalwrite|pinmode|analogwrite)\b",
                            local_left,
                            re.IGNORECASE,
                        )
                        and not re.search(r"\b(?:physically\s+(?:wired|connected)|wired\s+to|connected\s+to|plugged\s+into)\b", local_left, re.IGNORECASE)
                    ):
                        continue
                    if spec["connected_board_pins"] or spec["wires_count"] > 0 or spec["is_empty"] or spec["is_unwired"]:
                        # Check if pin_tok matches any connected board pin (normalize aliases)
                        norm_connected = {_normalize_pin_alias_for_check(x) for x in spec["connected_board_pins"]}
                        if pin_tok not in norm_connected:
                            _record_violation(
                                "pin_connection",
                                f"Asserted physical connection on board pin {pin_tok.upper()}, whereas connected board pins are {sorted(spec['connected_board_pins']) or 'none'}.",
                                clause,
                            )

        # 6. Simulator Execution & Runtime Claims ('blinking', 'glowing', 'running')
        for rm in _RUNTIME_ACTIVE_CLAIM_RE.finditer(clause):
            if is_suggestion or _has_local_negation(clause, rm.start()):
                continue
            if not spec["simulation_running"] or spec["simulation_paused"]:
                _record_violation(
                    "runtime_state",
                    f"Asserted '{rm.group(0)}' while simulation_status='{spec['simulation_status']}' (running={spec['simulation_running']}).",
                    clause,
                )
            elif spec["cross_layer_led"] and not spec["any_led_illuminated"]:
                states = [f"{c.get('led_id')}:{c.get('observed_state')}" for c in spec["cross_layer_led"]]
                _record_violation(
                    "runtime_state",
                    f"Asserted '{rm.group(0)}' while observed LED state is non-illuminated ({', '.join(states)}).",
                    clause,
                )
            else:
                _record_supported("runtime_state", f"Verified active runtime claim '{rm.group(0)}'.")

        # 7. Keep instrument, simulator, and component evidence separate.
        for supported, detail in _numeric_grounding(clause, topology):
            if supported:
                _record_supported("measurements", detail)
            else:
                _record_violation("measurements", f"Unsupported numeric claim ({detail}).", clause)

    return {
        "verified": len(unsupported_claims) == 0,
        "unsupported_claims": unsupported_claims,
        "unsupported_clauses": unsupported_clauses,
        "claim_ledger": claim_ledger,
    }


def _extract_grounded_prose(candidate_text: str, unsupported_clauses: List[str]) -> str:
    """
    Removes every clause that failed grounding verification while preserving safe,
    accurate explanatory prose.
    """
    if not candidate_text or not candidate_text.strip():
        return ""
    bad_set = {c.strip() for c in unsupported_clauses if c and c.strip()}
    if not bad_set:
        return candidate_text.strip()

    kept_lines: List[str] = []
    for line in candidate_text.splitlines():
        raw_line = line.strip()
        if not raw_line:
            continue
        if any(bad in raw_line for bad in bad_set):
            # Filter sub-sentences within the line cleanly
            sub_clauses = re.split(r"(?<=[.!?;])\s+", raw_line)
            surviving = [s.strip() for s in sub_clauses if s.strip() and s.strip() not in bad_set]
            if surviving:
                kept_lines.append(" ".join(surviving))
        else:
            kept_lines.append(raw_line)
    return "\n".join(kept_lines).strip()


def build_constrained_regeneration_prompt(
    original_prompt: str,
    unsupported_claims: List[str],
    spec: Dict[str, Any],
    *,
    format_mode_value: str = "DEFAULT_EDUCATIONAL",
    max_chars: int = 4000,
) -> str:
    """
    Builds a single constrained retry prompt instructing Xen to eliminate
    specifically detected unsupported claims and use ONLY authoritative facts.
    """
    issues_txt = "; ".join(unsupported_claims[:4])[:650]
    res_lines = [rt.get("path_summary", "") for rt in spec.get("resistor_terminals", {}).values()][:4]
    led_lines = [cl.get("summary", "") for cl in spec.get("cross_layer_led", [])][:4]
    facts: Dict[str, Any] = {
        "circuit_revision": spec.get("circuit_revision"),
        "health_status": spec.get("health_status"),
        "health_score": spec.get("health_score"),
        "parts_count": spec.get("parts_count"),
        "wires_count": spec.get("wires_count"),
        "simulation_running": spec.get("simulation_running"),
        "simulation_status": spec.get("simulation_status"),
        "code_pins": sorted(spec.get("code_pins") or []),
        "connected_board_pins": sorted(spec.get("connected_board_pins") or []),
    }
    if res_lines:
        facts["resistor_terminals"] = res_lines
    if led_lines:
        facts["cross_layer_led"] = led_lines

    facts_json = json.dumps(facts, ensure_ascii=False, separators=(",", ":"))
    header = (
        "[GROUNDING CORRECTION REQUIRED — REGENERATE FACTUALLY]\n"
        f"Your previous draft contained unsupported or contradicted circuit claims: {issues_txt}.\n"
        f"AUTHORITATIVE CIRCUIT FACTS (rev={spec.get('circuit_revision')}): {facts_json}\n"
        "Rewrite your response obeying ALL rules:\n"
        "- State ONLY facts present in AUTHORITATIVE CIRCUIT FACTS and [MISSION CONTEXT].\n"
        "- Report resistor terminal A and terminal B independently.\n"
        "- Separate physical wiring/topology from code pin mapping and simulator execution.\n"
        "- Never claim LED glowing/blinking when simulation_running is false or observed state is off/mismatched.\n"
        "- Keep helpful, concise educational explanation."
    )

    candidate = f"{header}\n\n{original_prompt}"
    if len(candidate) <= max_chars:
        return candidate

    # Trim original_prompt's older MISSION CONTEXT if necessary while keeping full correction header
    if "[/MISSION CONTEXT]\n\n" in original_prompt:
        user_tail = original_prompt.split("[/MISSION CONTEXT]\n\n", 1)[1]
        env_prefix = format_context_envelope(
            spec.get("sanitized_envelope") or {},
            max_chars=max(240, max_chars - len(header) - len(user_tail) - 96),
        )
        candidate = f"{header}\n\n{env_prefix}\n\n{user_tail}" if env_prefix else f"{header}\n\n{user_tail}"
    return candidate[:max_chars]


def build_deterministic_grounded_fallback(
    spec: Dict[str, Any],
    prompt: str = "",
    candidate_text: str = "",
    unsupported_claims: Optional[List[str]] = None,
    unsupported_clauses: Optional[List[str]] = None,
) -> str:
    """
    Fail-closed deterministic factual summary constructed directly from verified
    circuit facts, retaining only verified explanatory prose that passes re-validation.
    """
    rev = spec.get("circuit_revision")
    rev_tag = f" (revision {rev})" if rev is not None else ""

    if spec.get("is_empty"):
        base = (
            f"Based on the current CyberLab snapshot{rev_tag}, the canvas is **Empty** "
            "(0 components placed and 0 completed wires connected; health score: **N/A**)."
        )
    elif spec.get("is_unwired"):
        part_list = ", ".join(
            f"{p.get('id')} ({p.get('type')})"
            for p in (spec.get("parts") or [])[:8]
            if isinstance(p, dict)
        )
        base = (
            f"Based on the current CyberLab snapshot{rev_tag}, the circuit status is **Not Wired** — "
            f"{spec.get('parts_count')} component(s) placed ({part_list}), with **0** completed wires "
            "(health score: **N/A**)."
        )
    else:
        score_str = f"{spec['health_score']}/100" if spec.get("health_score") is not None else "N/A"
        lines = [
            f"Verified CyberLab state{rev_tag}: **{spec.get('parts_count')}** component(s), "
            f"**{spec.get('wires_count')}** completed wire(s), health status **{spec.get('health_status')}** "
            f"(score: **{score_str}**)."
        ]
        res_terms = list((spec.get("resistor_terminals") or {}).values())
        if res_terms:
            lines.append(
                "**Resistor Terminal Mapping:** " + "; ".join(rt.get("path_summary", "") for rt in res_terms[:6] if rt.get("path_summary"))
            )
        cl_leds = spec.get("cross_layer_led") or []
        if cl_leds:
            for cl in cl_leds[:4]:
                topo_txt = "valid" if (cl.get("topology_ok") and cl.get("safety_ok")) else "has wiring/safety issue(s)"
                code_txt = (
                    f"matches code pin(s) {[p.upper() for p in (cl.get('code_pins') or [])]}"
                    if cl.get("matches_physical_pin", True)
                    else f"CODE MISMATCH: {cl.get('mismatch_reason') or 'physical pin differs from code pin'}"
                )
                sim_txt = (
                    f"simulation is **running** (observed state: `{cl.get('observed_state')}`)"
                    if spec.get("simulation_running")
                    else f"simulation is **not running** (`{spec.get('simulation_status')}` — live blink/glow cannot be observed until started)"
                )
                lines.append(
                    f"**LED `{cl.get('led_id')}` Layers:** Electrical wiring {topo_txt} "
                    f"(physical pin(s): {[p.upper() for p in (cl.get('physical_pins') or [])] or ['none']}; "
                    f"resistors: {cl.get('series_resistors') or ['none']}); Program mapping: {code_txt}; "
                    f"Simulator execution: {sim_txt}."
                )
        elif not spec.get("simulation_running"):
            lines.append(
                f"**Simulation Status:** `{spec.get('simulation_status')}` (not running — start the simulation to observe live outputs)."
            )
        if spec.get("issues"):
            top_issues = "; ".join(
                f"{iss.get('title')}: {iss.get('message')}"
                for iss in spec["issues"][:3]
                if isinstance(iss, dict)
            )
            if top_issues:
                lines.append(f"**Diagnostics:** {top_issues}")
        base = "\n\n".join(lines)

    # Optionally retain clean educational sentences only if re-validation confirms 0 unsupported claims
    retained = _extract_grounded_prose(candidate_text, unsupported_clauses or [])
    if retained and len(retained) >= 24:
        # Avoid echoing boilerplate headings if very short
        candidate_combined = f"{base}\n\n**Notes:** {retained}"
        recheck = extract_and_validate_grounding_claims(candidate_combined, spec, prompt)
        if recheck["verified"]:
            return candidate_combined

    return base


def _turn_has_circuit_claims(content: str) -> bool:
    """Quick check for circuit-specific factual claims in a historical assistant turn."""
    if not content:
        return False
    return bool(
        re.search(
            r"\b(?:100/100|100%|connections\s+(?:are\s+)?intact|blinking|glowing|health\s+score|"
            r"resistor|r\d+|led\d+|terminal\s+[ab12]|uno|d\d{1,2}|a\d|gnd|anode|cathode|"
            r"wire\d*|connected\s+to|plugged\s+into|simulation\s+is\s+running)\b",
            content,
            re.IGNORECASE,
        )
    )


def filter_and_compact_xen_history(
    history: List[Dict[str, Any]],
    active_mode: Any,
    *,
    sanitize_fn: Any,
    current_circuit_revision: Optional[int] = None,
    current_spec: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Compacts conversation history while preserving history integrity:
    - Excludes assistant turns marked as error or grounding_verified=False.
    - Quarantines / strips stale-revision or contradicted circuit factual claims
      from prior assistant turns (including local_fallback turns) so previous
      hallucinations or outdated revisions can never become future facts.
    - Preserves clean role structure and bounded code blocks.
    """
    compacted: List[Dict[str, Any]] = []
    has_active_circuit = bool(current_spec and current_spec.get("has_circuit"))
    skipped_assistant = False

    for turn in history:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        content = turn.get("content", "")
        prov = turn.get("provenance") if isinstance(turn.get("provenance"), dict) else {}

        if role == "user":
            clean_u = sanitize_fn(content)
            if skipped_assistant and compacted and compacted[-1]["role"] == "user":
                compacted[-1] = {"role": "user", "content": clean_u}
            else:
                compacted.append({"role": "user", "content": clean_u})
            skipped_assistant = False
            continue

        if role != "assistant":
            continue

        # 1. Exclude explicit error or rejected ungrounded assistant turns
        if prov.get("response_source") == "error" or prov.get("grounding_verified") is False:
            skipped_assistant = True
            continue
        skipped_assistant = False

        # 2. Validate historical assistant circuit claims against current authoritative circuit state
        clean_content = content
        turn_rev = prov.get("circuit_revision")
        is_stale_rev = (
            has_active_circuit
            and current_circuit_revision is not None
            and turn_rev is not None
            and int(turn_rev) != int(current_circuit_revision)
        )

        if has_active_circuit and _turn_has_circuit_claims(content):
            val = extract_and_validate_grounding_claims(content, current_spec)
            if not val["verified"] or is_stale_rev:
                # Strip contradicted clauses and explicitly prevent model reliance on superseded/unverified claims
                scrubbed = _extract_grounded_prose(content, val["unsupported_clauses"])
                if not scrubbed or is_stale_rev:
                    rev_note = f"rev={turn_rev}" if turn_rev is not None else "prior state"
                    clean_content = (
                        f"[Prior assistant turn ({rev_note}) omitted/superseded — rely ONLY on current "
                        f"AUTHORITATIVE CIRCUIT STATE at rev={current_circuit_revision}.]"
                    )
                else:
                    clean_content = (
                        f"[Historical note — verify circuit facts only against current rev={current_circuit_revision}] "
                        f"{scrubbed}"
                    )

        code_blocks = re.findall(r"```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)```", clean_content)
        if code_blocks:
            lang_match = re.search(r"```([a-zA-Z0-9_-]*)\n", clean_content)
            lang = lang_match.group(1) if lang_match else "python"
            compact_turn = f"```{lang}\n{code_blocks[0].strip()}\n```"
            compacted.append({"role": "assistant", "content": sanitize_fn(compact_turn)})
        else:
            trimmed = clean_content.strip()
            if len(trimmed) > 420:
                trimmed = trimmed[:420] + "..."
            compacted.append({"role": "assistant", "content": sanitize_fn(trimmed)})

    return compacted
