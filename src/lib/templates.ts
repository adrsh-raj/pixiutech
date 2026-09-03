import type { CircuitState } from "./circuit-types"

export interface ProjectTemplate {
  id: string
  title: string
  description: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  tags: string[]
  circuit: CircuitState
  blocklyXml: string
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "ai-smart-barrier",
    title: "1. 🚗 AI Vision Smart Boom Barrier Gate (PictoBlox Style)",
    description: "AI Computer Vision meets Smart Parking! Camera detects approaching vehicle -> swings the striped boom barrier open (90°), turns Green Pass LED on, and streams AI telemetry to Serial Monitor.",
    difficulty: "Intermediate",
    tags: ["AI Vision", "PictoBlox", "Servo", "Boom Barrier", "Camera"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
        { id: "gate", type: "servo", x: 430, y: 70, rotation: 0, props: { arm: "barrier", angle: 0 } },
        { id: "led_green", type: "led", x: 600, y: 60, rotation: 0, props: { color: "green" } },
        { id: "r_green", type: "resistor", x: 600, y: 150, rotation: 0, props: { resistance: 220 } },
        { id: "led_red", type: "led", x: 440, y: 220, rotation: 0, props: { color: "red" } },
        { id: "r_red", type: "resistor", x: 540, y: 220, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w_gvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "gate", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_ggnd", from: { partId: "gate", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_gsig", from: { partId: "uno", pinId: "d6" }, to: { partId: "gate", pinId: "sig" }, color: "#f97316" },
        { id: "w_r1", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_green", pinId: "a" }, color: "#22c55e" },
        { id: "w_r2", from: { partId: "r_green", pinId: "b" }, to: { partId: "led_green", pinId: "anode" }, color: "#22c55e" },
        { id: "w_lgnd", from: { partId: "led_green", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_r3", from: { partId: "uno", pinId: "d13" }, to: { partId: "r_red", pinId: "a" }, color: "#ef4444" },
        { id: "w_r4", from: { partId: "r_red", pinId: "b" }, to: { partId: "led_red", pinId: "anode" }, color: "#ef4444" },
        { id: "w_lrgnd", from: { partId: "led_red", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="ai_is_detected"><field name="CLASS">car</field></block>
        </value>
        <statement name="DO0">
          <block type="serial_println"><value name="TEXT"><block type="text_string"><field name="TEXT">🚗 [AI Vision] Car Detected! Raising Boom Barrier...</field></block></value><next>
          <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value></block>
          </next></block></next></block></next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="servo_write"><field name="PIN">6</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value></block>
          </next></block></next></block></next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "blink-led",
    title: "2. Arduino Blink with 220Ω Resistor",
    description: "The classic 'Hello World' of electronics. Learn how current-limiting resistors protect LEDs from burning out.",
    difficulty: "Beginner",
    tags: ["LED", "Resistor", "Digital Output"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "led1", type: "led", x: 440, y: 100, rotation: 0, props: { color: "red" } },
        { id: "r1", type: "resistor", x: 440, y: 220, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#39d98a" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#39d98a" },
        { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="io_digitalwrite">
        <field name="PIN">13</field>
        <field name="STATE">HIGH</field>
        <next>
          <block type="time_delay">
            <value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
            <next>
              <block type="io_digitalwrite">
                <field name="PIN">13</field>
                <field name="STATE">LOW</field>
                <next>
                  <block type="time_delay">
                    <value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "traffic-light",
    title: "2. Traffic Light Simulator",
    description: "Simulate a Red-Yellow-Green city traffic intersection sequence.",
    difficulty: "Beginner",
    tags: ["Traffic", "LEDs", "Sequencing"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "red_led", type: "led", x: 420, y: 60, rotation: 0, props: { color: "red" } },
        { id: "yellow_led", type: "led", x: 420, y: 150, rotation: 0, props: { color: "yellow" } },
        { id: "green_led", type: "led", x: 420, y: 240, rotation: 0, props: { color: "green" } },
        { id: "r1", type: "resistor", x: 500, y: 60, rotation: 0, props: { resistance: 220 } },
        { id: "r2", type: "resistor", x: 500, y: 150, rotation: 0, props: { resistance: 220 } },
        { id: "r3", type: "resistor", x: 500, y: 240, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d12" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "red_led", pinId: "anode" }, color: "#ef4444" },
        { id: "w3", from: { partId: "red_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
        { id: "w4", from: { partId: "uno", pinId: "d11" }, to: { partId: "r2", pinId: "a" }, color: "#fbbf24" },
        { id: "w5", from: { partId: "r2", pinId: "b" }, to: { partId: "yellow_led", pinId: "anode" }, color: "#fbbf24" },
        { id: "w6", from: { partId: "yellow_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
        { id: "w7", from: { partId: "uno", pinId: "d10" }, to: { partId: "r3", pinId: "a" }, color: "#22c55e" },
        { id: "w8", from: { partId: "r3", pinId: "b" }, to: { partId: "green_led", pinId: "anode" }, color: "#22c55e" },
        { id: "w9", from: { partId: "green_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">3000</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">3000</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "servo-sweep",
    title: "3. Robotic Servo Motor Sweep",
    description: "Sweep a servo back and forth between 0° and 180°.",
    difficulty: "Intermediate",
    tags: ["Servo", "Robotics", "PWM"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "servo1", type: "servo", x: 440, y: 120, rotation: 0, props: { angle: 90 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#64748b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#fb923c" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">180</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "ultrasonic-radar",
    title: "4. Ultrasonic Distance Sensor & Buzzer Alarm",
    description: "HC-SR04 ultrasonic distance radar. Prints distance to Serial Monitor and triggers alarm.",
    difficulty: "Advanced",
    tags: ["Ultrasonic", "Serial", "Sensors"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "sonar", type: "ultrasonic", x: 440, y: 80, rotation: 0, props: { distance: 45 } },
        { id: "buzzer1", type: "buzzer", x: 460, y: 220, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#64748b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" }, color: "#60a5fa" },
        { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" }, color: "#38bdf8" },
        { id: "w5", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer1", pinId: "pos" }, color: "#eab308" },
        { id: "w6", from: { partId: "buzzer1", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field></block>
    </statement>
    <statement name="LOOP">
      <block type="serial_print"><value name="TEXT"><block type="text_string"><field name="TEXT">Target Distance: </field></block></value><next>
      <block type="serial_print"><value name="TEXT"><block type="ultrasonic_read"><field name="TRIG">9</field><field name="ECHO">10</field></block></value><next>
      <block type="serial_println"><value name="TEXT"><block type="text_string"><field name="TEXT"> cm</field></block></value><next>
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">LT</field>
            <value name="A">
              <block type="ultrasonic_read"><field name="TRIG">9</field><field name="ECHO">10</field></block>
            </value>
            <value name="B">
              <block type="math_number"><field name="NUM">30</field></block>
            </value>
          </block>
        </value>
        <statement name="DO0">
          <block type="serial_println"><value name="TEXT"><block type="text_string"><field name="TEXT">⚠️ DANGER (&lt;30cm): Sounding Alarm!</field></block></value><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field></block>
          </next></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field></block>
        </statement>
        <next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value></block>
        </next>
      </block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
]
