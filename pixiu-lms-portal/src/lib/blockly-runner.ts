import * as Blockly from "blockly"

export interface BlockStepInfo {
  id: string
  type: string
  label: string
}

export interface ExecutionEnvironment {
  setDigitalPin: (pin: string, state: "HIGH" | "LOW") => void
  setAnalogPin: (pin: string, value: number) => void
  setServoAngle: (pin: string, angle: number) => void
  setTone: (pin: string, freq: number | null) => void
  serialPrint?: (text: string) => void
  serialPrintln?: (text: string) => void
  setLcdText?: (col: number, row: number, text: string) => void
  clearLcd?: () => void
  setOledText?: (line: number, text: string) => void
  clearOled?: () => void
  getSensorValue?: (type: string, pin?: string) => number
  getSensorText?: (type: string, id?: string) => string
  isAiDetected?: (cls: string) => boolean
  isAiUnknown?: () => boolean
  getAiDetectedClass?: () => string
  getAiConfidence?: () => number
  getAiObjectCount?: () => number
  getDigitalPin?: (pin: string) => boolean
  getAiGesture?: () => string
  getAiFingerCount?: () => number
  isAiGesture?: (gesture: string) => boolean
  setAiCamera?: (enabled: boolean) => void
  setAiMicrophone?: (enabled: boolean) => void
  // Virtual Wi-Fi & Web Server hooks
  wifiConnect?: (ssid: string, pass: string) => void
  wifiIsConnected?: () => boolean
  wifiGetIp?: () => string | null
  wifiServerBegin?: (port: number) => void
  wifiServerOn?: (route: string, branch: Blockly.Block | null) => void
  wifiServerSend?: (code: number, contentType: string, body: string) => void
  // micro:bit 5x5 LED Matrix & buttons
  showMatrixIcon?: (icon: string) => void
  showMatrixNumber?: (num: number) => void
  showMatrixText?: (text: string) => void
  clearMatrix?: () => void
  isButtonPressed?: (btn: "A" | "B") => boolean
  // NeoPixel ring support
  setNeoPixelColor?: (sensorId: string, pixel: number, color: string) => void
  showNeoPixel?: (sensorId: string) => void
  // Keypad & 7-Segment hooks
  clearKeypadPin?: () => void
  setSevenSegmentDigit?: (digit: number) => void
  clearSevenSegment?: () => void
  sleep: (ms: number) => Promise<void>
  isRunning: () => boolean
  // Stepping & Debugging methods
  isPaused?: () => boolean
  getExecutionSpeed?: () => "normal" | "slow" | "step"
  waitStep?: (info: BlockStepInfo) => Promise<void>
  highlightBlock?: (blockId: string | null) => void
  onBlockEnter?: (info: BlockStepInfo) => void
}

interface LcdCursor {
  col: number
  row: number
}

const lcdCursors = new WeakMap<AbortSignal, LcdCursor>()
function getLcdCursor(signal: AbortSignal): LcdCursor {
  let cursor = lcdCursors.get(signal)
  if (!cursor) {
    cursor = { col: 0, row: 0 }
    lcdCursors.set(signal, cursor)
  }
  return cursor
}
const MAX_BLOCK_LOOP_ITERATIONS = 10_000

// AI blocks are data/control inputs only. They do not mutate virtual hardware;
// actuator effects remain in the simulator's Arduino execution cases below.

export function evaluateNumber(target: Blockly.Block | null, env?: ExecutionEnvironment, defaultValue: number = 0): number {
  if (!target) return defaultValue
  if (target.type === "math_number") {
    const val = Number(target.getFieldValue("NUM"))
    return isNaN(val) ? defaultValue : val
  }
  if (target.type === "ultrasonic_read") {
    return env?.getSensorValue ? env.getSensorValue("ultrasonic") : 100
  }
  if (target.type === "dht_temperature" || target.type === "dht_humidity") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorValue ? env.getSensorValue(target.type === "dht_temperature" ? "dht_temperature" : "dht_humidity", id) : 0
  }
  if (target.type === "joystick_x" || target.type === "joystick_y") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorValue ? env.getSensorValue(target.type === "joystick_x" ? "joystick_x" : "joystick_y", id) : 512
  }
  if (target.type === "soil_moisture_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorValue ? env.getSensorValue("soil", id) : 0
  }
  if (target.type === "encoder_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorValue ? env.getSensorValue("encoder", id) : 0
  }
  if (target.type === "mq2_gas_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorValue ? env.getSensorValue("mq2-gas", id) : 150
  }
  if (target.type === "io_analogread") {
    const pin = target.getFieldValue("PIN") ?? "A0"
    return env?.getSensorValue ? env.getSensorValue("analog", pin) : 512
  }
  if (target.type === "math_arithmetic") {
    const op = target.getFieldValue("OP") ?? "ADD"
    const a = evaluateNumber(target.getInputTargetBlock("A"), env, 0)
    const b = evaluateNumber(target.getInputTargetBlock("B"), env, 0)
    if (op === "ADD") return a + b
    if (op === "MINUS") return a - b
    if (op === "MULTIPLY") return a * b
    return b === 0 ? 0 : a / b
  }
  if (target.type === "math_modulo") {
    const a = evaluateNumber(target.getInputTargetBlock("DIVIDEND"), env, 0)
    const b = evaluateNumber(target.getInputTargetBlock("DIVISOR"), env, 1)
    return b === 0 ? 0 : a % b
  }
  if (target.type === "math_single") {
    const value = evaluateNumber(target.getInputTargetBlock("NUM"), env, 0)
    switch (target.getFieldValue("OP")) {
      case "ROOT": return Math.sqrt(Math.max(0, value))
      case "ABS": return Math.abs(value)
      case "NEG": return -value
      case "SIN": return Math.sin(value * Math.PI / 180)
      case "COS": return Math.cos(value * Math.PI / 180)
      case "TAN": return Math.tan(value * Math.PI / 180)
      default: return value
    }
  }
  if (target.type === "arduino_map") {
    const value = evaluateNumber(target.getInputTargetBlock("VALUE"), env, 0)
    const fromLow = evaluateNumber(target.getInputTargetBlock("FROM_LOW"), env, 0)
    const fromHigh = evaluateNumber(target.getInputTargetBlock("FROM_HIGH"), env, 1023)
    const toLow = evaluateNumber(target.getInputTargetBlock("TO_LOW"), env, 0)
    const toHigh = evaluateNumber(target.getInputTargetBlock("TO_HIGH"), env, 255)
    if (fromHigh === fromLow) return toLow
    return ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow
  }
  if (target.type === "ai_get_object_count") {
    return env?.getAiObjectCount ? env.getAiObjectCount() : 0
  }
  if (target.type === "ldr_read" || target.type === "tmp36_temperature" || target.type === "potentiometer_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    const type = target.type === "ldr_read" ? "ldr" : target.type === "tmp36_temperature" ? "tmp36" : "potentiometer"
    return env?.getSensorValue ? env.getSensorValue(type, id) : 0
  }
  if (target.type === "ai_confidence") {
    return env?.getAiConfidence ? env.getAiConfidence() : 0
  }
  if (target.type === "ai_get_finger_count") {
    return env?.getAiFingerCount ? env.getAiFingerCount() : 0
  }
  return defaultValue
}

export function evaluateBoolean(target: Blockly.Block | null, env?: ExecutionEnvironment): boolean {
  if (!target) return false
  if (target.type === "pushbutton_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("pushbutton", id) : 0) > 0
  }
  if (target.type === "ir_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("ir", id) : 0) > 0
  }
  if (target.type === "pir_motion") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("pir", id) : 0) > 0
  }
  if (target.type === "io_digitalread") {
    const pin = String(target.getFieldValue("PIN") ?? "13")
    return env?.getDigitalPin ? env.getDigitalPin(pin) : false
  }
  if (target.type === "joystick_button") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("joystick_button", id) : 0) > 0
  }
  if (target.type === "ai_is_detected") {
    const cls = target.getFieldValue("CLASS") ?? "car"
    return env?.isAiDetected ? env.isAiDetected(cls) : false
  }
  if (target.type === "ai_is_gesture") {
    const gesture = target.getFieldValue("GESTURE") ?? "fist"
    return env?.isAiGesture ? env.isAiGesture(gesture) : false
  }
  if (target.type === "ai_is_unknown") {
    return env?.isAiUnknown ? env.isAiUnknown() : false
  }
  if (target.type === "wifi_is_connected") {
    return env?.wifiIsConnected ? env.wifiIsConnected() : true
  }
  if (target.type === "microbit_button_pressed") {
    const btn = (target.getFieldValue("BTN") ?? "A") as "A" | "B"
    return env?.isButtonPressed ? env.isButtonPressed(btn) : false
  }
  if (target.type === "keypad_check_pin") {
    const targetPin = evaluateValueInput(target, "PIN", env, target.getFieldValue("PIN") || "1234").trim()
    const entered = String(env?.getSensorText ? env.getSensorText("keypad", "keypad") : "").trim()
    return entered !== "" && entered === targetPin
  }
  if (target.type === "logic_boolean") {
    return target.getFieldValue("BOOL") === "TRUE"
  }
  if (target.type === "logic_negate") {
    return !evaluateBoolean(target.getInputTargetBlock("BOOL"), env)
  }
  if (target.type === "logic_operation") {
    const op = target.getFieldValue("OP")
    const a = evaluateBoolean(target.getInputTargetBlock("A"), env)
    const b = evaluateBoolean(target.getInputTargetBlock("B"), env)
    return op === "AND" ? a && b : a || b
  }
  if (target.type === "logic_compare") {
    const op = target.getFieldValue("OP") ?? "EQ"
    const aTarget = target.getInputTargetBlock("A")
    const bTarget = target.getInputTargetBlock("B")

    const isTextLike = (blk: Blockly.Block | null) => {
      if (!blk) return false
      return ["text_string", "text", "keypad_read", "ai_get_detected_class", "ai_get_gesture"].includes(blk.type)
    }

    if (isTextLike(aTarget) || isTextLike(bTarget)) {
      const aStr = evaluateValueInput(target, "A", env, "")
      const bStr = evaluateValueInput(target, "B", env, "")
      switch (op) {
        case "EQ": return aStr === bStr
        case "NEQ": return aStr !== bStr
        case "LT": return aStr < bStr
        case "LTE": return aStr <= bStr
        case "GT": return aStr > bStr
        case "GTE": return aStr >= bStr
        default: return false
      }
    }

    const a = evaluateNumber(aTarget, env, 0)
    const b = evaluateNumber(bTarget, env, 0)

    switch (op) {
      case "EQ": return a === b
      case "NEQ": return a !== b
      case "LT": return a < b
      case "LTE": return a <= b
      case "GT": return a > b
      case "GTE": return a >= b
      default: return false
    }
  }
  return false
}

function evaluateNumberInput(block: Blockly.Block, inputName: string, env?: ExecutionEnvironment, defaultValue: number = 0): number {
  const target = block.getInputTargetBlock(inputName)
  return evaluateNumber(target, env, defaultValue)
}

function evaluateBooleanInput(block: Blockly.Block, inputName: string, env?: ExecutionEnvironment): boolean {
  const target = block.getInputTargetBlock(inputName)
  return evaluateBoolean(target, env)
}

function evaluateValueInput(block: Blockly.Block, inputName: string, env?: ExecutionEnvironment, defaultValue: string = ""): string {
  const target = block.getInputTargetBlock(inputName)
  if (!target) return defaultValue

  if (target.type === "text_string" || target.type === "text") {
    return target.getFieldValue("TEXT") ?? defaultValue
  }
  if (target.type === "math_number") {
    return String(target.getFieldValue("NUM") ?? defaultValue)
  }
  if ([
    "math_arithmetic","math_modulo","math_single","arduino_map","ai_confidence",
    "ai_get_finger_count","ai_get_object_count","ldr_read","tmp36_temperature","potentiometer_read"
  ].includes(target.type)) {
    return String(evaluateNumber(target, env, Number(defaultValue) || 0))
  }
  if (target.type === "ultrasonic_read") {
    const val = env?.getSensorValue ? env.getSensorValue("ultrasonic") : 100
    return String(val)
  }
  if (target.type === "keypad_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return env?.getSensorText ? env.getSensorText("keypad", id) : ""
  }
  if (target.type === "ai_get_detected_class") {
    return env?.getAiDetectedClass ? env.getAiDetectedClass() : "none"
  }
  if (target.type === "ai_get_gesture") {
    return env?.getAiGesture ? env.getAiGesture() : "none"
  }
  if (target.type === "wifi_local_ip") {
    return env?.wifiGetIp?.() ?? "0.0.0.0"
  }
  return defaultValue
}

function getBlockDescription(block: Blockly.Block, env: ExecutionEnvironment): string {
  switch (block.type) {
    case "io_digitalwrite": {
      const pin = block.getFieldValue("PIN") ?? "13"
      const state = block.getFieldValue("STATE") ?? "HIGH"
      return `digitalWrite(Pin ${pin}, ${state})`
    }
    case "time_delay": {
      const ms = evaluateNumberInput(block, "MS", env, 1000)
      return `delay(${ms} ms)`
    }
    case "io_analogwrite": {
      const pin = block.getFieldValue("PIN") ?? "13"
      const val = evaluateNumberInput(block, "VALUE", env, 255)
      return `analogWrite(Pin ${pin}, ${val})`
    }
    case "actuator_servo_write":
    case "servo_write": {
      const pin = block.getFieldValue("PIN") ?? "9"
      const angle = evaluateNumberInput(block, "ANGLE", env, 90)
      return `servo.write(Pin ${pin}, ${angle}°)`
    }
    case "io_tone":
    case "tone_play": {
      const pin = block.getFieldValue("PIN") ?? "8"
      const freq = evaluateNumberInput(block, "FREQ", env, 440)
      return `tone(Pin ${pin}, ${freq} Hz)`
    }
    case "io_notone":
    case "tone_stop": {
      const pin = block.getFieldValue("PIN") ?? "8"
      return `noTone(Pin ${pin})`
    }
    case "neopixel_set_color": {
      const sensor = block.getFieldValue("SENSOR") ?? "NeoPixel"
      return `neopixel.setPixel(${sensor})`
    }
    case "neopixel_show": {
      const sensor = block.getFieldValue("SENSOR") ?? "NeoPixel"
      return `neopixel.show(${sensor})`
    }
    case "ir_read":
    case "dht_temperature":
    case "dht_humidity":
    case "joystick_x":
    case "joystick_y":
    case "joystick_button":
    case "soil_moisture_read":
    case "encoder_read":
    case "keypad_read": {
      return `${block.type} (${block.getFieldValue("SENSOR") ?? "default"})`
    }
    case "oled_print": {
      const value = evaluateValueInput(block, "TEXT", env, "")
      return `OLED.print("${value}")`
    }
    case "oled_clear": {
      return "OLED.clear()"
    }
    case "motor_driver_write": {
      const speed = evaluateNumberInput(block, "SPEED", env, 180)
      return `Motor driver ${block.getFieldValue("CHANNEL") ?? "A"} speed ${speed}`
    }
    case "serial_begin": {
      const baud = block.getFieldValue("BAUD") ?? "9600"
      return `Serial.begin(${baud})`
    }
    case "serial_print": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      return `Serial.print("${text}")`
    }
    case "serial_println": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      return `Serial.println("${text}")`
    }
    case "lcd_print": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      return `lcd.print("${text}")`
    }
    case "lcd_set_cursor": {
      const col = block.getFieldValue("COL") ?? "0"
      const row = block.getFieldValue("ROW") ?? "0"
      return `lcd.setCursor(${col}, ${row})`
    }
    case "lcd_clear":
      return "lcd.clear()"
    case "lcd_print_line": {
      const line = block.getFieldValue("LINE") ?? "1"
      const text = evaluateValueInput(block, "TEXT", env, "")
      return `lcd.printLine(L${line}: "${text}")`
    }
    case "seven_segment_write": {
      const digit = evaluateNumberInput(block, "DIGIT", env, 0)
      return `7-segment.write(${digit})`
    }
    case "seven_segment_clear":
      return "7-segment.clear()"
    case "keypad_check_pin": {
      const pin = block.getFieldValue("PIN") ?? "1234"
      return `keypad PIN == "${pin}"`
    }
    case "keypad_clear_pin":
      return "keypad.clearPIN()"
    case "ai_is_unknown":
      return "AI unknown / low confidence"
    case "ai_camera_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      return `AI Camera ${state}`
    }
    case "ai_microphone_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      return `AI Microphone ${state}`
    }
    case "ai_get_gesture":
      return "AI gesture → current hand gesture"
    case "ai_get_finger_count":
      return "AI fingers → current count"
    case "ai_is_gesture":
      return "AI gesture predicate"
    case "controls_if":
      return "if (condition)"
    case "controls_repeat_ext": {
      const times = evaluateNumberInput(block, "TIMES", env, 1)
      return `repeat (${times}x)`
    }
    case "wifi_connect":
      return `WiFi.begin("${block.getFieldValue("SSID") ?? "Pixiu_IoT"}")`
    case "wifi_server_begin":
      return `server.begin(${block.getFieldValue("PORT") ?? 80})`
    case "wifi_server_on":
      return `server.on("${block.getFieldValue("PATH") ?? "/"}")`
    case "wifi_server_send":
      return `server.send(${block.getFieldValue("STATUS") ?? 200})`
    case "microbit_show_icon":
      return `display.show(${block.getFieldValue("ICON") ?? "heart"})`
    case "microbit_show_number":
      return "display.showNumber()"
    case "microbit_show_string":
      return "display.scroll()"
    case "microbit_clear":
      return "display.clear()"
    default:
      return block.type
  }
}

async function beforeExecuteBlock(block: Blockly.Block, env: ExecutionEnvironment, signal: AbortSignal) {
  if (signal.aborted || !env.isRunning()) return

  const label = getBlockDescription(block, env)
  const info: BlockStepInfo = { id: block.id, type: block.type, label }

  env.highlightBlock?.(block.id)
  env.onBlockEnter?.(info)

  const isPaused = env.isPaused ? env.isPaused() : false
  const speed = env.getExecutionSpeed ? env.getExecutionSpeed() : "normal"

  if (isPaused || speed === "step") {
    if (env.waitStep) {
      await env.waitStep(info)
    }
  } else if (speed === "slow") {
    await env.sleep(500)
  }
}

async function executeSingleBlock(block: Blockly.Block, env: ExecutionEnvironment, signal: AbortSignal) {
  if (signal.aborted || !env.isRunning()) return

  await beforeExecuteBlock(block, env, signal)
  if (signal.aborted || !env.isRunning()) return

  switch (block.type) {
    case "io_digitalwrite": {
      const pin = String(block.getFieldValue("PIN") ?? "13")
      const state = (block.getFieldValue("STATE") ?? "HIGH") as "HIGH" | "LOW"
      env.setDigitalPin(pin, state)
      break
    }

    case "time_delay": {
      const speed = env.getExecutionSpeed ? env.getExecutionSpeed() : "normal"
      const isPaused = env.isPaused ? env.isPaused() : false
      if (speed === "step" || isPaused) {
        await env.sleep(30)
      } else {
        const ms = Math.max(10, evaluateNumberInput(block, "MS", env, 1000))
        await env.sleep(ms)
      }
      break
    }

    case "io_analogwrite": {
      const pin = String(block.getFieldValue("PIN") ?? "13")
      const val = evaluateNumberInput(block, "VALUE", env, 255)
      env.setAnalogPin(pin, val)
      break
    }

    case "actuator_servo_write":
    case "servo_write": {
      const pin = String(block.getFieldValue("PIN") ?? "9")
      const angle = evaluateNumberInput(block, "ANGLE", env, 90)
      env.setServoAngle(pin, angle)
      break
    }

    case "io_tone":
    case "tone_play": {
      const pin = String(block.getFieldValue("PIN") ?? "8")
      const freq = evaluateNumberInput(block, "FREQ", env, 440)
      env.setTone(pin, freq)
      break
    }

    case "io_notone":
    case "tone_stop": {
      const pin = String(block.getFieldValue("PIN") ?? "8")
      env.setTone(pin, null)
      break
    }

    case "oled_print": {
      const textValue = evaluateValueInput(block, "TEXT", env, "")
      env.setOledText?.(1, textValue)
      break
    }

    case "oled_clear": {
      env.clearOled?.()
      break
    }

    case "motor_driver_write": {
      const channel = block.getFieldValue("CHANNEL") ?? "A"
      const speed = Math.max(0, Math.min(255, evaluateNumberInput(block, "SPEED", env, 180)))
      const enableField = channel === "A" ? "ENA" : "ENB"
      const in1Field = channel === "A" ? "IN1" : "IN3"
      const in2Field = channel === "A" ? "IN2" : "IN4"
      const enable = String(block.getFieldValue(enableField) ?? (channel === "A" ? "5" : "6"))
      const in1 = String(block.getFieldValue(in1Field) ?? (channel === "A" ? "7" : "9"))
      const in2 = String(block.getFieldValue(in2Field) ?? (channel === "A" ? "8" : "10"))
      const direction = block.getFieldValue("DIRECTION") ?? "CW"
      if (direction === "STOP") {
        env.setAnalogPin(enable, 0)
        env.setDigitalPin(in1, "LOW")
        env.setDigitalPin(in2, "LOW")
      } else {
        env.setAnalogPin(enable, speed)
        env.setDigitalPin(in1, direction === "CW" ? "HIGH" : "LOW")
        env.setDigitalPin(in2, direction === "CW" ? "LOW" : "HIGH")
      }
      break
    }

    case "serial_begin": {
      const baud = block.getFieldValue("BAUD") ?? "9600"
      env.serialPrintln?.(`[System] Serial initialized at ${baud} baud.`)
      break
    }

    case "serial_print": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      env.serialPrint?.(text)
      break
    }

    case "serial_println": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      env.serialPrintln?.(text)
      break
    }

    case "lcd_print": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      const cursor = getLcdCursor(signal)
      env.setLcdText?.(cursor.col, cursor.row, text)
      cursor.col += text.length
      break
    }

    case "lcd_set_cursor": {
      const cursor = getLcdCursor(signal)
      cursor.col = Number(block.getFieldValue("COL") ?? 0)
      cursor.row = Number(block.getFieldValue("ROW") ?? 0)
      break
    }

    case "lcd_clear": {
      const cursor = getLcdCursor(signal)
      cursor.col = 0
      cursor.row = 0
      env.clearLcd?.()
      break
    }

    case "lcd_print_line": {
      const line = Math.max(0, Math.min(1, Number(block.getFieldValue("LINE") ?? 1) - 1))
      const text = evaluateValueInput(block, "TEXT", env, "")
      env.setLcdText?.(0, line, text)
      break
    }

    case "seven_segment_write": {
      const digit = evaluateNumberInput(block, "DIGIT", env, 0)
      env.setSevenSegmentDigit?.(Math.floor(digit))
      break
    }

    case "seven_segment_clear": {
      env.clearSevenSegment?.()
      break
    }

    case "keypad_clear_pin": {
      env.clearKeypadPin?.()
      break
    }

    case "ai_camera_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      env.setAiCamera?.(state === "ON")
      break
    }

    case "ai_microphone_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      env.setAiMicrophone?.(state === "ON")
      break
    }

    case "wifi_connect": {
      const ssid = block.getFieldValue("SSID") ?? "Pixiu_IoT"
      const pass = block.getFieldValue("PASS") ?? ""
      env.wifiConnect?.(ssid, pass)
      break
    }

    case "wifi_server_begin": {
      const port = Number(block.getFieldValue("PORT") ?? 80)
      env.wifiServerBegin?.(port)
      break
    }

    case "wifi_server_on": {
      const route = block.getFieldValue("PATH") || block.getFieldValue("ROUTE") || "/"
      const branch = block.getInputTargetBlock("DO") || block.getInputTargetBlock("HANDLER")
      env.wifiServerOn?.(route, branch)
      break
    }

    case "wifi_server_send": {
      const status = Number(block.getFieldValue("STATUS") || block.getFieldValue("CODE") || 200)
      const content = evaluateValueInput(block, "CONTENT", env, "") || evaluateValueInput(block, "BODY", env, "OK")
      env.wifiServerSend?.(status, "text/html", String(content))
      break
    }

    case "microbit_show_icon": {
      const icon = block.getFieldValue("ICON") ?? "heart"
      env.showMatrixIcon?.(icon)
      break
    }

    case "microbit_show_number": {
      const num = evaluateNumberInput(block, "NUM", env, 0)
      env.showMatrixNumber?.(num)
      break
    }

    case "microbit_show_string": {
      const text = evaluateValueInput(block, "TEXT", env, "")
      env.showMatrixText?.(String(text))
      break
    }

    case "microbit_clear": {
      env.clearMatrix?.()
      break
    }

    case "neopixel_set_color": {
      const sensor = block.getFieldValue("SENSOR") ?? ""
      const pixel = evaluateNumberInput(block, "PIXEL", env, 0)
      const color = String(evaluateValueInput(block, "COLOR", env, "#ef4444") ?? "#ef4444")
      env.setNeoPixelColor?.(sensor, pixel, color)
      break
    }

    case "neopixel_show": {
      const sensor = block.getFieldValue("SENSOR") ?? ""
      env.showNeoPixel?.(sensor)
      break
    }

    case "mq2_gas_read":
    case "ai_get_gesture":
    case "ai_get_finger_count":
      // Value blocks are evaluated by evaluateValueInput/evaluateNumber.
      break

    case "controls_if": {
      let branchExecuted = false
      let i = 0
      while (block.getInput(`IF${i}`)) {
        const cond = evaluateBooleanInput(block, `IF${i}`, env)
        if (cond) {
          const doBranch = block.getInputTargetBlock(`DO${i}`)
          await executeStatement(doBranch, env, signal)
          branchExecuted = true
          break
        }
        i++
      }
      if (!branchExecuted) {
        const elseBranch = block.getInputTargetBlock("ELSE")
        if (elseBranch) {
          await executeStatement(elseBranch, env, signal)
        }
      }
      break
    }

    case "controls_repeat_ext": {
      const requestedTimes = evaluateNumberInput(block, "TIMES", env, 1)
      const times = Number.isFinite(requestedTimes)
        ? Math.max(0, Math.min(MAX_BLOCK_LOOP_ITERATIONS, Math.floor(requestedTimes)))
        : 0
      const branch = block.getInputTargetBlock("DO")
      for (let i = 0; i < times && !signal.aborted && env.isRunning(); i++) {
        await executeStatement(branch, env, signal)
      }
      break
    }
    case "controls_whileUntil": {
      const until = block.getFieldValue("MODE") === "UNTIL"
      const condition = block.getInputTargetBlock("BOOL")
      const branch = block.getInputTargetBlock("DO")
      let guard = 0

      while (!signal.aborted && env.isRunning() && guard++ < MAX_BLOCK_LOOP_ITERATIONS) {
        const value = evaluateBoolean(condition, env)
        const shouldContinue = until ? !value : value
        if (!shouldContinue) break
        await executeStatement(branch, env, signal)
        if (guard % 50 === 0) await env.sleep(0)
      }
      break
    }


    default:
      break
  }
}

export async function executeStatement(startBlock: Blockly.Block | null, env: ExecutionEnvironment, signal: AbortSignal) {
  let cur = startBlock
  while (cur && !signal.aborted && env.isRunning()) {
    await executeSingleBlock(cur, env, signal)
    cur = cur.getNextBlock()
  }
}

export async function runBlocklyProgram(workspace: Blockly.Workspace, env: ExecutionEnvironment, signal: AbortSignal) {
  const root = workspace.getTopBlocks(true).find((b) => b.type === "arduino_program")
  if (!root) return

  lcdCursors.set(signal, { col: 0, row: 0 })

  try {
    // 1. Execute SETUP statement
    const setupBlock = root.getInputTargetBlock("SETUP")
    if (setupBlock) {
      await executeStatement(setupBlock, env, signal)
    }

    // 2. Execute LOOP statement continuously
    const loopBlock = root.getInputTargetBlock("LOOP")
    while (!signal.aborted && env.isRunning()) {
      if (loopBlock) {
        await executeStatement(loopBlock, env, signal)
      }
      // Small safety delay to yield control and avoid freezing if loop has no wait block
      await env.sleep(20)
    }
  } finally {
    env.highlightBlock?.(null)
    lcdCursors.delete(signal)
  }
}
