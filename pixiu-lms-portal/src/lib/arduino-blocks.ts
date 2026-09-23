import * as Blockly from "blockly"
import type { CircuitState } from "./circuit-types"
import { getPinOptions } from "./pin-map"
import { CATALOG } from "./components-catalog"

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

function componentDropdown(types: string[], emptyLabel = "Add component first"): () => [string, string][] {
  return () => {
    const options = currentCircuit.parts
      .filter((part) => types.includes(part.type))
      .map((part) => [
        (CATALOG[part.type as keyof typeof CATALOG]?.name ?? part.type) + " · " + part.id.slice(0, 6),
        part.id,
      ] as [string, string])
    return options.length > 0 ? options : [[emptyLabel, ""]]
  }
}

let defined = false
let aiClasses = ["car", "person", "phone", "hand"]

export function setAiClassContext(classes: string[]) {
  const normalized = classes.map((value) => value.trim()).filter(Boolean).slice(0, 8)
  aiClasses = Array.from(new Set([...normalized, "car", "person", "phone", "hand"]))
}

function aiClassDropdown(): [string, string][] {
  return aiClasses.map((value) => [value, value])
}

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

  Blockly.Blocks['serial_begin'] = {
    init() {
      this.appendDummyInput().appendField('Serial.begin').appendField(new Blockly.FieldDropdown([['9600','9600'],['115200','115200']]), 'BAUD')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(160)
      this.setTooltip('Initialize serial communication')
    }
  }

  Blockly.Blocks['serial_print'] = {
    init() {
      this.appendValueInput('TEXT').setCheck(null).appendField('Serial.print')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(160)
      this.setTooltip('Print to Serial Monitor')
    }
  }

  Blockly.Blocks['serial_println'] = {
    init() {
      this.appendValueInput('TEXT').setCheck(null).appendField('Serial.println')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(160)
      this.setTooltip('Print line to Serial Monitor')
    }
  }

  Blockly.Blocks['text_string'] = {
    init() {
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput('Hello'), 'TEXT').appendField('"')
      this.setOutput(true, 'String')
      this.setColour(160)
      this.setTooltip('Text string value')
    }
  }

  Blockly.Blocks['lcd_print'] = {
    init() {
      this.appendValueInput('TEXT').setCheck(null).appendField('LCD print')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Print text to LCD display')
    }
  }

  Blockly.Blocks['lcd_set_cursor'] = {
    init() {
      this.appendDummyInput()
        .appendField('LCD set cursor col')
        .appendField(new Blockly.FieldNumber(0, 0, 15), 'COL')
        .appendField('row')
        .appendField(new Blockly.FieldNumber(0, 0, 1), 'ROW')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Set LCD cursor position')
    }
  }

  Blockly.Blocks['lcd_clear'] = {
    init() {
      this.appendDummyInput().appendField('LCD clear')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Clear LCD display')
    }
  }

  Blockly.Blocks['ir_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('IR obstacle?')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['ir-sensor'])), 'SENSOR')
      this.setOutput(true, 'Boolean')
      this.setColour(230)
      this.setTooltip('Read the virtual IR obstacle sensor.')
    }
  }

  Blockly.Blocks['dht_temperature'] = {
    init() {
      this.appendDummyInput()
        .appendField('DHT11 temperature')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['dht11'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read temperature in degrees Celsius.')
    }
  }

  Blockly.Blocks['dht_humidity'] = {
    init() {
      this.appendDummyInput()
        .appendField('DHT11 humidity')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['dht11'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read relative humidity percentage.')
    }
  }

  Blockly.Blocks['joystick_x'] = {
    init() {
      this.appendDummyInput()
        .appendField('Joystick X')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['joystick'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(210)
      this.setTooltip('Read X axis from 0 to 1023.')
    }
  }

  Blockly.Blocks['joystick_y'] = {
    init() {
      this.appendDummyInput()
        .appendField('Joystick Y')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['joystick'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(210)
      this.setTooltip('Read Y axis from 0 to 1023.')
    }
  }

  Blockly.Blocks['joystick_button'] = {
    init() {
      this.appendDummyInput()
        .appendField('Joystick button')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['joystick'])), 'SENSOR')
      this.setOutput(true, 'Boolean')
      this.setColour(210)
      this.setTooltip('Read the joystick push button.')
    }
  }

  Blockly.Blocks['soil_moisture_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('Soil moisture')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['soil-moisture'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(120)
      this.setTooltip('Read simulated soil moisture from 0 to 1023.')
    }
  }

  Blockly.Blocks['encoder_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('Encoder count')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['rotary-encoder'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(45)
      this.setTooltip('Read the virtual rotary encoder count.')
    }
  }

  Blockly.Blocks['keypad_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('Keypad key')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['keypad-4x4'])), 'SENSOR')
      this.setOutput(true, 'String')
      this.setColour(45)
      this.setTooltip('Read the last virtual key pressed.')
    }
  }

  Blockly.Blocks['oled_print'] = {
    init() {
      this.appendValueInput('TEXT').setCheck(null).appendField('OLED print')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Print text to the connected OLED display.')
    }
  }

  Blockly.Blocks['oled_clear'] = {
    init() {
      this.appendDummyInput().appendField('OLED clear')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Clear the virtual OLED display.')
    }
  }

  Blockly.Blocks['motor_driver_write'] = {
    init() {
      this.appendDummyInput()
        .appendField('Motor driver')
        .appendField(new Blockly.FieldDropdown([['A', 'A'], ['B', 'B']]), 'CHANNEL')
        .appendField('direction')
        .appendField(new Blockly.FieldDropdown([['CW', 'CW'], ['CCW', 'CCW'], ['STOP', 'STOP']]), 'DIRECTION')
        .appendField('speed')
      this.appendValueInput('SPEED').setCheck('Number')
      this.appendDummyInput()
        .appendField('pins ENA')
        .appendField(new Blockly.FieldNumber(5, 0, 13), 'ENA')
        .appendField('ENB')
        .appendField(new Blockly.FieldNumber(6, 0, 13), 'ENB')
      this.appendDummyInput()
        .appendField('IN1')
        .appendField(new Blockly.FieldNumber(7, 0, 13), 'IN1')
        .appendField('IN2')
        .appendField(new Blockly.FieldNumber(8, 0, 13), 'IN2')
      this.appendDummyInput()
        .appendField('IN3')
        .appendField(new Blockly.FieldNumber(9, 0, 13), 'IN3')
        .appendField('IN4')
        .appendField(new Blockly.FieldNumber(10, 0, 13), 'IN4')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(300)
      this.setTooltip('Drive one channel of the L298N using Arduino output pins.')
    }
  }

  Blockly.Blocks['ultrasonic_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('read distance (cm) trig pin')
        .appendField(new Blockly.FieldNumber(9, 0, 13), 'TRIG')
        .appendField('echo pin')
        .appendField(new Blockly.FieldNumber(10, 0, 13), 'ECHO')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read distance from HC-SR04 ultrasonic sensor in cm')
    }
  }

  /* --- PictoBlox AI Vision Blocks --- */
  Blockly.Blocks['ai_is_detected'] = {
    init() {
      this.appendDummyInput()
        .appendField('🤖 AI sees')
        .appendField(new Blockly.FieldTextInput('car'), 'CLASS')
        .appendField('?')
      this.setOutput(true, 'Boolean')
      this.setColour(285)
      this.setTooltip('Returns true when the normalized AI class matches this label.')
    },
  }

  Blockly.Blocks['ai_get_detected_class'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI detected object')
      this.setOutput(true, 'String')
      this.setColour(285)
      this.setTooltip('Returns the name of the currently detected object.')
    },
  }

  Blockly.Blocks['ai_confidence'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI confidence (%)')
      this.setOutput(true, 'Number')
      this.setColour(285)
      this.setTooltip('Returns the AI detection confidence score (0 to 100%).')
    },
  }

  Blockly.Blocks['ai_camera_enable'] = {
    init() {
      this.appendDummyInput()
        .appendField('🤖 turn AI camera')
        .appendField(
          new Blockly.FieldDropdown([
            ['ON', 'ON'],
            ['OFF', 'OFF'],
          ]),
          'STATE',
        )
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(285)
      this.setTooltip('Enable or disable the AI vision camera.')
    },
  }
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

arduino.forBlock['serial_begin'] = (block) => 'Serial.begin(' + block.getFieldValue('BAUD') + ');\n'

arduino.forBlock['serial_print'] = (block, gen) => {
  const text = gen.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return 'Serial.print(' + text + ');\n'
}

arduino.forBlock['serial_println'] = (block, gen) => {
  const text = gen.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return 'Serial.println(' + text + ');\n'
}

arduino.forBlock['text_string'] = (block) => ['"' + block.getFieldValue('TEXT') + '"', ORDER.ATOMIC]

arduino.forBlock['lcd_print'] = (block, gen) => {
  const text = gen.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return 'lcd.print(' + text + ');\n'
}

arduino.forBlock['lcd_set_cursor'] = (block) => {
  return 'lcd.setCursor(' + block.getFieldValue('COL') + ', ' + block.getFieldValue('ROW') + ');\n'
}

arduino.forBlock['lcd_clear'] = () => 'lcd.clear();\n'

arduino.forBlock['ir_read'] = (block) => ['digitalRead(' + block.getFieldValue('SENSOR') + ')', ORDER.ATOMIC]
arduino.forBlock['dht_temperature'] = (block, generator) => {
  const sensor = block.getFieldValue('SENSOR') || 'dht'
  ;(generator as ArduinoGen).definitions_[`dht_${sensor}`] = `// Add DHT11 setup for ${sensor} before uploading.\\n`
  return [`dht_${sensor}.readTemperature()`, ORDER.ATOMIC]
}
arduino.forBlock['dht_humidity'] = (block) => [`dht_${block.getFieldValue('SENSOR') || 'dht'}.readHumidity()`, ORDER.ATOMIC]
arduino.forBlock['joystick_x'] = (block) => [`analogRead(${block.getFieldValue('SENSOR') || 'A0'})`, ORDER.ATOMIC]
arduino.forBlock['joystick_y'] = (block) => [`analogRead(${block.getFieldValue('SENSOR') || 'A1'})`, ORDER.ATOMIC]
arduino.forBlock['joystick_button'] = (block) => [`digitalRead(${block.getFieldValue('SENSOR') || '2'})`, ORDER.ATOMIC]
arduino.forBlock['soil_moisture_read'] = (block) => [`analogRead(${block.getFieldValue('SENSOR') || 'A0'})`, ORDER.ATOMIC]
arduino.forBlock['encoder_read'] = (block) => [`readEncoder("${block.getFieldValue('SENSOR') || ''}")`, ORDER.ATOMIC]
arduino.forBlock['keypad_read'] = (block) => [`readKeypad("${block.getFieldValue('SENSOR') || ''}")`, ORDER.ATOMIC]
arduino.forBlock['oled_print'] = (block, generator) => {
  const text = generator.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return 'oled.print(' + text + ');\\n'
}
arduino.forBlock['oled_clear'] = () => 'oled.clearDisplay(); oled.display();\\n'
arduino.forBlock['motor_driver_write'] = (block, generator) => {
  const channel = block.getFieldValue('CHANNEL') || 'A'
  const speed = generator.valueToCode(block, 'SPEED', ORDER.NONE) || '0'
  const direction = block.getFieldValue('DIRECTION') || 'STOP'
  const ena = block.getFieldValue(channel === 'A' ? 'ENA' : 'ENB')
  const in1 = block.getFieldValue(channel === 'A' ? 'IN1' : 'IN3')
  const in2 = block.getFieldValue(channel === 'A' ? 'IN2' : 'IN4')
  if (direction === 'STOP') return `analogWrite(${ena}, 0); digitalWrite(${in1}, LOW); digitalWrite(${in2}, LOW);\\n`
  const highPin = direction === 'CW' ? in1 : in2
  const lowPin = direction === 'CW' ? in2 : in1
  return `analogWrite(${ena}, ${speed}); digitalWrite(${highPin}, HIGH); digitalWrite(${lowPin}, LOW);\\n`
}

arduino.forBlock['ultrasonic_read'] = (block) => {
  const trig = block.getFieldValue('TRIG')
  const echo = block.getFieldValue('ECHO')
  return ['readUltrasonic(' + trig + ', ' + echo + ')', ORDER.ATOMIC]
}

/* AI Vision C++ Generators */
arduino.forBlock['ai_is_detected'] = (block) => {
  const cls = block.getFieldValue('CLASS') ?? 'car'
  return ['aiVision.isDetected("' + cls + '")', ORDER.ATOMIC]
}

arduino.forBlock['ai_get_detected_class'] = () => ['aiVision.getDetectedClass()', ORDER.ATOMIC]

arduino.forBlock['ai_confidence'] = () => ['aiVision.getConfidence()', ORDER.ATOMIC]

arduino.forBlock['ai_camera_enable'] = (block) => {
  const state = block.getFieldValue('STATE') ?? 'ON'
  return 'aiVision.setCamera(' + (state === 'ON' ? 'true' : 'false') + ');\n'
}

// keep indent helper referenced (used by callers that post-process)
export { indent }
