# Virtual Lab Electrical Engine Audit — Resume Checkpoint

**Checkpoint updated:** 2026-11-10 (Asia/Kolkata)  
**Status:** Follow-up audit added catalogue-driven real-rail checks, fail-closed sensor reads, powered servo control, LDR/pot divider topology validation, corrected potentiometer orientation, shared-wire current aggregation, and solver-backed passive/motor current calculations. Relay + LDR wire-current regressions pass on the last completed run; the latest test-only correction is under a fresh Browser Gate run. Do not call the current head fully green or production-ready until that run completes.  
**Repository:** `adrsh-raj/pixiutech`  
**Working branch:** `fix/virtual-lab-electrical-engine-audit-2026-11-09`  
**Latest source commit:** `3eed1ec8f059efa047a1f710592ca85fe81220dc`  
**Latest fully CI-verified Browser Gate checkpoint:** `24925d1a5a22cff1e45b4fb033f81479c17b1ed8` (168/168 tests; later follow-up commits still under validation).  
**Resume branch head at checkpoint:** `3eed1ec8f059efa047a1f710592ca85fe81220dc` (fetch the branch endpoint below before continuing).  
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
- RGB reverse polarity is now checked per channel using solved signed node potentials relative to the common cathode. A reverse-biased channel appears in runtime warning state and Circuit Doctor surfaces a dedicated RGB reverse-polarity issue; valid forward RGB wiring is covered by a no-warning regression.
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

### NeoPixel data protocol and Workbench execution
- The Blockly runner already exposed neopixel_set_color and neopixel_show, but the Workbench had not implemented their callbacks. The callbacks are now connected to a per-ring output buffer.
- neopixel_set_color stages a pixel color; neopixel_show latches the staged frame. A staged frame is not rendered until show() is called.
- The Workbench resolves the ring's DI pad through the circuit graph to a real board digital-output pin. The resolver follows direct wires, resistor continuity and breadboard rows/rails, and retains the exact wire endpoint spelling so board aliases do not break graph traversal.
- Simulation requires real VCC/GND power, a committed frame and a physical path from the resolved GPIO to the ring's DI pad before pixels can illuminate. A catalogue default pattern="rainbow" no longer lights an uncommanded, supply-only ring.
- PartArt's idle fallback is dark. Current-flow animation only shows pixel supply draw when at least one latched pixel is illuminated, and the DI signal path only while a committed frame is active.
- Regression tests cover supply-only/off behavior, staged-but-not-shown behavior, committed data on a wired DI pin, no illumination when DI is disconnected, and data/supply current-flow on the ring's actual catalogue pins.

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

### Latest fully verified source head: `afac7541c1577cbf086ce89d71342f4c1f4fe784`

**PIXIU CyberLab Browser Gate — SUCCESS**  
- Run: `42751508275`
- Job: `129615958672`
- `test:lab`: **164 tests, 164 passed, 0 failed**.
- Browser gate completed; output includes `Training verified: My AI learned 2 concepts.`, `PIXIU CyberLab browser gate PASSED` and `Runtime AI origin policy · PASS`.
- Catalogue audit in the same test run: 75 circuits, 353 parts, 586 wires, 0 errors, 0 warnings.

Other fully verified-head successful workflows:
- Phase 0–3 Gate: run `42751508171` — SUCCESS.
- Phase 4–6 Gate: run `42751508240` — SUCCESS (includes the updated NeoPixel runtime static assertions).
- Phase 4–9 Reliability Gate: run `42751508451` — SUCCESS.
- Part 4 Current Verification: run `42751508170` — SUCCESS.
- Production Security Smoke: run `42751508481` — SUCCESS.
- Deployment Smoke Test on the earlier source checkpoint: run `42688061090` — SUCCESS (CI smoke workflow, not a manual production deploy).

A final alias-only source fix was then committed as `94549fae71a065af1151a61ec6780688157f813f` to preserve the actual wire spelling when resolving a NeoPixel DI GPIO. Its fresh CI batch is running:
- Browser Gate: run `42751702032` — IN PROGRESS.
- Phase 0–3 Gate: run `42751701783` — SUCCESS.
- Phase 4–6 Gate: run `42751701794` — SUCCESS.
- Phase 4–9 Reliability Gate: run `42751701953` — SUCCESS.
- Part 4 Current Verification: run `42751701526` — SUCCESS.
- Production Security Smoke: run `42751701605` — IN PROGRESS.
- Production Verification: run `42751701513` — IN PROGRESS.
- Phase 9 Final Green Gate: run `42751701671` — FAILURE at the unrelated public-site audit below.

### Known unrelated CI blocker

The following latest-head workflows fail after the public-site bundle itself builds:
- Phase 9 Final Green Gate: run `42747448909`.
- Production Verification: run `42747448862` (still running Django backend verification when this checkpoint was prepared).

The latest Phase 9 run reports the same unrelated public website audit finding:

`src/pages/EightSquareAI.jsx -> interactive cursor/scroll reveal pattern detected`

The fully verified-head Production Verification run `42751508091` ran **180 Django backend tests; all passed** before the public website audit step failed. The same exact site-audit message is present on the later branch head's Phase 9 run `42751701671`. `EightSquareAI.jsx` is outside this Virtual Lab electrical repair, and has not been modified. Do not hide or bypass this finding by weakening the unrelated site audit.

## Current branch/PR safety status

- Latest branch head and PR head at checkpoint: `3eed1ec8f059efa047a1f710592ca85fe81220dc`.
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
---
## 2026-11-10 follow-up checkpoint — source head `3eed1ec8f059efa047a1f710592ca85fe81220dc`

Same branch and PR; no second branch, no main changes.

### New atomic commits
- `24925d1a5a22cff1e45b4fb033f81479c17b1ed8`: catalogue-driven required power/ground diagnostics; rotary encoder solver power gate; fail-closed live sensor reads; NeoPixel stop/reset cleanup and strict explicit ID targeting.
- `d9420805ba46d5b6576cd1246e4731bde34a2187`: servo requires real VCC/GND, explicit `outputMode="servo"`, and wired board-pin signal.
- `83154af16bea7eb9f5049dd3e4724699d8417d1c`: added LDR 10kΩ divider legs in ESP32 weather and G6 LDR templates; corrected potentiometer track orientation in runtime/nodal/ohmmeter models; added all-template/lesson LDR/pot topology audit and 0/380/512/700/1023 tests.
- `131d31ecd6d7fb700e4b0213835932658fe3b83b`: restored audit helper syntax.
- `502190677d9231a1d9e8f3d0cfacb2e5cfe0fbf4`: fixed duplicate ESP32 weather LDR return-wire ID.
- `434105436b4ae8641c97542be1ee378c93fed8ed`: Doctor now follows real board/battery power and breadboard copper rows/rails; GPIO HIGH is not module VCC; buzzer + is a signal pin; added regressions.
- `0663435fb08038368a6244fb197e742df86815f5`: shared-wire currents aggregate algebraically; resistor/LDR/pot internal paths; buzzer/motor/LDR/pot current calculated via solver instead of per-branch constants.
- `5674d977cc7bbeb10c5ed38c61a12ad0dbace170`: removed artificial minimum current from tracer; added dark/bright LDR current test.
- `cd43b455f9a4f0deade64f1f2c64731c662f64c9` + `b3e73271d0e479a0f2889fea94123daa34284a6f`: relay COM–NO/COM–NC switch branch in nodal solver; closed contact resistance corrected to 0.05Ω.
- `12105ebca00fc023153e98c0ef6b065c26343424`: added modeled resistance/current handling for LDR, motor and buzzer; direct solver current tests.
- `3eed1ec8f059efa047a1f710592ca85fe81220dc`: moved direct nodal LDR current assertion into runtime-core test bundle that imports the solver; test-harness correction only.

### Latest verification evidence
- Last fully green Browser Gate checkpoint: `24925d1a5a22cff1e45b4fb033f81479c17b1ed8`, 168/168 tests.
- On `12105ebca00fc023153e98c0ef6b065c26343424`, Browser Gate had 178 tests: 177 pass / 1 fail because the new direct solver test was in a bundle that did not import `solveCircuitNodalPotentials`.
- In that run, relay NO-contact motor-current test, dark/bright LDR wire-current test, potentiometer ADC values test, all-template/lesson passive-divider audit and the 75-circuit uniqueness/integrity audit passed.
- Latest Browser Gate for `3eed1ec8f059efa047a1f710592ca85fe81220dc`: run `42756899894`, job `129633250166`. At this checkpoint the Virtual Lab build, browser runner installation and preview start had passed; browser gate was still running. Fetch exact status before reporting PASS.
- Previous `b3e73271d0e479a0f2889fea94123daa34284a6f` workflows: Phase 0–3, Phase 4–6, Phase 4–9 Reliability, Part 4 Current Verification and Production Security Smoke passed. Browser Gate had relay/LDR current failures, fixed in follow-up. Production Verification and Phase 9 failed on unrelated `src/pages/EightSquareAI.jsx` public-site audit.

### Still open — not production-ready
1. Verify Browser Gate and all required workflows for the exact current head; don't infer green from a build step.
2. Remove remaining inline fixed current assumptions in `current-flow.ts` for RGB/seven-segment, servo, displays, ultrasonic, MQ-2/soil, DHT, PIR/IR, relay coil, NeoPixel and L298N. Move supported typical-load values to explicit electrical metadata or derive actual currents from solved branches. Label estimated loads as estimates when an internal load model is unavailable.
3. Review sensor input loading, display/sensor signal paths and parallel branches.
4. Inspect latest production/Django logs. Preserve the unrelated `EightSquareAI.jsx` public-site audit finding; do not weaken/bypass it.
5. Update this checkpoint on every meaningful milestone.

### Resume safety
- Repo `adrsh-raj/pixiutech`; branch `fix/virtual-lab-electrical-engine-audit-2026-11-09`; PR #82 open/draft, not merged.
- Base/main `b5ec151c2392f560b5d5c4c85347f0ffa9795425`; main untouched.
- Latest source/test head before this documentation commit: `3eed1ec8f059efa047a1f710592ca85fe81220dc`.
- No manual deployment.
- On resume, fetch branch endpoint and compare head before editing. Use parent-checked atomic commits; never force-push, reset, clean, merge, deploy or modify main without explicit authorization.

