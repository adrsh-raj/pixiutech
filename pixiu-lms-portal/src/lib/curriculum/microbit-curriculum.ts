import type { Lesson } from "../lesson-engine"
import type { CircuitState, PartType } from "../circuit-types"

function part(id: string, type: PartType, x: number, y: number, props: Record<string, unknown> = {}) {
  return { id, type, x, y, rotation: 0, props }
}

function wire(id: string, fromPartId: string, fromPinId: string, toPartId: string, toPinId: string, color = "#fbbf24") {
  return { id, from: { partId: fromPartId, pinId: fromPinId }, to: { partId: toPartId, pinId: toPinId }, color }
}

export const MICROBIT_LESSONS: Lesson[] = [
  // =========================================================================
  // BBC MICRO:BIT V2 TIER 1: BEGINNER (Matrix Display, Buttons & P0 Ring)
  // =========================================================================
  {
    id: "lesson-microbit-heartbeat",
    title: "micro:bit Mission 1 · 5x5 LED Matrix Heartbeat",
    shortTitle: "5x5 LED Matrix Heartbeat",
    description: "Welcome to BBC micro:bit v2! Program the onboard 5x5 red LED matrix to display an animated beating heart icon.",
    difficulty: "Beginner",
    board: "microbit-v2",
    estimatedMinutes: 8,
    concepts: ["BBC micro:bit v2", "5x5 LED Matrix", "Matrix Icons", "Animation Loop", "Visual Feedback"],
    prerequisites: [],
    finalGoal: "🎯 What You Will Build: An animated pulsing heartbeat graphic rendered across the 25 integrated red LEDs of the onboard 5×5 LED matrix.",
    seedCircuit: {
      parts: [part("microbit", "microbit-v2", 120, 100)],
      wires: [],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="microbit_show_icon"><field name="ICON">heart</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">600</field></shadow></value><next>
      <block type="microbit_clear"><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place micro:bit v2",
        instructions: "Place a BBC micro:bit v2 board on the workbench. It features an nRF52833 Cortex-M4 MCU, 5x5 LED matrix, and edge ring connectors.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "microbit-v2", count: 1 }] }],
        success: "micro:bit v2 board is ready on the bench.",
      },
      {
        id: "code",
        title: "Program Matrix Heartbeat",
        instructions: "Add a 'micro:bit show icon' block set to 'heart', followed by a 600ms delay, a 'clear display' block, and a 300ms delay.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "microbit_show_icon", count: 1, fields: { ICON: "heart" } },
            { type: "microbit_clear", count: 1 },
            { type: "time_delay", count: 2 },
          ] },
        ],
        success: "Heartbeat matrix animation code constructed.",
      },
      {
        id: "run",
        title: "Simulate Heartbeat",
        instructions: "Click Start Simulation to watch the 25 matrix LEDs pulse with a bright beating heart pattern.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Your micro:bit matrix is beating with life!",
      },
    ],
  },

  {
    id: "lesson-microbit-buttons",
    title: "micro:bit Mission 2 · Buttons A & B Expression Switcher",
    shortTitle: "Tactile Buttons A & B",
    description: "Read the physical pushbuttons A and B built into the micro:bit to display a smiling or sad face on demand.",
    difficulty: "Beginner",
    board: "microbit-v2",
    estimatedMinutes: 10,
    concepts: ["Tactile Inputs", "Button A & B", "Conditional Branches", "Interactive UI", "nRF52833"],
    prerequisites: ["lesson-microbit-heartbeat"],
    finalGoal: "🎯 What You Will Build: An interactive facial expression switcher using physical Buttons A and B to display dynamic emotional icons like Smiles on the LED matrix.",
    seedCircuit: {
      parts: [part("microbit", "microbit-v2", 120, 100)],
      wires: [],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="controls_if">
        <value name="IF0">
          <block type="microbit_button_pressed"><field name="BTN">A</field></block>
        </value>
        <statement name="DO0">
          <block type="microbit_show_icon"><field name="ICON">smile</field></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Examine micro:bit Buttons",
        instructions: "The BBC micro:bit has tactile pushbuttons labeled A on the left and B on the right.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "microbit-v2", count: 1 }] }],
        success: "micro:bit hardware verified.",
      },
      {
        id: "code",
        title: "Code Button Detection",
        instructions: "Use an 'if' block testing 'micro:bit button A is pressed' to show the 'smile' icon.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "microbit_button_pressed", count: 1, fields: { BTN: "A" } },
            { type: "microbit_show_icon", count: 1, fields: { ICON: "smile" } },
            { type: "controls_if", count: 1 },
          ] },
        ],
        success: "Interactive button expression logic is set up.",
      },
      {
        id: "run",
        title: "Test Button Input",
        instructions: "Start the simulator and click Button A on the micro:bit to reveal the glowing smile.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Button presses detected and rendered on the matrix.",
      },
    ],
  },

  {
    id: "lesson-microbit-external-led",
    title: "micro:bit Mission 3 · Alligator Clip External LED (Pin P0)",
    shortTitle: "Pin P0 External LED",
    description: "Connect an external 5mm red LED and current-limiting resistor to the large P0 alligator-clip ring on the edge connector.",
    difficulty: "Beginner",
    board: "microbit-v2",
    estimatedMinutes: 12,
    concepts: ["Edge Connector", "Large Rings", "Pin P0", "Current Limiting", "3.3V Logic Rail"],
    prerequisites: ["lesson-microbit-heartbeat"],
    finalGoal: "🎯 What You Will Build: A safe 3.3V alligator-clip circuit driving an external red LED through a 220Ω resistor connected to large edge ring P0.",
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("resistor-1", "resistor", 280, 220, { resistance: 220 }),
        part("led-1", "led", 420, 220, { color: "red" }),
      ],
      wires: [
        wire("w1", "microbit", "p0", "resistor-1", "a", "#f59e0b"),
        wire("w2", "resistor-1", "b", "led-1", "anode", "#ef4444"),
        wire("w3", "led-1", "cathode", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">0</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">0</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">0</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Circuit Components",
        instructions: "Place a BBC micro:bit, a 220Ω resistor, and a red LED on the canvas.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "resistor", count: 1 },
          { type: "led", count: 1 },
        ] }],
        success: "All components ready.",
      },
      {
        id: "wiring",
        title: "Wire to Edge Pin P0 and GND",
        instructions: "Connect micro:bit P0 to resistor pin a, resistor pin b to LED anode, and LED cathode to micro:bit GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "resistor", pinId: "b" }, to: { partType: "led", pinId: "anode" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "microbit-v2", pinId: "gnd" } },
        ] }],
        success: "External LED circuit correctly wired to P0 ring.",
      },
      {
        id: "code",
        title: "Pulse Pin P0",
        instructions: "Configure pin 0 as OUTPUT and toggle it HIGH and LOW every 500ms in loop.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "io_pinmode", count: 1, fields: { PIN: "0", MODE: "OUTPUT" } },
            { type: "io_digitalwrite", count: 1, fields: { PIN: "0", STATE: "HIGH" } },
            { type: "io_digitalwrite", count: 1, fields: { PIN: "0", STATE: "LOW" } },
          ] },
        ],
        success: "Pin 0 blinking routine generated.",
      },
      {
        id: "run",
        title: "Verify LED Blink",
        instructions: "Run simulation and observe the external red LED flash rhythmically from micro:bit Pin P0.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "External hardware blink accomplished on micro:bit P0!",
      },
    ],
  },

  {
    id: "lesson-microbit-analog-pot",
    title: "micro:bit Mission 4 · Analog Potentiometer on Ring P0",
    shortTitle: "10-Bit ADC on P0",
    description: "Wire a rotary potentiometer to large ring P0 and sample 10-bit analog voltage levels (0..1023) powered by the 3V rail.",
    difficulty: "Beginner",
    board: "microbit-v2",
    estimatedMinutes: 12,
    concepts: ["Analog Input", "10-Bit ADC", "Potentiometer", "Voltage Divider", "3.3V Reference"],
    prerequisites: ["lesson-microbit-external-led"],
    finalGoal: "🎯 What You Will Build: A 10-bit analog-to-digital converter telemetry monitor reading 1024 discrete voltage steps from a potentiometer on edge ring P0.",
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("pot-1", "potentiometer", 320, 200),
      ],
      wires: [
        wire("w1", "microbit", "3v", "pot-1", "t1", "#ef4444"),
        wire("w2", "pot-1", "wiper", "microbit", "p0", "#f59e0b"),
        wire("w3", "pot-1", "t2", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="serial_print">
        <value name="VALUE">
          <block type="io_analogread"><field name="PIN">0</field></block>
        </value>
        <next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Potentiometer",
        instructions: "Add a rotary potentiometer alongside the micro:bit v2.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "potentiometer", count: 1 },
        ] }],
        success: "Parts placed.",
      },
      {
        id: "wiring",
        title: "Wire Potentiometer to 3V, P0 and GND",
        instructions: "Wire potentiometer terminal 1 to micro:bit 3V, wiper to Pin P0, and terminal 2 to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "3v" }, to: { partType: "potentiometer", pinId: "t1" } },
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "potentiometer", pinId: "wiper" } },
          { from: { partType: "microbit-v2", pinId: "gnd" }, to: { partType: "potentiometer", pinId: "t2" } },
        ] }],
        success: "Potentiometer voltage divider connected.",
      },
      {
        id: "code",
        title: "Sample Analog P0",
        instructions: "Use 'analog read pin 0' inside a serial print block with a 100ms delay in loop.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "io_analogread", count: 1, fields: { PIN: "0" } },
            { type: "serial_print", count: 1 },
          ] },
        ],
        success: "ADC sampling routine ready.",
      },
      {
        id: "run",
        title: "Inspect ADC Values",
        instructions: "Start simulation and drag the potentiometer dial to observe readings scale between 0 and 1023 in the Serial Monitor.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "10-bit analog conversion verified.",
      },
    ],
  },

  // =========================================================================
  // BBC MICRO:BIT V2 TIER 2: INTERMEDIATE (Sensors, Sound & Closed Loops)
  // =========================================================================
  {
    id: "lesson-microbit-piezo-melody",
    title: "micro:bit Mission 5 · Piezo Buzzer Doorbell Chime (Pin P0)",
    shortTitle: "Piezo Doorbell Chime",
    description: "Generate musical tones and doorbell chimes by outputting variable PWM frequencies through an external piezo buzzer on Pin P0.",
    difficulty: "Intermediate",
    board: "microbit-v2",
    estimatedMinutes: 15,
    concepts: ["PWM Frequencies", "Piezo Sounder", "Musical Notes", "Square Wave Synthesis", "P0 Output"],
    prerequisites: ["lesson-microbit-analog-pot"],
    finalGoal: "🎯 What You Will Build: An acoustic two-tone melodic entryway chime producing 523Hz (C5) and 659Hz (E5) audio waveforms on edge ring P0.",
    codingHints: [
      "In Loop, place a Tone Play block on Pin 0 with frequency 523 Hz (C5 chime).",
      "Add a Time Delay of 300 ms.",
      "Add a second Tone Play block on Pin 0 with frequency 659 Hz (E5 chime) and a 1000 ms delay.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("buzzer-1", "buzzer", 320, 200),
      ],
      wires: [
        wire("w1", "microbit", "p0", "buzzer-1", "pos", "#f59e0b"),
        wire("w2", "buzzer-1", "neg", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="tone_play"><field name="PIN">0</field><value name="FREQ"><shadow type="math_number"><field name="NUM">523</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value><next>
      <block type="tone_play"><field name="PIN">0</field><value name="FREQ"><shadow type="math_number"><field name="NUM">659</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Piezo Buzzer",
        instructions: "Place a piezo buzzer component beside the micro:bit.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "buzzer", count: 1 },
        ] }],
        success: "Buzzer placed.",
      },
      {
        id: "wiring",
        title: "Wire Buzzer to Pin P0 and GND",
        instructions: "Connect buzzer positive pin to micro:bit P0 and negative pin to micro:bit GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "buzzer", pinId: "neg" }, to: { partType: "microbit-v2", pinId: "gnd" } },
        ] }],
        success: "Piezo buzzer connected to micro:bit P0.",
      },
      {
        id: "code",
        title: "Compose Two-Tone Chime",
        instructions: "Use 'play tone' blocks on pin 0 with frequencies (e.g. 523Hz C5 and 659Hz E5) and appropriate delays.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "tone_play", count: 2, fields: { PIN: "0" } },
          ] },
        ],
        success: "Tone generation blocks programmed.",
      },
      {
        id: "run",
        title: "Simulate Chime",
        instructions: "Run simulation to hear the synthesized audio melody play through the virtual audio engine.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Two-tone chime played successfully!",
      },
    ],
  },

  {
    id: "lesson-microbit-optical-nightlight",
    title: "micro:bit Mission 6 · LDR Light Sensor Nightlight (P1 & P0)",
    shortTitle: "Optical Nightlight (P1/P0)",
    description: "Build an automated twilight nightlight: sample ambient light levels using an LDR on Pin P1 and illuminate a safety LED on Pin P0 when darkness falls.",
    difficulty: "Intermediate",
    board: "microbit-v2",
    estimatedMinutes: 16,
    concepts: ["Photoresistor", "Light Dependent Resistor", "Darkness Detection", "Closed Loop Automation", "P1 ADC & P0 GPIO"],
    prerequisites: ["lesson-microbit-piezo-melody"],
    finalGoal: "🎯 What You Will Build: An autonomous dusk-to-dawn nightlight reading ambient light on analog Pin P1 and automatically triggering a yellow safety LED on Pin P0 when dark.",
    codingHints: [
      "In Setup, configure Pin 0 as OUTPUT for the nightlight LED.",
      "In Loop, read light level using Analog Read on Pin 1 inside an If/Else comparison (< 400).",
      "If light is under 400 (darkness): turn Pin 0 HIGH.",
      "Else: turn Pin 0 LOW.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("ldr-1", "ldr", 260, 160),
        part("resistor-pullup", "resistor", 260, 260, { resistance: 10000 }),
        part("resistor-led", "resistor", 420, 160, { resistance: 220 }),
        part("led-1", "led", 420, 260, { color: "yellow" }),
      ],
      wires: [
        wire("w1", "microbit", "3v", "ldr-1", "t1", "#ef4444"),
        wire("w2", "ldr-1", "t2", "microbit", "p1", "#f59e0b"),
        wire("w3", "ldr-1", "t2", "resistor-pullup", "a", "#f59e0b"),
        wire("w4", "resistor-pullup", "b", "microbit", "gnd", "#1e293b"),
        wire("w5", "microbit", "p0", "resistor-led", "a", "#3b82f6"),
        wire("w6", "resistor-led", "b", "led-1", "anode", "#3b82f6"),
        wire("w7", "led-1", "cathode", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">0</field><field name="MODE">OUTPUT</field></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A"><block type="io_analogread"><field name="PIN">1</field></block></value>
            <value name="B"><shadow type="math_number"><field name="NUM">400</field></shadow></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">0</field><field name="STATE">HIGH</field></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">0</field><field name="STATE">LOW</field></block>
        </statement>
        <next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place LDR and Nightlight Parts",
        instructions: "Place micro:bit, an LDR, a 10kΩ divider resistor, a yellow LED, and a 220Ω resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "ldr", count: 1 },
          { type: "led", count: 1 },
        ] }],
        success: "Sensor and actuator components placed.",
      },
      {
        id: "wiring",
        title: "Wire LDR to P1 and LED to P0",
        instructions: "Wire LDR and 10kΩ divider to 3V, P1, and GND. Wire 220Ω resistor and LED to P0 and GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p1" }, to: { partType: "ldr", pinId: "t2" } },
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "microbit-v2", pinId: "gnd" } },
        ] }],
        success: "Optical divider and nightlight LED wired.",
      },
      {
        id: "code",
        title: "Code Twilight Threshold",
        instructions: "Read analog P1. If light level is less than 400 (darkness), turn on P0 HIGH, else LOW.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "io_analogread", count: 1, fields: { PIN: "1" } },
            { type: "io_digitalwrite", count: 1, fields: { PIN: "0", STATE: "HIGH" } },
            { type: "io_digitalwrite", count: 1, fields: { PIN: "0", STATE: "LOW" } },
          ] },
        ],
        success: "Threshold automation code ready.",
      },
      {
        id: "run",
        title: "Test Ambient Light Response",
        instructions: "Start simulation and drag the LDR light slider below 400. Observe the nightlight LED trigger automatically.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Autonomous twilight sensing works perfectly.",
      },
    ],
  },

  {
    id: "lesson-microbit-climate-temp",
    title: "micro:bit Mission 7 · TMP36 Temperature Station (Pin P0)",
    shortTitle: "TMP36 Thermometer on P0",
    description: "Read millivolts from a precision analog TMP36 temperature sensor on Pin P0, convert to degrees Celsius using 3.3V math, and display the result.",
    difficulty: "Intermediate",
    board: "microbit-v2",
    estimatedMinutes: 18,
    concepts: ["TMP36 Sensor", "Analog Millivolts", "Transfer Function", "3.3V ADC Math", "Celsius Conversion"],
    prerequisites: ["lesson-microbit-optical-nightlight"],
    finalGoal: "🎯 What You Will Build: A precision temperature station measuring millivolts from a TMP36 sensor on Pin P0 and streaming converted Celsius telemetry.",
    codingHints: [
      "In Loop, place a Serial Print block containing the Analog Read block for Pin 0.",
      "Add a Time Delay of 500 ms to sample continuous millivolt temperature data.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("tmp36-1", "tmp36", 320, 200),
      ],
      wires: [
        wire("w1", "microbit", "3v", "tmp36-1", "vcc", "#ef4444"),
        wire("w2", "tmp36-1", "out", "microbit", "p0", "#f59e0b"),
        wire("w3", "tmp36-1", "gnd", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="serial_print">
        <value name="VALUE">
          <block type="io_analogread"><field name="PIN">0</field></block>
        </value>
        <next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place TMP36 Sensor",
        instructions: "Place a TMP36 precision temperature sensor near the micro:bit.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "tmp36", count: 1 },
        ] }],
        success: "Sensor placed.",
      },
      {
        id: "wiring",
        title: "Wire TMP36 to 3V, P0 and GND",
        instructions: "Connect TMP36 VCC to micro:bit 3V, OUT to Pin P0, and GND to micro:bit GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "3v" }, to: { partType: "tmp36", pinId: "vcc" } },
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "tmp36", pinId: "out" } },
          { from: { partType: "microbit-v2", pinId: "gnd" }, to: { partType: "tmp36", pinId: "gnd" } },
        ] }],
        success: "TMP36 circuit wired.",
      },
      {
        id: "code",
        title: "Sample Temperature on P0",
        instructions: "Read analog Pin 0 and print the raw ADC reading to the Serial Monitor with a 500ms delay.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "io_analogread", count: 1, fields: { PIN: "0" } },
            { type: "serial_print", count: 1 },
          ] },
        ],
        success: "Temperature sampling programmed.",
      },
      {
        id: "run",
        title: "Observe Temperature Telemetry",
        instructions: "Run simulation and slide the temperature control to watch sensor output change in real time.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Thermal telemetry operational!",
      },
    ],
  },

  // =========================================================================
  // BBC MICRO:BIT V2 TIER 3: ADVANCED (Robotics, NeoPixels & Multi-Peripherals)
  // =========================================================================
  {
    id: "lesson-microbit-servo-sweep",
    title: "micro:bit Mission 8 · Micro Servo Robotic Sweep (Pin P0)",
    shortTitle: "Servo Robotic Sweep (P0)",
    description: "Generate 50Hz PWM control signals from Pin P0 to smoothly articulate a micro servo motor from 0 to 180 degrees.",
    difficulty: "Advanced",
    board: "microbit-v2",
    estimatedMinutes: 20,
    concepts: ["Servo Motor", "50Hz PWM", "Duty Cycle", "Robotic Articulation", "P0 Control Signal"],
    prerequisites: ["lesson-microbit-climate-temp"],
    finalGoal: "🎯 What You Will Build: A robotic micro servo arm sweeping across 0°, 90°, and 180° calibrated angular targets using 50Hz PWM control on Pin P0.",
    codingHints: [
      "In Loop, command the servo on Pin 0 to 0° using Servo Write, then wait 1000 ms.",
      "Command Servo Write Pin 0 to 90°, then wait 1000 ms.",
      "Command Servo Write Pin 0 to 180°, then wait 1000 ms to complete the sweep cycle.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("servo-1", "servo", 340, 180),
      ],
      wires: [
        wire("w1", "microbit", "p0", "servo-1", "sig", "#f59e0b"),
        wire("w2", "microbit", "3v", "servo-1", "vcc", "#ef4444"),
        wire("w3", "microbit", "gnd", "servo-1", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">180</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
      </next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place Servo Motor",
        instructions: "Place a micro servo motor on the workspace next to the micro:bit.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "servo", count: 1 },
        ] }],
        success: "Servo motor placed.",
      },
      {
        id: "wiring",
        title: "Wire Servo Signal to P0, 3V, and GND",
        instructions: "Connect servo signal wire to micro:bit P0, VCC to 3V, and GND to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "servo", pinId: "sig" } },
          { from: { partType: "microbit-v2", pinId: "3v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "microbit-v2", pinId: "gnd" }, to: { partType: "servo", pinId: "gnd" } },
        ] }],
        success: "Servo wiring complete.",
      },
      {
        id: "code",
        title: "Program Multi-Angle Sweep",
        instructions: "Send servo angles (0°, 90°, and 180°) on pin 0 with 1000ms delay between steps.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "servo_write", count: 3, fields: { PIN: "0" } },
          ] },
        ],
        success: "Servo actuation sweep logic verified.",
      },
      {
        id: "run",
        title: "Simulate Servo Arm Motion",
        instructions: "Run simulation to see the servo horn rotate between 0, 90, and 180 degrees.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Robotic servo articulation running smoothly!",
      },
    ],
  },

  {
    id: "lesson-microbit-neopixel-rainbow",
    title: "micro:bit Mission 9 · WS2812B NeoPixel 8-LED Ring Glow (Pin P0)",
    shortTitle: "NeoPixel Ring on P0",
    description: "Control an 8-LED WS2812B addressable NeoPixel ring via high-speed 800kHz single-wire timing from micro:bit Pin P0.",
    difficulty: "Advanced",
    board: "microbit-v2",
    estimatedMinutes: 22,
    concepts: ["WS2812B NeoPixel", "Addressable RGB", "800kHz Timing", "Color Arrays", "P0 Data Stream"],
    prerequisites: ["lesson-microbit-servo-sweep"],
    finalGoal: "🎯 What You Will Build: An 8-LED WS2812B addressable NeoPixel cyber ring displaying vivid RGB animations streamed over high-speed single-wire data from Pin P0.",
    codingHints: [
      "Target the NeoPixel Ring component connected to Pin P0.",
      "Use the NeoPixel Set Color block to set pixel indices to desired colors (e.g. #ef4444).",
      "Call NeoPixel Show to refresh LED ring hardware output.",
      "Add a Time Delay of 500 ms between animation frames.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("neopixel-ring-1", "neopixel-ring", 320, 180),
      ],
      wires: [
        wire("w1", "microbit", "p0", "neopixel-ring-1", "di", "#f59e0b"),
        wire("w2", "microbit", "3v", "neopixel-ring-1", "vcc", "#ef4444"),
        wire("w3", "microbit", "gnd", "neopixel-ring-1", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="neopixel_set_color"><field name="SENSOR">neopixel-ring-1</field>
        <value name="PIXEL"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="COLOR"><shadow type="text"><field name="TEXT">#ef4444</field></shadow></value>
        <next>
          <block type="neopixel_show"><field name="SENSOR">neopixel-ring-1</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
          </next></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Place NeoPixel 8-LED Ring",
        instructions: "Add a NeoPixel 8-pixel circular RGB module to the workspace.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "neopixel-ring", count: 1 },
        ] }],
        success: "NeoPixel ring in position.",
      },
      {
        id: "wiring",
        title: "Connect DI to P0, VCC to 3V, GND to GND",
        instructions: "Wire the DI (Data Input) pin of the NeoPixel ring to micro:bit P0, VCC to 3V, and GND to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "neopixel-ring", pinId: "di" } },
          { from: { partType: "microbit-v2", pinId: "3v" }, to: { partType: "neopixel-ring", pinId: "vcc" } },
          { from: { partType: "microbit-v2", pinId: "gnd" }, to: { partType: "neopixel-ring", pinId: "gnd" } },
        ] }],
        success: "High-speed addressable bus connected.",
      },
      {
        id: "code",
        title: "Program NeoPixel Illumination",
        instructions: "Use 'NeoPixel set color' and 'NeoPixel show' blocks targeting the ring to illuminate pixels.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "neopixel_set_color", count: 1 },
            { type: "neopixel_show", count: 1 },
          ] },
        ],
        success: "Color animation logic configured.",
      },
      {
        id: "run",
        title: "Run NeoPixel Animation",
        instructions: "Start simulation and observe the NeoPixel LEDs light up in vibrant color.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Addressable RGB ring glowing brilliantly!",
      },
    ],
  },

  {
    id: "lesson-microbit-intruder-alarm",
    title: "micro:bit Mission 10 · PIR Motion & Siren Security System",
    shortTitle: "PIR Security Alarm (P1/P0/P2)",
    description: "Engineer a comprehensive security alert station: detect human motion with a PIR sensor on P1, activate an audible alarm buzzer on P0, and flash an alert LED on P2.",
    difficulty: "Advanced",
    board: "microbit-v2",
    estimatedMinutes: 25,
    concepts: ["PIR Motion Sensor", "Digital Inputs", "Alarm Siren", "Visual Strobe", "Multi-Peripheral Integration"],
    prerequisites: ["lesson-microbit-neopixel-rainbow"],
    finalGoal: "🎯 What You Will Build: A multi-peripheral intrusion alarm system that detects human motion via PIR (P1), triggers an audible siren (P0), flashes a warning strobe (P2), and paints a ghost icon on the matrix.",
    codingHints: [
      "In Setup, configure Pin 1 as INPUT (PIR Sensor) and Pin 2 as OUTPUT (Strobe LED).",
      "In Loop, read Pin 1 with Digital Read inside an If/Else block.",
      "If motion detected: set Pin 2 HIGH, play alarm Tone on Pin 0 (880 Hz), and show 'ghost' icon on 5x5 LED matrix.",
      "Else: set Pin 2 LOW, stop Tone on Pin 0, and clear matrix display.",
    ],
    seedCircuit: {
      parts: [
        part("microbit", "microbit-v2", 60, 80),
        part("pir-1", "pir-sensor", 260, 140),
        part("buzzer-1", "buzzer", 440, 140),
        part("resistor-1", "resistor", 260, 260, { resistance: 220 }),
        part("led-1", "led", 440, 260, { color: "red" }),
      ],
      wires: [
        wire("w1", "microbit", "3v", "pir-1", "vcc", "#ef4444"),
        wire("w2", "pir-1", "out", "microbit", "p1", "#3b82f6"),
        wire("w3", "pir-1", "gnd", "microbit", "gnd", "#1e293b"),
        wire("w4", "microbit", "p0", "buzzer-1", "pos", "#f59e0b"),
        wire("w5", "buzzer-1", "neg", "microbit", "gnd", "#1e293b"),
        wire("w6", "microbit", "p2", "resistor-1", "a", "#ef4444"),
        wire("w7", "resistor-1", "b", "led-1", "anode", "#ef4444"),
        wire("w8", "led-1", "cathode", "microbit", "gnd", "#1e293b"),
      ],
    },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">1</field><field name="MODE">INPUT</field><next>
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="io_digitalread"><field name="PIN">1</field></block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">HIGH</field><next>
          <block type="tone_play"><field name="PIN">0</field><value name="FREQ"><shadow type="math_number"><field name="NUM">880</field></shadow></value><next>
          <block type="microbit_show_icon"><field name="ICON">ghost</field></block>
          </next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">LOW</field><next>
          <block type="tone_stop"><field name="PIN">0</field><next>
          <block type="microbit_clear"></block>
          </next></block></next></block>
        </statement>
        <next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">50</field></shadow></value></block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
    steps: [
      {
        id: "parts",
        title: "Assemble Alarm Hardware",
        instructions: "Place micro:bit, a PIR motion sensor, a piezo buzzer, a 220Ω resistor, and a red LED.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "microbit-v2", count: 1 },
          { type: "pir-sensor", count: 1 },
          { type: "buzzer", count: 1 },
          { type: "led", count: 1 },
        ] }],
        success: "All alarm components assembled on bench.",
      },
      {
        id: "wiring",
        title: "Wire Sensors and Annunciators",
        instructions: "Wire PIR OUT to Pin P1, buzzer positive to Pin P0, and LED anode through 220Ω resistor to Pin P2. Wire common 3V power and GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "microbit-v2", pinId: "p1" }, to: { partType: "pir-sensor", pinId: "out" } },
          { from: { partType: "microbit-v2", pinId: "p0" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "microbit-v2", pinId: "p2" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "microbit-v2", pinId: "gnd" } },
        ] }],
        success: "All sensor and actuator channels connected.",
      },
      {
        id: "code",
        title: "Program Security Logic",
        instructions: "Read digital Pin P1. When motion detected, sound buzzer on P0, light LED on P2, and show the 'ghost' icon on the micro:bit matrix.",
        kind: "code",
        checks: [
          { kind: "blocks", requirements: [
            { type: "io_digitalread", count: 1, fields: { PIN: "1" } },
            { type: "tone_play", count: 1, fields: { PIN: "0" } },
            { type: "io_digitalwrite", count: 1, fields: { PIN: "2", STATE: "HIGH" } },
            { type: "microbit_show_icon", count: 1, fields: { ICON: "ghost" } },
          ] },
        ],
        success: "Security monitoring logic successfully programmed.",
      },
      {
        id: "run",
        title: "Test Security System",
        instructions: "Start simulation and trigger motion on the PIR sensor to verify the simultaneous siren, strobe LED, and ghost matrix icon.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Complete multi-peripheral security system verified!",
      },
    ],
  },
]
