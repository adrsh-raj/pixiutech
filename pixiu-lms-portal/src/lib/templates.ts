import type { CircuitState, PartType } from "./circuit-types"

export type TemplateGrade = 6 | 7 | 8

export interface ProjectTemplate {
  id: string
  title: string
  description: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  tags: string[]
  circuit: CircuitState
  blocklyXml: string
  gradeBand?: TemplateGrade
  unit?: string
  tutorial?: string[]
}

const BASE_TEMPLATES: ProjectTemplate[] = [
  {
    id: "ai-smart-barrier",
    title: "1. 🚗 AI Vision Smart Boom Barrier Gate (Pixiu AI)",
    description: "AI Computer Vision meets Smart Parking! Camera detects approaching vehicle -> swings the striped boom barrier open (90°), turns Green Pass LED on, and streams AI telemetry to Serial Monitor.",
    difficulty: "Intermediate",
    tags: ["AI Vision", "Pixiu AI", "Servo", "Boom Barrier", "Camera"],
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
    id: "esp32-iot-smart-light",
    title: "2. 📱 ESP32 Smart Home Web Server & Phone Controller",
    description: "Connect ESP32 to Virtual Wi-Fi, host a local HTTP Web Server, and control Living Room and Bedroom lights directly from your simulated Smartphone!",
    difficulty: "Intermediate",
    tags: ["ESP32", "Virtual Wi-Fi", "IoT", "Web Server", "Smartphone", "Smart Home"],
    circuit: {
      parts: [
        { id: "esp", type: "esp32-devkit", x: 40, y: 70, rotation: 0, props: {} },
        { id: "r_red", type: "resistor", x: 380, y: 100, rotation: 0, props: { resistance: 220 } },
        { id: "led_red", type: "led", x: 500, y: 100, rotation: 0, props: { color: "red" } },
        { id: "r_blue", type: "resistor", x: 380, y: 220, rotation: 0, props: { resistance: 220 } },
        { id: "led_blue", type: "led", x: 500, y: 220, rotation: 0, props: { color: "blue" } },
      ],
      wires: [
        { id: "w_r1", from: { partId: "esp", pinId: "d4" }, to: { partId: "r_red", pinId: "a" }, color: "#ef4444" },
        { id: "w_r2", from: { partId: "r_red", pinId: "b" }, to: { partId: "led_red", pinId: "anode" }, color: "#ef4444" },
        { id: "w_rgnd", from: { partId: "led_red", pinId: "cathode" }, to: { partId: "esp", pinId: "gnd_r" }, color: "#1e293b" },
        { id: "w_b1", from: { partId: "esp", pinId: "d15" }, to: { partId: "r_blue", pinId: "a" }, color: "#3b82f6" },
        { id: "w_b2", from: { partId: "r_blue", pinId: "b" }, to: { partId: "led_blue", pinId: "anode" }, color: "#3b82f6" },
        { id: "w_bgnd", from: { partId: "led_blue", pinId: "cathode" }, to: { partId: "esp", pinId: "gnd_r" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field><next>
      <block type="io_pinmode"><field name="PIN">4</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">15</field><field name="MODE">OUTPUT</field><next>
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
                  <block type="text_string"><field name="TEXT">&lt;h1&gt;🏠 ESP32 Smart Home&lt;/h1&gt;&lt;p&gt;Tap to control room lights:&lt;/p&gt;&lt;div&gt;&lt;a href="/red/on"&gt;Turn ON Living Room&lt;/a&gt;&lt;a href="/red/off"&gt;Turn OFF Living Room&lt;/a&gt;&lt;/div&gt;&lt;div style="margin-top:10px;"&gt;&lt;a href="/blue/on"&gt;Turn ON Bedroom&lt;/a&gt;&lt;a href="/blue/off"&gt;Turn OFF Bedroom&lt;/a&gt;&lt;/div&gt;</field></block>
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
                    <block type="text_string"><field name="TEXT">&lt;h2 style="color:#ef4444"&gt;🔴 Living Room Light: ON&lt;/h2&gt;&lt;a href="/"&gt;← Back to Dashboard&lt;/a&gt;</field></block>
                  </value>
                </block>
                </next></block>
              </statement>
              <next>
              <block type="wifi_server_on">
                <field name="PATH">/red/off</field>
                <statement name="DO">
                  <block type="io_digitalwrite"><field name="PIN">4</field><field name="STATE">LOW</field><next>
                  <block type="wifi_server_send">
                    <field name="STATUS">200</field>
                    <field name="TYPE">text/html</field>
                    <value name="CONTENT">
                      <block type="text_string"><field name="TEXT">&lt;h2&gt;⚪ Living Room Light: OFF&lt;/h2&gt;&lt;a href="/"&gt;← Back to Dashboard&lt;/a&gt;</field></block>
                    </value>
                  </block>
                  </next></block>
                </statement>
                <next>
                <block type="wifi_server_on">
                  <field name="PATH">/blue/on</field>
                  <statement name="DO">
                    <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">HIGH</field><next>
                    <block type="wifi_server_send">
                      <field name="STATUS">200</field>
                      <field name="TYPE">text/html</field>
                      <value name="CONTENT">
                        <block type="text_string"><field name="TEXT">&lt;h2 style="color:#38bdf8"&gt;🔵 Bedroom Light: ON&lt;/h2&gt;&lt;a href="/"&gt;← Back to Dashboard&lt;/a&gt;</field></block>
                      </value>
                    </block>
                    </next></block>
                  </statement>
                  <next>
                  <block type="wifi_server_on">
                    <field name="PATH">/blue/off</field>
                    <statement name="DO">
                      <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">LOW</field><next>
                      <block type="wifi_server_send">
                        <field name="STATUS">200</field>
                        <field name="TYPE">text/html</field>
                        <value name="CONTENT">
                          <block type="text_string"><field name="TEXT">&lt;h2&gt;⚪ Bedroom Light: OFF&lt;/h2&gt;&lt;a href="/"&gt;← Back to Dashboard&lt;/a&gt;</field></block>
                        </value>
                      </block>
                      </next></block>
                    </statement>
                  </block>
                  </next></block>
                </next></block>
              </next></block>
            </next></block>
          </block>
          </next></block>
        </next></block>
      </next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "blink-led",
    title: "3. Arduino Blink with 220Ω Resistor",
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
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
    </statement>
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
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">11</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">10</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block>
    </statement>
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
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field></block>
      </next></block>
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

const BASE_TEMPLATE_META: Record<string, { gradeBand: TemplateGrade; unit: string; tutorial: string[] }> = {
  "esp32-iot-smart-light": {
    gradeBand: 8,
    unit: "IoT & Cloud",
    tutorial: [
      "Click 'Run' to connect ESP32 to Virtual Wi-Fi and spin up the HTTP Web Server.",
      "Open the 📱 IoT Web Portal in the toolbar to see your Smartphone View.",
      "Tap 'Turn ON Living Room' or 'Turn ON Bedroom' to switch physical LEDs on the canvas in real-time!",
    ],
  },
  "blink-led": { gradeBand: 6, unit: "Digital Output", tutorial: ["Place Arduino, LED and resistor.", "Wire D13 → resistor → LED → GND.", "Run the circuit and observe the blink sequence."] },
  "traffic-light": { gradeBand: 6, unit: "Sequencing", tutorial: ["Place three LEDs and three resistors.", "Connect each LED to its own Arduino output.", "Run the program and observe the red → yellow → green cycle."] },
  "servo-sweep": { gradeBand: 7, unit: "Motion + PWM", tutorial: ["Place Arduino and servo.", "Connect 5V, GND and D9 signal.", "Run 0° → 90° → 180° and observe motion."] },
  "ultrasonic-radar": { gradeBand: 7, unit: "Sensors", tutorial: ["Place HC-SR04 and buzzer.", "Connect TRIG, ECHO, power and alarm.", "Change distance and observe the alarm threshold."] },
  "ai-smart-barrier": { gradeBand: 8, unit: "AI + Automation", tutorial: ["Load the AI barrier project.", "Open AI Vision and enable the camera.", "Run the circuit and observe the automation response."] },
}

function part(id: string, type: PartType, x: number, y: number, props: Record<string, unknown> = {}) {
  return { id, type, x, y, rotation: 0, props }
}

function wire(id: string, fromPartId: string, fromPinId: string, toPartId: string, toPinId: string, color = "#60a5fa") {
  return { id, from: { partId: fromPartId, pinId: fromPinId }, to: { partId: toPartId, pinId: toPinId }, color }
}

function block(type: string, fields: Record<string, string> = {}, values: Record<string, string> = {}) {
  const fieldXml = Object.entries(fields).map(([name, value]) => "<field name=\"" + name + "\">" + value + "</field>").join("")
  const valueXml = Object.entries(values).map(([name, nested]) => "<value name=\"" + name + "\">" + nested + "</value>").join("")
  return "<block type=\"" + type + "\">" + fieldXml + valueXml + "</block>"
}

function withNext(current: string, next: string) {
  return current.replace(/<\/block>$/, "<next>" + next + "</next></block>")
}

function chain(blocks: string[]) {
  let result = blocks[blocks.length - 1] || ""
  for (let i = blocks.length - 2; i >= 0; i -= 1) result = withNext(blocks[i], result)
  return result
}

function numberBlock(value: number) { return block("math_number", { NUM: String(value) }) }
function compareBlock(op: string, left: string, right: string) {
  return "<block type=\"logic_compare\"><field name=\"OP\">" + op + "</field><value name=\"A\">" + left + "</value><value name=\"B\">" + right + "</value></block>"
}
function ifElseBlock(condition: string, whenTrue: string[], whenFalse: string[]) {
  return "<block type=\"controls_if\"><mutation else=\"1\"></mutation><value name=\"IF0\">" + condition + "</value><statement name=\"DO0\">" + chain(whenTrue) + "</statement><statement name=\"ELSE\">" + chain(whenFalse) + "</statement></block>"
}
function sensorBlock(type: string, sensor: string) {
  return block(type, { SENSOR: sensor })
}

function textBlock(value: string) { return block("text_string", { TEXT: value }) }
function pinMode(pin: string, mode: string) { return block("io_pinmode", { PIN: pin, MODE: mode }) }
function digitalWrite(pin: string, state: "HIGH" | "LOW") { return block("io_digitalwrite", { PIN: pin, STATE: state }) }
function analogWrite(pin: string, value: number) { return block("io_analogwrite", { PIN: pin }, { VALUE: numberBlock(value) }) }
function delay(ms: number) { return block("time_delay", {}, { MS: numberBlock(ms) }) }
function serialBegin() { return block("serial_begin", { BAUD: "9600" }) }
function serialPrint(value: string) { return block("serial_print", {}, { TEXT: textBlock(value) }) }
function serialPrintValue(type: string, fields: Record<string, string> = {}) { return block("serial_println", {}, { TEXT: block(type, fields) }) }

function program(setup: string[], loop: string[]) {
  return "<xml xmlns=\"https://developers.google.com/blockly/xml\"><block type=\"arduino_program\" x=\"40\" y=\"40\"><statement name=\"SETUP\">" + chain(setup) + "</statement><statement name=\"LOOP\">" + chain(loop) + "</statement></block></xml>"
}

function starter(id: string, title: string, description: string, gradeBand: TemplateGrade, unit: string, difficulty: ProjectTemplate["difficulty"], tags: string[], circuit: CircuitState, blocklyXml: string, tutorial: string[]): ProjectTemplate {
  return { id, title, description, gradeBand, unit, difficulty, tags, circuit, blocklyXml, tutorial }
}

const EXTRA_TEMPLATES: ProjectTemplate[] = [
  starter("g6-pushbutton-led", "Pushbutton Lamp", "Use a tactile pushbutton as a digital input to control an LED.", 6, "Digital Inputs", "Beginner", ["Pushbutton", "Digital Input", "LED"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",360,100),part("led1","led",540,90,{color:"green"}),part("r1","resistor",540,200,{resistance:220})], wires: [wire("p1","uno","d2","btn","p1a"),wire("p2","btn","p2a","uno","5v","#ef4444"),wire("p3","uno","d13","r1","a","#22c55e"),wire("p4","r1","b","led1","anode","#22c55e"),wire("p5","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(50),
    ]),
    ["Place Arduino, pushbutton, LED and resistor.","Connect the button to a digital input and the LED to D13 through its resistor.","Run the circuit and experiment with the button."]),
  starter("g6-pot-brightness", "Potentiometer LED Dimmer", "Turn a virtual knob and explore analog input mapped to LED brightness.", 6, "Analog Input", "Beginner", ["Potentiometer", "Analog", "PWM"],
    { parts: [part("uno","arduino-uno",60,110),part("pot","potentiometer",330,110,{value:512}),part("led1","led",540,90,{color:"blue"}),part("r1","resistor",540,190,{resistance:220})], wires: [wire("a","uno","5v","pot","t1","#ef4444"),wire("b","uno","gnd","pot","t2","#1e293b"),wire("c","pot","wiper","uno","a0","#eab308"),wire("d","uno","d9","r1","a","#3b82f6"),wire("e","r1","b","led1","anode","#3b82f6"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT")],[
      block("io_analogwrite", { PIN: "9" }, {
        VALUE: "<block type=\"arduino_map\"><value name=\"VALUE\">" + sensorBlock("potentiometer_read", "pot") + "</value><value name=\"FROM_LOW\">" + numberBlock(0) + "</value><value name=\"FROM_HIGH\">" + numberBlock(1023) + "</value><value name=\"TO_LOW\">" + numberBlock(0) + "</value><value name=\"TO_HIGH\">" + numberBlock(255) + "</value></block>",
      }),
      delay(80),
    ]),
    ["Place the potentiometer and LED circuit.","Connect the wiper to A0 and the LED to PWM pin D9.","Move the knob and observe the simulated brightness response."]),
  starter("g6-rgb-mood-lamp", "RGB Mood Lamp", "Drive three colour channels to create a simple RGB mood lamp.", 6, "Multi-Output", "Beginner", ["RGB LED", "Colour", "GPIO"],
    { parts: [part("uno","arduino-uno",60,110),part("rgb","rgb-led",430,100,{})], wires: [wire("r","uno","d9","rgb","red","#ef4444"),wire("g","uno","d10","rgb","green","#22c55e"),wire("b","uno","d11","rgb","blue","#3b82f6"),wire("gnd","uno","gnd","rgb","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT"),pinMode("10","OUTPUT"),pinMode("11","OUTPUT")],[analogWrite("9",255),analogWrite("10",90),analogWrite("11",180),delay(600)]),
    ["Place Arduino and the RGB LED.","Connect the three colour channels to PWM pins.","Change the three output values to create new colours."]),
  starter("g6-buzzer-doorbell", "Smart Doorbell", "Use a pushbutton input and buzzer output for a simple doorbell.", 6, "Digital Inputs + Outputs", "Beginner", ["Pushbutton", "Buzzer", "Digital I/O"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",340,90),part("bz","buzzer",520,160)], wires: [wire("a","uno","d2","btn","p1a"),wire("b","btn","p2a","uno","5v","#ef4444"),wire("c","uno","d8","bz","pos","#facc15"),wire("d","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("8","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("8","HIGH"), delay(250), digitalWrite("8","LOW")],
        [digitalWrite("8","LOW")],
      ),
      delay(50),
    ]),
    ["Place the button, buzzer and Arduino.","Wire the button as the input and buzzer to D8.","Run the circuit and experiment with the timing."]),
  starter("g6-seven-segment", "7-Segment Number Display", "Light a seven-segment display using Arduino digital outputs.", 6, "Displays", "Intermediate", ["7-Segment", "GPIO", "Numbers"],
    { parts: [part("uno","arduino-uno",60,110),part("seg","seven-segment",400,90)], wires: [wire("a","uno","d3","seg","a","#ef4444"),wire("b","uno","d4","seg","b","#f97316"),wire("c","uno","d5","seg","c","#eab308"),wire("d","uno","d6","seg","d","#22c55e"),wire("e","uno","gnd","seg","com","#1e293b")] },
    program([pinMode("3","OUTPUT"),pinMode("4","OUTPUT"),pinMode("5","OUTPUT"),pinMode("6","OUTPUT")],[digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),delay(500)]),
    ["Place the 7-segment display.","Connect several segments to Arduino outputs and the common pin to GND.","Run the display, then change which segments are HIGH."]),
  starter("g6-ldr-night-lamp", "Automatic Night Lamp", "Use an LDR concept circuit to introduce light sensing and automatic output.", 6, "Sensors", "Intermediate", ["LDR", "Analog", "Automation"],
    { parts: [part("uno","arduino-uno",60,110),part("ldr","ldr",330,100),part("led1","led",540,90,{color:"yellow"}),part("r1","resistor",540,190,{resistance:220})], wires: [wire("a","uno","5v","ldr","t1","#ef4444"),wire("b","ldr","t2","uno","a0","#eab308"),wire("c","uno","d13","r1","a","#facc15"),wire("d","r1","b","led1","anode","#facc15"),wire("e","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT")],[
      ifElseBlock(
        compareBlock("LT", sensorBlock("ldr_read", "ldr"), numberBlock(400)),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(100),
    ]),
    ["Build the LDR sensing path and LED output.","Use A0 as the sensor input.","Experiment with the LDR value and decide when the lamp should turn on."]),
  starter("g7-pir-security", "PIR Security Light", "Turn an LED on when a PIR motion sensor reports movement.", 7, "Sensors + Automation", "Intermediate", ["PIR", "Motion", "Security"],
    { parts: [part("uno","arduino-uno",60,110),part("pir","pir-sensor",360,90,{motion:false}),part("led1","led",560,90,{color:"red"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","pir","vcc","#ef4444"),wire("b","uno","gnd","pir","gnd","#1e293b"),wire("c","uno","d7","pir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pir_motion", "pir"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(80),
    ]),
    ["Power the PIR sensor and connect OUT to D7.","Connect the LED to D13 through a resistor.","Trigger motion in the Inspector and observe the light."]),
  starter("g7-tmp36-alert", "TMP36 Temperature Alert", "Read an analog temperature sensor and build a high-temperature alarm concept.", 7, "Analog Sensors", "Intermediate", ["TMP36", "Temperature", "Alarm"],
    { parts: [part("uno","arduino-uno",60,110),part("tmp","tmp36",350,95,{temperature:28}),part("bz","buzzer",560,170)], wires: [wire("a","uno","5v","tmp","vcc","#ef4444"),wire("b","tmp","out","uno","a0","#eab308"),wire("c","tmp","gnd","uno","gnd","#1e293b"),wire("d","uno","d8","bz","pos","#facc15"),wire("e","bz","neg","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("8","OUTPUT")],[
      serialPrintValue("tmp36_temperature", { SENSOR: "tmp" }),
      ifElseBlock(
        compareBlock("GT", sensorBlock("tmp36_temperature", "tmp"), numberBlock(30)),
        [digitalWrite("8","HIGH")],
        [digitalWrite("8","LOW")],
      ),
      delay(500),
    ]),
    ["Wire TMP36 power, ground and Vout to A0.","Place the buzzer on D8.","Adjust temperature in the Inspector and build your own threshold logic."]),
  starter("g7-dht-weather", "DHT11 Weather Station", "Display live temperature and humidity readings from a DHT11 sensor.", 7, "Environmental Sensors", "Intermediate", ["DHT11", "Temperature", "Humidity"],
    { parts: [part("uno","arduino-uno",60,120),part("dht","dht11",420,100,{temperature:25,humidity:55})], wires: [wire("a","uno","5v","dht","vcc","#ef4444"),wire("b","uno","gnd","dht","gnd","#1e293b"),wire("c","uno","d4","dht","data","#60a5fa")] },
    program([serialBegin(),pinMode("4","INPUT")],[serialPrint("Temperature: "),serialPrintValue("dht_temperature"),serialPrint("Humidity: "),serialPrintValue("dht_humidity"),delay(1000)]),
    ["Connect DHT11 VCC, GND and DATA.","Keep temperature and humidity reads in the loop.","Move the DHT11 controls and watch the live values."]),
  starter("g7-soil-smart-farm", "Smart Farm Soil Monitor", "Read soil moisture and use it to drive a farm indicator.", 7, "Smart Farming", "Intermediate", ["Soil Moisture", "Analog", "IoT"],
    { parts: [part("uno","arduino-uno",60,110),part("soil","soil-moisture",350,95,{moisture:620}),part("led1","led",560,90,{color:"green"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","soil","vcc","#ef4444"),wire("b","soil","ao","uno","a0","#eab308"),wire("c","soil","gnd","uno","gnd","#1e293b"),wire("d","uno","d13","r1","a","#22c55e"),wire("e","r1","b","led1","anode","#22c55e"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT")],[
      ifElseBlock(
        compareBlock("GT", sensorBlock("soil_moisture_read", "soil"), numberBlock(600)),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(100),
    ]),
    ["Connect the soil sensor AO line to A0.","Connect an indicator LED to D13.","Change moisture and design a dry-soil alert."]),
  starter("g7-ir-obstacle", "IR Obstacle Indicator", "Use an infrared obstacle sensor to control an indicator LED.", 7, "Digital Sensors", "Intermediate", ["IR Sensor", "Obstacle", "Robotics"],
    { parts: [part("uno","arduino-uno",60,110),part("ir","ir-sensor",350,95,{detected:"false"}),part("led1","led",560,90,{color:"red"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","ir","vcc","#ef4444"),wire("b","uno","gnd","ir","gnd","#1e293b"),wire("c","uno","d7","ir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("ir_read", "ir"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(80),
    ]),
    ["Connect IR VCC, GND and OUT.","Use D7 as the digital input.","Toggle obstacle detection and observe the LED."]),
  starter("g7-encoder-menu", "Rotary Encoder Counter", "Use a rotary encoder to explore incremental user input.", 7, "Human Interface", "Intermediate", ["Rotary Encoder", "Input", "Counter"],
    { parts: [part("uno","arduino-uno",60,110),part("enc","rotary-encoder",380,100,{value:0,pressed:"false"})], wires: [wire("a","uno","5v","enc","vcc","#ef4444"),wire("b","uno","gnd","enc","gnd","#1e293b"),wire("c","uno","d2","enc","clk","#60a5fa"),wire("d","uno","d3","enc","dt","#3b82f6"),wire("e","uno","d4","enc","sw","#a855f7")] },
    program([serialBegin(),pinMode("2","INPUT"),pinMode("3","INPUT"),pinMode("4","INPUT")],[
      serialPrintValue("encoder_read", { SENSOR: "enc" }),
      delay(300),
    ]),
    ["Connect VCC/GND and CLK, DT, SW.","Rotate the virtual encoder in the Inspector.","Use its count for a menu or counter."]),
  starter("g7-servo-door", "Automatic Servo Door", "Use a servo as a miniature automatic door mechanism.", 7, "Robotics", "Intermediate", ["Servo", "Automation", "PWM"],
    { parts: [part("uno","arduino-uno",60,110),part("servo","servo",420,110,{angle:0})], wires: [wire("a","uno","5v","servo","vcc","#ef4444"),wire("b","uno","gnd","servo","gnd","#1e293b"),wire("c","uno","d9","servo","sig","#fb923c")] },
    program([pinMode("9","OUTPUT")],[block("servo_write",{PIN:"9"},{ANGLE:numberBlock(0)}),delay(1000),block("servo_write",{PIN:"9"},{ANGLE:numberBlock(90)}),delay(1000)]),
    ["Power the servo and connect signal to D9.","Use servo-write blocks for closed and open positions.","Run and tune the two angles."]),
  starter("g8-lcd-weather", "LCD Sensor Monitor", "Show changing sensor information on a 16×2 I2C LCD.", 8, "Displays + I2C", "Intermediate", ["LCD", "I2C", "Sensors"],
    { parts: [part("uno","arduino-uno",60,110),part("lcd","lcd-i2c",390,100,{line1:"PIXIU TECH",line2:"READY"})], wires: [wire("a","uno","5v","lcd","vcc","#ef4444"),wire("b","uno","gnd","lcd","gnd","#1e293b"),wire("c","uno","a4","lcd","sda","#60a5fa"),wire("d","uno","a5","lcd","scl","#3b82f6")] },
    program([serialBegin()],[block("lcd_print",{}, {TEXT:textBlock("PIXIU TECH")}),delay(800),block("lcd_clear"),delay(300)]),
    ["Connect LCD power and SDA/SCL.","Use LCD print and clear blocks.","Change the message and observe the virtual display."]),
  starter("g8-oled-dashboard", "OLED Sensor Dashboard", "Build a compact 128×64 OLED dashboard for simulated sensor data.", 8, "Displays + I2C", "Intermediate", ["OLED", "Dashboard", "I2C"],
    { parts: [part("uno","arduino-uno",60,110),part("oled","oled-i2c",390,100,{line1:"PIXIU TECH",line2:"SENSOR DATA",line3:"READY"})], wires: [wire("a","uno","5v","oled","vcc","#ef4444"),wire("b","uno","gnd","oled","gnd","#1e293b"),wire("c","uno","a4","oled","sda","#60a5fa"),wire("d","uno","a5","oled","scl","#3b82f6")] },
    program([serialBegin()],[block("oled_print",{}, {TEXT:textBlock("PIXIU SENSOR")}),delay(600),block("oled_clear"),delay(300)]),
    ["Wire VCC, GND, SDA and SCL.","Print a heading or sensor value to OLED.","Change the text and update it repeatedly."]),
  starter("g8-motor-driver", "Dual Motor Driver", "Control a two-channel L298N driver for a simple robotic drive base.", 8, "Motor Control", "Advanced", ["L298N", "DC Motor", "Robotics"],
    { parts: [part("uno","arduino-uno",60,110),part("drv","l298n",360,95,{speedA:160,speedB:160}),part("bat","battery",230,270,{voltage:9}),part("m1","dc-motor",600,55),part("m2","dc-motor",600,205)], wires: [wire("a","uno","5v","drv","5v","#ef4444"),wire("b","uno","gnd","drv","gnd","#1e293b"),wire("c","bat","pos","drv","vs","#ef4444"),wire("d","bat","neg","uno","gnd","#1e293b"),wire("e","uno","d5","drv","ena","#60a5fa"),wire("f","uno","d7","drv","in1","#60a5fa"),wire("g","uno","d8","drv","in2","#60a5fa"),wire("h","uno","d6","drv","enb","#3b82f6"),wire("i","uno","d9","drv","in3","#3b82f6"),wire("j","uno","d10","drv","in4","#3b82f6"),wire("k","drv","out1","m1","pos","#f97316"),wire("l","drv","out2","m1","neg","#f97316"),wire("m","drv","out3","m2","pos","#f97316"),wire("n","drv","out4","m2","neg","#f97316")] },
    program([pinMode("5","OUTPUT"),pinMode("6","OUTPUT"),pinMode("7","OUTPUT"),pinMode("8","OUTPUT"),pinMode("9","OUTPUT"),pinMode("10","OUTPUT")],[block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),delay(1000),block("motor_driver_write",{CHANNEL:"A",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),block("motor_driver_write",{CHANNEL:"B",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),delay(500)]),
    ["Power VMotor from the battery and share ground with Arduino.","Wire both motor output pairs: OUT1/OUT2 and OUT3/OUT4.","Use the Motor Driver blocks to explore speed and direction."]),
  starter("g8-joystick-rover", "Joystick Rover Controller", "Use a two-axis joystick as the human controller for a rover.", 8, "Robotics + Inputs", "Advanced", ["Joystick", "Rover", "Analog Input"],
    { parts: [part("uno","arduino-uno",60,110),part("joy","joystick",350,95,{x:512,y:512,pressed:"false"}),part("drv","l298n",560,100,{speedA:120,speedB:120})], wires: [wire("a","uno","5v","joy","vcc","#ef4444"),wire("b","uno","gnd","joy","gnd","#1e293b"),wire("c","uno","a0","joy","vrx","#eab308"),wire("d","uno","a1","joy","vry","#22c55e"),wire("e","uno","d2","joy","sw","#a855f7"),wire("f","uno","5v","drv","5v","#ef4444"),wire("g","uno","gnd","drv","gnd","#1e293b")] },
    program([serialBegin()],[serialPrintValue("joystick_x",{SENSOR:"joy"}),serialPrintValue("joystick_y",{SENSOR:"joy"}),delay(200)]),
    ["Connect VRx/VRy to analog inputs.","Move the joystick in the Inspector.","Use X/Y values to design left-right steering."]),
  starter("g8-keypad-lock", "Keypad Access Lock", "Explore matrix keypad input as a simple digital access-control interface.", 8, "Human Interface", "Advanced", ["Keypad", "Security", "Input"],
    { parts: [part("uno","arduino-uno",60,110),part("keypad","keypad-4x4",380,90,{lastKey:""}),part("led1","led",590,90,{color:"green"}),part("r1","resistor",590,190,{resistance:220})], wires: [wire("a","uno","d2","keypad","r1","#60a5fa"),wire("b","uno","d3","keypad","r2","#60a5fa"),wire("c","uno","d4","keypad","r3","#60a5fa"),wire("d","uno","d5","keypad","r4","#60a5fa"),wire("e","uno","d6","keypad","c1","#3b82f6"),wire("f","uno","d7","keypad","c2","#3b82f6"),wire("g","uno","d8","keypad","c3","#3b82f6"),wire("h","uno","d9","keypad","c4","#3b82f6"),wire("i","uno","d13","r1","a","#22c55e"),wire("j","r1","b","led1","anode","#22c55e"),wire("k","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT")],[serialPrintValue("keypad_read",{SENSOR:"keypad"}),digitalWrite("13","HIGH"),delay(200),digitalWrite("13","LOW"),delay(800)]),
    ["Connect the keypad row and column lines.","Press keys using the virtual keypad controls.","Use keypad input to build a simple PIN indicator."]),
  starter("g8-relay-home", "Smart Home Relay", "Switch a virtual relay from an Arduino output to model simple automation.", 8, "Automation", "Advanced", ["Relay", "Automation", "Smart Home"],
    { parts: [part("uno","arduino-uno",60,110),part("relay","relay",380,100),part("led1","led",590,90,{color:"blue"}),part("r1","resistor",590,190,{resistance:220})], wires: [wire("a","uno","5v","relay","vcc","#ef4444"),wire("b","uno","gnd","relay","gnd","#1e293b"),wire("c","uno","d8","relay","in","#facc15"),wire("d","relay","no","r1","a","#60a5fa"),wire("e","r1","b","led1","anode","#3b82f6"),wire("f","led1","cathode","relay","com","#1e293b")] },
    program([pinMode("8","OUTPUT")],[digitalWrite("8","HIGH"),delay(900),digitalWrite("8","LOW"),delay(900)]),
    ["Connect relay power and the Arduino control input.","Use the NO/COM path for the load indicator.","Run the circuit and observe the switching cycle."]),
]

export const TEMPLATES: ProjectTemplate[] = BASE_TEMPLATES.map((template) => {
  const meta = BASE_TEMPLATE_META[template.id]
  return meta ? { ...template, ...meta } : template
}).concat(EXTRA_TEMPLATES)