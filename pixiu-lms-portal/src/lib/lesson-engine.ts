import type { CircuitState, PartType } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { TEMPLATES, type ProjectTemplate } from "./templates"

export type LessonDifficulty = "Beginner" | "Intermediate" | "Advanced"
export type LessonStepKind = "build" | "code" | "run" | "experiment"

export interface LessonPartRequirement {
  type: PartType
  count: number
}

export interface LessonEndpoint {
  partType: PartType
  pinId: string
  partId?: string
}

export interface LessonConnectionRequirement {
  from: LessonEndpoint
  to: LessonEndpoint
}

export interface LessonBlockRequirement {
  type: string
  count: number
  fields?: Record<string, string>
  /** Optional values expected inside named value/statement inputs, e.g. ANGLE → 90. */
  inputs?: Record<string, string | number>
  /** Lesson code checks count only blocks attached to the Arduino program by default. */
  connected?: boolean
}

export interface LessonRuntimeRequirement {
  partId?: string
  partType?: PartType
  field: keyof PartRuntime
  min?: number
  max?: number
  equals?: number | string | boolean
}

export type LessonCheck =
  | { kind: "parts"; requirements: LessonPartRequirement[] }
  | { kind: "connections"; requirements: LessonConnectionRequirement[] }
  | { kind: "part-property"; partType: PartType; property: string; min?: number; max?: number; equals?: string | number }
  | { kind: "blocks"; requirements: LessonBlockRequirement[] }
  | { kind: "running" }
  | { kind: "runtime"; requirements: LessonRuntimeRequirement[] }
  | { kind: "runtime-any"; requirements: LessonRuntimeRequirement[] }

export interface LessonStep {
  id: string
  title: string
  instructions: string
  kind: LessonStepKind
  checks: LessonCheck[]
  success: string
}

export interface Lesson {
  id: string
  title: string
  shortTitle: string
  description: string
  difficulty: LessonDifficulty
  estimatedMinutes: number
  concepts: string[]
  prerequisites: string[]
  templateId?: string
  seedCircuit?: CircuitState
  seedBlocklyXml?: string
  steps: LessonStep[]
}

export interface LessonContext {
  state: CircuitState
  blocklyXml: string
  running: boolean
  runtime: Record<string, PartRuntime>
}

export interface LessonCheckResult {
  passed: boolean
  label: string
  detail: string
}

export interface LessonStepResult {
  passed: boolean
  results: LessonCheckResult[]
  summary: string
}

export interface LessonProgress {
  completedStepIds: string[]
  startedAt?: string
  completedAt?: string
}

const PROGRESS_KEY = "pixiu-lesson-progress-v1"

export function loadLessonProgress(): Record<string, LessonProgress> {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function saveLessonProgress(progress: Record<string, LessonProgress>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Local-first progress is best-effort.
  }
}

export function markStepComplete(
  progress: Record<string, LessonProgress>,
  lesson: Lesson,
  stepId: string,
): Record<string, LessonProgress> {
  const current = progress[lesson.id] ?? { completedStepIds: [] }
  const completed = new Set(current.completedStepIds)
  completed.add(stepId)
  const next: LessonProgress = {
    ...current,
    completedStepIds: Array.from(completed),
    startedAt: current.startedAt ?? new Date().toISOString(),
  }
  if (completed.size >= lesson.steps.length) next.completedAt = current.completedAt ?? new Date().toISOString()
  const merged = { ...progress, [lesson.id]: next }
  saveLessonProgress(merged)
  return merged
}

export function resetLessonProgress(
  progress: Record<string, LessonProgress>,
  lessonId: string,
): Record<string, LessonProgress> {
  const merged = { ...progress }
  delete merged[lessonId]
  saveLessonProgress(merged)
  return merged
}

export function getLessonById(id: string) {
  return LESSONS.find((lesson) => lesson.id === id) ?? null
}

export function getLessonProgressPercent(lesson: Lesson, progress?: LessonProgress) {
  if (!progress || lesson.steps.length === 0) return 0
  return Math.round((progress.completedStepIds.filter((id) => lesson.steps.some((step) => step.id === id)).length / lesson.steps.length) * 100)
}

export function getUnlockedLessonIds(progress: Record<string, LessonProgress>) {
  return new Set(
    LESSONS.filter((lesson) =>
      lesson.prerequisites.every((id) => getLessonProgressPercent(getLessonById(id)!, progress[id]) === 100),
    ).map((lesson) => lesson.id),
  )
}

function countParts(state: CircuitState, type: PartType) {
  return state.parts.filter((part) => part.type === type).length
}

function pinMatches(partType: PartType, expectedPinId: string, actualPinId: string) {
  if (partType === "arduino-uno" && (expectedPinId === "gnd" || expectedPinId === "gnd_pwr")) {
    return actualPinId === "gnd" || actualPinId === "gnd_pwr"
  }
  return expectedPinId === actualPinId
}

function endpointMatches(state: CircuitState, endpoint: LessonEndpoint, actual: PinRef) {
  const part = state.parts.find((item) => item.id === actual.partId)
  if (!part || part.type !== endpoint.partType) return false
  if (endpoint.partId) {
    const namedPartExists = state.parts.some((item) => item.id === endpoint.partId && item.type === endpoint.partType)
    if (namedPartExists && endpoint.partId !== actual.partId) return false
  }
  return pinMatches(part.type, endpoint.pinId, actual.pinId)
}

function hasConnection(state: CircuitState, req: LessonConnectionRequirement) {
  const matches = (a: LessonConnectionRequirement["from"], b: LessonConnectionRequirement["to"]) =>
    state.wires.some((wire) =>
      endpointMatches(state, a, wire.from) &&
      endpointMatches(state, b, wire.to),
    )
  return matches(req.from, req.to) || matches(req.to, req.from)
}

function normalizeBlocklyValue(name: string, raw: string): string {
  const value = raw.replace(/\\u00a0/g, " ").replace(/\\s+/g, " ").trim()
  if (["PIN", "TRIG", "ECHO", "ENA", "ENB", "IN1", "IN2", "IN3", "IN4"].includes(name)) {
    const numeric = value.match(/^(A?\\d+)/i)
    if (numeric) return numeric[1].toUpperCase()
  }
  return value
}

function getNamedInputValue(node: Element, inputName: string): string | null {
  const children = Array.from(node.children)
  const holder = children.find((child) => {
    const tag = child.tagName.toLowerCase()
    return (tag === "value" || tag === "statement") && child.getAttribute("name") === inputName
  })
  if (!holder) return null
  const nestedBlock = Array.from(holder.children).find((child) => child.tagName.toLowerCase() === "block")
  if (!nestedBlock) return null
  const nestedFields = Array.from(nestedBlock.getElementsByTagName("field"))
  const numberField = nestedFields.find((field) => field.getAttribute("name") === "NUM")
  if (numberField) return normalizeBlocklyValue("NUM", numberField.textContent || "")
  const textField = nestedFields.find((field) => field.getAttribute("name") === "TEXT")
  if (textField) return normalizeBlocklyValue("TEXT", textField.textContent || "")
  return nestedBlock.getAttribute("type") || null
}

function extractBlocks(xml: string): Array<{
  type: string
  fields: Record<string, string>
  inputs: Record<string, string>
  connected: boolean
}> {
  if (typeof DOMParser === "undefined") return []
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml")
    if (doc.querySelector("parsererror")) return []

    return Array.from(doc.getElementsByTagName("block")).map((node) => {
      const fields: Record<string, string> = {}
      Array.from(node.getElementsByTagName("field")).forEach((field) => {
        const name = field.getAttribute("name")
        if (name) fields[name] = normalizeBlocklyValue(name, field.textContent || "")
      })

      const inputs: Record<string, string> = {}
      Array.from(node.children).forEach((child) => {
        const name = child.getAttribute("name")
        if (!name) return
        const tag = child.tagName.toLowerCase()
        if (tag === "value" || tag === "statement") {
          const value = getNamedInputValue(node, name)
          if (value !== null) inputs[name] = value
        }
      })

      let connected = false
      let parent: Element | null = node.parentElement
      while (parent && parent.tagName.toLowerCase() !== "xml") {
        if (parent.tagName.toLowerCase() === "block") {
          connected = true
          break
        }
        parent = parent.parentElement
      }

      return {
        type: node.getAttribute("type") || "",
        fields,
        inputs,
        connected,
      }
    })
  } catch {
    return []
  }
}

function matchesRuntimeValue(value: unknown, req: LessonRuntimeRequirement) {
  if (value === undefined || value === null) return false
  if (req.equals !== undefined) return value === req.equals
  if (typeof value !== "number") return false
  if (req.min !== undefined && value < req.min) return false
  if (req.max !== undefined && value > req.max) return false
  return true
}

export function evaluateLessonStep(lesson: Lesson, step: LessonStep, context: LessonContext): LessonStepResult {
  const results: LessonCheckResult[] = []

  for (const check of step.checks) {
    if (check.kind === "parts") {
      for (const req of check.requirements) {
        const count = countParts(context.state, req.type)
        results.push({
          passed: count >= req.count,
          label: req.type,
          detail: count >= req.count ? `${count} present` : `Need ${req.count}, found ${count}`,
        })
      }
    }

    if (check.kind === "connections") {
      for (const req of check.requirements) {
        const passed = hasConnection(context.state, req)
        results.push({
          passed,
          label: `${req.from.partType}.${req.from.pinId} → ${req.to.partType}.${req.to.pinId}`,
          detail: passed ? "Connected" : "Connection not found",
        })
      }
    }

    if (check.kind === "part-property") {
      const part = context.state.parts.find((item) => item.type === check.partType)
      const raw = part?.props?.[check.property]
      const value = typeof raw === "string" ? Number(raw) : Number(raw)
      const passed =
        part !== undefined &&
        (check.equals !== undefined
          ? raw === check.equals || value === Number(check.equals)
          : Number.isFinite(value) &&
            (check.min === undefined || value >= check.min) &&
            (check.max === undefined || value <= check.max))
      results.push({
        passed,
        label: `${check.partType}.${check.property}`,
        detail: passed ? `${raw}` : `Current value: ${raw ?? "unset"}`,
      })
    }

    if (check.kind === "blocks") {
      const blocks = extractBlocks(context.blocklyXml)
      for (const req of check.requirements) {
        const matchingBlocks = blocks.filter((block) => {
          if (block.type !== req.type) return false
          if (req.connected !== false && !block.connected) return false
          if (req.fields && !Object.entries(req.fields).every(([name, value]) => normalizeBlocklyValue(name, block.fields[name] ?? "") === normalizeBlocklyValue(name, value))) {
            return false
          }
          if (req.inputs && !Object.entries(req.inputs).every(([name, value]) => normalizeBlocklyValue(name, block.inputs[name] ?? "") === normalizeBlocklyValue(name, String(value)))) {
            return false
          }
          return true
        })
        const matching = matchingBlocks.length
        const requirementText = [
          req.fields ? Object.entries(req.fields).map(([name, value]) => `${name}=${value}`) : [],
          req.inputs ? Object.entries(req.inputs).map(([name, value]) => `${name}=${value}`) : [],
        ].flat().join(", ")
        results.push({
          passed: matching >= req.count,
          label: requirementText ? `${req.type} · ${requirementText}` : req.type,
          detail: matching >= req.count ? `${matching} found` : `Need ${req.count}, found ${matching}`,
        })
      }
    }

    if (check.kind === "running") {
      results.push({
        passed: context.running,
        label: "Simulation",
        detail: context.running ? "Running" : "Press Run first",
      })
    }

    if (check.kind === "runtime") {
      for (const req of check.requirements) {
        const part = req.partId
          ? context.state.parts.find((item) => item.id === req.partId)
          : req.partType
            ? context.state.parts.find((item) => item.type === req.partType)
            : undefined
        const runtime = part ? context.runtime[part.id] : undefined
        const passed = matchesRuntimeValue(runtime?.[req.field], req)
        results.push({
          passed,
          label: part ? `${part.type} · ${String(req.field)}` : String(req.field),
          detail: passed ? "Condition met" : "Condition not met yet",
        })
      }
    }

    if (check.kind === "runtime-any") {
      const passed = check.requirements.some((req) => {
        const part = req.partId
          ? context.state.parts.find((item) => item.id === req.partId)
          : req.partType
            ? context.state.parts.find((item) => item.type === req.partType)
            : undefined
        return matchesRuntimeValue(part ? context.runtime[part.id]?.[req.field] : undefined, req)
      })
      results.push({
        passed,
        label: "Live output",
        detail: passed ? "Expected output is active" : "Expected output has not appeared yet",
      })
    }
  }

  const passed = results.length > 0 && results.every((item) => item.passed)
  const failed = results.filter((item) => !item.passed)
  return {
    passed,
    results,
    summary: passed
      ? step.success
      : failed[0]?.detail || "Complete the step and check again.",
  }
}

function findTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((template) => template.id === id)
}

const DHT11_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 120, rotation: 0, props: {} },
    { id: "dht", type: "dht11", x: 430, y: 110, rotation: 0, props: { temperature: 25, humidity: 55 } },
  ],
  wires: [
    { id: "dht-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "dht", pinId: "vcc" }, color: "#ef4444" },
    { id: "dht-gnd", from: { partId: "dht", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#64748b" },
    { id: "dht-data", from: { partId: "uno", pinId: "d4" }, to: { partId: "dht", pinId: "data" }, color: "#60a5fa" },
  ],
}

const DHT11_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="LOOP">
      <block type="serial_print"><value name="TEXT"><block type="text_string"><field name="TEXT">Temperature: </field></block></value><next>
      <block type="serial_println"><value name="TEXT"><block type="dht_temperature"></block></value><next>
      <block type="serial_print"><value name="TEXT"><block type="text_string"><field name="TEXT">Humidity: </field></block></value><next>
      <block type="serial_println"><value name="TEXT"><block type="dht_humidity"></block></value><next>
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block>
      </next></block></next></block></next></block>
    </statement>
  </block>
</xml>`

export const LESSONS: Lesson[] = [
  {
    id: "lesson-led-basics",
    title: "Mission 1 · Safe LED Blink",
    shortTitle: "Safe LED Blink",
    description: "Build a complete LED circuit, protect the LED with a resistor, then make Arduino blink it.",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    concepts: ["GPIO", "Current limiting", "Digital output"],
    prerequisites: [],
    templateId: "blink-led",
    steps: [
      {
        id: "parts",
        title: "Gather the parts",
        instructions: "You need one Arduino Uno, one LED and one resistor. Load the lesson starter or build this set yourself.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "led", count: 1 }, { type: "resistor", count: 1 }] }],
        success: "Core parts are on the bench.",
      },
      {
        id: "resistor",
        title: "Choose a safe resistor",
        instructions: "Set the LED's series resistor between 220Ω and 330Ω. Click the resistor and edit its value in the Inspector.",
        kind: "build",
        checks: [{ kind: "part-property", partType: "resistor", property: "resistance", min: 220, max: 330 }],
        success: "Good: the LED has a sensible current-limiting resistor.",
      },
      {
        id: "wiring",
        title: "Complete the circuit",
        instructions: "Wire D13 → resistor A, resistor B → LED anode, and LED cathode → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d13", partId: "uno" }, to: { partType: "resistor", pinId: "a", partId: "r1" } },
          { from: { partType: "resistor", pinId: "b", partId: "r1" }, to: { partType: "led", pinId: "anode", partId: "led1" } },
          { from: { partType: "led", pinId: "cathode", partId: "led1" }, to: { partType: "arduino-uno", pinId: "gnd", partId: "uno" } },
        ] }],
        success: "The LED loop is wired correctly.",
      },
      {
        id: "code",
        title: "Program the blink",
        instructions: "Use two digital-write blocks on pin 13: HIGH and LOW, with a delay between them.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "LOW" } },
          { type: "time_delay", count: 2 },
        ] }],
        success: "The Blockly program contains the blink sequence.",
      },
      {
        id: "run",
        title: "Run and observe",
        instructions: "Press Run. Wait for the LED state to change, then check this step while the simulation is running.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partId: "led1", field: "level", min: 0.05 }] }],
        success: "The LED is responding to the running program.",
      },
    ],
  },
  {
    id: "lesson-traffic-light",
    title: "Mission 2 · Traffic Light Logic",
    shortTitle: "Traffic Light",
    description: "Coordinate three LEDs with a timed sequence and learn how multiple GPIO outputs work together.",
    difficulty: "Beginner",
    estimatedMinutes: 15,
    concepts: ["Sequencing", "GPIO", "Timing"],
    prerequisites: ["lesson-led-basics"],
    templateId: "traffic-light",
    steps: [
      {
        id: "parts",
        title: "Build the signal set",
        instructions: "Use three LEDs, three resistors and one Arduino. Each LED needs its own resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 }, { type: "led", count: 3 }, { type: "resistor", count: 3 },
        ] }],
        success: "All three signal channels are ready.",
      },
      {
        id: "wiring",
        title: "Wire three channels",
        instructions: "Connect D12, D11 and D10 through their own resistors to the three LED anodes. Connect all cathodes to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d12", partId: "uno" }, to: { partType: "resistor", pinId: "a", partId: "r1" } },
          { from: { partType: "resistor", pinId: "b", partId: "r1" }, to: { partType: "led", pinId: "anode", partId: "red_led" } },
          { from: { partType: "led", pinId: "cathode", partId: "red_led" }, to: { partType: "arduino-uno", pinId: "gnd", partId: "uno" } },
          { from: { partType: "arduino-uno", pinId: "d11", partId: "uno" }, to: { partType: "resistor", pinId: "a", partId: "r2" } },
          { from: { partType: "resistor", pinId: "b", partId: "r2" }, to: { partType: "led", pinId: "anode", partId: "yellow_led" } },
          { from: { partType: "led", pinId: "cathode", partId: "yellow_led" }, to: { partType: "arduino-uno", pinId: "gnd", partId: "uno" } },
          { from: { partType: "arduino-uno", pinId: "d10", partId: "uno" }, to: { partType: "resistor", pinId: "a", partId: "r3" } },
          { from: { partType: "resistor", pinId: "b", partId: "r3" }, to: { partType: "led", pinId: "anode", partId: "green_led" } },
          { from: { partType: "led", pinId: "cathode", partId: "green_led" }, to: { partType: "arduino-uno", pinId: "gnd", partId: "uno" } },
        ] }],
        success: "All three control lines are connected.",
      },
      {
        id: "code",
        title: "Create the sequence",
        instructions: "Set up D12, D11 and D10 as digital outputs and use HIGH/LOW plus delays to cycle the lights.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_pinmode", count: 1, fields: { PIN: "12", MODE: "OUTPUT" } },
          { type: "io_pinmode", count: 1, fields: { PIN: "11", MODE: "OUTPUT" } },
          { type: "io_pinmode", count: 1, fields: { PIN: "10", MODE: "OUTPUT" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "12", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "12", STATE: "LOW" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "11", STATE: "LOW" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "11", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "10", STATE: "LOW" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "10", STATE: "HIGH" } },
          { type: "time_delay", count: 3 },
        ] }],
        success: "The traffic sequence is represented in Blockly.",
      },
      {
        id: "run",
        title: "Watch the intersection",
        instructions: "Run the simulation and check this step. One of the signal LEDs should be active as the sequence progresses.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime-any", requirements: [
          { partId: "red_led", field: "level", min: 0.05 },
          { partId: "yellow_led", field: "level", min: 0.05 },
          { partId: "green_led", field: "level", min: 0.05 },
        ] }],
        success: "The traffic-light program is driving the red channel.",
      },
    ],
  },
  {
    id: "lesson-servo",
    title: "Mission 3 · Servo Motion",
    shortTitle: "Servo Sweep",
    description: "Connect a servo and program three target angles to explore PWM-controlled motion.",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    concepts: ["Servo", "PWM", "Motion"],
    prerequisites: ["lesson-led-basics"],
    templateId: "servo-sweep",
    steps: [
      {
        id: "parts",
        title: "Connect the servo",
        instructions: "Use one Arduino and one servo. The servo needs power, ground and a signal connection.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "servo", count: 1 }] }],
        success: "The servo hardware is ready.",
      },
      {
        id: "wiring",
        title: "Wire power and signal",
        instructions: "Connect 5V → VCC, GND → GND and D9 → SIG.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "servo", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "servo", pinId: "sig" } },
        ] }],
        success: "Servo power and signal are connected.",
      },
      {
        id: "code",
        title: "Program three angles",
        instructions: "Add servo-write blocks for at least three target positions, including 0°, 90° and 180°.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "servo_write", count: 1, inputs: { ANGLE: 0 } },
          { type: "servo_write", count: 1, inputs: { ANGLE: 90 } },
          { type: "servo_write", count: 1, inputs: { ANGLE: 180 } },
        ] }],
        success: "The program has multiple servo targets.",
      },
      {
        id: "run",
        title: "Observe the motion",
        instructions: "Press Run and check this step while the servo is moving. Its virtual angle should be in the 0–180° range.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partId: "servo1", field: "angle", min: 0, max: 180 }] }],
        success: "The servo is responding to the control signal.",
      },
    ],
  },
  {
    id: "lesson-ultrasonic",
    title: "Mission 4 · Distance Alarm",
    shortTitle: "Ultrasonic Alarm",
    description: "Read distance from HC-SR04 and use a threshold to control a buzzer.",
    difficulty: "Advanced",
    estimatedMinutes: 18,
    concepts: ["Sensors", "Thresholds", "Digital output"],
    prerequisites: ["lesson-servo"],
    templateId: "ultrasonic-radar",
    steps: [
      {
        id: "parts",
        title: "Place the sensor and buzzer",
        instructions: "Use one Arduino, one ultrasonic sensor and one buzzer.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "ultrasonic", count: 1 }, { type: "buzzer", count: 1 }] }],
        success: "Distance sensor and alarm hardware are ready.",
      },
      {
        id: "wiring",
        title: "Wire the sensor",
        instructions: "Connect sensor VCC/GND and use D9 for TRIG and D10 for ECHO. Put the buzzer on D8 and GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "ultrasonic", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "ultrasonic", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "ultrasonic", pinId: "trig" } },
          { from: { partType: "arduino-uno", pinId: "d10" }, to: { partType: "ultrasonic", pinId: "echo" } },
          { from: { partType: "arduino-uno", pinId: "d8" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "buzzer", pinId: "neg" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "The sensor and alarm wiring is complete.",
      },
      {
        id: "code",
        title: "Add the distance threshold",
        instructions: "Read the ultrasonic sensor and use an IF block to make D8 HIGH below 30 cm, otherwise LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "ultrasonic_read", count: 2, fields: { TRIG: "9", ECHO: "10" } },
          { type: "controls_if", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "LOW" } },
        ] }],
        success: "The alarm logic is present.",
      },
      {
        id: "experiment",
        title: "Trigger the alarm",
        instructions: "Select the ultrasonic sensor and set Distance to 25 cm or less. Press Run, then check this step.",
        kind: "experiment",
        checks: [
          { kind: "part-property", partType: "ultrasonic", property: "distance", max: 25 },
          { kind: "running" },
          { kind: "runtime", requirements: [{ partId: "buzzer1", field: "level", min: 0.5 }] },
        ],
        success: "Threshold reached: the virtual alarm is sounding.",
      },
    ],
  },
  {
    id: "lesson-dht11",
    title: "Mission 5 · Weather Station",
    shortTitle: "DHT11 Weather Station",
    description: "Wire a DHT11 sensor and build a tiny serial weather monitor with live temperature and humidity values.",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    concepts: ["Sensors", "Temperature", "Humidity", "Serial output"],
    prerequisites: ["lesson-ultrasonic"],
    seedCircuit: DHT11_CIRCUIT,
    seedBlocklyXml: DHT11_XML,
    steps: [
      {
        id: "wiring",
        title: "Wire the DHT11",
        instructions: "Connect 5V → VCC, GND → GND, and D4 → DATA.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "dht11", count: 1 }] }, { kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "dht11", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "dht11", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d4" }, to: { partType: "dht11", pinId: "data" } },
        ] }],
        success: "The DHT11 sensor has power and a data line.",
      },
      {
        id: "code",
        title: "Read temperature and humidity",
        instructions: "Use one temperature-read block and one humidity-read block, then send the values to Serial.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "dht_temperature", count: 1 },
          { type: "dht_humidity", count: 1 },
          { type: "serial_print", count: 1 },
          { type: "serial_println", count: 1 },
        ] }],
        success: "The weather station has both sensor readings in code.",
      },
      {
        id: "experiment",
        title: "Read live sensor values",
        instructions: "Press Run and move the DHT11 Temperature/Humidity sliders in the Inspector. Check the step when live values appear.",
        kind: "experiment",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [
          { partId: "dht", field: "dhtTemperature", min: 0, max: 50 },
          { partId: "dht", field: "dhtHumidity", min: 0, max: 100 },
        ] }],
        success: "The DHT11 values are live in the virtual lab.",
      },
    ],
  },
]

export function getLessonSeed(lesson: Lesson): { state: CircuitState; blocklyXml: string; sourceTemplateId?: string } {
  if (lesson.seedCircuit && lesson.seedBlocklyXml) {
    return { state: JSON.parse(JSON.stringify(lesson.seedCircuit)), blocklyXml: lesson.seedBlocklyXml }
  }
  const template = lesson.templateId ? findTemplate(lesson.templateId) : undefined
  if (!template) throw new Error(`No starter project found for lesson: ${lesson.title}`)
  return {
    state: JSON.parse(JSON.stringify(template.circuit)),
    blocklyXml: template.blocklyXml,
    sourceTemplateId: template.id,
  }
}
