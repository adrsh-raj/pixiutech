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
- [ ] Finish the all-lesson audit.
- [ ] Correct all confirmed lesson seed / mapping defects.
- [ ] Prevent stale Blockly code when selecting non-Beginner lessons.
- [ ] Add and run regression tests.
- [ ] Run build / lint / existing lab QA and inspect CI results.
- [ ] Review final diff and promote verified changes to `main`.

