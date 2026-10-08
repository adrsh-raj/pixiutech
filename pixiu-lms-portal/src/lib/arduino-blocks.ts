import * as Blockly from "blockly"
import type { CircuitState } from "./circuit-types"
import { getPinOptions } from "./pin-map"
import { CATALOG } from "./components-catalog"
import { COCO_SSD_CLASSES } from "./ai/object-detector"

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
let aiClasses: string[] = [...COCO_SSD_CLASSES, "phone", "hand"]

export function setAiClassContext(classes: string[]) {
  const normalized = classes.map((value) => value.trim().toLowerCase()).filter(Boolean).slice(0, 32)
  aiClasses = Array.from(new Set([...COCO_SSD_CLASSES, ...normalized, "phone", "hand"]))
}

function aiClassDropdown(): [string, string][] {
  return aiClasses.map((value) => [value === "phone" ? "phone (legacy alias)" : value, value])
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
      tooltip: "Write a 0-255 PWM value (or true DAC voltage on ESP32 DAC pins) to a pin.",
    },
    {
      type: "io_analogread",
      message0: "analog read pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      output: "Number",
      colour: 260,
      tooltip: "Read an analog value from a pin (0-1023 on Arduino Uno, 0-4095 on ESP32 12-bit ADC).",
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

  // Backward compatibility block aliases
  Blockly.Blocks['io_tone'] = Blockly.Blocks['tone_play']
  Blockly.Blocks['io_notone'] = Blockly.Blocks['tone_stop']
  Blockly.Blocks['actuator_servo_write'] = Blockly.Blocks['servo_write']

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

  Blockly.Blocks['lcd_print_line'] = {
    init() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('LCD print on line')
        .appendField(new Blockly.FieldDropdown([['1 (Top)', '1'], ['2 (Bottom)', '2']]), 'LINE')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Print text on LCD line 1 or line 2 (16 characters max)')
    }
  }

  Blockly.Blocks['seven_segment_write'] = {
    init() {
      this.appendValueInput('DIGIT')
        .setCheck('Number')
        .appendField('7-Segment display digit')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Display a number (0-9) on the 7-segment display')
    }
  }

  Blockly.Blocks['seven_segment_clear'] = {
    init() {
      this.appendDummyInput().appendField('7-Segment clear')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(120)
      this.setTooltip('Turn off all segments on the 7-segment display')
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
      this.setTooltip('Read the last virtual key pressed or entered PIN.')
    }
  }

  Blockly.Blocks['keypad_check_pin'] = {
    init() {
      this.appendValueInput('PIN')
        .setCheck(null)
        .appendField('Keypad PIN matches')
      this.setOutput(true, 'Boolean')
      this.setColour(45)
      this.setTooltip('Checks if entered keypad PIN matches the secret password')
    }
  }

  Blockly.Blocks['keypad_clear_pin'] = {
    init() {
      this.appendDummyInput().appendField('clear keypad PIN')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(45)
      this.setTooltip('Clears the entered keypad PIN buffer')
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

  Blockly.Blocks['pushbutton_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('Pushbutton pressed?')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['pushbutton'])), 'SENSOR')
      this.setOutput(true, 'Boolean')
      this.setColour(210)
      this.setTooltip('Read the live pressed state of a virtual pushbutton.')
    }
  }

  Blockly.Blocks['pir_motion'] = {
    init() {
      this.appendDummyInput()
        .appendField('PIR motion?')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['pir-sensor'])), 'SENSOR')
      this.setOutput(true, 'Boolean')
      this.setColour(230)
      this.setTooltip('Read whether the virtual PIR sensor detects motion.')
    }
  }

  Blockly.Blocks['ldr_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('LDR light')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['ldr'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read the simulated LDR light level.')
    }
  }

  Blockly.Blocks['tmp36_temperature'] = {
    init() {
      this.appendDummyInput()
        .appendField('TMP36 temperature')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['tmp36'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read the simulated TMP36 temperature.')
    }
  }

  Blockly.Blocks['potentiometer_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('Potentiometer')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['potentiometer'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(210)
      this.setTooltip('Read the potentiometer wiper value.')
    }
  }

  Blockly.Blocks['neopixel_set_color'] = {
    init() {
      this.appendDummyInput()
        .appendField('NeoPixel')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['neopixel-ring'])), 'SENSOR')
        .appendField('pixel #')
      this.appendValueInput('PIXEL').setCheck('Number')
      this.appendDummyInput().appendField('color')
      this.appendValueInput('COLOR').setCheck('String')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(280)
      this.setTooltip('Set the color of an individual NeoPixel RGB LED.')
    }
  }

  Blockly.Blocks['neopixel_show'] = {
    init() {
      this.appendDummyInput()
        .appendField('NeoPixel show')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['neopixel-ring'])), 'SENSOR')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(280)
      this.setTooltip('Refresh and display updated colors on the NeoPixel ring.')
    }
  }

  Blockly.Blocks['mq2_gas_read'] = {
    init() {
      this.appendDummyInput()
        .appendField('MQ-2 Gas level (ppm)')
        .appendField(new Blockly.FieldDropdown(componentDropdown(['mq2-gas'])), 'SENSOR')
      this.setOutput(true, 'Number')
      this.setColour(230)
      this.setTooltip('Read simulated gas concentration in parts per million (ppm).')
    }
  }

  Blockly.Blocks['arduino_map'] = {
    init() {
      this.appendValueInput('VALUE').setCheck('Number').appendField('map')
      this.appendValueInput('FROM_LOW').setCheck('Number').appendField('from')
      this.appendValueInput('FROM_HIGH').setCheck('Number').appendField('to')
      this.appendValueInput('TO_LOW').setCheck('Number').appendField('→')
      this.appendValueInput('TO_HIGH').setCheck('Number')
      this.setOutput(true, 'Number')
      this.setColour(260)
      this.setTooltip('Map one numeric range to another.')
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

  /* --- PIXIU AI Runtime Blocks --- */
  Blockly.Blocks['ai_is_detected'] = {
    init() {
      this.appendDummyInput()
        .appendField('🤖 AI sees')
        .appendField(new Blockly.FieldDropdown(aiClassDropdown), 'CLASS')
        .appendField('?')
      this.setOutput(true, 'Boolean')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: checks the live AI result in the simulator.')
    },
  }

  Blockly.Blocks['ai_is_unknown'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI result is unknown?')
      this.setOutput(true, 'Boolean')
      this.setColour(285)
      this.setTooltip('Returns true when AI has no accepted result or confidence is below the AI threshold.')
    },
  }

  Blockly.Blocks['ai_get_detected_class'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI detected object')
      this.setOutput(true, 'String')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: returns the current AI label in the simulator.')
    },
  }

  Blockly.Blocks['ai_confidence'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI confidence (%)')
      this.setOutput(true, 'Number')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: returns AI confidence (0 to 100%) in the simulator.')
    },
  }

  Blockly.Blocks['ai_get_object_count'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI objects in view')
      this.setOutput(true, 'Number')
      this.setColour(285)
      this.setTooltip('Returns the number of accepted object detections in the current AI frame.')
    }
  }

  Blockly.Blocks['ai_get_gesture'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI gesture')
      this.setOutput(true, 'String')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: returns the interpreted hand gesture in the simulator.')
    },
  }

  Blockly.Blocks['ai_get_finger_count'] = {
    init() {
      this.appendDummyInput().appendField('🤖 AI finger count')
      this.setOutput(true, 'Number')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: returns the stable 0–5 finger count in the simulator.')
    },
  }

  Blockly.Blocks['ai_is_gesture'] = {
    init() {
      const gestures = [
        ['Fist', 'fist'],
        ['Thumbs Up', 'thumbs_up'],
        ['Thumbs Down', 'thumbs_down'],
        ['Point', 'point'],
        ['Peace', 'peace'],
        ['One', 'one'],
        ['Two', 'two'],
        ['Three', 'three'],
        ['Four', 'four'],
        ['Open Palm', 'open_palm'],
      ]
      this.appendDummyInput()
        .appendField('🤖 AI gesture is')
        .appendField(new Blockly.FieldDropdown(gestures), 'GESTURE')
      this.setOutput(true, 'Boolean')
      this.setColour(285)
      this.setTooltip('Browser AI Studio block: checks the interpreted hand gesture.')
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
      this.setTooltip('Browser AI Studio block: enable or disable the camera runtime in the simulator.')
    },
  }

  Blockly.Blocks['ai_microphone_enable'] = {
    init() {
      this.appendDummyInput()
        .appendField('🤖 turn AI microphone')
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
      this.setTooltip('Browser AI Studio block: enable or disable the microphone and Sound AI input.')
    },
  }

  /* --- ESP32 Virtual Wi-Fi & Web Server Blocks --- */
  Blockly.Blocks['wifi_connect'] = {
    init() {
      this.appendDummyInput()
        .appendField('📡 Wi-Fi connect SSID')
        .appendField(new Blockly.FieldTextInput('Pixiu_IoT'), 'SSID')
        .appendField('password')
        .appendField(new Blockly.FieldTextInput('12345678'), 'PASS')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(205)
      this.setTooltip('Connect ESP32 to virtual Wi-Fi network with given SSID and password.')
    },
  }

  Blockly.Blocks['wifi_is_connected'] = {
    init() {
      this.appendDummyInput().appendField('📡 Wi-Fi connected?')
      this.setOutput(true, 'Boolean')
      this.setColour(205)
      this.setTooltip('Returns true when ESP32 has connected to the Wi-Fi network.')
    },
  }

  Blockly.Blocks['wifi_local_ip'] = {
    init() {
      this.appendDummyInput().appendField('📡 Wi-Fi IP address')
      this.setOutput(true, 'String')
      this.setColour(205)
      this.setTooltip('Returns the IP address assigned to ESP32 on the network.')
    },
  }

  Blockly.Blocks['wifi_server_begin'] = {
    init() {
      this.appendDummyInput()
        .appendField('🌐 start Web Server port')
        .appendField(new Blockly.FieldNumber(80, 1, 65535), 'PORT')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(205)
      this.setTooltip('Start the HTTP Web Server on the given port (default: 80).')
    },
  }

  Blockly.Blocks['wifi_server_on'] = {
    init() {
      this.appendDummyInput()
        .appendField('🌐 on HTTP request route')
        .appendField(new Blockly.FieldTextInput('/led/on'), 'PATH')
      this.appendStatementInput('DO').appendField('do')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(205)
      this.setTooltip('Define an HTTP endpoint route and handler callback.')
    },
  }

  Blockly.Blocks['wifi_server_send'] = {
    init() {
      this.appendValueInput('CONTENT')
        .setCheck(null)
        .appendField('🌐 send HTTP response')
        .appendField(new Blockly.FieldNumber(200, 100, 599), 'STATUS')
        .appendField('content')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(205)
      this.setTooltip('Send an HTTP response status code and HTML/text payload to the client.')
    },
  }

  /* --- BBC micro:bit v2 Blocks --- */
  Blockly.Blocks['microbit_show_icon'] = {
    init() {
      const icons = [
        ['Heart', 'heart'],
        ['Smile', 'smile'],
        ['Check', 'check'],
        ['Sad', 'sad'],
        ['Ghost', 'ghost'],
        ['Square', 'square'],
      ]
      this.appendDummyInput()
        .appendField('🟩 micro:bit show icon')
        .appendField(new Blockly.FieldDropdown(icons), 'ICON')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(345)
      this.setTooltip('Display a built-in symbol on the 5x5 LED matrix display.')
    },
  }

  Blockly.Blocks['microbit_show_number'] = {
    init() {
      this.appendValueInput('NUM')
        .setCheck('Number')
        .appendField('🟩 micro:bit show number')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(345)
      this.setTooltip('Display a number on the 5x5 LED matrix.')
    },
  }

  Blockly.Blocks['microbit_show_string'] = {
    init() {
      this.appendValueInput('TEXT')
        .setCheck(null)
        .appendField('🟩 micro:bit show text')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(345)
      this.setTooltip('Scroll text across the 5x5 LED matrix display.')
    },
  }

  Blockly.Blocks['microbit_clear'] = {
    init() {
      this.appendDummyInput().appendField('🟩 micro:bit clear display')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(345)
      this.setTooltip('Clear all LEDs on the 5x5 matrix display.')
    },
  }

  Blockly.Blocks['microbit_button_pressed'] = {
    init() {
      this.appendDummyInput()
        .appendField('🟩 micro:bit button')
        .appendField(new Blockly.FieldDropdown([['A', 'A'], ['B', 'B']]), 'BTN')
        .appendField('is pressed?')
      this.setOutput(true, 'Boolean')
      this.setColour(345)
      this.setTooltip('Check whether tactile button A or B on the micro:bit is pressed.')
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

arduino.forBlock["io_tone"] = arduino.forBlock["tone_play"]
arduino.forBlock["io_notone"] = arduino.forBlock["tone_stop"]
arduino.forBlock["actuator_servo_write"] = arduino.forBlock["servo_write"]

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

arduino.forBlock["math_modulo"] = function (block, generator) {
  const a = generator.valueToCode(block, "DIVIDEND", ORDER.NONE) || "0"
  const b = generator.valueToCode(block, "DIVISOR", ORDER.NONE) || "1"
  return [`((${a}) % (${b}))`, ORDER.MUL]
}

arduino.forBlock["math_single"] = function (block, generator) {
  const op = block.getFieldValue("OP") || "ABS"
  const value = generator.valueToCode(block, "NUM", ORDER.NONE) || "0"
  const expressions: Record<string, string> = {
    ROOT: `sqrt(${value})`,
    ABS: `abs(${value})`,
    NEG: `-(${value})`,
    SIN: `sin((${value}) * PI / 180.0)`,
    COS: `cos((${value}) * PI / 180.0)`,
    TAN: `tan((${value}) * PI / 180.0)`,
  }
  return [expressions[op] || value, ORDER.ATOMIC]
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

arduino.forBlock['text_string'] = (block) => [
  JSON.stringify(String(block.getFieldValue('TEXT') ?? '')),
  ORDER.ATOMIC,
]

arduino.forBlock['lcd_print'] = function (block, generator) {
  const gg = generator as ArduinoGen
  gg.definitions_['wire_include'] = '#include <Wire.h>'
  gg.definitions_['lcd_include'] = '#include <LiquidCrystal_I2C.h>'
  gg.definitions_['lcd_decl'] = 'LiquidCrystal_I2C lcd(0x27, 16, 2);'
  const text = generator.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return `lcd.print(${text});\n`
}

arduino.forBlock['lcd_print_line'] = function (block, generator) {
  const gg = generator as ArduinoGen
  gg.definitions_['wire_include'] = '#include <Wire.h>'
  gg.definitions_['lcd_include'] = '#include <LiquidCrystal_I2C.h>'
  gg.definitions_['lcd_decl'] = 'LiquidCrystal_I2C lcd(0x27, 16, 2);'
  const line = block.getFieldValue('LINE') || '1'
  const row = Number(line) === 2 ? 1 : 0
  const text = generator.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return `lcd.setCursor(0, ${row});\nlcd.print(${text});\n`
}

arduino.forBlock['lcd_set_cursor'] = function (block) {
  const col = block.getFieldValue('COL') ?? '0'
  const row = block.getFieldValue('ROW') ?? '0'
  return `lcd.setCursor(${col}, ${row});\n`
}

arduino.forBlock['lcd_clear'] = function () {
  return 'lcd.clear();\n'
}

arduino.forBlock['seven_segment_write'] = function (block, generator) {
  const digit = generator.valueToCode(block, 'DIGIT', ORDER.NONE) || '0'
  return `displayDigit(${digit});\n`
}

arduino.forBlock['seven_segment_clear'] = function () {
  return 'clearDisplay();\n'
}

arduino.forBlock['ir_read'] = (block) => [
  'false /* PIXIU simulated IR obstacle sensor: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['dht_temperature'] = (block) => [
  '0 /* PIXIU simulated DHT11 temperature: ' + String(block.getFieldValue('SENSOR') || 'dht') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['dht_humidity'] = (block) => [
  '0 /* PIXIU simulated DHT11 humidity: ' + String(block.getFieldValue('SENSOR') || 'dht') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['joystick_x'] = (block) => [
  '512 /* PIXIU simulated joystick X: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['joystick_y'] = (block) => [
  '512 /* PIXIU simulated joystick Y: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['joystick_button'] = (block) => [
  'false /* PIXIU simulated joystick button: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['soil_moisture_read'] = (block) => [
  '0 /* PIXIU simulated soil moisture: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['encoder_read'] = (block) => [
  '0 /* PIXIU simulated rotary encoder: ' + String(block.getFieldValue('SENSOR') || '') + ' */',
  ORDER.ATOMIC,
]
arduino.forBlock['keypad_read'] = function () {
  return ['keypad.getKey()', ORDER.ATOMIC]
}

arduino.forBlock['keypad_check_pin'] = function (block, generator) {
  const pin = generator.valueToCode(block, 'PIN', ORDER.NONE) || '"1234"'
  return [`(enteredPin == ${pin})`, ORDER.EQUALITY]
}

arduino.forBlock['keypad_clear_pin'] = function () {
  return 'enteredPin = "";\n'
}

arduino.forBlock['oled_print'] = function (block, generator) {
  const gg = generator as ArduinoGen
  gg.definitions_['wire_include'] = '#include <Wire.h>'
  gg.definitions_['adafruit_gfx'] = '#include <Adafruit_GFX.h>'
  gg.definitions_['adafruit_ssd1306'] = '#include <Adafruit_SSD1306.h>'
  gg.definitions_['oled_decl'] = 'Adafruit_SSD1306 oled(128, 64, &Wire, -1);'
  const text = generator.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return `oled.println(${text});\noled.display();\n`
}

arduino.forBlock['oled_clear'] = function () {
  return 'oled.clearDisplay();\noled.display();\n'
}
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

arduino.forBlock['pushbutton_read'] = (block) => ['false /* PIXIU simulated pushbutton: ' + String(block.getFieldValue('SENSOR') || '') + ' */', ORDER.ATOMIC]
arduino.forBlock['pir_motion'] = (block) => ['false /* PIXIU simulated PIR: ' + String(block.getFieldValue('SENSOR') || '') + ' */', ORDER.ATOMIC]
arduino.forBlock['ldr_read'] = () => ['analogRead(A0) /* PIXIU simulated LDR */', ORDER.ATOMIC]
arduino.forBlock['tmp36_temperature'] = () => ['analogRead(A0) /* PIXIU simulated TMP36 */', ORDER.ATOMIC]
arduino.forBlock['potentiometer_read'] = () => ['analogRead(A0) /* PIXIU simulated potentiometer */', ORDER.ATOMIC]
arduino.forBlock['neopixel_set_color'] = (block, generator) => {
  const pixel = generator.valueToCode(block, 'PIXEL', ORDER.NONE) || '0'
  const color = generator.valueToCode(block, 'COLOR', ORDER.NONE) || '"#ff0000"'
  return `/* PIXIU NeoPixel: setPixelColor(${pixel}, ${color}) */\n`
}
arduino.forBlock['neopixel_show'] = () => {
  return '/* PIXIU NeoPixel: show() */\n'
}
arduino.forBlock['mq2_gas_read'] = () => ['analogRead(A0) /* PIXIU simulated MQ-2 Gas PPM */', ORDER.ATOMIC]
arduino.forBlock['arduino_map'] = (block, generator) => {
  const value = generator.valueToCode(block, 'VALUE', ORDER.NONE) || '0'
  const fromLow = generator.valueToCode(block, 'FROM_LOW', ORDER.NONE) || '0'
  const fromHigh = generator.valueToCode(block, 'FROM_HIGH', ORDER.NONE) || '1023'
  const toLow = generator.valueToCode(block, 'TO_LOW', ORDER.NONE) || '0'
  const toHigh = generator.valueToCode(block, 'TO_HIGH', ORDER.NONE) || '255'
  return ['map(' + value + ', ' + fromLow + ', ' + fromHigh + ', ' + toLow + ', ' + toHigh + ')', ORDER.ATOMIC]
}

arduino.forBlock['ultrasonic_read'] = (block) => [
  '0 /* PIXIU simulated ultrasonic distance: D' +
    String(block.getFieldValue('TRIG') || '?') +
    '/D' +
    String(block.getFieldValue('ECHO') || '?') +
    ' */',
  ORDER.ATOMIC,
]

/* Browser AI generators -------------------------------------------------
 * PIXIU AI inference lives in the browser runtime. Arduino C++ generation is
 * intentionally compile-safe and documents that the AI action is simulator
 * runtime behavior rather than an Arduino-side aiVision library call.
 */
arduino.forBlock['ai_is_detected'] = (block) => {
  const cls = block.getFieldValue('CLASS') ?? 'car'
  const safeClass = String(cls).replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'car'
  return [
    'false /* PIXIU AI Studio: browser-only AI sees "' + safeClass + '". */',
    ORDER.ATOMIC,
  ]
}

arduino.forBlock['ai_is_unknown'] = () => [
  'false /* PIXIU AI Studio browser-only: normalized unknown/low-confidence result. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_get_detected_class'] = () => [
  '"none" /* PIXIU AI Studio: browser-only AI detected class. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_get_object_count'] = () => [
  '0 /* PIXIU AI Studio: browser-only object count. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_confidence'] = () => [
  '0 /* PIXIU AI Studio: browser-only AI confidence (0-100). */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_get_gesture'] = () => [
  '"none" /* PIXIU AI Studio: browser-only hand gesture. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_get_finger_count'] = () => [
  '0 /* PIXIU AI Studio: browser-only finger count. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_is_gesture'] = () => [
  'false /* PIXIU AI Studio: browser-only gesture predicate. */',
  ORDER.ATOMIC,
]

arduino.forBlock['ai_camera_enable'] = (block) => {
  const state = block.getFieldValue('STATE') ?? 'ON'
  return '/* PIXIU AI Studio browser runtime: AI camera ' +
    state.toLowerCase() +
    '. This is not an Arduino camera API. */\n'
}

arduino.forBlock['ai_microphone_enable'] = (block) => {
  const state = block.getFieldValue('STATE') ?? 'ON'
  return '/* PIXIU AI Studio browser runtime: AI microphone ' +
    state.toLowerCase() +
    '. This is not an Arduino microphone API. */\n'
}

/* --- Wi-Fi & Web Server C++ Generators --- */
arduino.forBlock['wifi_connect'] = (block) => {
  const ssid = block.getFieldValue('SSID') || 'Pixiu_IoT'
  const pass = block.getFieldValue('PASS') || ''
  return `WiFi.begin("${ssid}", "${pass}");\n`
}

arduino.forBlock['wifi_is_connected'] = () => [
  '(WiFi.status() == WL_CONNECTED)',
  ORDER.EQUALITY,
]

arduino.forBlock['wifi_local_ip'] = () => [
  'WiFi.localIP().toString()',
  ORDER.ATOMIC,
]

arduino.forBlock['wifi_server_begin'] = (block) => {
  const port = block.getFieldValue('PORT') || 80
  return `server.begin(${port});\n`
}

arduino.forBlock['wifi_server_on'] = (block, generator) => {
  const path = block.getFieldValue('PATH') || block.getFieldValue('ROUTE') || '/'
  const branch = generator.statementToCode(block, 'DO') || generator.statementToCode(block, 'HANDLER') || ''
  return `server.on("${path}", []() {\n${branch}});\n`
}

arduino.forBlock['wifi_server_send'] = (block, generator) => {
  const status = block.getFieldValue('STATUS') || block.getFieldValue('CODE') || 200
  const content = generator.valueToCode(block, 'CONTENT', ORDER.NONE) || generator.valueToCode(block, 'BODY', ORDER.NONE) || '""'
  return `server.send(${status}, "text/html", ${content});\n`
}

/* --- micro:bit C++ Generators --- */
arduino.forBlock['microbit_show_icon'] = (block) => {
  const icon = block.getFieldValue('ICON') || 'heart'
  return `uBit.display.show(IconNames::${icon});\n`
}

arduino.forBlock['microbit_show_number'] = (block, generator) => {
  const num = generator.valueToCode(block, 'NUM', ORDER.NONE) || '0'
  return `uBit.display.print(${num});\n`
}

arduino.forBlock['microbit_show_string'] = (block, generator) => {
  const text = generator.valueToCode(block, 'TEXT', ORDER.NONE) || '""'
  return `uBit.display.scroll(${text});\n`
}

arduino.forBlock['microbit_clear'] = () => 'uBit.display.clear();\n'

arduino.forBlock['microbit_button_pressed'] = (block) => {
  const btn = block.getFieldValue('BTN') || 'A'
  return [`uBit.button${btn}.isPressed()`, ORDER.ATOMIC]
}

// keep indent helper referenced (used by callers that post-process)
export { indent }

/**
 * Normalizes Blockly XML strings to ensure backward and forward compatibility
 * across different schema conventions (e.g. ROUTE -> PATH, HANDLER -> DO,
 * CODE -> STATUS, BODY -> CONTENT).
 */
export function normalizeBlocklyXml(xml: string): string {
  if (!xml || typeof xml !== "string") return xml
  let normalized = xml

  // 1. wifi_server_on: ROUTE -> PATH, HANDLER -> DO
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_on["'][^>]*>[\s\S]*?)<field name=["']ROUTE["']>([\s\S]*?)<\/field>/g,
    '$1<field name="PATH">$2</field>'
  )
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_on["'][^>]*>[\s\S]*?)<statement name=["']HANDLER["']>/g,
    '$1<statement name="DO">'
  )

  // 2. wifi_server_send: CODE -> STATUS, BODY -> CONTENT
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_send["'][^>]*>[\s\S]*?)<field name=["']CODE["']>([\s\S]*?)<\/field>/g,
    '$1<field name="STATUS">$2</field>'
  )
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_send["'][^>]*>[\s\S]*?)<value name=["']BODY["']>/g,
    '$1<value name="CONTENT">'
  )

  // 3. Fallback generic tag normalization for safety
  normalized = normalized
    .replace(/<field name="ROUTE">/g, '<field name="PATH">')
    .replace(/<statement name="HANDLER">/g, '<statement name="DO">')
    .replace(/<field name="CODE">/g, '<field name="STATUS">')
    .replace(/<value name="BODY">/g, '<value name="CONTENT">')

  return normalized
}
