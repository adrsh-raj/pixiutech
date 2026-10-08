import assert from "node:assert/strict"
import test from "node:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build } from "esbuild"

const outfile = join(tmpdir(), `circuit-solver-bundle-${Date.now()}.mjs`)
await build({
  entryPoints: [new URL("../../src/lib/circuit-solver.ts", import.meta.url).pathname],
  bundle: true,
  format: "esm",
  outfile,
  platform: "neutral",
  alias: {
    "@": new URL("../../src", import.meta.url).pathname,
  },
})

const { solveCircuitNodalPotentials } = await import(`file://${outfile}`)

test("DMM: Equipotential detection when probes are on the same 5V rail (Red on Uno 5V, Black on MQ2 VCC)", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "mq2", type: "mq2-gas", x: 260, y: 110, rotation: 0, props: { gasLevel: 150 } },
    ],
    wires: [
      { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "mq2", pinId: "vcc" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "mq2", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "uno", pinId: "5v" }
  const probeBlack = { partId: "mq2", pinId: "vcc" }

  const pd = solution.getPotentialDifference(probeRed, probeBlack, circuitState, {})

  assert.equal(pd.diff, 0, "Potential difference on same 5V wire must be 0.00V")
  assert.equal(pd.isWarning, true, "Must flag equipotential rail warning")
  assert.match(pd.explanation, /Equipotential Rail/i, "Explanation must mention Equipotential Rail")
  assert.match(pd.subtext, /BLACK probe.*to Ground/i, "Subtext must guide user to connect Black probe to Ground")
})

test("DMM: Single-Probe mode measures voltage referenced to Ground (Red on MQ2 VCC, Black null)", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
      { id: "mq2", type: "mq2-gas", x: 260, y: 110, rotation: 0, props: { gasLevel: 150 } },
    ],
    wires: [
      { id: "w_vcc", from: { partId: "uno", pinId: "5v" }, to: { partId: "mq2", pinId: "vcc" }, color: "#ef4444" },
      { id: "w_gnd", from: { partId: "uno", pinId: "gnd" }, to: { partId: "mq2", pinId: "gnd" }, color: "#1e293b" },
    ],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "mq2", pinId: "vcc" }

  const pd = solution.getPotentialDifference(probeRed, null, circuitState, {})

  assert.equal(pd.diff, 5, "Single probe on 5V pin must measure 5.00V referenced to GND")
  assert.match(pd.explanation, /Single Probe/i, "Explanation must indicate Single Probe mode")
  assert.match(pd.explanation, /5\.00V/i, "Explanation must show 5.00V")
  assert.match(pd.subtext, /Auto-GND active/i, "Subtext must mention Auto-GND")
})

test("DMM: Reversed Polarity detection with clear guidance", () => {
  const circuitState = {
    parts: [
      { id: "uno", type: "arduino-uno", x: 40, y: 110, rotation: 0, props: {} },
    ],
    wires: [],
  }

  const solution = solveCircuitNodalPotentials(circuitState, new Set(), {}, true)
  const probeRed = { partId: "uno", pinId: "gnd" }
  const probeBlack = { partId: "uno", pinId: "5v" }

  const pd = solution.getPotentialDifference(probeRed, probeBlack, circuitState, {})

  assert.equal(pd.diff, -5, "Red on GND and Black on 5V must measure -5.00V")
  assert.match(pd.explanation, /Reversed Polarity/i, "Explanation must mention Reversed Polarity")
  assert.match(pd.subtext, /Swap Probes/i, "Subtext must guide user to swap probes")
})
