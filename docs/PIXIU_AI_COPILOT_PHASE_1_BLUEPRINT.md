# 🏛️ PIXIU TECH / ENGINEERING STRATEGY
## Proprietary AI Copilot — Phase 1 Architecture & Component Specification
**Document Version:** 1.0.0 | **Status:** Ready for Review & Enhancement  
**Classification:** Confidential & Proprietary — Pixiu Tech Intellectual Property

---

## 📌 Executive Summary

This blueprint defines the engineering execution plan for **Phase 1: AI-Ready CyberLab Foundation**, in direct alignment with Pixiu Tech’s *Proprietary AI Copilot Strategy*.

### The Core Architectural Principle
> **"Make the model propose; make software verify."**  
> The AI model is an untrusted agent. It never mutates the live canvas directly. It proposes an action payload; deterministic application software validates the schema, pins, and physics rules; the student previews the changes; and only upon confirmation is the circuit applied with an instant **Undo/Rollback** safety net.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1 EXECUTION WORKFLOW PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   [Student Prompt] ──> [AI Model / Dataset] ──> [Proposed Action Payload]             │
│                                                              │                         │
│                                                              ▼                         │
│                                              ┌───────────────────────────────┐         │
│                                              │ 1. Deterministic Validator    │         │
│                                              │    (circuit-validator.ts)     │         │
│                                              └───────────────┬───────────────┘         │
│                                                              │                         │
│                        ┌─────────────────────────────────────┴───────────────┐         │
│                        ▼ Valid                                               ▼ Invalid │
│        ┌───────────────────────────────┐                     ┌───────────────────────┐ │
│        │ 2. Physics & Rule Diagnostic  │                     │ Return Actionable     │ │
│        │    (circuit-doctor.ts)        │                     │ Error Feedback        │ │
│        └───────────────┬───────────────┘                     └───────────────────────┘ │
│                        │                                                               │
│                        ▼                                                               │
│        ┌───────────────────────────────┐                                               │
│        │ 3. Staging & Ghost Preview    │                                               │
│        │    (Visual canvas overlay)    │                                               │
│        └───────────────┬───────────────┘                                               │
│                        │                                                               │
│                        ▼ Student Clicks "Apply"                                        │
│        ┌───────────────────────────────┐                                               │
│        │ 4. Canvas State Mutation      │ ──> [5. Undo Stack Snapshot Saved]            │
│        │    (workbench.tsx update)     │     (Revert to previous state anytime)        │
│        └───────────────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Section 1: Ground-Truth 32-Component Training Specification

Every component in Pixiu CyberLab has been cataloged into a normalized machine-readable dataset:
* **TypeScript Definition:** `pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.ts`
* **Raw JSON Catalog:** `pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.json`

### 1.1 Microcontrollers (4 Target Boards)

| Board Type | Logic Level | ADC Resolution | Power Output | Key Header Pins & Capabilities | Primary Wiring Rules |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **`arduino-uno`** | 5V | 10-bit (0–1023) | 5V, 3.3V, VIN | D0–D13 (PWM: D3, D5, D6, D9, D10, D11), A0–A5 (I2C: A4=SDA, A5=SCL), 2x GND | All active components must share common GND with Uno. Servos require PWM pins. |
| **`esp32-devkit`** | 3.3V | 12-bit (0–4095) | 3.3V, VIN (5V) | GPIO2 (Built-in LED), GPIO4, GPIO15, GPIO21 (SDA), GPIO22 (SCL), GPIO34/35 (Input-only ADC) | Max input 3.3V on GPIO pins. 5V sensors require voltage dividers. |
| **`rpi-pico`** | 3.3V | 12-bit (0–4095) | 3.3V, VBUS (5V)| GP0 (SDA), GP1 (SCL), GP25 (Built-in LED), GP26 (ADC0) | Native 3.3V logic level throughout. |
| **`microbit-v2`**| 3.3V | 10-bit (0–1023) | 3V, GND | P0, P1, P2 (Touch/ADC/Audio), Btn A, Btn B, 5x5 LED Matrix | Large rings suited for alligator clips. Audio tone defaults to P0. |

---

### 1.2 Passive & Discrete Components (6 Parts)

| Part Type | Default Props | Pins & Recognized Aliases | Electrical Constraints | Mandatory Circuit Doctor Rules |
| :--- | :--- | :--- | :--- | :--- |
| **`led`** | `color: "red"` | `anode` (`a`, `pos`, `+`), `cathode` (`k`, `neg`, `-`) | 1.8V–2.2V drop, max 20mA | **Must** have 220Ω–1kΩ series resistor to prevent burnout. Reverse bias prevents conduction. |
| **`resistor`** | `resistance: 220` | `a` (`t1`, `1`), `b` (`t2`, `2`) | Linear Ohm's Law, non-polarized | Symmetrical terminals. Connects in series with LEDs or in voltage dividers. |
| **`pushbutton`**| `pressed: false` | `p1a` (`1a`), `p1b` (`1b`), `p2a` (`2a`), `p2b` (`2b`) | Momentary tactile switch | Recommended with `INPUT_PULLUP` to prevent floating states. |
| **`potentiometer`**| `value: 512` | `t1` (5V), `wiper` (`w`, `out`), `t2` (GND) | 10kΩ linear track | Wiper must connect to an Analog ADC pin (A0–A5). |
| **`battery`** | `voltage: 9` | `pos` (`+`), `neg` (`-`) | 9V DC external power | Negative terminal must connect to common circuit GND when driving shared loads. |
| **`breadboard`**| N/A | `pos_top`, `neg_top`, `pos_bot`, `neg_bot`, columns `a1–j20` | Dual power distribution rails | Distributes 5V and GND buses across multiple components. |

---

### 1.3 Sensors & Input Devices (10 Parts)

| Sensor Type | Output Kind | Pins & Connections | Read Block / C++ API | Application Topology |
| :--- | :---: | :--- | :--- | :--- |
| **`ultrasonic`** | Digital Pulse | `vcc` (5V), `trig` (D-Pin), `echo` (D-Pin), `gnd` (GND) | `ultrasonic_read` | Sonar distance measurement (2–400 cm). |
| **`ldr`** | Analog Passive | `t1` (5V), `t2` (Junction to A0 + 10kΩ to GND) | `ldr_read` | Light-dependent voltage divider. Resistance drops with light. |
| **`pir-sensor`** | Digital TTL | `vcc` (5V), `out` (D-Pin), `gnd` (GND) | `pir_motion` | Pyroelectric motion detection. Goes HIGH upon human movement. |
| **`dht11`** | Digital Serial | `vcc` (5V/3.3V), `data` (D-Pin), `gnd` (GND) | `dht_temperature`, `dht_humidity` | Climate sensing (0–50°C temp, 20–90% humidity). |
| **`tmp36`** | Analog Voltage| `vcc` (5V), `out` (ADC Pin), `gnd` (GND) | `tmp36_temperature` | Linear 10 mV/°C analog output with 500 mV 0°C offset. |
| **`mq2-gas`** | Dual (AO/DO) | `vcc` (5V), `gnd` (GND), `do` (D-Pin), `ao` (ADC Pin) | `mq2_gas_read` | Gas & smoke detection. Internal heater requires 5V rail. |
| **`soil-moisture`**| Analog Voltage| `vcc` (5V/3.3V), `ao` (ADC Pin), `gnd` (GND) | `soil_moisture_read` | Volumetric soil conductivity probe (high=dry, low=wet). |
| **`ir-sensor`** | Digital Active-Low| `vcc` (5V), `out` (D-Pin), `gnd` (GND) | `ir_read` | Short-range reflective optical obstacle detector. |
| **`joystick`** | Dual Analog + D | `gnd`, `vcc`, `vrx` (A0), `vry` (A1), `sw` (D2) | `joystick_x`, `joystick_y`, `joystick_button` | Dual 10kΩ potentiometers + momentary tactile push button. |
| **`rotary-encoder`**| Quadrature Gray| `gnd`, `vcc`, `clk` (D2), `dt` (D3), `sw` (D4) | `encoder_read` | Continuous rotational dial with push switch. |

---

### 1.4 Actuators, Motors & Drivers (8 Parts)

| Actuator Type | Control Signal | Pins & Wiring | Code Interface | Hardware Safety Rules |
| :--- | :--- | :--- | :--- | :--- |
| **`servo`** | 50Hz PWM Pulse | `sig` (PWM Pin: D9/D10), `vcc` (5V), `gnd` (GND) | `servo_write` (`<Servo.h>`) | Must connect to PWM-capable pin; requires 5V rail. |
| **`buzzer`** | Audio Frequency | `pos` (D-Pin: D8/D11), `neg` (GND) | `tone_play`, `tone_stop` | Driven by `tone(pin, freq)` square wave. |
| **`dc-motor`** | High Current DC| `pos` (M+), `neg` (M-) | `motor_driver_write` | **Forbidden** to connect directly to MCU GPIO. Requires L298N or relay. |
| **`relay`** | Digital Active-High| `vcc` (5V), `gnd` (GND), `in` (D-Pin), `com`, `no`, `nc`| `io_digitalwrite` | Opto-isolated coil switches external battery to load. |
| **`l298n`** | Dual PWM + Dir | `vs` (9V Bat), `gnd`, `5v`, `ena`, `in1`, `in2`, `enb`, `in3`, `in4`| `motor_driver_write` | Common GND between battery and Arduino is strictly mandatory. |
| **`rgb-led`** | 3x PWM Channels| `red` (D9), `gnd` (Common Cathode), `green` (D10), `blue` (D11) | `io_analogwrite` | Each of the 3 color anodes requires its own 220Ω resistor. |
| **`npn-transistor`**| Current Base | `emitter` (GND), `base` (via 1kΩ to D-Pin), `collector` (Load) | `io_digitalwrite` | Base pin must always have 1kΩ resistor to protect MCU GPIO. |
| **`keypad-4x4`** | Matrix Scanning| Rows: `r1–r4` (D2–D5), Cols: `c1–c4` (D6–D9) | `keypad_read`, `keypad_check_pin` | Scans 16 keys across 8 digital lines using `<Keypad.h>`. |

---

### 1.5 Displays (3 Modules)

| Display Type | Bus / Interface | Pins | Default Props | Code Libraries |
| :--- | :---: | :--- | :--- | :--- |
| **`lcd-i2c`** | 2-Wire I2C (0x27)| `gnd`, `vcc` (5V), `sda` (A4), `scl` (A5) | `line1: "PIXIU CYBERLAB"`, `line2: "SYSTEM READY"` | `<LiquidCrystal_I2C.h>`, `<Wire.h>` |
| **`oled-i2c`** | 2-Wire I2C (0x3C)| `gnd`, `vcc` (3.3V/5V), `scl` (A5), `sda` (A4)| `line1: "PIXIU TECH"`, `line2: "READY"` | `<Adafruit_SSD1306.h>`, `<Adafruit_GFX.h>` |
| **`neopixel-ring`**| 800kHz Single-Wire | `di` (D6), `vcc` (5V), `gnd`, `do` | `numPixels: 8, brightness: 200, pattern: "rainbow"` | `<Adafruit_NeoPixel.h>` |
| **`seven-segment`**| Parallel 7 Segments| Segs `a–g` (D2–D8), `dp`, `com` (GND) | `digit: 0` | Direct GPIO bit-mapping |

---

## 🛠️ Section 2: Phase 1 Deliverables & Technical Architecture

### Deliverable 1: Deterministic Circuit Validator (`circuit-validator.ts`)
* **Path:** `pixiu-lms-portal/src/lib/circuit-validator.ts`
* **Contract:**
  ```ts
  export interface CircuitValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
    normalizedCircuit?: CircuitState
    metrics: {
      partCount: number
      wireCount: number
      unconnectedPins: number
      powerRailsOk: boolean
    }
  }
  export function validateProposedCircuit(candidate: unknown): CircuitValidationResult
  ```
* **Validation Rules Executed:**
  1. **Schema Check:** Verifies `parts` array contains valid coordinates, rotations, and IDs; `wires` connect valid `{partId, pinId}` endpoints.
  2. **Pin Resolution:** Replaces aliases (e.g., `resistor:1` $\to$ `resistor:a`, `led:+` $\to$ `led:anode`).
  3. **Short-Circuit Detection:** Blocks direct `5v` $\to$ `gnd` wire connections without load resistance.
  4. **Burnout Prevention:** Rejects direct `LED` to power pin without an intervening resistor.
  5. **Ground Loop Continuity:** Flags any active actuator or sensor missing a return ground path.

---

### Deliverable 2: Action & Staging Controller (`use-circuit-copilot-action.ts`)
* **Path:** `pixiu-lms-portal/src/components/circuit-lab/use-circuit-copilot-action.ts`
* **Features:**
  * **Staging Mode (`preview`)**: Visual ghost preview displaying proposed components and wire trajectories with dotted glow strokes before touching canvas state.
  * **Application Mode (`apply`)**: Safely merges or replaces parts/wires into `workbench.tsx`'s `updateState`.
  * **Code Hydration**: Injects matching Blockly XML or Arduino C++ sketch simultaneously.
  * **Undo Stack (`undo`)**: Preserves exact previous `(parts, wires, blocklyXml)` snapshot in a circular buffer, enabling one-click reversion.

---

### Deliverable 3: Simulator Telemetry Serializer (`circuit-telemetry.ts`)
* **Path:** `pixiu-lms-portal/src/lib/circuit-telemetry.ts`
* **Features:**
  * Extracts live nodal voltages from `solveCircuitNodalPotentials`.
  * Reads current MCU pin states (`pinStatesRef.current`), PWM duty cycles, and buzzer frequencies.
  * Packages Circuit Doctor health reports into a compact prompt injection context (~120 tokens) so the AI tutor answers physics questions with factual accuracy.

---

### Deliverable 4: Automated Verification Test Suite (`test-phase1-ai-copilot-engine.mjs`)
* **Path:** `scripts/test-phase1-ai-copilot-engine.mjs`
* **Test Gates:**
  1. **Gate 1:** All 65 existing starter templates pass the validator with 100% compliance.
  2. **Gate 2:** Intentionally faulty circuits (e.g., invalid pin `uno:d99`, missing LED resistor, floating ground) are caught and rejected with descriptive error strings.
  3. **Gate 3:** Alias normalization succeeds for all 32 component pin variations.
  4. **Gate 4:** Preview $\to$ Apply $\to$ Undo state lifecycle maintains state purity without memory leaks.

---

## 📊 Section 3: Benchmark & Quality Evaluation Matrix

As established in your engineering strategy guide, progress will be measured by **functional product benchmarks**, not training loss:

| Evaluation Metric | Target Threshold | Validation Method |
| :--- | :---: | :--- |
| **Schema Validity Rate** | $\ge 99.5\%$ | JSON schema parsing & TypeScript interface compliance. |
| **Circuit Validity Rate** | $\ge 98.0\%$ | Valid board, part, pin, and alias existence checks. |
| **Simulation Success Rate** | $\ge 95.0\%$ | Solver runs without nodal divergence or short-circuit crashes. |
| **Code Compilation Rate** | $\ge 95.0\%$ | Arduino sketch / Blockly AST compiles cleanly. |
| **Diagnostic Repair Rate** | $\ge 90.0\%$ | Successfully diagnoses and repairs seeded wiring faults. |

---

## 🚀 Section 4: Phase 1 Action Plan & File Inventory

| File Path | Action | Description |
| :--- | :---: | :--- |
| `pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.ts` | **Completed** | Full 32-component training & rule specifications. |
| `pixiu-lms-portal/src/lib/ai/pixiu-components-dataset.json` | **Completed** | Machine-readable JSON export for training pipelines. |
| `pixiu-lms-portal/src/lib/circuit-validator.ts` | **To Build** | Deterministic schema, pin, and electrical validation engine. |
| `pixiu-lms-portal/src/lib/circuit-telemetry.ts` | **To Build** | Live simulator telemetry context serializer for AI tutor. |
| `pixiu-lms-portal/src/components/circuit-lab/use-circuit-copilot-action.ts` | **To Build** | Canvas staging, preview, apply, and undo controller. |
| `scripts/test-phase1-ai-copilot-engine.mjs` | **To Build** | Automated end-to-end verification gate for Phase 1. |

---

*This blueprint establishes the foundation for Pixiu Tech's proprietary AI engine.*
