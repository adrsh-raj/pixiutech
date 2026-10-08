import { useState } from "react"
import type { PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"
import { getComponentMeta } from "@/lib/component-registry"
import { getBoardDefinition, isBoardType } from "@/lib/board-registry"
import type { PartRuntime } from "./part-art"
import { X, Cpu, Zap, Wifi } from "lucide-react"
import { decodeSevenSegment, resolveSevenSegmentSegments } from "@/lib/seven-segment"

interface Props {
  part: PlacedPart | null
  runtime?: PartRuntime
  running?: boolean
  partCount: number
  wireCount: number
  onChangeProp: (id: string, key: string, value: string | number) => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onClose?: () => void
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

export function Inspector({ part, runtime, running = false, partCount, wireCount, onChangeProp, onRotate, onDelete, onDuplicate, onClose }: Props) {
  const [pinFilter, setPinFilter] = useState<"all" | "power" | "analog" | "digital">("all")
  return (
    <aside
      className={`
        ${!part ? "hidden md:flex" : "fixed inset-x-0 bottom-0 z-40 max-h-[60vh] md:max-h-full rounded-t-2xl md:rounded-none shadow-2xl md:shadow-none border-t md:border-t-0 flex"}
        md:static md:flex h-auto md:h-full w-full md:w-72 shrink-0 flex-col md:border-l border-border bg-sidebar transition-all duration-200
      `}
    >
      <div className="border-b border-border px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground truncate">Inspector</h2>
          {part && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold truncate">
              {CATALOG[part.type]?.name || part.type}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition cursor-pointer shrink-0 ml-2"
            title="Close Inspector (Cut panel)"
            aria-label="Close Inspector"
          >
            <X size={16} />
          </button>
        )}
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
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Learn + Build</span>
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                  Grade {getComponentMeta(part.type).educational.gradeBand}
                </span>
              </div>
              <p className="text-[11px] font-bold text-foreground">{getComponentMeta(part.type).educational.concept}</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{getComponentMeta(part.type).educational.experiment}</p>
              <div className="mt-2 rounded-lg border border-border/70 bg-background/50 p-2 text-[9px] leading-4 text-muted-foreground">
                <span className="font-bold text-primary">Hint:</span> {getComponentMeta(part.type).educational.hint}
              </div>
            </div>

            {/* Board Hardware Architecture & Telemetry Section */}
            {isBoardType(part.type) && (() => {
              const board = getBoardDefinition(part.type)
              if (!board) return null

              const filteredPins = board.pins.filter((p) => {
                if (pinFilter === "power") return p.kind === "power" || p.kind === "ground"
                if (pinFilter === "analog") return p.kind === "analog" || !!p.capabilities?.adc || !!p.capabilities?.dac
                if (pinFilter === "digital") return p.kind === "digital"
                return true
              })

              return (
                <div className="rounded-xl border border-border bg-card/60 p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                      <Cpu size={13} className="text-primary" />
                      <span>Hardware Specs</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                      {board.mcu}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg bg-background/70 border border-border/70 p-2">
                      <div className="text-muted-foreground text-[8.5px] uppercase font-bold flex items-center gap-1">
                        <Zap size={10} className="text-amber-400" />
                        <span>Logic Level</span>
                      </div>
                      <div className={`font-bold text-xs mt-0.5 ${board.logicVoltage === 3.3 ? "text-cyan-400" : "text-amber-400"}`}>
                        {board.logicVoltage}V DC
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/80 mt-0.5">
                        {board.logicVoltage === 3.3 ? "Safe range 0-3.3V" : "Safe range 0-5.0V"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-background/70 border border-border/70 p-2">
                      <div className="text-muted-foreground text-[8.5px] uppercase font-bold">Clock Speed</div>
                      <div className="font-bold text-xs mt-0.5 text-foreground">
                        {board.clockSpeedMhz} MHz
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/80 mt-0.5">
                        {board.architecture === "xtensa-lx6" ? "Dual 32-bit" : board.architecture === "avr" ? "8-bit AVR" : "ARM Cortex"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-background/70 border border-border/70 p-2">
                      <div className="text-muted-foreground text-[8.5px] uppercase font-bold">ADC Engine</div>
                      <div className="font-bold text-xs mt-0.5 text-foreground">
                        {board.adcResolutionBits}-bit
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/80 mt-0.5">
                        0 .. {(1 << board.adcResolutionBits) - 1} steps
                      </div>
                    </div>

                    <div className="rounded-lg bg-background/70 border border-border/70 p-2">
                      <div className="text-muted-foreground text-[8.5px] uppercase font-bold">Flash / SRAM</div>
                      <div className="font-bold text-xs mt-0.5 text-foreground">
                        {board.flashSizeKb >= 1024 ? `${board.flashSizeKb / 1024}MB` : `${board.flashSizeKb}KB`} / {board.ramSizeKb}KB
                      </div>
                      <div className="text-[8.5px] text-muted-foreground/80 mt-0.5">
                        {board.capabilities.hasWifi ? "Wireless MCU" : "Standard MCU"}
                      </div>
                    </div>
                  </div>

                  {board.capabilities.hasWifi && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
                      <Wifi size={13} className="shrink-0" />
                      <span className="font-bold">Wi-Fi 802.11 b/g/n + Bluetooth 4.2 / BLE</span>
                    </div>
                  )}

                  {/* Header Pin Quick Reference & Filter */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground font-bold">
                        Header Pins ({filteredPins.length}/{board.pins.length})
                      </span>
                      <div className="flex items-center gap-1 font-mono text-[8.5px]">
                        {(["all", "power", "analog", "digital"] as const).map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setPinFilter(cat)}
                            className={`px-1.5 py-0.5 rounded capitalize transition-colors ${
                              pinFilter === cat
                                ? "bg-primary text-primary-foreground font-bold"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[9px]">
                      {filteredPins.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-2 py-1 rounded bg-background/60 hover:bg-background/90 border border-border/40 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                p.kind === "power"
                                  ? "bg-red-400"
                                  : p.kind === "ground"
                                  ? "bg-slate-400"
                                  : p.kind === "analog"
                                  ? "bg-amber-400"
                                  : "bg-cyan-400"
                              }`}
                            />
                            <span className="font-bold text-foreground truncate">{p.label}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {p.capabilities?.builtInLed && (
                              <span className="text-[7.5px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                                LED
                              </span>
                            )}
                            {p.capabilities?.touch && (
                              <span className="text-[7.5px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
                                TOUCH
                              </span>
                            )}
                            {p.capabilities?.dac && (
                              <span className="text-[7.5px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                DAC
                              </span>
                            )}
                            {p.capabilities?.i2cRole && (
                              <span className="text-[7.5px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                                {p.capabilities.i2cRole}
                              </span>
                            )}
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                p.kind === "power"
                                  ? "bg-red-500/15 text-red-300"
                                  : p.kind === "ground"
                                  ? "bg-slate-700 text-slate-300"
                                  : p.kind === "analog"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-cyan-500/15 text-cyan-300"
                              }`}
                            >
                              {p.capabilities?.adc ? "ADC" : p.kind.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

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

            {part.type === "seven-segment" && (() => {
              const propDigit = part.props.digit !== undefined ? Number(part.props.digit) : undefined
              const runtimeSegments = (runtime as any)?.segments as Record<string, boolean> | undefined
              const isPreview = runtimeSegments === undefined
              const effectiveSegs = resolveSevenSegmentSegments(runtimeSegments, propDigit)
              const decoded = decodeSevenSegment(effectiveSegs)

              return (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <Field label="Decoded Output">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-bold border ${
                          decoded.digit !== undefined
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                            : decoded.status === "partial"
                            ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                            : "bg-slate-950 text-slate-400 border-slate-800"
                        }`}
                      >
                        <span className="text-base">{decoded.digit !== undefined ? decoded.digit : decoded.glyph || "—"}</span>
                        <span>{decoded.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {decoded.activeSegments.filter((segment) => segment !== "dp").length} of 7 segments lit
                      </span>
                    </div>
                  </Field>

                  <Field label="Segment States (a-g, dp)">
                    <div className="grid grid-cols-4 gap-1">
                      {["a", "b", "c", "d", "e", "f", "g", "dp"].map((s) => {
                        const on = Boolean(effectiveSegs[s])
                        return (
                          <div
                            key={s}
                            className={`flex items-center justify-between rounded px-1.5 py-1 text-[10px] font-mono border ${
                              on
                                ? "bg-red-500/20 text-red-300 border-red-500/40 font-bold"
                                : "bg-slate-950 text-slate-500 border-slate-800"
                            }`}
                          >
                            <span>{s.toUpperCase()}</span>
                            <span className={on ? "text-red-400" : "text-slate-600"}>{on ? "ON" : "OFF"}</span>
                          </div>
                        )
                      })}
                    </div>
                  </Field>

                  {/* Educational wiring alert when incomplete pattern like ']' is detected */}
                  {decoded.tip && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200 leading-relaxed">
                      <span className="font-bold text-amber-300">💡 Electronics Tip: </span>
                      {decoded.tip}
                    </div>
                  )}

                  <Field label="Interactive Digit Test">
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <button
                          key={d}
                          type="button"
                          disabled={running}
                          onClick={() => onChangeProp(part.id, "digit", d)}
                          className={`rounded py-1 text-[11px] font-mono font-bold border transition ${
                            decoded.digit === d || (isPreview && Number(part.props.digit ?? 0) === d)
                              ? "bg-red-600 text-white border-red-400 shadow-sm shadow-red-500/30"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:border-red-400 hover:bg-slate-700"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )
            })()}

            {part.type === "ir-sensor" && (
              <Field label="Virtual obstacle">
                <button
                  onClick={() => onChangeProp(part.id, "detected", part.props.detected === "true" ? "false" : "true")}
                  className={"w-full rounded-xl border px-3 py-2 text-xs font-bold transition " + (
                    part.props.detected === "true"
                      ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                      : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  )}
                >
                  {part.props.detected === "true" ? "🔴 Obstacle detected" : "🟢 Path clear"}
                </button>
              </Field>
            )}

            {part.type === "dht11" && (
              <>
                <Field label={"Temperature: " + (part.props.temperature ?? 25) + "°C"}>
                  <input type="range" min={0} max={50} value={Number(part.props.temperature ?? 25)}
                    onChange={(e) => onChangeProp(part.id, "temperature", Number(e.target.value))}
                    className="w-full accent-sky-400" />
                </Field>
                <Field label={"Humidity: " + (part.props.humidity ?? 55) + "%"}>
                  <input type="range" min={10} max={95} value={Number(part.props.humidity ?? 55)}
                    onChange={(e) => onChangeProp(part.id, "humidity", Number(e.target.value))}
                    className="w-full accent-cyan-400" />
                </Field>
              </>
            )}

            {part.type === "oled-i2c" && (
              <>
                <Field label="OLED line 1">
                  <input value={String(part.props.line1 ?? "")} maxLength={18}
                    onChange={(e) => onChangeProp(part.id, "line1", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground" />
                </Field>
                <Field label="OLED line 2">
                  <input value={String(part.props.line2 ?? "")} maxLength={18}
                    onChange={(e) => onChangeProp(part.id, "line2", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground" />
                </Field>
                <Field label="OLED line 3">
                  <input value={String(part.props.line3 ?? "")} maxLength={18}
                    onChange={(e) => onChangeProp(part.id, "line3", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground" />
                </Field>
              </>
            )}

            {part.type === "joystick" && (
              <>
                <Field label={"X axis: " + (part.props.x ?? 512)}>
                  <input type="range" min={0} max={1023} value={Number(part.props.x ?? 512)}
                    onChange={(e) => onChangeProp(part.id, "x", Number(e.target.value))}
                    className="w-full accent-blue-400" />
                </Field>
                <Field label={"Y axis: " + (part.props.y ?? 512)}>
                  <input type="range" min={0} max={1023} value={Number(part.props.y ?? 512)}
                    onChange={(e) => onChangeProp(part.id, "y", Number(e.target.value))}
                    className="w-full accent-cyan-400" />
                </Field>
                <button
                  onClick={() => onChangeProp(part.id, "pressed", part.props.pressed === "true" ? "false" : "true")}
                  className={"w-full rounded-lg border px-3 py-2 text-xs font-bold " + (
                    part.props.pressed === "true" ? "border-amber-400/50 bg-amber-500/15 text-amber-200" : "border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {part.props.pressed === "true" ? "🟡 Button pressed" : "○ Press joystick button"}
                </button>
              </>
            )}

            {part.type === "l298n" && (
              <>
                <Field label={"Motor A speed: " + (part.props.speedA ?? 0)}>
                  <input type="range" min={0} max={255} value={Number(part.props.speedA ?? 0)}
                    onChange={(e) => onChangeProp(part.id, "speedA", Number(e.target.value))}
                    className="w-full accent-emerald-400" />
                </Field>
                <Field label={"Motor B speed: " + (part.props.speedB ?? 0)}>
                  <input type="range" min={0} max={255} value={Number(part.props.speedB ?? 0)}
                    onChange={(e) => onChangeProp(part.id, "speedB", Number(e.target.value))}
                    className="w-full accent-emerald-400" />
                </Field>
                <div className="grid grid-cols-3 gap-1.5">
                  {["cw","ccw","stop"].map((dir) => (
                    <button key={dir}
                      onClick={() => onChangeProp(part.id, "directionA", dir)}
                      className={"rounded-lg border px-2 py-1.5 text-[10px] font-bold " + (
                        String(part.props.directionA ?? "stop") === dir ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {dir.toUpperCase()}
                    </button>
                  ))}
                </div>
              </>
            )}

            {part.type === "rotary-encoder" && (
              <>
                <Field label={"Count: " + (part.props.value ?? 0)}>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => onChangeProp(part.id, "value", Number(part.props.value ?? 0) - 1)} className="rounded-lg border border-border bg-secondary py-2 text-sm font-bold">−</button>
                    <button onClick={() => onChangeProp(part.id, "value", 0)} className="rounded-lg border border-border bg-background py-2 text-[10px]">Reset</button>
                    <button onClick={() => onChangeProp(part.id, "value", Number(part.props.value ?? 0) + 1)} className="rounded-lg border border-border bg-secondary py-2 text-sm font-bold">+</button>
                  </div>
                </Field>
                <button
                  onClick={() => onChangeProp(part.id, "pressed", part.props.pressed === "true" ? "false" : "true")}
                  className={"w-full rounded-lg border px-3 py-2 text-xs font-bold " + (
                    part.props.pressed === "true" ? "border-amber-400/50 bg-amber-500/15 text-amber-200" : "border-border bg-secondary text-muted-foreground"
                  )}
                >
                  {part.props.pressed === "true" ? "🟡 Encoder switch pressed" : "○ Press encoder"}
                </button>
              </>
            )}

            {part.type === "soil-moisture" && (
              <Field label={"Moisture: " + (part.props.moisture ?? 620) + " / 1023"}>
                <input type="range" min={0} max={1023} value={Number(part.props.moisture ?? 620)}
                  onChange={(e) => onChangeProp(part.id, "moisture", Number(e.target.value))}
                  className="w-full accent-cyan-400" />
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>🏜️ Dry</span><span>💧 Wet</span></div>
              </Field>
            )}

            {part.type === "keypad-4x4" && (
              <Field label="Keypad PIN Entry">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-md border border-border bg-background/80 px-2.5 py-1.5 font-mono text-xs">
                    <span className="text-[10px] text-muted-foreground">PIN Buffer:</span>
                    <span className="font-bold tracking-widest text-primary">
                      {part.props.enteredPin ? String(part.props.enteredPin) : "____"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "CLR", "0", "OK", "D"].map((key) => {
                      const isOk = key === "OK"
                      const isClr = key === "CLR"
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const currentPin = String(part.props.enteredPin ?? "")
                            if (isClr) {
                              onChangeProp(part.id, "enteredPin", "")
                              onChangeProp(part.id, "lastKey", "")
                            } else if (isOk) {
                              const pinToSubmit = currentPin || "#"
                              onChangeProp(part.id, "lastKey", pinToSubmit)
                              onChangeProp(part.id, "enteredPin", "")
                              setTimeout(() => onChangeProp(part.id, "lastKey", ""), 1200)
                            } else {
                              const newPin = (currentPin + key).slice(0, 8)
                              onChangeProp(part.id, "enteredPin", newPin)
                            }
                          }}
                          className={`rounded-lg border px-1 py-2 text-xs font-bold transition-all ${
                            isOk
                              ? "border-emerald-500 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                              : isClr
                              ? "border-rose-500 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
                              : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {key}
                        </button>
                      )
                    })}
                  </div>
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
