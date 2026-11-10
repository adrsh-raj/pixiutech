# PIXIU CYBERLAB Virtual Lab — Current-Flow & Electrical Model Follow-up Checkpoint

**Checkpoint date:** 2026-11-10 (Asia/Kolkata)  
**Repository:** adrsh-raj/pixiutech  
**Scope:** Virtual Lab / PIXIU CYBERLAB only.  
**Checkpoint branch:** fix/virtual-lab-current-flow-model-audit-2026-11-10  
**Branch base at creation:** main @ 5e86bb161b6b9b372961df66671f636360b12ecc  
**Latest main commit inspected:** 5e86bb161b6b9b372961df66671f636360b12ecc  
**Status:** Audit in progress; do not treat current-flow visualization as physically accurate for every component yet.

## 1. Verified repository and merge state

- Confirmed repository is `adrsh-raj/pixiutech`, default branch `main`.
- Latest main commit is `5e86bb161b6b9b372961df66671f636360b12ecc`, message: `Merge Virtual Lab electrical engine audit`.
- Previous electrical audit feature branch `fix/virtual-lab-electrical-engine-audit-2026-11-09` is an ancestor of main and is now **1 commit behind main, 0 commits ahead**. Its changes have therefore already landed on main; do not merge that branch again.
- The checkpoint file that landed with the merge still contains historical statements saying PR #82 is open and main untouched. Those statements are stale after the merge and must not be relied on as current state.
- Combined commit status currently reports Vercel – portal and Vercel – pixiutech failures whose target URL is the account build-rate-limit page. These are infrastructure/account limits, not evidence of TypeScript or electrical-test failure.
- The GitHub connector's commit-workflow-runs endpoint returned no runs for the merge commit; this is not proof that no Actions workflows ran.

## 2. Prior completed audit evidence (historical baseline)

The previous checkpoint reports:
- Catalogue inventory: 35 effective project templates, 55 curriculum lessons (40 with seeded circuits), 75 total circuits, 353 parts, 586 wire endpoints/edges.
- Catalogue audit: 0 topology/electrical errors and 0 warnings.
- Browser Gate on source/test head `3eed1ec8f059efa047a1f710592ca85fe81220dc`, documented on checkpoint commit `49511ca8adb2b4108cd62a9ef135424b29451691`: 178/178 tests passed.
- The previous source checkpoint still had open follow-up work around fixed current assumptions and component load modeling. Do not call the entire Virtual Lab production-ready solely from catalogue audit or the 178-test Browser Gate.

## 3. New direct source finding on main

Inspected:
- `pixiu-lms-portal/src/lib/current-flow.ts`
- `pixiu-lms-portal/src/lib/circuit-solver.ts`
- `pixiu-lms-portal/src/lib/electrical-model.ts`
- `pixiu-lms-portal/src/lib/templates.ts`
- `pixiu-lms-portal/test/circuit-lab/current-flow.test.mjs`
- `pixiu-lms-portal/test/circuit-lab/runtime-core.test.mjs`
- `pixiu-lms-portal/package.json`

Confirmed issue: current-flow.ts still uses hard-coded nominal current values for multiple devices instead of the nodal solver's branch currents:
- RGB LED fallback: `redLevel * 15`, `greenLevel * 15`, `blueLevel * 15` mA.
- Seven-segment: 15 mA per active segment.
- Servo supply: 10 mA; signal: 5 mA.
- LCD/OLED supply: 15 mA; SDA/SCL: 4 mA each.
- Ultrasonic supply: 10 mA; TRIG/ECHO: 4 mA each.
- MQ-2 / soil moisture supply: 12 mA; AO: 4 mA.
- DHT11 supply: 8 mA; DATA: 4 mA.
- PIR/IR supply: 8 mA; output: 6 mA.
- Relay coil: 12 mA; input: 6 mA.
- NeoPixel ring/strip supply: 20 mA; data: 6 mA.
- L298N VS: 25 mA; logic 5V: 15 mA.
- LED fallback: level-scaled or 15 mA default when runtime current is absent.

These may be acceptable only as explicitly labelled illustrative estimates, not as measured/solved current. The UI currently receives them through the same `currentMa` flow state, which risks presenting estimates as physical measurements.

Additional algorithmic limitation: `traceComponentFlow` uses breadth-first search to select one upstream path and one downstream path. It then assigns the full component current to those selected wires. In circuits with parallel feeds, alternate return paths, or loops, this path-selection method can misrepresent branch distribution even if the component current itself is correct. Shared-wire algebraic aggregation helps for selected paths but does not solve the full network-flow allocation problem.

The nodal solver models resistors, LDRs, potentiometers, LEDs/RGB channels, relays and selected active sources/outputs. It does not yet provide explicit internal load models for every sensor/display/driver. Therefore simply replacing every constant with `computeCurrentBetweenPins` is not valid until the corresponding physical branch is represented in the solver.

## 4. Required next work

1. Inspect the remainder of `circuit-solver.ts` and `electrical-model.ts`; map which device terminals have real modeled branches and which are idealized outputs only.
2. Decide a truthful contract for current-flow UI:
   - solved current for explicitly modeled branches;
   - labelled estimate for components with documented typical-load metadata;
   - no numeric current animation where neither model nor defensible estimate exists.
3. Replace LED/RGB/seven-segment and supported passive/load hard-coded fallbacks with solved branch current where the solver genuinely models those branches.
4. Add explicit load metadata/models for selected sensor/display/servo/relay/driver components only where source/catalogue data supports a defensible model. Do not invent typical currents.
5. Fix path tracing so wire current comes from solved branch/net current rather than one arbitrary BFS path. Preserve topology, breadboard copper and alias semantics.
6. Add regression tests for series, parallel, shared feed/return, multiple return paths, open branches, reverse polarity, shorted sources, and current conservation (KCL).
7. Re-run `npm run test:lab`, build, lint, catalogue audit, Browser Gate and relevant reliability/security gates on the exact resulting commit. Record run IDs and exact outcomes.
8. Keep unrelated public-site audit findings (e.g. historical EightSquareAI.jsx check) separate; do not weaken unrelated checks.

## 5. Mathematical acceptance criteria

- KCL: algebraic sum of currents at every non-source node is approximately zero within a documented numerical tolerance.
- Ohm's law: resistor branch current equals signed voltage difference divided by resistance.
- Series circuit: every series branch carries the same current.
- Parallel circuit: branch currents sum to source current; branch currents follow branch resistance.
- Open switch/open branch: zero current through that branch.
- Relay NO/NC contacts: exactly one contact path conducts according to relay state; contact resistance is modeled consistently.
- LED: no forward current below its configured forward voltage; current limited by the actual series network; reverse bias is not reported as forward illumination.
- Potentiometer: endpoint and mid-track behavior agrees with its split resistance model and wiper node.
- LDR: resistance changes monotonically with light input and current follows the solved network.
- Power-domain correctness: GPIO signal current is not conflated with board supply current; supply rails and ground are not silently shorted by ideal fixed-source conflicts.

## 6. Safety / resume protocol

- Work only in `adrsh-raj/pixiutech`, Virtual Lab / PIXIU CYBERLAB scope.
- Continue on branch `fix/virtual-lab-current-flow-model-audit-2026-11-10` from the exact base above.
- Do not force-push, reset, clean, stash, rebase, or overwrite unrelated files.
- No production deployment.
- Do not merge follow-up work until exact-head tests and review pass. User has explicitly asked for main integration, but that does not waive test gates.
- If connection drops, fetch this checkpoint and current branch head first; compare against main before resuming.


## 7. Additional solver / current-measurement review (2026-11-10)

Further inspection of the MNA solver and its measurement helpers found these risks requiring targeted tests:

- `solveCircuitNodalPotentials` clamps every solved unknown node voltage with `Math.max(0, ...)`. This discards negative node potentials. If negative rails or reversed external supplies are within the supported circuit domain, the solver cannot represent them faithfully. Establish whether negative supplies are supported; either preserve signed node voltages and add tests, or explicitly constrain/document the simulator's supported voltage domain.
- Fixed voltage nets are inserted into a `Map` by iterating boards and batteries. A later source silently overwrites an earlier fixed voltage if two sources are wired onto the same net. Conflicting 3.3V/5V/9V sources or a direct source-to-source short can therefore be hidden instead of diagnosed. Add a source-conflict/short-circuit check before solving; never rely on iteration order.
- The MNA matrix receives a diagonal regularizer (`1e-9`) and rounds solved node potentials to 3 decimals before later calculations. Validate that the regularizer does not create misleading finite readings on floating/high-impedance nodes, and quantify the error for large resistance ratios.
- The active diode set is chosen using reachable fixed source voltages, then rechecked for at most two solve passes. Add cases for multiple LED branches, series diodes, reverse-biased branches and mixed source networks to prove convergence and correct current limiting.
- The current measurement helper's LED path falls back to runtime level/current estimates rather than deriving current from the actual diode branch; ensure its result matches solver branch current when the resistor, supply voltage or LED forward voltage changes.
- The ohmmeter resistance path uses shortest-path resistance for resistors/potentiometers; this is not equivalent resistance for parallel networks. Verify whether this UI is meant to measure a component path or whole-network equivalent resistance; if the latter, implement a network equivalent-resistance solve instead of Dijkstra's shortest path.

### Priority order
P0: detect conflicting ideal voltage sources / shorts; eliminate false current readings on parallel networks.  
P1: current-flow branch allocation and remove unlabeled fixed current constants.  
P1: signed voltage support (or explicit non-support) and diode convergence tests.  
P2: validate resistance-meter semantics and floating-net numerical tolerances.

No source-code fix has been applied in this follow-up yet. The only change on this branch so far is this persistent audit checkpoint. Do not describe the current-flow or MNA implementation as fully audited or mathematically certified.
