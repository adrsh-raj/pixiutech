import * as Blockly from "blockly/core"
import type { CircuitState } from "./circuit-types"
import { getPinOptions } from "./pin-map"

/** Operator precedence buckets for the generated C++. */
export const ORDER = {
  ATOMIC: 0,
  UNARY: 1,
  MUL: 2,
  ADD: 3,
  RELATIONAL: 4,
  EQUALITY: 5,
  LOGICAL_AND: 6,
  LOGICAL_OR: 7,
  NONE: 99,
}

/**
 * Dropdown option source. Blockly calls the function each time a dropdown
 * opens, so we read from this live reference to stay in sync with the canvas.
 */
let currentCircuit: CircuitState = { parts: [], wires: [] }
export function setPinContext(circuit: CircuitState) {
  currentCircuit = circuit
}
function pinDropdown(): [string, string][] {
  const opts = getPinOptions(currentCircuit)
  if (opts.length === 0) return [["13", "13"]]
  return opts.map((o) => [o.label, o.code])
}

let defined = false

export function defineArduinoBlocks() {
  if (defined) return
  defined = true

  Blockly.defineBlocksWithJsonArray([
    {
      type: "arduino_program",
      message0: "Arduino %1 setup (runs once) %2 %3 loop (repeats forever) %4 %5",
      args0: [
        { type: "input_dummy" },
        { type: "input_dummy" },
        { type: "input_statement", name: "SETUP" },
        { type: "input_dummy" },
        { type: "input_statement", name: "LOOP" },
      ],
      colour: 180,
      tooltip: "Every Arduino sketch has a setup() and a loop().",
      deletable: false,
    },
    {
      type: "io_pinmode",
      message0: "set pin %1 as %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        {
          type: "field_dropdown",
          name: "MODE",
          options: [
            ["OUTPUT", "OUTPUT"],
            ["INPUT", "INPUT"],
            ["INPUT_PULLUP", "INPUT_PULLUP"],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 30,
      tooltip: "Configure a pin as input or output.",
    },
    {
      type: "io_digitalwrite",
      message0: "digital write pin %1 %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [
            ["HIGH", "HIGH"],
            ["LOW", "LOW"],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Turn a pin on (HIGH) or off (LOW).",
    },
    {
      type: "io_digitalread",
      message0: "digital read pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      output: "Boolean",
      colour: 210,
      tooltip: "Read HIGH/LOW from a pin.",
    },
    {
      type: "io_analogwrite",
      message0: "analog (PWM) write pin %1 value %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "VALUE", check: "Number" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Write a 0-255 PWM value to a pin.",
    },
    {
      type: "io_analogread",
      message0: "analog read pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      output: "Number",
      colour: 260,
      tooltip: "Read a 0-1023 value from an analog pin.",
    },
    {
      type: "time_delay",
      message0: "wait %1 milliseconds",
      args0: [{ type: "input_value", name: "MS", check: "Number" }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: "Pause the program.",
    },
    {
      type: "servo_write",
      message0: "set servo on pin %1 to %2 degrees",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "ANGLE", check: "Number" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 300,
      tooltip: "Move a servo to an angle (0-180).",
    },
    {
      type: "tone_play",
      message0: "play tone on pin %1 at %2 Hz",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "FREQ", check: "Number" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Drive a buzzer at a frequency.",
    },
    {
      type: "tone_stop",
      message0: "stop tone on pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Silence a buzzer.",
    },
  ])
}

/* ------------------------------------------------------------------ */
/* Arduino C++ generator                                               */
/* ------------------------------------------------------------------ */

export const arduino = new Blockly.Generator("Arduino")

// Reserve C++ keywords so variable names never collide.
arduino.addReservedWords("setup,loop,if,else,for,while,int,void,HIGH,LOW,INPUT,OUTPUT,Servo,delay,digitalWrite,digitalRead,analogWrite,analogRead,pinMode,tone,noTone")

arduino.init = function (workspace) {
  const gen = this as any
  gen.definitions_ = Object.create(null)
  if (!gen.nameDB_) {
    gen.nameDB_ = new Blockly.Names(gen.RESERVED_WORDS_)
  } else {
    gen.nameDB_.reset()
  }
  gen.nameDB_.setVariableMap(workspace.getVariableMap())
}

arduino.finish = function (code) {
  const gen = this as any
  const defs = Object.values(gen.definitions_ as Record<string, string>).join("\n")
  return (defs ? defs + "\n\n" : "") + code
}

arduino.scrubNakedValue = (line) => line + ";\n"

arduino.scrub_ = function (block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock()
  const nextCode = thisOnly || !next ? "" : this.blockToCode(next)
  return code + (nextCode as string)
}

function indent(code: string): string {
  return code
    .split("\n")
    .map((l) => (l ? "  " + l : l))
    .join("\n")
}

arduino.forBlock["arduino_program"] = function (block, generator) {
  const setup = generator.statementToCode(block, "SETUP")
  const loop = generator.statementToCode(block, "LOOP")
  return `void setup() {\n${setup}}\n\nvoid loop() {\n${loop}}\n`
}

arduino.forBlock["io_pinmode"] = (block) => {
  const pin = block.getFieldValue("PIN")
  const mode = block.getFieldValue("MODE")
  return `pinMode(${pin}, ${mode});\n`
}

arduino.forBlock["io_digitalwrite"] = (block) => {
  const pin = block.getFieldValue("PIN")
  const state = block.getFieldValue("STATE")
  return `digitalWrite(${pin}, ${state});\n`
}

arduino.forBlock["io_digitalread"] = (block) => {
  return [`digitalRead(${block.getFieldValue("PIN")})`, ORDER.ATOMIC]
}

arduino.forBlock["io_analogwrite"] = (block, generator) => {
  const pin = block.getFieldValue("PIN")
  const value = generator.valueToCode(block, "VALUE", ORDER.NONE) || "0"
  return `analogWrite(${pin}, ${value});\n`
}

arduino.forBlock["io_analogread"] = (block) => {
  return [`analogRead(${block.getFieldValue("PIN")})`, ORDER.ATOMIC]
}

arduino.forBlock["time_delay"] = (block, generator) => {
  const ms = generator.valueToCode(block, "MS", ORDER.NONE) || "1000"
  return `delay(${ms});\n`
}

arduino.forBlock["servo_write"] = function (block, generator) {
  const pin = block.getFieldValue("PIN")
  const angle = generator.valueToCode(block, "ANGLE", ORDER.NONE) || "90"
  const gg = generator as ArduinoGen
  gg.definitions_["servo_include"] = "#include <Servo.h>"
  const name = `servo_${pin}`.replace(/[^a-zA-Z0-9_]/g, "_")
  gg.definitions_[name] = `Servo ${name};`
  return `${name}.attach(${pin});\n${name}.write(${angle});\n`
}

arduino.forBlock["tone_play"] = (block, generator) => {
  const pin = block.getFieldValue("PIN")
  const freq = generator.valueToCode(block, "FREQ", ORDER.NONE) || "440"
  return `tone(${pin}, ${freq});\n`
}

arduino.forBlock["tone_stop"] = (block) => {
  return `noTone(${block.getFieldValue("PIN")});\n`
}

/* ---- generators for the built-in blocks used in the toolbox ---- */

arduino.forBlock["controls_if"] = function (block, generator) {
  let n = 0
  let code = ""
  do {
    const cond = generator.valueToCode(block, "IF" + n, ORDER.NONE) || "false"
    const branch = generator.statementToCode(block, "DO" + n)
    code += (n === 0 ? "if" : " else if") + ` (${cond}) {\n${branch}}`
    n++
  } while (block.getInput("IF" + n))
  if (block.getInput("ELSE")) {
    code += ` else {\n${generator.statementToCode(block, "ELSE")}}`
  }
  return code + "\n"
}

arduino.forBlock["controls_repeat_ext"] = function (block, generator) {
  const times = generator.valueToCode(block, "TIMES", ORDER.NONE) || "0"
  const branch = generator.statementToCode(block, "DO")
  return `for (int i = 0; i < ${times}; i++) {\n${branch}}\n`
}

arduino.forBlock["controls_whileUntil"] = function (block, generator) {
  const until = block.getFieldValue("MODE") === "UNTIL"
  let cond = generator.valueToCode(block, "BOOL", until ? ORDER.UNARY : ORDER.NONE) || "false"
  if (until) cond = "!" + cond
  return `while (${cond}) {\n${generator.statementToCode(block, "DO")}}\n`
}

arduino.forBlock["logic_compare"] = function (block, generator) {
  const ops: Record<string, string> = { EQ: "==", NEQ: "!=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" }
  const op = ops[block.getFieldValue("OP")]
  const order = op === "==" || op === "!=" ? ORDER.EQUALITY : ORDER.RELATIONAL
  const a = generator.valueToCode(block, "A", order) || "0"
  const b = generator.valueToCode(block, "B", order) || "0"
  return [`${a} ${op} ${b}`, order]
}

arduino.forBlock["logic_operation"] = function (block, generator) {
  const and = block.getFieldValue("OP") === "AND"
  const op = and ? "&&" : "||"
  const order = and ? ORDER.LOGICAL_AND : ORDER.LOGICAL_OR
  const a = generator.valueToCode(block, "A", order) || "false"
  const b = generator.valueToCode(block, "B", order) || "false"
  return [`${a} ${op} ${b}`, order]
}

arduino.forBlock["logic_negate"] = function (block, generator) {
  const a = generator.valueToCode(block, "BOOL", ORDER.UNARY) || "true"
  return [`!${a}`, ORDER.UNARY]
}

arduino.forBlock["logic_boolean"] = (block) => {
  return [block.getFieldValue("BOOL") === "TRUE" ? "true" : "false", ORDER.ATOMIC]
}

arduino.forBlock["math_number"] = (block) => {
  return [String(Number(block.getFieldValue("NUM"))), ORDER.ATOMIC]
}

arduino.forBlock["math_arithmetic"] = function (block, generator) {
  const ops: Record<string, [string, number]> = {
    ADD: ["+", ORDER.ADD],
    MINUS: ["-", ORDER.ADD],
    MULTIPLY: ["*", ORDER.MUL],
    DIVIDE: ["/", ORDER.MUL],
  }
  const [op, order] = ops[block.getFieldValue("OP")] ?? ["+", ORDER.ADD]
  const a = generator.valueToCode(block, "A", order) || "0"
  const b = generator.valueToCode(block, "B", order) || "0"
  return [`${a} ${op} ${b}`, order]
}

arduino.forBlock["variables_get"] = function (block, generator) {
  const gg = generator as ArduinoGen
  const name = gg.nameDB_!.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE)
  return [name, ORDER.ATOMIC]
}

arduino.forBlock["variables_set"] = function (block, generator) {
  const gg = generator as ArduinoGen
  const name = gg.nameDB_!.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE)
  const value = generator.valueToCode(block, "VALUE", ORDER.NONE) || "0"
  gg.definitions_[`var_${name}`] = `int ${name};`
  return `${name} = ${value};\n`
}

// keep indent helper referenced (used by callers that post-process)
export { indent }
