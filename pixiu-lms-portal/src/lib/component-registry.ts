import type { PartType, PartEducationalMeta } from "./circuit-types"
import { CATALOG, PALETTE_ORDER } from "./components-catalog"

export type ComponentCategory = "controller" | "basic" | "sensor" | "display" | "output" | "motor" | "driver" | "input"

export interface ComponentRegistryEntry {
  type: PartType
  name: string
  category: ComponentCategory
  visualModel: string
  electricalModel: string
  runtimeModel: string
  blockIds: string[]
  educational: PartEducationalMeta
}

const CATEGORY_MAP: Record<PartType, ComponentCategory> = {
  "arduino-uno": "controller",
  breadboard: "basic",
  resistor: "basic",
  pushbutton: "input",
  battery: "basic",
  potentiometer: "input",
  led: "output",
  "rgb-led": "output",
  "seven-segment": "display",
  "lcd-i2c": "display",
  buzzer: "output",
  servo: "motor",
  "dc-motor": "motor",
  "npn-transistor": "driver",
  relay: "driver",
  ultrasonic: "sensor",
  "pir-sensor": "sensor",
  ldr: "sensor",
  tmp36: "sensor",
  "ir-sensor": "sensor",
  dht11: "sensor",
  "oled-i2c": "display",
  joystick: "input",
  l298n: "driver",
  "rotary-encoder": "input",
  "soil-moisture": "sensor",
  "keypad-4x4": "input",
}

const DEFAULT_EDUCATION = (type: PartType): PartEducationalMeta => ({
  gradeBand: "6-8",
  concept: CATALOG[type]?.name ?? "Electronic component",
  realWorld: "Hands-on electronics, robotics and embedded systems",
  experiment: "Connect the component safely, run the simulation and observe its response.",
  hint: "Start with the power and ground pins, then connect the signal pins.",
})

const OVERRIDES: Partial<Record<PartType, Partial<ComponentRegistryEntry>>> = {
  "arduino-uno": {
    category: "controller",
    electricalModel: "microcontroller-5v",
    runtimeModel: "arduino-pin-state",
    blockIds: ["io_pinmode", "io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread"],
    educational: {
      gradeBand: "6-8",
      concept: "Microcontroller + digital/analog I/O",
      realWorld: "Robots, sensors, automation and embedded controllers",
      experiment: "Blink an LED, read a button, and drive an actuator.",
      hint: "Every sensor needs power, ground and a signal path.",
    },
  },
  "ir-sensor": {
    electricalModel: "powered-digital-output",
    runtimeModel: "binary-obstacle-input",
    blockIds: ["ir_read"],
    educational: {
      gradeBand: "6-8",
      concept: "Infrared reflection and digital sensing",
      realWorld: "Line followers, obstacle avoiders and counting systems",
      experiment: "Move the virtual obstacle switch and watch OUT change.",
      hint: "Most modules use VCC, GND and OUT; OUT is the signal you read.",
    },
  },
  dht11: {
    electricalModel: "powered-digital-sensor",
    runtimeModel: "temperature-humidity",
    blockIds: ["dht_temperature", "dht_humidity"],
    educational: {
      gradeBand: "6-8",
      concept: "Environmental sensing",
      realWorld: "Weather stations, greenhouses and indoor monitoring",
      experiment: "Change temperature and humidity and display them on a screen.",
      hint: "DHT11 data is digital; you do not use analogRead for it.",
    },
  },
  "oled-i2c": {
    electricalModel: "i2c-display",
    runtimeModel: "oled-text-buffer",
    blockIds: ["oled_print", "oled_clear"],
    educational: {
      gradeBand: "8-10",
      concept: "I2C communication and digital display",
      realWorld: "Wearables, instruments and compact dashboards",
      experiment: "Print live sensor values to a 128×64 OLED.",
      hint: "SDA and SCL are communication lines; VCC/GND power the module.",
    },
  },
  joystick: {
    electricalModel: "dual-analog-plus-digital",
    runtimeModel: "joystick-xy-button",
    blockIds: ["joystick_x", "joystick_y", "joystick_button"],
    educational: {
      gradeBand: "6-8",
      concept: "Analog control + digital switch",
      realWorld: "Game controllers, robot arms and remote vehicles",
      experiment: "Move X/Y sliders and press the stick button to control outputs.",
      hint: "The center position is near 512 on a 10-bit analog scale.",
    },
  },
  l298n: {
    electricalModel: "dual-h-bridge",
    runtimeModel: "dual-motor-driver",
    blockIds: ["motor_driver_write"],
    educational: {
      gradeBand: "8-10",
      concept: "H-bridge motor direction and speed control",
      realWorld: "Mobile robots, conveyor systems and two-wheel rovers",
      experiment: "Change enable speed and IN1/IN2 direction inputs to drive Motor A.",
      hint: "ENA/ENB control speed; IN1/IN2 and IN3/IN4 control direction.",
    },
  },
  "rotary-encoder": {
    electricalModel: "incremental-digital-input",
    runtimeModel: "encoder-position",
    blockIds: ["encoder_read"],
    educational: {
      gradeBand: "8-10",
      concept: "Rotational position sensing",
      realWorld: "Volume knobs, CNC controls and user interfaces",
      experiment: "Turn the virtual encoder and read its changing count.",
      hint: "CLK and DT together reveal direction; SW is the push switch.",
    },
  },
  "soil-moisture": {
    electricalModel: "powered-analog-sensor",
    runtimeModel: "soil-moisture",
    blockIds: ["soil_moisture_read"],
    educational: {
      gradeBand: "6-8",
      concept: "Analog moisture sensing",
      realWorld: "Smart irrigation and precision farming",
      experiment: "Move soil moisture from dry to wet and automate a pump/LED.",
      hint: "Higher readings here represent a wetter virtual probe.",
    },
  },
  "keypad-4x4": {
    electricalModel: "matrix-input",
    runtimeModel: "matrix-keypress",
    blockIds: ["keypad_read"],
    educational: {
      gradeBand: "8-10",
      concept: "Row/column matrix scanning",
      realWorld: "Door locks, calculators and control panels",
      experiment: "Press a virtual key and route the key value to a display.",
      hint: "A 4×4 keypad uses eight signal lines instead of sixteen.",
    },
  },
}

function createEntry(type: PartType): ComponentRegistryEntry {
  const def = CATALOG[type]
  const override = OVERRIDES[type] ?? {}
  const category = override.category ?? CATEGORY_MAP[type]
  return {
    type,
    name: def.name,
    category,
    visualModel: "PartArt:" + type,
    electricalModel: override.electricalModel ?? "passive-or-module-default",
    runtimeModel: override.runtimeModel ?? "catalog-runtime:" + type,
    blockIds: override.blockIds ?? [],
    educational: override.educational ?? DEFAULT_EDUCATION(type),
  }
}

export const COMPONENT_REGISTRY: Record<PartType, ComponentRegistryEntry> = Object.fromEntries(
  PALETTE_ORDER.map((type) => [type, createEntry(type)]),
) as Record<PartType, ComponentRegistryEntry>

export const COMPONENT_GROUPS: Array<{ id: ComponentCategory; label: string; icon: string }> = [
  { id: "controller", label: "Controllers", icon: "◉" },
  { id: "basic", label: "Build & Power", icon: "▦" },
  { id: "input", label: "Controls & Inputs", icon: "⌁" },
  { id: "sensor", label: "Sensors", icon: "◌" },
  { id: "output", label: "Lights & Sound", icon: "✦" },
  { id: "display", label: "Displays", icon: "▣" },
  { id: "motor", label: "Motion", icon: "↻" },
  { id: "driver", label: "Drivers & Switching", icon: "⇄" },
]

export function getComponentMeta(type: PartType): ComponentRegistryEntry {
  return COMPONENT_REGISTRY[type]
}
