# Virtual Lab Electrical Engine Audit — Resume Checkpoint

**Checkpoint updated:** 2026-11-09 (Asia/Kolkata)  
**Status:** AUDIT IN PROGRESS — no repair commit has been made yet  
**Working branch:** `fix/virtual-lab-electrical-engine-audit-2026-11-09`  
**Base commit:** `b5ec151c2392f560b5d5c4c85347f0ffa9795425` (PR #81 merge into `main`)  
**Rule:** Do not edit `main` directly. All changes and checkpoints belong on the working branch.

## User request / scope

Perform a production-readiness audit and repair of the entire Virtual Lab electrical model, not only the one potentiometer project:
- Audit every project template, component, pin endpoint, wire connection, and associated Blockly program.
- Audit the TypeScript simulation runtime, nodal solver, polarity detector, Circuit Doctor, component models, and board definitions.
- Fix PWM/LED behavior, reverse-polarity false positives, actual reverse polarity detection, and any other verified electrical/runtime defects.
- Make behavior data-driven from board/component definitions and circuit topology. Avoid template-specific hacks or hardcoded one-off template IDs.
- Add regression coverage and keep this checkpoint current after each meaningful milestone.

## Repository inventory captured

- `pixiu-lms-portal/src/lib/templates.ts`: 1454 lines, 142,028 characters.
  - `BASE_TEMPLATES` plus `EXTRA_TEMPLATES`; the regex scan found 23 `starter(...)` definitions in `EXTRA_TEMPLATES`. Base-template count and effective `TEMPLATES` count still need a parsed audit.
- Four board definitions live in `board-registry.ts`: Arduino Uno, ESP32 DevKit, Raspberry Pi Pico, micro:bit v2.
- Components are defined in `components-catalog.ts` and `circuit-types.ts`.
- Lesson inventory from merged PR #81: 55 curriculum lessons (25 Uno, 10 ESP32, 10 Pico, 10 micro:bit); lesson seeds are separate from the project-template catalogue and must also be checked where they contain circuits.
- Existing QA: `test/circuit-lab/*.test.mjs`, including `runtime-core.test.mjs`, `multimeter.test.mjs`, `current-flow.test.mjs`, and `lesson-seed-integrity.test.mjs`.

## Confirmed defects (source-level)

### A. False LED reverse-polarity detection

In `simulation.ts`, reverse polarity is currently inferred from two global shortest-path checks:
- any active source reaching LED cathode
- any ground sink reaching LED anode

The search crosses passive resistive components and unrelated signal paths. A potentiometer's normal 5V-to-GND divider creates a path that can make a correctly grounded LED cathode appear source-connected. A LOW output connected to an LED anode can also be treated as ground, although both LED terminals may simply be at 0V. This is not a valid voltage-polarity test.

`circuit-doctor.ts` maps that runtime string directly to the visible “LED Reverse Polarity” warning. The Doctor therefore reports a false warning for a correctly wired potentiometer template.

### B. PWM LED behavior is currently modelled as average voltage

The simulation turns a PWM duty value into an average DC voltage (`logicVoltage * duty`) before applying the LED forward-voltage threshold. A blue LED with Vf≈3.2V can therefore be reported dark at duties below roughly 64%, even though a real PWM GPIO still emits full-amplitude logic pulses and controls average LED brightness by duty cycle.

The multimeter solver also exposes a PWM average-voltage approximation; this must remain clearly distinguished from instantaneous pulse amplitude / duty-cycle brightness and should not be used to decide if a PWM LED conducts.

### C. Existing nodal solver is a reusable foundation, not yet proven sufficient

`circuit-solver.ts` already exports `solveCircuitNodalPotentials`, builds nets, models resistors and potentiometers, and uses modified nodal analysis. It currently sets PWM nets to an average output voltage and performs a reachability pre-check for diode branches. We need to reconcile its assumptions with the simulation runtime rather than blindly duplicate a second inconsistent solver.

## Initial exact source locations

- `pixiu-lms-portal/src/lib/simulation.ts`: LED runtime branch around lines 414–480; global activeSources/groundSinks and reverse path around lines 80–105 and 466–480.
- `pixiu-lms-portal/src/lib/circuit-doctor.ts`: LED warning mapping around lines 54–80.
- `pixiu-lms-portal/src/lib/circuit-solver.ts`: `solveCircuitNodalPotentials` starts around line 114; PWM fixed-net approximation around lines 385–410; nodal/diode model around lines 515–700.
- `pixiu-lms-portal/src/lib/templates.ts`: potentiometer dual-channel template `g6-pot-brightness` around lines 1002–1017. Its intended wiring uses 220Ω series resistors for both LED anodes, cathodes to Uno GND, pot terminals to 5V/GND, wiper to A0, and buzzer to D8/GND. The template is correctly wired in source.

## Resume protocol

When a connection times out or a new chat starts:
1. Read this file from `docs/engineering/virtual-lab-electrical-engine-audit-checkpoint.md`.
2. Check branch head and last commits:
   `https://api.github.com/repos/adrsh-raj/pixiutech/branches/fix/virtual-lab-electrical-engine-audit-2026-11-09`
3. Continue from the **Latest progress / next actions** section below. Do not repeat completed audit stages or create a new branch.
4. Do not merge or deploy without explicit user instruction. Keep `main` untouched.

## Latest progress / next actions

- [x] Pin exact base commit and create dedicated feature branch.
- [x] Inventory relevant source/test paths.
- [x] Confirm false polarity detector mechanism and PWM-average-voltage LED defect.
- [ ] Parse all effective `TEMPLATES` and extract all `CircuitState` definitions, including reusable template constants.
- [ ] Build a machine-readable topology audit for every project template and every curriculum seed circuit: unknown part/pin endpoints, dangling required pins, invalid duplicates, board pin validity, resistor polarity/series loops, power/ground, sensor/control wiring, Blockly-vs-circuit pin conflicts.
- [ ] Design one dynamic electrical contract shared by simulation, polarity detection, Doctor, and the nodal solver. Prefer component/board metadata; avoid project-id or template-id special cases.
- [ ] Repair PWM signal semantics and LED brightness/current calculation.
- [ ] Repair reverse polarity using actual solved node potentials / valid path conditions, preserving real reversed-diode detection.
- [ ] Audit remaining runtime models (potentiometer, pushbutton, sensors, displays, buzzer, RGB, motor driver, relay, servo, battery, breadboard, board rails).
- [ ] Add regression tests for every discovered bug and a catalogue-wide template audit.
- [ ] Run all Circuit Lab tests, build, lint, and the relevant GitHub Actions gates; update this checkpoint with exact commit/run IDs and remaining limitations.

**No repair has been made yet. This document is an audit checkpoint only.**
