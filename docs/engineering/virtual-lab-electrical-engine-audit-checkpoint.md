# Virtual Lab Electrical Engine Audit — Resume Checkpoint

**Checkpoint updated:** 2026-11-10 (Asia/Kolkata)  
**Status:** Electrical engine and catalogue topology audit implemented; latest Browser Gate green. PR remains draft.  
**Repository:** `adrsh-raj/pixiutech`  
**Working branch:** `fix/virtual-lab-electrical-engine-audit-2026-11-09`  
**Latest verified branch head:** `ef47fb2225a3f51033d2caab7862c1fc206eab8d`  
**Base commit:** `b5ec151c2392f560b5d5c4c85347f0ffa9795425`  
**Pull request:** [#82 — Virtual Lab electrical engine audit](https://github.com/adrsh-raj/pixiutech/pull/82)  
**PR state:** open, draft, mergeable, not merged.  
**Safety boundary:** `main` was not modified. No manual production deployment was performed.

## User request / scope

Audit and repair the whole Virtual Lab electrical model—not a single template:
- Effective project templates and curriculum seed circuits, including topology, required/optional pins, component references, board pin validity, polarity and resistor protection.
- Shared electrical metadata and consistent behavior across simulation runtime, nodal solver, waveform sampler, current-flow animation and Circuit Doctor.
- Correct PWM, DAC, tone, servo, LED/RGB, supply/ground and relay/motor behavior.
- Regression tests for discovered defects and a persistent checkpoint for resumption.

All source changes remain on the feature branch. Do not merge or deploy without explicit user instruction.

## Catalogue-wide audit result

The effective inventory was parsed from the exported template catalogue and curriculum:
- **35** effective project templates.
- **55** curriculum lessons, with **40** lessons containing seeded circuits.
- **75** circuits audited in total.
- **353** component instances and **586** wire endpoints/edges in that inventory.
- **0 topology/electrical errors and 0 warnings** on the latest catalogue audit.

Optional pins and component-specific alternatives are represented declaratively rather than being treated as mandatory wires. `requiredPinGroups` metadata now covers 27 catalogued component types. Relay contact requirements model COM plus either NO or NC; RGB and seven-segment segments are checked channel-by-channel.

The audit also rejects nominal resistor presence when a wire-only path bypasses the resistor. Pushbutton inputs with a power-side contact require a real physical pull-down in the current model; an `INPUT_PULLUP` declaration alone is not accepted because the runtime does not model that internal pull-up as an electrical resistor.

## Implemented source repairs

### Shared LED and electrical metadata
- Added `electrical-model.ts` to resolve LED forward voltage, nominal current and maximum current from component catalogue metadata, with per-instance electrical overrides.
- Simulation and nodal solver use the same LED electrical definition.
- RGB red, green and blue channels resolve their own forward-voltage values and current; the nodal solver models three separate diode branches.
- Corrected the insufficient-supply case: a 3V source cannot illuminate a white LED whose configured forward voltage is 3.3V, and the runtime reports zero current.
- Reverse-polarity detection uses signed solved node potentials across the LED terminals. It no longer treats an unrelated potentiometer divider or any remote power/ground path as proof of reverse polarity. A genuine reversed LED remains covered by regression tests.

### Signal semantics: PWM, DAC, tone and servo
- Pin state now carries explicit `outputMode`: digital, PWM, tone, servo or DAC.
- `pin-state.ts` replaces stale per-pin state across aliases when Blockly changes output mode, rather than leaving old duty/frequency/angle fields behind.
- Board pin lookup preserves `outputMode` and related fields across aliases; this fixed a real metadata-loss defect.
- PWM LED conduction uses full logic-level pulse amplitude; duty cycle scales average current and brightness. Nodal/DMM readings retain the average-voltage view, and waveform sampling retains instantaneous HIGH/LOW pulses.
- Tone uses its specified frequency; servo uses its timed pulse width. Neither is interpreted as steady DC HIGH.
- DAC is now treated as continuous analog output: the selected DAC-capable pin's voltage is scaled by its value, with duty 1 for load-current analysis. The peak LED analysis preserves DAC mode instead of coercing it to a digital HIGH. By contrast, `analogWrite` on the same DAC-capable pin remains PWM.
- Added regression coverage proving a 128/255 DAC output (~1.66V on ESP32) stays below the red LED's 1.9V forward voltage, while 3.3V PWM pulses at the same numeric setting illuminate the LED at non-zero duty.

### Electrical topology and curriculum/template repairs
- Added catalog electrical/connection metadata and component required-pin groups for 27 part types.
- Added 10kΩ pull-down networks to seven project templates with floating D2 pushbutton inputs: traffic-light, blink-led, servo-sweep, G6 pushbutton control, G6 RGB mood lamp, G6 smart doorbell and G7 servo gate.
- Corrected earlier verified lesson/template defects: micro:bit 3V rail pin, NeoPixel `DI` endpoint, missing buzzer in AI Smart Doorbell, and RGB current-limiting resistor topologies in ESP32/Pico lesson seeds.
- Pico Smart Farm lesson now includes a DC motor representing the pump. VBUS feeds relay COM, relay NO feeds pump positive, and pump negative returns to common GND. Lesson description, parts step, wiring step and regression tests all describe/require this contact path.
- Circuit Doctor continues to surface runtime LED burnout and signed reverse-polarity findings; its message mapping consumes the corrected runtime warning rather than independently guessing polarity from unrelated paths.

### Current-flow and power-domain behavior
- Signal GPIO sources/sinks are kept separate from actual board/battery supply and ground domains.
- Relay NO/NC contact animation follows `relayActive`, not the obsolete `level` field.
- DC motor current-flow detection follows runtime RPM/direction, not an LED-style level/speed assumption.
- L298N motor output pairs have internal current-flow links when the corresponding motor channel is active.
- Regression tests cover Pico relay coil energization, COM–NO motor power and the corresponding wire-current animation; the de-energized NO path has no pump current.

## Regression and CI verification

### Latest verified source head: `ef47fb2225a3f51033d2caab7862c1fc206eab8d`

**PIXIU CyberLab Browser Gate — SUCCESS**  
- Run: `42746619389`
- Job: `129600141918`
- `test:lab`: **158 tests, 158 passed, 0 failed**.
- Browser gate completed; output includes `PIXIU CyberLab browser gate PASSED` and `Runtime AI origin policy · PASS`.
- Catalogue audit in the same test run: 75 circuits, 353 parts, 586 wires, 0 errors, 0 warnings.

Other latest-head successful workflows:
- Phase 0–3 Gate: run `42746619348` — SUCCESS.
- Phase 4–6 Gate: run `42746619329` — SUCCESS.
- Phase 4–9 Reliability Gate: run `42746619709` — SUCCESS.
- Part 4 Current Verification: run `42746619340` — SUCCESS.
- Production Security Smoke: run `42746619304` — SUCCESS.
- Deployment Smoke Test workflows: runs `42746668901` and `42746647806` — SUCCESS.

### Known unrelated CI blocker

The following latest-head workflows fail after the public-site bundle itself builds:
- Phase 9 Final Green Gate: run `42746619344`.
- Production Verification: run `42746619262`.

Both report the same unrelated public website audit finding:

`src/pages/EightSquareAI.jsx -> interactive cursor/scroll reveal pattern detected`

The Production Verification job ran **180 Django backend tests; all passed** before the public website audit step failed. `EightSquareAI.jsx` is outside this Virtual Lab electrical repair, and has not been modified. Do not hide or bypass this finding by weakening the unrelated site audit.

## Current branch/PR safety status

- Latest branch head and PR head: `ef47fb2225a3f51033d2caab7862c1fc206eab8d`.
- PR #82 remains open, draft and mergeable; it is not merged.
- `main` remains untouched.
- No manual production deployment was performed.
- Deployment Smoke Test refers to the repository's CI workflow, not a manual production deployment.

## Next actions on resumption

1. Continue the remaining runtime/Doctor review for component-specific power and signal paths, sensor I/O, displays, servo, relay, motor driver, battery and breadboard edge cases.
2. Keep new fixes topology-driven and catalogue/board-metadata-driven; do not add template-ID exceptions.
3. Run the full test/build/reliability/browser gates after each meaningful source change. Record exact run IDs and outcomes here.
4. Keep the unrelated `EightSquareAI.jsx` public-site audit finding separate unless the user explicitly expands scope.
5. Do not merge PR #82, deploy, or modify `main` without explicit user instruction.

## Resume protocol

After a connection timeout or in a new chat:
1. Read this checkpoint.
2. Fetch the current branch head:
   `https://api.github.com/repos/adrsh-raj/pixiutech/branches/fix/virtual-lab-electrical-engine-audit-2026-11-09`
3. Inspect the latest commits and CI runs for PR #82.
4. Continue from **Next actions on resumption**. Do not recreate the branch or repeat completed audit stages.
