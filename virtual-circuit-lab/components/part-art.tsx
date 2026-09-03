import type { PlacedPart } from "@/lib/circuit-types"

export interface PartRuntime {
  /** 0..1 brightness for LEDs / on-off for others */
  level?: number
  /** servo angle in degrees */
  angle?: number
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
          <rect x={0} y={0} width={420} height={150} rx={6} fill="#e8e6dd" stroke="#c9c6ba" />
          {/* power rails */}
          <line x1={16} y1={14} x2={404} y2={14} stroke="#d33" strokeWidth={1.5} />
          <line x1={16} y1={30} x2={404} y2={30} stroke="#33f" strokeWidth={1.5} />
          <line x1={16} y1={120} x2={404} y2={120} stroke="#d33" strokeWidth={1.5} />
          <line x1={16} y1={136} x2={404} y2={136} stroke="#33f" strokeWidth={1.5} />
          {/* center trench */}
          <rect x={0} y={72} width={420} height={8} fill="#d8d5c9" />
          {/* tie point holes */}
          {Array.from({ length: 30 }).map((_, c) =>
            Array.from({ length: 4 }).map((_, r) => (
              <circle
                key={`${c}-${r}`}
                cx={20 + c * 13.4}
                cy={r < 2 ? 52 + r * 9 : 90 + (r - 2) * 9}
                r={1.6}
                fill="#a8a498"
              />
            )),
          )}
        </g>
      )

    case "led": {
      const color = LED_COLORS[String(part.props.color ?? "red")] ?? LED_COLORS.red
      const level = runtime?.level ?? 0
      return (
        <g>
          {/* legs */}
          <line x1={14} y1={44} x2={14} y2={62} stroke="#9aa0a6" strokeWidth={2} />
          <line x1={30} y1={40} x2={30} y2={62} stroke="#9aa0a6" strokeWidth={2} />
          {level > 0 && <circle cx={22} cy={22} r={26} fill={color} opacity={0.28 * level} />}
          {/* bulb */}
          <path d="M6 24 A16 16 0 0 1 38 24 L38 40 L6 40 Z" fill={color} opacity={0.85} />
          <ellipse cx={22} cy={24} rx={16} ry={16} fill={color} opacity={level > 0 ? 0.6 + 0.4 * level : 0.55} />
          <ellipse cx={16} cy={18} rx={4} ry={6} fill="#ffffff" opacity={0.5} />
          <rect x={6} y={38} width={32} height={5} rx={1} fill="#cfd3d8" />
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
      return (
        <g>
          <rect x={16} y={10} width={56} height={40} rx={3} fill="#1e3a8a" stroke="#0b1d52" />
          <circle cx={44} cy={18} r={10} fill="#93c5fd" />
          <g transform={`rotate(${angle - 90} 44 18)`}>
            <rect x={42} y={0} width={4} height={20} rx={2} fill="#f8fafc" />
            <circle cx={44} cy={2} r={3} fill="#f8fafc" />
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
          <text x={28} y={30} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="monospace">
            +
          </text>
        </g>
      )
    }

    default:
      return null
  }
}
