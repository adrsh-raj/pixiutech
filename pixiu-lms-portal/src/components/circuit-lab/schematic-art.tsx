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

    case "esp32-devkit": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={10} y={10} width={220} height={350} rx={4} fill="#090d16" stroke="#06b6d4" strokeWidth={2.5} />
          <rect x={10} y={10} width={220} height={26} fill="#0e7490" />
          <text x={120} y={27} textAnchor="middle" fontSize={11} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            U1 : ESP32-WROOM-32 (3.3V)
          </text>
          <text x={20} y={48} fontSize={8} fill="#38bdf8" fontWeight={700}>[LEFT HEADER]</text>
          <text x={220} y={48} textAnchor="end" fontSize={8} fill="#38bdf8" fontWeight={700}>[RIGHT HEADER]</text>
          {Array.from({ length: 15 }).map((_, i) => (
            <g key={i}>
              <line x1={0} y1={35 + i * 22} x2={10} y2={35 + i * 22} stroke="#06b6d4" strokeWidth={1.5} />
              <line x1={230} y1={35 + i * 22} x2={240} y2={35 + i * 22} stroke="#06b6d4" strokeWidth={1.5} />
            </g>
          ))}
          <text x={120} y={190} textAnchor="middle" fontSize={10} fill="#67e8f9" fontFamily="monospace" fontWeight={700}>
            WiFi 802.11 b/g/n
          </text>
          <text x={120} y={205} textAnchor="middle" fontSize={10} fill="#67e8f9" fontFamily="monospace" fontWeight={700}>
            Bluetooth 4.2 / BLE
          </text>
          <text x={120} y={220} textAnchor="middle" fontSize={8.5} fill="#94a3b8" fontFamily="monospace">
            240MHz Dual-Core
          </text>
        </g>
      )
    }

    case "rpi-pico": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={10} y={10} width={200} height={360} rx={4} fill="#090d16" stroke="#10b981" strokeWidth={2.5} />
          <rect x={10} y={10} width={200} height={26} fill="#047857" />
          <text x={110} y={27} textAnchor="middle" fontSize={11} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            U1 : RP2040 (PICO 3.3V)
          </text>
          <text x={110} y={190} textAnchor="middle" fontSize={10} fill="#34d399" fontFamily="monospace" fontWeight={700}>
            ARM Cortex-M0+
          </text>
        </g>
      )
    }

    case "microbit-v2": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={10} y={10} width={300} height={240} rx={4} fill="#090d16" stroke="#f59e0b" strokeWidth={2.5} />
          <rect x={10} y={10} width={300} height={26} fill="#b45309" />
          <text x={160} y={27} textAnchor="middle" fontSize={11} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            U1 : nRF52833 (MICRO:BIT 3.3V)
          </text>
          <text x={160} y={130} textAnchor="middle" fontSize={10} fill="#fbbf24" fontFamily="monospace" fontWeight={700}>
            5x5 LED MATRIX & BLE
          </text>
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

    case "rgb-led": {
      const rLit = (runtime?.redLevel ?? 0) > 0.1
      const gLit = (runtime?.greenLevel ?? 0) > 0.1
      const bLit = (runtime?.blueLevel ?? 0) > 0.1
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={42} height={60} rx={4} fill="#090d16" stroke="#a855f7" strokeWidth={1.5} />
          {/* Common cathode bar at bottom */}
          <line x1={10} y1={50} x2={40} y2={50} stroke="#38bdf8" strokeWidth={2} />
          <line x1={18} y1={50} x2={18} y2={64} stroke="#38bdf8" strokeWidth={2} />
          <text x={18} y={60} fontSize={6} fill="#94a3b8" fontFamily="monospace">GND</text>
          
          {/* Red diode */}
          <line x1={10} y1={12} x2={10} y2={24} stroke="#ef4444" strokeWidth={1.5} />
          <polygon points="6,24 14,24 10,32" fill={rLit ? "#ef4444" : "#450a0a"} stroke="#ef4444" strokeWidth={1} />
          <line x1={6} y1={32} x2={14} y2={32} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={10} y1={32} x2={10} y2={50} stroke="#ef4444" strokeWidth={1.5} />
          <text x={10} y={10} textAnchor="middle" fontSize={6} fill="#ef4444" fontWeight={700}>R</text>

          {/* Green diode */}
          <line x1={26} y1={12} x2={26} y2={24} stroke="#22c55e" strokeWidth={1.5} />
          <polygon points="22,24 30,24 26,32" fill={gLit ? "#22c55e" : "#052e16"} stroke="#22c55e" strokeWidth={1} />
          <line x1={22} y1={32} x2={30} y2={32} stroke="#22c55e" strokeWidth={1.5} />
          <line x1={26} y1={32} x2={26} y2={50} stroke="#22c55e" strokeWidth={1.5} />
          <text x={26} y={10} textAnchor="middle" fontSize={6} fill="#22c55e" fontWeight={700}>G</text>

          {/* Blue diode */}
          <line x1={38} y1={12} x2={38} y2={24} stroke="#3b82f6" strokeWidth={1.5} />
          <polygon points="34,24 42,24 38,32" fill={bLit ? "#3b82f6" : "#0f172a"} stroke="#3b82f6" strokeWidth={1} />
          <line x1={34} y1={32} x2={42} y2={32} stroke="#3b82f6" strokeWidth={1.5} />
          <line x1={38} y1={32} x2={38} y2={50} stroke="#3b82f6" strokeWidth={1.5} />
          <text x={38} y={10} textAnchor="middle" fontSize={6} fill="#3b82f6" fontWeight={700}>B</text>
        </g>
      )
    }

    case "seven-segment": {
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={52} height={68} rx={4} fill="#090d16" stroke="#ef4444" strokeWidth={1.5} />
          {/* Internal 7-segment digit glyph */}
          <text x={30} y={44} textAnchor="middle" fontSize={26} fill="#ef4444" fontFamily="monospace" fontWeight={700}>
            8
          </text>
          <text x={30} y={58} textAnchor="middle" fontSize={6.5} fill="#fca5a5" fontFamily="monospace">
            7-SEG (CC)
          </text>
          {/* Top pin leads e, f, g, dp */}
          <line x1={10} y1={0} x2={10} y2={6} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={22} y1={0} x2={22} y2={6} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={34} y1={0} x2={34} y2={6} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={46} y1={0} x2={46} y2={6} stroke="#38bdf8" strokeWidth={1.5} />
          {/* Bottom pin leads a, b, c, d */}
          <line x1={10} y1={74} x2={10} y2={80} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={22} y1={74} x2={22} y2={80} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={34} y1={74} x2={34} y2={80} stroke="#38bdf8" strokeWidth={1.5} />
          <line x1={46} y1={74} x2={46} y2={80} stroke="#38bdf8" strokeWidth={1.5} />
          {/* Common Pin */}
          <line x1={56} y1={40} x2={60} y2={40} stroke="#38bdf8" strokeWidth={1.5} />
          <text x={53} y={43} textAnchor="end" fontSize={6} fill="#94a3b8">COM</text>
        </g>
      )
    }

    case "ldr": {
      const lightVal = runtime?.sensorValue ?? part.props.light ?? 512
      return (
        <g className="schematic-symbol select-none">
          {/* Leads */}
          <line x1={0} y1={25} x2={10} y2={25} stroke="#38bdf8" strokeWidth={2} />
          <line x1={30} y1={25} x2={40} y2={25} stroke="#38bdf8" strokeWidth={2} />
          {/* Circle surrounding photoresistor */}
          <circle cx={20} cy={25} r={14} fill="#090d16" stroke="#eab308" strokeWidth={1.5} />
          {/* Zigzag resistor */}
          <path
            d="M 10,25 L 12,21 L 16,29 L 20,21 L 24,29 L 28,21 L 30,25"
            stroke="#eab308"
            strokeWidth={1.5}
            fill="none"
            strokeLinejoin="round"
          />
          {/* Inward photon arrows */}
          <line x1={8} y1={10} x2={16} y2={18} stroke="#fde047" strokeWidth={1.5} />
          <polygon points="16,18 12,16 15,13" fill="#fde047" />
          <line x1={15} y1={8} x2={23} y2={16} stroke="#fde047" strokeWidth={1.5} />
          <polygon points="23,16 19,14 22,11" fill="#fde047" />
          <text x={20} y={45} textAnchor="middle" fontSize={7.5} fill="#fef08a" fontFamily="monospace">
            {lightVal} Lux
          </text>
        </g>
      )
    }

    case "tmp36": {
      const tempVal = runtime?.sensorValue ?? part.props.temperature ?? 25
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={32} height={38} rx={3} fill="#090d16" stroke="#f97316" strokeWidth={1.8} />
          {/* Internal bandgap temperature sensor diode symbol */}
          <line x1={20} y1={12} x2={20} y2={18} stroke="#f97316" strokeWidth={1.2} />
          <polygon points="17,18 23,18 20,24" fill="#f97316" stroke="#f97316" strokeWidth={0.8} />
          <line x1={17} y1={24} x2={23} y2={24} stroke="#f97316" strokeWidth={1.2} />
          <line x1={20} y1={24} x2={20} y2={30} stroke="#f97316" strokeWidth={1.2} />
          <text x={20} y={38} textAnchor="middle" fontSize={6} fill="#fb923c" fontFamily="monospace">
            TMP36
          </text>
          {/* Leads */}
          <line x1={6} y1={44} x2={6} y2={50} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={20} y1={44} x2={20} y2={50} stroke="#f97316" strokeWidth={1.5} />
          <line x1={34} y1={44} x2={34} y2={50} stroke="#1e293b" strokeWidth={1.5} />
          <text x={20} y={2} textAnchor="middle" fontSize={7.5} fill="#fdba74" fontFamily="monospace">
            {tempVal}°C
          </text>
        </g>
      )
    }

    case "pir-sensor": {
      const triggered = (runtime?.level ?? 0) > 0
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={52} height={58} rx={4} fill="#090d16" stroke="#16a34a" strokeWidth={2} />
          {/* Dual-element pyroelectric detector & Fresnel lens arc */}
          <path d="M 16,22 Q 30,12 44,22" fill="none" stroke="#4ade80" strokeWidth={1.5} strokeDasharray="2 2" />
          <rect x={22} y={20} width={7} height={12} rx={1} fill={triggered ? "#ef4444" : "#166534"} stroke="#22c55e" strokeWidth={1} />
          <rect x={31} y={20} width={7} height={12} rx={1} fill={triggered ? "#ef4444" : "#166534"} stroke="#22c55e" strokeWidth={1} />
          <text x={30} y={42} textAnchor="middle" fontSize={7.5} fill="#86efac" fontFamily="monospace" fontWeight={700}>
            PIR (BISS0001)
          </text>
          <text x={30} y={54} textAnchor="middle" fontSize={6.5} fill={triggered ? "#f87171" : "#94a3b8"} fontFamily="monospace">
            {triggered ? "MOTION ACTIVE" : "QUIET"}
          </text>
          {/* Leads at bottom */}
          <line x1={10} y1={64} x2={10} y2={70} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={30} y1={64} x2={30} y2={70} stroke="#22c55e" strokeWidth={1.5} />
          <line x1={50} y1={64} x2={50} y2={70} stroke="#1e293b" strokeWidth={1.5} />
        </g>
      )
    }

    case "ir-sensor": {
      const detected = (runtime?.level ?? 0) > 0
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={68} height={52} rx={4} fill="#090d16" stroke="#ec4899" strokeWidth={2} />
          {/* IR Emitter diode */}
          <polygon points="18,18 26,18 22,25" fill="#f43f5e" stroke="#fb7185" strokeWidth={1} />
          <line x1={18} y1={25} x2={26} y2={25} stroke="#fb7185" strokeWidth={1.5} />
          <line x1={26} y1={14} x2={32} y2={8} stroke="#fda4af" strokeWidth={1.2} />
          <polygon points="32,8 28,9 30,12" fill="#fda4af" />
          
          {/* Photodiode receiver */}
          <polygon points="46,25 54,25 50,18" fill="#a855f7" stroke="#c084fc" strokeWidth={1} />
          <line x1={46} y1={18} x2={54} y2={18} stroke="#c084fc" strokeWidth={1.5} />
          <line x1={40} y1={8} x2={46} y2={14} stroke="#e9d5ff" strokeWidth={1.2} />
          <polygon points="46,14 42,13 44,10" fill="#e9d5ff" />

          {/* Comparator output indicator */}
          <text x={36} y={38} textAnchor="middle" fontSize={7} fill="#f472b6" fontFamily="monospace" fontWeight={700}>
            LM393 COMPARATOR
          </text>
          <text x={36} y={48} textAnchor="middle" fontSize={6.5} fill={detected ? "#f43f5e" : "#94a3b8"} fontFamily="monospace">
            {detected ? "OBJECT DETECTED" : "CLEAR"}
          </text>
        </g>
      )
    }

    case "lcd-i2c": {
      const l1 = runtime?.lcdLine1 ?? part.props.line1 ?? ""
      const l2 = runtime?.lcdLine2 ?? part.props.line2 ?? ""
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={172} height={68} rx={4} fill="#090d16" stroke="#22c55e" strokeWidth={2} />
          <rect x={12} y={12} width={156} height={36} rx={2} fill="#052e16" stroke="#15803d" strokeWidth={1.5} />
          <text x={18} y={25} fontSize={8.5} fill="#4ade80" fontFamily="monospace">
            {(l1 || "LCD 1602").slice(0, 16)}
          </text>
          <text x={18} y={38} fontSize={8.5} fill="#4ade80" fontFamily="monospace">
            {(l2 || "I2C BUS PCF8574").slice(0, 16)}
          </text>
          {/* I2C Backpack pins */}
          <rect x={20} y={52} width={140} height={16} rx={2} fill="#1e293b" />
          <text x={30} y={63} textAnchor="middle" fontSize={6.5} fill="#a3e635" fontFamily="monospace">GND</text>
          <text x={60} y={63} textAnchor="middle" fontSize={6.5} fill="#ef4444" fontFamily="monospace">VCC</text>
          <text x={90} y={63} textAnchor="middle" fontSize={6.5} fill="#60a5fa" fontFamily="monospace">SDA</text>
          <text x={120} y={63} textAnchor="middle" fontSize={6.5} fill="#fbbf24" fontFamily="monospace">SCL</text>
        </g>
      )
    }

    case "oled-i2c": {
      const l1 = runtime?.lcdLine1 ?? part.props.line1 ?? ""
      const l2 = runtime?.lcdLine2 ?? part.props.line2 ?? ""
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={142} height={80} rx={5} fill="#090d16" stroke="#06b6d4" strokeWidth={2} />
          <rect x={12} y={12} width={126} height={52} rx={3} fill="#021c29" stroke="#0891b2" strokeWidth={1.2} />
          <text x={18} y={28} fontSize={8} fill="#67e8f9" fontFamily="monospace">
            {(l1 || "SSD1306 OLED").slice(0, 18)}
          </text>
          <text x={18} y={42} fontSize={8} fill="#22d3ee" fontFamily="monospace">
            {(l2 || "128x64 GRAPHIC").slice(0, 18)}
          </text>
          <text x={18} y={56} fontSize={7} fill="#0e7490" fontFamily="monospace">
            I2C CONTROLLER
          </text>
          {/* Pins at bottom */}
          <text x={28} y={78} textAnchor="middle" fontSize={6.5} fill="#a3e635" fontFamily="monospace">GND</text>
          <text x={58} y={78} textAnchor="middle" fontSize={6.5} fill="#ef4444" fontFamily="monospace">VCC</text>
          <text x={88} y={78} textAnchor="middle" fontSize={6.5} fill="#fbbf24" fontFamily="monospace">SCL</text>
          <text x={118} y={78} textAnchor="middle" fontSize={6.5} fill="#60a5fa" fontFamily="monospace">SDA</text>
        </g>
      )
    }

    case "joystick": {
      const jx = Math.round(runtime?.joystickX ?? part.props.x ?? 512)
      const jy = Math.round(runtime?.joystickY ?? part.props.y ?? 512)
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={78} height={74} rx={4} fill="#090d16" stroke="#eab308" strokeWidth={2} />
          {/* Dual orthogonal potentiometer wipers */}
          <path d="M 12,24 L 16,18 L 22,30 L 28,18 L 34,30 L 38,24" stroke="#eab308" strokeWidth={1.5} fill="none" />
          <line x1={25} y1={36} x2={25} y2={26} stroke="#eab308" strokeWidth={1.5} />
          <polygon points="25,24 23,28 27,28" fill="#eab308" />
          <text x={25} y={14} textAnchor="middle" fontSize={6} fill="#fde047" fontFamily="monospace">VRX:{jx}</text>

          <path d="M 44,24 L 48,18 L 54,30 L 60,18 L 66,30 L 70,24" stroke="#eab308" strokeWidth={1.5} fill="none" />
          <line x1={57} y1={36} x2={57} y2={26} stroke="#eab308" strokeWidth={1.5} />
          <polygon points="57,24 55,28 59,28" fill="#eab308" />
          <text x={57} y={14} textAnchor="middle" fontSize={6} fill="#fde047" fontFamily="monospace">VRY:{jy}</text>

          {/* SW switch */}
          <circle cx={35} cy={50} r={2} fill="none" stroke="#eab308" strokeWidth={1.2} />
          <circle cx={47} cy={50} r={2} fill="none" stroke="#eab308" strokeWidth={1.2} />
          <line x1={37} y1={49} x2={47} y2={43} stroke="#eab308" strokeWidth={1.5} />
          <text x={41} y={60} textAnchor="middle" fontSize={6} fill="#94a3b8" fontFamily="monospace">SW CLICK</text>

          {/* Pin headers at bottom */}
          <text x={10} y={74} textAnchor="middle" fontSize={5.5} fill="#a3e635" fontFamily="monospace">GND</text>
          <text x={28} y={74} textAnchor="middle" fontSize={5.5} fill="#ef4444" fontFamily="monospace">5V</text>
          <text x={46} y={74} textAnchor="middle" fontSize={5.5} fill="#eab308" fontFamily="monospace">VRX</text>
          <text x={64} y={74} textAnchor="middle" fontSize={5.5} fill="#eab308" fontFamily="monospace">VRY</text>
          <text x={78} y={74} textAnchor="middle" fontSize={5.5} fill="#60a5fa" fontFamily="monospace">SW</text>
        </g>
      )
    }

    case "l298n": {
      const mA = runtime?.motorARpm ?? 0
      const mB = runtime?.motorBRpm ?? 0
      return (
        <g className="schematic-symbol select-none">
          <rect x={6} y={6} width={108} height={84} rx={4} fill="#090d16" stroke="#3b82f6" strokeWidth={2.5} />
          <rect x={6} y={6} width={108} height={16} fill="#1e3a8a" />
          <text x={60} y={17} textAnchor="middle" fontSize={8} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            L298N DUAL H-BRIDGE
          </text>
          {/* Dual H-Bridge Schematics */}
          <rect x={12} y={26} width={42} height={40} rx={2} fill="#0f172a" stroke="#2563eb" strokeWidth={1} />
          <text x={33} y={38} textAnchor="middle" fontSize={7} fill="#93c5fd" fontWeight={700}>BRIDGE A</text>
          <text x={33} y={50} textAnchor="middle" fontSize={6.5} fill="#60a5fa" fontFamily="monospace">{mA} RPM</text>

          <rect x={66} y={26} width={42} height={40} rx={2} fill="#0f172a" stroke="#2563eb" strokeWidth={1} />
          <text x={87} y={38} textAnchor="middle" fontSize={7} fill="#93c5fd" fontWeight={700}>BRIDGE B</text>
          <text x={87} y={50} textAnchor="middle" fontSize={6.5} fill="#60a5fa" fontFamily="monospace">{mB} RPM</text>

          {/* Pin bus notations */}
          <text x={60} y={76} textAnchor="middle" fontSize={6} fill="#cbd5e1" fontFamily="monospace">
            ENA·IN1·IN2·IN3·IN4·ENB
          </text>
        </g>
      )
    }

    case "rotary-encoder": {
      const count = Number(part.props.value ?? 0)
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={66} height={70} rx={4} fill="#090d16" stroke="#06b6d4" strokeWidth={2} />
          {/* Quadrature switch contacts */}
          <circle cx={22} cy={22} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
          <circle cx={44} cy={22} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
          <line x1={25} y1={21} x2={41} y2={14} stroke="#06b6d4" strokeWidth={1.5} />
          <text x={53} y={20} fontSize={6} fill="#67e8f9" fontFamily="monospace">CLK</text>
          
          <circle cx={22} cy={38} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
          <circle cx={44} cy={38} r={3} fill="none" stroke="#06b6d4" strokeWidth={1.5} />
          <line x1={25} y1={37} x2={41} y2={30} stroke="#06b6d4" strokeWidth={1.5} />
          <text x={53} y={36} fontSize={6} fill="#67e8f9" fontFamily="monospace">DT</text>

          <text x={37} y={54} textAnchor="middle" fontSize={7.5} fill="#a5f3fc" fontFamily="monospace" fontWeight={700}>
            COUNT: {count}
          </text>
        </g>
      )
    }

    case "soil-moisture": {
      const mVal = runtime?.sensorValue ?? part.props.moisture ?? 620
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={6} width={64} height={72} rx={4} fill="#090d16" stroke="#ca8a04" strokeWidth={2} />
          {/* Dual probe electrodes */}
          <line x1={22} y1={14} x2={22} y2={42} stroke="#eab308" strokeWidth={3} strokeLinecap="round" />
          <line x1={46} y1={14} x2={46} y2={42} stroke="#eab308" strokeWidth={3} strokeLinecap="round" />
          {/* Variable soil resistance zigzag */}
          <path d="M 22,28 L 26,24 L 32,32 L 38,24 L 42,32 L 46,28" stroke="#ca8a04" strokeWidth={1.2} fill="none" />
          <text x={34} y={54} textAnchor="middle" fontSize={7} fill="#fde047" fontFamily="monospace" fontWeight={700}>
            SOIL PROBE
          </text>
          <text x={34} y={66} textAnchor="middle" fontSize={6.5} fill="#fef08a" fontFamily="monospace">
            {mVal} ADC
          </text>
        </g>
      )
    }

    case "keypad-4x4": {
      const pressedKey = runtime?.keypadKey || part.props.lastKey || ""
      return (
        <g className="schematic-symbol select-none">
          <rect x={4} y={4} width={110} height={112} rx={6} fill="#090d16" stroke="#38bdf8" strokeWidth={2} />
          <rect x={4} y={4} width={110} height={16} fill="#0369a1" />
          <text x={59} y={15} textAnchor="middle" fontSize={8} fill="#f0f9ff" fontFamily="monospace" fontWeight={700}>
            4×4 MATRIX KEYPAD
          </text>
          {/* 4x4 Grid Matrix lines */}
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => {
              const kx = 18 + col * 26
              const ky = 30 + row * 20
              const label = ["1","2","3","A","4","5","6","B","7","8","9","C","*","0","#","D"][row * 4 + col]
              const isKeyActive = pressedKey === label
              return (
                <g key={`${row}-${col}`}>
                  <rect
                    x={kx}
                    y={ky}
                    width={18}
                    height={14}
                    rx={2}
                    fill={isKeyActive ? "#22c55e" : "#1e293b"}
                    stroke={isKeyActive ? "#86efac" : "#475569"}
                    strokeWidth={1}
                  />
                  <text
                    x={kx + 9}
                    y={ky + 10}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={700}
                    fill={isKeyActive ? "#000000" : "#f1f5f9"}
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              )
            })
          )}
          <text x={59} y={108} textAnchor="middle" fontSize={6} fill="#94a3b8" fontFamily="monospace">
            ROWS: D2..D5 · COLS: D6..D9
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
