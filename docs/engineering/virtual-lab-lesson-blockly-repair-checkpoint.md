# Virtual Lab Lesson / Blockly Integrity Repair Checkpoint

**Status:** Virtual Lab and AI/CyberLab checks green on feature branch; PR open. Only the separate public marketing-site audit remains failing.  
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

Several other Beginner Arduino missions referenced missing or mismatched project-template IDs. Those references and the template fallback have been removed; each Beginner lesson now receives its own explicit Blockly starter. Intermediate and Advanced missions load a clean program root instead of inheriting stale code from the previously selected lesson.

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
- [x] Correct external pushbutton wiring in Arduino, ESP32 and Pico button missions with 10kΩ pull-down resistors so released inputs are not left floating.
- [x] Make doorbell Mission 4 play one chime per press and wait for the physical button release before retriggering.
- [x] Complete ESP32 Mission 10 phone control with root dashboard plus `/red/on`, `/red/off`, `/blue/on`, and `/blue/off` routes; align wiring and code checks with both LED channels.
- [x] Fix power-domain detection in `simulation.ts`: GPIO HIGH/LOW pins remain signal sources/sinks and cannot falsely power sensors or L298N drivers. Dedicated board rails or a battery positive/negative pair must provide a real source and return path in the same connected power domain.
- [x] Add runtime regression coverage for actual seeded ESP32/Pico pull-down voltage behavior, manual Arduino pull-down voltage behavior, unpowered sensors, GPIO-only false supply/ground, and a correctly powered L298N motor.
- [x] Validate 55 unique lesson IDs across four boards, 19 Beginner seeds, 36 blank Intermediate/Advanced workspaces, all 47 stored Blockly XML definitions (including reusable XML constants), and all 40 seeded-circuit sensor references.
- [x] Update the Phase 4–6 static contract to assert the current multi-board `findBoardPinState` bridge and current runtime memoization rather than obsolete Arduino-only code strings.
- [x] Align the browser gate's welcome-screen assertion with the actual shipped `8 Square AI` announcement/coming-soon behavior; it no longer claims that a live conversational Copilot panel exists.
- [x] GitHub Actions at `ced93d1` passed Virtual Lab Build Virtual Lab (including `npm run test:lab`, `npm run test:copilot`, and `npm run build`), Phase 4–6, Part 4 Current, Phase 4–9 Reliability, Phase 0–3, and deployment smoke checks.
- [x] Re-run browser gate against current branch head `161d145`; it passed through Blockly hydration, AI camera/pose/hands/emotion/sound lifecycle, My AI train/persist/predict, and same-origin runtime checks.
- [x] Re-run Phase 4–6, Part 4 Current, Phase 4–9 Reliability, Phase 0–3, production security smoke, and deployment smoke against current branch head `161d145`; all passed.
- [x] Review PR diff and mergeability; PR #81 is open, mergeable, and unmerged.
- [ ] Final production verification is still running at the last check. Phase 9 Final Green Gate has one separate failure: the unchanged public marketing audit flags `src/pages/EightSquareAI.jsx` for an interactive cursor/scroll reveal pattern after the source/build and security stages pass. This file is outside the Virtual Lab repair.

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
- 2909053: added 10kΩ pull-down networks and wiring checks to Arduino Mission 2 and Mission 4.
- d461af8: added 10kΩ GPIO4 pull-down to ESP32 button mission.
- 02c8f98: added 10kΩ GP14 pull-down to Pico button mission.
- d7552ce: added lesson-level pull-down wiring regression assertions.
- 0313f7b: added nodal-solver voltage test for released/pressed pull-down input.
- e3040f7: repaired the DHT11 stored seed's missing closing `next`/block chain.
- 5299575: expanded component-reference assertions to all 40 seed circuits and corrected RGB pin assertions.
- 9feb231: updated Phase 4–6 static checks to require the current board-registry-based L298N and reactive runtime paths.
- f8895b3 / d7552ce / 0313f7b: added and tightened pull-down wiring and nodal-voltage regression coverage.
- 2258617: completed ESP32 Mission 10 dashboard and all four light routes using an explicit lesson seed.
- 33caf0f: made the smart doorbell wait for release, avoiding repeated chimes while held.
- d12038e / d56759a / 218c14d: separated logic GPIO sources/sinks from actual component power; paired supply rails with their correct ground-return domain.
- 2ab6c2c / ced93d1: added negative and positive runtime tests for sensor and L298N supply/ground behavior; ensure the MCU common ground is shared.
- edea006: aligned the first-run browser test with the actual 8 Square announcement rather than an unimplemented AI chat panel.
- e5ac28d: extended the Phase 4–6 static gate to assert supply/ground-domain validation.

The three board-specific curricula (ESP32/Pico/micro:bit) were statically checked: each of their 30 Blockly seed programs has a non-empty program root and each non-empty SENSOR reference resolves to a part ID in that lesson's seedCircuit. Actual CI/runtime verification is still pending; do not mark the repair complete until those checks pass.



## Latest verified run summary — 2026-11-09, branch head `161d14596031b26974c8b25a357ad5d012b6909f`

- Browser gate run `42666897808`: **PASS**. It reached `PIXIU CyberLab browser gate PASSED` and `Runtime AI origin policy · PASS`; My AI training reported two learned concepts.
- Phase 4–6 Gate run `42666898115`: **PASS** — portal lint, Phase 4–6 static gate, AI static contract, AI executable regression matrix, and production build.
- Part 4 Current Verification run `42666897576`: **PASS**.
- Phase 4–9 Reliability run `42666897724`: **PASS**.
- Phase 0–3 Gate run `42666898140`: **PASS**.
- Deployment smoke run `42666931463`: **PASS**.
- Production Security Smoke run: **PASS**.
- Production Verification run `42666897962`: still in progress at the last status read; prior equivalent runs passed Django/backend checks and then stopped at the same separate website audit.
- Phase 9 Final Green Gate run `42666897714`: failed only at `Verify public website build and audit`; the audit reports `src/pages/EightSquareAI.jsx -> interactive cursor/scroll reveal pattern detected`. Its security gate, Part 4 gate, and source/build final gate all passed.
- No changes were made to `src/pages/EightSquareAI.jsx`; no merge or manual deployment was performed.

