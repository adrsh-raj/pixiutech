import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outdir = join(tmpdir(), `pixiu-lesson-seed-integrity-${Date.now()}`)
await build({
  entryPoints: [new URL("../../src/lib/lesson-engine.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outdir,
  platform: "neutral",
  alias: { "@": new URL("../../src", import.meta.url).pathname },
})

const { LESSONS, getLessonSeed } = await import(`file://${join(outdir, "lesson-engine.js")}`)

function blockTypes(xml) {
  return [...xml.matchAll(/<block\s+type=["']([^"']+)["']/g)].map((match) => match[1])
}

function hasField(xml, blockType, fieldName, fieldValue) {
  return xml.includes(`<block type="${blockType}"><field name="${fieldName}">${fieldValue}</field>`)
}

function assertWellFormedXml(xml, label) {
  const stack = []
  const tokens = xml.match(/<\/?[A-Za-z][^>]*>/g) ?? []
  for (const token of tokens) {
    const closing = token.startsWith("</")
    const selfClosing = token.endsWith("/>")
    const tag = token.match(/^<\/?([A-Za-z][\w:-]*)/)?.[1]
    assert.ok(tag, `${label}: malformed XML token ${token}`)
    if (closing) {
      assert.equal(stack.pop(), tag, `${label}: unexpected closing tag ${token}`)
    } else if (!selfClosing) {
      stack.push(tag)
    }
  }
  assert.deepEqual(stack, [], `${label}: unclosed XML elements`)
}

test("all 55 lessons have unique IDs and preserve the four-board curriculum inventory", () => {
  assert.equal(LESSONS.length, 55)
  const ids = LESSONS.map((lesson) => lesson.id)
  assert.equal(new Set(ids).size, ids.length, "lesson IDs must be globally unique")

  const counts = Object.fromEntries(
    ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].map((board) => [
      board,
      LESSONS.filter((lesson) => (lesson.board ?? "arduino-uno") === board).length,
    ]),
  )
  assert.deepEqual(counts, {
    "arduino-uno": 25,
    "esp32-devkit": 10,
    "rpi-pico": 10,
    "microbit-v2": 10,
  })
})

test("every Beginner lesson loads its own non-empty, well-formed Blockly program", () => {
  const beginnerLessons = LESSONS.filter((lesson) => lesson.difficulty === "Beginner")
  assert.equal(beginnerLessons.length, 19)

  for (const lesson of beginnerLessons) {
    const seed = getLessonSeed(lesson)
    assert.ok(seed.blocklyXml, `${lesson.id}: missing Blockly seed`)
    assertWellFormedXml(seed.blocklyXml, lesson.id)
    assert.ok(seed.blocklyXml.includes('<block type="arduino_program"'), `${lesson.id}: missing program root`)
    assert.ok(blockTypes(seed.blocklyXml).length > 1, `${lesson.id}: starter is blank`)
    assert.equal("templateId" in lesson, false, `${lesson.id}: lesson must not inherit a mismatched project template`)
  }
})

test("every stored lesson Blockly seed is well-formed, even when it is not auto-loaded", () => {
  const storedSeeds = LESSONS.filter((lesson) => typeof lesson.seedBlocklyXml === "string" && lesson.seedBlocklyXml.trim())
  assert.ok(storedSeeds.length >= 43, "expected explicit seed XML across all four board curricula and Arduino AI missions")

  for (const lesson of storedSeeds) {
    assertWellFormedXml(lesson.seedBlocklyXml, `${lesson.id} stored seed`)
    assert.ok(blockTypes(lesson.seedBlocklyXml).length > 1, `${lesson.id}: stored seed must contain executable blocks`)
    assert.ok(lesson.seedBlocklyXml.includes('<block type="arduino_program"'), `${lesson.id}: stored seed must have a program root`)
  }
})

test("Intermediate and Advanced missions always start with a clean Blockly workspace", () => {
  const lessons = LESSONS.filter((lesson) => lesson.difficulty !== "Beginner")
  assert.equal(lessons.length, 36)

  for (const lesson of lessons) {
    const seed = getLessonSeed(lesson)
    assertWellFormedXml(seed.blocklyXml, lesson.id)
    assert.deepEqual(blockTypes(seed.blocklyXml), ["arduino_program"], `${lesson.id}: stale code leaked into a non-Beginner lesson`)
  }
})

test("Mission 1 Safe LED Blink only drives its single D13 LED with a timed HIGH/LOW blink", () => {
  const lesson = LESSONS.find((item) => item.id === "lesson-led-basics")
  assert.ok(lesson)
  const xml = getLessonSeed(lesson).blocklyXml

  assert.ok(hasField(xml, "io_pinmode", "PIN", "13"))
  assert.ok(xml.includes('<field name="MODE">OUTPUT</field>'))
  assert.ok(xml.includes('<block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">HIGH</field>'))
  assert.ok(xml.includes('<block type="io_digitalwrite"><field name="PIN">13</field><field name="STATE">LOW</field>'))
  assert.equal((xml.match(/<block type="time_delay"/g) ?? []).length, 2)
  for (const forbidden of ["pushbutton_read", "io_digitalread", "tone_play", "tone_stop"]) {
    assert.equal(xml.includes(`type="${forbidden}"`), false, `Safe LED Blink must not contain ${forbidden}`)
  }
})

test("the other Beginner Arduino starters match their lesson pins and behavior", () => {
  const byId = (id) => {
    const lesson = LESSONS.find((item) => item.id === id)
    assert.ok(lesson, `missing lesson ${id}`)
    return getLessonSeed(lesson).blocklyXml
  }

  const button = byId("lesson-pushbutton-led")
  assert.ok(hasField(button, "io_digitalread", "PIN", "2"))
  assert.ok(button.includes('<field name="PIN">13</field><field name="STATE">HIGH</field>'))
  assert.ok(button.includes('<field name="PIN">13</field><field name="STATE">LOW</field>'))

  const dimmer = byId("lesson-pot-dimmer")
  assert.ok(hasField(dimmer, "io_analogread", "PIN", "A0"))
  assert.ok(hasField(dimmer, "io_analogwrite", "PIN", "9"))
  assert.ok(dimmer.includes('type="arduino_map"'))
  assert.ok(dimmer.includes('<field name="NUM">1023</field>'))
  assert.ok(dimmer.includes('<field name="NUM">255</field>'))

  const doorbell = byId("lesson-buzzer-doorbell")
  assert.ok(hasField(doorbell, "io_digitalread", "PIN", "2"))
  assert.ok(hasField(doorbell, "tone_play", "PIN", "8"))
  assert.ok(hasField(doorbell, "tone_stop", "PIN", "8"))
  assert.equal(doorbell.includes('type="pushbutton_read"'), false)

  const rgb = byId("lesson-rgb-mood-lamp")
  for (const pin of ["9", "10", "11"]) assert.ok(hasField(rgb, "io_analogwrite", "PIN", pin))

  const traffic = byId("lesson-traffic-light")
  for (const pin of ["10", "11", "12"]) {
    assert.ok(traffic.includes(`<field name="PIN">${pin}</field>`), `traffic light missing pin ${pin}`)
  }
  assert.ok((traffic.match(/<block type="time_delay"/g) ?? []).length >= 4)
})

test("external pushbutton lessons include stable 10kΩ pull-down networks", () => {
  const arduinoButton = LESSONS.find((lesson) => lesson.id === "lesson-pushbutton-led")
  const arduinoDoorbell = LESSONS.find((lesson) => lesson.id === "lesson-buzzer-doorbell")
  assert.ok(arduinoButton)
  assert.ok(arduinoDoorbell)

  for (const lesson of [arduinoButton, arduinoDoorbell]) {
    const partsStep = lesson.steps.find((step) => step.id === "parts")
    const wiringStep = lesson.steps.find((step) => step.id === "wiring")
    assert.ok(partsStep)
    assert.ok(wiringStep)
    assert.ok(partsStep.checks.some((check) =>
      check.kind === "parts" && check.requirements.some((part) => part.type === "resistor" && part.count >= 1),
    ), lesson.id + ": requires the pull-down resistor")
    const requirements = wiringStep.checks.flatMap((check) => check.kind === "connections" ? check.requirements : [])
    assert.ok(requirements.some((edge) => edge.from.partProps?.resistance === 10000), lesson.id + ": missing 10kΩ resistor input connection")
    assert.ok(requirements.some((edge) => edge.to.partProps?.resistance === 10000), lesson.id + ": missing 10kΩ resistor ground connection")
  }

  for (const [id, boardType, pin, groundPin] of [
    ["lesson-esp32-pushbutton", "esp32-devkit", "d4", "gnd_l"],
    ["lesson-pico-tactile-button", "rpi-pico", "gp14", "gnd_4"],
  ]) {
    const lesson = LESSONS.find((item) => item.id === id)
    assert.ok(lesson?.seedCircuit, id + ": missing seeded circuit")
    const pullDown = lesson.seedCircuit.parts.find((part) => part.id === "r_pull")
    assert.equal(pullDown?.type, "resistor")
    assert.equal(Number(pullDown.props.resistance), 10000)
    const boardId = boardType === "esp32-devkit" ? "esp" : "pico"
    const signalWire = lesson.seedCircuit.wires.some((wire) =>
      wire.from.partId === boardId && wire.from.pinId === pin && wire.to.partId === "r_pull" && wire.to.pinId === "a",
    )
    const groundWire = lesson.seedCircuit.wires.some((wire) =>
      wire.from.partId === "r_pull" && wire.from.pinId === "b" && wire.to.partId === boardId && wire.to.pinId === groundPin,
    )
    assert.equal(signalWire, true, id + ": signal pin must connect to the pull-down resistor")
    assert.equal(groundWire, true, id + ": pull-down resistor must return to board ground")
  }
})

test("all pre-seeded component references resolve to a component in that lesson's seed circuit", () => {
  const lessonsWithCircuit = LESSONS.filter((lesson) => lesson.seedCircuit && lesson.seedBlocklyXml)
  assert.equal(lessonsWithCircuit.length, 40)

  for (const lesson of lessonsWithCircuit) {
    const partIds = new Set(lesson.seedCircuit.parts.map((part) => part.id))
    const references = [...lesson.seedBlocklyXml.matchAll(/<field name="SENSOR">([^<]*)<\/field>/g)]
      .map((match) => match[1])
      .filter(Boolean)
    for (const id of references) {
      assert.ok(partIds.has(id), `${lesson.id}: Blockly references missing component id "${id}"`)
    }
  }
})
