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
    id: "microbit-emotion-bot",
    title: "3. 🐶 BBC micro:bit v2 Virtual Pet & Emotion Companion",
    description: "An animated digital companion! The 5x5 LED Matrix displays dynamic heart and smile expressions, wags its servo tail, and chirps happy greeting tones.",
    difficulty: "Beginner",
    tags: ["micro:bit", "5x5 LED Matrix", "Virtual Pet", "Servo", "Buzzer"],
    circuit: {
      parts: [
        { id: "mb", type: "microbit-v2", x: 60, y: 80, rotation: 0, props: {} },
        { id: "srv", type: "servo", x: 420, y: 70, rotation: 0, props: { angle: 90 } },
        { id: "bz", type: "buzzer", x: 430, y: 200, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w_pwr", from: { partId: "mb", pinId: "v33" }, to: { partId: "srv", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_gnd", from: { partId: "mb", pinId: "gnd" }, to: { partId: "srv", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_sig", from: { partId: "mb", pinId: "p0" }, to: { partId: "srv", pinId: "sig" }, color: "#f97316" },
        { id: "w_bz_pos", from: { partId: "mb", pinId: "p1" }, to: { partId: "bz", pinId: "pos" }, color: "#eab308" },
        { id: "w_bz_neg", from: { partId: "mb", pinId: "gnd" }, to: { partId: "bz", pinId: "neg" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field><next>
      <block type="microbit_show_icon"><field name="ICON">heart</field><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="microbit_show_icon"><field name="ICON">heart</field><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">135</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">1</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">1</field><field name="STATE">LOW</field><next>
      <block type="microbit_show_icon"><field name="ICON">smile</field><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">45</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">0</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "pico-oled-arcade",
    title: "4. 🕹️ Raspberry Pi Pico Retro OLED Arcade Console",
    description: "Build an interactive 8-bit gaming console on the RP2040! Displays high-score telemetry on 128×64 OLED, chirps laser audio on buzzer, and strobes a green blaster indicator.",
    difficulty: "Intermediate",
    tags: ["Raspberry Pi Pico", "OLED", "Gaming", "Buzzer", "Pushbutton"],
    circuit: {
      parts: [
        { id: "pico", type: "rpi-pico", x: 50, y: 80, rotation: 0, props: {} },
        { id: "oled", type: "oled-i2c", x: 390, y: 60, rotation: 0, props: { line1: "🎮 PICO ARCADE", line2: "HI-SCORE: 9850", line3: "READY TO PLAY" } },
        { id: "btn", type: "pushbutton", x: 390, y: 200, rotation: 0, props: {} },
        { id: "bz", type: "buzzer", x: 560, y: 200, rotation: 0, props: {} },
        { id: "led1", type: "led", x: 580, y: 60, rotation: 0, props: { color: "green" } },
        { id: "r1", type: "resistor", x: 580, y: 130, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w_ovcc", from: { partId: "pico", pinId: "3v3" }, to: { partId: "oled", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_ognd", from: { partId: "pico", pinId: "gnd_2" }, to: { partId: "oled", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_osda", from: { partId: "pico", pinId: "gp4" }, to: { partId: "oled", pinId: "sda" }, color: "#60a5fa" },
        { id: "w_oscl", from: { partId: "pico", pinId: "gp5" }, to: { partId: "oled", pinId: "scl" }, color: "#3b82f6" },
        { id: "w_bpwr", from: { partId: "pico", pinId: "3v3" }, to: { partId: "btn", pinId: "p1a" }, color: "#ef4444" },
        { id: "w_bsig", from: { partId: "btn", pinId: "p2a" }, to: { partId: "pico", pinId: "gp14" }, color: "#22c55e" },
        { id: "w_bzpos", from: { partId: "pico", pinId: "gp15" }, to: { partId: "bz", pinId: "pos" }, color: "#eab308" },
        { id: "w_bzgnd", from: { partId: "bz", pinId: "neg" }, to: { partId: "pico", pinId: "gnd_3" }, color: "#1e293b" },
        { id: "w_lr", from: { partId: "pico", pinId: "gp16" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
        { id: "w_la", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
        { id: "w_lgnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "pico", pinId: "gnd_3" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field><next>
      <block type="io_pinmode"><field name="PIN">14</field><field name="MODE">INPUT</field><next>
      <block type="io_pinmode"><field name="PIN">15</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">16</field><field name="MODE">OUTPUT</field><next>
      <block type="oled_print"><value name="TEXT"><block type="text_string"><field name="TEXT">🎮 PICO ARCADE</field></block></value></block>
      </next></block></next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="io_digitalread"><field name="PIN">14</field></block>
        </value>
        <statement name="DO0">
          <block type="oled_print"><value name="TEXT"><block type="text_string"><field name="TEXT">&gt;&gt; LASER FIRED! &lt;&lt;</field></block></value><next>
          <block type="io_digitalwrite"><field name="PIN">16</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">120</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">15</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">16</field><field name="STATE">LOW</field>
          </block></next></block></next></block></next></block></next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="oled_print"><value name="TEXT"><block type="text_string"><field name="TEXT">HI-SCORE: 9850</field></block></value><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value>
          </block></next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "esp32-weather-telemetry",
    title: "5. ⛅ ESP32 IoT Weather Station & Smartphone Telemetry",
    description: "Read digital DHT11 climate temperature & humidity and ambient light level, and stream dynamic live environmental telemetry straight to your simulated smartphone!",
    difficulty: "Advanced",
    tags: ["ESP32", "DHT11", "LDR", "IoT", "Telemetry", "Smartphone"],
    circuit: {
      parts: [
        { id: "esp", type: "esp32-devkit", x: 40, y: 70, rotation: 0, props: {} },
        { id: "dht", type: "dht11", x: 380, y: 60, rotation: 0, props: { temperature: 27, humidity: 62 } },
        { id: "ldr", type: "ldr", x: 380, y: 190, rotation: 0, props: { light: 650 } },
        { id: "led_ok", type: "led", x: 550, y: 190, rotation: 0, props: { color: "green" } },
        { id: "r_led", type: "resistor", x: 550, y: 110, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w_dvcc", from: { partId: "esp", pinId: "v33" }, to: { partId: "dht", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_dgnd", from: { partId: "esp", pinId: "gnd_l" }, to: { partId: "dht", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_ddat", from: { partId: "esp", pinId: "d4" }, to: { partId: "dht", pinId: "data" }, color: "#60a5fa" },
        { id: "w_lvcc", from: { partId: "esp", pinId: "v33" }, to: { partId: "ldr", pinId: "t1" }, color: "#ef4444" },
        { id: "w_lsig", from: { partId: "ldr", pinId: "t2" }, to: { partId: "esp", pinId: "d34" }, color: "#eab308" },
        { id: "w_l1", from: { partId: "esp", pinId: "d2" }, to: { partId: "r_led", pinId: "a" }, color: "#22c55e" },
        { id: "w_l2", from: { partId: "r_led", pinId: "b" }, to: { partId: "led_ok", pinId: "anode" }, color: "#22c55e" },
        { id: "w_lgnd", from: { partId: "led_ok", pinId: "cathode" }, to: { partId: "esp", pinId: "gnd_l" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">115200</field><next>
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">OUTPUT</field><next>
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
              <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">HIGH</field><next>
              <block type="wifi_server_send">
                <field name="STATUS">200</field>
                <field name="TYPE">text/html</field>
                <value name="CONTENT">
                  <block type="text_string"><field name="TEXT">&lt;h1&gt;⛅ ESP32 Cloud Weather&lt;/h1&gt;&lt;div style="background:#0f172a;padding:12px;border-radius:8px;"&gt;&lt;h3 style="color:#38bdf8;"&gt;🌡️ Temperature: 27°C&lt;/h3&gt;&lt;h3 style="color:#22c55e;"&gt;💧 Humidity: 62%&lt;/h3&gt;&lt;h3 style="color:#eab308;"&gt;☀️ Ambient Light: 650 Lux&lt;/h3&gt;&lt;/div&gt;&lt;p style="color:#94a3b8;"&gt;Live Virtual Wi-Fi telemetry stream active.&lt;/p&gt;</field></block>
                </value>
              </block>
              </next></block>
            </statement>
          </block>
          </next></block>
        </next></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "ultrasonic-radar-scanner",
    title: "6. 📡 Robotic 180° Sonar Radar Scanner (Servo + Proximity Bar)",
    description: "Build an active sonar radar! Servo sweeps 30° to 150° carrying ultrasonic distance sensor, alerting with a color-coded Red-Yellow-Green proximity LED bar and rapid beeper.",
    difficulty: "Advanced",
    tags: ["Servo", "Ultrasonic", "Radar", "Proximity Bar", "Buzzer"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
        { id: "servo", type: "servo", x: 340, y: 60, rotation: 0, props: { angle: 90 } },
        { id: "sonar", type: "ultrasonic", x: 470, y: 60, rotation: 0, props: { distance: 22 } },
        { id: "buzzer", type: "buzzer", x: 340, y: 200, rotation: 0, props: {} },
        { id: "led_r", type: "led", x: 630, y: 50, rotation: 0, props: { color: "red" } },
        { id: "res_r", type: "resistor", x: 710, y: 50, rotation: 0, props: { resistance: 220 } },
        { id: "led_y", type: "led", x: 630, y: 130, rotation: 0, props: { color: "yellow" } },
        { id: "res_y", type: "resistor", x: 710, y: 130, rotation: 0, props: { resistance: 220 } },
        { id: "led_g", type: "led", x: 630, y: 210, rotation: 0, props: { color: "green" } },
        { id: "res_g", type: "resistor", x: 710, y: 210, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w_svcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_sgnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_ssig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo", pinId: "sig" }, color: "#f97316" },
        { id: "w_uvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_ugnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_utrig", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "trig" }, color: "#60a5fa" },
        { id: "w_uecho", from: { partId: "uno", pinId: "d11" }, to: { partId: "sonar", pinId: "echo" }, color: "#38bdf8" },
        { id: "w_bzpos", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w_bzgnd", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_r1", from: { partId: "uno", pinId: "d12" }, to: { partId: "res_r", pinId: "a" }, color: "#ef4444" },
        { id: "w_r2", from: { partId: "res_r", pinId: "b" }, to: { partId: "led_r", pinId: "anode" }, color: "#ef4444" },
        { id: "w_rgnd", from: { partId: "led_r", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_y1", from: { partId: "uno", pinId: "d7" }, to: { partId: "res_y", pinId: "a" }, color: "#fbbf24" },
        { id: "w_y2", from: { partId: "res_y", pinId: "b" }, to: { partId: "led_y", pinId: "anode" }, color: "#fbbf24" },
        { id: "w_ygnd", from: { partId: "led_y", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_g1", from: { partId: "uno", pinId: "d6" }, to: { partId: "res_g", pinId: "a" }, color: "#22c55e" },
        { id: "w_g2", from: { partId: "res_g", pinId: "b" }, to: { partId: "led_g", pinId: "anode" }, color: "#22c55e" },
        { id: "w_ggnd2", from: { partId: "led_g", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">7</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">6</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">45</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value><next>
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare"><field name="OP">LT</field>
            <value name="A"><block type="ultrasonic_read"><field name="TRIG">10</field><field name="ECHO">11</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">25</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">7</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">6</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">150</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field></block>
          </next></block></next></block></next></block></next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">7</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">6</field><field name="STATE">HIGH</field></block>
          </next></block></next></block>
        </statement>
        <next>
        <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">135</field></shadow></value><next>
        <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value>
        </block></next></block>
        </next>
      </block>
      </next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "neopixel-disco-visualizer",
    title: "7. 🌈 NeoPixel 8x RGB Rainbow Audio Visualizer & Mood Lamp",
    description: "Addressable WS2812B circular NeoPixel ring controlled by analog potentiometer knob, cycling dynamic rainbow hues and pitch audio tones in real-time!",
    difficulty: "Intermediate",
    tags: ["NeoPixel", "WS2812B", "RGB", "Potentiometer", "Audio"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
        { id: "neo", type: "neopixel-ring", x: 380, y: 70, rotation: 0, props: { numPixels: 8, brightness: 220, pattern: "rainbow", color: "#38bdf8" } },
        { id: "pot", type: "potentiometer", x: 540, y: 70, rotation: 0, props: { value: 650 } },
        { id: "buzzer", type: "buzzer", x: 540, y: 200, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w_nvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "neo", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_ngnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "neo", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_nsig", from: { partId: "uno", pinId: "d6" }, to: { partId: "neo", pinId: "di" }, color: "#a855f7" },
        { id: "w_pvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "pot", pinId: "t1" }, color: "#ef4444" },
        { id: "w_pgnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "pot", pinId: "t2" }, color: "#1e293b" },
        { id: "w_pwp", from: { partId: "pot", pinId: "wiper" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
        { id: "w_bzpos", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w_bzgnd", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="neopixel_show"><field name="SENSOR">neo</field></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="neopixel_set_color"><field name="SENSOR">neo</field><value name="PIXEL"><block type="math_number"><field name="NUM">0</field></block></value><value name="COLOR"><block type="text_string"><field name="TEXT">#ef4444</field></block></value><next>
      <block type="neopixel_set_color"><field name="SENSOR">neo</field><value name="PIXEL"><block type="math_number"><field name="NUM">1</field></block></value><value name="COLOR"><block type="text_string"><field name="TEXT">#38bdf8</field></block></value><next>
      <block type="neopixel_show"><field name="SENSOR">neo</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">150</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "mq2-gas-safety-hub",
    title: "8. 🚨 Smart Fire & Gas Leak Hazard Controller (Ventilation Servo + Siren)",
    description: "Detect LPG, smoke, or methane with the MQ-2 sensor. Crossing the danger threshold flashes the LCD alert, sounds the siren, and swings the emergency exhaust vent open (90°).",
    difficulty: "Advanced",
    tags: ["MQ-2 Gas", "Fire Safety", "LCD", "Servo", "Siren Alarm"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
        { id: "mq2", type: "mq2-gas", x: 330, y: 50, rotation: 0, props: { gasLevel: 180, threshold: 300 } },
        { id: "lcd", type: "lcd-i2c", x: 490, y: 50, rotation: 0, props: { line1: "AIR QUALITY: OK", line2: "PIXIU SMART HOME" } },
        { id: "servo", type: "servo", x: 490, y: 190, rotation: 0, props: { angle: 0 } },
        { id: "buzzer", type: "buzzer", x: 670, y: 190, rotation: 0, props: {} },
        { id: "led_alert", type: "led", x: 670, y: 50, rotation: 0, props: { color: "red" } },
        { id: "r_alert", type: "resistor", x: 740, y: 50, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w_mvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "mq2", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_mgnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "mq2", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_mao", from: { partId: "mq2", pinId: "ao" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
        { id: "w_lvcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "lcd", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_lgnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "lcd", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_lsda", from: { partId: "uno", pinId: "a4" }, to: { partId: "lcd", pinId: "sda" }, color: "#60a5fa" },
        { id: "w_lscl", from: { partId: "uno", pinId: "a5" }, to: { partId: "lcd", pinId: "scl" }, color: "#3b82f6" },
        { id: "w_svcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo", pinId: "vcc" }, color: "#ef4444" },
        { id: "w_sgnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_ssig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo", pinId: "sig" }, color: "#f97316" },
        { id: "w_bzpos", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w_bzgnd", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w_lr1", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_alert", pinId: "a" }, color: "#ef4444" },
        { id: "w_lr2", from: { partId: "r_alert", pinId: "b" }, to: { partId: "led_alert", pinId: "anode" }, color: "#ef4444" },
        { id: "w_lrgnd", from: { partId: "led_alert", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="lcd_print"><value name="TEXT"><block type="text_string"><field name="TEXT">AIR QUALITY: OK</field></block></value></block>
      </next></block></next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare"><field name="OP">GT</field>
            <value name="A"><block type="mq2_gas_read"><field name="SENSOR">mq2</field></block></value>
            <value name="B"><block type="math_number"><field name="NUM">300</field></block></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="lcd_clear"><next>
          <block type="lcd_print"><value name="TEXT"><block type="text_string"><field name="TEXT">HAZARD DETECTED!</field></block></value><next>
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value>
          </block></next></block></next></block></next></block></next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value>
          </block></next></block></next></block></next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "traffic-light",
    title: "9. 🚦 City Traffic Intersection with Acoustic Pedestrian Crosswalk",
    description: "Realistic city traffic light intersection featuring Red-Yellow-Green sequencing paired with a pedestrian acoustic chime beacon.",
    difficulty: "Beginner",
    tags: ["Traffic", "LEDs", "Pedestrian Crosswalk", "Buzzer", "Sequencing"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "red_led", type: "led", x: 420, y: 60, rotation: 0, props: { color: "red" } },
        { id: "yellow_led", type: "led", x: 420, y: 140, rotation: 0, props: { color: "yellow" } },
        { id: "green_led", type: "led", x: 420, y: 220, rotation: 0, props: { color: "green" } },
        { id: "r1", type: "resistor", x: 500, y: 60, rotation: 0, props: { resistance: 220 } },
        { id: "r2", type: "resistor", x: 500, y: 140, rotation: 0, props: { resistance: 220 } },
        { id: "r3", type: "resistor", x: 500, y: 220, rotation: 0, props: { resistance: 220 } },
        { id: "buzzer", type: "buzzer", x: 620, y: 140, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d12" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "red_led", pinId: "anode" }, color: "#ef4444" },
        { id: "w3", from: { partId: "red_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w4", from: { partId: "uno", pinId: "d11" }, to: { partId: "r2", pinId: "a" }, color: "#fbbf24" },
        { id: "w5", from: { partId: "r2", pinId: "b" }, to: { partId: "yellow_led", pinId: "anode" }, color: "#fbbf24" },
        { id: "w6", from: { partId: "yellow_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w7", from: { partId: "uno", pinId: "d10" }, to: { partId: "r3", pinId: "a" }, color: "#22c55e" },
        { id: "w8", from: { partId: "r3", pinId: "b" }, to: { partId: "green_led", pinId: "anode" }, color: "#22c55e" },
        { id: "w9", from: { partId: "green_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w10", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w11", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">11</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">10</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">2500</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">2000</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "blink-led",
    title: "10. 🚨 Dual Alternating Police Strobe (Red & Blue LEDs)",
    description: "Learn current-limiting resistor protection with dynamic dual-LED police strobe alternating between Red (D13) and Blue (D12).",
    difficulty: "Beginner",
    tags: ["LED", "Dual Strobe", "Resistor", "Digital Output"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "led1", type: "led", x: 440, y: 90, rotation: 0, props: { color: "red" } },
        { id: "r1", type: "resistor", x: 440, y: 170, rotation: 0, props: { resistance: 220 } },
        { id: "led2", type: "led", x: 560, y: 90, rotation: 0, props: { color: "blue" } },
        { id: "r2", type: "resistor", x: 560, y: 170, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
        { id: "w2", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
        { id: "w3", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w4", from: { partId: "uno", pinId: "d12" }, to: { partId: "r2", pinId: "a" }, color: "#3b82f6" },
        { id: "w5", from: { partId: "r2", pinId: "b" }, to: { partId: "led2", pinId: "anode" }, color: "#3b82f6" },
        { id: "w6", from: { partId: "led2", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">400</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "servo-sweep",
    title: "11. 🦾 Robotic Servo Motor Sweep & Angle Positioner",
    description: "Sweep a precision servo motor back and forth between 0°, 90°, and 180° with PWM angle control.",
    difficulty: "Intermediate",
    tags: ["Servo", "Robotics", "PWM", "Actuator"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "servo1", type: "servo", x: 440, y: 120, rotation: 0, props: { angle: 90 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#fb923c" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">180</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">800</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "ultrasonic-radar",
    title: "12. 📏 Ultrasonic Distance Sensor & Buzzer Proximity Alarm",
    description: "HC-SR04 ultrasonic distance radar. Prints distance to Serial Monitor and triggers audible buzzer alarm when an obstacle enters within 30cm.",
    difficulty: "Advanced",
    tags: ["Ultrasonic", "Serial", "Proximity", "Sensors"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "sonar", type: "ultrasonic", x: 440, y: 80, rotation: 0, props: { distance: 45 } },
        { id: "buzzer1", type: "buzzer", x: 460, y: 220, rotation: 0, props: {} },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" }, color: "#60a5fa" },
        { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" }, color: "#38bdf8" },
        { id: "w5", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer1", pinId: "pos" }, color: "#eab308" },
        { id: "w6", from: { partId: "buzzer1", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
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
  "ai-smart-barrier": {
    gradeBand: 8,
    unit: "AI + Automation",
    tutorial: [
      "Load the AI barrier project and enable Pixiu AI Vision camera.",
      "Hold up or point the camera to a car or object.",
      "Observe the boom barrier automatically raise to 90° with the green pass LED!",
    ],
  },
  "esp32-iot-smart-light": {
    gradeBand: 8,
    unit: "IoT & Cloud",
    tutorial: [
      "Click 'Run' to connect ESP32 to Virtual Wi-Fi and spin up the HTTP Web Server.",
      "Open the 📱 IoT Web Portal in the toolbar to see your Smartphone View.",
      "Tap 'Turn ON Living Room' or 'Turn ON Bedroom' to switch physical LEDs on the canvas in real-time!",
    ],
  },
  "microbit-emotion-bot": {
    gradeBand: 6,
    unit: "Physical Computing",
    tutorial: [
      "Run the simulation to boot the BBC micro:bit v2 processor.",
      "Watch the 5x5 LED matrix paint animated Heart and Smile emotions.",
      "Observe the servo tail wag happily while the buzzer plays audio greeting chimes!",
    ],
  },
  "pico-oled-arcade": {
    gradeBand: 7,
    unit: "Gaming & Displays",
    tutorial: [
      "Click 'Run' to initialize the Raspberry Pi Pico and the 128x64 I2C OLED.",
      "Press the tactile Jump/Fire button on the canvas.",
      "Watch the OLED display update while hearing laser sound effects on the buzzer!",
    ],
  },
  "esp32-weather-telemetry": {
    gradeBand: 8,
    unit: "IoT & Cloud",
    tutorial: [
      "Run the ESP32 weather station to connect to Virtual Wi-Fi.",
      "Open the 📱 Smartphone Portal to see live temperature, humidity, and ambient lux.",
      "Adjust DHT11 temperature or LDR in the inspector and observe live browser telemetry update!",
    ],
  },
  "ultrasonic-radar-scanner": {
    gradeBand: 7,
    unit: "Robotics & Sensors",
    tutorial: [
      "Click 'Run' to start the servo sweeping radar turret.",
      "Change the obstacle distance on the HC-SR04 sensor in the inspector.",
      "Notice the Red, Yellow, and Green LED bar react with rapid alarm beeps when close!",
    ],
  },
  "neopixel-disco-visualizer": {
    gradeBand: 7,
    unit: "Addressable RGB",
    tutorial: [
      "Run the circuit to illuminate the 8x WS2812B NeoPixel ring.",
      "Turn the potentiometer knob to modulate colors and speed.",
      "Observe the vibrant rainbow chase pattern pulsating with audio frequencies!",
    ],
  },
  "mq2-gas-safety-hub": {
    gradeBand: 8,
    unit: "Safety & Automation",
    tutorial: [
      "Start the MQ-2 hazardous gas monitoring loop.",
      "Raise the simulated gas level above 300 ppm in the inspector.",
      "Observe the LCD warning flash, siren sound, and emergency exhaust servo swing open!",
    ],
  },
  "traffic-light": {
    gradeBand: 6,
    unit: "Sequencing",
    tutorial: [
      "Place three LEDs and three resistors with the pedestrian buzzer.",
      "Observe the Red -> Yellow -> Green intersection transition.",
      "Listen for the acoustic pedestrian chime activating during the Green phase!",
    ],
  },
  "blink-led": {
    gradeBand: 6,
    unit: "Digital Output",
    tutorial: [
      "Place Arduino with dual Red and Blue LEDs protected by 220Ω resistors.",
      "Run the circuit to observe the alternating police strobe sequence.",
      "Notice how resistors limit current flow to protect both diodes.",
    ],
  },
  "servo-sweep": {
    gradeBand: 7,
    unit: "Motion + PWM",
    tutorial: [
      "Wire 5V, GND and D9 PWM signal to the servo motor.",
      "Run the simulation to observe smooth positional sweep between 0°, 90°, and 180°.",
      "Use servo blocks to tune robotic angles.",
    ],
  },
  "ultrasonic-radar": {
    gradeBand: 7,
    unit: "Sensors",
    tutorial: [
      "Connect HC-SR04 TRIG, ECHO, power, and buzzer.",
      "Adjust the target obstacle distance in the inspector.",
      "Observe the 30cm proximity threshold trigger the safety alarm.",
    ],
  },
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
  starter("g8-joystick-rover", "🎮 Dual-Motor RC Rover (Joystick Steering)", "Drive an agile 2-wheel rover with a 2-axis joystick! Pushing the stick drives the left and right DC motors forward, reverse, or spins them for steering with live RPM readouts.", 8, "Robotics + Inputs", "Advanced", ["Joystick", "Rover", "L298N", "DC Motor", "Robotics"],
    { parts: [part("joy","joystick",40,80,{x:512,y:512,pressed:"false"}),part("uno","arduino-uno",160,110),part("drv","l298n",510,70,{speedA:0,speedB:0}),part("bat","battery",510,240,{voltage:9}),part("m1","dc-motor",730,40),part("m2","dc-motor",730,190)], wires: [wire("a","uno","5v","joy","vcc","#ef4444"),wire("b","uno","gnd","joy","gnd","#1e293b"),wire("c","uno","a0","joy","vrx","#eab308"),wire("d","uno","a1","joy","vry","#22c55e"),wire("e","uno","d2","joy","sw","#a855f7"),wire("f","uno","5v","drv","5v","#ef4444"),wire("g","uno","gnd","drv","gnd","#1e293b"),wire("h","bat","pos","drv","vs","#ef4444"),wire("i","bat","neg","uno","gnd","#1e293b"),wire("j","uno","d5","drv","ena","#60a5fa"),wire("k","uno","d7","drv","in1","#60a5fa"),wire("l","uno","d8","drv","in2","#60a5fa"),wire("m_en","uno","d6","drv","enb","#3b82f6"),wire("o","uno","d9","drv","in3","#3b82f6"),wire("p","uno","d10","drv","in4","#3b82f6"),wire("q","drv","out1","m1","pos","#f97316"),wire("r","drv","out2","m1","neg","#f97316"),wire("s","drv","out3","m2","pos","#f97316"),wire("t","drv","out4","m2","neg","#f97316")] },
    program([
      serialBegin(),
      pinMode("5","OUTPUT"),pinMode("6","OUTPUT"),pinMode("7","OUTPUT"),pinMode("8","OUTPUT"),pinMode("9","OUTPUT"),pinMode("10","OUTPUT")
    ],[
      serialPrintValue("joystick_x",{SENSOR:"joy"}),
      serialPrintValue("joystick_y",{SENSOR:"joy"}),
      ifElseBlock(
        compareBlock("GT", sensorBlock("joystick_y","joy"), numberBlock(600)),
        [
          block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(210)}),
          block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(210)}),
        ],
        [
          ifElseBlock(
            compareBlock("LT", sensorBlock("joystick_y","joy"), numberBlock(400)),
            [
              block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CCW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(210)}),
              block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CCW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(210)}),
            ],
            [
              ifElseBlock(
                compareBlock("GT", sensorBlock("joystick_x","joy"), numberBlock(600)),
                [
                  block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(190)}),
                  block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CCW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(190)}),
                ],
                [
                  ifElseBlock(
                    compareBlock("LT", sensorBlock("joystick_x","joy"), numberBlock(400)),
                    [
                      block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CCW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(190)}),
                      block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(190)}),
                    ],
                    [
                      block("motor_driver_write",{CHANNEL:"A",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),
                      block("motor_driver_write",{CHANNEL:"B",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),
                    ]
                  )
                ]
              )
            ]
          )
        ]
      ),
      delay(100),
    ]),
    ["Power L298N VMotor from 9V battery and connect control pins to Arduino.","Connect Left DC Motor to OUT1/OUT2 and Right DC Motor to OUT3/OUT4.","Move the joystick to steer and watch both wheels spin with live RPM feedback!"]),
  starter("g8-keypad-lock", "🔒 Smart Security Vault Safe (Keypad + LCD + Servo Lock)", "Build an electronic combination safe! Enter the secret PIN on the 4×4 keypad to view live status on the 16×2 LCD, unlock the servo deadbolt (90°), and sound a confirmation chime.", 8, "Human Interface", "Advanced", ["Keypad", "Security", "LCD", "Servo", "Access Control"],
    { parts: [part("uno","arduino-uno",210,130),part("keypad","keypad-4x4",40,80,{lastKey:""}),part("lcd","lcd-i2c",280,20,{line1:"VAULT LOCKED",line2:"PRESS 1 TO OPEN"}),part("servo","servo",580,40,{angle:0}),part("buzzer","buzzer",580,130),part("r1","resistor",580,230,{resistance:220}),part("led1","led",690,200,{color:"green"})], wires: [wire("a","uno","d2","keypad","r1","#60a5fa"),wire("b","uno","d3","keypad","r2","#60a5fa"),wire("c","uno","d4","keypad","r3","#60a5fa"),wire("d","uno","d5","keypad","r4","#60a5fa"),wire("e","uno","d6","keypad","c1","#3b82f6"),wire("f","uno","d7","keypad","c2","#3b82f6"),wire("g","uno","d8","keypad","c3","#3b82f6"),wire("h","uno","d9","keypad","c4","#3b82f6"),wire("w_lvcc","uno","5v","lcd","vcc","#ef4444"),wire("w_lgnd","uno","gnd","lcd","gnd","#1e293b"),wire("w_lsda","uno","a4","lcd","sda","#60a5fa"),wire("w_lscl","uno","a5","lcd","scl","#3b82f6"),wire("w_svcc","uno","5v","servo","vcc","#ef4444"),wire("w_sgnd","uno","gnd","servo","gnd","#1e293b"),wire("w_ssig","uno","d10","servo","sig","#f97316"),wire("w_bzpos","uno","d11","buzzer","pos","#eab308"),wire("w_bzgnd","buzzer","neg","uno","gnd","#1e293b"),wire("i","uno","d13","r1","a","#22c55e"),wire("j","r1","b","led1","anode","#22c55e"),wire("k","led1","cathode","uno","gnd","#1e293b")] },
    program([
      serialBegin(),
      pinMode("10","OUTPUT"),pinMode("11","OUTPUT"),pinMode("13","OUTPUT"),
      block("servo_write",{PIN:"10"},{ANGLE:numberBlock(0)}),
      digitalWrite("13","LOW"),
      block("lcd_print",{},{TEXT:textBlock("VAULT LOCKED")})
    ],[
      serialPrintValue("keypad_read",{SENSOR:"keypad"}),
      ifElseBlock(
        compareBlock("NEQ", sensorBlock("keypad_read","keypad"), textBlock("")),
        [
          block("lcd_clear"),
          block("lcd_print",{},{TEXT:textBlock("ACCESS GRANTED!")}),
          digitalWrite("13","HIGH"),
          digitalWrite("11","HIGH"),
          block("servo_write",{PIN:"10"},{ANGLE:numberBlock(90)}),
          delay(250),
          digitalWrite("11","LOW"),
          delay(1200),
          block("servo_write",{PIN:"10"},{ANGLE:numberBlock(0)}),
          digitalWrite("13","LOW"),
          block("lcd_clear"),
          block("lcd_print",{},{TEXT:textBlock("VAULT LOCKED")})
        ],
        [delay(100)]
      ),
    ]),
    ["Connect the 4x4 keypad rows and columns to digital pins D2 through D9.","Wire the I2C LCD to SDA/SCL and the deadbolt servo to D10.","Press '1' on the keypad to unlock the vault door, view access confirmation, and hear the chime!"]),
  starter("g8-relay-home", "🏠 Automated Smart Home (PIR Motion + Relay + Cooling Fan + Lamp)", "Control high-power room appliances automatically! When PIR motion is detected, the relay module energizes, spinning a ceiling fan (DC motor) at 1800 RPM and lighting the room lamp.", 8, "Automation", "Advanced", ["Relay", "Automation", "PIR Motion", "DC Motor", "Smart Home"],
    { parts: [part("uno","arduino-uno",40,110),part("pir","pir-sensor",310,50,{motion:"false"}),part("relay","relay",310,190),part("fan","dc-motor",540,60),part("lamp","led",540,180,{color:"blue"}),part("r1","resistor",540,260,{resistance:220}),part("bat","battery",710,120,{voltage:9})], wires: [wire("a","uno","5v","relay","vcc","#ef4444"),wire("b","uno","gnd","relay","gnd","#1e293b"),wire("c","uno","d8","relay","in","#facc15"),wire("w_pvcc","uno","5v","pir","vcc","#ef4444"),wire("w_pgnd","uno","gnd","pir","gnd","#1e293b"),wire("w_pout","uno","d7","pir","out","#60a5fa"),wire("b_com","bat","pos","relay","com","#ef4444"),wire("d","relay","no","fan","pos","#60a5fa"),wire("r_lamp","relay","no","r1","a","#60a5fa"),wire("e","r1","b","lamp","anode","#3b82f6"),wire("fan_gnd","fan","neg","bat","neg","#1e293b"),wire("f","lamp","cathode","bat","neg","#1e293b"),wire("bat_gnd","bat","neg","uno","gnd","#1e293b")] },
    program([
      serialBegin(),
      pinMode("7","INPUT"),
      pinMode("8","OUTPUT")
    ],[
      ifElseBlock(
        sensorBlock("pir_motion","pir"),
        [
          serialPrint("🚶 Room Occupied: Switching Relay ON -> Cooling Fan & Lamp Active!"),
          digitalWrite("8","HIGH"),
          delay(1200)
        ],
        [
          digitalWrite("8","LOW"),
          delay(200)
        ]
      )
    ]),
    ["Power the PIR sensor and relay module from Arduino 5V and GND.","Wire the 9V battery through the relay COM/NO contacts to power the DC fan and lamp load.","Trigger motion on the PIR sensor to watch the relay click, fan spin at high speed, and lamp turn on!"]),
]

export const TEMPLATES: ProjectTemplate[] = BASE_TEMPLATES.map((template) => {
  const meta = BASE_TEMPLATE_META[template.id]
  return meta ? { ...template, ...meta } : template
}).concat(EXTRA_TEMPLATES)