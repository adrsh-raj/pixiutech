import type { PlacedPart } from "@/lib/circuit-types"
import { decodeSevenSegment, resolveSevenSegmentSegments } from "@/lib/seven-segment"
import { BREADBOARD_COLUMNS } from "@/lib/components-catalog"

export interface PartRuntime {
  /** 0..1 brightness for LEDs / on-off for others */
  level?: number
  /** servo angle in degrees */
  angle?: number
  /** for Arduino Uno: is Pin 13 HIGH */
  pin13High?: boolean
  /** for ESP32: is Pin D2 (GPIO2) HIGH */
  pin2High?: boolean
  /** for Raspberry Pi Pico: is GP25 HIGH */
  pin25High?: boolean
  /** for BBC micro:bit v2: 5x5 LED matrix active cells & button press state */
  matrix5x5?: boolean[][]
  btnAPressed?: boolean
  btnBPressed?: boolean
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
  /** Hardware-expansion sensor/driver states */
  dhtTemperature?: number
  dhtHumidity?: number
  joystickX?: number
  joystickY?: number
  joystickButton?: boolean
  motorARpm?: number
  motorBRpm?: number
  motorADirection?: "cw" | "ccw" | "stopped"
  motorBDirection?: "cw" | "ccw" | "stopped"
  encoderValue?: number
  encoderDirection?: "cw" | "ccw" | "idle"
  keypadKey?: string
  /** Transistor: conducting */
  conducting?: boolean
  /** NeoPixel WS2812B 8-RGB pixel colors */
  pixelColors?: string[]
  /** MQ-2 Gas sensor runtime values */
  gasLevel?: number
  gasAlert?: boolean
  /** Arduino board active digital/analog pins for live LED indicators */
  activePins?: Record<string, boolean | number>
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
    case "arduino-uno": {
      const TOP_PINS_META = [
        { id: "aref", label: "AREF", isPwm: false },
        { id: "gnd", label: "GND", isPwm: false },
        { id: "d13", label: "13", isPwm: false },
        { id: "d12", label: "12", isPwm: false },
        { id: "d11", label: "11", isPwm: true },
        { id: "d10", label: "10", isPwm: true },
        { id: "d9", label: "9", isPwm: true },
        { id: "d8", label: "8", isPwm: false },
        { id: "d7", label: "7", isPwm: false },
        { id: "d6", label: "6", isPwm: true },
        { id: "d5", label: "5", isPwm: true },
        { id: "d4", label: "4", isPwm: false },
        { id: "d3", label: "3", isPwm: true },
        { id: "d2", label: "2", isPwm: false },
        { id: "d1", label: "1", isPwm: false, sub: "TX" },
        { id: "d0", label: "0", isPwm: false, sub: "RX" },
      ]

      const BOTTOM_PINS_META = [
        { id: "5v", label: "5V", isAnalog: false },
        { id: "3v3", label: "3.3V", isAnalog: false },
        { id: "rst", label: "RESET", isAnalog: false },
        { id: "vin", label: "VIN", isAnalog: false },
        { id: "gnd_pwr", label: "GND", isAnalog: false },
        { id: "a0", label: "A0", isAnalog: true },
        { id: "a1", label: "A1", isAnalog: true },
        { id: "a2", label: "A2", isAnalog: true },
        { id: "a3", label: "A3", isAnalog: true },
        { id: "a4", label: "A4", isAnalog: true },
        { id: "a5", label: "A5", isAnalog: true },
      ]

      return (
        <g className="select-none">
          {/* Main PCB substrate with official vibrant Arduino Teal */}
          <rect x={0} y={0} width={320} height={200} rx={10} fill="#00878f" stroke="#005d63" strokeWidth={2.5} />
          {/* Internal copper zones and routed ground planes */}
          <rect x={6} y={17} width={308} height={166} rx={6} fill="#007a82" opacity={0.8} />
          <path d="M 8,36 L 44,36 L 54,86 L 8,86 Z" fill="#006b72" opacity={0.6} />
          <path d="M 268,26 L 312,26 L 312,174 L 268,174 Z" fill="#006b72" opacity={0.5} />
          {/* Subtle gold PCB via pads */}
          {[
            { cx: 72, cy: 30 }, { cx: 78, cy: 30 }, { cx: 72, cy: 36 },
            { cx: 270, cy: 88 }, { cx: 270, cy: 94 }, { cx: 270, cy: 100 },
            { cx: 110, cy: 154 }, { cx: 116, cy: 154 },
          ].map((v, i) => (
            <circle key={i} cx={v.cx} cy={v.cy} r={1.2} fill="#eab308" stroke="#ca8a04" strokeWidth={0.5} />
          ))}

          {/* Brass corner mounting holes */}
          {[
            { cx: 16, cy: 16 },
            { cx: 306, cy: 16 },
            { cx: 64, cy: 184 },
            { cx: 306, cy: 184 },
          ].map((h, i) => (
            <g key={i}>
              <circle cx={h.cx} cy={h.cy} r={6.5} fill="#eab308" stroke="#ca8a04" strokeWidth={1} />
              <circle cx={h.cx} cy={h.cy} r={4} fill="#0f172a" />
            </g>
          ))}

          {/* Metallic USB Type-B Port */}
          <g>
            <rect x={-6} y={36} width={34} height={48} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1.5} />
            <rect x={-6} y={40} width={28} height={40} rx={2} fill="#94a3b8" />
            <rect x={-2} y={45} width={20} height={30} rx={2} fill="#334155" />
            <rect x={2} y={53} width={12} height={14} fill="#0f172a" />
          </g>

          {/* 2.1mm DC Barrel Power Jack */}
          <g>
            <rect x={-6} y={118} width={32} height={42} rx={4} fill="#1e293b" stroke="#090d16" strokeWidth={2} />
            <rect x={-6} y={124} width={26} height={30} rx={2} fill="#0f172a" />
            <circle cx={4} cy={139} r={5} fill="#475569" />
            <circle cx={4} cy={139} r={2.5} fill="#cbd5e1" />
          </g>

          {/* 16.000 MHz Crystal Oscillator */}
          <g>
            <rect x={76} y={52} width={24} height={15} rx={6} fill="#e2e8f0" stroke="#64748b" strokeWidth={1} />
            <rect x={78} y={54} width={20} height={11} rx={4} fill="#f1f5f9" />
            <text x={88} y={62.5} textAnchor="middle" fontSize={5.5} fill="#334155" fontFamily="system-ui, sans-serif" fontWeight={800}>
              16.000
            </text>
          </g>

          {/* 5V Voltage Regulator & SMT Caps */}
          <g>
            <rect x={66} y={134} width={18} height={15} rx={1} fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
            <rect x={70} y={130} width={10} height={4} fill="#64748b" />
            <rect x={68} y={149} width={3.5} height={4} fill="#94a3b8" />
            <rect x={73.5} y={149} width={3.5} height={4} fill="#94a3b8" />
            <rect x={79} y={149} width={3.5} height={4} fill="#94a3b8" />
            {/* Capacitors */}
            <circle cx={48} cy={144} r={6} fill="#334155" stroke="#64748b" strokeWidth={1} />
            <path d="M 44,141 L 52,141" stroke="#cbd5e1" strokeWidth={1} />
            <circle cx={48} cy={166} r={6} fill="#334155" stroke="#64748b" strokeWidth={1} />
            <path d="M 44,163 L 52,163" stroke="#cbd5e1" strokeWidth={1} />
          </g>

          {/* ATmega328P DIP-28 Microcontroller with socket & pins */}
          <g>
            {/* DIP Socket Base */}
            <rect x={120} y={90} width={138} height={58} rx={3} fill="#111827" stroke="#374151" strokeWidth={1.2} />
            {/* 28 IC Silver Lead Pins (14 on top, 14 on bottom) */}
            {Array.from({ length: 14 }).map((_, i) => (
              <g key={i}>
                <rect x={126 + i * 9.2} y={85} width={4} height={6} fill="#cbd5e1" rx={0.5} stroke="#64748b" strokeWidth={0.5} />
                <rect x={126 + i * 9.2} y={147} width={4} height={6} fill="#cbd5e1" rx={0.5} stroke="#64748b" strokeWidth={0.5} />
              </g>
            ))}
            {/* Main IC Package */}
            <rect x={124} y={92} width={130} height={54} rx={2} fill="#1c2430" />
            {/* Pin 1 semicircular orientation notch */}
            <path d="M 124,114 A 5,5 0 0,0 124,124 Z" fill="#111827" />
            <circle cx={133} cy={100} r={2.2} fill="#111827" stroke="#374151" strokeWidth={0.6} />
            {/* High-contrast laser-etched silkscreen on chip */}
            <text x={189} y={117} textAnchor="middle" fontSize={11} fill="#f8fafc" fontFamily="monospace" fontWeight={800} letterSpacing="0.08em">
              ATMEGA328P-PU
            </text>
            <text x={189} y={132} textAnchor="middle" fontSize={7.5} fill="#94a3b8" fontFamily="monospace" fontWeight={600} letterSpacing="0.05em">
              MICROCHIP 2348
            </text>
          </g>

          {/* Interactive Red Tactile Reset Switch */}
          <g className="cursor-pointer">
            <rect x={38} y={94} width={22} height={22} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />
            <circle cx={49} cy={105} r={7} fill="#dc2626" stroke="#991b1b" strokeWidth={1.2} />
            <circle cx={48.5} cy={104.5} r={3.5} fill="#ef4444" />
            <text x={49} y={124} textAnchor="middle" fontSize={6.5} fill="#ffffff" fontFamily="system-ui, sans-serif" fontWeight={800}>
              RESET
            </text>
          </g>

          {/* Top Female Header Socket */}
          <rect x={14} y={1} width={292} height={14} rx={2} fill="#111827" stroke="#1f2937" strokeWidth={1} />

          {/* Top Header Pin Sockets, Clean High-Contrast Labels */}
          {TOP_PINS_META.map((pin, i) => {
            const px = Math.round(22 + (i / 15) * 276)
            return (
              <g key={pin.id}>
                {/* Outer socket cell */}
                <rect x={px - 6.5} y={1.5} width={13} height={13} rx={1.5} fill="#182026" stroke="#2d3748" strokeWidth={0.8} />
                {/* Inner pin socket hole (matches canvas pin circle center at y=8) */}
                <rect x={px - 4} y={4} width={8} height={8} rx={1} fill="#0b0f17" stroke="#374151" strokeWidth={0.8} />
                <rect x={px - 2} y={5.5} width={4} height={5} fill="#4b5563" />

                {/* Crystal-clear Pin Label */}
                {pin.sub ? (
                  <>
                    <text x={px} y={23} textAnchor="middle" fontSize={8} fill="#ffffff" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800}>
                      {pin.label}
                    </text>
                    <text x={px} y={31} textAnchor="middle" fontSize={5.5} fill="#38bdf8" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800}>
                      {pin.sub}
                    </text>
                  </>
                ) : pin.isPwm ? (
                  <text x={px} y={25} textAnchor="middle" fontSize={8} fill="#ffffff" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800}>
                    <tspan fill="#f59e0b" fontWeight={900}>~</tspan>{pin.label}
                  </text>
                ) : (
                  <text x={px} y={25} textAnchor="middle" fontSize={pin.label.length > 2 ? 6.5 : 8} fill="#ffffff" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800}>
                    {pin.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Top Silkscreen Section Brackets */}
          <path d="M 52,32 L 52,34 L 268,34 L 268,32" stroke="#ffffff" strokeWidth={0.8} fill="none" opacity={0.85} />
          <text x={160} y={42} textAnchor="middle" fill="#ffffff" fontSize={6.5} fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800} letterSpacing="0.08em">
            DIGITAL (PWM ~)
          </text>
          <path d="M 274,32 L 274,34 L 304,34 L 304,32" stroke="#38bdf8" strokeWidth={0.8} fill="none" opacity={0.85} />
          <text x={289} y={42} textAnchor="middle" fill="#38bdf8" fontSize={6} fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800} letterSpacing="0.06em">
            COMM
          </text>

          {/* Bottom Female Header Socket */}
          <rect x={30} y={185} width={260} height={14} rx={2} fill="#111827" stroke="#1f2937" strokeWidth={1} />

          {/* Bottom Header Pin Sockets, Clean High-Contrast Labels */}
          {BOTTOM_PINS_META.map((pin, i) => {
            const px = Math.round(40 + (i / 10) * 240)
            return (
              <g key={pin.id}>
                {/* Outer socket cell */}
                <rect x={px - 6.5} y={186} width={13} height={12} rx={1.5} fill="#182026" stroke="#2d3748" strokeWidth={0.8} />
                {/* Inner pin socket hole (matches canvas pin circle center at y=192) */}
                <rect x={px - 4} y={188} width={8} height={8} rx={1} fill="#0b0f17" stroke="#374151" strokeWidth={0.8} />
                <rect x={px - 2} y={189.5} width={4} height={5} fill="#4b5563" />

                {/* Pin label text */}
                <text
                  x={px}
                  y={179}
                  textAnchor="middle"
                  fontSize={pin.label.length > 3 ? 6.5 : 7.5}
                  fill={pin.isAnalog ? "#38bdf8" : "#ffffff"}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight={800}
                >
                  {pin.label}
                </text>
              </g>
            )
          })}

          {/* Bottom Silkscreen Section Brackets */}
          <path d="M 34,171 L 34,169 L 142,169 L 142,171" stroke="#ffffff" strokeWidth={0.8} fill="none" opacity={0.85} />
          <text x={88} y={164} textAnchor="middle" fill="#ffffff" fontSize={6.5} fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800} letterSpacing="0.08em">
            POWER
          </text>
          <path d="M 154,171 L 154,169 L 286,169 L 286,171" stroke="#38bdf8" strokeWidth={0.8} fill="none" opacity={0.85} />
          <text x={220} y={164} textAnchor="middle" fill="#38bdf8" fontSize={6.5} fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800} letterSpacing="0.08em">
            ANALOG IN
          </text>

          {/* Silkscreen Board Branding & Iconic Infinity Loop */}
          <g transform="translate(142, 50)">
            <path d="M 0,6 C 0,0 10,0 14,6 C 18,12 28,12 28,6 C 28,0 18,0 14,6 C 10,12 0,12 0,6 Z" fill="none" stroke="#ffffff" strokeWidth={2.4} />
            <text x={4.5} y={8} fontSize={7} fill="#ffffff" fontWeight={900}>-</text>
            <text x={20.5} y={8} fontSize={7} fill="#ffffff" fontWeight={900}>+</text>
          </g>
          <text x={180} y={56} fontSize={13} fill="#ffffff" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={900} letterSpacing="0.08em">
            ARDUINO
          </text>
          <text x={180} y={70} fontSize={10} fill="#99f6e4" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={800} letterSpacing="0.04em">
            UNO R3
          </text>
          <text x={180} y={80} fontSize={6.5} fill="#cbd5e1" fontFamily="system-ui, -apple-system, sans-serif" fontWeight={700} letterSpacing="0.08em">
            MADE IN ITALY
          </text>

          {/* Onboard Status LEDs: ON, L, TX, RX */}
          {/* ON Power LED (Green) */}
          <g>
            <circle cx={98} cy={105} r={3.5} fill="#22c55e" stroke="#15803d" strokeWidth={0.8} />
            <circle cx={98} cy={105} r={6} fill="#22c55e" opacity={0.4} />
            <text x={98} y={116} textAnchor="middle" fontSize={6} fill="#ffffff" fontFamily="system-ui, sans-serif" fontWeight={800}>
              ON
            </text>
          </g>

          {/* Built-in L LED (Pin 13 Indicator) */}
          <g>
            <circle
              cx={108}
              cy={60}
              r={3.5}
              fill={runtime?.pin13High ? "#f59e0b" : "#78350f"}
              stroke={runtime?.pin13High ? "#ffffff" : "#451a03"}
              strokeWidth={0.8}
            />
            {runtime?.pin13High && <circle cx={108} cy={60} r={7} fill="#f59e0b" opacity={0.5} />}
            <text x={117} y={62.5} fontSize={7} fill="#ffffff" fontFamily="system-ui, sans-serif" fontWeight={800}>
              L
            </text>
          </g>

          {/* TX & RX LEDs */}
          <g>
            <circle cx={108} cy={72} r={3} fill="#78350f" stroke="#451a03" strokeWidth={0.6} />
            <text x={117} y={74} fontSize={6} fill="#cbd5e1" fontFamily="system-ui, sans-serif" fontWeight={700}>
              TX
            </text>
            <circle cx={108} cy={83} r={3} fill="#78350f" stroke="#451a03" strokeWidth={0.6} />
            <text x={117} y={85} fontSize={6} fill="#cbd5e1" fontFamily="system-ui, sans-serif" fontWeight={700}>
              RX
            </text>
          </g>
        </g>
      )
    }

    case "esp32-devkit": {
      const LEFT_LABELS = [
        { id: "en", label: "EN", color: "#94a3b8" },
        { id: "vp", label: "VP", color: "#fcd34d" },
        { id: "vn", label: "VN", color: "#fcd34d" },
        { id: "d34", label: "D34", color: "#fcd34d" },
        { id: "d35", label: "D35", color: "#fcd34d" },
        { id: "d32", label: "D32", color: "#38bdf8" },
        { id: "d33", label: "D33", color: "#38bdf8" },
        { id: "d25", label: "D25", color: "#38bdf8" },
        { id: "d26", label: "D26", color: "#38bdf8" },
        { id: "d27", label: "D27", color: "#38bdf8" },
        { id: "d14", label: "D14", color: "#38bdf8" },
        { id: "d12", label: "D12", color: "#38bdf8" },
        { id: "d13", label: "D13", color: "#38bdf8" },
        { id: "gnd_l", label: "GND", color: "#cbd5e1" },
        { id: "vin", label: "VIN", color: "#f87171" },
      ]

      const RIGHT_LABELS = [
        { id: "d23", label: "D23", color: "#38bdf8" },
        { id: "d22", label: "D22", color: "#38bdf8" },
        { id: "tx0", label: "TX0", color: "#cbd5e1" },
        { id: "rx0", label: "RX0", color: "#cbd5e1" },
        { id: "d21", label: "D21", color: "#38bdf8" },
        { id: "d19", label: "D19", color: "#38bdf8" },
        { id: "d18", label: "D18", color: "#38bdf8" },
        { id: "d5", label: "D5", color: "#38bdf8" },
        { id: "tx2", label: "TX2", color: "#cbd5e1" },
        { id: "rx2", label: "RX2", color: "#cbd5e1" },
        { id: "d4", label: "D4", color: "#38bdf8" },
        { id: "d2", label: "D2", color: "#60a5fa" },
        { id: "d15", label: "D15", color: "#38bdf8" },
        { id: "gnd_r", label: "GND", color: "#cbd5e1" },
        { id: "3v3", label: "3V3", color: "#f87171" },
      ]

      return (
        <g className="select-none">
          {/* Main PCB substrate - Matte Charcoal Black */}
          <rect x={0} y={0} width={240} height={370} rx={12} fill="#121316" stroke="#272b35" strokeWidth={2.5} />
          {/* Inner routing area */}
          <rect x={22} y={16} width={196} height={338} rx={6} fill="#0d0e11" opacity={0.6} />

          {/* 4 Corner mounting holes with gold pads */}
          {[
            { cx: 14, cy: 14 },
            { cx: 226, cy: 14 },
            { cx: 14, cy: 356 },
            { cx: 226, cy: 356 },
          ].map((h, i) => (
            <g key={i}>
              <circle cx={h.cx} cy={h.cy} r={5.5} fill="#eab308" stroke="#ca8a04" strokeWidth={0.8} />
              <circle cx={h.cx} cy={h.cy} r={3.2} fill="#020617" />
            </g>
          ))}

          {/* Onboard 2.4GHz Inverted-F Meandering PCB Antenna */}
          <g>
            <rect x={56} y={16} width={128} height={42} rx={3} fill="#0a0a0d" stroke="#1f242d" strokeWidth={1} />
            <path
              d="M 64,48 L 74,48 L 74,24 L 84,24 L 84,48 L 94,48 L 94,24 L 104,24 L 104,48 L 114,48 L 114,24 L 124,24 L 124,48 L 134,48 L 134,24 L 144,24 L 144,48 L 154,48 L 154,24 L 164,24 L 164,48 L 174,48"
              fill="none"
              stroke="#eab308"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>

          {/* ESP-WROOM-32 Laser-Engraved Metal RF Shield */}
          <g>
            <rect x={50} y={64} width={140} height={132} rx={5} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.5} />
            <rect x={53} y={67} width={134} height={126} rx={3} fill="#94a3b8" opacity={0.3} />
            {/* Shield Engravings */}
            <text x={120} y={92} textAnchor="middle" fontSize={11} fill="#1e293b" fontFamily="system-ui, sans-serif" fontWeight={900} letterSpacing={2}>
              ESPRESSIF
            </text>
            <text x={120} y={114} textAnchor="middle" fontSize={13} fill="#0f172a" fontFamily="monospace" fontWeight={800}>
              ESP-WROOM-32
            </text>
            <text x={120} y={134} textAnchor="middle" fontSize={7.5} fill="#334155" fontFamily="monospace" fontWeight={600}>
              FCC ID: 2AC7Z-ESPWROOM32
            </text>
            <text x={120} y={148} textAnchor="middle" fontSize={7} fill="#334155" fontFamily="monospace">
              2.4GHz WiFi + BLE 4.2
            </text>
            <text x={120} y={166} textAnchor="middle" fontSize={7} fill="#475569" fontFamily="monospace">
              CE 0700 · RoHS Compliant
            </text>
          </g>

          {/* CP2102 / CH340 USB-to-UART Bridge IC */}
          <g>
            <rect x={96} y={232} width={48} height={42} rx={2} fill="#1e293b" stroke="#090d16" strokeWidth={1.5} />
            <circle cx={102} cy={238} r={1.5} fill="#94a3b8" />
            <text x={120} y={256} textAnchor="middle" fontSize={8} fill="#e2e8f0" fontFamily="monospace" fontWeight={700}>
              CP2102
            </text>
          </g>

          {/* AMS1117-3.3 Linear Voltage Regulator */}
          <g>
            <rect x={52} y={242} width={30} height={20} rx={1.5} fill="#1e293b" stroke="#0f172a" strokeWidth={1} />
            <rect x={58} y={238} width={18} height={4} fill="#64748b" />
            <text x={67} y={255} textAnchor="middle" fontSize={6} fill="#cbd5e1" fontFamily="monospace" fontWeight={700}>
              3.3V
            </text>
          </g>

          {/* Status LEDs */}
          <g>
            {/* PWR Red LED */}
            <circle cx={78} cy={212} r={3} fill="#ef4444" stroke="#991b1b" strokeWidth={0.8} />
            <circle cx={78} cy={212} r={1.2} fill="#fca5a5" />
            <text x={78} y={204} textAnchor="middle" fontSize={6} fill="#94a3b8" fontFamily="monospace" fontWeight={700}>
              PWR
            </text>

            {/* D2 User Blue LED (Active when GPIO2 / D2 is HIGH) */}
            <circle
              cx={162}
              cy={212}
              r={3}
              fill={runtime?.pin2High ? "#60a5fa" : "#1e3a8a"}
              stroke={runtime?.pin2High ? "#bfdbfe" : "#172554"}
              strokeWidth={0.8}
            />
            {runtime?.pin2High && <circle cx={162} cy={212} r={7} fill="#3b82f6" opacity={0.5} />}
            <circle cx={162} cy={212} r={1.2} fill={runtime?.pin2High ? "#ffffff" : "#3b82f6"} />
            <text x={162} y={204} textAnchor="middle" fontSize={6} fill={runtime?.pin2High ? "#93c5fd" : "#94a3b8"} fontFamily="monospace" fontWeight={700}>
              D2/LED
            </text>
          </g>

          {/* Reset / EN Tactile Button */}
          <g>
            <rect x={28} y={328} width={22} height={22} rx={2.5} fill="#334155" stroke="#1e293b" strokeWidth={1} />
            <circle cx={39} cy={339} r={6} fill="#dc2626" stroke="#991b1b" strokeWidth={1} />
            <text x={39} y={322} textAnchor="middle" fontSize={7} fill="#f87171" fontFamily="monospace" fontWeight={800}>
              EN
            </text>
          </g>

          {/* BOOT Tactile Button */}
          <g>
            <rect x={190} y={328} width={22} height={22} rx={2.5} fill="#334155" stroke="#1e293b" strokeWidth={1} />
            <circle cx={201} cy={339} r={6} fill="#1e293b" stroke="#0f172a" strokeWidth={1} />
            <text x={201} y={322} textAnchor="middle" fontSize={7} fill="#94a3b8" fontFamily="monospace" fontWeight={800}>
              BOOT
            </text>
          </g>

          {/* Micro-USB Port at bottom */}
          <g>
            <rect x={88} y={342} width={64} height={30} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1.5} />
            <rect x={94} y={352} width={52} height={16} rx={2} fill="#1e293b" />
            <rect x={104} y={356} width={32} height={8} fill="#090d16" />
          </g>

          {/* Dual Pin Header Sockets and Silkscreen Labels */}
          {/* Left Socket Strip */}
          <rect x={3} y={24} width={18} height={324} rx={2} fill="#0a0a0f" stroke="#1e293b" strokeWidth={1} />
          {/* Right Socket Strip */}
          <rect x={219} y={24} width={18} height={324} rx={2} fill="#0a0a0f" stroke="#1e293b" strokeWidth={1} />

          {/* Left Pins */}
          {LEFT_LABELS.map((item, i) => {
            const py = 35 + i * 22
            return (
              <g key={item.id}>
                {/* Pin Socket Hole */}
                <circle cx={12} cy={py} r={4.5} fill="#eab308" stroke="#ca8a04" strokeWidth={0.8} />
                <circle cx={12} cy={py} r={2.5} fill="#020617" />
                {/* Silkscreen Pin Label */}
                <text x={25} y={py + 3} textAnchor="start" fontSize={7.5} fill={item.color} fontFamily="monospace" fontWeight={700}>
                  {item.label}
                </text>
              </g>
            )
          })}

          {/* Right Pins */}
          {RIGHT_LABELS.map((item, i) => {
            const py = 35 + i * 22
            return (
              <g key={item.id}>
                {/* Pin Socket Hole */}
                <circle cx={228} cy={py} r={4.5} fill="#eab308" stroke="#ca8a04" strokeWidth={0.8} />
                <circle cx={228} cy={py} r={2.5} fill="#020617" />
                {/* Silkscreen Pin Label */}
                <text x={215} y={py + 3} textAnchor="end" fontSize={7.5} fill={item.color} fontFamily="monospace" fontWeight={700}>
                  {item.label}
                </text>
              </g>
            )
          })}

          {/* Center Brand Silkscreen */}
          <text x={120} y={305} textAnchor="middle" fontSize={8} fill="#38bdf8" fontFamily="monospace" fontWeight={700} letterSpacing={1}>
            PIXIU CYBERLAB
          </text>
          <text x={120} y={317} textAnchor="middle" fontSize={6.5} fill="#64748b" fontFamily="system-ui, sans-serif" fontWeight={600}>
            ESP32 NodeMCU-32S · 3.3V
          </text>
        </g>
      )
    }

    case "rpi-pico": {
      return (
        <g className="select-none">
          <rect x={0} y={0} width={220} height={380} rx={10} fill="#059669" stroke="#047857" strokeWidth={2.5} />
          <rect x={16} y={20} width={188} height={340} rx={6} fill="#047857" opacity={0.6} />

          {/* RP2040 chip */}
          <rect x={82} y={150} width={56} height={56} rx={3} fill="#1e293b" stroke="#0f172a" strokeWidth={1.5} />
          <text x={110} y={182} textAnchor="middle" fontSize={9} fill="#f1f5f9" fontFamily="monospace" fontWeight={700}>
            RP2040
          </text>

          {/* USB Port at top */}
          <rect x={86} y={-4} width={48} height={28} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth={1.5} />

          {/* GP25 Onboard Green User LED */}
          <g>
            <rect x={52} y={34} width={12} height={8} rx={1.5} fill="#1e293b" stroke="#0f172a" strokeWidth={0.8} />
            <circle
              cx={58}
              cy={38}
              r={2.5}
              fill={runtime?.pin25High ? "#22c55e" : "#14532d"}
              stroke={runtime?.pin25High ? "#86efac" : "#052e16"}
              strokeWidth={0.6}
            />
            {runtime?.pin25High && <circle cx={58} cy={38} r={6} fill="#22c55e" opacity={0.4} />}
            <text x={58} y={50} textAnchor="middle" fontSize={5} fill={runtime?.pin25High ? "#86efac" : "#6ee7b7"} fontFamily="monospace" fontWeight={700}>
              GP25
            </text>
          </g>

          {/* BOOTSEL Button */}
          <rect x={148} y={55} width={18} height={18} rx={2} fill="#334155" />
          <circle cx={157} cy={64} r={5} fill="#f8fafc" />
          <text x={157} y={80} textAnchor="middle" fontSize={5} fill="#cbd5e1" fontFamily="monospace">
            BOOTSEL
          </text>

          {/* Header Pins Left & Right */}
          {Array.from({ length: 20 }).map((_, i) => (
            <g key={i}>
              <circle cx={12} cy={25 + i * 17.5} r={3.8} fill="#eab308" stroke="#ca8a04" strokeWidth={0.6} />
              <circle cx={12} cy={25 + i * 17.5} r={2} fill="#020617" />
              <circle cx={208} cy={25 + i * 17.5} r={3.8} fill="#eab308" stroke="#ca8a04" strokeWidth={0.6} />
              <circle cx={208} cy={25 + i * 17.5} r={2} fill="#020617" />
            </g>
          ))}

          <text x={110} y={240} textAnchor="middle" fontSize={9} fill="#ecfdf5" fontFamily="monospace" fontWeight={700}>
            Raspberry Pi Pico
          </text>
          <text x={110} y={254} textAnchor="middle" fontSize={7} fill="#a7f3d0" fontFamily="sans-serif">
            RP2040 Dual ARM Cortex-M0+
          </text>
        </g>
      )
    }

    case "microbit-v2": {
      return (
        <g className="select-none">
          <rect x={0} y={0} width={320} height={260} rx={16} fill="#18181b" stroke="#27272a" strokeWidth={2.5} />
          {/* Top Yellow Accents */}
          <path d="M 0,40 Q 160,-20 320,40 L 320,0 L 0,0 Z" fill="#eab308" />

          {/* 5x5 LED Matrix */}
          <g>
            <rect x={110} y={65} width={100} height={100} rx={6} fill="#09090b" stroke="#27272a" />
            {Array.from({ length: 5 }).map((_, r) =>
              Array.from({ length: 5 }).map((__, c) => {
                const isLit = runtime?.matrix5x5?.[r]?.[c] === true
                return (
                  <g key={`${r}-${c}`}>
                    <rect
                      x={120 + c * 16}
                      y={75 + r * 16}
                      width={10}
                      height={10}
                      rx={2}
                      fill={isLit ? "#ef4444" : "#450a0a"}
                      stroke={isLit ? "#fca5a5" : "#7f1d1d"}
                      strokeWidth={isLit ? 1 : 0.5}
                    />
                    {isLit && (
                      <circle
                        cx={125 + c * 16}
                        cy={80 + r * 16}
                        r={6}
                        fill="#ef4444"
                        opacity={0.4}
                      />
                    )}
                  </g>
                )
              }),
            )}
          </g>

          {/* Button A & Button B */}
          <g>
            <circle cx={50} cy={115} r={14} fill="#27272a" stroke="#3f3f46" strokeWidth={1.5} />
            <circle cx={50} cy={115} r={9} fill={runtime?.btnAPressed ? "#38bdf8" : "#09090b"} />
            <text x={50} y={145} textAnchor="middle" fontSize={11} fill={runtime?.btnAPressed ? "#38bdf8" : "#f4f4f5"} fontWeight={700}>
              A
            </text>

            <circle cx={270} cy={115} r={14} fill="#27272a" stroke="#3f3f46" strokeWidth={1.5} />
            <circle cx={270} cy={115} r={9} fill={runtime?.btnBPressed ? "#38bdf8" : "#09090b"} />
            <text x={270} y={145} textAnchor="middle" fontSize={11} fill={runtime?.btnBPressed ? "#38bdf8" : "#f4f4f5"} fontWeight={700}>
              B
            </text>
          </g>

          {/* Gold Edge Connector at bottom */}
          <g>
            <rect x={0} y={230} width={320} height={30} rx={4} fill="#18181b" stroke="#eab308" strokeWidth={1} />
            {[
              { id: "p0", label: "0", x: 40 },
              { id: "p1", label: "1", x: 100 },
              { id: "p2", label: "2", x: 160 },
              { id: "3v", label: "3V", x: 220 },
              { id: "gnd", label: "GND", x: 280 },
            ].map((pin) => (
              <g key={pin.id}>
                <rect x={pin.x - 14} y={232} width={28} height={24} rx={2} fill="#eab308" stroke="#ca8a04" />
                <circle cx={pin.x} cy={248} r={5} fill="#09090b" />
                <text x={pin.x} y={222} textAnchor="middle" fontSize={10} fill="#fef08a" fontWeight={700} fontFamily="monospace">
                  {pin.label}
                </text>
              </g>
            ))}
          </g>

          <text x={160} y={45} textAnchor="middle" fontSize={12} fill="#09090b" fontFamily="sans-serif" fontWeight={800} letterSpacing={1}>
            micro:bit v2
          </text>
        </g>
      )
    }

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
          {[1, 5, 10, 15, BREADBOARD_COLUMNS].map((c) => {
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
            {Number(part.props.voltage ?? 9)}V
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
      const propDigit = part.props.digit !== undefined ? Number(part.props.digit) : undefined
      const effectiveSegs = resolveSevenSegmentSegments(runtime?.segments, propDigit)
      const isSegOn = (id: string) => Boolean(effectiveSegs[id])
      const segColor = (id: string) => (isSegOn(id) ? "#ef4444" : "#1f1f1f")
      const segOpacity = (id: string) => (isSegOn(id) ? 1 : 0.15)
      const segStyle = (id: string) =>
        isSegOn(id) ? { filter: "drop-shadow(0 0 3.5px rgba(239, 68, 68, 0.95))" } : undefined
      const segTextFill = (id: string) => (isSegOn(id) ? "#ffffff" : "#3f3f46")

      const decoded = decodeSevenSegment(effectiveSegs)

      return (
        <g>
          {/* Main Bezel */}
          <rect x={2} y={2} width={56} height={76} rx={4} fill="#0a0a0a" stroke="#27272a" strokeWidth={1.5} />

          {/* Top Pin labels: e, f, g, dp */}
          <text x={5} y={3.8} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">e</text>
          <text x={15} y={3.8} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">f</text>
          <text x={25} y={3.8} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">g</text>
          <text x={35} y={3.8} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">dp</text>

          {/* Bottom Pin labels: a, b, c, d */}
          <text x={5} y={79} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">a</text>
          <text x={15} y={79} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">b</text>
          <text x={25} y={79} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">c</text>
          <text x={35} y={79} textAnchor="middle" fontSize={3} fill="#71717a" fontFamily="monospace">d</text>

          {/* Common pin label on right */}
          <text x={55} y={36} textAnchor="middle" fontSize={2.8} fill="#71717a" fontFamily="monospace">com</text>

          {/* Horizontal segments: a(top), g(mid), d(bottom) */}
          <rect x={14} y={10} width={28} height={5} rx={1.5} fill={segColor("a")} opacity={segOpacity("a")} style={segStyle("a")} />
          <text x={28} y={13.8} textAnchor="middle" fontSize={3.6} fill={segTextFill("a")} fontWeight="bold" pointerEvents="none">a</text>

          <rect x={14} y={36} width={28} height={5} rx={1.5} fill={segColor("g")} opacity={segOpacity("g")} style={segStyle("g")} />
          <text x={28} y={39.8} textAnchor="middle" fontSize={3.6} fill={segTextFill("g")} fontWeight="bold" pointerEvents="none">g</text>

          <rect x={14} y={62} width={28} height={5} rx={1.5} fill={segColor("d")} opacity={segOpacity("d")} style={segStyle("d")} />
          <text x={28} y={65.8} textAnchor="middle" fontSize={3.6} fill={segTextFill("d")} fontWeight="bold" pointerEvents="none">d</text>

          {/* Vertical segments: f(TL), b(TR), e(BL), c(BR) */}
          <rect x={10} y={14} width={5} height={24} rx={1.5} fill={segColor("f")} opacity={segOpacity("f")} style={segStyle("f")} />
          <text x={12.5} y={27} textAnchor="middle" fontSize={3.6} fill={segTextFill("f")} fontWeight="bold" pointerEvents="none">f</text>

          <rect x={41} y={14} width={5} height={24} rx={1.5} fill={segColor("b")} opacity={segOpacity("b")} style={segStyle("b")} />
          <text x={43.5} y={27} textAnchor="middle" fontSize={3.6} fill={segTextFill("b")} fontWeight="bold" pointerEvents="none">b</text>

          <rect x={10} y={40} width={5} height={24} rx={1.5} fill={segColor("e")} opacity={segOpacity("e")} style={segStyle("e")} />
          <text x={12.5} y={53} textAnchor="middle" fontSize={3.6} fill={segTextFill("e")} fontWeight="bold" pointerEvents="none">e</text>

          <rect x={41} y={40} width={5} height={24} rx={1.5} fill={segColor("c")} opacity={segOpacity("c")} style={segStyle("c")} />
          <text x={43.5} y={53} textAnchor="middle" fontSize={3.6} fill={segTextFill("c")} fontWeight="bold" pointerEvents="none">c</text>

          {/* Decimal point */}
          <circle cx={50} cy={66} r={3} fill={segColor("dp")} opacity={segOpacity("dp")} style={segStyle("dp")} />

          {/* On-bezel decoded readout */}
          <rect
            x={15}
            y={70}
            width={26}
            height={6}
            rx={1.5}
            fill="#09090b"
            stroke={decoded.digit !== undefined ? "#22c55e" : decoded.status === "partial" ? "#eab308" : "#27272a"}
            strokeWidth={0.6}
          />
          <text
            x={28}
            y={74.5}
            textAnchor="middle"
            fontSize={3.8}
            fontWeight="bold"
            fontFamily="monospace"
            fill={decoded.digit !== undefined ? "#4ade80" : decoded.status === "partial" ? "#facc15" : "#71717a"}
          >
            {decoded.digit !== undefined ? `VAL: ${decoded.digit}` : decoded.glyph ? `[ ${decoded.glyph} ]` : "OFF"}
          </text>
        </g>
      )
    }


    case "lcd-i2c": {
      const line1 = runtime?.lcdLine1 ?? part.props.line1 ?? ""
      const line2 = runtime?.lcdLine2 ?? part.props.line2 ?? ""
      const backlit = runtime?.lcdBacklight !== false
      const clipId = `lcd-clip-${part.id}`
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <rect x={18} y={14} width={144} height={44} rx={2} />
            </clipPath>
          </defs>
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
          {/* Line 1 text - strictly aligned to 16 columns, lengthAdjust guarantees 0 overflow */}
          <text
            x={24}
            y={32}
            textAnchor="start"
            fontSize={7.8}
            textLength={132}
            lengthAdjust="spacingAndGlyphs"
            fill={backlit ? "#4ade80" : "#1a5c1a"}
            fontFamily="'Courier New', Courier, 'Lucida Console', monospace"
            fontWeight="bold"
            letterSpacing="0.4px"
            clipPath={`url(#${clipId})`}
          >
            {String(line1 || "").slice(0, 16).padEnd(16, " ")}
          </text>
          {/* Line 2 text */}
          <text
            x={24}
            y={48}
            textAnchor="start"
            fontSize={7.8}
            textLength={132}
            lengthAdjust="spacingAndGlyphs"
            fill={backlit ? "#4ade80" : "#1a5c1a"}
            fontFamily="'Courier New', Courier, 'Lucida Console', monospace"
            fontWeight="bold"
            letterSpacing="0.4px"
            clipPath={`url(#${clipId})`}
          >
            {String(line2 || "").slice(0, 16).padEnd(16, " ")}
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
      const isCcw = runtime?.motorDirection === "ccw"
      const duration = Math.max(0.08, 60 / (rpm || 120))
      return (
        <g>
          {/* Motor cylinder body */}
          <ellipse cx={30} cy={30} rx={24} ry={24} fill="#71717a" stroke="#52525b" strokeWidth={2} />
          <ellipse cx={30} cy={30} rx={18} ry={18} fill="#a1a1aa" />
          {/* Center shaft */}
          <circle cx={30} cy={30} r={4} fill="#52525b" stroke="#3f3f46" />
          {/* Shaft marker for rotation */}
          <g
            style={
              spinning
                ? {
                    transformOrigin: "30px 30px",
                    animation: `${isCcw ? "spin-reverse" : "spin"} ${duration}s linear infinite`,
                  }
                : {}
            }
          >
            <line x1={30} y1={30} x2={30} y2={14} stroke="#27272a" strokeWidth={3} strokeLinecap="round" />
            <circle cx={30} cy={14} r={2} fill="#ef4444" />
          </g>
          {/* Terminal tabs */}
          <rect x={10} y={50} width={10} height={8} rx={1} fill="#ef4444" />
          <text x={15} y={57} textAnchor="middle" fontSize={7} fill="#fff" fontWeight={700}>+</text>
          <rect x={40} y={50} width={10} height={8} rx={1} fill="#27272a" />
          <text x={45} y={57} textAnchor="middle" fontSize={7} fill="#fff" fontWeight={700}>−</text>
          {/* RPM readout */}
          {spinning && (
            <text x={30} y={-4} textAnchor="middle" fontSize={8} fill="#a3e635" fontFamily="monospace" fontWeight={700}>
              {rpm} RPM {isCcw ? "CCW" : "CW"}
            </text>
          )}
          {/* Label */}
          <text x={30} y={33} textAnchor="middle" fontSize={7} fill="#3f3f46" fontFamily="sans-serif" fontWeight={700}>M</text>
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
      const line1 = String(runtime?.lcdLine1 ?? part.props.line1 ?? "").slice(0, 16)
      const line2 = String(runtime?.lcdLine2 ?? part.props.line2 ?? "").slice(0, 16)
      const line3 = String(part.props.line3 ?? "").slice(0, 16)
      const clipId = `oled-clip-${part.id}`
      return (
        <g>
          <defs>
            <clipPath id={clipId}>
              <rect x="14" y="16" width="122" height="56" rx="4" />
            </clipPath>
          </defs>
          <rect x="2" y="3" width="146" height="86" rx="9" fill="#111827" stroke="#334155" strokeWidth="2" />
          <rect x="12" y="14" width="126" height="60" rx="5" fill="#03111b" stroke="#0e7490" strokeWidth="1.5" />
          <text x="18" y="31" fontSize="7.8" textLength={114} lengthAdjust="spacingAndGlyphs" fill="#67e8f9" fontFamily="'Courier New', Courier, monospace" clipPath={`url(#${clipId})`}>{(line1 || "PIXIU OLED").padEnd(16, " ")}</text>
          <text x="18" y="47" fontSize="7.8" textLength={114} lengthAdjust="spacingAndGlyphs" fill="#22d3ee" fontFamily="'Courier New', Courier, monospace" clipPath={`url(#${clipId})`}>{(line2 || "READY").padEnd(16, " ")}</text>
          <text x="18" y="63" fontSize="7.8" textLength={114} lengthAdjust="spacingAndGlyphs" fill="#0891b2" fontFamily="'Courier New', Courier, monospace" clipPath={`url(#${clipId})`}>{line3.padEnd(16, " ")}</text>
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
      const speedA = Math.max(
        0,
        Math.min(
          255,
          Number(
            runtime?.motorARpm !== undefined
              ? Math.round((runtime.motorARpm / 1000) * 255)
              : part.props.speedA ?? 0,
          ),
        ),
      )
      const speedB = Math.max(
        0,
        Math.min(
          255,
          Number(
            runtime?.motorBRpm !== undefined
              ? Math.round((runtime.motorBRpm / 1000) * 255)
              : part.props.speedB ?? 0,
          ),
        ),
      )
      const directionA = runtime?.motorADirection ?? "stopped"
      const directionB = runtime?.motorBDirection ?? "stopped"
      const dirShortA = directionA === "stopped" ? "OFF" : directionA.toUpperCase()
      const dirShortB = directionB === "stopped" ? "OFF" : directionB.toUpperCase()
      return (
        <g>
          <rect x="2" y="4" width="116" height="88" rx="7" fill="#153e75" stroke="#1d4ed8" strokeWidth="2" />
          <rect x="46" y="14" width="28" height="34" rx="2" fill="#0f172a" stroke="#334155" />
          <text x="60" y="34" textAnchor="middle" fontSize="8" fill="#cbd5e1" fontFamily="monospace" fontWeight="700">L298N</text>
          <text x="12" y="58" fontSize="6.5" fill="#93c5fd" fontFamily="monospace" fontWeight="600">MOT A: {speedA} ({dirShortA})</text>
          <text x="12" y="67" fontSize="6.5" fill="#38bdf8" fontFamily="monospace" fontWeight="600">MOT B: {speedB} ({dirShortB})</text>
          <rect x="12" y="72" width="96" height="5" rx="2.5" fill="#0f172a" />
          <rect x="12" y="72" width={Math.max(0, 96 * (speedA / 255))} height="5" rx="2.5" fill="#22c55e" />
          <rect x="12" y="80" width="96" height="4" rx="2" fill="#0f172a" />
          <rect x="12" y="80" width={Math.max(0, 96 * (speedB / 255))} height="4" rx="2" fill="#38bdf8" />
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
      const keys = [
        ["1", "2", "3", "A"],
        ["4", "5", "6", "B"],
        ["7", "8", "9", "C"],
        ["CLR", "0", "OK", "D"]
      ]
      const lastKey = String(part.props.lastKey ?? "")
      return (
        <g>
          <rect x="2" y="3" width="114" height="114" rx="8" fill="#111827" stroke="#475569" strokeWidth="2" />
          {keys.flatMap((row, r) => row.map((label, col) => {
            const x = 10 + col * 26
            const y = 12 + r * 26
            const rawKey = label === "OK" ? "#" : label === "CLR" ? "*" : label
            const active = label === lastKey || rawKey === lastKey
            const isOk = label === "OK"
            const isClr = label === "CLR"
            return (
              <g key={label} className="cursor-pointer select-none">
                <rect
                  x={x}
                  y={y}
                  width="20"
                  height="20"
                  rx="5"
                  fill={active ? "#2563eb" : isOk ? "#065f46" : isClr ? "#881337" : "#1e293b"}
                  stroke={active ? "#93c5fd" : isOk ? "#34d399" : isClr ? "#f43f5e" : "#475569"}
                  strokeWidth={active || isOk || isClr ? 1.5 : 1}
                  style={active ? { filter: "drop-shadow(0 0 5px rgba(59, 130, 246, 0.9))" } : undefined}
                />
                <text
                  x={x + 10}
                  y={y + 13}
                  textAnchor="middle"
                  fontSize={isOk || isClr ? "6.5" : "8"}
                  fill={active ? "#ffffff" : isOk ? "#a7f3d0" : isClr ? "#fecdd3" : "#e2e8f0"}
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  {label}
                </text>
              </g>
            )
          }))}
        </g>
      )
    }

    case "neopixel-ring": {
      const colors = runtime?.pixelColors ?? [
        "#ef4444", "#f97316", "#eab308", "#22c55e",
        "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
      ]
      return (
        <g className="select-none">
          {/* Circular Matte Black PCB Ring */}
          <circle cx={50} cy={50} r={48} fill="#090d16" stroke="#1e293b" strokeWidth={2} />
          <circle cx={50} cy={50} r={28} fill="#020617" stroke="#1e293b" strokeWidth={1.5} />

          {/* Golden Copper Ring Solder Tracks */}
          <circle cx={50} cy={50} r={46} fill="none" stroke="#d97706" strokeWidth={0.5} opacity={0.4} />
          <circle cx={50} cy={50} r={30} fill="none" stroke="#d97706" strokeWidth={0.5} opacity={0.4} />

          {/* Solder Pads at Bottom: DI, 5V, GND, DO */}
          {[
            { id: "di", x: 22, y: 92, label: "IN" },
            { id: "vcc", x: 40, y: 92, label: "5V" },
            { id: "gnd", x: 60, y: 92, label: "GND" },
            { id: "do", x: 78, y: 92, label: "OUT" },
          ].map((pad) => (
            <g key={pad.id}>
              <circle cx={pad.x} cy={pad.y} r={4.5} fill="#d97706" stroke="#b45309" strokeWidth={1} />
              <circle cx={pad.x} cy={pad.y} r={2.5} fill="#1e293b" />
              <text x={pad.x} y={pad.y - 7} textAnchor="middle" fontSize={5.5} fill="#fbbf24" fontFamily="monospace" fontWeight={700}>
                {pad.label}
              </text>
            </g>
          ))}

          {/* 8 SMD 5050 RGB LEDs placed radially */}
          {Array.from({ length: 8 }).map((_, i) => {
            const rad = (i * Math.PI * 2) / 8 - Math.PI / 2
            const cx = 50 + Math.cos(rad) * 38
            const cy = 50 + Math.sin(rad) * 38
            const deg = (i * 360) / 8
            const col = colors[i] || "#0f172a"
            const isLit = col !== "#0f172a" && col !== "#000000"
            return (
              <g key={i} transform={`translate(${cx}, ${cy}) rotate(${deg})`}>
                {/* 5050 SMT White Ceramic Package */}
                <rect x={-5.5} y={-5.5} width={11} height={11} rx={1.5} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.6} />
                {/* 4 Corner Solder Contacts */}
                <rect x={-6} y={-4.5} width={1.5} height={2} fill="#94a3b8" />
                <rect x={-6} y={2.5} width={1.5} height={2} fill="#94a3b8" />
                <rect x={4.5} y={-4.5} width={1.5} height={2} fill="#94a3b8" />
                <rect x={4.5} y={2.5} width={1.5} height={2} fill="#94a3b8" />
                {/* Inner circular silicone lens */}
                <circle cx={0} cy={0} r={4} fill={col} stroke="#ffffff" strokeWidth={0.5} />
                {/* Glow filter / halo when illuminated */}
                {isLit && (
                  <circle cx={0} cy={0} r={9} fill={col} opacity={0.35} />
                )}
              </g>
            )
          })}

          {/* Silkscreen text */}
          <text x={50} y={47} textAnchor="middle" fontSize={7} fill="#f8fafc" fontFamily="monospace" fontWeight={800}>
            WS2812B
          </text>
          <text x={50} y={56} textAnchor="middle" fontSize={5.5} fill="#a855f7" fontFamily="monospace" fontWeight={700}>
            8-RGB RING
          </text>
        </g>
      )
    }

    case "mq2-gas": {
      const gasLevel = Number(runtime?.gasLevel ?? part.props.gasLevel ?? 150)
      const threshold = Number(part.props.threshold ?? 350)
      const alert = runtime?.gasAlert ?? (gasLevel >= threshold)
      return (
        <g className="select-none">
          {/* Main PCB substrate */}
          <rect x={2} y={2} width={76} height={86} rx={6} fill="#1e3a8a" stroke="#1d4ed8" strokeWidth={2} />
          <rect x={6} y={6} width={68} height={78} rx={4} fill="#172554" opacity={0.7} />

          {/* Stainless Steel Wire Mesh Sensor Cylinder */}
          <circle cx={40} cy={38} r={25} fill="#475569" stroke="#94a3b8" strokeWidth={2} />
          <circle cx={40} cy={38} r={23} fill="#334155" stroke="#cbd5e1" strokeWidth={1} />
          {/* Concentric perforated mesh rings */}
          <circle cx={40} cy={38} r={17} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 2" />
          <circle cx={40} cy={38} r={11} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 2" />
          <circle cx={40} cy={38} r={5} fill="#1e293b" />
          {/* Gas chamber top label */}
          <text x={40} y={35} textAnchor="middle" fontSize={7} fill="#f8fafc" fontFamily="monospace" fontWeight={800}>
            MQ-2
          </text>
          <text x={40} y={43} textAnchor="middle" fontSize={5} fill="#cbd5e1" fontFamily="monospace">
            GAS SENSOR
          </text>

          {/* Trimpot & Comparator Chip */}
          <rect x={12} y={66} width={12} height={8} rx={1} fill="#0284c7" stroke="#0369a1" strokeWidth={0.5} />
          <circle cx={18} cy={70} r={2} fill="#d97706" />

          {/* Power & Alert LEDs */}
          {/* Power LED (Green) */}
          <circle cx={32} cy={70} r={2} fill="#22c55e" stroke="#16a34a" strokeWidth={0.5} />
          <text x={32} y={66} textAnchor="middle" fontSize={4.5} fill="#86efac">PWR</text>
          {/* D-OUT Alert LED (Red) */}
          <circle cx={44} cy={70} r={2.5} fill={alert ? "#ef4444" : "#450a0a"} stroke="#dc2626" strokeWidth={0.5} />
          {alert && <circle cx={44} cy={70} r={5} fill="#ef4444" opacity={0.5} />}
          <text x={44} y={66} textAnchor="middle" fontSize={4.5} fill={alert ? "#fca5a5" : "#7f1d1d"}>ALRT</text>

          {/* Live PPM Digital Badge */}
          <rect x={52} y={66} width={22} height={8} rx={2} fill="#0f172a" stroke="#334155" strokeWidth={0.5} />
          <text x={63} y={72.5} textAnchor="middle" fontSize={5} fill={alert ? "#f87171" : "#38bdf8"} fontFamily="monospace" fontWeight={700}>
            {gasLevel}PPM
          </text>

          {/* Solder Header Pins at Bottom: VCC, GND, DO, AO */}
          {[
            { id: "vcc", x: 16, y: 84, label: "VCC" },
            { id: "gnd", x: 32, y: 84, label: "GND" },
            { id: "do", x: 48, y: 84, label: "DO" },
            { id: "ao", x: 64, y: 84, label: "AO" },
          ].map((pad) => (
            <g key={pad.id}>
              <circle cx={pad.x} cy={pad.y} r={3} fill="#d97706" stroke="#b45309" strokeWidth={0.8} />
              <circle cx={pad.x} cy={pad.y} r={1.5} fill="#1e293b" />
              <text x={pad.x} y={pad.y - 4.5} textAnchor="middle" fontSize={4.5} fill="#93c5fd" fontFamily="monospace">
                {pad.label}
              </text>
            </g>
          ))}
        </g>
      )
    }

    default:
      return null
  }
}
