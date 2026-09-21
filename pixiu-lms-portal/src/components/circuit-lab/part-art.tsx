import type { PlacedPart } from "@/lib/circuit-types"

export interface PartRuntime {
  /** 0..1 brightness for LEDs / on-off for others */
  level?: number
  /** servo angle in degrees */
  angle?: number
  /** for Arduino Uno: is Pin 13 HIGH */
  pin13High?: boolean
  /** Real electrical burnout states */
  burnt?: boolean
  currentMa?: number
  resistorOhms?: number
  warning?: string
  /** RGB LED: individual channel levels 0..1 */
  redLevel?: number
  greenLevel?: number
  blueLevel?: number
  /** LCD 16x2: text content */
  lcdLine1?: string
  lcdLine2?: string
  lcdBacklight?: boolean
  /** 7-Segment: which segments are active (a-g, dp) */
  segments?: Record<string, boolean>
  /** DC Motor: RPM and direction */
  rpm?: number
  motorDirection?: "cw" | "ccw" | "stopped"
  /** Sensors: current reading value */
  sensorValue?: number
  /** Relay: coil energized */
  relayActive?: boolean
  /** Transistor: conducting */
  conducting?: boolean
}

const LED_COLORS: Record<string, string> = {
  red: "#ff4d4d",
  green: "#39d98a",
  blue: "#4d9bff",
  yellow: "#ffd23f",
  white: "#f5f5f5",
}

function ResistorBands({ resistance }: { resistance: number }) {
  // simple, not electrically exact — just a friendly visual for common values
  const map: Record<number, string[]> = {
    220: ["#d33", "#d33", "#8b4513"],
    330: ["#f80", "#f80", "#8b4513"],
    1000: ["#8b4513", "#000", "#d33"],
    10000: ["#8b4513", "#000", "#f80"],
  }
  const bands = map[resistance] ?? ["#888", "#888", "#888"]
  return (
    <>
      {bands.map((c, i) => (
        <rect key={i} x={26 + i * 12} y={2} width={5} height={22} fill={c} rx={1} />
      ))}
    </>
  )
}

export function PartArt({ part, runtime }: { part: PlacedPart; runtime?: PartRuntime }) {
  switch (part.type) {
    case "arduino-uno":
      return (
        <g>
          <rect x={0} y={0} width={320} height={200} rx={10} fill="#0f8a7e" stroke="#0b6b61" strokeWidth={2} />
          <rect x={8} y={20} width={304} height={160} rx={6} fill="#0d7a70" opacity={0.6} />
          {/* headers */}
          <rect x={14} y={2} width={292} height={13} rx={2} fill="#111827" />
          <rect x={30} y={185} width={260} height={13} rx={2} fill="#111827" />
          {/* USB */}
          <rect x={-6} y={40} width={30} height={44} rx={3} fill="#c0c4cc" stroke="#8b8f96" />
          {/* power jack */}
          <rect x={-4} y={120} width={26} height={34} rx={4} fill="#1f2937" stroke="#0b0f16" />
          {/* MCU chip */}
          <rect x={120} y={92} width={90} height={54} rx={3} fill="#1f2937" />
          <circle cx={130} cy={102} r={3} fill="#374151" />
          <text x={165} y={124} textAnchor="middle" fontSize={11} fill="#9ca3af" fontFamily="monospace">
            ATmega328P
          </text>
          {/* reset button */}
          <rect x={40} y={96} width={20} height={20} rx={3} fill="#b91c1c" />

          {/* Onboard SMD L LED (Pin 13 indicator) */}
          <rect x={122} y={40} width={8} height={12} rx={1.5} fill={runtime?.pin13High ? "#fbbf24" : "#374151"} />
          {runtime?.pin13High && <circle cx={126} cy={46} r={10} fill="#f59e0b" opacity={0.5} />}
          <text x={126} y={60} textAnchor="middle" fontSize={7} fill="#bdeee7" fontFamily="sans-serif" fontWeight={700}>
            L
          </text>

          <text x={160} y={70} textAnchor="middle" fontSize={16} fill="#e5fffb" fontFamily="monospace" fontWeight={700}>
            ARDUINO
          </text>
          <text x={160} y={168} textAnchor="middle" fontSize={11} fill="#bdeee7" fontFamily="monospace">
            UNO
          </text>
        </g>
      )

    case "breadboard":
      return (
        <g>
          {/* Base board casing */}
          <rect x={0} y={0} width={460} height={214} rx={8} fill="#fcfbf9" stroke="#d5d0c4" strokeWidth={2} />

          {/* Top power bus stripes */}
          <line x1={24} y1={16} x2={436} y2={16} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={24} y1={28} x2={436} y2={28} stroke="#3b82f6" strokeWidth={1.5} />
          {/* Bottom power bus stripes */}
          <line x1={24} y1={186} x2={436} y2={186} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={24} y1={198} x2={436} y2={198} stroke="#3b82f6" strokeWidth={1.5} />

          {/* Plus and Minus bus indicators */}
          <text x={14} y={19} fontSize={10} fontWeight={700} fill="#ef4444" textAnchor="middle" fontFamily="monospace">+</text>
          <text x={14} y={30} fontSize={11} fontWeight={700} fill="#3b82f6" textAnchor="middle" fontFamily="monospace">−</text>
          <text x={446} y={19} fontSize={10} fontWeight={700} fill="#ef4444" textAnchor="middle" fontFamily="monospace">+</text>
          <text x={446} y={30} fontSize={11} fontWeight={700} fill="#3b82f6" textAnchor="middle" fontFamily="monospace">−</text>

          <text x={14} y={189} fontSize={10} fontWeight={700} fill="#ef4444" textAnchor="middle" fontFamily="monospace">+</text>
          <text x={14} y={200} fontSize={11} fontWeight={700} fill="#3b82f6" textAnchor="middle" fontFamily="monospace">−</text>
          <text x={446} y={189} fontSize={10} fontWeight={700} fill="#ef4444" textAnchor="middle" fontFamily="monospace">+</text>
          <text x={446} y={200} fontSize={11} fontWeight={700} fill="#3b82f6" textAnchor="middle" fontFamily="monospace">−</text>

          {/* Center isolation canal */}
          <rect x={16} y={105} width={428} height={6} fill="#d8d3c5" rx={1} />

          {/* Column number labels (1, 5, 10, 15, 20) */}
          {[1, 5, 10, 15, 20].map((c) => {
            const x = 40 + (c - 1) * 20
            return (
              <g key={`num-${c}`}>
                <text x={x} y={42} fontSize={8} fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif" fontWeight={600}>{c}</text>
                <text x={x} y={178} fontSize={8} fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif" fontWeight={600}>{c}</text>
              </g>
            )
          })}

          {/* Row letter labels (a, b, c, d, e and f, g, h, i, j) */}
          {[
            { l: "a", y: 53 }, { l: "b", y: 65 }, { l: "c", y: 77 }, { l: "d", y: 89 }, { l: "e", y: 101 },
            { l: "f", y: 121 }, { l: "g", y: 133 }, { l: "h", y: 145 }, { l: "i", y: 157 }, { l: "j", y: 169 }
          ].map(({ l, y }) => (
            <g key={`row-${l}`}>
              <text x={26} y={y} fontSize={8} fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif" fontWeight={600}>{l}</text>
              <text x={434} y={y} fontSize={8} fill="#94a3b8" textAnchor="middle" fontFamily="sans-serif" fontWeight={600}>{l}</text>
            </g>
          ))}

          {/* All 280 contact tie holes */}
          {Array.from({ length: 20 }).map((_, colIdx) => {
            const x = 40 + colIdx * 20
            const yPositions = [16, 28, 50, 62, 74, 86, 98, 118, 130, 142, 154, 166, 186, 198]
            return yPositions.map((y) => (
              <circle
                key={`${colIdx}-${y}`}
                cx={x}
                cy={y}
                r={2.2}
                fill="#334155"
                stroke="#94a3b8"
                strokeWidth={0.7}
              />
            ))
          })}
        </g>
      )

    case "led": {
      const color = LED_COLORS[String(part.props.color ?? "red")] ?? LED_COLORS.red
      const level = runtime?.level ?? 0
      const isBurnt = Boolean(runtime?.burnt)

      return (
        <g>
          {/* legs */}
          <line x1={14} y1={44} x2={14} y2={62} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={30} y1={40} x2={30} y2={62} stroke="#9aa0a6" strokeWidth={2} />

          {/* Healthy radiant glow */}
          {!isBurnt && level > 0 && (
            <circle cx={22} cy={22} r={28} fill={color} opacity={0.35 * level} />
          )}

          {/* Bulb casing */}
          <path
            d="M6 24 A16 16 0 0 1 38 24 L38 40 L6 40 Z"
            fill={isBurnt ? "#3f3f46" : color}
            opacity={isBurnt ? 0.95 : 0.85}
          />
          <ellipse
            cx={22}
            cy={24}
            rx={16}
            ry={16}
            fill={isBurnt ? "#27272a" : color}
            opacity={isBurnt ? 0.95 : level > 0 ? 0.6 + 0.4 * level : 0.55}
          />
          <ellipse cx={16} cy={18} rx={4} ry={6} fill={isBurnt ? "#52525b" : "#ffffff"} opacity={0.4} />
          <rect x={6} y={38} width={32} height={5} rx={1} fill="#cfd3d8" />

          {/* Burnout Cracks and Explosion Visuals */}
          {isBurnt && (
            <g className="animate-bounce">
              {/* Internal hairline cracks on burnt glass */}
              <path d="M16 20 L22 28 L20 32 L26 36" stroke="#18181b" strokeWidth={1.5} fill="none" />
              {/* Pop explosion aura */}
              <circle cx={22} cy={18} r={20} fill="#ef4444" opacity={0.25} />
              <text x={22} y={24} textAnchor="middle" fontSize={18} className="select-none">
                💥
              </text>
              {/* Educational Danger Label */}
              <g transform="translate(0, -18)">
                <rect
                  x={-24}
                  y={0}
                  width={92}
                  height={18}
                  rx={4}
                  fill="#b91c1c"
                  stroke="#fecaca"
                  strokeWidth={1}
                />
                <text
                  x={22}
                  y={13}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill="#ffffff"
                  fontFamily="sans-serif"
                >
                  💥 NO RESISTOR!
                </text>
              </g>
            </g>
          )}
        </g>
      )
    }

    case "resistor":
      return (
        <g>
          <line x1={3} y1={13} x2={26} y2={13} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={62} y1={13} x2={85} y2={13} stroke="#9aa0a6" strokeWidth={2} />
          <rect x={24} y={2} width={40} height={22} rx={6} fill="#d9b382" stroke="#b7935f" />
          <ResistorBands resistance={Number(part.props.resistance ?? 220)} />
        </g>
      )

    case "pushbutton":
      return (
        <g>
          <rect x={8} y={8} width={44} height={44} rx={4} fill="#1f2937" stroke="#0b0f16" />
          <circle cx={30} cy={30} r={14} fill="#374151" stroke="#4b5563" />
          <circle cx={30} cy={30} r={9} fill="#6b7280" />
          {[8, 52].map((x) =>
            [8, 52].map((y) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} fill="#9aa0a6" />),
          )}
        </g>
      )

    case "battery":
      return (
        <g>
          <rect x={6} y={6} width={50} height={80} rx={6} fill="#1f2937" stroke="#0b0f16" />
          <rect x={16} y={0} width={12} height={8} rx={2} fill="#d33" />
          <rect x={34} y={0} width={12} height={8} rx={2} fill="#374151" />
          <text x={31} y={40} textAnchor="middle" fontSize={16} fill="#e5e7eb" fontFamily="monospace" fontWeight={700}>
            9V
          </text>
          <text x={20} y={62} textAnchor="middle" fontSize={14} fill="#d33">
            +
          </text>
          <text x={42} y={62} textAnchor="middle" fontSize={14} fill="#9ca3af">
            −
          </text>
        </g>
      )

    case "potentiometer": {
      const value = Number(part.props.value ?? 512)
      const deg = -135 + (value / 1023) * 270
      return (
        <g>
          <rect x={6} y={30} width={52} height={26} rx={3} fill="#1f2937" />
          <circle cx={32} cy={26} r={22} fill="#3b82f6" stroke="#1e40af" strokeWidth={2} />
          <g transform={`rotate(${deg} 32 26)`}>
            <rect x={30} y={8} width={4} height={16} rx={2} fill="#f8fafc" />
          </g>
        </g>
      )
    }

    case "servo": {
      const angle = runtime?.angle ?? Number(part.props.angle ?? 90)
      const isBarrier = part.props.arm === "barrier"
      return (
        <g>
          {/* Servo body chassis */}
          <rect x={16} y={10} width={56} height={40} rx={3} fill="#1e3a8a" stroke="#0b1d52" />
          <circle cx={44} cy={18} r={10} fill="#93c5fd" />

          {/* Rotating horn or boom barrier arm */}
          <g transform={`rotate(${angle - 90} 44 18)`}>
            {isBarrier ? (
              <g>
                {/* Long Boom Barrier arm (115px) */}
                <rect x={40} y={-110} width={8} height={124} rx={2} fill="#ffffff" stroke="#94a3b8" strokeWidth={0.6} />
                {/* Diagonal red safety warning stripes */}
                {[-100, -80, -60, -40, -20, 0].map((sy) => (
                  <polygon
                    key={sy}
                    points={`40,${sy} 48,${sy - 8} 48,${sy} 40,${sy + 8}`}
                    fill="#ef4444"
                  />
                ))}
                {/* Flashing warning lamp at tip of barrier */}
                <circle cx={44} cy={-107} r={4} fill="#ef4444" />
                <circle cx={44} cy={-107} r={8} fill="#ef4444" opacity={0.3} />
                {/* Heavy pivot counterweight hub */}
                <circle cx={44} cy={18} r={8} fill="#f59e0b" stroke="#b45309" strokeWidth={1} />
                <circle cx={44} cy={18} r={3} fill="#1e293b" />
              </g>
            ) : (
              <g>
                <rect x={42} y={0} width={4} height={20} rx={2} fill="#f8fafc" />
                <circle cx={44} cy={2} r={3} fill="#f8fafc" />
              </g>
            )}
          </g>

          {/* 3-wire lead */}
          <line x1={4} y1={16} x2={16} y2={22} stroke="#f97316" strokeWidth={2} />
          <line x1={4} y1={30} x2={16} y2={30} stroke="#dc2626" strokeWidth={2} />
          <line x1={4} y1={44} x2={16} y2={38} stroke="#111827" strokeWidth={2} />
        </g>
      )
    }

    case "buzzer": {
      const on = (runtime?.level ?? 0) > 0
      return (
        <g>
          <circle cx={28} cy={26} r={24} fill="#111827" stroke="#000" />
          <circle cx={28} cy={26} r={5} fill="#374151" />
          {on && <circle cx={28} cy={26} r={22} fill="none" stroke="var(--color-accent)" strokeWidth={2} opacity={0.8} />}
          {on && <circle cx={28} cy={26} r={17} fill="none" stroke="var(--color-accent)" strokeWidth={1} opacity={0.4} />}
          <text x={28} y={30} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="monospace">
            +
          </text>
        </g>
      )
    }

    /* ═══════════════════ NEW COMPONENTS ═══════════════════ */

    case "rgb-led": {
      const rL = runtime?.redLevel ?? 0
      const gL = runtime?.greenLevel ?? 0
      const bL = runtime?.blueLevel ?? 0
      const anyOn = rL > 0 || gL > 0 || bL > 0
      const mixedColor = `rgb(${Math.round(rL * 255)}, ${Math.round(gL * 255)}, ${Math.round(bL * 255)})`
      return (
        <g>
          {/* Legs — R, GND(long), G, B */}
          <line x1={8} y1={48} x2={8} y2={66} stroke="#ef4444" strokeWidth={2} />
          <line x1={18} y1={44} x2={18} y2={66} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={28} y1={48} x2={28} y2={66} stroke="#22c55e" strokeWidth={2} />
          <line x1={38} y1={48} x2={38} y2={66} stroke="#3b82f6" strokeWidth={2} />
          {/* Glow */}
          {anyOn && <circle cx={23} cy={24} r={28} fill={mixedColor} opacity={0.35} />}
          {/* Bulb dome */}
          <ellipse cx={23} cy={24} rx={18} ry={18} fill={anyOn ? mixedColor : "#52525b"} opacity={anyOn ? 0.75 : 0.6} />
          <path d="M5 26 A18 18 0 0 1 41 26 L41 44 L5 44 Z" fill={anyOn ? mixedColor : "#3f3f46"} opacity={0.8} />
          <ellipse cx={17} cy={18} rx={4} ry={6} fill="#ffffff" opacity={0.35} />
          <rect x={5} y={42} width={36} height={5} rx={1} fill="#cfd3d8" />
          {/* Label */}
          <text x={23} y={-4} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">RGB</text>
        </g>
      )
    }

    case "seven-segment": {
      const seg = runtime?.segments ?? {}
      const segColor = (id: string) => seg[id] ? "#ef4444" : "#1f1f1f"
      const segOpacity = (id: string) => seg[id] ? 1 : 0.15
      return (
        <g>
          <rect x={2} y={2} width={56} height={76} rx={4} fill="#0f0f0f" stroke="#27272a" />
          {/* Horizontal segments: a(top), g(mid), d(bottom) */}
          <rect x={14} y={10} width={28} height={5} rx={1.5} fill={segColor("a")} opacity={segOpacity("a")} />
          <rect x={14} y={36} width={28} height={5} rx={1.5} fill={segColor("g")} opacity={segOpacity("g")} />
          <rect x={14} y={62} width={28} height={5} rx={1.5} fill={segColor("d")} opacity={segOpacity("d")} />
          {/* Vertical segments: f(TL), b(TR), e(BL), c(BR) */}
          <rect x={10} y={14} width={5} height={24} rx={1.5} fill={segColor("f")} opacity={segOpacity("f")} />
          <rect x={41} y={14} width={5} height={24} rx={1.5} fill={segColor("b")} opacity={segOpacity("b")} />
          <rect x={10} y={40} width={5} height={24} rx={1.5} fill={segColor("e")} opacity={segOpacity("e")} />
          <rect x={41} y={40} width={5} height={24} rx={1.5} fill={segColor("c")} opacity={segOpacity("c")} />
          {/* Decimal point */}
          <circle cx={50} cy={66} r={3} fill={segColor("dp")} opacity={segOpacity("dp")} />
        </g>
      )
    }

    case "lcd-i2c": {
      const line1 = runtime?.lcdLine1 ?? ""
      const line2 = runtime?.lcdLine2 ?? ""
      const backlit = runtime?.lcdBacklight !== false
      return (
        <g>
          {/* PCB Board */}
          <rect x={0} y={0} width={180} height={72} rx={4} fill="#166534" stroke="#14532d" strokeWidth={1.5} />
          {/* Mounting holes */}
          <circle cx={8} cy={8} r={3} fill="#0f0f0f" />
          <circle cx={172} cy={8} r={3} fill="#0f0f0f" />
          <circle cx={8} cy={64} r={3} fill="#0f0f0f" />
          <circle cx={172} cy={64} r={3} fill="#0f0f0f" />
          {/* LCD window */}
          <rect x={14} y={10} width={152} height={52} rx={2} fill={backlit ? "#1a4a1a" : "#0a2a0a"} stroke="#052e16" />
          {/* Text area background */}
          <rect x={18} y={14} width={144} height={44} rx={1} fill={backlit ? "#0d3d0d" : "#061a06"} />
          {/* Line 1 text */}
          <text x={22} y={32} fontSize={13} fill={backlit ? "#4ade80" : "#1a5c1a"} fontFamily="monospace" letterSpacing={3}>
            {(line1 || "").padEnd(16, " ").slice(0, 16)}
          </text>
          {/* Line 2 text */}
          <text x={22} y={52} fontSize={13} fill={backlit ? "#4ade80" : "#1a5c1a"} fontFamily="monospace" letterSpacing={3}>
            {(line2 || "").padEnd(16, " ").slice(0, 16)}
          </text>
          {/* I2C backpack chip */}
          <rect x={70} y={66} width={40} height={8} rx={1} fill="#1f2937" />
          {/* Pin labels */}
          <text x={30} y={79} textAnchor="middle" fontSize={7} fill="#a3e635" fontFamily="mono">GND</text>
          <text x={60} y={79} textAnchor="middle" fontSize={7} fill="#ef4444" fontFamily="mono">VCC</text>
          <text x={90} y={79} textAnchor="middle" fontSize={7} fill="#60a5fa" fontFamily="mono">SDA</text>
          <text x={120} y={79} textAnchor="middle" fontSize={7} fill="#fbbf24" fontFamily="mono">SCL</text>
        </g>
      )
    }

    case "ultrasonic": {
      const dist = runtime?.sensorValue
      return (
        <g>
          {/* PCB */}
          <rect x={0} y={0} width={100} height={48} rx={3} fill="#1e3a8a" stroke="#1e40af" />
          {/* Two ultrasonic transducers (the "eyes") */}
          <circle cx={28} cy={20} r={14} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={1.5} />
          <circle cx={28} cy={20} r={8} fill="#e5e7eb" />
          <circle cx={28} cy={20} r={3} fill="#a1a1aa" />
          <circle cx={72} cy={20} r={14} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={1.5} />
          <circle cx={72} cy={20} r={8} fill="#e5e7eb" />
          <circle cx={72} cy={20} r={3} fill="#a1a1aa" />
          {/* Sound wave animation when active */}
          {dist !== undefined && (
            <g opacity={0.4}>
              <path d="M15 4 Q8 20 15 36" fill="none" stroke="#60a5fa" strokeWidth={1.5} />
              <path d="M85 4 Q92 20 85 36" fill="none" stroke="#60a5fa" strokeWidth={1.5} />
            </g>
          )}
          {/* Crystal oscillator */}
          <rect x={42} y={10} width={16} height={8} rx={1} fill="#27272a" />
          {/* Label */}
          <text x={50} y={44} textAnchor="middle" fontSize={8} fill="#93c5fd" fontFamily="monospace">HC-SR04</text>
          {/* Distance readout */}
          {dist !== undefined && (
            <text x={50} y={-4} textAnchor="middle" fontSize={9} fill="#fbbf24" fontFamily="mono">{dist}cm</text>
          )}
        </g>
      )
    }

    case "pir-sensor": {
      const detected = (runtime?.level ?? 0) > 0
      return (
        <g>
          {/* Body */}
          <rect x={4} y={30} width={52} height={32} rx={3} fill="#166534" stroke="#14532d" />
          {/* Fresnel lens dome */}
          <circle cx={30} cy={28} r={22} fill="#e5e7eb" stroke="#d4d4d8" strokeWidth={1.5} />
          <circle cx={30} cy={28} r={16} fill="#f5f5f5" opacity={0.6} />
          <circle cx={30} cy={28} r={8} fill="#fafafa" opacity={0.4} />
          {/* Motion detection indicator */}
          {detected && <circle cx={30} cy={28} r={26} fill="#ef4444" opacity={0.2} />}
          {detected && <circle cx={30} cy={28} r={32} fill="#ef4444" opacity={0.1} />}
          {/* Potentiometer trims on board */}
          <circle cx={14} cy={48} r={4} fill="#f59e0b" stroke="#d97706" />
          <circle cx={46} cy={48} r={4} fill="#3b82f6" stroke="#2563eb" />
          {/* Label */}
          <text x={30} y={-4} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">PIR</text>
        </g>
      )
    }

    case "ldr": {
      const lightVal = runtime?.sensorValue ?? 512
      const brightness = lightVal / 1023
      return (
        <g>
          {/* Body disc */}
          <circle cx={20} cy={20} r={16} fill="#78350f" stroke="#92400e" strokeWidth={1.5} />
          {/* Photosensitive zigzag pattern */}
          <path d="M12 16 L16 12 L20 16 L24 12 L28 16" fill="none" stroke="#fbbf24" strokeWidth={1.5} />
          <path d="M12 24 L16 20 L20 24 L24 20 L28 24" fill="none" stroke="#fbbf24" strokeWidth={1.5} />
          {/* Light indicator glow */}
          {brightness > 0.3 && <circle cx={20} cy={20} r={20} fill="#fbbf24" opacity={brightness * 0.25} />}
          {/* Legs */}
          <line x1={10} y1={36} x2={10} y2={46} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={30} y1={36} x2={30} y2={46} stroke="#9aa0a6" strokeWidth={2} />
          {/* Arrow symbols for light dependency */}
          <path d="M4 6 L10 10" fill="none" stroke="#fbbf24" strokeWidth={1} />
          <path d="M6 2 L10 8" fill="none" stroke="#fbbf24" strokeWidth={1} />
          <path d="M8 6 L10 8 L8 8" fill="#fbbf24" />
          <path d="M2 4 L4 6 L2 6" fill="#fbbf24" />
        </g>
      )
    }

    case "tmp36": {
      const temp = runtime?.sensorValue
      return (
        <g>
          {/* TO-92 package body */}
          <path d="M6 10 A16 16 0 0 1 34 10 L34 36 L6 36 Z" fill="#1f2937" stroke="#0f172a" />
          {/* Flat face marking */}
          <line x1={6} y1={10} x2={6} y2={36} stroke="#374151" strokeWidth={2} />
          {/* Text label */}
          <text x={20} y={22} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="monospace">TMP</text>
          <text x={20} y={32} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="monospace">36</text>
          {/* Legs */}
          <line x1={6} y1={36} x2={6} y2={46} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={20} y1={36} x2={20} y2={46} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={34} y1={36} x2={34} y2={46} stroke="#9aa0a6" strokeWidth={2} />
          {/* Temperature readout */}
          {temp !== undefined && (
            <text x={20} y={-4} textAnchor="middle" fontSize={9} fill="#f97316" fontFamily="mono">{temp}°C</text>
          )}
        </g>
      )
    }

    case "dc-motor": {
      const spinning = runtime?.motorDirection && runtime.motorDirection !== "stopped"
      const rpm = runtime?.rpm ?? 0
      return (
        <g>
          {/* Motor cylinder body */}
          <ellipse cx={30} cy={30} rx={24} ry={24} fill="#71717a" stroke="#52525b" strokeWidth={2} />
          <ellipse cx={30} cy={30} rx={18} ry={18} fill="#a1a1aa" />
          {/* Center shaft */}
          <circle cx={30} cy={30} r={4} fill="#52525b" stroke="#3f3f46" />
          {/* Shaft marker for rotation */}
          <g style={spinning ? { animation: `spin ${Math.max(0.1, 60 / (rpm || 60))}s linear infinite` } : {}}>
            <line x1={30} y1={30} x2={30} y2={14} stroke="#27272a" strokeWidth={3} />
          </g>
          {/* Terminal tabs */}
          <rect x={10} y={50} width={10} height={8} rx={1} fill="#ef4444" />
          <text x={15} y={57} textAnchor="middle" fontSize={7} fill="#fff" fontWeight={700}>+</text>
          <rect x={40} y={50} width={10} height={8} rx={1} fill="#27272a" />
          <text x={45} y={57} textAnchor="middle" fontSize={7} fill="#fff" fontWeight={700}>−</text>
          {/* RPM readout */}
          {spinning && (
            <text x={30} y={-4} textAnchor="middle" fontSize={8} fill="#a3e635" fontFamily="mono">{rpm} RPM</text>
          )}
          {/* Label */}
          <text x={30} y={34} textAnchor="middle" fontSize={7} fill="#3f3f46" fontFamily="sans-serif" fontWeight={700}>M</text>
        </g>
      )
    }

    case "npn-transistor": {
      const on = runtime?.conducting
      return (
        <g>
          {/* TO-92 package */}
          <path d="M6 8 A16 16 0 0 1 34 8 L34 38 L6 38 Z" fill="#1f2937" stroke="#0f172a" />
          <line x1={6} y1={8} x2={6} y2={38} stroke="#374151" strokeWidth={2} />
          {/* NPN symbol inside */}
          <line x1={16} y1={16} x2={16} y2={32} stroke="#60a5fa" strokeWidth={2} />
          <line x1={16} y1={20} x2={28} y2={14} stroke={on ? "#4ade80" : "#60a5fa"} strokeWidth={1.5} />
          <line x1={16} y1={28} x2={28} y2={34} stroke={on ? "#4ade80" : "#60a5fa"} strokeWidth={1.5} />
          {/* Arrow on emitter */}
          <polygon points="24,33 28,34 25,30" fill={on ? "#4ade80" : "#60a5fa"} />
          {/* Label */}
          <text x={20} y={-2} textAnchor="middle" fontSize={7} fill="#94a3b8" fontFamily="mono">2N2222</text>
          {/* Conducting indicator */}
          {on && <circle cx={20} cy={24} r={18} fill="#4ade80" opacity={0.12} />}
          {/* Legs: E, B, C */}
          <line x1={8} y1={38} x2={8} y2={52} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={20} y1={38} x2={20} y2={52} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={32} y1={38} x2={32} y2={52} stroke="#9aa0a6" strokeWidth={2} />
        </g>
      )
    }

    case "relay": {
      const active = runtime?.relayActive ?? false
      return (
        <g>
          {/* PCB Board */}
          <rect x={0} y={0} width={80} height={66} rx={3} fill="#1e3a8a" stroke="#1e40af" />
          {/* Relay body (blue cube) */}
          <rect x={10} y={10} width={40} height={32} rx={2} fill={active ? "#2563eb" : "#1d4ed8"} stroke="#1e40af" />
          {/* Coil indicator */}
          <path d="M18 22 Q22 18 26 22 Q30 26 34 22 Q38 18 42 22" fill="none" stroke="#93c5fd" strokeWidth={1.5} />
          {/* LED indicator */}
          <circle cx={60} cy={20} r={5} fill={active ? "#4ade80" : "#27272a"} />
          {active && <circle cx={60} cy={20} r={8} fill="#4ade80" opacity={0.3} />}
          {/* Relay state label */}
          <text x={40} y={48} textAnchor="middle" fontSize={7} fill="#93c5fd" fontFamily="mono">
            {active ? "ON" : "OFF"}
          </text>
          {/* Terminal screw connectors (top) */}
          <rect x={8} y={-2} width={12} height={8} rx={1} fill="#60a5fa" />
          <text x={14} y={5} textAnchor="middle" fontSize={6} fill="#fff" fontFamily="mono">COM</text>
          <rect x={34} y={-2} width={12} height={8} rx={1} fill="#4ade80" />
          <text x={40} y={5} textAnchor="middle" fontSize={6} fill="#fff" fontFamily="mono">NO</text>
          <rect x={60} y={-2} width={12} height={8} rx={1} fill="#ef4444" />
          <text x={66} y={5} textAnchor="middle" fontSize={6} fill="#fff" fontFamily="mono">NC</text>
        </g>
      )
    }

    case "ir-sensor": {
      const detected = Boolean(runtime?.sensorValue)
      return (
        <g>
          <rect x="4" y="6" width="68" height="52" rx="10" fill="#162033" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="24" cy="24" r="9" fill="#020617" stroke="#475569" strokeWidth="2" />
          <circle cx="52" cy="24" r="9" fill="#020617" stroke="#475569" strokeWidth="2" />
          <circle cx="24" cy="24" r="4" fill={detected ? "#f43f5e" : "#334155"} />
          <circle cx="52" cy="24" r="4" fill={detected ? "#f43f5e" : "#334155"} />
          <rect x="17" y="40" width="42" height="10" rx="5" fill={detected ? "#f43f5e" : "#1e293b"} />
          <text x="38" y="48" textAnchor="middle" fontSize="7" fill="#e2e8f0" fontFamily="monospace" fontWeight="700">{detected ? "OBJECT" : "CLEAR"}</text>
        </g>
      )
    }

    case "dht11": {
      const temperature = Number(part.props.temperature ?? 25)
      const humidity = Number(part.props.humidity ?? 55)
      return (
        <g>
          <rect x="7" y="4" width="58" height="58" rx="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
          <rect x="14" y="12" width="44" height="34" rx="6" fill="#1e293b" />
          <text x="36" y="27" textAnchor="middle" fontSize="8" fill="#7dd3fc" fontFamily="monospace">T {temperature}°</text>
          <text x="36" y="39" textAnchor="middle" fontSize="8" fill="#67e8f9" fontFamily="monospace">H {humidity}%</text>
          <circle cx="18" cy="55" r="2.5" fill="#22c55e" opacity="0.9" />
        </g>
      )
    }

    case "oled-i2c": {
      const line1 = String(runtime?.lcdLine1 ?? part.props.line1 ?? "").slice(0, 18)
      const line2 = String(runtime?.lcdLine2 ?? part.props.line2 ?? "").slice(0, 18)
      const line3 = String(part.props.line3 ?? "").slice(0, 18)
      return (
        <g>
          <rect x="2" y="3" width="146" height="86" rx="9" fill="#111827" stroke="#334155" strokeWidth="2" />
          <rect x="12" y="14" width="126" height="60" rx="5" fill="#03111b" stroke="#0e7490" strokeWidth="1.5" />
          <text x="20" y="31" fontSize="9" fill="#67e8f9" fontFamily="monospace">{line1 || "PIXIU OLED"}</text>
          <text x="20" y="47" fontSize="9" fill="#22d3ee" fontFamily="monospace">{line2 || "READY"}</text>
          <text x="20" y="63" fontSize="8" fill="#0891b2" fontFamily="monospace">{line3}</text>
          <circle cx="126" cy="81" r="2" fill="#22d3ee" className={line1 || line2 ? "animate-pulse" : ""} />
        </g>
      )
    }

    case "joystick": {
      const x = Math.max(0, Math.min(1023, Number(part.props.x ?? 512)))
      const y = Math.max(0, Math.min(1023, Number(part.props.y ?? 512)))
      const knobX = 43 + ((x - 512) / 512) * 22
      const knobY = 43 + ((512 - y) / 512) * 22
      const pressed = String(part.props.pressed ?? "false") === "true"
      return (
        <g>
          <circle cx="43" cy="43" r="31" fill="#111827" stroke="#475569" strokeWidth="2" />
          <circle cx={knobX} cy={knobY} r="13" fill="#2563eb" stroke="#93c5fd" strokeWidth="2" />
          <circle cx={knobX - 3} cy={knobY - 3} r="3" fill="#dbeafe" opacity="0.8" />
          <text x="43" y="12" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">Y+</text>
          <text x="43" y="79" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">Y−</text>
          <text x="8" y="46" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">X−</text>
          <text x="78" y="46" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">X+</text>
          <circle cx="72" cy="14" r="5" fill={pressed ? "#f59e0b" : "#334155"} stroke="#94a3b8" />
        </g>
      )
    }

    case "l298n": {
      const speedA = Math.max(0, Math.min(255, Number(part.props.speedA ?? 0)))
      const speedB = Math.max(0, Math.min(255, Number(part.props.speedB ?? 0)))
      return (
        <g>
          <rect x="2" y="4" width="116" height="88" rx="7" fill="#153e75" stroke="#1d4ed8" strokeWidth="2" />
          <rect x="46" y="16" width="28" height="36" rx="2" fill="#0f172a" stroke="#334155" />
          <text x="60" y="37" textAnchor="middle" fontSize="8" fill="#cbd5e1" fontFamily="monospace" fontWeight="700">L298N</text>
          <text x="12" y="68" fontSize="8" fill="#93c5fd" fontFamily="monospace">A:{speedA}</text>
          <text x="65" y="68" fontSize="8" fill="#93c5fd" fontFamily="monospace">B:{speedB}</text>
          <rect x="10" y="74" width="100" height="7" rx="3" fill="#0f172a" />
          <rect x="11" y="75" width={98 * (speedA / 255)} height="5" rx="2" fill="#22c55e" />
        </g>
      )
    }

    case "rotary-encoder": {
      const value = Number(part.props.value ?? 0)
      const pressed = String(part.props.pressed ?? "false") === "true"
      const angle = ((value % 20) / 20) * Math.PI * 2
      const markerX = 37 + Math.cos(angle - Math.PI / 2) * 20
      const markerY = 37 + Math.sin(angle - Math.PI / 2) * 20
      return (
        <g>
          <circle cx="37" cy="37" r="29" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <circle cx="37" cy="37" r="18" fill="#0f172a" stroke="#334155" />
          <line x1="37" y1="37" x2={markerX} y2={markerY} stroke="#60a5fa" strokeWidth="4" strokeLinecap="round" />
          <circle cx={markerX} cy={markerY} r="3" fill="#dbeafe" />
          <circle cx="37" cy="37" r={pressed ? 9 : 6} fill={pressed ? "#f59e0b" : "#334155"} stroke="#cbd5e1" strokeWidth="1.2" />
          <text x="37" y="67" textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="monospace">CNT {value}</text>
        </g>
      )
    }

    case "soil-moisture": {
      const moisture = Math.max(0, Math.min(1023, Number(part.props.moisture ?? 620)))
      const wet = moisture > 700
      return (
        <g>
          <rect x="8" y="5" width="56" height="50" rx="8" fill="#92400e" stroke="#f59e0b" strokeWidth="2" />
          <path d="M18 20 C22 13, 27 13, 31 20 C35 27, 31 34, 25 34 C19 34, 15 27, 18 20Z" fill={wet ? "#38bdf8" : "#a16207"} />
          <path d="M37 16 C40 12, 44 13, 46 18 L52 34" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          <rect x="14" y="40" width="44" height="8" rx="4" fill="#451a03" />
          <rect x="15" y="41" width={42 * (moisture / 1023)} height="6" rx="3" fill={wet ? "#38bdf8" : "#f59e0b"} />
        </g>
      )
    }

    case "keypad-4x4": {
      const keys = [["1","2","3","A"],["4","5","6","B"],["7","8","9","C"],["*","0","#","D"]]
      const lastKey = String(part.props.lastKey ?? "")
      return (
        <g>
          <rect x="2" y="3" width="114" height="114" rx="8" fill="#111827" stroke="#475569" strokeWidth="2" />
          {keys.flatMap((row, r) => row.map((label, col) => {
            const x = 10 + col * 26
            const y = 12 + r * 26
            const active = label === lastKey
            return (
              <g key={label}>
                <rect x={x} y={y} width="20" height="20" rx="5" fill={active ? "#2563eb" : "#1e293b"} stroke={active ? "#93c5fd" : "#475569"} />
                <text x={x + 10} y={y + 13} textAnchor="middle" fontSize="8" fill="#e2e8f0" fontFamily="monospace" fontWeight="700">{label}</text>
              </g>
            )
          }))}
        </g>
      )
    }

    default:
      return null
  }
}
