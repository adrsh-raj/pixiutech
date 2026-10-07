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
    description: "Computer vision-driven automated parking boom barrier! The webcam AI pipeline detects approaching vehicles in real-time. When a 'car' class is recognized with high confidence, the Arduino Uno pulses PWM pin D6 to swing the servo gate arm up to 90°, illuminates the Green pass indicator on D12 (turning off Red D13), and logs telemetry to Serial. When the path clears, the barrier smoothly lowers back to 0° with Red stop illuminated.",
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
    description: "Embedded IoT web server with wireless smartphone home automation! The ESP32 connects to Virtual Wi-Fi (SSID: SmartHome-WiFi), establishes an HTTP server on port 80, and serves an interactive web dashboard. Receiving client requests on endpoints /red/on, /red/off, /blue/on, or /blue/off triggers digital GPIO pins D4 and D15 to switch physical Living Room and Bedroom LEDs in real-time, responding with synchronized HTML status badges.",
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
    description: "Interactive robotic emotional pet powered by BBC micro:bit v2! The microcontroller boots up by displaying an animated heart icon on its 5x5 LED matrix and centering its servo tail. During the main loop, it shifts between happy and smiling moods, sweeping the servo tail between 45° and 135° on pin P0 while simultaneously pulsing audio chirps on piezo buzzer pin P1 to simulate realistic pet vocalizations.",
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
    description: "Retro handheld gaming console built on the RP2040 Raspberry Pi Pico! The system initializes a 128×64 SSD1306 OLED over I2C (GP4 SDA / GP5 SCL) displaying game scores. Polling tactile button GP14 detects player fire inputs, instantly updating the OLED with a laser animation, strobing the green blaster LED on GP16, and emitting high-frequency pulse-width audio on GP15 buzzer.",
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
    description: "Cloud-connected microclimate monitoring station! The ESP32 samples digital temperature and humidity data from DHT11 on GPIO 4 and analog ambient sunlight from an LDR on GPIO 34. Connecting over Virtual Wi-Fi, it hosts a real-time web portal on port 80 that formats and streams live environmental telemetry directly to simulated smartphones, while pulsing the green telemetry TX activity LED on GPIO 2 each time data packets are dispatched.",
    difficulty: "Advanced",
    tags: ["ESP32", "DHT11", "LDR", "IoT", "Telemetry", "Smartphone"],
    circuit: {
      parts: [
        { id: "esp", type: "esp32-devkit", x: 40, y: 70, rotation: 0, props: {} },
        { id: "dht", type: "dht11", x: 380, y: 60, rotation: 0, props: { temperature: 25, humidity: 60 } },
        { id: "ldr", type: "ldr", x: 380, y: 190, rotation: 0, props: { light: 500 } },
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
                  <block type="text_string"><field name="TEXT">&lt;h1&gt;⛅ ESP32 Cloud Weather&lt;/h1&gt;&lt;div style="background:#0f172a;padding:12px;border-radius:8px;"&gt;&lt;h3 style="color:#38bdf8;"&gt;🌡️ Temperature: {{TEMP}}°C&lt;/h3&gt;&lt;h3 style="color:#22c55e;"&gt;💧 Humidity: {{HUMIDITY}}%&lt;/h3&gt;&lt;h3 style="color:#eab308;"&gt;☀️ Ambient Light: {{LUX}} Lux&lt;/h3&gt;&lt;/div&gt;&lt;p style="color:#94a3b8;"&gt;Live Virtual Wi-Fi telemetry stream active.&lt;/p&gt;</field></block>
                </value>
                <next>
                <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">150</field></shadow></value><next>
                <block type="io_digitalwrite"><field name="PIN">2</field><field name="STATE">LOW</field></block>
                </next></block>
                </next>
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
    description: "180° robotic ultrasonic sonar turret with multi-stage proximity warning! The Arduino sweeps a servo turret on D9 between 45° and 135° while firing 40kHz ultrasonic sound pulses from HC-SR04 (Trig D10, Echo D11). Detecting an object closer than 25cm triggers emergency Red LED D12 and rapid buzzer pulses on D8. Clear paths revert to Yellow warning (D7) or safe Green illumination (D6).",
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
    description: "Dynamic sound-and-light disco stage visualizer! An analog potentiometer connected to A0 acts as a tempo and color palette selector. The Arduino Uno translates this input into high-speed WS2812B digital bitstreams over D6, driving an 8-pixel RGB NeoPixel ring in continuous rainbow chase patterns synchronized with rhythmic audio beats pulsed on D8 buzzer.",
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
    description: "Industrial safety and hazardous gas mitigation system! The MQ-2 gas sensor monitors LPG, smoke, and combustible gas levels on analog pin A0. If concentration exceeds the safety threshold (>300 ppm), the system activates an emergency sequence: an I2C LCD displays 'HAZARD DETECTED!', digital siren buzzer sounds on D8, Red alert LED turns on (D12), and a ventilation servo swings 90° on D9 to purge fumes.",
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
    description: "Synchronized municipal traffic intersection with acoustic pedestrian crosswalk guidance! The Arduino executes a state machine controlling Red (D12), Yellow (D11), and Green (D10) signal lamps. During the Green pedestrian phase, D8 activates an acoustic pulsing chime from the buzzer to assist visually impaired pedestrians, following strict real-world timing transitions.",
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
    description: "Dual emergency vehicle alternating police strobe with current-limiting protection! The Arduino alternates digital logic HIGH and LOW states between Red LED (pin D13) and Blue LED (pin D12) with 400ms timing intervals. 220Ω series resistors protect the LEDs against overcurrent by dropping the 5V logic supply down to safe forward operating voltages.",
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
    description: "Precision angular positioning actuator with Pulse-Width Modulation (PWM)! The Arduino Uno generates a 50Hz PWM control signal with variable duty cycles on digital pin D9, translating code angles into rotational movements of 0°, 90°, and 180°. Demonstrates how robotic arms, steerable mechanisms, and automated grippers achieve angular position control.",
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
    description: "Non-contact ultrasonic echolocation distance meter with threshold alarm! The HC-SR04 emits a 10µs ultrasonic burst from Trig (D9) and measures sound wave return time on Echo (D10) to calculate distance in centimeters. Live measurements are streamed to Serial Monitor, and if an approaching obstacle crosses under 30cm, digital pin D8 triggers a loud buzzer alarm.",
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
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect Servo power to 5V/GND and signal to D6. Wire Green LED to D12 and Red LED to D13 through 220Ω current-limiting resistors.",
      "2. ⚙️ Code Architecture & Logic: Arduino setup initializes Serial (9600 baud) and parks the servo at 0°. The loop checks the Pixiu AI vision block for vehicle recognition.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open the AI Camera panel. Show a toy car, vehicle picture, or hand gesture to the simulated camera feed.",
      "4. 📊 Outcomes & Real-Time Observations: Upon detecting a car, the barrier raises to 90°, Green LED lights up, and Serial logs: '🚗 Car Detected! Raising Boom Barrier...'.",
    ],
  },
  "esp32-iot-smart-light": {
    gradeBand: 8,
    unit: "IoT & Cloud",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect ESP32 to Red LED on GPIO 4 and Blue LED on GPIO 15, each protected with 220Ω series resistors to common GND.",
      "2. ⚙️ Code Architecture & Logic: Firmware connects to 'SmartHome-WiFi', launches an HTTP server on port 80, and maps REST routes /red/on, /red/off, /blue/on, and /blue/off to digital writes.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and observe the Wi-Fi connected message, then click the 📱 Smartphone Portal icon in the circuit lab toolbar.",
      "4. 📊 Outcomes & Real-Time Observations: Tap the web buttons on the smartphone screen; notice the LEDs switch immediately on the canvas and browser shows updated room status.",
    ],
  },
  "microbit-emotion-bot": {
    gradeBand: 6,
    unit: "Physical Computing",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect micro:bit 3.3V and GND to the micro servo motor, wire P0 to servo signal, and attach a piezo buzzer between P1 and GND.",
      "2. ⚙️ Code Architecture & Logic: Setup displays a heart icon on the 5x5 matrix. The loop sequences between heart and smile icons, wags the servo from 45° to 135°, and pulses sound on P1.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the micro:bit v2 simulation. Observe both the 5x5 LED matrix and the mechanical servo actuator.",
      "4. 📊 Outcomes & Real-Time Observations: The virtual pet displays playful facial expressions, wags its tail smoothly, and chirps pleasant audio tones.",
    ],
  },
  "pico-oled-arcade": {
    gradeBand: 7,
    unit: "Gaming & Displays",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect SSD1306 OLED to Pico 3.3V/GND, GP4 (SDA), and GP5 (SCL). Connect arcade pushbutton to GP14, buzzer to GP15, and blaster LED to GP16.",
      "2. ⚙️ Code Architecture & Logic: Setup initializes I2C and draws '🎮 PICO ARCADE'. The loop polls GP14; when pressed, it flashes GP16 LED, triggers laser buzzer sound on GP15, and writes 'LASER FIRED!'.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to boot the RP2040 chip, then click the pushbutton on the canvas to simulate tapping the fire trigger.",
      "4. 📊 Outcomes & Real-Time Observations: The OLED updates to '>> LASER FIRED! <<', the green blaster LED flashes, and the buzzer plays an authentic arcade laser effect.",
    ],
  },
  "esp32-weather-telemetry": {
    gradeBand: 8,
    unit: "IoT & Cloud",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect DHT11 data to GPIO 4, LDR ambient light sensor to analog GPIO 34, Green Telemetry TX Activity LED to GPIO 2 via 220Ω resistor, and supply 3.3V/GND rails to all sensors.",
      "2. ⚙️ Code Architecture & Logic: ESP32 connects to 'SmartHome-WiFi' and registers an HTTP GET '/' endpoint. When queried, it pulses the GPIO 2 green TX LED for 150ms and streams dynamic HTML containing real-time temperature, humidity, and lux telemetry.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the IoT server. Open the 📱 Smartphone Portal (movable floating device) and drag the DHT11 temperature or LDR light slider on the circuit canvas.",
      "4. 📊 Outcomes & Real-Time Observations: The smartphone dashboard live-updates with current temperature and lux metrics while the green GPIO 2 LED pulses on every data transmission packet.",
    ],
  },
  "ultrasonic-radar-scanner": {
    gradeBand: 7,
    unit: "Robotics & Sensors",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire HC-SR04 Trig to D10, Echo to D11, and servo signal to D9. Wire Red, Yellow, and Green LEDs to D12, D7, and D6 with 220Ω resistors, and buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Loop sweeps servo between 45° and 135°, taking ultrasonic distance measurements. If distance < 25cm, Red LED and buzzer sound; otherwise Green LED illuminates.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the scanning servo turret. Select the ultrasonic sensor on canvas and drag its obstacle distance slider.",
      "4. 📊 Outcomes & Real-Time Observations: As obstacles enter the 25cm hazard perimeter, the Green safe light extinguishes, the Red alert LED flashes, and the buzzer emits urgent beeps.",
    ],
  },
  "neopixel-disco-visualizer": {
    gradeBand: 7,
    unit: "Addressable RGB",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect WS2812B NeoPixel ring DI to D6, Potentiometer wiper to A0, Buzzer positive to D8, and share 5V and GND lines with Arduino Uno.",
      "2. ⚙️ Code Architecture & Logic: Arduino writes color bytes to the NeoPixel ring using high-speed timing, cycling through RGB hues while producing synchronized sound pulses on D8.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the disco sequence. Click and rotate the potentiometer dial on canvas to modulate animation tempo.",
      "4. 📊 Outcomes & Real-Time Observations: The 8-pixel NeoPixel ring glows with bright, vivid multi-color animations while the buzzer pulses rhythmic audio beats.",
    ],
  },
  "mq2-gas-safety-hub": {
    gradeBand: 8,
    unit: "Safety & Automation",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect MQ-2 gas sensor AO to A0, I2C LCD to A4/A5, Servo to D9, Buzzer to D8, and Red alert LED to D12 with a 220Ω resistor.",
      "2. ⚙️ Code Architecture & Logic: Setup prints 'AIR QUALITY: OK' on LCD. The loop reads A0; if gas level exceeds 300 ppm threshold, it alerts with LCD text, siren beeping, Red LED, and opens exhaust servo (90°).",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start monitoring. Select the MQ-2 sensor in the canvas inspector and slide its gas concentration above 300 ppm.",
      "4. 📊 Outcomes & Real-Time Observations: The LCD immediately displays 'HAZARD DETECTED!', the siren sounds continuously, and the servo swings open to evacuate fumes.",
    ],
  },
  "traffic-light": {
    gradeBand: 6,
    unit: "Sequencing",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire Red LED to D12, Yellow LED to D11, Green LED to D10 through individual 220Ω resistors. Connect pedestrian buzzer positive to D8 and common GND.",
      "2. ⚙️ Code Architecture & Logic: The Arduino loop executes a timed sequence: Red stop for 2.5s, Yellow warning for 1.0s, and Green walk for 2.0s with buzzer chiming concurrently.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to initiate the traffic intersection program. Observe the sequential timing progression in real-time.",
      "4. 📊 Outcomes & Real-Time Observations: Signal lights cycle cleanly from Red to Yellow to Green, accompanied by a distinct acoustic pedestrian safety chime.",
    ],
  },
  "blink-led": {
    gradeBand: 6,
    unit: "Digital Output",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect Red LED anode to D13 and Blue LED anode to D12, each in series with a 220Ω resistor. Wire both cathodes to Arduino GND.",
      "2. ⚙️ Code Architecture & Logic: Setup configures D13 and D12 as outputs. The loop pulls D13 HIGH while D12 is LOW for 400ms, then flips the states for another 400ms.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the microcontroller firmware. Zoom in on the breadboard to inspect current flow.",
      "4. 📊 Outcomes & Real-Time Observations: The Red and Blue LEDs flash alternately in a sharp emergency strobe pattern with 220Ω current protection preventing diode burnout.",
    ],
  },
  "servo-sweep": {
    gradeBand: 7,
    unit: "Motion + PWM",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect Servo motor VCC to Arduino 5V, GND to GND, and yellow/orange control signal pin to digital PWM pin D9.",
      "2. ⚙️ Code Architecture & Logic: The program transmits PWM servo position commands in sequence: 0° (extreme left), 90° (center), and 180° (extreme right) with 800ms dwell intervals.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to execute the servo trajectory. Open the Blockly editor to tweak delay times or target angles.",
      "4. 📊 Outcomes & Real-Time Observations: The servo horn rotates smoothly between its limits, demonstrating accurate angular positioning used in robotics.",
    ],
  },
  "ultrasonic-radar": {
    gradeBand: 7,
    unit: "Sensors",
    tutorial: [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect HC-SR04 VCC to 5V, GND to GND, Trig to D9, Echo to D10, and Piezo buzzer positive to D8 with negative to GND.",
      "2. ⚙️ Code Architecture & Logic: Firmware generates high-frequency ultrasonic pings, computes distance, prints cm readings to Serial, and turns on buzzer D8 if distance < 30cm.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open the Serial Monitor console. Select the ultrasonic sensor on canvas and drag its obstacle distance slider.",
      "4. 📊 Outcomes & Real-Time Observations: The Serial console logs live obstacle distance values; when moved within 30cm, the warning message appears and the buzzer sounds.",
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
  starter("g6-pushbutton-led", "Pushbutton Lamp", "Tactile digital input switch controlling an LED indicator! Pressing the momentary pushbutton completes an electrical circuit sending 5V HIGH to Arduino digital pin D2. The microcontroller evaluates the digital logic state and drives pin D13 HIGH, lighting the green LED through a 220Ω current-limiting resistor until released.", 6, "Digital Inputs", "Beginner", ["Pushbutton", "Digital Input", "LED"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",360,100),part("led1","led",540,90,{color:"green"}),part("r1","resistor",540,200,{resistance:220})], wires: [wire("p1","uno","d2","btn","p1a"),wire("p2","btn","p2a","uno","5v","#ef4444"),wire("p3","uno","d13","r1","a","#22c55e"),wire("p4","r1","b","led1","anode","#22c55e"),wire("p5","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(50),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect pushbutton terminal 1 to Arduino D2 and terminal 2 to 5V. Wire green LED anode from D13 through 220Ω resistor to cathode at GND.",
      "2. ⚙️ Code Architecture & Logic: Set D2 as INPUT and D13 as OUTPUT. The loop checks pushbutton_read; if pressed (HIGH), digital pin D13 is set HIGH, otherwise LOW.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start simulation, then click and hold the pushbutton component on the canvas.",
      "4. 📊 Outcomes & Real-Time Observations: The green LED illuminates instantly whenever the button is pressed and turns off when released, demonstrating binary digital input control.",
    ]),
  starter("g6-pot-brightness", "Potentiometer LED Dimmer", "Variable voltage divider with PWM brightness modulation! Turning the potentiometer knob varies the analog voltage on pin A0 from 0V to 5V (ADC readings 0 to 1023). The Arduino firmware maps this 10-bit range into an 8-bit PWM value (0 to 255) on digital pin D9, smoothly dimming or brightening the blue LED.", 6, "Analog Input", "Beginner", ["Potentiometer", "Analog", "PWM"],
    { parts: [part("uno","arduino-uno",60,110),part("pot","potentiometer",330,110,{value:512}),part("led1","led",540,90,{color:"blue"}),part("r1","resistor",540,190,{resistance:220})], wires: [wire("a","uno","5v","pot","t1","#ef4444"),wire("b","uno","gnd","pot","t2","#1e293b"),wire("c","pot","wiper","uno","a0","#eab308"),wire("d","uno","d9","r1","a","#3b82f6"),wire("e","r1","b","led1","anode","#3b82f6"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT")],[
      block("io_analogwrite", { PIN: "9" }, {
        VALUE: "<block type=\"arduino_map\"><value name=\"VALUE\">" + sensorBlock("potentiometer_read", "pot") + "</value><value name=\"FROM_LOW\">" + numberBlock(0) + "</value><value name=\"FROM_HIGH\">" + numberBlock(1023) + "</value><value name=\"TO_LOW\">" + numberBlock(0) + "</value><value name=\"TO_HIGH\">" + numberBlock(255) + "</value></block>",
      }),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect potentiometer outer legs to 5V and GND, and center wiper to A0. Wire blue LED from PWM pin D9 through 220Ω resistor to GND.",
      "2. ⚙️ Code Architecture & Logic: Read analog voltage on A0, map the 0–1023 input scale down to 0–255 PWM duty cycle, and write the result using analogWrite to D9.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then click and drag the rotary potentiometer knob on the canvas from 0% to 100%.",
      "4. 📊 Outcomes & Real-Time Observations: The blue LED smoothly transitions from completely off to full brightness in direct response to knob rotation.",
    ]),
  starter("g6-rgb-mood-lamp", "RGB Mood Lamp", "Multi-channel pulse-width modulation RGB color blending! The Arduino Uno drives the three separate cathode/anode color channels of an RGB LED using PWM pins D9 (Red), D10 (Green), and D11 (Blue). By outputting independent 8-bit duty cycles (e.g. 255 Red, 90 Green, 180 Blue), it mixes light to create rich ambient mood hues.", 6, "Multi-Output", "Beginner", ["RGB LED", "Colour", "GPIO"],
    { parts: [part("uno","arduino-uno",60,110),part("rgb","rgb-led",430,100,{})], wires: [wire("r","uno","d9","rgb","red","#ef4444"),wire("g","uno","d10","rgb","green","#22c55e"),wire("b","uno","d11","rgb","blue","#3b82f6"),wire("gnd","uno","gnd","rgb","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT"),pinMode("10","OUTPUT"),pinMode("11","OUTPUT")],[analogWrite("9",255),analogWrite("10",90),analogWrite("11",180),delay(600)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect RGB LED common cathode to GND, red pin to D9, green pin to D10, and blue pin to D11 via current-limiting resistors.",
      "2. ⚙️ Code Architecture & Logic: Configure pins 9, 10, and 11 as OUTPUT. Send PWM values to each channel using analogWrite to mix primary colors into custom shades.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start color rendering. In Blockly, adjust the RGB number values between 0 and 255 to mix new colors.",
      "4. 📊 Outcomes & Real-Time Observations: The RGB LED radiates a warm purple-magenta ambient glow produced by the simultaneous blending of the three PWM channels.",
    ]),
  starter("g6-buzzer-doorbell", "Smart Doorbell", "Audible annunciator system with pushbutton trigger! Pressing the tactile doorbell button pulls digital input D2 HIGH. The Arduino detects the rising edge and pulses digital output pin D8 HIGH for 250ms, driving an electromechanical piezo buzzer to produce a crisp visitor alert chime.", 6, "Digital Inputs + Outputs", "Beginner", ["Pushbutton", "Buzzer", "Digital I/O"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",340,90),part("bz","buzzer",520,160)], wires: [wire("a","uno","d2","btn","p1a"),wire("b","btn","p2a","uno","5v","#ef4444"),wire("c","uno","d8","bz","pos","#facc15"),wire("d","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("8","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("8","HIGH"), delay(250), digitalWrite("8","LOW")],
        [digitalWrite("8","LOW")],
      ),
      delay(50),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect tactile button between 5V and D2. Wire piezo buzzer positive terminal to D8 and negative terminal to Arduino GND.",
      "2. ⚙️ Code Architecture & Logic: Set D2 as INPUT and D8 as OUTPUT. When pushbutton_read returns HIGH, D8 activates for 250ms and then turns OFF.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to initialize the doorbell circuit, then click the pushbutton on the canvas.",
      "4. 📊 Outcomes & Real-Time Observations: The buzzer sounds a sharp 250ms audio chime whenever the doorbell button is tapped, accurately simulating a residential entry buzzer.",
    ]),
  starter("g6-seven-segment", "7-Segment Number Display", "Digitized numeric output using multiplexed LED segment bars! The 7-segment display contains seven individual bar LEDs arranged in a figure-eight pattern. The Arduino Uno drives segment pins 'a' (D3), 'b' (D4), 'c' (D5), and 'd' (D6) with digital HIGH outputs to illuminate specific segment patterns against common GND.", 6, "Displays", "Intermediate", ["7-Segment", "GPIO", "Numbers"],
    { parts: [part("uno","arduino-uno",60,110),part("seg","seven-segment",400,90)], wires: [wire("a","uno","d3","seg","a","#ef4444"),wire("b","uno","d4","seg","b","#f97316"),wire("c","uno","d5","seg","c","#eab308"),wire("d","uno","d6","seg","d","#22c55e"),wire("e","uno","gnd","seg","com","#1e293b")] },
    program([pinMode("3","OUTPUT"),pinMode("4","OUTPUT"),pinMode("5","OUTPUT"),pinMode("6","OUTPUT")],[digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),delay(500)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect 7-segment COM pin to GND. Wire individual segment pins a, b, c, d to Arduino digital pins D3, D4, D5, and D6.",
      "2. ⚙️ Code Architecture & Logic: Set D3–D6 as OUTPUT. Drive selected segment pins HIGH while grounding COM to illuminate specific numbers and glyphs.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to light the default segments. In Blockly, toggle digital write HIGH/LOW blocks to form other numbers.",
      "4. 📊 Outcomes & Real-Time Observations: Segments a, b, c, and d illuminate brightly on the display face, revealing how digital counters render human-readable numerals.",
    ]),
  starter("g6-ldr-night-lamp", "Automatic Night Lamp", "Photosensitive ambient light controller for automated night illumination! A Light Dependent Resistor (LDR) forms a variable voltage divider on analog pin A0. In bright daylight, LDR resistance is low; when darkness falls, resistance surges, causing analog voltage on A0 to drop below 400. The Arduino detects nightfall and automatically energizes the yellow lamp on D13.", 6, "Sensors", "Intermediate", ["LDR", "Analog", "Automation"],
    { parts: [part("uno","arduino-uno",60,110),part("ldr","ldr",330,100),part("led1","led",540,90,{color:"yellow"}),part("r1","resistor",540,190,{resistance:220})], wires: [wire("a","uno","5v","ldr","t1","#ef4444"),wire("b","ldr","t2","uno","a0","#eab308"),wire("c","uno","d13","r1","a","#facc15"),wire("d","r1","b","led1","anode","#facc15"),wire("e","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT")],[
      ifElseBlock(
        compareBlock("LT", sensorBlock("ldr_read", "ldr"), numberBlock(400)),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(100),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect LDR between 5V and A0. Connect yellow LED to D13 in series with a 220Ω resistor, with cathode connected to GND.",
      "2. ⚙️ Code Architecture & Logic: Set D13 as OUTPUT. The loop checks if ldr_read on A0 is less than threshold 400; if true, D13 turns HIGH (lamp ON); otherwise LOW.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start light monitoring. Select the LDR on the canvas and use the Inspector slider to simulate darkness.",
      "4. 📊 Outcomes & Real-Time Observations: When ambient light drops below the threshold, the yellow lamp turns on automatically, mimicking smart city streetlights.",
    ]),
  starter("g7-pir-security", "PIR Security Light", "Passive Infrared (PIR) intrusion detection with automated floodlight! The PIR sensor monitors ambient infrared heat signatures from moving bodies. When motion is detected, its digital output pin pulses HIGH to Arduino pin D7. The firmware processes the trigger and immediately switches on the high-intensity red security LED on D13.", 7, "Sensors + Automation", "Intermediate", ["PIR", "Motion", "Security"],
    { parts: [part("uno","arduino-uno",60,110),part("pir","pir-sensor",360,90,{motion:false}),part("led1","led",560,90,{color:"red"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","pir","vcc","#ef4444"),wire("b","uno","gnd","pir","gnd","#1e293b"),wire("c","uno","d7","pir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pir_motion", "pir"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Power PIR sensor with 5V and GND, connecting OUT to D7. Wire red indicator LED from D13 through 220Ω resistor to GND.",
      "2. ⚙️ Code Architecture & Logic: Configure D7 as INPUT and D13 as OUTPUT. Loop evaluates pir_motion; if motion is detected, D13 is switched HIGH, otherwise LOW.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to arm security. In the canvas Inspector, toggle the PIR motion trigger checkbox.",
      "4. 📊 Outcomes & Real-Time Observations: The red security lamp activates instantly upon detected motion, demonstrating automatic perimeter intrusion lighting.",
    ]),
  starter("g7-tmp36-alert", "TMP36 Temperature Alert", "Analog thermal monitoring with overheating siren! The TMP36 precision sensor outputs a linear analog voltage proportional to temperature (10mV per °C with 500mV offset at 0°C). Arduino reads pin A0, converts millivolts into Celsius, logs temperature over Serial (9600 baud), and activates the audio buzzer on D8 if ambient temperature exceeds 30°C.", 7, "Analog Sensors", "Intermediate", ["TMP36", "Temperature", "Alarm"],
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
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire TMP36 power, ground and Vout to A0. Connect piezo buzzer positive to D8 and negative to GND.",
      "2. ⚙️ Code Architecture & Logic: Initialize Serial at 9600 baud and D8 as OUTPUT. Read temperature from A0; if > 30°C, drive D8 HIGH to sound the alarm; otherwise LOW.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open the Serial Monitor. Select TMP36 in the Inspector and drag its temperature slider past 30°C.",
      "4. 📊 Outcomes & Real-Time Observations: The Serial console prints live temperature readings; when exceeding 30°C, the buzzer sounds an audible high-temperature alarm.",
    ]),
  starter("g7-dht-weather", "DHT11 Weather Station", "Digital single-bus environmental telemetry! The DHT11 sensor measures relative humidity (capacitive sensor) and temperature (thermistor), packaging the data into a high-speed single-wire digital packet on pin D4. The Arduino unpacks the data and streams formatted temperature and humidity telemetry to the Serial Monitor at 1Hz.", 7, "Environmental Sensors", "Intermediate", ["DHT11", "Temperature", "Humidity"],
    { parts: [part("uno","arduino-uno",60,120),part("dht","dht11",420,100,{temperature:25,humidity:55})], wires: [wire("a","uno","5v","dht","vcc","#ef4444"),wire("b","uno","gnd","dht","gnd","#1e293b"),wire("c","uno","d4","dht","data","#60a5fa")] },
    program([serialBegin(),pinMode("4","INPUT")],[serialPrint("Temperature: "),serialPrintValue("dht_temperature"),serialPrint("Humidity: "),serialPrintValue("dht_humidity"),delay(1000)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect DHT11 sensor VCC to 5V, GND to GND, and single-wire DATA line to Arduino digital pin D4.",
      "2. ⚙️ Code Architecture & Logic: Initialize Serial communication at 9600 baud. The loop queries DHT11 temperature and humidity channels and outputs formatted serial logs.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open Serial Monitor. Select the DHT11 on canvas and tweak temperature and humidity in the Inspector.",
      "4. 📊 Outcomes & Real-Time Observations: The console updates with live atmospheric readings (e.g. 'Temperature: 25°C | Humidity: 55%') with single-wire precision.",
    ]),
  starter("g7-soil-smart-farm", "Smart Farm Soil Monitor", "Automated agriculture soil hydration monitor! Two probe electrodes measure the electrical conductivity of the surrounding soil, outputting an analog voltage on pin A0. Dry soil yields lower conductivity, while moist soil produces higher readings. When soil moisture reading exceeds 600, Arduino illuminates the green irrigation health LED on D13.", 7, "Smart Farming", "Intermediate", ["Soil Moisture", "Analog", "IoT"],
    { parts: [part("uno","arduino-uno",60,110),part("soil","soil-moisture",350,95,{moisture:620}),part("led1","led",560,90,{color:"green"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","soil","vcc","#ef4444"),wire("b","soil","ao","uno","a0","#eab308"),wire("c","soil","gnd","uno","gnd","#1e293b"),wire("d","uno","d13","r1","a","#22c55e"),wire("e","r1","b","led1","anode","#22c55e"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT")],[
      ifElseBlock(
        compareBlock("GT", sensorBlock("soil_moisture_read", "soil"), numberBlock(600)),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(100),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire soil moisture sensor VCC to 5V, GND to GND, and AO to A0. Wire green LED from D13 through 220Ω resistor to GND.",
      "2. ⚙️ Code Architecture & Logic: Configure D13 as OUTPUT. The loop compares soil_moisture_read against threshold 600; if greater, D13 turns HIGH; otherwise LOW.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to begin soil monitoring. Select the soil sensor in the canvas Inspector and adjust moisture level.",
      "4. 📊 Outcomes & Real-Time Observations: The green indicator illuminates when soil moisture is sufficient and extinguishes when dry, indicating crops require watering.",
    ]),
  starter("g7-ir-obstacle", "IR Obstacle Indicator", "Active infrared optical proximity detection for robotics! The IR sensor features an IR emitter LED and photodiode receiver. When an object enters the detection beam, reflected infrared light trips an onboard comparator, driving digital OUT LOW/HIGH to Arduino pin D7. The Arduino reacts by turning on the red obstacle LED on D13.", 7, "Digital Sensors", "Intermediate", ["IR Sensor", "Obstacle", "Robotics"],
    { parts: [part("uno","arduino-uno",60,110),part("ir","ir-sensor",350,95,{detected:"false"}),part("led1","led",560,90,{color:"red"}),part("r1","resistor",560,190,{resistance:220})], wires: [wire("a","uno","5v","ir","vcc","#ef4444"),wire("b","uno","gnd","ir","gnd","#1e293b"),wire("c","uno","d7","ir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("ir_read", "ir"),
        [digitalWrite("13","HIGH")],
        [digitalWrite("13","LOW")],
      ),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect IR obstacle sensor VCC to 5V, GND to GND, and OUT to D7. Wire red indicator LED from D13 via 220Ω resistor to GND.",
      "2. ⚙️ Code Architecture & Logic: Set D7 as INPUT and D13 as OUTPUT. Loop evaluates ir_read; when an obstacle is detected, D13 turns HIGH to light the alert LED.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to activate sensor. In the Inspector panel, toggle the obstacle detection state to simulate an obstacle.",
      "4. 📊 Outcomes & Real-Time Observations: The red alert LED lights up instantly when an obstacle is present, demonstrating contact-free robotic collision avoidance.",
    ]),
  starter("g7-encoder-menu", "Rotary Encoder Counter", "Incremental quadrature user interface encoder! Rotating the knob rotates an internal disk with contact switches producing out-of-phase pulses on CLK (D2) and DT (D3), while pushing the knob down clicks the SW momentary switch (D4). The Arduino decodes the quadrature direction, tracking numerical increments/decrements and logging live counts to Serial.", 7, "Human Interface", "Intermediate", ["Rotary Encoder", "Input", "Counter"],
    { parts: [part("uno","arduino-uno",60,110),part("enc","rotary-encoder",380,100,{value:0,pressed:"false"})], wires: [wire("a","uno","5v","enc","vcc","#ef4444"),wire("b","uno","gnd","enc","gnd","#1e293b"),wire("c","uno","d2","enc","clk","#60a5fa"),wire("d","uno","d3","enc","dt","#3b82f6"),wire("e","uno","d4","enc","sw","#a855f7")] },
    program([serialBegin(),pinMode("2","INPUT"),pinMode("3","INPUT"),pinMode("4","INPUT")],[
      serialPrintValue("encoder_read", { SENSOR: "enc" }),
      delay(300),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire rotary encoder VCC to 5V, GND to GND, CLK to D2, DT to D3, and integrated pushbutton SW to D4.",
      "2. ⚙️ Code Architecture & Logic: Configure pins 2, 3, and 4 as INPUT and open Serial at 9600 baud. The loop decodes encoder_read steps and prints the value.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open the Serial Monitor. Click on the rotary encoder on the canvas and rotate its dial.",
      "4. 📊 Outcomes & Real-Time Observations: The Serial console prints positive and negative step counts corresponding to clockwise and counterclockwise knob turns.",
    ]),
  starter("g7-servo-door", "Automatic Servo Door", "Automated sliding/swinging door mechanism driven by servo PWM! The Arduino generates precision 50Hz PWM control signals on digital pin D9. The program commands the servo arm to alternate between 0° (fully closed latch) and 90° (fully open door) with 1-second holding delays, showing mechanical actuation in automated entry systems.", 7, "Robotics", "Intermediate", ["Servo", "Automation", "PWM"],
    { parts: [part("uno","arduino-uno",60,110),part("servo","servo",420,110,{angle:0})], wires: [wire("a","uno","5v","servo","vcc","#ef4444"),wire("b","uno","gnd","servo","gnd","#1e293b"),wire("c","uno","d9","servo","sig","#fb923c")] },
    program([pinMode("9","OUTPUT")],[block("servo_write",{PIN:"9"},{ANGLE:numberBlock(0)}),delay(1000),block("servo_write",{PIN:"9"},{ANGLE:numberBlock(90)}),delay(1000)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire servo motor VCC to Arduino 5V, GND to GND, and signal input wire to digital PWM pin D9.",
      "2. ⚙️ Code Architecture & Logic: Set D9 as OUTPUT. Loop commands servo_write to 0° (closed), waits 1000ms, then writes 90° (open), and waits 1000ms in repetition.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the door cycle. In the Blockly editor, experiment with custom intermediate door angles.",
      "4. 📊 Outcomes & Real-Time Observations: The servo horn swings systematically between closed (0°) and open (90°) positions with smooth angular actuation.",
    ]),
  starter("g8-lcd-weather", "LCD Sensor Monitor", "Two-wire I2C alphanumeric visual readout! The 16×2 Liquid Crystal Display communicates with the Arduino over I2C bus lines SDA (A4) and SCL (A5), reducing complex 16-pin parallel wiring down to just two communication lines. The controller sends command packets to initialize the display controller and refresh status messages.", 8, "Displays + I2C", "Intermediate", ["LCD", "I2C", "Sensors"],
    { parts: [part("uno","arduino-uno",60,110),part("lcd","lcd-i2c",390,100,{line1:"PIXIU TECH",line2:"READY"})], wires: [wire("a","uno","5v","lcd","vcc","#ef4444"),wire("b","uno","gnd","lcd","gnd","#1e293b"),wire("c","uno","a4","lcd","sda","#60a5fa"),wire("d","uno","a5","lcd","scl","#3b82f6")] },
    program([serialBegin()],[block("lcd_print",{}, {TEXT:textBlock("PIXIU TECH")}),delay(800),block("lcd_clear"),delay(300)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect LCD VCC to 5V, GND to GND, SDA data pin to Arduino A4, and SCL clock pin to Arduino A5.",
      "2. ⚙️ Code Architecture & Logic: Setup initializes I2C communication. The loop prints 'PIXIU TECH' to the LCD screen, pauses for 800ms, and clears the screen.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start I2C transmission. In Blockly, customize the displayed text message or add secondary lines.",
      "4. 📊 Outcomes & Real-Time Observations: The LCD illuminates with crisp blue backlighting and clear alphanumeric characters streamed over the I2C bus.",
    ]),
  starter("g8-oled-dashboard", "OLED Sensor Dashboard", "High-resolution graphic dashboard with SSD1306 OLED! Utilizing the I2C serial bus on pins A4 (SDA) and A5 (SCL), this 128×64 dot-matrix OLED receives byte streams to draw crisp graphical text, headers, and sensor metrics. Each organic pixel emits its own light, delivering high contrast and rapid screen refresh rates.", 8, "Displays + I2C", "Intermediate", ["OLED", "Dashboard", "I2C"],
    { parts: [part("uno","arduino-uno",60,110),part("oled","oled-i2c",390,100,{line1:"PIXIU TECH",line2:"SENSOR DATA",line3:"READY"})], wires: [wire("a","uno","5v","oled","vcc","#ef4444"),wire("b","uno","gnd","oled","gnd","#1e293b"),wire("c","uno","a4","oled","sda","#60a5fa"),wire("d","uno","a5","oled","scl","#3b82f6")] },
    program([serialBegin()],[block("oled_print",{}, {TEXT:textBlock("PIXIU SENSOR")}),delay(600),block("oled_clear"),delay(300)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect OLED VCC to 5V, GND to GND, SDA to Arduino pin A4, and SCL to Arduino pin A5.",
      "2. ⚙️ Code Architecture & Logic: Firmware initializes the I2C graphic display controller. Loop executes oled_print to render 'PIXIU SENSOR' and refreshes periodically.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to boot the graphic OLED controller. Edit the Blockly text string to display customized sensor dashboard cards.",
      "4. 📊 Outcomes & Real-Time Observations: The 128×64 OLED screen lights up with high-contrast sharp white typography showing modern embedded UI rendering.",
    ]),
  starter("g8-motor-driver", "Dual Motor Driver", "High-power dual DC motor H-Bridge drive base! The L298N motor driver isolates the Arduino from high motor currents while controlling two DC motors. An external 9V battery powers the motor rail (VS), while Arduino pins D5/D6 (ENA/ENB PWM) and D7/D8/D9/D10 (IN1-IN4 directional logic) control speed and forward/reverse rotation.", 8, "Motor Control", "Advanced", ["L298N", "DC Motor", "Robotics"],
    { parts: [part("uno","arduino-uno",60,110),part("drv","l298n",360,95,{speedA:160,speedB:160}),part("bat","battery",230,310,{voltage:9}),part("m1","dc-motor",600,55),part("m2","dc-motor",600,205)], wires: [wire("a","uno","5v","drv","5v","#ef4444"),wire("b","uno","gnd","drv","gnd","#1e293b"),wire("c","bat","pos","drv","vs","#ef4444"),wire("d","bat","neg","uno","gnd","#1e293b"),wire("e","uno","d5","drv","ena","#60a5fa"),wire("f","uno","d7","drv","in1","#60a5fa"),wire("g","uno","d8","drv","in2","#60a5fa"),wire("h","uno","d6","drv","enb","#3b82f6"),wire("i","uno","d9","drv","in3","#3b82f6"),wire("j","uno","d10","drv","in4","#3b82f6"),wire("k","drv","out1","m1","pos","#f97316"),wire("l","drv","out2","m1","neg","#f97316"),wire("m","drv","out3","m2","pos","#f97316"),wire("n","drv","out4","m2","neg","#f97316")] },
    program([pinMode("5","OUTPUT"),pinMode("6","OUTPUT"),pinMode("7","OUTPUT"),pinMode("8","OUTPUT"),pinMode("9","OUTPUT"),pinMode("10","OUTPUT")],[block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),delay(1000),block("motor_driver_write",{CHANNEL:"A",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),block("motor_driver_write",{CHANNEL:"B",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),delay(500)]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect 9V battery to L298N VS and GND (shared with Arduino). Wire ENA to D5, IN1 to D7, IN2 to D8, ENB to D6, IN3 to D9, IN4 to D10, and motors to OUT1-4.",
      "2. ⚙️ Code Architecture & Logic: Setup sets all 6 control pins as OUTPUT. Loop writes motor_driver_write blocks to drive both channels CW at speed 180, then stops.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start motor driver execution. Observe both DC motors spin up and view live simulated RPM.",
      "4. 📊 Outcomes & Real-Time Observations: Motors M1 and M2 spin smoothly clockwise at 180 PWM and halt synchronously, demonstrating H-bridge polarity switching.",
    ]),
  starter("g8-joystick-rover", "🎮 Dual-Motor RC Rover (Joystick Steering)", "Agile two-wheel robotic rover with differential joystick steering! An analog 2-axis joystick feeds VRX to A0 and VRY to A1. Pushing forward (Y > 600) drives both L298N H-Bridge channels forward at 210 PWM. Pulling back (Y < 400) reverses both wheels. Pushing left/right (X thresholds) differential-steers the rover by counter-rotating motors at 190 PWM, while live X/Y telemetry logs to Serial.", 8, "Robotics + Inputs", "Advanced", ["Joystick", "Rover", "L298N", "DC Motor", "Robotics"],
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
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect Joystick to 5V/GND, VRX to A0, VRY to A1. Wire L298N driver to Arduino D5-D10, 9V battery to VS, and left/right DC motors to OUT1-OUT4.",
      "2. ⚙️ Code Architecture & Logic: Setup initializes pins. Loop reads joystick X/Y; if Y>600 both motors drive forward; if Y<400 both reverse; if X deflects, motors counter-rotate to steer.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start the rover. Click and drag the joystick thumbstick on canvas in any direction (forward, back, left, right).",
      "4. 📊 Outcomes & Real-Time Observations: Both rover motors respond dynamically with forward, reverse, and skid-steering spin directions accompanied by live RPM telemetry.",
    ]),
  starter("g8-keypad-lock", "🔒 Smart Security Vault Safe (Keypad + LCD + Servo Lock)", "Electronic combination safe with matrix keypad authentication! A 4×4 matrix keypad scans rows (D2-D5) and columns (D6-D9) to detect keypresses. While locked, a 16×2 I2C LCD displays 'VAULT LOCKED'. When any key is entered, the safe grants access: the LCD shows 'ACCESS GRANTED!', green LED lights up (D13), buzzer sounds a confirmation chime (D11), and a servo deadbolt unlocks to 90° on D10 before auto-relocking.", 8, "Human Interface", "Advanced", ["Keypad", "Security", "LCD", "Servo", "Access Control"],
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
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire 4x4 keypad rows to D2-D5 and cols to D6-D9. Connect I2C LCD to A4/A5, deadbolt servo to D10, buzzer to D11, and green LED to D13.",
      "2. ⚙️ Code Architecture & Logic: Setup sets servo to 0° (locked) and LCD to 'VAULT LOCKED'. Loop polls keypad_read; when a key is pressed, it opens servo (90°), chimes buzzer, and relocks.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to arm vault. Click key '1' on the 4x4 matrix keypad component on the canvas to trigger unlock sequence.",
      "4. 📊 Outcomes & Real-Time Observations: The deadbolt servo swings 90°, the green access LED illuminates, the buzzer sounds a chime, and the LCD confirms 'ACCESS GRANTED!'.",
    ]),
  starter("g8-relay-home", "🏠 Automated Smart Home (PIR Motion + Relay + Cooling Fan + Lamp)", "High-voltage home automation with PIR motion and electromechanical relay! The PIR motion sensor monitors room occupancy on digital pin D7. When movement is detected, Arduino energizes an electromechanical relay module on pin D8. The relay's internal electromagnet closes the Normally Open (NO) contacts, routing power from a 9V battery to spin a ceiling cooling fan (DC motor) at 1800 RPM and illuminate the room lamp.", 8, "Automation", "Advanced", ["Relay", "Automation", "PIR Motion", "DC Motor", "Smart Home"],
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
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Wire PIR OUT to D7 and Relay IN to D8. Connect 9V battery through Relay COM and NO terminals to power the DC motor fan and lamp LED.",
      "2. ⚙️ Code Architecture & Logic: Setup configures D7 as INPUT and D8 as OUTPUT. The loop evaluates pir_motion; when active, D8 pulls HIGH, clicking the relay ON for 1.2s.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to arm room automation. In the Inspector panel, toggle the PIR motion trigger to simulate an occupant entering the room.",
      "4. 📊 Outcomes & Real-Time Observations: The relay contacts close with a mechanical click, the ceiling fan spins up rapidly to 1800 RPM, and the room lamp illuminates brightly.",
    ]),
]

export const TEMPLATES: ProjectTemplate[] = BASE_TEMPLATES.map((template) => {
  const meta = BASE_TEMPLATE_META[template.id]
  return meta ? { ...template, ...meta } : template
}).concat(EXTRA_TEMPLATES)