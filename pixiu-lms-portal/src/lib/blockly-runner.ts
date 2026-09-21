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
  getAiDetectedClass?: () => string
  getAiConfidence?: () => number
  setAiCamera?: (enabled: boolean) => void
  sleep: (ms: number) => Promise<void>
  isRunning: () => boolean
  // Stepping & Debugging methods
  isPaused?: () => boolean
  getExecutionSpeed?: () => "normal" | "slow" | "step"
  waitStep?: (info: BlockStepInfo) => Promise<void>
  highlightBlock?: (blockId: string | null) => void
  onBlockEnter?: (info: BlockStepInfo) => void
}

let lcdCursorCol = 0
let lcdCursorRow = 0

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
  if (target.type === "io_analogread") {
    const pin = target.getFieldValue("PIN") ?? "A0"
    return env?.getSensorValue ? env.getSensorValue("analog", pin) : 512
  }
  if (target.type === "ai_confidence") {
    return env?.getAiConfidence ? env.getAiConfidence() : 0
  }
  return defaultValue
}

export function evaluateBoolean(target: Blockly.Block | null, env?: ExecutionEnvironment): boolean {
  if (!target) return false
  if (target.type === "ir_read") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("ir", id) : 0) > 0
  }
  if (target.type === "joystick_button") {
    const id = target.getFieldValue("SENSOR") ?? ""
    return (env?.getSensorValue ? env.getSensorValue("joystick_button", id) : 0) > 0
  }
  if (target.type === "ai_is_detected") {
    const cls = target.getFieldValue("CLASS") ?? "car"
    return env?.isAiDetected ? env.isAiDetected(cls) : false
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
    case "servo_write": {
      const pin = block.getFieldValue("PIN") ?? "9"
      const angle = evaluateNumberInput(block, "ANGLE", env, 90)
      return `servo.write(Pin ${pin}, ${angle}°)`
    }
    case "tone_play": {
      const pin = block.getFieldValue("PIN") ?? "8"
      const freq = evaluateNumberInput(block, "FREQ", env, 440)
      return `tone(Pin ${pin}, ${freq} Hz)`
    }
    case "tone_stop": {
      const pin = block.getFieldValue("PIN") ?? "8"
      return `noTone(Pin ${pin})`
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
    case "ai_camera_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      return `AI Camera ${state}`
    }
    case "controls_if":
      return "if (condition)"
    case "controls_repeat_ext": {
      const times = evaluateNumberInput(block, "TIMES", env, 1)
      return `repeat (${times}x)`
    }
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

    case "servo_write": {
      const pin = String(block.getFieldValue("PIN") ?? "9")
      const angle = evaluateNumberInput(block, "ANGLE", env, 90)
      env.setServoAngle(pin, angle)
      break
    }

    case "tone_play": {
      const pin = String(block.getFieldValue("PIN") ?? "8")
      const freq = evaluateNumberInput(block, "FREQ", env, 440)
      env.setTone(pin, freq)
      break
    }

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
      env.setLcdText?.(lcdCursorCol, lcdCursorRow, text)
      lcdCursorCol += text.length
      break
    }

    case "lcd_set_cursor": {
      lcdCursorCol = Number(block.getFieldValue("COL") ?? 0)
      lcdCursorRow = Number(block.getFieldValue("ROW") ?? 0)
      break
    }

    case "lcd_clear": {
      lcdCursorCol = 0
      lcdCursorRow = 0
      env.clearLcd?.()
      break
    }

    case "ai_camera_enable": {
      const state = block.getFieldValue("STATE") ?? "ON"
      env.setAiCamera?.(state === "ON")
      break
    }

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
      const times = evaluateNumberInput(block, "TIMES", env, 1)
      const branch = block.getInputTargetBlock("DO")
      for (let i = 0; i < times && !signal.aborted && env.isRunning(); i++) {
        await executeStatement(branch, env, signal)
      }
      break
    }

    default:
      break
  }
}

async function executeStatement(startBlock: Blockly.Block | null, env: ExecutionEnvironment, signal: AbortSignal) {
  let cur = startBlock
  while (cur && !signal.aborted && env.isRunning()) {
    await executeSingleBlock(cur, env, signal)
    cur = cur.getNextBlock()
  }
}

export async function runBlocklyProgram(workspace: Blockly.Workspace, env: ExecutionEnvironment, signal: AbortSignal) {
  const root = workspace.getTopBlocks(true).find((b) => b.type === "arduino_program")
  if (!root) return

  lcdCursorCol = 0
  lcdCursorRow = 0

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
  }
}
