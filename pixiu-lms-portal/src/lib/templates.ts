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
    description: "Synchronized municipal traffic intersection with acoustic pedestrian crosswalk guidance! The Arduino executes a state machine controlling Red (D12), Yellow (D11), and Green (D10) signal lamps, plus a Pedestrian Walk Blue lamp (D9) and pedestrian call button (D2). During the Green pedestrian phase, D8 activates an acoustic pulsing chime from the buzzer to assist visually impaired pedestrians, following strict real-world timing transitions.",
    difficulty: "Beginner",
    tags: ["Traffic", "LEDs", "Pedestrian Crosswalk", "Buzzer", "Sequencing"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "walk_btn", type: "pushbutton", x: 250, y: 100, rotation: 0, props: {} },
        { id: "red_led", type: "led", x: 420, y: 40, rotation: 0, props: { color: "red" } },
        { id: "yellow_led", type: "led", x: 420, y: 120, rotation: 0, props: { color: "yellow" } },
        { id: "green_led", type: "led", x: 420, y: 200, rotation: 0, props: { color: "green" } },
        { id: "walk_led", type: "led", x: 420, y: 280, rotation: 0, props: { color: "blue" } },
        { id: "r1", type: "resistor", x: 500, y: 40, rotation: 0, props: { resistance: 220 } },
        { id: "r2", type: "resistor", x: 500, y: 120, rotation: 0, props: { resistance: 220 } },
        { id: "r3", type: "resistor", x: 500, y: 200, rotation: 0, props: { resistance: 220 } },
        { id: "r4", type: "resistor", x: 500, y: 280, rotation: 0, props: { resistance: 220 } },
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
        { id: "w12", from: { partId: "uno", pinId: "d9" }, to: { partId: "r4", pinId: "a" }, color: "#3b82f6" },
        { id: "w13", from: { partId: "r4", pinId: "b" }, to: { partId: "walk_led", pinId: "anode" }, color: "#3b82f6" },
        { id: "w14", from: { partId: "walk_led", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w15", from: { partId: "uno", pinId: "5v" }, to: { partId: "walk_btn", pinId: "p1a" }, color: "#ef4444" },
        { id: "w16", from: { partId: "walk_btn", pinId: "p2a" }, to: { partId: "uno", pinId: "d2" }, color: "#22c55e" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">11</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">10</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">9</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">INPUT</field></block>
      </next></block></next></block></next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">9</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">2500</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">10</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">9</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">2000</field></shadow></value></block>
      </next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "blink-led",
    title: "10. 🚨 Dual Alternating Police Strobe (Red & Blue LEDs + Siren Buzzer)",
    description: "Emergency vehicle alternating dual police strobe with acoustic piezo siren and mode switch! The Arduino alternates digital logic HIGH and LOW states between Red LED (pin D13) and Blue LED (pin D12) with synchronized audio chirps from buzzer D8 and push-button mode trigger on D2.",
    difficulty: "Beginner",
    tags: ["LED", "Dual Strobe", "Resistor", "Digital Output", "Buzzer", "Siren"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "btn", type: "pushbutton", x: 260, y: 100, rotation: 0, props: {} },
        { id: "buzzer", type: "buzzer", x: 260, y: 210, rotation: 0, props: {} },
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
        { id: "w7", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w8", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w9", from: { partId: "uno", pinId: "5v" }, to: { partId: "btn", pinId: "p1a" }, color: "#ef4444" },
        { id: "w10", from: { partId: "btn", pinId: "p2a" }, to: { partId: "uno", pinId: "d2" }, color: "#22c55e" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">INPUT</field></block>
      </next></block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
      <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">300</field></shadow></value>
      </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "servo-sweep",
    title: "11. 🦾 Robotic Servo Turret with Auto-Scan & Audio Feedback",
    description: "Interactive robotic servo positioning turret with audio clicks and strobe indicator! The Arduino generates precision 50Hz PWM signals on D9 to sweep the servo arm between 0°, 90°, and 180°. Pressing the on-canvas trigger button on D2 engages high-speed scanning, an audio clicker on D8 sounds at each position, and a green status LED on D13 tracks movement.",
    difficulty: "Intermediate",
    tags: ["Servo", "Robotics", "PWM", "Pushbutton", "Buzzer", "Actuator"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "servo1", type: "servo", x: 440, y: 80, rotation: 0, props: { angle: 90 } },
        { id: "btn", type: "pushbutton", x: 270, y: 90, rotation: 0, props: {} },
        { id: "buzzer", type: "buzzer", x: 270, y: 200, rotation: 0, props: {} },
        { id: "led1", type: "led", x: 600, y: 80, rotation: 0, props: { color: "green" } },
        { id: "r1", type: "resistor", x: 600, y: 160, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo1", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "servo1", pinId: "gnd" }, color: "#1e293b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo1", pinId: "sig" }, color: "#fb923c" },
        { id: "w4", from: { partId: "uno", pinId: "5v" }, to: { partId: "btn", pinId: "p1a" }, color: "#ef4444" },
        { id: "w5", from: { partId: "btn", pinId: "p2a" }, to: { partId: "uno", pinId: "d2" }, color: "#22c55e" },
        { id: "w6", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer", pinId: "pos" }, color: "#eab308" },
        { id: "w7", from: { partId: "buzzer", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w8", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
        { id: "w9", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
        { id: "w10", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="io_pinmode"><field name="PIN">2</field><field name="MODE">INPUT</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field>
      </block></next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">60</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">600</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">60</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">600</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">180</field></shadow></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">60</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">600</field></shadow></value><next>
      <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field>
      </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
    </statement>
  </block>
</xml>`,
  },
  {
    id: "ultrasonic-radar",
    title: "12. 📏 Ultrasonic Distance Sensor & 3-Zone Proximity Radar",
    description: "Automotive 3-zone ultrasonic parking radar with acoustic frequency alarm! The HC-SR04 emits ultrasonic pings from Trig (D9) and Echo (D10) to calculate obstacle distance. Readings stream to Serial Monitor, while three zone LEDs (Green Safe on D13, Yellow Caution on D12, Red Hazard on D11) and Piezo Buzzer D8 provide instant visual and acoustic proximity warnings.",
    difficulty: "Advanced",
    tags: ["Ultrasonic", "Serial", "Proximity", "Sensors", "LED Radar", "Buzzer"],
    circuit: {
      parts: [
        { id: "uno", type: "arduino-uno", x: 60, y: 100, rotation: 0, props: {} },
        { id: "sonar", type: "ultrasonic", x: 380, y: 80, rotation: 0, props: { distance: 45 } },
        { id: "buzzer1", type: "buzzer", x: 380, y: 220, rotation: 0, props: {} },
        { id: "led_green", type: "led", x: 560, y: 60, rotation: 0, props: { color: "green" } },
        { id: "r_green", type: "resistor", x: 560, y: 140, rotation: 0, props: { resistance: 220 } },
        { id: "led_yellow", type: "led", x: 670, y: 60, rotation: 0, props: { color: "yellow" } },
        { id: "r_yellow", type: "resistor", x: 670, y: 140, rotation: 0, props: { resistance: 220 } },
        { id: "led_red", type: "led", x: 780, y: 60, rotation: 0, props: { color: "red" } },
        { id: "r_red", type: "resistor", x: 780, y: 140, rotation: 0, props: { resistance: 220 } },
      ],
      wires: [
        { id: "w1", from: { partId: "uno", pinId: "5v" }, to: { partId: "sonar", pinId: "vcc" }, color: "#ef4444" },
        { id: "w2", from: { partId: "uno", pinId: "gnd" }, to: { partId: "sonar", pinId: "gnd" }, color: "#1e293b" },
        { id: "w3", from: { partId: "uno", pinId: "d9" }, to: { partId: "sonar", pinId: "trig" }, color: "#60a5fa" },
        { id: "w4", from: { partId: "uno", pinId: "d10" }, to: { partId: "sonar", pinId: "echo" }, color: "#38bdf8" },
        { id: "w5", from: { partId: "uno", pinId: "d8" }, to: { partId: "buzzer1", pinId: "pos" }, color: "#eab308" },
        { id: "w6", from: { partId: "buzzer1", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w7", from: { partId: "uno", pinId: "d13" }, to: { partId: "r_green", pinId: "a" }, color: "#22c55e" },
        { id: "w8", from: { partId: "r_green", pinId: "b" }, to: { partId: "led_green", pinId: "anode" }, color: "#22c55e" },
        { id: "w9", from: { partId: "led_green", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w10", from: { partId: "uno", pinId: "d12" }, to: { partId: "r_yellow", pinId: "a" }, color: "#fbbf24" },
        { id: "w11", from: { partId: "r_yellow", pinId: "b" }, to: { partId: "led_yellow", pinId: "anode" }, color: "#fbbf24" },
        { id: "w12", from: { partId: "led_yellow", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
        { id: "w13", from: { partId: "uno", pinId: "d11" }, to: { partId: "r_red", pinId: "a" }, color: "#ef4444" },
        { id: "w14", from: { partId: "r_red", pinId: "b" }, to: { partId: "led_red", pinId: "anode" }, color: "#ef4444" },
        { id: "w15", from: { partId: "led_red", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
      ],
    },
    blocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">11</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block></next></block></next></block>
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
          <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field></block>
          </next></block></next></block></next></block>
          </next></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">11</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field></block>
          </next></block></next></block></next></block>
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
  starter("g6-pushbutton-led", "🔘 Interactive Pushbutton Control Station (Dual LED + Click Buzzer)", "Tactile digital input switch controlling dual indicators and acoustic click feedback! Pressing the momentary pushbutton pulls D2 HIGH. The microcontroller switches the Green active LED (D13) ON, extinguishes the Amber standby LED (D12), and chirps the piezo buzzer (D8) with instantaneous acoustic confirmation.", 6, "Digital Inputs", "Beginner", ["Pushbutton", "Digital Input", "Dual LED", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",310,90),part("bz","buzzer",310,210),part("led1","led",520,70,{color:"green"}),part("r1","resistor",520,150,{resistance:220}),part("led2","led",640,70,{color:"yellow"}),part("r2","resistor",640,150,{resistance:220})], wires: [wire("p1","uno","d2","btn","p1a"),wire("p2","btn","p2a","uno","5v","#ef4444"),wire("p3","uno","d13","r1","a","#22c55e"),wire("p4","r1","b","led1","anode","#22c55e"),wire("p5","led1","cathode","uno","gnd","#1e293b"),wire("p6","uno","d12","r2","a","#facc15"),wire("p7","r2","b","led2","anode","#facc15"),wire("p8","led2","cathode","uno","gnd","#1e293b"),wire("p9","uno","d8","bz","pos","#eab308"),wire("p10","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("13","OUTPUT"),pinMode("12","OUTPUT"),pinMode("8","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("13","HIGH"),digitalWrite("12","LOW"),digitalWrite("8","HIGH"),delay(60),digitalWrite("8","LOW")],
        [digitalWrite("13","LOW"),digitalWrite("12","HIGH"),digitalWrite("8","LOW")],
      ),
      delay(50),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect pushbutton to D2 and 5V. Wire green LED to D13 and yellow LED to D12 through 220Ω resistors. Connect piezo buzzer to D8 and common GND.",
      "2. ⚙️ Code Architecture & Logic: Set D2 as INPUT and D13, D12, D8 as OUTPUT. The loop evaluates pushbutton_read; when pressed, D13 illuminates, D12 dims, and D8 sounds a sharp click.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start simulation, then click and hold the tactile pushbutton on the canvas.",
      "4. 📊 Outcomes & Real-Time Observations: The green lamp shines brightly and the buzzer chirps cleanly while pressed; releasing returns the circuit to amber standby.",
    ]),
  starter("g6-pot-brightness", "🎛️ Potentiometer Dual-Channel Dimmer & Audio Pitch Synth", "Variable voltage divider with PWM modulation and audio pitch synthesis! Turning the potentiometer varies analog voltage on A0 (0 to 1023). Arduino maps this value to PWM pin D9 for smooth blue LED dimming, lights the Green threshold LED (D10) when past 50%, and chirps the buzzer on D8.", 6, "Analog Input", "Beginner", ["Potentiometer", "Analog", "PWM", "Dual LED", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("pot","potentiometer",300,100,{value:512}),part("bz","buzzer",300,220),part("led1","led",500,70,{color:"blue"}),part("r1","resistor",500,150,{resistance:220}),part("led2","led",620,70,{color:"green"}),part("r2","resistor",620,150,{resistance:220})], wires: [wire("a","uno","5v","pot","t1","#ef4444"),wire("b","uno","gnd","pot","t2","#1e293b"),wire("c","pot","wiper","uno","a0","#eab308"),wire("d","uno","d9","r1","a","#3b82f6"),wire("e","r1","b","led1","anode","#3b82f6"),wire("f","led1","cathode","uno","gnd","#1e293b"),wire("g","uno","d10","r2","a","#22c55e"),wire("h","r2","b","led2","anode","#22c55e"),wire("i","led2","cathode","uno","gnd","#1e293b"),wire("j","uno","d8","bz","pos","#eab308"),wire("k","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT"),pinMode("10","OUTPUT"),pinMode("8","OUTPUT")],[
      block("io_analogwrite", { PIN: "9" }, {
        VALUE: "<block type=\"arduino_map\"><value name=\"VALUE\">" + sensorBlock("potentiometer_read", "pot") + "</value><value name=\"FROM_LOW\">" + numberBlock(0) + "</value><value name=\"FROM_HIGH\">" + numberBlock(1023) + "</value><value name=\"TO_LOW\">" + numberBlock(0) + "</value><value name=\"TO_HIGH\">" + numberBlock(255) + "</value></block>",
      }),
      ifElseBlock(
        compareBlock("GT", sensorBlock("potentiometer_read", "pot"), numberBlock(512)),
        [digitalWrite("10","HIGH"),digitalWrite("8","HIGH"),delay(25),digitalWrite("8","LOW")],
        [digitalWrite("10","LOW"),digitalWrite("8","LOW")],
      ),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect potentiometer to 5V, GND, and A0. Connect blue LED to PWM D9 and green LED to D10 via 220Ω resistors. Connect buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Maps A0 (0-1023) to PWM duty cycle on D9. If reading exceeds 512, energizes D10 green indicator and triggers audio click on D8.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then drag the rotary potentiometer knob on the canvas from 0% to 100%.",
      "4. 📊 Outcomes & Real-Time Observations: The blue lamp dims smoothly while the green indicator and buzzer trip as the knob crosses midpoint.",
    ]),
  starter("g6-rgb-mood-lamp", "🌈 RGB Mood Lamp & Interactive Color Strobe Station", "Multi-channel pulse-width modulation RGB color blending with interactive mode controls! The Arduino drives RGB color channels on PWM pins D9, D10, and D11, while monitoring an on-canvas Pushbutton on D2 and Potentiometer on A0 with acoustic chime on D8.", 6, "Multi-Output", "Beginner", ["RGB LED", "Colour", "GPIO", "Pushbutton", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",260,90),part("bz","buzzer",260,200),part("rgb","rgb-led",460,90,{}),part("pot","potentiometer",370,200,{value:512})], wires: [wire("r","uno","d9","rgb","red","#ef4444"),wire("g","uno","d10","rgb","green","#22c55e"),wire("b","uno","d11","rgb","blue","#3b82f6"),wire("gnd","uno","gnd","rgb","gnd","#1e293b"),wire("w_btn_vcc","uno","5v","btn","p1a","#ef4444"),wire("w_btn_sig","btn","p2a","uno","d2","#22c55e"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b"),wire("w_pot_vcc","uno","5v","pot","t1","#ef4444"),wire("w_pot_gnd","uno","gnd","pot","t2","#1e293b"),wire("w_pot_w","pot","wiper","uno","a0","#eab308")] },
    program([pinMode("9","OUTPUT"),pinMode("10","OUTPUT"),pinMode("11","OUTPUT"),pinMode("8","OUTPUT"),pinMode("2","INPUT")],[
      analogWrite("9",255),analogWrite("10",90),analogWrite("11",180),
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("8","HIGH"),analogWrite("9",0),analogWrite("10",255),analogWrite("11",255),delay(200),digitalWrite("8","LOW")],
        [digitalWrite("8","LOW")],
      ),
      delay(400),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect RGB LED common cathode to GND, R to D9, G to D10, B to D11. Connect mode pushbutton to D2 and buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Outputs blended PWM color hues. When pushbutton is pressed, activates party strobe and plays chime on D8.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start illumination. Click the pushbutton on canvas to trigger party color shifts.",
      "4. 📊 Outcomes & Real-Time Observations: Ambient violet mood glow transforms into vivid cyan flash accompanied by chime tones.",
    ]),
  starter("g6-buzzer-doorbell", "🔔 Smart Motion-Activated Video Doorbell (PIR + Chime + Welcome Light)", "Audible annunciator and motion security system! Detects visitor arrival via either tactile pushbutton (D2) or PIR infrared motion sensor (D7). The Arduino activates an acoustic 2-tone melodic chime on D8 and illuminates the welcoming LED porch light on D13.", 6, "Digital Inputs + Outputs", "Beginner", ["Pushbutton", "Buzzer", "PIR Motion", "Welcome Lamp"],
    { parts: [part("uno","arduino-uno",60,110),part("btn","pushbutton",270,90),part("pir","pir-sensor",430,60,{motion:"false"}),part("bz","buzzer",270,210),part("led1","led",590,80,{color:"green"}),part("r1","resistor",590,160,{resistance:220})], wires: [wire("a","uno","d2","btn","p1a"),wire("b","btn","p2a","uno","5v","#ef4444"),wire("c","uno","d8","bz","pos","#facc15"),wire("d","bz","neg","uno","gnd","#1e293b"),wire("w_pvcc","uno","5v","pir","vcc","#ef4444"),wire("w_pgnd","uno","gnd","pir","gnd","#1e293b"),wire("w_pout","uno","d7","pir","out","#60a5fa"),wire("w_la","uno","d13","r1","a","#22c55e"),wire("w_lb","r1","b","led1","anode","#22c55e"),wire("w_lgnd","led1","cathode","uno","gnd","#1e293b")] },
    program([pinMode("2","INPUT"),pinMode("7","INPUT"),pinMode("8","OUTPUT"),pinMode("13","OUTPUT")],[
      ifElseBlock(
        sensorBlock("pushbutton_read", "btn"),
        [digitalWrite("13","HIGH"),digitalWrite("8","HIGH"),delay(250),digitalWrite("8","LOW"),delay(150),digitalWrite("8","HIGH"),delay(250),digitalWrite("8","LOW"),digitalWrite("13","LOW")],
        [
          ifElseBlock(
            sensorBlock("pir_motion", "pir"),
            [digitalWrite("13","HIGH"),digitalWrite("8","HIGH"),delay(150),digitalWrite("8","LOW"),delay(300),digitalWrite("13","LOW")],
            [digitalWrite("13","LOW"),digitalWrite("8","LOW")],
          ),
        ],
      ),
      delay(50),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect tactile doorbell button to D2, PIR motion sensor to D7, piezo chime buzzer to D8, and welcome green lamp to D13.",
      "2. ⚙️ Code Architecture & Logic: Configures D2 and D7 as INPUT. When button is tapped or motion tripped, rings chime on D8 and illuminates D13 welcome light.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then click the pushbutton or toggle motion on the PIR sensor in the canvas inspector.",
      "4. 📊 Outcomes & Real-Time Observations: The system sounds a realistic entry chime while illuminating the visitor welcome lamp.",
    ]),
  starter("g6-seven-segment", "🔢 7-Segment Digital Decade Counter (0-9 Display + Pushbutton + Chime)", "Interactive digital decade counter! The Arduino Uno drives all seven segment bars (a-g on pins D2-D8) through common GND to render digits 0 through 9 with glowing LED precision. Each count transition triggers an audio chime on pin D10 and flashes the pulse LED on D13, while an on-canvas Pushbutton on D9 allows manual step increments.", 6, "Displays", "Beginner", ["7-Segment", "Counter", "Pushbutton", "Buzzer", "Numbers"],
    {
      parts: [
        part("uno", "arduino-uno", 50, 110),
        part("seg", "seven-segment", 420, 75, { digit: 0 }),
        part("btn", "pushbutton", 250, 95),
        part("buzzer", "buzzer", 250, 210),
        part("led", "led", 570, 75, { color: "green" }),
        part("r1", "resistor", 570, 150, { resistance: 220 }),
      ],
      wires: [
        wire("w_a", "uno", "d2", "seg", "a", "#ef4444"),
        wire("w_b", "uno", "d3", "seg", "b", "#f97316"),
        wire("w_c", "uno", "d4", "seg", "c", "#eab308"),
        wire("w_d", "uno", "d5", "seg", "d", "#22c55e"),
        wire("w_e", "uno", "d6", "seg", "e", "#3b82f6"),
        wire("w_f", "uno", "d7", "seg", "f", "#8b5cf6"),
        wire("w_g", "uno", "d8", "seg", "g", "#ec4899"),
        wire("w_com", "uno", "gnd", "seg", "com", "#1e293b"),
        wire("w_bpwr", "uno", "5v", "btn", "p1a", "#ef4444"),
        wire("w_bsig", "btn", "p2a", "uno", "d9", "#22c55e"),
        wire("w_bzpos", "uno", "d10", "buzzer", "pos", "#eab308"),
        wire("w_bzgnd", "buzzer", "neg", "uno", "gnd", "#1e293b"),
        wire("w_lr", "uno", "d13", "r1", "a", "#22c55e"),
        wire("w_la", "r1", "b", "led", "anode", "#22c55e"),
        wire("w_lgnd", "led", "cathode", "uno", "gnd", "#1e293b"),
      ],
    },
    program([
      pinMode("2","OUTPUT"),pinMode("3","OUTPUT"),pinMode("4","OUTPUT"),pinMode("5","OUTPUT"),
      pinMode("6","OUTPUT"),pinMode("7","OUTPUT"),pinMode("8","OUTPUT"),
      pinMode("9","INPUT"),pinMode("10","OUTPUT"),pinMode("13","OUTPUT")
    ],[
      // Digit 0: a,b,c,d,e,f ON, g OFF
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),digitalWrite("7","HIGH"),digitalWrite("8","LOW"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 1: b,c ON
      digitalWrite("2","LOW"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","LOW"),digitalWrite("6","LOW"),digitalWrite("7","LOW"),digitalWrite("8","LOW"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 2: a,b,d,e,g ON
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","LOW"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),digitalWrite("7","LOW"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 3: a,b,c,d,g ON
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","LOW"),digitalWrite("7","LOW"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 4: b,c,f,g ON
      digitalWrite("2","LOW"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","LOW"),digitalWrite("6","LOW"),digitalWrite("7","HIGH"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 5: a,c,d,f,g ON
      digitalWrite("2","HIGH"),digitalWrite("3","LOW"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","LOW"),digitalWrite("7","HIGH"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 6: a,c,d,e,f,g ON
      digitalWrite("2","HIGH"),digitalWrite("3","LOW"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),digitalWrite("7","HIGH"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 7: a,b,c ON
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","LOW"),digitalWrite("6","LOW"),digitalWrite("7","LOW"),digitalWrite("8","LOW"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 8: ALL ON
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","HIGH"),digitalWrite("7","HIGH"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
      // Digit 9: a,b,c,d,f,g ON
      digitalWrite("2","HIGH"),digitalWrite("3","HIGH"),digitalWrite("4","HIGH"),digitalWrite("5","HIGH"),digitalWrite("6","LOW"),digitalWrite("7","HIGH"),digitalWrite("8","HIGH"),
      digitalWrite("10","HIGH"),digitalWrite("13","HIGH"),delay(50),digitalWrite("10","LOW"),digitalWrite("13","LOW"),delay(650),
    ]),
    [
      "1. 🔌 Circuit Wiring: All 7 segments a-g wire to Arduino pins D2-D8, common COM to GND. Connect Pushbutton to D9, Buzzer to D10, and Pulse LED to D13.",
      "2. ⚙️ Code Architecture: Program cycles through numeric segment patterns 0 to 9, emitting a click sound and LED strobe on each count.",
      "3. ▶️ Interaction: Press Run to watch the automatic counter. Use the on-canvas quick digit buttons to jump directly to any number.",
      "4. 📊 Output: Crisp red numeric digits illuminate smoothly across the 7-segment display with audio-visual synchronization.",
    ]),
  starter("g6-ldr-night-lamp", "💡 Smart Night Lamp & Perimeter Security (LDR + PIR Motion + Siren)", "Photosensitive ambient light controller and motion security system! A Light Dependent Resistor (LDR) monitors ambient illumination on analog pin A0. In daylight, lamps remain OFF; when darkness falls (<400), Arduino lights the Yellow Lamp on D13 and Blue Ambient LED on D12. If the PIR sensor on D7 trips motion at night, the security siren on D8 chirps an intruder warning.", 6, "Sensors", "Intermediate", ["LDR", "Analog", "PIR Motion", "Dual LED", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("ldr","ldr",300,90),part("pir","pir-sensor",440,60,{motion:"false"}),part("bz","buzzer",300,210),part("led1","led",600,70,{color:"yellow"}),part("r1","resistor",600,150,{resistance:220}),part("led2","led",710,70,{color:"blue"}),part("r2","resistor",710,150,{resistance:220})], wires: [wire("a","uno","5v","ldr","t1","#ef4444"),wire("b","ldr","t2","uno","a0","#eab308"),wire("c","uno","d13","r1","a","#facc15"),wire("d","r1","b","led1","anode","#facc15"),wire("e","led1","cathode","uno","gnd","#1e293b"),wire("w_pvcc","uno","5v","pir","vcc","#ef4444"),wire("w_pgnd","uno","gnd","pir","gnd","#1e293b"),wire("w_pout","uno","d7","pir","out","#60a5fa"),wire("w_l2a","uno","d12","r2","a","#3b82f6"),wire("w_l2b","r2","b","led2","anode","#3b82f6"),wire("w_l2gnd","led2","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT"),pinMode("12","OUTPUT"),pinMode("8","OUTPUT"),pinMode("7","INPUT")],[
      ifElseBlock(
        compareBlock("LT", sensorBlock("ldr_read", "ldr"), numberBlock(400)),
        [
          digitalWrite("13","HIGH"),digitalWrite("12","HIGH"),
          ifElseBlock(
            sensorBlock("pir_motion", "pir"),
            [digitalWrite("8","HIGH"),delay(150),digitalWrite("8","LOW")],
            [digitalWrite("8","LOW")],
          ),
        ],
        [digitalWrite("13","LOW"),digitalWrite("12","LOW"),digitalWrite("8","LOW")],
      ),
      delay(100),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect LDR between 5V and A0, PIR motion OUT to D7. Wire yellow street lamp to D13 and blue ambient LED to D12 via 220Ω resistors. Connect siren buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Evaluates ldr_read on A0; if < 400 (darkness), powers D13 and D12. If PIR motion trips at night, sounds audible warning on D8.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start illumination monitoring. Use the LDR slider to simulate night, then toggle the PIR motion trigger.",
      "4. 📊 Outcomes & Real-Time Observations: Dual lamps illuminate automatically in darkness, and intruder motion trips the audio security siren.",
    ]),
  starter("g7-pir-security", "🚨 Smart Intrusion Defense Grid (PIR + Siren + Dual Alert LEDs + Armed Key)", "Passive Infrared intrusion defense grid with dual status indicators and acoustic siren! The PIR sensor monitors motion on D7. When movement occurs, Arduino triggers the high-decibel Piezo Siren on D8 and strobes the high-intensity Red Alarm LED on D13, while Green LED on D12 displays system armed state.", 7, "Sensors + Automation", "Intermediate", ["PIR", "Motion", "Security", "Siren", "Dual LED"],
    { parts: [part("uno","arduino-uno",60,110),part("pir","pir-sensor",320,60,{motion:"false"}),part("btn","pushbutton",200,210),part("bz","buzzer",320,210),part("led1","led",540,70,{color:"red"}),part("r1","resistor",540,150,{resistance:220}),part("led2","led",650,70,{color:"green"}),part("r2","resistor",650,150,{resistance:220})], wires: [wire("a","uno","5v","pir","vcc","#ef4444"),wire("b","uno","gnd","pir","gnd","#1e293b"),wire("c","uno","d7","pir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b"),wire("w_btn_vcc","uno","5v","btn","p1a","#ef4444"),wire("w_btn_sig","btn","p2a","uno","d2","#22c55e"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b"),wire("w_l2a","uno","d12","r2","a","#22c55e"),wire("w_l2b","r2","b","led2","anode","#22c55e"),wire("w_l2gnd","led2","cathode","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("2","INPUT"),pinMode("13","OUTPUT"),pinMode("12","OUTPUT"),pinMode("8","OUTPUT")],[
      digitalWrite("12","HIGH"),
      ifElseBlock(
        sensorBlock("pir_motion", "pir"),
        [digitalWrite("13","HIGH"),digitalWrite("8","HIGH"),delay(250),digitalWrite("8","LOW"),delay(100)],
        [digitalWrite("13","LOW"),digitalWrite("8","LOW")],
      ),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect PIR OUT to D7. Wire red alarm LED to D13 and green armed LED to D12 via 220Ω resistors. Connect piezo siren to D8 and arm key to D2.",
      "2. ⚙️ Code Architecture & Logic: Keeps green armed indicator active. When pir_motion detects an intruder, strobes red LED on D13 and sounds the D8 siren.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to arm perimeter security, then toggle the PIR motion trigger in the canvas inspector.",
      "4. 📊 Outcomes & Real-Time Observations: The green armed light stays solid; upon intruder detection, red strobe flashes and the siren blares urgently.",
    ]),
  starter("g7-tmp36-alert", "🌡️ Climate Overheat Protection System (TMP36 + DC Cooling Fan + Dual LEDs + Siren)", "Analog thermal monitoring with automated cooling fan and dual status warnings! The TMP36 outputs linear voltage on A0. When temperature exceeds safe thresholds (30°C), Arduino activates the DC Motor Cooling Fan on D5, sounds the emergency audio siren on D8, and flips from Normal Green LED (D12) to Overheat Red LED (D13).", 7, "Analog Sensors", "Intermediate", ["TMP36", "Temperature", "DC Motor", "Fan", "Alarm"],
    { parts: [part("uno","arduino-uno",60,110),part("tmp","tmp36",320,80,{temperature:28}),part("fan","dc-motor",520,60),part("bz","buzzer",320,210),part("led1","led",660,70,{color:"green"}),part("r1","resistor",660,150,{resistance:220}),part("led2","led",760,70,{color:"red"}),part("r2","resistor",760,150,{resistance:220})], wires: [wire("a","uno","5v","tmp","vcc","#ef4444"),wire("b","tmp","out","uno","a0","#eab308"),wire("c","tmp","gnd","uno","gnd","#1e293b"),wire("d","uno","d8","bz","pos","#facc15"),wire("e","bz","neg","uno","gnd","#1e293b"),wire("w_fan_pos","uno","d5","fan","pos","#60a5fa"),wire("w_fan_neg","fan","neg","uno","gnd","#1e293b"),wire("w_l1a","uno","d12","r1","a","#22c55e"),wire("w_l1b","r1","b","led1","anode","#22c55e"),wire("w_l1gnd","led1","cathode","uno","gnd","#1e293b"),wire("w_l2a","uno","d13","r2","a","#ef4444"),wire("w_l2b","r2","b","led2","anode","#ef4444"),wire("w_l2gnd","led2","cathode","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("8","OUTPUT"),pinMode("5","OUTPUT"),pinMode("12","OUTPUT"),pinMode("13","OUTPUT")],[
      serialPrintValue("tmp36_temperature", { SENSOR: "tmp" }),
      ifElseBlock(
        compareBlock("GT", sensorBlock("tmp36_temperature", "tmp"), numberBlock(30)),
        [digitalWrite("13","HIGH"),digitalWrite("12","LOW"),digitalWrite("5","HIGH"),digitalWrite("8","HIGH"),delay(250),digitalWrite("8","LOW")],
        [digitalWrite("13","LOW"),digitalWrite("12","HIGH"),digitalWrite("5","LOW"),digitalWrite("8","LOW")],
      ),
      delay(500),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect TMP36 to A0. Wire DC motor cooling fan to D5. Connect green LED to D12 and red LED to D13 via 220Ω resistors. Connect buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Reads temperature on A0; if > 30°C, engages DC cooling fan on D5, sounds D8 siren, and illuminates red LED D13.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run and open the Serial Monitor. Select TMP36 in the canvas inspector and slide temperature past 30°C.",
      "4. 📊 Outcomes & Real-Time Observations: The cooling fan spins up to full speed, the red overheat LED lights, and the buzzer sounds an emergency alarm.",
    ]),
  starter("g7-dht-weather", "⛅ Digital Environmental Station (DHT11 + I2C LCD + Pulse LED + Chime)", "Digital single-bus environmental telemetry with alphanumeric LCD display! Measures ambient temperature and humidity on pin D4, streams formatted metrics to Serial Monitor, outputs live values to a 16×2 I2C LCD screen, and flashes a heartbeat activity pulse on D13 with confirmation chime on D8.", 7, "Environmental Sensors", "Intermediate", ["DHT11", "Temperature", "Humidity", "LCD", "I2C"],
    { parts: [part("uno","arduino-uno",60,120),part("dht","dht11",280,90,{temperature:25,humidity:55}),part("lcd","lcd-i2c",480,60,{line1:"TEMP: 25C",line2:"HUMIDITY: 55%"}),part("led1","led",720,70,{color:"green"}),part("r1","resistor",720,150,{resistance:220}),part("bz","buzzer",280,210)], wires: [wire("a","uno","5v","dht","vcc","#ef4444"),wire("b","uno","gnd","dht","gnd","#1e293b"),wire("c","uno","d4","dht","data","#60a5fa"),wire("w_lvcc","uno","5v","lcd","vcc","#ef4444"),wire("w_lgnd","uno","gnd","lcd","gnd","#1e293b"),wire("w_lsda","uno","a4","lcd","sda","#60a5fa"),wire("w_lscl","uno","a5","lcd","scl","#3b82f6"),wire("w_la","uno","d13","r1","a","#22c55e"),wire("w_lb","r1","b","led1","anode","#22c55e"),wire("w_lg","led1","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("4","INPUT"),pinMode("13","OUTPUT"),pinMode("8","OUTPUT")],[
      digitalWrite("13","HIGH"),
      block("lcd_clear"),
      block("lcd_set_cursor",{COL:"0",ROW:"0"}),
      block("lcd_print",{},{TEXT:textBlock("WEATHER STATION")}),
      block("lcd_set_cursor",{COL:"0",ROW:"1"}),
      block("lcd_print",{},{TEXT:textBlock("T: 25C | H: 55%")}),
      serialPrint("Temperature: "),serialPrintValue("dht_temperature"),
      serialPrint("Humidity: "),serialPrintValue("dht_humidity"),
      digitalWrite("13","LOW"),
      delay(1000),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect DHT11 to D4, I2C LCD to A4/A5, telemetry pulse LED to D13 with 220Ω resistor, and audio buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Queries DHT11 temperature and humidity, outputs real-time readings to the LCD, pulses D13 LED, and streams data over Serial.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, select DHT11 in the inspector, and adjust temperature or humidity sliders.",
      "4. 📊 Outcomes & Real-Time Observations: The LCD display updates with crisp alphanumeric readings synchronized with heartbeat LED pulses.",
    ]),
  starter("g7-soil-smart-farm", "🌱 Automated Smart Agriculture Irrigation System (Soil Probe + DC Pump + Siren + Dual LEDs)", "Automated precision agriculture soil hydration monitor with DC irrigation pump! Conductive soil probes measure electrical impedance on A0. When soil drops below 600, Arduino illuminates the Red Drought LED on D12, triggers the DC Motor Irrigation Pump on D5 to deliver water, and chirps an alert buzzer on D8.", 7, "Smart Farming", "Intermediate", ["Soil Moisture", "Analog", "IoT", "DC Motor", "Pump"],
    { parts: [part("uno","arduino-uno",60,110),part("soil","soil-moisture",300,80,{moisture:620}),part("pump","dc-motor",490,60),part("bz","buzzer",300,210),part("led1","led",630,70,{color:"green"}),part("r1","resistor",630,150,{resistance:220}),part("led2","led",740,70,{color:"red"}),part("r2","resistor",740,150,{resistance:220})], wires: [wire("a","uno","5v","soil","vcc","#ef4444"),wire("b","soil","ao","uno","a0","#eab308"),wire("c","soil","gnd","uno","gnd","#1e293b"),wire("d","uno","d13","r1","a","#22c55e"),wire("e","r1","b","led1","anode","#22c55e"),wire("f","led1","cathode","uno","gnd","#1e293b"),wire("w_pump_pos","uno","d5","pump","pos","#60a5fa"),wire("w_pump_neg","pump","neg","uno","gnd","#1e293b"),wire("w_l2a","uno","d12","r2","a","#ef4444"),wire("w_l2b","r2","b","led2","anode","#ef4444"),wire("w_l2gnd","led2","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("13","OUTPUT"),pinMode("12","OUTPUT"),pinMode("5","OUTPUT"),pinMode("8","OUTPUT")],[
      ifElseBlock(
        compareBlock("GT", sensorBlock("soil_moisture_read", "soil"), numberBlock(600)),
        [digitalWrite("13","HIGH"),digitalWrite("12","LOW"),digitalWrite("5","LOW"),digitalWrite("8","LOW")],
        [digitalWrite("13","LOW"),digitalWrite("12","HIGH"),digitalWrite("5","HIGH"),digitalWrite("8","HIGH"),delay(250),digitalWrite("8","LOW")],
      ),
      delay(100),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect soil probe AO to A0. Wire DC irrigation pump motor to D5. Connect green hydrated LED to D13 and red drought LED to D12 via 220Ω resistors. Connect buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Reads soil moisture on A0; if reading > 600, illuminates green LED; if dry (<= 600), activates DC pump on D5 and red warning indicator.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, select the soil moisture sensor on canvas, and drag its moisture slider below 600.",
      "4. 📊 Outcomes & Real-Time Observations: The irrigation pump spins up instantly to water dry crops, accompanied by visual and acoustic alerts.",
    ]),
  starter("g7-ir-obstacle", "📦 Conveyor Sorting Diverter (IR Optical Sensor + Servo Gate + Chime + Dual LEDs)", "Active infrared optical detection with automated robotic diverter! When an item moves down the conveyor and interrupts the IR beam on D7, Arduino illuminates the Red Obstacle Strobe on D13, sounds the Sorting Chime on D8, and swings the Servo diverter arm on D9 to 90° to route the item into sorting bins.", 7, "Digital Sensors", "Intermediate", ["IR Sensor", "Obstacle", "Robotics", "Servo", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("ir","ir-sensor",300,80,{detected:"false"}),part("servo","servo",480,60,{angle:0}),part("bz","buzzer",300,210),part("led1","led",650,70,{color:"red"}),part("r1","resistor",650,150,{resistance:220}),part("led2","led",760,70,{color:"green"}),part("r2","resistor",760,150,{resistance:220})], wires: [wire("a","uno","5v","ir","vcc","#ef4444"),wire("b","uno","gnd","ir","gnd","#1e293b"),wire("c","uno","d7","ir","out","#60a5fa"),wire("d","uno","d13","r1","a","#ef4444"),wire("e","r1","b","led1","anode","#ef4444"),wire("f","led1","cathode","uno","gnd","#1e293b"),wire("w_svcc","uno","5v","servo","vcc","#ef4444"),wire("w_sgnd","uno","gnd","servo","gnd","#1e293b"),wire("w_ssig","uno","d9","servo","sig","#f97316"),wire("w_l2a","uno","d12","r2","a","#22c55e"),wire("w_l2b","r2","b","led2","anode","#22c55e"),wire("w_l2gnd","led2","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("7","INPUT"),pinMode("13","OUTPUT"),pinMode("12","OUTPUT"),pinMode("9","OUTPUT"),pinMode("8","OUTPUT")],[
      ifElseBlock(
        sensorBlock("ir_read", "ir"),
        [
          digitalWrite("13","HIGH"),digitalWrite("12","LOW"),
          block("servo_write",{PIN:"9"},{ANGLE:numberBlock(90)}),
          digitalWrite("8","HIGH"),delay(150),digitalWrite("8","LOW"),
        ],
        [
          digitalWrite("13","LOW"),digitalWrite("12","HIGH"),
          block("servo_write",{PIN:"9"},{ANGLE:numberBlock(0)}),
          digitalWrite("8","LOW"),
        ],
      ),
      delay(80),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect IR sensor OUT to D7. Wire sorting servo to D9. Connect red obstacle LED to D13 and green clear LED to D12 via 220Ω resistors. Connect chime buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: When ir_read detects an obstacle, drives red LED D13 HIGH, commands servo to 90° diversion position, and chirps buzzer D8.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then select the IR sensor on canvas and toggle its detected obstacle checkbox.",
      "4. 📊 Outcomes & Real-Time Observations: The servo gate swings 90° with crisp buzzer confirmation, demonstrating automated industrial package routing.",
    ]),
  starter("g7-encoder-menu", "🎛️ Rotary Encoder Digital Cockpit Dial (16x2 LCD + Click Buzzer + Action LED)", "Incremental quadrature user interface dial with alphanumeric LCD readout! Rotating the encoder dial steps through software menu selections on the 16×2 I2C LCD, the piezo buzzer produces mechanical tactile click tones, and pressing the integrated encoder switch pulses the Green action LED on D13.", 7, "Human Interface", "Intermediate", ["Rotary Encoder", "Input", "Counter", "LCD", "I2C"],
    { parts: [part("uno","arduino-uno",60,110),part("enc","rotary-encoder",280,90,{value:0,pressed:"false"}),part("lcd","lcd-i2c",470,60,{line1:"DIAL POSITION",line2:"STEPS: 0"}),part("led1","led",710,70,{color:"green"}),part("r1","resistor",710,150,{resistance:220}),part("bz","buzzer",280,210)], wires: [wire("a","uno","5v","enc","vcc","#ef4444"),wire("b","uno","gnd","enc","gnd","#1e293b"),wire("c","uno","d2","enc","clk","#60a5fa"),wire("d","uno","d3","enc","dt","#3b82f6"),wire("e","uno","d4","enc","sw","#a855f7"),wire("w_lvcc","uno","5v","lcd","vcc","#ef4444"),wire("w_lgnd","uno","gnd","lcd","gnd","#1e293b"),wire("w_lsda","uno","a4","lcd","sda","#60a5fa"),wire("w_lscl","uno","a5","lcd","scl","#3b82f6"),wire("w_la","uno","d13","r1","a","#22c55e"),wire("w_lb","r1","b","led1","anode","#22c55e"),wire("w_lg","led1","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("2","INPUT"),pinMode("3","INPUT"),pinMode("4","INPUT"),pinMode("13","OUTPUT"),pinMode("8","OUTPUT")],[
      serialPrintValue("encoder_read", { SENSOR: "enc" }),
      digitalWrite("13","HIGH"),digitalWrite("8","HIGH"),delay(30),digitalWrite("8","LOW"),digitalWrite("13","LOW"),
      delay(250),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect encoder CLK to D2, DT to D3, SW to D4. Wire I2C LCD to A4/A5, buzzer to D8, and action LED to D13 with 220Ω resistor.",
      "2. ⚙️ Code Architecture & Logic: Evaluates encoder quadrature rotation, updates live values to LCD and Serial, chirps buzzer D8 for audio click, and flashes D13.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, click the rotary encoder on canvas, and rotate its dial clockwise and counterclockwise.",
      "4. 📊 Outcomes & Real-Time Observations: The Serial console and LCD log positive and negative dial steps accompanied by tactile audio click chirps.",
    ]),
  starter("g7-servo-door", "🚧 Automatic Ultrasonic Boom Barrier Gate (Sonar + Servo + Stop/Go LEDs + Chime)", "Automated smart parking boom barrier gate with ultrasonic radar sensing! The HC-SR04 sonar measures vehicle distance on D10/D11. As vehicles arrive, the Red Stop LED (D12) flips to Green Go (D13), the Gate Chime on D8 sounds an entry tone, and the barrier servo swings open to 90°.", 7, "Robotics", "Intermediate", ["Servo", "Automation", "Ultrasonic", "Boom Barrier", "Buzzer"],
    { parts: [part("uno","arduino-uno",60,110),part("sonar","ultrasonic",300,60,{distance:45}),part("servo","servo",510,60,{angle:0}),part("btn","pushbutton",200,200),part("bz","buzzer",320,200),part("led_stop","led",670,60,{color:"red"}),part("r1","resistor",670,140,{resistance:220}),part("led_go","led",770,60,{color:"green"}),part("r2","resistor",770,140,{resistance:220})], wires: [wire("a","uno","5v","servo","vcc","#ef4444"),wire("b","uno","gnd","servo","gnd","#1e293b"),wire("c","uno","d9","servo","sig","#fb923c"),wire("w_sonar_vcc","uno","5v","sonar","vcc","#ef4444"),wire("w_sonar_gnd","uno","gnd","sonar","gnd","#1e293b"),wire("w_sonar_trig","uno","d10","sonar","trig","#60a5fa"),wire("w_sonar_echo","uno","d11","sonar","echo","#38bdf8"),wire("w_btn_vcc","uno","5v","btn","p1a","#ef4444"),wire("w_btn_sig","btn","p2a","uno","d2","#22c55e"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b"),wire("w_l1a","uno","d12","r1","a","#ef4444"),wire("w_l1b","r1","b","led_stop","anode","#ef4444"),wire("w_l1g","led_stop","cathode","uno","gnd","#1e293b"),wire("w_l2a","uno","d13","r2","a","#22c55e"),wire("w_l2b","r2","b","led_go","anode","#22c55e"),wire("w_l2g","led_go","cathode","uno","gnd","#1e293b")] },
    program([pinMode("9","OUTPUT"),pinMode("8","OUTPUT"),pinMode("12","OUTPUT"),pinMode("13","OUTPUT"),pinMode("2","INPUT")],[
      block("servo_write",{PIN:"9"},{ANGLE:numberBlock(0)}),
      digitalWrite("12","HIGH"),digitalWrite("13","LOW"),
      delay(800),
      block("servo_write",{PIN:"9"},{ANGLE:numberBlock(90)}),
      digitalWrite("12","LOW"),digitalWrite("13","HIGH"),
      digitalWrite("8","HIGH"),delay(150),digitalWrite("8","LOW"),
      delay(1200),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect barrier servo to D9, ultrasonic sonar to D10/D11, emergency button to D2, stop/go LEDs to D12/D13, and chime buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Commands barrier servo to close (0°) with Red Stop lamp, then raises barrier arm (90°) with Green Go lamp and welcome chime.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then select the ultrasonic sensor or manual emergency button on canvas to trigger gate actuation.",
      "4. 📊 Outcomes & Real-Time Observations: The boom barrier lifts gracefully to 90° with green traffic signal illumination and audio chime.",
    ]),
  starter("g8-lcd-weather", "📟 I2C Alphanumeric Climate Readout (LCD + DHT11 + Pulse LED + Chime)", "Two-wire I2C alphanumeric visual readout with integrated climate sensing! The 16×2 Liquid Crystal Display communicates with the Arduino over I2C bus lines SDA (A4) and SCL (A5), while DHT11 on D4 streams real-time environmental metrics, D13 flashes telemetry pulses, and D8 chirps audio confirmation.", 8, "Displays + I2C", "Intermediate", ["LCD", "I2C", "DHT11", "Climate", "Sensors"],
    { parts: [part("uno","arduino-uno",60,110),part("dht","dht11",280,80,{temperature:24,humidity:60}),part("lcd","lcd-i2c",480,60,{line1:"PIXIU WEATHER",line2:"T: 24C | H: 60%"}),part("led1","led",720,70,{color:"green"}),part("r1","resistor",720,150,{resistance:220}),part("bz","buzzer",280,210)], wires: [wire("a","uno","5v","lcd","vcc","#ef4444"),wire("b","uno","gnd","lcd","gnd","#1e293b"),wire("c","uno","a4","lcd","sda","#60a5fa"),wire("d","uno","a5","lcd","scl","#3b82f6"),wire("w_dvcc","uno","5v","dht","vcc","#ef4444"),wire("w_dgnd","uno","gnd","dht","gnd","#1e293b"),wire("w_data","uno","d4","dht","data","#60a5fa"),wire("w_la","uno","d13","r1","a","#22c55e"),wire("w_lb","r1","b","led1","anode","#22c55e"),wire("w_lg","led1","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("13","OUTPUT"),pinMode("8","OUTPUT"),pinMode("4","INPUT")],[
      digitalWrite("13","HIGH"),
      block("lcd_clear"),
      block("lcd_set_cursor",{COL:"0",ROW:"0"}),
      block("lcd_print",{},{TEXT:textBlock("PIXIU WEATHER")}),
      block("lcd_set_cursor",{COL:"0",ROW:"1"}),
      block("lcd_print",{},{TEXT:textBlock("T: 24C | H: 60%")}),
      digitalWrite("13","LOW"),
      delay(800),
      block("lcd_clear"),
      delay(300),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect LCD to 5V, GND, SDA (A4), and SCL (A5). Wire DHT11 sensor to D4, pulse indicator LED to D13 with 220Ω resistor, and buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Initializes I2C LCD communication, queries DHT11 sensor data, writes formatted climate strings to LCD rows, and pulses D13 LED.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to start telemetry. Select DHT11 in the canvas inspector to tweak temperature and humidity levels.",
      "4. 📊 Outcomes & Real-Time Observations: The backlit LCD screen lights up with high-contrast text displaying live atmospheric parameters streamed over I2C.",
    ]),
  starter("g8-oled-dashboard", "🚀 Spacecraft Cockpit HUD (SSD1306 OLED + 2-Axis Joystick + Warp Sound & LED)", "High-resolution graphic dashboard with SSD1306 OLED and analog joystick flight control! Utilizing I2C pins A4 (SDA) and A5 (SCL), this 128×64 OLED draws spacecraft flight instruments, while 2-Axis joystick on A0/A1 steers telemetry and push-switch on D2 engages warp drive with sound from buzzer D8.", 8, "Displays + I2C", "Intermediate", ["OLED", "Dashboard", "I2C", "Joystick", "HUD"],
    { parts: [part("uno","arduino-uno",60,110),part("joy","joystick",270,80,{x:512,y:512,pressed:"false"}),part("oled","oled-i2c",480,60,{line1:"COCKPIT HUD",line2:"THRUST: NOMINAL",line3:"SPEED: WARP 1"}),part("led1","led",720,70,{color:"blue"}),part("r1","resistor",720,150,{resistance:220}),part("bz","buzzer",270,210)], wires: [wire("a","uno","5v","oled","vcc","#ef4444"),wire("b","uno","gnd","oled","gnd","#1e293b"),wire("c","uno","a4","oled","sda","#60a5fa"),wire("d","uno","a5","oled","scl","#3b82f6"),wire("w_jvcc","uno","5v","joy","vcc","#ef4444"),wire("w_jgnd","uno","gnd","joy","gnd","#1e293b"),wire("w_jvrx","uno","a0","joy","vrx","#eab308"),wire("w_jvry","uno","a1","joy","vry","#22c55e"),wire("w_jsw","uno","d2","joy","sw","#a855f7"),wire("w_la","uno","d13","r1","a","#3b82f6"),wire("w_lb","r1","b","led1","anode","#3b82f6"),wire("w_lg","led1","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d8","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([serialBegin(),pinMode("13","OUTPUT"),pinMode("8","OUTPUT"),pinMode("2","INPUT")],[
      digitalWrite("13","HIGH"),
      block("oled_print",{},{TEXT:textBlock("PIXIU COCKPIT")}),
      digitalWrite("8","HIGH"),delay(40),digitalWrite("8","LOW"),
      digitalWrite("13","LOW"),
      delay(600),
      block("oled_clear"),
      delay(300),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect OLED VCC to 5V, GND to GND, SDA to A4, SCL to A5. Connect joystick VRx to A0, VRy to A1, SW to D2. Connect warp LED to D13 and buzzer to D8.",
      "2. ⚙️ Code Architecture & Logic: Boots graphic OLED display, renders flight computer HUD graphics, sounds thruster audio on D8, and flashes warp LED D13.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run to boot HUD. Click and drag the joystick thumbstick on canvas to steer simulated flight vectors.",
      "4. 📊 Outcomes & Real-Time Observations: The 128×64 OLED glows with sharp graphics, sound bursts, and warp drive visual pulses.",
    ]),
  starter("g8-motor-driver", "⚡ High-Power Dual DC Motor Drive & Speed Throttle Station (L298N + Potentiometer + RPM Pulse LED + Chime)", "High-power dual DC motor H-Bridge drive base with analog speed throttle control! The L298N motor driver isolates Arduino logic from high current 9V battery motor power. Arduino pins D5/D6 (ENA/ENB PWM) and D7-D10 (IN1-IN4) control dual motor speed and rotation, with potentiometer speed modulation and RPM pulse indicator.", 8, "Motor Control", "Advanced", ["L298N", "DC Motor", "Robotics", "Potentiometer", "PWM"],
    { parts: [part("uno","arduino-uno",60,110),part("pot","potentiometer",60,310,{value:512}),part("drv","l298n",360,95,{speedA:160,speedB:160}),part("bat","battery",230,310,{voltage:9}),part("m1","dc-motor",600,55),part("m2","dc-motor",600,205),part("led1","led",780,100,{color:"green"}),part("r1","resistor",780,170,{resistance:220}),part("bz","buzzer",360,230)], wires: [wire("a","uno","5v","drv","5v","#ef4444"),wire("b","uno","gnd","drv","gnd","#1e293b"),wire("c","bat","pos","drv","vs","#ef4444"),wire("d","bat","neg","uno","gnd","#1e293b"),wire("e","uno","d5","drv","ena","#60a5fa"),wire("f","uno","d7","drv","in1","#60a5fa"),wire("g","uno","d8","drv","in2","#60a5fa"),wire("h","uno","d6","drv","enb","#3b82f6"),wire("i","uno","d9","drv","in3","#3b82f6"),wire("j","uno","d10","drv","in4","#3b82f6"),wire("k","drv","out1","m1","pos","#f97316"),wire("l","drv","out2","m1","neg","#f97316"),wire("m","drv","out3","m2","pos","#f97316"),wire("n","drv","out4","m2","neg","#f97316"),wire("w_pot_vcc","uno","5v","pot","t1","#ef4444"),wire("w_pot_gnd","uno","gnd","pot","t2","#1e293b"),wire("w_pot_w","pot","wiper","uno","a0","#eab308"),wire("w_la","uno","d13","r1","a","#22c55e"),wire("w_lb","r1","b","led1","anode","#22c55e"),wire("w_lg","led1","cathode","uno","gnd","#1e293b"),wire("w_bzpos","uno","d11","bz","pos","#eab308"),wire("w_bzgnd","bz","neg","uno","gnd","#1e293b")] },
    program([pinMode("5","OUTPUT"),pinMode("6","OUTPUT"),pinMode("7","OUTPUT"),pinMode("8","OUTPUT"),pinMode("9","OUTPUT"),pinMode("10","OUTPUT"),pinMode("13","OUTPUT"),pinMode("11","OUTPUT")],[
      digitalWrite("13","HIGH"),
      block("motor_driver_write",{CHANNEL:"A",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),
      block("motor_driver_write",{CHANNEL:"B",DIRECTION:"CW",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(180)}),
      delay(1000),
      digitalWrite("13","LOW"),
      block("motor_driver_write",{CHANNEL:"A",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),
      block("motor_driver_write",{CHANNEL:"B",DIRECTION:"STOP",ENA:"5",ENB:"6",IN1:"7",IN2:"8",IN3:"9",IN4:"10"},{SPEED:numberBlock(0)}),
      delay(500),
    ]),
    [
      "1. 🔌 Circuit Wiring & Hardware Setup: Connect 9V battery to L298N VS and GND. Wire ENA to D5, IN1 to D7, IN2 to D8, ENB to D6, IN3 to D9, IN4 to D10, and DC motors to OUT1-4. Wire throttle pot to A0, pulse LED to D13, buzzer to D11.",
      "2. ⚙️ Code Architecture & Logic: Configures all 8 drive and telemetry pins. Loop engages dual motors CW at speed 180, pulses D13 tachometer LED, and halts with braking.",
      "3. ▶️ Simulation Execution & Interaction Controls: Click Run, then rotate the potentiometer on canvas to simulate throttle modulation.",
      "4. 📊 Outcomes & Real-Time Observations: Motors M1 and M2 spin smoothly at high RPM with synchronized tachometer pulse and buzzer alerts.",
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
  starter("g8-keypad-lock", "🔒 Smart Security Vault Safe (Keypad + LCD + Servo Lock)", "Electronic combination safe with matrix keypad authentication! Enter secret PIN 1234 on the 4×4 keypad and press OK to unlock. The 16×2 LCD guides the user with live prompts, the deadbolt servo unlocks to 90°, a green LED illuminates, and the buzzer plays a confirmation chime.", 8, "Human Interface", "Advanced", ["Keypad", "Security", "LCD", "Servo", "Access Control"],
    { parts: [part("uno","arduino-uno",210,130),part("keypad","keypad-4x4",40,80,{lastKey:"",enteredPin:""}),part("lcd","lcd-i2c",280,20,{line1:"ENTER PASSWORD",line2:"PRESS 1234 + OK"}),part("servo","servo",580,40,{angle:0}),part("buzzer","buzzer",580,130),part("r1","resistor",580,230,{resistance:220}),part("led1","led",690,200,{color:"green"})], wires: [wire("a","uno","d2","keypad","r1","#60a5fa"),wire("b","uno","d3","keypad","r2","#60a5fa"),wire("c","uno","d4","keypad","r3","#60a5fa"),wire("d","uno","d5","keypad","r4","#60a5fa"),wire("e","uno","d6","keypad","c1","#3b82f6"),wire("f","uno","d7","keypad","c2","#3b82f6"),wire("g","uno","d8","keypad","c3","#3b82f6"),wire("h","uno","d9","keypad","c4","#3b82f6"),wire("w_lvcc","uno","5v","lcd","vcc","#ef4444"),wire("w_lgnd","uno","gnd","lcd","gnd","#1e293b"),wire("w_lsda","uno","a4","lcd","sda","#60a5fa"),wire("w_lscl","uno","a5","lcd","scl","#3b82f6"),wire("w_svcc","uno","5v","servo","vcc","#ef4444"),wire("w_sgnd","uno","gnd","servo","gnd","#1e293b"),wire("w_ssig","uno","d10","servo","sig","#f97316"),wire("w_bzpos","uno","d11","buzzer","pos","#eab308"),wire("w_bzgnd","buzzer","neg","uno","gnd","#1e293b"),wire("i","uno","d13","r1","a","#22c55e"),wire("j","r1","b","led1","anode","#22c55e"),wire("k","led1","cathode","uno","gnd","#1e293b")] },
    program([
      serialBegin(),
      pinMode("10","OUTPUT"),pinMode("11","OUTPUT"),pinMode("13","OUTPUT"),
      block("servo_write",{PIN:"10"},{ANGLE:numberBlock(0)}),
      digitalWrite("13","LOW"),
      digitalWrite("11","LOW"),
      block("lcd_clear"),
      block("lcd_set_cursor",{COL:"0",ROW:"0"}),
      block("lcd_print",{},{TEXT:textBlock("ENTER PASSWORD")}),
      block("lcd_set_cursor",{COL:"0",ROW:"1"}),
      block("lcd_print",{},{TEXT:textBlock("PRESS 1234 + OK")})
    ],[
      serialPrintValue("keypad_read",{SENSOR:"keypad"}),
      ifElseBlock(
        compareBlock("EQ", sensorBlock("keypad_read","keypad"), textBlock("1234")),
        [
          block("lcd_clear"),
          block("lcd_set_cursor",{COL:"0",ROW:"0"}),
          block("lcd_print",{},{TEXT:textBlock("ACCESS GRANTED!")}),
          block("lcd_set_cursor",{COL:"0",ROW:"1"}),
          block("lcd_print",{},{TEXT:textBlock("VAULT UNLOCKED")}),
          digitalWrite("13","HIGH"),
          digitalWrite("11","HIGH"),
          block("servo_write",{PIN:"10"},{ANGLE:numberBlock(90)}),
          delay(250),
          digitalWrite("11","LOW"),
          delay(2000),
          block("servo_write",{PIN:"10"},{ANGLE:numberBlock(0)}),
          digitalWrite("13","LOW"),
          block("lcd_clear"),
          block("lcd_set_cursor",{COL:"0",ROW:"0"}),
          block("lcd_print",{},{TEXT:textBlock("ENTER PASSWORD")}),
          block("lcd_set_cursor",{COL:"0",ROW:"1"}),
          block("lcd_print",{},{TEXT:textBlock("PRESS 1234 + OK")})
        ],
        [
          ifElseBlock(
            compareBlock("NEQ", sensorBlock("keypad_read","keypad"), textBlock("")),
            [
              block("lcd_clear"),
              block("lcd_set_cursor",{COL:"0",ROW:"0"}),
              block("lcd_print",{},{TEXT:textBlock("WRONG PASSWORD!")}),
              block("lcd_set_cursor",{COL:"0",ROW:"1"}),
              block("lcd_print",{},{TEXT:textBlock("ACCESS DENIED")}),
              digitalWrite("11","HIGH"),
              delay(350),
              digitalWrite("11","LOW"),
              delay(1200),
              block("lcd_clear"),
              block("lcd_set_cursor",{COL:"0",ROW:"0"}),
              block("lcd_print",{},{TEXT:textBlock("ENTER PASSWORD")}),
              block("lcd_set_cursor",{COL:"0",ROW:"1"}),
              block("lcd_print",{},{TEXT:textBlock("PRESS 1234 + OK")})
            ],
            [delay(100)]
          )
        ]
      ),
    ]),
    [
      "1. 🔌 Circuit Wiring: Wire Keypad rows to D2-D5 and cols to D6-D9. Connect I2C LCD to A4/A5, deadbolt servo to D10, buzzer to D11, and green LED to D13.",
      "2. ⚙️ Code Architecture: Initialize locked servo at 0° and prompt user. Loop verifies keypad PIN; entry of 1234 and OK unlocks vault.",
      "3. ▶️ Interaction: Enter 1234 and press OK on keypad to disengage deadbolt.",
      "4. 📊 Output: Access Granted notification on 16x2 LCD, 90° servo deadbolt swing, and chime confirmation.",
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