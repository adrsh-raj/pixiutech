"use client"

import type { PlacedPart } from "@/lib/circuit-types"
import { CATALOG } from "@/lib/components-catalog"

interface Props {
  part: PlacedPart | null
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

export function Inspector({ part, partCount, wireCount, onChangeProp, onRotate, onDelete, onDuplicate }: Props) {
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
