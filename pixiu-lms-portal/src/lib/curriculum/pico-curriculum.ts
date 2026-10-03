import type { Lesson } from "../lesson-engine"
import type { CircuitState, PartType } from "../circuit-types"

function part(id: string, type: PartType, x: number, y: number, props: Record<string, unknown> = {}) {
  return { id, type, x, y, rotation: 0, props }
}

function wire(id: string, fromPartId: string, fromPinId: string, toPartId: string, toPinId: string, color = "#60a5fa") {
  return { id, from: { partId: fromPartId, pinId: fromPinId }, to: { partId: toPartId, pinId: toPinId }, color }
}

export const PICO_LESSONS: Lesson[] = [
  // =========================================================================
  // RASPBERRY PI PICO TIER 1: BEGINNER (Foundations, GP25 & 12-Bit ADC)
  // =========================================================================
  {
    id: "lesson-pico-gp25-blink",
    title: "Pico Mission 1 · RP2040 Green User LED (GP25)",
    shortTitle: "Pico GP25 Blink",
    description: "Explore the dual ARM Cortex-M0+ RP2040 microcontroller and blink the onboard green user LED on GP25.",
    difficulty: "Beginner",
    board: "rpi-pico",
    estimatedMinutes: 8,
    concepts: ["Raspberry Pi Pico", "RP2040", "GP25", "Built-in LED", "Digital Output"],
    prerequisites: [],
    seedCircuit: {
      parts: [part("pico", "rpi-pico", 80, 100)],
      wires: [],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">25</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">25</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">25</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Raspberry Pi Pico",
        instructions: "Place a Raspberry Pi Pico board on the workbench. It features 30 GPIO pins and 3.3V logic.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }] }],
        success: "Raspberry Pi Pico is on the bench.",
      },
      {
        id: "code",
        title: "Program GP25 Blink",
        instructions: "Use digital-write blocks on pin 25 (GP25) with HIGH and LOW and 500ms delay in loop.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_digitalwrite", count: 1, fields: { PIN: "25", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "25", STATE: "LOW" } },
          { type: "time_delay", count: 2 },
        ] }],
        success: "Pico GP25 blink program ready.",
      },
      {
        id: "run",
        title: "Run and Observe Green LED",
        instructions: "Press Run to observe the green user LED illuminating on the Pico vector board.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "rpi-pico", field: "pin25High", equals: true }] }],
        success: "Pico onboard green LED is blinking live!",
      },
    ],
  },
  {
    id: "lesson-pico-external-led",
    title: "Pico Mission 2 · External LED with Current-Limiting Resistor",
    shortTitle: "Pico External LED",
    description: "Wire an external LED to Pico GP15 through a protective 220Ω resistor to explore 3.3V current safety.",
    difficulty: "Beginner",
    board: "rpi-pico",
    estimatedMinutes: 10,
    concepts: ["RP2040", "Current Limiting", "GP15", "Ohm's Law"],
    prerequisites: ["lesson-pico-gp25-blink"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("r1", "resistor", 380, 180, { resistance: 220 }),
        part("led1", "led", 500, 180, { color: "red" }),
      ],
      wires: [
        wire("w1", "pico", "gp15", "r1", "a", "#ef4444"),
        wire("w2", "r1", "b", "led1", "anode", "#ef4444"),
        wire("w3", "led1", "cathode", "pico", "gnd_4", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">15</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Pico & LED Circuit",
        instructions: "Place Pico, one Red LED, and one 220Ω resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "led", count: 1 }, { type: "resistor", count: 1 }] }],
        success: "Components placed.",
      },
      {
        id: "wiring",
        title: "Wire to Pin GP15",
        instructions: "Connect GP15 → Resistor A, Resistor B → LED anode, and LED cathode → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp15" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Circuit wired to GP15.",
      },
      {
        id: "code",
        title: "Program GP15",
        instructions: "Use digital-write blocks on pin 15 to toggle the LED.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "io_digitalwrite", count: 1, fields: { PIN: "15", STATE: "HIGH" } }] }],
        success: "Code configured.",
      },
      {
        id: "run",
        title: "Run Simulation",
        instructions: "Press Run to observe the external LED blinking.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "led", field: "level", min: 0.1 }] }],
        success: "External LED glowing with 3.3V logic!",
      },
    ],
  },
  {
    id: "lesson-pico-tactile-button",
    title: "Pico Mission 3 · Button Toggle & Digital Input",
    shortTitle: "Pico Button Lamp",
    description: "Read a tactile pushbutton on Pico pin GP14 and turn an LED on GP15 on and off interactively.",
    difficulty: "Beginner",
    board: "rpi-pico",
    estimatedMinutes: 10,
    concepts: ["RP2040", "Digital Read", "Interactive Button", "Conditional Logic"],
    prerequisites: ["lesson-pico-external-led"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("btn", "pushbutton", 380, 100),
        part("led1", "led", 540, 100, { color: "blue" }),
        part("r1", "resistor", 540, 210, { resistance: 220 }),
      ],
      wires: [
        wire("w1", "pico", "gp14", "btn", "p1a", "#60a5fa"),
        wire("w2", "pico", "3v3", "btn", "p2a", "#ef4444"),
        wire("w3", "pico", "gp15", "r1", "a", "#3b82f6"),
        wire("w4", "r1", "b", "led1", "anode", "#3b82f6"),
        wire("w5", "led1", "cathode", "pico", "gnd_4", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">14</field><field name="MODE">INPUT</field><next>
      <block type="io_pinmode"><field name="PIN">15</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="io_digitalread"><field name="PIN">14</field></block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">LOW</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Button & LED",
        instructions: "Place Pico, Pushbutton, Blue LED, and 220Ω resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "pushbutton", count: 1 }, { type: "led", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire Digital Input",
        instructions: "Connect GP14 to Button 1a, 3V3 to Button 2a, and GP15 to the LED series resistor.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp14" }, to: { partType: "pushbutton", pinId: "p1a" } },
        ] }],
        success: "Digital input loop wired.",
      },
      {
        id: "code",
        title: "Read Digital Pin 14",
        instructions: "Use io_digitalread on pin 14 to drive pin 15 with an if-else block.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "io_digitalread", count: 1, fields: { PIN: "14" } }] }],
        success: "Interactive code programmed.",
      },
      {
        id: "run",
        title: "Run & Click Button",
        instructions: "Press Run and click the pushbutton on canvas to test interactive control.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Pico button lamp is responding live!",
      },
    ],
  },
  {
    id: "lesson-pico-pot-adc",
    title: "Pico Mission 4 · 12-Bit ADC Analog Input (GP26 / ADC0)",
    shortTitle: "Pico 12-Bit ADC",
    description: "Read RP2040 ADC0 (GP26) with true 12-bit discrete resolution (0 to 4095) from a potentiometer.",
    difficulty: "Beginner",
    board: "rpi-pico",
    estimatedMinutes: 10,
    concepts: ["RP2040", "12-bit ADC", "ADC0", "Analog In"],
    prerequisites: ["lesson-pico-tactile-button"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("pot", "potentiometer", 380, 100, { value: 512 }),
      ],
      wires: [
        wire("w1", "pico", "3v3", "pot", "t1", "#ef4444"),
        wire("w2", "pico", "gnd_7", "pot", "t2", "#1e293b"),
        wire("w3", "pot", "wiper", "pico", "gp26", "#eab308"),
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
          <block type="io_analogread"><field name="PIN">26</field></block>
        </value>
        <next>
        <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">250</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Potentiometer",
        instructions: "Place Pico and a Potentiometer on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "potentiometer", count: 1 }] }],
        success: "Parts placed.",
      },
      {
        id: "wiring",
        title: "Wire to GP26 (ADC0)",
        instructions: "Connect 3V3 → T1, GND → T2, and Wiper → GP26.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "potentiometer", pinId: "wiper" }, to: { partType: "rpi-pico", pinId: "gp26" } },
        ] }],
        success: "Potentiometer wired to ADC0.",
      },
      {
        id: "code",
        title: "Read Pin 26",
        instructions: "Use io_analogread on pin 26 and print value to Serial.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "io_analogread", count: 1, fields: { PIN: "26" } }] }],
        success: "ADC read block configured.",
      },
      {
        id: "run",
        title: "Run Telemetry",
        instructions: "Press Run to observe 12-bit discrete values in the Serial Monitor.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "RP2040 12-bit ADC data streaming live!",
      },
    ],
  },

  // =========================================================================
  // RASPBERRY PI PICO TIER 2: INTERMEDIATE (PWM Fader, Audio & Radar)
  // =========================================================================
  {
    id: "lesson-pico-rgb-fader",
    title: "Pico Mission 5 · Dual-Core RGB LED Smooth Fader",
    shortTitle: "Pico RGB Fader",
    description: "Drive Red, Green, and Blue LED channels on Pico pins GP16, GP17, and GP18 using hardware PWM slices.",
    difficulty: "Intermediate",
    board: "rpi-pico",
    estimatedMinutes: 12,
    concepts: ["RP2040", "PWM Slice", "Analog Write", "RGB LED"],
    prerequisites: ["lesson-pico-pot-adc"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("rgb", "rgb-led", 420, 100),
      ],
      wires: [
        wire("w1", "pico", "gp16", "rgb", "red", "#ef4444"),
        wire("w2", "pico", "gp17", "rgb", "green", "#22c55e"),
        wire("w3", "pico", "gp18", "rgb", "blue", "#3b82f6"),
        wire("w4", "rgb", "gnd", "pico", "gnd_5", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">16</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">17</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">18</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_analogwrite"><field name="PIN">16</field><value name="VALUE"><shadow type="math_number"><field name="NUM">220</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">17</field><value name="VALUE"><shadow type="math_number"><field name="NUM">120</field></shadow></value><next>
      <block type="io_analogwrite"><field name="PIN">18</field><value name="VALUE"><shadow type="math_number"><field name="NUM">240</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place RGB LED",
        instructions: "Place Pico and an RGB LED on the workbench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "rgb-led", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire to Pins GP16, GP17, GP18",
        instructions: "Connect GP16 → Red, GP17 → Green, GP18 → Blue, and GND → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp16" }, to: { partType: "rgb-led", pinId: "red" } },
        ] }],
        success: "RGB channels wired.",
      },
      {
        id: "code",
        title: "Program PWM Slices",
        instructions: "Use io_analogwrite to write values to pins 16, 17, and 18.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "io_analogwrite", count: 3 }] }],
        success: "PWM mixing programmed.",
      },
      {
        id: "run",
        title: "Run RGB Lamp",
        instructions: "Press Run to observe vibrant color blending on the RGB LED.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "rgb-led", field: "redLevel", min: 0.1 }] }],
        success: "Pico RGB lamp is glowing!",
      },
    ],
  },
  {
    id: "lesson-pico-buzzer-melody",
    title: "Pico Mission 6 · Piezo Buzzer Melody & Alarm",
    shortTitle: "Pico Alarm Buzzer",
    description: "Synthesize clear musical tones on a piezo buzzer connected to Pico GP15.",
    difficulty: "Intermediate",
    board: "rpi-pico",
    estimatedMinutes: 12,
    concepts: ["RP2040", "Audio PWM", "Buzzer", "Alert System"],
    prerequisites: ["lesson-pico-rgb-fader"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("bz", "buzzer", 420, 120),
      ],
      wires: [
        wire("w1", "pico", "gp15", "bz", "pos", "#facc15"),
        wire("w2", "bz", "neg", "pico", "gnd_4", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="tone_play"><field name="PIN">15</field><value name="FREQ"><shadow type="math_number"><field name="NUM">523</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value><next>
      <block type="tone_stop"><field name="PIN">15</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Buzzer",
        instructions: "Place Pico and Piezo Buzzer on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "buzzer", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire to GP15",
        instructions: "Connect Buzzer POS to GP15 and NEG to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp15" }, to: { partType: "buzzer", pinId: "pos" } },
        ] }],
        success: "Buzzer wired.",
      },
      {
        id: "code",
        title: "Generate Tone",
        instructions: "Use tone_play block on pin 15 with 523 Hz (Note C5).",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "tone_play", count: 1, fields: { PIN: "15" } }] }],
        success: "Tone block programmed.",
      },
      {
        id: "run",
        title: "Run Audio Test",
        instructions: "Press Run to hear tone generation from Pico.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "buzzer", field: "level", min: 0.5 }] }],
        success: "Pico buzzer tone playing live!",
      },
    ],
  },
  {
    id: "lesson-pico-ultrasonic-radar",
    title: "Pico Mission 7 · Ultrasonic Distance Gauge & Parking Radar",
    shortTitle: "Pico Ultrasonic Radar",
    description: "Measure object distance using an HC-SR04 ultrasonic sensor and sound an alarm when an obstacle is close.",
    difficulty: "Intermediate",
    board: "rpi-pico",
    estimatedMinutes: 15,
    concepts: ["RP2040", "Ultrasonic HC-SR04", "Distance Sensing", "Threshold Alarm"],
    prerequisites: ["lesson-pico-buzzer-melody"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("sonar", "ultrasonic", 420, 90, { distance: 35 }),
        part("bz", "buzzer", 420, 220),
      ],
      wires: [
        wire("w1", "pico", "vbus", "sonar", "vcc", "#ef4444"),
        wire("w2", "pico", "gnd_1", "sonar", "gnd", "#1e293b"),
        wire("w3", "pico", "gp2", "sonar", "trig", "#60a5fa"),
        wire("w4", "pico", "gp3", "sonar", "echo", "#38bdf8"),
        wire("w5", "pico", "gp4", "bz", "pos", "#facc15"),
        wire("w6", "bz", "neg", "pico", "gnd_2", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A"><block type="ultrasonic_read"></block></value>
            <value name="B"><block type="math_number"><field name="NUM">40</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">4</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">4</field><field name="STATE">LOW</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Sensor & Buzzer",
        instructions: "Place Pico, HC-SR04 Ultrasonic sensor, and Buzzer.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "ultrasonic", count: 1 }, { type: "buzzer", count: 1 }] }],
        success: "Parts ready.",
      },
      {
        id: "wiring",
        title: "Wire Trigger and Echo",
        instructions: "Connect TRIG to GP2, ECHO to GP3, and Buzzer to GP4.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp2" }, to: { partType: "ultrasonic", pinId: "trig" } },
        ] }],
        success: "Sensor connections wired.",
      },
      {
        id: "code",
        title: "Program Distance Threshold",
        instructions: "Check if ultrasonic_read < 40 cm to trigger the buzzer.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "ultrasonic_read", count: 1 }] }],
        success: "Proximity radar logic ready.",
      },
      {
        id: "run",
        title: "Run Radar Simulation",
        instructions: "Press Run to observe proximity detection.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Pico ultrasonic parking radar live!",
      },
    ],
  },

  // =========================================================================
  // RASPBERRY PI PICO TIER 3: ADVANCED (Servo Robotics, I2C LCD & Smart Farm)
  // =========================================================================
  {
    id: "lesson-pico-servo-motion",
    title: "Pico Mission 8 · Servo Motor Robotic Arm Sweep",
    shortTitle: "Pico Servo Actuator",
    description: "Control a robotic servo motor on Pico GP15 with calibrated 0° and 90° motion cycles.",
    difficulty: "Advanced",
    board: "rpi-pico",
    estimatedMinutes: 15,
    concepts: ["RP2040", "Servo Motors", "PWM", "Robotics"],
    prerequisites: ["lesson-pico-ultrasonic-radar"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("srv", "servo", 420, 110, { angle: 0 }),
      ],
      wires: [
        wire("w1", "pico", "vbus", "srv", "vcc", "#ef4444"),
        wire("w2", "pico", "gnd_1", "srv", "gnd", "#1e293b"),
        wire("w3", "pico", "gp15", "srv", "sig", "#fb923c"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">15</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">15</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Servo",
        instructions: "Place Pico and a Servo motor on the workbench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "servo", count: 1 }] }],
        success: "Actuator placed.",
      },
      {
        id: "wiring",
        title: "Wire Signal to GP15",
        instructions: "Connect VBUS → Servo VCC, GND → GND, and GP15 → SIG.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp15" }, to: { partType: "servo", pinId: "sig" } },
        ] }],
        success: "Servo signal wired.",
      },
      {
        id: "code",
        title: "Sweep Angles",
        instructions: "Use servo_write on pin 15 for 0° and 90°.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "servo_write", count: 2, fields: { PIN: "15" } }] }],
        success: "Motion cycle programmed.",
      },
      {
        id: "run",
        title: "Run Motion Cycle",
        instructions: "Press Run to observe robotic arm sweeping angles.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0 }] }],
        success: "Pico driving servo motion successfully!",
      },
    ],
  },
  {
    id: "lesson-pico-i2c-lcd",
    title: "Pico Mission 9 · I2C 16x2 Character LCD Display",
    shortTitle: "Pico I2C LCD",
    description: "Connect an alphanumeric 16x2 I2C LCD to Pico default I2C0 pins (SDA GP4, SCL GP5).",
    difficulty: "Advanced",
    board: "rpi-pico",
    estimatedMinutes: 15,
    concepts: ["RP2040", "I2C Bus", "16x2 LCD", "Text Formatting"],
    prerequisites: ["lesson-pico-servo-motion"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("lcd", "lcd-i2c", 420, 100, { line1: "PICO ONLINE", line2: "READY" }),
      ],
      wires: [
        wire("w1", "pico", "vbus", "lcd", "vcc", "#ef4444"),
        wire("w2", "pico", "gnd_1", "lcd", "gnd", "#1e293b"),
        wire("w3", "pico", "gp4", "lcd", "sda", "#38bdf8"),
        wire("w4", "pico", "gp5", "lcd", "scl", "#818cf8"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="lcd_print">
        <value name="TEXT"><block type="text_string"><field name="TEXT">RPI PICO RP2040</field></block></value>
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
        title: "Place LCD 16x2",
        instructions: "Place Pico and an I2C 16x2 Character LCD on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "lcd-i2c", count: 1 }] }],
        success: "LCD display placed.",
      },
      {
        id: "wiring",
        title: "Wire I2C Bus (GP4 SDA, GP5 SCL)",
        instructions: "Connect GP4 → SDA, GP5 → SCL, VBUS → VCC, and GND → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp4" }, to: { partType: "lcd-i2c", pinId: "sda" } },
          { from: { partType: "rpi-pico", pinId: "gp5" }, to: { partType: "lcd-i2c", pinId: "scl" } },
        ] }],
        success: "I2C bus wired.",
      },
      {
        id: "code",
        title: "Print to LCD",
        instructions: "Use lcd_print to display message on the screen.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "lcd_print", count: 1 }] }],
        success: "LCD print configured.",
      },
      {
        id: "run",
        title: "Run LCD Display",
        instructions: "Press Run to observe text rendered on the LCD screen.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "lcd-i2c", field: "lcdBacklight", equals: true }] }],
        success: "Pico character display running live!",
      },
    ],
  },
  {
    id: "lesson-pico-soil-irrigation",
    title: "Pico Mission 10 · Smart Agriculture & Relay Pump Automation",
    shortTitle: "Pico Smart Farm",
    description: "Monitor soil moisture on ADC1 (GP27) and automatically energize an electromechanical relay on GP13 when soil is dry.",
    difficulty: "Advanced",
    board: "rpi-pico",
    estimatedMinutes: 20,
    concepts: ["RP2040", "Soil Moisture Sensor", "Relay Driver", "Automated Irrigation"],
    prerequisites: ["lesson-pico-i2c-lcd"],
    seedCircuit: {
      parts: [
        part("pico", "rpi-pico", 60, 100),
        part("soil", "soil-moisture", 420, 90, { moisture: 350 }),
        part("rly", "relay", 420, 220),
      ],
      wires: [
        wire("w1", "pico", "3v3", "soil", "vcc", "#ef4444"),
        wire("w2", "pico", "gnd_7", "soil", "gnd", "#1e293b"),
        wire("w3", "pico", "gp27", "soil", "ao", "#eab308"),
        wire("w4", "pico", "vbus", "rly", "vcc", "#ef4444"),
        wire("w5", "pico", "gnd_1", "rly", "gnd", "#1e293b"),
        wire("w6", "pico", "gp13", "rly", "in", "#facc15"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A"><block type="soil_moisture_read"></block></value>
            <value name="B"><block type="math_number"><field name="NUM">400</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Soil Sensor & Relay",
        instructions: "Place Pico, Soil Moisture Sensor, and 5V Relay module.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "rpi-pico", count: 1 }, { type: "soil-moisture", count: 1 }, { type: "relay", count: 1 }] }],
        success: "Smart agriculture hardware placed.",
      },
      {
        id: "wiring",
        title: "Wire Sensor and Relay",
        instructions: "Connect Soil AO to GP27 (ADC1) and Relay IN to GP13.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "rpi-pico", pinId: "gp27" }, to: { partType: "soil-moisture", pinId: "ao" } },
        ] }],
        success: "Sensor and relay wired.",
      },
      {
        id: "code",
        title: "Program Irrigation Trigger",
        instructions: "If soil moisture < 400, energize the relay on pin 13 to pump water.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [{ type: "soil_moisture_read", count: 1 }, { type: "io_digitalwrite", count: 1, fields: { PIN: "13" } }] }],
        success: "Automated irrigation code ready.",
      },
      {
        id: "run",
        title: "Run Smart Irrigation",
        instructions: "Press Run to observe automated relay switching.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "relay", field: "relayActive", equals: true }] }],
        success: "RP2040 automated irrigation system is running live!",
      },
    ],
  },
]
