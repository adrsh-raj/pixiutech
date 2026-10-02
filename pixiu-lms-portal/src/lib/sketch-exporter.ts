import type { CircuitState } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import { getActiveBoard, isBoardPart } from "./board-registry"

export function buildInoSketch(circuit: CircuitState, cppCode: string): string {
  const dateStr = new Date().toISOString().split("T")[0]
  const board = getActiveBoard(circuit)
  const boardPart = circuit.parts.find((p) => isBoardPart(p.type))

  const pinUsageList: string[] = []
  if (boardPart) {
    for (const w of circuit.wires) {
      if (w.from.partId === boardPart.id) {
        const targetPart = circuit.parts.find((p) => p.id === w.to.partId)
        const targetName = targetPart ? (CATALOG[targetPart.type]?.name ?? targetPart.type) : w.to.partId
        pinUsageList.push(`// Pin ${w.from.pinId.toUpperCase()} -> ${targetName} (${w.to.pinId.toUpperCase()})`)
      } else if (w.to.partId === boardPart.id) {
        const sourcePart = circuit.parts.find((p) => p.id === w.from.partId)
        const sourceName = sourcePart ? (CATALOG[sourcePart.type]?.name ?? sourcePart.type) : w.from.partId
        pinUsageList.push(`// Pin ${w.to.pinId.toUpperCase()} <- ${sourceName} (${w.from.pinId.toUpperCase()})`)
      }
    }
  }

  // Detect which libraries may be needed
  const hasServo = circuit.parts.some((p) => p.type === "servo")
  const hasLcd = circuit.parts.some((p) => p.type === "lcd-i2c")
  const hasNeoPixel = circuit.parts.some((p) => p.type === "neopixel-ring")

  const headerIncludes: string[] = []
  if (hasServo && !cppCode.includes("<Servo.h>")) headerIncludes.push("#include <Servo.h>")
  if (hasLcd && !cppCode.includes("<LiquidCrystal_I2C.h>")) {
    headerIncludes.push("#include <Wire.h>")
    headerIncludes.push("#include <LiquidCrystal_I2C.h>")
  }
  if (hasNeoPixel && !cppCode.includes("<Adafruit_NeoPixel.h>")) {
    headerIncludes.push("#include <Adafruit_NeoPixel.h>")
  }

  const banner = `/*
 * -----------------------------------------------------------
 * PIXIU TECH CYBERLAB - EMBEDDED C/C++ SKETCH (.ino)
 * Target Board: ${board.name} (${board.mcu})
 * Architecture: ${board.family.toUpperCase()} · Logic: ${board.logicVoltage}V
 * Exported Date: ${dateStr}
 *
 * Circuit Wiring Map:
${pinUsageList.length > 0 ? pinUsageList.map((l) => " * " + l).join("\n") : " * (Standard standalone sketch)"}
 * -----------------------------------------------------------
 */\n\n`

  const includes = headerIncludes.length > 0 ? headerIncludes.join("\n") + "\n\n" : ""

  const fallbackCode = `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Pixiu CyberLab Arduino Initialized!");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`

  const body = cppCode.trim() ? cppCode.trim() : fallbackCode

  return banner + includes + body + "\n"
}

export function triggerInoDownload(filename: string, content: string) {
  const safeFilename = filename.endsWith(".ino") ? filename : `${filename}.ino`
  const blob = new Blob([content], { type: "text/x-arduino;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = safeFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
