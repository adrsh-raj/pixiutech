# PIXIU CYBERLAB Virtual Lab — Electrical Solver & Current-Flow Audit Checkpoint

**Checkpoint date:** 2026-11-10 (Asia/Kolkata)  
**Repository:** adrsh-raj/pixiutech  
**Scope:** Virtual Lab / PIXIU CYBERLAB only.  
**Branch:** fix/virtual-lab-current-flow-model-audit-2026-11-10  
**Branch base:** main @ 5e86bb161b6b9b372961df66671f636360b12ecc  
**Verified source/test head:** 6945fb098770fef26273aad69c716d32ae9427ad  
**Pull request:** #83 — https://github.com/adrsh-raj/pixiutech/pull/83  
**Status:** Implementation and exact-head CI verification complete, including board VIN/VSYS power-input correction. PR merge is pending the final integration action. Do not call every component model datasheet-accurate; see limitations below.

## 1. Repository and branch state

- Work was performed only in `adrsh-raj/pixiutech`, on the feature branch above.
- The branch was created from main at `5e86bb161b6b9b372961df66671f636360b12ecc`.
- The earlier Virtual Lab electrical-engine audit branch was already merged into main before this follow-up; it was not re-merged.
- PR #83 contains the follow-up electrical solver, current-flow, model metadata, tests and this checkpoint.
- No production deployment or direct write to main was performed during implementation.
- PR changes are limited to 16 Virtual Lab/board-registry/validator/test/engineering files. The implementation branch accumulated multiple API commits during incremental work; use a squash merge to land the reviewed result as one main commit.

## 2. Implemented electrical solver and measurement changes

### Nodal solver / MNA
- Added deterministic detection of conflicting ideal voltage sources on one equipotential net. A conflict produces a solver diagnostic; the complete connected conducting network is invalidated rather than displaying fabricated currents. Independent valid circuits remain measurable.
- Preserved signed node potentials, including negative battery rails.
- Replaced the fixed two-pass diode heuristic with an iterative active-set solve. Reverse-current diode branches are removed; forward-biased branches are added; non-convergence emits a diagnostic and fails safe by opening diode branches.
- Exposed signed component branch currents and algebraic net-current sums.
- Added/retained explicit branches for resistors, LDRs, potentiometer legs, LEDs/RGB channels, seven-segment diodes, relay contacts, active buzzer proxy, DC motor proxy, conducting NPN transistor, module supply loads, NeoPixel pixel loads and L298N motor-driver supply/output behavior.
- L298N outputs use a first-order average-DC model derived from runtime direction/PWM and VS supply. Connected 50Ω motor-winding proxy current is reflected back to the driver supply branch.
- The 1A test-source equivalent-resistance solve includes series and parallel passive paths; the shortest-path/Dijkstra resistance shortcut was removed.
- A passive piezo buzzer is not treated as a fixed 100Ω DC resistance in ohmmeter mode.

### Current-flow routing
- Replaced the one-path BFS allocation with a conductor-network KCL solve. Component branch currents are injected at their terminals, then distributed through physical wire and internal copper edges.
- Wire and breadboard conductors use explicit small resistance values for deterministic current sharing; relay and transistor pass-through paths are represented as conductor edges and are not double-counted as both edge and branch-current injection.
- Fixed-voltage boundaries are limited to actual board rails/GPIO sources, battery terminals and explicitly modeled sensor outputs. Wire-attached component pins remain unknown nodes so physical wire voltage drops can be solved.
- Legacy GPIO `OUTPUT LOW` states are recognized as fixed 0V sinks in current animation.
- Removed numeric hard-coded current fallback values from `current-flow.ts`; there are no fixed `currentMa` literals left in that file.
- Digital data/control pins are not represented as fabricated continuous DC current paths.

### Multimeter
- Direct probes across any modeled component branch now read that branch's signed MNA current (reported by magnitude), including RGB channels and seven-segment segments.
- Source-to-return current is the algebraic sum of solved branch currents at the driven source net, not a sum of stale `runtime.currentMa` fields.
- Equivalent resistance is solved across the passive network with a 1A test source, so parallel branches count even when the probes are directly across one resistor's terminals.
- Conflicted source nets produce a voltage warning rather than a plausible-looking numeric reading.
- Negative voltage-source current is covered by a regression test.

## 3. Component electrical-model coverage

- Added `ELECTRICAL_MODEL_CONTRACT` for **32/32 catalogue component types**. Each entry declares a model name, fidelity (`idealized`, `first-order`, `estimated`, `partial` or `signal-only`) and a plain-language limitation.
- Added **14 catalogue supply-load metadata records** covering generic servo, relay, LCD/OLED, ultrasonic, PIR/IR, DHT11, soil-moisture, MQ-2, L298N logic supply, joystick tracks and TMP36 teaching models.
- All generic module-load numbers are labelled `module-estimate` and have caveat/provenance notes. No exact manufacturer module variant was supplied, so none is represented as a datasheet-verified current.
- NeoPixel ring current is derived from the runtime pixel colours and a catalogue per-channel current estimate; data-pin pulse current is not invented.
- Passive and active components without a defensible static supply load are described as switch, passive-network, signal-only or partial models instead of being assigned a fake generic current.

### Explicit fidelity limitations

This is an auditable teaching simulator, not SPICE or a hardware power-budget sign-off. Specifically:
- MCU boards and regulator rails are ideal voltage boundaries; board quiescent current, regulator loss, source resistance and GPIO output resistance are not modeled.
- The existing board registry treats its declared VIN/VBUS/VSYS supply entries as nominal ideal 5V boundaries; the input/regulator/USB diode behavior of physical board revisions is not simulated.
- Generic sensor/display/servo/relay module loads are resistor-equivalent estimates. Exact board revision, pull-ups, LEDs, regulator and manufacturer current specifications are unknown.
- Servo torque, stall and acceleration current are not simulated.
- DC motor is a 50Ω winding proxy; back-EMF, inductance, mechanical load and stall transients are not modeled.
- L298N output voltage is a first-order average-PWM approximation; transistor voltage drops, switching edges, recirculation paths and motor back-EMF are not modeled.
- Active buzzer uses a limited 100Ω tone-active proxy; real piezo impedance is frequency-dependent. DC ohmmeter mode treats a passive piezo as open/reactive, not as a resistor.
- LED/RGB/seven-segment models use piecewise-linear forward-voltage plus a 10Ω dynamic-resistance proxy; temperature, thermal runaway and LED burnout physics are not solved by MNA.
- Breadboard contact resistance/rail segmentation, switch bounce and other parasitics are simplified.

## 4. Exact-head verification evidence

All runs below are for source/test head `47a87eeab6263822a8ab64881b5edc5ae40d3b71` (2026-11-10).

| GitHub Actions workflow | Run ID | Result |
|---|---:|---|
| PIXIU CyberLab Browser Gate | 42784844537 | PASS |
| PIXIU Production Verification | 42784844172 | PASS |
| PIXIU Phase 9 Final Green Gate | 42784844529 | PASS |
| PIXIU AI Lab Phase 4-6 Gate | 42784844559 | PASS |
| PIXIU AI Lab Phase 4-9 Reliability Gate | 42784844207 | PASS |
| PIXIU Part 4 Current Verification | 42784844264 | PASS |
| PIXIU AI Lab Phase 0-3 Gate | 42784844222 | PASS |
| PIXIU Production Security Smoke | 42784844183 | PASS |

### Browser Gate / electrical audit details

- `test:lab`: **193 tests, 193 pass, 0 fail**.
- Project templates: **35**.
- Curriculum lessons: **55**, of which **40** contain seeded circuits.
- Total circuits audited: **75**.
- Parts in those circuits: **355**.
- Wires in those circuits: **590**.
- Topology/electrical audit: **0 errors, 0 warnings**.
- The 75-circuit solver audit runs `computeRuntime()` for each circuit, passes the resulting runtime into MNA, asserts finite node voltages/branch currents, rejects source-conflict/diode non-convergence diagnostics, and checks each non-source/non-floating/non-conflicted net for KCL residual <= **0.01mA**.
- Browser Gate reports: `PIXIU CyberLab browser gate PASSED`.
- Browser evidence artifact: `pixiu-cyberlab-browser-evidence`, artifact ID `13748871132`.
- The separate Phase 9 final gate also passed its source/build, public-site, AI test and browser verification stages.
- Production Verification passed Django backend checks, public-site build/audit, LMS lint/security scans and production build. Lint reported **257 warnings and 0 errors**; warnings were not suppressed.
- Production Release Report: **all 10 acceptance gates passed** for the Phase 2 corpus (796 released records).

## 5. Deployment-provider status (separate from code/test gates)

- Netlify deploy preview for PR #83: **success**, URL https://deploy-preview-83--clever-sopapillas-afab2e.netlify.app
- Vercel – portal: failure state points to the Vercel account `build-rate-limit` page.
- Vercel – pixiutech: failure state points to the same Vercel account `build-rate-limit` page.
- These Vercel statuses are a provider/account build-rate-limit issue, not a failing GitHub Actions build or electrical test. They remain an external deployment blocker until the provider quota/account limit clears or is addressed.

## 6. Mathematical regression coverage

The test suite includes:
- Series resistors: equal branch current and KVL voltage-drop sum.
- Parallel resistors: branch currents follow resistance and sum to total current.
- KCL at solved internal nets and conductor-wire current conservation.
- Parallel physical wire routes: current division by conductor resistance, with shared return carrying the sum.
- Source conflict: incompatible ideal sources invalidate the full connected network while independent valid circuits continue.
- Negative battery voltage and negative-rail ammeter current.
- LED forward/off behavior, reverse polarity and diode active-set safety.
- Relay NO/NC contact and coil current behavior.
- L298N channel direction/PWM output voltage and VS supply current.
- RGB/seven-segment direct DMM branch-current readings.
- Parallel equivalent resistance when probing across one element.
- Passive piezo buzzer treated as an open/reactive DC ohmmeter path.
- Legacy GPIO OUTPUT LOW sink current routing.
- 32/32 catalogue electrical-model contract coverage and supply-load pin/provenance validation.

## 7. Main integration / resume protocol

- The source/test head above is fully verified. PR #83 is open against main; squash merge is the intended integration method so main receives one coherent commit.
- Merge only this PR once; do not re-merge the earlier electrical-engine audit branch.
- Do not force-push, reset, clean, stash, rebase or overwrite unrelated files.
- Do not treat this simulator as hardware power-budget certification. Retain the fidelity limitations above in any user-facing claims.
- After merge, verify main's merge SHA and confirm the PR state. Do not report success until GitHub confirms the merge.


## 8. Board power-input semantics correction (2026-11-10)

A cross-file review found that raw power-input pins were being treated as fixed 5V board sources in the solver, simulation, current-flow router and validators. This was physically incorrect for boards whose VIN/VSYS pins are external inputs.

### Corrected roles

- **Arduino Uno R3:** VIN is an input-only regulator terminal with a recommended external range of 7–12V. It is no longer a fixed 5V source; the regulated 5V and 3V3 rails remain modeled outputs. Official Arduino documentation identifies Uno Rev3 VIN as voltage input and states the 7–12V recommended range: https://docs.arduino.cc/learn/electronics/power-pins/ and https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf
- **ESP32 DevKit V1:** the VIN/5V header is modeled as a dual-role 5V input/output in the default USB-powered state; the 3V3 pin remains an output source. Espressif documents USB, 5V+GND and 3V3+GND as mutually exclusive supply options: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html
- **Raspberry Pi Pico:** VBUS is a USB 5V input and the default USB-powered 5V rail; VSYS is an input-only system rail with a 1.8–5.5V range and is not treated as a fixed 5V source. Official sources: https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html and https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf
- **micro:bit V2:** 3V is dual-role: input if the board is externally powered through that pin, and output when the board is powered by USB/battery. The simulator documents/assumes the default USB/battery-powered output state. Source: https://makecode.microbit.org/device/Pins and https://tech.microbit.org/hardware/power-supply/

### Code paths aligned

- Added BoardPowerInputSpec metadata with pin ID, min/max/nominal voltage, role and description.
- getPinVoltage() now returns undefined for input-only VIN/VSYS pins; it no longer falls through to the MCU's logic voltage.
- circuit-solver.ts, simulation.ts and current-flow.ts use only actual v5/v33 board output rails as fixed sources/anchors. Raw vin inputs are not board supply sources.
- circuit-doctor.ts no longer treats raw VIN as an available supply for connected modules. It still includes power-input pins in direct-short detection.
- circuit-validator.ts no longer appends raw VIN/VSYS to the 5V source group. It checks externally connected battery/board output voltage against each board's declared power-input range, warning on undervoltage and rejecting overvoltage.
- The 75-circuit template solver audit no longer classifies raw VIN/VSYS as an ideal source.

### VIN/VSYS regression tests

Added tests proving:
- Uno VIN and Pico VSYS are floating/input-only when no external supply is connected.
- Uno 5V and Pico VBUS remain 5V source outputs in the default powered-board model.
- Uno 5V connected into VIN triggers the 7V minimum warning; 9V is accepted; 13V exceeds the 12V maximum.
- Pico VSYS accepts 5V but rejects 9V.
- The release validator no longer emits a false direct 5V-to-GND classification merely because a raw VIN input is part of the board definition.

## 9. Final exact-head verification (2026-11-10)

All eight GitHub Actions workflows completed successfully on source/test head 6945fb098770fef26273aad69c716d32ae9427ad:

| Workflow | Run ID | Result |
|---|---:|---|
| PIXIU CyberLab Browser Gate | 42788280884 | PASS |
| PIXIU Production Verification | 42788280933 | PASS |
| PIXIU Phase 9 Final Green Gate | 42788281172 | PASS |
| PIXIU AI Lab Phase 4-6 Gate | 42788281090 | PASS |
| PIXIU AI Lab Phase 4-9 Reliability Gate | 42788280890 | PASS |
| PIXIU Part 4 Current Verification | 42788280961 | PASS |
| PIXIU AI Lab Phase 0-3 Gate | 42788281356 | PASS |
| PIXIU Production Security Smoke | 42788281439 | PASS |

Browser Gate on this exact head:
- 197 tests, 197 pass, 0 fail.
- 35 project templates + 40 curriculum seed circuits = 75 circuits.
- 55 curriculum lessons total.
- 355 parts, 590 wires.
- Topology audit: 0 errors, 0 warnings.
- The runtime-aware MNA/KCL circuit audit runs every circuit with computed runtime state, checks finite voltages/currents, rejects solver diagnostics, and enforces KCL residual <= 0.01mA at every non-source/non-floating/non-conflicted net.
- Includes the three new VIN/VSYS input-role and release-validation regressions.

Production Verification:
- Django backend verification: PASS.
- Public website build/audit: PASS.
- LMS lint, safety scans and production build: PASS.
- Lint: 257 warnings, 0 errors; warnings are reported, not suppressed.
- Live launch smoke step: skipped in this PR verification workflow; no production deployment was performed.
- Production Release Report: all 10 dataset acceptance gates passed for 796 released records.

Deployment providers:
- Netlify PR preview: PASS, https://deploy-preview-83--clever-sopapillas-afab2e.netlify.app
- Vercel – portal and Vercel – pixiutech: provider/account build-rate-limit failures. These are external deploy-provider blockers, not failed GitHub Actions build/test gates.

## 10. Final merge state

- Exact source/test head above passed all 8 GitHub Actions workflows.
- PR #83 is open against main, mergeable, and has no review threads/inline objections recorded at last review.
- Intended integration is one squash merge of PR #83 only. Do not merge the earlier electrical-engine audit branch again.
- Preserve all fidelity notes above: this is a teaching simulator, not SPICE or hardware power-budget certification.
