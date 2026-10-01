import type { PlacedPart } from "@/lib/circuit-types"
import type { PartRuntime } from "./part-art"

interface SchematicPartArtProps {
  part: PlacedPart
  runtime?: PartRuntime
}

export function SchematicPartArt({ part, runtime }: { part: PlacedPart; runtime?: PartRuntime }) {
  switch (part.type) {
    case "resistor": {
      const resVal = part.props.resistance || 220
      return (
        <g className="schematic-symbol select-none">
          {/* IEEE Standard Zigzag Resistor */}
          <line x1={0} y1={12} x2={10} y2={12} stroke="#38bdf8" strokeWidth={2} />
          <path
            d="M 10,12 L 14,4 L 20,20 L 26,4 L 32,20 L 38,4 L 44,20 L 48,12 L 58,12"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
          <text x={29} y={-4} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="monospace" fontWeight={600}>
            {resVal}Ω
          </text>
          <text x={29} y={32} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily="sans-serif">
            R
          </text>
        </g>
      )
    }

    case "led": {
      const isLit = (runtime?.level ?? 0) > 0.1
      const isBurnt = runtime?.burnt
      return (
        <g className="schematic-symbol select-none">
          {/* Diode leads */}
          <line x1={0} y1={15} x2={16} y2={15} stroke="#38bdf8" strokeWidth={2} />
          <line x1={32} y1={15} x2={48} y2={15} stroke="#38bdf8" strokeWidth={2} />
          {/* Triangle */}
          <polygon
            points="16,5 16,25 32,15"
            fill={isBurnt ? "#451a03" : isLit ? "#22c55e" : "#0284c7"}
            stroke={isBurnt ? "#ef4444" : "#38bdf8"}
            strokeWidth={2}
          />
          {/* Cathode bar */}
          <line x1={32} y1={5} x2={32} y2={25} stroke={isBurnt ? "#ef4444" : "#38bdf8"} strokeWidth={2.5} />
          {/* Photon emission arrows */}
          <g stroke={isLit ? "#eab308" : "#64748b"} strokeWidth={1.5} fill={isLit ? "#eab308" : "#64748b"}>
            <line x1={24} y1={5} x2={34} y2={-5} />
            <polygon points="34,-5 29,-3 32,-1" />
            <line x1={30} y1={7} x2={40} y2={-3} />
            <polygon points="40,-3 35,-1 38,1" />
          </g>
          <text x={24} y={38} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="sans-serif" fontWeight={600}>
            LED {isBurnt ? "(BURNT)" : ""}
          </text>
        </g>
      )
    }

    case "pushbutton": {
      const isPressed = (runtime?.level ?? 0) > 0
      return (
        <g className="schematic-symbol select-none">
          <circle cx={10} cy={16} r={3} fill="none" stroke="#38bdf8" strokeWidth={2} />
          <circle cx={42} cy={16} r={3} fill="none" stroke="#38bdf8" strokeWidth={2} />
          {/* Switch blade contact */}
          <line
            x1={10}
            y1={13}
            x2={38}
            y2={isPressed ? 13 : 2}
            stroke="#38bdf8"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* Push actuator handle */}
          <line x1={24} y1={isPressed ? 13 : 7} x2={24} y2={isPressed ? 2 : -4} stroke="#94a3b8" strokeWidth={2} />
          <line x1={18} y1={isPressed ? 2 : -4} x2={30} y2={isPressed ? 2 : -4} stroke="#94a3b8" strokeWidth={2} />
          <text x={26} y={32} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="sans-serif">
            SW (NO)
          </text>
        </g>
      )
    }

    case "potentiometer": {
      return (
        <g className="schematic-symbol select-none">
          {/* Zigzag body */}
          <line x1={0} y1={18} x2={8} y2={18} stroke="#38bdf8" strokeWidth={2} />
          <path
            d="M 8,18 L 12,10 L 18,26 L 24,10 L 30,26 L 36,10 L 42,26 L 46,18 L 54,18"
            stroke="#38bdf8"
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
          {/* Wiper arrow pointing to center */}
          <line x1={27} y1={36} x2={27} y2={22} stroke="#38bdf8" strokeWidth={2} />
          <polygon points="27,18 24,24 30,24" fill="#38bdf8" />
          <text x={27} y={4} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            10kΩ POT
          </text>
        </g>
      )
    }

    case "battery": {
      return (
        <g className="schematic-symbol select-none">
          {/* Lead lines */}
          <line x1={0} y1={20} x2={16} y2={20} stroke="#38bdf8" strokeWidth={2} />
          <line x1={28} y1={20} x2={44} y2={20} stroke="#38bdf8" strokeWidth={2} />
          {/* Long line (+) */}
          <line x1={16} y1={6} x2={16} y2={34} stroke="#ef4444" strokeWidth={2.5} />
          {/* Short line (-) */}
          <line x1={22} y1={12} x2={22} y2={28} stroke="#3b82f6" strokeWidth={4} />
          {/* Polarity signs */}
          <text x={10} y={12} fontSize={10} fill="#ef4444" fontWeight="bold">+</text>
          <text x={32} y={12} fontSize={12} fill="#3b82f6" fontWeight="bold">−</text>
          <text x={22} y={46} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            9V DC
          </text>
        </g>
      )
    }

    case "buzzer": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={12} y={8} width={24} height={24} rx={2} fill="#1e293b" stroke="#38bdf8" strokeWidth={2} />
          <path d="M 24,8 L 36,0 L 36,32 L 24,24 Z" fill="#0f172a" stroke="#38bdf8" strokeWidth={2} />
          <line x1={0} y1={14} x2={12} y2={14} stroke="#38bdf8" strokeWidth={2} />
          <line x1={0} y1={26} x2={12} y2={26} stroke="#38bdf8" strokeWidth={2} />
          <text x={24} y={42} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="sans-serif">
            BUZZER
          </text>
        </g>
      )
    }

    case "arduino-uno": {
      return (
        <g className="schematic-symbol select-none">
          {/* Main IC Block */}
          <rect
            x={10}
            y={10}
            width={300}
            height={180}
            rx={4}
            fill="#090d16"
            stroke="#0284c7"
            strokeWidth={2.5}
          />
          {/* Header Bar */}
          <rect x={10} y={10} width={300} height={26} fill="#0369a1" />
          <text x={160} y={27} textAnchor="middle" fontSize={12} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            U1 : ATMEGA328P (ARDUINO UNO R3)
          </text>

          {/* Sub-group Dividers */}
          <line x1={150} y1={36} x2={150} y2={190} stroke="#1e293b" strokeDasharray="3 3" />

          {/* Left Side Label: POWER & ANALOG */}
          <text x={20} y={50} fontSize={9} fill="#38bdf8" fontWeight={700}>
            [POWER / ANALOG]
          </text>
          {/* Left Pins: 5V, 3V3, GND, VIN, A0-A5 */}
          {[
            { label: "5V (VCC)", y: 68 },
            { label: "3V3 (3.3V)", y: 84 },
            { label: "GND (PWR)", y: 100 },
            { label: "VIN (RAW)", y: 116 },
            { label: "A0 (ADC0)", y: 132 },
            { label: "A1 (ADC1)", y: 148 },
            { label: "A2 (ADC2)", y: 164 },
            { label: "A3 (ADC3)", y: 180 },
          ].map((pin) => (
            <g key={pin.label}>
              <line x1={0} y1={pin.y} x2={10} y2={pin.y} stroke="#38bdf8" strokeWidth={1.5} />
              <text x={16} y={pin.y + 3} fontSize={8} fill="#cbd5e1" fontFamily="monospace">
                {pin.label}
              </text>
            </g>
          ))}

          {/* Right Side Label: DIGITAL & PWM */}
          <text x={165} y={50} fontSize={9} fill="#38bdf8" fontWeight={700}>
            [DIGITAL I/O & PWM]
          </text>
          {/* Right Pins: D0-D13 */}
          {[
            { label: "D13 (SCK/LED)", y: 68 },
            { label: "D12 (MISO)", y: 82 },
            { label: "D11 (~PWM/MOSI)", y: 96 },
            { label: "D10 (~PWM/SS)", y: 110 },
            { label: "D9 (~PWM)", y: 124 },
            { label: "D8", y: 138 },
            { label: "D7..D2 (GPIO)", y: 152 },
            { label: "D1 (TX) / D0 (RX)", y: 166 },
            { label: "AREF / RESET", y: 180 },
          ].map((pin) => (
            <g key={pin.label}>
              <line x1={310} y1={pin.y} x2={320} y2={pin.y} stroke="#38bdf8" strokeWidth={1.5} />
              <text x={302} y={pin.y + 3} textAnchor="end" fontSize={8} fill="#cbd5e1" fontFamily="monospace">
                {pin.label}
              </text>
            </g>
          ))}
        </g>
      )
    }

    case "neopixel-ring": {
      const colors = runtime?.pixelColors ?? ["#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8"]
      return (
        <g className="schematic-symbol select-none">
          {/* Circular ring schematic block */}
          <circle cx={50} cy={50} r={44} fill="#090d16" stroke="#a855f7" strokeWidth={2} />
          <circle cx={50} cy={50} r={28} fill="#020617" stroke="#6b21a8" strokeWidth={1.5} />
          {/* 8 LED dots */}
          {colors.map((c, i) => {
            const rad = (i * Math.PI * 2) / 8 - Math.PI / 2
            const cx = 50 + Math.cos(rad) * 36
            const cy = 50 + Math.sin(rad) * 36
            return <circle key={i} cx={cx} cy={cy} r={4} fill={c} stroke="#ffffff" strokeWidth={0.8} />
          })}
          <text x={50} y={48} textAnchor="middle" fontSize={8} fill="#e9d5ff" fontFamily="monospace" fontWeight={700}>
            WS2812B
          </text>
          <text x={50} y={58} textAnchor="middle" fontSize={7} fill="#c084fc">
            8-RGB RING
          </text>
        </g>
      )
    }

    case "mq2-gas": {
      const gasLevel = runtime?.gasLevel ?? part.props.gasLevel ?? 150
      return (
        <g className="schematic-symbol select-none">
          <rect x={6} y={6} width={68} height={78} rx={4} fill="#090d16" stroke="#f59e0b" strokeWidth={2} />
          <circle cx={40} cy={34} r={20} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.5} />
          {/* Coil heater symbol */}
          <path d="M 28,34 Q 34,26 40,34 Q 46,42 52,34" fill="none" stroke="#f97316" strokeWidth={2} />
          <text x={40} y={64} textAnchor="middle" fontSize={8} fill="#fcd34d" fontFamily="monospace" fontWeight={700}>
            MQ-2 GAS
          </text>
          <text x={40} y={74} textAnchor="middle" fontSize={7} fill="#94a3b8">
            {gasLevel} PPM
          </text>
        </g>
      )
    }

    case "servo": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={8} y={6} width={68} height={64} rx={4} fill="#090d16" stroke="#38bdf8" strokeWidth={2} />
          <circle cx={42} cy={34} r={18} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.5} />
          <text x={42} y={38} textAnchor="middle" fontSize={11} fill="#38bdf8" fontWeight={700} fontFamily="sans-serif">
            M
          </text>
          <text x={42} y={60} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">
            SERVO ({Math.round(runtime?.angle ?? 0)}°)
          </text>
        </g>
      )
    }

    case "dc-motor": {
      return (
        <g className="schematic-symbol select-none">
          <circle cx={40} cy={35} r={24} fill="#090d16" stroke="#38bdf8" strokeWidth={2} />
          <text x={40} y={40} textAnchor="middle" fontSize={16} fill="#38bdf8" fontWeight={700} fontFamily="sans-serif">
            M
          </text>
          <text x={40} y={66} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="monospace">
            {runtime?.rpm ? `${runtime.rpm} RPM` : "DC MOTOR"}
          </text>
        </g>
      )
    }

    case "npn-transistor": {
      return (
        <g className="schematic-symbol select-none">
          <circle cx={30} cy={30} r={24} fill="#090d16" stroke="#38bdf8" strokeWidth={1.5} />
          {/* Base line */}
          <line x1={22} y1={14} x2={22} y2={46} stroke="#38bdf8" strokeWidth={3} />
          <line x1={6} y1={30} x2={22} y2={30} stroke="#38bdf8" strokeWidth={2} />
          {/* Collector */}
          <line x1={22} y1={20} x2={40} y2={10} stroke="#38bdf8" strokeWidth={2} />
          {/* Emitter with arrow */}
          <line x1={22} y1={40} x2={40} y2={50} stroke="#38bdf8" strokeWidth={2} />
          <polygon points="40,50 32,46 34,42" fill="#38bdf8" />
          <text x={30} y={-4} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="sans-serif">
            NPN (Q1)
          </text>
        </g>
      )
    }

    case "relay": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={76} height={60} rx={4} fill="#090d16" stroke="#38bdf8" strokeWidth={2} />
          {/* Coil box */}
          <rect x={12} y={16} width={20} height={36} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={12} y1={16} x2={32} y2={52} stroke="#38bdf8" strokeWidth={1.2} />
          {/* Contact switch */}
          <circle cx={50} cy={34} r={2} fill="#38bdf8" />
          <line x1={50} y1={34} x2={66} y2={runtime?.relayActive ? 22 : 46} stroke="#38bdf8" strokeWidth={2} />
          <circle cx={66} cy={22} r={2} fill="#38bdf8" />
          <circle cx={66} cy={46} r={2} fill="#38bdf8" />
          <text x={42} y={12} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="monospace">
            RELAY (K1)
          </text>
        </g>
      )
    }

    case "ultrasonic": {
      const dist = runtime?.sensorValue ?? part.props.distance ?? 42
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={82} height={52} rx={4} fill="#090d16" stroke="#06b6d4" strokeWidth={2} />
          <circle cx={26} cy={26} r={14} fill="#1e293b" stroke="#06b6d4" strokeWidth={1.5} />
          <circle cx={64} cy={26} r={14} fill="#1e293b" stroke="#06b6d4" strokeWidth={1.5} />
          <text x={26} y={30} textAnchor="middle" fontSize={9} fill="#67e8f9" fontWeight={700}>T</text>
          <text x={64} y={30} textAnchor="middle" fontSize={9} fill="#67e8f9" fontWeight={700}>R</text>
          <text x={45} y={50} textAnchor="middle" fontSize={8} fill="#cbd5e1" fontFamily="monospace">
            HC-SR04 : {dist}cm
          </text>
        </g>
      )
    }

    case "dht11": {
      const t = runtime?.dhtTemperature ?? part.props.temperature ?? 25
      const h = runtime?.dhtHumidity ?? part.props.humidity ?? 55
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={64} height={58} rx={4} fill="#090d16" stroke="#3b82f6" strokeWidth={2} />
          <text x={36} y={22} textAnchor="middle" fontSize={9} fill="#93c5fd" fontWeight={700}>
            DHT11
          </text>
          <text x={36} y={38} textAnchor="middle" fontSize={8} fill="#cbd5e1" fontFamily="monospace">
            {t}°C · {h}%
          </text>
        </g>
      )
    }

    case "breadboard": {
      return (
        <g className="schematic-symbol select-none opacity-40">
          <rect x={0} y={0} width={460} height={214} rx={6} fill="#040812" stroke="#1e293b" strokeWidth={1.5} strokeDasharray="4 4" />
          <text x={230} y={112} textAnchor="middle" fontSize={11} fill="#475569" fontFamily="monospace" letterSpacing="0.1em">
            [BREADBOARD DISTRIBUTION BUS MATRIX]
          </text>
        </g>
      )
    }

    default:
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={52} height={42} rx={4} fill="#090d16" stroke="#64748b" strokeWidth={1.5} />
          <text x={30} y={26} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="monospace">
            {part.type.toUpperCase()}
          </text>
        </g>
      )
  }
}
