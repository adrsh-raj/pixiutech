/**
 * Deterministic Query-Sensitive Context Router for CyberLab 8square Copilot:
 * Distinguishes circuit-specific questions (LED, wiring, pins, simulation, canvas faults)
 * from general educational questions (Physics formulas, Newton's laws, definitions, mathematics).
 */

const ACADEMIC_STEM_PATTERNS = /\b(k[ie]n[eai]t[ie]c\s*(?:energy|enerfy|urja)?|kitnetic\s*(?:energy|enerfy|urja)?|kenetic\s*(?:energy|enerfy|urja)?|knetic\s*(?:energy|enerfy|urja)?|kintik\s*(?:energy|enerfy|urja)?|enerf[yi]|gatij\s*(?:urja)?|sthitij\s*(?:urja)?|poten[ct]ial\s*energy|newton'?s?\s*(?:first|second|third|1st|2nd|3rd|\w+)?\s*(?:law|niyam)?|laws?\s+of\s+motion|momentum|accelerat[ie]on|velocit[ye]|gravit[ye]|gravitat[ie]on|inertia|friction|thermodynamic|entropy|speed\s+of\s+light|relativit[ye]|work\s+done|conservation\s+of\s+energy|photosynthesis|mitochondria|chemical\s+equation|periodic\s+table|pythagor(?:as|ean)|trigonometr|calculus|derivative|integral|quadratic\s+equation)\b/i;

const CIRCUIT_HARDWARE_PATTERNS = /\b(circuit|on\s+(?:the\s+)?canvas|in\s+(?:the\s+)?canvas|workspace|see\s+my\s+screen|screen|circuit\s+doctor|simulator|simulation|led\d*|resistor\d*|resister\d*|registor\d*|capacitor\d*|buzzer\d*|buzer\d*|servo\d*|motor\d*|relay\d*|potentiometer\d*|pot\d*|ldr\d*|sensor\d*|pushbutton\d*|switch\d*|diode\d*|breadboard|neopixel|ultrasonic|arduino|esp32|pico|microbit|pin\s*[a-d]?\d+|[ad]\d{1,2}\s+pin|pin\b|anode|cathode|gpio\d*|pwm|gnd|ground|vcc|5v|3v3|3\.3v|vin|vsys|wire\d*|wires|wiring|taar|wireing|connect(?:ed|ing|ion)?|disconnect(?:ed|ing)?|short\s*circuit|open\s*circuit|glow(?:ing)?|jal(?:o)?|blink(?:ing)?|burnout|burned|fused|pinmode|digitalwrite|digitalread|analogwrite|analogread)\b/i;

/**
 * Returns true if the user query is specifically asking about their virtual circuit,
 * canvas components, pins, wiring, or simulation.
 * Returns false for general educational/academic questions (even when submitted inside CyberLab).
 */
export function isCircuitSpecificQuery(prompt, history = []) {
  if (!prompt || typeof prompt !== 'string') return false;
  const cleaned = prompt.trim();
  if (!cleaned) return false;

  const hasHardwareTokens = CIRCUIT_HARDWARE_PATTERNS.test(cleaned);
  const hasAcademicTokens = ACADEMIC_STEM_PATTERNS.test(cleaned);

  // If general academic/physics question without explicit "my circuit" or hardware pins
  if (hasAcademicTokens) {
    if (!/\b(my\s+circuit|mera\s+circuit|on\s+canvas|this\s+circuit|why\s+is\s+my|pin\s*[a-d]?\d+|d\d+|wire|gnd)\b/i.test(cleaned)) {
      return false;
    }
  }

  // Explicit circuit / hardware question
  if (hasHardwareTokens) {
    return true;
  }

  // Multi-turn context resolution
  if (Array.isArray(history) && history.length > 0) {
    let lastAsstContent = '';
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      if (turn && turn.role === 'assistant') {
        const text = turn.content || turn.text || '';
        if (text.trim()) {
          lastAsstContent = text.trim().toLowerCase();
          break;
        }
      }
    }

    if (lastAsstContent) {
      const lastWasCircuit = ['circuit', 'diagnos', 'fault', 'wiring', 'cathode', 'anode', 'gnd', 'pin', 'wire', 'breadboard', 'resistor', 'led1', 'circuit doctor', 'wiring mistake'].some(k => lastAsstContent.includes(k));
      const lastWasAcademic = ['kinetic energy', 'velocity', 'potential energy', 'newton', 'acceleration', 'joule'].some(k => lastAsstContent.includes(k));

      if (lastWasCircuit && !lastWasAcademic) {
        if (cleaned.split(/\s+/).length <= 8) return true;
      } else if (lastWasAcademic) {
        return false;
      }
    }
  }

  return false;
}
