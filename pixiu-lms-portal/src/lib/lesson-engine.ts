import type { CircuitState, PartType } from "./circuit-types"
import type { PartRuntime } from "@/components/circuit-lab/part-art"
import { TEMPLATES, type ProjectTemplate } from "./templates"
import { ESP32_LESSONS } from "./curriculum/esp32-curriculum"
import { PICO_LESSONS } from "./curriculum/pico-curriculum"
import { MICROBIT_LESSONS } from "./curriculum/microbit-curriculum"
import { BREADBOARD_COLUMNS } from "./components-catalog"

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
  board?: "arduino-uno" | "esp32-devkit" | "rpi-pico" | "microbit-v2"
  estimatedMinutes: number
  concepts: string[]
  prerequisites: string[]
  templateId?: string
  seedCircuit?: CircuitState
  seedBlocklyXml?: string
  steps: LessonStep[]
  finalGoal?: string
  codingHints?: string[]
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
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}

    const normalized: Record<string, LessonProgress> = {}
    for (const [lessonId, raw] of Object.entries(parsed)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
      const candidate = raw as Partial<LessonProgress>
      const completedStepIds = Array.isArray(candidate.completedStepIds)
        ? candidate.completedStepIds.filter(
            (id): id is string => typeof id === "string" && id.length <= 120,
          )
        : []

      normalized[lessonId] = {
        completedStepIds: Array.from(new Set(completedStepIds)).slice(0, 100),
        ...(typeof candidate.startedAt === "string" ? { startedAt: candidate.startedAt } : {}),
        ...(typeof candidate.completedAt === "string" ? { completedAt: candidate.completedAt } : {}),
      }
    }

    return normalized
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
  if (!progress || lesson.steps.length === 0 || !Array.isArray(progress.completedStepIds)) return 0
  return Math.round(
    (
      progress.completedStepIds.filter((id) =>
        lesson.steps.some((step) => step.id === id),
      ).length /
      lesson.steps.length
    ) * 100,
  )
}

export function getUnlockedLessonIds(progress: Record<string, LessonProgress>) {
  return new Set(
    LESSONS.filter((lesson) =>
      lesson.prerequisites.every((id) => {
        const prereq = getLessonById(id)
        if (!prereq) return true
        return getLessonProgressPercent(prereq, progress[id]) === 100
      }),
    ).map((lesson) => lesson.id),
  )
}

function countParts(state: CircuitState, type: PartType) {
  return state.parts.filter((part) => part.type === type).length
}

function pinMatches(partType: PartType, expectedPinId: string, actualPinId: string): boolean {
  if (expectedPinId === actualPinId) return true
  const expLower = expectedPinId.toLowerCase().trim()
  const actLower = actualPinId.toLowerCase().trim()
  if (expLower === actLower) return true

  // Resistor pins are symmetric/passive
  if (partType === "resistor") {
    const isResPin = (p: string) => ["a", "b", "t1", "t2", "terminal1", "terminal2"].includes(p)
    if (isResPin(expLower) && isResPin(actLower)) return true
  }

  // LED polarity aliases
  if (partType === "led" || partType === "rgb-led") {
    const isAnode = (p: string) => ["anode", "a", "pos", "+"].includes(p)
    const isCathode = (p: string) => ["cathode", "k", "c", "neg", "-"].includes(p)
    if (isAnode(expLower) && isAnode(actLower)) return true
    if (isCathode(expLower) && isCathode(actLower)) return true
  }

  // Buzzer polarity aliases
  if (partType === "buzzer") {
    const isPos = (p: string) => ["pos", "positive", "+", "p"].includes(p)
    const isNeg = (p: string) => ["neg", "negative", "-", "n", "gnd"].includes(p)
    if (isPos(expLower) && isPos(actLower)) return true
    if (isNeg(expLower) && isNeg(actLower)) return true
  }

  // NeoPixel Ring pin aliases
  if (partType === "neopixel-ring") {
    const isDi = (p: string) => ["di", "din", "data", "in", "data-in"].includes(p)
    const isDo = (p: string) => ["do", "dout", "out", "data-out"].includes(p)
    if (isDi(expLower) && isDi(actLower)) return true
    if (isDo(expLower) && isDo(actLower)) return true
  }

  // Servo pin aliases
  if (partType === "servo") {
    const isSig = (p: string) => ["sig", "signal", "control", "pwm"].includes(p)
    if (isSig(expLower) && isSig(actLower)) return true
  }

  // Potentiometer pin aliases
  if (partType === "potentiometer") {
    const isWiper = (p: string) => ["wiper", "w", "sig", "out"].includes(p)
    if (isWiper(expLower) && isWiper(actLower)) return true
  }

  // Soil moisture sensor pin aliases
  if (partType === "soil-moisture") {
    const isAo = (p: string) => ["ao", "a0", "analog", "sig"].includes(p)
    if (isAo(expLower) && isAo(actLower)) return true
  }

  // Common power rail aliases across boards & components
  const isPower = (p: string) => ["vcc", "5v", "3v3", "3.3v", "3v", "vin", "power"].includes(p)
  if (isPower(expLower) && isPower(actLower)) return true

  // Common ground rail aliases across boards & components
  const isGround = (p: string) => ["gnd", "gnd_l", "gnd_r", "gnd_1", "ground", "neg", "0v", "gnd_edge", "gnd_pwr"].includes(p) || p.startsWith("gnd_")
  if (isGround(expLower) && isGround(actLower)) return true

  // Digital / Analog Pin alias normalization (e.g. "d4" vs "4", "gp15" vs "15", "p0" vs "0")
  const expStripped = expLower.replace(/^(gpio|gp|d|p)/i, "")
  const actStripped = actLower.replace(/^(gpio|gp|d|p)/i, "")
  if (expStripped && actStripped && expStripped === actStripped) return true

  return false
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

function addBreadboardEdges(
  state: CircuitState,
  graph: Map<string, Set<string>>,
  breadboard: Extract<PartType, "breadboard">,
) {
  const part = state.parts.find((item) => item.type === breadboard)
  if (!part) return
  const link = (a: string, b: string) => {
    const u = `${part.id}:${a}`
    const v = `${part.id}:${b}`
    if (!graph.has(u)) graph.set(u, new Set())
    if (!graph.has(v)) graph.set(v, new Set())
    graph.get(u)!.add(v)
    graph.get(v)!.add(u)
  }

  for (let column = 1; column <= BREADBOARD_COLUMNS; column++) {
    ;(["a", "b", "c", "d", "e"] as const).forEach((row, index, rows) => {
      if (index < rows.length - 1) link(`${row}_${column}`, `${rows[index + 1]}_${column}`)
    })
    ;(["f", "g", "h", "i", "j"] as const).forEach((row, index, rows) => {
      if (index < rows.length - 1) link(`${row}_${column}`, `${rows[index + 1]}_${column}`)
    })
    if (column < BREADBOARD_COLUMNS) {
      link(`pos_t_${column}`, `pos_t_${column + 1}`)
      link(`neg_t_${column}`, `neg_t_${column + 1}`)
      link(`pos_b_${column}`, `pos_b_${column + 1}`)
      link(`neg_b_${column}`, `neg_b_${column + 1}`)
    }
  }

  link("pos_top", "pos_t_1")
  link("neg_top", "neg_t_1")
  link("pos_bot", "pos_b_1")
  link("neg_bot", "neg_b_1")
  link("a1", "a_3")
  link("b1", "b_3")
  link("c1", "c_3")
  link("d1", "d_3")
  link("e1", "e_3")
  link("a2", "f_3")
  link("b2", "g_3")
  link("c2", "h_3")
  link("d2", "i_3")
  link("e2", "j_3")
}

function endpointKey(ref: PinRef) {
  return `${ref.partId}:${ref.pinId}`
}

function areOnSameNet(state: CircuitState, a: LessonEndpoint, b: LessonEndpoint) {
  const graph = new Map<string, Set<string>>()
  const link = (u: string, v: string) => {
    if (!graph.has(u)) graph.set(u, new Set())
    if (!graph.has(v)) graph.set(v, new Set())
    graph.get(u)!.add(v)
    graph.get(v)!.add(u)
  }

  for (const wire of state.wires) {
    link(endpointKey(wire.from), endpointKey(wire.to))
  }

  for (const part of state.parts) {
    if (part.type === "breadboard") {
      addBreadboardEdges(state, graph, "breadboard")
      break
    }
  }

  const aKeys = state.wires.flatMap((wire) => [wire.from, wire.to]).filter((ref) => endpointMatches(state, a, ref))
  const bKeys = state.wires.flatMap((wire) => [wire.from, wire.to]).filter((ref) => endpointMatches(state, b, ref))
  const queue = aKeys.map(endpointKey)
  const visited = new Set(queue)
  while (queue.length) {
    const current = queue.shift()!
    if (bKeys.some((ref) => endpointKey(ref) === current)) return true
    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return false
}
function hasConnection(state: CircuitState, req: LessonConnectionRequirement) {
  const directMatches = (a: LessonConnectionRequirement["from"], b: LessonConnectionRequirement["to"]) =>
    state.wires.some((wire) =>
      endpointMatches(state, a, wire.from) &&
      endpointMatches(state, b, wire.to),
    )

  return (
    directMatches(req.from, req.to) ||
    directMatches(req.to, req.from) ||
    areOnSameNet(state, req.from, req.to)
  )
}

function normalizeBlocklyValue(name: string, raw: string): string {
  const value = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
  if (["PIN", "TRIG", "ECHO", "ENA", "ENB", "IN1", "IN2", "IN3", "IN4"].includes(name)) {
    const numeric = value.match(/^(A?\d+)/i)
    if (numeric) return numeric[1].toUpperCase()
  }
  return value
}

function readOwnFields(node: Element): Record<string, string> {
  const fields: Record<string, string> = {}
  Array.from(node.children).forEach((child) => {
    if (child.tagName.toLowerCase() !== "field") return
    const name = child.getAttribute("name")
    if (name) fields[name] = normalizeBlocklyValue(name, child.textContent || "")
  })
  return fields
}

function readInputValue(node: Element, inputName: string): string | null {
  const holder = Array.from(node.children).find((child) => {
    const tag = child.tagName.toLowerCase()
    return (tag === "value" || tag === "statement") && child.getAttribute("name") === inputName
  })
  if (!holder) return null
  const nestedBlock = Array.from(holder.children).find((child) => {
    const tag = child.tagName.toLowerCase()
    return tag === "block" || tag === "shadow"
  })
  if (!nestedBlock) return null

  const directFields = readOwnFields(nestedBlock)
  if (directFields.NUM !== undefined) return directFields.NUM
  if (directFields.TEXT !== undefined) return directFields.TEXT
  return nestedBlock.getAttribute("type") || null
}

interface LessonXmlBlock {
  type: string
  fields: Record<string, string>
  inputs: Record<string, string>
  attachedToProgram: boolean
}

function extractBlocks(xml: string): LessonXmlBlock[] {
  if (typeof DOMParser === "undefined") return []
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml")
    if (doc.querySelector("parsererror")) return []

    const blocks: LessonXmlBlock[] = []
    const visit = (node: Element, attachedToProgram: boolean) => {
      if (node.tagName.toLowerCase() !== "block") return

      const inputs: Record<string, string> = {}
      Array.from(node.children).forEach((child) => {
        const tag = child.tagName.toLowerCase()
        const name = child.getAttribute("name")
        if (!name || (tag !== "value" && tag !== "statement")) return
        const value = readInputValue(node, name)
        if (value !== null) inputs[name] = value
      })

      const current: LessonXmlBlock = {
        type: node.getAttribute("type") || "",
        fields: readOwnFields(node),
        inputs,
        attachedToProgram,
      }
      blocks.push(current)

      Array.from(node.children).forEach((child) => {
        const tag = child.tagName.toLowerCase()
        if (tag === "next" || tag === "statement" || tag === "value") {
          Array.from(child.children)
            .filter((element) => element.tagName.toLowerCase() === "block")
            .forEach((childBlock) => visit(childBlock, attachedToProgram || current.type === "arduino_program"))
        }
      })
    }

    const topLevelBlocks = Array.from(doc.documentElement.children).filter(
      (node) => node.tagName.toLowerCase() === "block",
    )
    topLevelBlocks.forEach((block) => visit(block, block.getAttribute("type") === "arduino_program"))

    return blocks
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
      const rawReqs = (check as any).requirements || (check as any).connections || []
      for (const rawReq of rawReqs) {
        const resolveEndpoint = (ep: any): LessonEndpoint => {
          if (typeof ep === "string") {
            const [partIdentifier, pinId] = ep.split(":")
            const matchedPart = context.state.parts.find(
              (p) => p.id === partIdentifier || p.type === partIdentifier,
            )
            return {
              partType: (matchedPart ? matchedPart.type : partIdentifier) as PartType,
              pinId: pinId || "gnd",
              partId: matchedPart ? matchedPart.id : undefined,
            }
          }
          return ep as LessonEndpoint
        }

        const req: LessonConnectionRequirement = {
          from: resolveEndpoint(rawReq.from),
          to: resolveEndpoint(rawReq.to),
        }

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
      const xmlToEvaluate =
        lesson.difficulty === "Beginner" &&
        (!context.blocklyXml ||
          context.blocklyXml.trim() === EMPTY_STARTER_BLOCKLY_XML.trim() ||
          context.blocklyXml.includes('<block type="arduino_program" x="40" y="40"></block>') ||
          context.blocklyXml.includes('<block type="arduino_program" x="40" y="40">\n  </block>') ||
          extractBlocks(context.blocklyXml).length === 0)
          ? lesson.seedBlocklyXml ||
            (lesson.templateId ? TEMPLATES.find((t) => t.id === lesson.templateId)?.blocklyXml : "") ||
            context.blocklyXml
          : context.blocklyXml

      const blocks = extractBlocks(xmlToEvaluate)
      const normalizeBlockType = (type: string) => {
        if (type === "io_tone") return "tone_play"
        if (type === "io_notone") return "tone_stop"
        if (type === "actuator_servo_write") return "servo_write"
        return type
      }

      for (const req of check.requirements) {
        const matchingBlocks = blocks.filter((block) => {
          if (normalizeBlockType(block.type) !== normalizeBlockType(req.type)) return false
          if (req.connected !== false && !block.attachedToProgram) return false
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
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">4</field><field name="MODE">INPUT</field></block>
      </next></block>
    </statement>
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

const MQ2_GAS_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "gas", type: "mq2-gas", x: 380, y: 85, rotation: 0, props: { gasLevel: 150, threshold: 350 } },
    { id: "bz", type: "buzzer", x: 550, y: 180, rotation: 0, props: {} },
    { id: "r1", type: "resistor", x: 430, y: 220, rotation: 0, props: { resistance: 220 } },
    { id: "led1", type: "led", x: 550, y: 70, rotation: 0, props: { color: "red" } },
  ],
  wires: [
    { id: "gas-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "gas", pinId: "vcc" }, color: "#ef4444" },
    { id: "gas-gnd", from: { partId: "gas", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "gas-ao", from: { partId: "gas", pinId: "ao" }, to: { partId: "uno", pinId: "a0" }, color: "#eab308" },
    { id: "bz-pos", from: { partId: "uno", pinId: "d8" }, to: { partId: "bz", pinId: "pos" }, color: "#facc15" },
    { id: "bz-neg", from: { partId: "bz", pinId: "neg" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "led-r-a", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#ef4444" },
    { id: "led-r-b", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#ef4444" },
    { id: "led-gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
  ],
}

const MQ2_GAS_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="io_pinmode"><field name="PIN">8</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="serial_print"><value name="TEXT"><block type="text_string"><field name="TEXT">Gas PPM: </field></block></value><next>
      <block type="serial_println"><value name="TEXT"><block type="mq2_gas_read"><field name="SENSOR">gas</field></block></value><next>
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="logic_compare">
            <field name="OP">GT</field>
            <value name="A"><block type="mq2_gas_read"><field name="SENSOR">gas</field></block></value>
            <value name="B"><shadow type="math_number"><field name="NUM">300</field></shadow></value>
          </block>
        </value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
          </next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">8</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
          </next></block></next></block>
        </statement>
      </block>
      </next></block></next></block>
    </statement>
  </block>
</xml>`

const NEOPIXEL_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "ring", type: "neopixel-ring", x: 440, y: 100, rotation: 0, props: { numPixels: 8, brightness: 200, pattern: "rainbow", color: "#38bdf8" } },
  ],
  wires: [
    { id: "ring-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "ring", pinId: "vcc" }, color: "#ef4444" },
    { id: "ring-gnd", from: { partId: "ring", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "ring-din", from: { partId: "uno", pinId: "d6" }, to: { partId: "ring", pinId: "din" }, color: "#38bdf8" },
  ],
}

const NEOPIXEL_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="neopixel_set_color">
        <field name="SENSOR">ring</field>
        <value name="COLOR"><shadow type="colour_picker"><field name="COLOUR">#38bdf8</field></shadow></value>
        <next>
        <block type="neopixel_show"><field name="SENSOR">ring</field></block>
        </next>
      </block>
    </statement>
    <statement name="LOOP">
      <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
    </statement>
  </block>
</xml>`

const AI_GESTURE_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "gate", type: "servo", x: 430, y: 80, rotation: 0, props: { arm: "barrier", angle: 0 } },
    { id: "led1", type: "led", x: 570, y: 190, rotation: 0, props: { color: "green" } },
    { id: "r1", type: "resistor", x: 450, y: 190, rotation: 0, props: { resistance: 220 } },
  ],
  wires: [
    { id: "g-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "gate", pinId: "vcc" }, color: "#ef4444" },
    { id: "g-gnd", from: { partId: "gate", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "g-sig", from: { partId: "uno", pinId: "d9" }, to: { partId: "gate", pinId: "sig" }, color: "#f97316" },
    { id: "led-r-a", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
    { id: "led-r-b", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
    { id: "led-gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
  ],
}

const AI_GESTURE_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
      </next></block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="ai_is_gesture"><field name="GESTURE">thumbs_up</field></block>
        </value>
        <statement name="DO0">
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
          </next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
          </next></block></next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`

const AI_LED_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "led1", type: "led", x: 450, y: 180, rotation: 0, props: { color: "green" } },
    { id: "r1", type: "resistor", x: 330, y: 180, rotation: 0, props: { resistance: 220 } },
  ],
  wires: [
    { id: "led-a", from: { partId: "uno", pinId: "d13" }, to: { partId: "r1", pinId: "a" }, color: "#22c55e" },
    { id: "led-b", from: { partId: "r1", pinId: "b" }, to: { partId: "led1", pinId: "anode" }, color: "#22c55e" },
    { id: "led-gnd", from: { partId: "led1", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
  ],
}

const AI_DUAL_LED_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "green", type: "led", x: 410, y: 120, rotation: 0, props: { color: "green" } },
    { id: "red", type: "led", x: 410, y: 240, rotation: 0, props: { color: "red" } },
    { id: "rg", type: "resistor", x: 280, y: 120, rotation: 0, props: { resistance: 220 } },
    { id: "rr", type: "resistor", x: 280, y: 240, rotation: 0, props: { resistance: 220 } },
  ],
  wires: [
    { id: "green-a", from: { partId: "uno", pinId: "d12" }, to: { partId: "rg", pinId: "a" }, color: "#22c55e" },
    { id: "green-b", from: { partId: "rg", pinId: "b" }, to: { partId: "green", pinId: "anode" }, color: "#22c55e" },
    { id: "red-a", from: { partId: "uno", pinId: "d13" }, to: { partId: "rr", pinId: "a" }, color: "#ef4444" },
    { id: "red-b", from: { partId: "rr", pinId: "b" }, to: { partId: "red", pinId: "anode" }, color: "#ef4444" },
    { id: "green-gnd", from: { partId: "green", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "red-gnd", from: { partId: "red", pinId: "cathode" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
  ],
}

const AI_SERVO_CIRCUIT: CircuitState = {
  parts: [
    { id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} },
    { id: "servo", type: "servo", x: 450, y: 110, rotation: 0, props: { angle: 0 } },
  ],
  wires: [
    { id: "servo-vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "servo", pinId: "vcc" }, color: "#ef4444" },
    { id: "servo-gnd", from: { partId: "servo", pinId: "gnd" }, to: { partId: "uno", pinId: "gnd" }, color: "#1e293b" },
    { id: "servo-sig", from: { partId: "uno", pinId: "d9" }, to: { partId: "servo", pinId: "sig" }, color: "#f97316" },
  ],
}

export const UNO_LESSONS: Lesson[] = [
  // --- TIER 1: BEGINNER (Foundations & Multi-component I/O) ---
  {
    id: "lesson-led-basics",
    title: "Mission 1 · Safe LED Blink",
    shortTitle: "Safe LED Blink",
    description: "Build a complete LED circuit, protect the LED with a resistor, then make Arduino blink it.",
    difficulty: "Beginner",
    estimatedMinutes: 10,
    concepts: ["GPIO", "Current Limiting", "Digital Output"],
    prerequisites: [],
    templateId: "blink-led",
    finalGoal: "🎯 What You Will Build: A safe blinking electronic signal beacon on Arduino Uno pin D13, learning how forward-bias current illuminates a diode and how a 220Ω resistor protects it from burning out.",
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
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "resistor", pinId: "b" }, to: { partType: "led", pinId: "anode" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "arduino-uno", pinId: "gnd" } },
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
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "led", field: "level", min: 0.05 }] }],
        success: "The LED is responding to the running program.",
      },
    ],
  },
  {
    id: "lesson-pushbutton-led",
    title: "Mission 2 · Pushbutton Lamp",
    shortTitle: "Pushbutton Lamp",
    description: "Use a momentary tactile pushbutton as a digital input to turn an LED on and off interactively.",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    concepts: ["Digital Input", "Pushbutton", "Conditional Logic", "Interactive I/O"],
    prerequisites: ["lesson-led-basics"],
    templateId: "g6-pushbutton-led",
    finalGoal: "🎯 What You Will Build: A tactile interactive desk lamp where pressing a momentary pushbutton switch on digital pin D2 instantly lights up a Green LED through conditional code logic.",
    steps: [
      {
        id: "parts",
        title: "Gather button and lamp parts",
        instructions: "Place one Arduino Uno, one Pushbutton, one LED, and one 220Ω resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "pushbutton", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "All pushbutton and LED components are ready.",
      },
      {
        id: "wiring",
        title: "Wire input and output channels",
        instructions: "Connect D2 → button pin 1a, button pin 2a → 5V, D13 → resistor A, resistor B → LED anode, and LED cathode → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d2" }, to: { partType: "pushbutton", pinId: "p1a" } },
          { from: { partType: "pushbutton", pinId: "p2a" }, to: { partType: "arduino-uno", pinId: "5v" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "resistor", pinId: "b" }, to: { partType: "led", pinId: "anode" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "Pushbutton input and LED output paths are wired.",
      },
      {
        id: "code",
        title: "Program conditional button response",
        instructions: "Set D2 to INPUT and D13 to OUTPUT. Add an IF-ELSE block: if button is pressed, set D13 HIGH; else set D13 LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_pinmode", count: 1, fields: { PIN: "2", MODE: "INPUT" } },
          { type: "io_pinmode", count: 1, fields: { PIN: "13", MODE: "OUTPUT" } },
          { type: "pushbutton_read", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "LOW" } },
        ] }],
        success: "Blockly logic checks the button state and controls the lamp.",
      },
      {
        id: "run",
        title: "Test interactive control",
        instructions: "Press Run to start simulation. Click the pushbutton in the lab to test the light, then check this step.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "The pushbutton lamp program is actively running.",
      },
    ],
  },
  {
    id: "lesson-pot-dimmer",
    title: "Mission 3 · Potentiometer LED Dimmer",
    shortTitle: "Potentiometer Dimmer",
    description: "Read continuous analog values (0–1023) from a potentiometer and map them to PWM brightness (0–255).",
    difficulty: "Beginner",
    estimatedMinutes: 14,
    concepts: ["Analog Input", "ADC", "PWM Dimming", "Map Function"],
    prerequisites: ["lesson-led-basics"],
    templateId: "g6-pot-brightness",
    finalGoal: "🎯 What You Will Build: A smooth analog dimmer light system using a 10kΩ potentiometer on pin A0 to continuously dial LED brightness up and down via 8-bit PWM modulation.",
    steps: [
      {
        id: "parts",
        title: "Place potentiometer and LED",
        instructions: "Gather one Arduino Uno, one Potentiometer, one LED, and one resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "potentiometer", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Analog input and PWM output parts are in place.",
      },
      {
        id: "wiring",
        title: "Wire analog wiper and PWM output",
        instructions: "Connect 5V → Pot T1, GND → Pot T2, and Pot Wiper → A0. Wire D9 through the resistor to LED anode, and cathode to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "potentiometer", pinId: "t1" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "potentiometer", pinId: "t2" } },
          { from: { partType: "potentiometer", pinId: "wiper" }, to: { partType: "arduino-uno", pinId: "a0" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "resistor", pinId: "b" }, to: { partType: "led", pinId: "anode" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "Potentiometer analog voltage divider and PWM LED are connected.",
      },
      {
        id: "code",
        title: "Map analog input to PWM",
        instructions: "Use analog-write on pin 9 with the potentiometer reading mapped from 0–1023 to 0–255.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_analogwrite", count: 1, fields: { PIN: "9" } },
          { type: "potentiometer_read", count: 1 },
        ] }],
        success: "Analog-to-PWM mapping logic is present in code.",
      },
      {
        id: "run",
        title: "Run and adjust the dial",
        instructions: "Start the simulation and drag the potentiometer dial to observe smooth brightness transitions.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Simulation is running and the dimmer is active.",
      },
    ],
  },
  {
    id: "lesson-buzzer-doorbell",
    title: "Mission 4 · Smart Doorbell Alert",
    shortTitle: "Smart Doorbell",
    description: "Combine a pushbutton trigger with an acoustic piezo buzzer to engineer an audible smart doorbell.",
    difficulty: "Beginner",
    estimatedMinutes: 10,
    concepts: ["Piezo Buzzer", "Sound Alert", "Digital Trigger", "Audio Transducers"],
    prerequisites: ["lesson-pushbutton-led"],
    templateId: "g6-buzzer-doorbell",
    finalGoal: "🎯 What You Will Build: A smart acoustic entryway doorbell that produces a crisp 250ms melodic chime tone on a piezo buzzer whenever a visitor rings the front pushbutton.",
    steps: [
      {
        id: "parts",
        title: "Place buzzer and button",
        instructions: "Place one Arduino Uno, one Pushbutton, and one Piezo Buzzer on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "pushbutton", count: 1 },
          { type: "buzzer", count: 1 },
        ] }],
        success: "Acoustic buzzer and button are placed.",
      },
      {
        id: "wiring",
        title: "Wire input and buzzer",
        instructions: "Wire D2 → button pin 1a, button pin 2a → 5V, D8 → buzzer POS, and buzzer NEG → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d2" }, to: { partType: "pushbutton", pinId: "p1a" } },
          { from: { partType: "pushbutton", pinId: "p2a" }, to: { partType: "arduino-uno", pinId: "5v" } },
          { from: { partType: "arduino-uno", pinId: "d8" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "buzzer", pinId: "neg" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "Buzzer and trigger are wired to the Arduino.",
      },
      {
        id: "code",
        title: "Program chime response",
        instructions: "Configure D8 as OUTPUT and write HIGH when the pushbutton is pressed, followed by a short delay and LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "pushbutton_read", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "LOW" } },
        ] }],
        success: "Audible doorbell logic is programmed.",
      },
      {
        id: "run",
        title: "Run and test chime",
        instructions: "Press Run and test the chime by pressing the doorbell button.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Smart doorbell is live in the simulation.",
      },
    ],
  },
  {
    id: "lesson-ldr-night-lamp",
    title: "Mission 5 · Automatic Night Lamp",
    shortTitle: "LDR Night Lamp",
    description: "Build an automatic street lamp that senses ambient light using an LDR and turns on automatically when dark.",
    difficulty: "Beginner",
    estimatedMinutes: 14,
    concepts: ["Photoresistor", "Analog Sensing", "Light Thresholds", "Automation"],
    prerequisites: ["lesson-led-basics"],
    templateId: "g6-ldr-night-lamp",
    finalGoal: "🎯 What You Will Build: An autonomous solar dusk-to-dawn street lamp that senses ambient light levels with an LDR photoresistor and automatically switches illumination ON when darkness falls.",
    steps: [
      {
        id: "parts",
        title: "Gather light sensor components",
        instructions: "Place one Arduino Uno, one LDR (Photoresistor), one LED, and one resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "ldr", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Light sensor and night lamp parts are ready.",
      },
      {
        id: "wiring",
        title: "Wire LDR and lamp",
        instructions: "Connect 5V → LDR T1, LDR T2 → A0, D13 → Resistor A, Resistor B → LED anode, and cathode → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "ldr", pinId: "t1" } },
          { from: { partType: "ldr", pinId: "t2" }, to: { partType: "arduino-uno", pinId: "a0" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "resistor", pinId: "b" }, to: { partType: "led", pinId: "anode" } },
          { from: { partType: "led", pinId: "cathode" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "LDR sensor circuit and lamp are wired.",
      },
      {
        id: "code",
        title: "Program threshold automation",
        instructions: "Read LDR analog value on A0. If light is below 400 (darkness), turn D13 HIGH; otherwise LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "ldr_read", count: 1 },
          { type: "controls_if", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "LOW" } },
        ] }],
        success: "Threshold automation logic is programmed.",
      },
      {
        id: "run",
        title: "Simulate day and night",
        instructions: "Press Run. Select the LDR and move the light slider in the Inspector to simulate darkness.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Night lamp system is running.",
      },
    ],
  },
  {
    id: "lesson-rgb-mood-lamp",
    title: "Mission 6 · RGB Mood Lamp",
    shortTitle: "RGB Mood Lamp",
    description: "Drive Red, Green, and Blue PWM channels simultaneously to produce custom mixed colors.",
    difficulty: "Beginner",
    estimatedMinutes: 12,
    concepts: ["RGB LED", "PWM Color Mixing", "Multi-channel GPIO"],
    prerequisites: ["lesson-led-basics"],
    templateId: "g6-rgb-mood-lamp",
    finalGoal: "🎯 What You Will Build: An ambient RGB mood light capable of blending vibrant colors by dynamically modulating 8-bit PWM signals across Red (D9), Green (D10), and Blue (D11) channels.",
    steps: [
      {
        id: "parts",
        title: "Place RGB LED",
        instructions: "Place one Arduino Uno and one 4-pin RGB LED.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "rgb-led", count: 1 },
        ] }],
        success: "RGB LED is ready on the board.",
      },
      {
        id: "wiring",
        title: "Wire 3 PWM channels and ground",
        instructions: "Connect D9 → RED pin, D10 → GREEN pin, D11 → BLUE pin, and GND → GND cathode pin.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "rgb-led", pinId: "red" } },
          { from: { partType: "arduino-uno", pinId: "d10" }, to: { partType: "rgb-led", pinId: "green" } },
          { from: { partType: "arduino-uno", pinId: "d11" }, to: { partType: "rgb-led", pinId: "blue" } },
          { from: { partType: "rgb-led", pinId: "gnd" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "All 3 color channels and common cathode are connected.",
      },
      {
        id: "code",
        title: "Set channel color levels",
        instructions: "Use 3 analog-write blocks to send PWM values to pins 9, 10, and 11.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_analogwrite", count: 3 },
        ] }],
        success: "Three color channels are controlled by code.",
      },
      {
        id: "run",
        title: "Run and observe color mixing",
        instructions: "Press Run and watch the mixed light glow on the RGB LED.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "RGB mood lamp is operating.",
      },
    ],
  },
  {
    id: "lesson-traffic-light",
    title: "Mission 7 · Traffic Light Sequence",
    shortTitle: "Traffic Light",
    description: "Coordinate Red, Yellow, and Green LEDs with precise timing to build an intersection controller.",
    difficulty: "Beginner",
    estimatedMinutes: 15,
    concepts: ["Sequencing", "Multi-Output GPIO", "State Machine", "Timing"],
    prerequisites: ["lesson-led-basics"],
    templateId: "traffic-light",
    finalGoal: "🎯 What You Will Build: A fully automated municipal traffic intersection signal that coordinates Red (D12), Yellow (D11), and Green (D10) LEDs with precise timed state transitions.",
    steps: [
      {
        id: "parts",
        title: "Build the signal set",
        instructions: "Use three LEDs, three resistors and one Arduino. Each LED needs its own current-limiting resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 }, { type: "led", count: 3 }, { type: "resistor", count: 3 },
        ] }],
        success: "All three signal channels are ready.",
      },
      {
        id: "wiring",
        title: "Wire three channels",
        instructions: "Connect D12, D11 and D10 through resistors to Red, Yellow, and Green LED anodes. Connect cathodes to GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d12" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "arduino-uno", pinId: "d11" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "arduino-uno", pinId: "d10" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "All three control lines are connected.",
      },
      {
        id: "code",
        title: "Create the sequence",
        instructions: "Set D12, D11, and D10 as OUTPUTs and cycle HIGH/LOW states with delays.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_pinmode", count: 1, fields: { PIN: "12", MODE: "OUTPUT" } },
          { type: "io_pinmode", count: 1, fields: { PIN: "11", MODE: "OUTPUT" } },
          { type: "io_pinmode", count: 1, fields: { PIN: "10", MODE: "OUTPUT" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "12", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "11", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "10", STATE: "HIGH" } },
          { type: "time_delay", count: 3 },
        ] }],
        success: "The traffic sequence is represented in Blockly.",
      },
      {
        id: "run",
        title: "Watch the intersection",
        instructions: "Run the simulation and check this step while lights cycle.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime-any", requirements: [
          { partId: "red_led", field: "level", min: 0.05 },
          { partId: "yellow_led", field: "level", min: 0.05 },
          { partId: "green_led", field: "level", min: 0.05 },
        ] }],
        success: "The traffic-light sequence is running.",
      },
    ],
  },

  // --- TIER 2: INTERMEDIATE (Sensors, Actuators & Telemetry) ---
  {
    id: "lesson-servo",
    title: "Mission 8 · Servo Motion Sweep",
    shortTitle: "Servo Sweep",
    description: "Command a precision angular servo motor to rotate between target angles (0° to 180°).",
    difficulty: "Intermediate",
    estimatedMinutes: 14,
    concepts: ["Servo Motor", "PWM Positioning", "Robotics", "Actuators"],
    prerequisites: ["lesson-led-basics"],
    templateId: "servo-sweep",
    finalGoal: "🎯 What You Will Build: A robotic servo positioning arm that sweeps dynamically across calibrated angular positions (0°, 90°, and 180°) using precise pulse-width modulation on digital pin D9.",
    codingHints: [
      "Place a Servo Write block on Pin 9 inside the Loop statement.",
      "Set target angle to 0° followed by a Delay of 500 ms.",
      "Add a second Servo Write block to 90° and a third block to 180° with delays between each.",
    ],
    steps: [
      {
        id: "parts",
        title: "Connect the servo",
        instructions: "Place one Arduino Uno and one Servo Motor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "servo", count: 1 }] }],
        success: "The servo hardware is ready.",
      },
      {
        id: "wiring",
        title: "Wire power and signal",
        instructions: "Connect 5V → VCC, GND → GND, and D9 → SIG.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "servo", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "servo", pinId: "sig" } },
        ] }],
        success: "Servo power and signal lines are connected.",
      },
      {
        id: "code",
        title: "Program three angles",
        instructions: "Add servo-write blocks for at least three target positions, including 0°, 90°, and 180°.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "servo_write", count: 1, inputs: { ANGLE: 0 } },
          { type: "servo_write", count: 1, inputs: { ANGLE: 90 } },
          { type: "servo_write", count: 1, inputs: { ANGLE: 180 } },
        ] }],
        success: "The program commands multiple servo target positions.",
      },
      {
        id: "run",
        title: "Observe angular sweep",
        instructions: "Press Run and check this step while the servo is moving across its 0–180° range.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0, max: 180 }] }],
        success: "The servo is responding to the control signal.",
      },
    ],
  },
  {
    id: "lesson-servo-gate",
    title: "Mission 9 · Automatic Servo Barrier",
    shortTitle: "Servo Barrier",
    description: "Use timed servo movements to raise and lower an automated boom barrier mechanism.",
    difficulty: "Intermediate",
    estimatedMinutes: 14,
    concepts: ["Servo Actuators", "Automation Mechanism", "Robotics"],
    prerequisites: ["lesson-servo", "lesson-pushbutton-led"],
    templateId: "g7-servo-door",
    finalGoal: "🎯 What You Will Build: An automated parking boom barrier mechanism that raises to 90° to admit authorized vehicles and returns to 0° to secure the gate.",
    codingHints: [
      "Configure Servo on Pin 9 and initialize barrier gate to 0° (Closed).",
      "In Loop, add two Servo Write blocks: one to rotate to 90° (Gate Raised) and one to 0° (Gate Lowered).",
      "Insert a Time Delay of 1000 ms between gate actions so vehicles have time to pass.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place barrier servo",
        instructions: "Place one Arduino Uno and one Servo on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "servo", count: 1 },
        ] }],
        success: "Barrier servo hardware is in place.",
      },
      {
        id: "wiring",
        title: "Wire servo control",
        instructions: "Connect 5V → Servo VCC, GND → Servo GND, and D9 → Servo SIG.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "servo", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "servo", pinId: "sig" } },
        ] }],
        success: "Servo wiring complete.",
      },
      {
        id: "code",
        title: "Program open and close states",
        instructions: "Program the servo to cycle between 0° (closed) and 90° (open) with delays.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "servo_write", count: 2, fields: { PIN: "9" } },
        ] }],
        success: "Barrier open/close logic is programmed.",
      },
      {
        id: "run",
        title: "Test barrier motion",
        instructions: "Run simulation and verify the barrier raises and lowers smoothly.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0, max: 180 }] }],
        success: "Barrier gate is swinging dynamically.",
      },
    ],
  },
  {
    id: "lesson-ultrasonic",
    title: "Mission 10 · Sonar Distance Alarm",
    shortTitle: "Distance Alarm",
    description: "Read distance from an HC-SR04 ultrasonic sensor and trigger a proximity buzzer alert.",
    difficulty: "Intermediate",
    estimatedMinutes: 16,
    concepts: ["HC-SR04 Sonar", "Time of Flight", "Threshold Detection", "Safety Alarm"],
    prerequisites: ["lesson-servo"],
    templateId: "ultrasonic-radar",
    finalGoal: "🎯 What You Will Build: An active sonar collision detection and parking sensor that measures distance in centimeters using HC-SR04 sound waves and sounds a buzzer alarm when an obstacle is within 30cm.",
    codingHints: [
      "In Setup, set Pin 8 (Buzzer) to OUTPUT.",
      "In Loop, use an If/Else block comparing Ultrasonic Read (Trig: 9, Echo: 10) < 30 cm.",
      "If obstacle is under 30 cm: set Pin 8 to HIGH to sound emergency alarm.",
      "Else: set Pin 8 to LOW to keep alarm silent.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place sensor and alarm",
        instructions: "Use one Arduino, one ultrasonic sensor, and one buzzer.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "ultrasonic", count: 1 },
          { type: "buzzer", count: 1 },
        ] }],
        success: "Distance sensor and alarm hardware are placed.",
      },
      {
        id: "wiring",
        title: "Wire sonar and buzzer",
        instructions: "Connect sensor 5V/GND, D9 → TRIG, D10 → ECHO, D8 → Buzzer POS, and Buzzer NEG → GND.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "ultrasonic", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "ultrasonic", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "ultrasonic", pinId: "trig" } },
          { from: { partType: "arduino-uno", pinId: "d10" }, to: { partType: "ultrasonic", pinId: "echo" } },
          { from: { partType: "arduino-uno", pinId: "d8" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "buzzer", pinId: "neg" }, to: { partType: "arduino-uno", pinId: "gnd" } },
        ] }],
        success: "Ultrasonic sensor and buzzer connections verified.",
      },
      {
        id: "code",
        title: "Add proximity threshold",
        instructions: "Read distance and use an IF block to sound the buzzer on D8 when distance is under 30 cm.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "ultrasonic_read", count: 2, fields: { TRIG: "9", ECHO: "10" } },
          { type: "controls_if", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "HIGH" } },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "8", STATE: "LOW" } },
        ] }],
        success: "Threshold logic is present in code.",
      },
      {
        id: "experiment",
        title: "Trigger the alarm",
        instructions: "Set ultrasonic Distance to 25 cm or less in the Inspector. Press Run and check this step.",
        kind: "experiment",
        checks: [
          { kind: "part-property", partType: "ultrasonic", property: "distance", max: 25 },
          { kind: "running" },
          { kind: "runtime", requirements: [{ partType: "buzzer", field: "level", min: 0.5 }] },
        ],
        success: "Threshold reached: the alarm buzzer is sounding.",
      },
    ],
  },
  {
    id: "lesson-mq2-gas",
    title: "Mission 11 · MQ-2 Gas & Smoke Sentinel",
    shortTitle: "Gas Sentinel",
    description: "Detect combustible gas or smoke PPM levels and activate emergency sound and warning strobe.",
    difficulty: "Intermediate",
    estimatedMinutes: 16,
    concepts: ["MQ-2 Gas Sensor", "PPM Concentration", "Environmental Safety", "Emergency Alarm"],
    prerequisites: ["lesson-ultrasonic"],
    seedCircuit: MQ2_GAS_CIRCUIT,
    seedBlocklyXml: MQ2_GAS_XML,
    finalGoal: "🎯 What You Will Build: An environmental hazard safety sentinel that continuously samples air quality via an MQ-2 sensor and trips an emergency buzzer alarm and flashing warning strobe if gas PPM exceeds 300.",
    codingHints: [
      "In Setup, configure digital alarm outputs: Pin 8 (Buzzer) and Pin 13 (Alert Strobe).",
      "In Loop, sample the gas sensor using the MQ-2 Gas Read block on Pin A0.",
      "Compare: If (Gas PPM > 300), turn Pin 8 and Pin 13 HIGH (Hazard Alert Active!).",
      "Else: set Pin 8 and Pin 13 to LOW (Air Clean).",
    ],
    steps: [
      {
        id: "parts",
        title: "Gather gas detection parts",
        instructions: "Place one Arduino Uno, one MQ-2 Gas sensor, one buzzer, one LED, and one resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "mq2-gas", count: 1 },
          { type: "buzzer", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "All gas sentinel parts are present.",
      },
      {
        id: "wiring",
        title: "Wire sensor and dual alert",
        instructions: "Connect MQ-2 VCC/GND, AO → A0. Wire D8 → Buzzer POS and D13 through resistor to LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "mq2-gas", pinId: "vcc" } },
          { from: { partType: "mq2-gas", pinId: "gnd" }, to: { partType: "arduino-uno", pinId: "gnd" } },
          { from: { partType: "mq2-gas", pinId: "ao" }, to: { partType: "arduino-uno", pinId: "a0" } },
          { from: { partType: "arduino-uno", pinId: "d8" }, to: { partType: "buzzer", pinId: "pos" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Gas sensor and alert outputs are wired.",
      },
      {
        id: "code",
        title: "Program PPM threshold logic",
        instructions: "Read the MQ-2 sensor with mq2_gas_read. If PPM > 300, turn D8 and D13 HIGH; else LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "mq2_gas_read", count: 1 },
          { type: "controls_if", count: 1 },
          { type: "io_digitalwrite", count: 2 },
        ] }],
        success: "PPM threshold logic is in place.",
      },
      {
        id: "experiment",
        title: "Test gas threshold trigger",
        instructions: "Press Run and verify the gas sentinel actively monitors the simulated atmosphere.",
        kind: "experiment",
        checks: [{ kind: "running" }],
        success: "MQ-2 gas sentinel is actively monitoring.",
      },
    ],
  },
  {
    id: "lesson-dht11",
    title: "Mission 12 · DHT11 Digital Weather Station",
    shortTitle: "DHT11 Weather",
    description: "Read digital temperature (°C) and relative humidity (%) over a 1-wire protocol and log to Serial.",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    concepts: ["DHT11", "Digital Protocol", "Telemetry", "Environmental Monitoring"],
    prerequisites: ["lesson-ultrasonic"],
    seedCircuit: DHT11_CIRCUIT,
    seedBlocklyXml: DHT11_XML,
    finalGoal: "🎯 What You Will Build: A digital weather telemetry monitor that reads temperature (°C) and humidity (%) over a single-wire digital protocol from a DHT11 sensor and logs formatted climate data to the Serial console.",
    codingHints: [
      "In Setup, initialize the Serial monitor with Serial Begin (9600 baud).",
      "In Loop, read temperature using DHT Temperature block and humidity using DHT Humidity block.",
      "Send sensor values to Serial Monitor using Serial Print and Serial Println blocks.",
      "Add a Time Delay of 1000 ms to give the DHT sensor sufficient sampling interval.",
    ],
    steps: [
      {
        id: "wiring",
        title: "Wire the DHT11",
        instructions: "Connect 5V → VCC, GND → GND, and D4 → DATA.",
        kind: "build",
        checks: [
          { kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "dht11", count: 1 }] },
          { kind: "connections", requirements: [
            { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "dht11", pinId: "vcc" } },
            { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "dht11", pinId: "gnd" } },
            { from: { partType: "arduino-uno", pinId: "d4" }, to: { partType: "dht11", pinId: "data" } },
          ] },
        ],
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
        success: "Both DHT11 sensor readings are integrated in code.",
      },
      {
        id: "experiment",
        title: "Read live sensor values",
        instructions: "Press Run and move the DHT11 Temperature/Humidity sliders in the Inspector. Check when values are live.",
        kind: "experiment",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [
          { partId: "dht", field: "dhtTemperature", min: 0, max: 50 },
          { partId: "dht", field: "dhtHumidity", min: 0, max: 100 },
        ] }],
        success: "The DHT11 values are live in the virtual lab.",
      },
    ],
  },
  {
    id: "lesson-lcd-weather",
    title: "Mission 13 · I2C 16x2 LCD Character Display",
    shortTitle: "I2C LCD Display",
    description: "Communicate over the I2C 2-wire serial bus (SDA/SCL) to render formatted alphanumeric text.",
    difficulty: "Intermediate",
    estimatedMinutes: 14,
    concepts: ["I2C Bus", "SDA / SCL", "Alphanumeric Display", "Hardware Addressing"],
    prerequisites: ["lesson-dht11"],
    templateId: "g8-lcd-weather",
    finalGoal: "🎯 What You Will Build: An alphanumeric smart dashboard that uses the 2-wire I2C communication protocol (SDA/SCL) on pins A4 & A5 to render custom greetings and telemetry on a 16×2 character LCD screen.",
    codingHints: [
      "In Setup, clear any residual display artifacts with the LCD Clear block.",
      "Use LCD Print to render your custom text string on row 0, column 0.",
      "In Loop, refresh telemetry readings or display dynamic strings with an update delay.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place LCD display",
        instructions: "Place one Arduino Uno and one 16x2 I2C LCD Display module.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "lcd-i2c", count: 1 },
        ] }],
        success: "LCD module is on the bench.",
      },
      {
        id: "wiring",
        title: "Wire I2C bus",
        instructions: "Connect 5V → VCC, GND → GND, A4 → SDA, and A5 → SCL.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "lcd-i2c", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "lcd-i2c", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "a4" }, to: { partType: "lcd-i2c", pinId: "sda" } },
          { from: { partType: "arduino-uno", pinId: "a5" }, to: { partType: "lcd-i2c", pinId: "scl" } },
        ] }],
        success: "I2C SDA and SCL bus lines are connected.",
      },
      {
        id: "code",
        title: "Print to display",
        instructions: "Use lcd_print and lcd_clear blocks to output text.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "lcd_print", count: 1 },
          { type: "lcd_clear", count: 1 },
        ] }],
        success: "LCD print commands are present.",
      },
      {
        id: "run",
        title: "Run display program",
        instructions: "Press Run and view the virtual LCD screen update.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "LCD display is operational.",
      },
    ],
  },
  {
    id: "lesson-neopixel-ring",
    title: "Mission 14 · NeoPixel Cyber Ring",
    shortTitle: "NeoPixel Ring",
    description: "Control addressable WS2812 RGB LEDs in a circular ring with single-pin high-speed data.",
    difficulty: "Intermediate",
    estimatedMinutes: 15,
    concepts: ["WS2812", "Addressable LEDs", "NeoPixel Ring", "High-speed Serial Data"],
    prerequisites: ["lesson-rgb-mood-lamp"],
    seedCircuit: NEOPIXEL_CIRCUIT,
    seedBlocklyXml: NEOPIXEL_XML,
    finalGoal: "🎯 What You Will Build: An 8-pixel WS2812B addressable NeoPixel cyber ring displaying flowing rainbow color animations and patterns controlled over a single high-speed digital data pin (D6).",
    codingHints: [
      "Target the NeoPixel Ring component (Pin D6, 8 pixels).",
      "Use the NeoPixel Set Color block to set pixel indices (0 to 7) to your desired color.",
      "Call the NeoPixel Show block to push color data buffer out to the WS2812 hardware LEDs.",
      "Add a Time Delay block to create sequential rainbow or chase animations.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place NeoPixel Ring",
        instructions: "Place one Arduino Uno and one NeoPixel 8-LED Ring.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "neopixel-ring", count: 1 },
        ] }],
        success: "NeoPixel Ring is placed.",
      },
      {
        id: "wiring",
        title: "Wire single-pin data line",
        instructions: "Connect 5V → VCC, GND → GND, and D6 → DIN.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "neopixel-ring", pinId: "vcc" } },
          { from: { partType: "neopixel-ring", pinId: "gnd" }, to: { partType: "arduino-uno", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d6" }, to: { partType: "neopixel-ring", pinId: "din" } },
        ] }],
        success: "NeoPixel data in line is wired to D6.",
      },
      {
        id: "code",
        title: "Program pixel colors",
        instructions: "Use neopixel_set_color and neopixel_show blocks to drive the ring.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "neopixel_set_color", count: 1 },
          { type: "neopixel_show", count: 1 },
        ] }],
        success: "NeoPixel color routines are programmed.",
      },
      {
        id: "run",
        title: "Illuminate cyber ring",
        instructions: "Press Run and watch the NeoPixel ring light up.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "NeoPixel ring is illuminating.",
      },
    ],
  },

  // --- TIER 3: ADVANCED & AI (Complex Sensors, Keypad Matrix & Pixiu AI) ---
  {
    id: "lesson-pir-security",
    title: "Mission 15 · PIR Motion Intruder Alarm",
    shortTitle: "PIR Security",
    description: "Detect human body infrared thermal motion using a PIR sensor and trip an immediate intrusion alert.",
    difficulty: "Advanced",
    estimatedMinutes: 16,
    concepts: ["PIR Pyroelectric Sensor", "Thermal Infrared", "Perimeter Security", "Digital Inputs"],
    prerequisites: ["lesson-servo-gate"],
    templateId: "g7-pir-security",
    finalGoal: "🎯 What You Will Build: An intrusion perimeter security system that senses human thermal infrared radiation via a PIR sensor on pin D7 and immediately activates a security alert strobe on pin D13.",
    codingHints: [
      "In Setup, configure Pin D7 as INPUT (PIR Sensor) and Pin D13 as OUTPUT (Security LED).",
      "In Loop, test motion status using the PIR Motion block inside an If/Else statement.",
      "If motion is HIGH: turn Pin 13 HIGH (Intruder Alert!).",
      "Else: turn Pin 13 LOW (Perimeter Secure).",
    ],
    steps: [
      {
        id: "parts",
        title: "Place PIR sensor and alert lamp",
        instructions: "Place one Arduino Uno, one PIR Motion Sensor, one LED, and one resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "pir-sensor", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Security hardware is on the bench.",
      },
      {
        id: "wiring",
        title: "Wire PIR and indicator",
        instructions: "Connect 5V → PIR VCC, GND → PIR GND, D7 → PIR OUT, and D13 through resistor to LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "pir-sensor", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "pir-sensor", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d7" }, to: { partType: "pir-sensor", pinId: "out" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "PIR and alert indicator lines connected.",
      },
      {
        id: "code",
        title: "Program intruder trigger",
        instructions: "Configure D7 as INPUT. When pir_motion is detected, set D13 HIGH; else LOW.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "io_pinmode", count: 1, fields: { PIN: "7", MODE: "INPUT" } },
          { type: "pir_motion", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13", STATE: "HIGH" } },
        ] }],
        success: "Intruder detection logic programmed.",
      },
      {
        id: "run",
        title: "Run security sentinel",
        instructions: "Press Run and test triggering motion using the Inspector.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "PIR motion security system is active.",
      },
    ],
  },
  {
    id: "lesson-soil-smart-farm",
    title: "Mission 16 · Smart Farm Soil Moisture Monitor",
    shortTitle: "Smart Farm Soil",
    description: "Measure soil volumetric water content using analog conductivity and automate agricultural irrigation alerts.",
    difficulty: "Advanced",
    estimatedMinutes: 16,
    concepts: ["Soil Moisture Sensor", "Analog Conductivity", "Smart Agriculture", "IoT Automation"],
    prerequisites: ["lesson-ldr-night-lamp"],
    templateId: "g7-soil-smart-farm",
    finalGoal: "🎯 What You Will Build: An automated smart irrigation controller that measures soil moisture content via analog conductivity on pin A0 and automatically switches an irrigation pump indicator on when soil is dry.",
    codingHints: [
      "In Setup, set Pin D13 as OUTPUT (Irrigation Pump / Water Valve indicator).",
      "In Loop, sample moisture using the Soil Moisture Read block on Pin A0.",
      "Use an If/Else block: if Soil Moisture is less than threshold (Dry Soil), turn Pin 13 HIGH to start irrigation pump.",
      "Else (Soil Hydrated): turn Pin 13 LOW to conserve water.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place soil sensor and pump indicator",
        instructions: "Place one Arduino Uno, one Soil Moisture sensor, one LED, and one resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "soil-moisture", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Smart farm hardware is placed.",
      },
      {
        id: "wiring",
        title: "Wire soil probe",
        instructions: "Connect 5V → Soil VCC, GND → Soil GND, Soil AO → A0, and D13 through resistor to LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "soil-moisture", pinId: "vcc" } },
          { from: { partType: "arduino-uno", pinId: "gnd" }, to: { partType: "soil-moisture", pinId: "gnd" } },
          { from: { partType: "soil-moisture", pinId: "ao" }, to: { partType: "arduino-uno", pinId: "a0" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Soil probe and pump indicator wired.",
      },
      {
        id: "code",
        title: "Program irrigation threshold",
        instructions: "Use soil_moisture_read and turn D13 HIGH if moisture exceeds threshold.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "soil_moisture_read", count: 1 },
          { type: "controls_if", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13" } },
        ] }],
        success: "Irrigation automation logic is programmed.",
      },
      {
        id: "run",
        title: "Test soil hydration response",
        instructions: "Run simulation and adjust soil moisture slider in Inspector.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Smart farm monitor is running.",
      },
    ],
  },
  {
    id: "lesson-keypad-lock",
    title: "Mission 17 · Keypad Digital Security Vault",
    shortTitle: "Keypad Vault",
    description: "Scan a 4×4 matrix keypad using row-column multiplexing to accept secure user PIN authentication.",
    difficulty: "Advanced",
    estimatedMinutes: 20,
    concepts: ["4x4 Matrix Keypad", "Multiplexing", "Security PIN", "Human Interface"],
    prerequisites: ["lesson-pir-security"],
    templateId: "g8-keypad-lock",
    finalGoal: "🎯 What You Will Build: A digital electronic security vault door that scans user keystrokes from a 4×4 matrix keypad using row-column multiplexing to verify a secure PIN and unlock the vault.",
    codingHints: [
      "In Setup, configure Pin D13 as OUTPUT for the Vault Lock status indicator.",
      "In Loop, scan for user input using the Keypad Read block across pins D2..D9.",
      "Compare the pressed key to your secret access digit (e.g. key '1').",
      "If matched: drive Pin 13 HIGH to unlock the electronic vault solenoid.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place 4x4 keypad and vault lock LED",
        instructions: "Place one Arduino Uno, one 4x4 Keypad, one LED, and one resistor.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "keypad-4x4", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Keypad access hardware is in place.",
      },
      {
        id: "wiring",
        title: "Wire matrix rows, columns and indicator",
        instructions: "Connect D2..D5 to keypad rows R1..R4, D6..D9 to columns C1..C4, and D13 to LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "d2" }, to: { partType: "keypad-4x4", pinId: "r1" } },
          { from: { partType: "arduino-uno", pinId: "d6" }, to: { partType: "keypad-4x4", pinId: "c1" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Matrix rows, columns and indicator wired.",
      },
      {
        id: "code",
        title: "Program keypad input scanning",
        instructions: "Read keypad input with keypad_read and drive the lock indicator on D13.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "keypad_read", count: 1 },
          { type: "io_digitalwrite", count: 1, fields: { PIN: "13" } },
        ] }],
        success: "Keypad scanning logic ready.",
      },
      {
        id: "run",
        title: "Test keypad entry",
        instructions: "Press Run and click keys on the 4x4 keypad in the Inspector.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "Keypad vault lock is actively running.",
      },
    ],
  },
  {
    id: "lesson-ai-vision-barrier",
    title: "Mission 18 · AI Vision Smart Boom Barrier (Pixiu AI)",
    shortTitle: "AI Vision Barrier",
    description: "Combine AI Computer Vision with a servo boom barrier: when the AI camera detects an oncoming car, open the barrier and illuminate the green pass light!",
    difficulty: "Advanced",
    estimatedMinutes: 22,
    concepts: ["Computer Vision", "Pixiu AI", "Edge AI Inference", "Autonomous Robotics", "Smart City"],
    prerequisites: ["lesson-servo-gate"],
    templateId: "ai-smart-barrier",
    finalGoal: "🎯 What You Will Build: An autonomous AI-powered boom barrier that runs real-time computer vision to detect oncoming vehicles, swinging the servo arm to 90° and illuminating the Green Pass light for authorized cars.",
    codingHints: [
      "In Setup, initialize Servo on Pin D6 to 0° (Closed Barrier) and set Pin 12 (Pass) & Pin 13 (Stop) as OUTPUTs.",
      "In Loop, inspect the camera feed with AI Is Detected for class 'car'.",
      "If detected: command Servo Write Pin 6 to 90° (Raise Barrier), turn Pin 12 HIGH (Green Pass) and Pin 13 LOW.",
      "Else: command Servo Write Pin 6 to 0° (Lower Barrier), turn Pin 12 LOW and Pin 13 HIGH (Red Stop).",
    ],
    steps: [
      {
        id: "parts",
        title: "Gather smart barrier components",
        instructions: "Place one Arduino Uno, one Servo (configured as barrier), two LEDs (Green Pass & Red Stop), and two resistors.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "servo", count: 1 },
          { type: "led", count: 2 },
          { type: "resistor", count: 2 },
        ] }],
        success: "Autonomous barrier gate parts are placed.",
      },
      {
        id: "wiring",
        title: "Wire barrier servo and dual indicators",
        instructions: "Connect 5V/GND and D6 to Servo SIG. Wire D12 through resistor to Green LED and D13 to Red LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "servo", pinId: "gnd" }, to: { partType: "arduino-uno", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d6" }, to: { partType: "servo", pinId: "sig" } },
          { from: { partType: "arduino-uno", pinId: "d12" }, to: { partType: "resistor", pinId: "a" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Servo and dual LED indicator circuits are complete.",
      },
      {
        id: "code",
        title: "Program AI Computer Vision detection",
        instructions: "Use ai_is_detected with class 'car'. When detected, swing the servo to 90° and set D12 HIGH / D13 LOW; else return to 0° with D12 LOW / D13 HIGH.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "ai_is_detected", count: 1, fields: { CLASS: "car" } },
          { type: "servo_write", count: 2 },
          { type: "io_digitalwrite", count: 2 },
        ] }],
        success: "Pixiu AI Vision object classifier is wired into control loop.",
      },
      {
        id: "run",
        title: "Run AI Vision Barrier",
        instructions: "Press Run to start simulation and trigger AI inference.",
        kind: "run",
        checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0, max: 180 }] }],
        success: "AI Vision Smart Barrier is running live in the simulator!",
      },
    ],
  },
  {
    id: "lesson-ai-gesture-controller",
    title: "Mission 19 · AI Hand Gesture Smart Controller",
    shortTitle: "AI Gesture Controller",
    description: "Track hand gestures via AI Computer Vision (e.g. Thumbs Up) to command smart home servo and LED actuators without touching hardware.",
    difficulty: "Advanced",
    estimatedMinutes: 22,
    concepts: ["Hand Gesture Recognition", "Pixiu AI Vision", "Touchless Control", "Smart Home"],
    prerequisites: ["lesson-ai-vision-barrier"],
    seedCircuit: AI_GESTURE_CIRCUIT,
    seedBlocklyXml: AI_GESTURE_XML,
    finalGoal: "🎯 What You Will Build: A touchless smart home automation system that uses AI hand gesture recognition (such as Thumbs Up) to wirelessly actuate servo mechanisms and lighting indicators without physical contact.",
    codingHints: [
      "In Setup, enable camera stream with the AI Camera Enable block and configure Pin 13 as OUTPUT.",
      "In Loop, check the hand classifier with AI Is Gesture for 'thumbs_up'.",
      "If Thumbs Up detected: command Servo Write Pin 9 to 90° and turn Pin 13 HIGH.",
      "Else: command Servo Write Pin 9 to 0° and turn Pin 13 LOW.",
    ],
    steps: [
      {
        id: "parts",
        title: "Place smart home actuators",
        instructions: "Place one Arduino Uno, one Servo, one LED, and one resistor on the bench.",
        kind: "build",
        checks: [{ kind: "parts", requirements: [
          { type: "arduino-uno", count: 1 },
          { type: "servo", count: 1 },
          { type: "led", count: 1 },
          { type: "resistor", count: 1 },
        ] }],
        success: "Actuators are ready for AI gesture control.",
      },
      {
        id: "wiring",
        title: "Wire servo and indicator",
        instructions: "Connect 5V → Servo VCC, GND → Servo GND, D9 → Servo SIG, and D13 through resistor to LED.",
        kind: "build",
        checks: [{ kind: "connections", requirements: [
          { from: { partType: "arduino-uno", pinId: "5v" }, to: { partType: "servo", pinId: "vcc" } },
          { from: { partType: "servo", pinId: "gnd" }, to: { partType: "arduino-uno", pinId: "gnd" } },
          { from: { partType: "arduino-uno", pinId: "d9" }, to: { partType: "servo", pinId: "sig" } },
          { from: { partType: "arduino-uno", pinId: "d13" }, to: { partType: "resistor", pinId: "a" } },
        ] }],
        success: "Servo and indicator wired.",
      },
      {
        id: "code",
        title: "Program AI Hand Gesture recognition",
        instructions: "Enable camera with ai_camera_enable. Use ai_is_gesture for 'thumbs_up' to rotate servo to 90° and turn on LED.",
        kind: "code",
        checks: [{ kind: "blocks", requirements: [
          { type: "ai_camera_enable", count: 1 },
          { type: "ai_is_gesture", count: 1 },
          { type: "servo_write", count: 2 },
        ] }],
        success: "AI hand gesture tracking logic is programmed.",
      },
      {
        id: "run",
        title: "Run gesture controller",
        instructions: "Press Run to start AI camera vision and gesture control.",
        kind: "run",
        checks: [{ kind: "running" }],
        success: "AI Gesture Smart Controller is live and active.",
      },
    ],
  },
  {
    id: "lesson-ai-object-counter",
    title: "Mission 20 · AI Vision Object Counter",
    shortTitle: "AI Object Counter",
    description: "Use Pixiu AI vision to count the objects currently visible to the camera and stream the result to the Arduino Serial Monitor.",
    difficulty: "Advanced",
    estimatedMinutes: 14,
    concepts: ["Computer Vision", "Object Counting", "Pixiu AI", "Serial Monitor"],
    prerequisites: ["lesson-ai-gesture-controller"],
    seedCircuit: { parts: [{ id: "uno", type: "arduino-uno", x: 60, y: 110, rotation: 0, props: {} }], wires: [] },
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="serial_begin"><field name="BAUD">9600</field><next>
      <block type="ai_camera_enable"><field name="STATE">ON</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="serial_println">
        <value name="TEXT"><block type="ai_get_object_count"></block></value>
        <next><block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block></next>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: An AI vision counter that reads the number of accepted object detections in each camera frame and reports the count to Arduino Serial.",
    codingHints: [
      "Enable the AI camera in Setup.",
      "Use AI Objects in View as a value block.",
      "Send that value to Serial.println so you can watch the count update.",
      "Run the simulation and place different objects in front of the camera."
    ],
    steps: [
      { id: "parts", title: "Place the Arduino", instructions: "Place one Arduino Uno. No external sensor is required because the AI camera is the input.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }] }], success: "Arduino is ready for AI vision." },
      { id: "code", title: "Program the object counter", instructions: "Enable the AI camera, read AI object count and print it repeatedly to Serial.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_camera_enable", count: 1 }, { type: "ai_get_object_count", count: 1 }, { type: "serial_println", count: 1 }] }], success: "AI object counter code is ready." },
      { id: "run", title: "Watch object count", instructions: "Press Run and observe the Serial Monitor while changing what the camera can see.", kind: "run", checks: [{ kind: "running" }], success: "Pixiu AI is counting objects live." }
    ],
  },
  {
    id: "lesson-ai-confidence-alarm",
    title: "Mission 21 · AI Confidence Alarm",
    shortTitle: "AI Confidence Alarm",
    description: "Turn AI confidence into a physical signal: when vision confidence passes your chosen threshold, light a warning LED.",
    difficulty: "Advanced",
    estimatedMinutes: 16,
    concepts: ["AI Confidence", "Thresholds", "Decision Logic", "Physical Output"],
    prerequisites: ["lesson-ai-object-counter"],
    seedCircuit: AI_LED_CIRCUIT,
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="logic_compare"><field name="OP">GT</field>
          <value name="A"><block type="ai_confidence"></block></value>
          <value name="B"><shadow type="math_number"><field name="NUM">75</field></shadow></value>
        </block></value>
        <statement name="DO0"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field></statement>
        <statement name="ELSE"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field></statement>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: A confidence-triggered AI alarm that converts model confidence into a real Arduino output.",
    codingHints: ["Choose a confidence threshold such as 75%.", "Compare AI confidence against that threshold.", "Drive D13 HIGH when confidence is above the threshold.", "Use the camera and try to create both high- and low-confidence frames."],
    steps: [
      { id: "parts", title: "Place the warning LED", instructions: "Place one Arduino Uno, one LED and one resistor.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "led", count: 1 }, { type: "resistor", count: 1 }] }], success: "Warning indicator is ready." },
      { id: "code", title: "Program the confidence threshold", instructions: "Enable AI, configure D13 as output and compare AI confidence to 75%.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_camera_enable", count: 1 }, { type: "ai_confidence", count: 1 }, { type: "logic_compare", count: 1 }, { type: "io_digitalwrite", count: 2 }] }], success: "Confidence threshold logic is programmed." },
      { id: "run", title: "Test the alarm", instructions: "Press Run and vary the camera input.", kind: "run", checks: [{ kind: "running" }], success: "AI confidence alarm is running." }
    ],
  },
  {
    id: "lesson-ai-smart-presence",
    title: "Mission 22 · AI Smart Presence Light",
    shortTitle: "AI Presence Light",
    description: "Detect a person with Pixiu AI and automatically switch a physical light on only when a person is visible.",
    difficulty: "Advanced",
    estimatedMinutes: 15,
    concepts: ["Person Detection", "Computer Vision", "Automation", "GPIO"],
    prerequisites: ["lesson-ai-confidence-alarm"],
    seedCircuit: AI_LED_CIRCUIT,
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="ai_is_detected"><field name="CLASS">person</field></block></value>
        <statement name="DO0"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field></statement>
        <statement name="ELSE"><block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field></statement>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: A contactless smart light that turns on when the AI camera recognizes a person.",
    codingHints: ["Use AI Is Detected with the class person.", "Put the detection condition inside If/Else.", "Set D13 HIGH for presence and LOW when the area is empty.", "Try moving in and out of the camera view."],
    steps: [
      { id: "parts", title: "Build the presence light", instructions: "Place one Arduino Uno, one LED and one resistor.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "led", count: 1 }, { type: "resistor", count: 1 }] }], success: "Presence light hardware is placed." },
      { id: "code", title: "Program person detection", instructions: "Enable the camera and switch D13 from the AI person detection result.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_is_detected", count: 1 }, { type: "controls_if", count: 1 }, { type: "io_digitalwrite", count: 2 }] }], success: "Presence automation is programmed." },
      { id: "run", title: "Test smart presence", instructions: "Press Run and step into the camera view.", kind: "run", checks: [{ kind: "running" }], success: "AI smart presence lighting is live." }
    ],
  },
  {
    id: "lesson-ai-gesture-signal",
    title: "Mission 23 · AI Gesture Traffic Signal",
    shortTitle: "AI Gesture Signal",
    description: "Use thumbs-up and thumbs-down gestures to control two physical signal lights without touching the circuit.",
    difficulty: "Advanced",
    estimatedMinutes: 18,
    concepts: ["Hand Gestures", "Touchless Control", "Decision Logic", "Robotics"],
    prerequisites: ["lesson-ai-smart-presence"],
    seedCircuit: AI_DUAL_LED_CIRCUIT,
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="io_pinmode"><field name="PIN">12</field><field name="MODE">OUTPUT</field><next>
      <block type="io_pinmode"><field name="PIN">13</field><field name="MODE">OUTPUT</field></next>
      </block></next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="ai_is_gesture"><field name="GESTURE">thumbs_up</field></block></value>
        <statement name="DO0">
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">HIGH</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field></next>
          </block>
        </statement>
        <statement name="ELSE">
          <block type="io_digitalwrite"><field name="PIN">12</field><field name="STATE">LOW</field><next>
          <block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field></next>
          </block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: A touchless signal controller where your hand gesture decides which physical light is active.",
    codingHints: ["Enable camera input.", "Use thumbs_up as the positive signal.", "Map D12 to green and D13 to red.", "Change the ELSE behavior later to a second gesture such as thumbs_down."],
    steps: [
      { id: "parts", title: "Place two signal lights", instructions: "Place one Arduino Uno, two LEDs and two resistors.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "led", count: 2 }, { type: "resistor", count: 2 }] }], success: "Dual signal hardware is placed." },
      { id: "code", title: "Program gesture control", instructions: "Enable AI gesture input and drive the two outputs from thumbs-up logic.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_is_gesture", count: 1 }, { type: "io_digitalwrite", count: 4 }] }], success: "Gesture signal logic is ready." },
      { id: "run", title: "Test the gesture signal", instructions: "Press Run and make a thumbs-up gesture.", kind: "run", checks: [{ kind: "running" }], success: "AI gesture signal is active." }
    ],
  },
  {
    id: "lesson-ai-finger-servo",
    title: "Mission 24 · AI Finger Count Servo",
    shortTitle: "AI Finger Servo",
    description: "Turn finger count into motion: show three or more fingers to open a servo mechanism, otherwise keep it closed.",
    difficulty: "Advanced",
    estimatedMinutes: 18,
    concepts: ["Hand Tracking", "Finger Counting", "Servo Control", "Human-Machine Interaction"],
    prerequisites: ["lesson-ai-gesture-signal"],
    seedCircuit: AI_SERVO_CIRCUIT,
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="ai_get_finger_count"></block></value><value name="B"><shadow type="math_number"><field name="NUM">2</field></shadow></value></block></value>
        <statement name="DO0"><block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block></statement>
        <statement name="ELSE"><block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block></statement>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: A servo actuator controlled by the number of fingers detected by Pixiu AI.",
    codingHints: ["Enable the camera.", "Read AI finger count as a number.", "Compare it against 2.", "Rotate the servo to 90° when three or more fingers are visible."],
    steps: [
      { id: "parts", title: "Place the servo", instructions: "Place one Arduino Uno and one Servo motor.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "servo", count: 1 }] }], success: "Servo hardware is ready." },
      { id: "code", title: "Map fingers to motion", instructions: "Compare AI finger count with 2 and drive the servo accordingly.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_get_finger_count", count: 1 }, { type: "logic_compare", count: 1 }, { type: "servo_write", count: 3 }] }], success: "Finger-count motion logic is programmed." },
      { id: "run", title: "Move with your hand", instructions: "Press Run and change the number of visible fingers.", kind: "run", checks: [{ kind: "running" }, { kind: "runtime", requirements: [{ partType: "servo", field: "angle", min: 0, max: 180 }] }], success: "AI finger-controlled servo is moving live." }
    ],
  },
  {
    id: "lesson-ai-smart-doorbell",
    title: "Mission 25 · AI Smart Doorbell",
    shortTitle: "AI Smart Doorbell",
    description: "Detect a person, open a virtual door servo and sound an electronic doorbell using one AI-driven decision loop.",
    difficulty: "Advanced",
    estimatedMinutes: 20,
    concepts: ["Person Detection", "Servo Automation", "Buzzer", "Smart Home AI"],
    prerequisites: ["lesson-ai-finger-servo"],
    seedCircuit: AI_SERVO_CIRCUIT,
    seedBlocklyXml: `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="ai_camera_enable"><field name="STATE">ON</field><next>
      <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
      </next></block>
    </statement>
    <statement name="LOOP">
      <block type="controls_if">
        <mutation else="1"></mutation>
        <value name="IF0"><block type="ai_is_detected"><field name="CLASS">person</field></block></value>
        <statement name="DO0">
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value><next>
          <block type="tone_play"><field name="PIN">8</field><value name="FREQ"><shadow type="math_number"><field name="NUM">880</field></shadow></value><next>
          <block type="time_delay"><value name="MS"><shadow type="math_number"><field name="NUM">500</field></shadow></value></block>
          </next></block></next></block>
        </statement>
        <statement name="ELSE">
          <block type="servo_write"><field name="PIN">9</field><value name="ANGLE"><shadow type="math_number"><field name="NUM">0</field></shadow></value><next>
          <block type="tone_stop"><field name="PIN">8</field></block>
          </next></block>
        </statement>
      </block>
    </statement>
  </block>
</xml>`,
    finalGoal: "🎯 What You Will Build: An AI smart-door system that recognizes a person, opens a servo mechanism and rings a virtual doorbell.",
    codingHints: ["Enable AI camera input.", "Check for the person class.", "Open the servo to 90° and play an 880 Hz tone.", "When no person is detected, close the servo and stop the tone."],
    steps: [
      { id: "parts", title: "Place the door mechanism", instructions: "Place one Arduino Uno and one Servo.", kind: "build", checks: [{ kind: "parts", requirements: [{ type: "arduino-uno", count: 1 }, { type: "servo", count: 1 }] }], success: "Smart door mechanism is placed." },
      { id: "code", title: "Program AI doorbell logic", instructions: "Detect a person, open the servo and trigger the buzzer.", kind: "code", checks: [{ kind: "blocks", requirements: [{ type: "ai_is_detected", count: 1 }, { type: "servo_write", count: 2 }, { type: "tone_play", count: 1 }, { type: "tone_stop", count: 1 }] }], success: "AI doorbell logic is programmed." },
      { id: "run", title: "Test the smart doorbell", instructions: "Press Run and move into the AI camera view.", kind: "run", checks: [{ kind: "running" }], success: "AI smart doorbell is live." }
    ],
  },

]

export const LESSONS: Lesson[] = [
  ...UNO_LESSONS.map((l) => {
    const tmplXml = l.templateId ? TEMPLATES.find((t) => t.id === l.templateId)?.blocklyXml : undefined
    return {
      ...l,
      board: l.board ?? ("arduino-uno" as const),
      seedBlocklyXml: l.seedBlocklyXml || tmplXml,
    }
  }),
  ...ESP32_LESSONS,
  ...PICO_LESSONS,
  ...MICROBIT_LESSONS,
]

const EMPTY_STARTER_BLOCKLY_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40"></block>
</xml>`

export function getLessonSeed(lesson: Lesson): { state: CircuitState; blocklyXml: string; sourceTemplateId?: string } {
  // Option B: Interactive Missions start with a clean blank canvas for wiring (parts: [], wires: []).
  // For Beginner missions: Blockly code is automatically loaded so beginner students only focus on wiring.
  // For Intermediate & Advanced missions: Clean starter blockly block so students construct code step-by-step.
  if (lesson.difficulty === "Beginner") {
    const beginnerXml =
      lesson.seedBlocklyXml ||
      (lesson.templateId ? TEMPLATES.find((t) => t.id === lesson.templateId)?.blocklyXml : undefined) ||
      EMPTY_STARTER_BLOCKLY_XML
    return {
      state: { parts: [], wires: [] },
      blocklyXml: beginnerXml,
      sourceTemplateId: lesson.templateId,
    }
  }

  return {
    state: { parts: [], wires: [] },
    blocklyXml: EMPTY_STARTER_BLOCKLY_XML,
  }
}

