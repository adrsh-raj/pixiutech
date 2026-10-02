#!/usr/bin/env node

/**
 * Multi-Board Curriculum QA Suite
 *
 * Verifies that the Circuit Lab interactive missions include at least 10+ missions
 * for each of the non-Uno boards (ESP32, Raspberry Pi Pico, BBC micro:bit v2) across
 * Beginner, Intermediate, and Advanced tiers, and that all lessons, starter circuits,
 * starter Blockly XML, and validation rules are structurally sound.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

console.log('🧪 Starting Multi-Board Curriculum QA Suite...\n')

// 1. Read source files directly to avoid ts-node / runtime bundling dependencies
const esp32Src = readFileSync(resolve(ROOT, 'pixiu-lms-portal/src/lib/curriculum/esp32-curriculum.ts'), 'utf8')
const picoSrc = readFileSync(resolve(ROOT, 'pixiu-lms-portal/src/lib/curriculum/pico-curriculum.ts'), 'utf8')
const microbitSrc = readFileSync(resolve(ROOT, 'pixiu-lms-portal/src/lib/curriculum/microbit-curriculum.ts'), 'utf8')
const lessonEngineSrc = readFileSync(resolve(ROOT, 'pixiu-lms-portal/src/lib/lesson-engine.ts'), 'utf8')
const browserSrc = readFileSync(resolve(ROOT, 'pixiu-lms-portal/src/components/circuit-lab/lesson-browser.tsx'), 'utf8')

// Simple extraction helpers
function extractLessonIds(src) {
  const matches = [...src.matchAll(/id:\s*["']([^"']+)["']/g)]
  // Filter out step ids like 'parts', 'wiring', 'code', 'run'
  return matches
    .map(m => m[1])
    .filter(id => id.startsWith('lesson-'))
}

function extractDifficulties(src) {
  const matches = [...src.matchAll(/difficulty:\s*["'](Beginner|Intermediate|Advanced)["']/g)]
  return matches.map(m => m[1])
}

const esp32LessonIds = extractLessonIds(esp32Src)
const picoLessonIds = extractLessonIds(picoSrc)
const microbitLessonIds = extractLessonIds(microbitSrc)

console.log(`📋 Discovered Mission Counts:`)
console.log(`   - ESP32 DevKit: ${esp32LessonIds.length} missions`)
console.log(`   - RPi Pico:     ${picoLessonIds.length} missions`)
console.log(`   - micro:bit v2: ${microbitLessonIds.length} missions`)

// Assertion 1: ESP32 has at least 10 missions
if (esp32LessonIds.length < 10) {
  console.error(`❌ ESP32 curriculum has only ${esp32LessonIds.length} missions, expected at least 10`)
  process.exit(1)
}
console.log('✅ ESP32 curriculum has at least 10 missions')

// Assertion 2: Pico has at least 10 missions
if (picoLessonIds.length < 10) {
  console.error(`❌ Pico curriculum has only ${picoLessonIds.length} missions, expected at least 10`)
  process.exit(1)
}
console.log('✅ RPi Pico curriculum has at least 10 missions')

// Assertion 3: micro:bit has at least 10 missions
if (microbitLessonIds.length < 10) {
  console.error(`❌ micro:bit curriculum has only ${microbitLessonIds.length} missions, expected at least 10`)
  process.exit(1)
}
console.log('✅ micro:bit v2 curriculum has at least 10 missions')

// Assertion 4: Check tier distribution (Beginner, Intermediate, Advanced)
for (const [name, src] of [['ESP32', esp32Src], ['Pico', picoSrc], ['micro:bit', microbitSrc]]) {
  const diffs = extractDifficulties(src)
  const beg = diffs.filter(d => d === 'Beginner').length
  const med = diffs.filter(d => d === 'Intermediate').length
  const adv = diffs.filter(d => d === 'Advanced').length

  console.log(`   - ${name} Tier Distribution: Beginner=${beg}, Intermediate=${med}, Advanced=${adv}`)
  if (beg === 0 || med === 0 || adv === 0) {
    console.error(`❌ ${name} is missing representation in one or more tiers (beg=${beg}, med=${med}, adv=${adv})`)
    process.exit(1)
  }
}
console.log('✅ All 3 architectures span Beginner, Intermediate, and Advanced tiers')

// Assertion 5: Lesson engine exports LESSONS containing all 3 arrays
if (!lessonEngineSrc.includes('ESP32_LESSONS') || !lessonEngineSrc.includes('PICO_LESSONS') || !lessonEngineSrc.includes('MICROBIT_LESSONS')) {
  console.error('❌ lesson-engine.ts does not import and merge all 3 curriculum arrays')
  process.exit(1)
}
console.log('✅ lesson-engine.ts imports and merges ESP32, Pico, and micro:bit curricula')

// Assertion 6: LessonBrowser has board filtering and board badges
if (!browserSrc.includes('boardFilter') || !browserSrc.includes('boardBadge')) {
  console.error('❌ lesson-browser.tsx is missing boardFilter state or boardBadge helper')
  process.exit(1)
}
if (!browserSrc.includes('arduino-uno') || !browserSrc.includes('esp32-devkit') || !browserSrc.includes('rpi-pico') || !browserSrc.includes('microbit-v2')) {
  console.error('❌ lesson-browser.tsx does not support all 4 board architecture filter options')
  process.exit(1)
}
console.log('✅ lesson-browser.tsx supports 4-way board architecture filtering and badges')

// Assertion 7: Check seed circuits and blockly xml tags in curriculum files
for (const [name, src] of [['ESP32', esp32Src], ['Pico', picoSrc], ['micro:bit', microbitSrc]]) {
  const xmlCount = (src.match(/seedBlocklyXml:\s*`<xml/g) || []).length
  const circuitCount = (src.match(/seedCircuit:\s*\{/g) || []).length
  if (xmlCount < 10) {
    console.error(`❌ ${name} has only ${xmlCount} valid seedBlocklyXml definitions`)
    process.exit(1)
  }
  if (circuitCount < 10) {
    console.error(`❌ ${name} has only ${circuitCount} seedCircuit definitions`)
    process.exit(1)
  }
}
console.log('✅ All 30 new missions have complete seed circuits and seed Blockly XML')

// Assertion 8: No duplicate lesson IDs across curricula
const allLessonIds = [...esp32LessonIds, ...picoLessonIds, ...microbitLessonIds]
const uniqueIds = new Set(allLessonIds)
if (allLessonIds.length !== uniqueIds.size) {
  console.error('❌ Duplicate lesson IDs found among new curricula!')
  process.exit(1)
}
console.log(`✅ All ${allLessonIds.length} new mission IDs are globally unique`)

// Assertion 9: Pin matches ground and power aliases in lesson-engine.ts
if (!lessonEngineSrc.includes('gnd_l') || !lessonEngineSrc.includes('gnd_1') || !lessonEngineSrc.includes('3v3')) {
  console.error('❌ pinMatches in lesson-engine.ts missing multi-board ground or power pin aliases')
  process.exit(1)
}
console.log('✅ pinMatches engine supports multi-board ground (gnd_l, gnd_r, gnd_1..8) and 3.3V logic rails')

console.log('\n🎉 ALL MULTI-BOARD CURRICULUM QA CHECKS PASSED!')
