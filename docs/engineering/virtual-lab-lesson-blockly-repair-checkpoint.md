# Virtual Lab Lesson / Blockly Integrity Repair Checkpoint

**Status:** In progress — audit checkpoint  
**Date:** 2026-11-09  
**Repository:** `adrsh-raj/pixiutech`  
**Base branch:** `main`  
**Base commit:** `b0ae12e1570861d73164b8230127a24d3425ee90`  
**Repair branch:** `fix/lesson-blockly-integrity-2026-11-09`

## User-reported failure

The Beginner mission **Mission 1 · Safe LED Blink** displays a circuit consisting of an Arduino Uno, one LED, and one current-limiting resistor, but the Blockly workspace generates a button-controlled police-strobe program that depends on D2, D12, and D8. The virtual circuit has no matching button, second LED, or buzzer, so the LED blink sequence never executes as intended.

## Confirmed root cause

- `pixiu-lms-portal/src/lib/lesson-engine.ts`: `lesson-led-basics` declares `templateId: "blink-led"` and has no lesson-specific `seedBlocklyXml`.
- `pixiu-lms-portal/src/lib/lesson-engine.ts`: `LESSONS` derives missing `seedBlocklyXml` values from the template referenced by `templateId`.
- `pixiu-lms-portal/src/lib/lesson-engine.ts`: `getLessonSeed()` automatically supplies seeded Blockly XML for Beginner missions.
- `pixiu-lms-portal/src/lib/templates.ts`: `blink-led` is actually **Dual Alternating Police Strobe (Red & Blue LEDs + Siren Buzzer)**, requiring a D2 pushbutton, D12/D13 LEDs, and D8 buzzer. Its Blockly XML matches the user's screenshot.

This establishes a lesson-to-template mapping error, not a Blockly C++ generator failure.

## Additional audit findings so far

Several other Beginner Arduino missions point to template IDs that do not exist in the current `TEMPLATES` list (including `g6-pushbutton-led`, `g6-pot-brightness`, `g6-buzzer-doorbell`, and `g6-rgb-mood-lamp`). The current fallback therefore yields the empty starter workspace for those missions. At least two other mapped template IDs resolve to projects whose titles/descriptions do not match their lessons (traffic-light and servo-sweep). These require a complete lesson-by-lesson review before repair is considered complete.

## Scope / constraints

1. Audit all 55 lessons across Arduino Uno, ESP32, Raspberry Pi Pico, and micro:bit v2.
2. Review beginner auto-seeded Blockly, and verify that Intermediate / Advanced lessons start with the intended blank starter rather than stale code left by the previously selected lesson.
3. Compare lesson goal, board, seed Blockly XML, required parts, expected pin usage, and lesson-step checks.
4. Add regression coverage for template references, beginner seed coverage, XML/program integrity, and selection/load reset behavior where feasible.
5. Verify repository checks and GitHub Actions before promoting the repair.
6. Keep changes on this repair branch until verification. Do not modify live portal settings or any system outside this GitHub repository.

## Checkpoint recovery

Resume from this branch and the latest commit. Re-read this file first, inspect the current branch head and changed files, then continue the audit without restarting completed work. Do not assume a repair is complete until the test results are recorded below.

## Verification log

- [x] Confirmed repository and base commit.
- [x] Created repair branch from the exact `main` head.
- [x] Reproduced the screenshot's code by matching it to the incorrect `blink-led` template source.
- [x] Audit all 55 lesson records across Arduino Uno, ESP32, Pico, and micro:bit.
- [x] Correct the six affected Beginner Arduino seeds with lesson-specific Blockly programs:
  - Mission 1: D13-only timed LED blink; no button/buzzer/tone blocks.
  - Mission 2: D2 digital input controls the D13 LED.
  - Mission 3: A0 analog read → 0–1023 to 0–255 map → D9 PWM output.
  - Mission 4: D2 button triggers an 880 Hz, 250 ms D8 chime and then stops it.
  - Mission 6: independent D9/D10/D11 RGB PWM channels.
  - Mission 7: D12/D11/D10 traffic-light cycle.
- [x] Remove the fragile lesson-to-template Blockly fallback. A project/template can no longer silently become a lesson's starter program.
- [x] Reset Blockly for every lesson selection, including Intermediate and Advanced; clear any held virtual buttons while switching/loading a lesson.
- [x] Repair malformed stored Blockly XML in Advanced Arduino Missions 21–23, DHT11 Intermediate Mission 12, and ESP32 Web Server Mission 10.
- [x] Extend test/circuit-lab/lesson-seed-integrity.test.mjs to validate every stored lesson seed XML (43 seeds), all 55 IDs/boards, 19 Beginner seeds, 36 blank non-Beginner workspaces, six repaired Arduino missions, and the 30 cross-board component references.
- [ ] Run the new and existing tests through GitHub Actions; inspect build/lint and CI results.
- [ ] Review final diff and promote verified changes to main.

## Current implementation commits

- 8d59a4a: explicit Arduino Beginner lesson Blockly seeds; removed stale template mapping from lesson composition.
- 4ec3c31: removed the remaining template lookup and aligned Mission 4 instructions/checks with the chime program.
- c2b8585: clear previous Blockly program and virtual button state when switching/loading lessons.
- b133742: added all-lesson seed integrity regression test.
- 3415ba3: corrected XML closing-tag parsing in the regression test.
- 3c91829: repaired malformed XML in Advanced AI confidence/presence/gesture lessons.
- 3b94f8e: validate every stored seed XML, including seeds intentionally not auto-loaded.
- aa23499: corrected nested block closure in AI presence/gesture programs.
- 64577ae: corrected ESP32 Web Server Mission 10 nested route/setup closures.
- e3040f7: repaired the DHT11 stored seed's missing closing `next`/block chain.
- 5299575: expanded component-reference assertions to all 40 seed circuits and corrected RGB pin assertions.

The three board-specific curricula (ESP32/Pico/micro:bit) were statically checked: each of their 30 Blockly seed programs has a non-empty program root and each non-empty SENSOR reference resolves to a part ID in that lesson's seedCircuit. Actual CI/runtime verification is still pending; do not mark the repair complete until those checks pass.

