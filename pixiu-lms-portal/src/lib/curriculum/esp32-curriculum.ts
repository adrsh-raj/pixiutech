import type { Lesson } from "../lesson-engine"
import type { CircuitState, PartType } from "../circuit-types"

function part(id: string, type: PartType, x: number, y: number, props: Record<string, unknown> = {}) {
  return { id, type, x, y, rotation: 0, props }
}

function wire(id: string, fromPartId: string, fromPinId: string, toPartId: string, toPinId: string, color = "#60a5fa") {
  return { id, from: { partId: fromPartId, pinId: fromPinId }, to: { partId: toPartId, pinId: toPinId }, color }
}

export const ESP32_LESSONS: Lesson[] = [
  // =========================================================================
  // ESP32 TIER 1: BEGINNER (Foundations, 3.3V Logic & ADC)
  // =========================================================================
  {
    id: "lesson-esp32-builtin-led",
    title: "ESP32 Mission 1 · Built-in Blue LED (GPIO 2)",
    shortTitle: "ESP32 Built-in LED",
    description: "Explore the dual-core 240MHz ESP32 DevKit and blink the onboard Blue status LED on GPIO2 with 3.3V logic.",
    difficulty: "Beginner",
    board: "esp32-devkit",
    estimatedMinutes: 8,
    concepts: ["ESP32", "3.3V Logic", "GPIO 2", "Built-in LED", "Digital Output"],
    prerequisites: [],
    seedCircuit: {
      parts: [part("esp", "esp32-devkit", 80, 100)],
      wires: [],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place ESP32 DevKit",
        instructions: "Place an ESP32 DevKit board on the workbench. It runs at 240MHz with 3.3V logic.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }] }],
        success: "ESP32 DevKit is on the bench.",
      },
      {
        id: "code",
        title: "Program GPIO 2 blink",
        instructions: "Use digital-write blocks to set pin 2 (GPIO2) HIGH and LOW with 500ms delay in loop.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_digitalwrite", count: 1, fields: { PIN: "2", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "2", STATE: "LOW" } },
          { type: "time_delay", count: 2 },
        ] }],
        success: "Blockly blink sequence programmed for ESP32 GPIO2.",
      },
      {
        id: "run",
        title: "Run and observe Blue LED",
        instructions: "Press Run to start simulation and watch the ESP32's onboard Blue LED illuminate.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "esp32-devkit", field: "pin2High", equals: true }] }],
        success: "ESP32 onboard Blue LED is blinking live!",
      },
    ],
  },
  {
    id: "lesson-esp32-pushbutton",
    title: "ESP32 Mission 2 · Tactile Button Digital Input",
    shortTitle: "ESP32 Pushbutton Lamp",
    description: "Read a tactile pushbutton as a 3.3V digital input on GPIO4 to control an external LED.",
    difficulty: "Beginner",
    board: "esp32-devkit",
    estimatedMinutes: 10,
    concepts: ["ESP32", "Digital Input", "Pushbutton", "GPIO 4", "Conditional Logic"],
    prerequisites: ["lesson-esp32-builtin-led"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("btn", "pushbutton", 380, 100),
        part("led1", "led", 540, 100, { color: "green" }),
        part("r1", "resistor", 540, 210, { resistance: 220 }),
      ],
      wires: [
        wire("w1", "esp", "d4", "btn", "p1a", "#60a5fa"),
        wire("w2", "esp", "3v3", "btn", "p2a", "#ef4444"),
        wire("w3", "esp", "d2", "r1", "a", "#22c55e"),
        wire("w4", "r1", "b", "led1", "anode", "#22c55e"),
        wire("w5", "led1", "cathode", "esp", "gnd_r", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">4</field><field name="MODE">INPUT</field><next>
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="io_digitalread"><field name="PIN">4</field></block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">LOW</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Button and Lamp Parts",
        instructions: "Place one ESP32 DevKit, one Pushbutton, one Green LED, and one 220Ω resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "esp32-devkit", count: 1 },
          { type: "pushbutton", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Components placed.",
      },
      {
        id: "wiring",
        title: "Wire 3.3V Logic Loop",
        instructions: "Connect ESP32 D4 to Pushbutton pin 1a, 3V3 to pin 2a, D2 to resistor A, and LED cathode to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d4" }, to: { partType: "pushbutton", pinId: "p1a" } },
          { from: { partType: "esp32-devkit", pinId: "d2" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "esp32-devkit", pinId: "gnd_r" } },
        ] }],
        success: "Pushbutton and LED wired correctly.",
      },
      {
        id: "code",
        title: "Check Button in Blockly",
        instructions: "Use io_digitalread on pin 4 to control pin 2 with an if-else block.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_digitalread", count: 1, fields: { PIN: "4" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "2", STATE: "HIGH" } },
        ] }],
        success: "Interactive button logic programmed.",
      },
      {
        id: "run",
        title: "Run Simulation",
        instructions: "Press Run to test your interactive 3.3V button circuit.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "ESP32 interactive button lamp is active!",
      },
    ],
  },
  {
    id: "lesson-esp32-pot-12bit",
    title: "ESP32 Mission 3 · 12-Bit ADC Potentiometer (0..4095)",
    shortTitle: "ESP32 12-Bit ADC",
    description: "Experience the high-resolution 12-bit ADC of ESP32 (4096 discrete levels) reading an analog potentiometer on pin 34.",
    difficulty: "Beginner",
    board: "esp32-devkit",
    estimatedMinutes: 10,
    concepts: ["ESP32", "12-Bit ADC", "Analog Input", "Resolution (0..4095)"],
    prerequisites: ["lesson-esp32-pushbutton"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("pot", "potentiometer", 380, 100, { value: 512 }),
      ],
      wires: [
        wire("w1", "esp", "3v3", "pot", "t1", "#ef4444"),
        wire("w2", "esp", "gnd_l", "pot", "t2", "#1e293b"),
        wire("w3", "pot", "wiper", "esp", "d34", "#eab308"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field></block>
    </statement>
    <statement name="LOOP">
      <block type="serial_println">
        <value name="TEXT">
          <block type="io_analogread"><field name="PIN">34</field></block>
        </value>
        <next>
        <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Potentiometer",
        instructions: "Place an ESP32 and Potentiometer on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "potentiometer", count: 1 }] }],
        success: "ESP32 and Potentiometer placed.",
      },
      {
        id: "wiring",
        title: "Wire to ADC Pin 34",
        instructions: "Connect Potentiometer T1 to 3V3, T2 to GND, and wiper to ESP32 pin D34 (ADC1 channel).",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "3v3" }, to: { partType: "potentiometer", pinId: "t1" } },
          { from: { partType: "potentiometer", pinId: "wiper" }, to: { partType: "esp32-devkit", pinId: "d34" } },
        ] }],
        success: "12-bit ADC connection wired.",
      },
      {
        id: "code",
        title: "Read 12-Bit Analog Signal",
        instructions: "Use io_analogread on pin 34 and print to Serial Monitor.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "serial_begin", count: 1 },
          { type: "io_analogread", count: 1, fields: { PIN: "34" } },
          { type: "serial_println", count: 1 },
        ] }],
        success: "12-bit ADC telemetry program ready.",
      },
      {
        id: "run",
        title: "Run and View Telemetry",
        instructions: "Press Run to observe real-time 12-bit analog telemetry (0 to 4095).",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "ESP32 12-bit ADC data streaming live!",
      },
    ],
  },
  {
    id: "lesson-esp32-rgb-mood",
    title: "ESP32 Mission 4 · Multi-Channel RGB Mood Light",
    shortTitle: "ESP32 RGB Lamp",
    description: "Drive Red, Green, and Blue LED channels on ESP32 GPIOs 25, 26, and 27 using multi-channel PWM.",
    difficulty: "Beginner",
    board: "esp32-devkit",
    estimatedMinutes: 10,
    concepts: ["ESP32", "RGB LED", "LEDC PWM", "Color Mixing"],
    prerequisites: ["lesson-esp32-pot-12bit"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("rgb", "rgb-led", 420, 100),
      ],
      wires: [
        wire("w1", "esp", "d25", "rgb", "red", "#ef4444"),
        wire("w2", "esp", "d26", "rgb", "green", "#22c55e"),
        wire("w3", "esp", "d27", "rgb", "blue", "#3b82f6"),
        wire("w4", "rgb", "gnd", "esp", "gnd_l", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">25</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">26</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">27</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_analogwrite"><field name="PIN">25</field><value name="VALUE"><shadow type="math_number"><field name="NUM">255</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">26</field><value name="VALUE"><shadow type="math_number"><field name="NUM">100</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">27</field><value name="VALUE"><shadow type="math_number"><field name="NUM">200</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place RGB LED",
        instructions: "Place ESP32 and an RGB LED on the workbench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "rgb-led", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire 3 Color Channels",
        instructions: "Connect D25 → Red, D26 → Green, D27 → Blue, and GND → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d25" }, to: { partType: "rgb-led", pinId: "red" } },
          { from: { partType: "esp32-devkit", pinId: "d26" }, to: { partType: "rgb-led", pinId: "green" } },
          { from: { partType: "esp32-devkit", pinId: "d27" }, to: { partType: "rgb-led", pinId: "blue" } },
        ] }],
        success: "All 3 color channels wired.",
      },
      {
        id: "code",
        title: "Mix Colors with PWM",
        instructions: "Use io_analogwrite to write values to pins 25, 26, and 27.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_analogwrite", count: 3 },
        ] }],
        success: "PWM color mixing code ready.",
      },
      {
        id: "run",
        title: "Run Mood Light",
        instructions: "Press Run to observe vibrant color blending.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "rgb-led", field: "redLevel", min: 0.1 }] }],
        success: "ESP32 RGB mood lamp is glowing!",
      },
    ],
  },

  // =========================================================================
  // ESP32 TIER 2: INTERMEDIATE (Actuators, DAC Audio & Environmental I2C)
  // =========================================================================
  {
    id: "lesson-esp32-dac-tone",
    title: "ESP32 Mission 5 · True 8-Bit Hardware DAC & Tone",
    shortTitle: "ESP32 Hardware DAC",
    description: "Generate true analog audio signals using ESP32's built-in 8-bit DAC1 (GPIO 25) driving a piezo buzzer.",
    difficulty: "Intermediate",
    board: "esp32-devkit",
    estimatedMinutes: 12,
    concepts: ["ESP32", "Hardware DAC", "Analog Voltage", "Tone Generation"],
    prerequisites: ["lesson-esp32-rgb-mood"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("bz", "buzzer", 420, 120),
      ],
      wires: [
        wire("w1", "esp", "d25", "bz", "pos", "#facc15"),
        wire("w2", "bz", "neg", "esp", "gnd_l", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="tone_play"><field name="PIN">25</field><value name="FREQ"><shadow type="math_number"><field name="NUM">440</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value><next>
      <block type="tone_stop"><field name="PIN">25</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Buzzer",
        instructions: "Place ESP32 and a Piezo Buzzer on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "buzzer", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire to DAC Pin 25",
        instructions: "Connect Buzzer POS to ESP32 D25 (DAC1) and NEG to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d25" }, to: { partType: "buzzer", pinId: "pos" } },
        ] }],
        success: "DAC audio path wired.",
      },
      {
        id: "code",
        title: "Generate Audio Tone",
        instructions: "Use tone_play block on pin 25 with 440 Hz frequency.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "tone_play", count: 1, fields: { PIN: "25" } },
        ] }],
        success: "Tone generation programmed.",
      },
      {
        id: "run",
        title: "Run Audio Test",
        instructions: "Press Run to hear tone generation from ESP32 DAC channel.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "buzzer", field: "level", min: 0.5 }] }],
        success: "ESP32 DAC tone synthesizing successfully!",
      },
    ],
  },
  {
    id: "lesson-esp32-servo-pwm",
    title: "ESP32 Mission 6 · High-Frequency PWM Servo Actuator",
    shortTitle: "ESP32 Servo Control",
    description: "Drive a precision servo motor using ESP32 PWM signals on GPIO 18 to explore robotic positioning.",
    difficulty: "Intermediate",
    board: "esp32-devkit",
    estimatedMinutes: 12,
    concepts: ["ESP32", "Servo Motors", "PWM Angle Sweep", "Robotics"],
    prerequisites: ["lesson-esp32-dac-tone"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("srv", "servo", 420, 110, { angle: 0 }),
      ],
      wires: [
        wire("w1", "esp", "vin", "srv", "vcc", "#ef4444"),
        wire("w2", "esp", "gnd_l", "srv", "gnd", "#1e293b"),
        wire("w3", "esp", "d18", "srv", "sig", "#fb923c"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">18</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">18</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Servo Motor",
        instructions: "Place ESP32 and Servo motor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "servo", count: 1 }] }],
        success: "Actuator placed.",
      },
      {
        id: "wiring",
        title: "Wire Servo Signal to GPIO 18",
        instructions: "Connect VIN → Servo VCC, GND → GND, and D18 → SIG.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d18" }, to: { partType: "servo", pinId: "sig" } },
        ] }],
        success: "Servo signal wired to GPIO 18.",
      },
      {
        id: "code",
        title: "Sweep Angles",
        instructions: "Use servo_write blocks on pin 18 for 0° and 90°.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "servo_write", count: 2, fields: { PIN: "18" } },
        ] }],
        success: "Servo positioning code ready.",
      },
      {
        id: "run",
        title: "Run Servo Motion",
        instructions: "Press Run to observe robotic arm sweeping angles.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0 }] }],
        success: "ESP32 driving servo motion cleanly!",
      },
    ],
  },
  {
    id: "lesson-esp32-dht11-env",
    title: "ESP32 Mission 7 · Climate Station with DHT11",
    shortTitle: "ESP32 DHT11 Station",
    description: "Read digital temperature and humidity data from a DHT11 sensor on GPIO 4 with serial telemetry.",
    difficulty: "Intermediate",
    board: "esp32-devkit",
    estimatedMinutes: 12,
    concepts: ["ESP32", "DHT11 Sensor", "One-Wire Digital", "Serial Telemetry"],
    prerequisites: ["lesson-esp32-servo-pwm"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("dht", "dht11", 420, 100, { temperature: 26, humidity: 60 }),
      ],
      wires: [
        wire("w1", "esp", "3v3", "dht", "vcc", "#ef4444"),
        wire("w2", "esp", "gnd_l", "dht", "gnd", "#1e293b"),
        wire("w3", "esp", "d4", "dht", "data", "#38bdf8"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field></block>
    </statement>
    <statement name="LOOP">
      <block type="serial_println">
        <value name="TEXT">
          <block type="dht_temperature"></block>
        </value>
        <next>
        <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Climate Sensor",
        instructions: "Place ESP32 and DHT11 Sensor on the workbench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "dht11", count: 1 }] }],
        success: "Sensor placed.",
      },
      {
        id: "wiring",
        title: "Wire DHT11 to GPIO 4",
        instructions: "Connect 3V3 → VCC, GND → GND, and D4 → DATA.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "3v3" }, to: { partType: "dht11", pinId: "vcc" } },
          { from: { partType: "esp32-devkit", pinId: "d4" }, to: { partType: "dht11", pinId: "data" } },
        ] }],
        success: "Sensor wired to GPIO 4.",
      },
      {
        id: "code",
        title: "Stream Temperature",
        instructions: "Use dht_temperature and serial_println to stream room climate.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "serial_begin", count: 1 },
          { type: "dht_temperature", count: 1 },
          { type: "serial_println", count: 1 },
        ] }],
        success: "Telemetry code programmed.",
      },
      {
        id: "run",
        title: "Run Climate Stream",
        instructions: "Press Run to observe temperature readings on the Serial Monitor.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "dht11", field: "dhtTemperature", min: 10 }] }],
        success: "ESP32 climate telemetry active!",
      },
    ],
  },

  // =========================================================================
  // ESP32 TIER 3: ADVANCED (I2C OLED, Virtual Wi-Fi & Smartphone Server)
  // =========================================================================
  {
    id: "lesson-esp32-oled-i2c",
    title: "ESP32 Mission 8 · I2C OLED 128x64 Dashboard",
    shortTitle: "ESP32 OLED Dashboard",
    description: "Connect a high-contrast 128x64 I2C OLED display to ESP32 default I2C pins (SDA GPIO21, SCL GPIO22).",
    difficulty: "Advanced",
    board: "esp32-devkit",
    estimatedMinutes: 15,
    concepts: ["ESP32", "I2C Bus", "OLED Display", "Visual Dashboard"],
    prerequisites: ["lesson-esp32-dht11-env"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 60, 100),
        part("oled", "oled-i2c", 420, 100, { line1: "ESP32 ONLINE", line2: "READY" }),
      ],
      wires: [
        wire("w1", "esp", "3v3", "oled", "vcc", "#ef4444"),
        wire("w2", "esp", "gnd_r", "oled", "gnd", "#1e293b"),
        wire("w3", "esp", "d21", "oled", "sda", "#38bdf8"),
        wire("w4", "esp", "d22", "oled", "scl", "#818cf8"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="oled_print">
        <value name="TEXT"><block type="text_string"><field name="TEXT">ESP32 CYBERLAB</field></block></value>
      </block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place OLED Display",
        instructions: "Place ESP32 and an I2C 128x64 OLED display on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }, { type: "oled-i2c", count: 1 }] }],
        success: "OLED display placed.",
      },
      {
        id: "wiring",
        title: "Wire I2C Bus (D21 SDA, D22 SCL)",
        instructions: "Connect D21 → SDA, D22 → SCL, 3V3 → VCC, and GND → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d21" }, to: { partType: "oled-i2c", pinId: "sda" } },
          { from: { partType: "esp32-devkit", pinId: "d22" }, to: { partType: "oled-i2c", pinId: "scl" } },
        ] }],
        success: "Hardware I2C bus connected.",
      },
      {
        id: "code",
        title: "Display Text on OLED",
        instructions: "Use oled_print to display message on the screen.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "oled_print", count: 1 }] }],
        success: "OLED print block configured.",
      },
      {
        id: "run",
        title: "Run Visual Dashboard",
        instructions: "Press Run to observe OLED backlight and crisp digital text render.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "oled-i2c", field: "lcdBacklight", equals: true }] }],
        success: "ESP32 graphics dashboard rendering live!",
      },
    ],
  },
  {
    id: "lesson-esp32-wifi-connect",
    title: "ESP32 Mission 9 · Virtual Wi-Fi Station & DHCP",
    shortTitle: "ESP32 Wi-Fi Station",
    description: "Connect the ESP32 to Virtual Wi-Fi, obtain an IP address via virtual DHCP, and verify connectivity.",
    difficulty: "Advanced",
    board: "esp32-devkit",
    estimatedMinutes: 15,
    concepts: ["ESP32", "Virtual Wi-Fi", "DHCP", "Station Mode", "Networking"],
    prerequisites: ["lesson-esp32-oled-i2c"],
    seedCircuit: {
      parts: [part("esp", "esp32-devkit", 80, 100)],
      wires: [],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field><next>
      <block type="wifi_connect">
        <value name="SSID"><block type="text_string"><field name="TEXT">CyberLab-WiFi</field></block></value>
        <value name="PASS"><block type="text_string"><field name="TEXT">secret123</field></block></value>
      </block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place ESP32",
        instructions: "Place an ESP32 DevKit board on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "esp32-devkit", count: 1 }] }],
        success: "ESP32 board ready.",
      },
      {
        id: "code",
        title: "Configure Wi-Fi Connect Block",
        instructions: "Use wifi_connect block with your desired SSID and password.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "wifi_connect", count: 1 }] }],
        success: "Virtual Wi-Fi connect block configured.",
      },
      {
        id: "run",
        title: "Connect & Verify IP",
        instructions: "Press Run to connect to Virtual Wi-Fi and verify the IP address assigned.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "ESP32 Wi-Fi station connected with virtual IP!",
      },
    ],
  },
  {
    id: "lesson-esp32-web-server-phone",
    title: "ESP32 Mission 10 · Local HTTP Web Server & Phone Controller",
    shortTitle: "ESP32 Phone Web Server",
    description: "Launch an embedded HTTP Web Server on port 80 and switch Living Room and Bedroom LEDs from your Smartphone!",
    difficulty: "Advanced",
    board: "esp32-devkit",
    estimatedMinutes: 20,
    concepts: ["ESP32", "HTTP Web Server", "IoT Smartphone", "Smart Home Automation", "Routes"],
    prerequisites: ["lesson-esp32-wifi-connect"],
    seedCircuit: {
      parts: [
        part("esp", "esp32-devkit", 40, 70),
        part("r_red", "resistor", 380, 100, { resistance: 220 }),
        part("led_red", "led", 500, 100, { color: "red" }),
        part("r_blue", "resistor", 380, 220, { resistance: 220 }),
        part("led_blue", "led", 500, 220, { color: "blue" }),
      ],
      wires: [
        wire("w_r1", "esp", "d4", "r_red", "a", "#ef4444"),
        wire("w_r2", "r_red", "b", "led_red", "anode", "#ef4444"),
        wire("w_rgnd", "led_red", "cathode", "esp", "gnd_r", "#1e293b"),
        wire("w_b1", "esp", "d15", "r_blue", "a", "#3b82f6"),
        wire("w_b2", "r_blue", "b", "led_blue", "anode", "#3b82f6"),
        wire("w_bgnd", "led_blue", "cathode", "esp", "gnd_r", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="wifi_connect">
        <value name="SSID"><block type="text_string"><field name="TEXT">SmartHome-WiFi</field></block></value>
        <value name="PASS"><block type="text_string"><field name="TEXT">pixiu123</field></block></value>
        <next>
        <block type="wifi_server_begin">
          <field name="PORT">80</field>
          <next>
          <block type="wifi_server_on">
            <field name="PATH">/</field>
            <statement name="DO">
              <block type="wifi_server_send">
                <field name="STATUS">200</field>
                <field name="TYPE">text/html</field>
                <value name="CONTENT">
                  <block type="text_string"><field name="TEXT">&lt;h1&gt;🏠 Smart Home&lt;/h1&gt;&lt;a href="/red/on"&gt;Turn ON Red&lt;/a&gt;&lt;a href="/red/off"&gt;Turn OFF Red&lt;/a&gt;</field></block>
                </value>
              </block>
            </statement>
            <next>
            <block type="wifi_server_on">
              <field name="PATH">/red/on</field>
              <statement name="DO">
                <block type="io_digitalwrite"><field name="PIN">4</field><field name="STATE">HIGH</field><next>
                <block type="wifi_server_send">
                  <field name="STATUS">200</field>
                  <field name="TYPE">text/html</field>
                  <value name="CONTENT">
                    <block type="text_string"><field name="TEXT">&lt;h2&gt;🔴 Red ON&lt;/h2&gt;&lt;a href="/"&gt;Back&lt;/a&gt;</field></block>
                  </value>
                </block>
                </next></block>
              </statement>
            </block>
            </next></block>
          </block>
          </next></block>
        </next></block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place ESP32 & Smart Lamps",
        instructions: "Place ESP32, Red LED, Blue LED, and two 220Ω resistors.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "esp32-devkit", count: 1 },
          { type: "led", count: 2 },
          { type: "resistor", count: 2 },
        ] }],
        success: "Smart home circuit parts placed.",
      },
      {
        id: "wiring",
        title: "Wire Smart Lights",
        instructions: "Connect GPIO4 through resistor to Red LED, and GPIO15 through resistor to Blue LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "esp32-devkit", pinId: "d4" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Lights wired to ESP32 GPIOs.",
      },
      {
        id: "code",
        title: "Program Web Server Routes",
        instructions: "Use wifi_connect, wifi_server_begin, and wifi_server_on for root / and /red/on.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "wifi_connect", count: 1 },
          { type: "wifi_server_begin", count: 1 },
          { type: "wifi_server_on", count: 2 },
        ] }],
        success: "Web server routes programmed.",
      },
      {
        id: "run",
        title: "Run Server & Test from Smartphone",
        instructions: "Press Run, open the 📱 IoT Web Portal, and tap the route button to switch light from your Smartphone!",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "ESP32 Smartphone Web Server is running live!",
      },
    ],
  },
]
