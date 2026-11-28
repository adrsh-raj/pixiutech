/**
 * Deterministic Query-Sensitive Context Router for CyberLab Xen Copilot:
 * Distinguishes circuit-specific questions (LED, wiring, pins, simulation, canvas faults)
 * from general educational questions (Physics formulas, Newton's laws, definitions, mathematics)
 * and casual small-talk / greetings / identity questions.
 */

const ACADEMIC_STEM_PATTERNS = /\b(k[ie]n[eai]t[ie]c\s*(?:energy|enerfy|urja)?|kitnetic\s*(?:energy|enerfy|urja)?|kenetic\s*(?:energy|enerfy|urja)?|knetic\s*(?:energy|enerfy|urja)?|kintik\s*(?:energy|enerfy|urja)?|enerf[yi]|gatij\s*(?:urja)?|sthitij\s*(?:urja)?|poten[ct]ial\s*energy|newton'?s?\s*(?:first|second|third|1st|2nd|3rd|\w+)?\s*(?:law|niyam)?|laws?\s+of\s+motion|ohm'?s?\s+law|kirchhoff(?:'?s)?\s+(?:law|laws|rule|voltage\s+law|current\s+law)|faraday(?:'?s)?\s+law|coulomb(?:'?s)?\s+law|joule(?:'?s)?\s+law|momentum|accelerat[ie]on|velocit[ye]|gravit[ye]|gravitat[ie]on|inertia|friction|thermodynamic|entropy|speed\s+of\s+light|relativit[ye]|work\s+done|conservation\s+of\s+energy|photosynthesis|mitochondria|chemical\s+equation|periodic\s+table|pythagor(?:as|ean)|trigonometr|calculus|derivative|integral|quadratic\s+equation)\b/i;

const CIRCUIT_HARDWARE_PATTERNS = /\b(circuit|(?:on|in)\s+(?:the|my|this|our)\s+canvas|canvas|workspace|which\s+board|controller\s+board|microcontroller|see\s+my\s+screen|screen|circuit\s+doctor|simulator|simulation|hover(?:ing|ed)?|cursor|pointing\s+at|mouse\s+over|drag(?:ging)?|candidate|multimeter|oscilloscope|scope|dmm|continuity|probe\w*|reading\w*|netlist|blockly|sketch|terminal\w*|breadboard\s+hole|attach(?:ed|ing)?|placed?|draft\s+wire|cancel(?:led|ing)?|select(?:ed|ing)?|deleted?|what\s+(?:am\s+i|are\s+we)\s+(?:connecting|wiring|hovering|building|making|creating|working\s+on|selecting|drawing)|what\s+have\s+we\s+built|what\s+did\s+(?:i|we)\s+build|what(?:'s|\s+is)\s+(?:on\s+(?:the|my|our)\s+(?:canvas|workspace|board)|built)|what\s+(?:parts|components|wires|connections)\b|led\d*|resistor\d*|resister\d*|registor\d*|capacitor\d*|buzzer\d*|buzer\d*|servo\d*|motor\d*|relay\d*|potentiometer\d*|pot\d*|ldr\d*|sensor\d*|pushbutton\d*|switch\d*|diode\d*|breadboard|neopixel|ultrasonic|arduino|esp32|pico|microbit|pin\s*[a-d]?\d+|[ad]\d{1,2}\s+pin|pin\b|anode|cathode|gpio\d*|pwm|gnd|ground|vcc|5v|3v3|3\.3v|vin|vsys|wire\d*|wires|wiring|taar|wireing|connect(?:ed|ing|ion)?|disconnect(?:ed|ing)?|short\s*circuit|open\s*circuit|glow(?:ing)?|jal(?:o)?|blink(?:ing)?|burnout|burned|fused|pinmode|digitalwrite|digitalread|analogwrite|analogread)\b/i;

const WORKSPACE_COMPLETION_FOLLOWUP_RE = /^\s*(?:i(?:'m|\s+am)?\s+done|done|finished|completed|fixed(?:\s+it)?|connected(?:\s+it)?|wired(?:\s+it)?|check(?:\s+it)?(?:\s+again)?|check\s+now|now\??|ho\s*gaya|kar\s*diya|bana\s*diya)[.!?]*$/i;

const SMALL_TALK_OR_GREETING_RE = /^\s*(?:(?:hi+|hii+|hey+|hello+|helo|namaste|yo|hola|good\s+(?:morning|afternoon|evening|night))(?:\s+(?:xen|bro|bhai|bhaiya|dude|yaar|sir|friend|there))?(?:[,\s]+(?:how\s+(?:are|r)\s+(?:you|u)(?:\s+(?:doing|bro|bhai|dude|yaar))?|how'?s\s+it\s+going|what'?s\s+up|wassup|kya\s+haal(?:\s+hai)?|kaise\s+ho))?|how\s+(?:are|r)\s+(?:you|u)(?:\s+(?:doing|today|now|bro|bhai|bhaiya|dude|yaar|xen))?(?:\s*,?\s*(?:and\s+)?(?:introduce\s+yourself(?:\s+a?\s*lil\s+bit)?|how\s+about\s+you)?)?|what'?s\s+up|wassup|kya\s+haal(?:\s+hai)?|kaise\s+ho(?:\s+(?:bhai|bro|xen))?|sab\s+theek(?:\s+hai)?|(?:ok(?:ay)?[,\s]+)?(?:thank\s+you|thanks(?:\s+a\s+lot)?|thx|ty|shukriya|dhanyavaad|bahut\s+shukriya)(?:\s+(?:xen|bro|bhai|bhaiya|dude|yaar|so\s+much))?|you(?:'re|\s+are)\s+(?:awesome|helpful|great|cool)|got\s+it|makes\s+sense|understood|(?:cool|nice|awesome|great|amazing)(?:\s+(?:xen|bro|bhai))?|bye|goodbye|see\s+(?:you|ya)(?:\s+later)?|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|introduce\s+yourself|tell\s+me\s+about\s+yourself)[,!?\s.]*$/i;

export function isSmallTalkOrGreeting(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  const cleaned = prompt.trim();
  if (!cleaned) return false;
  if (CIRCUIT_HARDWARE_PATTERNS.test(cleaned) || WORKSPACE_COMPLETION_FOLLOWUP_RE.test(cleaned)) {
    return false;
  }
  return SMALL_TALK_OR_GREETING_RE.test(cleaned);
}

const FOLLOWUP_RE = /^(?:can you check(?: it| again)?|is (?:it|that) correct|why|what about (?:it|that)|how to fix it|which arduino pin|check(?: it| again)?)[.!?]*$/i;
const AFFIRMATIVE_RE = /^(?:yes|yeah|okay|ok|sure|go ahead|haan|kar do|theek hai)(?:[, ]+(?:do it|go ahead|please))*[.!?]*$/i;
const TOPOLOGY_RE = /\b(?:which (?:arduino|board) pin|where (?:is|does).*(?:connect|go)|connected to|what is connected|directly connected|share.*net|which terminal|is .*grounded)\b/i;
const ABSTRACT_RE = /^(?:what is (?:a |an )?(?:resistor|led|pin|ground)|define |explain (?:the concept of |how )?(?:a resistor|leds|resistors|voltage|current)|what is (?:a |an )?(?:loop|function|variable)|explain (?:python|javascript|algebra|mathematics))\b/i;
const LIVE_RE = /\b(?:my|this|our|canvas|workspace|led\d+|resistor\d+)\b/i;

function explicitCircuit(text) {
  return CIRCUIT_HARDWARE_PATTERNS.test(text) &&
    !(ABSTRACT_RE.test(text) && !LIVE_RE.test(text)) &&
    !(ACADEMIC_STEM_PATTERNS.test(text) && !/\b(my|mera|this|canvas|led\d*|resistor\d*|arduino|esp32|breadboard|wire\w*|anode|cathode|gnd)\b/i.test(text));
}

export function classifyCopilotIntent(prompt, history = [], contextInfo = null) {
  const text = typeof prompt === 'string' ? prompt.trim() : '';
  const result = (intent, inspect = false) => ({ intent, inspect });
  if (!text) return result('ambiguous');
  if (isSmallTalkOrGreeting(text)) {
    return result(/^(?:hi+|hey+|hello+|namaste|good morning)\b/i.test(text) ? 'greeting' : 'conversation');
  }
  const contextual = FOLLOWUP_RE.test(text);
  if (!contextual && explicitCircuit(text)) {
    if (TOPOLOGY_RE.test(text)) return result('topology', true);
    if (/\b(?:code|blockly|sketch|pinmode|digitalwrite|program)\b/i.test(text)) return result('circuit_code', true);
    return result(/\b(?:check|diagnos\w*|why|fault|not|broken|short)\b/i.test(text) ? 'diagnosis' : 'circuit', true);
  }
  if (ACADEMIC_STEM_PATTERNS.test(text) || ABSTRACT_RE.test(text)) return result('education');

  const turns = Array.isArray(history) ? history : [];
  let priorCircuit = false;
  for (let i = turns.length - 1; i >= 0; --i) {
    const turn = turns[i];
    const content = turn?.content || turn?.text || '';
    if (typeof content !== 'string' || !content.trim()) continue;
    if (turn.role === 'assistant' && turn.wasCircuitQuery === true) {
      priorCircuit = true;
      break;
    }
    if (turn.role !== 'user' || isSmallTalkOrGreeting(content) || FOLLOWUP_RE.test(content) ||
        AFFIRMATIVE_RE.test(content) || WORKSPACE_COMPLETION_FOLLOWUP_RE.test(content)) continue;
    priorCircuit = explicitCircuit(content);
    break;
  }
  if (AFFIRMATIVE_RE.test(text)) {
    const last = turns.findLast(turn => turn?.role === 'assistant');
    const offeredInspection = /(?:can|could|would|want|shall|should).{0,36}(?:check|inspect|diagnos)/i.test(last?.content || last?.text || '');
    return result('affirmative', priorCircuit && offeredInspection);
  }
  if (WORKSPACE_COMPLETION_FOLLOWUP_RE.test(text) && /done|finished|completed|fixed|connected|wired|ho gaya|kar diya|bana diya/i.test(text)) {
    return result('followup', priorCircuit || Boolean(contextInfo?.hasActiveCircuit || contextInfo?.inCyberLab));
  }
  if (contextual || WORKSPACE_COMPLETION_FOLLOWUP_RE.test(text)) {
    return result(TOPOLOGY_RE.test(text) ? 'topology' : 'followup', priorCircuit);
  }
  return result('conversation');
}

export function isCircuitSpecificQuery(prompt, history = [], contextInfo = null) {
  return classifyCopilotIntent(prompt, history, contextInfo).inspect;
}
