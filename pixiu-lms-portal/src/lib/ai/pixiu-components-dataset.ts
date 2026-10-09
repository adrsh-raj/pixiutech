/**
 * PIXIU TECH CYBERLAB - COMPREHENSIVE COMPONENT TRAINING DATASET & GROUND TRUTH
 * 
 * Machine-readable specification for all 32 hardware components, sensors,
 * actuators, microcontrollers, and passive parts available in Pixiu CyberLab.
 * 
 * This dataset serves as:
 * 1. The ground-truth catalog for the AI Circuit Copilot dataset generator & training pipeline.
 * 2. The deterministic schema validator to verify AI-proposed circuits before canvas rendering.
 * 3. The physics and rule-checking matrix for automated circuit verification.
 * 
 * Copyright (c) 2026 Pixiu Tech. Proprietary and Confidential.
 */

export type ComponentCategory =
  | "microcontroller"
  | "sensor"
  | "actuator"
  | "display"
  | "passive"
  | "power"
  | "prototyping"
  | "driver"

export interface ComponentPinSpec {
  id: string
  label: string
  kind: "power" | "ground" | "digital" | "analog" | "passive"
  aliases: string[]
  role: string
  pwmSupported?: boolean
  adcSupported?: boolean
}

export interface ComponentPropertySpec {
  key: string
  type: "string" | "number" | "boolean"
  defaultValue: string | number | boolean
  allowedValues?: (string | number)[]
  description: string
}

export interface ComponentWiringRule {
  ruleId: string
  type: "mandatory" | "forbidden" | "recommended"
  description: string
  circuitDoctorCheckId?: string
}

export interface ComponentSpec {
  type: string
  name: string
  category: ComponentCategory
  blurb: string
  dimensions: { width: number; height: number }
  electrical: {
    operatingVoltage: string
    logicLevel: "5V" | "3.3V" | "universal" | "passive"
    maxCurrentMa?: number
    polaritySensitive: boolean
  }
  pins: ComponentPinSpec[]
  properties: ComponentPropertySpec[]
  codeInterface: {
    cppLibraries: string[]
    blocklyBlockTypes: string[]
    standardPinModes?: Record<string, "INPUT" | "OUTPUT" | "INPUT_PULLUP">
  }
  wiringRules: ComponentWiringRule[]
  trainingKeywords: string[]
  standardTopologies: string[]
}

export const PIXIU_COMPONENTS_DATASET: Record<string, ComponentSpec> = {
  // ==========================================
  // 1. MICROCONTROLLERS (4 BOARDS)
  // ==========================================
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno R3",
    category: "microcontroller",
    blurb: "ATmega328P 8-bit AVR microcontroller development board with 14 digital I/O pins, 6 analog inputs, and 16 MHz crystal oscillator.",
    dimensions: { width: 320, height: 200 },
    electrical: {
      operatingVoltage: "5V (USB) or 7-12V (VIN)",
      logicLevel: "5V",
      maxCurrentMa: 200,
      polaritySensitive: true,
    },
    pins: [
      { id: "5v", label: "5V", kind: "power", aliases: ["5v_pwr", "vcc", "+5v"], role: "Regulated 5V power supply output" },
      { id: "3v3", label: "3.3V", kind: "power", aliases: ["3v3_pwr", "3.3v", "+3v3"], role: "Regulated 3.3V power supply output (max 50mA)" },
      { id: "vin", label: "VIN", kind: "power", aliases: ["vin_pwr", "raw"], role: "External unregulated DC input voltage (7-12V)" },
      { id: "gnd", label: "GND (Top)", kind: "ground", aliases: ["ground", "gnd_top"], role: "System ground reference (0V)" },
      { id: "gnd_pwr", label: "GND (Bottom)", kind: "ground", aliases: ["ground_pwr", "gnd2", "gnd3"], role: "System ground reference (0V)" },
      { id: "aref", label: "AREF", kind: "digital", aliases: ["ref"], role: "Analog reference voltage input" },
      { id: "rst", label: "RESET", kind: "digital", aliases: ["reset"], role: "Active-low microcontroller reset line" },
      { id: "d0", label: "D0 (RX)", kind: "digital", aliases: ["rx", "0"], role: "Digital I/O and Serial Receive" },
      { id: "d1", label: "D1 (TX)", kind: "digital", aliases: ["tx", "1"], role: "Digital I/O and Serial Transmit" },
      { id: "d2", label: "D2", kind: "digital", aliases: ["2"], role: "Digital I/O and External Interrupt 0" },
      { id: "d3", label: "D3 (~)", kind: "digital", aliases: ["3"], role: "Digital I/O, PWM output, and External Interrupt 1", pwmSupported: true },
      { id: "d4", label: "D4", kind: "digital", aliases: ["4"], role: "Digital I/O" },
      { id: "d5", label: "D5 (~)", kind: "digital", aliases: ["5"], role: "Digital I/O and PWM output", pwmSupported: true },
      { id: "d6", label: "D6 (~)", kind: "digital", aliases: ["6"], role: "Digital I/O and PWM output", pwmSupported: true },
      { id: "d7", label: "D7", kind: "digital", aliases: ["7"], role: "Digital I/O" },
      { id: "d8", label: "D8", kind: "digital", aliases: ["8"], role: "Digital I/O" },
      { id: "d9", label: "D9 (~)", kind: "digital", aliases: ["9"], role: "Digital I/O and PWM output (Servo recommended)", pwmSupported: true },
      { id: "d10", label: "D10 (~)", kind: "digital", aliases: ["10"], role: "Digital I/O, PWM output, and SPI SS", pwmSupported: true },
      { id: "d11", label: "D11 (~)", kind: "digital", aliases: ["11"], role: "Digital I/O, PWM output, and SPI MOSI", pwmSupported: true },
      { id: "d12", label: "D12", kind: "digital", aliases: ["12"], role: "Digital I/O and SPI MISO" },
      { id: "d13", label: "D13", kind: "digital", aliases: ["13", "led_builtin"], role: "Digital I/O, SPI SCK, and Built-in LED" },
      { id: "a0", label: "A0", kind: "analog", aliases: ["0"], role: "10-bit Analog Input (0-1023) or Digital I/O (D14)", adcSupported: true },
      { id: "a1", label: "A1", kind: "analog", aliases: ["1"], role: "10-bit Analog Input (0-1023) or Digital I/O (D15)", adcSupported: true },
      { id: "a2", label: "A2", kind: "analog", aliases: ["2"], role: "10-bit Analog Input (0-1023) or Digital I/O (D16)", adcSupported: true },
      { id: "a3", label: "A3", kind: "analog", aliases: ["3"], role: "10-bit Analog Input (0-1023) or Digital I/O (D17)", adcSupported: true },
      { id: "a4", label: "A4 (SDA)", kind: "analog", aliases: ["sda", "4"], role: "10-bit Analog Input or I2C Data (SDA)", adcSupported: true },
      { id: "a5", label: "A5 (SCL)", kind: "analog", aliases: ["scl", "5"], role: "10-bit Analog Input or I2C Clock (SCL)", adcSupported: true },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Arduino.h>"],
      blocklyBlockTypes: ["arduino_program", "io_pinmode", "io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread", "time_delay", "serial_begin", "serial_println"],
    },
    wiringRules: [
      { ruleId: "uno-gnd-required", type: "mandatory", description: "All active peripheral circuits must share a common GND connection with the Arduino board." },
      { ruleId: "uno-pwm-pins", type: "recommended", description: "Servos, motor drivers, and analogWrite require PWM-capable pins (D3, D5, D6, D9, D10, D11)." },
      { ruleId: "uno-i2c-pins", type: "mandatory", description: "I2C displays (LCD 1602, OLED) must connect to A4 (SDA) and A5 (SCL)." },
    ],
    trainingKeywords: ["uno", "arduino", "atmega328p", "microcontroller", "main board", "controller"],
    standardTopologies: ["single-board microcontroller hub", "i2c bus master", "adc voltage sensing hub", "pwm actuator driver"],
  },

  "esp32-devkit": {
    type: "esp32-devkit",
    name: "ESP32 DevKit V1",
    category: "microcontroller",
    blurb: "Dual-core Xtensa 32-bit LX6 microcontroller with integrated 2.4 GHz Wi-Fi, Bluetooth 4.2 BLE, 12-bit ADC, and 3.3V logic.",
    dimensions: { width: 180, height: 280 },
    electrical: {
      operatingVoltage: "5V (VIN) or 3.3V",
      logicLevel: "3.3V",
      maxCurrentMa: 500,
      polaritySensitive: true,
    },
    pins: [
      { id: "3v3", label: "3V3", kind: "power", aliases: ["3.3v", "vcc"], role: "3.3V Regulated Output" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground (0V)" },
      { id: "vin", label: "VIN", kind: "power", aliases: ["5v"], role: "5V DC External Input" },
      { id: "d2", label: "GPIO2", kind: "digital", aliases: ["2", "gpio2"], role: "Built-in Blue LED, PWM", pwmSupported: true },
      { id: "d4", label: "GPIO4", kind: "digital", aliases: ["4", "gpio4"], role: "General I/O, ADC2, Touch0", pwmSupported: true, adcSupported: true },
      { id: "d15", label: "GPIO15", kind: "digital", aliases: ["15", "gpio15"], role: "General I/O, PWM", pwmSupported: true },
      { id: "d21", label: "GPIO21 (SDA)", kind: "digital", aliases: ["21", "sda"], role: "I2C Data line (SDA)" },
      { id: "d22", label: "GPIO22 (SCL)", kind: "digital", aliases: ["22", "scl"], role: "I2C Clock line (SCL)" },
      { id: "d34", label: "GPIO34", kind: "analog", aliases: ["34", "gpio34"], role: "Input-only, 12-bit ADC1", adcSupported: true },
      { id: "d35", label: "GPIO35", kind: "analog", aliases: ["35", "gpio35"], role: "Input-only, 12-bit ADC1", adcSupported: true },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<WiFi.h>", "<WebServer.h>"],
      blocklyBlockTypes: ["wifi_connect", "wifi_server_begin", "wifi_server_on", "wifi_server_send", "wifi_local_ip"],
    },
    wiringRules: [
      { ruleId: "esp32-voltage-tolerance", type: "mandatory", description: "ESP32 GPIO pins tolerate max 3.3V. 5V sensors require voltage dividers." },
      { ruleId: "esp32-i2c-pins", type: "mandatory", description: "Default I2C bus pins are GPIO21 (SDA) and GPIO22 (SCL)." },
    ],
    trainingKeywords: ["esp32", "wifi", "iot", "web server", "smart home", "internet of things"],
    standardTopologies: ["iot web server controller", "wifi telemetry client", "smart home hub"],
  },

  "rpi-pico": {
    type: "rpi-pico",
    name: "Raspberry Pi Pico",
    category: "microcontroller",
    blurb: "RP2040 dual-core ARM Cortex-M0+ microcontroller with 3.3V logic, programmable I/O (PIO), and 12-bit ADC.",
    dimensions: { width: 140, height: 320 },
    electrical: {
      operatingVoltage: "5V (VBUS) or 3.3V",
      logicLevel: "3.3V",
      maxCurrentMa: 300,
      polaritySensitive: true,
    },
    pins: [
      { id: "vbus", label: "VBUS (5V)", kind: "power", aliases: ["5v"], role: "USB 5V input power" },
      { id: "3v3", label: "3V3 (OUT)", kind: "power", aliases: ["3.3v"], role: "Regulated 3.3V power output" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "gp0", label: "GP0", kind: "digital", aliases: ["0"], role: "GPIO, UART0 TX, I2C0 SDA", pwmSupported: true },
      { id: "gp1", label: "GP1", kind: "digital", aliases: ["1"], role: "GPIO, UART0 RX, I2C0 SCL", pwmSupported: true },
      { id: "gp25", label: "GP25", kind: "digital", aliases: ["25", "led_builtin"], role: "Built-in Green LED" },
      { id: "gp26", label: "GP26 (ADC0)", kind: "analog", aliases: ["26", "a0"], role: "12-bit ADC0 channel", adcSupported: true },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<pico/stdlib.h>"],
      blocklyBlockTypes: ["io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread"],
    },
    wiringRules: [
      { ruleId: "pico-3v3-logic", type: "mandatory", description: "Raspberry Pi Pico uses 3.3V logic level." },
    ],
    trainingKeywords: ["pico", "rp2040", "raspberry pi pico", "arm cortex"],
    standardTopologies: ["embedded edge controller", "pwm audio/motor station"],
  },

  "microbit-v2": {
    type: "microbit-v2",
    name: "BBC micro:bit v2",
    category: "microcontroller",
    blurb: "Educational nRF52833 board featuring 5x5 LED display matrix, A/B tactile buttons, MEMS microphone, and edge connector.",
    dimensions: { width: 260, height: 210 },
    electrical: {
      operatingVoltage: "3V (Battery) or 5V (USB)",
      logicLevel: "3.3V",
      maxCurrentMa: 150,
      polaritySensitive: true,
    },
    pins: [
      { id: "3v", label: "3V", kind: "power", aliases: ["3v3", "vcc"], role: "3V Power Rail" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "p0", label: "P0", kind: "analog", aliases: ["0"], role: "Touch pin, ADC, buzzer audio output", adcSupported: true },
      { id: "p1", label: "P1", kind: "analog", aliases: ["1"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "p2", label: "P2", kind: "analog", aliases: ["2"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "btn_a", label: "Button A", kind: "digital", aliases: ["a"], role: "Integrated left tactile button" },
      { id: "btn_b", label: "Button B", kind: "digital", aliases: ["b"], role: "Integrated right tactile button" },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Adafruit_Microbit.h>"],
      blocklyBlockTypes: ["microbit_show_icon", "microbit_show_number", "microbit_show_string", "microbit_clear", "microbit_button_pressed"],
    },
    wiringRules: [
      { ruleId: "microbit-edge-alligator", type: "recommended", description: "P0, P1, P2 and 3V/GND large rings are designed for alligator clips." },
    ],
    trainingKeywords: ["microbit", "bbc micro:bit", "5x5 led matrix", "stem edtech"],
    standardTopologies: ["wearable interactive badge", "gesture badge", "educational sensory game"],
  },

  // ==========================================
  // 2. DISCRETE & PASSIVE ELECTRONICS
  // ==========================================
  led: {
    type: "led",
    name: "Standard 5mm LED",
    category: "actuator",
    blurb: "Polarized semiconductor light-emitting diode. Requires current limiting resistor.",
    dimensions: { width: 44, height: 66 },
    electrical: {
      operatingVoltage: "1.8V - 2.2V forward drop (typical)",
      logicLevel: "passive",
      maxCurrentMa: 20,
      polaritySensitive: true,
    },
    pins: [
      { id: "anode", label: "Anode (+)", kind: "passive", aliases: ["a", "pos", "+", "anode_+"], role: "Longer positive lead. Connects to control signal via current-limiting resistor." },
      { id: "cathode", label: "Cathode (-)", kind: "passive", aliases: ["k", "neg", "-", "cathode_-"], role: "Shorter negative lead with flat lens edge. Connects to Ground (0V)." },
    ],
    properties: [
      { key: "color", type: "string", defaultValue: "red", allowedValues: ["red", "green", "blue", "yellow", "white"], description: "Color of the emitted light" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite", "io_analogwrite"],
      standardPinModes: { "anode": "OUTPUT" },
    },
    wiringRules: [
      { ruleId: "led-series-resistor", type: "mandatory", description: "Must ALWAYS have a 220Ω-1kΩ resistor in series with Anode or Cathode to prevent burnout.", circuitDoctorCheckId: "led_burnout" },
      { ruleId: "led-polarity", type: "mandatory", description: "Anode must receive positive potential relative to Cathode (forward bias) to conduct current.", circuitDoctorCheckId: "led_reversed" },
    ],
    trainingKeywords: ["led", "light", "indicator", "lamp", "diode", "blinking led", "traffic light"],
    standardTopologies: ["digital indicator loop: Pin -> 220Ω Resistor -> LED Anode -> LED Cathode -> GND", "pwm dimming indicator"],
  },

  resistor: {
    type: "resistor",
    name: "Through-Hole Resistor",
    category: "passive",
    blurb: "Fixed linear passive component that restricts electrical current according to Ohm's Law (V = IR).",
    dimensions: { width: 88, height: 26 },
    electrical: {
      operatingVoltage: "0V - 50V",
      logicLevel: "passive",
      polaritySensitive: false,
    },
    pins: [
      { id: "a", label: "Terminal 1", kind: "passive", aliases: ["t1", "1", "lead1"], role: "Symmetrical passive terminal" },
      { id: "b", label: "Terminal 2", kind: "passive", aliases: ["t2", "2", "lead2"], role: "Symmetrical passive terminal" },
    ],
    properties: [
      { key: "resistance", type: "number", defaultValue: 220, allowedValues: [100, 220, 330, 1000, 4700, 10000, 100000], description: "Resistance value in Ohms (Ω)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: [],
    },
    wiringRules: [
      { ruleId: "resistor-symmetry", type: "recommended", description: "Terminals a and b are electrically symmetrical; either can connect to source or ground." },
    ],
    trainingKeywords: ["resistor", "resistance", "ohms", "current limiter", "pull-up", "pull-down", "voltage divider"],
    standardTopologies: ["current-limiting series resistor", "voltage divider lower arm (10k)", "pull-up resistor"],
  },

  pushbutton: {
    type: "pushbutton",
    name: "Momentary Tactile Pushbutton",
    category: "sensor",
    blurb: "Normally-open momentary mechanical switch. Closes circuit between internal pin pairs when pressed.",
    dimensions: { width: 60, height: 60 },
    electrical: {
      operatingVoltage: "0V - 12V",
      logicLevel: "passive",
      polaritySensitive: false,
    },
    pins: [
      { id: "p1a", label: "Terminal 1a", kind: "passive", aliases: ["1a", "a1"], role: "Contact pair 1 (internally connected to 1b)" },
      { id: "p1b", label: "Terminal 1b", kind: "passive", aliases: ["1b", "b1"], role: "Contact pair 1 (internally connected to 1a)" },
      { id: "p2a", label: "Terminal 2a", kind: "passive", aliases: ["2a", "a2"], role: "Contact pair 2 (internally connected to 2b)" },
      { id: "p2b", label: "Terminal 2b", kind: "passive", aliases: ["2b", "b2"], role: "Contact pair 2 (internally connected to 2a)" },
    ],
    properties: [
      { key: "pressed", type: "boolean", defaultValue: false, description: "True when button is held down by user" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pushbutton_read", "io_digitalread"],
      standardPinModes: { "signal": "INPUT_PULLUP" },
    },
    wiringRules: [
      { ruleId: "button-pullup-recommended", type: "recommended", description: "Connect one terminal to GND and configure pin with INPUT_PULLUP to avoid floating state.", circuitDoctorCheckId: "floating_input" },
    ],
    trainingKeywords: ["button", "pushbutton", "switch", "press", "trigger", "key", "doorbell"],
    standardTopologies: ["active-low input with internal pullup", "voltage divider active-high button"],
  },

  potentiometer: {
    type: "potentiometer",
    name: "Rotary Potentiometer (10kΩ)",
    category: "sensor",
    blurb: "Three-terminal manual variable resistor acting as an adjustable voltage divider.",
    dimensions: { width: 64, height: 64 },
    electrical: {
      operatingVoltage: "0V - 5V",
      logicLevel: "universal",
      polaritySensitive: false,
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["vcc", "left"], role: "High-side reference voltage (usually 5V or 3.3V)" },
      { id: "wiper", label: "Wiper", kind: "passive", aliases: ["w", "out", "sig", "center"], role: "Adjustable analog tap. Connects to microcontroller ADC (e.g. A0)" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["gnd", "right"], role: "Low-side reference voltage (GND)" },
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 512, description: "Wiper position ADC reading (0 to 1023)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["potentiometer_read", "io_analogread"],
    },
    wiringRules: [
      { ruleId: "pot-wiper-to-adc", type: "mandatory", description: "Wiper terminal must connect to an Analog ADC pin (A0-A5 on Uno)." },
    ],
    trainingKeywords: ["potentiometer", "knob", "dial", "volume control", "analog input", "speed control"],
    standardTopologies: ["standard 3-terminal voltage divider: 5V -> T1, GND -> T2, A0 -> Wiper"],
  },

  battery: {
    type: "battery",
    name: "9V Alkaline Battery",
    category: "power",
    blurb: "Independent 9V direct-current power supply for high-load actuators, relays, and motor drivers.",
    dimensions: { width: 62, height: 92 },
    electrical: {
      operatingVoltage: "9V DC",
      logicLevel: "power",
      maxCurrentMa: 1000,
      polaritySensitive: true,
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "vcc", "vin"], role: "Positive 9V terminal" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground / 0V return terminal" },
    ],
    properties: [
      { key: "voltage", type: "number", defaultValue: 9, description: "Nominal terminal voltage (V)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: [],
    },
    wiringRules: [
      { ruleId: "battery-common-ground", type: "mandatory", description: "Negative terminal must share a common GND with the microcontroller if driving shared logic." },
    ],
    trainingKeywords: ["battery", "9v", "power source", "external power", "power supply"],
    standardTopologies: ["high-current actuator supply for motors and relays"],
  },

  // ==========================================
  // 3. MOTORS & ACTUATORS
  // ==========================================
  servo: {
    type: "servo",
    name: "SG90 Micro Servo Motor",
    category: "actuator",
    blurb: "Precision gear-driven position motor capable of 0° to 180° rotation using standard 50Hz PWM signals.",
    dimensions: { width: 90, height: 60 },
    electrical: {
      operatingVoltage: "4.8V - 6.0V DC",
      logicLevel: "5V",
      maxCurrentMa: 550,
      polaritySensitive: true,
    },
    pins: [
      { id: "sig", label: "Signal (Orange/Yellow)", kind: "digital", aliases: ["signal", "pwm", "s"], role: "PWM control signal (1ms=0°, 1.5ms=90°, 2ms=180°)" },
      { id: "vcc", label: "VCC (Red)", kind: "power", aliases: ["5v", "power"], role: "5V Power Supply" },
      { id: "gnd", label: "GND (Brown/Black)", kind: "ground", aliases: ["ground"], role: "System Ground Reference" },
    ],
    properties: [
      { key: "angle", type: "number", defaultValue: 90, description: "Current horn angle in degrees (0 to 180)" },
    ],
    codeInterface: {
      cppLibraries: ["<Servo.h>"],
      blocklyBlockTypes: ["servo_write", "actuator_servo_write"],
      standardPinModes: { "sig": "OUTPUT" },
    },
    wiringRules: [
      { ruleId: "servo-pwm-pin", type: "mandatory", description: "Signal pin must connect to a PWM-capable pin (D9, D10 recommended on Uno)." },
      { ruleId: "servo-vcc-5v", type: "mandatory", description: "VCC must connect to 5V (not 3.3V) for sufficient motor torque." },
    ],
    trainingKeywords: ["servo", "motor", "robotic arm", "barrier gate", "lock", "vault", "steering", "angle"],
    standardTopologies: ["barrier gate control", "smart door lock actuator", "gauge meter pointer"],
  },

  buzzer: {
    type: "buzzer",
    name: "Piezoelectric Sound Buzzer",
    category: "actuator",
    blurb: "Acoustic audio transducer that converts electrical frequency signals into audible tones.",
    dimensions: { width: 56, height: 56 },
    electrical: {
      operatingVoltage: "3V - 12V DC",
      logicLevel: "universal",
      maxCurrentMa: 30,
      polaritySensitive: true,
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "sig", "p"], role: "Positive tone signal input" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground return (0V)" },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tone_play", "tone_stop", "io_tone", "io_notone"],
      standardPinModes: { "pos": "OUTPUT" },
    },
    wiringRules: [
      { ruleId: "buzzer-pos-to-pin", type: "mandatory", description: "Positive pin connects to digital output pin (e.g. D8, D11); negative connects to GND." },
    ],
    trainingKeywords: ["buzzer", "piezo", "chime", "alarm", "speaker", "audio alert", "siren"],
    standardTopologies: ["audio alert siren", "confirmation chime", "doorbell chime"],
  },

  "dc-motor": {
    type: "dc-motor",
    name: "Small Brushed DC Motor",
    category: "actuator",
    blurb: "Rotational direct-current motor. High inductive load; requires transistor, relay, or motor driver.",
    dimensions: { width: 60, height: 60 },
    electrical: {
      operatingVoltage: "3V - 9V DC",
      logicLevel: "passive",
      maxCurrentMa: 800,
      polaritySensitive: false,
    },
    pins: [
      { id: "pos", label: "M+ (Terminal 1)", kind: "passive", aliases: ["t1", "lead1"], role: "Motor coil terminal" },
      { id: "neg", label: "M- (Terminal 2)", kind: "passive", aliases: ["t2", "lead2"], role: "Motor coil terminal" },
    ],
    properties: [
      { key: "rpm", type: "number", defaultValue: 0, description: "Rotational speed in revolutions per minute" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write", "io_analogwrite"],
    },
    wiringRules: [
      { ruleId: "dc-motor-driver-required", type: "mandatory", description: "Do NOT connect DC motor directly to Arduino GPIO pins. Must use transistor, relay, or L298N driver." },
    ],
    trainingKeywords: ["dc motor", "fan", "propeller", "wheel", "motor", "rotational power"],
    standardTopologies: ["transistor-switched fan", "l298n h-bridge dual drive"],
  },

  relay: {
    type: "relay",
    name: "5V Electromechanical Relay Module",
    category: "driver",
    blurb: "Opto-isolated magnetic switch allowing low-voltage microcontrollers to switch high-voltage loads safely.",
    dimensions: { width: 80, height: 70 },
    electrical: {
      operatingVoltage: "5V DC Coil",
      logicLevel: "5V",
      maxCurrentMa: 70,
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Relay coil 5V power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "in", label: "IN", kind: "passive", aliases: ["sig", "control"], role: "Digital control signal from Arduino (e.g. D8)" },
      { id: "com", label: "COM", kind: "passive", aliases: ["common"], role: "Common switch terminal" },
      { id: "no", label: "NO", kind: "passive", aliases: ["normally_open"], role: "Normally-Open contact (closes when IN is HIGH)" },
      { id: "nc", label: "NC", kind: "passive", aliases: ["normally_closed"], role: "Normally-Closed contact (opens when IN is HIGH)" },
    ],
    properties: [
      { key: "closed", type: "boolean", defaultValue: false, description: "State of the NO contact" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"],
      standardPinModes: { "in": "OUTPUT" },
    },
    wiringRules: [
      { ruleId: "relay-coil-power", type: "mandatory", description: "VCC connects to 5V, GND to GND, and IN to digital control pin." },
    ],
    trainingKeywords: ["relay", "switch", "high voltage", "home automation", "smart plug", "ac switch"],
    standardTopologies: ["home automation high power switch: Battery -> COM, NO -> Load -> Battery GND"],
  },

  l298n: {
    type: "l298n",
    name: "L298N Dual H-Bridge Motor Driver",
    category: "driver",
    blurb: "High-power dual DC motor and stepper driver module supporting bidirectional speed and direction control.",
    dimensions: { width: 120, height: 96 },
    electrical: {
      operatingVoltage: "5V - 35V Motor Power (VS)",
      logicLevel: "5V",
      maxCurrentMa: 2000,
      polaritySensitive: true,
    },
    pins: [
      { id: "vs", label: "VMotor (VS)", kind: "power", aliases: ["12v", "bat"], role: "External motor power supply (e.g. 9V battery)" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Common ground reference" },
      { id: "5v", label: "5V Logic", kind: "power", aliases: ["vcc"], role: "5V onboard logic power" },
      { id: "ena", label: "ENA", kind: "digital", aliases: ["speed_a"], role: "Motor A PWM speed enable (e.g. D5)" },
      { id: "in1", label: "IN1", kind: "digital", aliases: ["dir1_a"], role: "Motor A Direction 1 (e.g. D7)" },
      { id: "in2", label: "IN2", kind: "digital", aliases: ["dir2_a"], role: "Motor A Direction 2 (e.g. D8)" },
      { id: "out1", label: "OUT1", kind: "passive", aliases: ["motor_a_1"], role: "Motor A Output Terminal 1" },
      { id: "out2", label: "OUT2", kind: "passive", aliases: ["motor_a_2"], role: "Motor A Output Terminal 2" },
      { id: "enb", label: "ENB", kind: "digital", aliases: ["speed_b"], role: "Motor B PWM speed enable (e.g. D6)" },
      { id: "in3", label: "IN3", kind: "digital", aliases: ["dir1_b"], role: "Motor B Direction 1 (e.g. D9)" },
      { id: "in4", label: "IN4", kind: "digital", aliases: ["dir2_b"], role: "Motor B Direction 2 (e.g. D10)" },
      { id: "out3", label: "OUT3", kind: "passive", aliases: ["motor_b_1"], role: "Motor B Output Terminal 1" },
      { id: "out4", label: "OUT4", kind: "passive", aliases: ["motor_b_2"], role: "Motor B Output Terminal 2" },
    ],
    properties: [
      { key: "speedA", type: "number", defaultValue: 0, description: "Motor A PWM Speed (0-255)" },
      { key: "speedB", type: "number", defaultValue: 0, description: "Motor B PWM Speed (0-255)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write"],
    },
    wiringRules: [
      { ruleId: "l298n-common-ground", type: "mandatory", description: "L298N GND must be connected to BOTH battery GND and Arduino GND." },
    ],
    trainingKeywords: ["l298n", "h-bridge", "motor driver", "rover", "robot car", "dual motor"],
    standardTopologies: ["differential steering 2WD robot chassis"],
  },

  // ==========================================
  // 4. SENSORS (INPUT DEVICES)
  // ==========================================
  ultrasonic: {
    type: "ultrasonic",
    name: "HC-SR04 Ultrasonic Distance Sensor",
    category: "sensor",
    blurb: "Non-contact sonar ranging module measuring distances from 2 cm to 400 cm with 3mm precision.",
    dimensions: { width: 100, height: 56 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 15,
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "trig", label: "Trig", kind: "passive", aliases: ["trigger", "t"], role: "Trigger input pulse (10µs TTL pulse)" },
      { id: "echo", label: "Echo", kind: "passive", aliases: ["e"], role: "Echo output pulse proportional to distance" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" },
    ],
    properties: [
      { key: "distance", type: "number", defaultValue: 100, description: "Simulated target distance in centimeters" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ultrasonic_read"],
      standardPinModes: { "trig": "OUTPUT", "echo": "INPUT" },
    },
    wiringRules: [
      { ruleId: "ultrasonic-5v-required", type: "mandatory", description: "HC-SR04 requires 5V VCC to emit ultrasonic bursts reliably." },
    ],
    trainingKeywords: ["ultrasonic", "sonar", "distance", "hc-sr04", "radar", "proximity", "obstacle detector"],
    standardTopologies: ["obstacle avoidance radar", "smart trash can opener", "distance meter"],
  },

  ldr: {
    type: "ldr",
    name: "Light Dependent Resistor (Photoresistor)",
    category: "sensor",
    blurb: "CdS semiconductor sensor whose resistance decreases as ambient light intensity increases.",
    dimensions: { width: 40, height: 50 },
    electrical: {
      operatingVoltage: "0V - 5V",
      logicLevel: "passive",
      polaritySensitive: false,
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["1", "a"], role: "Passive resistor lead" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["2", "b"], role: "Passive resistor lead" },
    ],
    properties: [
      { key: "light", type: "number", defaultValue: 512, description: "Simulated ambient illumination level (0 to 1023)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ldr_read", "io_analogread"],
    },
    wiringRules: [
      { ruleId: "ldr-voltage-divider", type: "mandatory", description: "Must be wired in series with a 10kΩ fixed resistor between 5V and GND, tapping junction to A0.", circuitDoctorCheckId: "floating_analog" },
    ],
    trainingKeywords: ["ldr", "photoresistor", "light sensor", "night light", "solar tracker", "ambient light"],
    standardTopologies: ["voltage divider with 10k resistor: 5V -> LDR -> Junction(A0) -> 10kΩ -> GND"],
  },

  "pir-sensor": {
    type: "pir-sensor",
    name: "HC-SR501 PIR Motion Sensor",
    category: "sensor",
    blurb: "Pyroelectric infrared motion sensor that outputs a digital HIGH signal upon detecting human infrared movement.",
    dimensions: { width: 60, height: 70 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "3.3V/5V TTL Output",
      maxCurrentMa: 65,
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V DC Power Input" },
      { id: "out", label: "OUT", kind: "passive", aliases: ["sig", "data"], role: "Digital output: HIGH when motion detected, LOW when idle" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
    ],
    properties: [
      { key: "motion", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Current motion detection state" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pir_motion", "io_digitalread"],
      standardPinModes: { "out": "INPUT" },
    },
    wiringRules: [
      { ruleId: "pir-out-to-digital", type: "mandatory", description: "OUT pin connects to a digital input pin (e.g. D2, D7)." },
    ],
    trainingKeywords: ["pir", "motion", "burglar alarm", "occupancy", "security", "infrared motion"],
    standardTopologies: ["intruder alarm security station", "automatic room light controller"],
  },

  dht11: {
    type: "dht11",
    name: "DHT11 Temperature & Humidity Sensor",
    category: "sensor",
    blurb: "Single-wire digital climate sensor reading 20-90% relative humidity and 0-50°C temperature.",
    dimensions: { width: 72, height: 66 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      maxCurrentMa: 2.5,
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "Power supply" },
      { id: "data", label: "DATA", kind: "digital", aliases: ["out", "sig"], role: "Single-bus bidirectional serial data line" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Ambient temperature in °C" },
      { key: "humidity", type: "number", defaultValue: 55, description: "Relative humidity in %" },
    ],
    codeInterface: {
      cppLibraries: ["<DHT.h>"],
      blocklyBlockTypes: ["dht_temperature", "dht_humidity"],
    },
    wiringRules: [
      { ruleId: "dht-data-pin", type: "mandatory", description: "DATA pin connects to a digital pin (e.g. D2, D4)." },
    ],
    trainingKeywords: ["dht11", "temperature", "humidity", "weather station", "climate", "thermostat"],
    standardTopologies: ["smart weather station with lcd", "greenhouse automated climate monitor"],
  },

  tmp36: {
    type: "tmp36",
    name: "TMP36 Precision Temperature Sensor",
    category: "sensor",
    blurb: "Linear analog temperature sensor outputting 10 mV/°C with a 500 mV offset at 0°C (-40°C to +125°C).",
    dimensions: { width: 40, height: 50 },
    electrical: {
      operatingVoltage: "2.7V - 5.5V DC",
      logicLevel: "universal",
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "VOUT", kind: "passive", aliases: ["vout", "analog"], role: "Analog voltage proportional to temperature" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Simulated temperature in °C" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tmp36_temperature", "io_analogread"],
    },
    wiringRules: [
      { ruleId: "tmp36-out-to-adc", type: "mandatory", description: "VOUT must connect to an Analog ADC pin (e.g. A0, A1)." },
    ],
    trainingKeywords: ["tmp36", "temperature sensor", "thermometer", "analog temp", "heat sensor"],
    standardTopologies: ["analog thermometer with led indicator bar"],
  },

  "mq2-gas": {
    type: "mq2-gas",
    name: "MQ-2 Flammable Gas & Smoke Sensor",
    category: "sensor",
    blurb: "Chemical semiconductor gas sensor sensitive to LPG, propane, methane, hydrogen, and smoke.",
    dimensions: { width: 80, height: 90 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 150,
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Heater & Circuit Power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" },
      { id: "do", label: "DO (Digital Out)", kind: "digital", aliases: ["d0"], role: "Threshold comparator digital alert" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0"], role: "Analog gas concentration output" },
    ],
    properties: [
      { key: "gasLevel", type: "number", defaultValue: 150, description: "Gas concentration level in PPM" },
      { key: "threshold", type: "number", defaultValue: 350, description: "Alert trigger threshold" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["mq2_gas_read", "io_analogread", "io_digitalread"],
    },
    wiringRules: [
      { ruleId: "mq2-5v-required", type: "mandatory", description: "MQ-2 internal tin dioxide sensor heater requires 5V supply." },
    ],
    trainingKeywords: ["mq2", "gas sensor", "smoke detector", "fire alarm", "pollution", "lpg leak"],
    standardTopologies: ["kitchen safety smoke alarm with buzzer and led"],
  },

  "soil-moisture": {
    type: "soil-moisture",
    name: "Soil Moisture Sensor",
    category: "sensor",
    blurb: "Resistive soil hygrometer measuring volumetric water content in soil.",
    dimensions: { width: 72, height: 84 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Probe Power" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0", "sig"], role: "Analog moisture signal (high when dry, low when wet)" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
    ],
    properties: [
      { key: "moisture", type: "number", defaultValue: 620, description: "ADC reading (0-1023)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["soil_moisture_read", "io_analogread"],
    },
    wiringRules: [
      { ruleId: "soil-ao-to-adc", type: "mandatory", description: "AO connects to an Analog ADC pin (e.g. A0, A2)." },
    ],
    trainingKeywords: ["soil moisture", "hygrometer", "plant watering", "smart agriculture", "irrigation"],
    standardTopologies: ["automated plant watering system with servo valve"],
  },

  "ir-sensor": {
    type: "ir-sensor",
    name: "IR Optical Obstacle Sensor",
    category: "sensor",
    blurb: "Infrared emitter/photodiode pair for close-range line following and obstacle detection.",
    dimensions: { width: 76, height: 64 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      polaritySensitive: true,
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "OUT", kind: "digital", aliases: ["sig"], role: "Active-low digital output when obstacle reflected" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
    ],
    properties: [
      { key: "detected", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Reflection detected status" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ir_read", "io_digitalread"],
    },
    wiringRules: [
      { ruleId: "ir-out-to-digital", type: "mandatory", description: "OUT connects to digital input pin." },
    ],
    trainingKeywords: ["ir sensor", "infrared", "line tracker", "obstacle detector", "proximity"],
    standardTopologies: ["conveyor belt counter", "line-following robot sensor"],
  },

  joystick: {
    type: "joystick",
    name: "Dual-Axis Thumbstick & Switch",
    category: "sensor",
    blurb: "Two orthogonal 10kΩ potentiometers for X and Y analog deflection plus integrated tactile push switch.",
    dimensions: { width: 86, height: 86 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      polaritySensitive: true,
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Common ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V reference power" },
      { id: "vrx", label: "VRx", kind: "analog", aliases: ["x"], role: "Horizontal X-axis analog output (A0)" },
      { id: "vry", label: "VRy", kind: "analog", aliases: ["y"], role: "Vertical Y-axis analog output (A1)" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push-button digital switch (D2)" },
    ],
    properties: [
      { key: "x", type: "number", defaultValue: 512, description: "X-axis position (0 to 1023)" },
      { key: "y", type: "number", defaultValue: 512, description: "Y-axis position (0 to 1023)" },
      { key: "pressed", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "SW switch state" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["joystick_x", "joystick_y", "joystick_button"],
    },
    wiringRules: [
      { ruleId: "joystick-adc-pair", type: "mandatory", description: "VRx and VRy must connect to two separate Analog pins (A0, A1)." },
    ],
    trainingKeywords: ["joystick", "thumbstick", "gamepad", "pan tilt", "steer", "controller"],
    standardTopologies: ["rover drive controller", "pan-tilt camera mount"],
  },

  "rotary-encoder": {
    type: "rotary-encoder",
    name: "Quadrature Rotary Encoder",
    category: "sensor",
    blurb: "Infinite rotation dual-phase encoder outputting quadrature Gray-code pulses for angular step detection.",
    dimensions: { width: 74, height: 82 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      polaritySensitive: true,
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "clk", label: "CLK (A)", kind: "digital", aliases: ["a"], role: "Channel A pulse output" },
      { id: "dt", label: "DT (B)", kind: "digital", aliases: ["b"], role: "Channel B quadrature phase output" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push switch" },
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 0, description: "Current relative step counter" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["encoder_read"],
    },
    wiringRules: [
      { ruleId: "encoder-interrupt-recommended", type: "recommended", description: "Connect CLK to interrupt pin D2 or D3 for zero-miss step tracking." },
    ],
    trainingKeywords: ["encoder", "rotary encoder", "scroll wheel", "menu selector", "dial"],
    standardTopologies: ["digital menu navigation", "precision motor step odometer"],
  },

  "keypad-4x4": {
    type: "keypad-4x4",
    name: "4x4 Matrix Keypad",
    category: "sensor",
    blurb: "16-button membrane matrix keypad with 4 row lines and 4 column lines for PIN and code entry.",
    dimensions: { width: 118, height: 120 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "universal",
      polaritySensitive: false,
    },
    pins: [
      { id: "r1", label: "Row 1", kind: "digital", aliases: ["row1"], role: "Row 1 scan line (keys 1, 2, 3, A) -> D2" },
      { id: "r2", label: "Row 2", kind: "digital", aliases: ["row2"], role: "Row 2 scan line (keys 4, 5, 6, B) -> D3" },
      { id: "r3", label: "Row 3", kind: "digital", aliases: ["row3"], role: "Row 3 scan line (keys 7, 8, 9, C) -> D4" },
      { id: "r4", label: "Row 4", kind: "digital", aliases: ["row4"], role: "Row 4 scan line (keys CLR, 0, OK, D) -> D5" },
      { id: "c1", label: "Col 1", kind: "digital", aliases: ["col1"], role: "Col 1 scan line -> D6" },
      { id: "c2", label: "Col 2", kind: "digital", aliases: ["col2"], role: "Col 2 scan line -> D7" },
      { id: "c3", label: "Col 3", kind: "digital", aliases: ["col3"], role: "Col 3 scan line -> D8" },
      { id: "c4", label: "Col 4", kind: "digital", aliases: ["col4"], role: "Col 4 scan line -> D9" },
    ],
    properties: [
      { key: "lastKey", type: "string", defaultValue: "", description: "Submitted key or PIN string upon pressing OK" },
      { key: "enteredPin", type: "string", defaultValue: "", description: "Uncommitted live typing buffer" },
    ],
    codeInterface: {
      cppLibraries: ["<Keypad.h>"],
      blocklyBlockTypes: ["keypad_read", "keypad_check_pin", "keypad_clear_pin"],
    },
    wiringRules: [
      { ruleId: "keypad-pin-sequence", type: "mandatory", description: "Rows connect to D2-D5 sequentially; Cols connect to D6-D9 sequentially." },
    ],
    trainingKeywords: ["keypad", "pin entry", "password", "matrix keypad", "access control", "safe lock", "security"],
    standardTopologies: ["security safe vault authentication station with servo and lcd"],
  },

  // ==========================================
  // 5. DISPLAYS & LIGHTING
  // ==========================================
  "lcd-i2c": {
    type: "lcd-i2c",
    name: "16x2 Character LCD with I2C Backpack",
    category: "display",
    blurb: "Two-line, 16-character alphanumeric Liquid Crystal Display module driven over a 2-wire I2C bus.",
    dimensions: { width: 180, height: 80 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V (I2C address 0x27)",
      maxCurrentMa: 80,
      polaritySensitive: true,
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Power ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "sda", label: "SDA", kind: "passive", aliases: ["data"], role: "I2C Serial Data (Uno: A4, ESP32: GPIO21)" },
      { id: "scl", label: "SCL", kind: "passive", aliases: ["clock"], role: "I2C Serial Clock (Uno: A5, ESP32: GPIO22)" },
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU CYBERLAB", description: "Top 16-character line" },
      { key: "line2", type: "string", defaultValue: "SYSTEM READY", description: "Bottom 16-character line" },
    ],
    codeInterface: {
      cppLibraries: ["<LiquidCrystal_I2C.h>", "<Wire.h>"],
      blocklyBlockTypes: ["lcd_print", "lcd_print_line", "lcd_set_cursor", "lcd_clear"],
    },
    wiringRules: [
      { ruleId: "lcd-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Arduino Uno." },
      { ruleId: "lcd-vcc-5v", type: "mandatory", description: "LCD backlight requires 5V for readable character contrast." },
    ],
    trainingKeywords: ["lcd", "display", "screen", "16x2", "i2c lcd", "text display", "message"],
    standardTopologies: ["dashboard telemetry screen", "passcode prompt display"],
  },

  "oled-i2c": {
    type: "oled-i2c",
    name: "0.96-inch Monochrome OLED Display",
    category: "display",
    blurb: "128x64 high-contrast blue/white organic LED display powered by SSD1306 driver over I2C.",
    dimensions: { width: 150, height: 92 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal (I2C address 0x3C)",
      maxCurrentMa: 25,
      polaritySensitive: true,
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "3.3V or 5V Power" },
      { id: "scl", label: "SCL", kind: "digital", aliases: ["clock"], role: "I2C Clock line (A5 on Uno)" },
      { id: "sda", label: "SDA", kind: "digital", aliases: ["data"], role: "I2C Data line (A4 on Uno)" },
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU TECH", description: "Header text line" },
      { key: "line2", type: "string", defaultValue: "READY", description: "Primary message line" },
      { key: "line3", type: "string", defaultValue: "", description: "Status footer line" },
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_GFX.h>", "<Adafruit_SSD1306.h>", "<Wire.h>"],
      blocklyBlockTypes: ["oled_print", "oled_clear"],
    },
    wiringRules: [
      { ruleId: "oled-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Uno." },
    ],
    trainingKeywords: ["oled", "display", "ssd1306", "graphics screen", "0.96 inch"],
    standardTopologies: ["compact wearable HUD display", "telemetry monitor"],
  },

  "neopixel-ring": {
    type: "neopixel-ring",
    name: "NeoPixel WS2812B 8-LED Ring",
    category: "display",
    blurb: "Individually-addressable 24-bit RGB smart LEDs chained on a single high-speed digital timing wire.",
    dimensions: { width: 100, height: 100 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      maxCurrentMa: 480,
      polaritySensitive: true,
    },
    pins: [
      { id: "di", label: "DI (Data In)", kind: "digital", aliases: ["din", "data", "in"], role: "800kHz single-wire serial data in (e.g. D6)" },
      { id: "vcc", label: "VCC (5V)", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "do", label: "DO (Data Out)", kind: "digital", aliases: ["dout"], role: "Chaining data out to next NeoPixel module" },
    ],
    properties: [
      { key: "numPixels", type: "number", defaultValue: 8, description: "Total pixel count" },
      { key: "brightness", type: "number", defaultValue: 200, description: "Brightness level (0-255)" },
      { key: "pattern", type: "string", defaultValue: "rainbow", description: "Active animation pattern" },
      { key: "color", type: "string", defaultValue: "#38bdf8", description: "Active hex color" },
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_NeoPixel.h>"],
      blocklyBlockTypes: ["neopixel_set_color", "neopixel_show"],
      standardPinModes: { "di": "OUTPUT" },
    },
    wiringRules: [
      { ruleId: "neopixel-di-pin", type: "mandatory", description: "DI connects to high-speed digital pin (D6 recommended)." },
    ],
    trainingKeywords: ["neopixel", "ws2812b", "addressable led", "rgb ring", "smart led", "rainbow"],
    standardTopologies: ["mood lighting ring", "audio visualizer ring", "speedometer gauge"],
  },

  "seven-segment": {
    type: "seven-segment",
    name: "Common-Cathode 7-Segment Display",
    category: "display",
    blurb: "Eight individual LED segments (a, b, c, d, e, f, g, dp) arranged in figure-8 configuration to render decimal digits.",
    dimensions: { width: 60, height: 80 },
    electrical: {
      operatingVoltage: "2V forward drop per segment",
      logicLevel: "passive",
      polaritySensitive: true,
    },
    pins: [
      { id: "a", label: "Seg A", kind: "passive", aliases: ["sega"], role: "Top horizontal bar -> D2" },
      { id: "b", label: "Seg B", kind: "passive", aliases: ["segb"], role: "Top-right vertical bar -> D3" },
      { id: "c", label: "Seg C", kind: "passive", aliases: ["segc"], role: "Bottom-right vertical bar -> D4" },
      { id: "d", label: "Seg D", kind: "passive", aliases: ["segd"], role: "Bottom horizontal bar -> D5" },
      { id: "e", label: "Seg E", kind: "passive", aliases: ["sege"], role: "Bottom-left vertical bar -> D6" },
      { id: "f", label: "Seg F", kind: "passive", aliases: ["segf"], role: "Top-left vertical bar -> D7" },
      { id: "g", label: "Seg G", kind: "passive", aliases: ["segg"], role: "Middle horizontal bar -> D8" },
      { id: "dp", label: "DP", kind: "passive", aliases: ["dot"], role: "Decimal point" },
      { id: "com", label: "Common Cathode", kind: "passive", aliases: ["gnd", "k"], role: "Common Cathode pin -> GND" },
    ],
    properties: [
      { key: "digit", type: "number", defaultValue: 0, description: "Active displayed digit (0-9)" },
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["seven_segment_write", "seven_segment_clear"],
    },
    wiringRules: [
      { ruleId: "seven-seg-pins", type: "mandatory", description: "Segments a-g connect sequentially to digital pins D2 through D8. Common connects to GND." },
    ],
    trainingKeywords: ["7 segment", "seven segment", "counter", "digital display", "scoreboard", "digits"],
    standardTopologies: ["decade counter 0-9", "dice roller", "digital countdown timer"],
  },

  "rgb-led": {
    type: "rgb-led",
    name: "Common-Cathode RGB LED",
    category: "actuator",
    blurb: "Four-pin diffused LED packaging red, green, and blue diodes with a shared common cathode lead.",
    dimensions: { width: 50, height: 70 },
    electrical: {
      operatingVoltage: "2.0V - 3.2V forward drop",
      logicLevel: "passive",
      polaritySensitive: true,
    },
    pins: [
      { id: "red", label: "Red Anode", kind: "passive", aliases: ["r"], role: "Red diode anode via 220Ω resistor (PWM pin D9)" },
      { id: "gnd", label: "Common Cathode (-)", kind: "passive", aliases: ["k", "cathode"], role: "Common negative cathode -> GND" },
      { id: "green", label: "Green Anode", kind: "passive", aliases: ["g"], role: "Green diode anode via 220Ω resistor (PWM pin D10)" },
      { id: "blue", label: "Blue Anode", kind: "passive", aliases: ["b"], role: "Blue diode anode via 220Ω resistor (PWM pin D11)" },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_analogwrite", "io_digitalwrite"],
    },
    wiringRules: [
      { ruleId: "rgb-resistors", type: "mandatory", description: "Each color anode (Red, Green, Blue) requires its own 220Ω current-limiting resistor." },
      { ruleId: "rgb-pwm-pins", type: "recommended", description: "Connect to PWM pins (D9, D10, D11) for full 16-million color mixing." },
    ],
    trainingKeywords: ["rgb led", "multi color led", "color mixing", "tricolor led"],
    standardTopologies: ["mood lamp color fader", "traffic light single bulb"],
  },

  // ==========================================
  // 6. DISCRETE SEMICONDUCTORS & BREADBOARD
  // ==========================================
  "npn-transistor": {
    type: "npn-transistor",
    name: "2N2222 NPN Bipolar Junction Transistor",
    category: "driver",
    blurb: "Current-controlled electronic switch allowing a small base current to switch larger collector-emitter currents.",
    dimensions: { width: 40, height: 56 },
    electrical: {
      operatingVoltage: "Up to 40V VCEO",
      logicLevel: "passive",
      maxCurrentMa: 800,
      polaritySensitive: true,
    },
    pins: [
      { id: "emitter", label: "Emitter (E)", kind: "passive", aliases: ["e"], role: "Connects to Ground (0V)" },
      { id: "base", label: "Base (B)", kind: "passive", aliases: ["b"], role: "Control terminal. Connects to digital pin via 1kΩ base resistor." },
      { id: "collector", label: "Collector (C)", kind: "passive", aliases: ["c"], role: "Load connection to ground return" },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"],
    },
    wiringRules: [
      { ruleId: "transistor-base-resistor", type: "mandatory", description: "Must ALWAYS have a 1kΩ resistor between microcontroller digital pin and Base terminal to prevent burning GPIO." },
    ],
    trainingKeywords: ["transistor", "npn", "2n2222", "electronic switch", "amplifier"],
    standardTopologies: ["low-side switch for DC motor or high-power buzzer"],
  },

  breadboard: {
    type: "breadboard",
    name: "Solderless Prototyping Breadboard",
    category: "prototyping",
    blurb: "Full-size solderless breadboard with interconnected terminal strips (a-e, f-j) and full-length power distribution rails.",
    dimensions: { width: 460, height: 214 },
    electrical: {
      operatingVoltage: "0V - 12V",
      logicLevel: "passive",
      polaritySensitive: false,
    },
    pins: [
      { id: "pos_top", label: "+ Rail (Top)", kind: "power", aliases: ["+top"], role: "Continuous positive 5V power bus" },
      { id: "neg_top", label: "- Rail (Top)", kind: "ground", aliases: ["-top"], role: "Continuous ground 0V bus" },
      { id: "pos_bot", label: "+ Rail (Bottom)", kind: "power", aliases: ["+bot"], role: "Continuous positive 5V power bus" },
      { id: "neg_bot", label: "- Rail (Bottom)", kind: "ground", aliases: ["-bot"], role: "Continuous ground 0V bus" },
      { id: "a1", label: "Row a1", kind: "passive", aliases: [], role: "5-pin tie-point column" },
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: [],
    },
    wiringRules: [
      { ruleId: "breadboard-rails", type: "recommended", description: "Use top and bottom rails for 5V and GND distribution." },
    ],
    trainingKeywords: ["breadboard", "prototyping", "solderless", "tie points"],
    standardTopologies: ["central wiring breadboard bus"],
  },
}
