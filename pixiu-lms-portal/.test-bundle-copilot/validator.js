// src/lib/ai/pixiu-components-dataset.ts
var PIXIU_COMPONENTS_DATASET = {
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
      polaritySensitive: true
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
      { id: "a5", label: "A5 (SCL)", kind: "analog", aliases: ["scl", "5"], role: "10-bit Analog Input or I2C Clock (SCL)", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Arduino.h>"],
      blocklyBlockTypes: ["arduino_program", "io_pinmode", "io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread", "time_delay", "serial_begin", "serial_println"]
    },
    wiringRules: [
      { ruleId: "uno-gnd-required", type: "mandatory", description: "All active peripheral circuits must share a common GND connection with the Arduino board." },
      { ruleId: "uno-pwm-pins", type: "recommended", description: "Use PWM-capable pins for analogWrite motor-speed control. Hobby servos driven by the standard Servo library use timer-based control pulses and do not require hardware PWM." },
      { ruleId: "uno-i2c-pins", type: "mandatory", description: "I2C displays (LCD 1602, OLED) must connect to A4 (SDA) and A5 (SCL)." }
    ],
    trainingKeywords: ["uno", "arduino", "atmega328p", "microcontroller", "main board", "controller"],
    standardTopologies: ["single-board microcontroller hub", "i2c bus master", "adc voltage sensing hub", "pwm actuator driver"]
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
      polaritySensitive: true
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
      { id: "d35", label: "GPIO35", kind: "analog", aliases: ["35", "gpio35"], role: "Input-only, 12-bit ADC1", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<WiFi.h>", "<WebServer.h>"],
      blocklyBlockTypes: ["wifi_connect", "wifi_server_begin", "wifi_server_on", "wifi_server_send", "wifi_local_ip"]
    },
    wiringRules: [
      { ruleId: "esp32-voltage-tolerance", type: "mandatory", description: "ESP32 GPIO pins tolerate max 3.3V. 5V sensors require voltage dividers." },
      { ruleId: "esp32-i2c-pins", type: "mandatory", description: "Default I2C bus pins are GPIO21 (SDA) and GPIO22 (SCL)." }
    ],
    trainingKeywords: ["esp32", "wifi", "iot", "web server", "smart home", "internet of things"],
    standardTopologies: ["iot web server controller", "wifi telemetry client", "smart home hub"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vbus", label: "VBUS (5V)", kind: "power", aliases: ["5v"], role: "USB 5V input power" },
      { id: "3v3", label: "3V3 (OUT)", kind: "power", aliases: ["3.3v"], role: "Regulated 3.3V power output" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "gp0", label: "GP0", kind: "digital", aliases: ["0"], role: "GPIO, UART0 TX, I2C0 SDA", pwmSupported: true },
      { id: "gp1", label: "GP1", kind: "digital", aliases: ["1"], role: "GPIO, UART0 RX, I2C0 SCL", pwmSupported: true },
      { id: "gp25", label: "GP25", kind: "digital", aliases: ["25", "led_builtin"], role: "Built-in Green LED" },
      { id: "gp26", label: "GP26 (ADC0)", kind: "analog", aliases: ["26", "a0"], role: "12-bit ADC0 channel", adcSupported: true }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<pico/stdlib.h>"],
      blocklyBlockTypes: ["io_digitalwrite", "io_digitalread", "io_analogwrite", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "pico-3v3-logic", type: "mandatory", description: "Raspberry Pi Pico uses 3.3V logic level." }
    ],
    trainingKeywords: ["pico", "rp2040", "raspberry pi pico", "arm cortex"],
    standardTopologies: ["embedded edge controller", "pwm audio/motor station"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "3v", label: "3V", kind: "power", aliases: ["3v3", "vcc"], role: "3V Power Rail" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "p0", label: "P0", kind: "analog", aliases: ["0"], role: "Touch pin, ADC, buzzer audio output", adcSupported: true },
      { id: "p1", label: "P1", kind: "analog", aliases: ["1"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "p2", label: "P2", kind: "analog", aliases: ["2"], role: "Touch pin, ADC analog in", adcSupported: true },
      { id: "btn_a", label: "Button A", kind: "digital", aliases: ["a"], role: "Integrated left tactile button" },
      { id: "btn_b", label: "Button B", kind: "digital", aliases: ["b"], role: "Integrated right tactile button" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: ["<Adafruit_Microbit.h>"],
      blocklyBlockTypes: ["microbit_show_icon", "microbit_show_number", "microbit_show_string", "microbit_clear", "microbit_button_pressed"]
    },
    wiringRules: [
      { ruleId: "microbit-edge-alligator", type: "recommended", description: "P0, P1, P2 and 3V/GND large rings are designed for alligator clips." }
    ],
    trainingKeywords: ["microbit", "bbc micro:bit", "5x5 led matrix", "stem edtech"],
    standardTopologies: ["wearable interactive badge", "gesture badge", "educational sensory game"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "anode", label: "Anode (+)", kind: "passive", aliases: ["a", "pos", "+", "anode_+"], role: "Longer positive lead. Connects to control signal via current-limiting resistor." },
      { id: "cathode", label: "Cathode (-)", kind: "passive", aliases: ["k", "neg", "-", "cathode_-"], role: "Shorter negative lead with flat lens edge. Connects to Ground (0V)." }
    ],
    properties: [
      { key: "color", type: "string", defaultValue: "red", allowedValues: ["red", "green", "blue", "yellow", "white"], description: "Color of the emitted light" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite", "io_analogwrite"],
      standardPinModes: { "anode": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "led-series-resistor", type: "mandatory", description: "Must ALWAYS have a 220\u03A9-1k\u03A9 resistor in series with Anode or Cathode to prevent burnout.", circuitDoctorCheckId: "led_burnout" },
      { ruleId: "led-polarity", type: "mandatory", description: "Anode must receive positive potential relative to Cathode (forward bias) to conduct current.", circuitDoctorCheckId: "led_reversed" }
    ],
    trainingKeywords: ["led", "light", "indicator", "lamp", "diode", "blinking led", "traffic light"],
    standardTopologies: ["digital indicator loop: Pin -> 220\u03A9 Resistor -> LED Anode -> LED Cathode -> GND", "pwm dimming indicator"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "a", label: "Terminal 1", kind: "passive", aliases: ["t1", "1", "lead1"], role: "Symmetrical passive terminal" },
      { id: "b", label: "Terminal 2", kind: "passive", aliases: ["t2", "2", "lead2"], role: "Symmetrical passive terminal" }
    ],
    properties: [
      { key: "resistance", type: "number", defaultValue: 220, allowedValues: [100, 220, 330, 1e3, 4700, 1e4, 1e5], description: "Resistance value in Ohms (\u03A9)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "resistor-symmetry", type: "recommended", description: "Terminals a and b are electrically symmetrical; either can connect to source or ground." }
    ],
    trainingKeywords: ["resistor", "resistance", "ohms", "current limiter", "pull-up", "pull-down", "voltage divider"],
    standardTopologies: ["current-limiting series resistor", "voltage divider lower arm (10k)", "pull-up resistor"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "p1a", label: "Terminal 1a", kind: "passive", aliases: ["1a", "a1"], role: "Contact pair 1 (internally connected to 1b)" },
      { id: "p1b", label: "Terminal 1b", kind: "passive", aliases: ["1b", "b1"], role: "Contact pair 1 (internally connected to 1a)" },
      { id: "p2a", label: "Terminal 2a", kind: "passive", aliases: ["2a", "a2"], role: "Contact pair 2 (internally connected to 2b)" },
      { id: "p2b", label: "Terminal 2b", kind: "passive", aliases: ["2b", "b2"], role: "Contact pair 2 (internally connected to 2a)" }
    ],
    properties: [
      { key: "pressed", type: "boolean", defaultValue: false, description: "True when button is held down by user" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pushbutton_read", "io_digitalread"],
      standardPinModes: { "signal": "INPUT_PULLUP" }
    },
    wiringRules: [
      { ruleId: "button-pullup-recommended", type: "recommended", description: "Connect one terminal to GND and configure pin with INPUT_PULLUP to avoid floating state.", circuitDoctorCheckId: "floating_input" }
    ],
    trainingKeywords: ["button", "pushbutton", "switch", "press", "trigger", "key", "doorbell"],
    standardTopologies: ["active-low input with internal pullup", "voltage divider active-high button"]
  },
  potentiometer: {
    type: "potentiometer",
    name: "Rotary Potentiometer (10k\u03A9)",
    category: "sensor",
    blurb: "Three-terminal manual variable resistor acting as an adjustable voltage divider.",
    dimensions: { width: 64, height: 64 },
    electrical: {
      operatingVoltage: "0V - 5V",
      logicLevel: "universal",
      polaritySensitive: false
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["vcc", "left"], role: "High-side reference voltage (usually 5V or 3.3V)" },
      { id: "wiper", label: "Wiper", kind: "passive", aliases: ["w", "out", "sig", "center"], role: "Adjustable analog tap. Connects to microcontroller ADC (e.g. A0)" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["gnd", "right"], role: "Low-side reference voltage (GND)" }
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 512, description: "Wiper position ADC reading (0 to 1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["potentiometer_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "pot-wiper-to-adc", type: "mandatory", description: "Wiper terminal must connect to an Analog ADC pin (A0-A5 on Uno)." }
    ],
    trainingKeywords: ["potentiometer", "knob", "dial", "volume control", "analog input", "speed control"],
    standardTopologies: ["standard 3-terminal voltage divider: 5V -> T1, GND -> T2, A0 -> Wiper"]
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
      maxCurrentMa: 1e3,
      polaritySensitive: true
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "vcc", "vin"], role: "Positive 9V terminal" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground / 0V return terminal" }
    ],
    properties: [
      { key: "voltage", type: "number", defaultValue: 9, description: "Nominal terminal voltage (V)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "battery-common-ground", type: "mandatory", description: "Negative terminal must share a common GND with the microcontroller if driving shared logic." }
    ],
    trainingKeywords: ["battery", "9v", "power source", "external power", "power supply"],
    standardTopologies: ["high-current actuator supply for motors and relays"]
  },
  // ==========================================
  // 3. MOTORS & ACTUATORS
  // ==========================================
  servo: {
    type: "servo",
    name: "SG90 Micro Servo Motor",
    category: "actuator",
    blurb: "Precision gear-driven position motor capable of 0\xB0 to 180\xB0 rotation using standard 50Hz PWM signals.",
    dimensions: { width: 90, height: 60 },
    electrical: {
      operatingVoltage: "4.8V - 6.0V DC",
      logicLevel: "5V",
      maxCurrentMa: 550,
      polaritySensitive: true
    },
    pins: [
      { id: "sig", label: "Signal (Orange/Yellow)", kind: "digital", aliases: ["signal", "pwm", "s"], role: "PWM control signal (1ms=0\xB0, 1.5ms=90\xB0, 2ms=180\xB0)" },
      { id: "vcc", label: "VCC (Red)", kind: "power", aliases: ["5v", "power"], role: "5V Power Supply" },
      { id: "gnd", label: "GND (Brown/Black)", kind: "ground", aliases: ["ground"], role: "System Ground Reference" }
    ],
    properties: [
      { key: "angle", type: "number", defaultValue: 90, description: "Current horn angle in degrees (0 to 180)" }
    ],
    codeInterface: {
      cppLibraries: ["<Servo.h>"],
      blocklyBlockTypes: ["servo_write", "actuator_servo_write"],
      standardPinModes: { "sig": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "servo-signal-gpio", type: "mandatory", description: "Signal pin must connect to a valid digital GPIO. The standard Arduino Servo library generates timer-based control pulses and does not require hardware PWM; D9/D10 are examples, not mandatory pins." },
      { ruleId: "servo-vcc-5v", type: "mandatory", description: "VCC must connect to 5V (not 3.3V) for sufficient motor torque." }
    ],
    trainingKeywords: ["servo", "motor", "robotic arm", "barrier gate", "lock", "vault", "steering", "angle"],
    standardTopologies: ["barrier gate control", "smart door lock actuator", "gauge meter pointer"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "pos", label: "Positive (+)", kind: "power", aliases: ["+", "sig", "p"], role: "Positive tone signal input" },
      { id: "neg", label: "Negative (-)", kind: "ground", aliases: ["-", "gnd"], role: "Ground return (0V)" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tone_play", "tone_stop", "io_tone", "io_notone"],
      standardPinModes: { "pos": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "buzzer-pos-to-pin", type: "mandatory", description: "Positive pin connects to digital output pin (e.g. D8, D11); negative connects to GND." }
    ],
    trainingKeywords: ["buzzer", "piezo", "chime", "alarm", "speaker", "audio alert", "siren"],
    standardTopologies: ["audio alert siren", "confirmation chime", "doorbell chime"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "pos", label: "M+ (Terminal 1)", kind: "passive", aliases: ["t1", "lead1"], role: "Motor coil terminal" },
      { id: "neg", label: "M- (Terminal 2)", kind: "passive", aliases: ["t2", "lead2"], role: "Motor coil terminal" }
    ],
    properties: [
      { key: "rpm", type: "number", defaultValue: 0, description: "Rotational speed in revolutions per minute" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write", "io_analogwrite"]
    },
    wiringRules: [
      { ruleId: "dc-motor-driver-required", type: "mandatory", description: "Do NOT connect DC motor directly to Arduino GPIO pins. Must use transistor, relay, or L298N driver." }
    ],
    trainingKeywords: ["dc motor", "fan", "propeller", "wheel", "motor", "rotational power"],
    standardTopologies: ["transistor-switched fan", "l298n h-bridge dual drive"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Relay coil 5V power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "in", label: "IN", kind: "passive", aliases: ["sig", "control"], role: "Digital control signal from Arduino (e.g. D8)" },
      { id: "com", label: "COM", kind: "passive", aliases: ["common"], role: "Common switch terminal" },
      { id: "no", label: "NO", kind: "passive", aliases: ["normally_open"], role: "Normally-Open contact (closes when IN is HIGH)" },
      { id: "nc", label: "NC", kind: "passive", aliases: ["normally_closed"], role: "Normally-Closed contact (opens when IN is HIGH)" }
    ],
    properties: [
      { key: "closed", type: "boolean", defaultValue: false, description: "State of the NO contact" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"],
      standardPinModes: { "in": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "relay-coil-power", type: "mandatory", description: "VCC connects to 5V, GND to GND, and IN to digital control pin." }
    ],
    trainingKeywords: ["relay", "switch", "high voltage", "home automation", "smart plug", "ac switch"],
    standardTopologies: ["home automation high power switch: Battery -> COM, NO -> Load -> Battery GND"]
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
      maxCurrentMa: 2e3,
      polaritySensitive: true
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
      { id: "out4", label: "OUT4", kind: "passive", aliases: ["motor_b_2"], role: "Motor B Output Terminal 2" }
    ],
    properties: [
      { key: "speedA", type: "number", defaultValue: 0, description: "Motor A PWM Speed (0-255)" },
      { key: "speedB", type: "number", defaultValue: 0, description: "Motor B PWM Speed (0-255)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["motor_driver_write"]
    },
    wiringRules: [
      { ruleId: "l298n-common-ground", type: "mandatory", description: "L298N GND must be connected to BOTH battery GND and Arduino GND." }
    ],
    trainingKeywords: ["l298n", "h-bridge", "motor driver", "rover", "robot car", "dual motor"],
    standardTopologies: ["differential steering 2WD robot chassis"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "trig", label: "Trig", kind: "passive", aliases: ["trigger", "t"], role: "Trigger input pulse (10\xB5s TTL pulse)" },
      { id: "echo", label: "Echo", kind: "passive", aliases: ["e"], role: "Echo output pulse proportional to distance" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" }
    ],
    properties: [
      { key: "distance", type: "number", defaultValue: 100, description: "Simulated target distance in centimeters" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ultrasonic_read"],
      standardPinModes: { "trig": "OUTPUT", "echo": "INPUT" }
    },
    wiringRules: [
      { ruleId: "ultrasonic-5v-required", type: "mandatory", description: "HC-SR04 requires 5V VCC to emit ultrasonic bursts reliably." }
    ],
    trainingKeywords: ["ultrasonic", "sonar", "distance", "hc-sr04", "radar", "proximity", "obstacle detector"],
    standardTopologies: ["obstacle avoidance radar", "smart trash can opener", "distance meter"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "t1", label: "Terminal 1", kind: "passive", aliases: ["1", "a"], role: "Passive resistor lead" },
      { id: "t2", label: "Terminal 2", kind: "passive", aliases: ["2", "b"], role: "Passive resistor lead" }
    ],
    properties: [
      { key: "light", type: "number", defaultValue: 512, description: "Simulated ambient illumination level (0 to 1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ldr_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "ldr-voltage-divider", type: "mandatory", description: "Must be wired in series with a 10k\u03A9 fixed resistor between 5V and GND, tapping junction to A0.", circuitDoctorCheckId: "floating_analog" }
    ],
    trainingKeywords: ["ldr", "photoresistor", "light sensor", "night light", "solar tracker", "ambient light"],
    standardTopologies: ["voltage divider with 10k resistor: 5V -> LDR -> Junction(A0) -> 10k\u03A9 -> GND"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V DC Power Input" },
      { id: "out", label: "OUT", kind: "passive", aliases: ["sig", "data"], role: "Digital output: HIGH when motion detected, LOW when idle" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" }
    ],
    properties: [
      { key: "motion", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Current motion detection state" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["pir_motion", "io_digitalread"],
      standardPinModes: { "out": "INPUT" }
    },
    wiringRules: [
      { ruleId: "pir-out-to-digital", type: "mandatory", description: "OUT pin connects to a digital input pin (e.g. D2, D7)." }
    ],
    trainingKeywords: ["pir", "motion", "burglar alarm", "occupancy", "security", "infrared motion"],
    standardTopologies: ["intruder alarm security station", "automatic room light controller"]
  },
  dht11: {
    type: "dht11",
    name: "DHT11 Temperature & Humidity Sensor",
    category: "sensor",
    blurb: "Single-wire digital climate sensor reading 20-90% relative humidity and 0-50\xB0C temperature.",
    dimensions: { width: 72, height: 66 },
    electrical: {
      operatingVoltage: "3.3V - 5V DC",
      logicLevel: "universal",
      maxCurrentMa: 2.5,
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "Power supply" },
      { id: "data", label: "DATA", kind: "digital", aliases: ["out", "sig"], role: "Single-bus bidirectional serial data line" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Ambient temperature in \xB0C" },
      { key: "humidity", type: "number", defaultValue: 55, description: "Relative humidity in %" }
    ],
    codeInterface: {
      cppLibraries: ["<DHT.h>"],
      blocklyBlockTypes: ["dht_temperature", "dht_humidity"]
    },
    wiringRules: [
      { ruleId: "dht-data-pin", type: "mandatory", description: "DATA pin connects to a digital pin (e.g. D2, D4)." }
    ],
    trainingKeywords: ["dht11", "temperature", "humidity", "weather station", "climate", "thermostat"],
    standardTopologies: ["smart weather station with lcd", "greenhouse automated climate monitor"]
  },
  tmp36: {
    type: "tmp36",
    name: "TMP36 Precision Temperature Sensor",
    category: "sensor",
    blurb: "Linear analog temperature sensor outputting 10 mV/\xB0C with a 500 mV offset at 0\xB0C (-40\xB0C to +125\xB0C).",
    dimensions: { width: 40, height: 50 },
    electrical: {
      operatingVoltage: "2.7V - 5.5V DC",
      logicLevel: "universal",
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "VOUT", kind: "passive", aliases: ["vout", "analog"], role: "Analog voltage proportional to temperature" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "temperature", type: "number", defaultValue: 25, description: "Simulated temperature in \xB0C" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["tmp36_temperature", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "tmp36-out-to-adc", type: "mandatory", description: "VOUT must connect to an Analog ADC pin (e.g. A0, A1)." }
    ],
    trainingKeywords: ["tmp36", "temperature sensor", "thermometer", "analog temp", "heat sensor"],
    standardTopologies: ["analog thermometer with led indicator bar"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Heater & Circuit Power" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "System Ground" },
      { id: "do", label: "DO (Digital Out)", kind: "digital", aliases: ["d0"], role: "Threshold comparator digital alert" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0"], role: "Analog gas concentration output" }
    ],
    properties: [
      { key: "gasLevel", type: "number", defaultValue: 150, description: "Gas concentration level in PPM" },
      { key: "threshold", type: "number", defaultValue: 350, description: "Alert trigger threshold" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["mq2_gas_read", "io_analogread", "io_digitalread"]
    },
    wiringRules: [
      { ruleId: "mq2-5v-required", type: "mandatory", description: "MQ-2 internal tin dioxide sensor heater requires 5V supply." }
    ],
    trainingKeywords: ["mq2", "gas sensor", "smoke detector", "fire alarm", "pollution", "lpg leak"],
    standardTopologies: ["kitchen safety smoke alarm with buzzer and led"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Probe Power" },
      { id: "ao", label: "AO (Analog Out)", kind: "analog", aliases: ["a0", "sig"], role: "Analog moisture signal (high when dry, low when wet)" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "moisture", type: "number", defaultValue: 620, description: "ADC reading (0-1023)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["soil_moisture_read", "io_analogread"]
    },
    wiringRules: [
      { ruleId: "soil-ao-to-adc", type: "mandatory", description: "AO connects to an Analog ADC pin (e.g. A0, A2)." }
    ],
    trainingKeywords: ["soil moisture", "hygrometer", "plant watering", "smart agriculture", "irrigation"],
    standardTopologies: ["automated plant watering system with servo valve"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "out", label: "OUT", kind: "digital", aliases: ["sig"], role: "Active-low digital output when obstacle reflected" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" }
    ],
    properties: [
      { key: "detected", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "Reflection detected status" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["ir_read", "io_digitalread"]
    },
    wiringRules: [
      { ruleId: "ir-out-to-digital", type: "mandatory", description: "OUT connects to digital input pin." }
    ],
    trainingKeywords: ["ir sensor", "infrared", "line tracker", "obstacle detector", "proximity"],
    standardTopologies: ["conveyor belt counter", "line-following robot sensor"]
  },
  joystick: {
    type: "joystick",
    name: "Dual-Axis Thumbstick & Switch",
    category: "sensor",
    blurb: "Two orthogonal 10k\u03A9 potentiometers for X and Y analog deflection plus integrated tactile push switch.",
    dimensions: { width: 86, height: 86 },
    electrical: {
      operatingVoltage: "5V DC",
      logicLevel: "5V",
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Common ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V reference power" },
      { id: "vrx", label: "VRx", kind: "analog", aliases: ["x"], role: "Horizontal X-axis analog output (A0)" },
      { id: "vry", label: "VRy", kind: "analog", aliases: ["y"], role: "Vertical Y-axis analog output (A1)" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push-button digital switch (D2)" }
    ],
    properties: [
      { key: "x", type: "number", defaultValue: 512, description: "X-axis position (0 to 1023)" },
      { key: "y", type: "number", defaultValue: 512, description: "Y-axis position (0 to 1023)" },
      { key: "pressed", type: "string", defaultValue: "false", allowedValues: ["true", "false"], description: "SW switch state" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["joystick_x", "joystick_y", "joystick_button"]
    },
    wiringRules: [
      { ruleId: "joystick-adc-pair", type: "mandatory", description: "VRx and VRy must connect to two separate Analog pins (A0, A1)." }
    ],
    trainingKeywords: ["joystick", "thumbstick", "gamepad", "pan tilt", "steer", "controller"],
    standardTopologies: ["rover drive controller", "pan-tilt camera mount"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "Power supply" },
      { id: "clk", label: "CLK (A)", kind: "digital", aliases: ["a"], role: "Channel A pulse output" },
      { id: "dt", label: "DT (B)", kind: "digital", aliases: ["b"], role: "Channel B quadrature phase output" },
      { id: "sw", label: "SW", kind: "digital", aliases: ["btn"], role: "Push switch" }
    ],
    properties: [
      { key: "value", type: "number", defaultValue: 0, description: "Current relative step counter" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["encoder_read"]
    },
    wiringRules: [
      { ruleId: "encoder-interrupt-recommended", type: "recommended", description: "Connect CLK to interrupt pin D2 or D3 for zero-miss step tracking." }
    ],
    trainingKeywords: ["encoder", "rotary encoder", "scroll wheel", "menu selector", "dial"],
    standardTopologies: ["digital menu navigation", "precision motor step odometer"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "r1", label: "Row 1", kind: "digital", aliases: ["row1"], role: "Row 1 scan line (keys 1, 2, 3, A) -> D2" },
      { id: "r2", label: "Row 2", kind: "digital", aliases: ["row2"], role: "Row 2 scan line (keys 4, 5, 6, B) -> D3" },
      { id: "r3", label: "Row 3", kind: "digital", aliases: ["row3"], role: "Row 3 scan line (keys 7, 8, 9, C) -> D4" },
      { id: "r4", label: "Row 4", kind: "digital", aliases: ["row4"], role: "Row 4 scan line (keys CLR, 0, OK, D) -> D5" },
      { id: "c1", label: "Col 1", kind: "digital", aliases: ["col1"], role: "Col 1 scan line -> D6" },
      { id: "c2", label: "Col 2", kind: "digital", aliases: ["col2"], role: "Col 2 scan line -> D7" },
      { id: "c3", label: "Col 3", kind: "digital", aliases: ["col3"], role: "Col 3 scan line -> D8" },
      { id: "c4", label: "Col 4", kind: "digital", aliases: ["col4"], role: "Col 4 scan line -> D9" }
    ],
    properties: [
      { key: "lastKey", type: "string", defaultValue: "", description: "Submitted key or PIN string upon pressing OK" },
      { key: "enteredPin", type: "string", defaultValue: "", description: "Uncommitted live typing buffer" }
    ],
    codeInterface: {
      cppLibraries: ["<Keypad.h>"],
      blocklyBlockTypes: ["keypad_read", "keypad_check_pin", "keypad_clear_pin"]
    },
    wiringRules: [
      { ruleId: "keypad-pin-sequence", type: "mandatory", description: "Rows connect to D2-D5 sequentially; Cols connect to D6-D9 sequentially." }
    ],
    trainingKeywords: ["keypad", "pin entry", "password", "matrix keypad", "access control", "safe lock", "security"],
    standardTopologies: ["security safe vault authentication station with servo and lcd"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Power ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "sda", label: "SDA", kind: "passive", aliases: ["data"], role: "I2C Serial Data (Uno: A4, ESP32: GPIO21)" },
      { id: "scl", label: "SCL", kind: "passive", aliases: ["clock"], role: "I2C Serial Clock (Uno: A5, ESP32: GPIO22)" }
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU CYBERLAB", description: "Top 16-character line" },
      { key: "line2", type: "string", defaultValue: "SYSTEM READY", description: "Bottom 16-character line" }
    ],
    codeInterface: {
      cppLibraries: ["<LiquidCrystal_I2C.h>", "<Wire.h>"],
      blocklyBlockTypes: ["lcd_print", "lcd_print_line", "lcd_set_cursor", "lcd_clear"]
    },
    wiringRules: [
      { ruleId: "lcd-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Arduino Uno." },
      { ruleId: "lcd-vcc-5v", type: "mandatory", description: "LCD backlight requires 5V for readable character contrast." }
    ],
    trainingKeywords: ["lcd", "display", "screen", "16x2", "i2c lcd", "text display", "message"],
    standardTopologies: ["dashboard telemetry screen", "passcode prompt display"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "vcc", label: "VCC", kind: "power", aliases: ["5v", "3v3"], role: "3.3V or 5V Power" },
      { id: "scl", label: "SCL", kind: "digital", aliases: ["clock"], role: "I2C Clock line (A5 on Uno)" },
      { id: "sda", label: "SDA", kind: "digital", aliases: ["data"], role: "I2C Data line (A4 on Uno)" }
    ],
    properties: [
      { key: "line1", type: "string", defaultValue: "PIXIU TECH", description: "Header text line" },
      { key: "line2", type: "string", defaultValue: "READY", description: "Primary message line" },
      { key: "line3", type: "string", defaultValue: "", description: "Status footer line" }
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_GFX.h>", "<Adafruit_SSD1306.h>", "<Wire.h>"],
      blocklyBlockTypes: ["oled_print", "oled_clear"]
    },
    wiringRules: [
      { ruleId: "oled-i2c-pins", type: "mandatory", description: "SDA connects to A4 and SCL connects to A5 on Uno." }
    ],
    trainingKeywords: ["oled", "display", "ssd1306", "graphics screen", "0.96 inch"],
    standardTopologies: ["compact wearable HUD display", "telemetry monitor"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "di", label: "DI (Data In)", kind: "digital", aliases: ["din", "data", "in"], role: "800kHz single-wire serial data in (e.g. D6)" },
      { id: "vcc", label: "VCC (5V)", kind: "power", aliases: ["5v"], role: "5V Power Supply" },
      { id: "gnd", label: "GND", kind: "ground", aliases: ["ground"], role: "Ground reference" },
      { id: "do", label: "DO (Data Out)", kind: "digital", aliases: ["dout"], role: "Chaining data out to next NeoPixel module" }
    ],
    properties: [
      { key: "numPixels", type: "number", defaultValue: 8, description: "Total pixel count" },
      { key: "brightness", type: "number", defaultValue: 200, description: "Brightness level (0-255)" },
      { key: "pattern", type: "string", defaultValue: "rainbow", description: "Active animation pattern" },
      { key: "color", type: "string", defaultValue: "#38bdf8", description: "Active hex color" }
    ],
    codeInterface: {
      cppLibraries: ["<Adafruit_NeoPixel.h>"],
      blocklyBlockTypes: ["neopixel_set_color", "neopixel_show"],
      standardPinModes: { "di": "OUTPUT" }
    },
    wiringRules: [
      { ruleId: "neopixel-di-pin", type: "mandatory", description: "DI connects to high-speed digital pin (D6 recommended)." }
    ],
    trainingKeywords: ["neopixel", "ws2812b", "addressable led", "rgb ring", "smart led", "rainbow"],
    standardTopologies: ["mood lighting ring", "audio visualizer ring", "speedometer gauge"]
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
      polaritySensitive: true
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
      { id: "com", label: "Common Cathode", kind: "passive", aliases: ["gnd", "k"], role: "Common Cathode pin -> GND" }
    ],
    properties: [
      { key: "digit", type: "number", defaultValue: 0, description: "Active displayed digit (0-9)" }
    ],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["seven_segment_write", "seven_segment_clear"]
    },
    wiringRules: [
      { ruleId: "seven-seg-pins", type: "mandatory", description: "Segments a-g connect sequentially to digital pins D2 through D8. Common connects to GND." }
    ],
    trainingKeywords: ["7 segment", "seven segment", "counter", "digital display", "scoreboard", "digits"],
    standardTopologies: ["decade counter 0-9", "dice roller", "digital countdown timer"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "red", label: "Red Anode", kind: "passive", aliases: ["r"], role: "Red diode anode via 220\u03A9 resistor (PWM pin D9)" },
      { id: "gnd", label: "Common Cathode (-)", kind: "passive", aliases: ["k", "cathode"], role: "Common negative cathode -> GND" },
      { id: "green", label: "Green Anode", kind: "passive", aliases: ["g"], role: "Green diode anode via 220\u03A9 resistor (PWM pin D10)" },
      { id: "blue", label: "Blue Anode", kind: "passive", aliases: ["b"], role: "Blue diode anode via 220\u03A9 resistor (PWM pin D11)" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_analogwrite", "io_digitalwrite"]
    },
    wiringRules: [
      { ruleId: "rgb-resistors", type: "mandatory", description: "Each color anode (Red, Green, Blue) requires its own 220\u03A9 current-limiting resistor." },
      { ruleId: "rgb-pwm-pins", type: "recommended", description: "Connect to PWM pins (D9, D10, D11) for full 16-million color mixing." }
    ],
    trainingKeywords: ["rgb led", "multi color led", "color mixing", "tricolor led"],
    standardTopologies: ["mood lamp color fader", "traffic light single bulb"]
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
      polaritySensitive: true
    },
    pins: [
      { id: "emitter", label: "Emitter (E)", kind: "passive", aliases: ["e"], role: "Connects to Ground (0V)" },
      { id: "base", label: "Base (B)", kind: "passive", aliases: ["b"], role: "Control terminal. Connects to digital pin via 1k\u03A9 base resistor." },
      { id: "collector", label: "Collector (C)", kind: "passive", aliases: ["c"], role: "Load connection to ground return" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: ["io_digitalwrite"]
    },
    wiringRules: [
      { ruleId: "transistor-base-resistor", type: "mandatory", description: "Must ALWAYS have a 1k\u03A9 resistor between microcontroller digital pin and Base terminal to prevent burning GPIO." }
    ],
    trainingKeywords: ["transistor", "npn", "2n2222", "electronic switch", "amplifier"],
    standardTopologies: ["low-side switch for DC motor or high-power buzzer"]
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
      polaritySensitive: false
    },
    pins: [
      { id: "pos_top", label: "+ Rail (Top)", kind: "power", aliases: ["+top"], role: "Continuous positive 5V power bus" },
      { id: "neg_top", label: "- Rail (Top)", kind: "ground", aliases: ["-top"], role: "Continuous ground 0V bus" },
      { id: "pos_bot", label: "+ Rail (Bottom)", kind: "power", aliases: ["+bot"], role: "Continuous positive 5V power bus" },
      { id: "neg_bot", label: "- Rail (Bottom)", kind: "ground", aliases: ["-bot"], role: "Continuous ground 0V bus" },
      { id: "a1", label: "Row a1", kind: "passive", aliases: [], role: "5-pin tie-point column" }
    ],
    properties: [],
    codeInterface: {
      cppLibraries: [],
      blocklyBlockTypes: []
    },
    wiringRules: [
      { ruleId: "breadboard-rails", type: "recommended", description: "Use top and bottom rails for 5V and GND distribution." }
    ],
    trainingKeywords: ["breadboard", "prototyping", "solderless", "tie points"],
    standardTopologies: ["central wiring breadboard bus"]
  }
};

// src/lib/board-registry.ts
var ARDUINO_W = 320;
var ARDUINO_H = 200;
function distributePins(labels, left, right, y) {
  const n = labels.length;
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind,
      capabilities: l.caps,
      alternateNames: l.alt
    };
  });
}
var unoTopPins = distributePins(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground", alt: ["gnd_top"] },
    { label: "D13", kind: "digital", caps: { builtInLed: true }, alt: ["13"] },
    { label: "D12", kind: "digital", alt: ["12"] },
    { label: "D11", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["11"] },
    { label: "D10", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["10"] },
    { label: "D9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
    { label: "D8", kind: "digital", alt: ["8"] },
    { label: "D7", kind: "digital", alt: ["7"] },
    { label: "D6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
    { label: "D5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
    { label: "D4", kind: "digital", alt: ["4"] },
    { label: "D3", kind: "digital", caps: { pwm: true }, alt: ["3"] },
    { label: "D2", kind: "digital", alt: ["2"] },
    { label: "D1", kind: "digital", caps: { uartRole: "tx" }, alt: ["1", "tx"] },
    { label: "D0", kind: "digital", caps: { uartRole: "rx" }, alt: ["0", "rx"] }
  ],
  22,
  ARDUINO_W - 22,
  8
);
var unoBottomPins = distributePins(
  [
    { label: "5V", kind: "power", alt: ["v5", "5v_pwr"] },
    { label: "3V3", kind: "power", alt: ["3.3v", "v33"] },
    { label: "RST", kind: "digital", alt: ["reset"] },
    { label: "VIN", kind: "power", alt: ["vin_pwr"] },
    { label: "GND", kind: "ground", alt: ["gnd_bot"] },
    { label: "A0", kind: "analog", caps: { adc: true }, alt: ["0"] },
    { label: "A1", kind: "analog", caps: { adc: true }, alt: ["1"] },
    { label: "A2", kind: "analog", caps: { adc: true }, alt: ["2"] },
    { label: "A3", kind: "analog", caps: { adc: true }, alt: ["3"] },
    { label: "A4", kind: "analog", caps: { adc: true, i2cRole: "sda" }, alt: ["sda", "4"] },
    { label: "A5", kind: "analog", caps: { adc: true, i2cRole: "scl" }, alt: ["scl", "5"] }
  ],
  40,
  ARDUINO_W - 40,
  ARDUINO_H - 8
).map((p) => p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p);
var ARDUINO_UNO_BOARD = {
  id: "arduino-uno",
  partType: "arduino-uno",
  name: "Arduino Uno R3",
  shortName: "Uno",
  mcu: "ATmega328P",
  family: "avr",
  blurb: "Industry-standard 8-bit AVR microcontroller board (5V Logic, 16MHz)",
  width: ARDUINO_W,
  height: ARDUINO_H,
  logicVoltage: 5,
  supplyVoltages: [5, 3.3],
  adcResolutionBits: 10,
  // 0..1023
  adcMaxVoltage: 5,
  pwmResolutionBits: 8,
  // 0..255
  pwmFrequencyDefaultHz: 490,
  maxGpioCurrentMa: 20,
  clockSpeedMhz: 16,
  flashSizeKb: 32,
  ramSizeKb: 2,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: false,
    supportsCpp: true
  },
  pins: [...unoTopPins, ...unoBottomPins],
  powerPins: {
    v5: ["5v"],
    v33: ["3v3"],
    gnd: ["gnd", "gnd_pwr"],
    vin: ["vin"]
  },
  builtInLedPin: "d13",
  i2cPins: { sda: "a4", scl: "a5" },
  serialPins: { rx: "d0", tx: "d1" },
  documentationUrl: "https://docs.arduino.cc/hardware/uno-rev3",
  visualColors: {
    pcbColor: "#008184",
    accentColor: "#00979d"
  }
};
var ESP32_W = 240;
var ESP32_H = 370;
var esp32LeftSpecs = [
  { id: "en", label: "EN", kind: "digital", alt: ["rst", "reset"] },
  { id: "vp", label: "VP", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio36", "36", "adc1_0"] },
  { id: "vn", label: "VN", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio39", "39", "adc1_3"] },
  { id: "d34", label: "D34", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio34", "34"] },
  { id: "d35", label: "D35", kind: "analog", caps: { adc: true, inputOnly: true }, alt: ["gpio35", "35"] },
  { id: "d32", label: "D32", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio32", "32"] },
  { id: "d33", label: "D33", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio33", "33"] },
  { id: "d25", label: "D25", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio25", "25", "dac1"] },
  { id: "d26", label: "D26", kind: "digital", caps: { adc: true, dac: true, pwm: true }, alt: ["gpio26", "26", "dac2"] },
  { id: "d27", label: "D27", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio27", "27"] },
  { id: "d14", label: "D14", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "sck" }, alt: ["gpio14", "14"] },
  { id: "d12", label: "D12", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "miso" }, alt: ["gpio12", "12"] },
  { id: "d13", label: "D13", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "mosi" }, alt: ["gpio13", "13"] },
  { id: "gnd_l", label: "GND", kind: "ground", alt: ["gnd", "gnd1"] },
  { id: "vin", label: "VIN", kind: "power", alt: ["5v", "v5"] }
];
var esp32RightSpecs = [
  { id: "d23", label: "D23", kind: "digital", caps: { pwm: true, spiRole: "mosi" }, alt: ["gpio23", "23"] },
  { id: "d22", label: "D22", kind: "digital", caps: { pwm: true, i2cRole: "scl" }, alt: ["gpio22", "22", "scl"] },
  { id: "tx0", label: "TX0", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio1", "1", "tx"] },
  { id: "rx0", label: "RX0", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio3", "3", "rx"] },
  { id: "d21", label: "D21", kind: "digital", caps: { pwm: true, i2cRole: "sda" }, alt: ["gpio21", "21", "sda"] },
  { id: "d19", label: "D19", kind: "digital", caps: { pwm: true, spiRole: "miso" }, alt: ["gpio19", "19"] },
  { id: "d18", label: "D18", kind: "digital", caps: { pwm: true, spiRole: "sck" }, alt: ["gpio18", "18"] },
  { id: "d5", label: "D5", kind: "digital", caps: { pwm: true, spiRole: "ss" }, alt: ["gpio5", "5"] },
  { id: "tx2", label: "TX2", kind: "digital", caps: { uartRole: "tx" }, alt: ["gpio17", "17"] },
  { id: "rx2", label: "RX2", kind: "digital", caps: { uartRole: "rx" }, alt: ["gpio16", "16"] },
  { id: "d4", label: "D4", kind: "digital", caps: { adc: true, touch: true, pwm: true }, alt: ["gpio4", "4"] },
  { id: "d2", label: "D2", kind: "digital", caps: { adc: true, touch: true, pwm: true, builtInLed: true }, alt: ["gpio2", "2", "led"] },
  { id: "d15", label: "D15", kind: "digital", caps: { adc: true, touch: true, pwm: true, spiRole: "ss" }, alt: ["gpio15", "15"] },
  { id: "gnd_r", label: "GND", kind: "ground", alt: ["gnd", "gnd2"] },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v", "v33"] }
];
var esp32Pins = [
  ...esp32LeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  })),
  ...esp32RightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: ESP32_W - 12,
    y: Math.round(35 + i * 22),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  }))
];
var ESP32_DEVKIT_BOARD = {
  id: "esp32-devkit",
  partType: "esp32-devkit",
  name: "ESP32 DevKit V1",
  shortName: "ESP32",
  mcu: "ESP32-D0WDQ6",
  family: "xtensa",
  blurb: "Dual-Core 240MHz 32-bit MCU with WiFi, Bluetooth BLE, 2x DAC & 10x Touch (3.3V Logic)",
  width: ESP32_W,
  height: ESP32_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5],
  adcResolutionBits: 12,
  // 0..4095
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8,
  // 0..255 (expandable to 16)
  pwmFrequencyDefaultHz: 5e3,
  maxGpioCurrentMa: 12,
  // ESP32 recommended max 12mA per GPIO
  clockSpeedMhz: 240,
  flashSizeKb: 4096,
  ramSizeKb: 520,
  capabilities: {
    hasWifi: true,
    hasBluetooth: true,
    hasBle: true,
    hasDac: true,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: esp32Pins,
  powerPins: {
    v33: ["3v3"],
    gnd: ["gnd_l", "gnd_r"],
    vin: ["vin"]
  },
  builtInLedPin: "d2",
  i2cPins: { sda: "d21", scl: "d22" },
  serialPins: { rx: "rx0", tx: "tx0" },
  documentationUrl: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html",
  visualColors: {
    pcbColor: "#121316",
    accentColor: "#06b6d4"
  }
};
var PICO_W = 220;
var PICO_H = 380;
var picoLeftSpecs = [
  { id: "gp0", label: "GP0", kind: "digital", caps: { uartRole: "tx", i2cRole: "sda", pwm: true }, alt: ["0"] },
  { id: "gp1", label: "GP1", kind: "digital", caps: { uartRole: "rx", i2cRole: "scl", pwm: true }, alt: ["1"] },
  { id: "gnd_1", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp2", label: "GP2", kind: "digital", caps: { i2cRole: "sda", pwm: true }, alt: ["2"] },
  { id: "gp3", label: "GP3", kind: "digital", caps: { i2cRole: "scl", pwm: true }, alt: ["3"] },
  { id: "gp4", label: "GP4", kind: "digital", caps: { pwm: true }, alt: ["4"] },
  { id: "gp5", label: "GP5", kind: "digital", caps: { pwm: true }, alt: ["5"] },
  { id: "gnd_2", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp6", label: "GP6", kind: "digital", caps: { pwm: true }, alt: ["6"] },
  { id: "gp7", label: "GP7", kind: "digital", caps: { pwm: true }, alt: ["7"] },
  { id: "gp8", label: "GP8", kind: "digital", caps: { pwm: true }, alt: ["8"] },
  { id: "gp9", label: "GP9", kind: "digital", caps: { pwm: true }, alt: ["9"] },
  { id: "gnd_3", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp10", label: "GP10", kind: "digital", caps: { pwm: true }, alt: ["10"] },
  { id: "gp11", label: "GP11", kind: "digital", caps: { pwm: true }, alt: ["11"] },
  { id: "gp12", label: "GP12", kind: "digital", caps: { pwm: true }, alt: ["12"] },
  { id: "gp13", label: "GP13", kind: "digital", caps: { pwm: true }, alt: ["13"] },
  { id: "gnd_4", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp14", label: "GP14", kind: "digital", caps: { pwm: true }, alt: ["14"] },
  { id: "gp15", label: "GP15", kind: "digital", caps: { pwm: true }, alt: ["15"] }
];
var picoRightSpecs = [
  { id: "vbus", label: "VBUS", kind: "power", alt: ["5v", "vin"] },
  { id: "vsys", label: "VSYS", kind: "power" },
  { id: "gnd_8", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "3v3_en", label: "3V3_EN", kind: "digital" },
  { id: "3v3", label: "3V3", kind: "power", alt: ["3.3v"] },
  { id: "adc_vref", label: "ADC_VREF", kind: "power" },
  { id: "gp28", label: "GP28", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc2", "28"] },
  { id: "gnd_7", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp27", label: "GP27", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc1", "27"] },
  { id: "gp26", label: "GP26", kind: "analog", caps: { adc: true, pwm: true }, alt: ["adc0", "26"] },
  { id: "run", label: "RUN", kind: "digital", alt: ["rst"] },
  { id: "gp22", label: "GP22", kind: "digital", caps: { pwm: true }, alt: ["22"] },
  { id: "gnd_6", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp21", label: "GP21", kind: "digital", caps: { pwm: true }, alt: ["21"] },
  { id: "gp20", label: "GP20", kind: "digital", caps: { pwm: true }, alt: ["20"] },
  { id: "gp19", label: "GP19", kind: "digital", caps: { pwm: true }, alt: ["19"] },
  { id: "gp18", label: "GP18", kind: "digital", caps: { pwm: true }, alt: ["18"] },
  { id: "gnd_5", label: "GND", kind: "ground", alt: ["gnd"] },
  { id: "gp17", label: "GP17", kind: "digital", caps: { pwm: true }, alt: ["17"] },
  { id: "gp16", label: "GP16", kind: "digital", caps: { pwm: true }, alt: ["16"] }
];
var picoPins = [
  ...picoLeftSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  })),
  ...picoRightSpecs.map((spec, i) => ({
    id: spec.id,
    label: spec.label,
    x: PICO_W - 12,
    y: Math.round(25 + i * 17.5),
    kind: spec.kind,
    capabilities: spec.caps,
    alternateNames: spec.alt
  }))
];
var RPI_PICO_BOARD = {
  id: "rpi-pico",
  partType: "rpi-pico",
  name: "Raspberry Pi Pico",
  shortName: "Pico",
  mcu: "RP2040",
  family: "arm",
  blurb: "Dual ARM Cortex-M0+ @ 133MHz with 12-bit ADC & MicroPython support (3.3V Logic)",
  width: PICO_W,
  height: PICO_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3, 5],
  adcResolutionBits: 12,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 16,
  pwmFrequencyDefaultHz: 1e3,
  maxGpioCurrentMa: 12,
  clockSpeedMhz: 133,
  flashSizeKb: 2048,
  ramSizeKb: 264,
  capabilities: {
    hasWifi: false,
    hasBluetooth: false,
    hasBle: false,
    hasDac: false,
    hasTouchPins: false,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: picoPins,
  powerPins: {
    v5: ["vbus"],
    v33: ["3v3"],
    gnd: ["gnd_1", "gnd_2", "gnd_3", "gnd_4", "gnd_5", "gnd_6", "gnd_7", "gnd_8"],
    vin: ["vbus", "vsys"]
  },
  builtInLedPin: "gp25",
  i2cPins: { sda: "gp4", scl: "gp5" },
  serialPins: { rx: "gp1", tx: "gp0" },
  documentationUrl: "https://www.raspberrypi.com/documentation/microcontrollers/raspberry-pi-pico.html",
  visualColors: {
    pcbColor: "#059669",
    accentColor: "#10b981"
  }
};
var MICROBIT_W = 320;
var MICROBIT_H = 260;
var microbitPins = [
  { id: "p0", label: "P0", x: 40, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["0"] },
  { id: "p1", label: "P1", x: 100, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["1"] },
  { id: "p2", label: "P2", x: 160, y: MICROBIT_H - 12, kind: "analog", capabilities: { adc: true, touch: true }, alternateNames: ["2"] },
  { id: "3v", label: "3V", x: 220, y: MICROBIT_H - 12, kind: "power", alternateNames: ["3v3", "vcc"] },
  { id: "gnd", label: "GND", x: 280, y: MICROBIT_H - 12, kind: "ground", alternateNames: ["gnd_edge"] }
];
var MICROBIT_V2_BOARD = {
  id: "microbit-v2",
  partType: "microbit-v2",
  name: "BBC micro:bit v2",
  shortName: "micro:bit",
  mcu: "nRF52833",
  family: "arm",
  blurb: "ARM Cortex-M4 @ 64MHz with BLE 5.0, 5x5 LED Matrix, Speaker & Mic (3.3V Logic)",
  width: MICROBIT_W,
  height: MICROBIT_H,
  logicVoltage: 3.3,
  supplyVoltages: [3.3],
  adcResolutionBits: 10,
  adcMaxVoltage: 3.3,
  pwmResolutionBits: 8,
  pwmFrequencyDefaultHz: 50,
  maxGpioCurrentMa: 5,
  clockSpeedMhz: 64,
  flashSizeKb: 512,
  ramSizeKb: 128,
  capabilities: {
    hasWifi: false,
    hasBluetooth: true,
    hasBle: true,
    hasDac: false,
    hasTouchPins: true,
    hasBuiltInLed: true,
    supportsMicroPython: true,
    supportsCpp: true
  },
  pins: microbitPins,
  powerPins: {
    v33: ["3v"],
    gnd: ["gnd"]
  },
  visualColors: {
    pcbColor: "#1e1e24",
    accentColor: "#fbbf24"
  }
};
var BOARD_REGISTRY = {
  "arduino-uno": ARDUINO_UNO_BOARD,
  "esp32-devkit": ESP32_DEVKIT_BOARD,
  "rpi-pico": RPI_PICO_BOARD,
  "microbit-v2": MICROBIT_V2_BOARD
};
var BOARD_TYPE_SET = new Set(Object.keys(BOARD_REGISTRY));
function isBoardPart(type) {
  return BOARD_TYPE_SET.has(type);
}
function getBoardDefinition(idOrType) {
  return BOARD_REGISTRY[idOrType];
}
function getBoardForPart(part) {
  const type = typeof part === "string" ? part : "type" in part ? part.type : "";
  return getBoardDefinition(type);
}

// src/lib/components-catalog.ts
function distribute(labels, left, right, y) {
  const n = labels.length;
  return labels.map((l, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return {
      id: l.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: l.label,
      x: Math.round(left + t * (right - left)),
      y,
      kind: l.kind
    };
  });
}
var ARDUINO_W2 = 320;
var ARDUINO_H2 = 200;
var BREADBOARD_COLUMNS = 20;
var topPins = distribute(
  [
    { label: "AREF", kind: "digital" },
    { label: "GND", kind: "ground" },
    { label: "D13", kind: "digital" },
    { label: "D12", kind: "digital" },
    { label: "D11", kind: "digital" },
    { label: "D10", kind: "digital" },
    { label: "D9", kind: "digital" },
    { label: "D8", kind: "digital" },
    { label: "D7", kind: "digital" },
    { label: "D6", kind: "digital" },
    { label: "D5", kind: "digital" },
    { label: "D4", kind: "digital" },
    { label: "D3", kind: "digital" },
    { label: "D2", kind: "digital" },
    { label: "D1", kind: "digital" },
    { label: "D0", kind: "digital" }
  ],
  22,
  ARDUINO_W2 - 22,
  8
);
var bottomPins = distribute(
  [
    { label: "5V", kind: "power" },
    { label: "3V3", kind: "power" },
    { label: "RST", kind: "digital" },
    { label: "VIN", kind: "power" },
    { label: "GND", kind: "ground" },
    { label: "A0", kind: "analog" },
    { label: "A1", kind: "analog" },
    { label: "A2", kind: "analog" },
    { label: "A3", kind: "analog" },
    { label: "A4", kind: "analog" },
    { label: "A5", kind: "analog" }
  ],
  40,
  ARDUINO_W2 - 40,
  ARDUINO_H2 - 8
).map(
  (p, i) => (
    // disambiguate the two GND ids across headers
    p.id === "gnd" ? { ...p, id: "gnd_pwr" } : p
  )
);
var CATALOG = {
  "arduino-uno": {
    type: "arduino-uno",
    name: "Arduino Uno",
    blurb: "ATmega328P microcontroller board",
    width: ARDUINO_W2,
    height: ARDUINO_H2,
    pins: [...topPins, ...bottomPins]
  },
  "esp32-devkit": {
    type: "esp32-devkit",
    name: ESP32_DEVKIT_BOARD.name,
    blurb: ESP32_DEVKIT_BOARD.blurb,
    width: ESP32_DEVKIT_BOARD.width,
    height: ESP32_DEVKIT_BOARD.height,
    pins: ESP32_DEVKIT_BOARD.pins
  },
  "rpi-pico": {
    type: "rpi-pico",
    name: RPI_PICO_BOARD.name,
    blurb: RPI_PICO_BOARD.blurb,
    width: RPI_PICO_BOARD.width,
    height: RPI_PICO_BOARD.height,
    pins: RPI_PICO_BOARD.pins
  },
  "microbit-v2": {
    type: "microbit-v2",
    name: MICROBIT_V2_BOARD.name,
    blurb: MICROBIT_V2_BOARD.blurb,
    width: MICROBIT_V2_BOARD.width,
    height: MICROBIT_V2_BOARD.height,
    pins: MICROBIT_V2_BOARD.pins
  },
  breadboard: {
    type: "breadboard",
    name: "Breadboard",
    blurb: "Full 20-column solderless prototyping breadboard with bus rails",
    width: 460,
    height: 214,
    pins: (() => {
      const pins = [];
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const x = 40 + (c - 1) * 20;
        pins.push({ id: `pos_t_${c}`, label: `+ rail (col ${c})`, x, y: 16, kind: "power" });
        pins.push({ id: `neg_t_${c}`, label: `- rail (col ${c})`, x, y: 28, kind: "ground" });
        pins.push({ id: `a_${c}`, label: `a${c}`, x, y: 50, kind: "passive" });
        pins.push({ id: `b_${c}`, label: `b${c}`, x, y: 62, kind: "passive" });
        pins.push({ id: `c_${c}`, label: `c${c}`, x, y: 74, kind: "passive" });
        pins.push({ id: `d_${c}`, label: `d${c}`, x, y: 86, kind: "passive" });
        pins.push({ id: `e_${c}`, label: `e${c}`, x, y: 98, kind: "passive" });
        pins.push({ id: `f_${c}`, label: `f${c}`, x, y: 118, kind: "passive" });
        pins.push({ id: `g_${c}`, label: `g${c}`, x, y: 130, kind: "passive" });
        pins.push({ id: `h_${c}`, label: `h${c}`, x, y: 142, kind: "passive" });
        pins.push({ id: `i_${c}`, label: `i${c}`, x, y: 154, kind: "passive" });
        pins.push({ id: `j_${c}`, label: `j${c}`, x, y: 166, kind: "passive" });
        pins.push({ id: `pos_b_${c}`, label: `+ rail (col ${c})`, x, y: 186, kind: "power" });
        pins.push({ id: `neg_b_${c}`, label: `- rail (col ${c})`, x, y: 198, kind: "ground" });
      }
      pins.push({ id: "pos_top", label: "+ rail (top)", x: 40, y: 16, kind: "power" });
      pins.push({ id: "neg_top", label: "- rail (top)", x: 40, y: 28, kind: "ground" });
      pins.push({ id: "pos_bot", label: "+ rail (bot)", x: 40, y: 186, kind: "power" });
      pins.push({ id: "neg_bot", label: "- rail (bot)", x: 40, y: 198, kind: "ground" });
      pins.push({ id: "a1", label: "row A", x: 80, y: 50, kind: "passive" });
      pins.push({ id: "b1", label: "row B", x: 140, y: 50, kind: "passive" });
      pins.push({ id: "c1", label: "row C", x: 200, y: 50, kind: "passive" });
      pins.push({ id: "d1", label: "row D", x: 260, y: 50, kind: "passive" });
      pins.push({ id: "e1", label: "row E", x: 320, y: 50, kind: "passive" });
      pins.push({ id: "a2", label: "row A", x: 80, y: 118, kind: "passive" });
      pins.push({ id: "b2", label: "row B", x: 140, y: 118, kind: "passive" });
      pins.push({ id: "c2", label: "row C", x: 200, y: 118, kind: "passive" });
      pins.push({ id: "d2", label: "row D", x: 260, y: 118, kind: "passive" });
      pins.push({ id: "e2", label: "row E", x: 320, y: 118, kind: "passive" });
      return pins;
    })()
  },
  led: {
    type: "led",
    name: "LED",
    blurb: "Light-emitting diode",
    width: 44,
    height: 66,
    pins: [
      { id: "anode", label: "Anode (+)", x: 14, y: 62, kind: "passive" },
      { id: "cathode", label: "Cathode (-)", x: 30, y: 62, kind: "passive" }
    ],
    defaults: { color: "red" }
  },
  resistor: {
    type: "resistor",
    name: "Resistor",
    blurb: "Limits current flow",
    width: 88,
    height: 26,
    pins: [
      { id: "a", label: "Terminal 1", x: 3, y: 13, kind: "passive" },
      { id: "b", label: "Terminal 2", x: 85, y: 13, kind: "passive" }
    ],
    defaults: { resistance: 220 }
  },
  pushbutton: {
    type: "pushbutton",
    name: "Pushbutton",
    blurb: "Momentary tactile switch",
    width: 60,
    height: 60,
    pins: [
      { id: "p1a", label: "1a", x: 6, y: 8, kind: "passive" },
      { id: "p2a", label: "2a", x: 54, y: 8, kind: "passive" },
      { id: "p1b", label: "1b", x: 6, y: 52, kind: "passive" },
      { id: "p2b", label: "2b", x: 54, y: 52, kind: "passive" }
    ]
  },
  battery: {
    type: "battery",
    name: "Battery",
    blurb: "DC power source",
    width: 62,
    height: 92,
    pins: [
      { id: "pos", label: "+", x: 20, y: 88, kind: "power" },
      { id: "neg", label: "-", x: 42, y: 88, kind: "ground" }
    ],
    defaults: { voltage: 9 }
  },
  potentiometer: {
    type: "potentiometer",
    name: "Potentiometer",
    blurb: "Variable resistor / knob",
    width: 64,
    height: 64,
    pins: [
      { id: "t1", label: "Terminal 1", x: 12, y: 60, kind: "passive" },
      { id: "wiper", label: "Wiper", x: 32, y: 60, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 52, y: 60, kind: "passive" }
    ],
    defaults: { value: 512, resistance: 1e4 }
  },
  servo: {
    type: "servo",
    name: "Servo Motor",
    blurb: "Positional rotation motor",
    width: 100,
    height: 70,
    pins: [
      { id: "sig", label: "Signal", x: 4, y: 18, kind: "digital" },
      { id: "vcc", label: "VCC", x: 4, y: 35, kind: "power" },
      { id: "gnd", label: "GND", x: 4, y: 52, kind: "ground" }
    ],
    defaults: { angle: 90 }
  },
  buzzer: {
    type: "buzzer",
    name: "Piezo Buzzer",
    blurb: "Produces tones",
    width: 56,
    height: 56,
    pins: [
      { id: "pos", label: "+", x: 20, y: 52, kind: "power" },
      { id: "neg", label: "-", x: 36, y: 52, kind: "ground" }
    ]
  },
  "rgb-led": {
    type: "rgb-led",
    name: "RGB LED",
    blurb: "Common-cathode RGB light-emitting diode",
    width: 50,
    height: 70,
    pins: [
      { id: "red", label: "Red", x: 8, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 18, y: 66, kind: "passive" },
      { id: "green", label: "Green", x: 28, y: 66, kind: "passive" },
      { id: "blue", label: "Blue", x: 38, y: 66, kind: "passive" }
    ]
  },
  "seven-segment": {
    type: "seven-segment",
    name: "7-Segment Display",
    blurb: "Single digit numeric display",
    width: 60,
    height: 80,
    pins: [
      { id: "a", label: "Seg A", x: 5, y: 76, kind: "passive" },
      { id: "b", label: "Seg B", x: 15, y: 76, kind: "passive" },
      { id: "c", label: "Seg C", x: 25, y: 76, kind: "passive" },
      { id: "d", label: "Seg D", x: 35, y: 76, kind: "passive" },
      { id: "e", label: "Seg E", x: 5, y: 4, kind: "passive" },
      { id: "f", label: "Seg F", x: 15, y: 4, kind: "passive" },
      { id: "g", label: "Seg G", x: 25, y: 4, kind: "passive" },
      { id: "dp", label: "DP", x: 35, y: 4, kind: "passive" },
      { id: "com", label: "Common", x: 55, y: 40, kind: "passive" }
    ]
  },
  "lcd-i2c": {
    type: "lcd-i2c",
    name: "LCD 16\xD72 (I2C)",
    blurb: "Two-line alphanumeric display with I2C backpack",
    width: 180,
    height: 80,
    pins: [
      { id: "gnd", label: "GND", x: 30, y: 76, kind: "ground" },
      { id: "vcc", label: "VCC", x: 60, y: 76, kind: "power" },
      { id: "sda", label: "SDA", x: 90, y: 76, kind: "passive" },
      { id: "scl", label: "SCL", x: 120, y: 76, kind: "passive" }
    ]
  },
  ultrasonic: {
    type: "ultrasonic",
    name: "Ultrasonic Sensor",
    blurb: "HC-SR04 distance measurement (2-400cm)",
    width: 100,
    height: 56,
    pins: [
      { id: "vcc", label: "VCC", x: 20, y: 52, kind: "power" },
      { id: "trig", label: "Trig", x: 40, y: 52, kind: "passive" },
      { id: "echo", label: "Echo", x: 60, y: 52, kind: "passive" },
      { id: "gnd", label: "GND", x: 80, y: 52, kind: "ground" }
    ]
  },
  "pir-sensor": {
    type: "pir-sensor",
    name: "PIR Motion Sensor",
    blurb: "Passive infrared motion detector",
    width: 60,
    height: 70,
    pins: [
      { id: "vcc", label: "VCC", x: 10, y: 66, kind: "power" },
      { id: "out", label: "OUT", x: 30, y: 66, kind: "passive" },
      { id: "gnd", label: "GND", x: 50, y: 66, kind: "ground" }
    ]
  },
  ldr: {
    type: "ldr",
    name: "Photoresistor (LDR)",
    blurb: "Light-dependent resistor for light sensing",
    width: 40,
    height: 50,
    pins: [
      { id: "t1", label: "Terminal 1", x: 10, y: 46, kind: "passive" },
      { id: "t2", label: "Terminal 2", x: 30, y: 46, kind: "passive" }
    ]
  },
  tmp36: {
    type: "tmp36",
    name: "Temperature Sensor",
    blurb: "TMP36 analog temperature sensor (-40 to 125\xB0C)",
    width: 40,
    height: 50,
    pins: [
      { id: "vcc", label: "VCC", x: 6, y: 46, kind: "power" },
      { id: "out", label: "Vout", x: 20, y: 46, kind: "passive" },
      { id: "gnd", label: "GND", x: 34, y: 46, kind: "ground" }
    ]
  },
  "dc-motor": {
    type: "dc-motor",
    name: "DC Motor",
    blurb: "Small brushed DC motor",
    width: 108,
    height: 72,
    pins: [
      { id: "pos", label: "M+", x: 34, y: 68, kind: "passive" },
      { id: "neg", label: "M-", x: 76, y: 68, kind: "passive" }
    ]
  },
  "npn-transistor": {
    type: "npn-transistor",
    name: "NPN Transistor",
    blurb: "2N2222 general-purpose NPN switching transistor",
    width: 40,
    height: 56,
    pins: [
      { id: "emitter", label: "Emitter (E)", x: 8, y: 52, kind: "passive" },
      { id: "base", label: "Base (B)", x: 20, y: 52, kind: "passive" },
      { id: "collector", label: "Collector (C)", x: 32, y: 52, kind: "passive" }
    ]
  },
  relay: {
    type: "relay",
    name: "Relay Module",
    blurb: "5V single-channel relay for high-voltage switching",
    width: 112,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 28, y: 80, kind: "power" },
      { id: "gnd", label: "GND", x: 56, y: 80, kind: "ground" },
      { id: "in", label: "IN", x: 84, y: 80, kind: "passive" },
      { id: "com", label: "COM", x: 72, y: 4, kind: "passive" },
      { id: "no", label: "NO", x: 86, y: 4, kind: "passive" },
      { id: "nc", label: "NC", x: 100, y: 4, kind: "passive" }
    ]
  },
  "ir-sensor": {
    type: "ir-sensor",
    name: "IR Obstacle Sensor",
    blurb: "Digital infrared obstacle / line sensor",
    width: 76,
    height: 64,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 60, kind: "power" },
      { id: "out", label: "OUT", x: 38, y: 60, kind: "digital" },
      { id: "gnd", label: "GND", x: 64, y: 60, kind: "ground" }
    ],
    defaults: { detected: "false" }
  },
  "dht11": {
    type: "dht11",
    name: "DHT11 Climate Sensor",
    blurb: "Temperature + humidity digital sensor",
    width: 72,
    height: 66,
    pins: [
      { id: "vcc", label: "VCC", x: 12, y: 62, kind: "power" },
      { id: "data", label: "DATA", x: 36, y: 62, kind: "digital" },
      { id: "gnd", label: "GND", x: 60, y: 62, kind: "ground" }
    ],
    defaults: { temperature: 25, humidity: 55 }
  },
  "oled-i2c": {
    type: "oled-i2c",
    name: "OLED 0.96\u2033 I2C",
    blurb: "128\xD764 monochrome I2C display",
    width: 150,
    height: 92,
    pins: [
      { id: "gnd", label: "GND", x: 28, y: 88, kind: "ground" },
      { id: "vcc", label: "VCC", x: 58, y: 88, kind: "power" },
      { id: "scl", label: "SCL", x: 88, y: 88, kind: "digital" },
      { id: "sda", label: "SDA", x: 118, y: 88, kind: "digital" }
    ],
    defaults: { line1: "PIXIU TECH", line2: "READY", line3: "" }
  },
  "joystick": {
    type: "joystick",
    name: "2-Axis Joystick",
    blurb: "X/Y analog control + push button",
    width: 86,
    height: 86,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 82, kind: "ground" },
      { id: "vcc", label: "VCC", x: 28, y: 82, kind: "power" },
      { id: "vrx", label: "VRx", x: 46, y: 82, kind: "analog" },
      { id: "vry", label: "VRy", x: 64, y: 82, kind: "analog" },
      { id: "sw", label: "SW", x: 78, y: 82, kind: "digital" }
    ],
    defaults: { x: 512, y: 512, pressed: "false" }
  },
  "l298n": {
    type: "l298n",
    name: "L298N Motor Driver",
    blurb: "Dual H-bridge for two DC motors",
    width: 150,
    height: 112,
    pins: [
      { id: "vs", label: "VMotor", x: 24, y: 8, kind: "power" },
      { id: "gnd", label: "GND", x: 48, y: 8, kind: "ground" },
      { id: "5v", label: "5V", x: 72, y: 8, kind: "power" },
      { id: "ena", label: "ENA", x: 30, y: 104, kind: "digital" },
      { id: "in1", label: "IN1", x: 46, y: 104, kind: "digital" },
      { id: "in2", label: "IN2", x: 62, y: 104, kind: "digital" },
      { id: "out1", label: "OUT1", x: 8, y: 39, kind: "passive" },
      { id: "out2", label: "OUT2", x: 8, y: 66, kind: "passive" },
      { id: "out3", label: "OUT3", x: 142, y: 39, kind: "passive" },
      { id: "out4", label: "OUT4", x: 142, y: 66, kind: "passive" },
      { id: "enb", label: "ENB", x: 110, y: 104, kind: "digital" },
      { id: "in3", label: "IN3", x: 78, y: 104, kind: "digital" },
      { id: "in4", label: "IN4", x: 94, y: 104, kind: "digital" }
    ],
    defaults: { speedA: 0, speedB: 0 }
  },
  "rotary-encoder": {
    type: "rotary-encoder",
    name: "Rotary Encoder",
    blurb: "Incremental dial with push switch",
    width: 74,
    height: 82,
    pins: [
      { id: "gnd", label: "GND", x: 10, y: 78, kind: "ground" },
      { id: "vcc", label: "VCC", x: 25, y: 78, kind: "power" },
      { id: "clk", label: "CLK", x: 40, y: 78, kind: "digital" },
      { id: "dt", label: "DT", x: 55, y: 78, kind: "digital" },
      { id: "sw", label: "SW", x: 68, y: 78, kind: "digital" }
    ],
    defaults: { value: 0, pressed: "false" }
  },
  "soil-moisture": {
    type: "soil-moisture",
    name: "Soil Moisture Sensor",
    blurb: "Analog probe for smart farming projects",
    width: 72,
    height: 84,
    pins: [
      { id: "vcc", label: "VCC", x: 14, y: 80, kind: "power" },
      { id: "ao", label: "AO", x: 36, y: 80, kind: "analog" },
      { id: "gnd", label: "GND", x: 58, y: 80, kind: "ground" }
    ],
    defaults: { moisture: 620 }
  },
  "keypad-4x4": {
    type: "keypad-4x4",
    name: "4\xD74 Matrix Keypad",
    blurb: "Sixteen-key matrix input for access and control",
    width: 118,
    height: 120,
    pins: [
      { id: "r1", label: "R1", x: 12, y: 116, kind: "digital" },
      { id: "r2", label: "R2", x: 42, y: 116, kind: "digital" },
      { id: "r3", label: "R3", x: 72, y: 116, kind: "digital" },
      { id: "r4", label: "R4", x: 102, y: 116, kind: "digital" },
      { id: "c1", label: "C1", x: 12, y: 4, kind: "digital" },
      { id: "c2", label: "C2", x: 42, y: 4, kind: "digital" },
      { id: "c3", label: "C3", x: 72, y: 4, kind: "digital" },
      { id: "c4", label: "C4", x: 102, y: 4, kind: "digital" }
    ],
    defaults: { lastKey: "" }
  },
  "neopixel-ring": {
    type: "neopixel-ring",
    name: "NeoPixel RGB Ring (8x)",
    blurb: "Addressable WS2812B 8-LED circular ring module",
    width: 100,
    height: 100,
    pins: [
      { id: "di", label: "DI", x: 22, y: 92, kind: "digital" },
      { id: "vcc", label: "VCC (5V)", x: 40, y: 92, kind: "power" },
      { id: "gnd", label: "GND", x: 60, y: 92, kind: "ground" },
      { id: "do", label: "DO", x: 78, y: 92, kind: "digital" }
    ],
    defaults: { numPixels: 8, brightness: 200, pattern: "rainbow", color: "#38bdf8" }
  },
  "mq2-gas": {
    type: "mq2-gas",
    name: "MQ-2 Gas / Smoke Sensor",
    blurb: "LPG, propane, methane, hydrogen and smoke detection module",
    width: 80,
    height: 90,
    pins: [
      { id: "vcc", label: "VCC", x: 16, y: 84, kind: "power" },
      { id: "gnd", label: "GND", x: 32, y: 84, kind: "ground" },
      { id: "do", label: "DO", x: 48, y: 84, kind: "digital" },
      { id: "ao", label: "AO", x: 64, y: 84, kind: "analog" }
    ],
    defaults: { gasLevel: 150, threshold: 350 }
  }
};

// src/lib/breadboard-pins.ts
function getLegacyBreadboardPinMappings() {
  const mappings = [
    ["pos_top", "pos_t_1"],
    ["neg_top", "neg_t_1"],
    ["pos_bot", "pos_b_1"],
    ["neg_bot", "neg_b_1"]
  ];
  for (const row of ["a", "b", "c", "d", "e"]) {
    const column = (row.charCodeAt(0) - "a".charCodeAt(0) + 1) * 3;
    mappings.push([`${row}1`, `${row}_${column}`]);
    mappings.push([`${row}2`, `${String.fromCharCode(row.charCodeAt(0) + 5)}_${column}`]);
  }
  return mappings;
}

// src/lib/circuit-validator.ts
var PIN_ALIAS_MAP = {
  led: {
    a: "anode",
    pos: "anode",
    "+": "anode",
    p: "anode",
    plus: "anode",
    k: "cathode",
    neg: "cathode",
    "-": "cathode",
    c: "cathode",
    minus: "cathode"
  },
  resistor: {
    t1: "a",
    "1": "a",
    pin1: "a",
    term1: "a",
    t2: "b",
    "2": "b",
    pin2: "b",
    term2: "b"
  },
  pushbutton: {
    "1a": "p1a",
    t1a: "p1a",
    terminal1a: "p1a",
    "1b": "p1b",
    t1b: "p1b",
    terminal1b: "p1b",
    "2a": "p2a",
    t2a: "p2a",
    terminal2a: "p2a",
    "2b": "p2b",
    t2b: "p2b",
    terminal2b: "p2b"
  },
  potentiometer: {
    t1: "t1",
    "1": "t1",
    pin1: "t1",
    vcc: "t1",
    "5v": "t1",
    wiper: "wiper",
    w: "wiper",
    out: "wiper",
    sig: "wiper",
    "2": "wiper",
    pin2: "wiper",
    t2: "t2",
    "3": "t2",
    pin3: "t2",
    gnd: "t2"
  },
  battery: {
    pos: "pos",
    "+": "pos",
    positive: "pos",
    vcc: "pos",
    "9v": "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    negative: "neg",
    gnd: "neg",
    black: "neg"
  },
  servo: {
    sig: "sig",
    signal: "sig",
    pwm: "sig",
    control: "sig",
    orange: "sig",
    yellow: "sig",
    data: "sig",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    red: "vcc",
    pos: "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    black: "gnd",
    brown: "gnd",
    neg: "gnd",
    "-": "gnd"
  },
  buzzer: {
    pos: "pos",
    "+": "pos",
    anode: "pos",
    sig: "pos",
    signal: "pos",
    pin1: "pos",
    vcc: "pos",
    red: "pos",
    neg: "neg",
    "-": "neg",
    cathode: "neg",
    gnd: "neg",
    ground: "neg",
    pin2: "neg",
    black: "neg"
  },
  "rgb-led": {
    r: "red",
    anode_r: "red",
    gnd: "gnd",
    com: "gnd",
    cathode: "gnd",
    c: "gnd",
    "-": "gnd",
    g: "green",
    anode_g: "green",
    b: "blue",
    anode_b: "blue"
  },
  ultrasonic: {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    trig: "trig",
    trigger: "trig",
    echo: "echo",
    gnd: "gnd",
    ground: "gnd"
  },
  dht11: {
    vcc: "vcc",
    "+": "vcc",
    power: "vcc",
    data: "data",
    out: "data",
    sig: "data",
    signal: "data",
    pin2: "data",
    gnd: "gnd",
    "-": "gnd",
    ground: "gnd"
  },
  "pir-sensor": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  tmp36: {
    vcc: "vcc",
    vs: "vcc",
    power: "vcc",
    out: "out",
    vout: "out",
    sig: "out",
    signal: "out",
    analog: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  ldr: {
    t1: "t1",
    "1": "t1",
    a: "t1",
    pin1: "t1",
    t2: "t2",
    "2": "t2",
    b: "t2",
    pin2: "t2"
  },
  relay: {
    vcc: "vcc",
    power: "vcc",
    gnd: "gnd",
    ground: "gnd",
    in: "in",
    sig: "in",
    signal: "in",
    control: "in",
    input: "in",
    com: "com",
    common: "com",
    no: "no",
    normally_open: "no",
    nc: "nc",
    normally_closed: "nc"
  },
  l298n: {
    vs: "vs",
    vcc: "vs",
    power: "vs",
    "12v": "vs",
    "9v": "vs",
    gnd: "gnd",
    ground: "gnd",
    "5v": "5v",
    logic_vcc: "5v",
    ena: "ena",
    enb: "enb",
    in1: "in1",
    in2: "in2",
    in3: "in3",
    in4: "in4",
    out1: "out1",
    out2: "out2",
    out3: "out3",
    out4: "out4"
  },
  "lcd-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    sda: "sda",
    data: "sda",
    scl: "scl",
    clk: "scl",
    clock: "scl"
  },
  "oled-i2c": {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    "3v3": "vcc",
    "5v": "vcc",
    scl: "scl",
    clk: "scl",
    clock: "scl",
    sda: "sda",
    data: "sda"
  },
  "neopixel-ring": {
    di: "di",
    din: "di",
    data: "di",
    in: "di",
    sig: "di",
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    "+": "vcc",
    gnd: "gnd",
    ground: "gnd",
    "-": "gnd",
    do: "do",
    dout: "do",
    out: "do"
  },
  "mq2-gas": {
    vcc: "vcc",
    power: "vcc",
    "5v": "vcc",
    gnd: "gnd",
    ground: "gnd",
    do: "do",
    digital: "do",
    dout: "do",
    ao: "ao",
    analog: "ao",
    aout: "ao"
  },
  "soil-moisture": {
    vcc: "vcc",
    power: "vcc",
    ao: "ao",
    analog: "ao",
    out: "ao",
    sig: "ao",
    signal: "ao",
    gnd: "gnd",
    ground: "gnd"
  },
  "ir-sensor": {
    vcc: "vcc",
    power: "vcc",
    out: "out",
    sig: "out",
    signal: "out",
    data: "out",
    gnd: "gnd",
    ground: "gnd"
  },
  joystick: {
    gnd: "gnd",
    ground: "gnd",
    vcc: "vcc",
    power: "vcc",
    vrx: "vrx",
    x: "vrx",
    vx: "vrx",
    vry: "vry",
    y: "vry",
    vy: "vry",
    sw: "sw",
    btn: "sw",
    switch: "sw",
    button: "sw"
  },
  "rotary-encoder": {
    gnd: "gnd",
    vcc: "vcc",
    clk: "clk",
    a: "clk",
    dt: "dt",
    b: "dt",
    sw: "sw",
    btn: "sw"
  },
  "dc-motor": {
    pos: "pos",
    "+": "pos",
    "m+": "pos",
    pin1: "pos",
    neg: "neg",
    "-": "neg",
    "m-": "neg",
    pin2: "neg"
  },
  "npn-transistor": {
    collector: "collector",
    c: "collector",
    base: "base",
    b: "base",
    emitter: "emitter",
    e: "emitter"
  },
  "seven-segment": {
    com: "com",
    common: "com",
    gnd: "com",
    cathode: "com",
    dp: "dp",
    dot: "dp"
  }
};
function resolveCanonicalPin(partType, pinId) {
  const clean = pinId.trim().toLowerCase();
  if (!clean) return clean;
  const partAliases = PIN_ALIAS_MAP[partType];
  if (partAliases && partAliases[clean]) {
    return partAliases[clean];
  }
  if (partType === "breadboard") {
    if (clean === "pos_top" || clean === "+top" || clean === "top_+") return "pos_top";
    if (clean === "neg_top" || clean === "-top" || clean === "top_-") return "neg_top";
    if (clean === "pos_bot" || clean === "+bot" || clean === "bot_+") return "pos_bot";
    if (clean === "neg_bot" || clean === "-bot" || clean === "bot_-") return "neg_bot";
    return clean.replace(/[-]/g, "_");
  }
  if (isBoardPart(partType)) {
    const board = getBoardDefinition(partType);
    if (board) {
      for (const p of board.pins) {
        if (p.id.toLowerCase() === clean || p.label.toLowerCase() === clean) {
          return p.id;
        }
        if (p.alternateNames?.some((alt) => alt.toLowerCase() === clean)) {
          return p.id;
        }
      }
      if (clean === "5v" || clean === "v5") return "5v";
      if (clean === "v33" || clean === "3v3" || clean === "3.3v" || clean === "3v") {
        return board.powerPins.v33?.[0] ?? "3v3";
      }
      if (clean === "vin" || clean === "v_in") return "vin";
      if (clean === "gnd" || clean.startsWith("gnd")) {
        return board.powerPins.gnd[0] ?? "gnd";
      }
      const numOnly = clean.replace(/^(gpio|gp|d|p)/, "");
      if (/^\d+$/.test(numOnly)) {
        for (const p of board.pins) {
          const bpNum = p.id.replace(/^(gpio|gp|d|p)/, "");
          if (bpNum === numOnly) return p.id;
        }
      }
    }
  }
  const catalogDefinition = CATALOG[partType];
  const componentPins = PIXIU_COMPONENTS_DATASET[partType]?.pins ?? [];
  const datasetPin = componentPins.find(
    (pin) => pin.id.toLowerCase() === clean || pin.label.trim().toLowerCase() === clean || pin.aliases.some((alias) => alias.trim().toLowerCase() === clean)
  );
  if (datasetPin && catalogDefinition?.pins.some((pin) => pin.id.toLowerCase() === datasetPin.id.toLowerCase())) {
    return datasetPin.id;
  }
  const catalogPin = catalogDefinition?.pins.find(
    (pin) => pin.id.toLowerCase() === clean || pin.label.trim().toLowerCase() === clean
  );
  if (catalogPin) return catalogPin.id;
  return clean;
}
function isRegisteredPin(partType, pinId) {
  const definition = CATALOG[partType];
  return Boolean(definition?.pins.some((pin) => pin.id.toLowerCase() === pinId.toLowerCase()));
}
function computeCircuitHash(circuit, blocklyXml) {
  const sortedParts = [...circuit.parts].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({
    id: p.id,
    type: p.type,
    // Preserve sub-pixel edits; revision guards must not round away real mutations.
    x: Object.is(p.x, -0) ? 0 : p.x,
    y: Object.is(p.y, -0) ? 0 : p.y,
    rotation: Object.is(p.rotation || 0, -0) ? 0 : p.rotation || 0,
    props: Object.keys(p.props || {}).sort().reduce((acc, k) => {
      acc[k] = p.props[k];
      return acc;
    }, {})
  }));
  const sortedWires = [...circuit.wires].sort((a, b) => {
    const kA = `${a.from.partId}:${a.from.pinId}->${a.to.partId}:${a.to.pinId}`;
    const kB = `${b.from.partId}:${b.from.pinId}->${b.to.partId}:${b.to.pinId}`;
    return kA.localeCompare(kB);
  }).map((w) => ({
    from: `${w.from.partId}:${w.from.pinId}`,
    to: `${w.to.partId}:${w.to.pinId}`,
    color: w.color || "#38bdf8"
  }));
  const canonicalStr = JSON.stringify({
    parts: sortedParts,
    wires: sortedWires,
    blocklyXml: blocklyXml ?? null
  });
  let h1 = 2166136261;
  let h2 = 2166136261 ^ 1540483477;
  for (let i = 0; i < canonicalStr.length; i++) {
    const code = canonicalStr.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code;
    h2 = Math.imul(h2, 16777619);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${p1}${p2}`;
}
var DisjointSet = class {
  parent = /* @__PURE__ */ new Map();
  find(item) {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
      return item;
    }
    const root = this.parent.get(item);
    if (root === item) return item;
    const resolved = this.find(root);
    this.parent.set(item, resolved);
    return resolved;
  }
  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
  connected(a, b) {
    return this.find(a) === this.find(b);
  }
  allNodes() {
    return Array.from(this.parent.keys());
  }
};
function validateProposedCircuit(candidate, options = {}) {
  const allowWarnings = options.allowWarnings ?? true;
  const notices = [];
  const errors = [];
  const warnings = [];
  const metrics = {
    partCount: 0,
    wireCount: 0,
    unconnectedPins: 0,
    powerRailsOk: true,
    shortCircuitsFound: 0,
    overcurrentRisks: 0,
    overvoltageRisks: 0,
    unpoweredModules: 0,
    missingReturnPaths: 0
  };
  const addNotice = (notice) => {
    notices.push(notice);
    if (notice.severity === "critical") {
      errors.push(`${notice.title}: ${notice.message}`);
    } else if (notice.severity === "warning") {
      warnings.push(`${notice.title}: ${notice.message}`);
    }
  };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    addNotice({
      ruleId: "schema-envelope-invalid",
      severity: "critical",
      category: "schema",
      title: "Malformed Circuit Payload",
      message: "The circuit proposal is not a valid JSON object.",
      suggestion: "Provide a JSON object containing 'parts' and 'wires' arrays.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  const rawCandidate = candidate;
  if (!Array.isArray(rawCandidate.parts)) {
    addNotice({
      ruleId: "schema-parts-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Parts Array",
      message: "Proposed circuit object must contain a 'parts' array.",
      suggestion: "Include 'parts: []' in the proposed circuit structure.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  if (!Array.isArray(rawCandidate.wires)) {
    addNotice({
      ruleId: "schema-wires-array-missing",
      severity: "critical",
      category: "schema",
      title: "Missing Wires Array",
      message: "Proposed circuit object must contain a 'wires' array.",
      suggestion: "Include 'wires: []' in the proposed circuit structure.",
      involvedPartIds: []
    });
    return {
      valid: false,
      errors,
      warnings,
      notices,
      metrics,
      revHash: "0000000000000000"
    };
  }
  const partMap = /* @__PURE__ */ new Map();
  const validPartIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawCandidate.parts.length; i++) {
    const rawPart = rawCandidate.parts[i];
    if (!rawPart || typeof rawPart !== "object") {
      addNotice({
        ruleId: `schema-part-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Part Entry",
        message: `Part at index ${i} is not a valid object.`,
        suggestion: "Ensure all items in the 'parts' array are valid PlacedPart objects.",
        involvedPartIds: []
      });
      continue;
    }
    const p = rawPart;
    if (!p.id || typeof p.id !== "string" || !p.id.trim()) {
      addNotice({
        ruleId: `schema-part-${i}-missing-id`,
        severity: "critical",
        category: "schema",
        title: "Missing Part ID",
        message: `Part at index ${i} is missing a valid string 'id'.`,
        suggestion: "Assign a unique string identifier (e.g., 'uno', 'led-1') to every part.",
        involvedPartIds: []
      });
      continue;
    }
    const normalizedPartId = p.id.trim();
    if (validPartIds.has(normalizedPartId)) {
      addNotice({
        ruleId: `schema-duplicate-part-id-${normalizedPartId}`,
        severity: "critical",
        category: "schema",
        title: "Duplicate Part ID",
        message: `Multiple components share the normalized ID '${normalizedPartId}'. Part IDs must be unique after trimming whitespace.`,
        suggestion: `Rename one of the parts with ID '${normalizedPartId}' to a distinct identifier.`,
        involvedPartIds: [normalizedPartId]
      });
      continue;
    }
    if (!p.type || typeof p.type !== "string") {
      addNotice({
        ruleId: `schema-part-${p.id}-missing-type`,
        severity: "critical",
        category: "schema",
        title: "Missing Part Type",
        message: `Component '${p.id}' does not specify a valid 'type'.`,
        suggestion: "Specify a recognized component type from the Pixiu CyberLab catalog.",
        involvedPartIds: [p.id]
      });
      continue;
    }
    const coordinateFields = [
      { field: "x", value: p.x },
      { field: "y", value: p.y },
      { field: "rotation", value: p.rotation }
    ];
    const malformedCoordinate = coordinateFields.find(
      ({ value }) => value !== void 0 && (typeof value !== "number" || !Number.isFinite(value))
    );
    const coordinateOutOfBounds = typeof p.x === "number" && Math.abs(p.x) > 1e5 || typeof p.y === "number" && Math.abs(p.y) > 1e5 || typeof p.rotation === "number" && Math.abs(p.rotation) > 3600;
    if (malformedCoordinate || coordinateOutOfBounds) {
      const field = malformedCoordinate?.field ?? "x/y/rotation";
      addNotice({
        ruleId: `schema-part-${normalizedPartId}-coordinate-invalid`,
        severity: "critical",
        category: "schema",
        title: "Invalid Component Coordinates",
        message: malformedCoordinate ? `Component '${normalizedPartId}' has a non-finite or non-numeric '${field}' value.` : `Component '${normalizedPartId}' exceeds the allowed canvas coordinate/rotation bounds.`,
        suggestion: "Use finite numeric x/y/rotation values; x/y must be within \xB1100,000 canvas units and rotation within \xB13,600 degrees.",
        involvedPartIds: [normalizedPartId]
      });
      continue;
    }
    const placed = {
      id: normalizedPartId,
      type: p.type.trim(),
      x: Number.isFinite(p.x) ? Number(p.x) : 100,
      y: Number.isFinite(p.y) ? Number(p.y) : 100,
      rotation: Number.isFinite(p.rotation) ? Number(p.rotation) : 0,
      props: p.props && typeof p.props === "object" ? { ...p.props } : {}
    };
    validPartIds.add(placed.id);
    partMap.set(placed.id, placed);
  }
  metrics.partCount = partMap.size;
  const validComponentTypes = /* @__PURE__ */ new Set([
    ...Object.keys(PIXIU_COMPONENTS_DATASET),
    ...Object.keys(CATALOG),
    "arduino-uno",
    "esp32-devkit",
    "rpi-pico",
    "microbit-v2"
  ]);
  for (const part of partMap.values()) {
    if (!validComponentTypes.has(part.type)) {
      addNotice({
        ruleId: `identity-unknown-part-type-${part.type}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Type",
        message: `Component '${part.id}' specifies unrecognized type '${part.type}'.`,
        suggestion: `Use one of the supported 32 components in Pixiu CyberLab.`,
        involvedPartIds: [part.id]
      });
    }
  }
  const normalizedWires = [];
  const wireIdSet = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawCandidate.wires.length; i++) {
    const rawWire = rawCandidate.wires[i];
    if (!rawWire || typeof rawWire !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-invalid`,
        severity: "critical",
        category: "schema",
        title: "Malformed Wire Entry",
        message: `Wire at index ${i} is not a valid object.`,
        suggestion: "Ensure each wire specifies 'from' and 'to' endpoints.",
        involvedPartIds: []
      });
      continue;
    }
    const w = rawWire;
    if (!w.from || typeof w.from !== "object" || !w.to || typeof w.to !== "object") {
      addNotice({
        ruleId: `schema-wire-${i}-missing-endpoints`,
        severity: "critical",
        category: "schema",
        title: "Incomplete Wire Endpoints",
        message: `Wire at index ${i} is missing 'from' or 'to' endpoint definitions.`,
        suggestion: "Each wire must define { from: { partId, pinId }, to: { partId, pinId } }.",
        involvedPartIds: []
      });
      continue;
    }
    const fromPartId = String(w.from.partId || "").trim();
    const fromPinRaw = String(w.from.pinId || "").trim();
    const toPartId = String(w.to.partId || "").trim();
    const toPinRaw = String(w.to.pinId || "").trim();
    if (!fromPartId || !fromPinRaw || !toPartId || !toPinRaw) {
      addNotice({
        ruleId: `schema-wire-${i}-empty-endpoint-ids`,
        severity: "critical",
        category: "schema",
        title: "Empty Wire Endpoint Identifiers",
        message: `Wire at index ${i} has empty partId or pinId fields.`,
        suggestion: "Specify non-empty partId and pinId strings for both endpoints.",
        involvedPartIds: []
      });
      continue;
    }
    const fromPart = partMap.get(fromPartId);
    const toPart = partMap.get(toPartId);
    if (!fromPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${fromPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Origin Part Not Found",
        message: `Wire starts at component '${fromPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${fromPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [fromPartId]
      });
      continue;
    }
    if (!toPart) {
      addNotice({
        ruleId: `identity-wire-endpoint-missing-${toPartId}`,
        severity: "critical",
        category: "identity",
        title: "Wire Target Part Not Found",
        message: `Wire ends at component '${toPartId}' which does not exist in the parts list.`,
        suggestion: `Ensure part '${toPartId}' is added to the parts list before wiring to it.`,
        involvedPartIds: [toPartId]
      });
      continue;
    }
    const canonicalFromPin = resolveCanonicalPin(fromPart.type, fromPinRaw);
    const canonicalToPin = resolveCanonicalPin(toPart.type, toPinRaw);
    let invalidPinEndpoint = false;
    if (!isRegisteredPin(fromPart.type, canonicalFromPin)) {
      invalidPinEndpoint = true;
      addNotice({
        ruleId: `identity-unknown-pin-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${fromPinRaw}' resolves to '${canonicalFromPin}', which is not registered on component '${fromPartId}' (${fromPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin]
      });
    }
    if (!isRegisteredPin(toPart.type, canonicalToPin)) {
      invalidPinEndpoint = true;
      addNotice({
        ruleId: `identity-unknown-pin-${toPartId}-${canonicalToPin}`,
        severity: "critical",
        category: "identity",
        title: "Unknown Component Pin",
        message: `Pin '${toPinRaw}' resolves to '${canonicalToPin}', which is not registered on component '${toPartId}' (${toPart.type}).`,
        suggestion: "Use a pin ID or alias defined in the CyberLab component catalog.",
        involvedPartIds: [toPartId],
        involvedPinIds: [canonicalToPin]
      });
    }
    if (invalidPinEndpoint) continue;
    if (fromPartId === toPartId && canonicalFromPin === canonicalToPin) {
      addNotice({
        ruleId: `safety-self-loop-wire-${fromPartId}-${canonicalFromPin}`,
        severity: "critical",
        category: "safety",
        title: "Redundant Self-Connecting Wire Loop",
        message: `Wire connects pin '${canonicalFromPin}' on '${fromPartId}' to itself.`,
        suggestion: "Remove redundant loop wire connecting the same pin to itself.",
        involvedPartIds: [fromPartId],
        involvedPinIds: [canonicalFromPin]
      });
      continue;
    }
    const wireId = w.id && typeof w.id === "string" && !wireIdSet.has(w.id) ? w.id : `w_${fromPartId}_${canonicalFromPin}_${toPartId}_${canonicalToPin}_${i}`;
    wireIdSet.add(wireId);
    normalizedWires.push({
      id: wireId,
      from: { partId: fromPartId, pinId: canonicalFromPin },
      to: { partId: toPartId, pinId: canonicalToPin },
      color: typeof w.color === "string" && w.color ? w.color : "#38bdf8"
    });
  }
  metrics.wireCount = normalizedWires.length;
  const normalizedParts = Array.from(partMap.values());
  const normalizedCircuit = {
    parts: normalizedParts,
    wires: normalizedWires
  };
  const revHash = computeCircuitHash(
    normalizedCircuit,
    typeof rawCandidate.blocklyXml === "string" ? rawCandidate.blocklyXml : void 0
  );
  const boardParts = normalizedParts.filter((p) => isBoardPart(p.type));
  const primaryBoardPart = boardParts[0];
  const boardDef = primaryBoardPart ? getBoardForPart(primaryBoardPart) : void 0;
  if (boardParts.length > 1) {
    addNotice({
      ruleId: "budget-multiple-boards-detected",
      severity: "warning",
      category: "budget",
      title: "Multiple Microcontrollers Detected",
      message: `The canvas contains ${boardParts.length} microcontroller boards (${boardParts.map((b) => b.id).join(", ")}).`,
      suggestion: "Ensure shared common ground continuity across all microcontrollers.",
      involvedPartIds: boardParts.map((b) => b.id)
    });
  }
  const netlist = new DisjointSet();
  const pinKey = (partId, pinId) => `${partId}:${pinId}`;
  for (const w of normalizedWires) {
    netlist.union(pinKey(w.from.partId, w.from.pinId), pinKey(w.to.partId, w.to.pinId));
  }
  for (const part of normalizedParts) {
    if (part.type === "breadboard") {
      for (let c = 1; c <= BREADBOARD_COLUMNS; c++) {
        const topRow = ["a", "b", "c", "d", "e"];
        for (let r = 0; r < topRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${topRow[r]}_${c}`), pinKey(part.id, `${topRow[r + 1]}_${c}`));
        }
        const botRow = ["f", "g", "h", "i", "j"];
        for (let r = 0; r < botRow.length - 1; r++) {
          netlist.union(pinKey(part.id, `${botRow[r]}_${c}`), pinKey(part.id, `${botRow[r + 1]}_${c}`));
        }
      }
      for (let c = 1; c < BREADBOARD_COLUMNS; c++) {
        netlist.union(pinKey(part.id, `pos_t_${c}`), pinKey(part.id, `pos_t_${c + 1}`));
        netlist.union(pinKey(part.id, `neg_t_${c}`), pinKey(part.id, `neg_t_${c + 1}`));
        netlist.union(pinKey(part.id, `pos_b_${c}`), pinKey(part.id, `pos_b_${c + 1}`));
        netlist.union(pinKey(part.id, `neg_b_${c}`), pinKey(part.id, `neg_b_${c + 1}`));
      }
      for (const [legacy, canonical] of getLegacyBreadboardPinMappings()) {
        netlist.union(pinKey(part.id, legacy), pinKey(part.id, canonical));
      }
    } else if (part.type === "pushbutton") {
      netlist.union(pinKey(part.id, "p1a"), pinKey(part.id, "p1b"));
      netlist.union(pinKey(part.id, "p2a"), pinKey(part.id, "p2b"));
    }
  }
  const v5Pins = [];
  const v33Pins = [];
  const gndPins = [];
  const batteryPosPins = [];
  const batteryNegPins = [];
  for (const bPart of boardParts) {
    const b = getBoardForPart(bPart);
    if (!b) continue;
    if (b.powerPins.v5) {
      v5Pins.push(...b.powerPins.v5.map((p) => pinKey(bPart.id, p)));
    }
    if (b.powerPins.v33) {
      v33Pins.push(...b.powerPins.v33.map((p) => pinKey(bPart.id, p)));
    }
    if (b.powerPins.vin) {
      v5Pins.push(...b.powerPins.vin.map((p) => pinKey(bPart.id, p)));
    }
    gndPins.push(...b.powerPins.gnd.map((p) => pinKey(bPart.id, p)));
  }
  for (const part of normalizedParts) {
    if (part.type === "battery") {
      batteryPosPins.push(pinKey(part.id, "pos"));
      batteryNegPins.push(pinKey(part.id, "neg"));
    }
  }
  for (const pwr of v5Pins) {
    for (const gnd of gndPins) {
      if (netlist.connected(pwr, gnd)) {
        metrics.shortCircuitsFound++;
        metrics.powerRailsOk = false;
        addNotice({
          ruleId: "safety-direct-power-short-5v",
          severity: "critical",
          category: "safety",
          title: "Direct Short Circuit Detected (5V to GND)",
          message: "The 5V power supply rail is connected directly to Ground with zero resistance. On hardware, this causes an overcurrent shutdown or burns out the onboard voltage regulator.",
          suggestion: "Remove the wire connecting 5V directly to Ground. Ensure a load or resistor separates power from ground.",
          involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
          involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]]
        });
        break;
      }
    }
    if (!metrics.powerRailsOk) break;
  }
  if (metrics.powerRailsOk) {
    for (const pwr of v33Pins) {
      for (const gnd of gndPins) {
        if (netlist.connected(pwr, gnd)) {
          metrics.shortCircuitsFound++;
          metrics.powerRailsOk = false;
          addNotice({
            ruleId: "safety-direct-power-short-3v3",
            severity: "critical",
            category: "safety",
            title: "Direct Short Circuit Detected (3.3V to GND)",
            message: "The 3.3V power supply rail is connected directly to Ground with zero resistance.",
            suggestion: "Remove the wire bridging 3.3V to Ground. Add a load or circuit component between them.",
            involvedPartIds: [pwr.split(":")[0], gnd.split(":")[0]],
            involvedPinIds: [pwr.split(":")[1], gnd.split(":")[1]]
          });
          break;
        }
      }
      if (!metrics.powerRailsOk) break;
    }
  }
  if (metrics.powerRailsOk) {
    for (const v5 of v5Pins) {
      for (const v33 of v33Pins) {
        if (netlist.connected(v5, v33)) {
          metrics.shortCircuitsFound++;
          metrics.powerRailsOk = false;
          addNotice({
            ruleId: "safety-rail-conflict-5v-3v3",
            severity: "critical",
            category: "safety",
            title: "Voltage Rail Conflict (5V Shorted to 3.3V)",
            message: "The 5V power rail is tied directly to the 3.3V low-dropout regulator rail without a level shifter or regulator.",
            suggestion: "Disconnect the direct link between 5V and 3.3V power buses.",
            involvedPartIds: [v5.split(":")[0], v33.split(":")[0]],
            involvedPinIds: [v5.split(":")[1], v33.split(":")[1]]
          });
          break;
        }
      }
      if (!metrics.powerRailsOk) break;
    }
  }
  for (const bPos of batteryPosPins) {
    const batPartId = bPos.split(":")[0];
    const bNeg = pinKey(batPartId, "neg");
    if (netlist.connected(bPos, bNeg)) {
      metrics.shortCircuitsFound++;
      metrics.powerRailsOk = false;
      addNotice({
        ruleId: `safety-battery-short-${batPartId}`,
        severity: "critical",
        category: "safety",
        title: "Battery Terminal Short Circuit",
        message: `9V Battery '${batPartId}' positive and negative terminals are connected together with 0\u03A9 resistance. This causes thermal runaway and battery rupture.`,
        suggestion: "Remove direct short between battery positive and negative terminals.",
        involvedPartIds: [batPartId],
        involvedPinIds: ["pos", "neg"]
      });
    }
  }
  const resistiveGraph = /* @__PURE__ */ new Map();
  const addResistiveEdge = (u, v, r) => {
    if (!resistiveGraph.has(u)) resistiveGraph.set(u, []);
    if (!resistiveGraph.has(v)) resistiveGraph.set(v, []);
    resistiveGraph.get(u).push({ to: v, resistance: r });
    resistiveGraph.get(v).push({ to: u, resistance: r });
  };
  for (const node of netlist.allNodes()) {
    const root = netlist.find(node);
    if (root !== node) {
      addResistiveEdge(node, root, 0);
    }
  }
  for (const part of normalizedParts) {
    if (part.type === "resistor") {
      const rVal = Math.max(1, Number(part.props.resistance || 220));
      addResistiveEdge(pinKey(part.id, "a"), pinKey(part.id, "b"), rVal);
    }
  }
  const findMinResistance = (startPin, targetPins) => {
    const targetSet = new Set(targetPins);
    const dist = /* @__PURE__ */ new Map();
    const queue = [{ node: startPin, d: 0 }];
    dist.set(startPin, 0);
    while (queue.length > 0) {
      queue.sort((a, b) => a.d - b.d);
      const { node: cur, d } = queue.shift();
      if (targetSet.has(cur)) return d;
      const neighbors = resistiveGraph.get(cur) || [];
      for (const edge of neighbors) {
        const nextDist = d + edge.resistance;
        if (!dist.has(edge.to) || nextDist < dist.get(edge.to)) {
          dist.set(edge.to, nextDist);
          queue.push({ node: edge.to, d: nextDist });
        }
      }
    }
    return Infinity;
  };
  const allPowerPins = [...v5Pins, ...v33Pins];
  if (primaryBoardPart && boardDef) {
    for (const bp of boardDef.pins) {
      if (bp.kind === "digital") {
        allPowerPins.push(pinKey(primaryBoardPart.id, bp.id));
      }
    }
  }
  for (const part of normalizedParts) {
    if (part.type === "led") {
      const anodePin = pinKey(part.id, "anode");
      const cathodePin = pinKey(part.id, "cathode");
      const anodeConnected = resistiveGraph.has(anodePin);
      const cathodeConnected = resistiveGraph.has(cathodePin);
      if (anodeConnected && cathodeConnected) {
        const rToPower = findMinResistance(anodePin, allPowerPins);
        const rToGnd = findMinResistance(cathodePin, gndPins);
        const rRevToPower = findMinResistance(cathodePin, allPowerPins);
        const rRevToGnd = findMinResistance(anodePin, gndPins);
        const totalLoopRes = Math.min(rToPower + rToGnd, rRevToPower + rRevToGnd);
        if (Number.isFinite(totalLoopRes) && totalLoopRes < 100) {
          metrics.overcurrentRisks++;
          addNotice({
            ruleId: `safety-led-burnout-${part.id}`,
            severity: "critical",
            category: "safety",
            title: `LED Overcurrent Burnout Risk (${part.id})`,
            message: `LED '${part.id}' is wired directly across power and ground with only ${totalLoopRes.toFixed(1)}\u03A9 series resistance. Operating an LED without a 220\u03A9\u20131k\u03A9 current-limiting resistor causes thermal burnout within milliseconds!`,
            suggestion: `Insert a 220\u03A9 or 330\u03A9 resistor in series with LED '${part.id}' Anode (+) or Cathode (-).`,
            involvedPartIds: [part.id],
            involvedPinIds: ["anode", "cathode"]
          });
        }
      }
    }
  }
  if (primaryBoardPart && boardDef && boardDef.logicVoltage <= 3.3) {
    const dangerousSources = [...v5Pins, ...batteryPosPins];
    for (const pin of boardDef.pins) {
      if (pin.kind === "digital" || pin.kind === "analog") {
        const boardPinKey = pinKey(primaryBoardPart.id, pin.id);
        if (resistiveGraph.has(boardPinKey)) {
          const minResToOvervoltage = findMinResistance(boardPinKey, dangerousSources);
          if (Number.isFinite(minResToOvervoltage)) {
            const referencePathResistance = findMinResistance(boardPinKey, [...gndPins, ...v33Pins]);
            const seriesOnlyOrLowResistance = minResToOvervoltage < 500 || !Number.isFinite(referencePathResistance);
            metrics.overvoltageRisks++;
            addNotice({
              ruleId: `safety-overvoltage-gpio-${primaryBoardPart.id}-${pin.id}`,
              severity: seriesOnlyOrLowResistance ? "critical" : "warning",
              category: "safety",
              title: `5V Overvoltage on 3.3V MCU Pin (${pin.label})`,
              message: seriesOnlyOrLowResistance ? `A ${minResToOvervoltage.toFixed(0)}\u03A9 path connects a 5V/9V source to ${pin.label} on ${boardDef.name} without a modeled safe divider/reference return. A series resistor alone does not prove 3.3V-safe logic.` : `A ${minResToOvervoltage.toFixed(0)}\u03A9 path connects a 5V/9V source to ${pin.label} on ${boardDef.name}. A return/reference path exists, but this static validator cannot prove the resulting node voltage or divider ratio.`,
              suggestion: "Use a verified resistor-divider topology or a suitable logic-level shifter; do not rely on a series resistor alone.",
              involvedPartIds: [primaryBoardPart.id],
              involvedPinIds: [pin.id]
            });
          }
        }
      }
    }
  }
  if (primaryBoardPart && boardDef) {
    const boardGpioPins = boardDef.pins.filter((p) => p.kind === "digital").map((p) => pinKey(primaryBoardPart.id, p.id));
    for (const part of normalizedParts) {
      if (part.type === "dc-motor") {
        const mPos = pinKey(part.id, "pos");
        const mNeg = pinKey(part.id, "neg");
        const posConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mPos, bp));
        const negConnectedToGpio = boardGpioPins.some((bp) => netlist.connected(mNeg, bp));
        if (posConnectedToGpio || negConnectedToGpio) {
          addNotice({
            ruleId: `safety-motor-direct-gpio-${part.id}`,
            severity: "warning",
            category: "safety",
            title: `Inductive Overload Risk (DC Motor ${part.id})`,
            message: `DC Motor '${part.id}' is wired directly to microcontroller GPIO pins. Real physical motors require 200mA\u20131000mA (MCU pins can only supply 20mA\u201340mA) and generate inductive back-EMF spikes that damage pins. In physical assembly, use an L298N driver or relay.`,
            suggestion: "In physical breadboard assembly, use an L298N motor driver or relay module with external battery power to control the motor.",
            involvedPartIds: [part.id, primaryBoardPart.id],
            involvedPinIds: ["pos", "neg"]
          });
        }
      }
    }
  }
  const activeModuleTypes = [
    "ultrasonic",
    "dht11",
    "mq2-gas",
    "neopixel-ring",
    "oled-i2c",
    "lcd-i2c",
    "servo",
    "l298n",
    "pir-sensor",
    "ir-sensor"
  ];
  for (const part of normalizedParts) {
    if (activeModuleTypes.includes(part.type) && primaryBoardPart) {
      const moduleGnd = pinKey(part.id, "gnd");
      const hasWires = normalizedWires.some(
        (w) => w.from.partId === part.id || w.to.partId === part.id
      );
      if (hasWires) {
        const hasGndContinuity = gndPins.some((gnd) => netlist.connected(moduleGnd, gnd));
        if (!hasGndContinuity) {
          metrics.missingReturnPaths++;
          addNotice({
            ruleId: `wiring-missing-ground-return-${part.id}`,
            severity: "warning",
            category: "wiring",
            title: `Missing Ground Return Path (${part.id})`,
            message: `Active component '${part.id}' (${part.type}) is connected to the microcontroller but its Ground (GND) pin is not connected to common circuit GND. Without a closed return path, signals cannot flow.`,
            suggestion: `Connect '${part.id}' pin 'gnd' to microcontroller GND rail.`,
            involvedPartIds: [part.id],
            involvedPinIds: ["gnd"]
          });
        }
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawCandidate, "blocklyXml") && rawCandidate.blocklyXml !== void 0) {
    if (typeof rawCandidate.blocklyXml !== "string") {
      addNotice({
        ruleId: "syntax-blockly-xml-type-invalid",
        severity: "critical",
        category: "syntax",
        title: "Invalid Blockly XML Payload",
        message: "Blockly XML must be a string when supplied.",
        suggestion: "Send a serialized Blockly workspace XML string or omit blocklyXml.",
        involvedPartIds: []
      });
    } else {
      const xml = rawCandidate.blocklyXml.trim();
      const hasXmlRoot = /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?>[\s\S]*<\/xml>\s*$/i.test(xml) || /^(?:<\?xml\b[^?]*\?>\s*)?<xml(?:\s[^>]*)?\/>\s*$/i.test(xml);
      const unsafeXmlPattern = /<!DOCTYPE|<!ENTITY|<\s*script\b|<\s*(?:iframe|object|embed|foreignObject|html|body)\b|javascript\s*:|\bon[a-z]+\s*=/i;
      if (xml.length > 2e5) {
        addNotice({
          ruleId: "syntax-blockly-xml-size-limit",
          severity: "critical",
          category: "syntax",
          title: "Blockly XML Payload Too Large",
          message: "Blockly XML exceeds the 200,000-character safety limit.",
          suggestion: "Reduce the workspace payload and submit a smaller Blockly program.",
          involvedPartIds: []
        });
      } else if (xml && !hasXmlRoot) {
        addNotice({
          ruleId: "syntax-blockly-xml-root-invalid",
          severity: "critical",
          category: "syntax",
          title: "Malformed Blockly XML",
          message: "Blockly workspace payload must have a single <xml> root element.",
          suggestion: "Send XML exported from the Blockly workspace serializer.",
          involvedPartIds: []
        });
      } else if (unsafeXmlPattern.test(xml)) {
        addNotice({
          ruleId: "syntax-script-injection-blocked",
          severity: "critical",
          category: "syntax",
          title: "Unsafe Blockly XML Blocked",
          message: "Blockly XML contains a forbidden active-content, script, or event-handler pattern.",
          suggestion: "Remove script/active-content markup and regenerate the workspace XML.",
          involvedPartIds: []
        });
      }
    }
  }
  const criticalCount = notices.filter((n) => n.severity === "critical").length;
  const warningCount = notices.filter((n) => n.severity === "warning").length;
  const valid = criticalCount === 0 && (allowWarnings || warningCount === 0);
  return {
    valid,
    errors,
    warnings,
    notices,
    normalizedCircuit: valid ? normalizedCircuit : void 0,
    metrics,
    revHash
  };
}
export {
  computeCircuitHash,
  resolveCanonicalPin,
  validateProposedCircuit
};
