import type { PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"
import type { PartRuntime } from "./part-art"

interface Props {
  part: PlacedPart | null
  runtime?: PartRuntime
  partCount: number
  wireCount: number
  onChangeProp: (id: string, key: string, value: string | number) => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

const LED_COLORS = ["red", "green", "blue", "yellow", "white"]
const RESISTOR_VALUES = [220, 330, 1000, 10000]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function Inspector({ part, runtime, partCount, wireCount, onChangeProp, onRotate, onDelete, onDuplicate }: Props) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Inspector</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!part ? (
          <div className="flex flex-col gap-4">
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Select a component on the canvas to edit its properties.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-card p-3">
                <div className="font-mono text-2xl text-foreground">{partCount}</div>
                <div className="text-[11px] text-muted-foreground">components</div>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="font-mono text-2xl text-foreground">{wireCount}</div>
                <div className="text-[11px] text-muted-foreground">wires</div>
              </div>
            </div>
            <div className="rounded-md border border-border bg-card/50 p-3">
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shortcuts</h3>
              <ul className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                <li>Click a pin, then another to wire</li>
                <li>Drag empty space to pan</li>
                <li>Scroll to zoom</li>
                <li>Click a wire to delete it</li>
                <li>
                  <kbd className="rounded bg-secondary px-1 font-mono text-[10px]">Esc</kbd> cancels wiring
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <div className="font-medium text-foreground">{CATALOG[part.type].name}</div>
              <div className="font-mono text-[11px] text-muted-foreground">#{part.id.slice(0, 8)}</div>
            </div>

            {part.type === "led" && (
              <>
                <Field label="Electrical Status">
                  {runtime?.burnt ? (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">
                      <div className="font-bold flex items-center gap-1.5 text-red-300">
                        <span>💥 Destroyed (Overcurrent)</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                        Direct connection without a resistor! Current reached {runtime.currentMa} mA (Max safe: 20 mA). Connect a 220Ω resistor!
                      </p>
                    </div>
                  ) : runtime?.level && runtime.level > 0 ? (
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-400">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                        <span>✅ Safe & Optimal Operation</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Current: {runtime.currentMa} mA (Protected by {runtime.resistorOhms}Ω resistor)
                      </p>
                    </div>
                  ) : runtime?.warning ? (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-300">
                      <span>⚠️ {runtime.warning}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-800 border border-slate-700 p-2 text-xs text-slate-400">
                      <span>⚪ Inactive / OFF (0 mA)</span>
                    </div>
                  )}
                </Field>

                <Field label="Color">
                <div className="flex flex-wrap gap-2">
                  {LED_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onChangeProp(part.id, "color", c)}
                      className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-sidebar transition ${
                        part.props.color === c ? "ring-primary" : "ring-transparent"
                      }`}
                      style={{ backgroundColor: c === "white" ? "#f5f5f5" : c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </Field>
            </>
          )}

            {part.type === "resistor" && (
              <Field label="Resistance (Ω)">
                <div className="grid grid-cols-2 gap-2">
                  {RESISTOR_VALUES.map((v) => (
                    <button
                      key={v}
                      onClick={() => onChangeProp(part.id, "resistance", v)}
                      className={`rounded-md border px-2 py-1.5 font-mono text-xs transition ${
                        Number(part.props.resistance) === v
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {v >= 1000 ? `${v / 1000}k` : v}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {part.type === "potentiometer" && (
              <Field label={`Value: ${part.props.value ?? 512} / 1023`}>
                <input
                  type="range"
                  min={0}
                  max={1023}
                  value={Number(part.props.value ?? 512)}
                  onChange={(e) => onChangeProp(part.id, "value", Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </Field>
            )}

            {part.type === "servo" && (
              <>
                <Field label={`Angle: ${part.props.angle ?? 90}°`}>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    value={Number(part.props.angle ?? 90)}
                    onChange={(e) => onChangeProp(part.id, "angle", Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
                <Field label="Arm Attachment">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onChangeProp(part.id, "arm", "horn")}
                      className={`rounded-md border px-2 py-1.5 text-xs transition ${
                        part.props.arm !== "barrier"
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      Horn
                    </button>
                    <button
                      onClick={() => onChangeProp(part.id, "arm", "barrier")}
                      className={`rounded-md border px-2 py-1.5 text-xs transition ${
                        part.props.arm === "barrier"
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      🚧 Boom Barrier
                    </button>
                  </div>
                </Field>
              </>
            )}

            {/* ═══════ NEW SENSOR CONTROLS ═══════ */}

            {part.type === "rgb-led" && runtime && (
              <Field label="Color Preview">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full border-2 border-slate-600"
                    style={{
                      backgroundColor: `rgb(${Math.round((runtime.redLevel ?? 0) * 255)}, ${Math.round((runtime.greenLevel ?? 0) * 255)}, ${Math.round((runtime.blueLevel ?? 0) * 255)})`,
                      boxShadow: (runtime.redLevel || runtime.greenLevel || runtime.blueLevel) ? `0 0 12px rgb(${Math.round((runtime.redLevel ?? 0) * 255)}, ${Math.round((runtime.greenLevel ?? 0) * 255)}, ${Math.round((runtime.blueLevel ?? 0) * 255)})` : "none",
                    }}
                  />
                  <div className="text-[11px] text-slate-400 font-mono leading-tight">
                    <div>R: {Math.round((runtime.redLevel ?? 0) * 255)}</div>
                    <div>G: {Math.round((runtime.greenLevel ?? 0) * 255)}</div>
                    <div>B: {Math.round((runtime.blueLevel ?? 0) * 255)}</div>
                  </div>
                </div>
              </Field>
            )}

            {part.type === "ultrasonic" && (
              <Field label={`Distance: ${part.props.distance ?? 100} cm`}>
                <input
                  type="range"
                  min={2}
                  max={400}
                  value={Number(part.props.distance ?? 100)}
                  onChange={(e) => onChangeProp(part.id, "distance", Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>2cm</span>
                  <span>400cm</span>
                </div>
              </Field>
            )}

            {part.type === "pir-sensor" && (
              <Field label="Motion Trigger">
                <button
                  onClick={() => onChangeProp(part.id, "motion", part.props.motion === "true" ? "false" : "true")}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                    part.props.motion === "true"
                      ? "bg-red-500/20 border border-red-500/40 text-red-300"
                      : "bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {part.props.motion === "true" ? "🔴 Motion Detected!" : "👆 Simulate Motion"}
                </button>
              </Field>
            )}

            {part.type === "ldr" && (
              <Field label={`Light: ${part.props.light ?? 512} / 1023`}>
                <input
                  type="range"
                  min={0}
                  max={1023}
                  value={Number(part.props.light ?? 512)}
                  onChange={(e) => onChangeProp(part.id, "light", Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>🌑 Dark</span>
                  <span>☀️ Bright</span>
                </div>
              </Field>
            )}

            {part.type === "tmp36" && (
              <Field label={`Temperature: ${part.props.temperature ?? 25}°C`}>
                <input
                  type="range"
                  min={-40}
                  max={125}
                  value={Number(part.props.temperature ?? 25)}
                  onChange={(e) => onChangeProp(part.id, "temperature", Number(e.target.value))}
                  className="w-full accent-orange-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>❄️ -40°C</span>
                  <span>🔥 125°C</span>
                </div>
              </Field>
            )}

            {part.type === "dc-motor" && runtime && (
              <Field label="Motor Status">
                <div className={`rounded-lg p-2.5 text-xs ${
                  runtime.motorDirection === "cw"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-slate-800 border border-slate-700 text-slate-400"
                }`}>
                  {runtime.motorDirection === "cw"
                    ? `⚡ Spinning: ${runtime.rpm} RPM`
                    : "⚪ Stopped (No power)"}
                </div>
              </Field>
            )}

            {part.type === "npn-transistor" && runtime && (
              <Field label="Transistor Status">
                <div className={`rounded-lg p-2.5 text-xs ${
                  runtime.conducting
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                    : "bg-slate-800 border border-slate-700 text-slate-400"
                }`}>
                  {runtime.conducting ? "✅ Conducting (Base HIGH)" : "⚪ Cutoff (Base LOW)"}
                </div>
              </Field>
            )}

            {part.type === "relay" && runtime && (
              <Field label="Relay Status">
                <div className={`rounded-lg p-2.5 text-xs ${
                  runtime.relayActive
                    ? "bg-blue-500/10 border border-blue-500/30 text-blue-300"
                    : "bg-slate-800 border border-slate-700 text-slate-400"
                }`}>
                  {runtime.relayActive
                    ? "🔵 Energized — COM ↔ NO (Normally Open)"
                    : "⚪ De-energized — COM ↔ NC (Normally Closed)"}
                </div>
              </Field>
            )}

            {part.type === "lcd-i2c" && runtime && (
              <Field label="LCD Preview">
                <div className="rounded-lg bg-emerald-950 border border-emerald-800 p-2 font-mono text-[11px] text-emerald-400 leading-snug">
                  <div>{(runtime.lcdLine1 || "").padEnd(16, "\u00A0").slice(0, 16)}</div>
                  <div>{(runtime.lcdLine2 || "").padEnd(16, "\u00A0").slice(0, 16)}</div>
                </div>
              </Field>
            )}

            {part.type === "seven-segment" && runtime?.segments && (
              <Field label="Active Segments">
                <div className="flex flex-wrap gap-1.5">
                  {["a","b","c","d","e","f","g","dp"].map(s => (
                    <span key={s} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      runtime.segments?.[s] ? "bg-red-500/20 text-red-300" : "bg-slate-800 text-slate-500"
                    }`}>
                      {s.toUpperCase()}
                    </span>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Rotation">
              <button
                onClick={() => onRotate(part.id)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary"
              >
                Rotate 90° ({part.rotation}°)
              </button>
            </Field>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <button
                onClick={() => onDuplicate(part.id)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary"
              >
                Duplicate
              </button>
              <button
                onClick={() => onDelete(part.id)}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive transition hover:bg-destructive/10"
              >
                Delete component
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
