// src/lib/arduino-blocks.ts
import * as Blockly from "blockly";

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
function getDefaultBoard() {
  return ARDUINO_UNO_BOARD;
}
function getBoardForPart(part) {
  const type = typeof part === "string" ? part : "type" in part ? part.type : "";
  return getBoardDefinition(type);
}
function getActiveBoard(circuit, preferredPartId) {
  if (preferredPartId) {
    const pref = circuit.parts.find((p) => p.id === preferredPartId && isBoardPart(p.type));
    if (pref) {
      const def = getBoardDefinition(pref.type);
      if (def) return def;
    }
  }
  const boardParts = circuit.parts.filter((p) => isBoardPart(p.type));
  if (boardParts.length > 0) {
    const nonUno = [...boardParts].reverse().find((p) => p.type !== "arduino-uno");
    const target = nonUno ?? boardParts[boardParts.length - 1];
    const def = getBoardDefinition(target.type);
    if (def) return def;
  }
  return getDefaultBoard();
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

// src/lib/pin-map.ts
function buildNets(circuit) {
  const parent = /* @__PURE__ */ new Map();
  const key = (partId, pinId) => `${partId}:${pinId}`;
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const w of circuit.wires) {
    union(key(w.from.partId, w.from.pinId), key(w.to.partId, w.to.pinId));
  }
  return { find, key };
}
function partDescriptor(circuit, partId) {
  const part = circuit.parts.find((p) => p.id === partId);
  if (!part || isBoardPart(part.type)) return null;
  const def = CATALOG[part.type];
  if (!def) return null;
  if (part.type === "led") return `LED (${part.props.color ?? "red"})`;
  return def.name;
}
function getPinOptions(circuit) {
  const board = getActiveBoard(circuit);
  const boardPart = circuit.parts.find((p) => getBoardForPart(p)?.id === board.id) ?? circuit.parts.find((p) => isBoardPart(p.type));
  const pinList = board.pins.filter((p) => p.kind === "digital" || p.kind === "analog").map((p) => {
    let code = p.label;
    if (p.label.startsWith("D") && !isNaN(Number(p.label.substring(1)))) {
      code = p.label.substring(1);
    } else if (p.label.startsWith("GP") && !isNaN(Number(p.label.substring(2)))) {
      code = p.label.substring(2);
    } else if (p.label.startsWith("P") && !isNaN(Number(p.label.substring(1)))) {
      code = p.label.substring(1);
    }
    return { id: p.id, code };
  });
  if (!boardPart) {
    return pinList.map((p) => ({ code: p.code, label: p.code, connected: false }));
  }
  const { find, key } = buildNets(circuit);
  const netParts = /* @__PURE__ */ new Map();
  for (const part of circuit.parts) {
    if (isBoardPart(part.type)) continue;
    const def = CATALOG[part.type];
    const desc = partDescriptor(circuit, part.id);
    if (!desc || !def) continue;
    for (const pin of def.pins) {
      const root = find(key(part.id, pin.id));
      if (!netParts.has(root)) netParts.set(root, /* @__PURE__ */ new Set());
      netParts.get(root).add(desc);
    }
  }
  return pinList.map((p) => {
    const root = find(key(boardPart.id, p.id));
    const parts = netParts.get(root);
    if (parts && parts.size > 0) {
      return { code: p.code, label: `${p.code} \u2192 ${Array.from(parts).join(", ")}`, connected: true };
    }
    return { code: p.code, label: p.code, connected: false };
  });
}

// src/lib/ai/object-detector.ts
import * as cocoSsd from "@tensorflow-models/coco-ssd";
var COCO_SSD_CLASSES = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush"
];

// src/lib/arduino-blocks.ts
var ORDER = {
  ATOMIC: 0,
  UNARY: 1,
  MUL: 2,
  ADD: 3,
  RELATIONAL: 4,
  EQUALITY: 5,
  LOGICAL_AND: 6,
  LOGICAL_OR: 7,
  NONE: 99
};
var currentCircuit = { parts: [], wires: [] };
function setPinContext(circuit) {
  currentCircuit = circuit;
}
function pinDropdown() {
  const opts = getPinOptions(currentCircuit);
  if (opts.length === 0) return [["13", "13"]];
  return opts.map((o) => [o.label, o.code]);
}
function componentDropdown(types, emptyLabel = "Add component first") {
  return () => {
    const options = currentCircuit.parts.filter((part) => types.includes(part.type)).map((part) => [
      (CATALOG[part.type]?.name ?? part.type) + " \xB7 " + part.id.slice(0, 6),
      part.id
    ]);
    return options.length > 0 ? options : [[emptyLabel, ""]];
  };
}
var defined = false;
var aiClasses = [...COCO_SSD_CLASSES, "phone", "hand"];
function setAiClassContext(classes) {
  const normalized = classes.map((value) => value.trim().toLowerCase()).filter(Boolean).slice(0, 32);
  aiClasses = Array.from(/* @__PURE__ */ new Set([...COCO_SSD_CLASSES, ...normalized, "phone", "hand"]));
}
function aiClassDropdown() {
  return aiClasses.map((value) => [value === "phone" ? "phone (legacy alias)" : value, value]);
}
function defineArduinoBlocks() {
  if (defined && Blockly.Blocks["arduino_program"]) return;
  Blockly.defineBlocksWithJsonArray([
    {
      type: "arduino_program",
      message0: "Arduino %1 setup (runs once) %2 %3 loop (repeats forever) %4 %5",
      args0: [
        { type: "input_dummy" },
        { type: "input_dummy" },
        { type: "input_statement", name: "SETUP" },
        { type: "input_dummy" },
        { type: "input_statement", name: "LOOP" }
      ],
      colour: 180,
      tooltip: "Every Arduino sketch has a setup() and a loop().",
      deletable: false
    },
    {
      type: "io_pinmode",
      message0: "set pin %1 as %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        {
          type: "field_dropdown",
          name: "MODE",
          options: [
            ["OUTPUT", "OUTPUT"],
            ["INPUT", "INPUT"],
            ["INPUT_PULLUP", "INPUT_PULLUP"]
          ]
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 30,
      tooltip: "Configure a pin as input or output."
    },
    {
      type: "io_digitalwrite",
      message0: "digital write pin %1 %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        {
          type: "field_dropdown",
          name: "STATE",
          options: [
            ["HIGH", "HIGH"],
            ["LOW", "LOW"]
          ]
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Turn a pin on (HIGH) or off (LOW)."
    },
    {
      type: "io_digitalread",
      message0: "digital read pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      output: "Boolean",
      colour: 210,
      tooltip: "Read HIGH/LOW from a pin."
    },
    {
      type: "io_analogwrite",
      message0: "analog (PWM) write pin %1 value %2",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "VALUE", check: "Number" }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Write a 0-255 PWM value (or true DAC voltage on ESP32 DAC pins) to a pin."
    },
    {
      type: "io_analogread",
      message0: "analog read pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      output: "Number",
      colour: 260,
      tooltip: "Read an analog value from a pin (0-1023 on Arduino Uno, 0-4095 on ESP32 12-bit ADC)."
    },
    {
      type: "time_delay",
      message0: "wait %1 milliseconds",
      args0: [{ type: "input_value", name: "MS", check: "Number" }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: "Pause the program."
    },
    {
      type: "servo_write",
      message0: "set servo on pin %1 to %2 degrees",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "ANGLE", check: "Number" }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 300,
      tooltip: "Move a servo to an angle (0-180)."
    },
    {
      type: "tone_play",
      message0: "play tone on pin %1 at %2 Hz",
      args0: [
        { type: "field_dropdown", name: "PIN", options: pinDropdown },
        { type: "input_value", name: "FREQ", check: "Number" }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Drive a buzzer at a frequency."
    },
    {
      type: "tone_stop",
      message0: "stop tone on pin %1",
      args0: [{ type: "field_dropdown", name: "PIN", options: pinDropdown }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Silence a buzzer."
    }
  ]);
  Blockly.Blocks["io_tone"] = Blockly.Blocks["tone_play"];
  Blockly.Blocks["io_notone"] = Blockly.Blocks["tone_stop"];
  Blockly.Blocks["actuator_servo_write"] = Blockly.Blocks["servo_write"];
  Blockly.Blocks["serial_begin"] = {
    init() {
      this.appendDummyInput().appendField("Serial.begin").appendField(new Blockly.FieldDropdown([["9600", "9600"], ["115200", "115200"]]), "BAUD");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
      this.setTooltip("Initialize serial communication");
    }
  };
  Blockly.Blocks["serial_print"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("Serial.print");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
      this.setTooltip("Print to Serial Monitor");
    }
  };
  Blockly.Blocks["serial_println"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("Serial.println");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
      this.setTooltip("Print line to Serial Monitor");
    }
  };
  Blockly.Blocks["text_string"] = {
    init() {
      this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput("Hello"), "TEXT").appendField('"');
      this.setOutput(true, "String");
      this.setColour(160);
      this.setTooltip("Text string value");
    }
  };
  Blockly.Blocks["lcd_print"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("LCD print");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Print text to LCD display");
    }
  };
  Blockly.Blocks["lcd_set_cursor"] = {
    init() {
      this.appendDummyInput().appendField("LCD set cursor col").appendField(new Blockly.FieldNumber(0, 0, 15), "COL").appendField("row").appendField(new Blockly.FieldNumber(0, 0, 1), "ROW");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Set LCD cursor position");
    }
  };
  Blockly.Blocks["lcd_setup"] = {
    init() {
      this.appendDummyInput().appendField("LCD setup (init & backlight)");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Initialize I2C LCD display (0x27, 16x2) and turn on backlight.");
    }
  };
  Blockly.Blocks["lcd_clear"] = {
    init() {
      this.appendDummyInput().appendField("LCD clear");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Clear LCD display");
    }
  };
  Blockly.Blocks["lcd_print_line"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("LCD print on line").appendField(new Blockly.FieldDropdown([["1 (Top)", "1"], ["2 (Bottom)", "2"]]), "LINE");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Print text on LCD line 1 or line 2 (16 characters max)");
    }
  };
  Blockly.Blocks["seven_segment_write"] = {
    init() {
      this.appendValueInput("DIGIT").setCheck("Number").appendField("7-Segment display digit");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Display a number (0-9) on the 7-segment display");
    }
  };
  Blockly.Blocks["seven_segment_clear"] = {
    init() {
      this.appendDummyInput().appendField("7-Segment clear");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Turn off all segments on the 7-segment display");
    }
  };
  Blockly.Blocks["ir_read"] = {
    init() {
      this.appendDummyInput().appendField("IR obstacle?").appendField(new Blockly.FieldDropdown(componentDropdown(["ir-sensor"])), "SENSOR");
      this.setOutput(true, "Boolean");
      this.setColour(230);
      this.setTooltip("Read the virtual IR obstacle sensor.");
    }
  };
  Blockly.Blocks["dht_temperature"] = {
    init() {
      this.appendDummyInput().appendField("DHT11 temperature").appendField(new Blockly.FieldDropdown(componentDropdown(["dht11"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read temperature in degrees Celsius.");
    }
  };
  Blockly.Blocks["dht_humidity"] = {
    init() {
      this.appendDummyInput().appendField("DHT11 humidity").appendField(new Blockly.FieldDropdown(componentDropdown(["dht11"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read relative humidity percentage.");
    }
  };
  Blockly.Blocks["joystick_x"] = {
    init() {
      this.appendDummyInput().appendField("Joystick X").appendField(new Blockly.FieldDropdown(componentDropdown(["joystick"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(210);
      this.setTooltip("Read X axis from 0 to 1023.");
    }
  };
  Blockly.Blocks["joystick_y"] = {
    init() {
      this.appendDummyInput().appendField("Joystick Y").appendField(new Blockly.FieldDropdown(componentDropdown(["joystick"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(210);
      this.setTooltip("Read Y axis from 0 to 1023.");
    }
  };
  Blockly.Blocks["joystick_button"] = {
    init() {
      this.appendDummyInput().appendField("Joystick button").appendField(new Blockly.FieldDropdown(componentDropdown(["joystick"])), "SENSOR");
      this.setOutput(true, "Boolean");
      this.setColour(210);
      this.setTooltip("Read the joystick push button.");
    }
  };
  Blockly.Blocks["soil_moisture_read"] = {
    init() {
      this.appendDummyInput().appendField("Soil moisture").appendField(new Blockly.FieldDropdown(componentDropdown(["soil-moisture"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(120);
      this.setTooltip("Read simulated soil moisture from 0 to 1023.");
    }
  };
  Blockly.Blocks["encoder_read"] = {
    init() {
      this.appendDummyInput().appendField("Encoder count").appendField(new Blockly.FieldDropdown(componentDropdown(["rotary-encoder"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(45);
      this.setTooltip("Read the virtual rotary encoder count.");
    }
  };
  Blockly.Blocks["keypad_read"] = {
    init() {
      this.appendDummyInput().appendField("Keypad key").appendField(new Blockly.FieldDropdown(componentDropdown(["keypad-4x4"])), "SENSOR");
      this.setOutput(true, "String");
      this.setColour(45);
      this.setTooltip("Read the last virtual key pressed or entered PIN.");
    }
  };
  Blockly.Blocks["keypad_check_pin"] = {
    init() {
      this.appendValueInput("PIN").setCheck(null).appendField("Keypad PIN matches");
      this.setOutput(true, "Boolean");
      this.setColour(45);
      this.setTooltip("Checks if entered keypad PIN matches the secret password");
    }
  };
  Blockly.Blocks["keypad_clear_pin"] = {
    init() {
      this.appendDummyInput().appendField("clear keypad PIN");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(45);
      this.setTooltip("Clears the entered keypad PIN buffer");
    }
  };
  Blockly.Blocks["oled_print"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("OLED print");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Print text to the connected OLED display.");
    }
  };
  Blockly.Blocks["oled_clear"] = {
    init() {
      this.appendDummyInput().appendField("OLED clear");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
      this.setTooltip("Clear the virtual OLED display.");
    }
  };
  Blockly.Blocks["motor_driver_write"] = {
    init() {
      this.appendDummyInput().appendField("Motor driver").appendField(new Blockly.FieldDropdown([["A", "A"], ["B", "B"]]), "CHANNEL").appendField("direction").appendField(new Blockly.FieldDropdown([["CW", "CW"], ["CCW", "CCW"], ["STOP", "STOP"]]), "DIRECTION").appendField("speed");
      this.appendValueInput("SPEED").setCheck("Number");
      this.appendDummyInput().appendField("pins ENA").appendField(new Blockly.FieldNumber(5, 0, 13), "ENA").appendField("ENB").appendField(new Blockly.FieldNumber(6, 0, 13), "ENB");
      this.appendDummyInput().appendField("IN1").appendField(new Blockly.FieldNumber(7, 0, 13), "IN1").appendField("IN2").appendField(new Blockly.FieldNumber(8, 0, 13), "IN2");
      this.appendDummyInput().appendField("IN3").appendField(new Blockly.FieldNumber(9, 0, 13), "IN3").appendField("IN4").appendField(new Blockly.FieldNumber(10, 0, 13), "IN4");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(300);
      this.setTooltip("Drive one channel of the L298N using Arduino output pins.");
    }
  };
  Blockly.Blocks["pushbutton_read"] = {
    init() {
      this.appendDummyInput().appendField("Pushbutton pressed?").appendField(new Blockly.FieldDropdown(componentDropdown(["pushbutton"])), "SENSOR");
      this.setOutput(true, "Boolean");
      this.setColour(210);
      this.setTooltip("Read the live pressed state of a virtual pushbutton.");
    }
  };
  Blockly.Blocks["pir_motion"] = {
    init() {
      this.appendDummyInput().appendField("PIR motion?").appendField(new Blockly.FieldDropdown(componentDropdown(["pir-sensor"])), "SENSOR");
      this.setOutput(true, "Boolean");
      this.setColour(230);
      this.setTooltip("Read whether the virtual PIR sensor detects motion.");
    }
  };
  Blockly.Blocks["ldr_read"] = {
    init() {
      this.appendDummyInput().appendField("LDR light").appendField(new Blockly.FieldDropdown(componentDropdown(["ldr"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read the simulated LDR light level.");
    }
  };
  Blockly.Blocks["tmp36_temperature"] = {
    init() {
      this.appendDummyInput().appendField("TMP36 temperature").appendField(new Blockly.FieldDropdown(componentDropdown(["tmp36"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read the simulated TMP36 temperature.");
    }
  };
  Blockly.Blocks["potentiometer_read"] = {
    init() {
      this.appendDummyInput().appendField("Potentiometer").appendField(new Blockly.FieldDropdown(componentDropdown(["potentiometer"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(210);
      this.setTooltip("Read the potentiometer wiper value.");
    }
  };
  Blockly.Blocks["neopixel_set_color"] = {
    init() {
      this.appendDummyInput().appendField("NeoPixel").appendField(new Blockly.FieldDropdown(componentDropdown(["neopixel-ring"])), "SENSOR").appendField("pixel #");
      this.appendValueInput("PIXEL").setCheck("Number");
      this.appendDummyInput().appendField("color");
      this.appendValueInput("COLOR").setCheck("String");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(280);
      this.setTooltip("Set the color of an individual NeoPixel RGB LED.");
    }
  };
  Blockly.Blocks["neopixel_show"] = {
    init() {
      this.appendDummyInput().appendField("NeoPixel show").appendField(new Blockly.FieldDropdown(componentDropdown(["neopixel-ring"])), "SENSOR");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(280);
      this.setTooltip("Refresh and display updated colors on the NeoPixel ring.");
    }
  };
  Blockly.Blocks["mq2_gas_read"] = {
    init() {
      this.appendDummyInput().appendField("MQ-2 Gas level (ppm)").appendField(new Blockly.FieldDropdown(componentDropdown(["mq2-gas"])), "SENSOR");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read simulated gas concentration in parts per million (ppm).");
    }
  };
  Blockly.Blocks["arduino_map"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("map");
      this.appendValueInput("FROM_LOW").setCheck("Number").appendField("from");
      this.appendValueInput("FROM_HIGH").setCheck("Number").appendField("to");
      this.appendValueInput("TO_LOW").setCheck("Number").appendField("\u2192");
      this.appendValueInput("TO_HIGH").setCheck("Number");
      this.setOutput(true, "Number");
      this.setColour(260);
      this.setTooltip("Map one numeric range to another.");
    }
  };
  Blockly.Blocks["ultrasonic_read"] = {
    init() {
      this.appendDummyInput().appendField("read distance (cm) trig pin").appendField(new Blockly.FieldNumber(9, 0, 13), "TRIG").appendField("echo pin").appendField(new Blockly.FieldNumber(10, 0, 13), "ECHO");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Read distance from HC-SR04 ultrasonic sensor in cm");
    }
  };
  Blockly.Blocks["ai_is_detected"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI sees").appendField(new Blockly.FieldDropdown(aiClassDropdown), "CLASS").appendField("?");
      this.setOutput(true, "Boolean");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: checks the live AI result in the simulator.");
    }
  };
  Blockly.Blocks["ai_is_unknown"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI result is unknown?");
      this.setOutput(true, "Boolean");
      this.setColour(285);
      this.setTooltip("Returns true when AI has no accepted result or confidence is below the AI threshold.");
    }
  };
  Blockly.Blocks["ai_get_detected_class"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI detected object");
      this.setOutput(true, "String");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: returns the current AI label in the simulator.");
    }
  };
  Blockly.Blocks["ai_confidence"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI confidence (%)");
      this.setOutput(true, "Number");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: returns AI confidence (0 to 100%) in the simulator.");
    }
  };
  Blockly.Blocks["ai_get_object_count"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI objects in view");
      this.setOutput(true, "Number");
      this.setColour(285);
      this.setTooltip("Returns the number of accepted object detections in the current AI frame.");
    }
  };
  Blockly.Blocks["ai_get_gesture"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI gesture");
      this.setOutput(true, "String");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: returns the interpreted hand gesture in the simulator.");
    }
  };
  Blockly.Blocks["ai_get_finger_count"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} AI finger count");
      this.setOutput(true, "Number");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: returns the stable 0\u20135 finger count in the simulator.");
    }
  };
  Blockly.Blocks["ai_is_gesture"] = {
    init() {
      const gestures = [
        ["Fist", "fist"],
        ["Thumbs Up", "thumbs_up"],
        ["Thumbs Down", "thumbs_down"],
        ["Point", "point"],
        ["Peace", "peace"],
        ["One", "one"],
        ["Two", "two"],
        ["Three", "three"],
        ["Four", "four"],
        ["Open Palm", "open_palm"]
      ];
      this.appendDummyInput().appendField("\u{1F916} AI gesture is").appendField(new Blockly.FieldDropdown(gestures), "GESTURE");
      this.setOutput(true, "Boolean");
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: checks the interpreted hand gesture.");
    }
  };
  Blockly.Blocks["ai_camera_enable"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} turn AI camera").appendField(
        new Blockly.FieldDropdown([
          ["ON", "ON"],
          ["OFF", "OFF"]
        ]),
        "STATE"
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: enable or disable the camera runtime in the simulator.");
    }
  };
  Blockly.Blocks["ai_microphone_enable"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F916} turn AI microphone").appendField(
        new Blockly.FieldDropdown([
          ["ON", "ON"],
          ["OFF", "OFF"]
        ]),
        "STATE"
      );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(285);
      this.setTooltip("Browser AI Studio block: enable or disable the microphone and Sound AI input.");
    }
  };
  Blockly.Blocks["wifi_connect"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F4E1} Wi-Fi connect SSID").appendField(new Blockly.FieldTextInput("Pixiu_IoT"), "SSID").appendField("password").appendField(new Blockly.FieldTextInput("12345678"), "PASS");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(205);
      this.setTooltip("Connect ESP32 to virtual Wi-Fi network with given SSID and password.");
    }
  };
  Blockly.Blocks["wifi_is_connected"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F4E1} Wi-Fi connected?");
      this.setOutput(true, "Boolean");
      this.setColour(205);
      this.setTooltip("Returns true when ESP32 has connected to the Wi-Fi network.");
    }
  };
  Blockly.Blocks["wifi_local_ip"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F4E1} Wi-Fi IP address");
      this.setOutput(true, "String");
      this.setColour(205);
      this.setTooltip("Returns the IP address assigned to ESP32 on the network.");
    }
  };
  Blockly.Blocks["wifi_server_begin"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F310} start Web Server port").appendField(new Blockly.FieldNumber(80, 1, 65535), "PORT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(205);
      this.setTooltip("Start the HTTP Web Server on the given port (default: 80).");
    }
  };
  Blockly.Blocks["wifi_server_on"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F310} on HTTP request route").appendField(new Blockly.FieldTextInput("/led/on"), "PATH");
      this.appendStatementInput("DO").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(205);
      this.setTooltip("Define an HTTP endpoint route and handler callback.");
    }
  };
  Blockly.Blocks["wifi_server_send"] = {
    init() {
      this.appendValueInput("CONTENT").setCheck(null).appendField("\u{1F310} send HTTP response").appendField(new Blockly.FieldNumber(200, 100, 599), "STATUS").appendField("content");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(205);
      this.setTooltip("Send an HTTP response status code and HTML/text payload to the client.");
    }
  };
  Blockly.Blocks["microbit_show_icon"] = {
    init() {
      const icons = [
        ["Heart", "heart"],
        ["Smile", "smile"],
        ["Check", "check"],
        ["Sad", "sad"],
        ["Ghost", "ghost"],
        ["Square", "square"]
      ];
      this.appendDummyInput().appendField("\u{1F7E9} micro:bit show icon").appendField(new Blockly.FieldDropdown(icons), "ICON");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(345);
      this.setTooltip("Display a built-in symbol on the 5x5 LED matrix display.");
    }
  };
  Blockly.Blocks["microbit_show_number"] = {
    init() {
      this.appendValueInput("NUM").setCheck("Number").appendField("\u{1F7E9} micro:bit show number");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(345);
      this.setTooltip("Display a number on the 5x5 LED matrix.");
    }
  };
  Blockly.Blocks["microbit_show_string"] = {
    init() {
      this.appendValueInput("TEXT").setCheck(null).appendField("\u{1F7E9} micro:bit show text");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(345);
      this.setTooltip("Scroll text across the 5x5 LED matrix display.");
    }
  };
  Blockly.Blocks["microbit_clear"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F7E9} micro:bit clear display");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(345);
      this.setTooltip("Clear all LEDs on the 5x5 matrix display.");
    }
  };
  Blockly.Blocks["microbit_button_pressed"] = {
    init() {
      this.appendDummyInput().appendField("\u{1F7E9} micro:bit button").appendField(new Blockly.FieldDropdown([["A", "A"], ["B", "B"]]), "BTN").appendField("is pressed?");
      this.setOutput(true, "Boolean");
      this.setColour(345);
      this.setTooltip("Check whether tactile button A or B on the micro:bit is pressed.");
    }
  };
  defined = true;
}
var arduino = new Blockly.Generator("Arduino");
arduino.addReservedWords("setup,loop,if,else,for,while,int,void,HIGH,LOW,INPUT,OUTPUT,Servo,delay,digitalWrite,digitalRead,analogWrite,analogRead,pinMode,tone,noTone");
arduino.init = function(workspace) {
  const gen = this;
  gen.definitions_ = /* @__PURE__ */ Object.create(null);
  if (!gen.nameDB_) {
    gen.nameDB_ = new Blockly.Names(gen.RESERVED_WORDS_);
  } else {
    gen.nameDB_.reset();
  }
  gen.nameDB_.setVariableMap(workspace.getVariableMap());
};
arduino.finish = function(code) {
  const gen = this;
  const defs = Object.values(gen.definitions_).join("\n");
  return (defs ? defs + "\n\n" : "") + code;
};
arduino.scrubNakedValue = (line) => line + ";\n";
arduino.scrub_ = function(block, code, thisOnly) {
  const next = block.nextConnection?.targetBlock();
  const nextCode = thisOnly || !next ? "" : this.blockToCode(next);
  return code + nextCode;
};
function indent(code) {
  return code.split("\n").map((l) => l ? "  " + l : l).join("\n");
}
arduino.forBlock["arduino_program"] = function(block, generator) {
  const setup = generator.statementToCode(block, "SETUP");
  const loop = generator.statementToCode(block, "LOOP");
  return `void setup() {
${setup}}

void loop() {
${loop}}
`;
};
arduino.forBlock["io_pinmode"] = (block) => {
  const pin = block.getFieldValue("PIN");
  const mode = block.getFieldValue("MODE");
  return `pinMode(${pin}, ${mode});
`;
};
arduino.forBlock["io_digitalwrite"] = (block) => {
  const pin = block.getFieldValue("PIN");
  const state = block.getFieldValue("STATE");
  return `digitalWrite(${pin}, ${state});
`;
};
arduino.forBlock["io_digitalread"] = (block) => {
  return [`digitalRead(${block.getFieldValue("PIN")})`, ORDER.ATOMIC];
};
arduino.forBlock["io_analogwrite"] = (block, generator) => {
  const pin = block.getFieldValue("PIN");
  const value = generator.valueToCode(block, "VALUE", ORDER.NONE) || "0";
  return `analogWrite(${pin}, ${value});
`;
};
arduino.forBlock["io_analogread"] = (block) => {
  return [`analogRead(${block.getFieldValue("PIN")})`, ORDER.ATOMIC];
};
arduino.forBlock["time_delay"] = (block, generator) => {
  const ms = generator.valueToCode(block, "MS", ORDER.NONE) || "1000";
  return `delay(${ms});
`;
};
arduino.forBlock["servo_write"] = function(block, generator) {
  const pin = block.getFieldValue("PIN");
  const angle = generator.valueToCode(block, "ANGLE", ORDER.NONE) || "90";
  const gg = generator;
  gg.definitions_["servo_include"] = "#include <Servo.h>";
  const name = `servo_${pin}`.replace(/[^a-zA-Z0-9_]/g, "_");
  gg.definitions_[name] = `Servo ${name};`;
  return `${name}.attach(${pin});
${name}.write(${angle});
`;
};
arduino.forBlock["tone_play"] = (block, generator) => {
  const pin = block.getFieldValue("PIN");
  const freq = generator.valueToCode(block, "FREQ", ORDER.NONE) || "440";
  return `tone(${pin}, ${freq});
`;
};
arduino.forBlock["tone_stop"] = (block) => {
  return `noTone(${block.getFieldValue("PIN")});
`;
};
arduino.forBlock["io_tone"] = arduino.forBlock["tone_play"];
arduino.forBlock["io_notone"] = arduino.forBlock["tone_stop"];
arduino.forBlock["actuator_servo_write"] = arduino.forBlock["servo_write"];
arduino.forBlock["controls_if"] = function(block, generator) {
  let n = 0;
  let code = "";
  do {
    const cond = generator.valueToCode(block, "IF" + n, ORDER.NONE) || "false";
    const branch = generator.statementToCode(block, "DO" + n);
    code += (n === 0 ? "if" : " else if") + ` (${cond}) {
${branch}}`;
    n++;
  } while (block.getInput("IF" + n));
  if (block.getInput("ELSE")) {
    code += ` else {
${generator.statementToCode(block, "ELSE")}}`;
  }
  return code + "\n";
};
arduino.forBlock["controls_repeat_ext"] = function(block, generator) {
  const times = generator.valueToCode(block, "TIMES", ORDER.NONE) || "0";
  const branch = generator.statementToCode(block, "DO");
  return `for (int i = 0; i < ${times}; i++) {
${branch}}
`;
};
arduino.forBlock["controls_whileUntil"] = function(block, generator) {
  const until = block.getFieldValue("MODE") === "UNTIL";
  let cond = generator.valueToCode(block, "BOOL", until ? ORDER.UNARY : ORDER.NONE) || "false";
  if (until) cond = "!" + cond;
  return `while (${cond}) {
${generator.statementToCode(block, "DO")}}
`;
};
arduino.forBlock["logic_compare"] = function(block, generator) {
  const ops = { EQ: "==", NEQ: "!=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" };
  const op = ops[block.getFieldValue("OP")];
  const order = op === "==" || op === "!=" ? ORDER.EQUALITY : ORDER.RELATIONAL;
  const a = generator.valueToCode(block, "A", order) || "0";
  const b = generator.valueToCode(block, "B", order) || "0";
  return [`${a} ${op} ${b}`, order];
};
arduino.forBlock["logic_operation"] = function(block, generator) {
  const and = block.getFieldValue("OP") === "AND";
  const op = and ? "&&" : "||";
  const order = and ? ORDER.LOGICAL_AND : ORDER.LOGICAL_OR;
  const a = generator.valueToCode(block, "A", order) || "false";
  const b = generator.valueToCode(block, "B", order) || "false";
  return [`${a} ${op} ${b}`, order];
};
arduino.forBlock["logic_negate"] = function(block, generator) {
  const a = generator.valueToCode(block, "BOOL", ORDER.UNARY) || "true";
  return [`!${a}`, ORDER.UNARY];
};
arduino.forBlock["logic_boolean"] = (block) => {
  return [block.getFieldValue("BOOL") === "TRUE" ? "true" : "false", ORDER.ATOMIC];
};
arduino.forBlock["math_number"] = (block) => {
  return [String(Number(block.getFieldValue("NUM"))), ORDER.ATOMIC];
};
arduino.forBlock["math_arithmetic"] = function(block, generator) {
  const ops = {
    ADD: ["+", ORDER.ADD],
    MINUS: ["-", ORDER.ADD],
    MULTIPLY: ["*", ORDER.MUL],
    DIVIDE: ["/", ORDER.MUL]
  };
  const [op, order] = ops[block.getFieldValue("OP")] ?? ["+", ORDER.ADD];
  const a = generator.valueToCode(block, "A", order) || "0";
  const b = generator.valueToCode(block, "B", order) || "0";
  return [`${a} ${op} ${b}`, order];
};
arduino.forBlock["math_modulo"] = function(block, generator) {
  const a = generator.valueToCode(block, "DIVIDEND", ORDER.NONE) || "0";
  const b = generator.valueToCode(block, "DIVISOR", ORDER.NONE) || "1";
  return [`((${a}) % (${b}))`, ORDER.MUL];
};
arduino.forBlock["math_single"] = function(block, generator) {
  const op = block.getFieldValue("OP") || "ABS";
  const value = generator.valueToCode(block, "NUM", ORDER.NONE) || "0";
  const expressions = {
    ROOT: `sqrt(${value})`,
    ABS: `abs(${value})`,
    NEG: `-(${value})`,
    SIN: `sin((${value}) * PI / 180.0)`,
    COS: `cos((${value}) * PI / 180.0)`,
    TAN: `tan((${value}) * PI / 180.0)`
  };
  return [expressions[op] || value, ORDER.ATOMIC];
};
arduino.forBlock["variables_get"] = function(block, generator) {
  const gg = generator;
  const name = gg.nameDB_.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
  return [name, ORDER.ATOMIC];
};
arduino.forBlock["variables_set"] = function(block, generator) {
  const gg = generator;
  const name = gg.nameDB_.getName(block.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
  const value = generator.valueToCode(block, "VALUE", ORDER.NONE) || "0";
  gg.definitions_[`var_${name}`] = `int ${name};`;
  return `${name} = ${value};
`;
};
arduino.forBlock["serial_begin"] = (block) => "Serial.begin(" + block.getFieldValue("BAUD") + ");\n";
arduino.forBlock["serial_print"] = (block, gen) => {
  const text = gen.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return "Serial.print(" + text + ");\n";
};
arduino.forBlock["serial_println"] = (block, gen) => {
  const text = gen.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return "Serial.println(" + text + ");\n";
};
arduino.forBlock["text_string"] = (block) => [
  JSON.stringify(String(block.getFieldValue("TEXT") ?? "")),
  ORDER.ATOMIC
];
arduino.forBlock["lcd_print"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["lcd_include"] = "#include <LiquidCrystal_I2C.h>";
  gg.definitions_["lcd_decl"] = "LiquidCrystal_I2C lcd(0x27, 16, 2);";
  const text = generator.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return `lcd.print(${text});
`;
};
arduino.forBlock["lcd_print_line"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["lcd_include"] = "#include <LiquidCrystal_I2C.h>";
  gg.definitions_["lcd_decl"] = "LiquidCrystal_I2C lcd(0x27, 16, 2);";
  const line = block.getFieldValue("LINE") || "1";
  const row = Number(line) === 2 ? 1 : 0;
  const text = generator.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return `lcd.setCursor(0, ${row});
lcd.print(${text});
`;
};
arduino.forBlock["lcd_setup"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["lcd_include"] = "#include <LiquidCrystal_I2C.h>";
  gg.definitions_["lcd_decl"] = "LiquidCrystal_I2C lcd(0x27, 16, 2);";
  return "lcd.init();\nlcd.backlight();\n";
};
arduino.forBlock["lcd_set_cursor"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["lcd_include"] = "#include <LiquidCrystal_I2C.h>";
  gg.definitions_["lcd_decl"] = "LiquidCrystal_I2C lcd(0x27, 16, 2);";
  const col = block.getFieldValue("COL") ?? "0";
  const row = block.getFieldValue("ROW") ?? "0";
  return `lcd.setCursor(${col}, ${row});
`;
};
arduino.forBlock["lcd_clear"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["lcd_include"] = "#include <LiquidCrystal_I2C.h>";
  gg.definitions_["lcd_decl"] = "LiquidCrystal_I2C lcd(0x27, 16, 2);";
  return "lcd.clear();\n";
};
arduino.forBlock["seven_segment_write"] = function(block, generator) {
  const digit = generator.valueToCode(block, "DIGIT", ORDER.NONE) || "0";
  return `displayDigit(${digit});
`;
};
arduino.forBlock["seven_segment_clear"] = function() {
  return "clearDisplay();\n";
};
arduino.forBlock["ir_read"] = (block) => [
  "false /* PIXIU simulated IR obstacle sensor: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["dht_temperature"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["dht_include"] = "#include <DHT.h>";
  gg.definitions_["dht_decl"] = "#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);";
  return ["dht.readTemperature()", ORDER.ATOMIC];
};
arduino.forBlock["dht_humidity"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["dht_include"] = "#include <DHT.h>";
  gg.definitions_["dht_decl"] = "#define DHTPIN 2\n#define DHTTYPE DHT22\nDHT dht(DHTPIN, DHTTYPE);";
  return ["dht.readHumidity()", ORDER.ATOMIC];
};
arduino.forBlock["joystick_x"] = (block) => [
  "512 /* PIXIU simulated joystick X: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["joystick_y"] = (block) => [
  "512 /* PIXIU simulated joystick Y: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["joystick_button"] = (block) => [
  "false /* PIXIU simulated joystick button: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["soil_moisture_read"] = (block) => [
  "0 /* PIXIU simulated soil moisture: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["encoder_read"] = (block) => [
  "0 /* PIXIU simulated rotary encoder: " + String(block.getFieldValue("SENSOR") || "") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["keypad_read"] = function(_block, generator) {
  const gg = generator;
  gg.definitions_["keypad_include"] = "#include <Keypad.h>\nconst byte ROWS = 4;\nconst byte COLS = 4;\nchar keys[ROWS][COLS] = {\n  {'1','2','3','A'},\n  {'4','5','6','B'},\n  {'7','8','9','C'},\n  {'*','0','#','D'}\n};\nbyte rowPins[ROWS] = {2, 3, 4, 5};\nbyte colPins[COLS] = {6, 7, 8, 9};\nKeypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);";
  return ["keypad.getKey()", ORDER.ATOMIC];
};
arduino.forBlock["keypad_check_pin"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["keypad_pin_var"] = 'String enteredPin = "";';
  const pin = generator.valueToCode(block, "PIN", ORDER.NONE) || '"1234"';
  return [`(enteredPin == ${pin})`, ORDER.EQUALITY];
};
arduino.forBlock["keypad_clear_pin"] = function(_block, generator) {
  const gg = generator;
  gg.definitions_["keypad_pin_var"] = 'String enteredPin = "";';
  return 'enteredPin = "";\n';
};
arduino.forBlock["oled_print"] = function(block, generator) {
  const gg = generator;
  gg.definitions_["wire_include"] = "#include <Wire.h>";
  gg.definitions_["adafruit_gfx"] = "#include <Adafruit_GFX.h>";
  gg.definitions_["adafruit_ssd1306"] = "#include <Adafruit_SSD1306.h>";
  gg.definitions_["oled_decl"] = "Adafruit_SSD1306 oled(128, 64, &Wire, -1);";
  const text = generator.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return `oled.println(${text});
oled.display();
`;
};
arduino.forBlock["oled_clear"] = function() {
  return "oled.clearDisplay();\noled.display();\n";
};
arduino.forBlock["motor_driver_write"] = (block, generator) => {
  const channel = block.getFieldValue("CHANNEL") || "A";
  const speed = generator.valueToCode(block, "SPEED", ORDER.NONE) || "0";
  const direction = block.getFieldValue("DIRECTION") || "STOP";
  const ena = block.getFieldValue(channel === "A" ? "ENA" : "ENB");
  const in1 = block.getFieldValue(channel === "A" ? "IN1" : "IN3");
  const in2 = block.getFieldValue(channel === "A" ? "IN2" : "IN4");
  if (direction === "STOP") return `analogWrite(${ena}, 0); digitalWrite(${in1}, LOW); digitalWrite(${in2}, LOW);\\n`;
  const highPin = direction === "CW" ? in1 : in2;
  const lowPin = direction === "CW" ? in2 : in1;
  return `analogWrite(${ena}, ${speed}); digitalWrite(${highPin}, HIGH); digitalWrite(${lowPin}, LOW);\\n`;
};
arduino.forBlock["pushbutton_read"] = (block) => ["false /* PIXIU simulated pushbutton: " + String(block.getFieldValue("SENSOR") || "") + " */", ORDER.ATOMIC];
arduino.forBlock["pir_motion"] = (block) => ["false /* PIXIU simulated PIR: " + String(block.getFieldValue("SENSOR") || "") + " */", ORDER.ATOMIC];
arduino.forBlock["ldr_read"] = () => ["analogRead(A0) /* PIXIU simulated LDR */", ORDER.ATOMIC];
arduino.forBlock["tmp36_temperature"] = () => ["analogRead(A0) /* PIXIU simulated TMP36 */", ORDER.ATOMIC];
arduino.forBlock["potentiometer_read"] = () => ["analogRead(A0) /* PIXIU simulated potentiometer */", ORDER.ATOMIC];
arduino.forBlock["neopixel_set_color"] = (block, generator) => {
  const pixel = generator.valueToCode(block, "PIXEL", ORDER.NONE) || "0";
  const color = generator.valueToCode(block, "COLOR", ORDER.NONE) || '"#ff0000"';
  return `/* PIXIU NeoPixel: setPixelColor(${pixel}, ${color}) */
`;
};
arduino.forBlock["neopixel_show"] = () => {
  return "/* PIXIU NeoPixel: show() */\n";
};
arduino.forBlock["mq2_gas_read"] = () => ["analogRead(A0) /* PIXIU simulated MQ-2 Gas PPM */", ORDER.ATOMIC];
arduino.forBlock["arduino_map"] = (block, generator) => {
  const value = generator.valueToCode(block, "VALUE", ORDER.NONE) || "0";
  const fromLow = generator.valueToCode(block, "FROM_LOW", ORDER.NONE) || "0";
  const fromHigh = generator.valueToCode(block, "FROM_HIGH", ORDER.NONE) || "1023";
  const toLow = generator.valueToCode(block, "TO_LOW", ORDER.NONE) || "0";
  const toHigh = generator.valueToCode(block, "TO_HIGH", ORDER.NONE) || "255";
  return ["map(" + value + ", " + fromLow + ", " + fromHigh + ", " + toLow + ", " + toHigh + ")", ORDER.ATOMIC];
};
arduino.forBlock["ultrasonic_read"] = (block) => [
  "0 /* PIXIU simulated ultrasonic distance: D" + String(block.getFieldValue("TRIG") || "?") + "/D" + String(block.getFieldValue("ECHO") || "?") + " */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_is_detected"] = (block) => {
  const cls = block.getFieldValue("CLASS") ?? "car";
  const safeClass = String(cls).replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "car";
  return [
    'false /* PIXIU AI Studio: browser-only AI sees "' + safeClass + '". */',
    ORDER.ATOMIC
  ];
};
arduino.forBlock["ai_is_unknown"] = () => [
  "false /* PIXIU AI Studio browser-only: normalized unknown/low-confidence result. */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_get_detected_class"] = () => [
  '"none" /* PIXIU AI Studio: browser-only AI detected class. */',
  ORDER.ATOMIC
];
arduino.forBlock["ai_get_object_count"] = () => [
  "0 /* PIXIU AI Studio: browser-only object count. */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_confidence"] = () => [
  "0 /* PIXIU AI Studio: browser-only AI confidence (0-100). */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_get_gesture"] = () => [
  '"none" /* PIXIU AI Studio: browser-only hand gesture. */',
  ORDER.ATOMIC
];
arduino.forBlock["ai_get_finger_count"] = () => [
  "0 /* PIXIU AI Studio: browser-only finger count. */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_is_gesture"] = () => [
  "false /* PIXIU AI Studio: browser-only gesture predicate. */",
  ORDER.ATOMIC
];
arduino.forBlock["ai_camera_enable"] = (block) => {
  const state = block.getFieldValue("STATE") ?? "ON";
  return "/* PIXIU AI Studio browser runtime: AI camera " + state.toLowerCase() + ". This is not an Arduino camera API. */\n";
};
arduino.forBlock["ai_microphone_enable"] = (block) => {
  const state = block.getFieldValue("STATE") ?? "ON";
  return "/* PIXIU AI Studio browser runtime: AI microphone " + state.toLowerCase() + ". This is not an Arduino microphone API. */\n";
};
arduino.forBlock["wifi_connect"] = (block) => {
  const ssid = block.getFieldValue("SSID") || "Pixiu_IoT";
  const pass = block.getFieldValue("PASS") || "";
  return `WiFi.begin("${ssid}", "${pass}");
`;
};
arduino.forBlock["wifi_is_connected"] = () => [
  "(WiFi.status() == WL_CONNECTED)",
  ORDER.EQUALITY
];
arduino.forBlock["wifi_local_ip"] = () => [
  "WiFi.localIP().toString()",
  ORDER.ATOMIC
];
arduino.forBlock["wifi_server_begin"] = (block) => {
  const port = block.getFieldValue("PORT") || 80;
  return `server.begin(${port});
`;
};
arduino.forBlock["wifi_server_on"] = (block, generator) => {
  const path = block.getFieldValue("PATH") || block.getFieldValue("ROUTE") || "/";
  const branch = generator.statementToCode(block, "DO") || generator.statementToCode(block, "HANDLER") || "";
  return `server.on("${path}", []() {
${branch}});
`;
};
arduino.forBlock["wifi_server_send"] = (block, generator) => {
  const status = block.getFieldValue("STATUS") || block.getFieldValue("CODE") || 200;
  const content = generator.valueToCode(block, "CONTENT", ORDER.NONE) || generator.valueToCode(block, "BODY", ORDER.NONE) || '""';
  return `server.send(${status}, "text/html", ${content});
`;
};
arduino.forBlock["microbit_show_icon"] = (block) => {
  const icon = block.getFieldValue("ICON") || "heart";
  return `uBit.display.show(IconNames::${icon});
`;
};
arduino.forBlock["microbit_show_number"] = (block, generator) => {
  const num = generator.valueToCode(block, "NUM", ORDER.NONE) || "0";
  return `uBit.display.print(${num});
`;
};
arduino.forBlock["microbit_show_string"] = (block, generator) => {
  const text = generator.valueToCode(block, "TEXT", ORDER.NONE) || '""';
  return `uBit.display.scroll(${text});
`;
};
arduino.forBlock["microbit_clear"] = () => "uBit.display.clear();\n";
arduino.forBlock["microbit_button_pressed"] = (block) => {
  const btn = block.getFieldValue("BTN") || "A";
  return [`uBit.button${btn}.isPressed()`, ORDER.ATOMIC];
};
function normalizeBlocklyXml(xml) {
  if (!xml || typeof xml !== "string") return xml;
  let normalized = xml;
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_on["'][^>]*>[\s\S]*?)<field name=["']ROUTE["']>([\s\S]*?)<\/field>/g,
    '$1<field name="PATH">$2</field>'
  );
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_on["'][^>]*>[\s\S]*?)<statement name=["']HANDLER["']>/g,
    '$1<statement name="DO">'
  );
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_send["'][^>]*>[\s\S]*?)<field name=["']CODE["']>([\s\S]*?)<\/field>/g,
    '$1<field name="STATUS">$2</field>'
  );
  normalized = normalized.replace(
    /(<block[^>]*type=["']wifi_server_send["'][^>]*>[\s\S]*?)<value name=["']BODY["']>/g,
    '$1<value name="CONTENT">'
  );
  normalized = normalized.replace(/<field name="ROUTE">/g, '<field name="PATH">').replace(/<statement name="HANDLER">/g, '<statement name="DO">').replace(/<field name="CODE">/g, '<field name="STATUS">').replace(/<value name="BODY">/g, '<value name="CONTENT">');
  return normalized;
}
export {
  ORDER,
  arduino,
  defineArduinoBlocks,
  indent,
  normalizeBlocklyXml,
  setAiClassContext,
  setPinContext
};
