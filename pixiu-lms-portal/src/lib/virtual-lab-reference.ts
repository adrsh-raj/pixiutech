import type { CircuitState } from "@/lib/circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"

export interface ModelReferenceCase {
  id: string
  title: string
  setup: string
  equation: string
  expected: string
  assumptions: string
}

export const MODEL_REFERENCE_CASES: ModelReferenceCase[] = [
  {
    id: "red-led-220",
    title: "Red LED with a 220 ohm resistor",
    setup: "5 V source, one red LED, and a 220 ohm series resistor",
    equation: "I = (Vs - Vf) / R",
    expected: "(5.0 V - 2.0 V) / 220 ohm = 13.6 mA",
    assumptions: "Typical red LED forward drop is taken as 2.0 V. Real LEDs vary by part and current.",
  },
  {
    id: "equal-divider",
    title: "Equal-resistor voltage divider",
    setup: "5 V source with two 10 kohm resistors in series",
    equation: "Vmid = Vs x R2 / (R1 + R2)",
    expected: "2.50 V at the midpoint; 0.25 mA through the divider",
    assumptions: "The output is unloaded. A connected load changes the midpoint voltage.",
  },
  {
    id: "reverse-led",
    title: "LED connected in reverse",
    setup: "A diode is reverse biased in a low-voltage circuit",
    equation: "Forward current is approximately zero",
    expected: "LED stays off; the simplified simulator flags reverse polarity",
    assumptions: "This is a low-voltage model. It does not simulate reverse breakdown.",
  },
  {
    id: "open-circuit",
    title: "Open series connection",
    setup: "One wire in a series loop is disconnected",
    equation: "I = 0 A for an ideal open circuit",
    expected: "No current flows through the loop",
    assumptions: "The circuit doctor identifies disconnected lesson requirements; parasitic leakage is not modeled.",
  },
  {
    id: "uno-adc",
    title: "Arduino Uno analog input",
    setup: "A 0 to 5 V input read by the standard 10-bit ADC",
    equation: "ADC code is approximately Vin / Vref x 1023",
    expected: "2.50 V reads about 512 counts",
    assumptions: "The reference is 5 V. This is a conversion reference, not a calibrated sensor measurement.",
  },
]

export interface LiveModelEvidence {
  id: string
  label: string
  value: string
  note: string
}

export function getLiveModelEvidence(state: CircuitState, runtime: Record<string, PartRuntime>): LiveModelEvidence[] {
  const evidence: LiveModelEvidence[] = []
  for (const part of state.parts) {
    const reading = runtime[part.id]
    if (!reading) continue
    if (part.type === "led" && typeof reading.currentMa === "number") {
      evidence.push({
        id: part.id + "-current",
        label: "LED current",
        value: reading.currentMa.toFixed(reading.currentMa % 1 ? 1 : 0) + " mA",
        note: reading.burnt ? "Model limit exceeded; inspect the series resistance." : "Calculated by the virtual circuit model.",
      })
    }
    if (part.type === "ldr" && typeof reading.sensorValue === "number") {
      evidence.push({
        id: part.id + "-adc",
        label: "LDR input",
        value: Math.round(reading.sensorValue) + " / 1023",
        note: "Raw virtual ADC control value; it is not lux or a physical resistance reading.",
      })
    } else if (part.type === "dht11" && typeof reading.dhtTemperature === "number") {
      evidence.push({
        id: part.id + "-dht",
        label: "DHT11 model inputs",
        value: reading.dhtTemperature + " C, " + (reading.dhtHumidity ?? "—") + "% RH",
        note: "Configured sample values; sensor accuracy and timing are not simulated.",
      })
    } else if (part.type === "ultrasonic" && typeof reading.sensorValue === "number") {
      evidence.push({
        id: part.id + "-distance",
        label: "Ultrasonic distance",
        value: reading.sensorValue + " cm",
        note: "Virtual distance input; echo pulse timing and acoustic noise are not simulated.",
      })
    } else if (part.type === "tmp36" && typeof reading.sensorValue === "number") {
      evidence.push({
        id: part.id + "-temperature",
        label: "TMP36 model input",
        value: reading.sensorValue + " C",
        note: "Configured temperature value; analog noise and calibration are not simulated.",
      })
    }
  }
  return evidence
}
