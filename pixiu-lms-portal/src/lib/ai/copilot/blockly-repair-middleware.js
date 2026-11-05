const VERIFIED_BLOCK_ALIASES = Object.freeze({
  // pir_motion_detected has field PIN -> pir_motion has field PIN, generates digitalRead
  pir_motion_detected: "pir_motion",
  // actuator_servo_write has field PIN, value ANGLE -> servo_write has field PIN, value ANGLE
  actuator_servo_write: "servo_write",
  // io_tone -> tone_play
  io_tone: "tone_play",
  // io_notone -> tone_stop
  io_notone: "tone_stop",
  // lcd_setup -> lcd_clear (both inject Wire.h, LiquidCrystal_I2C.h, lcd.init(), lcd.backlight() in setup)
  lcd_setup: "lcd_clear"
});
const UNKNOWN_UNSUPPORTED_BLOCKS = /* @__PURE__ */ new Set([
  "max6675_read",
  "max6675_init",
  "t777_display_write",
  "tm1637_init",
  "tm1637_display",
  "servo_read",
  "serial_read",
  "serial_available",
  "time_millis"
]);
function repairBlocklyXml(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions: [],
      unsupportedBlocks: [],
      error: "Empty or invalid response text"
    };
  }
  const actions = [];
  let rawXml = null;
  const fencedMatch = rawText.match(/```(?:xml)?\s*(<xml[\s\S]*?(?:<\/xml>|$))\s*```/i);
  if (fencedMatch) {
    rawXml = fencedMatch[1].trim();
  } else {
    const bareMatch = rawText.match(/(<xml[\s\S]*?(?:<\/xml>|$))/i);
    if (bareMatch) {
      rawXml = bareMatch[1].trim();
    } else {
      const rootBlockMatch = rawText.match(/(<block\s+type=["']arduino_program["'][\s\S]*)/i);
      if (rootBlockMatch) {
        rawXml = `<xml xmlns="https://developers.google.com/blockly/xml">
${rootBlockMatch[1].trim()}
</xml>`;
        actions.push("WRAPPED_ROOT_BLOCK_IN_XML");
      }
    }
  }
  if (!rawXml) {
    return {
      repairedXml: null,
      success: false,
      isHealed: false,
      actions,
      unsupportedBlocks: [],
      error: "No Blockly XML found in response text"
    };
  }
  let xml = rawXml.trim();
  let isHealed = false;
  if (!xml.endsWith("</xml>")) {
    isHealed = true;
    actions.push("HEALED_TRUNCATED_TAGS");
    xml = xml.replace(/<[^>]*$/, "").trim();
    const tagMatches = xml.match(/<(\/?[a-zA-Z0-9_-]+)[^>]*>/g) || [];
    const openStack = [];
    const voidTags = /* @__PURE__ */ new Set(["shadow"]);
    for (const token of tagMatches) {
      const tagNameMatch = token.match(/<(\/?)([a-zA-Z0-9_-]+)/);
      if (!tagNameMatch) continue;
      const isClosing = tagNameMatch[1] === "/";
      const tagName = tagNameMatch[2].toLowerCase();
      if (isClosing) {
        if (openStack.length > 0 && openStack[openStack.length - 1] === tagName) {
          openStack.pop();
        }
      } else {
        if (!token.endsWith("/>") && !voidTags.has(tagName)) {
          openStack.push(tagName);
        }
      }
    }
    for (let i = openStack.length - 1; i >= 0; i--) {
      xml += `</${openStack[i]}>`;
    }
    if (!xml.endsWith("</xml>")) {
      xml += "</xml>";
    }
  }
  if (!xml.includes('xmlns="https://developers.google.com/blockly/xml"')) {
    xml = xml.replace(/<xml(?:\s+[^>]*)?>/i, '<xml xmlns="https://developers.google.com/blockly/xml">');
    actions.push("INJECTED_GOOGLE_XML_NAMESPACE");
  }
  for (const [srcAlias, targetBlock] of Object.entries(VERIFIED_BLOCK_ALIASES)) {
    const pattern = new RegExp(`type=["']${srcAlias}["']`, "g");
    if (pattern.test(xml)) {
      xml = xml.replace(pattern, `type="${targetBlock}"`);
      actions.push(`ALIASED_${srcAlias}_TO_${targetBlock}`);
    }
  }
  const detectedBlocks = Array.from(xml.matchAll(/type=["']([^"']+)["']/g)).map((m) => m[1]);
  const unsupported = detectedBlocks.filter((b) => UNKNOWN_UNSUPPORTED_BLOCKS.has(b));
  if (unsupported.length > 0) {
    return {
      repairedXml: xml,
      success: false,
      isHealed,
      actions,
      unsupportedBlocks: Array.from(new Set(unsupported)),
      error: `Unsupported peripheral blocks detected: ${Array.from(new Set(unsupported)).join(", ")}. These hardware blocks are not defined in the Pixiu LMS toolbox.`
    };
  }
  return {
    repairedXml: xml,
    success: true,
    isHealed,
    actions,
    unsupportedBlocks: []
  };
}
function wrapCopilotPrompt(prompt, options = {}) {
  const parts = [];
  if (options.domain === "math") {
    parts.push(
      "[PEDAGOGICAL GUARDRAIL: In Math Teaching mode, ask the student a diagnostic guiding question first. Do not provide the complete algebraic solution in Turn 1.]"
    );
  }
  if (options.domain === "circuit" || options.hasInductiveLoad) {
    parts.push(
      "[HARDWARE SAFETY GUARDRAIL: ATmega328P pins cannot supply motor/pump/relay current (>20mA). All inductive loads must use an external driver (transistor/MOSFET/relay) and a 1N4007 flyback protection diode across the coil.]"
    );
  }
  parts.push(prompt.trim());
  return parts.join("\n\n");
}
export {
  UNKNOWN_UNSUPPORTED_BLOCKS,
  VERIFIED_BLOCK_ALIASES,
  repairBlocklyXml,
  wrapCopilotPrompt
};
